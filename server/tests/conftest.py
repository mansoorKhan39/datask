import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["DATASK_ENV"] = "development"
os.environ["LLM_PROVIDER"] = "mock"
os.environ.pop("MONGODB_URI", None)


@pytest.fixture()
def client(monkeypatch):
    from datask_api import config, db
    monkeypatch.setenv("DAILY_ASK_LIMIT", "5")
    config.reset_settings()
    db.reset_db()
    import main
    from fastapi.testclient import TestClient
    with TestClient(main.app) as c:
        yield c
    config.reset_settings()
    db.reset_db()


def signup(client, email="a@example.com", name="Ayesha", password="secret123"):
    r = client.post("/auth/register", json={"name": name, "email": email, "password": password})
    assert r.status_code == 201, r.text
    return r


CSV = "order_date,city,category,sales,returned\n2026-01-05,Lahore,A,100,no\n2026-01-20,Karachi,B,250,yes\n2026-02-03,Lahore,B,300,no\n2026-02-14,Quetta,A,50,no\n2026-03-01,Karachi,A,400,no\n"


def upload(client, content=CSV, name="data.csv"):
    return client.post("/datasets", files={"file": (name, content.encode() if isinstance(content, str) else content, "text/csv")})
