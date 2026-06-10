import { createServer } from 'http'
import { readFile, stat } from 'fs/promises'
import { createReadStream } from 'fs'
import { join, extname } from 'path'
import { request } from 'http'

const PORT = 5173
const DIST = join(import.meta.dirname, 'dist')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

createServer(async (req, res) => {
  // API proxy
  if (req.url.startsWith('/api')) {
    const proxy = request({ host: 'localhost', port: 8000, path: req.url, method: req.method, headers: req.headers })
    req.pipe(proxy)
    proxy.on('response', pres => { res.writeHead(pres.statusCode, pres.headers); pres.pipe(res) })
    proxy.on('error', () => { res.writeHead(502); res.end('Bad Gateway') })
    return
  }

  // Static file
  const url = new URL(req.url, 'http://localhost')
  let filePath = join(DIST, url.pathname)
  try { const s = await stat(filePath); if (s.isDirectory()) filePath = join(filePath, 'index.html') }
  catch { filePath = join(DIST, 'index.html') } // SPA fallback

  try {
    const s = await stat(filePath)
    const ext = extname(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': s.size })
    createReadStream(filePath).pipe(res)
  } catch { res.writeHead(404); res.end('Not Found') }
}).listen(PORT, () => console.log(`Serving on http://localhost:${PORT}`))
