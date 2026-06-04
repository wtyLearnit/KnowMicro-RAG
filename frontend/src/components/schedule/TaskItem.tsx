/**
 * TaskItem — draggable task card in the task panel.
 */
import { useState, useRef } from 'react'
import { Pencil, Trash2, Clock, Flag } from 'lucide-react'
import { deleteScheduleTask } from '../../services/api'
import type { ScheduleTask } from '../../types'

const PRIORITY_COLORS: Record<string, string> = {
  high: 'rgb(239, 68, 68)',
  medium: 'var(--accent-gold)',
  low: 'var(--accent-cyan)',
}

interface TaskItemProps {
  task: ScheduleTask
  onEdit: () => void
  onMoved: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
}

export function TaskItem({ task, onEdit, onMoved, onDragStart, onDragEnd }: TaskItemProps) {
  const [isDragging, setIsDragging] = useState(false)
  const didDragRef = useRef(false)
  const mouseDownRef = useRef<{ x: number; y: number } | null>(null)

  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium

  // ── Drag (card-style sticky-note UX) ──
  const handleDragStart = (e: React.DragEvent) => {
    didDragRef.current = false
    setIsDragging(true)
    onDragStart?.()

    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'task',
      task,
    }))
    e.dataTransfer.effectAllowed = 'copy'

    // Use the element itself as the drag image — the browser snapshots
    // it, so dragging looks like moving the card directly (no ghost).
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    e.dataTransfer.setDragImage(el, e.clientX - rect.left, e.clientY - rect.top)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    onDragEnd?.()
  }

  // ── Click vs Drag detection ──
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownRef.current = { x: e.clientX, y: e.clientY }
    didDragRef.current = false
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseDownRef.current) return
    const dx = Math.abs(e.clientX - mouseDownRef.current.x)
    const dy = Math.abs(e.clientY - mouseDownRef.current.y)
    if (dx > 4 || dy > 4) {
      didDragRef.current = true
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    // Don't open edit if user was dragging or clicking action buttons
    if (didDragRef.current) return
    // Don't open edit if clicking inside an action button
    if ((e.target as HTMLElement).closest('[data-action]')) return
    onEdit()
  }

  // ── Delete ──
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!confirm(`确定删除任务「${task.title}」？`)) return
    try {
      await deleteScheduleTask(task.id)
      onMoved()
    } catch (err) {
      console.error('Delete task failed:', err)
    }
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      className="glass-card p-2.5 cursor-grab active:cursor-grabbing group relative transition-all duration-200"
      style={{
        opacity: isDragging ? 0.4 : 1,
        borderLeft: `3px solid ${priorityColor}`,
      }}
    >
      {/* Priority indicator */}
      <div className="flex items-center gap-2 mb-1">
        <Flag size={10} style={{ color: priorityColor }} />
        <span className="text-[10px] uppercase font-medium" style={{ color: priorityColor }}>
          {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
        </span>
      </div>

      {/* Title */}
      <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        {task.title}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <Clock size={10} />
          {task.estimated_minutes}min
        </div>
        {task.due_date && (
          <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
            截止 {task.due_date}
          </div>
        )}
      </div>

      {/* Actions (hover) — positioned outside overflow, larger click area */}
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          data-action
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEdit() }}
          className="p-1.5 rounded-md transition-colors hover:bg-white/5"
          style={{ color: 'var(--text-dim)' }}
          title="编辑"
        >
          <Pencil size={12} />
        </button>
        <button
          data-action
          onClick={handleDelete}
          className="p-1.5 rounded-md transition-colors hover:bg-red-500/10"
          style={{ color: 'rgb(239,68,68)' }}
          title="删除"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Drag hint */}
      <div className="text-[9px] mt-1 opacity-0 group-hover:opacity-50 transition-opacity"
           style={{ color: 'var(--text-dim)' }}>
        拖到日历安排时间
      </div>
    </div>
  )
}
