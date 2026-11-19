// hooks/useElevenLabsTTS.ts
// Fetches ElevenLabs audio through the server-side /api/tts route and plays it
// with the Web Audio API. Falls back to the browser's built-in voice if the
// route is unavailable (no key configured, credits exhausted, or network error).

import { useCallback, useRef } from "react"
import { Lang } from "@/lib/mathvoice"

function browserSpeak(text: string, lang: Lang): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return resolve()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang === "fr" ? "fr-FR" : "en-US"
    utter.rate = 0.9
    utter.onend = () => resolve()
    utter.onerror = () => resolve()
    window.speechSynthesis.speak(utter)
  })
}

export function useElevenLabsTTS() {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const premiumAvailable = useRef(true)

  const getAudioContext = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext()
    }
    return audioCtxRef.current
  }

  const speak = useCallback(async (text: string, lang: Lang): Promise<void> => {
    // After one failure in a session, stay on the browser voice instead of retrying every line.
    if (!premiumAvailable.current) return browserSpeak(text, lang)

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      })
      if (!response.ok) throw new Error(`TTS route returned ${response.status}`)

      const arrayBuffer = await response.arrayBuffer()
      const audioCtx = getAudioContext()
      // Resume context if suspended (browser autoplay policy)
      if (audioCtx.state === "suspended") await audioCtx.resume()

      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
      const source = audioCtx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioCtx.destination)

      return new Promise((resolve) => {
        source.onended = () => resolve()
        source.start(0)
      })
    } catch (err) {
      console.warn("ElevenLabs unavailable, falling back to browser voice", err)
      premiumAvailable.current = false
      return browserSpeak(text, lang)
    }
  }, [])

  return { speak }
}
