import re
from typing import Optional

FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'so', 'actually', 'basically', 'right', 'okay']

def normalize_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text.strip())

def count_words(text: str) -> int:
    return len([word for word in normalize_text(text).split(' ') if word])

def calculate_filler_count(text: str) -> int:
    lower = text.lower()
    return sum(len(re.findall(rf'\b{re.escape(filler)}\b', lower)) for filler in FILLER_WORDS)

def is_likely_english(text: str) -> bool:
    if not text or len(text.strip()) < 3:
        return True
    words = [w.lower() for w in re.findall(r'\b[a-zA-Z]+\b', text)]
    if not words:
        return False
    return len(words) >= 1

def estimate_pace(words: int, duration_seconds: float = 0.0) -> str:
    if duration_seconds <= 0:
        return '0 wpm'
    minutes = duration_seconds / 60.0
    pace = min(max(round(words / minutes), 40), 250)
    return f'{pace} wpm'

def calculate_metrics(
    text: str,
    duration_seconds: float = 0.0,
    speech_duration_seconds: float = 0.0,
    pause_count: int = 0
) -> dict:
    words = count_words(text)
    fillers = calculate_filler_count(text)
    pace_str = estimate_pace(words, duration_seconds)
    
    filler_ratio = fillers / max(words, 1)
    base_confidence = 85 - (filler_ratio * 100) - (pause_count * 2)
    confidence = max(30, min(99, round(base_confidence)))

    return {
        "wordsSpoken": words,
        "fillerCount": fillers,
        "estimatedPace": pace_str,
        "confidenceScore": confidence,
        "durationSeconds": duration_seconds,
        "pauseCount": pause_count
    }
