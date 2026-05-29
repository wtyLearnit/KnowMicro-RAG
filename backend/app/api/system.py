"""
柏拉图之窗 - Admin & System Routes
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db, Collection, Document, Conversation
from app.schemas.schemas import StatsResponse, ConfigResponse
from app.config import settings
from app.services.rag_service import rag_service

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/stats", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Get system-wide statistics."""
    collection_count = await db.scalar(select(func.count(Collection.id)))
    doc_count = await db.scalar(select(func.count(Document.id)))
    conv_count = await db.scalar(select(func.count(Conversation.id)))

    # Sum vector counts across all collections
    result = await db.execute(select(Collection))
    collections = result.scalars().all()
    vector_count = 0
    for c in collections:
        stats = rag_service.collection_stats(c.id)
        vector_count += stats["chunk_count"]

    return StatsResponse(
        collection_count=collection_count or 0,
        document_count=doc_count or 0,
        vector_count=vector_count,
        conversation_count=conv_count or 0,
    )


@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """Get current system configuration (non-sensitive)."""
    return ConfigResponse(
        llm_model=settings.llm_model,
        embed_model=settings.embed_model,
        embed_dimensions=settings.embed_dimensions,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "柏拉图之窗"}
