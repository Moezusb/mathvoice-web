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
const CAPTURE_WINDOW_MS = 4000

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
          {lang === "en" ? "⏳  Take your time to think" : "⏳  Prends le temps de réfléchir"}
        </p>
        <p className="how-it-works-step">
          {lang === "en" ? "🎤  Say your answer out loud whenever you're ready" : "🎤  Dis ta réponse à voix haute quand tu es prêt"}
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
        {seconds > 0 ? seconds : "🎤"}
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

const MIC_ERROR_TEXT: Record<string, Record<Lang, string>> = {
  "not-allowed": {
    en: "MathVoice can't use your microphone. Click the icon left of the address bar and allow the microphone, then restart.",
    fr: "MathVoice n'a pas accès au micro. Clique sur l'icône à gauche de l'adresse, autorise le micro, puis recommence.",
  },
  "service-not-allowed": {
    en: "Speech recognition is blocked in this browser. Use Google Chrome.",
    fr: "La reconnaissance vocale est bloquée dans ce navigateur. Utilise Google Chrome.",
  },
  "audio-capture": {
    en: "No microphone was found. Check that one is connected and selected in Chrome's settings.",
    fr: "Aucun micro détecté. Vérifie qu'un micro est branché et choisi dans les réglages de Chrome.",
  },
  "network": {
    en: "Speech recognition needs an internet connection to Google. Check your connection or VPN.",
    fr: "La reconnaissance vocale a besoin d'une connexion à Google. Vérifie ta connexion ou ton VPN.",
  },
  "unsupported": {
    en: "This browser doesn't support speech recognition. Open MathVoice in Google Chrome.",
    fr: "Ce navigateur ne gère pas la reconnaissance vocale. Ouvre MathVoice dans Google Chrome.",
  },
}

function SessionScreen({ session, phase, countdown, capturing, micError, onRestart }: {
  session: SessionState; phase: Phase; countdown: number; capturing: boolean; micError: string | null; onRestart: () => void
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
      {micError && (
        <div className="mic-error" role="alert">
          {(MIC_ERROR_TEXT[micError] || MIC_ERROR_TEXT["not-allowed"])[session.lang]}
        </div>
      )}
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
              {phase === "countdown" && (session.lang === "en" ? "🎤 Listening: say your answer when you're ready" : "🎤 J'écoute : dis ta réponse quand tu es prêt")}
              {phase === "listening" && (session.lang === "en" ? "🎤 Last few seconds: say your answer!" : "🎤 Dernières secondes : dis ta réponse!")}
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
  const [micError, setMicError] = useState<string | null>(null)
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
    // The mic opens as soon as the question ends, so an answer given during
    // the thinking time counts. The countdown is a visual guide, not a gate.
    setCapturing(true)
    setPhase("countdown")
    let answered = false
    const totalMs = COUNTDOWN_SECONDS * 1000 + CAPTURE_WINDOW_MS
    const listening = listen(lang, totalMs, (t) => extractNumber(t) !== null).then((r) => {
      answered = true
      return r
    })
    for (let i = COUNTDOWN_SECONDS; i >= 1 && !answered; i--) {
      setCountdown(i)
      await new Promise(r => setTimeout(r, 1000))
    }
    if (!answered) {
      setCountdown(0)
      setPhase("listening")
    }
    const result = await listening
    setCapturing(false)
    if (result.error) setMicError(result.error)
    return result.transcript
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
    setMicError(null)
    const micOk = await requestMicPermission()
    if (!micOk) setMicError("not-allowed")
    setPhase("greeting")
    await speak(pickRandom(GREETINGS[lang]), lang)
    runQuestion(newSession, 0)
  }, [speak, requestMicPermission, runQuestion])

  const restart = useCallback(() => {
    setSession(null)
    setCountdown(COUNTDOWN_SECONDS)
    setCapturing(false)
    setMicError(null)
    setPhase("setup")
  }, [])

  if (phase === "setup" || !session) {
    return <main className="app-shell"><SetupScreen onStart={startSession} /></main>
  }

  return (
    <main className="app-shell">
      <SessionScreen session={session} phase={phase} countdown={countdown} capturing={capturing} micError={micError} onRestart={restart} />
    </main>
  )
}
