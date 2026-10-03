"""Safe, user-facing activity events for Mabaso AI generations.

This module intentionally describes operational stages only. It must never
contain model chain-of-thought, prompts, credentials, or provider internals.
"""

from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any


ACTIVITY_TEXT: dict[str, str] = {
    "REQUEST_RECEIVED": "Request received…",
    "UNDERSTANDING_REQUEST": "Understanding your question…",
    "READING_DOCUMENT": "Reading your document…",
    "ANALYZING_DOCUMENT": "Analyzing the material…",
    "ANALYZING_IMAGE": "Analyzing your image…",
    "PROCESSING_AUDIO": "Processing your recording…",
    "TRANSCRIBING_AUDIO": "Transcribing speech…",
    "CALCULATING": "Working through the calculation…",
    "ORGANIZING_CONTENT": "Organizing the content…",
    "GENERATING_REPORT": "Generating your report…",
    "GENERATING_STUDY_GUIDE": "Generating your study guide…",
    "GENERATING_FLASHCARDS": "Creating flashcards…",
    "GENERATING_EXAM": "Creating questions and answers…",
    "GENERATING_POWERPOINT": "Generating your presentation…",
    "GENERATING_PODCAST": "Generating your podcast…",
    "CREATING_FILE": "Creating your file…",
    "SAVING_MATERIAL": "Saving to your materials…",
    "CHECKING_RESULT": "Checking the result…",
    "PREPARING_RESPONSE": "Preparing your answer…",
    "STREAMING_RESPONSE": "Responding…",
    "COMPLETED": "Response ready",
    "FAILED": "Response couldn't be completed",
}

COMPLETED_ACTIVITY_TEXT: dict[str, str] = {
    "REQUEST_RECEIVED": "Request received",
    "UNDERSTANDING_REQUEST": "Understood your question",
    "READING_DOCUMENT": "Read your document",
    "ANALYZING_DOCUMENT": "Analyzed the material",
    "ANALYZING_IMAGE": "Analyzed your image",
    "PROCESSING_AUDIO": "Processed your recording",
    "TRANSCRIBING_AUDIO": "Transcribed the recording",
    "CALCULATING": "Worked through the calculation",
    "ORGANIZING_CONTENT": "Organized the content",
    "GENERATING_REPORT": "Generated the report",
    "GENERATING_STUDY_GUIDE": "Generated the study guide",
    "GENERATING_FLASHCARDS": "Created the flashcards",
    "GENERATING_EXAM": "Created the questions and answers",
    "GENERATING_POWERPOINT": "Generated the presentation",
    "GENERATING_PODCAST": "Generated the podcast",
    "CREATING_FILE": "Created the file",
    "SAVING_MATERIAL": "Saved to your materials",
    "CHECKING_RESULT": "Checked the result",
    "PREPARING_RESPONSE": "Prepared the answer",
    "STREAMING_RESPONSE": "Response generated",
    "COMPLETED": "Response ready",
    "FAILED": "Response couldn't be completed",
}

ACTIVITY_TYPES = frozenset(ACTIVITY_TEXT)

_MATH_PATTERN = re.compile(
    r"(?:\bcalculate\b|\bsolve\b|\bequation\b|\bintegral\b|\bderivative\b|"
    r"\bmatrix\b|\bprobability\b|\bformula\b|\bprove\b|[=+×÷]|\d\s*[*/^]\s*\d)",
    flags=re.IGNORECASE,
)


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_activity_event(
    activity_type: str,
    *,
    state: str = "active",
    metadata: dict[str, Any] | None = None,
    generation_id: str = "",
    conversation_id: str = "",
) -> dict[str, Any]:
    normalized_type = str(activity_type or "").strip().upper()
    if normalized_type not in ACTIVITY_TYPES:
        raise ValueError(f"Unsupported chat activity type: {normalized_type}")
    normalized_state = "completed" if state == "completed" else "failed" if state == "failed" else "active"
    display_map = COMPLETED_ACTIVITY_TEXT if normalized_state == "completed" else ACTIVITY_TEXT
    safe_metadata = {
        key: value
        for key, value in dict(metadata or {}).items()
        if key in {"document_count", "image_count", "page_count", "source_count", "duration_ms"}
        and isinstance(value, (int, float, str))
    }
    return {
        "activity_type": normalized_type,
        "display_text": display_map[normalized_type],
        "state": normalized_state,
        "generation_id": str(generation_id or ""),
        "conversation_id": str(conversation_id or ""),
        "started_at": utc_iso(),
        "metadata": safe_metadata,
    }


def infer_request_activity_types(
    *,
    question: str,
    reference_image_count: int = 0,
    reference_document_count: int = 0,
    has_document_context: bool = False,
) -> list[str]:
    """Return only stages supported by real request inputs.

    There is deliberately no web-search stage here: the current lecture chat
    route does not invoke a web-search tool, so claiming that it does would be
    misleading.
    """

    stages = ["UNDERSTANDING_REQUEST"]
    if reference_document_count > 0 or has_document_context:
        stages.extend(["READING_DOCUMENT", "ANALYZING_DOCUMENT"])
    if reference_image_count > 0:
        stages.append("ANALYZING_IMAGE")
    if _MATH_PATTERN.search(str(question or "")):
        stages.extend(["CALCULATING", "CHECKING_RESULT"])
    stages.append("PREPARING_RESPONSE")
    return stages

