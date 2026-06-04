/**
 * TaskPanel — right-side panel showing pending tasks.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, CheckCircle2, ListTodo } from 'lucide-react'
import { TaskItem } from './TaskItem'
import type { ScheduleTask } from '../../types'

interface TaskPanelProps {
  tasks: ScheduleTask[]
  allTasks: ScheduleTask[]
  onEditTask: (task: ScheduleTask) => void
  onCreateTask: () => void
  onTaskMoved: () => void
  onDragStart?: (task: ScheduleTask) => void
  onDragEnd?: () => void
}

export function TaskPanel({ tasks, allTasks, onEditTask, onCreateTask, onTaskMoved, onDragStart, onDragEnd }: TaskPanelProps) {
  const completedTasks = allTasks.filter(t => t.status === 'completed')

  return (
    <div
      className="w-64 lg:w-72 shrink-0 border-l flex flex-col overflow-hidden"
      style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-sidebar)' }}
    >
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between"
           style={{ borderColor: 'var(--border-glass)' }}>
        <h3 className="text-sm font-medium flex items-center gap-2"
            style={{ color: 'var(--text-secondary)' }}>
          <ListTodo size={16} className="text-[var(--accent-blue)]" />
          待安排
          {tasks.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)' }}>
              {tasks.length}
            </span>
          )}
        </h3>
        <button onClick={onCreateTask} className="btn-ghost p-1" title="新建任务">
          <Plus size={16} />
        </button>
      </div>

      {/* Pending tasks */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <AnimatePresence>
          {tasks.map(task => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
            >
              <TaskItem task={task} onEdit={() => onEditTask(task)} onMoved={onTaskMoved}
                        onDragStart={() => onDragStart?.(task)} onDragEnd={() => onDragEnd?.()} />
            </motion.div>
          ))}
        </AnimatePresence>

        {tasks.length === 0 && (
          <div className="text-center py-8">
            <ListTodo size={24} className="mx-auto mb-2" style={{ color: 'var(--text-dim)' }} />
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              暂无待安排任务
            </p>
          </div>
        )}

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-glass)' }}>
            <div className="flex items-center gap-1.5 px-2 mb-2">
              <CheckCircle2 size={12} style={{ color: 'var(--text-dim)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-dim)' }}>
                已完成 ({completedTasks.length})
              </span>
            </div>
            {completedTasks.slice(0, 5).map(task => (
              <div key={task.id} className="px-2 py-1.5 text-xs line-through opacity-50"
                   style={{ color: 'var(--text-muted)' }}>
                {task.title}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border-glass)' }}>
        <button onClick={onCreateTask}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(167,139,250,0.04))',
                  border: '1px solid rgba(59,130,246,0.18)',
                  color: 'var(--accent-blue)',
                }}>
          <Plus size={14} />
          新建任务
        </button>
      </div>
    </div>
  )
}
