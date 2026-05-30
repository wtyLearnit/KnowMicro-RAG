/* 苏格拉底之窗 - API Service */
import axios from 'axios';
import type {
  Collection, Document, Conversation, Message,
  ChatResponse, SearchResponse, Stats, SystemConfig, UploadResponse,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
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

export const listDocuments = (collectionId: string) =>
  api.get<Document[]>(`/documents/collection/${collectionId}`).then(r => r.data);

export const deleteDocument = (docId: string) =>
  api.delete(`/documents/${docId}`);

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
    collection_id: string;
    message: string;
    conversation_id?: string;
    top_k?: number;
    mode?: 'socratic' | 'direct';
  },
  onChunk: (text: string) => void,
  onSources: (sources: any[]) => void,
  onDone: (convId: string) => void,
  onError: (err: Error) => void,
) => {
  const controller = new AbortController();

  fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

export const getMessages = (collectionId: string, conversationId: string) =>
  api.get<Message[]>(`/conversations/${collectionId}/${conversationId}`).then(r => r.data);

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
  onChunk: (text: string) => void,
  onSources: (sources: any[]) => void,
  onDone: (convId: string) => void,
  onError: (err: Error) => void,
) => {
  const controller = new AbortController();

  fetch(`/api/conversations/${collectionId}/${conversationId}/messages/${messageId}/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, top_k: 5 }),
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
