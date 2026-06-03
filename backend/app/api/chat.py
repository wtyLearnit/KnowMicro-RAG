"""
苏格拉底之窗 - Chat & Search API Routes
"""
from typing import List, Optional, AsyncIterator, Dict, Any
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete as sql_delete, case
from app.database import get_db, async_session as db_session_factory, Collection, Conversation, Message, UserModelConfig
from app.schemas.schemas import (
    ChatRequest, ChatResponse, SearchRequest, SearchResponse,
    SearchResultItem, ConversationOut, MessageOut,
    ConversationRename, MessageUpdate, RegenerateRequest, BranchRequest,
)
from app.dependencies import get_rag_service, get_llm_service
from app.services.rag_service import RAGService
from app.services.llm_service import LLMService
from app.services.embedding_service import EmbeddingService
from app.services.exceptions import ExternalServiceError
from app.utils.crypto import decrypt_api_key

logger = logging.getLogger("Socratess_window")
router = APIRouter(tags=["chat"])


async def _resolve_model_services(
    db: AsyncSession,
    model_config_id: Optional[str] = None,
):
    """
    根据 model_config_id 解析用户配置，返回 (llm_svc, emb_svc)。
    若未指定或找不到配置，返回 (None, None) 使用系统默认。
    """
    from app.services.llm_service import create_llm_service_from_config
    from app.services.embedding_service import create_embedding_service_from_config

    llm_svc = None
    emb_svc = None

    # Resolve LLM service
    if model_config_id:
        config = await db.get(UserModelConfig, model_config_id)
        if config and config.config_type == "llm":
            llm_svc = create_llm_service_from_config({
                "base_url": config.base_url,
                "api_key": decrypt_api_key(config.api_key) if config.api_key else "",
                "model_name": config.model_name,
                "extra_params": config.extra_params or {},
            })

    # Always resolve active embedding config
    result = await db.execute(
        select(UserModelConfig).where(
            UserModelConfig.config_type == "embedding",
            UserModelConfig.is_active == 1,
        )
    )
    emb_config = result.scalar_one_or_none()
    if emb_config:
        emb_svc = create_embedding_service_from_config({
            "base_url": emb_config.base_url,
            "api_key": decrypt_api_key(emb_config.api_key) if emb_config.api_key else "",
            "model_name": emb_config.model_name,
            "extra_params": emb_config.extra_params or {},
        })

    # If no specific LLM config, try active LLM
    if llm_svc is None:
        result = await db.execute(
            select(UserModelConfig).where(
                UserModelConfig.config_type == "llm",
                UserModelConfig.is_active == 1,
            )
        )
        llm_config = result.scalar_one_or_none()
        if llm_config:
            llm_svc = create_llm_service_from_config({
                "base_url": llm_config.base_url,
                "api_key": decrypt_api_key(llm_config.api_key) if llm_config.api_key else "",
                "model_name": llm_config.model_name,
                "extra_params": llm_config.extra_params or {},
            })

    return llm_svc, emb_svc

# ── Shared Helpers ───────────────────────────────────


async def _prepare_chat_context(
    collection_id: Optional[str],
    conversation_id: Optional[str],
    user_message: str,
    db: AsyncSession,
):
    """
    Common pre-processing for chat and chat_stream:
    - Verify collection (if KB mode)
    - Get or create conversation
    - Fetch history (last 20 msgs)
    - Save user message

    Returns: (conversation, history, is_free)
    """
    is_free = not collection_id

    if not is_free:
        collection = await db.get(Collection, collection_id)
        if not collection:
            raise HTTPException(404, "知识库不存在")

    if conversation_id:
        conversation = await db.get(Conversation, conversation_id)
        if not conversation:
            raise HTTPException(404, "对话不存在")
        if conversation.is_orphaned:
            raise HTTPException(400, "此对话关联的知识库已被删除，仅可查看历史记录，无法发送新消息")
    else:
        conversation = Conversation(
            collection_id=collection_id,
            title=user_message[:50] + ("..." if len(user_message) > 50 else ""),
            model_used="llm" if is_free else "rag",
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

    hist_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(20)
    )
    messages = list(reversed(hist_result.scalars().all()))
    history = [{"role": m.role, "content": m.content} for m in messages]

    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=user_message,
    )
    db.add(user_msg)
    await db.commit()

    return conversation, history, is_free


async def _free_chat_generator(
    user_message: str,
    history: List[Dict[str, str]],
    mode: str,
    llm: LLMService,
    web_search: bool = False,
) -> AsyncIterator[Dict[str, Any]]:
    """Adapt LLM chat_stream output to unified {type, content/sources} event dicts."""
    context = ""
    sources: List[Dict[str, Any]] = []
    has_web = False

    if web_search:
        from app.services.web_search_service import web_search_service
        ws_resp = await web_search_service.search(user_message)
        if ws_resp.results:
            has_web = True
            from app.services.rag_service import rag_service as _rag
            context = _rag._format_web_context(ws_resp.results)
            sources = _rag._build_web_source_items(ws_resp.results)

    async for chunk in llm.chat_stream(
        user_message=user_message, history=history, context=context, mode=mode,
        has_web_results=has_web,
    ):
        yield {"type": "chunk", "content": chunk}
    yield {"type": "sources", "sources": sources}


async def _sse_wrap(
    generator: AsyncIterator[Dict[str, Any]],
    conversation_id: str,
) -> AsyncIterator[str]:
    """
    Wrap a RAG/LLM event generator with:
    - SSE formatting
    - Error handling (ExternalServiceError → error SSE, generic → error SSE)
    - Assistant message persistence (new session)
    - Final 'done' event
    """
    full_content = ""
    sources: List[Dict[str, Any]] = []
    errored = False

    try:
        async for event in generator:
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
        logger.exception("Unexpected error during streaming generation")
        yield f"data: {json.dumps({'type': 'error', 'message': '生成回复时发生未知错误'}, ensure_ascii=False)}\n\n"

    if full_content and not errored:
        async with db_session_factory() as save_db:
            assistant_msg = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=full_content,
                sources=sources,
            )
            save_db.add(assistant_msg)
            await save_db.commit()

    yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id}, ensure_ascii=False)}\n\n"

# ── Semantic Search ─────────────────────────────────
search_router = APIRouter(prefix="/api/search", tags=["search"])


@search_router.post("", response_model=SearchResponse)
async def semantic_search(
    req: SearchRequest,
    db: AsyncSession = Depends(get_db),
    rag: RAGService = Depends(get_rag_service),
):
    """Semantic search across a collection (or globally)."""
    if req.collection_id:
        collection = await db.get(Collection, req.collection_id)
        if not collection:
            raise HTTPException(404, "知识库不存在")
        results = await rag.retrieve(
            req.collection_id, req.query, req.top_k
        )
    else:
        # Global search across all collections: simplified for now
        result = await db.execute(select(Collection))
        all_collections = result.scalars().all()
        results = []
        for coll in all_collections:
            coll_results = await rag.retrieve(
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
    rag: RAGService = Depends(get_rag_service),
    llm: LLMService = Depends(get_llm_service),
):
    """RAG-powered chat or free chat (no knowledge base)."""
    conversation, history, is_free = await _prepare_chat_context(
        collection_id=req.collection_id,
        conversation_id=req.conversation_id,
        user_message=req.message,
        db=db,
    )

    # Resolve user model config (fallback to system defaults)
    user_llm, user_emb = await _resolve_model_services(db, req.model_config_id)
    active_llm = user_llm or llm

    # Run pipeline
    if is_free:
        if req.web_search:
            from app.services.web_search_service import web_search_service as _wsvc
            ws_resp = await _wsvc.search(req.message)
            ctx = rag._format_web_context(ws_resp.results) if ws_resp.results else ""
            response = await active_llm.chat(req.message, history, context=ctx, mode=req.mode, has_web_results=bool(ws_resp.results))
            sources = rag._build_web_source_items(ws_resp.results) if ws_resp.results else []
        else:
            response = await active_llm.chat(req.message, history, context="", mode=req.mode)
            sources = []
    elif req.web_search:
        response = await rag.query_with_web(
            collection_id=req.collection_id,
            user_message=req.message,
            history=history,
            top_k=req.top_k,
            mode=req.mode,
            llm_svc=active_llm,
            emb_svc=user_emb,
        )
        sources = response.get("sources", [])
    else:
        response = await rag.query(
            collection_id=req.collection_id,
            user_message=req.message,
            history=history,
            top_k=req.top_k,
            mode=req.mode,
            llm_svc=active_llm,
            emb_svc=user_emb,
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
    rag: RAGService = Depends(get_rag_service),
    llm: LLMService = Depends(get_llm_service),
):
    """Streaming chat via Server-Sent Events (RAG or free chat)."""
    conversation, history, is_free = await _prepare_chat_context(
        collection_id=req.collection_id,
        conversation_id=req.conversation_id,
        user_message=req.message,
        db=db,
    )

    # Resolve user model config (fallback to system defaults)
    user_llm, user_emb = await _resolve_model_services(db, req.model_config_id)
    active_llm = user_llm or llm

    conversation_id = conversation.id
    collection_id = req.collection_id
    top_k = req.top_k
    mode = req.mode
    user_message = req.message

    async def build_generator():
        if is_free:
            async for event in _free_chat_generator(user_message, history, mode, active_llm, web_search=req.web_search):
                yield event
        elif req.web_search:
            async for event in rag.query_stream_with_web(
                collection_id=collection_id,
                user_message=user_message,
                history=history,
                top_k=top_k,
                mode=mode,
                llm_svc=active_llm,
                emb_svc=user_emb,
            ):
                yield event
        else:
            async for event in rag.query_stream(
                collection_id=collection_id,
                user_message=user_message,
                history=history,
                top_k=top_k,
                mode=mode,
                llm_svc=active_llm,
                emb_svc=user_emb,
            ):
                yield event

    return StreamingResponse(
        _sse_wrap(build_generator(), conversation_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Conversations ───────────────────────────────────
conv_router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def _build_conversation_rows(rows) -> List[ConversationOut]:
    """Convert joined query rows to ConversationOut list.  Single-query, no N+1."""
    return [
        ConversationOut(
            id=conv.id,
            collection_id=conv.collection_id,
            title=conv.title,
            model_used=conv.model_used,
            message_count=msg_cnt,
            is_orphaned=bool(conv.is_orphaned),
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        )
        for conv, msg_cnt in rows
    ]


@conv_router.get("/orphaned", response_model=List[ConversationOut])
async def list_orphaned_conversations(
    db: AsyncSession = Depends(get_db),
):
    """List orphaned conversations (kept after collection deletion)."""
    result = await db.execute(
        select(Conversation, func.count(Message.id))
        .outerjoin(Message, Message.conversation_id == Conversation.id)
        .where(Conversation.is_orphaned == 1, Conversation.is_archived == 0)
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
    )
    return _build_conversation_rows(result.all())


@conv_router.get("/free", response_model=List[ConversationOut])
async def list_free_conversations(
    db: AsyncSession = Depends(get_db),
):
    """List conversations without a knowledge base (free chat)."""
    result = await db.execute(
        select(Conversation, func.count(Message.id))
        .outerjoin(Message, Message.conversation_id == Conversation.id)
        .where(
            Conversation.collection_id.is_(None),
            Conversation.is_orphaned == 0,
            Conversation.is_archived == 0,
        )
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
    )
    return _build_conversation_rows(result.all())


@conv_router.get("/{collection_id}", response_model=List[ConversationOut])
async def list_conversations(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List conversations for a collection."""
    result = await db.execute(
        select(Conversation, func.count(Message.id))
        .outerjoin(Message, Message.conversation_id == Conversation.id)
        .where(Conversation.collection_id == collection_id, Conversation.is_archived == 0)
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
    )
    return _build_conversation_rows(result.all())


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
    rag: RAGService = Depends(get_rag_service),
    llm: LLMService = Depends(get_llm_service),
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

    # Resolve user model config
    user_llm, user_emb = await _resolve_model_services(db, req.model_config_id)
    active_llm = user_llm or llm

    async def build_generator():
        if is_free:
            async for event in _free_chat_generator(user_message_text, history, req.mode, active_llm, web_search=req.web_search):
                yield event
        elif req.web_search:
            async for event in rag.query_stream_with_web(
                collection_id=collection_id,
                user_message=user_message_text,
                history=history,
                top_k=req.top_k,
                mode=req.mode,
                llm_svc=active_llm,
                emb_svc=user_emb,
            ):
                yield event
        else:
            async for event in rag.query_stream(
                collection_id=collection_id,
                user_message=user_message_text,
                history=history,
                top_k=req.top_k,
                mode=req.mode,
                llm_svc=active_llm,
                emb_svc=user_emb,
            ):
                yield event

    return StreamingResponse(
        _sse_wrap(build_generator(), conversation_id),
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
    req: BranchRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new conversation branched from a specific message.
    Copies all messages up to (and including) the specified message_id
    into a new conversation.
    """
    is_free = collection_id == "free"
    message_id = req.message_id
    title = req.title

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
