# MathVoice Web 🎙️✖️➕

**A bilingual voice math tutor for Grade 1–3, powered by ElevenLabs.**

Live demo: `https://mathvoice.vercel.app` ← deploy yours below

MathVoice runs entirely in the browser. No app to install. No downloads.
ElevenLabs voices the questions. The Web Speech API listens for answers.
The child speaks. MathVoice responds.

---

## Demo

1. Choose English or French
2. Choose your grade (1, 2, or 3)
3. Hit Start — MathVoice greets you by voice
4. Listen to the question, say your answer out loud
5. Get instant voiced feedback — encouragement or gentle correction
6. 5 questions, then a scored summary

---

## Deploy to Vercel (2 minutes)

**Step 1 — Push to GitHub**
```bash
git clone https://github.com/Moezusb/mathvoice-web.git
# or create a new repo and push this code
```

**Step 2 — Import on Vercel**
- Go to [vercel.com/new](https://vercel.com/new)
- Import your GitHub repo
- Add environment variable:
  - Key: `NEXT_PUBLIC_ELEVENLABS_API_KEY`
  - Value: your ElevenLabs API key ([get one here](https://elevenlabs.io/app/settings/api-keys))
- Deploy

That's it. Vercel handles the build automatically.

---

## Run locally

```bash
npm install
cp .env.local.example .env.local
# Add your ElevenLabs API key to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture

```
Browser
  ├── ElevenLabs REST API  →  TTS voice output (ElevenLabs SDK)
  └── Web Speech API       →  Speech-to-text input (browser native)

No backend. No database. Stateless session.
```

**Graceful fallback:** If no API key is set, MathVoice falls back to the browser's
built-in Web Speech synthesis — lower quality but fully functional for testing.

**A note on the API key:** For this demo, the key is client-side (`NEXT_PUBLIC_`).
For production, proxy TTS requests through a backend route to keep the key server-side.

---

## Why ElevenLabs

Voice quality is the product for a child learning to listen and respond.
Robotic TTS breaks engagement in seconds.

ElevenLabs' `eleven_multilingual_v2` model delivers:
- Natural pacing and warmth — children lean in rather than tune out
- Native-quality French — not translated English with a French accent
- Emotional expressiveness — encouragement sounds like encouragement

The bilingual EN/FR capability reflects a real deployment need: French-first learners
in Quebec, West Africa, and across the Francophone world deserve the same quality of
voice interaction as English-speaking children.

---

## Built by

**Mohamed Bah** — [moezusb.github.io](https://moezusb.github.io) · [LinkedIn](https://linkedin.com/in/mohamedmoezus)

*"Great science is artistic at its core."*
