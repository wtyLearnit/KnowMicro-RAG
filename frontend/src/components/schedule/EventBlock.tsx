/**
 * EventBlock — a single event rendered as a positioned block in the day column.
 * Supports: HTML5 drag (cross-day), resize top/bottom edges, click to edit.
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
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDeltaY, setResizeDeltaY] = useState(0)
  const [resizeEdge, setResizeEdge] = useState<'top' | 'bottom' | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const didDragRef = useRef(false)

  const startDate = new Date(event.start_time)
  const endDate = new Date(event.end_time)

  // getHours() returns local time — backend sends UTC-aware datetimes,
  // new Date() converts to local automatically
  const startHour = startDate.getHours() + startDate.getMinutes() / 60
  const endHour = endDate.getHours() + endDate.getMinutes() / 60
  const duration = endHour - startHour

  const baseTop = (startHour - hourStart) * hourHeight
  const baseHeight = Math.max(duration * hourHeight, hourHeight / 3)

  const isCourse = event.event_type === 'course'
  const isTask = event.event_type === 'task'
  const isVirtual = event.is_virtual

  // ── Color ──
  const rawColor = event.color || '#4A90D9'
  const hexColor = rawColor.startsWith('#') ? rawColor : '#4A90D9'
  const bgStyle = isCourse ? `${hexColor}22` : isTask ? hexColor : `${hexColor}dd`
  const textColor = isCourse ? hexColor : '#fff'

  // ── Click ──
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isDragging && !isResizing && !didDragRef.current) {
      onClick()
    }
  }

  // ── HTML5 Drag (cross-day support) ──
  const handleDragStart = (e: React.DragEvent) => {
    if (isVirtual) return
    didDragRef.current = false
    setIsDragging(true)
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'event',
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        start_time: event.start_time,
        end_time: event.end_time,
        color: event.color,
        event_type: event.event_type,
      },
    }))
    e.dataTransfer.effectAllowed = 'move'

    // Custom drag image
    const ghost = document.createElement('div')
    ghost.style.cssText = `
      position: fixed; top: -200px; left: -200px; z-index: 9999;
      padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500;
      background: rgba(15,23,42,0.92); color: #fff;
      border-left: 3px solid ${hexColor};
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      font-family: system-ui, -apple-system, sans-serif;
    `
    ghost.textContent = event.title
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 20, 12)
    requestAnimationFrame(() => ghost.remove())
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  // ── Resize (top or bottom edge) ──
  const handleResizeStart = useCallback((e: React.MouseEvent, edge: 'top' | 'bottom') => {
    if (isVirtual) return
    e.stopPropagation()
    e.preventDefault()
    didDragRef.current = false
    setIsResizing(true)
    setResizeEdge(edge)

    const origStart = startDate
    const origEnd = endDate
    const startY = e.clientY

    const handleMouseMove = (moveE: MouseEvent) => {
      const deltaY = moveE.clientY - startY
      if (Math.abs(deltaY) > 3) didDragRef.current = true
      setResizeDeltaY(deltaY)
    }

    const handleMouseUp = async (upE: MouseEvent) => {
      setIsResizing(false)
      setResizeDeltaY(0)
      setResizeEdge(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      if (!didDragRef.current) return

      const deltaY = upE.clientY - startY
      const deltaMinutes = Math.round((deltaY / hourHeight) * 60 / 15) * 15

      if (Math.abs(deltaMinutes) < 5) return

      let newStart: Date, newEnd: Date
      if (edge === 'top') {
        newStart = new Date(origStart.getTime() + deltaMinutes * 60000)
        newEnd = origEnd
        if (newEnd.getTime() - newStart.getTime() < 15 * 60000) {
          newStart = new Date(newEnd.getTime() - 15 * 60000)
        }
      } else {
        newStart = origStart
        newEnd = new Date(origEnd.getTime() + deltaMinutes * 60000)
        if (newEnd.getTime() - newStart.getTime() < 15 * 60000) {
          newEnd = new Date(newStart.getTime() + 15 * 60000)
        }
      }

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

  // ── Display calculations ──
  let displayTop = baseTop
  let displayHeight = baseHeight

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

  // Time display — getHours() is local time since backend sends UTC-aware datetimes
  const fmtTime = (d: Date) => format(d, 'HH:mm')

  const snapMinutes = (deltaPx: number) => Math.round((deltaPx / hourHeight) * 60 / 15) * 15

  const tooltipStart = isResizing && resizeEdge === 'top'
    ? new Date(startDate.getTime() + snapMinutes(resizeDeltaY) * 60000)
    : startDate
  const tooltipEnd = isResizing && resizeEdge === 'bottom'
    ? new Date(endDate.getTime() + snapMinutes(resizeDeltaY) * 60000)
    : endDate

  return (
    <div
      data-event-id={event.id}
      data-event-block="true"
      draggable={!isVirtual}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="absolute left-0.5 right-0.5 rounded-md overflow-hidden group"
      style={{
        top: displayTop,
        height: displayHeight,
        background: bgStyle,
        borderLeft: `3px solid ${hexColor}`,
        zIndex: isResizing ? 100 : isCourse ? 1 : isTask ? 3 : 2,
        backdropFilter: isCourse ? 'blur(4px)' : undefined,
        boxShadow: isResizing
          ? '0 8px 24px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)'
          : isTask ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
        cursor: isVirtual ? 'pointer' : isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.4 : 1,
        transition: isResizing ? 'none' : isDragging ? 'none' : 'top 0.15s ease, height 0.15s ease',
      }}
      onClick={handleClick}
      title={`${event.title}\n${fmtTime(tooltipStart)} - ${fmtTime(tooltipEnd)}${event.description ? '\n' + event.description : ''}`}
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
        <div className="text-xs font-medium truncate leading-tight" style={{ color: textColor }}>
          {event.title}
        </div>
        {displayHeight > hourHeight / 2 && (
          <div className="text-[10px] truncate mt-0.5" style={{ color: textColor, opacity: 0.75 }}>
            {fmtTime(tooltipStart)} – {fmtTime(tooltipEnd)}
          </div>
        )}
        {displayHeight > hourHeight && event.description && (
          <div className="text-[10px] truncate mt-0.5" style={{ color: textColor, opacity: 0.55 }}>
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
