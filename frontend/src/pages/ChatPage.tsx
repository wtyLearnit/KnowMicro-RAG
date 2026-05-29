/* 柏拉图之窗 - Chat Page */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, BookOpen, ChevronDown, Plus, Trash2, Loader2, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  listCollections, getCollection,
  listConversations, getMessages, deleteConversation,
  streamMessage,
} from '../services/api'
import type { Collection, Conversation, Message, SourceItem } from '../types'

export function ChatPage() {
  const { collectionId: urlCollectionId } = useParams()
  const navigate = useNavigate()

  const [collections, setCollections] = useState<Collection[]>([])
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(urlCollectionId ?? null)
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingSources, setStreamingSources] = useState<SourceItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load collections
  useEffect(() => {
    listCollections().then(setCollections).catch(() => {})
  }, [])

  // Load active collection
  useEffect(() => {
    if (activeCollectionId) {
      getCollection(activeCollectionId).then(setActiveCollection).catch(() => {})
      listConversations(activeCollectionId).then(setConversations).catch(() => {})
    }
  }, [activeCollectionId])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Abort any in-flight stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  // Load conversation messages
  const loadConversation = useCallback(async (convId: string) => {
    if (!activeCollectionId) return
    setActiveConvId(convId)
    try {
      const msgs = await getMessages(activeCollectionId, convId)
      setMessages(msgs)
    } catch {
      setMessages([])
    }
  }, [activeCollectionId])

  // Send message
  const handleSend = async () => {
    if (!input.trim() || !activeCollectionId || streaming) return
    const userMessage = input.trim()
    setInput('')
    setStreaming(true)
    setStreamingContent('')
    setStreamingSources([])
    setError(null)

    // Add user message optimistically
    const userMsg: Message = {
      id: 'temp-' + Date.now(),
      conversation_id: activeConvId ?? '',
      role: 'user',
      content: userMessage,
      sources: [],
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    const abort = streamMessage(
      {
        collection_id: activeCollectionId,
        message: userMessage,
        conversation_id: activeConvId ?? undefined,
      },
      (chunk) => {
        setStreamingContent(prev => prev + chunk)
      },
      (sources) => {
        setStreamingSources(sources)
      },
      (convId) => {
        setStreaming(false)
        // Add assistant message
        const assistantMsg: Message = {
          id: 'temp-assist-' + Date.now(),
          conversation_id: convId,
          role: 'assistant',
          content: '', // Will be filled from streamingContent
          sources: [],
          created_at: new Date().toISOString(),
        }
        // Refresh conversation list
        if (!activeConvId) {
          setActiveConvId(convId)
          listConversations(activeCollectionId).then(setConversations).catch(() => {})
        }
      },
      (err) => {
        console.error('Stream error:', err)
        setError(err?.message || '生成回复时发生错误，请稍后重试')
        setStreaming(false)
      },
    )
    abortRef.current = { abort: () => abort.abort() } as AbortController
  }

  // After streaming completes, update messages
  useEffect(() => {
    if (!streaming && streamingContent) {
      const assistantMsg: Message = {
        id: 'stream-' + Date.now(),
        conversation_id: activeConvId ?? '',
        role: 'assistant',
        content: streamingContent,
        sources: streamingSources,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
      setStreamingContent('')
      setStreamingSources([])
      // Refresh conversation list
      if (activeCollectionId) {
        listConversations(activeCollectionId).then(setConversations).catch(() => {})
      }
    }
  }, [streaming])

  const handleDeleteConv = async (convId: string) => {
    if (!activeCollectionId) return
    await deleteConversation(activeCollectionId, convId)
    if (activeConvId === convId) {
      setActiveConvId(null)
      setMessages([])
    }
    listConversations(activeCollectionId).then(setConversations).catch(() => {})
  }

  const handleNewConv = () => {
    setActiveConvId(null)
    setMessages([])
    setStreamingContent('')
    setStreamingSources([])
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Sidebar: Collections & Conversations */}
      <div className="hidden lg:flex lg:flex-col w-72 flex-shrink-0 border-r border-parchment-700/30 pr-4 space-y-4">
        {/* Collection selector */}
        <div>
          <label className="text-xs text-parchment-500 uppercase tracking-wider mb-2 block">
            知识库
          </label>
          <select
            value={activeCollectionId ?? ''}
            onChange={(e) => {
              const id = e.target.value
              setActiveCollectionId(id || null)
              setActiveConvId(null)
              setMessages([])
              navigate(id ? `/chat/${id}` : '/chat')
            }}
            className="input-field text-sm"
          >
            <option value="">选择知识库...</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        {activeCollectionId && (
          <>
            {/* New conversation */}
            <button onClick={handleNewConv} className="btn-secondary text-sm flex items-center gap-2 justify-center">
              <Plus size={16} />
              新对话
            </button>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto space-y-1">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`
                    group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm
                    transition-all duration-200
                    ${activeConvId === conv.id
                      ? 'bg-parchment-400/15 text-parchment-200 border border-parchment-400/30'
                      : 'text-parchment-400 hover:text-parchment-200 hover:bg-academia-700/50'
                    }
                  `}
                  onClick={() => loadConversation(conv.id)}
                >
                  <span className="truncate flex-1">{conv.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.id) }}
                    className="opacity-0 group-hover:opacity-100 text-parchment-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-xs text-parchment-600 text-center py-4">
                  暂无对话
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeCollectionId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <BookOpen size={48} className="mx-auto text-parchment-600" />
              <div>
                <p className="text-parchment-400 text-lg">请先选择一个知识库</p>
                <p className="text-parchment-600 text-sm mt-1">
                  选择知识库后即可与苏格拉底展开对话
                </p>
              </div>
              {/* Mobile collection selector */}
              <select
                value={activeCollectionId ?? ''}
                onChange={(e) => {
                  const id = e.target.value
                  setActiveCollectionId(id || null)
                  navigate(id ? `/chat/${id}` : '/chat')
                }}
                className="input-field text-sm lg:hidden"
              >
                <option value="">选择知识库...</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-6 pb-4">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                    <div
                      className={`
                        rounded-2xl px-5 py-3
                        ${msg.role === 'user'
                          ? 'bg-parchment-400/20 text-parchment-100 rounded-br-md'
                          : 'bg-academia-700/60 text-parchment-100 rounded-bl-md'
                        }
                      `}
                    >
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="prose-content text-sm">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <details className="mt-2 group">
                        <summary className="text-xs text-parchment-500 cursor-pointer hover:text-parchment-300 flex items-center gap-1">
                          <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                          参考来源 ({msg.sources.length})
                        </summary>
                        <div className="mt-2 space-y-2">
                          {msg.sources.map((src, i) => (
                            <div key={i} className="bg-academia-800 rounded-lg p-3 text-xs">
                              <div className="text-parchment-300 font-medium mb-1">
                                {src.doc_name} · 相关度 {(src.score * 100).toFixed(0)}%
                              </div>
                              <p className="text-parchment-500 line-clamp-3">{src.chunk_text}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming message */}
              {streaming && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] bg-academia-700/60 text-parchment-100 rounded-2xl rounded-bl-md px-5 py-3">
                    {streamingContent ? (
                      <div className="prose-content text-sm">
                        <ReactMarkdown>{streamingContent}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-parchment-500">
                        <Loader2 size={16} className="animate-spin" />
                        思考中...
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-2 flex items-start justify-between gap-3 bg-red-900/20 border border-red-400/30 rounded-xl px-4 py-3">
                <p className="text-red-300 text-sm">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400/70 hover:text-red-300 flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-parchment-700/30 pt-4">
              <div className="flex gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="向苏格拉底提问..."
                  rows={2}
                  className="input-field flex-1 resize-none"
                  disabled={streaming}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  className="btn-primary self-end flex items-center gap-2"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-xs text-parchment-600 mt-2">
                Enter 发送 · Shift+Enter 换行
                {activeCollection && ` · 当前知识库: ${activeCollection.name}`}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
