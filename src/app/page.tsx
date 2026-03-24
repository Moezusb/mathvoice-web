"use client"

import { useState, useCallback, useEffect } from "react"
import { useElevenLabsTTS } from "@/hooks/useElevenLabsTTS"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import {
  Lang, Grade, Question,
  generateQuestion, extractNumber, endingCategory, fillTemplate, pickRandom,
  GREETINGS, CORRECT, WRONG, ENDINGS, NO_HEAR, LISTEN_PROMPT,
} from "@/lib/mathvoice"

const TOTAL_QUESTIONS = 5

type Phase =
  | "setup"
  | "greeting"
  | "question"
  | "listening"
  | "feedback"
  | "finished"

interface SessionState {
  lang: Lang
  grade: Grade
  questions: Question[]
  current: number
  score: number
  lastCorrect: boolean | null
  endingText: string
}

// ─── SETUP SCREEN ─────────────────────────────────────────────────────────────

function SetupScreen({ onStart }: { onStart: (lang: Lang, grade: Grade) => void }) {
  const [lang, setLang] = useState<Lang>("en")
  const [grade, setGrade] = useState<Grade>(1)

  return (
    <div className="setup-screen">
      <div className="logo-mark">MV</div>
      <h1 className="app-title">MathVoice</h1>
      <p className="app-subtitle">
        {lang === "en"
          ? "A voice math tutor that speaks and listens."
          : "Un tuteur de maths qui parle et écoute."}
      </p>

      <div className="setup-group">
        <label className="setup-label">
          {lang === "en" ? "Language" : "Langue"}
        </label>
        <div className="toggle-row">
          {(["en", "fr"] as Lang[]).map((l) => (
            <button
              key={l}
              className={`toggle-btn ${lang === l ? "active" : ""}`}
              onClick={() => setLang(l)}
            >
              {l === "en" ? "🇨🇦 English" : "🇫🇷 Français"}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-group">
        <label className="setup-label">
          {lang === "en" ? "Grade" : "Niveau"}
        </label>
        <div className="toggle-row">
          {([1, 2, 3] as Grade[]).map((g) => (
            <button
              key={g}
              className={`toggle-btn ${grade === g ? "active" : ""}`}
              onClick={() => setGrade(g)}
            >
              {lang === "en" ? `Grade ${g}` : `Niveau ${g}`}
            </button>
          ))}
        </div>
        <p className="grade-hint">
          {lang === "en" ? (
            grade === 1 ? "Addition & subtraction up to 20"
            : grade === 2 ? "Up to 100, intro to multiplication"
            : "All operations, times tables up to 10"
          ) : (
            grade === 1 ? "Addition & soustraction jusqu'à 20"
            : grade === 2 ? "Jusqu'à 100, initiation à la multiplication"
            : "Toutes les opérations, tables jusqu'à 10"
          )}
        </p>
      </div>

      <button className="start-btn" onClick={() => onStart(lang, grade)}>
        {lang === "en" ? "Start Session" : "Commencer"}
        <span className="start-arrow">→</span>
      </button>

      <p className="elevenlabs-credit">
        Voice by{" "}
        <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer">
          ElevenLabs
        </a>
      </p>
    </div>
  )
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = (current / total) * 100
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${pct}%` }} />
      <span className="progress-label">{current}/{total}</span>
    </div>
  )
}

// ─── WAVEFORM ANIMATION ───────────────────────────────────────────────────────

function Waveform({ active }: { active: boolean }) {
  return (
    <div className={`waveform ${active ? "waveform--active" : ""}`}>
      {[...Array(7)].map((_, i) => (
        <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  )
}

// ─── MAIN SESSION ─────────────────────────────────────────────────────────────

function SessionScreen({ session, phase, onRestart }: {
  session: SessionState
  phase: Phase
  onRestart: () => void
}) {
  const q = session.questions[session.current]
  const isListening = phase === "listening"
  const isFinished = phase === "finished"

  const scoreEmoji = () => {
    const pct = session.score / TOTAL_QUESTIONS
    if (pct === 1) return "🌟"
    if (pct >= 0.7) return "🎉"
    if (pct >= 0.5) return "👍"
    return "💪"
  }

  return (
    <div className="session-screen">
      {!isFinished && (
        <ProgressBar current={session.current} total={TOTAL_QUESTIONS} />
      )}

      <div className={`card ${phase === "feedback" ? (session.lastCorrect ? "card--correct" : "card--wrong") : ""} ${isFinished ? "card--finished" : ""}`}>

        {isFinished ? (
          <div className="finished-inner">
            <div className="finished-emoji">{scoreEmoji()}</div>
            <div className="finished-score">
              {session.score}<span className="finished-total">/{TOTAL_QUESTIONS}</span>
            </div>
            <p className="finished-text">{session.endingText}</p>
            <button className="restart-btn" onClick={onRestart}>
              {session.lang === "en" ? "Play Again" : "Rejouer"}
            </button>
          </div>
        ) : (
          <div className="question-inner">
            <div className="op-badge">
              {q?.op === "add" ? "+" : q?.op === "sub" ? "−" : "×"}
            </div>

            <div className="numbers-display">
              <span className="number-a">{q?.a}</span>
              <span className="op-symbol">
                {q?.op === "add" ? "+" : q?.op === "sub" ? "−" : "×"}
              </span>
              <span className="number-b">{q?.b}</span>
              <span className="op-symbol">=</span>
              <span className={`number-answer ${phase === "listening" ? "number-answer--blank" : ""}`}>
                {phase === "listening" ? "?" : "?"}
              </span>
            </div>

            <p className="question-text">{q?.text}</p>

            <Waveform active={isListening} />

            <p className="phase-label">
              {phase === "question" && (session.lang === "en" ? "Listen carefully..." : "Écoute bien...")}
              {phase === "listening" && LISTEN_PROMPT[session.lang]}
              {phase === "feedback" && (session.lastCorrect
                ? (session.lang === "en" ? "Correct! ✓" : "Correct! ✓")
                : (session.lang === "en" ? "Keep going! →" : "Continue! →")
              )}
              {phase === "greeting" && (session.lang === "en" ? "Get ready..." : "Prépare-toi...")}
            </p>
          </div>
        )}
      </div>

      <div className="score-strip">
        {[...Array(TOTAL_QUESTIONS)].map((_, i) => (
          <div
            key={i}
            className={`score-dot ${i < session.current ? (i < session.score + (TOTAL_QUESTIONS - session.current) ? "score-dot--done" : "score-dot--done") : "score-dot--pending"}`}
          />
        ))}
      </div>
    </div>
  )
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

export default function MathVoice() {
  const [phase, setPhase] = useState<Phase>("setup")
  const [session, setSession] = useState<SessionState | null>(null)
  const { speak } = useElevenLabsTTS()
  const { listen } = useSpeechRecognition()

  const startSession = useCallback(async (lang: Lang, grade: Grade) => {
    const questions = Array.from({ length: TOTAL_QUESTIONS }, () =>
      generateQuestion(grade, lang)
    )
    const newSession: SessionState = {
      lang, grade, questions, current: 0, score: 0,
      lastCorrect: null, endingText: "",
    }
    setSession(newSession)
    setPhase("greeting")

    // Greet
    const greeting = pickRandom(GREETINGS[lang])
    await speak(greeting, lang)

    // Start first question
    runQuestion(newSession, 0)
  }, [speak])

  const runQuestion = useCallback(async (sess: SessionState, idx: number) => {
    const q = sess.questions[idx]
    setPhase("question")
    await speak(q.text, sess.lang)

    setPhase("listening")
    await speak(LISTEN_PROMPT[sess.lang], sess.lang)

    const transcript = await listen(sess.lang, 7000)
    const number = extractNumber(transcript || "")

    let correct = false
    let feedbackText = ""

    if (number !== null) {
      correct = number === q.answer
      if (correct) {
        feedbackText = pickRandom(CORRECT[sess.lang])
      } else {
        feedbackText = fillTemplate(pickRandom(WRONG[sess.lang]), { answer: q.answer })
      }
    } else {
      feedbackText = fillTemplate(NO_HEAR[sess.lang], { answer: q.answer })
    }

    const newScore = correct ? sess.score + 1 : sess.score
    const updatedSession = { ...sess, score: newScore, lastCorrect: correct }
    setSession(updatedSession)
    setPhase("feedback")
    await speak(feedbackText, sess.lang)

    const nextIdx = idx + 1
    if (nextIdx < TOTAL_QUESTIONS) {
      runQuestion({ ...updatedSession, current: nextIdx }, nextIdx)
      setSession(prev => prev ? { ...prev, current: nextIdx } : prev)
    } else {
      // End session
      const cat = endingCategory(newScore, TOTAL_QUESTIONS)
      const endText = fillTemplate(ENDINGS[sess.lang][cat], {
        score: newScore, total: TOTAL_QUESTIONS
      })
      await speak(endText, sess.lang)
      setSession(prev => prev ? { ...prev, endingText: endText } : prev)
      setPhase("finished")
    }
  }, [speak, listen])

  const restart = useCallback(() => {
    setSession(null)
    setPhase("setup")
  }, [])

  if (phase === "setup" || !session) {
    return (
      <main className="app-shell">
        <SetupScreen onStart={startSession} />
      </main>
    )
  }

  return (
    <main className="app-shell">
      <SessionScreen session={session} phase={phase} onRestart={restart} />
    </main>
  )
}
