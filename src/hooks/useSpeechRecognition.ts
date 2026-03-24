// hooks/useSpeechRecognition.ts
// Browser Web Speech API wrapper

import { useCallback, useRef } from "react"
import { Lang } from "@/lib/mathvoice"

export function useSpeechRecognition() {
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const listen = useCallback((lang: Lang, timeoutMs = 6000): Promise<string | null> => {
    return new Promise((resolve) => {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (!SpeechRecognition) {
        resolve(null)
        return
      }

      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition
      recognition.lang = lang === "fr" ? "fr-FR" : "en-US"
      recognition.interimResults = false
      recognition.maxAlternatives = 3

      let resolved = false
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          recognition.stop()
          resolve(null)
        }
      }, timeoutMs)

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        clearTimeout(timeout)
        if (!resolved) {
          resolved = true
          const transcript = event.results[0][0].transcript
          resolve(transcript)
        }
      }

      recognition.onerror = () => {
        clearTimeout(timeout)
        if (!resolved) {
          resolved = true
          resolve(null)
        }
      }

      recognition.onend = () => {
        clearTimeout(timeout)
        if (!resolved) {
          resolved = true
          resolve(null)
        }
      }

      recognition.start()
    })
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return { listen, stop }
}
