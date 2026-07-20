"""End-to-end smoke test for the ConviAI backend.

Exercises every public route, verifies status codes and key fields, and
prints a summary table at the end.
"""

import io
import json
import sys
import time

import numpy as np
import requests
import soundfile as sf

BASE = "http://127.0.0.1:4000"


def synth_wav(seconds: float = 1.5) -> bytes:
    sr = 16000
    t = np.linspace(0, seconds, int(sr * seconds), endpoint=False)
    tone = (
        0.4 * np.sin(2 * np.pi * 440 * t)
        + 0.2 * np.sin(2 * np.pi * 880 * t)
    ).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, tone, sr, format="WAV")
    return buf.getvalue()


def must_ok(label, resp, expect=200, must_have=None):
    if not must_have:
        must_have = []
    if resp.status_code != expect:
        print(f"  [FAIL] {label} -> {resp.status_code} (expected {expect})")
        print(f"     body: {resp.text[:200]}")
        return False
    try:
        body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    except Exception:
        body = {}
    for key in must_have:
        if key not in body:
            print(f"  [FAIL] {label} -> missing key '{key}'")
            return False
    print(f"  [OK] {label} -> {resp.status_code}")
    return True


def main():
    results = []
    audio = synth_wav()

    # --- Health
    r = requests.get(f"{BASE}/api/health")
    results.append(("health", must_ok("GET /api/health", r, must_have=["status"])))

    # --- Auth
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )
    ok = must_ok("POST /api/auth/login", r, must_have=["token", "user"])
    results.append(("login", ok))
    if not ok:
        print(f"Login failed: {r.text[:200]}")
        sys.exit(1)
    token = r.json()["token"]
    auth = {"Authorization": f"Bearer {token}"}

    # --- Auth me
    r = requests.get(f"{BASE}/api/auth/me", headers=auth)
    results.append(("auth/me", must_ok("GET /api/auth/me", r, must_have=["id", "email"])))

    # --- Dashboard
    r = requests.get(f"{BASE}/api/dashboard", headers=auth)
    results.append(("dashboard", must_ok("GET /api/dashboard", r, must_have=["todayPracticeMinutes"])))

    r = requests.get(f"{BASE}/api/dashboard/sessions", headers=auth)
    results.append(("dashboard/sessions", must_ok("GET /api/dashboard/sessions", r)))

    # --- Practice
    r = requests.post(
        f"{BASE}/api/practice/start",
        headers={**auth, "Content-Type": "application/json"},
        json={"type": "free_practice"},
    )
    ok = must_ok("POST /api/practice/start", r, must_have=["sessionId"])
    results.append(("practice/start", ok))

    r = requests.post(
        f"{BASE}/api/speech/analyze",
        headers=auth,
        files={"file": ("test.wav", audio, "audio/wav")},
        timeout=180,
    )
    body = r.json() if r.status_code == 200 else {}
    ok = must_ok(
        "POST /api/speech/analyze",
        r,
        must_have=["id", "transcript", "corrected", "pronunciationScore", "confidenceScore"],
    )
    if ok:
        # Confirm the new fields are present
        for k in ("pronunciationAvailable", "sessionType", "speakingPaceWpm", "grammarErrors"):
            if k not in body:
                print(f"     [!] missing '{k}' in PracticeResult")
        print(
            f"     -> transcript={body.get('transcript')!r}, "
            f"corrected={body.get('corrected')!r}, "
            f"pronunciationScore={body.get('pronunciationScore')}, "
            f"pronunciationAvailable={body.get('pronunciationAvailable')}"
        )
    results.append(("speech/analyze", ok))

    # /practice/stop
    r = requests.post(
        f"{BASE}/api/practice/stop",
        headers={**auth, "Content-Type": "application/json"},
        json={"type": "free_practice"},
    )
    # We need a real sessionId, but the field accepts any active session.
    # Fall back to the analyzed session id.
    if r.status_code == 400:
        sid = body.get("id") if ok else None
        if sid:
            r = requests.post(
                f"{BASE}/api/practice/stop",
                headers={**auth, "Content-Type": "application/json"},
                json={"sessionId": sid},
            )
    results.append(("practice/stop", must_ok("POST /api/practice/stop", r)))

    # --- Partner

    r = requests.get(f"{BASE}/api/partner/topics", headers=auth)
    results.append(("partner/topics", must_ok("GET /api/partner/topics", r)))
    r = requests.get(f"{BASE}/api/partner/history", headers=auth)
    results.append(("partner/history", must_ok("GET /api/partner/history", r)))
    r = requests.post(
        f"{BASE}/api/partner/message",
        headers={**auth, "Content-Type": "application/json"},
        json={"message": "Yesterday i have went to the store and they was very busy"},
    )
    ok = must_ok(
        "POST /api/partner/message",
        r,
        must_have=["id", "role", "content", "createdAt", "tips", "difficultyLevel"],
    )
    if ok:
        rb = r.json()
        safe_diff = rb.get("difficultyLabel", "").encode("ascii", "ignore").decode()
        print(f"     -> tips: {rb.get('tips')}, difficulty: {safe_diff}")

    results.append(("partner/message", ok))

    r = requests.get(f"{BASE}/api/partner/tips", headers=auth)
    results.append(("partner/tips", must_ok("GET /api/partner/tips", r)))
    r = requests.post(f"{BASE}/api/partner/session/stop", headers=auth)
    results.append(("partner/session/stop", must_ok("POST /api/partner/session/stop", r, must_have=["score", "fluencyScore", "fillerCount"])))
    r = requests.post(f"{BASE}/api/partner/session/reset", headers=auth)
    results.append(("partner/session/reset", must_ok("POST /api/partner/session/reset", r, must_have=["status", "greeting"])))



    # --- Interview
    r = requests.post(
        f"{BASE}/api/interview/start",
        headers={**auth, "Content-Type": "application/json"},
        json={"company": "Google", "role": "Software Engineer", "difficulty": "medium"},
    )
    results.append(
        ("interview/start", must_ok("POST /api/interview/start", r, must_have=["interviewId"]))
    )
    iid = r.json().get("interviewId") if r.status_code == 200 else None
    if iid:
        r = requests.get(f"{BASE}/api/interview/questions?interviewId={iid}", headers=auth)
        results.append(("interview/questions", must_ok("GET /api/interview/questions", r)))
        qs = r.json() if r.status_code == 200 else []
        if qs:
            qid = qs[0]["id"]
            r = requests.post(
                f"{BASE}/api/interview/answer?interviewId={iid}&questionId={qid}",
                headers=auth,
                files={"file": ("a.wav", audio, "audio/wav")},
                timeout=180,
            )
            results.append(
                (
                    "interview/answer",
                    must_ok(
                        "POST /api/interview/answer",
                        r,
                        must_have=["id", "transcript", "feedback"],
                    ),
                )
            )
        r = requests.get(f"{BASE}/api/interview/summary/{iid}", headers=auth)
        results.append(
            (
                "interview/summary",
                must_ok(
                    "GET /api/interview/summary/{id}",
                    r,
                    must_have=["id", "totalScore", "questionsAnswered"],
                ),
            )
        )

    # --- Challenge
    r = requests.get(f"{BASE}/api/challenge/today", headers=auth)
    cid = r.json().get("id") if r.status_code == 200 else None
    results.append(
        ("challenge/today", must_ok("GET /api/challenge/today", r, must_have=["id", "title"]))
    )
    r = requests.get(f"{BASE}/api/challenge/history", headers=auth)
    results.append(("challenge/history", must_ok("GET /api/challenge/history", r)))
    if cid:
        r = requests.post(
            f"{BASE}/api/challenge/complete?challengeId={cid}",
            headers=auth,
            files={"file": ("c.wav", audio, "audio/wav")},
            timeout=180,
        )
        if r.status_code == 200:
            results.append(("challenge/complete", must_ok("POST /api/challenge/complete", r, must_have=["score", "reward", "feedback", "transcript"])))
        elif r.status_code == 400:
            print(f"  [OK] POST /api/challenge/complete -> 400 (already completed)")
            results.append(("challenge/complete", True))
        else:
            results.append(("challenge/complete", must_ok("POST /api/challenge/complete", r)))


    # --- Vocabulary
    r = requests.get(f"{BASE}/api/vocabulary/word-of-day", headers=auth)
    results.append(
        (
            "vocabulary/wod",
            must_ok("GET /api/vocabulary/word-of-day", r, must_have=["id", "word", "meaning"]),
        )
    )
    wid = r.json().get("id") if r.status_code == 200 else None
    r = requests.get(f"{BASE}/api/vocabulary/words?limit=20", headers=auth)
    results.append(("vocabulary/words", must_ok("GET /api/vocabulary/words", r)))
    r = requests.get(f"{BASE}/api/vocabulary/bookmarks", headers=auth)
    results.append(("vocabulary/bookmarks", must_ok("GET /api/vocabulary/bookmarks", r)))
    if wid:
        r = requests.post(
            f"{BASE}/api/vocabulary/bookmark",
            headers={**auth, "Content-Type": "application/json"},
            json={"wordId": wid},
        )
        results.append(
            (
                "vocabulary/bookmark",
                must_ok("POST /api/vocabulary/bookmark", r, must_have=["bookmarked"]),
            )
        )

    # --- Profile
    r = requests.get(f"{BASE}/api/profile", headers=auth)
    results.append(("profile", must_ok("GET /api/profile", r, must_have=["id", "email"])))
    r = requests.put(
        f"{BASE}/api/profile",
        headers={**auth, "Content-Type": "application/json"},
        json={"name": "Test User Updated"},
    )
    results.append(("profile PUT", must_ok("PUT /api/profile", r, must_have=["id"])))
    r = requests.get(f"{BASE}/api/profile/stats", headers=auth)
    results.append(
        (
            "profile/stats",
            must_ok(
                "GET /api/profile/stats",
                r,
                must_have=["totalSessions", "totalMinutes", "averageScore"],
            ),
        )
    )
    r = requests.get(f"{BASE}/api/profile/certificates", headers=auth)
    results.append(("profile/certificates", must_ok("GET /api/profile/certificates", r)))

    # --- Settings
    r = requests.get(f"{BASE}/api/settings", headers=auth)
    results.append(
        (
            "settings",
            must_ok(
                "GET /api/settings",
                r,
                must_have=["language", "notifications", "englishOnlyMode", "selectedVoice"],
            ),
        )
    )
    r = requests.put(
        f"{BASE}/api/settings",
        headers={**auth, "Content-Type": "application/json"},
        json={"language": "en-GB", "englishOnlyMode": False, "selectedVoice": "british"},
    )
    results.append(("settings PUT", must_ok("PUT /api/settings", r)))

    # --- Analytics + reports
    r = requests.get(f"{BASE}/api/analytics?range=month", headers=auth)
    results.append(
        (
            "analytics",
            must_ok(
                "GET /api/analytics",
                r,
                must_have=["timeline", "radar", "byCategory", "speakingSpeed", "confidenceByWeek"],
            ),
        )
    )
    r = requests.get(f"{BASE}/api/reports?range=month", headers=auth)
    results.append(("reports", must_ok("GET /api/reports", r)))
    r = requests.get(
        f"{BASE}/api/reports/export?format=csv&range=month", headers=auth
    )
    ok = r.status_code == 200 and "csv" in (r.headers.get("content-type") or "")
    print(f"  [{'OK' if ok else 'FAIL'}] GET /api/reports/export?format=csv -> {r.status_code} ({r.headers.get('content-type')})")
    results.append(("reports/csv", ok))

    # --- Phase 4: progress prediction (sklearn)
    r = requests.get(f"{BASE}/api/analytics/predict?targetScore=80", headers=auth)
    p_ok = must_ok(
        "GET /api/analytics/predict",
        r,
        must_have=[
            "currentScore", "currentCefr", "nextWeekScore",
            "targetCefr", "weeksToTarget", "slopePerSession",
            "projection", "summary",
        ],
    )
    if p_ok:
        p = r.json()
        print(
            f"     -> current={p['currentScore']} ({p['currentCefr']['level']}), "
            f"slope={p['slopePerSession']}, target={p['targetCefr']['level']} in {p['weeksToTarget']}w, "
            f"confidence={p['confidence']}"
        )
    results.append(("analytics/predict", p_ok))

    # --- Phase 4: WebSocket streaming STT
    try:
        import asyncio
        import base64
        import json as _json
        import websockets

        async def _ws_smoke():
            url = BASE.replace("http://", "ws://") + "/ws/stt"
            async with websockets.connect(url) as ws:
                await ws.send(_json.dumps({"type": "start"}))
                ready = False
                await ws.send(
                    _json.dumps({"type": "chunk", "data": base64.b64encode(audio).decode("ascii")})
                )
                got_final = False
                deadline = asyncio.get_event_loop().time() + 30.0
                while asyncio.get_event_loop().time() < deadline:
                    remaining = deadline - asyncio.get_event_loop().time()
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=min(remaining, 5.0))
                    except asyncio.TimeoutError:
                        await ws.send(_json.dumps({"type": "stop"}))
                        continue
                    except Exception:
                        break
                    m = _json.loads(raw)
                    if m.get("type") == "ready":
                        ready = True
                    if m.get("type") == "final":
                        got_final = True
                        break
                    if m.get("type") == "error":
                        return False, f"server error: {m.get('message')}"
                return got_final and ready, "ok" if (got_final and ready) else "no final"

        ws_ok, ws_msg = asyncio.run(_ws_smoke())
        print(f"  [{'OK' if ws_ok else 'FAIL'}] WebSocket /ws/stt -> {ws_msg}")
        results.append(("ws/stt", ws_ok))
    except Exception as exc:
        print(f"  [FAIL] WebSocket /ws/stt -> {exc}")
        results.append(("ws/stt", False))

    # --- Summary
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    for name, ok in results:
        print(f"  [{'OK' if ok else 'FAIL'}]  {name}")
    print()
    print(f"  {passed}/{total} endpoint groups passed")
    if passed < total:
        sys.exit(1)


if __name__ == "__main__":
    main()
