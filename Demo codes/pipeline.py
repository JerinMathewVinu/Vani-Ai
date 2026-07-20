import logging
import re
from typing import Any, Dict, List, Optional

from converters.stt import transcribe_audio_full
from llm import call_local_mistral
from analytics import calculate_metrics, is_likely_english
from services.wav2vec_pronunciation import score_pronunciation as _wav2vec_score
from services.gec_corrector import correct_grammar as _gec_correct

_lt_tool = None
_lt_init_attempted = False

def _get_language_tool():
    global _lt_tool, _lt_init_attempted
    if _lt_init_attempted:
        return _lt_tool
    _lt_init_attempted = True
    try:
        import language_tool_python
        _lt_tool = language_tool_python.LanguageTool("en-US")
    except Exception:
        _lt_tool = None
    return _lt_tool

def _grammar_errors_with_languagetool(text: str) -> List[Dict[str, Any]]:
    tool = _get_language_tool()
    if tool is None or not text or not text.strip():
        return []
    try:
        matches = tool.check(text)
    except Exception:
        return []
    errors = []
    for idx, m in enumerate(matches[:20]):
        suggestion = m.replacements[0] if m.replacements else ""
        category = (m.category or "grammar").lower()
        if category not in {"grammar", "spelling", "punctuation", "style"}:
            category = "grammar"
        errors.append({
            "id": f"g{idx + 1}",
            "message": m.message or "Grammar issue",
            "category": category,
            "start": int(m.offset),
            "end": int(m.offset + m.errorLength),
            "suggestion": suggestion,
        })
    return errors

def _fallback_grammar_errors(original: str, corrected: str) -> List[Dict[str, Any]]:
    if not original or not corrected or original.strip() == corrected.strip():
        return []
    return [{
        "id": "g1",
        "message": "Suggested rewrite for clearer grammar and flow.",
        "category": "grammar",
        "start": 0,
        "end": len(original),
        "suggestion": corrected,
    }]

def _pace_to_int(pace_str: str) -> int:
    try:
        return int(str(pace_str).split()[0])
    except (ValueError, IndexError):
        return 0

def _build_correction_variants(text: str, base_corrected: str) -> Dict[str, str]:
    if is_likely_english(text):
        gec_output = None
        if text.strip():
            grammar_prompt = (
                "You are an English grammar expert. Correct all grammatical, spelling, and punctuation errors. "
                f"Original: \"{text}\" Return only the corrected sentence without explanation."
            )
            gec_output = call_local_mistral(grammar_prompt)
            if not gec_output:
                gec_output = _gec_correct(text)
        corrected = (gec_output or base_corrected or text).strip()

        improved_prompt = (
            "You are a native English teacher. Rewrite the sentence to make it natural and fluent. "
            f"Original sentence: \"{corrected}\" Return only the rewritten sentence."
        )
        improved = call_local_mistral(improved_prompt) or corrected

        professional_prompt = (
            "You are a professional business coach. Rewrite the sentence in formal business register. "
            f"Sentence: \"{corrected}\" Return only the rewritten sentence."
        )
        professional = call_local_mistral(professional_prompt) or corrected
    else:
        corrected = base_corrected
        improved = base_corrected
        professional = base_corrected

    return {
        "corrected": corrected,
        "improved": improved,
        "professional": professional,
    }

def _derive_grammar_errors(original: str, corrected: str) -> List[Dict[str, Any]]:
    errors = _grammar_errors_with_languagetool(original)
    if errors:
        return errors
    return _fallback_grammar_errors(original, corrected)

def _derive_vocab_suggestions(text: str) -> List[Dict[str, Any]]:
    if not text:
        return []
    lower = text.lower()
    suggestions = []
    word_pairs = [
        ("good", "A basic positive adjective.", ["excellent", "solid", "impressive"]),
        ("bad", "A basic negative adjective.", ["poor", "unfortunate", "subpar"]),
        ("nice", "A vague positive adjective.", ["pleasant", "delightful", "wonderful"]),
        ("very", "An intensifier that weakens writing.", ["extremely", "remarkably", "exceptionally"]),
    ]
    for weak, meaning, alts in word_pairs:
        if f" {weak} " in f" {lower} ":
            suggestions.append({"word": weak, "meaning": meaning, "alternatives": alts})
    return suggestions[:3]

def _build_practice_result(
    session_id: str,
    transcript: str,
    corrected_text: str,
    metrics: Dict[str, Any],
    language_alert: Optional[str],
    pronunciation_score: Optional[int] = None,
) -> Dict[str, Any]:
    if pronunciation_score is None:
        pronunciation_score = max(40, min(99, int(metrics.get("confidenceScore", 0)) + 8))
    return {
        "id": session_id,
        "transcript": transcript,
        "corrected": corrected_text,
        "grammarErrors": _derive_grammar_errors(transcript, corrected_text),
        "vocabularySuggestions": _derive_vocab_suggestions(transcript),
        "confidenceScore": int(metrics.get("confidenceScore", 0)),
        "pronunciationScore": pronunciation_score,
        "pronunciationAvailable": pronunciation_score is not None,
        "speakingPaceWpm": _pace_to_int(metrics.get("estimatedPace", "0 wpm")),
        "englishOnlyViolation": bool(language_alert),
    }

def process_audio_session(audio_bytes: bytes, session_id: Optional[str] = None) -> Dict[str, Any]:
    transcription = transcribe_audio_full(audio_bytes)
    transcript = transcription.text
    metrics = calculate_metrics(
        transcript,
        duration_seconds=transcription.duration,
        speech_duration_seconds=transcription.speech_duration,
        pause_count=transcription.pause_count,
    )
    language_alert = None
    corrected_text = ''

    if not is_likely_english(transcript):
        language_alert = 'Language other than English detected, please talk in English.'
        corrected_text = 'Language other than English detected, please talk in English.'
    else:
        gec_text = _gec_correct(transcript) if transcript.strip() else None
        prompt = (
            'Please improve the following spoken English for a professional response. '
            f'Original: "{transcript}" Return only the corrected text without explanation.'
        )
        llm_text = call_local_mistral(prompt)
        corrected_text = (llm_text or gec_text or transcript).strip()

    pronunciation_score = None
    if not language_alert and transcript.strip():
        try:
            pronunciation_score = _wav2vec_score(audio_bytes, transcript, audio_duration=transcription.duration)
        except Exception:
            pronunciation_score = None

    result = _build_practice_result(
        session_id=session_id or (transcript[:8] or 'audio'),
        transcript=transcript,
        corrected_text=corrected_text,
        metrics=metrics,
        language_alert=language_alert,
        pronunciation_score=pronunciation_score,
    )

    return {
        'transcript': transcript,
        'correctedText': corrected_text,
        'metrics': metrics,
        'languageAlert': language_alert,
        'pronunciationAvailable': bool(pronunciation_score is not None),
        'result': result,
    }

def build_correction_result(text: str) -> Dict[str, Any]:
    metrics = calculate_metrics(text)
    if not is_likely_english(text):
        base_corrected = text.strip()
        variants = {"corrected": base_corrected, "improved": base_corrected, "professional": base_corrected}
    else:
        gec_text = _gec_correct(text) if text.strip() else None
        prompt = (
            'Please improve the following spoken English for a professional response. '
            f'Original: "{text}" Return only the corrected text without explanation.'
        )
        llm_text = call_local_mistral(prompt)
        base_corrected = (llm_text or gec_text or text).strip()
        variants = _build_correction_variants(text, base_corrected)

    return {
        "id": text[:8] or "corr",
        "original": text,
        **variants,
        "grammarErrors": _derive_grammar_errors(text, variants["corrected"]),
        "vocabularySuggestions": _derive_vocab_suggestions(text),
    }
