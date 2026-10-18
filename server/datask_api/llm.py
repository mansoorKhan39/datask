"""Talks to the AI service (Gemini or Groq). Includes a keyword-based 'mock' provider for local development and tests."""
import json
import re
from datetime import date

import httpx

from .config import get_settings
from .errors import LLMError, PlanError
from .plan import Plan, parse_plan, validate_plan

SYSTEM = """You turn a user's question about a table into a JSON query plan. You never write code.
Reply with ONE JSON object and nothing else, using exactly this shape:
{
  "can_answer": true,
  "reason": null,
  "select": [],
  "filters": [{"col": "<column>", "op": "eq|ne|gt|gte|lt|lte|in|contains|between|is_null|not_null", "value": <value or [lo, hi] or [list]>}],
  "group_by": [{"col": "<column>", "part": null | "year" | "quarter" | "month" | "week" | "weekday" | "day" | "hour"}],
  "metrics": [{"agg": "sum|mean|count|min|max|median|nunique", "col": "<column or null for row count>", "as": "<short label>"}],
  "sort": {"by": "<result column or metric label>", "desc": true} | null,
  "limit": 20,
  "chart": {"type": "bar|line|pie|scatter|number|table", "title": "<short title in the user's language>"},
  "language": "en" | "ur" | "roman_ur"
}
Rules:
- Use ONLY the column names listed in the schema, spelled exactly. "part" may only be used on date columns.
- sum, mean and median only work on number columns. Booleans can be averaged to get a rate.
- Relative dates ("last month", "this year", "pichle mahine", "پچھلے مہینے") are relative to the LATEST date in the data (given as data_end), not the real today, unless the user names a specific date. Use absolute dates (YYYY-MM-DD) in filters. For a whole month use between first-day and last-day.
- "highest / most / sab se zyada" -> group, sort desc, limit 1 (or a short top list if it helps the chart). "lowest / least / sab se kam" -> sort asc.
- Over time / trend / per month -> group_by a date column with part "month" (or day/week/year if asked) and chart type "line".
- Parts of a whole -> chart "pie" (max 8 slices). Comparisons between categories -> "bar". A single total -> "number".
- Text values in filters must match the sample values given (e.g. "Lahore"). Match spelling from the samples when the user writes it differently.
- language: "ur" if the question is written in Urdu script, "roman_ur" if it is Urdu written in English letters, otherwise "en".
- If the question cannot be answered from these columns, set can_answer false and put a short helpful reason (in the user's language) in "reason".
- If the question refers to the previous answer ("and for Lahore?", "ab Lahore ka dikhao"), build on the previous plan given in history.
"""

EXAMPLES = """Examples (for a table with columns city, sales, order_date):
Q: Which city had the highest sales?
{"can_answer":true,"filters":[],"group_by":[{"col":"city"}],"metrics":[{"agg":"sum","col":"sales","as":"total_sales"}],"sort":{"by":"total_sales","desc":true},"limit":1,"chart":{"type":"bar","title":"Sales by city"},"language":"en"}
Q: har mahine ki sales dikhao
{"can_answer":true,"filters":[],"group_by":[{"col":"order_date","part":"month"}],"metrics":[{"agg":"sum","col":"sales","as":"total_sales"}],"limit":60,"chart":{"type":"line","title":"Monthly sales"},"language":"roman_ur"}
Q: کل کتنی فروخت ہوئی؟
{"can_answer":true,"filters":[],"group_by":[],"metrics":[{"agg":"sum","col":"sales","as":"total_sales"}],"limit":1,"chart":{"type":"number","title":"کل فروخت"},"language":"ur"}
"""


# ---------------------------------------------------------------- providers
def _http_error(e: httpx.HTTPStatusError) -> LLMError:
    code = e.response.status_code
    if code == 429:
        return LLMError("The AI service is busy right now (free-plan limit). Please try again in a minute.")
    if code in (401, 403):
        return LLMError("The AI service rejected the server's API key. Check GEMINI_API_KEY / GROQ_API_KEY.")
    if code == 404:
        return LLMError("The AI model name is not available. Check the LLM_MODEL setting.")
    return LLMError("The AI service returned an error. Please try again.")


def _call_gemini(system: str, user: str, json_mode: bool) -> str:
    s = get_settings()
    if not s.gemini_key:
        raise LLMError("The AI service is not configured on the server (missing GEMINI_API_KEY).")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{s.llm_model}:generateContent"
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": 0.1, **({"responseMimeType": "application/json"} if json_mode else {})},
    }
    try:
        r = httpx.post(url, json=body, headers={"x-goog-api-key": s.gemini_key}, timeout=30)
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]
    except httpx.HTTPStatusError as e:
        raise _http_error(e)
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        raise LLMError("The AI service did not respond properly. Please try again.")


def _call_groq(system: str, user: str, json_mode: bool) -> str:
    s = get_settings()
    if not s.groq_key:
        raise LLMError("The AI service is not configured on the server (missing GROQ_API_KEY).")
    body = {
        "model": s.llm_model,
        "temperature": 0.1,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        **({"response_format": {"type": "json_object"}} if json_mode else {}),
    }
    try:
        r = httpx.post("https://api.groq.com/openai/v1/chat/completions", json=body,
                       headers={"Authorization": f"Bearer {s.groq_key}"}, timeout=30)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise _http_error(e)
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        raise LLMError("The AI service did not respond properly. Please try again.")


def _call(system: str, user: str, json_mode: bool) -> str:
    p = get_settings().llm_provider
    if p == "gemini":
        return _call_gemini(system, user, json_mode)
    if p == "groq":
        return _call_groq(system, user, json_mode)
    raise LLMError("The AI service is not configured on the server. Add GEMINI_API_KEY or GROQ_API_KEY.")


# ---------------------------------------------------------------- prompt building
def schema_text(profile: dict, privacy: bool) -> str:
    lines = []
    for c in profile["columns"]:
        line = f'- "{c["name"]}" ({c["kind"]})'
        st = c.get("stats")
        if st and c["kind"] == "date":
            line += f' range {st["min"]} to {st["max"]}'
        elif st and c["kind"] == "number" and not privacy:
            line += f' range {st["min"]} to {st["max"]}'
        if not privacy:
            if c["kind"] in ("category", "boolean") and c.get("top"):
                line += " values: " + ", ".join(str(t["value"]) for t in c["top"])
            elif c.get("samples"):
                line += " e.g. " + ", ".join(str(v) for v in c["samples"])
        lines.append(line)
    return "\n".join(lines)


def data_end(profile: dict) -> str | None:
    ends = [c["stats"]["max"] for c in profile["columns"] if c["kind"] == "date" and c.get("stats")]
    return max(ends) if ends else None


def _extract_json(text: str) -> dict:
    t = text.strip()
    t = re.sub(r"^```(?:json)?|```$", "", t, flags=re.M).strip()
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1:
        raise PlanError("The AI response did not contain JSON.")
    try:
        return json.loads(t[start: end + 1])
    except json.JSONDecodeError:
        raise PlanError("The AI response was not valid JSON.")


def plan_question(question: str, profile: dict, kinds: dict[str, str], history: list[dict], privacy: bool) -> Plan:
    s = get_settings()
    if s.llm_provider == "mock":
        return validate_plan(parse_plan(mock_plan(question, profile, kinds, history)), kinds)

    hist = ""
    if history:
        hist = "History (oldest first):\n" + "\n".join(
            f'Q: {h["q"]}\nPlan: {json.dumps(h["plan"], ensure_ascii=False)}' for h in history[-3:]
        ) + "\n\n"
    user = (
        f"Table has {profile['rows']} rows.\nSchema:\n{schema_text(profile, privacy)}\n\n"
        f"today: {date.today().isoformat()}\ndata_end: {data_end(profile)}\n\n{EXAMPLES}\n{hist}"
        f"Q: {question}\nJSON plan:"
    )
    last_error = ""
    for attempt in range(2):
        prompt = user if not last_error else f"{user}\n\nYour previous reply was rejected: {last_error}\nFix it and reply with the corrected JSON only."
        raw = _call(SYSTEM, prompt, json_mode=True)
        try:
            return validate_plan(parse_plan(_extract_json(raw)), kinds)
        except PlanError as e:
            last_error = str(e)
    raise PlanError(last_error)


def compose_answer(question: str, plan: Plan, result: dict) -> str:
    s = get_settings()
    if s.llm_provider in ("gemini", "groq"):
        sample = [dict(zip(result["columns"], r)) for r in result["rows"][:15]]
        lang = {"en": "English", "ur": "Urdu (Urdu script)", "roman_ur": "Roman Urdu (Urdu in English letters)"}[plan.language]
        prompt = (
            f"Question: {question}\nResult rows (JSON, max 15 shown of {result['row_count']}): {json.dumps(sample, ensure_ascii=False)}\n"
            f"{'The user asked about only the first ' + str(result['highlight']) + ' row(s); the rest are context. ' if result.get('highlight') else ''}"
            f"Write the answer in {lang}, 1 or 2 short sentences, quoting the key numbers exactly as given. No markdown, no preamble."
        )
        try:
            text = _call("You write short, accurate answers about data results. Only use the numbers you are given.", prompt, json_mode=False).strip()
            if text:
                return text
        except LLMError:
            pass
    return template_answer(plan, result)


def _fmt(v) -> str:
    if isinstance(v, float):
        return f"{v:,.2f}".rstrip("0").rstrip(".")
    if isinstance(v, int) and not isinstance(v, bool):
        return f"{v:,}"
    return str(v)


def template_answer(plan: Plan, result: dict) -> str:
    from .executor import metric_phrase
    chart = result.get("chart") or {}
    rows, cols = result["rows"], result["columns"]
    if not rows:
        return "No rows matched your question."
    if chart.get("type") == "number":
        label = chart["label"]
        return f"{label[:1].upper() + label[1:]}: {_fmt(chart['value'])}"
    if result.get("group_names") and result.get("metric_names"):
        phrase = metric_phrase(plan)
        if plan.group_by and plan.group_by[0].part and len(result["group_names"]) == 1 and len(rows) > 1:
            mi = cols.index(result["metric_names"][0])
            hi, lo = max(rows, key=lambda r: r[mi] or 0), min(rows, key=lambda r: r[mi] or 0)
            return f"{phrase[:1].upper() + phrase[1:]} was highest in {_fmt(hi[0])} ({_fmt(hi[mi])}) and lowest in {_fmt(lo[0])} ({_fmt(lo[mi])})."
        first = rows[0]
        value = _fmt(first[cols.index(result["metric_names"][0])])
        if result.get("highlight") == 1:
            word = "lowest" if plan.sort and not plan.sort.desc else "highest"
            return f"{_fmt(first[0])} has the {word} {phrase}: {value}."
        return f"{_fmt(first[0])} comes first with {phrase} of {value}. All {len(rows)} groups are shown below."
    return f"Found {result['row_count']:,} rows."


# ---------------------------------------------------------------- mock provider (development only)
SYNONYMS = {
    "city": ["city", "shehar", "shehr", "sheher", "شہر"],
    "category": ["category", "kism", "type", "زمرہ"],
    "payment": ["payment", "pay", "adaigi"],
    "customer": ["customer", "gahak"],
}


def mock_plan(question: str, profile: dict, kinds: dict[str, str], history: list[dict]) -> dict:
    q = question.lower()
    cols = profile["columns"]
    nums = [c["name"] for c in cols if c["kind"] == "number"]
    cats = [c["name"] for c in cols if c["kind"] in ("category", "boolean", "text")]
    dates = [c["name"] for c in cols if c["kind"] == "date"]
    lang = "ur" if re.search(r"[؀-ۿ]", question) else ("roman_ur" if re.search(r"\b(kya|kis|ki|ka|ke|dikhao|sab se|zyada|kam|mahine|hisab|kitni|kitne|batao)\b", q) else "en")

    def mentioned(names):
        for n in names:
            if n.lower() in q or n.lower().replace("_", " ") in q:
                return n
        for n in names:
            for key, words in SYNONYMS.items():
                if key in n.lower() and any(w in q for w in words):
                    return n
        return None

    metric = mentioned(nums) or next((n for n in nums if re.search(r"sales|revenue|amount|total", n, re.I)), nums[0] if nums else None)
    dim = mentioned(cats)
    agg = "sum"
    if re.search(r"average|avg|mean|ausat", q):
        agg = "mean"
    elif re.search(r"how many|count|kitne|number of", q):
        agg = "count"
    filters = []
    end = data_end(profile)
    if dates and end and re.search(r"last month|pichle mahine|پچھلے مہینے", q):
        y, m = int(end[:4]), int(end[5:7])
        py_, pm = (y - 1, 12) if m == 1 else (y, m - 1)
        first = f"{py_}-{pm:02d}-01"
        import calendar
        last = f"{py_}-{pm:02d}-{calendar.monthrange(py_, pm)[1]:02d}"
        filters.append({"col": dates[0], "op": "between", "value": [first, last]})
    group = []
    chart = "bar"
    limit = 10
    if dates and re.search(r"month|mahine|monthly|trend|over time|مہینے", q) and not filters:
        group = [{"col": dates[0], "part": "month"}]
        chart, limit = "line", 60
    elif dim:
        group = [{"col": dim}]
    top = re.search(r"top (\d+)", q)
    if top:
        limit = int(top.group(1))
    elif re.search(r"highest|most|sab se zyada|سب سے زیادہ|best|top", q):
        limit = 1 if not re.search(r"show|dikhao", q) else limit
    word = {"sum": "total", "mean": "average"}.get(agg, agg)
    metrics = [{"agg": "count", "as": "rows"}] if (agg == "count" or not metric) else [{"agg": agg, "col": metric, "as": f"{word}_{metric}"}]
    if not group and not re.search(r"total|how many|kul|kitni|sum|average|avg", q) and dim is None:
        group = []
    asc = bool(re.search(r"lowest|least|sab se kam|سب سے کم", q))
    return {
        "can_answer": True, "filters": filters, "group_by": group, "metrics": metrics,
        "sort": {"by": metrics[0]["as"], "desc": not asc} if group and chart != "line" else None,
        "limit": limit, "chart": {"type": chart if group else "number", "title": None}, "language": lang,
    }
