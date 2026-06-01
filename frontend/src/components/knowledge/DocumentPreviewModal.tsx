/**
 * DocumentPreviewModal — document preview with content/chunk tabs.
 * Extracted from KnowledgeBasePage.tsx.
 * Different from ChatPage's DocumentPreviewModal (citation-focused).
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { getDocumentPreview } from '../../services/api'
import type { DocumentPreview } from '../../types'

interface DocumentPreviewModalProps {
  docId: string
  onClose: () => void
}

export function DocumentPreviewModal({ docId, onClose }: DocumentPreviewModalProps) {
  const [preview, setPreview] = useState<DocumentPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'content' | 'chunks'>('content')
  const [currentChunk, setCurrentChunk] = useState(0)

  useEffect(() => {
    getDocumentPreview(docId)
      .then(setPreview)
      .catch((err) => setError(err?.response?.data?.detail || '加载失败'))
      .finally(() => setLoading(false))
  }, [docId])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-panel w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: 'var(--border-glass)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}
            >
              <FileText size={18} style={{ color: 'var(--accent-blue)' }} />
            </div>
            <div className="min-w-0">
              <h3
                className="font-serif font-semibold truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {preview?.filename || '加载中...'}
              </h3>
              {preview && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {(preview.file_size / 1024).toFixed(1)} KB ·{' '}
                  {preview.file_type.toUpperCase()} · {preview.chunk_count} 片段
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4">
          {(['content', 'chunks'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-t-lg text-sm font-medium transition-all duration-200"
              style={{
                background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
                color: activeTab === tab ? 'var(--accent-blue)' : 'var(--text-muted)',
                border:
                  activeTab === tab
                    ? '1px solid var(--border-glass)'
                    : '1px solid transparent',
                borderBottom:
                  activeTab === tab ? '1px solid var(--bg-card)' : undefined,
              }}
            >
              {tab === 'content'
                ? '📄 原文内容'
                : `🧩 分块结果 (${preview?.chunks.length || 0})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2
                size={32}
                className="animate-spin"
                style={{ color: 'var(--accent-blue)' }}
              />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p style={{ color: 'var(--text-muted)' }}>{error}</p>
            </div>
          ) : activeTab === 'content' ? (
            <div
              className="prose-content text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--text-secondary)' }}
            >
              {preview?.content || '(无内容)'}
            </div>
          ) : preview?.chunks && preview.chunks.length > 0 ? (
            <div className="space-y-3">
              {/* Chunk navigator */}
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  片段 {currentChunk + 1} / {preview.chunks.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentChunk(Math.max(0, currentChunk - 1))}
                    disabled={currentChunk === 0}
                    className="btn-ghost p-1.5 disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentChunk(
                        Math.min(preview.chunks.length - 1, currentChunk + 1),
                      )
                    }
                    disabled={currentChunk === preview.chunks.length - 1}
                    className="btn-ghost p-1.5 disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Current chunk */}
              <motion.div
                key={currentChunk}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(59,130,246,0.1)',
                      color: 'var(--accent-blue)',
                    }}
                  >
                    片段 #{preview.chunks[currentChunk].index}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {preview.chunks[currentChunk].char_count} 字符
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {preview.chunks[currentChunk].text}
                </p>
              </motion.div>

              {/* Chunk list (scrollable thumbnails) */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 mt-4">
                {preview.chunks.map((chunk, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentChunk(i)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all duration-150 truncate"
                    style={{
                      background:
                        i === currentChunk ? 'rgba(59,130,246,0.1)' : 'var(--bg-input)',
                      border:
                        i === currentChunk
                          ? '1px solid var(--accent-blue)'
                          : '1px solid var(--border-glass)',
                      color:
                        i === currentChunk
                          ? 'var(--accent-blue)'
                          : 'var(--text-muted)',
                    }}
                  >
                    <span className="font-medium">#{chunk.index}</span>
                    {' — '}
                    {chunk.text.slice(0, 60)}...
                    <span className="ml-2" style={{ color: 'var(--text-dim)' }}>
                      ({chunk.char_count}字符)
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <p style={{ color: 'var(--text-muted)' }}>暂无分块数据</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
