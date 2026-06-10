import { useState, useEffect } from 'react'

interface DocxPreviewResult {
  html: string | null
  loading: boolean
  error: string | null
}

/**
 * Fetch a DOCX file from the given URL and convert it to HTML using mammoth.js.
 * Only triggers conversion when `enabled` is true (e.g. user has switched to the
 * "original file" view), to avoid wasting bandwidth.
 * Pass `fileUrl` as null for non-DOCX files — the hook will stay idle.
 */
export function useDocxPreview(
  fileUrl: string | null,
  enabled: boolean,
): DocxPreviewResult {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !fileUrl) return
    if (html !== null) return // already loaded

    let cancelled = false

    // Capture the URL so TypeScript knows it's non-null inside the async function
    const url = fileUrl!
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Dynamically import mammoth to keep it tree-shaken until needed
        const mammoth = await import('mammoth')

        const resp = await fetch(url)
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`)
        }
        const arrayBuffer = await resp.arrayBuffer()
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            // Convert underline to <u> so it renders visibly
            convertImage: null as unknown as undefined, // keep images as base64 (inline)
          },
        )
        if (!cancelled) {
          setHtml(result.value)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || '加载失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [fileUrl, enabled, html])

  return { html, loading, error }
}
