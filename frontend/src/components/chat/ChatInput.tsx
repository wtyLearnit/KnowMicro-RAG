/**
 * ChatInput — bottom input area with mode toggle, Top-K selector, and send button.
 * Extracted from ChatPage.tsx.
 */
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, SlidersHorizontal, ChevronDown, Check, Loader2 } from 'lucide-react'
import { TOP_K_OPTIONS } from '../../utils/constants'
import type { Collection } from '../../types'

interface ChatInputProps {
  isOrphanedConv: boolean
  mode: 'socratic' | 'direct'
  isFreeChat: boolean
  topK: number
  input: string
  streaming: boolean
  regeneratingMsgId: string | null
  activeCollection: Collection | null
  onModeChange: (mode: 'socratic' | 'direct') => void
  onTopKChange: (value: number) => void
  onInputChange: (value: string) => void
  onSend: () => void
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
  onModeChange,
  onTopKChange,
  onInputChange,
  onSend,
}: ChatInputProps) {
  const [showTopKPanel, setShowTopKPanel] = useState(false)
  const topKRef = useRef<HTMLDivElement | null>(null)

  // Close Top-K panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (topKRef.current && !topKRef.current.contains(e.target as Node)) {
        setShowTopKPanel(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isDisabled = streaming || !!regeneratingMsgId || isOrphanedConv

  return (
    <div
      className="border-t p-4"
      style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-sidebar)' }}
    >
      {/* Mode toggle + Top-K selector */}
      {!isOrphanedConv && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div
            className="flex rounded-lg p-0.5"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}
          >
            <button
              onClick={() => {
                onModeChange('socratic')
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
                onModeChange('direct')
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
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
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
            rows={2}
            className="w-full input-field resize-none text-sm"
            disabled={isDisabled}
            style={{
              color: isDisabled ? 'var(--text-dim)' : 'var(--text-primary)',
            }}
          />
        </div>
        <button
          onClick={onSend}
          disabled={isDisabled || !input.trim()}
          className="btn-primary shrink-0 flex items-center gap-2"
          style={{
            background: isDisabled
              ? 'var(--bg-card)'
              : 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',
            color: isDisabled ? 'var(--text-dim)' : '#fff',
            cursor: isDisabled || !input.trim() ? 'not-allowed' : 'pointer',
            boxShadow:
              !isDisabled && input.trim()
                ? '0 2px 12px rgba(59,130,246,0.3)'
                : 'none',
          }}
        >
          {streaming || regeneratingMsgId ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          <span className="text-sm font-medium">发送</span>
        </button>
      </div>
    </div>
  )
}
