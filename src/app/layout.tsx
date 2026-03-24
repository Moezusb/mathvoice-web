import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "MathVoice — Bilingual Voice Math Tutor",
  description:
    "A bilingual EN/FR voice math tutor for Grade 1–3, built on ElevenLabs. Speak your answer. Hear the feedback. Learn.",
  openGraph: {
    title: "MathVoice",
    description: "Bilingual voice math tutor powered by ElevenLabs",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
