"""
苏格拉底之窗 - Database Models (SQLAlchemy)
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, DateTime, Integer, Float, ForeignKey, JSON, Index,
    Boolean, select, func,
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
    is_archived = Column(Integer, default=0)
    archived_at = Column(DateTime, nullable=True)

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
    file_path = Column(String(1024), default="")           # 原始文件磁盘路径（空=未保存）
    metadata_ = Column("metadata", JSON, default=dict)
    is_archived = Column(Integer, default=0)
    archived_at = Column(DateTime, nullable=True)
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
    is_orphaned = Column(Integer, default=0)  # 关联知识库被归档但保留了对话
    is_archived = Column(Integer, default=0)
    archived_at = Column(DateTime, nullable=True)

    collection = relationship("Collection", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", 
                            cascade="all, delete-orphan", order_by="Message.created_at")

    __table_args__ = (
        Index("idx_conversation_collection", "collection_id"),
        Index("idx_conversation_orphaned_archived", "is_orphaned", "is_archived"),
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

    __table_args__ = (
        Index("idx_message_conversation", "conversation_id"),
        Index("idx_message_created", "created_at"),
    )


# ── User Model Config (用户模型配置) ─────────────────
class UserModelConfig(Base):
    __tablename__ = "user_model_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    config_type = Column(String(16), nullable=False)          # "llm" | "embedding"
    provider = Column(String(32), default="custom")           # openai/deepseek/zhipu/qwen/ollama/custom
    base_url = Column(String(512), nullable=False)
    api_key = Column(Text, default="")                         # API 密钥（明文存储）
    model_name = Column(String(128), nullable=False)
    is_active = Column(Integer, default=0)                    # 同类型仅一个激活
    extra_params = Column(JSON, default=dict)                  # temperature, max_tokens 等
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_umc_config_type", "config_type"),
        Index("idx_umc_active", "config_type", "is_active"),
    )


# ── Course (课程表) ────────────────────────────────
class Course(Base):
    __tablename__ = "courses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    day_of_week = Column(Integer, nullable=False)          # 0=周日 1=周一 ... 6=周六
    start_time = Column(String(5), nullable=False)         # "08:00"
    end_time = Column(String(5), nullable=False)           # "09:40"
    location = Column(String(200), default="")
    teacher = Column(String(100), default="")
    color = Column(String(20), default="#4A90D9")
    weeks = Column(String(200), default="1-16")            # "1,3,5,7-15"
    semester_start = Column(String(10), default="")        # "2026-02-24"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_course_active", "is_active"),
    )


# ── Task (待办任务) ────────────────────────────────
class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    estimated_minutes = Column(Integer, default=60)
    priority = Column(String(10), default="medium")        # low / medium / high
    status = Column(String(20), default="pending")         # pending / scheduled / completed
    tags = Column(JSON, default=list)
    due_date = Column(String(10), nullable=True)           # "2026-06-15"
    scheduled_event_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_task_status", "status"),
    )


# ── ScheduleEvent (日程事件) ───────────────────────
class ScheduleEvent(Base):
    __tablename__ = "schedule_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    event_type = Column(String(20), default="custom")      # course / task / custom
    color = Column(String(20), default="#4A90D9")
    course_id = Column(String(36), nullable=True)
    task_id = Column(String(36), nullable=True)
    all_day = Column(Boolean, default=False)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_event_time", "start_time", "end_time"),
        Index("idx_event_type", "event_type"),
    )


# ── Engine & Session ────────────────────────────────
# SQLite with aiosqlite uses NullPool (no connection pool — SQLite handles its own locking).
# pool_pre_ping validates the connection; pool_recycle prevents stale file handles.
engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args={"check_same_thread": False},
)
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


async def _table_exists(conn, table_name: str) -> bool:
    """Check if a table exists in the database."""
    from sqlalchemy import text
    result = await conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    )
    return result.fetchone() is not None


async def _migrate_archive_fields(conn):
    """Migrate: add is_archived, archived_at, is_orphaned columns if they don't exist."""
    from sqlalchemy import text
    import logging
    logger = logging.getLogger("Socratess_window")

    # Only run migrations on tables that already exist (skip for fresh databases,
    # since create_all will create them with the correct schema)

    if not await _table_exists(conn, "collections"):
        return

    # Check and add columns for collections
    result = await conn.execute(text("PRAGMA table_info(collections)"))
    cols = {row[1] for row in result.fetchall()}
    if 'is_archived' not in cols:
        logger.info("Adding is_archived column to collections")
        await conn.execute(text("ALTER TABLE collections ADD COLUMN is_archived INTEGER DEFAULT 0"))
    if 'archived_at' not in cols:
        logger.info("Adding archived_at column to collections")
        await conn.execute(text("ALTER TABLE collections ADD COLUMN archived_at DATETIME"))

    # Check and add columns for documents
    result = await conn.execute(text("PRAGMA table_info(documents)"))
    cols = {row[1] for row in result.fetchall()}
    if 'is_archived' not in cols:
        logger.info("Adding is_archived column to documents")
        await conn.execute(text("ALTER TABLE documents ADD COLUMN is_archived INTEGER DEFAULT 0"))
    if 'archived_at' not in cols:
        logger.info("Adding archived_at column to documents")
        await conn.execute(text("ALTER TABLE documents ADD COLUMN archived_at DATETIME"))

    # Check and add column for conversations
    result = await conn.execute(text("PRAGMA table_info(conversations)"))
    cols = {row[1] for row in result.fetchall()}
    if 'is_orphaned' not in cols:
        logger.info("Adding is_orphaned column to conversations")
        await conn.execute(text("ALTER TABLE conversations ADD COLUMN is_orphaned INTEGER DEFAULT 0"))
    if 'is_archived' not in cols:
        logger.info("Adding is_archived column to conversations")
        await conn.execute(text("ALTER TABLE conversations ADD COLUMN is_archived INTEGER DEFAULT 0"))
    if 'archived_at' not in cols:
        logger.info("Adding archived_at column to conversations")
        await conn.execute(text("ALTER TABLE conversations ADD COLUMN archived_at DATETIME"))


async def _migrate_api_key_column():
    """Migrate: rename api_key_encrypted to api_key in user_model_configs."""
    from sqlalchemy import text
    import logging
    logger = logging.getLogger("Socratess_window")

    async with engine.begin() as conn:
        if not await _table_exists(conn, "user_model_configs"):
            return

        result = await conn.execute(text("PRAGMA table_info(user_model_configs)"))
        cols = {row[1] for row in result.fetchall()}
        if 'api_key_encrypted' in cols and 'api_key' not in cols:
            logger.info("Migrating user_model_configs: renaming api_key_encrypted to api_key")
            await conn.execute(text("ALTER TABLE user_model_configs RENAME COLUMN api_key_encrypted TO api_key"))


async def init_db():
    """
    Ensure database schema is up to date via Alembic migrations.
    Falls back to create_all for fresh databases.
    """
    import logging
    from alembic.config import Config
    from alembic import command

    logger = logging.getLogger("Socratess_window")

    # Check if alembic_version table exists (tracks applied migrations)
    async with engine.begin() as conn:
        from sqlalchemy import text
        result = await conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'")
        )
        has_alembic = result.fetchone() is not None

    if not has_alembic:
        # Fresh database: run legacy migrations then stamp for Alembic
        logger.info("Fresh database detected, running legacy migrations then Alembic stamp")
        async with engine.begin() as conn:
            await _migrate_conversations(conn)
            await _migrate_archive_fields(conn)
            await conn.run_sync(Base.metadata.create_all)
        try:
            alembic_cfg = Config("alembic.ini")
            command.stamp(alembic_cfg, "head")
            logger.info("Alembic stamped to head after legacy init")
        except Exception:
            logger.warning("Could not stamp Alembic, will retry on next startup")
    else:
        # Existing database: use Alembic migrations
        try:
            alembic_cfg = Config("alembic.ini")
            command.upgrade(alembic_cfg, "head")
            logger.info("Alembic migrations applied successfully")
        except Exception as exc:
            logger.error("Alembic migration failed, falling back to create_all: %s", exc)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

    # Migrate: rename api_key_encrypted to api_key if needed
    await _migrate_api_key_column()

    # Seed default model configs if the table is empty
    await _seed_default_model_configs()


async def _seed_default_model_configs():
    """为首次启动创建系统默认的模型配置记录。"""
    import logging
    from sqlalchemy import select, text as sql_text

    logger = logging.getLogger("Socratess_window")

    async with async_session() as session:
        # Check if table exists and is empty
        try:
            result = await session.execute(
                select(func.count(UserModelConfig.id))
            )
            count = result.scalar()
        except Exception:
            return  # Table doesn't exist yet

        if count and count > 0:
            return  # Already seeded

        # Skip seeding if API keys are placeholder values (user should configure via frontend)
        if settings.llm_api_key in ("sk-your-key-here", ""):
            return

        # Create default LLM config from system settings
        from app.utils.crypto import encrypt_api_key
        llm_config = UserModelConfig(
            config_type="llm",
            provider="custom",
            base_url=settings.llm_api_base,
            api_key=encrypt_api_key(settings.llm_api_key),
            model_name=settings.llm_model,
            is_active=1,
            extra_params={
                "temperature": settings.llm_temperature,
                "max_tokens": settings.llm_max_tokens,
            },
        )
        embed_config = UserModelConfig(
            config_type="embedding",
            provider="custom",
            base_url=settings.embed_api_base,
            api_key=encrypt_api_key(settings.embed_api_key),
            model_name=settings.embed_model,
            is_active=1,
            extra_params={
                "dimensions": settings.embed_dimensions,
                "batch_size": settings.embed_batch_size,
            },
        )
        session.add(llm_config)
        session.add(embed_config)
        await session.commit()
        logger.info("Seeded default model configs from system settings")


async def get_db() -> AsyncSession:
    """Dependency: yield async DB session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
