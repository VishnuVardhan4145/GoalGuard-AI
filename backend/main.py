import os
import re
import time
from typing import List
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from config import (
    HOST,
    PORT,
    MOCK_LLM,
    GEMINI_API_KEY,
    ALLOWED_ORIGINS,
    SWITCH_TAX_MIN_LOW,
    SWITCH_TAX_MIN_HIGH,
)
from models import (
    IntentRequest,
    IntentResponse,
    ClassifyRequest,
    ClassifyResponse,
    SummaryRequest,
    SummaryResponse,
    HealthResponse,
    ContextSwitchTax,
    LogEntry,
)
import llm

app = FastAPI(title="GoalGuard AI", version="1.0.0")

# CORS: exact origins from config + regex for Vercel preview URLs
_VERCEL_ORIGIN_RE = re.compile(r"^https://.*\.vercel\.app$")


class FlexibleCORSMiddleware(BaseHTTPMiddleware):
    """CORS middleware that supports both exact origins and regex patterns."""

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")
        allowed = origin in ALLOWED_ORIGINS or bool(_VERCEL_ORIGIN_RE.match(origin))

        if request.method == "OPTIONS":
            response = Response(status_code=200)
        else:
            response = await call_next(request)

        if allowed and origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Vary"] = "Origin"

        return response


app.add_middleware(FlexibleCORSMiddleware)


@app.get("/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint indicating whether mock LLM mode is active."""
    is_mock = MOCK_LLM or not bool(GEMINI_API_KEY)
    return HealthResponse(ok=True, mock=is_mock)


@app.post("/intent", response_model=IntentResponse)
def get_intent(req: IntentRequest):
    """Parse user goal and extract duration + categorized examples."""
    try:
        return llm.generate_intent(req.goal_text, req.duration_min)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/classify", response_model=ClassifyResponse)
def classify_activity_endpoint(req: ClassifyRequest):
    """Classify current activity against goal and intent profile."""
    try:
        return llm.classify_activity(
            goal=req.goal,
            activity=req.activity,
            on_track_examples=req.on_track_examples,
            adjacent_examples=req.adjacent_examples,
            drift_examples=req.drift_examples,
            recent_activities=req.recent_activities,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def calculate_session_metrics(
    logs: List[LogEntry],
    duration_min: int,
    session_start_timestamp: float = None,
    session_end_timestamp: float = None,
):
    """
    Calculate focus score, time breakdown, and context switch tax:
    - Switch count: Transitions between on_track and non-on_track (adjacent/drifted).
    - Time-weighted focus score: (1.0*on_track + 0.5*adjacent + 0.0*drift) / total_time * 100.
    - Switch tax: switch_count * [SWITCH_TAX_MIN_LOW, SWITCH_TAX_MIN_HIGH].
    """
    if not logs:
        return {
            "focus_score": 100,
            "time_on_track_min": float(duration_min),
            "time_adjacent_min": 0.0,
            "time_drifted_min": 0.0,
            "switch_count": 0,
        }

    # Normalize timestamps (handle milliseconds if > 1e11)
    norm_logs = []
    for log in logs:
        ts = log.timestamp
        if ts > 1e11:
            ts = ts / 1000.0
        norm_logs.append((ts, log.status))

    # Sort logs by timestamp
    norm_logs.sort(key=lambda x: x[0])

    # Count transitions between on_track and non-on_track
    switch_count = 0
    for i in range(1, len(norm_logs)):
        prev_is_on_track = norm_logs[i - 1][1] == "on_track"
        curr_is_on_track = norm_logs[i][1] == "on_track"
        if prev_is_on_track != curr_is_on_track:
            switch_count += 1

    # Time allocation calculation
    durations = {"on_track": 0.0, "adjacent": 0.0, "drifted": 0.0}

    # If timestamps are distinct and show real progression
    has_meaningful_intervals = (
        len(norm_logs) > 1 and (norm_logs[-1][0] - norm_logs[0][0]) > 1.0
    )

    if has_meaningful_intervals:
        for i in range(len(norm_logs)):
            status = norm_logs[i][1]
            if i < len(norm_logs) - 1:
                interval_sec = max(0.0, norm_logs[i + 1][0] - norm_logs[i][0])
            else:
                if session_end_timestamp:
                    end_ts = (
                        session_end_timestamp / 1000.0
                        if session_end_timestamp > 1e11
                        else session_end_timestamp
                    )
                    interval_sec = max(0.0, end_ts - norm_logs[i][0])
                else:
                    # Default last interval to average of previous intervals
                    interval_sec = max(
                        10.0, (norm_logs[i][0] - norm_logs[0][0]) / max(1, i)
                    )
            durations[status] += interval_sec / 60.0
    else:
        # Equal distribution across logs based on duration_min
        slice_min = duration_min / max(1, len(norm_logs))
        for _, status in norm_logs:
            durations[status] += slice_min

    total_time = sum(durations.values())
    if total_time <= 0:
        total_time = float(duration_min) or 1.0
        durations["on_track"] = total_time

    raw_score = (
        (1.0 * durations["on_track"] + 0.5 * durations["adjacent"] + 0.0 * durations["drifted"])
        / total_time
    ) * 100.0

    focus_score = int(round(max(0.0, min(100.0, raw_score))))

    return {
        "focus_score": focus_score,
        "time_on_track_min": round(durations["on_track"], 1),
        "time_adjacent_min": round(durations["adjacent"], 1),
        "time_drifted_min": round(durations["drifted"], 1),
        "switch_count": switch_count,
    }


@app.post("/summary", response_model=SummaryResponse)
def get_summary(req: SummaryRequest):
    """Calculate session summary metrics and insight."""
    duration_min = req.duration_min or 45
    metrics = calculate_session_metrics(
        logs=req.logs,
        duration_min=duration_min,
        session_start_timestamp=req.session_start_timestamp,
        session_end_timestamp=req.session_end_timestamp,
    )

    tax_low = metrics["switch_count"] * SWITCH_TAX_MIN_LOW
    tax_high = metrics["switch_count"] * SWITCH_TAX_MIN_HIGH

    insight = llm.generate_summary_insight(
        goal=req.goal or "Focus Session",
        duration_min=duration_min,
        focus_score=metrics["focus_score"],
        time_on_track_min=metrics["time_on_track_min"],
        time_adjacent_min=metrics["time_adjacent_min"],
        time_drifted_min=metrics["time_drifted_min"],
        switch_count=metrics["switch_count"],
        tax_low=tax_low,
        tax_high=tax_high,
    )

    return SummaryResponse(
        focus_score=metrics["focus_score"],
        time_on_track_min=metrics["time_on_track_min"],
        time_adjacent_min=metrics["time_adjacent_min"],
        time_drifted_min=metrics["time_drifted_min"],
        switch_count=metrics["switch_count"],
        context_switch_tax_min=ContextSwitchTax(low=tax_low, high=tax_high),
        insight=insight,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
