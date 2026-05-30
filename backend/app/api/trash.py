"""
苏格拉底之窗 - Trash (回收站) API Routes
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update as sql_update, or_
from app.database import get_db, Collection, Document, Conversation, Message
from app.schemas.schemas import (
    TrashResponse, TrashCollectionOut, TrashDocumentOut, TrashConversationOut,
)
from app.services.rag_service import rag_service

router = APIRouter(prefix="/api/trash", tags=["trash"])


@router.get("", response_model=TrashResponse)
async def get_trash(db: AsyncSession = Depends(get_db)):
    """List all archived items."""
    # Archived collections
    coll_result = await db.execute(
        select(Collection).where(Collection.is_archived == 1).order_by(Collection.archived_at.desc())
    )
    archived_collections = coll_result.scalars().all()

    collections_out = []
    for c in archived_collections:
        doc_count = await db.scalar(
            select(func.count(Document.id)).where(
                Document.collection_id == c.id, Document.is_archived == 1
            )
        )
        conv_count = await db.scalar(
            select(func.count(Conversation.id)).where(
                Conversation.collection_id == c.id
            )
        )
        collections_out.append(TrashCollectionOut(
            id=c.id,
            name=c.name,
            description=c.description,
            icon=c.icon,
            document_count=doc_count or 0,
            conversation_count=conv_count or 0,
            archived_at=c.archived_at,
            created_at=c.created_at,
        ))

    # Archived documents (from non-archived collections or orphaned)
    doc_result = await db.execute(
        select(Document).where(Document.is_archived == 1).order_by(Document.archived_at.desc())
    )
    archived_docs = doc_result.scalars().all()

    documents_out = []
    for d in archived_docs:
        coll = await db.get(Collection, d.collection_id)
        documents_out.append(TrashDocumentOut(
            id=d.id,
            collection_id=d.collection_id,
            collection_name=coll.name if coll else "(已删除的知识库)",
            filename=d.filename,
            file_type=d.file_type,
            file_size=d.file_size,
            archived_at=d.archived_at,
            created_at=d.created_at,
        ))

    # Conversations in trash: only is_archived (directly deleted or discarded with collection)
    conv_result = await db.execute(
        select(Conversation)
        .where(Conversation.is_archived == 1)
        .order_by(Conversation.updated_at.desc())
    )
    trash_convs = conv_result.scalars().all()

    conversations_out = []
    for conv in trash_convs:
        msg_count = await db.scalar(
            select(func.count(Message.id)).where(Message.conversation_id == conv.id)
        )
        # All conversations here are is_archived=1
        source = "手动删除" if not conv.is_orphaned else "知识库已删除"
        conversations_out.append(TrashConversationOut(
            id=conv.id,
            collection_id=conv.collection_id,
            collection_name=source,
            title=conv.title,
            message_count=msg_count or 0,
            model_used=conv.model_used,
            is_orphaned=bool(conv.is_orphaned),
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        ))

    return TrashResponse(
        collections=collections_out,
        documents=documents_out,
        conversations=conversations_out,
    )


@router.delete("/collections/{collection_id}", status_code=204)
async def permanent_delete_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete an archived collection and all associated data."""
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(404, "知识库不存在")

    # Delete conversations linked to this collection
    linked = await db.execute(
        select(Conversation).where(Conversation.collection_id == collection_id)
    )
    for conv in linked.scalars().all():
        await db.delete(conv)

    await db.delete(collection)
    await db.commit()

    await rag_service.delete_collection(collection_id)


@router.delete("/documents/{document_id}", status_code=204)
async def permanent_delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete an archived document."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "文档不存在")

    collection_id = doc.collection_id
    await db.delete(doc)
    await db.commit()

    await rag_service.delete_document_chunks(collection_id, document_id)


@router.delete("/conversations/{conversation_id}", status_code=204)
async def permanent_delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a conversation from trash."""
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "对话不存在")

    await db.delete(conv)
    await db.commit()


@router.post("/collections/{collection_id}/restore", status_code=204)
async def restore_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Restore an archived collection with all its documents and conversations."""
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


@router.post("/documents/{document_id}/restore", status_code=204)
async def restore_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Restore an archived document."""
    doc = await db.get(Document, document_id)
    if not doc or not doc.is_archived:
        raise HTTPException(404, "已归档文档不存在")

    doc.is_archived = 0
    doc.archived_at = None
    await db.commit()


@router.post("/conversations/{conversation_id}/restore", status_code=204)
async def restore_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Restore an archived/orphaned conversation."""
    conv = await db.get(Conversation, conversation_id)
    if not conv or (not conv.is_archived and not conv.is_orphaned):
        raise HTTPException(404, "已归档对话不存在")

    conv.is_archived = 0
    conv.archived_at = None
    conv.is_orphaned = 0
    await db.commit()
