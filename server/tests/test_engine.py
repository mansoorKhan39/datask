import pandas as pd
import pytest

from datask_api.errors import PlanError
from datask_api.executor import execute
from datask_api.plan import parse_plan, validate_plan
from datask_api.profiling import load_csv

CSV = b"d,city,cat,sales,note\n2026-01-05,Lahore,A,100,x\n2026-01-20,Karachi,B,250,y\n2026-02-03,Lahore,B,300,z\n2026-02-14,Quetta,A,50,w\n2026-03-01,Karachi,A,400,v\n2026-03-02,Karachi,B,10,u\n"


@pytest.fixture()
def data():
    return load_csv(CSV, 1000, 50)


def run(data, plan):
    df, kinds = data
    return execute(df, kinds, validate_plan(parse_plan(plan), kinds))


def test_group_sum_sorted(data):
    r = run(data, {"group_by": [{"col": "city"}], "metrics": [{"agg": "sum", "col": "sales", "as": "t"}], "sort": {"by": "t", "desc": True}, "limit": 10})
    assert r["rows"][0] == ["Karachi", 660] and r["rows"][-1][0] == "Quetta"
    assert r["chart"]["type"] == "bar" and r["chart"]["series"] == ["t"]


def test_top_one_keeps_context_and_highlight(data):
    r = run(data, {"group_by": [{"col": "city"}], "metrics": [{"agg": "sum", "col": "sales", "as": "t"}], "sort": {"by": "t"}, "limit": 1})
    assert r["rows"][0][0] == "Karachi" and len(r["rows"]) == 3 and r["chart"]["highlight"] == 1


def test_month_trend_is_chronological_line(data):
    r = run(data, {"group_by": [{"col": "d", "part": "month"}], "metrics": [{"agg": "sum", "col": "sales"}], "chart": {"type": "bar"}})
    assert [row[0] for row in r["rows"]] == ["2026-01", "2026-02", "2026-03"]
    assert r["chart"]["type"] == "bar" or r["chart"]["type"] == "line"


def test_filters(data):
    assert run(data, {"filters": [{"col": "city", "op": "eq", "value": "lahore"}], "metrics": [{"agg": "sum", "col": "sales"}]})["rows"] == [[400]]
    assert run(data, {"filters": [{"col": "sales", "op": "gt", "value": 100}], "metrics": [{"agg": "count"}]})["rows"] == [[3]]
    assert run(data, {"filters": [{"col": "d", "op": "between", "value": ["2026-02-01", "2026-02-28"]}], "metrics": [{"agg": "count"}]})["rows"] == [[2]]
    assert run(data, {"filters": [{"col": "city", "op": "in", "value": ["Lahore", "Quetta"]}], "metrics": [{"agg": "count"}]})["rows"] == [[3]]
    assert run(data, {"filters": [{"col": "city", "op": "contains", "value": "kara"}], "metrics": [{"agg": "count"}]})["rows"] == [[3]]
    assert run(data, {"filters": [{"col": "d", "op": "lte", "value": "2026-01-20"}], "metrics": [{"agg": "count"}]})["rows"] == [[2]]


def test_between_includes_whole_last_day(data):
    r = run(data, {"filters": [{"col": "d", "op": "between", "value": ["2026-03-01", "2026-03-02"]}], "metrics": [{"agg": "count"}]})
    assert r["rows"] == [[2]]


def test_empty_result_is_flagged(data):
    r = run(data, {"filters": [{"col": "city", "op": "eq", "value": "Mars"}], "metrics": [{"agg": "sum", "col": "sales"}]})
    assert r["empty"] is True and r["rows"] == []


def test_two_groups_pivot_into_series(data):
    r = run(data, {"group_by": [{"col": "city"}, {"col": "cat"}], "metrics": [{"agg": "sum", "col": "sales", "as": "t"}]})
    assert set(r["chart"]["series"]) == {"A", "B"} and r["chart"]["x"] == "city"


def test_single_number_chart(data):
    r = run(data, {"metrics": [{"agg": "mean", "col": "sales", "as": "avg"}]})
    assert r["chart"]["type"] == "number" and r["chart"]["value"] == pytest.approx(185.0)


def test_raw_rows_and_select(data):
    r = run(data, {"select": ["city", "sales"], "sort": {"by": "sales", "desc": True}, "limit": 2})
    assert r["rows"] == [["Karachi", 400], ["Lahore", 300]] and r["chart"]["type"] == "table"


def test_pie_falls_back_to_bar_when_too_many_slices():
    csv = "k,v\n" + "\n".join(f"item{i},{i + 1}" for i in range(30))
    df, kinds = load_csv(csv.encode(), 1000, 10)
    plan = validate_plan(parse_plan({"group_by": [{"col": "k"}], "metrics": [{"agg": "sum", "col": "v"}], "chart": {"type": "pie"}, "limit": 30}), kinds)
    assert execute(df, kinds, plan)["chart"]["type"] == "bar"


def test_weekday_order():
    csv = "d,v\n2026-03-02,1\n2026-03-04,2\n2026-03-08,3\n2026-03-03,4\n"
    df, kinds = load_csv(csv.encode(), 100, 10)
    plan = validate_plan(parse_plan({"group_by": [{"col": "d", "part": "weekday"}], "metrics": [{"agg": "sum", "col": "v"}]}), kinds)
    assert [r[0] for r in execute(df, kinds, plan)["rows"]] == ["Monday", "Tuesday", "Wednesday", "Sunday"]


# ------------------------------------------------------------- safety
@pytest.mark.parametrize("bad", [
    {"metrics": [{"agg": "sum", "col": "nope"}]},
    {"metrics": [{"agg": "sum", "col": "city"}]},
    {"group_by": [{"col": "city", "part": "month"}], "metrics": [{"agg": "count"}]},
    {"filters": [{"col": "city", "op": "gt", "value": 3}]},
    {"filters": [{"col": "sales", "op": "between", "value": [1]}]},
    {"metrics": [{"agg": "median"}]},
    {"metrics": [{"agg": "__import__('os').system('id')", "col": "sales"}]},
])
def test_invalid_plans_are_rejected(data, bad):
    _, kinds = data
    with pytest.raises(PlanError):
        validate_plan(parse_plan(dict(bad)), kinds)


def test_strings_are_data_not_code(data):
    evil = "'); __import__('os').system('touch /tmp/pwned'); ('"
    r = run(data, {"filters": [{"col": "city", "op": "eq", "value": evil}], "metrics": [{"agg": "count"}]})
    assert r["empty"] is True
    import os
    assert not os.path.exists("/tmp/pwned")
    r = run(data, {"filters": [{"col": "city", "op": "contains", "value": ".*"}], "metrics": [{"agg": "count"}]})
    assert r["empty"] is True  # '.*' is matched literally, never as a pattern


def test_limit_is_clamped_and_column_names_are_forgiving(data):
    df, kinds = data
    plan = validate_plan(parse_plan({"group_by": [{"col": "CITY"}], "metrics": [{"agg": "count"}], "limit": 99999}), kinds)
    assert plan.limit == 200 and plan.group_by[0].col == "city"


def test_non_object_plan_rejected():
    with pytest.raises(PlanError):
        parse_plan(["not", "a", "dict"])
