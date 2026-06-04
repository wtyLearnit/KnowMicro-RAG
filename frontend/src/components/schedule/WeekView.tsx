/**
 * WeekView — vertical time axis + 7 day columns with events.
 */
import { useMemo } from 'react'
import { startOfWeek, addDays, format, isToday } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { TimeAxis } from './TimeAxis'
import { DayColumn } from './DayColumn'
import type { CalendarEvent, Course } from '../../types'

const HOUR_START = 8
const HOUR_END = 22
const HOUR_COUNT = HOUR_END - HOUR_START
const HOUR_HEIGHT = 64 // px per hour

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  courses: Course[]
  showCourses: boolean
  onSlotClick: (date: Date, hour: number) => void
  onEventClick: (event: CalendarEvent) => void
  onEventMoved: () => void
}

export function WeekView({
  currentDate, events, courses, showCourses,
  onSlotClick, onEventClick, onEventMoved,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const dayNames = ['一', '二', '三', '四', '五', '六', '日']
  const totalHeight = HOUR_COUNT * HOUR_HEIGHT

  return (
    <div className="h-full flex flex-col">
      {/* Day headers */}
      <div className="flex shrink-0 border-b" style={{ borderColor: 'var(--border-glass)' }}>
        {/* Time axis header spacer */}
        <div className="w-14 shrink-0" />

        {days.map((day, i) => {
          const today = isToday(day)
          return (
            <div
              key={i}
              className="flex-1 py-2 px-1 text-center border-l"
              style={{ borderColor: 'var(--border-glass)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                周{dayNames[i]}
              </div>
              <div
                className={`text-lg font-serif font-semibold mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full ${
                  today ? 'text-white' : ''
                }`}
                style={{
                  color: today ? '#fff' : 'var(--text-primary)',
                  background: today ? 'var(--accent-blue)' : 'transparent',
                }}
              >
                {format(day, 'd')}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="flex flex-1 overflow-y-auto overflow-x-hidden">
        {/* Time axis */}
        <TimeAxis hourStart={HOUR_START} hourEnd={HOUR_END} hourHeight={HOUR_HEIGHT} />

        {/* Day columns */}
        <div className="flex-1 flex">
          {days.map((day, i) => (
            <DayColumn
              key={i}
              date={day}
              events={events}
              hourStart={HOUR_START}
              hourEnd={HOUR_END}
              hourHeight={HOUR_HEIGHT}
              onSlotClick={onSlotClick}
              onEventClick={onEventClick}
              onEventMoved={onEventMoved}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export { HOUR_START, HOUR_END, HOUR_HEIGHT }
