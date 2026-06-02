/**
 * DocumentPreviewModal — citation-focused document viewer with inline original-file support.
 * Used from ChatPage for viewing source documents.
 */
import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Loader2, X, ExternalLink, Download, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react'
import type { DocumentPreview, DocumentChunk } from '../../types'
import { getDocumentFileUrl } from '../../services/api'
import { useSidebarWidth } from '../../hooks/useSidebarWidth'

interface DocumentPreviewModalProps {
  previewDoc: DocumentPreview | null
  highlightChunkIndex: number | null
  previewLoading: boolean
  onClose: () => void
}

type ViewMode = 'text' | 'original'

const INLINE_PREVIEW: Record<string, 'iframe' | 'img' | false> = {
  pdf: 'iframe',
  png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', webp: 'img', svg: 'img',
}

const PLAIN_TEXT_TYPES = new Set(['txt', 'md', 'markdown'])

export function DocumentPreviewModal({
  previewDoc,
  highlightChunkIndex,
  previewLoading,
  onClose,
}: DocumentPreviewModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('text')
  const [origError, setOrigError] = useState<string | null>(null)
  const [maximized, setMaximized] = useState(false)
  const sidebarWidth = useSidebarWidth()

  // Reset view when opening a different document
  useEffect(() => {
    setViewMode('text')
    setOrigError(null)
  }, [previewDoc?.document_id])

  const switchToOriginal = useCallback(() => {
    setViewMode('original')
    setOrigError(null)
  }, [])

  const switchToText = useCallback(() => setViewMode('text'), [])

  const handleOrigImgError = useCallback(() => {
    setOrigError('原文件加载失败，可能已被删除')
  }, [])

  if (!previewDoc) return null

  const docId = previewDoc.document_id
  const fileUrl = getDocumentFileUrl(docId)
  const fileType = previewDoc.file_type.toLowerCase()
  const previewMode = PLAIN_TEXT_TYPES.has(fileType) ? null : (INLINE_PREVIEW[fileType] ?? false)

  return (
    <AnimatePresence>
      {previewDoc && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed z-[100] flex items-center justify-center ${maximized ? 'p-0' : 'p-6'}`}
          style={{
            top: 0, right: 0, bottom: 0,
            left: maximized ? `${sidebarWidth}px` : 0,
            // PDF/iframe repaints leave ghost trails under backdrop-filter; drop the blur in original view.
            background: viewMode === 'original' ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)',
            backdropFilter: viewMode === 'original' ? 'none' : 'blur(8px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className={`flex flex-col ${maximized ? 'w-full h-full rounded-none' : 'h-[85vh] rounded-2xl'}`}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
              minWidth: maximized ? undefined : '48rem',
              width: maximized ? undefined : 'min(90vw, 48rem)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-glass)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <FileText size={20} className="text-[var(--accent-blue)]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{previewDoc.filename}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {previewDoc.file_type.toUpperCase()} · {previewDoc.chunk_count} 个分段
                    {highlightChunkIndex !== null && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[var(--accent-blue)]" style={{ background: 'rgba(59,130,246,0.1)' }}>
                        跳转到第 {highlightChunkIndex + 1} 段
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!PLAIN_TEXT_TYPES.has(fileType) && (
                  <button
                    onClick={viewMode === 'original' ? switchToText : switchToOriginal}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-[var(--bg-card-hover)]"
                    style={{
                      color: viewMode === 'original' ? '#fff' : 'var(--accent-blue)',
                      background: viewMode === 'original' ? 'var(--accent-blue)' : 'transparent',
                      border: viewMode === 'original' ? '1px solid var(--accent-blue)' : '1px solid rgba(59,130,246,0.25)',
                    }}
                  >
                    <ExternalLink size={14} />
                    {viewMode === 'original' ? '返回文本' : '查看原文件'}
                  </button>
                )}
                <button
                  onClick={() => setMaximized(!maximized)}
                  className="p-2 rounded-lg transition-colors hover:text-[var(--text-primary)]"
                  style={{ color: 'var(--text-muted)' }}
                  title={maximized ? '还原' : '最大化'}
                >
                  {maximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:text-[var(--text-primary)]" style={{ color: 'var(--text-muted)' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* ── Content ── */}
            <div
              className="flex-1 min-h-0 px-6 py-4"
              style={{
                overflow: viewMode === 'original' ? 'hidden' : 'auto',
              }}
            >
              {/* Loading (text view) */}
              {previewLoading && viewMode === 'text' && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-dim)' }} />
                </div>
              )}

              {/* Text view: chunks with highlight */}
              {!previewLoading && viewMode === 'text' && (
                previewDoc.chunks.length > 0 ? (
                  <div className="space-y-4">
                    {previewDoc.chunks.map((chunk: DocumentChunk) => {
                      const isHighlighted = highlightChunkIndex === chunk.index
                      return (
                        <div key={chunk.index} id={`doc-chunk-${chunk.index}`}
                          className="rounded-xl p-4 transition-all duration-500"
                          style={{
                            background: isHighlighted ? 'rgba(59,130,246,0.1)' : 'var(--bg-input)',
                            border: isHighlighted ? '2px solid var(--accent-blue)' : '1px solid var(--border-glass)',
                            boxShadow: isHighlighted ? '0 0 24px rgba(59,130,246,0.15)' : 'none',
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                              style={{ background: isHighlighted ? 'var(--accent-blue)' : 'var(--bg-card)', color: isHighlighted ? '#fff' : 'var(--text-muted)' }}>
                              第 {chunk.index + 1} 段
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{chunk.char_count} 字符</span>
                            {isHighlighted && (
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.15)' }}>
                                检索命中
                              </span>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: isHighlighted ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
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
                )
              )}

              {/* ── Original file view ── */}
              {viewMode === 'original' && (
                <div className="h-full flex flex-col">
                  {origError && (
                    <div className="flex flex-col items-center justify-center flex-1 gap-4">
                      <AlertTriangle size={40} style={{ color: 'var(--text-dim)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>原文件加载失败，可能已被删除</p>
                      <a href={fileUrl} download className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent-blue)', color: '#fff' }}>
                        <Download size={16} />下载原文件
                      </a>
                    </div>
                  )}
                  {/* PDF: iframe fills available space */}
                  {!origError && previewMode === 'iframe' && (
                    <iframe src={fileUrl} className="w-full flex-1 rounded-lg"
                      style={{ border: '1px solid var(--border-glass)', minHeight: '600px' }}
                      onError={handleOrigImgError} title={previewDoc.filename} />
                  )}
                  {/* Image: fills available space */}
                  {!origError && previewMode === 'img' && (
                    <div className="flex items-center justify-center flex-1">
                      <img src={fileUrl} alt={previewDoc.filename}
                        className="max-w-full max-h-full object-contain rounded-lg"
                        style={{ border: '1px solid var(--border-glass)' }}
                        onError={handleOrigImgError} />
                    </div>
                  )}
                  {/* Non-previewable: download card */}
                  {!origError && previewMode === false && (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
                        <FileText size={36} style={{ color: 'var(--accent-blue)' }} />
                      </div>
                      <div className="text-center">
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{previewDoc.filename}</p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{fileType.toUpperCase()} · 浏览器不支持直接预览此格式</p>
                      </div>
                      <a href={fileUrl} download className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--accent-blue)', color: '#fff', boxShadow: '0 4px 14px rgba(59,130,246,0.25)' }}>
                        <Download size={16} />下载原文件
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
