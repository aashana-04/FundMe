"""
FundMe Opportunity Intelligence — Matching Engine & DB Service.

Upgraded matching uses the stored AI profile (keywords, archetype,
semantic_domains, funding_maturity, opportunity_pathways) as the
PRIMARY recommendation driver — far richer than raw text inference.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.models.onboarding import User
from backend.models.opportunities import (
    Opportunity, FounderShortlist, FounderOpportunityStatus,
)
from backend.services.opportunity_data import CURATED_OPPORTUNITIES

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────
#  Stage normalisation map
# ─────────────────────────────────────────
STAGE_MAP = {
    "exploration": "idea",
    "ideation":    "idea",
    "idea":        "idea",
    "validation":  "validation",
    "pre-seed":    "pre-seed",
    "pre_seed":    "pre-seed",
    "seed-ready":  "seed",
    "seed":        "seed",
    "mvp":         "mvp",
}


def _norm_stage(stage: str) -> str:
    return STAGE_MAP.get(stage.lower().replace(" ", "-"), "idea")


# ─────────────────────────────────────────
#  Semantic Tag Similarity
# ─────────────────────────────────────────

TAG_CLUSTERS = {
    "ai":       {"ai", "ml", "machine learning", "nlp", "llm", "artificial intelligence", "deep learning", "gpt", "ai platform", "automation"},
    "health":   {"healthtech", "health", "medical", "medtech", "pharma", "clinical", "hospital", "biotech", "lifesciences", "digital health"},
    "finance":  {"fintech", "finance", "payment", "banking", "insurance", "lending", "credit", "financial services"},
    "education":{"edtech", "education", "learning", "school", "student", "course", "e-learning"},
    "climate":  {"climate", "cleantech", "sustainability", "green", "renewable", "energy", "carbon", "climate tech"},
    "saas":     {"saas", "software", "platform", "b2b", "enterprise", "dashboard", "b2b saas", "developer tools"},
    "deep":     {"deeptech", "hardware", "semiconductor", "robotics", "drone", "iot", "deeptech / hardware"},
    "bio":      {"biotech", "biology", "genomics", "drug", "protein", "lab", "research", "bioscience"},
    "agri":     {"agritech", "agriculture", "farming", "crop", "farmer", "farmtech"},
    "social":   {"social-impact", "social", "impact", "ngo", "community", "welfare", "rural", "social impact"},
    "consumer": {"consumer app", "consumer", "mobile", "marketplace", "d2c", "retail"},
    "cyber":    {"cybersecurity", "security", "privacy", "infosec"},
    "logistics":{"logistics", "supply chain", "last-mile"},
}


def _tag_similarity(tags_a: set, tags_b: set) -> float:
    """Compute semantic similarity between two tag sets (0.0-1.0)."""
    if not tags_a or not tags_b:
        return 0.5  # agnostic

    a_lower = {t.lower() for t in tags_a}
    b_lower = {t.lower() for t in tags_b}

    # Direct overlap
    direct = len(a_lower & b_lower)
    if direct > 0:
        return min(1.0, 0.6 + direct * 0.12)

    # Cluster-based soft matching
    a_clusters = set()
    b_clusters = set()
    for cluster_name, cluster_tags in TAG_CLUSTERS.items():
        if a_lower & cluster_tags:
            a_clusters.add(cluster_name)
        if b_lower & cluster_tags:
            b_clusters.add(cluster_name)

    if a_clusters & b_clusters:
        return min(0.85, 0.40 + len(a_clusters & b_clusters) * 0.12)

    return 0.08


# ─────────────────────────────────────────
#  Funding Maturity → Stage / Category Map
# ─────────────────────────────────────────

MATURITY_STAGE_MAP = {
    "grant-ready":        ["idea", "validation"],
    "incubator-ready":    ["idea", "validation", "mvp"],
    "accelerator-ready":  ["validation", "mvp", "pre-seed"],
    "investor-ready":     ["mvp", "pre-seed", "seed"],
}

MATURITY_CATEGORY_BONUS = {
    "grant-ready":       {"grant", "government", "fellowship", "student"},
    "incubator-ready":   {"incubator", "grant", "fellowship"},
    "accelerator-ready": {"accelerator", "fellowship", "grant"},
    "investor-ready":    {"accelerator", "research"},
}


# ─────────────────────────────────────────
#  Urgency Score
# ─────────────────────────────────────────

def _urgency_score(deadline_str: Optional[str]) -> float:
    if not deadline_str:
        return 0.3

    lower = deadline_str.strip().lower()
    if lower in ("rolling", "ongoing", "open", "always open", "continuous"):
        return 0.4
    if "rolling" in lower or "cohort" in lower or "batch" in lower:
        return 0.45
    if "check" in lower or "annual" in lower:
        return 0.5

    now = datetime.now(timezone.utc)
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            deadline = datetime.strptime(lower, fmt).replace(tzinfo=timezone.utc)
            days_until = (deadline - now).days
            if days_until < 0:
                return 0.0
            elif days_until <= 7:
                return 1.0
            elif days_until <= 14:
                return 0.9
            elif days_until <= 30:
                return 0.8
            elif days_until <= 60:
                return 0.65
            elif days_until <= 90:
                return 0.5
            else:
                return 0.35
        except ValueError:
            continue
    return 0.3


# ─────────────────────────────────────────
#  DB seeding
# ─────────────────────────────────────────

def seed_opportunities(db: Session) -> int:
    """Insert curated opportunities that don't exist yet. Returns count added."""
    added = 0
    for opp_data in CURATED_OPPORTUNITIES:
        exists = db.query(Opportunity).filter(Opportunity.id == opp_data["id"]).first()
        if not exists:
            opp = Opportunity(
                id=opp_data["id"],
                title=opp_data["title"],
                organization=opp_data["organization"],
                description=opp_data["description"],
                category=opp_data["category"],
                tags=opp_data.get("tags", []),
                eligibility_summary=opp_data.get("eligibility_summary"),
                startup_stages=opp_data.get("startup_stages", []),
                geography=opp_data.get("geography", []),
                domain_focus=opp_data.get("domain_focus", []),
                founder_criteria=opp_data.get("founder_criteria", []),
                funding_amount=opp_data.get("funding_amount"),
                benefits=opp_data.get("benefits", []),
                required_docs=opp_data.get("required_docs", []),
                official_link=opp_data["official_link"],
                deadline=opp_data.get("deadline"),
                source_name=opp_data.get("source_name"),
                last_verified=datetime.now(timezone.utc),
                is_active=True,
            )
            db.add(opp)
            added += 1
    if added:
        db.commit()
    return added


# ─────────────────────────────────────────
#  Build Founder Profile (AI-powered)
# ─────────────────────────────────────────

def _load_ai_profile(user: User) -> dict:
    """Load the stored AI extraction profile from User model."""
    if user.ai_profile_json:
        try:
            return json.loads(user.ai_profile_json)
        except Exception:
            pass
    return {}


def _build_founder_profile(user: User) -> dict:
    """Extract a rich normalised profile dict from a User ORM object.
    
    Uses the stored AI profile (keywords, archetype, semantic_domains,
    funding_maturity, opportunity_pathways) as primary signals.
    Falls back to text-based inference when AI profile is absent.
    """
    # ── Scoring-derived stage ──
    stage_raw = ""
    overall_score = 0
    scores = {}

    if user.problem_clarity:
        pc = user.problem_clarity
        scores["problem_clarity"] = (
            pc.problem_definition_score + pc.target_user_clarity_score +
            pc.frequency_score + pc.severity_score
        ) / 4

    if user.validation:
        v = user.validation
        scores["validation"] = (
            v.users_spoken_to + v.user_type_score +
            v.pattern_score + v.iteration_score
        ) / 4

    if user.build:
        b = user.build
        scores["build"] = (
            b.build_stage + b.accessibility_score + b.development_activity_score
        ) / 3

    if user.traction:
        t = user.traction
        scores["traction"] = (
            t.user_count + t.engagement_score + t.traction_signal_score
        ) / 3

    if user.funding_readiness:
        fr = user.funding_readiness
        scores["funding_readiness"] = (
            fr.market_understanding_score + fr.business_model_score +
            fr.funding_history_score
        ) / 3

    if scores:
        weighted = (
            scores.get("problem_clarity", 0) * 0.20 +
            scores.get("validation", 0)      * 0.20 +
            scores.get("build", 0)           * 0.15 +
            scores.get("traction", 0)        * 0.20 +
            scores.get("funding_readiness", 0) * 0.25
        )
        overall_score = round((weighted - 1) / 3 * 100)

        if overall_score >= 85:
            stage_raw = "seed"
        elif overall_score >= 65:
            stage_raw = "pre-seed"
        elif overall_score >= 45:
            stage_raw = "validation"
        else:
            stage_raw = "idea"

    # ── AI Profile (primary intelligence source) ──
    ai_profile = _load_ai_profile(user)

    # Semantic domains from AI profile (preferred) or text fallback
    if ai_profile.get("semantic_domains"):
        domain_signals = [d.lower() for d in ai_profile["semantic_domains"]]
    elif ai_profile.get("keywords"):
        domain_signals = [k.lower() for k in ai_profile["keywords"][:6]]
    else:
        # Text-based fallback
        basics = user.startup_basics
        idea_text = ""
        if basics:
            idea_text = " ".join([
                basics.idea_description or "",
                basics.problem_statement or "",
                basics.solution_description or "",
            ]).lower()

        domain_keywords = {
            "ai":           ["ai", "machine learning", "ml", "nlp", "llm", "artificial intelligence"],
            "healthtech":   ["health", "medical", "doctor", "patient", "clinical", "hospital", "pharma"],
            "fintech":      ["finance", "payment", "banking", "insurance", "lending", "credit", "wallet"],
            "edtech":       ["education", "learning", "school", "student", "teacher", "course", "exam"],
            "climate":      ["climate", "carbon", "sustainability", "green", "renewable", "energy"],
            "saas":         ["saas", "software", "platform", "subscription", "b2b", "enterprise"],
            "deeptech":     ["deep tech", "hardware", "semiconductor", "robotics", "drone", "iot"],
            "biotech":      ["biotech", "biology", "genomics", "drug", "protein", "lab"],
            "agritech":     ["agriculture", "farming", "crop", "farmer", "irrigation", "soil"],
            "social-impact":["social", "impact", "ngo", "community", "poverty", "rural", "welfare"],
        }
        domain_signals = []
        for domain, keywords in domain_keywords.items():
            if any(kw in idea_text for kw in keywords):
                domain_signals.append(domain)

    # All tags for matching (AI keywords + tags + domains)
    all_ai_tags = set()
    if ai_profile.get("keywords"):
        all_ai_tags.update(k.lower() for k in ai_profile["keywords"])
    if ai_profile.get("tags"):
        all_ai_tags.update(t.lower() for t in ai_profile["tags"])
    if ai_profile.get("semantic_domains"):
        all_ai_tags.update(d.lower() for d in ai_profile["semantic_domains"])

    # Funding maturity from AI or score-based fallback
    funding_maturity = ai_profile.get("funding_maturity", "")
    if not funding_maturity:
        if overall_score >= 75:
            funding_maturity = "investor-ready"
        elif overall_score >= 55:
            funding_maturity = "accelerator-ready"
        elif overall_score >= 30:
            funding_maturity = "incubator-ready"
        else:
            funding_maturity = "grant-ready"

    # Opportunity pathways from AI
    opportunity_pathways = ai_profile.get("opportunity_pathways", [])

    # Startup archetype
    archetype = ai_profile.get("archetype", "Tech Startup")

    # Idea text for context
    basics = user.startup_basics
    idea_text = ""
    if basics:
        idea_text = " ".join([
            basics.idea_description or "",
            basics.problem_statement or "",
            basics.solution_description or "",
        ]).lower()

    # Founder criteria detection
    founder_strength = ""
    if user.funding_readiness:
        founder_strength = (user.funding_readiness.founder_strength or "").lower()

    founder_criteria = []
    if any(x in founder_strength for x in ["student", "university", "college"]):
        founder_criteria.append("student")
    if any(x in founder_strength for x in ["women", "female", "woman"]):
        founder_criteria.append("women")

    # Readiness indicators
    has_mvp = bool(user.build and user.build.build_stage >= 3)
    has_demo = bool(basics and (basics.website_link or basics.demo_link))
    has_traction = bool(user.traction and user.traction.user_count >= 2)
    has_pitch = bool(basics and basics.demo_link)

    return {
        "stage":                stage_raw,
        "overall_score":        overall_score,
        "domain_signals":       domain_signals,
        "all_ai_tags":          all_ai_tags,
        "ai_keywords":          ai_profile.get("keywords", []),
        "category":             ai_profile.get("category", ""),
        "archetype":            archetype,
        "funding_maturity":     funding_maturity,
        "opportunity_pathways": opportunity_pathways,
        "startup_summary":      ai_profile.get("startup_summary", ""),
        "founder_criteria":     founder_criteria,
        "geography":            ["India"],   # default; can be extended
        "idea_text":            idea_text,
        "raw_scores":           scores,
        "has_mvp":              has_mvp,
        "has_demo":             has_demo,
        "has_traction":         has_traction,
        "has_pitch":            has_pitch,
    }


# ─────────────────────────────────────────
#  Scoring an Opportunity
# ─────────────────────────────────────────

def _score_opportunity(opp: Opportunity, profile: dict) -> float:
    """
    Compute a 0.0–1.0 relevance score for an opportunity given a founder profile.

    Scoring weights (total = 1.0):
      0.30  Domain / semantic match  ← primary driver (uses AI profile)
      0.22  Stage / funding maturity match
      0.15  Geography match
      0.12  Category fitness (grant vs accelerator vs fellowship)
      0.08  Founder criteria
      0.08  Urgency / deadline
      0.05  Readiness confidence
    """
    score = 0.0
    max_score = 0.0

    # ── 1. Domain / Semantic Match (weight 0.30) — PRIMARY DRIVER ──
    max_score += 0.30
    opp_domains = set(d.lower() for d in (opp.domain_focus or []))
    opp_all_tags = set(t.lower() for t in (opp.tags or [])) | opp_domains

    # Use rich AI tag set if available, else text-derived signals
    founder_tags = profile.get("all_ai_tags") or set(profile.get("domain_signals", []))

    if opp_all_tags:
        sim = _tag_similarity(founder_tags, opp_all_tags)
        score += 0.30 * sim
    else:
        # Domain-agnostic opp — use cluster-level match only
        simple_sim = _tag_similarity(
            set(profile.get("domain_signals", [])), {"general", "all", "technology"}
        )
        score += 0.18

    # ── 2. Stage & Funding Maturity Match (weight 0.22) ──
    max_score += 0.22
    founder_stage = _norm_stage(profile["stage"])
    funding_maturity = profile.get("funding_maturity", "grant-ready")
    opp_stages = opp.startup_stages or []

    # Direct stage match
    if founder_stage in opp_stages:
        score += 0.15
    elif _adjacent_stage(founder_stage, opp_stages):
        score += 0.08

    # Funding maturity → opportunity category alignment
    maturity_good_cats = MATURITY_CATEGORY_BONUS.get(funding_maturity, set())
    if opp.category in maturity_good_cats:
        score += 0.07
    elif opp.category in ("hackathon",):
        score += 0.04  # always somewhat relevant

    # ── 3. Geography Match (weight 0.15) ──
    max_score += 0.15
    opp_geos = set(g.lower() for g in (opp.geography or []))
    if "global" in opp_geos:
        score += 0.15
    elif any(g.lower() in opp_geos for g in profile["geography"]):
        score += 0.15
    else:
        score += 0.03

    # ── 4. Category Fitness (weight 0.12) ──
    max_score += 0.12
    if opp.category == "hackathon":
        score += 0.09  # hackathons always relevant for early stages
    elif opp.category in maturity_good_cats:
        score += 0.12
    elif opp.category == "student" and "student" in profile["founder_criteria"]:
        score += 0.12
    elif opp.category == "fellowship":
        score += 0.06
    else:
        score += 0.04

    # ── 5. Founder Criteria (weight 0.08) ──
    max_score += 0.08
    opp_criteria = set(c.lower() for c in (opp.founder_criteria or []))
    founder_criteria = set(c.lower() for c in profile["founder_criteria"])
    if not opp_criteria:
        score += 0.08   # open to all
    elif opp_criteria & founder_criteria:
        score += 0.08
    else:
        score += 0.02

    # ── 6. Urgency / Deadline Bonus (weight 0.08) ──
    max_score += 0.08
    urgency = _urgency_score(opp.deadline)
    score += 0.08 * urgency

    # ── 7. Readiness Confidence (weight 0.05) ──
    max_score += 0.05
    readiness_pts = sum([
        profile.get("has_mvp", False),
        profile.get("has_demo", False),
        profile.get("has_traction", False),
        profile.get("has_pitch", False),
    ])
    score += 0.05 * (readiness_pts / 4)

    return round(min(score / max_score, 1.0), 3) if max_score else 0.0


def _adjacent_stage(stage: str, opp_stages: list) -> bool:
    order = ["idea", "validation", "mvp", "pre-seed", "seed"]
    try:
        idx = order.index(stage)
        adjacent = set()
        if idx > 0:
            adjacent.add(order[idx - 1])
        if idx < len(order) - 1:
            adjacent.add(order[idx + 1])
        return bool(adjacent & set(opp_stages))
    except ValueError:
        return False


# ─────────────────────────────────────────
#  Public: Get Recommendations
# ─────────────────────────────────────────

def get_recommended_opportunities(db: Session, user_id: str, limit: int = 12) -> list[dict]:
    """
    Return ranked opportunities for a user.
    Each dict: {opportunity: Opportunity ORM, relevance_score: float, profile: dict}
    """
    user = db.query(User).filter(or_(User.id == user_id, User.auth_user_id == user_id)).first()
    if not user:
        return []

    profile = _build_founder_profile(user)
    opportunities = db.query(Opportunity).filter(Opportunity.is_active == True).all()

    scored = []
    for opp in opportunities:
        rel_score = _score_opportunity(opp, profile)
        scored.append({"opportunity": opp, "relevance_score": rel_score, "profile": profile})

    scored.sort(key=lambda x: x["relevance_score"], reverse=True)
    return scored[:limit]


# ─────────────────────────────────────────
#  Public: Single Opportunity
# ─────────────────────────────────────────

def get_opportunity_by_id(db: Session, opportunity_id: str) -> Optional[Opportunity]:
    return db.query(Opportunity).filter(Opportunity.id == opportunity_id).first()


def _resolve_user_id(db: Session, user_id: str) -> str:
    user = db.query(User).filter(or_(User.id == user_id, User.auth_user_id == user_id)).first()
    return user.id if user else user_id


def get_user_opportunity_status(db: Session, user_id: str, opportunity_id: str) -> Optional[str]:
    uid = _resolve_user_id(db, user_id)
    row = db.query(FounderOpportunityStatus).filter(
        FounderOpportunityStatus.user_id == uid,
        FounderOpportunityStatus.opportunity_id == opportunity_id,
    ).first()
    return row.status if row else None


def build_readiness_checklist(opp: Opportunity, user: User) -> list[dict]:
    items = []
    basics = user.startup_basics
    build = user.build
    traction = user.traction
    fr = user.funding_readiness

    def add(item, desc, done):
        items.append({
            "item": item,
            "description": desc,
            "status": "done" if done else "missing",
        })

    add("Startup Idea", "Clear description of what you're building",
        bool(basics and basics.idea_description))
    add("Problem Statement", "Well-defined problem being solved",
        bool(basics and basics.problem_statement))
    add("Target User Definition", "Specific customer segment identified",
        bool(basics and basics.target_user))
    add("MVP / Prototype", "Some form of working product or prototype",
        bool(build and build.build_stage >= 2))
    add("User Validation", "Spoken to real potential users",
        bool(user.validation and user.validation.users_spoken_to >= 2))
    add("Traction Signal", "Early users or engagement data",
        bool(traction and traction.user_count >= 2))
    add("Business Model Clarity", "Understanding of how you make money",
        bool(fr and fr.business_model_score >= 2))
    add("Pitch Deck", "Visual presentation of your startup",
        bool(basics and basics.demo_link))
    add("Demo / Live Product", "Working demo, website, or app link",
        bool(basics and (basics.website_link or basics.demo_link)))

    for doc in (opp.required_docs or []):
        already = any(i["item"].lower() in doc.lower() for i in items)
        if not already:
            items.append({"item": doc, "description": f"Required by {opp.organization}", "status": "missing"})

    return items


# ─────────────────────────────────────────
#  Public: Shortlist
# ─────────────────────────────────────────

def shortlist_opportunity(db: Session, user_id: str, opportunity_id: str) -> bool:
    uid = _resolve_user_id(db, user_id)
    existing = db.query(FounderShortlist).filter(
        FounderShortlist.user_id == uid,
        FounderShortlist.opportunity_id == opportunity_id,
    ).first()
    if existing:
        return False

    db.add(FounderShortlist(user_id=uid, opportunity_id=opportunity_id))

    status_row = db.query(FounderOpportunityStatus).filter(
        FounderOpportunityStatus.user_id == uid,
        FounderOpportunityStatus.opportunity_id == opportunity_id,
    ).first()
    if not status_row:
        db.add(FounderOpportunityStatus(
            user_id=uid, opportunity_id=opportunity_id, status="shortlisted"
        ))

    db.commit()
    return True


def remove_shortlist(db: Session, user_id: str, opportunity_id: str) -> bool:
    uid = _resolve_user_id(db, user_id)
    row = db.query(FounderShortlist).filter(
        FounderShortlist.user_id == uid,
        FounderShortlist.opportunity_id == opportunity_id,
    ).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def get_shortlisted_opportunities(db: Session, user_id: str) -> list[Opportunity]:
    uid = _resolve_user_id(db, user_id)
    rows = db.query(FounderShortlist).filter(FounderShortlist.user_id == uid).all()
    opp_ids = [r.opportunity_id for r in rows]
    return db.query(Opportunity).filter(Opportunity.id.in_(opp_ids)).all()


# ─────────────────────────────────────────
#  Public: Mark Applied
# ─────────────────────────────────────────

def mark_applied(db: Session, user_id: str, opportunity_id: str, notes: str = "") -> bool:
    uid = _resolve_user_id(db, user_id)
    row = db.query(FounderOpportunityStatus).filter(
        FounderOpportunityStatus.user_id == uid,
        FounderOpportunityStatus.opportunity_id == opportunity_id,
    ).first()
    if row:
        row.status = "applied"
        row.notes = notes
    else:
        db.add(FounderOpportunityStatus(
            user_id=uid,
            opportunity_id=opportunity_id,
            status="applied",
            notes=notes,
        ))
    db.commit()
    return True
