/**
 * SourcesPanel — right-side panel showing citation sources for the latest assistant message.
 * Extracted from ChatPage.tsx.
 */
import { motion } from 'framer-motion'
import { FileText, Globe, X } from 'lucide-react'
import type { SourceItem } from '../../types'

interface SourcesPanelProps {
  sources: SourceItem[]
  onClose: () => void
  onCitationClick: (src: SourceItem) => void
}

export function SourcesPanel({ sources, onClose, onCitationClick }: SourcesPanelProps) {
  return (
    <div
      className="h-full flex flex-col border-l overflow-hidden"
      style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-sidebar)' }}
    >
      <div
        className="p-4 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border-glass)' }}
      >
        <h3
          className="text-sm font-medium flex items-center gap-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          <FileText size={16} className="text-[var(--accent-blue)]" />
          引用来源
        </h3>
        <button onClick={onClose} className="btn-ghost p-1">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sources.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={32} className="mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无引用来源</p>
          </div>
        ) : (
          sources.map((src, i) => {
            const isWeb = src.source_type === 'web'
            return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4 space-y-2 group/source transition-all duration-200 hover:border-[var(--accent-blue)]/30"
              style={{ border: isWeb ? '1px solid rgba(34,197,94,0.25)' : '1px solid var(--border-glass)' }}
              onClick={() => {
                if (isWeb && src.url) {
                  window.open(src.url, '_blank', 'noopener,noreferrer')
                } else {
                  onCitationClick(src)
                }
              }}
              title={isWeb ? `打开网页: ${src.url}` : '点击查看文档原文对应位置'}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium truncate max-w-[65%] transition-colors flex items-center gap-1.5 ${
                    isWeb ? '' : 'group-hover/source:text-[var(--accent-blue)]'
                  }`}
                  style={{ color: isWeb ? '#16a34a' : 'var(--accent-blue)' }}
                >
                  {isWeb ? <Globe size={12} className="shrink-0" /> : <FileText size={12} className="shrink-0" />}
                  <span className="truncate">{src.doc_name}</span>
                </span>
                <span
                  className="text-xs flex items-center gap-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {!isWeb && <span>{(src.score * 100).toFixed(0)}%</span>}
                  <span
                    className="opacity-0 group-hover/source:opacity-100 transition-opacity text-[10px]"
                    style={{ color: isWeb ? '#16a34a' : 'var(--accent-cyan)' }}
                  >
                    {isWeb ? '打开链接 →' : '查看原文 →'}
                  </span>
                </span>
              </div>
              {!isWeb && (
                <div
                  className="w-full h-1 rounded-full overflow-hidden"
                  style={{ background: 'var(--bg-input)' }}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-cyan)]"
                    style={{ width: `${src.score * 100}%` }}
                  />
                </div>
              )}
              <p
                className="text-xs leading-relaxed line-clamp-4"
                style={{ color: 'var(--text-muted)' }}
              >
                {src.chunk_text}
              </p>
            </motion.div>
          )})
        )}
      </div>
    </div>
  )
}
