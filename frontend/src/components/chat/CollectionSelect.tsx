/**
 * CollectionSelect — dropdown to select a knowledge base or enter free-chat mode.
 * Extracted from ChatPage.tsx.
 */
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Database, Check } from 'lucide-react'
import type { Collection } from '../../types'

interface CollectionSelectProps {
  collections: Collection[]
  value: string | null
  onChange: (id: string) => void
}

export function CollectionSelect({ collections, value, onChange }: CollectionSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = collections.find((c) => c.id === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group"
        style={{
          background: 'var(--bg-input)',
          border: `1px solid ${open ? 'var(--accent-blue)' : 'var(--border-glass)'}`,
          boxShadow: open ? '0 0 20px rgba(59,130,246,0.12)' : 'none',
        }}
      >
        {selected ? (
          <>
            <span className="text-lg flex-shrink-0">{selected.icon}</span>
            <span
              className="flex-1 text-left text-sm truncate font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              {selected.name}
            </span>
          </>
        ) : (
          <>
            <Database size={16} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <span className="flex-1 text-left text-sm" style={{ color: 'var(--text-muted)' }}>
              选择知识库...
            </span>
          </>
        )}
        <ChevronDown
          size={16}
          className="transition-all duration-200"
          style={{
            color: open ? 'var(--accent-blue)' : 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 mt-1.5 z-50 glass-panel overflow-hidden"
            style={{
              boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 0 20px rgba(59,130,246,0.08)',
            }}
          >
            <div className="py-1.5 max-h-60 overflow-y-auto">
              {!value && (
                <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  选择知识库
                </div>
              )}
              {collections.map((col) => {
                const isActive = col.id === value
                return (
                  <button
                    key={col.id}
                    onClick={() => {
                      onChange(col.id)
                      setOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-150"
                    style={{
                      background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                      color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--bg-card-hover)'
                        e.currentTarget.style.color = 'var(--text-primary)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--text-secondary)'
                      }
                    }}
                  >
                    <span className="text-lg flex-shrink-0">{col.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{col.name}</div>
                      {col.description && (
                        <div
                          className="text-xs truncate mt-0.5"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {col.description}
                        </div>
                      )}
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
                      {col.document_count} 份
                    </span>
                    {isActive && (
                      <Check size={14} className="flex-shrink-0 text-[var(--accent-blue)]" />
                    )}
                  </button>
                )
              })}
              {collections.length === 0 && (
                <div className="px-3 py-4 text-center">
                  <Database
                    size={20}
                    className="mx-auto mb-2"
                    style={{ color: 'var(--text-dim)' }}
                  />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    暂无知识库
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
