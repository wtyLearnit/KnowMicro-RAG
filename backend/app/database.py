"""
苏格拉底之窗 - Database Models (SQLAlchemy)
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
    conversations = relationship("Conversation", back_populates="collection", cascade="save-update, merge")


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
    content = Column(Text, default="")                    # 存储解析后的文本内容
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
    collection_id = Column(String(36), ForeignKey("collections.id", ondelete="SET NULL"), nullable=True)
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


async def _migrate_conversations(conn):
    """Migrate conversations table: make collection_id nullable for free chat support."""
    from sqlalchemy import text
    # Check if table exists
    result = await conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'")
    )
    if not result.fetchone():
        return  # Table doesn't exist yet, create_all will handle it

    # Check if collection_id is currently NOT NULL
    result = await conn.execute(text("PRAGMA table_info(conversations)"))
    columns = result.fetchall()
    for col in columns:
        # col = (cid, name, type, notnull, default_value, pk)
        if col[1] == 'collection_id' and col[3] == 1:
            # collection_id is NOT NULL — need to migrate
            import logging
            logging.getLogger("Socratess_window").info(
                "Migrating conversations table: making collection_id nullable"
            )
            await conn.execute(text("ALTER TABLE conversations RENAME TO conversations_old"))
            await conn.execute(text("""
                CREATE TABLE conversations (
                    id VARCHAR(36) PRIMARY KEY,
                    collection_id VARCHAR(36) REFERENCES collections(id) ON DELETE SET NULL,
                    title VARCHAR(512) DEFAULT '新对话',
                    model_used VARCHAR(128) DEFAULT '',
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            await conn.execute(text("""
                INSERT INTO conversations (id, collection_id, title, model_used, created_at, updated_at)
                SELECT id, collection_id, title, model_used, created_at, updated_at
                FROM conversations_old
            """))
            await conn.execute(text("DROP TABLE conversations_old"))
            # Recreate index
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_conversation_collection ON conversations(collection_id)"
            ))
            break


async def init_db():
    """Create all tables on startup, with migration support."""
    async with engine.begin() as conn:
        await _migrate_conversations(conn)
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """Dependency: yield async DB session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
