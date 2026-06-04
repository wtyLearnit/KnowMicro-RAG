/**
 * CurrentTimeLine — red horizontal line marking the current time.
 */
import { useState, useEffect } from 'react'

interface CurrentTimeLineProps {
  hourStart: number
  hourHeight: number
}

export function CurrentTimeLine({ hourStart, hourHeight }: CurrentTimeLineProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

  const hour = now.getHours() + now.getMinutes() / 60
  if (hour < hourStart || hour > hourStart + 24) return null

  const top = (hour - hourStart) * hourHeight

  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="w-2.5 h-2.5 rounded-full -ml-1"
             style={{ background: 'rgb(239, 68, 68)', boxShadow: '0 0 6px rgba(239,68,68,0.5)' }} />
        <div className="flex-1 h-[2px]"
             style={{ background: 'rgb(239, 68, 68)', boxShadow: '0 0 4px rgba(239,68,68,0.3)' }} />
      </div>
    </div>
  )
}
