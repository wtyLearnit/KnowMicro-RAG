/**
 * DayColumn — single day column with events and free slots.
 */
import { useMemo, useState } from 'react'
import { isSameDay, isToday as checkIsToday } from 'date-fns'
import { EventBlock } from './EventBlock'
import { CurrentTimeLine } from './CurrentTimeLine'
import type { CalendarEvent, ScheduleTask } from '../../types'
import { createScheduleEvent } from '../../services/api'

interface DayColumnProps {
  date: Date
  events: CalendarEvent[]
  hourStart: number
  hourEnd: number
  hourHeight: number
  onSlotClick: (date: Date, hour: number) => void
  onEventClick: (event: CalendarEvent) => void
  onEventMoved: () => void
}

export function DayColumn({
  date, events, hourStart, hourEnd, hourHeight,
  onSlotClick, onEventClick, onEventMoved,
}: DayColumnProps) {
  const hourCount = hourEnd - hourStart
  const totalHeight = hourCount * hourHeight
  const today = checkIsToday(date)
  const [isDragOver, setIsDragOver] = useState(false)

  // Filter events for this day
  const dayEvents = useMemo(() => {
    return events.filter(e => {
      const eventDate = new Date(e.start_time)
      return isSameDay(eventDate, date)
    })
  }, [events, date])

  const handleSlotClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const hour = hourStart + y / hourHeight
    const snappedHour = Math.floor(hour * 2) / 2 // Snap to 30min
    onSlotClick(date, snappedHour)
  }

  // ── Drag & Drop (task → calendar) ──
  const calcDropHour = (e: React.DragEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const hour = hourStart + y / hourHeight
    return Math.floor(hour * 2) / 2 // Snap to 30min
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)

    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return

    try {
      const data = JSON.parse(raw)
      if (data.type !== 'task' || !data.task) return

      const task: ScheduleTask = data.task
      const dropHour = calcDropHour(e)
      const durationMinutes = task.estimated_minutes || 60

      const start = new Date(date)
      start.setHours(Math.floor(dropHour), (dropHour % 1) * 60, 0, 0)
      const end = new Date(start.getTime() + durationMinutes * 60000)

      await createScheduleEvent({
        title: task.title,
        description: task.description || '',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        event_type: 'task',
        task_id: task.id,
        color: task.priority === 'high' ? '#E85D75' : task.priority === 'medium' ? '#E8A838' : '#4A90D9',
      })

      onEventMoved()
    } catch (err) {
      console.error('Drop failed:', err)
    }
  }

  return (
    <div
      className="flex-1 relative border-l cursor-pointer"
      style={{
        borderColor: 'var(--border-glass)',
        height: totalHeight,
        background: today ? 'rgba(59,130,246,0.02)' : isDragOver ? 'rgba(59,130,246,0.06)' : 'transparent',
      }}
      onClick={handleSlotClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hour grid lines */}
      {Array.from({ length: hourCount }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t"
          style={{
            top: i * hourHeight,
            borderColor: 'var(--border-glass)',
          }}
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

      {/* Events */}
      {dayEvents.map(event => (
        <EventBlock
          key={event.id}
          event={event}
          hourStart={hourStart}
          hourHeight={hourHeight}
          onClick={() => onEventClick(event)}
          onMoved={onEventMoved}
        />
      ))}

      {/* Current time line */}
      {today && <CurrentTimeLine hourStart={hourStart} hourHeight={hourHeight} />}
    </div>
  )
}
