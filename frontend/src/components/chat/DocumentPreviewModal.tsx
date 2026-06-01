/**
 * DocumentPreviewModal — shows full document text with chunk highlighting.
 * Extracted from ChatPage.tsx; also reusable from KnowledgeBasePage.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Loader2, X } from 'lucide-react'
import type { DocumentPreview, DocumentChunk } from '../../types'

interface DocumentPreviewModalProps {
  previewDoc: DocumentPreview | null
  highlightChunkIndex: number | null
  previewLoading: boolean
  onClose: () => void
}

export function DocumentPreviewModal({
  previewDoc,
  highlightChunkIndex,
  previewLoading,
  onClose,
}: DocumentPreviewModalProps) {
  return (
    <AnimatePresence>
      {previewDoc && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
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
            <div
              className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: 'var(--border-glass)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'rgba(59,130,246,0.12)',
                    border: '1px solid rgba(59,130,246,0.2)',
                  }}
                >
                  <FileText size={20} className="text-[var(--accent-blue)]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {previewDoc.filename}
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {previewDoc.file_type.toUpperCase()} · {previewDoc.chunk_count} 个分段
                    {highlightChunkIndex !== null && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded text-[var(--accent-blue)]"
                        style={{ background: 'rgba(59,130,246,0.1)' }}
                      >
                        跳转到第 {highlightChunkIndex + 1} 段
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition-colors hover:text-[var(--text-primary)]"
                style={{ color: 'var(--text-muted)' }}
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
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                color: 'var(--accent-blue)',
                                background: 'rgba(59,130,246,0.15)',
                              }}
                            >
                              检索命中
                            </span>
                          )}
                        </div>
                        <p
                          className="text-sm leading-relaxed whitespace-pre-wrap"
                          style={{
                            color: isHighlighted ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}
                        >
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
  )
}
