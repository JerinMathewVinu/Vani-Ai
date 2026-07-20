import asyncio
import io
import time
from dataclasses import dataclass, field
from typing import List, Optional

from converters.stt import transcribe_audio_full

@dataclass
class StreamState:
    user_id: Optional[str] = None
    pcm_frames: List[bytes] = field(default_factory=list)
    started_at: float = 0.0
    last_partial_at: float = 0.0
    closed: bool = False

def process_stream_chunk(state: StreamState, chunk: bytes) -> Optional[str]:
    state.pcm_frames.append(chunk)
    now = time.time()
    if now - state.last_partial_at >= 1.2:
        state.last_partial_at = now
        full_pcm = b"".join(state.pcm_frames)
        result = transcribe_audio_full(full_pcm)
        return result.text
    return None
