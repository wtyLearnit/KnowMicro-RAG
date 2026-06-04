"""
苏格拉底之窗 - Pydantic Schemas
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, model_validator


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
    slides: Optional[List[dict]] = None


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
    web_search: bool = False


class SourceItem(BaseModel):
    doc_id: str
    doc_name: str
    chunk_text: str
    score: float
    chunk_index: int = 0
    source_type: str = "kb"   # "kb" | "web"
    url: str = ""


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
    web_search: bool = False


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
    web_search_backend: str = "duckduckgo"


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
    config_type: str = Field(..., pattern="^(llm|embedding|web_search)$")
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


# ── Web Search Config Test ───────────────────────────
class WebSearchTestRequest(BaseModel):
    """测试网络搜索 API 连接：可引用已保存的配置，或直接传入参数。"""
    config_id: Optional[str] = None
    provider: Optional[str] = None  # tavily | brave | serper | duckduckgo | custom
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    protocol: Optional[str] = None  # 自定义供应商的协议类型 (tavily/serper/brave)


class WebSearchTestResponse(BaseModel):
    success: bool
    latency_ms: int = 0
    result_count: int = 0


# ── Schedule: Course ───────────────────────────────
class CourseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    location: str = ""
    teacher: str = ""
    color: str = "#4A90D9"
    weeks: str = "1-16"
    semester_start: str = ""


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    day_of_week: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    teacher: Optional[str] = None
    color: Optional[str] = None
    weeks: Optional[str] = None
    semester_start: Optional[str] = None


class CourseOut(BaseModel):
    model_config = {"from_attributes": True}
    id: str
    name: str
    day_of_week: int
    start_time: str
    end_time: str
    location: str
    teacher: str
    color: str
    weeks: str
    semester_start: str
    is_active: bool
    created_at: datetime


# ── Schedule: Task ─────────────────────────────────
class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    estimated_minutes: int = Field(60, ge=5, le=480)
    priority: str = Field("medium", pattern=r"^(low|medium|high)$")
    tags: List[str] = []
    due_date: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    estimated_minutes: Optional[int] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None
    due_date: Optional[str] = None


class TaskOut(BaseModel):
    model_config = {"from_attributes": True}
    id: str
    title: str
    description: str
    estimated_minutes: int
    priority: str
    status: str
    tags: List[str]
    due_date: Optional[str]
    scheduled_event_id: Optional[str]
    created_at: datetime


# ── Schedule: Event ────────────────────────────────
class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    start_time: datetime
    end_time: datetime
    event_type: str = Field("custom", pattern=r"^(course|task|custom)$")
    color: str = "#4A90D9"
    course_id: Optional[str] = None
    task_id: Optional[str] = None
    all_day: bool = False


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    color: Optional[str] = None
    all_day: Optional[bool] = None
    is_completed: Optional[bool] = None


class EventReschedule(BaseModel):
    start_time: datetime
    end_time: datetime


class EventOut(BaseModel):
    model_config = {"from_attributes": True}
    id: str
    title: str
    description: str
    start_time: datetime
    end_time: datetime
    event_type: str
    color: str
    course_id: Optional[str]
    task_id: Optional[str]
    all_day: bool
    is_completed: bool
    created_at: datetime

    @model_validator(mode='after')
    def _ensure_utc(self):
        """数据库存的是 UTC naive datetime，补上时区信息让前端正确解析。"""
        for field in ('start_time', 'end_time', 'created_at'):
            val = getattr(self, field)
            if val and val.tzinfo is None:
                object.__setattr__(self, field, val.replace(tzinfo=timezone.utc))
        return self
    is_completed: bool
    created_at: datetime


class CalendarEventOut(BaseModel):
    """日历混合查询输出：真实事件 + 课表虚拟事件。"""
    id: str
    title: str
    description: str
    start_time: datetime
    end_time: datetime
    event_type: str
    color: str
    course_id: Optional[str] = None
    task_id: Optional[str] = None
    all_day: bool = False
    is_completed: bool = False
    is_virtual: bool = False  # True = 由课表自动生成，不存在于 events 表

    @model_validator(mode='after')
    def _ensure_utc(self):
        """确保输出的 datetime 都带 UTC 时区，前端 new Date() 才能正确解析。"""
        for field in ('start_time', 'end_time'):
            val = getattr(self, field)
            if val and val.tzinfo is None:
                object.__setattr__(self, field, val.replace(tzinfo=timezone.utc))
        return self


# ── Schedule: Import ───────────────────────────────
class ParsedCourseRecord(BaseModel):
    name: str
    day_of_week: int
    start_period: int
    end_period: int
    teacher: str = ""
    location: str = ""
    weeks: str = "1-16"


class PeriodMapping(BaseModel):
    periods: str
    start_time: str
    end_time: str


class ParseExcelResponse(BaseModel):
    format: str  # "list" or "grid"
    records: List[ParsedCourseRecord]
    period_mapping: List[PeriodMapping]


class ParseIcsResponse(BaseModel):
    records: List[ParsedCourseRecord]
    period_mapping: List[PeriodMapping]


class ParseTextRequest(BaseModel):
    text: str


class ImportCoursesRequest(BaseModel):
    records: List[ParsedCourseRecord]
    semester_start: str
    period_mapping: List[PeriodMapping]
    message: str = ""
    error: Optional[str] = None
