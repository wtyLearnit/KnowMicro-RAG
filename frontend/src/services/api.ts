/* 苏格拉底之窗 - API Service */
import axios from 'axios';
import type {
  Collection, Document, Conversation, Message,
  ChatResponse, SearchResponse, Stats, SystemConfig, UploadResponse,
  DocumentPreview, TrashData, SourceItem,
  UserModelConfig, ModelTestResult, ActiveConfigs,
  FetchModelsResult, BatchAddResult, WebSearchTestResult,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

// Token 认证：从 localStorage 读取 api_token 并附加到每个请求
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('api_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Collections ────────────────────────────────────
export const listCollections = () =>
  api.get<Collection[]>('/collections').then(r => r.data);

export const createCollection = (data: { name: string; description: string; icon: string }) =>
  api.post<Collection>('/collections', data).then(r => r.data);

export const getCollection = (id: string) =>
  api.get<Collection>(`/collections/${id}`).then(r => r.data);

export const updateCollection = (id: string, data: Partial<Collection>) =>
  api.patch<Collection>(`/collections/${id}`, data).then(r => r.data);

export const deleteCollection = (id: string) =>
  api.delete(`/collections/${id}`);

// ── Documents ──────────────────────────────────────
export const uploadDocument = (collectionId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<UploadResponse>(`/documents/upload/${collectionId}`, form).then(r => r.data);
};

export const uploadDocumentWithProgress = (
  collectionId: string,
  file: File,
  onProgress: (percent: number) => void,
) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<UploadResponse>(`/documents/upload/${collectionId}`, form, {
    timeout: 600000,  // 10 min for large files
    onUploadProgress: (e) => {
      if (e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  }).then(r => r.data);
};

export const getDocumentPreview = (documentId: string) =>
  api.get<DocumentPreview>(`/documents/${documentId}`).then(r => r.data);

export const listDocuments = (collectionId: string) =>
  api.get<Document[]>(`/documents/collection/${collectionId}`).then(r => r.data);

export const deleteDocument = (docId: string) =>
  api.delete(`/documents/${docId}`);

/** Build the URL for serving the original uploaded file (inline or download). */
export const getDocumentFileUrl = (documentId: string) =>
  `/api/documents/${documentId}/file`;

// ── Chat ───────────────────────────────────────────
export const sendMessage = (data: {
  collection_id: string;
  message: string;
  conversation_id?: string;
  top_k?: number;
}) =>
  api.post<ChatResponse>('/chat', data).then(r => r.data);

export const streamMessage = (
  data: {
    collection_id?: string;
    message: string;
    conversation_id?: string;
    top_k?: number;
    mode?: 'socratic' | 'direct';
    model_config_id?: string;
    web_search?: boolean;
  },
  onChunk: (text: string) => void,
  onSources: (sources: SourceItem[]) => void,
  onDone: (convId: string) => void,
  onError: (err: Error) => void,
) => {
  const controller = new AbortController();

  fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('api_token') ? { 'Authorization': `Bearer ${localStorage.getItem('api_token')}` } : {}),
    },
    body: JSON.stringify(data),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      let detail = `HTTP ${response.status}`
      try {
        const body = await response.json()
        if (body?.detail) detail = body.detail
      } catch { /* non-JSON error body */ }
      throw new Error(detail)
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'chunk') {
              onChunk(event.content);
            } else if (event.type === 'sources') {
              onSources(event.sources);
            } else if (event.type === 'error') {
              onError(new Error(event.message || '生成回复时发生错误'));
            } else if (event.type === 'done') {
              onDone(event.conversation_id);
            }
          } catch { /* skip malformed */ }
        }
      }
    }
  }).catch((err) => {
    // Ignore user-initiated aborts; surface everything else.
    if (err?.name === 'AbortError') return;
    onError(err instanceof Error ? err : new Error(String(err)));
  });

  return controller;
};

// ── Conversations ──────────────────────────────────
export const listConversations = (collectionId: string) =>
  api.get<Conversation[]>(`/conversations/${collectionId}`).then(r => r.data);

export const listFreeConversations = () =>
  api.get<Conversation[]>('/conversations/free').then(r => r.data);

export const listOrphanedConversations = () =>
  api.get<Conversation[]>('/conversations/orphaned').then(r => r.data);

export const getMessages = (collectionId: string, conversationId: string) =>
  api.get<Message[]>(`/conversations/${collectionId}/${conversationId}`).then(r => r.data);

export const archiveConversation = (collectionId: string, conversationId: string) =>
  api.post(`/conversations/${collectionId}/${conversationId}/archive`);

export const deleteConversation = (collectionId: string, conversationId: string) =>
  api.delete(`/conversations/${collectionId}/${conversationId}`);

// ── Feature 1: Rename Conversation ─────────────────
export const renameConversation = (collectionId: string, conversationId: string, title: string) =>
  api.patch<Conversation>(`/conversations/${collectionId}/${conversationId}`, { title }).then(r => r.data);

// ── Feature 2: Edit / Delete Message ───────────────
export const editMessage = (collectionId: string, conversationId: string, messageId: string, content: string) =>
  api.put<Message>(`/conversations/${collectionId}/${conversationId}/messages/${messageId}`, { content }).then(r => r.data);

export const deleteMessage = (collectionId: string, conversationId: string, messageId: string) =>
  api.delete(`/conversations/${collectionId}/${conversationId}/messages/${messageId}`);

// ── Feature 3: Regenerate Response (streaming) ─────
export const regenerateResponse = (
  collectionId: string,
  conversationId: string,
  messageId: string,
  mode: 'socratic' | 'direct',
  topK: number,
  onChunk: (text: string) => void,
  onSources: (sources: SourceItem[]) => void,
  onDone: (convId: string) => void,
  onError: (err: Error) => void,
  modelConfigId?: string,
  webSearch?: boolean,
) => {
  const controller = new AbortController();

  fetch(`/api/conversations/${collectionId}/${conversationId}/messages/${messageId}/regenerate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('api_token') ? { 'Authorization': `Bearer ${localStorage.getItem('api_token')}` } : {}),
    },
    body: JSON.stringify({ mode, top_k: topK, model_config_id: modelConfigId, web_search: webSearch }),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (body?.detail) detail = body.detail;
      } catch { /* non-JSON error body */ }
      throw new Error(detail);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'chunk') {
              onChunk(event.content);
            } else if (event.type === 'sources') {
              onSources(event.sources);
            } else if (event.type === 'error') {
              onError(new Error(event.message || '生成回复时发生错误'));
            } else if (event.type === 'done') {
              onDone(event.conversation_id);
            }
          } catch { /* skip malformed */ }
        }
      }
    }
  }).catch((err) => {
    if (err?.name === 'AbortError') return;
    onError(err instanceof Error ? err : new Error(String(err)));
  });

  return controller;
};

// ── Feature 5: Branch Conversation ─────────────────
export const branchConversation = (collectionId: string, conversationId: string, messageId: string) =>
  api.post<Conversation>(`/conversations/${collectionId}/${conversationId}/branch`, {
    message_id: messageId,
    title: '分支对话',
  }).then(r => r.data);

// ── Search ─────────────────────────────────────────
export const search = (data: { query: string; collection_id?: string; top_k?: number }) =>
  api.post<SearchResponse>('/search', data).then(r => r.data);

// ── System ─────────────────────────────────────────
export const getStats = () =>
  api.get<Stats>('/system/stats').then(r => r.data);

export const getConfig = () =>
  api.get<SystemConfig>('/system/config').then(r => r.data);

// ── User Model Configs ─────────────────────────────
type ConfigType = 'llm' | 'embedding' | 'web_search';

export const getModelConfigs = (type?: ConfigType) =>
  api.get<UserModelConfig[]>('/user/model-configs', { params: type ? { type } : {} }).then(r => r.data);

export const createModelConfig = (data: {
  config_type: ConfigType;
  provider?: string;
  base_url: string;
  api_key?: string;
  model_name: string;
  is_active?: boolean;
  extra_params?: Record<string, unknown>;
}) =>
  api.post<UserModelConfig>('/user/model-configs', data).then(r => r.data);

export const updateModelConfig = (id: string, data: {
  provider?: string;
  base_url?: string;
  api_key?: string;
  model_name?: string;
  is_active?: boolean;
  extra_params?: Record<string, unknown>;
}) =>
  api.put<UserModelConfig>(`/user/model-configs/${id}`, data).then(r => r.data);

export const deleteModelConfig = (id: string) =>
  api.delete(`/user/model-configs/${id}`);

export const testModelConfig = (data: {
  config_id?: string;
  config_type?: 'llm' | 'embedding';
  provider?: string;
  base_url?: string;
  api_key?: string;
  model_name?: string;
}) =>
  api.post<ModelTestResult>('/user/model-configs/test', data).then(r => r.data);

export const getActiveConfigs = () =>
  api.get<ActiveConfigs>('/user/model-configs/active').then(r => r.data);

export const fetchModels = (data: {
  config_type: 'llm' | 'embedding';
  base_url: string;
  api_key?: string;
  config_id?: string;
}) =>
  api.post<FetchModelsResult>('/user/model-configs/fetch-models', data).then(r => r.data);

export const batchAddModels = (data: {
  config_type: ConfigType;
  provider?: string;
  base_url: string;
  api_key?: string;
  models: string[];
  extra_params?: Record<string, unknown>;
}) =>
  api.post<BatchAddResult>('/user/model-configs/batch', data).then(r => r.data);

export const testWebSearchConfig = (data: {
  config_id?: string;
  provider?: string;
  base_url?: string;
  api_key?: string;
  protocol?: string;
}) =>
  api.post<WebSearchTestResult>('/user/model-configs/test-web-search', data).then(r => r.data);

// ── Archive ────────────────────────────────────────
export const archiveCollection = (id: string, keepConversations: boolean = true) =>
  api.post(`/collections/${id}/archive`, null, { params: { keep_conversations: keepConversations } });

export const archiveDocument = (id: string) =>
  api.post(`/documents/${id}/archive`);

// ── Trash ──────────────────────────────────────────
export const getTrash = () =>
  api.get<TrashData>('/trash').then(r => r.data);

export const permanentDeleteCollection = (id: string) =>
  api.delete(`/trash/collections/${id}`);

export const permanentDeleteDocument = (id: string) =>
  api.delete(`/trash/documents/${id}`);

export const permanentDeleteConversation = (id: string) =>
  api.delete(`/trash/conversations/${id}`);

export const restoreCollection = (id: string) =>
  api.post(`/trash/collections/${id}/restore`);

export const restoreDocument = (id: string) =>
  api.post(`/trash/documents/${id}/restore`);

export const restoreConversation = (id: string) =>
  api.post(`/trash/conversations/${id}/restore`);
