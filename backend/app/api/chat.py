"""
苏格拉底之窗 - Chat & Search API Routes
"""
from typing import List
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete as sql_delete
from app.database import get_db, Collection, Conversation, Message
from app.schemas.schemas import (
    ChatRequest, ChatResponse, SearchRequest, SearchResponse,
    SearchResultItem, ConversationOut, MessageOut,
    ConversationRename, MessageUpdate, RegenerateRequest,
)
from app.services.rag_service import rag_service
from app.services.llm_service import llm_service
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
    """RAG-powered chat or free chat (no knowledge base)."""
    is_free = not req.collection_id

    # Verify collection (only for KB chat)
    if not is_free:
        collection = await db.get(Collection, req.collection_id)
        if not collection:
            raise HTTPException(404, "知识库不存在")

    # Get or create conversation
    if req.conversation_id:
        conversation = await db.get(Conversation, req.conversation_id)
        if not conversation:
            raise HTTPException(404, "对话不存在")
        if conversation.is_orphaned:
            raise HTTPException(400, "此对话关联的知识库已被删除，仅可查看历史记录，无法发送新消息")
    else:
        conversation = Conversation(
            collection_id=req.collection_id,
            title=req.message[:50] + ("..." if len(req.message) > 50 else ""),
            model_used="llm" if is_free else "rag",
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

    # Run pipeline
    if is_free:
        # Free chat: pure LLM, no RAG
        response = await llm_service.chat(req.message, history, context="", mode=req.mode)
        sources = []
    else:
        # RAG chat
        response = await rag_service.query(
            collection_id=req.collection_id,
            user_message=req.message,
            history=history,
            top_k=req.top_k,
            mode=req.mode,
        )
        sources = response.get("sources", [])

    # Save assistant message
    assistant_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=response["content"],
        sources=sources,
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return ChatResponse(
        conversation_id=conversation.id,
        message_id=assistant_msg.id,
        content=response["content"],
        sources=sources,
        usage=response.get("usage", {}),
    )


@chat_router.post("/stream")
async def chat_stream(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Streaming chat via Server-Sent Events (RAG or free chat)."""
    is_free = not req.collection_id

    # Verify collection (only for KB chat)
    if not is_free:
        collection = await db.get(Collection, req.collection_id)
        if not collection:
            raise HTTPException(404, "知识库不存在")

    # Get or create conversation
    if req.conversation_id:
        conversation = await db.get(Conversation, req.conversation_id)
        if not conversation:
            raise HTTPException(404, "对话不存在")
        if conversation.is_orphaned:
            raise HTTPException(400, "此对话关联的知识库已被删除，仅可查看历史记录，无法发送新消息")
    else:
        conversation = Conversation(
            collection_id=req.collection_id,
            title=req.message[:50] + ("..." if len(req.message) > 50 else ""),
            model_used="llm" if is_free else "rag",
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
    collection_id = req.collection_id
    top_k = req.top_k
    mode = req.mode
    user_message = req.message

    async def event_stream():
        full_content = ""
        sources = []
        errored = False

        try:
            if is_free:
                # Free chat: pure LLM, no RAG retrieval
                async for chunk in llm_service.chat_stream(
                    user_message=user_message,
                    history=history,
                    context="",
                    mode=mode,
                ):
                    full_content += chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk}, ensure_ascii=False)}\n\n"
                # Send empty sources for consistency
                yield f"data: {json.dumps({'type': 'sources', 'sources': []}, ensure_ascii=False)}\n\n"
            else:
                # RAG chat
                async for event in rag_service.query_stream(
                    collection_id=collection_id,
                    user_message=user_message,
                    history=history,
                    top_k=top_k,
                    mode=mode,
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


@conv_router.get("/orphaned", response_model=List[ConversationOut])
async def list_orphaned_conversations(
    db: AsyncSession = Depends(get_db),
):
    """List orphaned conversations (kept after collection deletion)."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.is_orphaned == 1, Conversation.is_archived == 0)
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
            is_orphaned=True,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        ))
    return out


@conv_router.get("/free", response_model=List[ConversationOut])
async def list_free_conversations(
    db: AsyncSession = Depends(get_db),
):
    """List conversations without a knowledge base (free chat)."""
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.collection_id.is_(None),
            Conversation.is_orphaned == 0,
            Conversation.is_archived == 0,
        )
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
            collection_id=None,
            title=conv.title,
            model_used=conv.model_used,
            message_count=msg_count or 0,
            is_orphaned=bool(conv.is_orphaned),
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        ))
    return out


@conv_router.get("/{collection_id}", response_model=List[ConversationOut])
async def list_conversations(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List conversations for a collection."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.collection_id == collection_id, Conversation.is_archived == 0)
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
            is_orphaned=bool(conv.is_orphaned),
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


@conv_router.post("/{collection_id}/{conversation_id}/archive", status_code=204)
async def archive_conversation(
    collection_id: str,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Archive a conversation (soft delete)."""
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "对话不存在")
    conv.is_archived = 1
    conv.archived_at = datetime.now(timezone.utc)
    await db.commit()


# ── Feature 1: Rename Conversation ─────────────────
@conv_router.patch("/{collection_id}/{conversation_id}", response_model=ConversationOut)
async def rename_conversation(
    collection_id: str,
    conversation_id: str,
    req: ConversationRename,
    db: AsyncSession = Depends(get_db),
):
    """Rename a conversation."""
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "对话不存在")
    conv.title = req.title
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(conv)

    msg_count = await db.scalar(
        select(func.count(Message.id)).where(Message.conversation_id == conv.id)
    )
    return ConversationOut(
        id=conv.id,
        collection_id=conv.collection_id,
        title=conv.title,
        model_used=conv.model_used,
        message_count=msg_count or 0,
        is_orphaned=bool(conv.is_orphaned),
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


# ── Feature 2: Edit / Delete Message ───────────────
@conv_router.put("/{collection_id}/{conversation_id}/messages/{message_id}", response_model=MessageOut)
async def edit_message(
    collection_id: str,
    conversation_id: str,
    message_id: str,
    req: MessageUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Edit a user message's content."""
    msg = await db.get(Message, message_id)
    if not msg or msg.conversation_id != conversation_id:
        raise HTTPException(404, "消息不存在")
    if msg.role != "user":
        raise HTTPException(400, "只能编辑用户消息")
    msg.content = req.content
    await db.commit()
    await db.refresh(msg)
    return msg


@conv_router.delete("/{collection_id}/{conversation_id}/messages/{message_id}", status_code=204)
async def delete_message(
    collection_id: str,
    conversation_id: str,
    message_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a message and all subsequent messages in the conversation."""
    msg = await db.get(Message, message_id)
    if not msg or msg.conversation_id != conversation_id:
        raise HTTPException(404, "消息不存在")

    # Delete this message and all messages created after it
    await db.execute(
        sql_delete(Message).where(
            Message.conversation_id == conversation_id,
            Message.created_at >= msg.created_at,
        )
    )
    await db.commit()


# ── Feature 3: Regenerate Response (streaming) ─────
@conv_router.post("/{collection_id}/{conversation_id}/messages/{message_id}/regenerate")
async def regenerate_response_stream(
    collection_id: str,
    conversation_id: str,
    message_id: str,
    req: RegenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Regenerate the assistant reply for a given user message.
    - message_id is the USER message whose assistant reply should be regenerated.
    - Deletes the existing assistant reply (the next message after the user message).
    - Streams a new reply via SSE.
    """
    is_free = collection_id == "free"

    # Verify collection (skip for free chat)
    if not is_free:
        collection = await db.get(Collection, collection_id)
        if not collection:
            raise HTTPException(404, "知识库不存在")

    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "对话不存在")

    user_msg = await db.get(Message, message_id)
    if not user_msg or user_msg.conversation_id != conversation_id:
        raise HTTPException(404, "消息不存在")
    if user_msg.role != "user":
        raise HTTPException(400, "只能对用户消息重新生成回复")

    # Find and delete the assistant message that follows this user message
    result = await db.execute(
        select(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.role == "assistant",
            Message.created_at > user_msg.created_at,
        )
        .order_by(Message.created_at.asc())
        .limit(1)
    )
    old_assistant_msg = result.scalar_one_or_none()
    if old_assistant_msg:
        await db.delete(old_assistant_msg)
        await db.commit()

    # Build history from messages BEFORE the user message
    hist_result = await db.execute(
        select(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.created_at < user_msg.created_at,
        )
        .order_by(Message.created_at.desc())
        .limit(20)
    )
    history_msgs = list(reversed(hist_result.scalars().all()))
    history = [{"role": m.role, "content": m.content} for m in history_msgs]

    user_message_text = user_msg.content

    async def event_stream():
        full_content = ""
        sources = []
        errored = False

        try:
            if is_free:
                # Free chat: pure LLM, no RAG
                async for chunk in llm_service.chat_stream(
                    user_message=user_message_text,
                    history=history,
                    context="",
                    mode=req.mode,
                ):
                    full_content += chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'sources', 'sources': []}, ensure_ascii=False)}\n\n"
            else:
                async for event in rag_service.query_stream(
                    collection_id=collection_id,
                    user_message=user_message_text,
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


# ── Feature 5: Branch Conversation ─────────────────
@conv_router.post("/{collection_id}/{conversation_id}/branch", response_model=ConversationOut)
async def branch_conversation(
    collection_id: str,
    conversation_id: str,
    req: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new conversation branched from a specific message.
    Copies all messages up to (and including) the specified message_id
    into a new conversation.
    Body: { "message_id": "...", "title": "..." }
    """
    is_free = collection_id == "free"
    message_id = req.get("message_id")
    title = req.get("title", "分支对话")
    if not message_id:
        raise HTTPException(400, "缺少 message_id")

    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "对话不存在")
    # Verify ownership: free chat convs have null collection_id
    if is_free:
        if conv.collection_id is not None:
            raise HTTPException(404, "对话不存在")
    else:
        if conv.collection_id != collection_id:
            raise HTTPException(404, "对话不存在")

    # Get the branch point message
    branch_msg = await db.get(Message, message_id)
    if not branch_msg or branch_msg.conversation_id != conversation_id:
        raise HTTPException(404, "消息不存在")

    # Get all messages up to and including the branch point
    result = await db.execute(
        select(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.created_at <= branch_msg.created_at,
        )
        .order_by(Message.created_at.asc())
    )
    source_messages = result.scalars().all()

    # Create new conversation
    new_conv = Conversation(
        collection_id=None if is_free else collection_id,
        title=title,
        model_used="llm" if is_free else "rag",
    )
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv)

    # Copy messages
    for msg in source_messages:
        new_msg = Message(
            conversation_id=new_conv.id,
            role=msg.role,
            content=msg.content,
            sources=msg.sources,
            token_count=msg.token_count,
        )
        db.add(new_msg)
    await db.commit()

    msg_count = len(source_messages)
    return ConversationOut(
        id=new_conv.id,
        collection_id=new_conv.collection_id,
        title=new_conv.title,
        model_used=new_conv.model_used,
        message_count=msg_count,
        is_orphaned=False,
        created_at=new_conv.created_at,
        updated_at=new_conv.updated_at,
    )
