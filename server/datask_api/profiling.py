"""Read a CSV, work out column types, and describe the data."""
import io
import re
import warnings
from typing import Any

import numpy as np
import pandas as pd

from .errors import ApiError

NA_VALUES = ["", "na", "n/a", "N/A", "NA", "null", "NULL", "None", "none", "nan", "NaN", "-", "--"]
_NUM_JUNK = re.compile(r"[,\s$€£₨%]|^Rs\.?", flags=re.I)
_DATE_LIKE = re.compile(r"\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}")
_ID_NAME = re.compile(r"(^|[_\s-])(id|uuid|code|zip|zipcode|phone|sku|cnic)$", flags=re.I)
_BOOL_WORDS = {"true", "false", "yes", "no", "y", "n", "t", "f"}


def _decode(raw: bytes) -> str:
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ApiError(400, "unreadable", "This file could not be read as text. Please upload a CSV file.")


def _sniff(text: str) -> str:
    lines = [ln for ln in text[:8000].splitlines() if ln.strip()][:6]
    if not lines:
        return ","
    best, best_score = ",", -1
    for d in (",", ";", "\t", "|"):
        counts = [ln.count(d) for ln in lines]
        if min(counts) == 0:
            continue
        score = min(counts) * (3 if len(set(counts)) == 1 else 1)
        if score > best_score:
            best, best_score = d, score
    return best


def _clean_names(cols) -> list[str]:
    seen: dict[str, int] = {}
    out = []
    for i, c in enumerate(cols):
        name = re.sub(r"\s+", " ", str(c)).strip() or f"column_{i + 1}"
        if name.lower().startswith("unnamed:"):
            name = f"column_{i + 1}"
        if name in seen:
            seen[name] += 1
            name = f"{name}_{seen[name]}"
        else:
            seen[name] = 1
        out.append(name)
    return out


def _to_dates(s: pd.Series) -> pd.Series:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return pd.to_datetime(s, errors="coerce", format="mixed", dayfirst=False)


def _infer(name: str, s: pd.Series) -> tuple[pd.Series, str]:
    s = s.astype("object")
    nn = s.dropna()
    if nn.empty:
        return s, "text"
    nn_str = nn.astype(str)

    identifier = bool(_ID_NAME.search(name)) and nn.nunique() > 0.9 * len(nn)

    # numbers (including "1,200", "$45", "12%")
    if not identifier:
        cleaned = nn_str.str.replace(_NUM_JUNK, "", regex=True)
        num = pd.to_numeric(cleaned, errors="coerce")
        if num.notna().mean() >= 0.95:
            full = pd.to_numeric(s.astype("string").str.replace(_NUM_JUNK, "", regex=True), errors="coerce")
            return full.astype("float64"), "number"

    # yes/no style columns
    lowered = set(nn_str.str.lower().unique())
    if 1 < len(lowered) <= 2 and lowered <= _BOOL_WORDS:
        truthy = {"true", "yes", "y", "t"}
        mapped = s.map(lambda v: np.nan if pd.isna(v) else (str(v).lower() in truthy))
        return mapped.astype("object"), "boolean"

    # dates
    sample = nn_str.head(200)
    if sample.map(lambda v: bool(_DATE_LIKE.search(v))).mean() >= 0.9:
        parsed_sample = _to_dates(sample)
        if parsed_sample.notna().mean() >= 0.95:
            return _to_dates(s.astype("string")), "date"

    unique = nn.nunique()
    if not identifier and unique <= max(50, int(0.05 * len(nn))):
        return s, "category"
    return s, "text"


def load_csv(raw: bytes, max_rows: int, max_cols: int) -> tuple[pd.DataFrame, dict[str, str]]:
    text = _decode(raw)
    if not text.strip():
        raise ApiError(400, "empty_file", "This file is empty.")
    sep = _sniff(text)
    try:
        df = pd.read_csv(
            io.StringIO(text), sep=sep, dtype=str, na_values=NA_VALUES, keep_default_na=False,
            skipinitialspace=True, on_bad_lines="skip", engine="python" if len(text) < 200_000 else "c",
        )
    except Exception:
        raise ApiError(400, "unreadable", "This file does not look like a valid CSV. Check that it has a header row and comma-separated values.")
    df = df.dropna(axis=1, how="all").dropna(axis=0, how="all").reset_index(drop=True)
    if df.shape[1] == 0 or df.shape[0] == 0:
        raise ApiError(400, "empty_file", "No rows were found in this file. Make sure the first row has column names.")
    if df.shape[0] > max_rows:
        raise ApiError(400, "too_many_rows", f"This file has {df.shape[0]:,} rows. The limit is {max_rows:,}.")
    if df.shape[1] > max_cols:
        raise ApiError(400, "too_many_columns", f"This file has {df.shape[1]} columns. The limit is {max_cols}.")

    df.columns = _clean_names(df.columns)
    for c in df.columns:
        df[c] = df[c].map(lambda v: v.strip() if isinstance(v, str) else v)

    kinds: dict[str, str] = {}
    out = {}
    for c in df.columns:
        series, kind = _infer(c, df[c])
        out[c] = series
        kinds[c] = kind
    return pd.DataFrame(out), kinds


# ---------- JSON-safe helpers ----------
def py(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, (pd.Timestamp,)):
        if pd.isna(v):
            return None
        return v.strftime("%Y-%m-%d") if (v.hour, v.minute, v.second) == (0, 0, 0) else v.isoformat(timespec="seconds")
    if v is pd.NaT:
        return None
    if isinstance(v, (np.bool_, bool)):
        return bool(v)
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        f = float(v)
        if np.isnan(f) or np.isinf(f):
            return None
        return round(f, 4)
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return v if isinstance(v, (int, str)) else str(v)


def describe(df: pd.DataFrame, kinds: dict[str, str]) -> dict:
    n = len(df)
    cols = []
    for c in df.columns:
        s = df[c]
        kind = kinds[c]
        nulls = int(s.isna().sum())
        info: dict[str, Any] = {
            "name": c,
            "kind": kind,
            "nulls": nulls,
            "null_pct": round(100 * nulls / n, 1) if n else 0,
            "unique": int(s.nunique(dropna=True)),
            "samples": [py(v) for v in s.dropna().head(3).tolist()],
        }
        if kind == "number" and s.notna().any():
            info["stats"] = {k: py(v) for k, v in {
                "min": s.min(), "max": s.max(), "mean": s.mean(), "median": s.median(), "sum": s.sum(),
            }.items()}
        elif kind == "date" and s.notna().any():
            info["stats"] = {"min": py(s.min()), "max": py(s.max())}
        elif kind in ("category", "boolean"):
            vc = s.value_counts(dropna=True).head(8)
            info["top"] = [{"value": py(k), "count": int(v)} for k, v in vc.items()]
        cols.append(info)
    return {"rows": n, "cols": len(df.columns), "columns": cols}


def preview(df: pd.DataFrame, offset: int = 0, limit: int = 100) -> dict:
    part = df.iloc[offset: offset + limit]
    return {
        "columns": list(df.columns),
        "rows": [[py(v) for v in row] for row in part.itertuples(index=False, name=None)],
        "total": len(df),
        "offset": offset,
    }


def suggestions(profile: dict) -> list[str]:
    cols = profile["columns"]
    nums = [c["name"] for c in cols if c["kind"] == "number"]
    cats = [c["name"] for c in cols if c["kind"] in ("category",) and 1 < c["unique"] <= 30]
    dates = [c["name"] for c in cols if c["kind"] == "date"]
    metric = None
    for pattern in ("sales|revenue|income|turnover", "profit|amount|total", "price|cost|salary|fee", "score|rating|marks", "quantity|qty|count"):
        metric = next((n for n in nums if re.search(pattern, n, re.I)), None)
        if metric:
            break
    metric = metric or (nums[0] if nums else None)
    out: list[str] = []
    if metric:
        out.append(f"What is the total {metric}?")
        if cats:
            out.append(f"Which {cats[0]} has the highest {metric}?")
        if len(cats) > 1:
            out.append(f"{cats[1]} ke hisab se {metric} dikhao")
        if dates:
            out.append(f"Show monthly {metric} trend")
        if cats:
            out.append(f"Top 5 {cats[0]} by average {metric}")
    if cats:
        out.append(f"How many rows are there for each {cats[0]}?")
    if not out:
        out.append("How many rows are in this file?")
    return out[:6]
