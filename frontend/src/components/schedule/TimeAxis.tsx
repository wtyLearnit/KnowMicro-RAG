/**
 * TimeAxis — left column showing hour labels.
 */

interface TimeAxisProps {
  hourStart: number
  hourEnd: number
  hourHeight: number
}

export function TimeAxis({ hourStart, hourEnd, hourHeight }: TimeAxisProps) {
  const hours = Array.from({ length: hourEnd - hourStart }, (_, i) => hourStart + i)

  return (
    <div className="w-14 shrink-0 relative" style={{ height: hours.length * hourHeight }}>
      {hours.map(hour => (
        <div
          key={hour}
          className="absolute left-0 right-0 flex items-start justify-end pr-2"
          style={{ top: (hour - hourStart) * hourHeight - 6 }}
        >
          <span className="text-[11px] font-mono" style={{ color: 'var(--text-dim)' }}>
            {String(hour).padStart(2, '0')}:00
          </span>
        </div>
      ))}
    </div>
  )
}
