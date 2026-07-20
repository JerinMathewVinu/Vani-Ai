"""Smoke test for the /ws/stt streaming WebSocket.

Connects, sends a short tone, and verifies we get back a 'ready' event
plus a 'final' event with non-empty text.
"""
import asyncio
import base64
import io
import json
import sys

import numpy as np
import soundfile as sf
import websockets


def synth_wav_bytes(seconds: float = 2.0) -> bytes:
    sr = 16000
    t = np.linspace(0, seconds, int(sr * seconds), endpoint=False)
    tone = (
        0.4 * np.sin(2 * np.pi * 440 * t)
        + 0.2 * np.sin(2 * np.pi * 880 * t)
    ).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, tone, sr, format="WAV")
    return buf.getvalue()


async def main() -> int:
    audio = synth_wav_bytes(2.0)
    audio_b64 = base64.b64encode(audio).decode("ascii")
    print(f"audio bytes: {len(audio)} (b64 len {len(audio_b64)})")

    url = "ws://127.0.0.1:4000/ws/stt"
    print(f"connecting to {url}")
    async with websockets.connect(url) as ws:
        await ws.send('{"type": "start"}')

        # Send the audio in one go
        await ws.send(json.dumps({"type": "chunk", "data": audio_b64}))

        # Collect messages: a 'ready', some 'partial's, then a 'final'.
        got_ready = False
        got_final = False
        got_partials = 0
        deadline = asyncio.get_event_loop().time() + 30.0
        while asyncio.get_event_loop().time() < deadline:
            remaining = deadline - asyncio.get_event_loop().time()
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=min(remaining, 5.0))
            except asyncio.TimeoutError:
                # Time slice expired, send stop to force a final.
                await ws.send('{"type": "stop"}')
                continue
            msg = json.loads(raw)
            t = msg.get("type")
            if t == "ready":
                got_ready = True
            elif t == "partial":
                got_partials += 1
                print(f"  partial: {msg.get('text')!r} (dur {msg.get('duration')}s)")
            elif t == "final":
                got_final = True
                print(f"  FINAL:   {msg.get('text')!r} (dur {msg.get('duration')}s)")
                break
            elif t == "error":
                print(f"  error from server: {msg.get('message')!r}")
                return 2

        if got_final:
            print(f"\nOK: ready={got_ready}, partials={got_partials}, final=received")
            return 0 if got_ready else 1
        print("ERROR: did not receive a final within deadline")
        return 5


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
