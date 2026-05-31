"""
苏格拉底之窗 - Pydantic Schemas
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ── Collection ──────────────────────────────────────
class CollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    description: str = ""
    icon: str = "📚"


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None


class CollectionOut(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    document_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Document ────────────────────────────────────────
class DocumentOut(BaseModel):
    id: str
    collection_id: str
    filename: str
    file_type: str
    file_size: int
    chunk_count: int
    status: str
    error_message: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentUploadResponse(BaseModel):
    document_id: str
    filename: str
    file_type: str
    file_size: int
    chunk_count: int
    status: str


class DocumentChunk(BaseModel):
    index: int
    text: str
    char_count: int


class DocumentPreview(BaseModel):
    document_id: str
    filename: str
    file_type: str
    file_size: int
    chunk_count: int
    content: str
    chunks: List[DocumentChunk]


# ── Search ──────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    collection_id: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=20)


class SearchResultItem(BaseModel):
    doc_id: str
    doc_name: str
    chunk_text: str
    score: float
    chunk_index: int


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResultItem]


# ── Chat / RAG ──────────────────────────────────────
class ChatRequest(BaseModel):
    collection_id: Optional[str] = None
    message: str = Field(..., min_length=1)
    conversation_id: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=20)
    mode: str = Field(default="socratic", pattern="^(socratic|direct)$")


class SourceItem(BaseModel):
    doc_id: str
    doc_name: str
    chunk_text: str
    score: float
    chunk_index: int = 0


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    content: str
    sources: List[SourceItem] = []
    usage: Dict[str, Any] = {}


# ── Conversation ────────────────────────────────────
class ConversationOut(BaseModel):
    id: str
    collection_id: Optional[str] = None
    title: str
    model_used: str
    message_count: int = 0
    is_orphaned: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationRename(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    sources: List[Dict[str, Any]]
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageUpdate(BaseModel):
    content: str = Field(..., min_length=1)


class MessageDelete(BaseModel):
    """Delete a message and all subsequent messages in the conversation."""
    include_subsequent: bool = True


class RegenerateRequest(BaseModel):
    """Regenerate the assistant reply for a given user message."""
    mode: str = Field(default="socratic", pattern="^(socratic|direct)$")
    top_k: int = Field(default=5, ge=1, le=20)


# ── System ──────────────────────────────────────────
class StatsResponse(BaseModel):
    collection_count: int
    document_count: int
    vector_count: int
    conversation_count: int


class ConfigResponse(BaseModel):
    llm_model: str
    embed_model: str
    embed_dimensions: int
    chunk_size: int
    chunk_overlap: int
    hybrid_search_enabled: bool = True
    reranker_enabled: bool = True
    query_rewrite_enabled: bool = True


# ── Archive / Trash ──────────────────────────────────
class ArchiveCollectionRequest(BaseModel):
    keep_conversations: bool = True


class TrashCollectionOut(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    document_count: int = 0
    conversation_count: int = 0
    archived_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TrashDocumentOut(BaseModel):
    id: str
    collection_id: str
    collection_name: str = ""
    filename: str
    file_type: str
    file_size: int
    archived_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TrashConversationOut(BaseModel):
    id: str
    collection_id: Optional[str] = None
    collection_name: str = ""
    title: str
    message_count: int = 0
    model_used: str = ""
    is_orphaned: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TrashResponse(BaseModel):
    collections: List[TrashCollectionOut] = []
    documents: List[TrashDocumentOut] = []
    conversations: List[TrashConversationOut] = []


class TrashCounts(BaseModel):
    collections: int = 0
    documents: int = 0
    conversations: int = 0
