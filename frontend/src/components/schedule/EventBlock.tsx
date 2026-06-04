/**
 * EventBlock — a single event rendered as a positioned block in the day column.
 */
import { useState, useRef } from 'react'
import { format } from 'date-fns'
import { rescheduleEvent } from '../../services/api'
import type { CalendarEvent } from '../../types'

interface EventBlockProps {
  event: CalendarEvent
  hourStart: number
  hourHeight: number
  onClick: () => void
  onMoved: () => void
}

export function EventBlock({ event, hourStart, hourHeight, onClick, onMoved }: EventBlockProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ y: number; origStart: Date } | null>(null)

  const startDate = new Date(event.start_time)
  const endDate = new Date(event.end_time)

  const startHour = startDate.getHours() + startDate.getMinutes() / 60
  const endHour = endDate.getHours() + endDate.getMinutes() / 60
  const duration = endHour - startHour

  const top = (startHour - hourStart) * hourHeight
  const height = Math.max(duration * hourHeight, hourHeight / 3) // Minimum height

  const isCourse = event.event_type === 'course'
  const isVirtual = event.is_virtual

  // Parse color for background opacity
  const bgColor = event.color || '#4A90D9'
  const bgStyle = isCourse
    ? `${bgColor}22` // Semi-transparent for courses
    : `${bgColor}dd` // More opaque for events

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isDragging) {
      onClick()
    }
  }

  // Simple drag to reschedule (vertical only)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isVirtual) return
    e.stopPropagation()
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { y: e.clientY, origStart: startDate }

    const handleMouseMove = (moveE: MouseEvent) => {
      const deltaY = moveE.clientY - (dragStartRef.current?.y ?? 0)
      // Visual feedback via CSS transform is handled by the browser
    }

    const handleMouseUp = async (upE: MouseEvent) => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      if (!dragStartRef.current) return
      const deltaY = upE.clientY - dragStartRef.current.y
      const deltaMinutes = Math.round((deltaY / hourHeight) * 60 / 15) * 15 // Snap to 15min

      if (Math.abs(deltaMinutes) < 15) {
        // Too small, treat as click
        onClick()
        return
      }

      const newStart = new Date(startDate.getTime() + deltaMinutes * 60000)
      const newEnd = new Date(endDate.getTime() + deltaMinutes * 60000)

      try {
        await rescheduleEvent(event.id, newStart.toISOString(), newEnd.toISOString())
        onMoved()
      } catch (err) {
        console.error('Reschedule failed:', err)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 overflow-hidden cursor-pointer transition-all duration-150 group"
      style={{
        top,
        height,
        background: bgStyle,
        borderLeft: `3px solid ${event.color || '#4A90D9'}`,
        opacity: isDragging ? 0.7 : 1,
        transform: isDragging ? 'scale(0.98)' : 'scale(1)',
        zIndex: isDragging ? 50 : isCourse ? 1 : 2,
        backdropFilter: isCourse ? 'blur(4px)' : undefined,
      }}
      onClick={handleClick}
      onMouseDown={isVirtual ? undefined : handleMouseDown}
      title={`${event.title}\n${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')}${event.description ? '\n' + event.description : ''}`}
    >
      <div className="text-xs font-medium truncate leading-tight"
           style={{ color: event.color ? `${event.color}ee` : 'var(--text-primary)' }}>
        {event.title}
      </div>
      {height > hourHeight / 2 && (
        <div className="text-[10px] truncate mt-0.5 opacity-70"
             style={{ color: 'var(--text-secondary)' }}>
          {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}
        </div>
      )}
      {height > hourHeight && event.description && (
        <div className="text-[10px] truncate mt-0.5 opacity-60"
             style={{ color: 'var(--text-muted)' }}>
          {event.description}
        </div>
      )}
    </div>
  )
}
