"""Password hashing (scrypt, standard library) and JWT sessions."""
import base64
import hashlib
import hmac
import os
import re
import time
from typing import Optional

import jwt
from fastapi import Request, Response

from .config import get_settings
from .db import get_db
from .errors import ApiError

_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")
_N, _R, _P = 2**14, 8, 1


def valid_email(email: str) -> bool:
    return bool(_EMAIL.match(email)) and len(email) <= 254


def check_password_strength(pw: str) -> None:
    if len(pw) < 8:
        raise ApiError(400, "weak_password", "Password must be at least 8 characters.")
    if len(pw) > 128:
        raise ApiError(400, "weak_password", "Password must be at most 128 characters.")
    if pw.isdigit() or pw.isalpha():
        raise ApiError(400, "weak_password", "Use a mix of letters and numbers in your password.")


def hash_password(pw: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(pw.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return "scrypt$%d$%d$%d$%s$%s" % (_N, _R, _P, base64.b64encode(salt).decode(), base64.b64encode(digest).decode())


def verify_password(pw: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, hash_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(hash_b64)
        digest = hashlib.scrypt(pw.encode(), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected))
        return hmac.compare_digest(digest, expected)
    except Exception:
        return False


def create_token(user_id: str) -> str:
    s = get_settings()
    now = int(time.time())
    return jwt.encode({"sub": user_id, "iat": now, "exp": now + s.jwt_days * 86400}, s.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> Optional[str]:
    try:
        data = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"], options={"require": ["exp", "sub"]})
        return data["sub"]
    except jwt.PyJWTError:
        return None


def set_session(response: Response, user_id: str) -> None:
    s = get_settings()
    response.set_cookie(
        s.cookie_name,
        create_token(user_id),
        max_age=s.jwt_days * 86400,
        httponly=True,
        samesite="lax",
        secure=s.cookie_secure,
        path="/",
    )


def clear_session(response: Response) -> None:
    s = get_settings()
    response.delete_cookie(s.cookie_name, path="/", httponly=True, samesite="lax", secure=s.cookie_secure)


def current_user(request: Request) -> dict:
    s = get_settings()
    token = request.cookies.get(s.cookie_name)
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:].strip()
    user_id = decode_token(token) if token else None
    if not user_id:
        raise ApiError(401, "unauthenticated", "Please log in to continue.")
    user = get_db().users.find_one({"_id": user_id})
    if not user:
        raise ApiError(401, "unauthenticated", "Your account no longer exists. Please log in again.")
    return user


def public_user(user: dict) -> dict:
    return {"id": user["_id"], "name": user["name"], "email": user["email"]}


# ---- simple fixed-window throttle, stored in the database so it works across serverless instances ----
def throttle_hit(key: str, limit: int, window_seconds: int) -> None:
    """Count one attempt for `key`; raise 429 if the limit in the current window is exceeded."""
    col = get_db().throttle
    now = time.time()
    doc = col.find_one({"_id": key})
    if not doc or doc["reset_at"] <= now:
        col.replace_one({"_id": key}, {"_id": key, "count": 1, "reset_at": now + window_seconds}, upsert=True)
        return
    if doc["count"] >= limit:
        wait = int(doc["reset_at"] - now) + 1
        raise ApiError(429, "too_many_attempts", f"Too many attempts. Try again in {max(1, wait // 60)} minute(s).")
    col.update_one({"_id": key}, {"$inc": {"count": 1}})


def throttle_clear(key: str) -> None:
    get_db().throttle.delete_one({"_id": key})
