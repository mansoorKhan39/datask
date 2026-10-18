from conftest import CSV, signup, upload


def test_upload_profile_and_preview(client):
    signup(client)
    r = upload(client)
    assert r.status_code == 201
    ds = r.json()["dataset"]
    assert ds["rows"] == 5 and ds["cols"] == 5
    detail = client.get(f"/datasets/{ds['id']}").json()
    kinds = {c["name"]: c["kind"] for c in detail["profile"]["columns"]}
    assert kinds == {"order_date": "date", "city": "category", "category": "category", "sales": "number", "returned": "boolean"}
    assert detail["suggestions"]
    prev = client.get(f"/datasets/{ds['id']}/preview?limit=2").json()
    assert prev["total"] == 5 and len(prev["rows"]) == 2 and prev["kinds"][3] == "number"


def test_upload_rejections(client):
    signup(client)
    assert upload(client, "x", "notes.pdf").json()["error"]["code"] == "bad_file_type"
    assert upload(client, "", "empty.csv").status_code == 400
    big = "a,b\n" + "1,2\n" * 1_100_000
    r = upload(client, big)
    assert r.status_code == 413 and r.json()["error"]["code"] == "file_too_large"


def test_semicolon_and_formatted_numbers(client):
    signup(client)
    csv = "name;price;when\nA;\"1,200\";12/01/2026\nB;$900;13/01/2026\nC;450;14/01/2026\n"
    ds = upload(client, csv).json()["dataset"]
    kinds = {c["name"]: c["kind"] for c in client.get(f"/datasets/{ds['id']}").json()["profile"]["columns"]}
    assert kinds["price"] == "number" and kinds["when"] == "date"
    stats = next(c for c in client.get(f"/datasets/{ds['id']}").json()["profile"]["columns"] if c["name"] == "price")["stats"]
    assert stats["sum"] == 2550


def test_users_cannot_see_each_others_data(client):
    signup(client)
    did = upload(client).json()["dataset"]["id"]
    client.post("/auth/logout")
    signup(client, email="b@example.com", name="Bilal")
    assert client.get("/datasets").json()["datasets"] == []
    for method, path, kw in [("get", f"/datasets/{did}", {}), ("get", f"/datasets/{did}/preview", {}), ("delete", f"/datasets/{did}", {}),
                             ("get", f"/datasets/{did}/messages", {}), ("post", f"/datasets/{did}/ask", {"json": {"question": "total sales"}}),
                             ("patch", f"/datasets/{did}", {"json": {"name": "mine now"}})]:
        assert getattr(client, method)(path, **kw).status_code == 404, path


def test_rename_delete_and_limit(client, monkeypatch):
    signup(client)
    did = upload(client).json()["dataset"]["id"]
    assert client.patch(f"/datasets/{did}", json={"name": "Q1 sales"}).json()["dataset"]["name"] == "Q1 sales"
    assert client.delete(f"/datasets/{did}").status_code == 200
    assert client.get(f"/datasets/{did}").status_code == 404
    from datask_api import config
    monkeypatch.setenv("MAX_DATASETS", "2")
    config.reset_settings()
    upload(client); upload(client)
    assert upload(client).json()["error"]["code"] == "dataset_limit"


def test_sample_dataset_is_recent(client):
    signup(client)
    ds = client.post("/datasets/sample").json()["dataset"]
    assert ds["rows"] == 1500
    from datetime import date, timedelta
    cols = {c["name"]: c for c in client.get(f"/datasets/{ds['id']}").json()["profile"]["columns"]}
    assert cols["order_date"]["stats"]["max"] >= (date.today() - timedelta(days=10)).isoformat()
