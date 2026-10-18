import pytest

from conftest import signup, upload


def setup(client):
    signup(client)
    return upload(client).json()["dataset"]["id"]


def test_ask_returns_answer_chart_and_steps(client):
    did = setup(client)
    r = client.post(f"/datasets/{did}/ask", json={"question": "Which city had the highest sales?"})
    assert r.status_code == 200
    m = r.json()["message"]
    assert m["data"]["kind"] == "answer" and m["data"]["chart"]["type"] == "bar"
    assert m["data"]["result"]["steps"] and "Karachi" in m["content"]
    assert r.json()["usage"]["used"] == 1


def test_history_is_saved_and_can_be_cleared(client):
    did = setup(client)
    client.post(f"/datasets/{did}/ask", json={"question": "total sales"})
    msgs = client.get(f"/datasets/{did}/messages").json()["messages"]
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    client.delete(f"/datasets/{did}/messages")
    assert client.get(f"/datasets/{did}/messages").json()["messages"] == []


def test_daily_limit(client):
    did = setup(client)
    for _ in range(5):
        assert client.post(f"/datasets/{did}/ask", json={"question": "total sales"}).status_code == 200
    r = client.post(f"/datasets/{did}/ask", json={"question": "total sales"})
    assert r.status_code == 429 and r.json()["error"]["code"] == "daily_limit"
    assert client.get("/usage").json()["remaining"] == 0


def test_ai_outage_gives_friendly_error_and_refunds_the_question(client, monkeypatch):
    did = setup(client)
    from datask_api import llm
    from datask_api.errors import LLMError

    def boom(*a, **k):
        raise LLMError("The AI service is busy right now (free-plan limit). Please try again in a minute.")
    monkeypatch.setattr(llm, "plan_question", boom)
    r = client.post(f"/datasets/{did}/ask", json={"question": "total sales"})
    assert r.status_code == 503 and "busy" in r.json()["error"]["message"]
    assert client.get("/usage").json()["used"] == 0
    assert client.get(f"/datasets/{did}/messages").json()["messages"] == []


def test_bad_plan_from_ai_becomes_a_helpful_message(client, monkeypatch):
    did = setup(client)
    from datask_api import llm
    from datask_api.errors import PlanError
    monkeypatch.setattr(llm, "plan_question", lambda *a, **k: (_ for _ in ()).throw(PlanError("nope")))
    r = client.post(f"/datasets/{did}/ask", json={"question": "something odd"})
    assert r.status_code == 200 and r.json()["message"]["data"]["kind"] == "unanswerable"


def test_cannot_answer_flag_is_respected(client, monkeypatch):
    did = setup(client)
    from datask_api import llm
    from datask_api.plan import Plan
    monkeypatch.setattr(llm, "plan_question", lambda *a, **k: Plan(can_answer=False, reason="Is data mein weather ka column nahi hai.", language="roman_ur"))
    m = client.post(f"/datasets/{did}/ask", json={"question": "kal barish hogi?"}).json()["message"]
    assert m["data"]["kind"] == "unanswerable" and "weather" in m["content"]


def test_input_validation(client):
    did = setup(client)
    assert client.post(f"/datasets/{did}/ask", json={"question": ""}).status_code == 422
    assert client.post(f"/datasets/{did}/ask", json={"question": "x" * 501}).status_code == 422
    assert client.post(f"/datasets/{did}/ask", json={"question": "  "}).status_code in (400, 422)


def test_prompt_never_contains_values_in_privacy_mode():
    from datask_api.llm import schema_text
    profile = {"columns": [{"name": "city", "kind": "category", "top": [{"value": "Lahore", "count": 2}], "samples": ["Lahore"]},
                           {"name": "sales", "kind": "number", "samples": [100], "stats": {"min": 1, "max": 9}}]}
    private, normal = schema_text(profile, True), schema_text(profile, False)
    assert "Lahore" not in private and "100" not in private and "range" not in private
    assert "Lahore" in normal


def test_llm_json_extraction_and_retry(monkeypatch, client):
    from datask_api import llm, config
    monkeypatch.setenv("LLM_PROVIDER", "groq"); monkeypatch.setenv("GROQ_API_KEY", "k")
    config.reset_settings()
    replies = iter(['```json\n{"metrics":[{"agg":"sum","col":"nonexistent"}]}\n```', '{"metrics":[{"agg":"sum","col":"sales","as":"t"}],"chart":"number"}'])
    prompts = []
    monkeypatch.setattr(llm, "_call", lambda system, user, json_mode: (prompts.append(user), next(replies))[1])
    profile = {"rows": 5, "columns": [{"name": "sales", "kind": "number", "samples": [1]}]}
    plan = llm.plan_question("total", profile, {"sales": "number"}, [], False)
    assert plan.metrics[0].col == "sales" and plan.chart.type == "number"
    assert len(prompts) == 2 and "rejected" in prompts[1] and "Unknown column" in prompts[1]
