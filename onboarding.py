"""
FundMe Onboarding Service — business logic, CRUD, scoring engine.
Now also runs AI keyword extraction on submit and stores the rich profile.
"""
import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.models.onboarding import (
    User, StartupBasics, ProblemClarity,
    Validation, Build, Traction, FundingReadiness,
)
from backend.schemas.onboarding import OnboardingSubmitRequest

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────
#  CRUD helpers
# ─────────────────────────────────────────

def create_user(db: Session, auth_user_id: str | None = None) -> User:
    """Create and persist a new user row, returning it."""
    logger.info("Creating user with %s auth_user_id", auth_user_id)
    print(f"Creating user with {auth_user_id} auth_user_id")
    user = User(auth_user_id=auth_user_id)
    db.add(user)
    db.flush()          # populate user.id before child inserts
    return user


def save_onboarding(db: Session, payload: OnboardingSubmitRequest, auth_user_id: str | None = None) -> str:
    """
    Persist a full onboarding submission.
    Creates a new User + all 6 child rows atomically.
    Runs AI keyword extraction and stores the enriched profile.
    Returns the new user_id.
    """
    logger.info(f"Creating a user with {auth_user_id} user id")
    user = create_user(db, auth_user_id)
    uid = user.id

    db.add(StartupBasics(user_id=uid, **payload.startup_basics.model_dump()))
    db.add(ProblemClarity(user_id=uid, **payload.problem_clarity.model_dump()))
    db.add(Validation(user_id=uid, **payload.validation.model_dump()))
    db.add(Build(user_id=uid, **payload.build.model_dump()))
    db.add(Traction(user_id=uid, **payload.traction.model_dump()))
    db.add(FundingReadiness(user_id=uid, **payload.funding_readiness.model_dump()))

    # Run AI keyword extraction to build the startup intelligence profile
    try:
        from backend.services.keyword_service import extract_startup_keywords
        basics = payload.startup_basics
        funding = payload.funding_readiness

        extraction_data = {
            "idea": basics.idea_description or "",
            "problem": basics.problem_statement or "",
            "solution": basics.solution_description or "",
            "target_user": basics.target_user or "",
            "domain": "",   # inferred by AI from idea/problem/solution
            "stage": "Idea",  # will be updated post-analysis; we use MVP build signal
            "founder_strength": funding.founder_strength or "",
        }

        # Infer rough stage from build_score for better extraction
        build_score = payload.build.build_stage
        if build_score >= 4:
            extraction_data["stage"] = "Live Product"
        elif build_score == 3:
            extraction_data["stage"] = "MVP"
        elif build_score == 2:
            extraction_data["stage"] = "Prototype"
        else:
            extraction_data["stage"] = "Idea"

        ai_profile = extract_startup_keywords(extraction_data)
        user.ai_profile_json = json.dumps(ai_profile)
        logger.info("AI profile extracted for user %s: category=%s archetype=%s",
                    uid, ai_profile.get("category"), ai_profile.get("archetype"))
    except Exception as exc:
        logger.warning("AI keyword extraction failed during onboarding for %s: %s", uid, exc)
        # Non-fatal — continue without AI profile

    db.commit()
    db.refresh(user)
    return uid


def get_user_data(db: Session, user_id: str) -> User | None:
    """Return a User ORM object with all relationships loaded, or None."""
    return db.query(User).filter(or_(User.id == user_id, User.auth_user_id == user_id)).first()


# ─────────────────────────────────────────
#  Scoring Engine
# ─────────────────────────────────────────

STAGE_THRESHOLDS = [
    (85, "Seed-Ready",    "Your startup shows strong fundamentals across all dimensions. You're positioned to approach seed investors."),
    (65, "Pre-Seed",      "Good traction with some gaps. Focus on the weak areas below before approaching investors."),
    (45, "Validation",    "You have a concept and early signals. Now validate rigorously — talk to more users and iterate."),
    (25, "Ideation",      "You're still shaping your idea. Nail the problem first before thinking about building or funding."),
    (0,  "Exploration",   "Very early stage. Focus on discovering a real problem worth solving."),
]

SECTION_WEIGHTS = {
    "problem_clarity":   0.20,
    "validation":        0.20,
    "build":             0.15,
    "traction":          0.20,
    "funding_readiness": 0.25,
}


def _section_score(values: list[int], max_val: int = 4) -> int:
    """Convert a list of 1-4 scores to a 0-100 section score."""
    if not values:
        return 0
    avg = sum(values) / len(values)
    return round((avg - 1) / (max_val - 1) * 100)


def _score_problem_clarity(row: ProblemClarity) -> int:
    return _section_score([
        row.problem_definition_score,
        row.target_user_clarity_score,
        row.frequency_score,
        row.severity_score,
    ])


def _score_validation(row: Validation) -> int:
    return _section_score([
        row.users_spoken_to,
        row.user_type_score,
        row.pattern_score,
        row.iteration_score,
    ])


def _score_build(row: Build) -> int:
    return _section_score([
        row.build_stage,
        row.accessibility_score,
        row.development_activity_score,
    ])


def _score_traction(row: Traction) -> int:
    return _section_score([
        row.user_count,
        row.engagement_score,
        row.traction_signal_score,
    ])


def _score_funding_readiness(row: FundingReadiness) -> int:
    return _section_score([
        row.market_understanding_score,
        row.business_model_score,
        row.funding_history_score,
    ])


def compute_analysis(user: User) -> dict:
    """
    Run the scoring engine against a user's full onboarding data.
    Returns a dict matching AnalysisResponse schema.
    """
    scores = {
        "problem_clarity":   _score_problem_clarity(user.problem_clarity)   if user.problem_clarity   else 0,
        "validation":        _score_validation(user.validation)              if user.validation        else 0,
        "build":             _score_build(user.build)                        if user.build             else 0,
        "traction":          _score_traction(user.traction)                  if user.traction          else 0,
        "funding_readiness": _score_funding_readiness(user.funding_readiness) if user.funding_readiness else 0,
    }

    # Weighted overall score
    overall = round(sum(scores[k] * SECTION_WEIGHTS[k] for k in scores))

    # Determine stage
    stage, stage_label = "Exploration", "Very early stage."
    for threshold, name, label in STAGE_THRESHOLDS:
        if overall >= threshold:
            stage, stage_label = name, label
            break

    # Strengths / weaknesses (top 2 / bottom 2 sections)
    sorted_sections = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    label_map = {
        "problem_clarity":   "Problem Clarity",
        "validation":        "Validation",
        "build":             "Build",
        "traction":          "Traction",
        "funding_readiness": "Funding Readiness",
    }

    strengths  = [f"Strong {label_map[k]} ({v}%)" for k, v in sorted_sections[:2] if v >= 50]
    weaknesses = [f"Weak {label_map[k]} ({v}%)"   for k, v in sorted_sections[-2:] if v < 70]

    # Next steps
    next_steps = _generate_next_steps(scores, overall)

    return {
        "user_id":       user.id,
        "stage":         stage,
        "stage_label":   stage_label,
        "overall_score": overall,
        "scores":        scores,
        "strengths":     strengths,
        "weaknesses":    weaknesses,
        "next_steps":    next_steps,
    }


def _generate_next_steps(scores: dict, overall: int) -> list[str]:
    steps = []
    if scores["problem_clarity"] < 60:
        steps.append("Sharpen your problem definition — can you state it in one crisp sentence?")
    if scores["validation"] < 60:
        steps.append("Conduct at least 20 user interviews before building further.")
    if scores["build"] < 50:
        steps.append("Build a lightweight MVP (clickable prototype or landing page) to test demand.")
    if scores["traction"] < 50:
        steps.append("Find your first 10 engaged users who return without being prompted.")
    if scores["funding_readiness"] < 60:
        steps.append("Define a clear business model and quantify your total addressable market.")
    if overall >= 65:
        steps.append("Prepare a concise pitch deck and identify 5-10 relevant seed investors.")
    if not steps:
        steps.append("You're doing great — keep iterating, measure retention, and start fundraising conversations.")
    return steps[:4]  # cap at 4 steps
