/**
 * DayColumn — single day column with events and free slots.
 * Supports drag-and-drop with live time preview.
 */
import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { isSameDay, isToday as checkIsToday, format } from 'date-fns'
import { EventBlock } from './EventBlock'
import { CurrentTimeLine } from './CurrentTimeLine'
import type { CalendarEvent, ScheduleTask } from '../../types'
import { createScheduleEvent, rescheduleEvent } from '../../services/api'

interface DayColumnProps {
  date: Date
  events: CalendarEvent[]
  hourStart: number
  hourEnd: number
  hourHeight: number
  draggingTask: ScheduleTask | null
  onSlotClick: (date: Date, hour: number) => void
  onEventClick: (event: CalendarEvent) => void
  onEventMoved: () => void
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#06B6D4',
}

export function DayColumn({
  date, events, hourStart, hourEnd, hourHeight, draggingTask,
  onSlotClick, onEventClick, onEventMoved,
}: DayColumnProps) {
  const hourCount = hourEnd - hourStart
  const totalHeight = hourCount * hourHeight
  const today = checkIsToday(date)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Drop preview state ──
  const [dropHour, setDropHour] = useState<number | null>(null)
  const dropHourRef = useRef<number | null>(null)

  // Filter events for this day
  const dayEvents = useMemo(() => {
    return events.filter(e => {
      const eventDate = new Date(e.start_time)
      return isSameDay(eventDate, date)
    })
  }, [events, date])

  // ── Click ──
  const didDragRef = useRef(false)
  const mouseDownRef = useRef<{ x: number; y: number } | null>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownRef.current = { x: e.clientX, y: e.clientY }
    didDragRef.current = false
  }

  const handleMouseMoveClick = (e: React.MouseEvent) => {
    if (!mouseDownRef.current) return
    const dx = Math.abs(e.clientX - mouseDownRef.current.x)
    const dy = Math.abs(e.clientY - mouseDownRef.current.y)
    if (dx > 4 || dy > 4) didDragRef.current = true
  }

  const handleClick = (e: React.MouseEvent) => {
    if (didDragRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const hour = hourStart + y / hourHeight
    const snappedHour = Math.floor(hour * 2) / 2
    onSlotClick(date, snappedHour)
  }

  // ── Drag & Drop ──
  const calcDropHour = useCallback((e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const hour = hourStart + y / hourHeight
    return Math.floor(hour * 2) / 2
  }, [hourStart, hourHeight])

  const formatHour = (h: number) => {
    const hh = Math.floor(h)
    const mm = Math.round((h % 1) * 60)
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }

  // Debounce timer for dragLeave — prevents duplicate previews caused by:
  // - boundary overlap between adjacent columns (shared 1px border)
  // - child-element enter/leave (EventBlocks inside DayColumn)
  const dragLeaveTimerRef = useRef<number | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (dragLeaveTimerRef.current !== null) {
        clearTimeout(dragLeaveTimerRef.current)
      }
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // Match dropEffect to the drag source's effectAllowed:
    // - tasks from panel → copy (create new event)
    // - events from timeline → move (reschedule)
    e.dataTransfer.dropEffect = draggingTask ? 'copy' : 'move'

    // Cancel any pending dragLeave clear — a live dragover means
    // we're still actively hovering this column
    if (dragLeaveTimerRef.current !== null) {
      clearTimeout(dragLeaveTimerRef.current)
      dragLeaveTimerRef.current = null
    }

    const hour = calcDropHour(e)
    if (dropHourRef.current !== hour) {
      dropHourRef.current = hour
      setDropHour(hour)
    }
  }, [draggingTask, calcDropHour])

  const handleDragLeave = useCallback((_e: React.DragEvent) => {
    // Debounced clear: wait 60ms before hiding the preview.
    // If dragover fires again on this column within that window
    // (e.g. after leaving a child EventBlock, or at a column
    // boundary where two rects overlap by 1px), the timer is
    // cancelled and the preview stays alive.
    // If the mouse really moved to another column, the new
    // column's dragover will take over and this column fades.
    if (dragLeaveTimerRef.current !== null) {
      clearTimeout(dragLeaveTimerRef.current)
    }
    dragLeaveTimerRef.current = window.setTimeout(() => {
      dropHourRef.current = null
      setDropHour(null)
      dragLeaveTimerRef.current = null
    }, 60)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    // Immediately clear preview — drop succeeded or rejected
    if (dragLeaveTimerRef.current !== null) {
      clearTimeout(dragLeaveTimerRef.current)
      dragLeaveTimerRef.current = null
    }
    const dropH = dropHourRef.current
    dropHourRef.current = null
    setDropHour(null)

    const draggedEventId = document.body.dataset.dragEventId || undefined
    // Clean up event drag metadata
    delete document.body.dataset.dragEventDuration
    delete document.body.dataset.dragEventColor
    delete document.body.dataset.dragEventId

    const raw = e.dataTransfer.getData('application/json')
    if (!raw || dropH === null) return

    try {
      const data = JSON.parse(raw)
      const hour = dropH

      // ── Compute drop time range for conflict check ──
      let dropDurationMin: number
      if (data.type === 'task' && data.task) {
        dropDurationMin = data.task.estimated_minutes || 60
      } else if (data.type === 'event' && data.event) {
        const origS = new Date(data.event.start_time)
        const origE = new Date(data.event.end_time)
        dropDurationMin = (origE.getTime() - origS.getTime()) / 60000
      } else {
        return
      }
      const dropEndH = hour + dropDurationMin / 60

      // ── Conflict check: don't allow overlapping events ──
      const hasOverlap = dayEvents.some(ev => {
        if (draggedEventId && ev.id === draggedEventId) return false
        const s = new Date(ev.start_time)
        const e = new Date(ev.end_time)
        const evStartH = s.getHours() + s.getMinutes() / 60
        const evEndH = e.getHours() + e.getMinutes() / 60
        return hour < evEndH && evStartH < dropEndH
      })

      if (hasOverlap) {
        // Visual feedback: briefly flash the column red, then do nothing
        const col = e.currentTarget as HTMLElement
        col.style.transition = 'none'
        col.style.boxShadow = 'inset 0 0 0 3px rgba(239,68,68,0.5)'
        setTimeout(() => {
          col.style.transition = 'box-shadow 0.4s ease'
          col.style.boxShadow = ''
        }, 150)
        return
      }

      if (data.type === 'task' && data.task) {
        // ── Task → Create new event at drop position ──
        const task: ScheduleTask = data.task
        const durationMinutes = task.estimated_minutes || 60

        // Local time: date is the column's day, hour is the drop position
        const start = new Date(
          date.getFullYear(), date.getMonth(), date.getDate(),
          Math.floor(hour), Math.round((hour % 1) * 60), 0, 0
        )
        const end = new Date(start.getTime() + durationMinutes * 60000)

        await createScheduleEvent({
          title: task.title,
          description: task.description || '',
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          event_type: 'task',
          task_id: task.id,
          color: PRIORITY_COLORS[task.priority] || '#4A90D9',
        })

      } else if (data.type === 'event' && data.event) {
        // ── Event → Move to drop position (supports cross-day) ──
        const evt = data.event
        const origStart = new Date(evt.start_time)
        const origEnd = new Date(evt.end_time)
        const durationMs = origEnd.getTime() - origStart.getTime()

        // New start = drop position on this column's day (local time)
        const newStart = new Date(
          date.getFullYear(), date.getMonth(), date.getDate(),
          Math.floor(hour), Math.round((hour % 1) * 60), 0, 0
        )
        const newEnd = new Date(newStart.getTime() + durationMs)

        await rescheduleEvent(evt.id, newStart.toISOString(), newEnd.toISOString())

      } else {
        return
      }

      onEventMoved()
    } catch (err) {
      console.error('Drop failed:', err)
    }
  }, [date, calcDropHour, onEventMoved, dayEvents])

  // ── Preview block style ──
  // Show preview for both task drags and event drags.
  // Event drag duration is stored on document.body.dataset by EventBlock
  // because custom MIME values are unreadable during dragover.
  const isDragActive = dropHour !== null
  const eventDragMinutes = document.body.dataset.dragEventDuration
  const dragEventId = document.body.dataset.dragEventId
  const previewDuration = draggingTask
    ? (draggingTask.estimated_minutes || 60)
    : (eventDragMinutes ? parseInt(eventDragMinutes) : 60)
  const previewHeight = Math.max((previewDuration / 60) * hourHeight, hourHeight / 2)
  const baseColor = draggingTask
    ? (PRIORITY_COLORS[draggingTask.priority] || '#4A90D9')
    : (document.body.dataset.dragEventColor || '#3B82F6')

  // ── Overlap detection ──
  // Check whether the drop position would collide with an existing event.
  const dropStartH = dropHour ?? 0
  const dropEndH = dropStartH + previewDuration / 60
  const hasConflict = useMemo(() => {
    if (!isDragActive) return false
    return dayEvents.some(ev => {
      // Exclude the event being moved (it's leaving its old slot)
      if (dragEventId && ev.id === dragEventId) return false
      const s = new Date(ev.start_time)
      const e = new Date(ev.end_time)
      const evStartH = s.getHours() + s.getMinutes() / 60
      const evEndH = e.getHours() + e.getMinutes() / 60
      // Two ranges overlap: A_start < B_end && B_start < A_end
      return dropStartH < evEndH && evStartH < dropEndH
    })
  }, [isDragActive, dropStartH, dropEndH, dayEvents, dragEventId])

  const previewColor = hasConflict ? '#EF4444' : baseColor

  return (
    <div
      ref={containerRef}
      className="flex-1 relative border-l select-none"
      style={{
        borderColor: 'var(--border-glass)',
        height: totalHeight,
        background: today ? 'rgba(59,130,246,0.02)' : 'transparent',
        transition: 'background 0.15s ease',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMoveClick}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hour grid lines */}
      {Array.from({ length: hourCount }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t"
          style={{ top: i * hourHeight, borderColor: 'var(--border-glass)' }}
        />
      ))}

      {/* Half-hour grid lines */}
      {Array.from({ length: hourCount }, (_, i) => (
        <div
          key={`half-${i}`}
          className="absolute left-0 right-0 border-t border-dashed"
          style={{
            top: i * hourHeight + hourHeight / 2,
            borderColor: 'var(--border-glass)',
            opacity: 0.4,
          }}
        />
      ))}

      {/* Drop preview indicator — shows where the item will land */}
      {isDragActive && (
        <div
          className={`absolute left-0.5 right-0.5 rounded-lg pointer-events-none flex flex-col justify-center px-2 overflow-hidden ${hasConflict ? 'animate-pulse' : ''}`}
          style={{
            top: (dropHour! - hourStart) * hourHeight + 1,
            height: previewHeight - 2,
            background: hasConflict ? `${previewColor}22` : `${previewColor}18`,
            border: `2px ${hasConflict ? 'solid' : 'dashed'} ${previewColor}${hasConflict ? 'aa' : '80'}`,
            zIndex: 15,
            transition: 'top 0.1s ease',
          }}
        >
          <div className="text-xs font-medium truncate" style={{ color: previewColor }}>
            {hasConflict ? '⚠ 时间段已占用' : draggingTask ? draggingTask.title : '移动到此处'}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: `${previewColor}${hasConflict ? 'cc' : 'aa'}` }}>
            {formatHour(dropHour)} – {formatHour(dropHour + previewDuration / 60)}
          </div>
        </div>
      )}

      {/* Drag-over column highlight */}
      {isDragActive && (
        <div
          className="absolute inset-0 pointer-events-none rounded-sm"
          style={{
            background: hasConflict ? `${previewColor}0d` : `${previewColor}05`,
            boxShadow: `inset 0 0 0 1px ${previewColor}${hasConflict ? '30' : '20'}`,
          }}
        />
      )}

      {/* Events */}
      {dayEvents.map(event => (
        <EventBlock
          key={event.id}
          event={event}
          hourStart={hourStart}
          hourHeight={hourHeight}
          onClick={() => onEventClick(event)}
          onMoved={onEventMoved}
          siblingEvents={dayEvents}
        />
      ))}

      {/* Current time line */}
      {today && <CurrentTimeLine hourStart={hourStart} hourHeight={hourHeight} />}
    </div>
  )
}
