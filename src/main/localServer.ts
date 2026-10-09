// Minimal read-only static file server bound to 127.0.0.1, used for both the
// production renderer and the self-hosted rhwp-studio (see
// rhwp/studioServer.ts and index.ts for why each needs an http:// origin
// instead of file://).
import { readFile } from 'fs'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { extname, join, normalize, sep } from 'path'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  // Required for WebAssembly.instantiateStreaming().
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
}

function createStaticServer(rootDir: string): Server {
  return createServer((req, res) => {
    let pathname: string
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname)
    } catch {
      res.statusCode = 400
      res.end()
      return
    }
    if (pathname.endsWith('/')) pathname += 'index.html'

    const filePath = normalize(join(rootDir, pathname))
    if (!filePath.startsWith(rootDir + sep)) {
      res.statusCode = 403
      res.end()
      return
    }

    readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404
        res.end()
        return
      }
      res.setHeader(
        'Content-Type',
        MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      )
      res.end(data)
    })
  })
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error): void => reject(err)
    server.once('error', onError)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError)
      resolve((server.address() as AddressInfo).port)
    })
  })
}

/**
 * Serves `rootDir` on 127.0.0.1 and resolves to its base URL (with trailing
 * slash). Tries `preferredPort` first — a stable port keeps the page's origin
 * (and so its localStorage) the same across launches — and falls back to an
 * OS-assigned port if it's taken.
 */
export async function startStaticServer(rootDir: string, preferredPort = 0): Promise<string> {
  const root = normalize(rootDir)
  let server = createStaticServer(root)
  let port: number
  try {
    port = await listen(server, preferredPort)
  } catch (e) {
    if (preferredPort === 0) throw e
    server = createStaticServer(root)
    port = await listen(server, 0)
  }
  return `http://127.0.0.1:${port}/`
}
