import os
import threading
from typing import Optional

_model = None
_tokenizer = None
MODEL_ID = "vennify/t5-base-grammar-correction"
PREFIX_GE = "gec: "

def _ensure_loaded():
    global _model, _tokenizer
    if _model is not None and _tokenizer is not None:
        return True
    try:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        _model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID)
        _model.eval()
        return True
    except Exception:
        return False

def correct_grammar(text: str) -> Optional[str]:
    if not text or not text.strip() or not _ensure_loaded():
        return None
    try:
        import torch
        inputs = _tokenizer(PREFIX_GE + text.strip(), return_tensors="pt", max_length=128, truncation=True)
        with torch.no_grad():
            outputs = _model.generate(
                inputs.input_ids,
                max_length=128,
                num_beams=4,
                early_stopping=True
            )
        corrected = _tokenizer.decode(outputs[0], skip_special_tokens=True)
        return corrected.strip()
    except Exception:
        return None
