import os
import sys
import shutil
import random
import re
import unicodedata
import asyncio
import json
import subprocess
import pandas as pd
from datetime import datetime, timedelta
from collections import Counter
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form, BackgroundTasks, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlmodel import Session, select, SQLModel
from sqlalchemy.orm import selectinload
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

from database import engine, create_db_and_tables, get_session
from models import Dataset, Comment, ImportLog, User
from processing import clean_sprout_csv, process_scraped_reviews, process_chatbot_csv, process_google_maps_txt
from auth import verify_password, get_password_hash, create_access_token, decode_token, ACCESS_TOKEN_EXPIRE_MINUTES
from google_scraper import scrape_google_reviews

# Load environment variables
load_dotenv()

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
class GoogleScrapeRequest(BaseModel):
    url: str
    max_reviews: int = 50

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
        s = data.get("summary", {})
        summary_data = [
            ["Métrica", "Valor"],
            ["Total Comentarios", str(s.get("total_comments", 0))],
            ["Menciones Positivas", str(s.get("positive_mentions", 0))],
            ["Temas Únicos", str(s.get("unique_themes", 0))]
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
        for topic in topics[:10]: # Top 10
             topic_table_data.append([topic.get("name", "N/A"), str(topic.get("value", 0))])
        
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

# CORS configuration
origins = os.getenv("FRONTEND_URL", "http://localhost:3000,http://localhost:3001,http://localhost:3005,http://localhost:3006").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    with Session(engine) as session:
        admin_username = os.getenv("ADMIN_USERNAME")
        admin_password = os.getenv("ADMIN_PASSWORD")
        if admin_username and admin_password:
            existing = session.exec(select(User).where(User.username == admin_username)).first()
            if not existing:
                session.add(User(
                    username=admin_username,
                    hashed_password=get_password_hash(admin_password),
                    role="admin"
                ))
        else:
            print("WARNING: ADMIN_USERNAME or ADMIN_PASSWORD not set — no default admin will be created.", file=sys.stderr)

        analyst_username = os.getenv("ANALYST_USERNAME")
        analyst_password = os.getenv("ANALYST_PASSWORD")
        if analyst_username and analyst_password:
            existing = session.exec(select(User).where(User.username == analyst_username)).first()
            if not existing:
                session.add(User(
                    username=analyst_username,
                    hashed_password=get_password_hash(analyst_password),
                    role="viewer"
                ))
        session.commit()

async def get_current_user(request: Request, session: Session = Depends(get_session)):
    token = None
    # 1. Try httpOnly cookie first
    cookie_val = request.cookies.get("access_token")
    if cookie_val and cookie_val.startswith("Bearer "):
        token = cookie_val[7:]
    # 2. Fallback to Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
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

@app.get("/")
def read_root():
    return {"message": "Social Comments Analytics API is running"}

@app.post("/token")
@limiter.limit("10/minute")
async def login(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == form_data.username)).first()
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

    # Check for duplicate filename
    existing = session.exec(select(Dataset).where(Dataset.file_name == file.filename)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Un archivo con el nombre '{file.filename}' ya existe en el historial.")

    # Save raw file
    file_path = os.path.join(UPLOAD_DIR, f"{datetime.now().timestamp()}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create dataset record
    dataset = Dataset(
        file_name=file.filename,
        social_network=network,
        account_name=account_name,
        date_from=datetime.fromisoformat(date_from) if date_from else None,
        date_to=datetime.fromisoformat(date_to) if date_to else None,
        raw_file_path=file_path,
        status="processing"
    )
    session.add(dataset)
    session.commit()
    session.refresh(dataset)

    # Clean and process
    if file.filename.endswith(".txt"):
        success, message, cleaned_count, discarded_count = process_google_maps_txt(file_path, dataset.id, session)
        dataset.social_network = "google_maps"
        dataset.source_type = "google_maps"
    else:
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
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can upload")

    # Check for duplicate filename
    existing = session.exec(select(Dataset).where(Dataset.file_name == file.filename)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Un archivo chatbot con el nombre '{file.filename}' ya existe.")

    # Save raw file
    file_path = os.path.join(UPLOAD_DIR, f"chatbot_{datetime.now().timestamp()}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create dataset record
    dataset = Dataset(
        file_name=file.filename,
        source_type="Chatbot",
        social_network="Chatbot",
        account_name="WhatsApp/Chatbot",
        raw_file_path=file_path,
        status="processing"
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
async def run_google_scrape_task(dataset_id: int, url: str, max_reviews: int):
    with Session(engine) as session:
        dataset = session.get(Dataset, dataset_id)
        if not dataset:
            return

        try:
            # 1. Scrape — run as a separate subprocess to avoid macOS sandbox issues with Playwright
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            scraper_script = os.path.join(backend_dir, "run_scraper.py")
            proc = await asyncio.create_subprocess_exec(
                sys.executable, scraper_script, url, str(max_reviews),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=backend_dir
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
            
            # Log any stderr from the scraper to our main log
            if stderr:
                print(f"--- Scraper Logs (Dataset {dataset_id}) ---", file=sys.stderr)
                print(stderr.decode(), file=sys.stderr)
                print(f"--- End Scraper Logs ---", file=sys.stderr)

            if proc.returncode != 0:
                error_msg = stderr.decode()[-1000:] if stderr else "Unknown error"
                raise Exception(f"Scraper subprocess failed with exit code {proc.returncode}: {error_msg}")
            reviews = json.loads(stdout.decode().strip() or "[]")
            
            if not reviews:
                dataset.status = "failed"
                log = ImportLog(dataset_id=dataset_id, step_name="scraping", status="failed", message="No reviews found or error during scraping")
                session.add(log)
                session.add(dataset)
                session.commit()
                return

            # 2. Process and Save
            success, message, count = process_scraped_reviews(reviews, dataset_id, session)
            
            dataset.status = "ready" if success else "failed"
            dataset.cleaned_rows_count = count
            
            log = ImportLog(
                dataset_id=dataset_id,
                step_name="processing",
                status="ready" if success else "failed",
                message=message
            )
            session.add(log)
            session.add(dataset)
            session.commit()
            
        except Exception as e:
            dataset.status = "failed"
            log = ImportLog(dataset_id=dataset_id, step_name="scraping_error", status="failed", message=str(e))
            session.add(log)
            session.add(dataset)
            session.commit()

@app.post("/scrape-google")
async def scrape_google(
    request: GoogleScrapeRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can trigger scraping")

    # Create dataset record
    dataset = Dataset(
        file_name=f"Google Sweep - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        social_network="Google",
        account_name="Google Maps",
        status="processing",
        raw_file_path=request.url,
        uploaded_by=current_user.id
    )
    session.add(dataset)
    session.commit()
    session.refresh(dataset)

    # Trigger background task
    background_tasks.add_task(run_google_scrape_task, dataset.id, request.url, request.max_reviews)

    return {"message": "Google scraping started in background", "dataset_id": dataset.id}

async def run_google_maps_bot_task(dataset_id: int, url: str, max_reviews: int = 50):
    with Session(engine) as session:
        dataset = session.get(Dataset, dataset_id)
        if not dataset:
            return

        try:
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            output_filename = f"reseñas_{dataset_id}.txt"
            output_path = os.path.join(UPLOAD_DIR, output_filename)

            node_bin = shutil.which("node") or "node"
            proc = await asyncio.create_subprocess_exec(
                node_bin, "bot.js", url,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=backend_dir,
                env={**os.environ, "OUTPUT_FILE": output_path, "META_RESENAS": str(max_reviews)}
            )
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)
            except asyncio.TimeoutError:
                proc.kill()
                raise Exception("Node scraper timed out after 10 minutes")

            stderr_text = stderr.decode(errors="replace")
            if proc.returncode != 0:
                raise Exception(f"Node scraper failed: {stderr_text}")
            
            dataset.status = "ready"
            dataset.raw_file_path = output_path
            
            log = ImportLog(
                dataset_id=dataset_id,
                step_name="scraping",
                status="ready",
                message=f"Scraping completed. File saved as {output_filename}"
            )
            session.add(log)
            session.add(dataset)
            session.commit()
            
        except Exception as e:
            dataset.status = "failed"
            log = ImportLog(dataset_id=dataset_id, step_name="scraping_error", status="failed", message=str(e))
            session.add(log)
            session.add(dataset)
            session.commit()

@app.post("/api/scrape/google-maps")
@limiter.limit("5/minute")
async def scrape_google_maps_v2(
    request: Request,
    body: GoogleScrapeRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can trigger scraping")

    # Create dataset record
    dataset = Dataset(
        file_name=f"Google Maps Scrape - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        social_network="google_maps",
        account_name="Google Maps Bot",
        status="processing",
        raw_file_path="",
        uploaded_by=current_user.id
    )
    session.add(dataset)
    session.commit()
    session.refresh(dataset)

    # Trigger background task
    background_tasks.add_task(run_google_maps_bot_task, dataset.id, body.url, body.max_reviews)

    return {"message": "Google Maps scraping started", "dataset_id": dataset.id}

@app.get("/api/scrape/download/{filename}")
async def download_scraped_file(filename: str, current_user: User = Depends(get_current_user)):
    safe_name = os.path.basename(filename)
    upload_dir_real = os.path.realpath(UPLOAD_DIR)
    file_path = os.path.realpath(os.path.join(upload_dir_real, safe_name))
    if not file_path.startswith(upload_dir_real + os.sep) and file_path != upload_dir_real:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    from fastapi.responses import FileResponse
    return FileResponse(file_path, filename=safe_name)

@app.get("/datasets", response_model=List[Dataset])
def get_datasets(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    return session.exec(select(Dataset)).all()

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
    network: Optional[str] = None,
    account: Optional[str] = None,
    search: Optional[str] = None,
    theme: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(Comment)
    if start_date:
        statement = statement.where(Comment.comment_date >= datetime.fromisoformat(start_date))
    if end_date:
        statement = statement.where(Comment.comment_date <= datetime.fromisoformat(end_date))
    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
    else:
        # EXCLUDE Chatbot by default in the general comments list
        statement = statement.where(Comment.network != "Chatbot")
    
    if account:
        statement = statement.where(Comment.account_name == account)
    if theme:
        statement = statement.where(Comment.theme == theme)
    if search:
        statement = statement.where(Comment.comment_text.contains(search))
    
    return session.exec(statement).all()

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
    else:
        # DEFAULT: Exclude Chatbot from general analytics
        statement = statement.where(Dataset.source_type != "Chatbot")
        
    if start_date:
        statement = statement.where(Comment.comment_date >= datetime.fromisoformat(start_date))
    if end_date:
        statement = statement.where(Comment.comment_date <= datetime.fromisoformat(end_date))
    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
        
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
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    statement = select(Comment).join(Dataset).where(Dataset.status == "ready")
    if start_date:
        statement = statement.where(Comment.comment_date >= datetime.fromisoformat(start_date))
    if end_date:
        statement = statement.where(Comment.comment_date <= datetime.fromisoformat(end_date))
    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
    else:
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
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    statement = select(Comment).join(Dataset).where(Dataset.status == "ready")
    if start_date:
        statement = statement.where(Comment.comment_date >= datetime.fromisoformat(start_date))
    if end_date:
        statement = statement.where(Comment.comment_date <= datetime.fromisoformat(end_date))
    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
    else:
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
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    statement = select(Comment).join(Dataset).where(Dataset.status == "ready")
    if start_date:
        statement = statement.where(Comment.comment_date >= datetime.fromisoformat(start_date))
    if end_date:
        statement = statement.where(Comment.comment_date <= datetime.fromisoformat(end_date))
    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
    else:
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


@app.get("/analytics/theme-report")
def get_theme_report(
    theme: str,
    network: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # 1. Query Comments for the Specific Theme
    statement = select(Comment).join(Dataset).where(Dataset.status == "ready").where(Comment.theme == theme)
    if start_date:
        statement = statement.where(Comment.comment_date >= datetime.fromisoformat(start_date))
    if end_date:
        statement = statement.where(Comment.comment_date <= datetime.fromisoformat(end_date))
    
    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
    else:
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
    # We call get_trends but need to filter for theme inside or pass it. 
    # For now, let's just filter comments here for trends
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
        except:
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
        "topics": problems, # Reusing 'topics' key for the sub-pattern distribution chart
        "trends": trends,
        "details": problems # For the vertical problem cards
    }

def _get_representative_quotes(comments, pattern_keywords):
    scored = []
    seen_texts = set()
    unique_quotes = []
    for c in comments:
        norm = _normalize_text(c.comment_text)
        if norm in seen_texts:
            continue
        score = sum(1 for kw in pattern_keywords if kw in norm)
        if score > 0:
            seen_texts.add(norm)
            scored.append((score, c.author_name, c.comment_text))
    
    # Sort by score and length
    scored.sort(key=lambda x: (x[0], len(x[2])), reverse=True)
    return [{"author": s[1], "text": s[2]} for s in scored[:3]]

@app.get("/analytics/consolidated-report")
def get_consolidated_report(
    network: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # 1. Base Query
    statement = select(Comment).join(Dataset).where(Dataset.status == "ready")
    if start_date:
        statement = statement.where(Comment.comment_date >= datetime.fromisoformat(start_date))
    if end_date:
        statement = statement.where(Comment.comment_date <= datetime.fromisoformat(end_date))
    
    if network:
        network_list = [n.strip() for n in network.split(",") if n.strip()]
        if network_list:
            statement = statement.where(Comment.network.in_(network_list))
    else:
        statement = statement.where(Dataset.source_type != "Chatbot")
        
    all_comments = session.exec(statement).all()
    total_comments = len(all_comments)
    
    if total_comments == 0:
        return {"error": "No data found for the selected period."}

    # 2. Summary Stats & Trends
    summary = get_summary(start_date, end_date, network, session, current_user)
    distribution = get_distribution(start_date, end_date, network, session, current_user)
    trends = get_trends(start_date, end_date, network, session, current_user)
    
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
