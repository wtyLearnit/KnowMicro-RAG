"""
苏格拉底之窗 - Chat & Search API Routes
"""
from typing import List
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db, Collection, Conversation, Message
from app.schemas.schemas import (
    ChatRequest, ChatResponse, SearchRequest, SearchResponse,
    SearchResultItem, ConversationOut, MessageOut,
)
from app.services.rag_service import rag_service
from app.services.exceptions import ExternalServiceError

router = APIRouter(tags=["chat"])

# ── Semantic Search ─────────────────────────────────
search_router = APIRouter(prefix="/api/search", tags=["search"])


@search_router.post("", response_model=SearchResponse)
async def semantic_search(
    req: SearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Semantic search across a collection (or globally)."""
    if req.collection_id:
        collection = await db.get(Collection, req.collection_id)
        if not collection:
            raise HTTPException(404, "知识库不存在")
        results = await rag_service.retrieve(
            req.collection_id, req.query, req.top_k
        )
    else:
        # Global search across all collections: simplified for now
        result = await db.execute(select(Collection))
        all_collections = result.scalars().all()
        results = []
        for coll in all_collections:
            coll_results = await rag_service.retrieve(
                coll.id, req.query, top_k=req.top_k
            )
            results.extend(coll_results)

        # Re-sort by score and trim
        results.sort(key=lambda x: x["score"], reverse=True)
        results = results[:req.top_k]

    return SearchResponse(
        query=req.query,
        results=[
            SearchResultItem(
                doc_id=r["doc_id"],
                doc_name=r["doc_name"],
                chunk_text=r["chunk_text"][:500],
                score=r["score"],
                chunk_index=r["chunk_index"],
            )
            for r in results
        ],
    )


# ── RAG Chat ────────────────────────────────────────
chat_router = APIRouter(prefix="/api/chat", tags=["chat"])


@chat_router.post("", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """RAG-powered chat: retrieve context from knowledge base, then generate."""
    # Verify collection
    collection = await db.get(Collection, req.collection_id)
    if not collection:
        raise HTTPException(404, "知识库不存在")

    # Get or create conversation
    if req.conversation_id:
        conversation = await db.get(Conversation, req.conversation_id)
        if not conversation:
            raise HTTPException(404, "对话不存在")
    else:
        conversation = Conversation(
            collection_id=req.collection_id,
            title=req.message[:50] + ("..." if len(req.message) > 50 else ""),
            model_used="rag",
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

    # Get conversation history (most recent 20 messages, in chronological order)
    hist_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(20)
    )
    messages = list(reversed(hist_result.scalars().all()))
    history = [
        {"role": m.role, "content": m.content}
        for m in messages
    ]

    # Save user message
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    await db.commit()

    # Run RAG pipeline
    response = await rag_service.query(
        collection_id=req.collection_id,
        user_message=req.message,
        history=history,
        top_k=req.top_k,
        mode=req.mode,
    )

    # Save assistant message
    assistant_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=response["content"],
        sources=response.get("sources", []),
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return ChatResponse(
        conversation_id=conversation.id,
        message_id=assistant_msg.id,
        content=response["content"],
        sources=response.get("sources", []),
        usage=response.get("usage", {}),
    )


@chat_router.post("/stream")
async def chat_stream(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Streaming RAG chat via Server-Sent Events."""
    # Verify collection
    collection = await db.get(Collection, req.collection_id)
    if not collection:
        raise HTTPException(404, "知识库不存在")

    # Get or create conversation
    if req.conversation_id:
        conversation = await db.get(Conversation, req.conversation_id)
        if not conversation:
            raise HTTPException(404, "对话不存在")
    else:
        conversation = Conversation(
            collection_id=req.collection_id,
            title=req.message[:50] + ("..." if len(req.message) > 50 else ""),
            model_used="rag",
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

    # Get history (most recent 20 messages, in chronological order)
    hist_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(20)
    )
    messages = list(reversed(hist_result.scalars().all()))
    history = [{"role": m.role, "content": m.content} for m in messages]

    # Save user message
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    await db.commit()

    conversation_id = conversation.id

    async def event_stream():
        full_content = ""
        sources = []
        errored = False

        try:
            async for event in rag_service.query_stream(
                collection_id=req.collection_id,
                user_message=req.message,
                history=history,
                top_k=req.top_k,
                mode=req.mode,
            ):
                if event["type"] == "chunk":
                    full_content += event["content"]
                    yield f"data: {json.dumps({'type': 'chunk', 'content': event['content']}, ensure_ascii=False)}\n\n"
                elif event["type"] == "sources":
                    sources = event["sources"]
                    yield f"data: {json.dumps({'type': 'sources', 'sources': sources}, ensure_ascii=False)}\n\n"
        except ExternalServiceError as e:
            errored = True
            yield f"data: {json.dumps({'type': 'error', 'message': e.message}, ensure_ascii=False)}\n\n"
        except Exception:
            errored = True
            yield f"data: {json.dumps({'type': 'error', 'message': '生成回复时发生未知错误'}, ensure_ascii=False)}\n\n"

        # Persist the assistant message only if we produced content (use a new session)
        if full_content and not errored:
            from app.database import async_session as db_session
            async with db_session() as save_db:
                assistant_msg = Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=full_content,
                    sources=sources,
                )
                save_db.add(assistant_msg)
                await save_db.commit()

        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Conversations ───────────────────────────────────
conv_router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@conv_router.get("/{collection_id}", response_model=List[ConversationOut])
async def list_conversations(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List conversations for a collection."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.collection_id == collection_id)
        .order_by(Conversation.updated_at.desc())
    )
    conversations = result.scalars().all()

    out = []
    for conv in conversations:
        msg_count = await db.scalar(
            select(func.count(Message.id)).where(Message.conversation_id == conv.id)
        )
        out.append(ConversationOut(
            id=conv.id,
            collection_id=conv.collection_id,
            title=conv.title,
            model_used=conv.model_used,
            message_count=msg_count or 0,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        ))
    return out


@conv_router.get("/{collection_id}/{conversation_id}", response_model=List[MessageOut])
async def get_messages(
    collection_id: str,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all messages of a conversation."""
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return result.scalars().all()


@conv_router.delete("/{collection_id}/{conversation_id}", status_code=204)
async def delete_conversation(
    collection_id: str,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation."""
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "对话不存在")
    await db.delete(conv)
    await db.commit()
