/* 苏格拉底之窗 - Types */

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

export interface DocumentPreview {
  document_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  content: string;
  chunks: DocumentChunk[];
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
