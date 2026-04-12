import os
import sys
import shutil
from pathlib import Path
import random
import re
import unicodedata
import secrets
import pandas as pd
from datetime import datetime, timedelta
from collections import Counter
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlmodel import Session, select, SQLModel
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, and_, func
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
import io
import json
from html import escape
import google.generativeai as genai

from database import engine, create_db_and_tables, get_session
from models import Dataset, Comment, ImportLog, User, ShareToken
from processing import clean_sprout_csv, process_chatbot_csv
from auth import verify_password, get_password_hash, create_access_token, decode_token, ACCESS_TOKEN_EXPIRE_MINUTES

# Load environment variables
load_dotenv()

# Google acepta GEMINI_API_KEY (AI Studio) o GOOGLE_API_KEY (nombres nuevos del SDK / documentación).
GEMINI_API_KEY_VALUE = (
    (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
)
if GEMINI_API_KEY_VALUE:
    genai.configure(api_key=GEMINI_API_KEY_VALUE)

# generateContent: los alias gemini-1.5-* ya no están en v1beta; default alineado con la doc actual de Google AI.
GEMINI_GENERATION_MODEL = (os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip() or "gemini-2.5-flash"


def _parse_range_start(start_date: Optional[str]) -> Optional[datetime]:
    """Inicio inclusivo del día para filtros YYYY-MM-DD desde <input type=\"date\">."""
    if not start_date or not str(start_date).strip():
        return None
    s = str(start_date).strip()
    dt = datetime.fromisoformat(s.replace("Z", "+00:00").split("+")[0])
    if "T" not in s and len(s) <= 10:
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return dt


def _parse_range_end(end_date: Optional[str]) -> Optional[datetime]:
    """Fin inclusivo del día (23:59:59) para que el último día del rango no quede vacío."""
    if not end_date or not str(end_date).strip():
        return None
    s = str(end_date).strip()
    dt = datetime.fromisoformat(s.replace("Z", "+00:00").split("+")[0])
    if "T" not in s and len(s) <= 10:
        return dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    return dt


def _analytics_exclude_chatbot(include_chatbot: bool, network: Optional[str]) -> bool:
    """Misma lógica histórica: sin filtro de red, se excluyen datasets Chatbot salvo include_chatbot."""
    if include_chatbot:
        return False
    if network and str(network).strip():
        return False
    return True


def _normalize_date_scope(raw: Optional[str]) -> str:
    """comment_date = mensaje en el CSV; dataset_upload = cuándo se subió el archivo (uploaded_at)."""
    v = (raw or "comment_date").strip().lower()
    if v in ("dataset_upload", "upload", "subida", "archivo"):
        return "dataset_upload"
    return "comment_date"


def _apply_date_scope_filter(statement, start_date: Optional[str], end_date: Optional[str], date_scope: Optional[str]):
    scope = _normalize_date_scope(date_scope)
    ds = _parse_range_start(start_date)
    de = _parse_range_end(end_date)
    if scope == "dataset_upload":
        if ds:
            statement = statement.where(Dataset.uploaded_at >= ds)
        if de:
            statement = statement.where(Dataset.uploaded_at <= de)
    else:
        if ds:
            statement = statement.where(Comment.comment_date >= ds)
        if de:
            statement = statement.where(Comment.comment_date <= de)
    return statement


class TagUpdate(BaseModel):
    tags: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "viewer"

class UserRead(BaseModel):
    id: int
    username: str
    role: str

class ReportRequest(SQLModel):
    emails: List[str]
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    report_data: Optional[dict] = None


class ShareTokenCreate(BaseModel):
    label: str
    expires_at: Optional[datetime] = None


class ShareTokenRead(BaseModel):
    id: int
    token: str
    label: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    is_active: bool


class ShareValidateResponse(BaseModel):
    valid: bool
    label: str


class PDFGenerator:
    @staticmethod
    def generate(data: dict, start_date: str, end_date: str):
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor("#1e293b")
        )
        
        header_style = ParagraphStyle(
            'CustomHeader',
            parent=styles['Heading2'],
            fontSize=16,
            spaceBefore=20,
            spaceAfter=10,
            textColor=colors.HexColor("#4f46e5")
        )

        elements = []
        
        # Title
        elements.append(Paragraph("UXR Social - Reporte de Analytics", title_style))
        elements.append(Paragraph(f"Periodo: {start_date} a {end_date}", styles["Normal"]))
        elements.append(Spacer(1, 20))
        
        # Summary Section
        elements.append(Paragraph("Resumen General", header_style))
        s = data.get("summary", {}) or {}
        if isinstance(s, dict) and ("positive_mentions" in s or "unique_themes" in s):
            summary_data = [
                ["Métrica", "Valor"],
                ["Total Comentarios", str(s.get("total_comments", 0))],
                ["Menciones Positivas", str(s.get("positive_mentions", 0))],
                ["Temas Únicos", str(s.get("unique_themes", 0))],
            ]
        else:
            summary_data = [
                ["Métrica", "Valor"],
                ["Total comentarios", str(s.get("total_comments", 0))],
                ["Autores únicos", str(s.get("unique_authors", 0))],
                ["Redes activas", str(s.get("active_networks", 0))],
                ["Promedio comentarios/día", str(s.get("avg_per_day", 0))],
            ]
        t = Table(summary_data, colWidths=[200, 100])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0"))
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))
        
        # Topics Section
        elements.append(Paragraph("Distribución de Temas", header_style))
        topics = data.get("topics", [])
        topic_table_data = [["Tema", "Comentarios"]]
        for topic in topics[:10]:  # Top 10
            label = topic.get("name") or topic.get("topic") or "N/A"
            val = topic.get("value") if topic.get("value") is not None else topic.get("count", 0)
            topic_table_data.append([str(label), str(val)])
        
        if len(topic_table_data) > 1:
            t_topics = Table(topic_table_data, colWidths=[200, 100])
            t_topics.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0"))
            ]))
            elements.append(t_topics)
        else:
            elements.append(Paragraph("No hay temas detectados para este periodo.", styles["Italic"]))
            
        elements.append(Spacer(1, 30))
        elements.append(Paragraph("Este reporte fue generado automáticamente por UXR Social AI.", styles["Normal"]))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_theme(data: dict, theme: str, start_date: str, end_date: str) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72,
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "ThemePdfTitle",
            parent=styles["Heading1"],
            fontSize=22,
            spaceAfter=14,
            textColor=colors.HexColor("#1e293b"),
        )
        header_style = ParagraphStyle(
            "ThemePdfHeader",
            parent=styles["Heading2"],
            fontSize=14,
            spaceBefore=16,
            spaceAfter=8,
            textColor=colors.HexColor("#4f46e5"),
        )
        meta = data.get("metadata") or {}
        summ = data.get("summary") or {}
        elements = []
        period_label = meta.get("period") or f"{start_date or '—'} a {end_date or '—'}"
        elements.append(Paragraph(f"UXR Social — Tema: {escape(theme)}", title_style))
        elements.append(Paragraph(f"<b>Período:</b> {escape(period_label)}", styles["Normal"]))
        elements.append(
            Paragraph(
                f"<b>Total comentarios:</b> {meta.get('total_comments', '—')} &nbsp;|&nbsp; "
                f"<b>Autores únicos:</b> {summ.get('unique_authors', '—')} &nbsp;|&nbsp; "
                f"<b>Redes en datos:</b> {summ.get('active_networks', '—')}",
                styles["Normal"],
            )
        )
        elements.append(
            Paragraph(
                f"<b>Alcance de red (filtro):</b> {escape(str(meta.get('networks', '—')))}",
                styles["Normal"],
            )
        )
        elements.append(Spacer(1, 16))

        dist = data.get("distribution") or {}
        networks = dist.get("networks") or []
        if networks:
            elements.append(Paragraph("Distribución por red", header_style))
            total_n = meta.get("total_comments") or sum(int(n.get("value") or 0) for n in networks)
            net_rows = [["Red", "Comentarios", "%"]]
            for n in networks:
                v = int(n.get("value") or 0)
                pct = round((v / total_n) * 100) if total_n else 0
                net_rows.append([escape(str(n.get("name", ""))), str(v), f"{pct}%"])
            t_net = Table(net_rows, colWidths=[180, 90, 60])
            t_net.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                        ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ]
                )
            )
            elements.append(t_net)
            elements.append(Spacer(1, 20))

        details = data.get("details") or data.get("topics") or []
        elements.append(Paragraph("Subtemas detectados", header_style))
        if details:
            for i, block in enumerate(details[:25]):
                title = block.get("title") or ""
                elements.append(Paragraph(f"{i + 1}. {escape(title)}", header_style))
                elements.append(
                    Paragraph(
                        f"{block.get('count', 0)} menciones ({block.get('percentage', 0)}%)",
                        styles["Normal"],
                    )
                )
                desc = (block.get("description") or "").strip()
                if desc:
                    safe = escape(desc).replace("\n", "<br/>")
                    elements.append(Paragraph(safe, styles["Normal"]))
                elements.append(Spacer(1, 10))
        else:
            elements.append(Paragraph("Sin subtemas en este período.", styles["Italic"]))

        elements.append(Spacer(1, 24))
        elements.append(Paragraph("Generado por UXR Social AI.", styles["Normal"]))
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()


def _safe_attachment_filename(*parts: str) -> str:
    raw = "_".join(p for p in parts if p) or "reporte"
    return re.sub(r"[^\w\-.]+", "_", raw)[:120]


# Mail Configuration
conf = ConnectionConfig(
    MAIL_USERNAME = os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD"),
    MAIL_FROM = os.getenv("MAIL_FROM"),
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER = os.getenv("MAIL_SERVER"),
    MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "UXR Social Reports"),
    MAIL_STARTTLS = True,
    MAIL_SSL_TLS = False,
    USE_CREDENTIALS = True,
    VALIDATE_CERTS = False
)

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Social Comments Analytics API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS: Next con --hostname 127.0.0.1 envía Origin http://127.0.0.1:PORT (distinto de localhost para el navegador).
def _cors_allow_origins() -> List[str]:
    default = (
        "http://localhost:3000,http://localhost:3001,http://localhost:3005,http://localhost:3006,"
        "http://127.0.0.1:3005,http://127.0.0.1:3006"
    )
    raw = (os.getenv("FRONTEND_URL") or default).split(",")
    seen = set()
    out: List[str] = []
    for o in raw:
        o = o.strip()
        if o and o not in seen:
            seen.add(o)
            out.append(o)
    mirror_pairs = [
        ("http://localhost:3005", "http://127.0.0.1:3005"),
        ("http://localhost:3006", "http://127.0.0.1:3006"),
        ("http://localhost:3000", "http://127.0.0.1:3000"),
        ("http://localhost:3001", "http://127.0.0.1:3001"),
    ]
    for a, b in mirror_pairs:
        if a in seen and b not in seen:
            seen.add(b)
            out.append(b)
        elif b in seen and a not in seen:
            seen.add(a)
            out.append(a)
    return out


origins = _cors_allow_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Misma idea que database.py: rutas relativas al cwd rompen al reiniciar uvicorn desde otro directorio.
_BACKEND_ROOT = Path(__file__).resolve().parent
UPLOAD_DIR = str((_BACKEND_ROOT / "uploads").resolve())
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _recent_identical_upload(
    session: Session,
    *,
    file_name: str,
    social_network: str,
    account_name: str,
    source_type: Optional[str] = None,
    within_seconds: int = 120,
) -> Optional[Dataset]:
    """
    Evita doble POST accidental del mismo archivo; permite el mismo nombre de archivo
    (muy habitual en exportaciones de Sprout) en importaciones posteriores.
    """
    since = datetime.utcnow() - timedelta(seconds=within_seconds)
    stmt = (
        select(Dataset)
        .where(Dataset.file_name == file_name)
        .where(Dataset.social_network == social_network)
        .where(Dataset.account_name == account_name)
        .where(Dataset.uploaded_at >= since)
    )
    if source_type is not None:
        stmt = stmt.where(Dataset.source_type == source_type)
    return session.exec(stmt).first()

def _upsert_seed_user(
    session: Session,
    username: Optional[str],
    plain_password: Optional[str],
    role: str,
    *,
    always_rehash: bool = False,
) -> None:
    """Create seed user or refresh password hash when env password no longer matches (fixes stale DB)."""
    if not username or not plain_password:
        return
    existing = session.exec(select(User).where(User.username == username)).first()
    if existing:
        if existing.role != role:
            existing.role = role
        if always_rehash or not verify_password(plain_password, existing.hashed_password):
            existing.hashed_password = get_password_hash(plain_password)
        session.add(existing)
    else:
        session.add(User(
            username=username,
            hashed_password=get_password_hash(plain_password),
            role=role
        ))

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    _non_prod = os.getenv("ENVIRONMENT", "development") != "production"
    with Session(engine) as session:
        admin_username = os.getenv("ADMIN_USERNAME")
        analyst_username = os.getenv("ANALYST_USERNAME")
        shared = (os.getenv("SEED_SHARED_PASSWORD") or "").strip()
        admin_password = shared if shared else (os.getenv("ADMIN_PASSWORD") or "").strip()
        analyst_password = shared if shared else (os.getenv("ANALYST_PASSWORD") or "").strip()

        # En desarrollo, alinear siempre el hash con el .env (evita DB “huérfana” u otro cwd).
        _upsert_seed_user(
            session, admin_username, admin_password, "admin", always_rehash=_non_prod
        )
        if not admin_username or not admin_password:
            print("WARNING: Set ADMIN_USERNAME and ADMIN_PASSWORD (or SEED_SHARED_PASSWORD) for the admin user.", file=sys.stderr)

        _upsert_seed_user(
            session, analyst_username, analyst_password, "viewer", always_rehash=_non_prod
        )
        if not analyst_username or not analyst_password:
            print("WARNING: Set ANALYST_USERNAME and ANALYST_PASSWORD (or SEED_SHARED_PASSWORD) for the analyst user.", file=sys.stderr)

        session.commit()

async def get_current_user(request: Request, session: Session = Depends(get_session)):
    token = None
    # Authorization primero: el SPA guarda el JWT del JSON de /token (las cookies cross-origin fallan a veces en dev).
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    if not token:
        cookie_val = request.cookies.get("access_token")
        if cookie_val and cookie_val.startswith("Bearer "):
            token = cookie_val[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    username: str = payload.get("sub")
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@app.get("/users", response_model=List[UserRead])
def get_users(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return session.exec(select(User)).all()

@app.post("/users", response_model=UserRead)
def create_user(user_in: UserCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if exists
    existing = session.exec(select(User).where(User.username == user_in.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    new_user = User(
        username=user_in.username,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user

@app.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(user)
    session.commit()
    return {"ok": True}

@app.get("/")
def read_root():
    return {"message": "Social Comments Analytics API is running"}

@app.post("/token")
@limiter.limit("10/minute")
async def login(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    raw_user = (form_data.username or "").strip()
    user = session.exec(select(User).where(User.username == raw_user)).first()
    if not user and os.getenv("ENVIRONMENT", "development") != "production":
        user = session.exec(
            select(User).where(func.lower(User.username) == func.lower(raw_user))
        ).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    access_token = create_access_token(data={"sub": user.username})
    is_secure = os.getenv("ENVIRONMENT") == "production"
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

@app.get("/api/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username, "role": current_user.role}

@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", httponly=True, samesite="lax")
    return {"message": "Logged out successfully"}


@app.post("/share-tokens", response_model=ShareTokenRead)
def create_share_token(
    body: ShareTokenCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    raw = secrets.token_urlsafe(32)
    row = ShareToken(
        token=raw,
        created_by=current_user.id,
        label=body.label,
        expires_at=body.expires_at,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return ShareTokenRead(
        id=row.id,
        token=row.token,
        label=row.label,
        expires_at=row.expires_at,
        created_at=row.created_at,
        is_active=row.is_active,
    )


@app.get("/share-tokens", response_model=List[ShareTokenRead])
def list_share_tokens(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    rows = session.exec(
        select(ShareToken).where(ShareToken.created_by == current_user.id)
    ).all()
    return [
        ShareTokenRead(
            id=r.id,
            token=r.token,
            label=r.label,
            expires_at=r.expires_at,
            created_at=r.created_at,
            is_active=r.is_active,
        )
        for r in rows
    ]


@app.delete("/share-tokens/{token_id}")
def revoke_share_token(
    token_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    row = session.get(ShareToken, token_id)
    if not row or row.created_by != current_user.id:
        raise HTTPException(status_code=404, detail="Share token not found")
    row.is_active = False
    session.add(row)
    session.commit()
    return {"message": "Share token revoked"}


@app.get("/api/auth/validate-share-token", response_model=ShareValidateResponse)
def validate_share_token(
    token: str = Query(..., description="Share token value"),
    session: Session = Depends(get_session),
):
    row = session.exec(select(ShareToken).where(ShareToken.token == token)).first()
    now = datetime.utcnow()
    if (
        not row
        or not row.is_active
        or (row.expires_at is not None and row.expires_at < now)
    ):
        return ShareValidateResponse(valid=False, label="")
    return ShareValidateResponse(valid=True, label=row.label or "")


@app.post("/upload")
async def upload_csv(
    file: UploadFile = File(...),
    network: str = Form(...),
    account_name: str = Form(...),
    date_from: Optional[str] = Form(None),
    date_to: Optional[str] = Form(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can upload")

    acc = (account_name or "").strip() or network
    dup = _recent_identical_upload(
        session,
        file_name=file.filename,
        social_network=network,
        account_name=acc,
        source_type="Sprout Social",
    )
    if dup:
        raise HTTPException(
            status_code=409,
            detail="Se detectó el mismo archivo dos veces en muy poco tiempo. Si ya se importó, refrescá el historial.",
        )

    # Save raw file
    file_path = os.path.join(UPLOAD_DIR, f"{datetime.now().timestamp()}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create dataset record
    dataset = Dataset(
        file_name=file.filename,
        social_network=network,
        account_name=acc,
        date_from=datetime.fromisoformat(date_from) if date_from else None,
        date_to=datetime.fromisoformat(date_to) if date_to else None,
        raw_file_path=file_path,
        status="processing",
        uploaded_by=current_user.id,
    )
    session.add(dataset)
    session.commit()
    session.refresh(dataset)

    # Clean and process
    success, message, cleaned_count, discarded_count = clean_sprout_csv(file_path, dataset.id, session)

    if success:
        dataset.status = "ready"
    else:
        dataset.status = "failed"
    
    dataset.cleaned_rows_count = cleaned_count
    dataset.discarded_rows_count = discarded_count
    
    session.add(dataset)
    
    # Log the result
    log = ImportLog(
        dataset_id=dataset.id,
        step_name="cleaning",
        status="ready" if success else "failed",
        message=message
    )
    session.add(log)
    session.commit()

    return {"dataset_id": dataset.id, "status": dataset.status, "message": message}

@app.post("/upload-chatbot")
async def upload_chatbot_csv(
    file: UploadFile = File(...),
    account_name: str = Form(...),
    social_network: str = Form("Chatbot"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can upload")

    account_clean = (account_name or "").strip()
    if not account_clean:
        raise HTTPException(status_code=400, detail="Nombre de cuenta requerido")

    sn = social_network or "Chatbot"
    dup_chat = _recent_identical_upload(
        session,
        file_name=file.filename,
        social_network=sn,
        account_name=account_clean,
        source_type="Chatbot",
    )
    if dup_chat:
        raise HTTPException(
            status_code=409,
            detail="Se detectó el mismo archivo de chatbot dos veces en muy poco tiempo. Esperá un momento o revisá el historial.",
        )

    # Save raw file
    file_path = os.path.join(UPLOAD_DIR, f"chatbot_{datetime.now().timestamp()}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create dataset record
    dataset = Dataset(
        file_name=file.filename,
        source_type="Chatbot",
        social_network=sn,
        account_name=account_clean,
        raw_file_path=file_path,
        status="processing",
        uploaded_by=current_user.id,
    )
    session.add(dataset)
    session.commit()
    session.refresh(dataset)

    # Process chatbot CSV
    success, message, cleaned_count, discarded_count = process_chatbot_csv(file_path, dataset.id, session)

    if success:
        dataset.status = "ready"
    else:
        dataset.status = "failed"
    
    dataset.cleaned_rows_count = cleaned_count
    dataset.discarded_rows_count = discarded_count
    
    session.add(dataset)
    
    # Log the result
    log = ImportLog(
        dataset_id=dataset.id,
        step_name="chatbot_processing",
        status="ready" if success else "failed",
        message=message
    )
    session.add(log)
    session.commit()

    return {"dataset_id": dataset.id, "status": dataset.status, "message": message}


@app.get("/datasets", response_model=List[Dataset])
def get_datasets(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    stmt = select(Dataset).order_by(Dataset.uploaded_at.desc())
    return session.exec(stmt).all()

@app.delete("/datasets/{dataset_id}")
def delete_dataset(dataset_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete datasets")
    
    dataset = session.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # 1. Delete related comments
    comments = session.exec(select(Comment).where(Comment.dataset_id == dataset_id)).all()
    for comment in comments:
        session.delete(comment)
        
    # 2. Delete related import logs
    logs = session.exec(select(ImportLog).where(ImportLog.dataset_id == dataset_id)).all()
    for log in logs:
        session.delete(log)
    
    # 3. Delete file from disk if exists
    if dataset.raw_file_path and os.path.exists(dataset.raw_file_path):
        try:
            os.remove(dataset.raw_file_path)
        except Exception as e:
            print(f"Error removing file: {e}")
        
    session.delete(dataset)
    session.commit()
    return {"message": "Dataset, comments, and logs deleted successfully"}

@app.get("/comments", response_model=List[Comment])
def get_comments(
    response: Response,
    network: Optional[str] = None,
    account: Optional[str] = None,
    search: Optional[str] = None,
    theme: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    post_id: Optional[str] = None,
    session_id: Optional[str] = None,
    limit: Optional[int] = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    conditions = []

    if post_id is not None:
        conditions.append(Comment.post_id == post_id)
    if session_id is not None:
        conditions.append(Comment.session_id == session_id)

    ds = _parse_range_start(start_date)
    if ds:
        conditions.append(Comment.comment_date >= ds)
    de = _parse_range_end(end_date)
    if de:
        conditions.append(Comment.comment_date <= de)

    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            conditions.append(Comment.network.in_(network_list))
    elif post_id is None and session_id is None:
        conditions.append(Comment.network != "Chatbot")

    if account:
        conditions.append(Comment.account_name == account)
    if theme:
        conditions.append(Comment.theme == theme)
    if search:
        conditions.append(
            or_(
                Comment.comment_text.contains(search),
                Comment.author_name.contains(search),
            )
        )

    stmt = select(Comment)
    count_stmt = select(func.count(Comment.id))
    if conditions:
        stmt = stmt.where(and_(*conditions))
        count_stmt = count_stmt.where(and_(*conditions))

    stmt = stmt.order_by(Comment.comment_date.desc())

    total = session.exec(count_stmt).one()
    if limit is not None:
        response.headers["X-Total-Count"] = str(total)
        stmt = stmt.offset(offset).limit(limit)

    return session.exec(stmt).all()

@app.patch("/comments/{comment_id}/tags")
def update_comment_tags(
    comment_id: int, 
    tag_update: TagUpdate, 
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    comment = session.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    comment.tags = tag_update.tags
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment

@app.get("/analytics/summary")
def get_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    network: Optional[str] = None,
    include_chatbot: bool = Query(False),
    date_scope: str = Query("comment_date"),
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    # Only include comments from READY datasets
    # AND EXCLUDE Chatbot unless specifically requested
    statement = select(Comment).join(Dataset).where(Dataset.status == "ready")
    
    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
    elif _analytics_exclude_chatbot(include_chatbot, network):
        # DEFAULT: Exclude Chatbot from general analytics
        statement = statement.where(Dataset.source_type != "Chatbot")

    statement = _apply_date_scope_filter(statement, start_date, end_date, date_scope)

    comments = session.exec(statement).all()
    total_comments = len(comments)

    # 1. Word Frequency (with Spanish stopwords filter)
    SPANISH_STOPWORDS = {
        "que", "con", "una", "por", "para", "los", "las", "del", "como",
        "pero", "más", "sus", "hay", "sobre", "cuando", "desde", "hasta",
        "esto", "esta", "este", "estos", "estas", "ese", "esa", "eso",
        "esos", "esas", "ella", "ellos", "ellas", "nosotros", "vosotros",
        "ustedes", "nuestro", "nuestra", "nuestros", "nuestras", "muy",
        "bien", "todo", "todos", "toda", "todas", "algo", "nada", "cada",
        "otro", "otra", "otros", "otras", "mismo", "misma", "mismos",
        "mismas", "tanto", "tanta", "tantos", "tantas", "mucho", "mucha",
        "muchos", "muchas", "poco", "poca", "pocos", "pocas", "aquí",
        "allí", "allá", "también", "tampoco", "solo", "sólo", "aún",
        "aun", "así", "aunque", "porque", "pues", "entonces", "donde",
        "quien", "quién", "cuyo", "cuya", "cuándo", "cuánto", "cuál",
        "cuáles", "hola", "gracias", "hoy", "ahora", "antes", "después",
        "siempre", "nunca", "entre", "hacia", "sino", "ante", "bajo",
        "cabe", "según", "tras", "versus", "vía", "fueron", "están",
        "tiene", "tienen", "tengo", "tenemos", "puedo", "puede", "pueden",
        "quiero", "quiere", "quieren", "hacer", "hace", "hacen", "hago",
        "sería", "seria", "seria", "puede", "podría", "podria", "ser",
        "estar", "tener", "hacer", "haber", "poder", "querer", "decir",
        "saber", "llegar", "pasar", "deber", "poner", "seguir", "dar",
        "venir", "ver", "tomar", "creer", "llevar", "dejar", "sentir",
        "hablar", "esperar", "buscar", "salir", "volver", "vivir",
    }

    all_text = " ".join([c.comment_text for c in comments])
    words = all_text.lower().split()
    filtered_words = [
        w.strip(".,!?¿¡;:\"'()[]") for w in words
        if len(w) > 3 and w.strip(".,!?¿¡;:\"'()[]") not in SPANISH_STOPWORDS
    ]
    top_words = Counter(filtered_words).most_common(50)
    filtered_top_words = [{"word": w, "count": c} for w, c in top_words if w]
    
    # 2. Unique Authors
    unique_authors = len(set([c.author_name for c in comments]))
    
    # 3. Active Networks
    networks = len(set([c.network for c in comments]))
    
    # 4. Daily Average
    if total_comments > 0:
        dates = [c.comment_date.date() for c in comments]
        days = (max(dates) - min(dates)).days + 1
        avg_per_day = round(total_comments / days, 1)
    else:
        avg_per_day = 0

    # 5. Simulated Growth for Comparison (In real app, compare with previous period)
    # Since this is a sample/MVP, we provide mock growth data to show the UI capability
    growth = {
        "total": 12.5,
        "authors": 8.2,
        "networks": 0,
        "avg": -2.4
    }

    return {
        "total_comments": total_comments,
        "unique_authors": unique_authors,
        "active_networks": networks,
        "avg_per_day": avg_per_day,
        "top_words": filtered_top_words[:20],
        "growth": growth
    }


@app.get("/analytics/trends")
def get_trends(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    network: Optional[str] = None,
    include_chatbot: bool = Query(False),
    date_scope: str = Query("comment_date"),
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    statement = select(Comment).join(Dataset).where(Dataset.status == "ready")
    statement = _apply_date_scope_filter(statement, start_date, end_date, date_scope)
    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
    elif _analytics_exclude_chatbot(include_chatbot, network):
        # DEFAULT: Exclude Chatbot
        statement = statement.where(Dataset.source_type != "Chatbot")
        
    comments = session.exec(statement).all()
    if not comments:
        return []
    
    # Group by date and network
    df = pd.DataFrame([{"date": c.comment_date.date(), "network": c.network} for c in comments])
    trends = df.groupby(["date", "network"]).size().reset_index(name="count")
    trends["date"] = trends["date"].astype(str)
    
    return trends.to_dict(orient="records")

@app.get("/analytics/distribution")
def get_distribution(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    network: Optional[str] = None,
    include_chatbot: bool = Query(False),
    date_scope: str = Query("comment_date"),
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    statement = select(Comment).join(Dataset).where(Dataset.status == "ready")
    statement = _apply_date_scope_filter(statement, start_date, end_date, date_scope)
    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
    elif _analytics_exclude_chatbot(include_chatbot, network):
        # DEFAULT: Exclude Chatbot
        statement = statement.where(Dataset.source_type != "Chatbot")
        
    comments = session.exec(statement).all()
    if not comments:
        return {"networks": [], "accounts": []}
    
    df = pd.DataFrame([{"network": c.network, "account": c.account_name} for c in comments])
    
    network_dist = df.groupby("network").size().to_dict()
    account_dist = df.groupby("account").size().to_dict()
    
    return {
        "networks": [{"name": k, "value": v} for k, v in network_dist.items()],
        "accounts": [{"name": k, "value": v} for k, v in account_dist.items()]
    }

@app.get("/analytics/topics")
def get_topics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    network: Optional[str] = None,
    include_chatbot: bool = Query(False),
    date_scope: str = Query("comment_date"),
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    statement = select(Comment).join(Dataset).where(Dataset.status == "ready")
    statement = _apply_date_scope_filter(statement, start_date, end_date, date_scope)
    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
    elif _analytics_exclude_chatbot(include_chatbot, network):
        # DEFAULT: Exclude Chatbot
        statement = statement.where(Dataset.source_type != "Chatbot")
        
    comments = session.exec(statement).all()
    if not comments:
        return []
    
    df = pd.DataFrame([{"theme": c.theme} for c in comments])
    topic_dist = df.groupby("theme").size().sort_values(ascending=False).to_dict()
    
    return [{"topic": k, "count": v} for k, v in topic_dist.items()]

def _normalize_text(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))

STOPWORDS = {
    "que", "con", "una", "por", "para", "los", "las", "del", "como",
    "pero", "mas", "sus", "hay", "sobre", "cuando", "desde", "hasta",
    "esto", "esta", "este", "estos", "estas", "ese", "esa", "eso",
    "esos", "esas", "ella", "ellos", "ellas", "nosotros", "vosotros",
    "ustedes", "nuestro", "nuestra", "muy", "bien", "todo", "todos",
    "toda", "todas", "algo", "nada", "cada", "otro", "otra", "otros",
    "otras", "mismo", "misma", "aqui", "alli", "alla", "tambien",
    "tampoco", "solo", "sola", "aun", "asi", "aunque", "porque",
    "pues", "entonces", "donde", "quien", "hola", "hoy", "ahora",
    "antes", "despues", "siempre", "nunca", "entre", "hacia", "sino",
    "fueron", "estan", "tiene", "tienen", "tengo", "tenemos", "puedo",
    "puede", "pueden", "quiero", "quiere", "quieren", "hacer", "hace",
    "hago", "seria", "podria", "ser", "estar", "tener", "haber",
    "poder", "querer", "decir", "saber", "llegar", "pasar", "deber",
    "poner", "seguir", "dar", "venir", "ver", "tomar", "creer",
    "llevar", "dejar", "sentir", "hablar", "esperar", "buscar",
    "salir", "volver", "vivir", "gracias", "buenas", "buen", "buena",
    "hola", "como", "igual", "favor", "info", "dias", "aca",
}

# Sub-patterns per theme to detect specific concerns
SUB_PATTERNS = {
    "Inscripciones": {
        "Consultas sobre fechas y plazos": ["cuando", "fecha", "plazo", "vence", "hasta", "abre", "cierra", "limite"],
        "Proceso de inscripción": ["como", "pasos", "proceso", "formulario", "registro", "requisito", "tramite"],
        "Disponibilidad de cupos": ["cupo", "lugar", "vacante", "disponible", "lleno", "quedan"],
    },
    "Soporte & Ayuda": {
        "Problemas de acceso y login": ["contrasena", "password", "login", "ingresar", "acceder", "cuenta", "usuario"],
        "Errores en la plataforma": ["no carga", "no funciona", "error", "falla", "bug", "no abre", "caido"],
        "Solicitud de contacto directo": ["whatsapp", "contacto", "telefono", "mail", "llamar", "escribir"],
        "WhatsApp sin respuesta": ["whatsapp", "no responde", "sin respuesta", "esperando", "atencion"],
        "Chatbot ineficaz": ["chatbot", "bot", "automatico", "no entiende", "no resuelve"],
    },
    "Costos": {
        "Consultas de precio": ["precio", "cuanto", "costo", "valor", "tarifa", "sale"],
        "Métodos y facilidades de pago": ["cuotas", "tarjeta", "mercadopago", "transferencia", "efectivo", "debito", "credito"],
        "Búsqueda de descuentos": ["descuento", "promo", "promocion", "beca", "gratis", "gratuito", "beneficio"],
    },
    "Feedback": {
        "Agradecimientos y elogios": ["gracias", "excelente", "genial", "increible", "perfecto", "felicitaciones", "encanto"],
        "Sugerencias de mejora": ["podrian", "sugiero", "faltaria", "deberian", "mejorar", "agregar", "incluir"],
        "Recomendaciones a otros": ["recomiendo", "comparto", "difundo", "les cuento", "les digo"],
    },
    "Otros": {
        "Consultas generales": ["consulta", "pregunta", "saber", "informacion", "dato", "detalle"],
        "Interacción con el contenido": ["me gusto", "visto", "video", "post", "publicacion", "contenido"],
        "Menciones de terceros": ["amigo", "familiar", "conocido", "colega", "trabajo", "equipo"],
    },
}


def _build_theme_report(
    theme: str,
    network: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
    include_chatbot: bool,
    date_scope: str,
    session: Session,
) -> dict:
    # 1. Query Comments for the Specific Theme
    statement = select(Comment).join(Dataset).where(Dataset.status == "ready").where(Comment.theme == theme)
    statement = _apply_date_scope_filter(statement, start_date, end_date, date_scope)

    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
    elif _analytics_exclude_chatbot(include_chatbot, network):
        statement = statement.where(Dataset.source_type != "Chatbot")

    comments = session.exec(statement).all()
    count = len(comments)

    if count == 0:
        return {"error": f"No se encontró información para el tema {theme} en este periodo."}

    # 2. Sub-patterns Distribution (Equivalent to top_problems in consolidated)
    patterns = SUB_PATTERNS.get(theme, {})
    norm_texts = [(_normalize_text(c.comment_text), c) for c in comments]

    problems = []
    for label, keywords in patterns.items():
        hits = [c for norm, c in norm_texts if any(kw in norm for kw in keywords)]
        if hits:
            problems.append({
                "title": label,
                "count": len(hits),
                "percentage": round(len(hits) / count * 100),
                "description": f"Se detectaron menciones relacionadas con {label.lower()}.",
                "tags": keywords[:4],
                "quotes": _get_representative_quotes(hits, keywords)
            })

    problems.sort(key=lambda x: x["count"], reverse=True)

    # 3. Network Distribution for this theme
    net_counts = Counter(c.network for c in comments)
    networks_dist = [{"name": n, "value": v} for n, v in net_counts.items()]

    # 4. Trends for this theme
    daily = {}
    for c in comments:
        d = c.comment_date.strftime("%Y-%m-%d")
        n = c.network
        key = (d, n)
        daily[key] = daily.get(key, 0) + 1

    trends = [{"date": k[0], "network": k[1], "count": v} for k, v in daily.items()]
    trends.sort(key=lambda x: x["date"])

    # 5. Metadata
    period_label = "Histórico completo"
    if start_date and end_date:
        try:
            d1 = datetime.fromisoformat(start_date).strftime("%d/%m/%Y")
            d2 = datetime.fromisoformat(end_date).strftime("%d/%m/%Y")
            period_label = f"Desde {d1} Hasta {d2}"
        except Exception:
            period_label = f"Desde {start_date} Hasta {end_date}"

    return {
        "metadata": {
            "theme": theme,
            "period": period_label,
            "generated_at": datetime.now().strftime("%d/%m/%Y"),
            "total_comments": count,
            "networks": network if network else "IG · FB · LI · X"
        },
        "summary": {
            "total_comments": count,
            "unique_authors": len(set(c.author_name for c in comments)),
            "active_networks": len(net_counts)
        },
        "distribution": {
            "networks": networks_dist
        },
        "topics": problems,
        "trends": trends,
        "details": problems
    }


@app.get("/analytics/theme-report")
def get_theme_report(
    theme: str,
    network: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    include_chatbot: bool = Query(False),
    date_scope: str = Query("comment_date"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    return _build_theme_report(
        theme, network, start_date, end_date, include_chatbot, date_scope, session
    )


@app.post("/analytics/theme-summary")
def post_theme_summary(
    theme: str = Query(..., description="Theme name to analyze"),
    dataset_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    include_chatbot: bool = Query(False),
    date_scope: str = Query("comment_date"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    statement = (
        select(Comment)
        .join(Dataset)
        .where(Dataset.status == "ready")
        .where(Comment.theme == theme)
    )
    if dataset_id is not None:
        statement = statement.where(Dataset.id == dataset_id)
    statement = _apply_date_scope_filter(statement, start_date, end_date, date_scope)
    if _analytics_exclude_chatbot(include_chatbot, None):
        statement = statement.where(Dataset.source_type != "Chatbot")

    statement = statement.order_by(Comment.comment_date.desc()).limit(100)
    comments = session.exec(statement).all()

    texts = [c.comment_text.strip() for c in comments if c.comment_text and c.comment_text.strip()]
    n = len(texts)
    if n == 0:
        raise HTTPException(
            status_code=400,
            detail=f"No hay comentarios para el tema «{theme}» en este periodo.",
        )

    if not GEMINI_API_KEY_VALUE:
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta clave de la API de Gemini. En backend/.env definí GEMINI_API_KEY o GOOGLE_API_KEY "
                "(clave de Google AI Studio) y reiniciá el servidor."
            ),
        )

    prompt = (
        "Actuá como analista de experiencia de usuario e investigación cualitativa, "
        "redactando para un equipo de producto, comunicación y atención al usuario. "
        "Tu lectura debe ser profunda y honesta: no alines forzosamente todo a una conclusión positiva.\n\n"
        f"Dataset: {n} comentarios públicos clasificados bajo el tema «{theme}». "
        "Leé el lenguaje literal y también lo que implica (necesidades, miedos, expectativas incumplidas, "
        "confusión, alivio, reclamo).\n\n"
        "En español, generá un informe con esta estructura (podés usar ## para títulos):\n"
        "## Panorama\n"
        "2–4 oraciones que sinteticen qué está pasando en la voz del usuario respecto de este tema.\n"
        "## Lo que los usuarios están tratando de resolver\n"
        "Inferí intenciones y jobs-to-be-done; diferenciá dudas operativas vs. problemas de valor o confianza.\n"
        "## Fricciones y señales de riesgo para la experiencia\n"
        "Patrones de confusión, demoras, calidad percibida, comparaciones, desconfianza —solo si emergen del texto.\n"
        "## Tono y clima emocional\n"
        "Matices (no solo «positivo/negativo»): frustración, esperanza, neutralidad operativa, etc.\n"
        "## Lectura UX priorizada\n"
        "3–5 insights accionables para mejorar producto, contenidos o canales; indicá prioridad relativa (alta/media/baja) "
        "según frecuencia o gravedad implícita en los comentarios.\n\n"
        "Reglas: basate solo en estos mensajes; si algo no se desprende del texto, decilo explícitamente. "
        "Evitá jerga vacía y bullet lists sin contenido.\n\n"
        "Comentarios:\n"
        + "\n".join(texts)
    )

    try:
        genai.configure(api_key=GEMINI_API_KEY_VALUE)
        model = genai.GenerativeModel(GEMINI_GENERATION_MODEL)
        resp = model.generate_content(prompt)
        summary_str = (getattr(resp, "text", None) or "").strip()
        if not summary_str:
            raise RuntimeError("Respuesta vacía del modelo")
        return {"summary": summary_str, "comments_analyzed": n, "theme": theme}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _get_representative_quotes(comments, pattern_keywords):
    scored = []
    seen_texts = set()
    for c in comments:
        norm = _normalize_text(c.comment_text)
        if norm in seen_texts:
            continue
        score = sum(1 for kw in pattern_keywords if kw in norm)
        if score > 0:
            seen_texts.add(norm)
            scored.append((score, c.author_name, c.comment_text))

    scored.sort(key=lambda x: (x[0], len(x[2])), reverse=True)
    return [{"author": s[1], "text": s[2]} for s in scored[:3]]


@app.get("/analytics/consolidated-report")
def get_consolidated_report(
    network: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    include_chatbot: bool = Query(False),
    date_scope: str = Query("comment_date"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # 1. Base Query
    statement = select(Comment).join(Dataset).where(Dataset.status == "ready")
    statement = _apply_date_scope_filter(statement, start_date, end_date, date_scope)

    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
    elif _analytics_exclude_chatbot(include_chatbot, network):
        statement = statement.where(Dataset.source_type != "Chatbot")

    all_comments = session.exec(statement).all()
    total_comments = len(all_comments)
    
    if total_comments == 0:
        return {"error": "No data found for the selected period."}

    # 2. Summary Stats & Trends
    summary = get_summary(
        start_date,
        end_date,
        network,
        include_chatbot=include_chatbot,
        date_scope=date_scope,
        session=session,
        current_user=current_user,
    )
    distribution = get_distribution(
        start_date,
        end_date,
        network,
        include_chatbot=include_chatbot,
        date_scope=date_scope,
        session=session,
        current_user=current_user,
    )
    trends = get_trends(
        start_date,
        end_date,
        network,
        include_chatbot=include_chatbot,
        date_scope=date_scope,
        session=session,
        current_user=current_user,
    )
    
    # 3. Categorized Analysis
    categories = {}
    for c in all_comments:
        cat = c.theme or "Otros"
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(c)

    # 4. Deep Analysis on Soporte & Ayuda (Top 5 Problems)
    soporte_comments = categories.get("Soporte & Ayuda", [])
    problems = []
    if soporte_comments:
        soporte_patterns = SUB_PATTERNS.get("Soporte & Ayuda", {})
        soporte_norm_texts = [(_normalize_text(c.comment_text), c) for c in soporte_comments]
        
        for label, keywords in soporte_patterns.items():
            hits = [c for norm, c in soporte_norm_texts if any(kw in norm for kw in keywords)]
            if hits:
                problems.append({
                    "title": label,
                    "count": len(hits),
                    "percentage": round(len(hits) / len(soporte_comments) * 100),
                    "description": f"Usuarios expresan preocupaciones relacionadas con {label.lower()}.",
                    "tags": keywords[:4],
                    "quotes": _get_representative_quotes(hits, keywords)
                })
        
        # Sort by count
        problems.sort(key=lambda x: x["count"], reverse=True)
        problems = problems[:5]

    # 5. Feedback Analysis
    feedback_comments = categories.get("Feedback", [])
    feedback_signals = []
    if feedback_comments:
        feedback_signals.append({
            "title": "Señal positiva detectada",
            "description": f"Se identificaron {len(feedback_comments)} menciones positivas. Los usuarios valoran especialmente la calidad del contenido y la atención docente."
        })

    period_label = "Histórico completo"
    if start_date and end_date:
        try:
            d1 = datetime.fromisoformat(start_date).strftime("%d/%m/%Y")
            d2 = datetime.fromisoformat(end_date).strftime("%d/%m/%Y")
            period_label = f"Desde {d1} Hasta {d2}"
        except:
            period_label = f"Desde {start_date} Hasta {end_date}"

    # 6. Topic Distribution for Pie Chart
    topics_list = [{"name": cat, "value": len(msgs)} for cat, msgs in categories.items()]
    topics_list.sort(key=lambda x: x["value"], reverse=True)

    return {
        "metadata": {
            "period": period_label,
            "generated_at": datetime.now().strftime("%d/%m/%Y"),
            "total_comments": total_comments,
            "networks": network if network else "IG · FB · LI · X"
        },
        "summary": summary,
        "distribution": distribution,
        "topics": topics_list,
        "trends": trends,
        "top_problems": problems,
        "feedback_insights": feedback_signals
    }


@app.get("/analytics/consolidated-pdf")
def download_consolidated_pdf(
    network: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    include_chatbot: bool = Query(False),
    date_scope: str = Query("comment_date"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    report = get_consolidated_report(
        network=network,
        start_date=start_date,
        end_date=end_date,
        include_chatbot=include_chatbot,
        date_scope=date_scope,
        session=session,
        current_user=current_user,
    )
    if not isinstance(report, dict) or report.get("error"):
        detail = report.get("error", "Sin datos") if isinstance(report, dict) else "Sin datos"
        raise HTTPException(status_code=400, detail=str(detail))
    start_str = start_date or "inicio"
    end_str = end_date or "fin"
    pdf_bytes = PDFGenerator.generate(report, start_str, end_str)
    fname = _safe_attachment_filename("uxr_consolidado", start_str, end_str) + ".pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@app.get("/analytics/theme-pdf")
def download_theme_pdf(
    theme: str = Query(..., description="Nombre del tema / categoría"),
    network: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    include_chatbot: bool = Query(False),
    date_scope: str = Query("comment_date"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    data = _build_theme_report(
        theme, network, start_date, end_date, include_chatbot, date_scope, session
    )
    if data.get("error"):
        raise HTTPException(status_code=400, detail=str(data["error"]))
    pdf_bytes = PDFGenerator.generate_theme(data, theme, start_date or "", end_date or "")
    fname = _safe_attachment_filename("uxr_tema", theme[:48], start_date or "", end_date or "") + ".pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@app.post("/analytics/consolidated-summary")
def post_consolidated_summary(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    network: Optional[str] = Query(None),
    include_chatbot: bool = Query(False),
    date_scope: str = Query("comment_date"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Informe ejecutivo en texto (Gemini) a partir del mismo dataset que el reporte consolidado."""
    report = get_consolidated_report(
        network=network,
        start_date=start_date,
        end_date=end_date,
        include_chatbot=include_chatbot,
        date_scope=date_scope,
        session=session,
        current_user=current_user,
    )
    if not isinstance(report, dict):
        raise HTTPException(status_code=500, detail="Respuesta de reporte inválida")
    err = report.get("error")
    if err:
        raise HTTPException(status_code=400, detail=str(err))

    if not GEMINI_API_KEY_VALUE:
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta clave de la API de Gemini. En backend/.env definí GEMINI_API_KEY o GOOGLE_API_KEY "
                "(clave de Google AI Studio) y reiniciá el servidor."
            ),
        )

    payload = json.dumps(report, ensure_ascii=False, indent=2)
    if len(payload) > 120_000:
        payload = payload[:120_000] + "\n…[truncado]"

    prompt = (
        "Actuá como analista de experiencia de usuario y social listening, "
        "con criterio de investigación cualitativa + métricas. Vas a presentar esto a liderazgo de producto y CX.\n\n"
        "Debajo tenés un JSON agregado (metadata, summary, distribution, topics, trends, top_problems, feedback_insights). "
        "No copies el JSON ni hagas un inventario seco de números: interpretá qué significan para la experiencia del usuario "
        "y para la operación en redes.\n\n"
        "Redactá en español un informe coherente y con profundidad, usando ## para secciones. Incluí, en el orden que mejor "
        "cuente la historia:\n"
        "- **Apertura analítica**: en 3–5 oraciones, qué está pasando en el período (volumen, diversidad de redes/autores, "
        "lectura global del clima).\n"
        "- **Distribución y territorio de conversación**: qué canales concentran qué tipo de conversación y qué implica "
        "para dónde hay que escuchar y responder.\n"
        "- **Temas y narrativa de usuario**: cómo se reparten los temas; qué necesidades o tensiones sugiere esa mezcla "
        "(conectá topics con summary/top_words solo como apoyo, no como listado).\n"
        "- **Evolución temporal**: si trends aporta señal, contá si hay concentración, picos o calma; si es ruido o poco "
        "datos, decilo con transparencia.\n"
        "- **Soporte, fricción y feedback**: integrá top_problems y feedback_insights; si vienen vacíos, explicá qué eso "
        "sugiere (p. ej. poco volumen en categorías profundas) sin inventar problemas.\n"
        "- **Implicancias UX y próximos pasos**: 4–7 recomendaciones accionables, priorizadas, alineadas al JSON; "
        "indicá para quién son (producto, contenido, community management, soporte).\n\n"
        "Tono: profesional, directo, sin marketing. No inventes cifras ni hechos que no estén en los datos. "
        "Si algo no se puede concluir, reconocelo.\n\n"
        "Datos:\n"
        + payload
    )

    try:
        genai.configure(api_key=GEMINI_API_KEY_VALUE)
        model = genai.GenerativeModel(GEMINI_GENERATION_MODEL)
        resp = model.generate_content(prompt)
        summary_str = (getattr(resp, "text", None) or "").strip()
        if not summary_str:
            raise RuntimeError("Respuesta vacía del modelo")
        return {"summary": summary_str}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analytics/send-report")
async def send_report(
    request: ReportRequest,
    current_user: User = Depends(get_current_user)
):
    if not request.report_data:
        raise HTTPException(status_code=400, detail="Faltan los datos del reporte")
        
    start_str = request.start_date or "Inicio"
    end_str = request.end_date or datetime.now().strftime("%Y-%m-%d")
    
    # 1. Generate PDF
    try:
        pdf_content = PDFGenerator.generate(request.report_data, start_str, end_str)
    except Exception as e:
        print(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Error al generar PDF: {str(e)}")
    
    # 2. Save to temporary file for mailing
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(pdf_content)
        tmp_path = tmp.name

    # 3. Send Email
    try:
        message = MessageSchema(
            subject=f"UXR Social: Reporte de Analytics ({start_str} - {end_str})",
            recipients=request.emails,
            body="Adjunto encontrarás el reporte detallado generado por UXR Social.",
            subtype=MessageType.html,
            attachments=[tmp_path]
        )

        fm = FastMail(conf)
        await fm.send_message(message)
    except Exception as e:
        print(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail=f"Error al enviar el correo: {str(e)}. Verifique su configuración de SMTP.")
    finally:
        # Cleanup temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    
    return {
        "status": "success",
        "message": f"Reporte enviado exitosamente a {len(request.emails)} destinatarios.",
        "recipients": request.emails
    }
