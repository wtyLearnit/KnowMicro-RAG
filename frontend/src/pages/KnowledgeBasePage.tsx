/* 苏格拉底之窗 - Knowledge Base Management Page */
import { useEffect, useState, useRef, useCallback } from 'react'
import { formatSize } from '../utils/format'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Upload, Trash2, FileText, X, Loader2, RefreshCw,
  Database, HardDrive, Pencil, Eye, ChevronLeft, ChevronRight, ExternalLink,
  Check, GripVertical, AlertTriangle,
} from 'lucide-react'
import {
  listCollections, createCollection, updateCollection,
  archiveCollection,
  listDocuments, uploadDocumentWithProgress, archiveDocument,
  getDocumentFileUrl,
} from '../services/api'
import type { Collection, Document } from '../types'
import { IconPicker } from '../components/knowledge/IconPicker'
import { DocumentPreviewModal } from '../components/knowledge/DocumentPreviewModal'

/* ── Upload File Progress Item ────────────────── */
interface UploadItem {
  id: string
  file: File
  progress: number
  status: 'uploading' | 'processing' | 'done' | 'error'
  error?: string
}


/* ── Main Page ──────────────────────────────────── */
export function KnowledgeBasePage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)

  // Create / Edit modal state
  const [showModal, setShowModal] = useState(false)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formIcon, setFormIcon] = useState('📚')

  // Upload progress tracking
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([])

  // Drag-drop state
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  // Archive confirmation dialog
  const [archiveTarget, setArchiveTarget] = useState<Collection | null>(null)
  const [keepConversations, setKeepConversations] = useState(true)

  // Document preview
  const [previewDocId, setPreviewDocId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadCollections = async () => {
    try {
      const cols = await listCollections()
      setCollections(cols)
    } catch { /* */ }
  }

  const loadDocuments = async (collectionId: string) => {
    try {
      const docs = await listDocuments(collectionId)
      setDocuments(docs)
    } catch {
      setDocuments([])
    }
  }

  useEffect(() => { loadCollections() }, [])

  useEffect(() => {
    if (selectedCollectionId) {
      loadDocuments(selectedCollectionId)
    } else {
      setDocuments([])
    }
  }, [selectedCollectionId])

  // ── Collection create/edit ──
  const openCreateModal = () => {
    setEditingCollection(null)
    setFormName('')
    setFormDesc('')
    setFormIcon('📚')
    setShowModal(true)
  }

  const openEditModal = (col: Collection) => {
    setEditingCollection(col)
    setFormName(col.name)
    setFormDesc(col.description)
    setFormIcon(col.icon)
    setShowModal(true)
  }

  const handleSaveCollection = async () => {
    if (!formName.trim()) return
    try {
      if (editingCollection) {
        await updateCollection(editingCollection.id, {
          name: formName.trim(),
          description: formDesc.trim(),
          icon: formIcon,
        })
      } else {
        await createCollection({
          name: formName.trim(),
          description: formDesc.trim(),
          icon: formIcon,
        })
      }
      setShowModal(false)
      await loadCollections()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (detail) {
        alert(detail)
      } else if (err?.message) {
        // Network error (e.g. "Network Error", "connect ECONNREFUSED")
        console.error('API call failed:', err.message, err)
        alert('保存失败：无法连接到后端服务，请确认后端已启动（http://localhost:8000）')
      } else {
        console.error('API call failed:', err)
        alert('保存失败：未知错误，请查看浏览器控制台')
      }
    }
  }

  const handleArchiveCollection = async () => {
    if (!archiveTarget) return
    try {
      await archiveCollection(archiveTarget.id, keepConversations)
      if (selectedCollectionId === archiveTarget.id) setSelectedCollectionId(null)
      setArchiveTarget(null)
      await loadCollections()
    } catch (err: any) {
      alert(err?.response?.data?.detail || '归档失败')
    }
  }

  // ── Upload with progress ──
  const processUploads = useCallback(async (files: FileList | File[]) => {
    if (!selectedCollectionId || files.length === 0) return

    const items: UploadItem[] = Array.from(files).map(f => ({
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      progress: 0,
      status: 'uploading' as const,
    }))
    setUploadQueue(prev => [...prev, ...items])
    setUploading(true)

    // Process files sequentially
    for (const item of items) {
      try {
        // Upload phase: 0-80%
        setUploadQueue(prev => prev.map(u =>
          u.id === item.id ? { ...u, status: 'uploading', progress: 0 } : u
        ))

        await uploadDocumentWithProgress(
          selectedCollectionId,
          item.file,
          (percent) => {
            // Map upload progress to 0-80%, then simulate 80-100% for processing
            setUploadQueue(prev => prev.map(u =>
              u.id === item.id ? { ...u, progress: Math.min(percent * 0.8, 80) } : u
            ))
          },
        )

        // Done
        setUploadQueue(prev => prev.map(u =>
          u.id === item.id ? { ...u, status: 'done', progress: 100 } : u
        ))
      } catch (err: any) {
        setUploadQueue(prev => prev.map(u =>
          u.id === item.id
            ? { ...u, status: 'error', error: err?.response?.data?.detail || '上传失败' }
            : u
        ))
      }
    }

    // Refresh documents and collections after all uploads
    await loadDocuments(selectedCollectionId)
    await loadCollections()

    // Clear completed uploads after a delay
    setTimeout(() => {
      setUploadQueue(prev => prev.filter(u => u.status === 'uploading'))
      setUploading(false)
    }, 1500)
  }, [selectedCollectionId])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processUploads(e.target.files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Drag & Drop ──
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      processUploads(files)
    }
  }

  const handleArchiveDocument = async (doc: Document) => {
    if (!confirm(`确定归档「${doc.filename}」？归档后可从回收站恢复。`)) return
    await archiveDocument(doc.id)
    await loadDocuments(selectedCollectionId!)
    await loadCollections()
  }


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto px-4 lg:px-8 py-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Database size={24} className="text-[var(--accent-blue)]" />
            知识库管理
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            创建知识库，上传学习资料，构建你的专属知识体系
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          新建知识库
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Collections list */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider px-1" style={{ color: 'var(--text-muted)' }}>
            知识库列表
          </h2>
          {collections.length === 0 ? (
            <div className="glass-card text-center py-10">
              <HardDrive size={32} className="mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>还没有知识库</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>点击上方按钮创建</p>
            </div>
          ) : (
            <AnimatePresence>
              {collections.map(col => {
                const isSelected = selectedCollectionId === col.id
                return (
                  <motion.div
                    key={col.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => setSelectedCollectionId(col.id)}
                    className="glass-card-hover flex items-center justify-between group"
                    style={{
                      borderColor: isSelected ? 'var(--accent-blue)' : undefined,
                      background: isSelected ? 'rgba(59,130,246,0.08)' : undefined,
                      boxShadow: isSelected ? '0 0 0 1px var(--accent-blue)' : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl">{col.icon}</span>
                      <div className="min-w-0">
                        <h3 className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{col.name}</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {col.document_count} 份文档
                          {col.description && <span className="ml-1">· {col.description}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(col) }}
                        className="btn-ghost p-1"
                        style={{ color: 'var(--text-dim)' }}
                        title="编辑知识库"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setArchiveTarget(col); setKeepConversations(true) }}
                        className="btn-ghost p-1"
                        style={{ color: 'var(--text-dim)' }}
                        title="归档知识库"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Documents */}
        <div className="lg:col-span-2">
          {selectedCollectionId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Upload area with drag-drop */}
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wider px-1" style={{ color: 'var(--text-muted)' }}>
                  文档列表
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadDocuments(selectedCollectionId)}
                    className="btn-ghost p-2"
                    title="刷新"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <label className={`
                    btn-primary cursor-pointer flex items-center gap-2 text-sm
                    ${uploading ? 'opacity-50 pointer-events-none' : ''}
                  `}>
                    {uploading ? (
                      <><Loader2 size={16} className="animate-spin" /> 上传中...</>
                    ) : (
                      <><Upload size={16} /> 上传文档</>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.md,.docx"
                      multiple
                      onChange={handleFileInput}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              {/* Drag-drop zone */}
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="relative rounded-xl border-2 border-dashed transition-all duration-300 p-6 text-center"
                style={{
                  borderColor: isDragging ? 'var(--accent-blue)' : 'var(--border-glass)',
                  background: isDragging ? 'rgba(59,130,246,0.06)' : 'var(--bg-input)',
                }}
              >
                <AnimatePresence>
                  {isDragging && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{
                        background: 'rgba(59,130,246,0.08)',
                        border: '2px solid var(--accent-blue)',
                      }}
                    />
                  )}
                </AnimatePresence>

                <Upload
                  size={28}
                  className="mx-auto mb-2"
                  style={{ color: isDragging ? 'var(--accent-blue)' : 'var(--text-dim)' }}
                />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {isDragging ? '松开鼠标即可上传' : '拖拽文件到此处上传'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                  支持 PDF、TXT、Markdown、DOCX 格式，可多选
                </p>
              </div>

              {/* Upload progress queue */}
              {uploadQueue.length > 0 && (
                <div className="space-y-2">
                  {uploadQueue.map(item => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card py-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {item.status === 'done' ? (
                            <Check size={14} style={{ color: 'rgb(34, 197, 94)' }} />
                          ) : item.status === 'error' ? (
                            <X size={14} style={{ color: 'rgb(239, 68, 68)' }} />
                          ) : (
                            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
                          )}
                          <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                            {item.file.name}
                          </span>
                        </div>
                        <span className="text-xs flex-shrink-0" style={{
                          color: item.status === 'error' ? 'rgb(239, 68, 68)'
                            : item.status === 'done' ? 'rgb(34, 197, 94)'
                            : 'var(--text-muted)',
                        }}>
                          {item.status === 'error' ? item.error
                            : item.status === 'done' ? '完成'
                            : `${Math.round(item.progress)}%`}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background: item.status === 'error'
                              ? 'rgb(239, 68, 68)'
                              : item.status === 'done'
                                ? 'rgb(34, 197, 94)'
                                : 'var(--accent-blue)',
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${item.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Document list */}
              {documents.length === 0 && uploadQueue.length === 0 ? (
                <div className="glass-card text-center py-16">
                  <Upload size={36} className="mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>还没有文档，上传第一份学习资料吧</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <motion.div
                      key={doc.id}
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card flex items-center justify-between group"
                    >
                      <div
                        className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                        onClick={() => doc.status === 'ready' && setPreviewDocId(doc.id)}
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                             style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
                          <FileText size={18} style={{ color: 'var(--text-secondary)' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{doc.filename}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {formatSize(doc.file_size)} · {doc.chunk_count} 片段 · {doc.file_type.toUpperCase()}
                            {doc.status === 'error' && (
                              <span className="text-red-400 ml-1">
                                · 错误: {doc.error_message}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.status === 'processing' && (
                          <Loader2 size={16} className="animate-spin text-[var(--accent-blue)]" />
                        )}
                        {doc.status === 'ready' && (
                          <>
                            <button
                              onClick={() => setPreviewDocId(doc.id)}
                              className="btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-all"
                              style={{ color: 'var(--text-dim)' }}
                              title="预览文档"
                            >
                              <Eye size={16} />
                            </button>
                            <a
                              href={getDocumentFileUrl(doc.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-all inline-flex"
                              style={{ color: 'var(--accent-blue)' }}
                              title="查看原文件"
                            >
                              <ExternalLink size={14} />
                            </a>
                            <span className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: 'rgba(34,211,238,0.1)', color: 'var(--accent-cyan)' }}>
                              就绪
                            </span>
                          </>
                        )}
                        <button
                          onClick={() => handleArchiveDocument(doc)}
                          className="btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-all"
                          style={{ color: 'var(--text-dim)' }}
                          title="归档文档"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Create / Edit Collection Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-panel p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-serif font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {editingCollection ? '编辑知识库' : '新建知识库'}
                </h3>
                <button onClick={() => setShowModal(false)} className="btn-ghost p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Icon picker */}
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>图标</label>
                  <IconPicker value={formIcon} onChange={setFormIcon} />
                </div>

                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>名称</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例如：操作系统笔记"
                    className="input-field"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveCollection()}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>描述（选填）</label>
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="简单描述这个知识库的内容..."
                    rows={3}
                    className="input-field resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 justify-end">
                <button onClick={() => setShowModal(false)} className="btn-secondary">
                  取消
                </button>
                <button onClick={handleSaveCollection} className="btn-primary">
                  {editingCollection ? '保存' : '创建'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Archive Collection Confirmation Modal */}
      <AnimatePresence>
        {archiveTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setArchiveTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-panel p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <AlertTriangle size={20} className="text-[var(--accent-gold)]" />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>归档知识库</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    归档后可从回收站恢复
                  </p>
                </div>
              </div>

              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                确定要归档 <strong style={{ color: 'var(--text-primary)' }}>「{archiveTarget.name}」</strong> 吗？
                知识库及其文档将被移至回收站。
              </p>

              {/* Keep conversations checkbox */}
              <label className="flex items-center gap-3 mb-6 p-3 rounded-lg cursor-pointer transition-all duration-200"
                     style={{
                       background: keepConversations ? 'rgba(59,130,246,0.08)' : 'var(--bg-input)',
                       border: keepConversations ? '1px solid rgba(59,130,246,0.25)' : '1px solid var(--border-glass)',
                     }}>
                <input
                  type="checkbox"
                  checked={keepConversations}
                  onChange={(e) => setKeepConversations(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--accent-blue)]"
                />
                <div>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    保留相关对话记录
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    勾选后，对话可在聊天页查看历史记录，但无法继续对话
                  </p>
                </div>
              </label>

              <div className="flex gap-3 justify-end">
                <button onClick={() => setArchiveTarget(null)} className="btn-secondary">
                  取消
                </button>
                <button onClick={handleArchiveCollection} className="btn-primary">
                  归档知识库
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Preview Modal */}
      <AnimatePresence>
        {previewDocId && (
          <DocumentPreviewModal
            docId={previewDocId}
            onClose={() => setPreviewDocId(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
