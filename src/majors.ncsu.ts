import type { Major } from "./types.ts"

export const files = import.meta.glob<{ default: Major }>(["../data/majors/ncsu/*.json", "!../data/majors/ncsu/* *.json"], {
  eager: true,
})
