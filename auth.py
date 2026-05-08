"""
FundMe Pydantic Schemas — Auth + FounderProfile.
"""
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr


# ── Auth Schemas ──

class SignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6, description="Minimum 6 characters")


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    success: bool
    token: str
    user_id: str
    name: str
    email: str
    message: str


class AuthErrorResponse(BaseModel):
    success: bool = False
    message: str


# ── Founder Profile Schemas ──

class FounderProfileSubmitRequest(BaseModel):
    """Simplified single-page questionnaire payload."""
    # Required
    problem: str = Field(..., min_length=10, description="What problem are you solving?")
    solution: str = Field(..., min_length=10, description="What solution have you built or planned?")
    domain: str = Field(..., description="Industry/domain e.g. AI, Healthcare, Fintech")
    stage: str = Field(..., description="Startup stage: Idea | MVP | Early users | Revenue stage")
    geography: str = Field(..., description="Target market: India | US | Global")

    # Optional
    target_user: Optional[str] = None
    seeking: Optional[List[str]] = None      # ["grants", "accelerators", "hackathons", ...]

    # Optional links
    github_link: Optional[str] = None
    linkedin_link: Optional[str] = None
    pitch_deck_url: Optional[str] = None
    website_link: Optional[str] = None
    demo_link: Optional[str] = None


class FounderProfileResponse(BaseModel):
    success: bool
    profile_id: str
    user_id: str
    extracted_keywords: Optional[List[str]] = None
    startup_category: Optional[str] = None
    ai_profile_summary: Optional[str] = None
    message: str


class KeywordExtractionRequest(BaseModel):
    problem: str
    solution: str
    domain: str
    stage: str
    geography: str
    target_user: Optional[str] = None


class KeywordExtractionResponse(BaseModel):
    keywords: List[str]
    category: str
    summary: str
    tags: List[str]
