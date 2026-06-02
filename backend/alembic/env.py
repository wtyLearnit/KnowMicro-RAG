"""
Alembic environment configuration.
Reads DB URL from app.config, imports all ORM models for autogenerate.
"""
import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import pool
from alembic import context

# Ensure the backend/ directory is on sys.path so app.* imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.database import Base  # noqa: E402 — must import after sys.path setup

# Import all models so Alembic can detect schema changes
import app.database  # noqa: F401 — ensures all models are registered on Base.metadata

# Alembic Config object
config = context.config

# Override sqlalchemy.url from config.py (ignore alembic.ini value)
config.set_main_option("sqlalchemy.url", settings.database_url)

# Setup loggers from alembic.ini if available
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generate SQL script)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connect to live database)."""
    from sqlalchemy import create_engine

    connectable = create_engine(
        settings.database_url.replace("+aiosqlite", ""),  # use sync driver for migrations
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
