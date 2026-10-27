import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { join, extname } from "node:path"
import { fileURLToPath } from "node:url"

const PORT = parseInt(process.env.PORT || "7002", 10)
const __dirname = fileURLToPath(new URL(".", import.meta.url))
const clientDir = join(__dirname, "dist", "client")

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xml": "application/xml",
}

async function serveStaticFile(filePath) {
  try {
    const stats = await stat(filePath)
    if (!stats.isFile()) return null
    const content = await readFile(filePath)
    const ext = extname(filePath)
    return { content, contentType: MIME_TYPES[ext] || "application/octet-stream" }
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") return null
    throw err
  }
}

const { default: server } = await import("./dist/server/server.js")

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`)

  // Try static files first (assets, images, etc.)
  const staticFile = await serveStaticFile(join(clientDir, url.pathname))
  if (staticFile) {
    res.writeHead(200, {
      "Content-Type": staticFile.contentType,
      "Cache-Control": url.pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600",
    })
    res.end(staticFile.content)
    return
  }

  // SSR via TanStack Start fetch handler
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value)
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  const request = new Request(url.toString(), {
    method: req.method,
    headers,
    body: hasBody ? req : undefined,
    duplex: hasBody ? "half" : undefined,
  })

  const response = await server.fetch(request)
  // Each cookie needs its own Set-Cookie header; folding them into one loses all but the last
  const responseHeaders = Object.fromEntries([...response.headers].filter(([key]) => key !== "set-cookie"))
  const cookies = response.headers.getSetCookie()
  if (cookies.length) responseHeaders["set-cookie"] = cookies
  res.writeHead(response.status, responseHeaders)
  res.end(Buffer.from(await response.arrayBuffer()))
})

httpServer.listen(PORT, () => {
  console.log(`martlyshop.in running on http://localhost:${PORT}`)
})
