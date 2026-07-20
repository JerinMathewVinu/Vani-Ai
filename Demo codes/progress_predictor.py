import math
from typing import Any, Dict, List

try:
    from sklearn.linear_model import LinearRegression
    _SKLEARN_OK = True
except Exception:
    LinearRegression = None
    _SKLEARN_OK = False

_CEFR_LEVELS = [
    (0, 20, "A1", "Beginner"),
    (20, 40, "A2", "Elementary"),
    (40, 60, "B1", "Intermediate"),
    (60, 80, "B2", "Upper-Intermediate"),
    (80, 95, "C1", "Advanced"),
    (95, 101, "C2", "Proficient"),
]

def score_to_cefr(score: float) -> Dict[str, str]:
    clamped = max(0.0, min(100.0, float(score)))
    for low, high, code, label in _CEFR_LEVELS:
        if low <= clamped < high or (high == 101 and clamped >= 95):
            return {"code": code, "label": label}
    return {"code": "B1", "label": "Intermediate"}

def predict_user_progress(scores: List[float]) -> Dict[str, Any]:
    if not scores or len(scores) < 3 or not _SKLEARN_OK:
        current = scores[-1] if scores else 50.0
        cefr = score_to_cefr(current)
        return {
            "status": "insufficient_data",
            "currentScore": round(current, 1),
            "currentCefr": cefr["code"],
            "projectedScore1W": round(current, 1),
            "projectedScore4W": round(current, 1),
        }

    X = [[i] for i in range(len(scores))]
    y = scores

    model = LinearRegression()
    model.fit(X, y)

    slope = float(model.coef_[0])
    current_idx = len(scores) - 1
    
    proj_1w = max(0.0, min(100.0, float(model.predict([[current_idx + 3]])[0])))
    proj_4w = max(0.0, min(100.0, float(model.predict([[current_idx + 12]])[0])))

    return {
        "status": "success",
        "trendSlope": round(slope, 3),
        "currentScore": round(scores[-1], 1),
        "currentCefr": score_to_cefr(scores[-1])["code"],
        "projectedScore1W": round(proj_1w, 1),
        "projectedCefr1W": score_to_cefr(proj_1w)["code"],
        "projectedScore4W": round(proj_4w, 1),
        "projectedCefr4W": score_to_cefr(proj_4w)["code"],
    }
