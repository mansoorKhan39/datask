from conftest import signup


def test_register_login_logout_flow(client):
    r = signup(client)
    assert "datask_token" in r.cookies
    assert "HttpOnly" in r.headers["set-cookie"] and "samesite=lax" in r.headers["set-cookie"].lower()
    assert client.get("/auth/me").json()["user"]["email"] == "a@example.com"
    assert client.post("/auth/logout").status_code == 200
    assert client.get("/auth/me").status_code == 401
    r = client.post("/auth/login", json={"email": "A@Example.com", "password": "secret123"})
    assert r.status_code == 200 and r.json()["user"]["name"] == "Ayesha"


def test_password_is_never_stored_in_plain_text(client):
    signup(client)
    from datask_api.db import get_db
    stored = get_db().users.find_one({"email": "a@example.com"})["pw_hash"]
    assert stored.startswith("scrypt$") and "secret123" not in stored


def test_register_validation(client):
    assert client.post("/auth/register", json={"name": "A", "email": "nope", "password": "secret123"}).status_code == 400
    assert client.post("/auth/register", json={"name": "A", "email": "a@b.co", "password": "short1"}).json()["error"]["code"] == "weak_password"
    assert client.post("/auth/register", json={"name": "A", "email": "a@b.co", "password": "onlyletters"}).status_code == 400
    assert client.post("/auth/register", json={"email": "a@b.co"}).status_code == 422


def test_duplicate_email_rejected(client):
    signup(client)
    r = client.post("/auth/register", json={"name": "B", "email": "A@example.com", "password": "another123"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "email_taken"


def test_wrong_password_and_unknown_user_look_the_same(client):
    signup(client)
    a = client.post("/auth/login", json={"email": "a@example.com", "password": "wrongpass1"})
    b = client.post("/auth/login", json={"email": "nobody@example.com", "password": "wrongpass1"})
    assert a.status_code == b.status_code == 401 and a.json() == b.json()


def test_login_is_throttled(client):
    signup(client)
    for _ in range(8):
        client.post("/auth/login", json={"email": "a@example.com", "password": "bad-pass-1"})
    r = client.post("/auth/login", json={"email": "a@example.com", "password": "secret123"})
    assert r.status_code == 429


def test_protected_routes_need_login(client):
    for method, path in [("get", "/datasets"), ("post", "/datasets/sample"), ("get", "/usage"), ("get", "/datasets/x/messages")]:
        assert getattr(client, method)(path).status_code == 401


def test_tampered_or_expired_token_rejected(client):
    import time, jwt
    from datask_api.config import get_settings
    signup(client)
    uid = client.get("/auth/me").json()["user"]["id"]
    s = get_settings()
    expired = jwt.encode({"sub": uid, "iat": 1, "exp": int(time.time()) - 10}, s.jwt_secret, algorithm="HS256")
    forged = jwt.encode({"sub": uid, "exp": int(time.time()) + 999}, "other-secret-value-1234567", algorithm="HS256")
    client.cookies.clear()
    assert client.get("/auth/me", headers={"authorization": f"Bearer {expired}"}).status_code == 401
    assert client.get("/auth/me", headers={"authorization": f"Bearer {forged}"}).status_code == 401


def test_change_password(client):
    signup(client)
    assert client.post("/auth/password", json={"current": "wrong-pass-1", "new": "newsecret1"}).status_code == 400
    assert client.post("/auth/password", json={"current": "secret123", "new": "newsecret1"}).status_code == 200
    client.post("/auth/logout")
    assert client.post("/auth/login", json={"email": "a@example.com", "password": "secret123"}).status_code == 401
    assert client.post("/auth/login", json={"email": "a@example.com", "password": "newsecret1"}).status_code == 200


def test_delete_account_removes_everything(client):
    from conftest import upload
    signup(client)
    did = upload(client).json()["dataset"]["id"]
    client.post(f"/datasets/{did}/ask", json={"question": "total sales"})
    assert client.post("/auth/delete-account", json={"password": "nope-nope-1"}).status_code == 400
    assert client.post("/auth/delete-account", json={"password": "secret123"}).status_code == 200
    from datask_api.db import get_db
    db = get_db()
    assert db.users.count_documents({}) == db.datasets.count_documents({}) == db.messages.count_documents({}) == 0
    assert client.get("/auth/me").status_code == 401
