import * as cheerio from "cheerio"
import { get } from "./lib/http.ts"
import { clean } from "./college-courses.ts"
import type { Policies, Source } from "../src/types.ts"

const NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }

async function pageText(url: string): Promise<{ text: string; source: Source }> {
  const page = await get(url)
  const $ = cheerio.load(page.body)
  $("script, style").remove()
  return { text: clean($("body").text()), source: page.source }
}

function find(text: string, pattern: RegExp, url: string): RegExpExecArray {
  const match = pattern.exec(text)
  if (!match) throw new Error(`Expected policy text was not found at ${url}: ${pattern.source}`)
  return match
}

export async function scrapePolicies(
  prefixAliases: Record<string, string>,
  prefixEvidence: Source[],
): Promise<Policies> {
  const credit = await pageText("https://catalog.unc.edu/policies-procedures/credit-evaluation/")
  const degree = await pageText("https://catalog.unc.edu/undergraduate/degree-requirements/")
  const ideas = await pageText("https://catalog.unc.edu/undergraduate/ideas-in-action/")
  const coda = await pageText("https://engr.ncsu.edu/academics/undergraduate/coda/")
  const science = await pageText(
    "https://docs.google.com/document/d/e/2PACX-1vQln7G8aAN6ndZq1pJztgH4ODepxNeh00Op2SlbMBqZuJSNg3gSB_TYxJRbNZDi-ahNsRH0K4lvJ5dI/pub",
  )

  const core = find(credit.text, /No more than (\w+) courses \([^)]*\) of BE credit may be used as part of the major core\./, credit.source.url)
  const focus = find(credit.text, /No more than (\w+) BE credit courses may be used to fulfill the general education Focus Capacities requirements\./, credit.source.url)
  const half = find(degree.text, /All students, including[^.]*must take at least half of their major core requirements[^.]*\./, degree.source.url)
  const capacities = find(ideas.text, /Of the 9 Focus Capacities, students may fulfill up to 5 Focus Capacities[^.]*\./, ideas.source.url)
  const entry = find(coda.text, /All entering engineering first-year students are classified as[^.]*\./, coda.source.url)
  const success = find(coda.text, /Success courses:(.*?)Students must complete each of the courses above with a C or better[^.]*\./, coda.source.url)
  const research = find(science.text, /Science courses with a significant research component[^.]*\(\*R\*\)\.[^.]*\./, science.source.url)
  const math = find(science.text, /Some Science courses rely heavily on mathematics.*?\(\*M\*\)\./, science.source.url)

  return {
    unc: {
      beLimits: {
        quote: `${core[0]} ${focus[0]}`,
        source: credit.source,
        majorCoreCourses: NUMBERS[core[1]],
        focusCapacityCourses: NUMBERS[focus[1]],
      },
      halfCoreAtUnc: { quote: half[0], source: degree.source },
      focusCapacities: { quote: capacities[0], source: ideas.source },
    },
    ncsu: {
      prefixAliases,
      prefixEvidence,
      coda: {
        quote: `${entry[0]} ${success[0].slice(success[0].indexOf("Students must complete"))}`,
        source: coda.source,
        successCourses: [...success[1].matchAll(/\b([A-Z]{2,4} \d{3})\b/g)].map((match) => match[1]),
      },
    },
    ncssm: { markers: { research: research[0], mathIntensive: math[0], source: science.source } },
  }
}
