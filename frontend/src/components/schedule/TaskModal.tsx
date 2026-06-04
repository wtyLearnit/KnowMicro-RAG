/**
 * TaskModal — create/edit task modal.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import { createScheduleTask, updateScheduleTask } from '../../services/api'
import type { ScheduleTask } from '../../types'

interface TaskModalProps {
  task: ScheduleTask | null
  onClose: () => void
  onSaved: () => void
}

export function TaskModal({ task, onClose, onSaved }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [estimatedMinutes, setEstimatedMinutes] = useState(task?.estimated_minutes ?? 60)
  const [priority, setPriority] = useState(task?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      if (task) {
        await updateScheduleTask(task.id, {
          title: title.trim(), description, estimated_minutes: estimatedMinutes,
          priority, due_date: dueDate || undefined,
        })
      } else {
        await createScheduleTask({
          title: title.trim(), description, estimated_minutes: estimatedMinutes,
          priority, due_date: dueDate || undefined,
        })
      }
      onSaved()
    } catch (err) {
      console.error('Save task failed:', err)
    }
    setSaving(false)
  }

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
        className="glass-panel p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-serif font-semibold" style={{ color: 'var(--text-primary)' }}>
            {task ? '编辑任务' : '新建任务'}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>标题</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                   placeholder="例如：完成线性代数作业" className="input-field" autoFocus />
          </div>

          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>描述（选填）</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
                      rows={2} className="input-field resize-none" placeholder="详细描述..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>预估耗时（分钟）</label>
              <input type="number" value={estimatedMinutes}
                     onChange={e => setEstimatedMinutes(Number(e.target.value))}
                     min={5} max={480} className="input-field" />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>优先级</label>
              <div className="flex gap-1.5">
                {(['low', 'medium', 'high'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200"
                    style={{
                      background: priority === p
                        ? p === 'high' ? 'rgba(239,68,68,0.15)' : p === 'medium' ? 'rgba(251,191,36,0.15)' : 'rgba(34,211,238,0.15)'
                        : 'var(--bg-input)',
                      border: priority === p
                        ? `1px solid ${p === 'high' ? 'rgba(239,68,68,0.4)' : p === 'medium' ? 'rgba(251,191,36,0.4)' : 'rgba(34,211,238,0.4)'}`
                        : '1px solid var(--border-glass)',
                      color: priority === p
                        ? p === 'high' ? 'rgb(239,68,68)' : p === 'medium' ? 'var(--accent-gold)' : 'var(--accent-cyan)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {p === 'high' ? '高' : p === 'medium' ? '中' : '低'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>截止日期（选填）</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-field" />
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="btn-primary">
            {saving ? '保存中...' : task ? '保存' : '创建'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
