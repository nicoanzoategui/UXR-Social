import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine, Session

# Load environment variables
load_dotenv()

_BACKEND_DIR = Path(__file__).resolve().parent


def _resolve_database_url() -> str:
    """SQLite URLs relative to cwd break when uvicorn is started outside backend/. Anchor to this package."""
    raw = os.getenv("DATABASE_URL", "").strip()
    if not raw:
        return f"sqlite:///{(_BACKEND_DIR / 'social_analytics.db').as_posix()}"
    if raw.startswith("sqlite:///"):
        rest = raw[len("sqlite:///") :]
        if rest == ":memory:":
            return raw
        path = Path(rest)
        if not path.is_absolute():
            resolved = (_BACKEND_DIR / path).resolve()
            return f"sqlite:///{resolved.as_posix()}"
    return raw


DATABASE_URL = _resolve_database_url()

if os.getenv("ENVIRONMENT") == "production" and DATABASE_URL.startswith("sqlite"):
    print("WARNING: Using SQLite in a production environment is not recommended.", file=sys.stderr)

# Adjust for SQLAlchemy 1.4+ (PostgreSQL URLs must start with postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite-specific optimization: check_same_thread
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
