from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class IntentRequest(BaseModel):
    goal_text: str = Field(..., description="Natural language goal entered by the user")
    duration_min: Optional[int] = Field(45, description="Planned duration in minutes")


class IntentResponse(BaseModel):
    goal: str = Field(..., description="Cleaned goal text without duration substring")
    duration_min: int = Field(..., description="Extracted or configured duration in minutes")
    on_track_examples: List[str] = Field(default_factory=list, description="4-6 activities advancing the goal")
    adjacent_examples: List[str] = Field(default_factory=list, description="4-6 supportive/adjacent activities")
    drift_examples: List[str] = Field(default_factory=list, description="4-6 distracting/drift activities")


class ClassifyRequest(BaseModel):
    goal: str = Field(..., description="Current session goal")
    on_track_examples: List[str] = Field(default_factory=list)
    adjacent_examples: List[str] = Field(default_factory=list)
    drift_examples: List[str] = Field(default_factory=list)
    activity: str = Field(..., description="Activity currently performed")
    recent_activities: List[str] = Field(default_factory=list, description="Prior activities, e.g. 'activity [status]'")


class ClassifyResponse(BaseModel):
    status: Literal["on_track", "adjacent", "drifted"] = Field(..., description="Intent classification")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")
    reason: str = Field(..., description="Max 20 words explaining the determination")
    nudge: str = Field("", description="Max 25 words gentle nudge if drifted, else empty")
    fallback: bool = Field(False, description="True if fallback/mock classifier was used")


class ContextSwitchTax(BaseModel):
    low: int
    high: int


class LogEntry(BaseModel):
    timestamp: float = Field(..., description="Epoch timestamp in seconds or milliseconds")
    activity: str
    status: Literal["on_track", "adjacent", "drifted"]


class SummaryRequest(BaseModel):
    goal: Optional[str] = ""
    duration_min: Optional[int] = 45
    logs: List[LogEntry] = Field(default_factory=list)
    session_start_timestamp: Optional[float] = None
    session_end_timestamp: Optional[float] = None


class SummaryResponse(BaseModel):
    focus_score: int = Field(..., ge=0, le=100, description="Time-weighted focus score from 0 to 100")
    time_on_track_min: float
    time_adjacent_min: float
    time_drifted_min: float
    switch_count: int
    context_switch_tax_min: ContextSwitchTax
    insight: str


class HealthResponse(BaseModel):
    ok: bool = True
    mock: bool
