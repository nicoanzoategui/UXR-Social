from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    role: str = "viewer"  # admin, viewer

class Dataset(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    file_name: str
    source_type: str = "Sprout Social"  # Sprout Social, Google, Chatbot
    social_network: str
    account_name: str
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    uploaded_by: Optional[int] = Field(default=None, foreign_key="user.id")
    status: str = "processing"  # processing, ready, failed
    raw_file_path: str
    cleaned_rows_count: int = 0
    discarded_rows_count: int = 0

    comments: List["Comment"] = Relationship(back_populates="dataset")

class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dataset_id: int = Field(foreign_key="dataset.id")
    network: str
    account_name: str
    post_id: Optional[str] = None
    session_id: Optional[str] = None  # For Chatbot sessions
    post_text: Optional[str] = None
    post_url: Optional[str] = None
    comment_id: str
    comment_text: str
    author_name: str
    comment_date: datetime
    message_type: str
    reply_status: str
    theme: Optional[str] = "Unclassified"
    tags: Optional[str] = None  # Comma-separated tags
    rating: Optional[int] = None
    owner_reply: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    dataset: Dataset = Relationship(back_populates="comments")

class ImportLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dataset_id: int = Field(foreign_key="dataset.id")
    step_name: str
    status: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
