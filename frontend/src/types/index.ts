/* KnowMicro - Types */

export interface Collection {
  id: string;
  name: string;
  description: string;
  icon: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  collection_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  status: string;
  error_message: string;
  created_at: string;
}

export interface DocumentChunk {
  index: number;
  text: string;
  char_count: number;
}

export interface SlideData {
  index: number;
  title: string;
  text: string;
  char_count: number;
}

export interface DocumentPreview {
  document_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  content: string;
  chunks: DocumentChunk[];
  slides?: SlideData[] | null;
}

export interface Conversation {
  id: string;
  collection_id: string | null;
  title: string;
  model_used: string;
  message_count: number;
  is_orphaned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources: SourceItem[];
  created_at: string;
}

export interface SourceItem {
  doc_id: string;
  doc_name: string;
  chunk_text: string;
  score: number;
  chunk_index: number;
  source_type?: 'kb' | 'web';
  url?: string;
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  content: string;
  sources: SourceItem[];
  usage: Record<string, number>;
}

export interface SearchResult {
  doc_id: string;
  doc_name: string;
  chunk_text: string;
  score: number;
  chunk_index: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

export interface Stats {
  collection_count: number;
  document_count: number;
  vector_count: number;
  conversation_count: number;
}

export interface SystemConfig {
  llm_model: string;
  embed_model: string;
  embed_dimensions: number;
  chunk_size: number;
  chunk_overlap: number;
  hybrid_search_enabled: boolean;
  reranker_enabled: boolean;
  query_rewrite_enabled: boolean;
}

export interface UploadResponse {
  document_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  status: string;
}

export interface TrashCollection {
  id: string;
  name: string;
  description: string;
  icon: string;
  document_count: number;
  conversation_count: number;
  archived_at: string | null;
  created_at: string;
}

export interface TrashDocument {
  id: string;
  collection_id: string;
  collection_name: string;
  filename: string;
  file_type: string;
  file_size: number;
  archived_at: string | null;
  created_at: string;
}

export interface TrashConversation {
  id: string;
  collection_id: string | null;
  collection_name: string;
  title: string;
  message_count: number;
  model_used: string;
  is_orphaned: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrashData {
  collections: TrashCollection[];
  documents: TrashDocument[];
  conversations: TrashConversation[];
}

// ── User Model Config ────────────────────────────────
export interface UserModelConfig {
  id: string;
  config_type: 'llm' | 'embedding' | 'web_search';
  provider: string;
  base_url: string;
  model_name: string;
  is_active: boolean;
  extra_params: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ModelTestResult {
  success: boolean;
  latency_ms: number;
  message: string;
  error?: string;
}

export interface ActiveConfigs {
  llm: UserModelConfig | null;
  embedding: UserModelConfig | null;
  llm_configs: UserModelConfig[];
  embedding_configs: UserModelConfig[];
}

export interface ModelInfo {
  id: string;
  owned_by: string;
}

export interface FetchModelsResult {
  success: boolean;
  models: ModelInfo[];
  error?: string;
}

export interface BatchAddResult {
  created: number;
  skipped: number;
  models: string[];
}

export interface WebSearchTestResult {
  success: boolean;
  latency_ms: number;
  result_count: number;
  message: string;
  error?: string;
}

// ── Schedule: Course ─────────────────────────────
export interface Course {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  teacher: string;
  color: string;
  weeks: string;
  semester_start: string;
  is_active: boolean;
  created_at: string;
}

// ── Schedule: Task ───────────────────────────────
export interface ScheduleTask {
  id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'scheduled' | 'completed';
  tags: string[];
  due_date: string | null;
  scheduled_event_id: string | null;
  created_at: string;
}

// ── Schedule: Event ──────────────────────────────
export interface ScheduleEvent {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  event_type: 'course' | 'task' | 'custom';
  color: string;
  course_id: string | null;
  task_id: string | null;
  all_day: boolean;
  is_completed: boolean;
  created_at: string;
}

export interface CalendarEvent extends ScheduleEvent {
  is_virtual: boolean;
}

// ── Schedule: Import ─────────────────────────────
export interface ParsedCourseRecord {
  name: string;
  day_of_week: number;
  start_period: number;
  end_period: number;
  teacher: string;
  location: string;
  weeks: string;
}

export interface PeriodMapping {
  periods: string;
  start_time: string;
  end_time: string;
}

export interface ParseExcelResponse {
  format: 'list' | 'grid';
  records: ParsedCourseRecord[];
  period_mapping: PeriodMapping[];
}
