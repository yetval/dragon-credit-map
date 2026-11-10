import { defineConfig } from "vite"

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ")

export default defineConfig(({ command }) => ({
  base: "./",
  build: { target: "es2022", modulePreload: { polyfill: false } },
  plugins: [
    {
      name: "content-security-policy",
      transformIndexHtml(html) {
        if (command !== "build") return html
        return html.replace("<meta charset=\"utf-8\" />", `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
      },
    },
  ],
}))
