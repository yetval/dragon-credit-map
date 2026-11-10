import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { extname, join, relative } from "node:path"

const ROOT = join(import.meta.dirname, "..")

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const authored = [
  ...walk(join(ROOT, "src")),
  ...walk(join(ROOT, "scripts")),
  ...walk(join(ROOT, "tests")),
  join(ROOT, "index.html"),
  join(ROOT, "vite.config.ts"),
].filter((path) => [".ts", ".css", ".html"].includes(extname(path)))

const withoutStrings = (line: string) =>
  line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""').replace(/\/(?:[^/\\\n]|\\.)+\/[dgimsuvy]*/g, "//x")

test("interface text and code contain no em dashes", () => {
  const dash = String.fromCodePoint(0x2014)
  const found = authored.filter((path) => readFileSync(path, "utf8").includes(dash)).map((path) => relative(ROOT, path))
  assert.deepEqual(found, [])
})

test("code files carry no comments", () => {
  const found: string[] = []
  for (const path of authored) {
    const kind = extname(path)
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, index) => {
        const bare = withoutStrings(line)
        const comment =
          kind === ".html" ? /<!--/.test(line) : kind === ".css" ? /\/\*/.test(line) : /(^|\s)\/\/(\s|$)/.test(bare) || /\/\*/.test(bare)
        if (comment) found.push(`${relative(ROOT, path)}:${index + 1}`)
      })
  }
  assert.deepEqual(found, [])
})

test("the app never touches browser storage or the network", () => {
  const banned = /localStorage|sessionStorage|indexedDB|document\.cookie|sendBeacon|XMLHttpRequest|WebSocket|\bfetch\(/
  const found = walk(join(ROOT, "src"))
    .filter((path) => extname(path) === ".ts" && banned.test(readFileSync(path, "utf8")))
    .map((path) => relative(ROOT, path))
  assert.deepEqual(found, [])
})

test("the built site is locked to its own origin", () => {
  const out = mkdtempSync(join(tmpdir(), "credit-map-"))
  execFileSync("npx", ["vite", "build", "--outDir", out, "--emptyOutDir", "--logLevel", "silent"], { cwd: ROOT, stdio: "pipe" })
  const html = readFileSync(join(out, "index.html"), "utf8")
  const policy = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? ""
  assert.match(policy, /default-src 'none'/)
  assert.match(policy, /script-src 'self'/)
  assert.match(policy, /font-src 'self'/)
  assert.doesNotMatch(policy, /unsafe|https?:|\*/)
  assert.doesNotMatch(policy, /connect-src/)
  const loaded = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(
    loaded.filter((url) => /^(?:https?:)?\/\//.test(url)),
    [],
  )
  const styles = walk(out).filter((path) => extname(path) === ".css")
  for (const path of styles) {
    const css = readFileSync(path, "utf8")
    assert.doesNotMatch(css, /url\(\s*["']?(?:https?:)?\/\//)
    assert.doesNotMatch(css, /@import/)
  }
  const own = walk(out).filter((path) => extname(path) === ".js" && !/pdf/i.test(path))
  for (const path of own) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /localStorage|sessionStorage|indexedDB|document\.cookie|sendBeacon/, relative(out, path))
  }
})
