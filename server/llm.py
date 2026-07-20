import os
import re
import logging
from dotenv import load_dotenv
import requests

env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://127.0.0.1:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'mistral')
LOCAL_MISTRAL_URL = os.getenv('LOCAL_MISTRAL_URL', 'http://localhost:8080/v1/chat/completions')
LOCAL_MISTRAL_MODEL = os.getenv('LOCAL_MISTRAL_MODEL', 'mistral-7b-instruct')

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
HF_TOKEN = os.getenv('HF_TOKEN') or os.getenv('HUGGINGFACE_API_KEY')


def _extract_original_text(prompt: str) -> str:
    m = re.search(r'Original:\s*"([\s\S]+?)"', prompt)
    if not m:
        m = re.search(r'Sentence:\s*"([\s\S]+?)"', prompt)
    return m.group(1) if m else prompt


def _offline_improve_text(prompt: str) -> str:
    if "Format the output strictly as a JSON object" in prompt:
        return '{"feedback": "Great effort! Your sentence structure and confidence are strong. Keep practicing to expand your vocabulary.", "grammar_score": 85, "clarity_score": 82, "confidence_score": 88}'

    user_line = ""
    lines = [line.strip() for line in prompt.split('\n') if line.strip()]
    for line in reversed(lines):
        if line.startswith("User:") or line.startswith("Original:"):
            user_line = line.split(":", 1)[1].strip()
            break

    lower = user_line.lower()

    if not user_line or lower in ["hi", "hello", "hey", "namaste", "good morning", "good evening"]:
        return "Hello! I'm Vani, your AI English voice coach. How are you doing today, and what would you like to talk about?"

    # Name / Introduction / Clarification intent
    if any(k in lower for k in ["my name", "i am ", "name is", "tell my name", "told my name", "just tell"]):
        name_match = re.search(r'(?:name is|i am|call me)\s+([A-Za-z]+)', lower)
        name_str = name_match.group(1).title() if name_match else ""
        if name_str and name_str.lower() not in ["general", "user", "a", "the", "me", "my"]:
            return f"Nice to meet you, {name_str}! It's great to practice English with you today. What topic would you like to discuss—travel, tech, movies, or career?"
        return "Nice to meet you! It's great to practice English with you today. What topic would you like to discuss—travel, tech, movies, or career?"

    # Subject Topics
    if any(k in lower for k in ["travel", "trip", "visit", "country", "flight", "vacation", "beach", "city"]):
        return "Travel is such an exciting topic! What's one dream destination you'd love to visit, and what would you pack?"

    if any(k in lower for k in ["food", "cook", "eat", "dish", "restaurant", "lunch", "dinner"]):
        return "Food is a wonderful subject to discuss! What's your favorite dish or comfort food to enjoy?"

    if any(k in lower for k in ["tech", "technology", "phone", "app", "ai", "computer", "laptop"]):
        return "Technology is evolving so fast! What's one app or gadget you rely on every single day?"

    if any(k in lower for k in ["work", "job", "career", "office", "interview", "study", "college"]):
        return "Career development is so essential! What is your main professional or study goal right now?"

    # Keyword extraction fallback
    words = [w for w in re.findall(r'\b[a-z]{3,}\b', lower) if w not in ["the", "and", "that", "this", "with", "for", "about", "just", "have", "from", "tell", "said", "what", "like"]]
    if words:
        keyword = words[-1]
        return f"That's very interesting! Tell me more about your thoughts regarding {keyword} in English."

    return "That's a great point! Could you share a bit more detail about that so we can keep practicing your spoken English?"


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
            if first.get('text') is not None:
                return str(first.get('text'))
        return str(first)

    if 'output' in data:
        output = data['output']
        if isinstance(output, list) and output:
            first = output[0]
            if isinstance(first, dict):
                if first.get('content') is not None:
                    return str(first.get('content'))
                if first.get('text') is not None:
                    return str(first.get('text'))
            return str(first)
        if isinstance(output, str):
            return output

    if 'text' in data:
        return str(data['text'])

    return None


def _send_request(url: str, payload: dict, headers: dict = None):
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=20)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.warning(f"API call to {url} failed: {e}")
        return None


def _try_groq(prompt: str) -> str | None:
    if not GROQ_API_KEY:
        return None
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    # Try supported Groq models in order
    models_to_try = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"]
    for m in models_to_try:
        payload = {
            "model": m,
            "messages": [
                {
                    "role": "system",
                    "content": "You are Vani, an interactive Alexa-like English teaching coach and conversational companion. Respond directly to the user's statement, provide warm encouragement, correct any grammar/language mistakes gently, and ask an engaging follow-up question in 1 to 3 short sentences."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.5,
            "max_tokens": 300
        }
        res_json = _send_request(url, payload, headers)
        if res_json:
            result = _parse_llm_response(res_json)
            if result and len(result.strip()) > 5:
                return result.strip()
    return None


def _try_gemini(prompt: str) -> str | None:
    if not GEMINI_API_KEY:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.5,
            "maxOutputTokens": 300
        }
    }
    res_json = _send_request(url, payload)
    if res_json and "candidates" in res_json and res_json["candidates"]:
        try:
            return res_json['candidates'][0]['content']['parts'][0]['text'].strip()
        except Exception:
            pass
    return None


def _try_openai(prompt: str) -> str | None:
    if not OPENAI_API_KEY:
        return None
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "system",
                "content": "You are Vani, an interactive Alexa-like English teaching coach and conversational companion."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.5,
        "max_tokens": 300
    }
    res_json = _send_request(url, payload, headers)
    if res_json:
        result = _parse_llm_response(res_json)
        if result:
            return result.strip()
    return None


def _try_ollama_chat(prompt: str):
    payload = {
        'model': OLLAMA_MODEL,
        'messages': [
            {
                'role': 'system',
                'content': 'You are Vani, an interactive Alexa-like English teaching coach.'
            },
            {
                'role': 'user',
                'content': prompt
            }
        ],
        'temperature': 0.45,
        'max_tokens': 260
    }

    raw = OLLAMA_URL.rstrip('/')
    urls = [f'{raw}/api/chat', f'{raw}/v1/chat/completions']
    for url in urls:
        data = _send_request(url, payload)
        if data:
            result = _parse_llm_response(data)
            if result:
                return result
    return None


def _try_huggingface(prompt: str) -> str | None:
    if not HF_TOKEN:
        return None
    url = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "mistralai/Mistral-7B-Instruct-v0.2",
        "messages": [
            {
                "role": "system",
                "content": "You are Vani, an interactive Alexa-like English teaching coach and conversational companion."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.5,
        "max_tokens": 300
    }
    res_json = _send_request(url, payload, headers)
    if res_json:
        result = _parse_llm_response(res_json)
        if result:
            return result.strip()
    return None


def call_local_mistral(prompt: str) -> str:
    # 1. Try Groq Cloud first (Fastest & Active Key!)
    groq_resp = _try_groq(prompt)
    if groq_resp:
        return groq_resp.strip()

    # 2. Try Gemini
    gemini_resp = _try_gemini(prompt)
    if gemini_resp:
        return gemini_resp.strip()

    # 3. Try OpenAI
    openai_resp = _try_openai(prompt)
    if openai_resp:
        return openai_resp.strip()

    # 4. Try Hugging Face Inference API
    hf_resp = _try_huggingface(prompt)
    if hf_resp:
        return hf_resp.strip()

    # 5. Try Ollama local
    ollama_response = _try_ollama_chat(prompt)
    if ollama_response:
        return ollama_response.strip()

    # 6. Smart offline fallback
    return _offline_improve_text(prompt)
