"""
FundMe — Advanced Founder Readiness Engine.

Dynamically generates per-opportunity readiness assessments:
  - Required documents check
  - Preparation gap analysis
  - Readiness percentage
  - Missing assets identification
  - Adaptive checklist per opportunity type
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────
#  Checklist Item Definitions
# ─────────────────────────────────────────

class ChecklistItem:
    """A single readiness checklist item."""
    __slots__ = ("item", "description", "status", "category", "priority", "tips")

    def __init__(self, item: str, description: str, status: str = "missing",
                 category: str = "general", priority: int = 2, tips: str = ""):
        self.item = item
        self.description = description
        self.status = status         # "done" | "partial" | "missing"
        self.category = category     # "document" | "product" | "validation" | "team" | "strategy"
        self.priority = priority     # 1=critical, 2=important, 3=nice-to-have
        self.tips = tips

    def to_dict(self) -> dict:
        return {
            "item": self.item,
            "description": self.description,
            "status": self.status,
            "category": self.category,
            "priority": self.priority,
            "tips": self.tips,
        }


# ─────────────────────────────────────────
#  Core Readiness Items
# ─────────────────────────────────────────

def _core_readiness_items(user) -> list[ChecklistItem]:
    """Generate core readiness items from user's onboarding data."""
    basics = user.startup_basics
    build = user.build
    traction = user.traction
    validation = user.validation
    fr = user.funding_readiness

    items = []

    # ── Documents & Identity ──
    items.append(ChecklistItem(
        "Startup Idea Description",
        "Clear, concise description of what you're building",
        "done" if (basics and basics.idea_description and len(basics.idea_description) > 20) else "missing",
        "document", 1,
        "Write a 2-3 sentence elevator pitch that anyone can understand."
    ))

    items.append(ChecklistItem(
        "Problem Statement",
        "Well-defined problem being solved with market context",
        "done" if (basics and basics.problem_statement and len(basics.problem_statement) > 20) else "missing",
        "document", 1,
        "Use the format: '[Target users] struggle with [problem] because [reason].'"
    ))

    items.append(ChecklistItem(
        "Target User Definition",
        "Specific customer segment with demographic/psychographic details",
        "done" if (basics and basics.target_user and len(basics.target_user) > 10) else "missing",
        "strategy", 1,
        "Be specific: 'Gen-Z college students in Tier-2 Indian cities' not just 'students'."
    ))

    items.append(ChecklistItem(
        "Incorporation Certificate",
        "Company registration (Pvt Ltd / LLP / Partnership)",
        "partial",  # We can't verify from onboarding data alone
        "document", 1,
        "Most government grants require DPIIT-recognized startup registration."
    ))

    # ── Product & Build ──
    items.append(ChecklistItem(
        "MVP / Working Prototype",
        "Functional product, demo, or clickable prototype",
        "done" if (build and build.build_stage >= 3) else
        "partial" if (build and build.build_stage >= 2) else "missing",
        "product", 1,
        "Even a Figma prototype or landing page with sign-ups counts as early validation."
    ))

    items.append(ChecklistItem(
        "Live Demo / Product Link",
        "Accessible URL for your working product or demo",
        "done" if (basics and (basics.website_link or basics.demo_link)) else "missing",
        "product", 2,
        "Deploy on Vercel/Netlify for free. A live link dramatically improves credibility."
    ))

    items.append(ChecklistItem(
        "GitHub / Source Repository",
        "Active development repository showing commit history",
        "done" if (basics and basics.github_link) else "missing",
        "product", 3,
        "Judges and evaluators often check GitHub for development activity."
    ))

    # ── Validation & Traction ──
    items.append(ChecklistItem(
        "User Validation Evidence",
        "Documented conversations with 10+ potential users",
        "done" if (validation and validation.users_spoken_to >= 3) else
        "partial" if (validation and validation.users_spoken_to >= 2) else "missing",
        "validation", 1,
        "Create a simple spreadsheet tracking: user name, problem confirmed, willingness to pay."
    ))

    items.append(ChecklistItem(
        "Traction Proof",
        "Evidence of early users, sign-ups, revenue, or engagement",
        "done" if (traction and traction.user_count >= 3) else
        "partial" if (traction and traction.user_count >= 2) else "missing",
        "validation", 1,
        "Screenshots of analytics dashboards, user counts, or waitlist numbers work well."
    ))

    items.append(ChecklistItem(
        "User Feedback Documentation",
        "Structured feedback from real users with patterns identified",
        "done" if (validation and validation.feedback_summary and len(validation.feedback_summary or "") > 20) else "missing",
        "validation", 2,
        "Summarize top 3 feedback themes and how you're addressing each."
    ))

    # ── Business Strategy ──
    items.append(ChecklistItem(
        "Business Model Clarity",
        "Clear revenue model and unit economics understanding",
        "done" if (fr and fr.business_model_score >= 3) else
        "partial" if (fr and fr.business_model_score >= 2) else "missing",
        "strategy", 1,
        "Define: How you make money, average revenue per user, and path to profitability."
    ))

    items.append(ChecklistItem(
        "Market Understanding (TAM/SAM/SOM)",
        "Total addressable market analysis with realistic sizing",
        "done" if (fr and fr.market_understanding_score >= 3) else
        "partial" if (fr and fr.market_understanding_score >= 2) else "missing",
        "strategy", 2,
        "Use bottom-up sizing. Top-down '1% of $X billion' arguments are weak."
    ))

    items.append(ChecklistItem(
        "Pitch Deck",
        "10-15 slide investor-ready presentation",
        "partial" if (basics and basics.demo_link) else "missing",
        "document", 1,
        "Follow the YC format: Problem → Solution → Traction → Market → Team → Ask."
    ))

    items.append(ChecklistItem(
        "Financial Projections",
        "3-year revenue projection with assumptions",
        "missing",  # Not captured in onboarding
        "document", 2,
        "Keep it simple: monthly revenue, costs, and growth assumptions for 36 months."
    ))

    items.append(ChecklistItem(
        "Go-to-Market Strategy",
        "Clear plan for acquiring first 100-1000 users",
        "partial" if (traction and traction.traction_signal_score >= 2) else "missing",
        "strategy", 2,
        "Focus on one channel first. 'We'll use social media, SEO, and ads' is too vague."
    ))

    # ── Team ──
    items.append(ChecklistItem(
        "Founder Profile / Bio",
        "Professional background, skills, and domain expertise",
        "done" if (fr and fr.founder_strength and len(fr.founder_strength or "") > 10) else "missing",
        "team", 2,
        "Highlight relevant experience, technical skills, and why you're uniquely positioned."
    ))

    items.append(ChecklistItem(
        "Team Composition",
        "Co-founders and key team members with complementary skills",
        "partial",  # Can't fully verify from onboarding
        "team", 2,
        "Strong teams have technical + business/domain expertise combination."
    ))

    return items


# ─────────────────────────────────────────
#  Opportunity-Specific Items
# ─────────────────────────────────────────

CATEGORY_SPECIFIC_ITEMS = {
    "government": [
        ChecklistItem("DPIIT Recognition", "Startup India recognition number",
                      "missing", "document", 1,
                      "Apply at startupindia.gov.in — takes 2-3 weeks. Most govt grants require this."),
        ChecklistItem("Udyam Registration", "MSME registration certificate",
                      "missing", "document", 2,
                      "Free registration at udyamregistration.gov.in."),
    ],
    "grant": [
        ChecklistItem("Detailed Project Proposal", "Technical proposal with milestones and budget",
                      "missing", "document", 1,
                      "Include: objectives, methodology, timeline, deliverables, and budget breakdown."),
        ChecklistItem("Budget Breakdown", "Itemized budget with justification for each expense",
                      "missing", "document", 1,
                      "Be specific: equipment, salaries, travel, materials — with unit costs."),
    ],
    "accelerator": [
        ChecklistItem("Pitch Video", "2-3 minute founder pitch video",
                      "missing", "document", 1,
                      "Record a casual, authentic video. Focus on problem, solution, and traction."),
        ChecklistItem("Product Demo Recording", "Screen recording showing your product in action",
                      "missing", "product", 2,
                      "Use Loom or similar tool. Show the core user flow, not every feature."),
    ],
    "hackathon": [
        ChecklistItem("Project README", "Clear documentation of your project",
                      "missing", "document", 2,
                      "Include: what it does, how to run it, tech stack, and screenshots."),
        ChecklistItem("Demo Video", "2-minute demo showing the project working",
                      "missing", "product", 1,
                      "Focus on the 'wow' moment. Show the working product, not slides."),
    ],
    "fellowship": [
        ChecklistItem("Personal Statement / Essay", "Founder motivation and vision essay",
                      "missing", "document", 1,
                      "Write about why you care about this problem and your unique insight."),
        ChecklistItem("Recommendation Letters", "References from mentors or domain experts",
                      "missing", "document", 2,
                      "Reach out to professors, previous employers, or industry mentors."),
    ],
    "incubator": [
        ChecklistItem("Innovation Description", "Technical differentiation and novelty",
                      "missing", "document", 1,
                      "Explain what's technically novel about your approach vs. existing solutions."),
    ],
    "student": [
        ChecklistItem("Student ID / Enrollment Proof", "Current student or recent graduate status",
                      "missing", "document", 1,
                      "University ID card, enrollment letter, or recent transcript."),
        ChecklistItem("Faculty Recommendation", "Letter from a faculty advisor",
                      "missing", "document", 2,
                      "Approach a professor in your domain who can vouch for your technical ability."),
    ],
}


def _add_opportunity_specific_items(
    items: list[ChecklistItem],
    opp_category: str,
    opp_required_docs: list[str],
) -> list[ChecklistItem]:
    """Add opportunity-type-specific and explicit required doc items."""

    # Add category-specific items
    category_items = CATEGORY_SPECIFIC_ITEMS.get(opp_category, [])
    existing_names = {i.item.lower() for i in items}

    for ci in category_items:
        if ci.item.lower() not in existing_names:
            items.append(ChecklistItem(
                ci.item, ci.description, ci.status,
                ci.category, ci.priority, ci.tips
            ))
            existing_names.add(ci.item.lower())

    # Add explicit required docs from the opportunity
    for doc in opp_required_docs:
        doc_lower = doc.strip().lower()
        if not any(doc_lower in name for name in existing_names):
            items.append(ChecklistItem(
                doc, f"Required document for this opportunity",
                "missing", "document", 1,
                f"This is specifically required by the opportunity. Prepare it before applying."
            ))
            existing_names.add(doc_lower)

    return items


# ─────────────────────────────────────────
#  Public API: Build Full Readiness Assessment
# ─────────────────────────────────────────

def build_readiness_assessment(opp, user) -> dict:
    """
    Build a comprehensive readiness assessment for a founder + opportunity pair.
    
    Returns:
        {
            readiness_percentage: int,
            total_items: int,
            completed: int,
            partial: int,
            missing: int,
            critical_missing: [str],
            checklist: [{item, description, status, category, priority, tips}],
            preparation_summary: str,
            estimated_prep_time: str,
        }
    """
    # Start with core items
    items = _core_readiness_items(user)

    # Add opportunity-specific items
    items = _add_opportunity_specific_items(
        items,
        opp.category if opp else "",
        opp.required_docs if opp else [],
    )

    # Sort by priority then category
    items.sort(key=lambda x: (x.priority, x.category))

    # Calculate stats
    done = sum(1 for i in items if i.status == "done")
    partial = sum(1 for i in items if i.status == "partial")
    missing = sum(1 for i in items if i.status == "missing")
    total = len(items)

    # Readiness percentage: done=100%, partial=50%, missing=0%
    if total > 0:
        weighted = (done * 100 + partial * 50) / total
        readiness_pct = round(weighted)
    else:
        readiness_pct = 0

    # Critical missing items (priority 1 + missing)
    critical_missing = [
        i.item for i in items
        if i.status == "missing" and i.priority == 1
    ]

    # Preparation summary
    prep_summary = _generate_prep_summary(readiness_pct, critical_missing, opp)

    # Estimated preparation time
    est_time = _estimate_prep_time(missing, partial)

    return {
        "readiness_percentage": readiness_pct,
        "total_items": total,
        "completed": done,
        "partial": partial,
        "missing": missing,
        "critical_missing": critical_missing,
        "checklist": [i.to_dict() for i in items],
        "preparation_summary": prep_summary,
        "estimated_prep_time": est_time,
    }


def _generate_prep_summary(pct: int, critical: list, opp) -> str:
    """Generate a human-readable preparation summary."""
    opp_title = opp.title if opp else "this opportunity"

    if pct >= 85:
        return (
            f"You're in excellent shape for {opp_title}! "
            f"Most requirements are met. Focus on polishing your application materials."
        )
    elif pct >= 65:
        return (
            f"Good progress toward {opp_title}. "
            f"Address the {len(critical)} critical gaps before applying to maximize your chances."
        )
    elif pct >= 40:
        return (
            f"You have a foundation but need significant preparation for {opp_title}. "
            f"Focus on the critical items first — especially: {', '.join(critical[:3])}."
        )
    else:
        return (
            f"Significant preparation needed for {opp_title}. "
            f"Consider building your foundation with these priorities: {', '.join(critical[:3])}. "
            f"You might also explore more beginner-friendly opportunities while preparing."
        )


def _estimate_prep_time(missing: int, partial: int) -> str:
    """Rough estimate of preparation time."""
    total_work = missing * 3 + partial * 1  # hours estimate
    if total_work <= 5:
        return "1-2 days"
    elif total_work <= 15:
        return "1-2 weeks"
    elif total_work <= 30:
        return "2-4 weeks"
    else:
        return "1-2 months"


# ─────────────────────────────────────────
#  Quick Readiness Score (for recommendation cards)
# ─────────────────────────────────────────

def quick_readiness_score(opp, user) -> dict:
    """
    Fast readiness estimate for use in recommendation cards.
    Returns {level: str, percentage: int, gaps: int}
    """
    items = _core_readiness_items(user)
    items = _add_opportunity_specific_items(
        items, opp.category if opp else "", opp.required_docs if opp else []
    )

    done = sum(1 for i in items if i.status == "done")
    partial = sum(1 for i in items if i.status == "partial")
    total = len(items)

    if total > 0:
        pct = round((done * 100 + partial * 50) / total)
    else:
        pct = 0

    if pct >= 75:
        level = "High"
    elif pct >= 45:
        level = "Medium"
    else:
        level = "Low"

    gaps = sum(1 for i in items if i.status == "missing" and i.priority == 1)

    return {"level": level, "percentage": pct, "gaps": gaps}
