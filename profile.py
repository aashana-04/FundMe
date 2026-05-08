"""
FundMe Profile Routes — simplified questionnaire submission + keyword extraction.
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.schemas.auth import (
    FounderProfileSubmitRequest,
    FounderProfileResponse,
    KeywordExtractionRequest,
    KeywordExtractionResponse,
)
from backend.models.auth import FounderProfile, AuthUser
from backend.models.onboarding import User, StartupBasics, ProblemClarity, Validation, Build, Traction, FundingReadiness
import json
from backend.services.auth_service import verify_token
from backend.services.keyword_service import extract_startup_keywords

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profile", tags=["Profile"])


def _get_current_user(authorization: Optional[str], db: Session) -> AuthUser:
    """Extract user from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")
    token = authorization[7:]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    user = db.query(AuthUser).filter(AuthUser.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


@router.post(
    "/submit",
    response_model=FounderProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit simplified founder questionnaire",
)
def submit_profile(
    payload: FounderProfileSubmitRequest,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    user = _get_current_user(authorization, db)

    # Run AI keyword extraction
    extraction_data = {
        "problem": payload.problem,
        "solution": payload.solution,
        "domain": payload.domain,
        "stage": payload.stage,
        "geography": payload.geography,
        "target_user": payload.target_user or "",
    }

    try:
        extracted = extract_startup_keywords(extraction_data)
    except Exception as e:
        logger.error("Keyword extraction error: %s", e)
        extracted = {
            "keywords": [payload.domain, payload.stage],
            "category": payload.domain,
            "summary": f"{payload.stage} startup in {payload.domain}.",
            "tags": [payload.domain],
        }

    profile = FounderProfile(
        auth_user_id=user.id,
        problem=payload.problem,
        solution=payload.solution,
        domain=payload.domain,
        stage=payload.stage,
        geography=payload.geography,
        target_user=payload.target_user,
        seeking=payload.seeking,
        github_link=payload.github_link,
        linkedin_link=payload.linkedin_link,
        pitch_deck_url=payload.pitch_deck_url,
        website_link=payload.website_link,
        demo_link=payload.demo_link,
        extracted_keywords=extracted.get("keywords", []),
        startup_category=extracted.get("category"),
        ai_profile_summary=extracted.get("summary"),
    )
    db.add(profile)

    # Maintain backward compatibility with legacy User model
    legacy_user = db.query(User).filter(User.auth_user_id == user.id).first()
    if not legacy_user:
        legacy_user = User(auth_user_id=user.id)
        db.add(legacy_user)
        db.flush()

        build_stage = 1
        stage_lower = payload.stage.lower()
        if stage_lower in ["mvp", "build"]: build_stage = 3
        elif stage_lower in ["traction", "scale", "growth", "revenue stage", "seed-ready", "seed"]: build_stage = 4

        db.add(StartupBasics(
            user_id=legacy_user.id,
            idea_description=f"Building in {payload.domain}",
            problem_statement=payload.problem,
            solution_description=payload.solution,
            target_user=payload.target_user or "General users",
            github_link=payload.github_link,
            website_link=payload.website_link,
            demo_link=payload.demo_link
        ))
        db.add(ProblemClarity(user_id=legacy_user.id, problem_definition_score=3, target_user_clarity_score=3, frequency_score=3, severity_score=3))
        db.add(Validation(user_id=legacy_user.id, users_spoken_to=5, user_type_score=3, feedback_summary="", pattern_score=3, iteration_score=3))
        db.add(Build(user_id=legacy_user.id, build_stage=build_stage, accessibility_score=3, development_activity_score=3))
        db.add(Traction(user_id=legacy_user.id, user_count=10 if build_stage >= 3 else 0, engagement_score=3, feedback_summary="", traction_signal_score=3))
        db.add(FundingReadiness(user_id=legacy_user.id, market_understanding_score=3, business_model_score=3, founder_strength="", funding_history_score=1))
    
    legacy_user.ai_profile_json = json.dumps(extracted)
    db.commit()
    db.refresh(profile)

    return FounderProfileResponse(
        success=True,
        profile_id=profile.id,
        user_id=user.id,
        extracted_keywords=profile.extracted_keywords,
        startup_category=profile.startup_category,
        ai_profile_summary=profile.ai_profile_summary,
        message="Profile created. Finding your opportunities...",
    )


@router.post(
    "/extract-keywords",
    response_model=KeywordExtractionResponse,
    summary="Extract AI keywords from startup description (no auth required)",
)
def extract_keywords(payload: KeywordExtractionRequest):
    """Lightweight endpoint to preview keyword extraction without saving."""
    data = {
        "problem": payload.problem,
        "solution": payload.solution,
        "domain": payload.domain,
        "stage": payload.stage,
        "geography": payload.geography,
        "target_user": payload.target_user or "",
    }
    result = extract_startup_keywords(data)
    return KeywordExtractionResponse(
        keywords=result["keywords"],
        category=result["category"],
        summary=result["summary"],
        tags=result["tags"],
    )


@router.get(
    "/me/latest",
    summary="Get latest profile for the authenticated user",
)
def get_latest_profile(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    user = _get_current_user(authorization, db)
    profile = (
        db.query(FounderProfile)
        .filter(FounderProfile.auth_user_id == user.id)
        .order_by(FounderProfile.created_at.desc())
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="No profile found. Please complete the questionnaire.")
    return {
        "profile_id": profile.id,
        "user_id": user.id,
        "domain": profile.domain,
        "stage": profile.stage,
        "geography": profile.geography,
        "extracted_keywords": profile.extracted_keywords,
        "startup_category": profile.startup_category,
        "ai_profile_summary": profile.ai_profile_summary,
    }
