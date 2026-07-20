import os
import tempfile
import base64
import requests
from dataclasses import dataclass, field
from typing import List

_model = None

def get_transcription_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel('tiny.en', device='cpu', compute_type='int8')
    return _model

@dataclass
class TranscriptionSegment:
    start: float
    end: float
    text: str

@dataclass
class TranscriptionResult:
    text: str
    duration: float
    segments: List[TranscriptionSegment] = field(default_factory=list)

    @property
    def speech_duration(self) -> float:
        return max(0.0, sum(max(0.0, s.end - s.start) for s in self.segments))

    @property
    def pause_count(self) -> int:
        if len(self.segments) < 2:
            return 0
        count = 0
        for i in range(1, len(self.segments)):
            gap = self.segments[i].start - self.segments[i - 1].end
            if gap >= 0.3:
                count += 1
        return count

def transcribe_audio_full(audio_bytes: bytes, language: str = 'en') -> TranscriptionResult:
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
        temp_file.write(audio_bytes)
        temp_path = temp_file.name

    try:
        model = get_transcription_model()
        segments_iter, info = model.transcribe(
            temp_path,
            language=language,
            beam_size=1,
            vad_filter=True,
        )
        segments = []
        text_parts = []
        for seg in segments_iter:
            segments.append(
                TranscriptionSegment(
                    start=float(seg.start),
                    end=float(seg.end),
                    text=seg.text.strip(),
                )
            )
            if seg.text.strip():
                text_parts.append(seg.text.strip())

        duration = float(info.duration) if info and info.duration else 0.0
        return TranscriptionResult(
            text=" ".join(text_parts).strip(),
            duration=duration,
            segments=segments,
        )
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass
