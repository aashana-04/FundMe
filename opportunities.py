"""
FundMe Opportunity Intelligence — Pydantic Schemas (Extended).
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────
#  Opportunity (Read)
# ─────────────────────────────────────────

class OpportunitySchema(BaseModel):

    id:               str
    title:            str
    organization:     str
    description:      str
    category:         str
    tags:             List[str] = []
    eligibility_summary: Optional[str] = None
    startup_stages:   List[str] = []
    geography:        List[str] = []
    domain_focus:     List[str] = []
    founder_criteria: List[str] = []
    funding_amount:   Optional[str] = None
    benefits:         List[str] = []
    required_docs:    List[str] = []
    official_link:    str
    deadline:         Optional[str] = None
    is_active:        bool = True
    source_name:      Optional[str] = None
    source_type:      Optional[str] = None    # "live" | "curated" | "rss"
    source_id:        Optional[str] = None     # external source ID
    last_scraped:     Optional[str] = None     # ISO timestamp
    created_at:       Optional[str] = None

    model_config = {
        "from_attributes": True
    }


# ─────────────────────────────────────────
#  AI Recommendation Envelope
# ─────────────────────────────────────────

class AIOpportunityInsight(BaseModel):

    why_recommended:      str = ""
    readiness_level:      str = ""       # "High" | "Medium" | "Low"
    key_gaps:             List[str] = []
    application_strategy: str = ""
    priority_level:       str = ""       # "Top Pick" | "Strong Fit" | "Worth Exploring"
    estimated_fit_score:  int = 0        # 0-100


# ─────────────────────────────────────────
#  Recommended Opportunity
# ─────────────────────────────────────────

class RecommendedOpportunity(BaseModel):

    opportunity:     OpportunitySchema
    ai_insight:      AIOpportunityInsight
    relevance_score: float = 0.0
    user_status:     Optional[str] = None   # "shortlisted" | "applied" | None
    is_shortlisted:  bool = False


# ─────────────────────────────────────────
#  Recommended Response
# ─────────────────────────────────────────

class OpportunityRecommendationsResponse(BaseModel):

    user_id:            str
    total:              int
    opportunities:      List[RecommendedOpportunity]
    generated_at:       str
    # AI profile fields — populated from founder_profile built during ranking
    extracted_keywords: List[str] = []
    ai_profile_summary: str = ""
    domain:             str = ""
    stage:              str = ""
    startup_category:   str = ""
    archetype:          str = ""


# ─────────────────────────────────────────
#  Search / Filter
# ─────────────────────────────────────────

class SearchResponse(BaseModel):

    total:         int
    offset:        int
    limit:         int
    opportunities: List[OpportunitySchema]
    query:         str = ""
    filters:       Dict[str, Any] = {}


# ─────────────────────────────────────────
#  Readiness Assessment
# ─────────────────────────────────────────

class ChecklistItemSchema(BaseModel):

    item:        str
    description: str
    status:      str      # "done" | "partial" | "missing"
    category:    str = "general"
    priority:    int = 2
    tips:        str = ""


class ReadinessAssessmentResponse(BaseModel):

    readiness_percentage: int
    total_items:          int
    completed:            int
    partial:              int
    missing:              int
    critical_missing:     List[str] = []
    checklist:            List[Dict[str, Any]] = []
    preparation_summary:  str = ""
    estimated_prep_time:  str = ""


# ─────────────────────────────────────────
#  Shortlist / Status
# ─────────────────────────────────────────

class ShortlistRequest(BaseModel):

    user_id: str


class ShortlistResponse(BaseModel):

    success:        bool
    message:        str
    opportunity_id: str


class MarkAppliedRequest(BaseModel):

    user_id: str
    notes:   Optional[str] = None


class MarkAppliedResponse(BaseModel):

    success:        bool
    message:        str
    opportunity_id: str
    status:         str


class ShortlistedOpportunitiesResponse(BaseModel):

    user_id:       str
    total:         int
    opportunities: List[OpportunitySchema]


# ─────────────────────────────────────────
#  Single Opportunity Detail
# ─────────────────────────────────────────

class OpportunityDetailResponse(BaseModel):

    opportunity: OpportunitySchema
    user_status: Optional[str] = None
    checklist:   List[Dict[str, Any]] = []
    readiness:   Optional[Dict[str, Any]] = None


# ─────────────────────────────────────────
#  Admin / Ingestion Report
# ─────────────────────────────────────────

class IngestionReportResponse(BaseModel):

    total_opportunities: int
    active:              int
    inactive:            int
    live_count:          int = 0
    curated_count:       int = 0
    stale_count:         int
    sources:             Dict[str, int] = {}
    categories:          Dict[str, int] = {}
    trusted_sources:     int
    live_adapters:       List[Dict[str, Any]] = []
    sync_history:        Dict[str, Any] = {}
    last_refresh:        str