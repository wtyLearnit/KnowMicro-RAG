/* 苏格拉底之窗 - Trash Page (回收站) */
import { useEffect, useState } from 'react'
import { formatSize, formatDate } from '../utils/format'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2, RotateCcw, Database, FileText, MessageSquare,
  Loader2, AlertTriangle,
} from 'lucide-react'
import {
  getTrash,
  permanentDeleteCollection, permanentDeleteDocument, permanentDeleteConversation,
  restoreCollection, restoreDocument, restoreConversation,
} from '../services/api'
import type { TrashData, TrashCollection, TrashDocument, TrashConversation } from '../types'

export function TrashPage() {
  const [trash, setTrash] = useState<TrashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'collection' | 'document' | 'conversation'
    id: string
    name: string
  } | null>(null)

  const loadTrash = async () => {
    setLoading(true)
    try {
      const data = await getTrash()
      setTrash(data)
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { loadTrash() }, [])

  const handlePermanentDelete = async () => {
    if (!confirmDelete) return
    setActionLoading(confirmDelete.id)
    try {
      if (confirmDelete.type === 'collection') {
        await permanentDeleteCollection(confirmDelete.id)
      } else if (confirmDelete.type === 'document') {
        await permanentDeleteDocument(confirmDelete.id)
      } else {
        await permanentDeleteConversation(confirmDelete.id)
      }
      setConfirmDelete(null)
      await loadTrash()
    } catch { /* */ }
    setActionLoading(null)
  }

  const handleRestore = async (type: string, id: string) => {
    setActionLoading(id)
    try {
      if (type === 'collection') await restoreCollection(id)
      else if (type === 'document') await restoreDocument(id)
      else await restoreConversation(id)
      await loadTrash()
    } catch { /* */ }
    setActionLoading(null)
  }

  const isEmpty = !trash || (
    trash.collections.length === 0 &&
    trash.documents.length === 0 &&
    trash.conversations.length === 0
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-4 lg:px-8 py-6 space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Trash2 size={24} className="text-[var(--accent-blue)]" />
          回收站
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          已归档的内容会保留 30 天，之后自动清理。恢复后内容将回到原位置。
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
        </div>
      ) : isEmpty ? (
        <div className="glass-card text-center py-20">
          <Trash2 size={48} className="mx-auto mb-4" style={{ color: 'var(--text-dim)' }} />
          <p className="text-lg font-serif" style={{ color: 'var(--text-secondary)' }}>
            回收站是空的
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            删除的知识库和文档会出现在这里
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Archived Collections */}
          {trash!.collections.length > 0 && (
            <div>
              <h2 className="text-sm font-medium flex items-center gap-2 mb-3" style={{ color: 'var(--text-secondary)' }}>
                <Database size={16} className="text-[var(--accent-blue)]" />
                已归档的知识库 ({trash!.collections.length})
              </h2>
              <div className="space-y-2">
                <AnimatePresence>
                  {trash!.collections.map(col => (
                    <TrashCollectionItem
                      key={col.id}
                      item={col}
                      actionLoading={actionLoading}
                      onRestore={() => handleRestore('collection', col.id)}
                      onDelete={() => setConfirmDelete({ type: 'collection', id: col.id, name: col.name })}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Archived Documents */}
          {trash!.documents.length > 0 && (
            <div>
              <h2 className="text-sm font-medium flex items-center gap-2 mb-3" style={{ color: 'var(--text-secondary)' }}>
                <FileText size={16} className="text-[var(--accent-cyan)]" />
                已归档的文档 ({trash!.documents.length})
              </h2>
              <div className="space-y-2">
                <AnimatePresence>
                  {trash!.documents.map(doc => (
                    <TrashDocumentItem
                      key={doc.id}
                      item={doc}
                      actionLoading={actionLoading}
                      onRestore={() => handleRestore('document', doc.id)}
                      onDelete={() => setConfirmDelete({ type: 'document', id: doc.id, name: doc.filename })}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Archived Conversations */}
          {trash!.conversations.length > 0 && (
            <div>
              <h2 className="text-sm font-medium flex items-center gap-2 mb-3" style={{ color: 'var(--text-secondary)' }}>
                <MessageSquare size={16} className="text-[var(--accent-purple)]" />
                已归档的对话 ({trash!.conversations.length})
              </h2>
              <div className="space-y-2">
                <AnimatePresence>
                  {trash!.conversations.map(conv => (
                    <TrashConversationItem
                      key={conv.id}
                      item={conv}
                      actionLoading={actionLoading}
                      onRestore={() => handleRestore('conversation', conv.id)}
                      onDelete={() => setConfirmDelete({ type: 'conversation', id: conv.id, name: conv.title })}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm Permanent Delete Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-panel p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                     style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>永久删除</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>此操作不可撤销</p>
                </div>
              </div>

              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                确定要永久删除 <strong style={{ color: 'var(--text-primary)' }}>「{confirmDelete.name}」</strong> 吗？
                所有关联数据将被彻底清除，无法恢复。
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="btn-secondary"
                  disabled={!!actionLoading}
                >
                  取消
                </button>
                <button
                  onClick={handlePermanentDelete}
                  disabled={!!actionLoading}
                  className="px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all duration-200"
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'rgb(252, 165, 165)',
                  }}
                >
                  {actionLoading === confirmDelete.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  永久删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ── Sub-components ──────────────────────────── */

function TrashCollectionItem({
  item, actionLoading, onRestore, onDelete,
}: {
  item: TrashCollection
  actionLoading: string | null
  onRestore: () => void
  onDelete: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="glass-card flex items-center justify-between group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl">{item.icon}</span>
        <div className="min-w-0">
          <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {item.document_count} 份文档 · {item.conversation_count} 个对话
            {item.archived_at && <span> · 归档于 {new Date(item.archived_at).toLocaleDateString('zh-CN')}</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onRestore}
          disabled={!!actionLoading}
          className="btn-ghost p-2"
          style={{ color: 'var(--text-dim)' }}
          title="恢复"
        >
          {actionLoading === item.id ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RotateCcw size={16} />
          )}
        </button>
        <button
          onClick={onDelete}
          disabled={!!actionLoading}
          className="btn-ghost p-2"
          style={{ color: 'var(--text-dim)' }}
          title="永久删除"
          onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(239, 68, 68)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  )
}

function TrashDocumentItem({
  item, actionLoading, onRestore, onDelete,
}: {
  item: TrashDocument
  actionLoading: string | null
  onRestore: () => void
  onDelete: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="glass-card flex items-center justify-between group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
          <FileText size={18} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.filename}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {item.collection_name} · {item.file_type.toUpperCase()}
            {item.archived_at && <span> · 归档于 {new Date(item.archived_at).toLocaleDateString('zh-CN')}</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onRestore}
          disabled={!!actionLoading}
          className="btn-ghost p-2"
          style={{ color: 'var(--text-dim)' }}
          title="恢复"
        >
          {actionLoading === item.id ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RotateCcw size={16} />
          )}
        </button>
        <button
          onClick={onDelete}
          disabled={!!actionLoading}
          className="btn-ghost p-2"
          style={{ color: 'var(--text-dim)' }}
          title="永久删除"
          onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(239, 68, 68)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  )
}

function TrashConversationItem({
  item, actionLoading, onRestore, onDelete,
}: {
  item: TrashConversation
  actionLoading: string | null
  onRestore: () => void
  onDelete: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="glass-card flex items-center justify-between group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
          <MessageSquare size={18} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {item.collection_name} · {item.message_count} 条消息
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onRestore}
          disabled={!!actionLoading}
          className="btn-ghost p-2"
          style={{ color: 'var(--text-dim)' }}
          title="恢复"
        >
          {actionLoading === item.id ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RotateCcw size={16} />
          )}
        </button>
        <button
          onClick={onDelete}
          disabled={!!actionLoading}
          className="btn-ghost p-2"
          style={{ color: 'var(--text-dim)' }}
          title="永久删除"
          onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(239, 68, 68)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  )
}
