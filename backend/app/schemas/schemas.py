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
    model_config_id: Optional[str] = None


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
    model_config_id: Optional[str] = None


class BranchRequest(BaseModel):
    """Create a branch conversation from a specific message."""
    message_id: str = Field(..., min_length=1)
    title: str = Field(default="分支对话", min_length=1, max_length=512)


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


# ── User Model Config ────────────────────────────────
class UserModelConfigCreate(BaseModel):
    config_type: str = Field(..., pattern="^(llm|embedding)$")
    provider: str = Field(default="custom", max_length=32)
    base_url: str = Field(..., min_length=1, max_length=512)
    api_key: str = ""
    model_name: str = Field(..., min_length=1, max_length=128)
    is_active: bool = False
    extra_params: Dict[str, Any] = {}


class UserModelConfigUpdate(BaseModel):
    provider: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    is_active: Optional[bool] = None
    extra_params: Optional[Dict[str, Any]] = None


class UserModelConfigOut(BaseModel):
    id: str
    config_type: str
    provider: str
    base_url: str
    model_name: str
    is_active: bool
    extra_params: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ModelTestRequest(BaseModel):
    """测试连接：可引用已保存的配置，或直接传入参数。"""
    config_id: Optional[str] = None
    config_type: Optional[str] = Field(default=None, pattern="^(llm|embedding)$")
    provider: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None


class ModelTestResponse(BaseModel):
    success: bool
    latency_ms: int = 0
    message: str = ""
    error: Optional[str] = None


class ActiveConfigsResponse(BaseModel):
    llm: Optional[UserModelConfigOut] = None
    embedding: Optional[UserModelConfigOut] = None
    llm_configs: List[UserModelConfigOut] = []
    embedding_configs: List[UserModelConfigOut] = []


class FetchModelsRequest(BaseModel):
    """请求获取供应商可用模型列表。"""
    config_type: str = Field(..., pattern="^(llm|embedding)$")
    base_url: str = Field(..., min_length=1)
    api_key: str = ""
    config_id: Optional[str] = None


class ModelInfo(BaseModel):
    id: str
    owned_by: str = ""


class FetchModelsResponse(BaseModel):
    success: bool
    models: List[ModelInfo] = []
    error: Optional[str] = None


class BatchAddRequest(BaseModel):
    """批量添加模型配置。"""
    config_type: str = Field(..., pattern="^(llm|embedding)$")
    provider: str = "custom"
    base_url: str = Field(..., min_length=1)
    api_key: str = ""
    models: List[str] = Field(..., min_length=1)
    extra_params: Optional[Dict[str, Any]] = None


class BatchAddResponse(BaseModel):
    created: int
    skipped: int
    models: List[str] = []
