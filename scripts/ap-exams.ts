import type { ApExam } from "../src/types.ts"

type ExamEntry = ApExam & { aliases: string[] }

export const EXAMS: ExamEntry[] = [
  { id: "african-american-studies", name: "African American Studies", group: "exam", aliases: ["African American Studies"] },
  { id: "art-2d", name: "Art and Design: 2-D", group: "exam", aliases: ["Art 2D", "Art: Studio Art: 2-D Design"] },
  { id: "art-3d", name: "Art and Design: 3-D", group: "exam", aliases: ["Art 3D", "Art: Studio Art: 3-D Design"] },
  { id: "art-drawing", name: "Art and Design: Drawing", group: "exam", aliases: ["Art Studio Drawing", "Art: Studio Art – Drawing Portfolio"] },
  { id: "art-history", name: "Art History", group: "exam", aliases: ["Art History", "History of Art"] },
  { id: "biology", name: "Biology", group: "exam", aliases: ["Biology"] },
  { id: "calculus-ab", name: "Calculus AB", group: "exam", aliases: ["Calculus AB", "Math: Calculus AB"] },
  { id: "calculus-bc", name: "Calculus BC", group: "exam", aliases: ["Calculus BC", "Math: Calculus BC"] },
  { id: "calculus-ab-subscore", name: "Calculus BC: AB subscore", group: "subscore", aliases: ["Calculus AB Subscore"] },
  { id: "chemistry", name: "Chemistry", group: "exam", aliases: ["Chemistry"] },
  { id: "chinese", name: "Chinese Language and Culture", group: "exam", aliases: ["Chinese"] },
  { id: "comparative-government", name: "Comparative Government and Politics", group: "exam", aliases: ["Comparative Government and Politics", "Government & Politics: Comparative"] },
  { id: "computer-science-a", name: "Computer Science A", group: "exam", aliases: ["Computer Science A"] },
  { id: "computer-science-ab", name: "Computer Science AB", group: "retired", aliases: ["Computer Science AB"] },
  { id: "computer-science-principles", name: "Computer Science Principles", group: "exam", aliases: ["Computer Science Principles"] },
  { id: "macroeconomics", name: "Macroeconomics", group: "exam", aliases: ["Economics: Macroeconomics"] },
  { id: "microeconomics", name: "Microeconomics", group: "exam", aliases: ["Economics: Microeconomics"] },
  { id: "english-language", name: "English Language and Composition", group: "exam", aliases: ["English Language and Composition", "English Language & Composition"] },
  { id: "english-literature", name: "English Literature and Composition", group: "exam", aliases: ["English Literature", "English Literature & Composition"] },
  { id: "environmental-science", name: "Environmental Science", group: "exam", aliases: ["Environmental Science"] },
  { id: "european-history", name: "European History", group: "exam", aliases: ["European History"] },
  { id: "french-language", name: "French Language and Culture", group: "exam", aliases: ["French Language and Culture", "French Language"] },
  { id: "french-literature", name: "French Literature", group: "retired", aliases: ["French Literature"] },
  { id: "german", name: "German Language and Culture", group: "exam", aliases: ["German Language"] },
  { id: "human-geography", name: "Human Geography", group: "exam", aliases: ["Geography (Human)", "Human Geography"] },
  { id: "italian", name: "Italian Language and Culture", group: "exam", aliases: ["Italian Language and Culture"] },
  { id: "japanese", name: "Japanese Language and Culture", group: "exam", aliases: ["Japanese", "Japanese Language & Culture"] },
  { id: "latin", name: "Latin", group: "exam", aliases: ["Latin"] },
  { id: "music-theory", name: "Music Theory", group: "exam", aliases: ["Music Theory"] },
  { id: "music-theory-aural", name: "Music Theory: aural subscore", group: "subscore", aliases: ["Music Theory: Aural Sub-Score"] },
  { id: "music-theory-nonaural", name: "Music Theory: non-aural subscore", group: "subscore", aliases: ["Music Theory: Non-Aural Sub-Score"] },
  { id: "physics-1", name: "Physics 1", group: "exam", aliases: ["Physics 1"] },
  { id: "physics-2", name: "Physics 2", group: "exam", aliases: ["Physics 2"] },
  { id: "physics-b", name: "Physics B", group: "retired", aliases: ["Physics B"] },
  { id: "physics-c-em", name: "Physics C: Electricity and Magnetism", group: "exam", aliases: ["Physics C E&M", "Physics C: Electricity & Magnetism"] },
  { id: "physics-c-mechanics", name: "Physics C: Mechanics", group: "exam", aliases: ["Physics C Mechanics", "Physics C Meachnics", "Physics C: Mechanics"] },
  { id: "precalculus", name: "Precalculus", group: "exam", aliases: ["Pre-Calculus", "Precalculus"] },
  { id: "psychology", name: "Psychology", group: "exam", aliases: ["Psychology"] },
  { id: "spanish-language", name: "Spanish Language and Culture", group: "exam", aliases: ["Spanish Language and Culture", "Spanish Language"] },
  { id: "spanish-literature", name: "Spanish Literature and Culture", group: "exam", aliases: ["Spanish Literature and Culture", "Spanish Literature"] },
  { id: "statistics", name: "Statistics", group: "exam", aliases: ["Statistics"] },
  { id: "us-government", name: "United States Government and Politics", group: "exam", aliases: ["US Government and Politics", "Government & Politics: United States"] },
  { id: "us-history", name: "United States History", group: "exam", aliases: ["US History"] },
  { id: "world-history", name: "World History: Modern", group: "exam", aliases: ["World History"] },
]

export const COMBINED: Record<string, { exams: string[]; mode: "all" | "any" }> = {
  "Economics - Either Micro or Macro": { exams: ["microeconomics", "macroeconomics"], mode: "any" },
  "Economics - Both Micro and Macro": { exams: ["microeconomics", "macroeconomics"], mode: "all" },
}

export const TYPO_ALIASES = new Set(["Physics C Meachnics"])
