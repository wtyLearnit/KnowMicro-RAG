/**
 * IconPicker — emoji icon selector for knowledge base collections.
 * Extracted from KnowledgeBasePage.tsx.
 */
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export const ICON_OPTIONS = [
  '📚', '📖', '📝', '📋', '📁', '📂', '📄', '📑',
  '🧠', '💡', '🔬', '🔭', '🧪', '⚗️', '🧬', '🔢',
  '💻', '🖥️', '⌨️', '🖱️', '💾', '📀', '🌐', '🔗',
  '🎓', '🏫', '📐', '📏', '🎨', '🎭', '🎵', '🎶',
  '🌍', '🌎', '🌏', '🗺️', '⚖️', '🏛️', '🔮', '💎',
  '🐍', '🦀', '☕', '⚛️', '🧮', '📊', '📈', '🗂️',
  '🩺', '💊', '🧿', '🪐', '✨', '🔥', '⚡', '🌟',
]

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200"
        style={{
          background: 'var(--bg-input)',
          border: `1px solid ${open ? 'var(--accent-blue)' : 'var(--border-glass)'}`,
        }}
      >
        <span className="text-2xl">{value}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>选择图标</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 mt-1.5 z-50 glass-panel p-3 w-72"
            style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }}
          >
            <div className="grid grid-cols-8 gap-1">
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => {
                    onChange(icon)
                    setOpen(false)
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-lg transition-all duration-150 hover:scale-110"
                  style={{
                    background: icon === value ? 'rgba(59,130,246,0.15)' : 'transparent',
                    border:
                      icon === value ? '1px solid var(--accent-blue)' : '1px solid transparent',
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
