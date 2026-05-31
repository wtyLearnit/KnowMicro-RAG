/* 苏格拉底之窗 - Chat Page */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, BookOpen, ChevronDown, Plus, Trash2, Loader2, X,
  FileText, Sparkles, RotateCcw, Database, Check,
  Pencil, Copy, GitBranch, CheckCheck, SlidersHorizontal,
  MessageCircle, MessageSquare, AlertTriangle,
  History,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  listCollections, getCollection,
  listConversations, listFreeConversations, listOrphanedConversations,
  getMessages, archiveConversation, getDocumentPreview,
  streamMessage, renameConversation, editMessage, deleteMessage,
  regenerateResponse, branchConversation,
} from '../services/api'
import { useTheme } from '../components/ThemeContext'
import type { Collection, Conversation, Message, SourceItem, DocumentPreview, DocumentChunk } from '../types'

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
  const [isFreeChat, setIsFreeChat] = useState(urlCollectionId === 'free')
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    urlCollectionId && urlCollectionId !== 'free'
      ? urlCollectionId
      : localStorage.getItem('lastCollectionId') || null
  )
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [orphanedConversations, setOrphanedConversations] = useState<Conversation[]>([])
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
  const [topK, setTopK] = useState<number>(() => {
    const saved = localStorage.getItem('chatTopK')
    return saved ? parseInt(saved, 10) : 5
  })
  const [showTopKPanel, setShowTopKPanel] = useState(false)
  const [isOrphanedConv, setIsOrphanedConv] = useState(false)

  // ── History panel ──
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

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

  // ── Citation Navigation ──
  const [previewDoc, setPreviewDoc] = useState<DocumentPreview | null>(null)
  const [highlightChunkIndex, setHighlightChunkIndex] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const topKRef = useRef<HTMLDivElement>(null)

  // Close Top-K panel on outside click
  useEffect(() => {
    if (!showTopKPanel) return
    const handler = (e: MouseEvent) => {
      if (topKRef.current && !topKRef.current.contains(e.target as Node)) {
        setShowTopKPanel(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTopKPanel])

  // scopeId: the ID used in API paths ("free" for free chat, actual collection_id otherwise)
  const scopeId = isFreeChat ? 'free' : activeCollectionId

  useEffect(() => {
    listCollections().then(setCollections).catch(() => {})
    listOrphanedConversations().then(setOrphanedConversations).catch(() => {})
  }, [])

  // Sync URL with activeCollectionId / isFreeChat
  useEffect(() => {
    if (isFreeChat && urlCollectionId !== 'free') {
      navigate('/chat/free', { replace: true })
    } else if (activeCollectionId && !urlCollectionId) {
      navigate(`/chat/${activeCollectionId}`, { replace: true })
    }
  }, [])

  // Load conversations and collection details based on mode
  useEffect(() => {
    if (isFreeChat) {
      setActiveCollection(null)
      listFreeConversations().then(setConversations).catch(() => {})
      listOrphanedConversations().then(setOrphanedConversations).catch(() => {})
    } else if (activeCollectionId) {
      localStorage.setItem('lastCollectionId', activeCollectionId)
      getCollection(activeCollectionId).then(setActiveCollection).catch(() => {})
      listConversations(activeCollectionId).then(setConversations).catch(() => {})
    }
  }, [activeCollectionId, isFreeChat])

  // Track whether the user is near the bottom of the message list.
  // Only auto-scroll during streaming if the user hasn't scrolled up to read.
  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const threshold = 80 // px from bottom to consider "following"
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }, [])

  // Auto-scroll to bottom only if the user is already following (near bottom).
  // If they've scrolled up to read earlier content, don't yank them away.
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
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
    if (!scopeId) return
    setActiveConvId(convId)
    setEditingMsgId(null)
    setRegeneratingMsgId(null)
    isNearBottomRef.current = true
    // Check if this conversation is orphaned
    const conv = conversations.find(c => c.id === convId)
      ?? orphanedConversations.find(c => c.id === convId)
    setIsOrphanedConv(conv?.is_orphaned ?? false)
    try {
      const msgs = await getMessages(scopeId, convId)
      setMessages(msgs)
    } catch {
      setMessages([])
    }
  }, [scopeId, conversations])

  const refreshConversationList = useCallback(() => {
    if (isFreeChat) {
      listFreeConversations().then(setConversations).catch(() => {})
      listOrphanedConversations().then(setOrphanedConversations).catch(() => {})
    } else if (activeCollectionId) {
      listConversations(activeCollectionId).then(setConversations).catch(() => {})
    }
  }, [activeCollectionId, isFreeChat])

  const handleSend = async () => {
    if (!input.trim() || (!activeCollectionId && !isFreeChat) || streaming || regeneratingMsgId || isOrphanedConv) return
    const userMessage = input.trim()
    setInput('')
    setStreaming(true)
    setStreamingContent('')
    setStreamingSources([])
    setError(null)
    setShowSources(false)

    // User just sent a message — follow the response
    isNearBottomRef.current = true

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
    const currentScopeId = scopeId!

    const abort = streamMessage(
      {
        collection_id: isFreeChat ? undefined : activeCollectionId!,
        message: userMessage,
        conversation_id: activeConvId ?? undefined,
        mode: mode,
        top_k: topK,
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
        getMessages(currentScopeId, convId).then(setMessages).catch(() => {})
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
    if (!renamingConvId || !scopeId || !renameTitle.trim()) {
      setRenamingConvId(null)
      return
    }
    try {
      await renameConversation(scopeId, renamingConvId, renameTitle.trim())
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
    if (!editingMsgId || !scopeId || !activeConvId || !editContent.trim()) {
      setEditingMsgId(null)
      return
    }
    try {
      await editMessage(scopeId, activeConvId, editingMsgId, editContent.trim())
      setMessages(prev => prev.map(m =>
        m.id === editingMsgId ? { ...m, content: editContent.trim() } : m
      ))
    } catch {
      setError('编辑失败')
    }
    setEditingMsgId(null)
  }

  const handleDeleteMessage = async (msgId: string) => {
    if (!scopeId || !activeConvId) return
    try {
      await deleteMessage(scopeId, activeConvId, msgId)
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
    if (!scopeId || !activeConvId || streaming || regeneratingMsgId) return

    setRegeneratingMsgId(assistantMsg.id)
    setRegenContent('')
    setRegenSources([])
    setError(null)

    // Remove the old assistant message from display
    setMessages(prev => prev.filter(m => m.id !== assistantMsg.id))

    let accumulatedContent = ''
    let accumulatedSources: SourceItem[] = []
    const currentScopeId = scopeId

    const abort = regenerateResponse(
      currentScopeId,
      activeConvId,
      userMsg.id,
      mode,
      topK,
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
        getMessages(currentScopeId, convId).then(setMessages).catch(() => {})
      },
      (err) => {
        console.error('Regenerate error:', err)
        setError(err?.message || '重新生成失败')
        setRegeneratingMsgId(null)
        // Restore old message on failure
        getMessages(currentScopeId, activeConvId).then(setMessages).catch(() => {})
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
    if (!scopeId || !activeConvId) return
    try {
      const newConv = await branchConversation(scopeId, activeConvId, msgId)
      refreshConversationList()
      // Switch to the new branch
      setActiveConvId(newConv.id)
      const msgs = await getMessages(scopeId, newConv.id)
      setMessages(msgs)
    } catch {
      setError('创建分支失败')
    }
  }

  const handleDeleteConv = async (convId: string) => {
    if (!scopeId) return
    await archiveConversation(scopeId, convId)
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
    setIsOrphanedConv(false)
  }

  // ── Citation click handler ──
  const handleCitationClick = async (src: SourceItem) => {
    if (!src.doc_id) return
    setPreviewLoading(true)
    setHighlightChunkIndex(src.chunk_index ?? null)
    try {
      const doc = await getDocumentPreview(src.doc_id)
      setPreviewDoc(doc)
    } catch {
      setPreviewDoc(null)
    }
    setPreviewLoading(false)
  }

  // Scroll to highlighted chunk in document viewer
  useEffect(() => {
    if (previewDoc && highlightChunkIndex !== null) {
      setTimeout(() => {
        document.getElementById(`doc-chunk-${highlightChunkIndex}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }, 150)
    }
  }, [previewDoc, highlightChunkIndex])

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

  // ── History scroll handler ──
  const handleScrollToMessage = useCallback((msgId: string) => {
    setIsHistoryOpen(false)
    setTimeout(() => {
      document.getElementById(`msg-${msgId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }, [])

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      {!activeCollectionId && !isFreeChat ? (
        /* No collection selected and not in free chat */
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
              <p className="text-xl font-serif" style={{ color: 'var(--text-primary)' }}>开始你的对话</p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                选择知识库进行 RAG 对话，或直接开始自由对话
              </p>
            </div>
            <div className="max-w-xs mx-auto space-y-3">
              <CollectionSelect
                collections={collections}
                value={activeCollectionId}
                onChange={(id) => {
                  setIsFreeChat(false)
                  setActiveCollectionId(id || null)
                  navigate(id ? `/chat/${id}` : '/chat')
                }}
              />
              <button
                onClick={() => {
                  setIsFreeChat(true)
                  setActiveConvId(null)
                  setMessages([])
                  navigate('/chat/free')
                }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(167,139,250,0.04))',
                  border: '1px solid rgba(59,130,246,0.18)',
                  color: 'var(--text-primary)',
                  boxShadow: '0 2px 12px rgba(59,130,246,0.06)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.14), rgba(167,139,250,0.08))'
                  e.currentTarget.style.borderColor = 'var(--accent-blue)'
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.12)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(167,139,250,0.04))'
                  e.currentTarget.style.borderColor = 'rgba(59,130,246,0.18)'
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(59,130,246,0.06)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(167,139,250,0.1))' }}>
                  <MessageCircle size={22} className="text-[var(--accent-blue)]" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">自由对话</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>不依赖知识库，直接与苏格拉底对话</div>
                </div>
              </button>

              {/* Orphaned conversations from archived collections */}
              {orphanedConversations.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-1 pt-2">
                    <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
                      已归档知识库对话
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
                  </div>
                  {orphanedConversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setIsFreeChat(true)
                        setActiveCollectionId(null)
                        setIsOrphanedConv(true)
                        setActiveConvId(conv.id)
                        setMessages([])
                        getMessages('free', conv.id).then(setMessages).catch(() => setMessages([]))
                        navigate('/chat/free')
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 text-left"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-glass)',
                        color: 'var(--text-primary)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-card-hover)'
                        e.currentTarget.style.borderColor = 'var(--border-glass)'
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-card)'
                        e.currentTarget.style.borderColor = 'var(--border-glass)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                           style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
                        <MessageSquare size={16} style={{ color: 'var(--text-dim)' }} />
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="text-sm truncate">{conv.title}</div>
                        <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          来自已删除的知识库 · {conv.message_count} 条消息
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      ) : (
        <PanelGroup orientation="horizontal" className="h-full">
          {/* Left sidebar - Conversations */}
          <Panel defaultSize="28%" minSize="20%" maxSize="45%">
            <div className="h-full flex flex-col border-r overflow-hidden min-w-0"
                 style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-sidebar)' }}>
              {/* Collection selector / Free chat indicator */}
              <div className="p-3 border-b" style={{ borderColor: 'var(--border-glass)' }}>
                {isFreeChat ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                         style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                      <MessageCircle size={16} className="text-[var(--accent-blue)]" />
                      <span className="text-sm font-medium" style={{ color: 'var(--accent-blue)' }}>自由对话</span>
                    </div>
                    <button
                      onClick={() => {
                        setIsFreeChat(false)
                        setActiveConvId(null)
                        setMessages([])
                        const lastId = localStorage.getItem('lastCollectionId')
                        if (lastId) {
                          setActiveCollectionId(lastId)
                          navigate(`/chat/${lastId}`)
                        } else {
                          navigate('/chat')
                        }
                      }}
                      className="w-full text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
                      style={{ color: 'var(--text-muted)', border: '1px solid var(--border-glass)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-glass)' }}
                    >
                      ← 切换到知识库对话
                    </button>
                  </div>
                ) : (
                  <>
                    <CollectionSelect
                      collections={collections}
                      value={activeCollectionId}
                      onChange={(id) => {
                        setIsFreeChat(false)
                        setActiveCollectionId(id || null)
                        setActiveConvId(null)
                        setMessages([])
                        navigate(id ? `/chat/${id}` : '/chat')
                      }}
                    />
                    <button
                      onClick={() => {
                        setIsFreeChat(true)
                        setActiveCollectionId(null)
                        setActiveConvId(null)
                        setMessages([])
                        navigate('/chat/free')
                      }}
                      className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200"
                      style={{
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-glass)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--accent-blue)'
                        e.currentTarget.style.borderColor = 'var(--accent-blue)'
                        e.currentTarget.style.background = 'rgba(59,130,246,0.05)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)'
                        e.currentTarget.style.borderColor = 'var(--border-glass)'
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <MessageCircle size={16} />
                      <span>自由对话</span>
                    </button>
                  </>
                )}
              </div>

              {/* New conversation */}
              <div className="p-3">
                <button
                  onClick={handleNewConv}
                  className="w-full text-sm flex items-center gap-2 justify-center py-2.5 rounded-lg transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.04))',
                    border: '1px solid rgba(59,130,246,0.18)',
                    color: 'var(--accent-blue)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(59,130,246,0.08))'
                    e.currentTarget.style.borderColor = 'var(--accent-blue)'
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(59,130,246,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.04))'
                    e.currentTarget.style.borderColor = 'rgba(59,130,246,0.18)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <Plus size={17} />
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

                {/* Orphaned conversations — peer section to free chat */}
                {isFreeChat && orphanedConversations.length > 0 && (
                  <div className="border-t mt-2 pt-2" style={{ borderColor: 'var(--border-glass)' }}>
                    <p className="px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
                      已归档知识库对话
                    </p>
                    {orphanedConversations.map(conv => {
                      const isActive = activeConvId === conv.id
                      return (
                        <div
                          key={conv.id}
                          className="group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all duration-200 mx-2"
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
                          <MessageSquare size={14} style={{ color: 'var(--text-dim)' }} />
                          <span className="truncate flex-1">{conv.title}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {/* Resize handle */}
          <PanelResizeHandle />

          {/* Center - Chat */}
          <Panel defaultSize={showSources ? "47%" : "72%"} minSize="30%">
            <div className="h-full flex flex-col">
              {/* Orphaned conversation banner */}
              {isOrphanedConv && (
                <div className="mx-4 mt-3 rounded-xl px-4 py-3 flex items-start gap-3"
                     style={{
                       background: 'rgba(251,191,36,0.1)',
                       border: '1px solid rgba(251,191,36,0.25)',
                     }}>
                  <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-gold)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--accent-gold)' }}>
                      此对话关联的知识库已被删除
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      仅可查看历史记录，无法发送新消息。如需继续对话，请创建新对话。
                    </p>
                  </div>
                </div>
              )}

              {/* Header bar with history & export */}
              {activeConvId && messages.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border-glass)' }}>
                  {/* Left: History trigger */}
                  <div
                    className="relative"
                    onMouseEnter={() => setIsHistoryOpen(true)}
                    onMouseLeave={() => setIsHistoryOpen(false)}
                  >
                    <button
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200"
                      style={{
                        color: isHistoryOpen ? 'var(--accent-blue)' : 'var(--text-muted)',
                        background: isHistoryOpen ? 'rgba(59,130,246,0.1)' : 'transparent',
                        border: '1px solid transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isHistoryOpen) {
                          e.currentTarget.style.color = 'var(--text-primary)'
                          e.currentTarget.style.background = 'var(--bg-card-hover)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isHistoryOpen) {
                          e.currentTarget.style.color = 'var(--text-muted)'
                          e.currentTarget.style.background = 'transparent'
                        }
                      }}
                    >
                      <History size={14} />
                      <span>历史消息</span>
                    </button>

                    <AnimatePresence>
                      {isHistoryOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.12 }}
                          className="absolute top-full left-0 mt-1 z-50 glass-panel overflow-hidden"
                          style={{
                            minWidth: '220px',
                            maxHeight: '360px',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
                          }}
                        >
                          <div className="py-1.5 px-3 border-b flex items-center gap-2"
                               style={{ borderColor: 'var(--border-glass)' }}>
                            <History size={12} style={{ color: 'var(--text-dim)' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                              历史消息 · {messages.filter(m => m.role === 'user').length} 条
                            </span>
                          </div>
                          <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
                            {(() => {
                              const userMsgs = messages.filter(m => m.role === 'user')
                              return userMsgs.length === 0 ? (
                                <div className="px-3 py-6 text-center">
                                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>暂无用户消息</p>
                                </div>
                              ) : (
                                userMsgs.map((msg) => (
                                  <button
                                    key={msg.id}
                                    onClick={() => handleScrollToMessage(msg.id)}
                                    className="w-full text-left px-3 py-2.5 transition-all duration-150 border-b last:border-b-0"
                                    style={{
                                      borderColor: 'var(--border-glass)',
                                      color: 'var(--text-secondary)',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(59,130,246,0.08)'
                                      e.currentTarget.style.color = 'var(--text-primary)'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent'
                                      e.currentTarget.style.color = 'var(--text-secondary)'
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <MessageCircle size={11} style={{ color: 'var(--text-dim)' }} />
                                      <span className="text-xs truncate">
                                        {msg.content.length > 10 ? msg.content.slice(0, 10) + '...' : msg.content}
                                      </span>
                                    </div>
                                  </button>
                                ))
                              )
                            })()}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Right: Export button */}
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
              <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
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
                      id={`msg-${msg.id}`}
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
                        {!streaming && !regeneratingMsgId && editingMsgId !== msg.id && !isOrphanedConv && (
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
                {/* Mode toggle + Top-K selector (hidden for orphaned convs) */}
                {!isOrphanedConv && (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
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

                  {/* Top-K selector (hidden in free chat mode) */}
                  {!isFreeChat && (
                  <div className="relative ml-auto" ref={topKRef}>
                    <button
                      onClick={() => setShowTopKPanel(!showTopKPanel)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200"
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-glass)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <SlidersHorizontal size={12} />
                      <span>检索 {topK} 条</span>
                      <ChevronDown size={12} className={`transition-transform ${showTopKPanel ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showTopKPanel && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="absolute bottom-full right-0 mb-2 w-64 glass-panel p-3 z-50"
                          style={{ boxShadow: '0 -8px 30px rgba(0,0,0,0.15)' }}
                        >
                          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                            参考来源条数
                          </div>
                          <div className="space-y-1">
                            {[
                              { value: 3, label: '3 条', desc: '快速精准，适合简单问题' },
                              { value: 5, label: '5 条', desc: '默认推荐，平衡速度与质量' },
                              { value: 8, label: '8 条', desc: '广泛检索，适合复杂问题' },
                              { value: 10, label: '10 条', desc: '深度搜索，覆盖更多内容' },
                              { value: 15, label: '15 条', desc: '全面检索，适合对比分析' },
                              { value: 20, label: '20 条', desc: '最大范围，响应较慢' },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  setTopK(opt.value)
                                  localStorage.setItem('chatTopK', String(opt.value))
                                  setShowTopKPanel(false)
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg transition-all duration-150"
                                style={{
                                  background: topK === opt.value ? 'rgba(59,130,246,0.12)' : 'transparent',
                                  border: topK === opt.value ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                                }}
                                onMouseEnter={(e) => {
                                  if (topK !== opt.value) {
                                    e.currentTarget.style.background = 'var(--bg-card-hover)'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (topK !== opt.value) {
                                    e.currentTarget.style.background = 'transparent'
                                  }
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium" style={{ color: topK === opt.value ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                                    {opt.label}
                                  </span>
                                  {topK === opt.value && <Check size={14} className="text-[var(--accent-blue)]" />}
                                </div>
                                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                  {opt.desc}
                                </div>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  )}
                </div>
                )}

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
                    placeholder={
                      isOrphanedConv
                        ? '此对话已归档，无法发送新消息'
                        : isFreeChat
                          ? '自由对话模式，随意提问...'
                          : mode === 'socratic' ? '向苏格拉底提问...' : '输入你的问题...'
                    }
                    rows={2}
                    className="input-field flex-1 resize-none"
                    disabled={streaming || !!regeneratingMsgId || isOrphanedConv}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || streaming || !!regeneratingMsgId || isOrphanedConv}
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
                  {isFreeChat && (
                    <span className="ml-2">
                      · <span className="text-[var(--accent-blue)]">自由对话模式</span>
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
                          className="glass-card p-4 space-y-2 cursor-pointer group/source transition-all duration-200 hover:border-[var(--accent-blue)]/30"
                          style={{ border: '1px solid var(--border-glass)' }}
                          onClick={() => handleCitationClick(src)}
                          title="点击查看文档原文对应位置"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium truncate max-w-[65%] group-hover/source:text-[var(--accent-blue)] transition-colors" style={{ color: 'var(--accent-blue)' }}>
                              {src.doc_name}
                            </span>
                            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              <span>{(src.score * 100).toFixed(0)}%</span>
                              <span className="opacity-0 group-hover/source:opacity-100 transition-opacity text-[10px]" style={{ color: 'var(--accent-cyan)' }}>
                                查看原文 →
                              </span>
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

      {/* ── Document Viewer Modal (Citation Navigation) ── */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => { setPreviewDoc(null); setHighlightChunkIndex(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-3xl max-h-[85vh] rounded-2xl flex flex-col overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-glass)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
                   style={{ borderColor: 'var(--border-glass)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                       style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <FileText size={20} className="text-[var(--accent-blue)]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {previewDoc.filename}
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {previewDoc.file_type.toUpperCase()} · {previewDoc.chunk_count} 个分段
                      {highlightChunkIndex !== null && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[var(--accent-blue)]"
                              style={{ background: 'rgba(59,130,246,0.1)' }}>
                          跳转到第 {highlightChunkIndex + 1} 段
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setPreviewDoc(null); setHighlightChunkIndex(null) }}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {previewLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-dim)' }} />
                  </div>
                ) : previewDoc.chunks.length > 0 ? (
                  <div className="space-y-4">
                    {previewDoc.chunks.map((chunk: DocumentChunk) => {
                      const isHighlighted = highlightChunkIndex === chunk.index
                      return (
                        <div
                          key={chunk.index}
                          id={`doc-chunk-${chunk.index}`}
                          className="rounded-xl p-4 transition-all duration-500"
                          style={{
                            background: isHighlighted ? 'rgba(59,130,246,0.1)' : 'var(--bg-input)',
                            border: isHighlighted
                              ? '2px solid var(--accent-blue)'
                              : '1px solid var(--border-glass)',
                            boxShadow: isHighlighted ? '0 0 24px rgba(59,130,246,0.15)' : 'none',
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="text-xs px-2 py-0.5 rounded-md font-medium"
                              style={{
                                background: isHighlighted ? 'var(--accent-blue)' : 'var(--bg-card)',
                                color: isHighlighted ? '#fff' : 'var(--text-muted)',
                              }}
                            >
                              第 {chunk.index + 1} 段
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                              {chunk.char_count} 字符
                            </span>
                            {isHighlighted && (
                              <span className="text-xs px-1.5 py-0.5 rounded"
                                    style={{ color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.15)' }}>
                                检索命中
                              </span>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap"
                             style={{ color: isHighlighted ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {chunk.text}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText size={32} className="mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>无法加载文档内容</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
