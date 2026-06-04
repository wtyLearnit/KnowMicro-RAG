/**
 * MonthView — monthly calendar grid.
 */
import { useMemo } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameDay, isSameMonth, isToday, format,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { CalendarEvent } from '../../types'

interface MonthViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onDateClick: (date: Date) => void
}

export function MonthView({ currentDate, events, onDateClick }: MonthViewProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const result: Date[] = []
    let day = calStart
    while (day <= calEnd) {
      result.push(day)
      day = addDays(day, 1)
    }
    return result
  }, [currentDate])

  const dayNames = ['一', '二', '三', '四', '五', '六', '日']

  return (
    <div className="h-full flex flex-col p-4">
      {/* Day name headers */}
      <div className="grid grid-cols-7 mb-2">
        {dayNames.map(name => (
          <div key={name} className="text-center text-xs font-medium py-2"
               style={{ color: 'var(--text-muted)' }}>
            周{name}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 flex-1 gap-px" style={{ background: 'var(--border-glass)' }}>
        {days.map((day, i) => {
          const isCurrentMonth = isSameMonth(day, currentDate)
          const today = isToday(day)
          const dayEvents = events.filter(e => isSameDay(new Date(e.start_time), day))

          return (
            <div
              key={i}
              className="min-h-[80px] p-1.5 cursor-pointer transition-colors duration-150"
              style={{
                background: isCurrentMonth ? 'var(--bg-card)' : 'var(--bg-input)',
                opacity: isCurrentMonth ? 1 : 0.5,
              }}
              onClick={() => onDateClick(day)}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = isCurrentMonth ? 'var(--bg-card)' : 'var(--bg-input)' }}
            >
              <div className={`text-sm mb-1 ${today ? 'font-bold' : ''}`}
                   style={{
                     color: today ? 'var(--accent-blue)' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-dim)',
                   }}>
                {today ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs"
                        style={{ background: 'var(--accent-blue)' }}>
                    {format(day, 'd')}
                  </span>
                ) : format(day, 'd')}
              </div>

              {/* Event dots/bars */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(evt => (
                  <div
                    key={evt.id}
                    className="text-[10px] truncate px-1 py-0.5 rounded"
                    style={{
                      background: `${evt.color}22`,
                      color: evt.color,
                      borderLeft: `2px solid ${evt.color}`,
                    }}
                  >
                    {evt.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-center" style={{ color: 'var(--text-dim)' }}>
                    +{dayEvents.length - 3} 更多
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
