"""
柏拉图之窗 - Collection API Routes
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db, Collection, Document, Conversation
from app.schemas.schemas import (
    CollectionCreate, CollectionUpdate, CollectionOut
)
from app.services.rag_service import rag_service

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.get("", response_model=List[CollectionOut])
async def list_collections(db: AsyncSession = Depends(get_db)):
    """List all knowledge base collections."""
    result = await db.execute(
        select(Collection).order_by(Collection.updated_at.desc())
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


@router.delete("/{collection_id}", status_code=204)
async def delete_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a collection and all its documents."""
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(404, "知识库不存在")

    await db.delete(collection)
    await db.commit()

    # Clean up vector store
    await rag_service.delete_collection(collection_id)
