"""Carga de variables de entorno desde rutas fijas (no depende del cwd de uvicorn)."""

from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent


def load_application_env() -> None:
    """
    1) .env en la raíz del repo (opcional)
    2) backend/.env (prioridad) — así los datos y DATABASE_URL son coherentes aunque
       ejecutes `uvicorn main:app` desde la carpeta padre.
    """
    repo_root = _BACKEND_DIR.parent
    load_dotenv(repo_root / ".env", override=False)
    load_dotenv(_BACKEND_DIR / ".env", override=True)
