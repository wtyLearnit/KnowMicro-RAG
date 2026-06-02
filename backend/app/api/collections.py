"""
苏格拉底之窗 - Collection API Routes
"""
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update as sql_update
from app.database import get_db, Collection, Document, Conversation
from app.schemas.schemas import (
    CollectionCreate, CollectionUpdate, CollectionOut
)
from app.dependencies import get_rag_service
from app.services.rag_service import RAGService

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.get("", response_model=List[CollectionOut])
async def list_collections(db: AsyncSession = Depends(get_db)):
    """List all knowledge base collections."""
    result = await db.execute(
        select(Collection).where(Collection.is_archived == 0).order_by(Collection.updated_at.desc())
    )
    collections = result.scalars().all()

    out = []
    for c in collections:
        # Count documents
        doc_count = await db.scalar(
            select(func.count(Document.id)).where(Document.collection_id == c.id)
        )
        out.append(CollectionOut(
            id=c.id,
            name=c.name,
            description=c.description,
            icon=c.icon,
            document_count=doc_count or 0,
            created_at=c.created_at,
            updated_at=c.updated_at,
        ))
    return out


@router.post("", response_model=CollectionOut, status_code=201)
async def create_collection(
    data: CollectionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new knowledge base collection."""
    # Check duplicate name
    existing = await db.scalar(
        select(Collection).where(Collection.name == data.name)
    )
    if existing:
        raise HTTPException(400, "知识库名称已存在")

    collection = Collection(
        name=data.name,
        description=data.description,
        icon=data.icon,
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)

    return CollectionOut(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        icon=collection.icon,
        document_count=0,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.get("/{collection_id}", response_model=CollectionOut)
async def get_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single collection by ID."""
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(404, "知识库不存在")

    doc_count = await db.scalar(
        select(func.count(Document.id)).where(Document.collection_id == collection_id)
    )
    return CollectionOut(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        icon=collection.icon,
        document_count=doc_count or 0,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.patch("/{collection_id}", response_model=CollectionOut)
async def update_collection(
    collection_id: str,
    data: CollectionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a collection."""
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(404, "知识库不存在")

    if data.name is not None:
        collection.name = data.name
    if data.description is not None:
        collection.description = data.description
    if data.icon is not None:
        collection.icon = data.icon

    await db.commit()
    await db.refresh(collection)

    doc_count = await db.scalar(
        select(func.count(Document.id)).where(Document.collection_id == collection_id)
    )
    return CollectionOut(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        icon=collection.icon,
        document_count=doc_count or 0,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.post("/{collection_id}/archive", status_code=204)
async def archive_collection(
    collection_id: str,
    keep_conversations: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    """Archive a collection (soft delete)."""
    collection = await db.get(Collection, collection_id)
    if not collection or collection.is_archived:
        raise HTTPException(404, "知识库不存在")

    now = datetime.now(timezone.utc)

    # Archive the collection
    collection.is_archived = 1
    collection.archived_at = now

    # Archive documents under this collection
    await db.execute(
        sql_update(Document)
        .where(Document.collection_id == collection_id, Document.is_archived == 0)
        .values(is_archived=1, archived_at=now)
    )

    # Handle conversations
    conversations_result = await db.execute(
        select(Conversation).where(Conversation.collection_id == collection_id)
    )
    conversations = conversations_result.scalars().all()

    if keep_conversations:
        # Keep conversations as read-only, preserve collection_id for later restore
        for conv in conversations:
            conv.is_orphaned = 1
    else:
        # Archive conversations together with the collection
        for conv in conversations:
            conv.is_archived = 1
            conv.archived_at = now

    await db.commit()


@router.post("/{collection_id}/restore", status_code=204)
async def restore_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Restore a collection from trash."""
    collection = await db.get(Collection, collection_id)
    if not collection or not collection.is_archived:
        raise HTTPException(404, "已归档知识库不存在")

    collection.is_archived = 0
    collection.archived_at = None

    # Restore documents
    await db.execute(
        sql_update(Document)
        .where(Document.collection_id == collection_id, Document.is_archived == 1)
        .values(is_archived=0, archived_at=None)
    )

    # Restore archived conversations (keep=False case)
    await db.execute(
        sql_update(Conversation)
        .where(Conversation.collection_id == collection_id, Conversation.is_archived == 1)
        .values(is_archived=0, archived_at=None)
    )
    # Clear orphaned flag on kept conversations (keep=True case)
    await db.execute(
        sql_update(Conversation)
        .where(Conversation.collection_id == collection_id, Conversation.is_orphaned == 1)
        .values(is_orphaned=0)
    )

    await db.commit()


@router.delete("/{collection_id}/permanent", status_code=204)
async def permanent_delete_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    rag: RAGService = Depends(get_rag_service),
):
    """Permanently delete a collection and all its documents."""
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(404, "知识库不存在")

    # Delete orphaned conversations
    orphaned = await db.execute(
        select(Conversation).where(
            Conversation.collection_id == collection_id
        )
    )
    for conv in orphaned.scalars().all():
        await db.delete(conv)

    await db.delete(collection)
    await db.commit()

    # Clean up vector store
    await rag.delete_collection(collection_id)
