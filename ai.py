"""
FundMe AI Schemas — request/response models for the AI mentor endpoint.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AIAnalysisRequest(BaseModel):
    """
    Payload accepted by POST /api/v1/ai/analysis.

    The client can pass data directly (e.g., freshly computed from the
    scoring engine) without needing a stored user_id.
    """

    idea: str = Field(..., min_length=1, description="What the founder is building.")
    problem: str = Field(..., min_length=1, description="The problem being solved.")
    target_user: str = Field(..., min_length=1, description="Who the product is for.")
    solution: str = Field(..., min_length=1, description="What the product does.")

    stage: str = Field(..., description="Stage determined by the scoring engine (e.g. 'Pre-Seed').")

    scores: Dict[str, Any] = Field(
        default_factory=dict,
        description="Section scores as returned by the scoring engine (keys are section names, values are 0-100 ints).",
    )
    strengths: List[str] = Field(
        default_factory=list,
        description="Strength strings returned by the scoring engine.",
    )
    weaknesses: List[str] = Field(
        default_factory=list,
        description="Weakness strings returned by the scoring engine.",
    )


class AIAnalysisResponse(BaseModel):
    """
    Structured response from the AI mentor.

    All fields are populated by the LLM; if the LLM call fails a safe
    fallback is returned with the same shape.
    """

    stage_explanation: str = Field(
        description="Why the startup is at its current stage, based on the specific inputs."
    )
    personalized_advice: str = Field(
        description="Highly specific advice tailored to the founder's exact idea and audience."
    )
    key_risks: List[str] = Field(
        description="2–4 key risks or mistakes the founder is likely making right now."
    )
    next_steps_detailed: List[str] = Field(
        description="3–5 concrete, priority-ordered next steps."
    )
    improvement_focus: str = Field(
        description="The single area the founder must prioritise first, with reasoning."
    )

    # Optional meta-fields present only when the AI call fails
    _fallback_reason: Optional[str] = None
    _raw_response: Optional[str] = None

    model_config = {"populate_by_name": True}
