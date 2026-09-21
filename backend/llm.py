import json
import logging
from typing import Optional, Dict, Any, List
from google import genai
from google.genai import types
from pydantic import ValidationError

from config import GEMINI_API_KEY, GEMINI_MODEL, MOCK_LLM
from models import IntentResponse, ClassifyResponse, SummaryResponse
import prompts
import mock_classifier

logger = logging.getLogger(__name__)


def get_genai_client() -> Optional[genai.Client]:
    if MOCK_LLM or not GEMINI_API_KEY:
        return None
    try:
        return genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        logger.warning(f"Failed to initialize google-genai client: {e}")
        return None


def generate_intent(goal_text: str, duration_min: Optional[int] = 45) -> IntentResponse:
    """
    Extract clean goal, duration, and example activities using Gemini or mock fallback.
    """
    client = get_genai_client()
    if not client:
        res = mock_classifier.generate_mock_intent(goal_text, duration_min)
        return IntentResponse(**res)

    user_prompt = prompts.INTENT_USER_PROMPT_TEMPLATE.format(
        goal_text=goal_text,
        duration_min=duration_min or 45
    )

    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=prompts.INTENT_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=IntentResponse,
                    temperature=0.3
                )
            )
            raw_text = response.text
            data = json.loads(raw_text)
            return IntentResponse(**data)
        except Exception as e:
            logger.warning(f"Intent generation attempt {attempt + 1} failed: {e}")

    # Fallback to mock on failure
    res = mock_classifier.generate_mock_intent(goal_text, duration_min)
    return IntentResponse(**res)


def classify_activity(
    goal: str,
    activity: str,
    on_track_examples: Optional[List[str]] = None,
    adjacent_examples: Optional[List[str]] = None,
    drift_examples: Optional[List[str]] = None,
    recent_activities: Optional[List[str]] = None
) -> ClassifyResponse:
    """
    Classify activity alignment using Gemini or mock fallback.
    """
    client = get_genai_client()
    if not client:
        res = mock_classifier.mock_classify(
            goal=goal,
            activity=activity,
            on_track_examples=on_track_examples,
            adjacent_examples=adjacent_examples,
            drift_examples=drift_examples,
            recent_activities=recent_activities
        )
        return ClassifyResponse(**res)

    on_track_str = "\n".join(f"- {x}" for x in (on_track_examples or [])) or "None specified"
    adj_str = "\n".join(f"- {x}" for x in (adjacent_examples or [])) or "None specified"
    drift_str = "\n".join(f"- {x}" for x in (drift_examples or [])) or "None specified"
    recent_str = "\n".join(f"- {x}" for x in (recent_activities or [])) or "None"

    user_prompt = prompts.CLASSIFY_USER_PROMPT_TEMPLATE.format(
        goal=goal,
        on_track_examples=on_track_str,
        adjacent_examples=adj_str,
        drift_examples=drift_str,
        recent_activities=recent_str,
        activity=activity
    )

    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=prompts.CLASSIFY_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=ClassifyResponse,
                    temperature=0.2
                )
            )
            raw_text = response.text
            data = json.loads(raw_text)
            data["fallback"] = False
            return ClassifyResponse(**data)
        except Exception as e:
            logger.warning(f"Activity classify attempt {attempt + 1} failed: {e}")

    # Fallback to mock
    res = mock_classifier.mock_classify(
        goal=goal,
        activity=activity,
        on_track_examples=on_track_examples,
        adjacent_examples=adjacent_examples,
        drift_examples=drift_examples,
        recent_activities=recent_activities
    )
    res["fallback"] = True
    return ClassifyResponse(**res)


def generate_summary_insight(
    goal: str,
    duration_min: int,
    focus_score: int,
    time_on_track_min: float,
    time_adjacent_min: float,
    time_drifted_min: float,
    switch_count: int,
    tax_low: int,
    tax_high: int
) -> str:
    """
    Generate an encouraging session insight using Gemini or fallback heuristic.
    """
    client = get_genai_client()
    if client:
        try:
            user_prompt = prompts.SUMMARY_USER_PROMPT_TEMPLATE.format(
                goal=goal,
                duration_min=duration_min,
                focus_score=focus_score,
                time_on_track_min=time_on_track_min,
                time_adjacent_min=time_adjacent_min,
                time_drifted_min=time_drifted_min,
                switch_count=switch_count,
                tax_low=tax_low,
                tax_high=tax_high
            )
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=prompts.SUMMARY_SYSTEM_PROMPT,
                    temperature=0.5
                )
            )
            text = response.text.strip()
            if text:
                return text
        except Exception as e:
            logger.warning(f"Summary insight generation failed: {e}")

    # Heuristic fallback insight
    if focus_score >= 80:
        return f"Exceptional deep work session! You stayed tightly aligned with '{goal}' and minimized costly context switches."
    elif focus_score >= 50:
        return f"Solid progress on '{goal}'. With {switch_count} context switches, refocusing a bit quicker will reclaim even more productive momentum."
    else:
        return f"Challenging focus block for '{goal}'. Take a real break to reset, and consider shorter intervals next time to build steady cadence."
