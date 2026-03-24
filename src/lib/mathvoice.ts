MathVoice — Bilingual Voice Math Tutor for Grade 1–3
Built on ElevenLabs TTS + SpeechRecognition

Author: Mohamed Bah
GitHub: github.com/Moezusb
"""

import os
import random
import speech_recognition as sr
from elevenlabs.client import ElevenLabs
from elevenlabs import play
from dotenv import load_dotenv

load_dotenv()

# ─── CONFIG ──────────────────────────────────────────────────────────────────

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# Voice IDs — swap for any voice from the ElevenLabs Voice Library
# https://elevenlabs.io/voice-library
VOICES = {
    "en": "EXAVITQu4vr4xnSDxMaL",  # Bella — warm, clear, child-friendly
    "fr": "onwK4e9ZLuTAKqWW03F9",  # Daniel — native French speaker
}

MODELS = {
    "en": "eleven_multilingual_v2",
    "fr": "eleven_multilingual_v2",
}

# ─── CONTENT ─────────────────────────────────────────────────────────────────

GREETINGS = {
    "en": [
        "Hi there! I'm MathVoice, your math buddy. Let's do some math together!",
        "Hello! Ready to practise some math? Let's go!",
    ],
    "fr": [
        "Salut! Je suis MathVoice, ton ami des maths. On va s'entraîner ensemble!",
        "Bonjour! Tu es prêt à faire des maths? C'est parti!",
    ],
}

CORRECT = {
    "en": [
        "That's right! Great job!",
        "Correct! You're doing amazing!",
        "Yes! Excellent work!",
        "Fantastic! You got it!",
    ],
    "fr": [
        "C'est exact! Bravo!",
        "Correct! Tu te débrouilles très bien!",
        "Oui! Excellent travail!",
        "Fantastique! Tu as trouvé!",
    ],
}

WRONG = {
    "en": [
        "Not quite — the answer is {answer}. You'll get the next one!",
        "Almost! It's actually {answer}. Keep going, you're doing great!",
        "Good try! The answer was {answer}. Let's try another one.",
    ],
    "fr": [
        "Pas tout à fait — la réponse est {answer}. Tu vas avoir le prochain!",
        "Presque! C'est en fait {answer}. Continue, tu t'en sors très bien!",
        "Bonne tentative! La réponse était {answer}. Essayons-en un autre.",
    ],
}

QUESTION_TEMPLATES = {
    "en": {
        "add": "What is {a} plus {b}?",
        "sub": "What is {a} minus {b}?",
        "mul": "What is {a} times {b}?",
    },
    "fr": {
        "add": "Combien font {a} plus {b}?",
        "sub": "Combien font {a} moins {b}?",
        "mul": "Combien font {a} fois {b}?",
    },
}

ENDINGS = {
    "en": {
        "perfect": "Incredible! You got {score} out of {total}! You're a math star!",
        "great":   "Well done! {score} out of {total}. Keep practising and you'll be unstoppable!",
        "good":    "Nice effort! {score} out of {total}. Practice makes perfect — see you next time!",
        "keep_going": "Good start! {score} out of {total}. Let's practise more together soon!",
    },
    "fr": {
        "perfect": "Incroyable! Tu as eu {score} sur {total}! Tu es une star des maths!",
        "great":   "Bravo! {score} sur {total}. Continue à t'entraîner et tu seras imbattable!",
        "good":    "Bel effort! {score} sur {total}. C'est en forgeant qu'on devient forgeron — à bientôt!",
        "keep_going": "Bon début! {score} sur {total}. Entraînons-nous encore ensemble bientôt!",
    },
}

# ─── QUESTION GENERATOR ──────────────────────────────────────────────────────

def generate_question(grade: int) -> dict:
    """
    Generate an age-appropriate arithmetic question.
    Grade 1: addition/subtraction up to 20
    Grade 2: addition/subtraction up to 100, multiplication by 2/5/10
    Grade 3: all operations, multiplication up to 10x10
    """
    if grade == 1:
        op = random.choice(["add", "sub"])
        a = random.randint(1, 10)
        b = random.randint(1, 10)
        if op == "sub":
            a, b = max(a, b), min(a, b)  # ensure positive result
        answer = a + b if op == "add" else a - b

    elif grade == 2:
        op = random.choice(["add", "add", "sub", "mul"])
        if op in ("add", "sub"):
            a = random.randint(10, 50)
            b = random.randint(1, 20)
            if op == "sub":
                a, b = max(a, b), min(a, b)
            answer = a + b if op == "add" else a - b
        else:
            a = random.choice([2, 5, 10])
            b = random.randint(1, 10)
            answer = a * b

    else:  # grade 3
        op = random.choice(["add", "sub", "mul"])
        if op in ("add", "sub"):
            a = random.randint(10, 100)
            b = random.randint(1, 50)
            if op == "sub":
                a, b = max(a, b), min(a, b)
            answer = a + b if op == "add" else a - b
        else:
            a = random.randint(2, 10)
            b = random.randint(2, 10)
            answer = a * b

    return {"op": op, "a": a, "b": b, "answer": answer}


def format_question(q: dict, lang: str) -> str:
    template = QUESTION_TEMPLATES[lang][q["op"]]
    return template.format(a=q["a"], b=q["b"])


# ─── VOICE LAYER ─────────────────────────────────────────────────────────────

client = ElevenLabs(api_key=ELEVENLABS_API_KEY)


def speak(text: str, lang: str) -> None:
    """Convert text to speech and play it."""
    print(f"\n🔊  {text}")
    audio = client.text_to_speech.convert(
        text=text,
        voice_id=VOICES[lang],
        model_id=MODELS[lang],
        output_format="mp3_44100_128",
    )
    play(audio)


# ─── SPEECH RECOGNITION ──────────────────────────────────────────────────────

recognizer = sr.Recognizer()
recognizer.pause_threshold = 1.0  # seconds of silence before end of phrase


def listen(lang: str, timeout: int = 5) -> str | None:
    """
    Listen via microphone and return transcribed text.
    Returns None if nothing was heard or recognition failed.
    """
    lang_code = "en-US" if lang == "en" else "fr-FR"
    print("🎤  Listening...")

    with sr.Microphone() as source:
        recognizer.adjust_for_ambient_noise(source, duration=0.3)
        try:
            audio = recognizer.listen(source, timeout=timeout, phrase_time_limit=6)
            text = recognizer.recognize_google(audio, language=lang_code)
            print(f"👤  Heard: '{text}'")
            return text.strip()
        except sr.WaitTimeoutError:
            return None
        except sr.UnknownValueError:
            return None
        except sr.RequestError as e:
            print(f"⚠️  Speech recognition error: {e}")
            return None


def extract_number(text: str) -> int | None:
    """
    Pull the first integer out of a transcribed string.
    Handles digits and common spoken forms.
    """
    if not text:
        return None

    word_map = {
        "zero": 0, "zéro": 0,
        "one": 1, "un": 1, "une": 1,
        "two": 2, "deux": 2,
        "three": 3, "trois": 3,
        "four": 4, "quatre": 4,
        "five": 5, "cinq": 5,
        "six": 6,
        "seven": 7, "sept": 7,
        "eight": 8, "huit": 8,
        "nine": 9, "neuf": 9,
        "ten": 10, "dix": 10,
        "eleven": 11, "onze": 11,
        "twelve": 12, "douze": 12,
        "thirteen": 13, "treize": 13,
        "fourteen": 14, "quatorze": 14,
        "fifteen": 15, "quinze": 15,
        "sixteen": 16, "seize": 16,
        "seventeen": 17, "dix-sept": 17,
        "eighteen": 18, "dix-huit": 18,
        "nineteen": 19, "dix-neuf": 19,
        "twenty": 20, "vingt": 20,
    }

    tokens = text.lower().replace("-", " ").split()
    for token in tokens:
        if token in word_map:
            return word_map[token]
        try:
            return int(token)
        except ValueError:
            continue

    return None


# ─── SESSION ─────────────────────────────────────────────────────────────────

def run_session(lang: str = "en", grade: int = 1, num_questions: int = 5) -> None:
    """Run a full MathVoice tutoring session."""

    print(f"\n{'='*50}")
    print(f"  MathVoice  |  Grade {grade}  |  Language: {lang.upper()}")
    print(f"{'='*50}\n")

    # Greeting
    speak(random.choice(GREETINGS[lang]), lang)

    score = 0
    missed = 0

    for i in range(num_questions):
        q = generate_question(grade)
        question_text = format_question(q, lang)

        # Ask up to 2 times per question
        answered = False
        for attempt in range(2):
            speak(question_text, lang)
            response = listen(lang)
            number = extract_number(response)

            if number is not None:
                answered = True
                if number == q["answer"]:
                    score += 1
                    speak(random.choice(CORRECT[lang]), lang)
                else:
                    speak(
                        random.choice(WRONG[lang]).format(answer=q["answer"]),
                        lang
                    )
                break

        if not answered:
            missed += 1
            if lang == "en":
                speak(f"I didn't catch that. The answer was {q['answer']}.", lang)
            else:
                speak(f"Je n'ai pas entendu. La réponse était {q['answer']}.", lang)

    # Closing
    pct = score / num_questions
    if pct == 1.0:
        category = "perfect"
    elif pct >= 0.7:
        category = "great"
    elif pct >= 0.5:
        category = "good"
    else:
        category = "keep_going"

    speak(
        ENDINGS[lang][category].format(score=score, total=num_questions),
        lang
    )

    print(f"\n📊  Session complete — {score}/{num_questions} correct\n")


# ─── ENTRY POINT ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="MathVoice — Bilingual Voice Math Tutor")
    parser.add_argument(
        "--lang",
        choices=["en", "fr"],
        default="en",
        help="Session language: 'en' for English, 'fr' for French (default: en)",
    )
    parser.add_argument(
        "--grade",
        type=int,
        choices=[1, 2, 3],
        default=1,
        help="Grade level 1–3 (default: 1)",
    )
    parser.add_argument(
        "--questions",
        type=int,
        default=5,
        help="Number of questions per session (default: 5)",
    )
    args = parser.parse_args()

    run_session(lang=args.lang, grade=args.grade, num_questions=args.questions)
