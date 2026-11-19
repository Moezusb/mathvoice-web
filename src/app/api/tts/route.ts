// app/api/tts/route.ts
// Server-side proxy for ElevenLabs text-to-speech.
// The API key stays on the server; the browser only ever sees audio.

import { NextRequest, NextResponse } from "next/server"
import { VOICE_IDS, Lang } from "@/lib/mathvoice"

const MODEL_ID = "eleven_multilingual_v2"
const MAX_TEXT_CHARS = 300

// Best-effort rate limit. Serverless instances do not share memory, so this
// slows abuse rather than stopping it. Set a usage cap on the ElevenLabs key too.
const WINDOW_MS = 60 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 120
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > MAX_REQUESTS_PER_WINDOW
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    console.error("tts: ELEVENLABS_API_KEY is not set")
    return NextResponse.json({ error: "TTS not configured" }, { status: 503 })
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown"
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  let body: { text?: unknown; lang?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const text = typeof body.text === "string" ? body.text.trim() : ""
  const lang = body.lang === "fr" ? "fr" : body.lang === "en" ? "en" : null
  if (!text || !lang || text.length > MAX_TEXT_CHARS) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_IDS[lang as Lang]}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      output_format: "mp3_44100_128",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
    }),
  })

  if (!upstream.ok) {
    console.error(`tts: ElevenLabs returned ${upstream.status}`)
    // 401/402/429 from ElevenLabs usually mean the key is out of credits or rate-limited.
    return NextResponse.json({ error: "TTS unavailable" }, { status: 502 })
  }

  console.log(`tts: ok (${lang}, ${text.length} chars)`)
  return new NextResponse(upstream.body, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  })
}
