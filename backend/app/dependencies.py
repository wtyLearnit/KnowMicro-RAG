"""
FastAPI dependency injection for services.

Replaces module-level singletons with injectable dependencies so that:
- Unit tests can mock any service via app.dependency_overrides
- Future config changes don't require process restart
- Service implementations can be swapped without touching route code

Usage in routes:
    from app.dependencies import get_rag_service, get_llm_service
    rag = Depends(get_rag_service)
"""
from functools import lru_cache

from app.config import settings
from app.services.embedding_service import EmbeddingService
from app.services.llm_service import LLMService
from app.services.document_service import DocumentService
from app.services.chunking_service import ChunkingService
from app.services.rag_service import RAGService


# ── Singleton factories (lazy-init, cached) ─────────


@lru_cache(maxsize=1)
def _get_embedding_service() -> EmbeddingService:
    return EmbeddingService()


@lru_cache(maxsize=1)
def _get_llm_service() -> LLMService:
    return LLMService()


@lru_cache(maxsize=1)
def _get_chunking_service() -> ChunkingService:
    return ChunkingService(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )


@lru_cache(maxsize=1)
def _get_document_service() -> DocumentService:
    return DocumentService()


@lru_cache(maxsize=1)
def _get_rag_service() -> RAGService:
    return RAGService()


# ── Public DI callables (usable with FastAPI Depends) ─


def get_embedding_service() -> EmbeddingService:
    """Return the singleton EmbeddingService (injectable)."""
    return _get_embedding_service()


def get_llm_service() -> LLMService:
    """Return the singleton LLMService (injectable)."""
    return _get_llm_service()


def get_chunking_service() -> ChunkingService:
    """Return the singleton ChunkingService (injectable)."""
    return _get_chunking_service()


def get_document_service() -> DocumentService:
    """Return the singleton DocumentService (injectable)."""
    return _get_document_service()


def get_rag_service() -> RAGService:
    """Return the singleton RAGService (injectable)."""
    return _get_rag_service()
