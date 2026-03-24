// hooks/useElevenLabsTTS.ts
// Streams ElevenLabs audio and plays it in the browser via Web Audio API

import { useCallback, useRef } from "react"
import { VOICE_IDS, Lang } from "@/lib/mathvoice"

const MODEL_ID = "eleven_multilingual_v2"

export function useElevenLabsTTS() {
  const audioCtxRef = useRef<AudioContext | null>(null)

  const getAudioContext = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext()
    }
    return audioCtxRef.current
  }

  const speak = useCallback(async (text: string, lang: Lang): Promise<void> => {
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY
    if (!apiKey) {
      console.warn("No ElevenLabs API key — falling back to Web Speech API")
      return new Promise((resolve) => {
        const utter = new SpeechSynthesisUtterance(text)
        utter.lang = lang === "fr" ? "fr-FR" : "en-US"
        utter.rate = 0.9
        utter.onend = () => resolve()
        window.speechSynthesis.speak(utter)
      })
    }

    const voiceId = VOICE_IDS[lang]
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        output_format: "mp3_44100_128",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`ElevenLabs TTS error: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const audioCtx = getAudioContext()

    // Resume context if suspended (browser autoplay policy)
    if (audioCtx.state === "suspended") {
      await audioCtx.resume()
    }

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    const source = audioCtx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioCtx.destination)

    return new Promise((resolve) => {
      source.onended = () => resolve()
      source.start(0)
    })
  }, [])

  return { speak }
}
