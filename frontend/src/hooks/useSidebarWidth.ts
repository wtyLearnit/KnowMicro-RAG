import { useState, useEffect } from 'react'

const EXPANDED = 256 // w-64
const COLLAPSED = 64  // w-16

function readWidth(): number {
  return localStorage.getItem('sidebarCollapsed') === 'true' ? COLLAPSED : EXPANDED
}

/** Reactive hook — returns the sidebar width in px, updates when sidebar toggles. */
export function useSidebarWidth(): number {
  const [width, setWidth] = useState(readWidth)

  useEffect(() => {
    const handler = () => setWidth(readWidth())
    window.addEventListener('sidebar-toggle', handler)
    return () => window.removeEventListener('sidebar-toggle', handler)
  }, [])

  return width
}
