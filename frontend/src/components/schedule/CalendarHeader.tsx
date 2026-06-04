/**
 * CalendarHeader — month navigation, today button, view toggle, course toggle.
 */
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, Plus, BookOpen, CalendarDays,
  Calendar as CalendarIcon, GraduationCap,
} from 'lucide-react'
import type { CalendarView } from '../../pages/CalendarPage'

interface CalendarHeaderProps {
  currentDate: Date
  view: CalendarView
  showCourses: boolean
  onViewChange: (view: CalendarView) => void
  onNavigate: (dir: 'prev' | 'next' | 'today') => void
  onToggleCourses: () => void
  onOpenCourseManager: () => void
  onCreateTask: () => void
}

export function CalendarHeader({
  currentDate, view, showCourses,
  onViewChange, onNavigate, onToggleCourses, onOpenCourseManager, onCreateTask,
}: CalendarHeaderProps) {
  const title = view === 'week'
    ? format(currentDate, 'yyyy年 M月', { locale: zhCN })
    : format(currentDate, 'yyyy年 M月', { locale: zhCN })

  return (
    <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b shrink-0"
         style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-sidebar)' }}>
      {/* Left: navigation */}
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-serif font-semibold mr-3 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}>
          <CalendarDays size={20} className="text-[var(--accent-blue)]" />
          {title}
        </h2>
        <button onClick={() => onNavigate('prev')} className="btn-ghost p-1.5"
                title="上一${view === 'week' ? '周' : '月'}">
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => onNavigate('today')}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-secondary)',
                }}>
          今天
        </button>
        <button onClick={() => onNavigate('next')} className="btn-ghost p-1.5"
                title="下一${view === 'week' ? '周' : '月'}">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        {/* Course toggle */}
        <button
          onClick={onToggleCourses}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
          style={{
            background: showCourses ? 'rgba(59,130,246,0.12)' : 'var(--bg-input)',
            border: showCourses ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border-glass)',
            color: showCourses ? 'var(--accent-blue)' : 'var(--text-muted)',
          }}
          title={showCourses ? '隐藏课表' : '显示课表'}
        >
          <BookOpen size={14} />
          课表
        </button>

        {/* Course manager */}
        <button onClick={onOpenCourseManager} className="btn-ghost p-1.5" title="管理课表">
          <GraduationCap size={18} />
        </button>

        {/* View toggle */}
        <div className="flex rounded-lg p-0.5"
             style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
          {(['week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
              style={{
                background: view === v ? 'var(--accent-blue)' : 'transparent',
                color: view === v ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {v === 'week' ? '周' : '月'}
            </button>
          ))}
        </div>

        {/* Add task */}
        <button onClick={onCreateTask} className="btn-primary !py-1.5 !px-3 text-xs">
          <Plus size={14} />
          任务
        </button>
      </div>
    </div>
  )
}
