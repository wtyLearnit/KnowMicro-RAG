import { useEffect, useRef, type RefObject } from 'react'

/**
 * Hook that detects clicks outside of a referenced element.
 * Used by dropdowns, modals, popovers, and icon pickers.
 */
export function useClickOutside<T extends HTMLElement>(
  handler: () => void,
): RefObject<T | null> {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler()
      }
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [handler])

  return ref
}
