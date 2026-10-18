"""Central settings, read from environment variables."""
import os
from dataclasses import dataclass


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    env: str
    jwt_secret: str
    jwt_days: int
    cookie_name: str
    cookie_secure: bool
    mongodb_uri: str
    mongodb_db: str
    max_upload_bytes: int
    max_rows: int
    max_cols: int
    max_datasets: int
    daily_ask_limit: int
    llm_provider: str
    llm_model: str
    gemini_key: str
    groq_key: str


def load_settings() -> Settings:
    env = os.environ.get("DATASK_ENV", "production").lower()
    secret = os.environ.get("JWT_SECRET", "")
    if not secret:
        if env == "production":
            raise RuntimeError("JWT_SECRET is not set. Add a long random string to the server's environment variables.")
        secret = "dev-only-insecure-secret-change-me"
    elif len(secret) < 16 and env == "production":
        raise RuntimeError("JWT_SECRET is too short. Use at least 32 random characters.")

    provider = os.environ.get("LLM_PROVIDER", "").lower()
    if not provider:
        if os.environ.get("GEMINI_API_KEY"):
            provider = "gemini"
        elif os.environ.get("GROQ_API_KEY"):
            provider = "groq"
        else:
            provider = "mock" if env != "production" else "none"

    default_model = {"gemini": "gemini-2.0-flash", "groq": "llama-3.3-70b-versatile"}.get(provider, "")
    return Settings(
        env=env,
        jwt_secret=secret,
        jwt_days=_int("JWT_DAYS", 7),
        cookie_name="datask_token",
        cookie_secure=os.environ.get("COOKIE_SECURE", "1" if env == "production" else "0") == "1",
        mongodb_uri=os.environ.get("MONGODB_URI", ""),
        mongodb_db=os.environ.get("MONGODB_DB", "datask"),
        max_upload_bytes=_int("MAX_UPLOAD_BYTES", 4_000_000),
        max_rows=_int("MAX_ROWS", 100_000),
        max_cols=_int("MAX_COLS", 100),
        max_datasets=_int("MAX_DATASETS", 10),
        daily_ask_limit=_int("DAILY_ASK_LIMIT", 60),
        llm_provider=provider,
        llm_model=os.environ.get("LLM_MODEL", default_model),
        gemini_key=os.environ.get("GEMINI_API_KEY", ""),
        groq_key=os.environ.get("GROQ_API_KEY", ""),
    )


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings


def reset_settings() -> None:
    """Used by tests."""
    global _settings
    _settings = None
