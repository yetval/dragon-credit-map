import type { Major } from "./types.ts"

export const files = import.meta.glob<{ default: Major }>(["../data/majors/unc/*.json", "!../data/majors/unc/* *.json"], {
  eager: true,
})
