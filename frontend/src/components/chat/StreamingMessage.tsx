/**
 * StreamingMessage — renders AI streaming output without re-rendering the entire message list.
 * Uses React.memo + useMemo to isolate streaming content from the rest of the chat.
 */
import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Loader2, Sparkles } from 'lucide-react'

interface StreamingMessageProps {
  content: string
  isRegenerate?: boolean
  label?: string
}

export const StreamingMessage = memo(function StreamingMessage({
  content,
  isRegenerate = false,
  label = 'thinking...',
}: StreamingMessageProps) {
  const renderedContent = useMemo(() => {
    if (!content) return null
    return <ReactMarkdown>{content}</ReactMarkdown>
  }, [content])

  return (
    <div className="flex justify-start mb-4">
      <div
        className="max-w-[80%] rounded-2xl px-5 py-4 relative"
        style={{
          background: 'rgba(59,130,246,0.06)',
          border: '1px solid var(--border-glass)',
          boxShadow: '0 4px 20px rgba(59,130,246,0.06)',
        }}
      >
        <div className="prose-content text-sm" style={{ color: 'var(--text-secondary)' }}>
          {renderedContent}
          <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom animate-pulse rounded-sm"
                style={{ background: 'var(--accent-blue)' }} />
        </div>
        <div className="flex items-center gap-2 mt-2">
          {isRegenerate ? (
            <RotateIcon />
          ) : (
            <Sparkles size={12} style={{ color: 'var(--accent-blue)' }} />
          )}
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {isRegenerate ? '重新生成中...' : label}
          </span>
        </div>
      </div>
    </div>
  )
})

/** Small spinner for regenerate mode. */
function RotateIcon() {
  return <Loader2 size={12} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
}
