import io
import math
import os
import re
import tempfile
from typing import Optional
import numpy as np
import soundfile as sf

_model = None
_processor = None
MODEL_ID = "facebook/wav2vec2-base-960h"

def _load_model():
    global _model, _processor
    if _model is not None and _processor is not None:
        return _model, _processor
    from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
    _processor = Wav2Vec2Processor.from_pretrained(MODEL_ID)
    _model = Wav2Vec2ForCTC.from_pretrained(MODEL_ID)
    _model.eval()
    return _model, _processor

def score_pronunciation(audio_bytes: bytes, transcript: str, audio_duration: float = 0.0) -> Optional[int]:
    if not audio_bytes or not transcript or not transcript.strip():
        return None
    try:
        import torch
        model, processor = _load_model()
        audio_stream = io.BytesIO(audio_bytes)
        speech, sample_rate = sf.read(audio_stream)
        if speech.ndim > 1:
            speech = speech.mean(axis=1)
        if sample_rate != 16000:
            import scipy.signal
            num_samples = round(len(speech) * 16000 / sample_rate)
            speech = scipy.signal.resample(speech, num_samples)

        inputs = processor(speech, sampling_rate=16000, return_tensors="pt")
        with torch.no_grad():
            logits = model(inputs.input_values).logits
            log_probs = torch.nn.functional.log_softmax(logits, dim=-1)[0]

        clean_text = re.sub(r'[^A-Z\s]', '', transcript.upper()).strip()
        tokens = processor.tokenizer(clean_text).input_ids
        if not tokens:
            return None

        scores = []
        for token_id in tokens:
            token_log_probs = log_probs[:, token_id]
            best_score = float(token_log_probs.max().item())
            scores.append(best_score)

        avg_log_prob = sum(scores) / len(scores)
        scaled_score = int(round(100 + (avg_log_prob * 15)))
        return max(30, min(98, scaled_score))
    except Exception:
        return None
