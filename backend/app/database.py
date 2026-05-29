"""
柏拉图之窗 - Database Models (SQLAlchemy)
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, DateTime, Integer, Float, ForeignKey, JSON, Index
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings


class Base(DeclarativeBase):
    pass


# ── Collection (知识库) ────────────────────────────
class Collection(Base):
    __tablename__ = "collections"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(256), nullable=False, unique=True)
    description = Column(Text, default="")
    icon = Column(String(64), default="📚")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    documents = relationship("Document", back_populates="collection", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="collection", cascade="all, delete-orphan")


# ── Document ────────────────────────────────────────
class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    collection_id = Column(String(36), ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(512), nullable=False)
    file_type = Column(String(32), nullable=False)        # pdf, txt, md, docx
    file_size = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    status = Column(String(32), default="processing")     # processing, ready, error
    error_message = Column(Text, default="")
    metadata_ = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    collection = relationship("Collection", back_populates="documents")

    __table_args__ = (
        Index("idx_document_collection", "collection_id"),
    )


# ── Conversation ────────────────────────────────────
class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    collection_id = Column(String(36), ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(512), default="新对话")
    model_used = Column(String(128), default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    collection = relationship("Collection", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", 
                            cascade="all, delete-orphan", order_by="Message.created_at")

    __table_args__ = (
        Index("idx_conversation_collection", "collection_id"),
    )


# ── Message ─────────────────────────────────────────
class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(32), nullable=False)              # user, assistant, system
    content = Column(Text, nullable=False)
    sources = Column(JSON, default=list)                   # [{doc_id, doc_name, chunk_text, score}]
    token_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    conversation = relationship("Conversation", back_populates="messages")


# ── Engine & Session ────────────────────────────────
engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """Dependency: yield async DB session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
