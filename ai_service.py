import json
import logging
import os
import re
from pathlib import Path

import requests
from dotenv import load_dotenv

# 🔥 Load .env from backend folder
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
REQUEST_TIMEOUT = 30

SYSTEM_PROMPT = (
    "You are an experienced startup mentor helping early-stage founders become "
    "fundable. Be specific, practical, and avoid generic advice."
)


# ─────────────────────────────────────────
# 🔁 FALLBACK
# ─────────────────────────────────────────
def _fallback(reason: str, raw: str = "") -> dict:
    print("❌ FALLBACK TRIGGERED:", reason)
    return {
        "stage_explanation": "AI analysis is temporarily unavailable.",
        "personalized_advice": reason,
        "key_risks": ["AI service unavailable"],
        "next_steps_detailed": ["Try again later"],
        "improvement_focus": "Check backend logs",
        "_debug": raw[:500] if raw else ""
    }


# ─────────────────────────────────────────
# 🔧 SAFE PARSER (CRITICAL FIX)
# ─────────────────────────────────────────
def _parse_response(raw_content: str) -> dict:
    try:
        # Remove markdown formatting
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_content.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned.strip())

        parsed = json.loads(cleaned)

    except Exception:
        return _fallback("JSON parsing failed", raw_content)

    # 🔥 FORCE TYPES (this fixes your crash)
    def ensure_list(value):
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return [value]
        return []

    return {
        "stage_explanation": str(parsed.get("stage_explanation", "")),
        "personalized_advice": str(parsed.get("personalized_advice", "")),
        "key_risks": ensure_list(parsed.get("key_risks")),
        "next_steps_detailed": ensure_list(parsed.get("next_steps_detailed")),
        "improvement_focus": str(parsed.get("improvement_focus", "")),
    }


# ─────────────────────────────────────────
# 🧠 MAIN FUNCTION
# ─────────────────────────────────────────
def generate_ai_analysis(data: dict) -> dict:

    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

    if not api_key:
        return _fallback("API KEY NOT FOUND")

    user_prompt = f"""
Startup Details:

Idea: {data.get("idea")}
Problem: {data.get("problem")}
Target User: {data.get("target_user")}
Solution: {data.get("solution")}

Current Stage: {data.get("stage")}

Scores:
{data.get("scores")}

Strengths:
{data.get("strengths")}

Weaknesses:
{data.get("weaknesses")}

---

TASK:

1. Explain why the user is at this stage
2. Give personalized advice
3. List key risks
4. Suggest next steps
5. Highlight improvement focus

Return ONLY valid JSON with:
stage_explanation, personalized_advice, key_risks, next_steps_detailed, improvement_focus
"""

    payload = {
        "model": "openai/gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "FundMe"
    }

    try:
        response = requests.post(
            OPENROUTER_BASE_URL,
            headers=headers,
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )

        print("\n===== AI DEBUG =====")
        print("STATUS:", response.status_code)
        print("RESPONSE:", response.text[:1000])
        print("=====================\n")

        response.raise_for_status()

    except Exception as e:
        return _fallback(str(e))

    try:
        raw_content = response.json()["choices"][0]["message"]["content"]
    except Exception:
        return _fallback("Bad response format", response.text)

    return _parse_response(raw_content)