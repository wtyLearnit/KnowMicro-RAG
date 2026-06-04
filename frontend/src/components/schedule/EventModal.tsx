/**
 * EventModal — create/edit event modal.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Trash2 } from 'lucide-react'
import { format, addHours } from 'date-fns'
import { createScheduleEvent, updateScheduleEvent, deleteScheduleEvent } from '../../services/api'
import type { CalendarEvent } from '../../types'

const EVENT_COLORS = ['#4A90D9', '#50C878', '#E8A838', '#E85D75', '#9B59B6', '#1ABC9C', '#E67E22', '#3498DB']

interface EventModalProps {
  event: CalendarEvent | null
  defaultDate?: Date
  defaultHour?: number
  onClose: () => void
  onSaved: () => void
}

export function EventModal({ event, defaultDate, defaultHour, onClose, onSaved }: EventModalProps) {
  const isEdit = !!event

  const getDefaultStart = () => {
    if (event) return format(new Date(event.start_time), "yyyy-MM-dd'T'HH:mm")
    if (defaultDate && defaultHour !== undefined) {
      const d = new Date(defaultDate)
      d.setHours(Math.floor(defaultHour), (defaultHour % 1) * 60, 0, 0)
      return format(d, "yyyy-MM-dd'T'HH:mm")
    }
    return format(new Date(), "yyyy-MM-dd'T'HH:mm")
  }

  const getDefaultEnd = () => {
    if (event) return format(new Date(event.end_time), "yyyy-MM-dd'T'HH:mm")
    if (defaultDate && defaultHour !== undefined) {
      const d = new Date(defaultDate)
      d.setHours(Math.floor(defaultHour) + 1, (defaultHour % 1) * 60, 0, 0)
      return format(d, "yyyy-MM-dd'T'HH:mm")
    }
    return format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm")
  }

  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [startTime, setStartTime] = useState(getDefaultStart())
  const [endTime, setEndTime] = useState(getDefaultEnd())
  const [color, setColor] = useState(event?.color ?? '#4A90D9')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      if (event) {
        await updateScheduleEvent(event.id, {
          title: title.trim(), description,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          color,
        })
      } else {
        await createScheduleEvent({
          title: title.trim(), description,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          event_type: 'custom', color,
        })
      }
      onSaved()
    } catch (err) {
      console.error('Save event failed:', err)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!event) return
    if (!confirm(`确定删除事件「${event.title}」？`)) return
    try {
      await deleteScheduleEvent(event.id)
      onSaved()
    } catch { /* */ }
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
            {isEdit ? '编辑事件' : '新建事件'}
          </h3>
          <div className="flex items-center gap-2">
            {isEdit && (
              <button onClick={handleDelete} className="btn-ghost p-1"
                      style={{ color: 'rgb(239,68,68)' }}>
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={onClose} className="btn-ghost p-1"><X size={20} /></button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>标题</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                   placeholder="事件标题" className="input-field" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>开始时间</label>
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
                     className="input-field" />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>结束时间</label>
              <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)}
                     className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>颜色</label>
            <div className="flex gap-2">
              {EVENT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform duration-150"
                  style={{
                    background: c,
                    boxShadow: color === c ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${c}` : 'none',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>描述（选填）</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
                      rows={2} className="input-field resize-none" placeholder="详细描述..." />
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="btn-primary">
            {saving ? '保存中...' : isEdit ? '保存' : '创建'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
