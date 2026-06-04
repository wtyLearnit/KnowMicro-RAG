/* 苏格拉底之窗 - Calendar Page */
import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addWeeks, subWeeks, addMonths, subMonths,
  format, isToday, isSameDay,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  getCalendarEvents, listScheduleTasks, listCourses,
} from '../services/api'
import type { CalendarEvent, ScheduleTask, Course } from '../types'
import { CalendarHeader } from '../components/schedule/CalendarHeader'
import { WeekView } from '../components/schedule/WeekView'
import { MonthView } from '../components/schedule/MonthView'
import { TaskPanel } from '../components/schedule/TaskPanel'
import { TaskModal } from '../components/schedule/TaskModal'
import { EventModal } from '../components/schedule/EventModal'
import { CourseManagerModal } from '../components/schedule/CourseManagerModal'

export type CalendarView = 'week' | 'month'

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<CalendarView>('week')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<ScheduleTask[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<ScheduleTask | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [eventModalDefaults, setEventModalDefaults] = useState<{ date: Date; hour: number } | null>(null)
  const [showCourseManager, setShowCourseManager] = useState(false)

  // Course visibility toggle
  const [showCourses, setShowCourses] = useState(() => {
    return localStorage.getItem('showCourses') !== 'false'
  })

  // Drag state — shared between TaskPanel and WeekView/DayColumn
  const [draggingTask, setDraggingTask] = useState<ScheduleTask | null>(null)

  // Calculate date range based on view
  const dateRange = view === 'week'
    ? { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) }
    : { start: startOfMonth(currentDate), end: endOfMonth(currentDate) }

  const fetchGenRef = useRef(0)

  const fetchData = useCallback(async () => {
    const gen = ++fetchGenRef.current
    setLoading(true)
    try {
      const start = dateRange.start.toISOString()
      const end = dateRange.end.toISOString()
      const [evts, tsks, cors] = await Promise.all([
        getCalendarEvents(start, end),
        listScheduleTasks(),
        listCourses(),
      ])
      // Ignore stale responses (e.g. if a delete happened while fetching)
      if (gen !== fetchGenRef.current) return
      setEvents(evts)
      setTasks(tsks)
      setCourses(cors)
    } catch (err) {
      if (gen === fetchGenRef.current) {
        console.error('Failed to load calendar data:', err)
      }
    }
    if (gen === fetchGenRef.current) setLoading(false)
  }, [dateRange.start, dateRange.end])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    localStorage.setItem('showCourses', String(showCourses))
  }, [showCourses])

  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date())
    } else if (view === 'week') {
      setCurrentDate(d => direction === 'next' ? addWeeks(d, 1) : subWeeks(d, 1))
    } else {
      setCurrentDate(d => direction === 'next' ? addMonths(d, 1) : subMonths(d, 1))
    }
  }

  const handleSlotClick = (date: Date, hour: number) => {
    setEventModalDefaults({ date, hour })
    setEditingEvent(null)
    setShowEventModal(true)
  }

  const handleEventClick = (event: CalendarEvent) => {
    if (event.is_virtual) return // Can't edit virtual course events
    setEditingEvent(event)
    setEventModalDefaults(null)
    setShowEventModal(true)
  }

  const handleTaskCreated = () => {
    setShowTaskModal(false)
    setEditingTask(null)
    fetchData()
  }

  const handleEventSaved = () => {
    setShowEventModal(false)
    setEditingEvent(null)
    setEventModalDefaults(null)
    fetchData()
  }

  const handleCoursesChanged = () => {
    fetchData()
  }

  // Filter events based on course visibility
  const visibleEvents = showCourses
    ? events
    : events.filter(e => e.event_type !== 'course')

  const pendingTasks = tasks.filter(t => t.status === 'pending')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[calc(100vh-3.5rem)] flex flex-col"
    >
      {/* Header */}
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        showCourses={showCourses}
        onViewChange={setView}
        onNavigate={handleNavigate}
        onToggleCourses={() => setShowCourses(v => !v)}
        onOpenCourseManager={() => setShowCourseManager(true)}
        onCreateTask={() => { setEditingTask(null); setShowTaskModal(true) }}
      />

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Calendar area */}
        <div className="flex-1 min-w-0 overflow-auto">
          {view === 'week' ? (
            <WeekView
              currentDate={currentDate}
              events={visibleEvents}
              courses={courses}
              showCourses={showCourses}
              draggingTask={draggingTask}
              onSlotClick={handleSlotClick}
              onEventClick={handleEventClick}
              onEventMoved={fetchData}
            />
          ) : (
            <MonthView
              currentDate={currentDate}
              events={visibleEvents}
              onDateClick={(date) => { setCurrentDate(date); setView('week') }}
            />
          )}
        </div>

        {/* Task panel */}
        <TaskPanel
          tasks={pendingTasks}
          allTasks={tasks}
          onEditTask={(task) => { setEditingTask(task); setShowTaskModal(true) }}
          onCreateTask={() => { setEditingTask(null); setShowTaskModal(true) }}
          onTaskMoved={fetchData}
          onDragStart={(task) => setDraggingTask(task)}
          onDragEnd={() => setDraggingTask(null)}
        />
      </div>

      {/* Modals */}
      {showTaskModal && (
        <TaskModal
          task={editingTask}
          onClose={() => { setShowTaskModal(false); setEditingTask(null) }}
          onSaved={handleTaskCreated}
        />
      )}

      {showEventModal && (
        <EventModal
          event={editingEvent}
          defaultDate={eventModalDefaults?.date}
          defaultHour={eventModalDefaults?.hour}
          onClose={() => { setShowEventModal(false); setEditingEvent(null); setEventModalDefaults(null) }}
          onSaved={handleEventSaved}
        />
      )}

      {showCourseManager && (
        <CourseManagerModal
          courses={courses}
          onClose={() => setShowCourseManager(false)}
          onChanged={handleCoursesChanged}
        />
      )}
    </motion.div>
  )
}
