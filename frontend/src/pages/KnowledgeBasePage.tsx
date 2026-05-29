/* 苏格拉底之窗 - Knowledge Base Management Page */
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Upload, Trash2, FileText,
  X, Loader2, RefreshCw, Database, HardDrive,
} from 'lucide-react'
import {
  listCollections, createCollection, deleteCollection,
  listDocuments, uploadDocument, deleteDocument,
} from '../services/api'
import type { Collection, Document } from '../types'

export function KnowledgeBasePage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDesc, setNewCollectionDesc] = useState('')
  const [uploading, setUploading] = useState(false)
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

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return
    try {
      await createCollection({
        name: newCollectionName.trim(),
        description: newCollectionDesc.trim(),
        icon: '📚',
      })
      setShowCreateModal(false)
      setNewCollectionName('')
      setNewCollectionDesc('')
      await loadCollections()
    } catch (err: any) {
      alert(err?.response?.data?.detail || '创建失败')
    }
  }

  const handleDeleteCollection = async (id: string, name: string) => {
    if (!confirm(`确定删除知识库「${name}」？所有文档和对话将被永久删除。`)) return
    await deleteCollection(id)
    if (selectedCollectionId === id) setSelectedCollectionId(null)
    await loadCollections()
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedCollectionId) return
    setUploading(true)
    try {
      await uploadDocument(selectedCollectionId, file)
      await loadDocuments(selectedCollectionId)
      await loadCollections()
    } catch (err: any) {
      alert(err?.response?.data?.detail || '上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteDocument = async (doc: Document) => {
    if (!confirm(`确定删除「${doc.filename}」？`)) return
    await deleteDocument(doc.id)
    await loadDocuments(selectedCollectionId!)
    await loadCollections()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
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
                    className="glass-card-hover flex items-center justify-between"
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
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{col.document_count} 份文档</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCollection(col.id, col.name) }}
                      className="btn-ghost p-1"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Documents */}
        <div className="lg:col-span-2">
          {!selectedCollectionId ? (
            <div className="glass-card text-center py-20">
              <FileText size={48} className="mx-auto mb-4" style={{ color: 'var(--text-dim)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>选择一个知识库查看文档</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Upload area */}
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
                      onChange={handleUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              <p className="text-xs px-1" style={{ color: 'var(--text-dim)' }}>
                支持 PDF、TXT、Markdown、DOCX 格式，单文件上限 50 MB
              </p>

              {documents.length === 0 ? (
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
                      <div className="flex items-center gap-3 min-w-0">
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
                          <span className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(34,211,238,0.1)', color: 'var(--accent-cyan)' }}>
                            就绪
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteDocument(doc)}
                          className="btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-all"
                          style={{ color: 'var(--text-dim)' }}
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

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
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
                  新建知识库
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="btn-ghost p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>名称</label>
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="例如：操作系统笔记"
                    className="input-field"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateCollection()}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>描述（选填）</label>
                  <textarea
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    placeholder="简单描述这个知识库的内容..."
                    rows={3}
                    className="input-field resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 justify-end">
                <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  取消
                </button>
                <button onClick={handleCreateCollection} className="btn-primary">
                  创建
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
