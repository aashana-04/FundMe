"""
FundMe — AI Opportunity Explanation Service.

Uses the enriched founder profile (archetype, funding_maturity,
startup_summary, keywords, opportunity_pathways) to generate
SPECIFIC "why this matches" explanations — not generic AI filler.
"""
import json
import logging
import os
import re
from pathlib import Path

import requests
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
REQUEST_TIMEOUT = 55


SYSTEM_PROMPT = (
    "You are an expert startup funding advisor helping early-stage founders find the best opportunities. "
    "Your explanations are SPECIFIC — you reference the founder's actual domain, stage, archetype, and signals. "
    "NEVER write generic explanations like 'this aligns with your goals'. "
    "Always mention the specific domain match, stage fit, or founder signal that makes this opportunity relevant. "
    "Be direct, encouraging, and actionable. Base ALL advice strictly on the provided founder data."
)


def _fallback_insight(opp_title: str, opp_category: str, profile: dict) -> dict:
    """Rule-based fallback that still uses available profile data."""
    archetype = profile.get("archetype", "startup")
    maturity = profile.get("funding_maturity", "grant-ready")
    category = profile.get("category", "")
    stage = profile.get("stage", "idea")

    # Build a slightly personalized fallback
    why = f"{opp_title} is a strong match for your {archetype} at the {stage} stage"
    if category:
        why += f" in {category}"
    why += ". Review the eligibility criteria and prepare your startup summary before applying."

    priority = "Worth Exploring"
    if maturity in ("accelerator-ready", "investor-ready") and opp_category == "accelerator":
        priority = "Strong Fit"
    elif maturity == "grant-ready" and opp_category in ("grant", "government"):
        priority = "Strong Fit"

    return {
        "why_recommended": why,
        "readiness_level": "Medium",
        "key_gaps": ["Complete your founder profile for more specific guidance"],
        "application_strategy": "Highlight your domain expertise and problem-solution clarity in your application.",
        "priority_level": priority,
        "estimated_fit_score": 62,
        "preparation_guidance": "Gather traction data and a clear one-pager before applying.",
        "competitiveness": "Moderate",
        "strongest_pathway": "Lead with your domain expertise and target user clarity.",
        "readiness_gaps": ["More detailed profile needed for precise assessment"],
    }


def _parse_ai_insight(raw: str, opp_title: str, opp_category: str, profile: dict) -> dict:
    try:
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned.strip())
        parsed = json.loads(cleaned)
    except Exception:
        logger.warning("Failed to parse AI insight JSON for: %s", opp_title)
        return _fallback_insight(opp_title, opp_category, profile)

    def ensure_list(v):
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            return [v]
        return []

    def clamp_int(v, lo=0, hi=100):
        try:
            return max(lo, min(int(v), hi))
        except (TypeError, ValueError):
            return 70

    return {
        "why_recommended":       str(parsed.get("why_recommended", "")),
        "readiness_level":       str(parsed.get("readiness_level", "Medium")),
        "key_gaps":              ensure_list(parsed.get("key_gaps")),
        "application_strategy":  str(parsed.get("application_strategy", "")),
        "priority_level":        str(parsed.get("priority_level", "Worth Exploring")),
        "estimated_fit_score":   clamp_int(parsed.get("estimated_fit_score", 65)),
        "preparation_guidance":  str(parsed.get("preparation_guidance", "")),
        "competitiveness":       str(parsed.get("competitiveness", "Moderate")),
        "strongest_pathway":     str(parsed.get("strongest_pathway", "")),
        "readiness_gaps":        ensure_list(parsed.get("readiness_gaps")),
    }


def generate_opportunity_insights(
    founder_profile: dict,
    opportunities: list[dict],
) -> list[dict]:
    """
    Generate specific AI insights for a batch of top opportunities.
    Uses the enriched founder profile for genuinely personalised explanations.
    """
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        logger.warning("OPENROUTER_API_KEY not set — using fallback insights")
        return [
            _fallback_insight(o["opportunity"].title, o["opportunity"].category, founder_profile)
            for o in opportunities
        ]

    # Build compact opportunity summaries for the prompt
    opp_list_text = ""
    for i, item in enumerate(opportunities[:10], 1):
        opp = item["opportunity"]
        opp_list_text += (
            f"\n{i}. [{opp.id}] {opp.title} by {opp.organization}\n"
            f"   Type: {opp.category} | Funding: {opp.funding_amount or 'N/A'}\n"
            f"   Stages: {', '.join(opp.startup_stages or [])} | Geography: {', '.join((opp.geography or [])[:3])}\n"
            f"   Domain Focus: {', '.join((opp.domain_focus or [])[:4])}\n"
            f"   Tags: {', '.join((opp.tags or [])[:5])}\n"
            f"   Eligibility: {opp.eligibility_summary or 'Open'}\n"
            f"   Deadline: {opp.deadline or 'Rolling'} | Relevance: {item['relevance_score']:.2f}\n"
        )

    # Build detailed founder context from enriched profile
    readiness_indicators = (
        f"Has MVP: {'Yes' if founder_profile.get('has_mvp') else 'No'} | "
        f"Has Demo: {'Yes' if founder_profile.get('has_demo') else 'No'} | "
        f"Has Traction: {'Yes' if founder_profile.get('has_traction') else 'No'} | "
        f"Has Pitch: {'Yes' if founder_profile.get('has_pitch') else 'No'}"
    )

    ai_keywords = ", ".join(founder_profile.get("ai_keywords", [])[:10]) or "Not extracted"
    pathways = ", ".join(founder_profile.get("opportunity_pathways", [])[:4]) or "General programs"

    user_prompt = f"""FOUNDER PROFILE:
- Startup Summary: {founder_profile.get("startup_summary", "Not provided")[:400]}
- Category / Domain: {founder_profile.get("category", "Technology")}
- Startup Archetype: {founder_profile.get("archetype", "Tech Startup")}
- Funding Maturity: {founder_profile.get("funding_maturity", "grant-ready")}
- Stage: {founder_profile.get("stage", "idea")} | Score: {founder_profile.get("overall_score", 0)}/100
- AI-Extracted Keywords: {ai_keywords}
- Recommended Pathways: {pathways}
- Readiness: {readiness_indicators}

OPPORTUNITIES TO EVALUATE:
{opp_list_text}

TASK:
For EACH opportunity, generate a JSON insight object keyed by the opportunity ID.
Your explanations must be SPECIFIC — mention the actual domain match, funding maturity alignment,
stage fit, or specific keyword match. NEVER say generic things like "aligns with your goals."

Example of a GOOD why_recommended:
"Your AI healthcare automation startup matches this accelerator perfectly — you are at MVP stage,
which is exactly their target cohort, and your MedTech domain directly overlaps their portfolio focus."

Example of a BAD why_recommended (DO NOT DO THIS):
"This opportunity aligns with your startup's goals and could be beneficial for your growth."

Return ONLY valid JSON:
{{
  "opp_id_here": {{
    "why_recommended": "2-3 sentences — SPECIFIC domain, stage, or keyword match explanation",
    "readiness_level": "High|Medium|Low",
    "key_gaps": ["specific gap 1", "specific gap 2"],
    "application_strategy": "1-2 actionable sentences on how to approach this specific opportunity",
    "priority_level": "Top Pick|Strong Fit|Worth Exploring",
    "estimated_fit_score": 0-100,
    "preparation_guidance": "1-2 sentences on what to prepare before applying to THIS opportunity",
    "competitiveness": "High|Moderate|Low",
    "strongest_pathway": "The best angle for this specific founder to get selected",
    "readiness_gaps": ["gap 1", "gap 2"]
  }},
  ...
}}

Rules:
1. Reference the founder's actual archetype, domain, or keywords in each explanation
2. "Top Pick" = strong domain match + right stage + open deadline
3. "Strong Fit" = good domain match or right stage
4. "Worth Exploring" = partial match, worth investigating
5. estimated_fit_score must correlate with priority_level (Top Pick = 80-100, Strong Fit = 60-80, Worth Exploring = 40-65)
"""

    payload = {
        "model": "openai/gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt},
        ],
        "temperature": 0.5,
        "max_tokens": 2500,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
        "HTTP-Referer":  "http://localhost",
        "X-Title":       "FundMe",
    }

    try:
        response = requests.post(
            OPENROUTER_BASE_URL,
            headers=headers,
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        raw_content = response.json()["choices"][0]["message"]["content"]
    except Exception as exc:
        logger.error("AI opportunity insights call failed: %s", exc)
        return [
            _fallback_insight(o["opportunity"].title, o["opportunity"].category, founder_profile)
            for o in opportunities
        ]

    try:
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_content.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned.strip())
        parsed_map: dict = json.loads(cleaned)
    except Exception:
        logger.warning("Failed to parse batch AI insight JSON")
        return [
            _fallback_insight(o["opportunity"].title, o["opportunity"].category, founder_profile)
            for o in opportunities
        ]

    results = []
    for item in opportunities:
        opp_id = item["opportunity"].id
        raw_insight = parsed_map.get(opp_id, {})
        if not raw_insight:
            results.append(_fallback_insight(
                item["opportunity"].title, item["opportunity"].category, founder_profile
            ))
        else:
            results.append(_parse_ai_insight(
                json.dumps(raw_insight),
                item["opportunity"].title,
                item["opportunity"].category,
                founder_profile,
            ))

    return results
