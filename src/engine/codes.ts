export function canonicalCode(code: string, aliases: Record<string, string>): string {
  const split = code.indexOf(" ")
  if (split < 0) return code
  const prefix = code.slice(0, split)
  return aliases[prefix] ? aliases[prefix] + code.slice(split) : code
}

export function subjectOf(code: string): string {
  return code.split(" ")[0]
}

export function levelOf(code: string): number | null {
  const digit = /\s(\d)/.exec(code)?.[1]
  return digit ? Number(digit) * 100 : null
}

export function numberOf(code: string): number | null {
  const digits = /\s(\d{3})/.exec(code)?.[1]
  return digits ? Number(digits) : null
}
