/* 苏格拉底之窗 - Chat Page */
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
import { useTheme } from '../components/ThemeContext'
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
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group"
        style={{
          background: 'var(--bg-input)',
          border: `1px solid ${open ? 'var(--accent-blue)' : 'var(--border-glass)'}`,
          boxShadow: open ? '0 0 20px rgba(59,130,246,0.12)' : 'none',
        }}
      >
        {selected ? (
          <>
            <span className="text-lg flex-shrink-0">{selected.icon}</span>
            <span className="flex-1 text-left text-sm truncate font-medium" style={{ color: 'var(--text-primary)' }}>
              {selected.name}
            </span>
          </>
        ) : (
          <>
            <Database size={16} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <span className="flex-1 text-left text-sm" style={{ color: 'var(--text-muted)' }}>
              选择知识库...
            </span>
          </>
        )}
        <ChevronDown
          size={16}
          className="transition-all duration-200"
          style={{ color: open ? 'var(--accent-blue)' : 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none' }}
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
              boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 0 20px rgba(59,130,246,0.08)',
            }}
          >
            <div className="py-1.5 max-h-60 overflow-y-auto">
              {!value && (
                <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
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
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-150"
                    style={{
                      background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                      color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--bg-card-hover)'
                        e.currentTarget.style.color = 'var(--text-primary)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--text-secondary)'
                      }
                    }}
                  >
                    <span className="text-lg flex-shrink-0">{col.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{col.name}</div>
                      {col.description && (
                        <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {col.description}
                        </div>
                      )}
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
                      {col.document_count} 份
                    </span>
                    {isActive && (
                      <Check size={14} className="flex-shrink-0 text-[var(--accent-blue)]" />
                    )}
                  </button>
                )
              })}
              {collections.length === 0 && (
                <div className="px-3 py-4 text-center">
                  <Database size={20} className="mx-auto mb-2" style={{ color: 'var(--text-dim)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>暂无知识库</p>
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
  const { theme } = useTheme()

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
  const [mode, setMode] = useState<'socratic' | 'direct'>(() => {
    return (localStorage.getItem('chatMode') as 'socratic' | 'direct') || 'socratic'
  })

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

    // Local accumulators for this stream
    let accumulatedContent = ''
    let accumulatedSources: SourceItem[] = []

    const abort = streamMessage(
      {
        collection_id: activeCollectionId,
        message: userMessage,
        conversation_id: activeConvId ?? undefined,
        mode: mode,
      },
      (chunk) => {
        accumulatedContent += chunk
        setStreamingContent(prev => prev + chunk)
      },
      (sources) => {
        accumulatedSources = sources
        setStreamingSources(sources)
        if (sources.length > 0) setShowSources(true)
      },
      (convId) => {
        // Create message directly here with captured sources
        if (accumulatedContent) {
          const assistantMsg: Message = {
            id: 'stream-' + Date.now(),
            conversation_id: convId,
            role: 'assistant',
            content: accumulatedContent,
            sources: accumulatedSources,
            created_at: new Date().toISOString(),
          }
          setMessages(prev => [...prev, assistantMsg])
        }
        setStreaming(false)
        setStreamingContent('')
        setStreamingSources([])
        if (!activeConvId) {
          setActiveConvId(convId)
        }
        if (activeCollectionId) {
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
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[var(--accent-blue)]/20 to-[var(--accent-purple)]/20
                          flex items-center justify-center"
                 style={{ border: '1px solid var(--border-hover)' }}>
              <BookOpen size={36} className="text-[var(--accent-blue)]" />
            </div>
            <div>
              <p className="text-xl font-serif" style={{ color: 'var(--text-primary)' }}>请先选择一个知识库</p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
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
            <div className="h-full flex flex-col border-r overflow-hidden min-w-0"
                 style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-sidebar)' }}>
              {/* Collection selector */}
              <div className="p-3 border-b" style={{ borderColor: 'var(--border-glass)' }}>
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
                {conversations.map(conv => {
                  const isActive = activeConvId === conv.id
                  return (
                    <div
                      key={conv.id}
                      className="group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all duration-200"
                      style={{
                        color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                        border: isActive ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                      }}
                      onClick={() => loadConversation(conv.id)}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.color = 'var(--text-primary)'
                          e.currentTarget.style.background = 'var(--bg-card)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.color = 'var(--text-secondary)'
                          e.currentTarget.style.background = 'transparent'
                        }
                      }}
                    >
                      <span className="truncate flex-1">{conv.title}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.id) }}
                        className="opacity-0 group-hover:opacity-100 transition-all"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
                {conversations.length === 0 && (
                  <p className="text-xs text-center py-6" style={{ color: 'var(--text-dim)' }}>
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
                      <Sparkles size={32} className="mx-auto" style={{ color: 'var(--text-dim)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
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
                          className="rounded-2xl px-5 py-3.5"
                          style={{
                            background: msg.role === 'user' ? 'rgba(59,130,246,0.15)' : 'var(--bg-card)',
                            border: msg.role === 'user' ? '1px solid rgba(59,130,246,0.2)' : '1px solid var(--border-glass)',
                            borderBottomRightRadius: msg.role === 'user' ? '6px' : undefined,
                            borderBottomLeftRadius: msg.role === 'assistant' ? '6px' : undefined,
                            boxShadow: msg.role === 'user' ? 'none' : 'var(--shadow-inset), var(--shadow-card)',
                            backdropFilter: msg.role === 'assistant' ? 'blur(20px)' : undefined,
                          }}
                        >
                          {msg.role === 'user' ? (
                            <p className="whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{msg.content}</p>
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
                            className="mt-2 text-xs flex items-center gap-1 transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
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
                        <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
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
                    className="mx-6 mb-2 flex items-start justify-between gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
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
              <div className="border-t p-4" style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-sidebar)' }}>
                {/* Mode toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex rounded-lg p-0.5" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
                    <button
                      onClick={() => {
                        setMode('socratic')
                        localStorage.setItem('chatMode', 'socratic')
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
                      style={{
                        background: mode === 'socratic' ? 'var(--accent-blue)' : 'transparent',
                        color: mode === 'socratic' ? '#fff' : 'var(--text-secondary)',
                        boxShadow: mode === 'socratic' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
                      }}
                    >
                      苏格拉底式
                    </button>
                    <button
                      onClick={() => {
                        setMode('direct')
                        localStorage.setItem('chatMode', 'direct')
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
                      style={{
                        background: mode === 'direct' ? 'var(--accent-blue)' : 'transparent',
                        color: mode === 'direct' ? '#fff' : 'var(--text-secondary)',
                        boxShadow: mode === 'direct' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
                      }}
                    >
                      直接问答
                    </button>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {mode === 'socratic' ? '引导式提问，启发思考' : '直接给出答案'}
                  </span>
                </div>

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
                    placeholder={mode === 'socratic' ? '向苏格拉底提问...' : '输入你的问题...'}
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
                <p className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
                  Enter 发送 · Shift+Enter 换行
                  {activeCollection && (
                    <span className="ml-2">
                      · 当前: <span className="text-[var(--accent-blue)]">{activeCollection.name}</span>
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
                <div className="h-full flex flex-col border-l overflow-hidden"
                     style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-sidebar)' }}>
                  <div className="p-4 border-b flex items-center justify-between"
                       style={{ borderColor: 'var(--border-glass)' }}>
                    <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                      <FileText size={16} className="text-[var(--accent-blue)]" />
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
                        <FileText size={32} className="mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无引用来源</p>
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
                            <span className="text-xs font-medium truncate max-w-[70%]" style={{ color: 'var(--accent-blue)' }}>
                              {src.doc_name}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {(src.score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-cyan)]"
                              style={{ width: `${src.score * 100}%` }}
                            />
                          </div>
                          <p className="text-xs leading-relaxed line-clamp-4" style={{ color: 'var(--text-muted)' }}>
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
