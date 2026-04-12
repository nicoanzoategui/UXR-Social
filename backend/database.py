import os
import sys
from pathlib import Path

from sqlalchemy import event
from sqlmodel import SQLModel, create_engine, Session

from env_bootstrap import load_application_env

load_application_env()

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
    print(
        "WARNING: SQLite en producción sin disco persistente pierde datos en cada deploy/reinicio. "
        "Usá Postgres (DATABASE_URL) o un volumen montado y apuntá sqlite a esa ruta absoluta.",
        file=sys.stderr,
    )

# Adjust for SQLAlchemy 1.4+ (PostgreSQL URLs must start with postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite-specific optimization: check_same_thread
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)


@event.listens_for(engine, "connect")
def _sqlite_pragma(dbapi_connection, _connection_record):
    if not str(DATABASE_URL).startswith("sqlite"):
        return
    if ":memory:" in str(DATABASE_URL):
        return
    cur = dbapi_connection.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.execute("PRAGMA synchronous=NORMAL")
    cur.close()


def _log_database_target() -> None:
    u = str(DATABASE_URL)
    if ":memory:" in u:
        print(
            "[database] ADVERTENCIA: DATABASE_URL apunta a SQLite en memoria. "
            "Los datos se pierden al reiniciar el proceso.",
            file=sys.stderr,
        )
        return
    if u.startswith("sqlite"):
        path = u.replace("sqlite:///", "", 1)
        print(f"[database] Persistencia SQLite en archivo: {path}", file=sys.stderr)
        return
    if "@" in u:
        print("[database] Usando base de datos remota (URL con credenciales omitida).", file=sys.stderr)
    else:
        print(f"[database] DATABASE_URL configurada ({u.split('://')[0]}).", file=sys.stderr)


_log_database_target()


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
