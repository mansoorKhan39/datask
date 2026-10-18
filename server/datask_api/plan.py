"""The 'plan' is the only thing the AI may produce. It is plain data, validated against the dataset, then run by our own code.
No AI-written code is ever executed."""
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .errors import PlanError

Op = Literal["eq", "ne", "gt", "gte", "lt", "lte", "in", "contains", "between", "is_null", "not_null"]
Part = Literal["year", "quarter", "month", "week", "weekday", "day", "hour"]
Agg = Literal["sum", "mean", "count", "min", "max", "median", "nunique"]
ChartType = Literal["bar", "line", "pie", "scatter", "number", "table"]


class Filter(BaseModel):
    model_config = ConfigDict(extra="ignore")
    col: str
    op: Op
    value: Any = None


class Group(BaseModel):
    model_config = ConfigDict(extra="ignore")
    col: str
    part: Optional[Part] = None


class Metric(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    agg: Agg
    col: Optional[str] = None
    label: Optional[str] = Field(default=None, alias="as")


class Sort(BaseModel):
    model_config = ConfigDict(extra="ignore")
    by: str
    desc: bool = True


class ChartSpec(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type: ChartType = "table"
    title: Optional[str] = None


class Plan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    can_answer: bool = True
    reason: Optional[str] = None
    select: list[str] = []
    filters: list[Filter] = []
    group_by: list[Group] = []
    metrics: list[Metric] = []
    sort: Optional[Sort] = None
    limit: int = 20
    chart: ChartSpec = ChartSpec()
    language: Literal["en", "ur", "roman_ur"] = "en"


MAX_FILTERS, MAX_GROUPS, MAX_METRICS, MAX_SELECT = 8, 2, 4, 12


def parse_plan(data: Any) -> Plan:
    if not isinstance(data, dict):
        raise PlanError("The AI response was not a JSON object.")
    # tolerate common slips: chart given as a string, limit given as a string
    if isinstance(data.get("chart"), str):
        data["chart"] = {"type": data["chart"]}
    try:
        data["limit"] = int(data.get("limit", 20) or 20)
    except (TypeError, ValueError):
        data["limit"] = 20
    try:
        return Plan.model_validate(data)
    except ValidationError as e:
        first = e.errors()[0]
        raise PlanError(f"Invalid plan at {'.'.join(str(x) for x in first['loc'])}: {first['msg']}")


def _resolve(name: str, kinds: dict[str, str]) -> str:
    """Map a column name from the AI to a real column (exact, then case/space-insensitive)."""
    if name in kinds:
        return name
    norm = lambda s: "".join(ch for ch in s.lower() if ch.isalnum())
    for real in kinds:
        if norm(real) == norm(name):
            return real
    raise PlanError(f"Unknown column '{name}'. Available columns: {', '.join(kinds)}.")


def validate_plan(plan: Plan, kinds: dict[str, str]) -> Plan:
    if not plan.can_answer:
        return plan
    if len(plan.filters) > MAX_FILTERS or len(plan.group_by) > MAX_GROUPS or len(plan.metrics) > MAX_METRICS or len(plan.select) > MAX_SELECT:
        raise PlanError("The plan is too complex.")
    plan.limit = max(1, min(int(plan.limit), 200))

    for f in plan.filters:
        f.col = _resolve(f.col, kinds)
        k = kinds[f.col]
        if f.op in ("gt", "gte", "lt", "lte", "between") and k not in ("number", "date"):
            raise PlanError(f"Cannot compare '{f.col}' with {f.op}; it is not a number or date column.")
        if f.op == "between" and not (isinstance(f.value, (list, tuple)) and len(f.value) == 2):
            raise PlanError("'between' needs two values.")
        if f.op == "in" and not isinstance(f.value, (list, tuple)):
            f.value = [f.value]
        if f.op not in ("is_null", "not_null") and f.value is None:
            raise PlanError(f"Filter on '{f.col}' has no value.")

    for g in plan.group_by:
        g.col = _resolve(g.col, kinds)
        if g.part and kinds[g.col] != "date":
            raise PlanError(f"'{g.col}' is not a date column, so it cannot be split by {g.part}.")
        if kinds[g.col] == "date" and not g.part:
            g.part = "month"  # grouping raw timestamps is never what anyone wants

    for m in plan.metrics:
        if m.col:
            m.col = _resolve(m.col, kinds)
            if m.agg in ("sum", "mean", "median") and kinds[m.col] not in ("number", "boolean"):
                raise PlanError(f"Cannot calculate {m.agg} of '{m.col}'; it is not a number column.")
            if m.agg in ("min", "max") and kinds[m.col] == "text":
                raise PlanError(f"Cannot calculate {m.agg} of text column '{m.col}'.")
        elif m.agg != "count":
            raise PlanError(f"{m.agg} needs a column.")

    plan.select = [_resolve(c, kinds) for c in plan.select]
    if plan.group_by and not plan.metrics:
        plan.metrics = [Metric(agg="count")]
    return plan
