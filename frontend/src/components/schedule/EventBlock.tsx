/**
 * EventBlock — a single event rendered as a positioned block in the day column.
 * Supports: drag to reschedule, resize top/bottom edges, click to edit.
 */
import { useState, useRef, useCallback } from 'react'
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
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [resizeDeltaY, setResizeDeltaY] = useState(0)
  const [resizeEdge, setResizeEdge] = useState<'top' | 'bottom' | null>(null)
  const dragStartRef = useRef<{ y: number; origStart: Date; origEnd: Date } | null>(null)
  const didDragRef = useRef(false)

  const startDate = new Date(event.start_time)
  const endDate = new Date(event.end_time)

  const startHour = startDate.getHours() + startDate.getMinutes() / 60
  const endHour = endDate.getHours() + endDate.getMinutes() / 60
  const duration = endHour - startHour

  const baseTop = (startHour - hourStart) * hourHeight
  const baseHeight = Math.max(duration * hourHeight, hourHeight / 3)

  const isCourse = event.event_type === 'course'
  const isTask = event.event_type === 'task'
  const isVirtual = event.is_virtual

  // ── Color & opacity ──
  // Normalize color to hex for alpha appending
  const rawColor = event.color || '#4A90D9'
  const hexColor = rawColor.startsWith('#') ? rawColor : '#4A90D9'
  // Courses: semi-transparent overlay; tasks & custom: fully opaque
  const bgStyle = isCourse
    ? `${hexColor}22`
    : isTask ? hexColor : `${hexColor}dd`
  const textColor = isCourse
    ? hexColor
    : '#fff'

  // ── Click (not after drag/resize) ──
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isDragging && !isResizing && !didDragRef.current) {
      onClick()
    }
  }

  // ── Drag to reschedule (body of block) ──
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isVirtual || isResizing) return
    // Only start drag from the body (not the resize edges)
    if ((e.target as HTMLElement).dataset.resize) return
    e.stopPropagation()
    e.preventDefault()
    didDragRef.current = false
    setIsDragging(true)
    dragStartRef.current = { y: e.clientY, origStart: startDate, origEnd: endDate }

    const handleMouseMove = (moveE: MouseEvent) => {
      const deltaY = moveE.clientY - (dragStartRef.current?.y ?? 0)
      if (Math.abs(deltaY) > 3) didDragRef.current = true
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

  // ── Resize (top or bottom edge) ──
  const handleResizeStart = useCallback((e: React.MouseEvent, edge: 'top' | 'bottom') => {
    if (isVirtual) return
    e.stopPropagation()
    e.preventDefault()
    didDragRef.current = false
    setIsResizing(true)
    setResizeEdge(edge)
    dragStartRef.current = { y: e.clientY, origStart: startDate, origEnd: endDate }

    const handleMouseMove = (moveE: MouseEvent) => {
      const deltaY = moveE.clientY - (dragStartRef.current?.y ?? 0)
      if (Math.abs(deltaY) > 3) didDragRef.current = true
      setResizeDeltaY(deltaY)
    }

    const handleMouseUp = async (upE: MouseEvent) => {
      setIsResizing(false)
      setResizeDeltaY(0)
      setResizeEdge(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      if (!dragStartRef.current || !didDragRef.current) {
        dragStartRef.current = null
        return
      }

      const deltaY = upE.clientY - dragStartRef.current.y
      const deltaMinutes = Math.round((deltaY / hourHeight) * 60 / 15) * 15

      if (Math.abs(deltaMinutes) < 5) {
        dragStartRef.current = null
        return
      }

      let newStart: Date, newEnd: Date
      if (edge === 'top') {
        // Resizing top: change start time, keep end fixed
        newStart = new Date(dragStartRef.current.origStart.getTime() + deltaMinutes * 60000)
        newEnd = dragStartRef.current.origEnd
        // Ensure minimum 15 min duration
        if (newEnd.getTime() - newStart.getTime() < 15 * 60000) {
          newStart = new Date(newEnd.getTime() - 15 * 60000)
        }
      } else {
        // Resizing bottom: change end time, keep start fixed
        newStart = dragStartRef.current.origStart
        newEnd = new Date(dragStartRef.current.origEnd.getTime() + deltaMinutes * 60000)
        // Ensure minimum 15 min duration
        if (newEnd.getTime() - newStart.getTime() < 15 * 60000) {
          newEnd = new Date(newStart.getTime() + 15 * 60000)
        }
      }
      dragStartRef.current = null

      try {
        await rescheduleEvent(event.id, newStart.toISOString(), newEnd.toISOString())
        onMoved()
      } catch (err) {
        console.error('Resize failed:', err)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [event, hourHeight, onMoved, isVirtual, startDate, endDate])

  // ── Calculated display values ──
  let displayTop = baseTop
  let displayHeight = baseHeight

  if (isDragging) {
    displayTop = baseTop + dragOffsetY
  }
  if (isResizing && resizeEdge === 'top') {
    const newTop = baseTop + resizeDeltaY
    const newHeight = baseHeight - resizeDeltaY
    if (newHeight >= hourHeight / 4) {
      displayTop = newTop
      displayHeight = newHeight
    }
  }
  if (isResizing && resizeEdge === 'bottom') {
    const newHeight = baseHeight + resizeDeltaY
    if (newHeight >= hourHeight / 4) {
      displayHeight = newHeight
    }
  }

  // Snap helper for tooltip
  const snapMinutes = (deltaPx: number) => Math.round((deltaPx / hourHeight) * 60 / 15) * 15

  const tooltipStart = isDragging
    ? new Date(startDate.getTime() + snapMinutes(dragOffsetY) * 60000)
    : isResizing && resizeEdge === 'top'
    ? new Date(startDate.getTime() + snapMinutes(resizeDeltaY) * 60000)
    : startDate

  const tooltipEnd = isDragging
    ? new Date(endDate.getTime() + snapMinutes(dragOffsetY) * 60000)
    : isResizing && resizeEdge === 'bottom'
    ? new Date(endDate.getTime() + snapMinutes(resizeDeltaY) * 60000)
    : endDate

  return (
    <div
      data-event-id={event.id}
      className="absolute left-0.5 right-0.5 rounded-md overflow-hidden group"
      style={{
        top: displayTop,
        height: displayHeight,
        background: bgStyle,
        borderLeft: `3px solid ${hexColor}`,
        zIndex: (isDragging || isResizing) ? 100 : isCourse ? 1 : isTask ? 3 : 2,
        backdropFilter: isCourse ? 'blur(4px)' : undefined,
        boxShadow: (isDragging || isResizing)
          ? '0 8px 24px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)'
          : isTask ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
        cursor: (isDragging || isResizing) ? 'grabbing' : isVirtual ? 'pointer' : 'grab',
        transition: (isDragging || isResizing) ? 'none' : 'top 0.15s ease, height 0.15s ease, box-shadow 0.15s ease',
      }}
      onClick={handleClick}
      onMouseDown={isVirtual ? undefined : handleMouseDown}
      title={`${event.title}\n${format(tooltipStart, 'HH:mm')} - ${format(tooltipEnd, 'HH:mm')}${event.description ? '\n' + event.description : ''}`}
    >
      {/* Top resize handle */}
      {!isVirtual && (
        <div
          data-resize="top"
          className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={(e) => handleResizeStart(e, 'top')}
        >
          <div className="mx-auto mt-0.5 w-8 h-0.5 rounded-full"
               style={{ background: 'rgba(255,255,255,0.5)' }} />
        </div>
      )}

      {/* Content */}
      <div className="px-1.5 py-1 h-full flex flex-col justify-center overflow-hidden">
        <div className="text-xs font-medium truncate leading-tight"
             style={{ color: textColor }}>
          {event.title}
        </div>
        {displayHeight > hourHeight / 2 && (
          <div className="text-[10px] truncate mt-0.5"
               style={{ color: textColor, opacity: 0.75 }}>
            {format(tooltipStart, 'HH:mm')} – {format(tooltipEnd, 'HH:mm')}
          </div>
        )}
        {displayHeight > hourHeight && event.description && (
          <div className="text-[10px] truncate mt-0.5"
               style={{ color: textColor, opacity: 0.55 }}>
            {event.description}
          </div>
        )}
      </div>

      {/* Bottom resize handle */}
      {!isVirtual && (
        <div
          data-resize="bottom"
          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={(e) => handleResizeStart(e, 'bottom')}
        >
          <div className="mx-auto mb-0.5 w-8 h-0.5 rounded-full"
               style={{ background: 'rgba(255,255,255,0.5)' }} />
        </div>
      )}
    </div>
  )
}
