"""
FundMe Keyword Extraction Service.

AI deeply analyses startup input to extract:
  - keywords, category, tags (for opportunity matching)
  - archetype, funding_maturity, opportunity_pathways
  - semantic_domains, startup_summary

Falls back to rule-based extraction when AI is unavailable.
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
REQUEST_TIMEOUT = 30

# Best available model on OpenRouter — fast and cheap
OPENROUTER_MODEL = "openai/gpt-3.5-turbo-0125"


def _fallback_extraction(problem: str, solution: str, domain: str, stage: str, target_user: str) -> dict:
    """Rule-based fallback when AI is unavailable."""
    domain_lower = domain.lower()
    combined = (problem + " " + solution + " " + target_user).lower()
    keywords = []

    domain_map = {
        "ai":           ["AI", "Machine Learning", "Automation", "Intelligence", "LLM"],
        "healthcare":   ["Healthcare", "MedTech", "Digital Health", "HealthTech"],
        "health":       ["Healthcare", "MedTech"],
        "fintech":      ["FinTech", "Finance", "Payments", "Financial Services"],
        "finance":      ["FinTech", "Finance"],
        "edtech":       ["EdTech", "Education", "E-Learning"],
        "education":    ["EdTech", "Education"],
        "climate":      ["CleanTech", "Sustainability", "Green Tech", "Climate"],
        "cleantech":    ["CleanTech", "Sustainability"],
        "saas":         ["SaaS", "B2B Software", "Enterprise", "Platform"],
        "robotics":     ["Robotics", "Hardware", "DeepTech"],
        "deeptech":     ["DeepTech", "Hardware", "R&D"],
        "biotech":      ["Biotech", "Life Sciences", "BioScience"],
        "cybersecurity":["Cybersecurity", "Security", "Privacy", "Infosec"],
        "agritech":     ["AgriTech", "Agriculture", "FarmTech"],
        "logistics":    ["Logistics", "Supply Chain", "Last-Mile"],
        "ecommerce":    ["E-commerce", "D2C", "Retail Tech"],
        "social":       ["Social Impact", "Impact", "Community"],
        "gaming":       ["Gaming", "Entertainment", "Interactive Media"],
        "proptech":     ["PropTech", "Real Estate", "Construction Tech"],
    }

    for k, v in domain_map.items():
        if k in domain_lower:
            keywords.extend(v)

    signal_map = {
        "hospital": "Healthcare Automation",
        "patient": "Patient Care",
        "clinical": "Clinical Tech",
        "student": "EdTech",
        "farmer": "AgriTech",
        "climate": "Climate Tech",
        "carbon": "Carbon Reduction",
        "fraud": "Fraud Detection",
        "payment": "Digital Payments",
        "supply chain": "Supply Chain",
        "mental health": "Mental Wellness",
        "data": "Data Analytics",
        "automation": "Process Automation",
        "workflow": "Workflow Automation",
        "b2b": "B2B SaaS",
        "enterprise": "Enterprise Software",
        "api": "Developer Tools",
        "marketplace": "Marketplace",
        "platform": "Platform Business",
    }

    for kw, label in signal_map.items():
        if kw in combined:
            keywords.append(label)

    stage_map = {
        "idea": "Early Stage",
        "mvp": "MVP Stage",
        "early users": "Pre-traction",
        "revenue": "Revenue Stage",
        "validation": "Validation Stage",
    }

    for k, v in stage_map.items():
        if k in stage.lower():
            keywords.append(v)

    # Archetype
    archetype = "Tech Startup"

    if any(x in combined for x in ["b2b", "enterprise", "saas", "api", "dashboard"]):
        archetype = "B2B SaaS"

    elif any(x in combined for x in ["consumer", "mobile", "social", "marketplace"]):
        archetype = "Consumer App"

    elif any(x in combined for x in ["hardware", "robotics", "iot", "device"]):
        archetype = "DeepTech / Hardware"

    elif any(x in combined for x in ["health", "medical", "clinical", "hospital"]):
        archetype = "HealthTech"

    elif any(x in combined for x in ["impact", "rural", "community", "ngo"]):
        archetype = "Social Impact"

    # Funding maturity
    stage_lower = stage.lower()

    if "revenue" in stage_lower or "traction" in stage_lower:
        funding_maturity = "accelerator-ready"

    elif "mvp" in stage_lower or "prototype" in stage_lower or "validation" in stage_lower:
        funding_maturity = "incubator-ready"

    elif "seed" in stage_lower:
        funding_maturity = "investor-ready"

    else:
        funding_maturity = "grant-ready"

    # Pathways
    pathways = ["Grant Programs", "Incubator Programs"]

    if funding_maturity in ("accelerator-ready", "investor-ready"):
        pathways = ["Accelerators", "Seed Funding", "Angel Networks"]

    if "student" in combined or "university" in combined:
        pathways.append("Student Competitions")

    if any(x in combined for x in ["impact", "social", "rural"]):
        pathways.append("Social Impact Funds")

    unique_kw = list(dict.fromkeys(keywords))[:10]
    category = domain if domain else "Technology"
    summary = f"A {stage} startup in {domain} solving: {problem[:120]}"

    return {
        "keywords": unique_kw,
        "category": category,
        "startup_summary": summary,
        "tags": unique_kw[:6],
        "archetype": archetype,
        "funding_maturity": funding_maturity,
        "opportunity_pathways": pathways[:4],
        "semantic_domains": list(
            dict.fromkeys([category] + [k.split()[0] for k in unique_kw])
        )[:6],
    }


def extract_startup_keywords(data: dict) -> dict:
    """
    Use AI to extract enriched startup signals from questionnaire data.

    Returns dict with keys:
      keywords, category, startup_summary, tags,
      archetype, funding_maturity, opportunity_pathways, semantic_domains
    """

    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

    problem = data.get("problem", data.get("problem_statement", ""))
    solution = data.get("solution", data.get("solution_description", ""))
    idea = data.get("idea", data.get("idea_description", ""))
    domain = data.get("domain", "Technology")
    stage = data.get("stage", "Idea")
    target_user = data.get("target_user", "")
    geography = data.get("geography", "")
    founder_strength = data.get("founder_strength", "")

    if not api_key:
        logger.warning("OPENROUTER_API_KEY not set — using rule-based fallback")

        return _fallback_extraction(
            problem,
            solution,
            domain,
            stage,
            target_user,
        )

    prompt = f"""You are an expert startup analyst. Extract rich intelligence signals from this founder's input.

Founder Input:
- Startup Idea: {idea[:300] if idea else problem[:300]}
- Problem: {problem[:300]}
- Solution: {solution[:300]}
- Target User: {target_user}
- Domain / Industry: {domain}
- Stage: {stage}
- Geography: {geography}
- Founder Background: {founder_strength[:200] if founder_strength else "Not specified"}

Return ONLY valid JSON (no markdown, no prose):
{{
  "keywords": ["6-12 specific keywords: industry, technology, problem space, business model"],
  "category": "single primary category e.g. HealthTech, FinTech, EdTech, B2B SaaS, DeepTech, CleanTech",
  "startup_summary": "2-sentence sharp startup profile — what it does, who it serves, why it matters",
  "tags": ["5-8 tags for opportunity matching"],
  "archetype": "one of: B2B SaaS | Consumer App | Marketplace | DeepTech / Hardware | HealthTech | Social Impact | Developer Tools | FinTech | EdTech | AgriTech | CleanTech | Biotech | Cybersecurity | AI Platform",
  "funding_maturity": "one of: grant-ready | incubator-ready | accelerator-ready | investor-ready",
  "opportunity_pathways": ["3-5 specific funding/program types this startup should pursue"],
  "semantic_domains": ["4-6 high-level domains for semantic matching e.g. AI, Healthcare, SaaS"]
}}"""

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are a startup analyst. Return ONLY valid JSON. No markdown, no explanation."
            },
            {
                "role": "user",
                "content": prompt
            },
        ],
        "temperature": 0.3,
        "max_tokens": 700,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",

        # Use a broad referer — OpenRouter key allowlist can restrict by HTTP-Referer.
        # Set to your deployed domain in production, or configure the key on
        # https://openrouter.ai/keys to allow all origins.
        "HTTP-Referer": "http://localhost:8000",

        "X-Title": "FundMe",
    }

    try:
        resp = requests.post(
            OPENROUTER_BASE_URL,
            headers=headers,
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )

        resp.raise_for_status()

        raw = resp.json()["choices"][0]["message"]["content"]

        # Strip markdown fences if present
        cleaned = re.sub(
            r"^```(?:json)?\s*",
            "",
            raw.strip(),
            flags=re.IGNORECASE,
        )

        cleaned = re.sub(r"\s*```$", "", cleaned.strip())

        result = json.loads(cleaned)

        def ensure_list(v):
            return v if isinstance(v, list) else ([v] if isinstance(v, str) else [])

        return {
            "keywords": ensure_list(result.get("keywords", [])),
            "category": str(result.get("category", domain)),
            "startup_summary": str(result.get("startup_summary", "")),
            "tags": ensure_list(result.get("tags", [])),
            "archetype": str(result.get("archetype", "Tech Startup")),
            "funding_maturity": str(
                result.get("funding_maturity", "grant-ready")
            ),
            "opportunity_pathways": ensure_list(
                result.get("opportunity_pathways", [])
            ),
            "semantic_domains": ensure_list(
                result.get("semantic_domains", [])
            ),
        }

    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code if e.response else 0

        if status_code == 403:
            logger.error(
                "OpenRouter 403 Forbidden — your API key has a domain allowlist restriction. "
                "Fix: Go to https://openrouter.ai/keys → edit key → remove or update allowed origins "
                "to include 'localhost' and '127.0.0.1'. Falling back to rule-based extraction."
            )

        else:
            logger.error(
                "OpenRouter HTTP error %s: %s",
                status_code,
                e,
            )

        return _fallback_extraction(
            problem,
            solution,
            domain,
            stage,
            target_user,
        )

    except Exception as e:
        logger.error("Keyword extraction failed: %s", e)

        return _fallback_extraction(
            problem,
            solution,
            domain,
            stage,
            target_user,
        )

