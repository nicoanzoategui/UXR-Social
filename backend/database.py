import os
import sys
from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine, Session

# Load environment variables
load_dotenv()

# Determine database URL: check for environment variable 'DATABASE_URL'
# Default to local SQLite for development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./social_analytics.db")

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
