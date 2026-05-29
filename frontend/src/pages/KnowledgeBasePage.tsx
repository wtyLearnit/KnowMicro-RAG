/* 柏拉图之窗 - Knowledge Base Management Page */
import { useEffect, useState, useRef } from 'react'
import {
  Plus, Upload, Trash2, FileText, Search,
  X, Loader2, RefreshCw,
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
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-parchment-100">知识库管理</h1>
          <p className="text-parchment-500 text-sm mt-1">
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
          <h2 className="text-sm font-medium text-parchment-400 uppercase tracking-wider">
            知识库列表
          </h2>
          {collections.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-parchment-500">还没有知识库，点击上方按钮创建</p>
            </div>
          ) : (
            collections.map(col => (
              <div
                key={col.id}
                onClick={() => setSelectedCollectionId(col.id)}
                className={`
                  card-hover flex items-center justify-between
                  ${selectedCollectionId === col.id ? 'ring-2 ring-parchment-400/50 border-parchment-400/50' : ''}
                `}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">{col.icon}</span>
                  <div className="min-w-0">
                    <h3 className="font-medium text-parchment-100 truncate">{col.name}</h3>
                    <p className="text-xs text-parchment-500">{col.document_count} 份文档</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCollection(col.id, col.name) }}
                  className="btn-ghost text-parchment-600 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Documents */}
        <div className="lg:col-span-2">
          {!selectedCollectionId ? (
            <div className="card text-center py-16">
              <FileText size={48} className="mx-auto mb-4 text-parchment-600" />
              <p className="text-parchment-400">选择一个知识库查看文档</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Upload area */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-parchment-400 uppercase tracking-wider">
                  文档列表
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadDocuments(selectedCollectionId)}
                    className="btn-ghost"
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

              <p className="text-xs text-parchment-600">
                支持 PDF、TXT、Markdown、DOCX 格式，单文件上限 50 MB
              </p>

              {documents.length === 0 ? (
                <div className="card text-center py-12">
                  <Upload size={36} className="mx-auto mb-3 text-parchment-600" />
                  <p className="text-parchment-400">还没有文档，上传第一份学习资料吧</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div
                      key={doc.id}
                      className="card flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText size={20} className="text-parchment-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-parchment-100 text-sm truncate">{doc.filename}</p>
                          <p className="text-xs text-parchment-500">
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
                          <Loader2 size={16} className="animate-spin text-parchment-400" />
                        )}
                        <button
                          onClick={() => handleDeleteDocument(doc)}
                          className="btn-ghost text-parchment-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-academia-800 border border-parchment-700/50 rounded-2xl p-6 w-full max-w-md animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-serif font-semibold text-parchment-100">
                新建知识库
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="btn-ghost">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-parchment-400 mb-1.5">名称</label>
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
                <label className="block text-sm text-parchment-400 mb-1.5">描述（选填）</label>
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
          </div>
        </div>
      )}
    </div>
  )
}
