// lib/mathvoice.ts — Game logic, question generation, content

export type Lang = "en" | "fr"
export type Grade = 1 | 2 | 3
export type Op = "add" | "sub" | "mul"

export interface Question {
  op: Op
  a: number
  b: number
  answer: number
  text: string
}

// ─── CONTENT ─────────────────────────────────────────────────────────────────

export const VOICE_IDS: Record<Lang, string> = {
  en: "EXAVITQu4vr4xnSDxMaL", // Bella — warm, clear
  fr: "onwK4e9ZLuTAKqWW03F9", // Daniel — native French
}

export const GREETINGS: Record<Lang, string[]> = {
  en: [
    "Hi there! I'm MathVoice, your math buddy. Let's do some math together!",
    "Hello! Ready to practise some math? Let's go!",
    "Hey! Great to see you. Time for some math fun!",
  ],
  fr: [
    "Salut! Je suis MathVoice, ton ami des maths. On va s'entraîner ensemble!",
    "Bonjour! Tu es prêt à faire des maths? C'est parti!",
    "Coucou! Super de te voir. C'est l'heure des maths!",
  ],
}

export const CORRECT: Record<Lang, string[]> = {
  en: [
    "That's right! Great job!",
    "Correct! You're doing amazing!",
    "Yes! Excellent work!",
    "Fantastic! You got it!",
    "Brilliant! Exactly right!",
  ],
  fr: [
    "C'est exact! Bravo!",
    "Correct! Tu te débrouilles très bien!",
    "Oui! Excellent travail!",
    "Fantastique! Tu as trouvé!",
    "Brillant! Exactement juste!",
  ],
}

export const WRONG: Record<Lang, string[]> = {
  en: [
    "Not quite — the answer is {answer}. You'll get the next one!",
    "Almost! It's actually {answer}. Keep going, you're doing great!",
    "Good try! The answer was {answer}. Let's try another one.",
  ],
  fr: [
    "Pas tout à fait — la réponse est {answer}. Tu vas avoir le prochain!",
    "Presque! C'est en fait {answer}. Continue, tu t'en sors très bien!",
    "Bonne tentative! La réponse était {answer}. Essayons-en un autre.",
  ],
}

export const QUESTION_TEMPLATES: Record<Lang, Record<Op, string>> = {
  en: {
    add: "What is {a} plus {b}?",
    sub: "What is {a} minus {b}?",
    mul: "What is {a} times {b}?",
  },
  fr: {
    add: "Combien font {a} plus {b}?",
    sub: "Combien font {a} moins {b}?",
    mul: "Combien font {a} fois {b}?",
  },
}

export const ENDINGS: Record<Lang, Record<string, string>> = {
  en: {
    perfect: "Incredible! You got {score} out of {total}! You're a math star!",
    great:   "Well done! {score} out of {total}. Keep practising — you're unstoppable!",
    good:    "Nice effort! {score} out of {total}. Practice makes perfect!",
    keep_going: "Good start! {score} out of {total}. Let's practise more soon!",
  },
  fr: {
    perfect: "Incroyable! Tu as eu {score} sur {total}! Tu es une star des maths!",
    great:   "Bravo! {score} sur {total}. Continue — tu es imbattable!",
    good:    "Bel effort! {score} sur {total}. C'est en forgeant qu'on devient forgeron!",
    keep_going: "Bon début! {score} sur {total}. Entraînons-nous encore bientôt!",
  },
}

export const NO_HEAR: Record<Lang, string> = {
  en: "I didn't catch that. The answer was {answer}.",
  fr: "Je n'ai pas entendu. La réponse était {answer}.",
}

export const LISTEN_PROMPT: Record<Lang, string> = {
  en: "Your turn — say your answer!",
  fr: "À toi — dis ta réponse!",
}

// ─── QUESTION GENERATOR ──────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateQuestion(grade: Grade, lang: Lang): Question {
  let op: Op
  let a: number
  let b: number

  if (grade === 1) {
    op = pick<Op>(["add", "sub"])
    a = Math.floor(Math.random() * 10) + 1
    b = Math.floor(Math.random() * 10) + 1
    if (op === "sub") { [a, b] = [Math.max(a, b), Math.min(a, b)] }
  } else if (grade === 2) {
    op = pick<Op>(["add", "add", "sub", "mul"])
    if (op === "mul") {
      a = pick([2, 5, 10])
      b = Math.floor(Math.random() * 10) + 1
    } else {
      a = Math.floor(Math.random() * 40) + 10
      b = Math.floor(Math.random() * 20) + 1
      if (op === "sub") { [a, b] = [Math.max(a, b), Math.min(a, b)] }
    }
  } else {
    op = pick<Op>(["add", "sub", "mul"])
    if (op === "mul") {
      a = Math.floor(Math.random() * 9) + 2
      b = Math.floor(Math.random() * 9) + 2
    } else {
      a = Math.floor(Math.random() * 90) + 10
      b = Math.floor(Math.random() * 50) + 1
      if (op === "sub") { [a, b] = [Math.max(a, b), Math.min(a, b)] }
    }
  }

  const answer = op === "add" ? a + b : op === "sub" ? a - b : a * b
  const template = QUESTION_TEMPLATES[lang][op]
  const text = template.replace("{a}", String(a)).replace("{b}", String(b))

  return { op, a, b, answer, text }
}

export function endingCategory(score: number, total: number): string {
  const pct = score / total
  if (pct === 1)    return "perfect"
  if (pct >= 0.7)   return "great"
  if (pct >= 0.5)   return "good"
  return "keep_going"
}

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (str, [k, v]) => str.replace(`{${k}}`, String(v)),
    template
  )
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── NUMBER PARSING ───────────────────────────────────────────────────────────

const WORD_MAP: Record<string, number> = {
  zero: 0, zéro: 0,
  one: 1, un: 1, une: 1,
  two: 2, deux: 2,
  three: 3, trois: 3,
  four: 4, quatre: 4,
  five: 5, cinq: 5,
  six: 6,
  seven: 7, sept: 7,
  eight: 8, huit: 8,
  nine: 9, neuf: 9,
  ten: 10, dix: 10,
  eleven: 11, onze: 11,
  twelve: 12, douze: 12,
  thirteen: 13, treize: 13,
  fourteen: 14, quatorze: 14,
  fifteen: 15, quinze: 15,
  sixteen: 16, seize: 16,
  seventeen: 17, "dix-sept": 17,
  eighteen: 18, "dix-huit": 18,
  nineteen: 19, "dix-neuf": 19,
  twenty: 20, vingt: 20,
  thirty: 30, trente: 30,
  forty: 40, quarante: 40,
  fifty: 50, cinquante: 50,
  sixty: 60, soixante: 60,
  seventy: 70, "soixante-dix": 70,
  eighty: 80, "quatre-vingts": 80, "quatre-vingt": 80,
  ninety: 90, "quatre-vingt-dix": 90,
  hundred: 100, cent: 100,
}

export function extractNumber(text: string): number | null {
  if (!text) return null
  const tokens = text.toLowerCase().replace(/-/g, " ").split(/\s+/)
  for (const token of tokens) {
    if (token in WORD_MAP) return WORD_MAP[token]
    const n = parseInt(token, 10)
    if (!isNaN(n)) return n
  }
  return null
}
