"""Database access. MongoDB in production, an in-memory mongomock database for local development and tests."""
from .config import get_settings

_db = None


def get_db():
    global _db
    if _db is not None:
        return _db
    s = get_settings()
    if s.mongodb_uri:
        from pymongo import MongoClient

        client = MongoClient(s.mongodb_uri, serverSelectionTimeoutMS=8000, appname="datask")
        _db = client[s.mongodb_db]
    else:
        if s.env == "production":
            raise RuntimeError("MONGODB_URI is not set. Create a free MongoDB Atlas cluster and add its connection string.")
        import mongomock

        _db = mongomock.MongoClient()[s.mongodb_db]
    _ensure_indexes(_db)
    return _db


def _ensure_indexes(db) -> None:
    try:
        db.users.create_index("email", unique=True)
        db.datasets.create_index("user_id")
        db.messages.create_index([("dataset_id", 1), ("created", 1)])
        db.usage.create_index([("user_id", 1), ("day", 1)])
    except Exception:  # indexes are an optimisation, never a reason to fail a request
        pass


def reset_db() -> None:
    """Used by tests."""
    global _db
    _db = None
