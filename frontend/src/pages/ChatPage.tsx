/* 苏格拉底之窗 - Chat Page */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, BookOpen, ChevronDown, Plus, Trash2, Loader2, X,
  FileText, Sparkles, RotateCcw, Database, Check,
  Pencil, Copy, GitBranch, CheckCheck,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  listCollections, getCollection,
  listConversations, getMessages, deleteConversation,
  streamMessage, renameConversation, editMessage, deleteMessage,
  regenerateResponse, branchConversation,
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
  useTheme()

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

  // ── Feature 1: Rename ──
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')

  // ── Feature 2: Edit Message ──
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // ── Feature 3: Regenerate ──
  const [regeneratingMsgId, setRegeneratingMsgId] = useState<string | null>(null)
  const [regenContent, setRegenContent] = useState('')
  const [regenSources, setRegenSources] = useState<SourceItem[]>([])

  // ── Feature 4: Export ──
  const [copied, setCopied] = useState(false)
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

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
  }, [messages, streamingContent, regenContent])

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renamingConvId) {
      setTimeout(() => renameInputRef.current?.focus(), 50)
    }
  }, [renamingConvId])

  const loadConversation = useCallback(async (convId: string) => {
    if (!activeCollectionId) return
    setActiveConvId(convId)
    setEditingMsgId(null)
    setRegeneratingMsgId(null)
    try {
      const msgs = await getMessages(activeCollectionId, convId)
      setMessages(msgs)
    } catch {
      setMessages([])
    }
  }, [activeCollectionId])

  const refreshConversationList = useCallback(() => {
    if (activeCollectionId) {
      listConversations(activeCollectionId).then(setConversations).catch(() => {})
    }
  }, [activeCollectionId])

  const handleSend = async () => {
    if (!input.trim() || !activeCollectionId || streaming || regeneratingMsgId) return
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
        // Refresh messages from server to get real IDs
        getMessages(activeCollectionId, convId).then(setMessages).catch(() => {})
        refreshConversationList()
      },
      (err) => {
        console.error('Stream error:', err)
        setError(err?.message || '生成回复时发生错误，请稍后重试')
        setStreaming(false)
      },
    )
    abortRef.current = { abort: () => abort.abort() } as AbortController
  }

  // ── Feature 1: Rename handlers ──
  const handleStartRename = (conv: Conversation) => {
    setRenamingConvId(conv.id)
    setRenameTitle(conv.title)
  }

  const handleConfirmRename = async () => {
    if (!renamingConvId || !activeCollectionId || !renameTitle.trim()) {
      setRenamingConvId(null)
      return
    }
    try {
      await renameConversation(activeCollectionId, renamingConvId, renameTitle.trim())
      setConversations(prev => prev.map(c =>
        c.id === renamingConvId ? { ...c, title: renameTitle.trim() } : c
      ))
    } catch {
      setError('重命名失败')
    }
    setRenamingConvId(null)
  }

  // ── Feature 2: Edit/Delete handlers ──
  const handleStartEdit = (msg: Message) => {
    setEditingMsgId(msg.id)
    setEditContent(msg.content)
  }

  const handleConfirmEdit = async () => {
    if (!editingMsgId || !activeCollectionId || !activeConvId || !editContent.trim()) {
      setEditingMsgId(null)
      return
    }
    try {
      await editMessage(activeCollectionId, activeConvId, editingMsgId, editContent.trim())
      setMessages(prev => prev.map(m =>
        m.id === editingMsgId ? { ...m, content: editContent.trim() } : m
      ))
    } catch {
      setError('编辑失败')
    }
    setEditingMsgId(null)
  }

  const handleDeleteMessage = async (msgId: string) => {
    if (!activeCollectionId || !activeConvId) return
    try {
      await deleteMessage(activeCollectionId, activeConvId, msgId)
      // Remove the deleted message and all subsequent messages from local state
      const idx = messages.findIndex(m => m.id === msgId)
      if (idx !== -1) {
        setMessages(prev => prev.slice(0, idx))
      }
    } catch {
      setError('删除失败')
    }
  }

  // ── Feature 3: Regenerate handler ──
  const handleRegenerate = async (userMsg: Message, assistantMsg: Message) => {
    if (!activeCollectionId || !activeConvId || streaming || regeneratingMsgId) return

    setRegeneratingMsgId(assistantMsg.id)
    setRegenContent('')
    setRegenSources([])
    setError(null)

    // Remove the old assistant message from display
    setMessages(prev => prev.filter(m => m.id !== assistantMsg.id))

    let accumulatedContent = ''
    let accumulatedSources: SourceItem[] = []

    const abort = regenerateResponse(
      activeCollectionId,
      activeConvId,
      userMsg.id,
      mode,
      (chunk) => {
        accumulatedContent += chunk
        setRegenContent(prev => prev + chunk)
      },
      (sources) => {
        accumulatedSources = sources
        setRegenSources(sources)
        if (sources.length > 0) setShowSources(true)
      },
      (convId) => {
        if (accumulatedContent) {
          const newAssistantMsg: Message = {
            id: 'regen-' + Date.now(),
            conversation_id: convId,
            role: 'assistant',
            content: accumulatedContent,
            sources: accumulatedSources,
            created_at: new Date().toISOString(),
          }
          setMessages(prev => [...prev, newAssistantMsg])
        }
        setRegeneratingMsgId(null)
        setRegenContent('')
        setRegenSources([])
        // Refresh from server for real IDs
        getMessages(activeCollectionId, convId).then(setMessages).catch(() => {})
      },
      (err) => {
        console.error('Regenerate error:', err)
        setError(err?.message || '重新生成失败')
        setRegeneratingMsgId(null)
        // Restore old message on failure
        getMessages(activeCollectionId, activeConvId).then(setMessages).catch(() => {})
      },
    )
    abortRef.current = { abort: () => abort.abort() } as AbortController
  }

  // ── Feature 4: Export handler ──
  const handleExport = async () => {
    if (messages.length === 0) return
    const text = messages.map(m => {
      const role = m.role === 'user' ? '我' : '苏格拉底'
      return `${role}:\n${m.content}`
    }).join('\n\n---\n\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('复制失败，请手动复制')
    }
  }

  // ── Copy single message ──
  const handleCopyMessage = async (msg: Message) => {
    try {
      await navigator.clipboard.writeText(msg.content)
      setCopiedMsgId(msg.id)
      setTimeout(() => setCopiedMsgId(null), 2000)
    } catch {
      setError('复制失败')
    }
  }

  // ── Feature 5: Branch handler ──
  const handleBranch = async (msgId: string) => {
    if (!activeCollectionId || !activeConvId) return
    try {
      const newConv = await branchConversation(activeCollectionId, activeConvId, msgId)
      refreshConversationList()
      // Switch to the new branch
      setActiveConvId(newConv.id)
      const msgs = await getMessages(activeCollectionId, newConv.id)
      setMessages(msgs)
    } catch {
      setError('创建分支失败')
    }
  }

  const handleDeleteConv = async (convId: string) => {
    if (!activeCollectionId) return
    await deleteConversation(activeCollectionId, convId)
    if (activeConvId === convId) {
      setActiveConvId(null)
      setMessages([])
    }
    refreshConversationList()
  }

  const handleNewConv = () => {
    setActiveConvId(null)
    setMessages([])
    setStreamingContent('')
    setStreamingSources([])
    setShowSources(false)
    setEditingMsgId(null)
    setRegeneratingMsgId(null)
  }

  const latestSources = streamingSources.length > 0
    ? streamingSources
    : regenSources.length > 0
      ? regenSources
      : messages.filter(m => m.sources?.length).pop()?.sources ?? []

  // Get the user message that precedes a given assistant message
  const getUserMsgForAssistant = (assistantMsg: Message): Message | null => {
    const idx = messages.findIndex(m => m.id === assistantMsg.id)
    if (idx > 0 && messages[idx - 1].role === 'user') {
      return messages[idx - 1]
    }
    return null
  }

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
                  const isRenaming = renamingConvId === conv.id
                  return (
                    <div
                      key={conv.id}
                      className="group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all duration-200"
                      style={{
                        color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                        border: isActive ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                      }}
                      onClick={() => !isRenaming && loadConversation(conv.id)}
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
                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          value={renameTitle}
                          onChange={(e) => setRenameTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmRename()
                            if (e.key === 'Escape') setRenamingConvId(null)
                          }}
                          onBlur={handleConfirmRename}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-transparent border-b text-sm outline-none"
                          style={{
                            color: 'var(--text-primary)',
                            borderColor: 'var(--accent-blue)',
                          }}
                        />
                      ) : (
                        <span className="truncate flex-1">{conv.title}</span>
                      )}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartRename(conv) }}
                          className="p-0.5 transition-colors"
                          style={{ color: 'var(--text-dim)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                          title="重命名"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.id) }}
                          className="p-0.5 transition-colors"
                          style={{ color: 'var(--text-dim)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(239, 68, 68)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                          title="删除对话"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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
              {/* Header bar with export button */}
              {activeConvId && messages.length > 0 && (
                <div className="flex items-center justify-end px-4 py-2 border-b" style={{ borderColor: 'var(--border-glass)' }}>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200"
                    style={{
                      color: copied ? 'rgb(34, 197, 94)' : 'var(--text-muted)',
                      background: copied ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-input)',
                      border: '1px solid var(--border-glass)',
                    }}
                    onMouseEnter={(e) => {
                      if (!copied) {
                        e.currentTarget.style.color = 'var(--text-primary)'
                        e.currentTarget.style.background = 'var(--bg-card-hover)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!copied) {
                        e.currentTarget.style.color = 'var(--text-muted)'
                        e.currentTarget.style.background = 'var(--bg-input)'
                      }
                    }}
                    title="复制对话"
                  >
                    {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                    {copied ? '已复制' : '导出对话'}
                  </button>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {messages.length === 0 && !streaming && !regeneratingMsgId && (
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
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] group/msg ${msg.role === 'user' ? 'order-1' : ''}`}>
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
                          {/* Feature 2: Edit mode for user messages */}
                          {editingMsgId === msg.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full min-h-[80px] bg-transparent border rounded-lg px-3 py-2 text-sm outline-none resize-y"
                                style={{
                                  color: 'var(--text-primary)',
                                  borderColor: 'var(--accent-blue)',
                                }}
                                autoFocus
                              />
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => setEditingMsgId(null)}
                                  className="px-2.5 py-1 rounded-md text-xs transition-colors"
                                  style={{ color: 'var(--text-muted)', background: 'var(--bg-input)' }}
                                >
                                  取消
                                </button>
                                <button
                                  onClick={handleConfirmEdit}
                                  className="px-2.5 py-1 rounded-md text-xs transition-colors"
                                  style={{ color: '#fff', background: 'var(--accent-blue)' }}
                                >
                                  保存
                                </button>
                              </div>
                            </div>
                          ) : msg.role === 'user' ? (
                            <p className="whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{msg.content}</p>
                          ) : (
                            <div className="prose-content text-sm">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          )}
                        </div>

                        {/* Sources button — always visible, own row */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-1.5">
                            <button
                              onClick={() => setShowSources(!showSources)}
                              className="text-xs flex items-center gap-1 transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                              <FileText size={12} />
                              参考来源 ({msg.sources.length})
                            </button>
                          </div>
                        )}

                        {/* Action buttons — hover-only, zero height when hidden */}
                        {!streaming && !regeneratingMsgId && editingMsgId !== msg.id && (
                          <div className="h-0 overflow-visible opacity-0 group-hover/msg:opacity-100 group-hover/msg:mt-1.5 transition-all">
                            <div className="flex items-center gap-1">
                              {/* Copy single message */}
                              <button
                                onClick={() => handleCopyMessage(msg)}
                                className="text-xs flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded"
                                style={{ color: copiedMsgId === msg.id ? 'rgb(34, 197, 94)' : 'var(--text-dim)' }}
                                onMouseEnter={(e) => {
                                  if (copiedMsgId !== msg.id) e.currentTarget.style.color = 'var(--accent-blue)'
                                }}
                                onMouseLeave={(e) => {
                                  if (copiedMsgId !== msg.id) e.currentTarget.style.color = 'var(--text-dim)'
                                }}
                                title={copiedMsgId === msg.id ? '已复制' : '复制此消息'}
                              >
                                {copiedMsgId === msg.id
                                  ? <><CheckCheck size={11} /><span className="text-[10px]">已复制</span></>
                                  : <><Copy size={11} /><span className="text-[10px]">复制</span></>
                                }
                              </button>

                              {/* User message: Edit & Delete */}
                              {msg.role === 'user' && (
                                <>
                                  <button
                                    onClick={() => handleStartEdit(msg)}
                                    className="text-xs flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded"
                                    style={{ color: 'var(--text-dim)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                                    title="编辑消息"
                                  >
                                    <Pencil size={11} />
                                    <span className="text-[10px]">编辑</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="text-xs flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded"
                                    style={{ color: 'var(--text-dim)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(239, 68, 68)'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                                    title="删除此消息及之后所有消息"
                                  >
                                    <Trash2 size={11} />
                                    <span className="text-[10px]">删除</span>
                                  </button>
                                </>
                              )}

                              {/* Assistant message: Regenerate */}
                              {msg.role === 'assistant' && (() => {
                                const userMsg = getUserMsgForAssistant(msg)
                                return userMsg ? (
                                  <button
                                    onClick={() => handleRegenerate(userMsg, msg)}
                                    className="text-xs flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded"
                                    style={{ color: 'var(--text-dim)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                                    title="重新生成回复"
                                  >
                                    <RotateCcw size={11} />
                                    <span className="text-[10px]">重新生成</span>
                                  </button>
                                ) : null
                              })()}

                              {/* Branch */}
                              {activeConvId && (
                                <button
                                  onClick={() => handleBranch(msg.id)}
                                  className="text-xs flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded"
                                  style={{ color: 'var(--text-dim)' }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-purple, #a855f7)'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                                  title="从此处创建分支对话"
                                >
                                  <GitBranch size={11} />
                                  <span className="text-[10px]">分支</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Streaming message (normal send) */}
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

                {/* Streaming message (regenerate) */}
                {regeneratingMsgId && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="max-w-[80%] glass-panel rounded-2xl rounded-bl-md px-5 py-3.5">
                      {regenContent ? (
                        <div className="prose-content text-sm">
                          <ReactMarkdown>{regenContent}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-sm">重新生成中...</span>
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
                    disabled={streaming || !!regeneratingMsgId}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || streaming || !!regeneratingMsgId}
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
