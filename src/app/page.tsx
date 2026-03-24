"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useElevenLabsTTS } from "@/hooks/useElevenLabsTTS"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import {
  Lang, Grade, Question,
  generateQuestion, extractNumber, endingCategory, fillTemplate, pickRandom,
  GREETINGS, CORRECT, WRONG, ENDINGS, NO_HEAR, LISTEN_PROMPT,
} from "@/lib/mathvoice"

const TOTAL_QUESTIONS = 5
const COUNTDOWN_SECONDS = 7
const CAPTURE_WINDOW_MS = 2000

type Phase =
  | "setup"
  | "requesting_mic"
  | "greeting"
  | "question"
  | "countdown"
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
        <label className="setup-label">{lang === "en" ? "Language" : "Langue"}</label>
        <div className="toggle-row">
          {(["en", "fr"] as Lang[]).map((l) => (
            <button key={l} className={`toggle-btn ${lang === l ? "active" : ""}`} onClick={() => setLang(l)}>
              {l === "en" ? "🇨🇦 English" : "🇫🇷 Français"}
            </button>
          ))}
        </div>
      </div>
      <div className="setup-group">
        <label className="setup-label">{lang === "en" ? "Grade" : "Niveau"}</label>
        <div className="toggle-row">
          {([1, 2, 3] as Grade[]).map((g) => (
            <button key={g} className={`toggle-btn ${grade === g ? "active" : ""}`} onClick={() => setGrade(g)}>
              {lang === "en" ? `Grade ${g}` : `Niveau ${g}`}
            </button>
          ))}
        </div>
        <p className="grade-hint">
          {lang === "en"
            ? grade === 1 ? "Addition & subtraction up to 20" : grade === 2 ? "Up to 100, intro to multiplication" : "All operations, times tables up to 10"
            : grade === 1 ? "Addition & soustraction jusqu'à 20" : grade === 2 ? "Jusqu'à 100, initiation à la multiplication" : "Toutes les opérations, tables jusqu'à 10"}
        </p>
      </div>
      <div className="how-it-works">
        <p className="how-it-works-title">
          {lang === "en" ? "How it works" : "Comment ça marche"}
        </p>
        <p className="how-it-works-step">
          {lang === "en" ? "🔊  Listen to the question" : "🔊  Écoute la question"}
        </p>
        <p className="how-it-works-step">
          {lang === "en" ? "⏳  7 seconds to think" : "⏳  7 secondes pour réfléchir"}
        </p>
        <p className="how-it-works-step">
          {lang === "en" ? "🎤  Say your answer when you see the mic" : "🎤  Dis ta réponse quand tu vois le micro"}
        </p>
      </div>
      <button className="start-btn" onClick={() => onStart(lang, grade)}>
        {lang === "en" ? "Start Session" : "Commencer"}<span className="start-arrow">→</span>
      </button>
      <p className="elevenlabs-credit">Voice by <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer">ElevenLabs</a></p>
    </div>
  )
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${(current / total) * 100}%` }} />
      <span className="progress-label">{current}/{total}</span>
    </div>
  )
}

function CountdownRing({ seconds, total, capturing }: { seconds: number; total: number; capturing: boolean }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - seconds / total)
  return (
    <div className="countdown-wrapper">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="4" />
        <circle cx="36" cy="36" r={radius} fill="none"
          stroke={capturing ? "var(--correct)" : "var(--accent)"}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          transform="rotate(-90 36 36)"
          style={{ transition: "stroke-dashoffset 0.2s linear, stroke 0.3s ease" }}
        />
      </svg>
      <div className="countdown-number" style={{ color: capturing ? "var(--correct)" : "var(--accent)" }}>
        {capturing ? "🎤" : seconds}
      </div>
    </div>
  )
}

function Waveform({ active }: { active: boolean }) {
  return (
    <div className={`waveform ${active ? "waveform--active" : ""}`}>
      {[...Array(7)].map((_, i) => (
        <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  )
}

function SessionScreen({ session, phase, countdown, capturing, onRestart }: {
  session: SessionState; phase: Phase; countdown: number; capturing: boolean; onRestart: () => void
}) {
  const q = session.questions[session.current]
  const isFinished = phase === "finished"
  const showCountdown = phase === "countdown" || phase === "listening"

  const scoreEmoji = () => {
    const pct = session.score / TOTAL_QUESTIONS
    if (pct === 1) return "🌟"
    if (pct >= 0.7) return "🎉"
    if (pct >= 0.5) return "👍"
    return "💪"
  }

  return (
    <div className="session-screen">
      {!isFinished && <ProgressBar current={session.current} total={TOTAL_QUESTIONS} />}
      <div className={`card ${phase === "feedback" ? (session.lastCorrect ? "card--correct" : "card--wrong") : ""} ${isFinished ? "card--finished" : ""}`}>
        {phase === "requesting_mic" && (
          <div className="question-inner">
            <div style={{ fontSize: 48 }}>🎤</div>
            <p className="question-text" style={{ textAlign: "center" }}>
              {session.lang === "en" ? "Please allow microphone access when prompted." : "Veuillez autoriser l'accès au microphone."}
            </p>
          </div>
        )}
        {isFinished && (
          <div className="finished-inner">
            <div className="finished-emoji">{scoreEmoji()}</div>
            <div className="finished-score">{session.score}<span className="finished-total">/{TOTAL_QUESTIONS}</span></div>
            <p className="finished-text">{session.endingText}</p>
            <button className="restart-btn" onClick={onRestart}>{session.lang === "en" ? "Play Again" : "Rejouer"}</button>
          </div>
        )}
        {!isFinished && phase !== "requesting_mic" && (
          <div className="question-inner">
            <div className="op-badge">{q?.op === "add" ? "+" : q?.op === "sub" ? "−" : "×"}</div>
            <div className="numbers-display">
              <span className="number-a">{q?.a}</span>
              <span className="op-symbol">{q?.op === "add" ? "+" : q?.op === "sub" ? "−" : "×"}</span>
              <span className="number-b">{q?.b}</span>
              <span className="op-symbol">=</span>
              <span className={`number-answer ${showCountdown ? "number-answer--blank" : ""}`}>?</span>
            </div>
            <p className="question-text">{q?.text}</p>
            {showCountdown
              ? <CountdownRing seconds={countdown} total={COUNTDOWN_SECONDS} capturing={capturing} />
              : <Waveform active={false} />
            }
            <p className="phase-label">
              {phase === "question" && (session.lang === "en" ? "Listen carefully..." : "Écoute bien...")}
              {phase === "countdown" && !capturing && (session.lang === "en" ? "Get ready to answer..." : "Prépare ta réponse...")}
              {phase === "countdown" && capturing && (session.lang === "en" ? "Say your answer now!" : "Dis ta réponse!")}
              {phase === "listening" && (session.lang === "en" ? "Listening..." : "J'écoute...")}
              {phase === "feedback" && (session.lastCorrect ? "Correct! ✓" : (session.lang === "en" ? "Keep going! →" : "Continue! →"))}
              {phase === "greeting" && (session.lang === "en" ? "Get ready..." : "Prépare-toi...")}
            </p>
          </div>
        )}
      </div>
      <div className="score-strip">
        {[...Array(TOTAL_QUESTIONS)].map((_, i) => (
          <div key={i} className={`score-dot ${i < session.current ? "score-dot--done" : "score-dot--pending"}`} />
        ))}
      </div>
    </div>
  )
}

export default function MathVoice() {
  const [phase, setPhase] = useState<Phase>("setup")
  const [session, setSession] = useState<SessionState | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [capturing, setCapturing] = useState(false)
  const { speak } = useElevenLabsTTS()
  const { listen } = useSpeechRecognition()

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      return true
    } catch {
      return false
    }
  }, [])

  const runCountdownThenListen = useCallback(async (lang: Lang): Promise<string | null> => {
    setCapturing(false)
    for (let i = COUNTDOWN_SECONDS; i >= 1; i--) {
      setCountdown(i)
      setPhase("countdown")
      await new Promise(r => setTimeout(r, 1000))
    }
    setCapturing(true)
    setCountdown(0)
    setPhase("listening")
    const transcript = await listen(lang, CAPTURE_WINDOW_MS)
    setCapturing(false)
    return transcript
  }, [listen])

  const runQuestion = useCallback(async (sess: SessionState, idx: number) => {
    const q = sess.questions[idx]
    setPhase("question")
    await speak(q.text, sess.lang)

    const transcript = await runCountdownThenListen(sess.lang)
    const number = extractNumber(transcript || "")

    let correct = false
    let feedbackText = ""

    if (number !== null) {
      correct = number === q.answer
      feedbackText = correct
        ? pickRandom(CORRECT[sess.lang])
        : fillTemplate(pickRandom(WRONG[sess.lang]), { answer: q.answer })
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
      const nextSession = { ...updatedSession, current: nextIdx }
      setSession(nextSession)
      runQuestion(nextSession, nextIdx)
    } else {
      const cat = endingCategory(newScore, TOTAL_QUESTIONS)
      const endText = fillTemplate(ENDINGS[sess.lang][cat], { score: newScore, total: TOTAL_QUESTIONS })
      await speak(endText, sess.lang)
      setSession(prev => prev ? { ...prev, endingText: endText } : prev)
      setPhase("finished")
    }
  }, [speak, runCountdownThenListen])

  const startSession = useCallback(async (lang: Lang, grade: Grade) => {
    const questions = Array.from({ length: TOTAL_QUESTIONS }, () => generateQuestion(grade, lang))
    const newSession: SessionState = { lang, grade, questions, current: 0, score: 0, lastCorrect: null, endingText: "" }
    setSession(newSession)
    setPhase("requesting_mic")
    await requestMicPermission()
    setPhase("greeting")
    await speak(pickRandom(GREETINGS[lang]), lang)
    runQuestion(newSession, 0)
  }, [speak, requestMicPermission, runQuestion])

  const restart = useCallback(() => {
    setSession(null)
    setCountdown(COUNTDOWN_SECONDS)
    setCapturing(false)
    setPhase("setup")
  }, [])

  if (phase === "setup" || !session) {
    return <main className="app-shell"><SetupScreen onStart={startSession} /></main>
  }

  return (
    <main className="app-shell">
      <SessionScreen session={session} phase={phase} countdown={countdown} capturing={capturing} onRestart={restart} />
    </main>
  )
}
