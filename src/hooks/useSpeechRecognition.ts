"use client"

import { useCallback, useRef } from "react"
import { Lang } from "@/lib/mathvoice"

// How long to wait for Chrome to deliver the final transcript after the
// capture window closes. Recognition results arrive a beat after speech ends,
// so stopping and resolving at the same instant throws real answers away.
const FINALIZE_GRACE_MS = 1500

export function useSpeechRecognition() {
  const recognitionRef = useRef<any>(null)

  const listen = useCallback((lang: Lang, timeoutMs = 4000): Promise<string | null> => {
    return new Promise((resolve) => {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (!SpeechRecognition) {
        console.warn("MathVoice: SpeechRecognition is not supported in this browser")
        resolve(null)
        return
      }

      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition
      recognition.lang = lang === "fr" ? "fr-FR" : "en-US"
      recognition.interimResults = true
      recognition.maxAlternatives = 3

      let resolved = false
      let latest = "" // best transcript so far, final or interim
      let graceTimer: ReturnType<typeof setTimeout> | null = null

      const finish = (value: string | null) => {
        if (resolved) return
        resolved = true
        clearTimeout(windowTimer)
        if (graceTimer) clearTimeout(graceTimer)
        resolve(value && value.trim() ? value.trim() : null)
      }

      // When the window closes, ask Chrome to stop and hand over what it heard,
      // instead of discarding it.
      const windowTimer = setTimeout(() => {
        try { recognition.stop() } catch { /* already stopped */ }
        graceTimer = setTimeout(() => finish(latest), FINALIZE_GRACE_MS)
      }, timeoutMs)

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          latest = result[0].transcript
          if (result.isFinal) {
            finish(latest)
            try { recognition.stop() } catch { /* already stopped */ }
            return
          }
        }
      }

      recognition.onerror = (event: any) => {
        // "no-speech" is normal silence; anything else (not-allowed, audio-capture,
        // network) is worth seeing in the browser console when debugging.
        if (event?.error && event.error !== "no-speech" && event.error !== "aborted") {
          console.warn("MathVoice: speech recognition error:", event.error)
        }
        finish(latest)
      }

      recognition.onend = () => finish(latest)

      try {
        recognition.start()
      } catch (err) {
        console.warn("MathVoice: could not start speech recognition", err)
        finish(null)
      }
    })
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return { listen, stop }
}
