/**
 * DocumentPreviewModal — three-tab document viewer: extracted text, chunks, original file.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, X, Loader2, ChevronLeft, ChevronRight, Download, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react'
import { getDocumentPreview, getDocumentFileUrl } from '../../services/api'
import { useSidebarWidth } from '../../hooks/useSidebarWidth'
import type { DocumentPreview } from '../../types'

interface DocumentPreviewModalProps {
  docId: string
  onClose: () => void
}

type TabId = 'content' | 'chunks' | 'original'

/** File types that browsers can preview inline. */
const INLINE_TYPES: Record<string, 'iframe' | 'img' | false> = {
  pdf: 'iframe',
  png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', webp: 'img', svg: 'img',
}

const PLAIN_TEXT = new Set(['txt', 'md', 'markdown'])

function previewMode(fileType: string): 'iframe' | 'img' | false {
  return INLINE_TYPES[fileType.toLowerCase()] ?? false
}

export function DocumentPreviewModal({ docId, onClose }: DocumentPreviewModalProps) {
  const [preview, setPreview] = useState<DocumentPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('content')
  const [currentChunk, setCurrentChunk] = useState(0)

  // Original-file state
  const [origError, setOrigError] = useState(false)
  const [origLoading, setOrigLoading] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const sidebarWidth = useSidebarWidth()

  useEffect(() => {
    getDocumentPreview(docId)
      .then(setPreview)
      .catch((err) => setError(err?.response?.data?.detail || '加载失败'))
      .finally(() => setLoading(false))
  }, [docId])

  // Reset on new document
  useEffect(() => {
    setActiveTab('content')
    setOrigError(false)
    setOrigLoading(false)
  }, [docId])

  const fileUrl = getDocumentFileUrl(docId)
  const fileType = preview?.file_type?.toLowerCase() ?? ''
  const isTxt = PLAIN_TEXT.has(fileType)
  const origMode = preview ? previewMode(preview.file_type) : false

  // When user clicks the "原文件" tab, mark loading so we show a brief spinner
  const handleSelectOriginal = () => {
    if (activeTab !== 'original') {
      setActiveTab('original')
      setOrigError(false)
      if (origMode === 'img') {
        setOrigLoading(true) // only for images where onLoad is reliable
      }
    }
  }

  const handleOrigImgLoad = () => setOrigLoading(false)
  const handleOrigImgError = () => {
    setOrigLoading(false)
    setOrigError(true)
  }

  // Build tabs dynamically
  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: 'content', label: '📄 原文内容', show: true },
    { id: 'chunks', label: `🧩 分块结果 (${preview?.chunks.length ?? 0})`, show: true },
    { id: 'original', label: '📎 原文件', show: !isTxt },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed z-50 flex items-center justify-center ${maximized ? 'p-0' : 'p-4'} ${activeTab === 'original' ? 'bg-black/80' : 'bg-black/60 backdrop-blur-sm'}`}
      style={{
        top: 0, right: 0, bottom: 0,
        left: maximized ? `${sidebarWidth}px` : 0,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`glass-panel flex flex-col ${maximized ? 'w-full h-full rounded-none' : 'min-w-[56rem] max-w-[64rem] h-[85vh]'}`}
        style={{
          ...(maximized ? {} : { width: 'min(90vw, 64rem)' }),
          // Disable the panel's backdrop-blur over the PDF iframe to avoid repaint ghosting.
          ...(activeTab === 'original' ? { backdropFilter: 'none' } : {}),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: 'var(--border-glass)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
              <FileText size={18} style={{ color: 'var(--accent-blue)' }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {preview?.filename || '加载中...'}
              </h3>
              {preview && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {(preview.file_size / 1024).toFixed(1)} KB · {preview.file_type.toUpperCase()} · {preview.chunk_count} 片段
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setMaximized(!maximized)}
              className="btn-ghost p-1"
              title={maximized ? '还原' : '最大化'}
            >
              {maximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={onClose} className="btn-ghost p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 px-5 pt-4">
          {tabs.filter(t => t.show).map(tab => (
            <button
              key={tab.id}
              onClick={() => tab.id === 'original' ? handleSelectOriginal() : setActiveTab(tab.id)}
              className="px-4 py-2 rounded-t-lg text-sm font-medium transition-all duration-200"
              style={{
                background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                color: activeTab === tab.id ? 'var(--accent-blue)' : 'var(--text-muted)',
                border: activeTab === tab.id ? '1px solid var(--border-glass)' : '1px solid transparent',
                borderBottom: activeTab === tab.id ? '1px solid var(--bg-card)' : undefined,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content area ── */}
        <div
          className="flex-1 min-h-0 p-5"
          style={{
            overflow: activeTab === 'original' ? 'hidden' : 'auto',
          }}
        >
          {/* Initial loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="text-center py-20"><p style={{ color: 'var(--text-muted)' }}>{error}</p></div>
          )}

          {/* ── Content tab ── */}
          {!loading && !error && activeTab === 'content' && (
            <div className="prose-content text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
              {preview?.content || '(无内容)'}
            </div>
          )}

          {/* ── Chunks tab ── */}
          {!loading && !error && activeTab === 'chunks' && (
            preview?.chunks && preview.chunks.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    片段 {currentChunk + 1} / {preview.chunks.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentChunk(Math.max(0, currentChunk - 1))} disabled={currentChunk === 0} className="btn-ghost p-1.5 disabled:opacity-30">
                      <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setCurrentChunk(Math.min(preview.chunks.length - 1, currentChunk + 1))} disabled={currentChunk === preview.chunks.length - 1} className="btn-ghost p-1.5 disabled:opacity-30">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <motion.div key={currentChunk} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                      片段 #{preview.chunks[currentChunk].index}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{preview.chunks[currentChunk].char_count} 字符</span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{preview.chunks[currentChunk].text}</p>
                </motion.div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 mt-4">
                  {preview.chunks.map((chunk, i) => (
                    <button key={i} onClick={() => setCurrentChunk(i)}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all duration-150 truncate"
                      style={{
                        background: i === currentChunk ? 'rgba(59,130,246,0.1)' : 'var(--bg-input)',
                        border: i === currentChunk ? '1px solid var(--accent-blue)' : '1px solid var(--border-glass)',
                        color: i === currentChunk ? 'var(--accent-blue)' : 'var(--text-muted)',
                      }}
                    >
                      <span className="font-medium">#{chunk.index}</span>
                      {' — '}{chunk.text.slice(0, 60)}...
                      <span className="ml-2" style={{ color: 'var(--text-dim)' }}>({chunk.char_count}字符)</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-20"><p style={{ color: 'var(--text-muted)' }}>暂无分块数据</p></div>
            )
          )}

          {/* ── Original file tab ── */}
          {!loading && !error && activeTab === 'original' && (
            <div className="h-full flex flex-col">
              {/* Error fallback */}
              {origError && (
                <div className="flex flex-col items-center justify-center flex-1 gap-4">
                  <AlertTriangle size={40} style={{ color: 'var(--text-dim)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>原文件加载失败，可能已被删除</p>
                  <a href={fileUrl} download
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: 'var(--accent-blue)', color: '#fff' }}>
                    <Download size={16} />下载原文件
                  </a>
                </div>
              )}

              {/* PDF: iframe — fills available space */}
              {!origError && origMode === 'iframe' && (
                <iframe
                  src={fileUrl}
                  className="w-full flex-1 rounded-lg"
                  style={{ border: '1px solid var(--border-glass)', minHeight: '600px' }}
                  title={preview?.filename ?? 'original file'}
                />
              )}

              {/* Image: fills available space */}
              {!origError && origMode === 'img' && (
                <div className="flex items-center justify-center flex-1">
                  <img
                    src={fileUrl}
                    alt={preview?.filename ?? 'original'}
                    className="max-w-full max-h-full object-contain rounded-lg"
                    style={{ border: '1px solid var(--border-glass)' }}
                    onLoad={handleOrigImgLoad}
                    onError={handleOrigImgError}
                  />
                  {origLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
                    </div>
                  )}
                </div>
              )}

              {/* DOCX/XLSX/PPTX: download card */}
              {!origError && origMode === false && !isTxt && (
                <div className="flex flex-col items-center justify-center flex-1 gap-4">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
                    <FileText size={36} style={{ color: 'var(--accent-blue)' }} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{preview?.filename}</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      {fileType.toUpperCase()} · 浏览器不支持直接预览此格式
                    </p>
                  </div>
                  <a href={fileUrl} download
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{ background: 'var(--accent-blue)', color: '#fff', boxShadow: '0 4px 14px rgba(59,130,246,0.25)' }}>
                    <Download size={16} />下载原文件
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
