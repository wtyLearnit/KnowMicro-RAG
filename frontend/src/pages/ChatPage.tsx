/* 柏拉图之窗 - Chat Page */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, BookOpen, ChevronDown, Plus, Trash2, Loader2, X,
  FileText, GripVertical, Sparkles, RotateCcw, Database, Check,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  listCollections, getCollection,
  listConversations, getMessages, deleteConversation,
  streamMessage,
} from '../services/api'
import type { Collection, Conversation, Message, SourceItem } from '../types'

/* ── Collection Select Dropdown ─────────────────── */
function CollectionSelect({
  collections,
  value,
  onChange,
}: {
  collections: Collection[]
  value: string | null
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = collections.find(c => c.id === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                 bg-cosmos-900/70 border border-glass-border
                 hover:border-nebula-blue/30 hover:bg-cosmos-800/70
                 focus:outline-none focus:ring-1 focus:ring-nebula-blue/40 focus:border-nebula-blue/40
                 transition-all duration-200 group"
        style={open ? { boxShadow: '0 0 20px rgba(59,130,246,0.12)' } : undefined}
      >
        {selected ? (
          <>
            <span className="text-lg flex-shrink-0">{selected.icon}</span>
            <span className="flex-1 text-left text-sm text-cosmos-100 truncate font-medium">
              {selected.name}
            </span>
          </>
        ) : (
          <>
            <Database size={16} className="text-cosmos-500 flex-shrink-0" />
            <span className="flex-1 text-left text-sm text-cosmos-500">
              选择知识库...
            </span>
          </>
        )}
        <ChevronDown
          size={16}
          className={`text-cosmos-500 group-hover:text-nebula-blue transition-all duration-200
                   ${open ? 'rotate-180 text-nebula-blue' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 mt-1.5 z-50 glass-panel overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,17,40,0.98) 100%)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 20px rgba(59,130,246,0.08)',
            }}
          >
            <div className="py-1.5 max-h-60 overflow-y-auto">
              {!value && (
                <div className="px-3 py-2 text-xs text-cosmos-500">
                  选择知识库
                </div>
              )}
              {collections.map(col => {
                const isActive = col.id === value
                return (
                  <button
                    key={col.id}
                    onClick={() => {
                      onChange(col.id)
                      setOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-150
                      ${isActive
                        ? 'bg-nebula-blue/12 text-nebula-blue'
                        : 'text-cosmos-300 hover:bg-cosmos-800/60 hover:text-white'
                      }`}
                  >
                    <span className="text-lg flex-shrink-0">{col.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{col.name}</div>
                      {col.description && (
                        <div className="text-xs text-cosmos-500 truncate mt-0.5">
                          {col.description}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-cosmos-600 flex-shrink-0">
                      {col.document_count} 份
                    </span>
                    {isActive && (
                      <Check size={14} className="text-nebula-blue flex-shrink-0" />
                    )}
                  </button>
                )
              })}
              {collections.length === 0 && (
                <div className="px-3 py-4 text-center">
                  <Database size={20} className="mx-auto mb-2 text-cosmos-700" />
                  <p className="text-xs text-cosmos-500">暂无知识库</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ChatPage() {
  const { collectionId: urlCollectionId } = useParams()
  const navigate = useNavigate()

  const [collections, setCollections] = useState<Collection[]>([])
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    urlCollectionId || localStorage.getItem('lastCollectionId') || null
  )
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingSources, setStreamingSources] = useState<SourceItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showSources, setShowSources] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    listCollections().then(setCollections).catch(() => {})
  }, [])

  // Sync URL with activeCollectionId
  useEffect(() => {
    if (activeCollectionId && !urlCollectionId) {
      navigate(`/chat/${activeCollectionId}`, { replace: true })
    }
  }, [])

  useEffect(() => {
    if (activeCollectionId) {
      localStorage.setItem('lastCollectionId', activeCollectionId)
      getCollection(activeCollectionId).then(setActiveCollection).catch(() => {})
      listConversations(activeCollectionId).then(setConversations).catch(() => {})
    }
  }, [activeCollectionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

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

  const handleSend = async () => {
    if (!input.trim() || !activeCollectionId || streaming) return
    const userMessage = input.trim()
    setInput('')
    setStreaming(true)
    setStreamingContent('')
    setStreamingSources([])
    setError(null)
    setShowSources(false)

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
        if (sources.length > 0) setShowSources(true)
      },
      (convId) => {
        setStreaming(false)
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
    setShowSources(false)
  }

  const latestSources = streamingSources.length > 0
    ? streamingSources
    : messages.filter(m => m.sources?.length).pop()?.sources ?? []

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      {!activeCollectionId ? (
        /* No collection selected */
        <div className="flex-1 flex items-center justify-center h-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-nebula-blue/20 to-nebula-purple/20
                          flex items-center justify-center border border-nebula-blue/20">
              <BookOpen size={36} className="text-nebula-blue" />
            </div>
            <div>
              <p className="text-cosmos-200 text-xl font-serif">请先选择一个知识库</p>
              <p className="text-cosmos-500 text-sm mt-2">
                选择知识库后即可与苏格拉底展开对话
              </p>
            </div>
            <div className="max-w-xs mx-auto">
              <CollectionSelect
                collections={collections}
                value={activeCollectionId}
                onChange={(id) => {
                  setActiveCollectionId(id || null)
                  navigate(id ? `/chat/${id}` : '/chat')
                }}
              />
            </div>
          </motion.div>
        </div>
      ) : (
        <PanelGroup orientation="horizontal" className="h-full">
          {/* Left sidebar - Conversations */}
          <Panel defaultSize="28%" minSize="20%" maxSize="45%">
            <div className="h-full flex flex-col border-r border-glass-border bg-cosmos-950/50 overflow-hidden min-w-0">
              {/* Collection selector */}
              <div className="p-3 border-b border-glass-border">
                <CollectionSelect
                  collections={collections}
                  value={activeCollectionId}
                  onChange={(id) => {
                    setActiveCollectionId(id || null)
                    setActiveConvId(null)
                    setMessages([])
                    navigate(id ? `/chat/${id}` : '/chat')
                  }}
                />
              </div>

              {/* New conversation */}
              <div className="p-3">
                <button
                  onClick={handleNewConv}
                  className="w-full btn-secondary text-sm flex items-center gap-2 justify-center"
                >
                  <Plus size={16} />
                  新对话
                </button>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-3">
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`
                      group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm
                      transition-all duration-200
                      ${activeConvId === conv.id
                        ? 'bg-nebula-blue/15 text-nebula-blue border border-nebula-blue/25'
                        : 'text-cosmos-400 hover:text-cosmos-200 hover:bg-cosmos-800/50'
                      }
                    `}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <span className="truncate flex-1">{conv.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.id) }}
                      className="opacity-0 group-hover:opacity-100 text-cosmos-600 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <p className="text-xs text-cosmos-600 text-center py-6">
                    暂无对话
                  </p>
                )}
              </div>
            </div>
          </Panel>

          {/* Resize handle */}
          <PanelResizeHandle />

          {/* Center - Chat */}
          <Panel defaultSize={showSources ? "47%" : "72%"} minSize="30%">
            <div className="h-full flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {messages.length === 0 && !streaming && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center h-full"
                  >
                    <div className="text-center space-y-3">
                      <Sparkles size={32} className="mx-auto text-nebula-blue/40" />
                      <p className="text-cosmos-500 text-sm">
                        向苏格拉底提问，开始你的探索之旅
                      </p>
                    </div>
                  </motion.div>
                )}

                <AnimatePresence>
                  {messages.map(msg => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                        <div
                          className={`
                            rounded-2xl px-5 py-3.5
                            ${msg.role === 'user'
                              ? 'bg-nebula-blue/20 text-cosmos-100 rounded-br-md border border-nebula-blue/15'
                              : 'glass-panel rounded-bl-md'
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

                        {/* Sources button */}
                        {msg.sources && msg.sources.length > 0 && (
                          <button
                            onClick={() => setShowSources(!showSources)}
                            className="mt-2 text-xs text-cosmos-500 hover:text-nebula-blue
                                     flex items-center gap-1 transition-colors"
                          >
                            <FileText size={12} />
                            参考来源 ({msg.sources.length})
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Streaming message */}
                {streaming && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="max-w-[80%] glass-panel rounded-2xl rounded-bl-md px-5 py-3.5">
                      {streamingContent ? (
                        <div className="prose-content text-sm">
                          <ReactMarkdown>{streamingContent}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-cosmos-500">
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-sm">思考中...</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Error banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mx-6 mb-2 flex items-start justify-between gap-3
                             bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3"
                  >
                    <p className="text-red-300 text-sm">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="text-red-400/70 hover:text-red-300 flex-shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input */}
              <div className="border-t border-glass-border p-4 bg-cosmos-950/50">
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
                <p className="text-xs text-cosmos-600 mt-2">
                  Enter 发送 · Shift+Enter 换行
                  {activeCollection && (
                    <span className="ml-2">
                      · 当前: <span className="text-nebula-blue">{activeCollection.name}</span>
                    </span>
                  )}
                </p>
              </div>
            </div>
          </Panel>

          {/* Right panel - Sources */}
          {showSources && (
            <>
              <PanelResizeHandle />

              <Panel defaultSize="25%" minSize="15%" maxSize="40%">
                <div className="h-full flex flex-col border-l border-glass-border bg-cosmos-950/50">
                  <div className="p-4 border-b border-glass-border flex items-center justify-between">
                    <h3 className="text-sm font-medium text-cosmos-300 flex items-center gap-2">
                      <FileText size={16} className="text-nebula-blue" />
                      引用来源
                    </h3>
                    <button
                      onClick={() => setShowSources(false)}
                      className="btn-ghost p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {latestSources.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText size={32} className="mx-auto mb-3 text-cosmos-700" />
                        <p className="text-cosmos-500 text-sm">暂无引用来源</p>
                      </div>
                    ) : (
                      latestSources.map((src, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="glass-card p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-nebula-blue truncate max-w-[70%]">
                              {src.doc_name}
                            </span>
                            <span className="text-xs text-cosmos-500">
                              {(src.score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-1 rounded-full bg-cosmos-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-nebula-blue to-nebula-cyan"
                              style={{ width: `${src.score * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-cosmos-400 leading-relaxed line-clamp-4">
                            {src.chunk_text}
                          </p>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      )}
    </div>
  )
}
