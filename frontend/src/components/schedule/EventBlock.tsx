/**
 * EventBlock — a single event rendered as a positioned block in the day column.
 * Supports mouse-drag to reschedule with live visual feedback.
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
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const dragStartRef = useRef<{ y: number; origStart: Date; origEnd: Date } | null>(null)
  const didDragRef = useRef(false)

  const startDate = new Date(event.start_time)
  const endDate = new Date(event.end_time)

  const startHour = startDate.getHours() + startDate.getMinutes() / 60
  const endHour = endDate.getHours() + endDate.getMinutes() / 60
  const duration = endHour - startHour

  const top = (startHour - hourStart) * hourHeight
  const height = Math.max(duration * hourHeight, hourHeight / 3)

  const isCourse = event.event_type === 'course'
  const isVirtual = event.is_virtual

  // Parse color for background opacity
  const bgColor = event.color || '#4A90D9'
  const bgStyle = isCourse
    ? `${bgColor}22`
    : `${bgColor}dd`

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isDragging && !didDragRef.current) {
      onClick()
    }
  }

  // ── Drag to reschedule (vertical only) ──
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isVirtual) return
    e.stopPropagation()
    e.preventDefault()
    didDragRef.current = false
    setIsDragging(true)
    dragStartRef.current = { y: e.clientY, origStart: startDate, origEnd: endDate }

    const handleMouseMove = (moveE: MouseEvent) => {
      const deltaY = moveE.clientY - (dragStartRef.current?.y ?? 0)
      if (Math.abs(deltaY) > 3) {
        didDragRef.current = true
      }
      setDragOffsetY(deltaY)
    }

    const handleMouseUp = async (upE: MouseEvent) => {
      setIsDragging(false)
      setDragOffsetY(0)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      if (!dragStartRef.current || !didDragRef.current) {
        dragStartRef.current = null
        return
      }

      const deltaY = upE.clientY - dragStartRef.current.y
      const deltaMinutes = Math.round((deltaY / hourHeight) * 60 / 15) * 15

      if (Math.abs(deltaMinutes) < 15) {
        dragStartRef.current = null
        return
      }

      const newStart = new Date(dragStartRef.current.origStart.getTime() + deltaMinutes * 60000)
      const newEnd = new Date(dragStartRef.current.origEnd.getTime() + deltaMinutes * 60000)
      dragStartRef.current = null

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

  // Calculate snapped time for tooltip during drag
  const currentDragMinutes = isDragging
    ? Math.round((dragOffsetY / hourHeight) * 60 / 15) * 15
    : 0
  const snappedNewStart = new Date(startDate.getTime() + currentDragMinutes * 60000)
  const snappedNewEnd = new Date(endDate.getTime() + currentDragMinutes * 60000)

  return (
    <div
      data-event-id={event.id}
      className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 overflow-hidden cursor-pointer transition-shadow duration-150 group"
      style={{
        top: isDragging ? top + dragOffsetY : top,
        height,
        background: bgStyle,
        borderLeft: `3px solid ${event.color || '#4A90D9'}`,
        opacity: isDragging ? 0.85 : 1,
        zIndex: isDragging ? 100 : isCourse ? 1 : 2,
        backdropFilter: isCourse ? 'blur(4px)' : undefined,
        boxShadow: isDragging
          ? '0 8px 24px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)'
          : 'none',
        cursor: isDragging ? 'grabbing' : isVirtual ? 'pointer' : 'grab',
        transition: isDragging ? 'none' : 'top 0.15s ease, box-shadow 0.15s ease',
      }}
      onClick={handleClick}
      onMouseDown={isVirtual ? undefined : handleMouseDown}
      title={isDragging
        ? `${format(snappedNewStart, 'HH:mm')} - ${format(snappedNewEnd, 'HH:mm')}`
        : `${event.title}\n${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')}${event.description ? '\n' + event.description : ''}`
      }
    >
      <div className="text-xs font-medium truncate leading-tight"
           style={{ color: event.color ? `${event.color}ee` : 'var(--text-primary)' }}>
        {event.title}
      </div>
      {height > hourHeight / 2 && (
        <div className="text-[10px] truncate mt-0.5 opacity-70"
             style={{ color: 'var(--text-secondary)' }}>
          {isDragging
            ? `${format(snappedNewStart, 'HH:mm')} - ${format(snappedNewEnd, 'HH:mm')}`
            : `${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')}`
          }
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
