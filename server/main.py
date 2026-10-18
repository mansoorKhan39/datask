"""Datask API. Run locally with:  uvicorn main:app --reload --port 8000"""
import gzip
import time
import uuid
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, File, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from datask_api import llm, profiling, samples
from datask_api.config import get_settings
from datask_api.db import get_db
from datask_api.errors import ApiError, LLMError, PlanError
from datask_api.executor import execute
from datask_api.security import (
    check_password_strength, clear_session, current_user, hash_password, public_user, set_session,
    throttle_clear, throttle_hit, valid_email, verify_password,
)

app = FastAPI(title="Datask API", version="1.0.0", docs_url="/docs", redoc_url=None)

_DUMMY_HASH = hash_password("not-a-real-password-1")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")) or "unknown"


# ------------------------------------------------------------------ errors
@app.exception_handler(ApiError)
async def api_error_handler(_: Request, e: ApiError):
    return JSONResponse(status_code=e.status, content={"error": {"code": e.code, "message": e.message}})


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, e: RequestValidationError):
    first = e.errors()[0] if e.errors() else {}
    field = ".".join(str(x) for x in first.get("loc", []) if x != "body")
    return JSONResponse(status_code=422, content={"error": {"code": "invalid_input", "message": f"Please check your input{': ' + field if field else ''}."}})


@app.exception_handler(Exception)
async def unhandled(_: Request, e: Exception):
    if isinstance(e, RuntimeError):  # configuration problems carry an explanatory message
        return JSONResponse(status_code=500, content={"error": {"code": "server_config", "message": str(e)}})
    return JSONResponse(status_code=500, content={"error": {"code": "server_error", "message": "Something went wrong on our side. Please try again."}})


@app.get("/health")
def health():
    s = get_settings()
    return {"ok": True, "env": s.env, "llm": s.llm_provider, "db": "mongodb" if s.mongodb_uri else "memory"}


# ------------------------------------------------------------------ auth
class RegisterBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class LoginBody(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class PasswordBody(BaseModel):
    current: str = Field(max_length=128)
    new: str = Field(max_length=128)


class DeleteAccountBody(BaseModel):
    password: str = Field(max_length=128)


@app.post("/auth/register", status_code=201)
def register(body: RegisterBody, request: Request, response: Response):
    throttle_hit(f"reg:{client_ip(request)}", 10, 3600)
    email = body.email.strip().lower()
    if not valid_email(email):
        raise ApiError(400, "invalid_email", "Enter a valid email address.")
    check_password_strength(body.password)
    db = get_db()
    if db.users.find_one({"email": email}):
        raise ApiError(409, "email_taken", "An account with this email already exists. Try logging in.")
    user = {"_id": uuid.uuid4().hex, "name": body.name.strip(), "email": email, "pw_hash": hash_password(body.password), "created": now()}
    try:
        db.users.insert_one(user)
    except Exception:
        raise ApiError(409, "email_taken", "An account with this email already exists. Try logging in.")
    set_session(response, user["_id"])
    return {"user": public_user(user)}


@app.post("/auth/login")
def login(body: LoginBody, response: Response):
    email = body.email.strip().lower()
    key = f"login:{email}"
    throttle_hit(key, 8, 900)
    user = get_db().users.find_one({"email": email})
    ok = verify_password(body.password, user["pw_hash"] if user else _DUMMY_HASH)
    if not user or not ok:
        raise ApiError(401, "bad_credentials", "Email or password is incorrect.")
    throttle_clear(key)
    set_session(response, user["_id"])
    return {"user": public_user(user)}


@app.post("/auth/logout")
def logout(response: Response):
    clear_session(response)
    return {"ok": True}


@app.get("/auth/me")
def me(user: dict = Depends(current_user)):
    return {"user": public_user(user)}


@app.post("/auth/password")
def change_password(body: PasswordBody, user: dict = Depends(current_user)):
    throttle_hit(f"pw:{user['_id']}", 8, 900)
    if not verify_password(body.current, user["pw_hash"]):
        raise ApiError(400, "bad_credentials", "Your current password is incorrect.")
    check_password_strength(body.new)
    get_db().users.update_one({"_id": user["_id"]}, {"$set": {"pw_hash": hash_password(body.new)}})
    return {"ok": True}


@app.post("/auth/delete-account")
def delete_account(body: DeleteAccountBody, response: Response, user: dict = Depends(current_user)):
    throttle_hit(f"del:{user['_id']}", 5, 900)
    if not verify_password(body.password, user["pw_hash"]):
        raise ApiError(400, "bad_credentials", "Password is incorrect.")
    db = get_db()
    db.messages.delete_many({"user_id": user["_id"]})
    db.datasets.delete_many({"user_id": user["_id"]})
    db.usage.delete_many({"user_id": user["_id"]})
    db.users.delete_one({"_id": user["_id"]})
    clear_session(response)
    return {"ok": True}


# ------------------------------------------------------------------ datasets
def dataset_summary(ds: dict) -> dict:
    return {"id": ds["_id"], "name": ds["name"], "rows": ds["rows"], "cols": ds["cols"], "size": ds["size"], "created": ds["created"]}


def get_dataset(dataset_id: str, user: dict) -> dict:
    ds = get_db().datasets.find_one({"_id": dataset_id, "user_id": user["_id"]})
    if not ds:
        raise ApiError(404, "not_found", "This dataset was not found.")
    return ds


def load_df(ds: dict):
    s = get_settings()
    raw = gzip.decompress(bytes(ds["data"]))
    return profiling.load_csv(raw, s.max_rows, s.max_cols)


def store_dataset(user: dict, name: str, raw: bytes) -> dict:
    s = get_settings()
    db = get_db()
    if db.datasets.count_documents({"user_id": user["_id"]}) >= s.max_datasets:
        raise ApiError(400, "dataset_limit", f"You can keep up to {s.max_datasets} datasets. Delete one to add another.")
    df, kinds = profiling.load_csv(raw, s.max_rows, s.max_cols)
    ds = {
        "_id": uuid.uuid4().hex, "user_id": user["_id"], "name": name[:80] or "Untitled", "size": len(raw),
        "rows": len(df), "cols": len(df.columns), "profile": profiling.describe(df, kinds),
        "data": gzip.compress(raw, 6), "created": now(),
    }
    db.datasets.insert_one(ds)
    return ds


@app.get("/datasets")
def list_datasets(user: dict = Depends(current_user)):
    items = get_db().datasets.find({"user_id": user["_id"]}, {"data": 0, "profile": 0}).sort("created", -1)
    return {"datasets": [dataset_summary(d) for d in items]}


@app.post("/datasets", status_code=201)
def upload_dataset(file: UploadFile = File(...), user: dict = Depends(current_user)):
    s = get_settings()
    filename = (file.filename or "data.csv").strip()
    if not filename.lower().endswith((".csv", ".tsv", ".txt")):
        raise ApiError(400, "bad_file_type", "Please upload a CSV file (.csv).")
    raw = file.file.read(s.max_upload_bytes + 1)
    if len(raw) > s.max_upload_bytes:
        raise ApiError(413, "file_too_large", f"This file is larger than {s.max_upload_bytes / 1_000_000:.0f} MB. Try a smaller file.")
    name = filename.rsplit(".", 1)[0]
    ds = store_dataset(user, name, raw)
    return {"dataset": dataset_summary(ds)}


@app.post("/datasets/sample", status_code=201)
def create_sample(user: dict = Depends(current_user)):
    ds = store_dataset(user, "Sample: online store sales", samples.sales_csv())
    return {"dataset": dataset_summary(ds)}


@app.get("/datasets/{dataset_id}")
def dataset_detail(dataset_id: str, user: dict = Depends(current_user)):
    ds = get_dataset(dataset_id, user)
    return {"dataset": dataset_summary(ds), "profile": ds["profile"], "suggestions": profiling.suggestions(ds["profile"])}


class RenameBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)


@app.patch("/datasets/{dataset_id}")
def rename_dataset(dataset_id: str, body: RenameBody, user: dict = Depends(current_user)):
    get_dataset(dataset_id, user)
    get_db().datasets.update_one({"_id": dataset_id}, {"$set": {"name": body.name.strip()}})
    return {"dataset": dataset_summary(get_dataset(dataset_id, user))}


@app.delete("/datasets/{dataset_id}")
def delete_dataset(dataset_id: str, user: dict = Depends(current_user)):
    get_dataset(dataset_id, user)
    db = get_db()
    db.messages.delete_many({"dataset_id": dataset_id})
    db.datasets.delete_one({"_id": dataset_id})
    return {"ok": True}


@app.get("/datasets/{dataset_id}/preview")
def dataset_preview(dataset_id: str, offset: int = 0, limit: int = 100, user: dict = Depends(current_user)):
    ds = get_dataset(dataset_id, user)
    df, kinds = load_df(ds)
    out = profiling.preview(df, max(0, offset), max(1, min(limit, 200)))
    out["kinds"] = [kinds[c] for c in out["columns"]]
    return out


# ------------------------------------------------------------------ questions
def message_out(m: dict) -> dict:
    return {"id": m["_id"], "role": m["role"], "content": m["content"], "data": m.get("data"), "created": m["created"]}


@app.get("/datasets/{dataset_id}/messages")
def list_messages(dataset_id: str, user: dict = Depends(current_user)):
    get_dataset(dataset_id, user)
    items = get_db().messages.find({"dataset_id": dataset_id, "user_id": user["_id"]}).sort("created", 1)
    return {"messages": [message_out(m) for m in items]}


@app.delete("/datasets/{dataset_id}/messages")
def clear_messages(dataset_id: str, user: dict = Depends(current_user)):
    get_dataset(dataset_id, user)
    get_db().messages.delete_many({"dataset_id": dataset_id, "user_id": user["_id"]})
    return {"ok": True}


def usage_key(user_id: str) -> str:
    return f"{user_id}:{datetime.now(timezone.utc).date().isoformat()}"


def usage_info(user_id: str) -> dict:
    limit = get_settings().daily_ask_limit
    doc = get_db().usage.find_one({"_id": usage_key(user_id)})
    used = doc["count"] if doc else 0
    return {"used": used, "limit": limit, "remaining": max(0, limit - used)}


@app.get("/usage")
def usage(user: dict = Depends(current_user)):
    return usage_info(user["_id"])


class AskBody(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    privacy_mode: bool = False


@app.post("/datasets/{dataset_id}/ask")
def ask(dataset_id: str, body: AskBody, user: dict = Depends(current_user)):
    started = time.time()
    question = " ".join(body.question.split())
    if len(question) < 2:
        raise ApiError(400, "invalid_input", "Type a question about your data.")
    ds = get_dataset(dataset_id, user)
    db = get_db()

    info = usage_info(user["_id"])
    if info["remaining"] <= 0:
        raise ApiError(429, "daily_limit", f"You have used all {info['limit']} questions for today. The limit resets at midnight UTC.")
    db.usage.update_one({"_id": usage_key(user["_id"])}, {"$inc": {"count": 1}, "$set": {"user_id": user["_id"]}}, upsert=True)

    def refund():
        db.usage.update_one({"_id": usage_key(user["_id"])}, {"$inc": {"count": -1}})

    df, kinds = load_df(ds)
    history = []
    for m in db.messages.find({"dataset_id": dataset_id, "user_id": user["_id"], "role": "assistant"}).sort("created", -1).limit(3):
        d = m.get("data") or {}
        if d.get("plan") and d.get("question"):
            history.insert(0, {"q": d["question"], "plan": d["plan"]})

    user_msg = {"_id": uuid.uuid4().hex, "user_id": user["_id"], "dataset_id": dataset_id, "role": "user", "content": question, "created": now()}
    db.messages.insert_one(user_msg)

    def reply(text: str, data: dict) -> dict:
        data["question"] = question
        data["ms"] = int((time.time() - started) * 1000)
        msg = {"_id": uuid.uuid4().hex, "user_id": user["_id"], "dataset_id": dataset_id, "role": "assistant", "content": text, "data": data, "created": now()}
        db.messages.insert_one(msg)
        return {"user_message": message_out(user_msg), "message": message_out(msg), "usage": usage_info(user["_id"])}

    try:
        plan = llm.plan_question(question, ds["profile"], kinds, history, body.privacy_mode)
    except LLMError as e:
        refund()
        db.messages.delete_one({"_id": user_msg["_id"]})
        raise ApiError(503, "ai_unavailable", str(e))
    except PlanError:
        return reply("I couldn't turn that into something I can calculate. Try asking it another way, and use the column names you see in the data.", {"kind": "unanswerable", "language": "en"})

    if not plan.can_answer:
        return reply(plan.reason or "I can't answer that from this data. Try a question about the columns in your file.", {"kind": "unanswerable", "language": plan.language})

    try:
        result = execute(df, kinds, plan)
    except PlanError as e:
        return reply(f"I couldn't run that: {e}", {"kind": "unanswerable", "language": plan.language})

    if result.get("empty"):
        text = {"ur": "ان شرائط پر کوئی ریکارڈ نہیں ملا۔", "roman_ur": "In shara'it par koi record nahi mila."}.get(plan.language, "No rows matched your question.")
        return reply(text, {"kind": "answer", "plan": plan.model_dump(by_alias=True), "result": {k: result[k] for k in ("columns", "rows", "steps", "row_count")}, "chart": None, "language": plan.language})

    answer = llm.compose_answer(question, plan, result)
    return reply(answer, {
        "kind": "answer", "plan": plan.model_dump(by_alias=True), "language": plan.language,
        "result": {k: result[k] for k in ("columns", "rows", "truncated", "row_count", "steps")},
        "chart": result["chart"],
    })
