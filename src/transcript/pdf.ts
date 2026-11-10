import * as pdfjs from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

type Piece = { text: string; x: number; y: number; width: number }

export async function pdfText(data: ArrayBuffer): Promise<string> {
  const task = pdfjs.getDocument({ data, useSystemFonts: true })
  try {
    const document = await task.promise
    const lines: string[] = []
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      const pieces: Piece[] = []
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue
        pieces.push({ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width })
      }
      pieces.sort((a, b) => b.y - a.y || a.x - b.x)
      let row: Piece[] = []
      const flush = () => {
        if (row.length === 0) return
        row.sort((a, b) => a.x - b.x)
        let line = ""
        let end = 0
        for (const piece of row) {
          if (line) line += piece.x - end > 6 ? "   " : piece.x - end > 0.5 ? " " : ""
          line += piece.text
          end = piece.x + piece.width
        }
        lines.push(line)
        row = []
      }
      for (const piece of pieces) {
        if (row.length > 0 && Math.abs(row[0].y - piece.y) > 3) flush()
        row.push(piece)
      }
      flush()
      lines.push("")
    }
    return lines.join("\n")
  } finally {
    await task.destroy()
  }
}
