/**
 * TaskItem — draggable task card in the task panel.
 */
import { useState, useRef } from 'react'
import { Pencil, Trash2, Clock, Flag } from 'lucide-react'
import { deleteScheduleTask, createScheduleEvent } from '../../services/api'
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
}

export function TaskItem({ task, onEdit, onMoved }: TaskItemProps) {
  const [isDragging, setIsDragging] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true)
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'task',
      task,
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`确定删除任务「${task.title}」？`)) return
    try {
      await deleteScheduleTask(task.id)
      onMoved()
    } catch { /* */ }
  }

  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium

  return (
    <div
      ref={elementRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onEdit}
      className="glass-card p-2.5 cursor-grab active:cursor-grabbing group relative overflow-hidden transition-all duration-200"
      style={{
        opacity: isDragging ? 0.5 : 1,
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

      {/* Actions (hover) */}
      <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="p-0.5 rounded transition-colors"
          style={{ color: 'var(--text-dim)' }}
          title="编辑"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={handleDelete}
          className="p-0.5 rounded transition-colors"
          style={{ color: 'var(--text-dim)' }}
          title="删除"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Drag hint */}
      <div className="text-[9px] mt-1 opacity-0 group-hover:opacity-60 transition-opacity"
           style={{ color: 'var(--text-dim)' }}>
        拖到日历安排时间
      </div>
    </div>
  )
}
