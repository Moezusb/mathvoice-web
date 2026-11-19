"use client"

import { useCallback, useRef } from "react"
import { Lang } from "@/lib/mathvoice"

// Errors that mean the mic or the speech service is unusable. Anything else
// ("no-speech", "aborted") is normal and recognition is simply restarted.
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture", "network"])

// Grace period for Chrome to deliver the final transcript after we stop it.
const FINALIZE_GRACE_MS = 1500

export interface ListenResult {
  transcript: string | null
  error: string | null
}

/**
 * Listens until `accept` returns true for a final transcript, or until
 * `timeoutMs` elapses. Chrome ends recognition on its own after a few seconds
 * of silence, so the session is restarted until the deadline: a child who
 * thinks quietly before answering is still heard.
 */
export function useSpeechRecognition() {
  const recognitionRef = useRef<any>(null)

  const listen = useCallback(
    (lang: Lang, timeoutMs: number, accept: (t: string) => boolean = () => true): Promise<ListenResult> => {
      return new Promise((resolve) => {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

        if (!SpeechRecognition) {
          resolve({ transcript: null, error: "unsupported" })
          return
        }

        const deadline = Date.now() + timeoutMs
        let resolved = false
        let stopping = false
        let latest = ""
        let graceTimer: ReturnType<typeof setTimeout> | null = null
        let recognition: any = null

        const finish = (transcript: string | null, error: string | null = null) => {
          if (resolved) return
          resolved = true
          clearTimeout(windowTimer)
          if (graceTimer) clearTimeout(graceTimer)
          try { recognition?.abort() } catch { /* already stopped */ }
          resolve({ transcript: transcript && transcript.trim() ? transcript.trim() : null, error })
        }

        const startSession = () => {
          recognition = new SpeechRecognition()
          recognitionRef.current = recognition
          recognition.lang = lang === "fr" ? "fr-FR" : "en-US"
          recognition.continuous = true
          recognition.interimResults = true
          recognition.maxAlternatives = 3

          recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i]
              // Prefer the first alternative that contains an acceptable answer.
              let chosen = result[0].transcript
              for (let a = 0; a < result.length; a++) {
                if (accept(result[a].transcript)) { chosen = result[a].transcript; break }
              }
              latest = chosen
              if (result.isFinal && accept(chosen)) {
                finish(chosen)
                return
              }
            }
          }

          recognition.onerror = (event: any) => {
            const code = event?.error || "unknown"
            if (FATAL_ERRORS.has(code)) {
              console.warn("MathVoice: speech recognition error:", code)
              finish(latest || null, code)
            }
          }

          recognition.onend = () => {
            if (resolved) return
            // Chrome stopped by itself (silence or an utterance without a number).
            // Keep listening until the deadline.
            if (!stopping && Date.now() < deadline - 300) {
              try { startSession() } catch { finish(latest) }
            } else {
              finish(latest)
            }
          }

          try {
            recognition.start()
          } catch (err) {
            console.warn("MathVoice: could not start speech recognition", err)
            finish(null, "start-failed")
          }
        }

        const windowTimer = setTimeout(() => {
          stopping = true
          try { recognition?.stop() } catch { /* already stopped */ }
          graceTimer = setTimeout(() => finish(latest), FINALIZE_GRACE_MS)
        }, timeoutMs)

        startSession()
      })
    },
    []
  )

  const stop = useCallback(() => {
    try { recognitionRef.current?.abort() } catch { /* already stopped */ }
  }, [])

  return { listen, stop }
}
