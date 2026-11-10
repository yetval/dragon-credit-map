import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { ManifestEntry, Source } from "../../src/types.ts"

const CACHE_DIR = join(import.meta.dirname, "..", "..", ".cache")
const USE_CACHE = process.argv.includes("--cached")
const GAP_MS = 1000
const DENIED = [/\/ribbit\//, /\/search\//, /\/archives\//, /\/pdf\//, /\/courseleaf\//]

const queues = new Map<string, Promise<unknown>>()
const fetched = new Map<string, ManifestEntry>()

export type Page = { url: string; body: string; source: Source }

const sha = (text: string, algo: string) => createHash(algo).update(text).digest("hex")
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function download(url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, redirect: "follow" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.text()
    } catch (error) {
      if (attempt === 3) throw new Error(`Fetch failed for ${url}: ${(error as Error).message}`)
      await sleep(2000 * attempt)
    }
  }
}

export function get(url: string): Promise<Page> {
  const parsed = new URL(url)
  if (DENIED.some((pattern) => pattern.test(parsed.pathname))) {
    throw new Error(`Refusing to fetch a path that robots.txt disallows: ${url}`)
  }
  const file = join(CACHE_DIR, `${sha(url, "sha1")}.json`)
  if (USE_CACHE && existsSync(file)) {
    const cached = JSON.parse(readFileSync(file, "utf8")) as { body: string; fetchedAt: string }
    return Promise.resolve(record(url, cached.body, cached.fetchedAt))
  }
  const previous = queues.get(parsed.host) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const body = await download(url)
      const now = new Date()
      const fetchedAt = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, "0")).join("-")
      mkdirSync(CACHE_DIR, { recursive: true })
      writeFileSync(file, JSON.stringify({ url, fetchedAt, body }))
      await sleep(GAP_MS)
      return record(url, body, fetchedAt)
    })
  queues.set(parsed.host, next)
  return next
}

function record(url: string, body: string, fetchedAt: string): Page {
  fetched.set(url, { id: url, url, fetchedAt, sha256: sha(body, "sha256") })
  return { url, body, source: { url, fetchedAt } }
}

export function fetchedSources(): ManifestEntry[] {
  return [...fetched.values()].sort((a, b) => a.url.localeCompare(b.url))
}
