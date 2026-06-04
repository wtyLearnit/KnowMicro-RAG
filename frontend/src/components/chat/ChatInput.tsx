/**
 * ChatInput — bottom input area with mode toggle, Top-K selector, and send button.
 * Extracted from ChatPage.tsx.
 */
import { useState, useRef, useEffect, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, SlidersHorizontal, ChevronDown, Check, Loader2, Bot, Globe } from 'lucide-react'
import { TOP_K_OPTIONS } from '../../utils/constants'
import { getProvider } from '../../utils/providers'
import type { Collection, ActiveConfigs } from '../../types'

interface ChatInputProps {
  isOrphanedConv: boolean
  mode: 'socratic' | 'direct'
  isFreeChat: boolean
  topK: number
  input: string
  streaming: boolean
  regeneratingMsgId: string | null
  activeCollection: Collection | null
  activeModels: ActiveConfigs | null
  selectedModelId: string | null
  webSearchEnabled: boolean
  onModeChange: (mode: 'socratic' | 'direct') => void
  onTopKChange: (value: number) => void
  onInputChange: (value: string) => void
  onSend: () => void
  onModelChange: (configId: string | null) => void
  onWebSearchChange: (enabled: boolean) => void
}

const INPUT_PANEL_HEIGHT_KEY = 'chatInputPanelHeight'
const INPUT_PANEL_MIN_HEIGHT = 192
const INPUT_PANEL_MAX_HEIGHT = 440
const INPUT_PANEL_DEFAULT_HEIGHT = 214

const clampInputPanelHeight = (height: number) => {
  return Math.min(INPUT_PANEL_MAX_HEIGHT, Math.max(INPUT_PANEL_MIN_HEIGHT, height))
}

export function ChatInput({
  isOrphanedConv,
  mode,
  isFreeChat,
  topK,
  input,
  streaming,
  regeneratingMsgId,
  activeCollection,
  activeModels,
  selectedModelId,
  webSearchEnabled,
  onModeChange,
  onTopKChange,
  onInputChange,
  onSend,
  onModelChange,
  onWebSearchChange,
}: ChatInputProps) {
  const navigate = useNavigate()
  const [showTopKPanel, setShowTopKPanel] = useState(false)
  const [showModelPanel, setShowModelPanel] = useState(false)
  const [panelHeight, setPanelHeight] = useState(() => {
    const saved = Number(localStorage.getItem(INPUT_PANEL_HEIGHT_KEY))
    return Number.isFinite(saved)
      ? clampInputPanelHeight(saved)
      : INPUT_PANEL_DEFAULT_HEIGHT
  })
  const topKRef = useRef<HTMLDivElement | null>(null)
  const modelRef = useRef<HTMLDivElement | null>(null)

  // Close panels on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (topKRef.current && !topKRef.current.contains(e.target as Node)) {
        setShowTopKPanel(false)
      }
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setShowModelPanel(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    localStorage.setItem(INPUT_PANEL_HEIGHT_KEY, String(panelHeight))
  }, [panelHeight])

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = panelHeight
    const originalCursor = document.body.style.cursor
    const originalUserSelect = document.body.style.userSelect

    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + startY - moveEvent.clientY
      setPanelHeight(clampInputPanelHeight(nextHeight))
    }

    const handlePointerUp = () => {
      document.body.style.cursor = originalCursor
      document.body.style.userSelect = originalUserSelect
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const isDisabled = streaming || !!regeneratingMsgId || isOrphanedConv

  return (
    <div
      className="relative flex flex-col border-t px-4 py-4 lg:px-6"
      style={{
        height: panelHeight,
        borderColor: 'var(--border-glass)',
        background: 'var(--bg-sidebar)',
        boxShadow: '0 -10px 30px rgba(0,0,0,0.08)',
      }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="调整输入区域高度"
        title="拖动调整输入区域高度"
        onPointerDown={handleResizeStart}
        className="absolute left-0 right-0 top-0 z-10 flex h-3 -translate-y-1/2 cursor-ns-resize items-center justify-center"
      >
        <div
          className="h-1 w-14 rounded-full transition-all duration-150 hover:w-20"
          style={{ background: 'var(--separator-bg)' }}
        />
      </div>

      {/* Mode toggle + Top-K selector */}
      {!isOrphanedConv && (
        <div className="mb-3 flex shrink-0 items-center gap-3">
          <div
            className="relative flex shrink-0 rounded-lg p-1"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}
          >
            {/* Sliding indicator */}
            <div
              className="absolute top-1 bottom-1 rounded-md transition-all duration-300 ease-out"
              style={{
                background: 'var(--accent-blue)',
                boxShadow: '0 2px 10px rgba(59,130,246,0.3)',
                left: mode === 'socratic' ? '4px' : '50%',
                width: 'calc(50% - 4px)',
              }}
            />
            <button
              onClick={() => {
                onModeChange('socratic')
                localStorage.setItem('chatMode', 'socratic')
              }}
              className="relative z-10 min-h-8 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
              style={{
                color: mode === 'socratic' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              苏格拉底式
            </button>
            <button
              onClick={() => {
                onModeChange('direct')
                localStorage.setItem('chatMode', 'direct')
              }}
              className="relative z-10 min-h-8 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
              style={{
                color: mode === 'direct' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              直接问答
            </button>
          </div>
          <span className="hidden min-w-0 flex-1 truncate text-xs sm:block" style={{ color: 'var(--text-dim)' }}>
            {mode === 'socratic' ? '引导式提问，启发思考' : '直接给出答案'}
          </span>

          {/* Web search toggle */}
          <button
            onClick={() => {
              const next = !webSearchEnabled
              onWebSearchChange(next)
              localStorage.setItem('chatWebSearch', String(next))
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200"
            style={{
              background: webSearchEnabled ? 'rgba(34,197,94,0.12)' : 'var(--bg-input)',
              border: webSearchEnabled ? '1px solid rgba(34,197,94,0.35)' : '1px solid var(--border-glass)',
              color: webSearchEnabled ? '#16a34a' : 'var(--text-muted)',
              boxShadow: webSearchEnabled ? '0 2px 8px rgba(34,197,94,0.15)' : 'none',
            }}
            title={webSearchEnabled ? '已开启网络搜索' : '已关闭网络搜索'}
          >
            <Globe size={14} />
            <span className="hidden sm:inline">网络</span>
          </button>

          {/* Top-K selector (hidden in free chat mode) */}
          {!isFreeChat && (
            <div className="relative ml-auto shrink-0" ref={topKRef}>
              <button
                onClick={() => setShowTopKPanel(!showTopKPanel)}
                className="flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all duration-200"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-secondary)',
                }}
              >
                <SlidersHorizontal size={12} />
                <span>检索 {topK} 条</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform ${showTopKPanel ? 'rotate-180' : ''}`}
                />
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
                    <div
                      className="text-xs font-medium mb-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      参考来源条数
                    </div>
                    <div className="space-y-1">
                      {TOP_K_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            onTopKChange(opt.value)
                            localStorage.setItem('chatTopK', String(opt.value))
                            setShowTopKPanel(false)
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg transition-all duration-150 hover:bg-[var(--bg-card-hover)]"
                          style={{
                            background:
                              topK === opt.value ? 'rgba(59,130,246,0.12)' : 'transparent',
                            border:
                              topK === opt.value
                                ? '1px solid rgba(59,130,246,0.3)'
                                : '1px solid transparent',
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="text-sm font-medium"
                              style={{
                                color:
                                  topK === opt.value
                                    ? 'var(--accent-blue)'
                                    : 'var(--text-primary)',
                              }}
                            >
                              {opt.label}
                            </span>
                            {topK === opt.value && (
                              <Check size={14} className="text-[var(--accent-blue)]" />
                            )}
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

      {/* Input row */}
      <div
        className="flex min-h-0 flex-1 flex-col gap-3 rounded-lg p-3 lg:flex-row lg:items-end"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-glass)',
          boxShadow: 'var(--shadow-inset)',
        }}
      >
        <div className="relative min-h-0 min-w-0 flex-1 lg:self-stretch">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            placeholder={
              isOrphanedConv
                ? '此对话关联的知识库已归档，仅可查看历史记录'
                : isFreeChat
                  ? '自由提问，AI 基于自身知识回答...'
                  : activeCollection
                    ? `向「${activeCollection.name}」提问...`
                    : '输入消息...'
            }
            rows={3}
            className="block h-full min-h-[64px] w-full resize-none rounded-lg border px-4 py-3 text-[15px] leading-6 outline-none transition-all duration-300 focus:ring-2 focus:ring-[var(--accent-blue)]/20 focus:border-[var(--accent-blue)]/40"
            disabled={isDisabled}
            style={{
              background: 'var(--bg-input)',
              borderColor: 'var(--border-glass)',
              color: isDisabled ? 'var(--text-dim)' : 'var(--text-primary)',
              boxShadow: 'none',
            }}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:self-end">
        {/* Model selector */}
        <div className="relative min-w-0 flex-1 lg:flex-none" ref={modelRef}>
          {(activeModels?.llm_configs?.length ?? 0) > 0 ? (
            <button
              onClick={() => setShowModelPanel(!showModelPanel)}
              disabled={isDisabled}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg px-3 text-xs transition-all duration-200 lg:w-[168px]"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-secondary)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <Bot size={15} className="shrink-0" />
              <span className="min-w-0 truncate">
                {(() => {
                  const active = activeModels?.llm_configs?.find(c => c.id === (selectedModelId || activeModels?.llm?.id))
                  if (active) {
                    const prov = getProvider(active.provider)
                    return <>{prov.icon} {active.model_name}</>
                  }
                  return activeModels?.llm?.model_name || '选择模型'
                })()}
              </span>
              <ChevronDown
                size={12}
                className={`transition-transform ${showModelPanel ? 'rotate-180' : ''}`}
              />
            </button>
          ) : (
            <button
              onClick={() => navigate('/settings')}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg px-3 text-xs transition-all duration-200 lg:w-[168px]"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-muted)',
              }}
              title="未配置模型，点击前往设置"
            >
              <Bot size={15} />
              <span>未配置</span>
            </button>
          )}

          <AnimatePresence>
            {showModelPanel && (activeModels?.llm_configs?.length ?? 0) > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-full right-0 mb-2 w-56 glass-panel p-2 z-50"
                style={{ boxShadow: '0 -8px 30px rgba(0,0,0,0.15)' }}
              >
                <div
                  className="text-xs font-medium px-2 py-1.5 mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  选择模型
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {activeModels!.llm_configs.map(c => {
                    const isSelected = (selectedModelId || activeModels?.llm?.id) === c.id
                    const prov = getProvider(c.provider)
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          onModelChange(c.id)
                          setShowModelPanel(false)
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg transition-all duration-150 hover:bg-[var(--bg-card-hover)]"
                        style={{
                          background: isSelected ? 'rgba(59,130,246,0.12)' : 'transparent',
                          border: isSelected ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm shrink-0" title={prov.name}>{prov.icon}</span>
                            <span
                              className="text-sm font-medium"
                              style={{ color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)' }}
                            >
                              {c.model_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {c.is_active && (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="默认模型" />
                            )}
                            {isSelected && <Check size={14} className="text-[var(--accent-blue)]" />}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => {
                    navigate('/settings')
                    setShowModelPanel(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all hover:bg-[var(--bg-card-hover)] border-t mt-1 pt-2"
                  style={{ color: 'var(--text-muted)', borderColor: 'var(--border-glass)' }}
                >
                  + 添加新模型...
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

          <button
            onClick={onSend}
            disabled={isDisabled || !input.trim()}
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium transition-all duration-300 lg:min-w-[96px] group/send"
            style={{
              background: isDisabled || !input.trim()
                ? 'var(--bg-input)'
                : 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
              backgroundSize: '200% 200%',
              border: '1px solid var(--border-glass)',
              color: isDisabled || !input.trim() ? 'var(--text-dim)' : '#fff',
              cursor: isDisabled || !input.trim() ? 'not-allowed' : 'pointer',
              boxShadow:
                !isDisabled && input.trim()
                  ? '0 8px 24px rgba(59,130,246,0.28)'
                  : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isDisabled && input.trim()) {
                e.currentTarget.style.background = 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))'
                e.currentTarget.style.backgroundSize = '200% 200%'
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(59,130,246,0.35)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isDisabled && input.trim()) {
                e.currentTarget.style.background = 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))'
                e.currentTarget.style.backgroundSize = '200% 200%'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(59,130,246,0.28)'
                e.currentTarget.style.transform = 'translateY(0)'
              }
            }}
          >
            {streaming || regeneratingMsgId ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Send size={17} className="transition-transform duration-200 group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5" />
            )}
            <span>发送</span>
          </button>
        </div>
      </div>
    </div>
  )
}
