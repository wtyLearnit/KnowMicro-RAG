/**
 * DayColumn — single day column with events and free slots.
 */
import { useMemo } from 'react'
import { isSameDay, isToday as checkIsToday } from 'date-fns'
import { EventBlock } from './EventBlock'
import { CurrentTimeLine } from './CurrentTimeLine'
import type { CalendarEvent } from '../../types'

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

  return (
    <div
      className="flex-1 relative border-l cursor-pointer"
      style={{
        borderColor: 'var(--border-glass)',
        height: totalHeight,
        background: today ? 'rgba(59,130,246,0.02)' : 'transparent',
      }}
      onClick={handleSlotClick}
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
