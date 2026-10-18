"""Runs a validated Plan on a DataFrame with pandas. Nothing here evaluates text as code."""
from typing import Any

import numpy as np
import pandas as pd

from .errors import PlanError
from .plan import Plan
from .profiling import py

MAX_RESULT_ROWS = 200
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
OP_WORDS = {"eq": "=", "ne": "≠", "gt": ">", "gte": "≥", "lt": "<", "lte": "≤"}


def _coerce(value: Any, kind: str) -> Any:
    try:
        if kind == "number":
            return float(str(value).replace(",", ""))
        if kind == "date":
            ts = pd.to_datetime(value, errors="raise")
            return ts
        if kind == "boolean":
            return str(value).lower() in ("true", "yes", "y", "1", "t")
    except (ValueError, TypeError):
        raise PlanError(f"Could not use '{value}' as a {kind} value.")
    return str(value)


def _apply_filter(df: pd.DataFrame, f, kinds: dict[str, str]) -> tuple[pd.DataFrame, str]:
    s, kind = df[f.col], kinds[f.col]
    op = f.op
    if op == "is_null":
        return df[s.isna()], f"Kept rows where {f.col} is empty"
    if op == "not_null":
        return df[s.notna()], f"Kept rows where {f.col} is filled"
    if op == "between":
        lo, hi = _coerce(f.value[0], kind), _coerce(f.value[1], kind)
        if kind == "date":
            hi = hi + pd.Timedelta(days=1) - pd.Timedelta(microseconds=1) if hi == hi.normalize() else hi
        return df[(s >= lo) & (s <= hi)], f"Kept rows where {f.col} is between {py(lo) if kind != 'date' else str(lo)[:10]} and {py(hi) if kind != 'date' else str(hi)[:10]}"
    if op == "in":
        vals = [_coerce(v, kind) for v in f.value]
        if kind in ("category", "text"):
            low = {v.lower().strip() for v in vals}
            mask = s.astype("string").str.lower().str.strip().isin(low)
        else:
            mask = s.isin(vals)
        return df[mask], f"Kept rows where {f.col} is one of {', '.join(str(v) for v in f.value)}"
    if op == "contains":
        mask = s.astype("string").str.contains(str(f.value), case=False, regex=False, na=False)
        return df[mask], f"Kept rows where {f.col} contains “{f.value}”"
    val = _coerce(f.value, kind)
    if kind in ("category", "text") and op in ("eq", "ne"):
        eq = s.astype("string").str.lower().str.strip() == str(val).lower().strip()
        mask = eq if op == "eq" else ~eq.fillna(False)
        return df[mask.fillna(False)], f"Kept rows where {f.col} {OP_WORDS[op]} {val}"
    if kind == "boolean":
        eq = s == val
        return df[eq if op == "eq" else ~eq], f"Kept rows where {f.col} {OP_WORDS[op]} {val}"
    cmp = {"eq": s == val, "ne": s != val, "gt": s > val, "gte": s >= val, "lt": s < val, "lte": s <= val}[op]
    shown = str(val)[:10] if kind == "date" else py(val)
    return df[cmp.fillna(False)], f"Kept rows where {f.col} {OP_WORDS[op]} {shown}"


def _derive(df: pd.DataFrame, col: str, part: str | None) -> tuple[pd.Series, str]:
    if not part:
        return df[col], col
    s = df[col]
    name = f"{col} ({part})"
    if part == "year":
        return s.dt.year.astype("Int64").astype("string"), name
    if part == "quarter":
        return (s.dt.year.astype("Int64").astype("string") + "-Q" + s.dt.quarter.astype("Int64").astype("string")), name
    if part == "month":
        return s.dt.strftime("%Y-%m"), name
    if part == "week":
        return s.dt.to_period("W").dt.start_time.dt.strftime("%Y-%m-%d"), name
    if part == "weekday":
        return s.dt.day_name(), name
    if part == "day":
        return s.dt.strftime("%Y-%m-%d"), name
    if part == "hour":
        return s.dt.hour.astype("Int64"), name
    raise PlanError(f"Unsupported date part {part}.")


def _metric_names(plan: Plan) -> list[str]:
    names: list[str] = []
    for m in plan.metrics:
        base = m.label or (f"{m.agg}_{m.col}" if m.col else "count")
        name, i = base, 2
        while name in names:
            name, i = f"{base}_{i}", i + 1
        names.append(name)
    return names


def execute(df: pd.DataFrame, kinds: dict[str, str], plan: Plan) -> dict:
    steps: list[str] = [f"Started with {len(df):,} rows"]
    for f in plan.filters:
        df, text = _apply_filter(df, f, kinds)
        steps.append(f"{text} → {len(df):,} rows left")
    if df.empty:
        return {"columns": [], "rows": [], "truncated": False, "row_count": 0, "steps": steps + ["No rows matched"], "chart": None, "empty": True}

    metric_names = _metric_names(plan)
    group_names: list[str] = []
    time_grouped = False

    if plan.metrics:
        work = pd.DataFrame(index=df.index)
        keys = []
        for g in plan.group_by:
            series, name = _derive(df, g.col, g.part)
            work[name] = series
            keys.append(name)
            group_names.append(name)
            time_grouped = time_grouped or bool(g.part)
            steps.append(f"Grouped by {name}")
        aggs = {}
        for m, name in zip(plan.metrics, metric_names):
            if m.col:
                col_name = f"__v_{name}"
                src = df[m.col]
                if kinds[m.col] == "boolean":
                    src = src.map(lambda v: np.nan if pd.isna(v) else float(bool(v)))
                work[col_name] = src
                aggs[name] = (col_name, m.agg)
                steps.append(f"Calculated {m.agg} of {m.col}")
            else:
                work["__rows"] = 1
                aggs[name] = ("__rows", "sum")
                steps.append("Counted rows")
        if keys:
            res = work.groupby(keys, dropna=True, sort=False).agg(**aggs).reset_index()
        else:
            res = pd.DataFrame([{name: getattr(work[col], agg if agg != "sum" or col != "__rows" else "sum")() if agg != "nunique" else work[col].nunique() for name, (col, agg) in aggs.items()}])
    else:
        cols = plan.select or list(df.columns)
        res = df[cols].copy()
        steps.append(f"Selected columns: {', '.join(cols)}")

    # ---- sorting ----
    weekday_group = any(g.part == "weekday" for g in plan.group_by)
    if plan.sort:
        by = next((c for c in res.columns if c.lower() == plan.sort.by.lower()), None)
        if by is None:
            by = next((n for n in metric_names if plan.sort.by.lower() in n.lower()), None)
        if by is not None:
            res = res.sort_values(by, ascending=not plan.sort.desc, kind="stable")
            steps.append(f"Sorted by {by} ({'high to low' if plan.sort.desc else 'low to high'})")
    elif plan.metrics and group_names:
        if time_grouped and not weekday_group:
            res = res.sort_values(group_names, kind="stable")
        elif weekday_group:
            res["__o"] = res[group_names[0]].map(lambda d: WEEKDAYS.index(d) if d in WEEKDAYS else 99)
            res = res.sort_values("__o").drop(columns="__o")
        else:
            res = res.sort_values(metric_names[0], ascending=False, kind="stable")
            steps.append(f"Sorted by {metric_names[0]} (high to low)")

    limit = plan.limit
    highlight = 0
    if time_grouped and not plan.sort:
        limit = max(limit, 60)
    elif group_names and plan.metrics and not time_grouped and limit < 8 and len(res) > limit:
        highlight, limit = limit, 8  # "which city is highest?" -> show the top 8 with the winner highlighted
    total = len(res)
    res = res.head(min(limit, MAX_RESULT_ROWS))
    if total > len(res):
        steps.append(f"Showing the first {len(res)} of {total} rows")

    columns = list(res.columns)
    rows = [[py(v) for v in r] for r in res.itertuples(index=False, name=None)]
    result = {
        "columns": columns, "rows": rows, "truncated": total > len(res), "row_count": total, "steps": steps,
        "group_names": group_names, "metric_names": metric_names if plan.metrics else [], "highlight": highlight,
    }
    result["chart"] = build_chart(result, plan, kinds, time_grouped)
    return result


AGG_WORD = {"sum": "total", "mean": "average", "count": "number of", "min": "lowest", "max": "highest", "median": "median", "nunique": "unique"}


def metric_phrase(plan: Plan) -> str:
    """'total sales', 'average unit price', 'number of rows' ... for titles and fallback answers."""
    if not plan.metrics:
        return "result"
    m = plan.metrics[0]
    if m.agg == "count" and not m.col:
        return "number of rows"
    return f"{AGG_WORD[m.agg]} {(m.col or '').replace('_', ' ')}"


def default_title(plan: Plan) -> str:
    phrase = metric_phrase(plan)
    phrase = phrase[:1].upper() + phrase[1:]
    if plan.group_by:
        g = plan.group_by[0]
        return f"{phrase} by {g.col.replace('_', ' ')}" + (f" ({g.part})" if g.part else "")
    return phrase


def _is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def build_chart(result: dict, plan: Plan, kinds: dict[str, str], time_grouped: bool) -> dict | None:
    cols, rows = result["columns"], result["rows"]
    groups, metrics = result["group_names"], result["metric_names"]
    wanted = plan.chart.type
    title = plan.chart.title or (default_title(plan) if plan.metrics else None)

    # one number
    if len(rows) == 1 and len(cols) == 1 and _is_number(rows[0][0]):
        return {"type": "number", "title": title or cols[0], "value": rows[0][0], "label": title or cols[0]}
    if len(rows) == 1 and not groups and metrics and len(metrics) == 1:
        return {"type": "number", "title": title or metrics[0], "value": rows[0][cols.index(metrics[0])], "label": title or metrics[0]}

    if wanted == "number" and rows and _is_number(rows[0][-1]):
        return {"type": "number", "title": title or cols[-1], "value": rows[0][-1], "label": title or cols[-1]}

    # grouped result: x = first group, y = metrics (or pivot a 2nd group into series)
    if groups and metrics:
        x = groups[0]
        xi = cols.index(x)
        if len(groups) == 2 and len(metrics) >= 1:
            g2, m = groups[1], metrics[0]
            gi, mi = cols.index(g2), cols.index(m)
            series_names = []
            for r in rows:
                if r[gi] not in series_names:
                    series_names.append(r[gi])
            series_names = series_names[:8]
            data: dict[Any, dict] = {}
            for r in rows:
                if r[gi] in series_names:
                    data.setdefault(r[xi], {"x": r[xi]})[str(r[gi])] = r[mi]
            series = [str(s) for s in series_names]
            points = list(data.values())
        else:
            series = metrics[:4]
            points = [{"x": r[xi], **{m: r[cols.index(m)] for m in series}} for r in rows]
        ctype = wanted if wanted in ("bar", "line", "pie") else "bar"
        if time_grouped and wanted != "pie":
            ctype = "line" if wanted in ("line", "table", "scatter", "number") or len(points) > 12 else ctype
        if ctype == "pie" and (len(series) != 1 or len(points) > 10 or any((p.get(series[0]) or 0) < 0 for p in points)):
            ctype = "bar"
        return {"type": ctype, "title": title, "x": x, "series": series, "data": points, "highlight": result.get("highlight", 0), "can_switch": ["bar", "line", "pie"] if len(series) == 1 else ["bar", "line"]}

    # raw rows: scatter of two numeric columns when asked
    numeric = [c for c, k in zip(cols, [kinds.get(c) for c in cols]) if k == "number"]
    if wanted == "scatter" and len(numeric) >= 2:
        xi, yi = cols.index(numeric[0]), cols.index(numeric[1])
        pts = [{"x": r[xi], "y": r[yi]} for r in rows if _is_number(r[xi]) and _is_number(r[yi])]
        return {"type": "scatter", "title": title, "x": numeric[0], "series": [numeric[1]], "data": pts}
    return {"type": "table", "title": title}
