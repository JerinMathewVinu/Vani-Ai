import os
import re
import requests
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://127.0.0.1:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'mistral')
LOCAL_MISTRAL_URL = os.getenv('LOCAL_MISTRAL_URL', 'http://localhost:8080/v1/chat/completions')
LOCAL_MISTRAL_MODEL = os.getenv('LOCAL_MISTRAL_MODEL', 'mistral-7b-instruct')

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
GROQ_API_KEY = os.getenv('GROQ_API_KEY')

def _extract_original_text(prompt: str) -> str:
    m = re.search(r'Original:\s*"([\s\S]+?)"', prompt)
    if not m:
        m = re.search(r'Sentence:\s*"([\s\S]+?)"', prompt)
    return m.group(1) if m else prompt

def _offline_improve_text(prompt: str) -> str:
    text = _extract_original_text(prompt)
    fillers = [r'\bum\b', r'\buh\b', r'\blike\b', r'you know', r'\bso\b', r'\bactually\b', r'\bbasically\b']
    cleaned = text
    for f in fillers:
        cleaned = re.sub(f, '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    if cleaned:
        cleaned = cleaned[0].upper() + cleaned[1:]
    if cleaned and cleaned[-1] not in '.!?':
        cleaned = cleaned + '.'
    return cleaned

def _parse_llm_response(data):
    if not isinstance(data, dict):
        return None
    if 'choices' in data and isinstance(data['choices'], list) and data['choices']:
        first = data['choices'][0]
        if isinstance(first, dict):
            message = first.get('message')
            if isinstance(message, dict):
                return message.get('content')
            if message is not None:
                return str(message)
    return None

def _send_request(url: str, payload: dict):
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException:
        return None

def _try_ollama_chat(prompt: str):
    payload = {
        'model': OLLAMA_MODEL,
        'messages': [
            {'role': 'system', 'content': 'You are an English communication coach.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.45,
        'max_tokens': 260
    }
    url = f"{OLLAMA_URL.rstrip('/')}/api/chat"
    data = _send_request(url, payload)
    if data:
        return _parse_llm_response(data)
    return None

def _try_gemini(prompt: str) -> str | None:
    if not GEMINI_API_KEY:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.45, "maxOutputTokens": 500}
    }
    try:
        response = requests.post(url, json=payload, timeout=20)
        response.raise_for_status()
        res_json = response.json()
        return res_json['candidates'][0]['content']['parts'][0]['text'].strip()
    except Exception:
        return None

def _try_groq(prompt: str) -> str | None:
    if not GROQ_API_KEY:
        return None
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": "You are an English communication coach."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.45
    }
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        res_json = response.json()
        return res_json['choices'][0]['message']['content'].strip()
    except Exception:
        return None

def call_local_mistral(prompt: str) -> str:
    gemini_resp = _try_gemini(prompt)
    if gemini_resp:
        return gemini_resp.strip()

    groq_resp = _try_groq(prompt)
    if groq_resp:
        return groq_resp.strip()

    ollama_resp = _try_ollama_chat(prompt)
    if ollama_resp:
        return ollama_resp.strip()

    return _offline_improve_text(prompt)
