import asyncio
import base64
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import html
import hashlib
import hmac
from http.cookiejar import MozillaCookieJar
from io import BytesIO
import json
import logging
import mimetypes
import os
import re
import shutil
import smtplib
import sqlite3
import secrets
import subprocess
import tempfile
import textwrap
import zipfile
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse
from uuid import uuid4
from xml.etree import ElementTree as ET

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from openai import APIStatusError, InternalServerError, OpenAI
from pydantic import BaseModel
import requests
try:
    import yt_dlp
except ImportError:
    yt_dlp = None

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    try:
        from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig
    except ImportError:
        GenericProxyConfig = None
        WebshareProxyConfig = None
except ImportError:
    YouTubeTranscriptApi = None
    GenericProxyConfig = None
    WebshareProxyConfig = None

try:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import Paragraph, Preformatted, SimpleDocTemplate, Spacer, Table, TableStyle
except ImportError:
    A4 = None

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

try:
    from google.auth.transport.requests import Request as GoogleRequest
    from google.oauth2 import id_token as google_id_token
except ImportError:
    GoogleRequest = None
    google_id_token = None


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
client = OpenAI()

TRANSCRIPTION_MODEL = os.getenv("TRANSCRIPTION_MODEL", "gpt-4o-transcribe")
FALLBACK_TRANSCRIPTION_MODEL = os.getenv("FALLBACK_TRANSCRIPTION_MODEL", "whisper-1")
STUDY_GUIDE_MODEL = os.getenv("STUDY_GUIDE_MODEL", "gpt-4.1-mini")
VISION_MODEL = os.getenv("VISION_MODEL", "gpt-4.1-mini")
STUDY_CHAT_MODEL = os.getenv("STUDY_CHAT_MODEL", STUDY_GUIDE_MODEL)
ASSET_GENERATION_MODEL = os.getenv("ASSET_GENERATION_MODEL", STUDY_GUIDE_MODEL)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
MAX_COMPLETION_TOKENS = int(os.getenv("MAX_COMPLETION_TOKENS", "8000"))
MAX_FILE_SIZE_BYTES = int(os.getenv("MAX_FILE_SIZE_BYTES", str(600 * 1024 * 1024)))
OPENAI_AUDIO_LIMIT_BYTES = int(os.getenv("OPENAI_AUDIO_LIMIT_BYTES", str(25 * 1024 * 1024)))
CHUNK_DURATION_SECONDS = int(os.getenv("CHUNK_DURATION_SECONDS", "300"))
CHUNK_OVERLAP_SECONDS = int(os.getenv("CHUNK_OVERLAP_SECONDS", "20"))
TRANSCRIPTION_AUDIO_BITRATE = os.getenv("TRANSCRIPTION_AUDIO_BITRATE", "48k")
TRANSCRIPTION_AUDIO_SAMPLE_RATE = os.getenv("TRANSCRIPTION_AUDIO_SAMPLE_RATE", "16000")
MAX_STUDY_GUIDE_INPUT_CHARS = int(os.getenv("MAX_STUDY_GUIDE_INPUT_CHARS", "30000"))
MAX_TRANSCRIPT_STUDY_GUIDE_INPUT_CHARS = int(os.getenv("MAX_TRANSCRIPT_STUDY_GUIDE_INPUT_CHARS", "45000"))
STUDY_GUIDE_REQUEST_TIMEOUT = float(os.getenv("STUDY_GUIDE_REQUEST_TIMEOUT", "90"))
VISION_REQUEST_TIMEOUT = float(os.getenv("VISION_REQUEST_TIMEOUT", "45"))
TRANSCRIPTION_REQUEST_TIMEOUT = float(os.getenv("TRANSCRIPTION_REQUEST_TIMEOUT", "1200"))
VIDEO_DOWNLOAD_TIMEOUT = float(os.getenv("VIDEO_DOWNLOAD_TIMEOUT", "1200"))
TRANSCRIPTION_RETRIES = int(os.getenv("TRANSCRIPTION_RETRIES", "2"))
MAX_IMAGE_UPLOAD_BYTES = int(os.getenv("MAX_IMAGE_UPLOAD_BYTES", str(15 * 1024 * 1024)))
MAX_SLIDE_UPLOAD_BYTES = int(os.getenv("MAX_SLIDE_UPLOAD_BYTES", str(30 * 1024 * 1024)))
MAX_CHAT_CONTEXT_CHARS = int(os.getenv("MAX_CHAT_CONTEXT_CHARS", "36000"))
LOGIN_CODE_TTL_MINUTES = int(os.getenv("LOGIN_CODE_TTL_MINUTES", "10"))
SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "90"))
UPLOAD_DIR = Path(tempfile.gettempdir()) / "lecture-ai-project"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = Path(__file__).with_name("mabaso_ai.db")
APP_SECRET = os.getenv("APP_SECRET", os.getenv("OPENAI_API_KEY", "mabaso-dev-secret"))
YOUTUBE_LANGUAGE_PREFERENCES = ("en", "en-US", "en-GB")
YTDLP_YOUTUBE_PLAYER_CLIENTS = ("android_vr", "web_safari", "mweb", "tv_simply")
YOUTUBE_USER_AGENT = os.getenv(
    "YOUTUBE_USER_AGENT",
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
).strip()
YOUTUBE_PROXY_HTTP_URL = os.getenv("YOUTUBE_PROXY_HTTP_URL", "").strip()
YOUTUBE_PROXY_HTTPS_URL = os.getenv("YOUTUBE_PROXY_HTTPS_URL", "").strip()
YOUTUBE_WEBSHARE_PROXY_USERNAME = os.getenv("YOUTUBE_WEBSHARE_PROXY_USERNAME", "").strip()
YOUTUBE_WEBSHARE_PROXY_PASSWORD = os.getenv("YOUTUBE_WEBSHARE_PROXY_PASSWORD", "").strip()
YOUTUBE_WEBSHARE_PROXY_LOCATIONS = tuple(
    location.strip()
    for location in os.getenv("YOUTUBE_WEBSHARE_PROXY_LOCATIONS", "").split(",")
    if location.strip()
)
YOUTUBE_COOKIES_FILE = os.getenv("YOUTUBE_COOKIES_FILE", "").strip()
YOUTUBE_COOKIES_TXT = os.getenv("YOUTUBE_COOKIES_TXT", "").strip()

jobs: dict[str, dict] = {}

STUDY_GUIDE_PROMPT = """
You are an expert academic assistant for university students.

Convert the transcript into concise, high-value study notes.
Keep the response practical and faster to generate than a long textbook rewrite.

Return clean Markdown with these sections:
- LECTURE TITLE
- SHORT SUMMARY
- KEY CONCEPTS
- IMPORTANT DEFINITIONS
- IMPORTANT FORMULAS
- WORKED EXAMPLES
- STEP-BY-STEP EXPLANATIONS
- ADVANTAGES AND DISADVANTAGES
- COMMON MISTAKES TO AVOID
- QUICK REVISION PLAN
- VISUAL AIDS
- REAL-WORLD EXAMPLES
- PRACTICE QUESTIONS AND ANSWERS
- FLASHCARDS
- EXAM TIPS

Rules:
- Use clear section headings in uppercase and make each heading bold using Markdown.
- Leave a blank line between every section.
- Keep the notes compact and easy to revise.
- Use bullet points where useful, especially for summaries, concepts, definitions, exam tips, and revision steps.
- Prefer short readable bullets over long dense paragraphs.
- If formulas appear, rewrite them in readable human style.
- Never use LaTeX syntax or math delimiters such as \\, \\, $$, \\frac, \\int, \\mathcal, or \\begin.
- Do not write exponents with caret notation like s^2, t^n, or e^(-at) in the final answer.
- Write exponents and indices in textbook style using proper symbols where possible, for example s², tⁿ, e⁻ᵃᵗ, ∫₀∞.
- Write formulas the way a lecturer would write them on a board using plain readable text.
- In IMPORTANT FORMULAS, prefer a study-sheet layout using short lines in this style:
  t -> 1 / s²
  tⁿ -> n! / s⁽ⁿ ⁺ ¹⁾
  e⁻ᵃᵗ -> 1 / (s + a)
  eᵃᵗ -> 1 / (s - a)
- If the lecture covers transform pairs, conversion rules, or standard results, list them as readable two-column style mappings.
- Example style:
  F(s) = ∫₀∞ e⁻ˢᵗ f(t) dt
  u(t - a) = 0 for t < a, and 1 for t >= a
- Put a blank line before and after each formula block so it is easy to read.
- In WORKED EXAMPLES, include at least one step-by-step solved example when the lecture contains a problem, calculation, derivation, or sum.
- In ADVANTAGES AND DISADVANTAGES, give practical study-focused pros, limits, or caution points that help a student know when the idea is useful and where it becomes confusing.
- In COMMON MISTAKES TO AVOID, list short warnings about misunderstandings, skipped steps, wrong formula use, or revision traps.
- In QUICK REVISION PLAN, give a short sequence a student can follow before a class test or exam.
- In VISUAL AIDS, include simple ASCII diagrams, neat comparison tables, flow layouts, or graph sketches when they help explain the topic.
- Only include a bar graph, line graph, axis sketch, or trend diagram when the lecture discusses data, change over time, or relationships between variables. Do not invent fake numerical data.
- Use simple text layouts that students can read easily in plain Markdown.
- In PRACTICE QUESTIONS AND ANSWERS, create 10 numbered question-and-answer pairs using this exact style:
  1. Question: ...

  Answer: ...
- Put the Answer on its own line.
- Leave a blank line between each question and its answer, and a blank line between each numbered question block.
- Make question 1 the most straightforward and let the difficulty rise steadily until question 10 is the most demanding.
- Do not label questions with difficulty names, levels, or tags.
- In FLASHCARDS, use this exact style for every card:
  Q: ...

  A: ...
- Leave a blank line between Q and A, and a blank line between flashcards so they are easy to read.
- If lecture notes or lecture slides are provided together with the transcript, use all sources together. Prefer explicit formulas, worked examples, definitions, and likely assessment points from the slides or notes when they improve clarity.
- If the lecture skips steps, fill in only the most important missing steps.
- If a topic is unclear, say "Not clearly covered in transcript".
- Do not include YouTube links or long export suggestions.
"""


class StudyGuideRequest(BaseModel):
    transcript: str
    lecture_notes: str = ""
    lecture_slides: str = ""


class VideoUrlTranscriptionRequest(BaseModel):
    video_url: str


class RequestCodeRequest(BaseModel):
    email: str


class VerifyCodeRequest(BaseModel):
    email: str
    code: str


class GoogleAuthRequest(BaseModel):
    credential: str


class ChatTurn(BaseModel):
    role: str
    content: str


class StudyChatRequest(BaseModel):
    question: str
    transcript: str = ""
    summary: str = ""
    lecture_notes: str = ""
    lecture_slides: str = ""
    history: list[ChatTurn] = []
    reference_images: list[str] = []


class PdfSection(BaseModel):
    title: str
    content: str = ""


class PdfExportRequest(BaseModel):
    title: str
    sections: list[PdfSection]


class CollaborationRoomCreateRequest(BaseModel):
    title: str
    transcript: str = ""
    summary: str = ""
    formula: str = ""
    example: str = ""
    lecture_notes: str = ""
    lecture_slides: str = ""
    shared_notes: str = ""
    flashcards: list[dict[str, str]] = []
    quiz_questions: list[dict[str, Any]] = []
    invited_emails: list[str] = []
    active_tab: str = "guide"
    test_visibility: str = "private"


class CollaborationMessageRequest(BaseModel):
    content: str


class CollaborationSharedNotesRequest(BaseModel):
    shared_notes: str = ""


class CollaborationActiveTabRequest(BaseModel):
    active_tab: str


class CollaborationTestVisibilityRequest(BaseModel):
    test_visibility: str


class CollaborationQuizAnswerRequest(BaseModel):
    question_number: str
    answer_text: str = ""


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_in_future(*, minutes: int = 0, days: int = 0) -> str:
    return (utc_now() + timedelta(minutes=minutes, days=days)).isoformat()


def get_db_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_db_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                email TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                verified_at TEXT
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS login_codes (
                email TEXT PRIMARY KEY,
                code_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS collaboration_rooms (
                id TEXT PRIMARY KEY,
                owner_email TEXT NOT NULL,
                title TEXT NOT NULL,
                transcript TEXT NOT NULL,
                summary TEXT NOT NULL,
                formula TEXT NOT NULL,
                example TEXT NOT NULL,
                lecture_notes TEXT NOT NULL,
                lecture_slides TEXT NOT NULL,
                shared_notes TEXT NOT NULL,
                flashcards_json TEXT NOT NULL,
                quiz_questions_json TEXT NOT NULL,
                active_tab TEXT NOT NULL,
                test_visibility TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS collaboration_room_members (
                room_id TEXT NOT NULL,
                email TEXT NOT NULL,
                role TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (room_id, email)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS collaboration_room_messages (
                id TEXT PRIMARY KEY,
                room_id TEXT NOT NULL,
                author_email TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS collaboration_room_answers (
                room_id TEXT NOT NULL,
                question_number TEXT NOT NULL,
                author_email TEXT NOT NULL,
                answer_text TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (room_id, question_number, author_email)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


def hash_value(value: str) -> str:
    payload = f"{APP_SECRET}:{value}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def validate_email_address(email: str) -> str:
    normalized = normalize_email(email)
    if not normalized:
        raise HTTPException(status_code=400, detail="Email address is required.")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    return normalized


def verify_google_auth_is_configured():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Google login is not configured on the server yet. Missing GOOGLE_CLIENT_ID.",
        )
    if google_id_token is None or GoogleRequest is None:
        raise HTTPException(
            status_code=500,
            detail="Google login support is not installed on the server yet. Install backend requirements, including google-auth and requests, then redeploy.",
        )


def verify_smtp_is_configured():
    required = ["SMTP_HOST", "SMTP_FROM_EMAIL"]
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise HTTPException(
            status_code=500,
            detail=(
                "Email login is not configured on the server yet. "
                f"Missing environment variables: {', '.join(missing)}."
            ),
        )


def send_verification_email(email: str, code: str):
    verify_smtp_is_configured()

    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", "")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"

    message = EmailMessage()
    message["Subject"] = "Your MABASO.AI verification code"
    message["From"] = smtp_from
    message["To"] = email
    message.set_content(
        (
            "Your MABASO.AI verification code is:\n\n"
            f"{code}\n\n"
            f"This code expires in {LOGIN_CODE_TTL_MINUTES} minutes."
        )
    )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
        if smtp_use_tls:
            server.starttls()
        if smtp_username:
            server.login(smtp_username, smtp_password)
        server.send_message(message)


def create_login_code(email: str) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    now_iso = utc_now().isoformat()
    expiry_iso = iso_in_future(minutes=LOGIN_CODE_TTL_MINUTES)

    with get_db_connection() as connection:
        connection.execute(
            "INSERT OR IGNORE INTO users (email, created_at) VALUES (?, ?)",
            (email, now_iso),
        )
        connection.execute(
            """
            INSERT INTO login_codes (email, code_hash, expires_at, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                code_hash = excluded.code_hash,
                expires_at = excluded.expires_at,
                created_at = excluded.created_at
            """,
            (email, hash_value(code), expiry_iso, now_iso),
        )

    return code


def create_session(email: str) -> str:
    raw_token = secrets.token_urlsafe(32)
    with get_db_connection() as connection:
        connection.execute(
            "DELETE FROM sessions WHERE email = ?",
            (email,),
        )
        connection.execute(
            """
            INSERT INTO sessions (token_hash, email, expires_at, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (hash_value(raw_token), email, iso_in_future(days=SESSION_TTL_DAYS), utc_now().isoformat()),
        )
        connection.execute(
            "UPDATE users SET verified_at = COALESCE(verified_at, ?) WHERE email = ?",
            (utc_now().isoformat(), email),
        )
    return raw_token


def revoke_session(token: str):
    with get_db_connection() as connection:
        connection.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_value(token),))


def get_session_email(token: str) -> str | None:
    if not token:
        return None

    with get_db_connection() as connection:
        row = connection.execute(
            "SELECT email, expires_at FROM sessions WHERE token_hash = ?",
            (hash_value(token),),
        ).fetchone()

    if not row:
        return None

    if datetime.fromisoformat(row["expires_at"]) <= utc_now():
        with get_db_connection() as connection:
            connection.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_value(token),))
        return None

    return row["email"]


def get_authorization_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication is required.")
    return authorization.split(" ", 1)[1].strip()


def require_authenticated_user(authorization: str | None = Header(None)) -> str:
    token = get_authorization_token(authorization)
    email = get_session_email(token)
    if not email:
        raise HTTPException(status_code=401, detail="Your session is invalid or has expired.")
    return email


def verify_login_code(email: str, code: str) -> str:
    with get_db_connection() as connection:
        row = connection.execute(
            "SELECT code_hash, expires_at FROM login_codes WHERE email = ?",
            (email,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=400, detail="No verification code was requested for this email yet.")

    if datetime.fromisoformat(row["expires_at"]) <= utc_now():
        raise HTTPException(status_code=400, detail="That verification code has expired. Request a new code.")

    if not hmac.compare_digest(row["code_hash"], hash_value(code)):
        raise HTTPException(status_code=400, detail="The verification code is incorrect.")

    with get_db_connection() as connection:
        connection.execute("DELETE FROM login_codes WHERE email = ?", (email,))

    return create_session(email)


def create_session_from_google_credential(credential: str) -> tuple[str, str]:
    verify_google_auth_is_configured()

    try:
        token_info = google_id_token.verify_oauth2_token(
            credential,
            GoogleRequest(),
            GOOGLE_CLIENT_ID,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified.") from exc

    email = validate_email_address(token_info.get("email", ""))
    if not token_info.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email is not verified.")

    now_iso = utc_now().isoformat()
    with get_db_connection() as connection:
        connection.execute(
            "INSERT OR IGNORE INTO users (email, created_at) VALUES (?, ?)",
            (email, now_iso),
        )
        connection.execute(
            "UPDATE users SET verified_at = COALESCE(verified_at, ?) WHERE email = ?",
            (now_iso, email),
        )

    return create_session(email), email


def build_pdf_document(title: str, sections: list[PdfSection]) -> bytes:
    if A4 is None:
        raise HTTPException(
            status_code=500,
            detail="PDF export is not configured on the server yet. Install reportlab and redeploy.",
        )

    styles = getSampleStyleSheet()
    title_style = styles["Heading1"]
    title_style.textColor = colors.HexColor("#0f172a")
    title_style.spaceAfter = 12
    heading_style = styles["Heading2"]
    heading_style.textColor = colors.HexColor("#0f172a")
    heading_style.spaceBefore = 12
    heading_style.spaceAfter = 8
    body_style = ParagraphStyle(
        "MabasoBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#1f2937"),
        alignment=TA_LEFT,
        spaceAfter=8,
    )
    mono_style = ParagraphStyle(
        "MabasoMono",
        parent=body_style,
        fontName="Courier",
        fontSize=9,
        leading=13,
    )

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    def split_pdf_blocks(value: str) -> list[str]:
        cleaned = (value or "").replace("\r\n", "\n").strip()
        if not cleaned:
            return []
        wrapped_lines: list[str] = []
        for raw_line in cleaned.splitlines():
            line = raw_line.rstrip()
            if not line.strip():
                wrapped_lines.append("")
                continue
            numbered_match = re.match(r"^(\d+\.\s+)(.*)$", line)
            bullet_match = re.match(r"^([-*]\s+)(.*)$", line)
            if numbered_match:
                prefix, remainder = numbered_match.groups()
                wrapped = textwrap.fill(
                    remainder,
                    width=88,
                    initial_indent=prefix,
                    subsequent_indent=" " * len(prefix),
                )
            elif bullet_match:
                prefix, remainder = bullet_match.groups()
                wrapped = textwrap.fill(
                    remainder,
                    width=88,
                    initial_indent=prefix,
                    subsequent_indent=" " * len(prefix),
                )
            else:
                wrapped = textwrap.fill(line, width=92)
            wrapped_lines.extend(wrapped.splitlines())
        cleaned = "\n".join(wrapped_lines).strip()
        blocks: list[str] = []
        for raw_block in re.split(r"\n{2,}", cleaned):
            lines = raw_block.splitlines() or [raw_block]
            chunk: list[str] = []
            chunk_chars = 0
            for line in lines:
                addition = len(line) + 1
                if chunk and (len(chunk) >= 18 or chunk_chars + addition > 1800):
                    blocks.append("\n".join(chunk).strip())
                    chunk = []
                    chunk_chars = 0
                chunk.append(line)
                chunk_chars += addition
            if chunk:
                blocks.append("\n".join(chunk).strip())
        return [block for block in blocks if block]

    story: list = [Paragraph(title or "MABASO Study Pack", title_style), Spacer(1, 8)]
    for section in sections:
        if not section.content.strip():
            continue
        story.append(Paragraph(section.title, heading_style))
        for block in split_pdf_blocks(section.content):
            story.append(Preformatted(block, mono_style))
            story.append(Spacer(1, 8))
        story.append(Spacer(1, 6))

    document.build(story)
    return buffer.getvalue()


init_db()


def create_job(job_type: str, owner_email: str = "") -> str:
    job_id = uuid4().hex
    jobs[job_id] = {
        "job_id": job_id,
        "job_type": job_type,
        "owner_email": owner_email,
        "status": "queued",
        "stage": "Waiting",
        "progress": 0,
        "error": None,
        "transcript": "",
        "summary": "",
        "formula": "",
        "worked_example": "",
        "flashcards": [],
        "quiz_questions": [],
        "used_fallback": False,
    }
    return job_id


def update_job(job_id: str, **fields):
    job = jobs.get(job_id)
    if not job:
        return
    job.update(fields)


def build_chat_messages(payload: StudyChatRequest) -> list[dict[str, object]]:
    section_limit = max(2000, MAX_CHAT_CONTEXT_CHARS // 4)

    def trimmed_block(label: str, value: str, limit: int = section_limit) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            return ""
        if len(cleaned) > limit:
            shortened = cleaned[:limit].rsplit(" ", 1)[0].strip() or cleaned[:limit].strip()
            cleaned = f"{shortened}\n\n[Trimmed for chat context]"
        return f"{label}\n{cleaned}"

    context_parts = [
        trimmed_block("STUDY GUIDE", payload.summary, section_limit),
        trimmed_block("LECTURE NOTES", payload.lecture_notes, section_limit),
        trimmed_block("LECTURE SLIDES", payload.lecture_slides, section_limit),
        trimmed_block("LECTURE TRANSCRIPT", payload.transcript, max(4000, MAX_CHAT_CONTEXT_CHARS // 2)),
    ]
    context_text = "\n\n".join(part for part in context_parts if part).strip()
    if len(context_text) > MAX_CHAT_CONTEXT_CHARS:
        context_text = context_text[:MAX_CHAT_CONTEXT_CHARS].rsplit(" ", 1)[0].strip()

    messages: list[dict[str, object]] = [
        {
            "role": "system",
            "content": (
                "You are MABASO.AI, a lecture study assistant. "
                "Answer only from the provided lecture context. "
                "If the material does not support an answer, say that it was not clearly covered. "
                "Be helpful, concise, and use bullets when they make the answer easier to study."
            ),
        }
    ]

    if context_text:
        messages.append({"role": "system", "content": f"Lecture context:\n\n{context_text}"})

    for turn in payload.history[-6:]:
        role = "assistant" if turn.role == "assistant" else "user"
        content = (turn.content or "").strip()
        if content:
            messages.append({"role": role, "content": content[:1200]})

    question_text = payload.question.strip()
    reference_images = [image for image in payload.reference_images[:4] if (image or "").strip()]
    if reference_images:
        user_content: list[dict[str, object]] = [
            {
                "type": "text",
                "text": f"{question_text}\n\nUse the attached reference image(s) only if they help answer the question from the lecture context.",
            }
        ]
        for image in reference_images:
            user_content.append({"type": "image_url", "image_url": {"url": image}})
        messages.append({"role": "user", "content": user_content})
    else:
        messages.append({"role": "user", "content": question_text})
    return messages


def sanitize_download_filename(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", (value or "mabaso-study-pack").strip()).strip("-._")
    return cleaned[:80] or "mabaso-study-pack"


def dump_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False)


def load_json_list(value: str) -> list:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def parse_json_object(value: str) -> dict[str, Any]:
    cleaned = (value or "").strip()
    if not cleaned:
        return {}
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start < 0 or end <= start:
            return {}
        try:
            parsed = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            return {}
    return parsed if isinstance(parsed, dict) else {}


def parse_json_list(value: str) -> list[Any]:
    cleaned = (value or "").strip()
    if not cleaned:
        return []
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start < 0 or end <= start:
            return []
        try:
            parsed = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            return []
    return parsed if isinstance(parsed, list) else []


def compact_text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).replace("\r\n", "\n").strip()
    return text or fallback


def trimmed_context_block(label: str, value: str, limit: int) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        return ""
    if len(cleaned) > limit:
        cleaned = f"{cleaned[:limit].rstrip()}\n\nNOTE: This source was shortened for the structured asset step."
    return f"{label}\n{cleaned}"


def normalize_test_visibility(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized not in {"shared", "private"}:
        raise HTTPException(status_code=400, detail="Test visibility must be either 'shared' or 'private'.")
    return normalized


def sanitize_collaboration_tab(value: str) -> str:
    normalized = (value or "guide").strip().lower()
    allowed_tabs = {"guide", "transcript", "formulas", "examples", "flashcards", "quiz", "chat"}
    return normalized if normalized in allowed_tabs else "guide"


def normalize_invited_emails(emails: list[str], owner_email: str) -> list[str]:
    cleaned: list[str] = []
    seen = {owner_email}
    for email in emails or []:
        raw_value = (email or "").strip()
        if not raw_value:
            continue
        normalized = validate_email_address(raw_value)
        if normalized in seen:
            continue
        seen.add(normalized)
        cleaned.append(normalized)
    return cleaned


def touch_collaboration_room(room_id: str):
    with get_db_connection() as connection:
        connection.execute(
            "UPDATE collaboration_rooms SET updated_at = ? WHERE id = ?",
            (utc_now().isoformat(), room_id),
        )


def get_collaboration_room_members(room_id: str) -> list[dict[str, str]]:
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT email, role, created_at
            FROM collaboration_room_members
            WHERE room_id = ?
            ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, email ASC
            """,
            (room_id,),
        ).fetchall()

    return [
        {"email": row["email"], "role": row["role"], "created_at": row["created_at"]}
        for row in rows
    ]


def get_collaboration_room_messages(room_id: str, limit: int = 80) -> list[dict[str, str]]:
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, author_email, content, created_at
            FROM collaboration_room_messages
            WHERE room_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (room_id, limit),
        ).fetchall()

    ordered_rows = list(reversed(rows))
    return [
        {
            "id": row["id"],
            "author_email": row["author_email"],
            "content": row["content"],
            "created_at": row["created_at"],
        }
        for row in ordered_rows
    ]


def get_collaboration_room_answers(room_id: str, current_user: str, test_visibility: str) -> list[dict[str, str]]:
    query = """
        SELECT question_number, author_email, answer_text, updated_at
        FROM collaboration_room_answers
        WHERE room_id = ?
    """
    params: list[str] = [room_id]
    if test_visibility != "shared":
        query += " AND author_email = ?"
        params.append(current_user)
    query += " ORDER BY question_number ASC, author_email ASC"

    with get_db_connection() as connection:
        rows = connection.execute(query, params).fetchall()

    return [
        {
            "question_number": row["question_number"],
            "author_email": row["author_email"],
            "answer_text": row["answer_text"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def get_accessible_collaboration_room(room_id: str, current_user: str) -> sqlite3.Row:
    with get_db_connection() as connection:
        row = connection.execute(
            """
            SELECT DISTINCT r.*
            FROM collaboration_rooms r
            LEFT JOIN collaboration_room_members m
                ON m.room_id = r.id
            WHERE r.id = ?
              AND (r.owner_email = ? OR m.email = ?)
            """,
            (room_id, current_user, current_user),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Collaboration room not found.")
    return row


def serialize_collaboration_room(room_row: sqlite3.Row, current_user: str) -> dict:
    room_id = room_row["id"]
    test_visibility = normalize_test_visibility(room_row["test_visibility"])
    members = get_collaboration_room_members(room_id)

    return {
        "id": room_id,
        "title": room_row["title"],
        "owner_email": room_row["owner_email"],
        "transcript": room_row["transcript"],
        "summary": room_row["summary"],
        "formula": room_row["formula"],
        "example": room_row["example"],
        "lecture_notes": room_row["lecture_notes"],
        "lecture_slides": room_row["lecture_slides"],
        "shared_notes": room_row["shared_notes"],
        "flashcards": load_json_list(room_row["flashcards_json"]),
        "quiz_questions": load_json_list(room_row["quiz_questions_json"]),
        "active_tab": sanitize_collaboration_tab(room_row["active_tab"]),
        "test_visibility": test_visibility,
        "created_at": room_row["created_at"],
        "updated_at": room_row["updated_at"],
        "members": members,
        "messages": get_collaboration_room_messages(room_id),
        "quiz_answers": get_collaboration_room_answers(room_id, current_user, test_visibility),
        "is_owner": room_row["owner_email"] == current_user,
    }


def serialize_collaboration_room_card(room_row: sqlite3.Row) -> dict:
    members = get_collaboration_room_members(room_row["id"])
    return {
        "id": room_row["id"],
        "title": room_row["title"],
        "owner_email": room_row["owner_email"],
        "created_at": room_row["created_at"],
        "updated_at": room_row["updated_at"],
        "active_tab": sanitize_collaboration_tab(room_row["active_tab"]),
        "test_visibility": normalize_test_visibility(room_row["test_visibility"]),
        "member_count": len(members),
        "members": members,
    }


def ensure_openai_key():
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is not configured on the backend.",
        )


def is_text_upload(filename: str, content_type: str | None) -> bool:
    suffix = Path(filename or "").suffix.lower()
    return bool(
        (content_type and content_type.startswith("text/"))
        or suffix in {".txt", ".md", ".text"}
    )


def is_pdf_upload(filename: str, content_type: str | None) -> bool:
    suffix = Path(filename or "").suffix.lower()
    return suffix == ".pdf" or content_type == "application/pdf"


def is_pptx_upload(filename: str, content_type: str | None) -> bool:
    suffix = Path(filename or "").suffix.lower()
    return suffix == ".pptx" or content_type == "application/vnd.openxmlformats-officedocument.presentationml.presentation"


def build_data_url(file_bytes: bytes, content_type: str | None, filename: str = "") -> str:
    mime_type = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    encoded = base64.b64encode(file_bytes).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def extract_slide_text_from_pdf(file_bytes: bytes) -> str:
    if PdfReader is None:
        raise HTTPException(
            status_code=500,
            detail="PDF slide support needs the pypdf package on the backend. Install backend requirements and try again.",
        )

    reader = PdfReader(BytesIO(file_bytes))
    pages: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        page_text = (page.extract_text() or "").strip()
        if page_text:
            pages.append(f"SLIDE PAGE {index}\n{page_text}")
    return "\n\n".join(pages).strip()


def extract_slide_text_from_pptx(file_bytes: bytes) -> str:
    namespaces = {
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    }

    with zipfile.ZipFile(BytesIO(file_bytes)) as archive:
        slide_names = sorted(
            [name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)],
            key=lambda value: int(re.search(r"slide(\d+)\.xml", value).group(1)),
        )

        slide_text_parts: list[str] = []
        for slide_index, slide_name in enumerate(slide_names, start=1):
            xml_bytes = archive.read(slide_name)
            root = ET.fromstring(xml_bytes)
            text_runs = [node.text.strip() for node in root.findall(".//a:t", namespaces) if node.text and node.text.strip()]
            if text_runs:
                slide_text_parts.append(f"SLIDE {slide_index}\n" + "\n".join(text_runs))

    return "\n\n".join(slide_text_parts).strip()


def extract_slide_text_from_image(image_data_url: str, file_name: str = "") -> str:
    response = client.with_options(timeout=VISION_REQUEST_TIMEOUT).chat.completions.create(
        model=VISION_MODEL,
        max_completion_tokens=1200,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are extracting useful study content from a lecture slide image. "
                    "Return only the slide content in clean readable Markdown. Preserve headings, bullets, "
                    "key definitions, and formulas. Rewrite formulas in plain human-readable board style, "
                    "never in LaTeX."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"Extract the important lecture slide content from this image. "
                            f"File name: {file_name or 'slide image'}. "
                            "Keep the result concise but complete enough to help build better study guides and quiz questions."
                        ),
                    },
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                ],
            },
        ],
    )
    return (response.choices[0].message.content or "").strip()


def clamp_score(value: Any, max_score: int) -> int:
    try:
        numeric = int(round(float(str(value).strip())))
    except (TypeError, ValueError):
        return 0
    return max(0, min(max_score, numeric))


def parse_quiz_marking_response(content: str, max_score: int) -> dict[str, Any]:
    parsed_object = parse_json_object(content)
    mistakes = parsed_object.get("mistakes")
    if not isinstance(mistakes, list):
        mistakes = []
    return {
        "score": clamp_score(parsed_object.get("score"), max_score),
        "max_score": max_score,
        "extracted_answer": compact_text(parsed_object.get("extracted_answer")),
        "feedback": compact_text(parsed_object.get("feedback"), "The answer was reviewed."),
        "mistakes": [compact_text(item) for item in mistakes if compact_text(item)],
    }


def mark_quiz_answer_with_ai(
    question: str,
    expected_answer: str,
    student_answer: str = "",
    answer_image_data_url: str = "",
    answer_points: list[str] | None = None,
    max_score: int = 1,
) -> dict[str, Any]:
    point_lines = "\n".join(f"- {point}" for point in (answer_points or []) if compact_text(point))
    user_parts: list[dict] = [
        {
            "type": "text",
            "text": (
                "Grade this student answer against the expected answer.\n\n"
                f"Question: {question}\n"
                f"Maximum marks: {max_score}\n"
                f"Expected answer: {expected_answer}\n"
                f"Key marking points:\n{point_lines or '- Use the expected answer directly.'}\n"
                f"Typed student answer: {student_answer or 'No typed answer provided.'}\n\n"
                "Be fair if the meaning is correct even when wording differs. "
                "Award partial credit when some key points are correct. "
                "Return JSON only with these keys:\n"
                f'{{"score": 0 to {max_score}, "extracted_answer": "...", "feedback": "...", "mistakes": ["..."]}}'
            ),
        }
    ]

    if answer_image_data_url:
        user_parts.append({"type": "image_url", "image_url": {"url": answer_image_data_url}})

    response = client.with_options(timeout=VISION_REQUEST_TIMEOUT).chat.completions.create(
        model=VISION_MODEL,
        max_completion_tokens=500,
        messages=[
            {
                "role": "system",
                "content": (
                    "You mark student quiz answers carefully. "
                    "You may read typed answers, neat handwriting, messy handwriting, or both. "
                    "Return strict JSON only. "
                    "Never award more than the maximum marks provided."
                ),
            },
            {"role": "user", "content": user_parts},
        ],
    )
    content = (response.choices[0].message.content or "").strip()
    return parse_quiz_marking_response(content, max_score)


def grade_option_based_question(
    question_type: str,
    subparts: list[dict[str, Any]],
    student_selection: dict[str, Any],
) -> dict[str, Any]:
    normalized_selection = {
        compact_text(key).lower(): compact_text(value)
        for key, value in (student_selection or {}).items()
        if compact_text(key)
    }
    subpart_results: list[dict[str, Any]] = []
    incorrect_items: list[str] = []
    extracted_lines: list[str] = []
    total_score = 0
    max_score = 0

    for subpart in subparts or []:
        label = compact_text(subpart.get("label")).lower()
        marks = clamp_score(subpart.get("marks"), 100) or 1
        max_score += marks
        expected_answer = compact_text(subpart.get("answer"))
        selected_answer = normalized_selection.get(label, "")
        extracted_lines.append(f"{label}) {selected_answer or 'No answer'}")
        is_correct = bool(selected_answer) and selected_answer.lower() == expected_answer.lower()
        marks_awarded = marks if is_correct else 0
        total_score += marks_awarded
        if not is_correct:
            incorrect_items.append(label)
        explanation = compact_text(subpart.get("explanation"))
        subpart_results.append(
            {
                "label": label,
                "marks": marks,
                "marks_awarded": marks_awarded,
                "student_answer": selected_answer,
                "expected_answer": expected_answer,
                "is_correct": is_correct,
                "feedback": (
                    "Correct."
                    if is_correct
                    else compact_text(
                        f"{expected_answer} was correct. {explanation}".strip(),
                        f"{expected_answer} was correct.",
                    )
                ),
            }
        )

    if max_score <= 0:
        max_score = sum(int(subpart.get("marks") or 1) for subpart in subparts or []) or 1

    if incorrect_items:
        feedback = (
            f"You scored {total_score}/{max_score}. Review {', '.join(incorrect_items)} "
            f"and check the correct answers shown below."
        )
    else:
        feedback = f"Excellent. You scored {total_score}/{max_score} on this {question_type.replace('_', ' ')} question."

    return {
        "score": total_score,
        "max_score": max_score,
        "extracted_answer": "\n".join(extracted_lines),
        "feedback": feedback,
        "mistakes": [f"{label}) needs correction." for label in incorrect_items],
        "incorrect_items": incorrect_items,
        "subpart_results": subpart_results,
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/auth/request-code")
async def request_login_code(payload: RequestCodeRequest):
    email = validate_email_address(payload.email)
    code = create_login_code(email)
    await asyncio.to_thread(send_verification_email, email, code)
    return {"message": "Verification code sent.", "email": email}


@app.post("/auth/verify-code")
async def verify_login(payload: VerifyCodeRequest):
    email = validate_email_address(payload.email)
    code = payload.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="Verification code is required.")
    session_token = verify_login_code(email, code)
    return {"token": session_token, "email": email}


@app.post("/auth/google")
async def google_login(payload: GoogleAuthRequest):
    credential = payload.credential.strip()
    if not credential:
        raise HTTPException(status_code=400, detail="Google credential is required.")
    session_token, email = await asyncio.to_thread(create_session_from_google_credential, credential)
    return {"token": session_token, "email": email}


@app.get("/auth/me")
async def auth_me(current_user: str = Depends(require_authenticated_user)):
    return {"email": current_user}


@app.post("/auth/logout")
async def logout(authorization: str | None = Header(None)):
    token = get_authorization_token(authorization)
    revoke_session(token)
    return {"message": "Logged out."}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str, current_user: str = Depends(require_authenticated_user)):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.get("owner_email") and job["owner_email"] != current_user:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


async def save_upload_to_disk(file: UploadFile, job_id: str | None = None) -> Path:
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"

    def _write_file() -> Path:
        total_written = 0
        update_points = {
            1 * 1024 * 1024: 2,
            5 * 1024 * 1024: 4,
            10 * 1024 * 1024: 6,
            20 * 1024 * 1024: 8,
        }
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix,
            prefix="lecture_",
            dir=UPLOAD_DIR,
        ) as temp_file:
            file.file.seek(0)
            while chunk := file.file.read(1024 * 1024):
                temp_file.write(chunk)
                total_written += len(chunk)
                if job_id:
                    for threshold, progress in update_points.items():
                        if total_written >= threshold:
                            update_job(
                                job_id,
                                status="processing",
                                stage="Uploading lecture file",
                                progress=progress,
                            )
            return Path(temp_file.name)

    return await asyncio.to_thread(_write_file)


def get_file_size(file_path: Path) -> int:
    return file_path.stat().st_size


def normalize_video_url(value: str) -> str:
    cleaned = (value or "").strip()
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Paste a full video link that starts with http:// or https://.")
    return cleaned


def resolve_youtube_cookiefile() -> Path | None:
    if YOUTUBE_COOKIES_FILE:
        cookie_path = Path(YOUTUBE_COOKIES_FILE)
        if cookie_path.exists() and cookie_path.is_file():
            return cookie_path
        logger.warning("Configured YOUTUBE_COOKIES_FILE does not exist: %s", cookie_path)

    if not YOUTUBE_COOKIES_TXT:
        return None

    cookie_text = YOUTUBE_COOKIES_TXT.replace("\\n", "\n").strip()
    if not cookie_text:
        return None

    cookie_path = UPLOAD_DIR / "youtube_cookies.txt"
    try:
        cookie_path.write_text(f"{cookie_text}\n", encoding="utf-8")
    except OSError as exc:
        logger.warning("Could not write YouTube cookies file: %s", exc)
        return None
    return cookie_path


def load_youtube_request_cookies() -> dict[str, str]:
    cookies = {
        "CONSENT": "YES+cb.20210328-17-p0.en+FX+700",
        "PREF": "hl=en&gl=US",
    }
    cookie_path = resolve_youtube_cookiefile()
    if not cookie_path:
        return cookies

    try:
        cookie_jar = MozillaCookieJar()
        cookie_jar.load(str(cookie_path), ignore_discard=True, ignore_expires=True)
    except Exception as exc:
        logger.warning("Could not load YouTube cookies from %s: %s", cookie_path, exc)
        return cookies

    for cookie in cookie_jar:
        if "youtube.com" in (cookie.domain or "").lower() or "google.com" in (cookie.domain or "").lower():
            cookies[cookie.name] = cookie.value
    return cookies


def build_youtube_request_headers() -> dict[str, str]:
    return {
        "User-Agent": YOUTUBE_USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
    }


def build_ytdlp_options(*, output_template: str | None = None, progress_hook: Any = None, skip_download: bool = False) -> dict[str, Any]:
    options: dict[str, Any] = {
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "restrictfilenames": True,
        "geo_bypass": True,
        "http_headers": build_youtube_request_headers(),
        "extractor_args": {
            "youtube": {
                "player_client": list(YTDLP_YOUTUBE_PLAYER_CLIENTS),
                "skip": ["translated_subs"],
            }
        },
    }
    if output_template:
        options["outtmpl"] = output_template
    if progress_hook:
        options["progress_hooks"] = [progress_hook]
    if skip_download:
        options["skip_download"] = True
    cookie_path = resolve_youtube_cookiefile()
    if cookie_path:
        options["cookiefile"] = str(cookie_path)
    return options


def extract_youtube_video_id(video_url: str) -> str | None:
    parsed = urlparse(video_url)
    host = (parsed.netloc or "").lower().split(":")[0]
    if host.startswith("www."):
        host = host[4:]

    path_parts = [part for part in parsed.path.split("/") if part]
    if host == "youtu.be":
        return path_parts[0] if path_parts else None

    if host not in {"youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"}:
        return None

    if parsed.path == "/watch":
        video_id = parse_qs(parsed.query).get("v", [""])[0].strip()
        return video_id or None

    if path_parts and path_parts[0] in {"embed", "shorts", "live", "v"} and len(path_parts) > 1:
        return path_parts[1]

    return None


def captions_to_transcript_text(items: Any) -> str:
    lines: list[str] = []
    for item in items or []:
        text = item.get("text", "") if isinstance(item, dict) else getattr(item, "text", "")
        cleaned = re.sub(r"\s+", " ", str(text or "").replace("\xa0", " ")).strip()
        if cleaned:
            lines.append(cleaned)
    return "\n".join(lines).strip()


def build_youtube_transcript_api() -> Any | None:
    if YouTubeTranscriptApi is None:
        return None

    if (
        WebshareProxyConfig is not None
        and YOUTUBE_WEBSHARE_PROXY_USERNAME
        and YOUTUBE_WEBSHARE_PROXY_PASSWORD
    ):
        proxy_kwargs: dict[str, Any] = {
            "proxy_username": YOUTUBE_WEBSHARE_PROXY_USERNAME,
            "proxy_password": YOUTUBE_WEBSHARE_PROXY_PASSWORD,
        }
        if YOUTUBE_WEBSHARE_PROXY_LOCATIONS:
            proxy_kwargs["filter_ip_locations"] = list(YOUTUBE_WEBSHARE_PROXY_LOCATIONS)
        logger.info("Using Webshare proxy configuration for YouTube transcript requests")
        return YouTubeTranscriptApi(proxy_config=WebshareProxyConfig(**proxy_kwargs))

    if GenericProxyConfig is not None and (YOUTUBE_PROXY_HTTP_URL or YOUTUBE_PROXY_HTTPS_URL):
        proxy_kwargs = {}
        if YOUTUBE_PROXY_HTTP_URL:
            proxy_kwargs["http_url"] = YOUTUBE_PROXY_HTTP_URL
        if YOUTUBE_PROXY_HTTPS_URL:
            proxy_kwargs["https_url"] = YOUTUBE_PROXY_HTTPS_URL
        logger.info("Using generic proxy configuration for YouTube transcript requests")
        return YouTubeTranscriptApi(proxy_config=GenericProxyConfig(**proxy_kwargs))

    return YouTubeTranscriptApi()


def fetch_youtube_transcript(video_url: str, job_id: str) -> str | None:
    if YouTubeTranscriptApi is None:
        return None

    video_id = extract_youtube_video_id(video_url)
    if not video_id:
        return None

    update_job(job_id, status="processing", stage="Checking YouTube captions", progress=3)

    transcript_api = build_youtube_transcript_api()
    if transcript_api is None:
        return None

    preferred_languages = list(dict.fromkeys(["en", *YOUTUBE_LANGUAGE_PREFERENCES]))
    try:
        transcript_text = captions_to_transcript_text(
            transcript_api.fetch(video_id, languages=preferred_languages)
        )
        if transcript_text:
            update_job(job_id, status="processing", stage="YouTube captions found. Preparing transcript", progress=14)
            return transcript_text
    except Exception as exc:
        logger.info("Could not fetch YouTube transcript directly for %s: %s", video_url, exc)

    try:
        transcript_list = transcript_api.list(video_id)
    except Exception as exc:
        logger.info("Could not read YouTube transcript list for %s: %s", video_url, exc)
        return None

    candidates = []
    for finder_name in ("find_transcript", "find_manually_created_transcript", "find_generated_transcript"):
        finder = getattr(transcript_list, finder_name, None)
        if not callable(finder):
            continue
        try:
            candidates.append(finder(preferred_languages))
        except Exception:
            continue

    try:
        candidates.extend(list(transcript_list))
    except Exception as exc:
        logger.info("Could not iterate YouTube transcripts for %s: %s", video_url, exc)

    seen_candidates: set[tuple[str, bool]] = set()
    for transcript_candidate in candidates:
        candidate_key = (
            str(getattr(transcript_candidate, "language_code", "")),
            bool(getattr(transcript_candidate, "is_generated", False)),
        )
        if candidate_key in seen_candidates:
            continue
        seen_candidates.add(candidate_key)
        try:
            transcript_text = captions_to_transcript_text(transcript_candidate.fetch())
        except Exception as exc:
            logger.info("Could not fetch YouTube transcript candidate for %s: %s", video_url, exc)
            continue
        if transcript_text:
            update_job(job_id, status="processing", stage="YouTube captions found. Preparing transcript", progress=14)
            return transcript_text

    return None


def can_process_video_url(video_url: str) -> bool:
    return yt_dlp is not None or (YouTubeTranscriptApi is not None and extract_youtube_video_id(video_url) is not None)


def subtitle_body_to_text(raw_text: str) -> str:
    lines: list[str] = []
    for raw_line in (raw_text or "").splitlines():
        line = raw_line.strip()
        if (
            not line
            or line.upper() == "WEBVTT"
            or line.startswith("NOTE")
            or line.startswith("Kind:")
            or line.startswith("Language:")
            or "-->" in line
            or line.isdigit()
        ):
            continue
        line = html.unescape(re.sub(r"<[^>]+>", " ", line))
        line = re.sub(r"\s+", " ", line).strip()
        if line and (not lines or line != lines[-1]):
            lines.append(line)
    return "\n".join(lines).strip()


def read_subtitle_file(file_path: Path) -> str:
    try:
        raw_text = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raw_text = file_path.read_text(encoding="utf-8-sig", errors="ignore")
    return subtitle_body_to_text(raw_text)


def subtitle_file_priority(file_path: Path) -> tuple[int, int, str]:
    name = file_path.name.lower()
    language_score = 3
    if ".en." in name or ".en-" in name or name.endswith(".en.vtt") or name.endswith(".en.srt"):
        language_score = 0
    elif ".en-us." in name or ".en-gb." in name or ".en-orig." in name or ".orig." in name:
        language_score = 1
    elif ".a." in name:
        language_score = 2

    extension_score = 0 if file_path.suffix.lower() == ".vtt" else 1
    return (language_score, extension_score, name)


def cleanup_caption_files(prefix: str):
    for path in UPLOAD_DIR.glob(f"{prefix}*"):
        if path.is_file():
            try:
                path.unlink()
            except OSError:
                logger.warning("Could not delete subtitle artifact: %s", path)


def extract_json_object_from_text(source: str, marker: str) -> dict[str, Any] | None:
    marker_index = source.find(marker)
    if marker_index == -1:
        return None

    start_index = source.find("{", marker_index)
    if start_index == -1:
        return None

    depth = 0
    in_string = False
    escaped = False

    for index in range(start_index, len(source)):
        char = source[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(source[start_index:index + 1])
                except json.JSONDecodeError:
                    return None

    return None


def choose_youtube_caption_track(caption_tracks: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not caption_tracks:
        return None

    def track_priority(track: dict[str, Any]) -> tuple[int, int, str]:
        language_code = str(track.get("languageCode", "")).lower()
        kind = str(track.get("kind", "")).lower()
        language_score = 3
        if language_code in {language.lower() for language in YOUTUBE_LANGUAGE_PREFERENCES}:
            language_score = 0
        elif language_code.startswith("en"):
            language_score = 1
        elif language_code.endswith("-orig") or language_code == "orig":
            language_score = 2

        kind_score = 0 if kind != "asr" else 1
        return (language_score, kind_score, language_code)

    return sorted(caption_tracks, key=track_priority)[0]


def fetch_youtube_watch_page_captions(video_url: str, job_id: str) -> str | None:
    video_id = extract_youtube_video_id(video_url)
    if not video_id:
        return None

    headers = build_youtube_request_headers()
    cookies = load_youtube_request_cookies()
    watch_url = f"https://www.youtube.com/watch?v={video_id}&hl=en&bpctr=9999999999&has_verified=1"
    update_job(job_id, status="processing", stage="Checking YouTube watch-page captions", progress=7)

    try:
        response = requests.get(watch_url, headers=headers, cookies=cookies, timeout=20)
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.info("Could not fetch YouTube watch page for %s: %s", video_url, exc)
        return None

    player_response = None
    for marker in (
        "var ytInitialPlayerResponse = ",
        "ytInitialPlayerResponse = ",
        'window["ytInitialPlayerResponse"] = ',
        "window['ytInitialPlayerResponse'] = ",
    ):
        player_response = extract_json_object_from_text(response.text, marker)
        if player_response:
            break

    caption_tracks = (
        player_response.get("captions", {})
        .get("playerCaptionsTracklistRenderer", {})
        .get("captionTracks", [])
        if isinstance(player_response, dict)
        else []
    )
    caption_track = choose_youtube_caption_track(caption_tracks)
    base_url = caption_track.get("baseUrl", "") if isinstance(caption_track, dict) else ""
    if not base_url:
        return None

    caption_url = base_url if "fmt=" in base_url else f"{base_url}&fmt=vtt"
    try:
        caption_response = requests.get(caption_url, headers=headers, cookies=cookies, timeout=20)
        caption_response.raise_for_status()
    except requests.RequestException as exc:
        logger.info("Could not fetch YouTube caption track for %s: %s", video_url, exc)
        return None

    transcript_text = subtitle_body_to_text(caption_response.text)
    if transcript_text:
        update_job(job_id, status="processing", stage="YouTube watch-page captions found. Preparing transcript", progress=15)
        return transcript_text
    return None


def download_subtitles_from_video_url(video_url: str, job_id: str) -> str | None:
    if yt_dlp is None:
        return None

    normalized_url = normalize_video_url(video_url)
    subtitle_prefix = f"captions_{uuid4().hex}"
    output_template = str(UPLOAD_DIR / f"{subtitle_prefix}.%(ext)s")
    options = build_ytdlp_options(output_template=output_template, skip_download=True)
    options.update({
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": ["all"],
        "subtitlesformat": "vtt/best",
    })

    update_job(job_id, status="processing", stage="Checking downloadable captions", progress=9)
    try:
        with yt_dlp.YoutubeDL(options) as downloader:
            downloader.extract_info(normalized_url, download=True)
    except Exception as exc:
        logger.info("Could not download subtitles with yt-dlp for %s: %s", video_url, exc)
        cleanup_caption_files(subtitle_prefix)
        return None

    subtitle_files = sorted(
        [
            path
            for path in UPLOAD_DIR.glob(f"{subtitle_prefix}*")
            if path.is_file() and path.suffix.lower() in {".vtt", ".srt"}
        ],
        key=subtitle_file_priority,
    )

    transcript_text = ""
    for subtitle_file in subtitle_files:
        transcript_text = read_subtitle_file(subtitle_file)
        if transcript_text:
            break

    cleanup_caption_files(subtitle_prefix)
    if transcript_text:
        update_job(job_id, status="processing", stage="Downloadable captions found. Preparing transcript", progress=16)
        return transcript_text
    return None


def download_audio_from_video_url(video_url: str, job_id: str) -> Path:
    if yt_dlp is None:
        raise RuntimeError("Video-link transcription needs yt-dlp on the backend server.")

    normalized_url = normalize_video_url(video_url)
    download_prefix = f"video_{uuid4().hex}"
    output_template = str(UPLOAD_DIR / f"{download_prefix}.%(ext)s")

    def progress_hook(data: dict[str, Any]):
        status = data.get("status")
        if status == "downloading":
            total_bytes = data.get("total_bytes") or data.get("total_bytes_estimate") or 0
            downloaded = data.get("downloaded_bytes") or 0
            if total_bytes:
                progress = min(18, 4 + int((downloaded / total_bytes) * 14))
            else:
                progress = 8
            update_job(job_id, status="processing", stage="Downloading audio from the video link", progress=progress)
        elif status == "finished":
            update_job(job_id, status="processing", stage="Video downloaded. Preparing audio", progress=18)

    options = build_ytdlp_options(output_template=output_template, progress_hook=progress_hook)
    options["format"] = "bestaudio/best"

    update_job(job_id, status="processing", stage="Connecting to the video link", progress=3)
    with yt_dlp.YoutubeDL(options) as downloader:
        info = downloader.extract_info(normalized_url, download=True)
        requested_downloads = info.get("requested_downloads") or []
        candidate_paths = [
            Path(item["filepath"])
            for item in requested_downloads
            if isinstance(item, dict) and item.get("filepath")
        ]
        prepared_path = Path(downloader.prepare_filename(info))
        if prepared_path not in candidate_paths:
            candidate_paths.append(prepared_path)

    candidates = [
        path
        for path in candidate_paths
        if path.exists() and path.is_file() and path.suffix.lower() != ".part"
    ]
    if not candidates:
        candidates = sorted(
            [path for path in UPLOAD_DIR.glob(f"{download_prefix}*") if path.is_file() and path.suffix.lower() != ".part"],
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )

    if not candidates:
        raise RuntimeError("The video link was reachable, but no downloadable audio file was produced.")

    file_path = candidates[0]
    file_size = get_file_size(file_path)
    if file_size > MAX_FILE_SIZE_BYTES:
        try:
            file_path.unlink()
        except OSError:
            logger.warning("Could not delete oversized video download: %s", file_path)
        raise RuntimeError(
            f"The downloaded video audio is too large ({file_size / (1024 * 1024):.1f} MB). "
            f"Please use a shorter video or a link with a smaller audio track."
        )
    return file_path


def require_ffmpeg() -> str:
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        raise RuntimeError(
            "Large files need ffmpeg for audio compression and splitting, but ffmpeg is not installed or not available in PATH."
        )
    return ffmpeg_path


def require_ffprobe() -> str:
    ffprobe_path = shutil.which("ffprobe")
    if not ffprobe_path:
        raise RuntimeError(
            "ffprobe is required for large-file chunking, but it is not installed or not available in PATH."
        )
    return ffprobe_path


def format_job_error(exc: Exception) -> str:
    if isinstance(exc, APIStatusError):
        return (
            f"OpenAI request failed with status {exc.status_code}. "
            "This can happen because of temporary upstream issues or an unsupported file."
        )
    if isinstance(exc, TimeoutError):
        return "Processing timed out. Try again, compress the file, or use a shorter lecture segment."
    message = str(exc).strip()
    lowered = message.lower()
    if "sign in to confirm you're not a bot" in lowered or "cookies-from-browser" in lowered:
        return (
            "This YouTube video blocked direct server-side download from the hosted backend. "
            "Public captions are still checked first, but this video may need YOUTUBE_COOKIES_TXT or a YouTube proxy on Render."
        )
    return message or "An unexpected processing error occurred."


def get_media_duration_seconds(file_path: Path) -> float:
    ffprobe_path = require_ffprobe()
    file_size_mb = get_file_size(file_path) / (1024 * 1024)
    result = subprocess.run(
        [
            ffprobe_path,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(file_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe could not read media duration: {result.stderr.strip()}")
    try:
        if file_size_mb > 5:
            # Surface a visible stage while ffprobe inspects larger files.
            logger.info("Inspecting media duration for %.1f MB file", file_size_mb)
        return float(result.stdout.strip())
    except ValueError as exc:
        raise RuntimeError("ffprobe returned an invalid media duration.") from exc


def build_audio_chunks(file_path: Path, job_id: str) -> list[Path]:
    if get_file_size(file_path) <= OPENAI_AUDIO_LIMIT_BYTES:
        update_job(job_id, status="processing", stage="Audio ready for transcription", progress=15)
        return [file_path]

    ffmpeg_path = require_ffmpeg()
    chunk_dir = UPLOAD_DIR / f"{file_path.stem}_chunks"
    chunk_dir.mkdir(parents=True, exist_ok=True)
    update_job(job_id, status="processing", stage="Preparing lecture audio", progress=12)
    copied_audio = chunk_dir / "audio_track.m4a"
    copy_command = [
        ffmpeg_path,
        "-y",
        "-i",
        str(file_path),
        "-vn",
        "-c:a",
        "copy",
        str(copied_audio),
    ]

    copy_result = subprocess.run(
        copy_command,
        capture_output=True,
        text=True,
        check=False,
    )

    extracted_audio = copied_audio if copy_result.returncode == 0 and copied_audio.exists() else None

    if extracted_audio and get_file_size(extracted_audio) <= OPENAI_AUDIO_LIMIT_BYTES:
        update_job(job_id, status="processing", stage="Audio prepared successfully", progress=20)
        return [extracted_audio]

    source_for_encoding = extracted_audio or file_path
    profile_candidates: list[tuple[str, str, int]] = []
    for bitrate, sample_rate, duration in [
        (TRANSCRIPTION_AUDIO_BITRATE, TRANSCRIPTION_AUDIO_SAMPLE_RATE, CHUNK_DURATION_SECONDS),
        ("40k", "16000", max(180, CHUNK_DURATION_SECONDS - 60)),
        ("32k", "16000", max(120, CHUNK_DURATION_SECONDS - 120)),
        ("24k", "12000", max(90, CHUNK_DURATION_SECONDS - 180)),
    ]:
        candidate = (bitrate, sample_rate, duration)
        if candidate not in profile_candidates:
            profile_candidates.append(candidate)

    last_error = ""

    for index, (bitrate, sample_rate, chunk_duration) in enumerate(profile_candidates, start=1):
        profile_dir = chunk_dir / f"profile_{index}"
        profile_dir.mkdir(parents=True, exist_ok=True)
        compressed_audio = profile_dir / f"compressed_{index}.mp3"
        update_job(
            job_id,
            status="processing",
            stage=f"Compressing lecture audio (pass {index})",
            progress=min(20, 13 + index * 2),
        )
        compress_command = [
            ffmpeg_path,
            "-y",
            "-i",
            str(source_for_encoding),
            "-vn",
            "-ac",
            "1",
            "-ar",
            sample_rate,
            "-b:a",
            bitrate,
            str(compressed_audio),
        ]

        compress_result = subprocess.run(
            compress_command,
            capture_output=True,
            text=True,
            check=False,
        )
        if compress_result.returncode != 0:
            last_error = compress_result.stderr.strip()
            continue

        if compressed_audio.exists() and get_file_size(compressed_audio) <= OPENAI_AUDIO_LIMIT_BYTES:
            update_job(job_id, status="processing", stage="Audio prepared successfully", progress=20)
            return [compressed_audio]

        update_job(
            job_id,
            status="processing",
            stage=f"Splitting lecture into parts (pass {index})",
            progress=min(22, 16 + index * 2),
        )
        segment_pattern = profile_dir / "chunk_%03d.mp3"
        split_command = [
            ffmpeg_path,
            "-y",
            "-i",
            str(compressed_audio),
            "-f",
            "segment",
            "-segment_time",
            str(chunk_duration),
            "-reset_timestamps",
            "1",
            "-c",
            "copy",
            str(segment_pattern),
        ]

        split_result = subprocess.run(
            split_command,
            capture_output=True,
            text=True,
            check=False,
        )
        if split_result.returncode != 0:
            last_error = split_result.stderr.strip()
            continue

        chunk_files = sorted(profile_dir.glob("chunk_*.mp3"))
        if not chunk_files:
            last_error = "Audio splitting completed, but no chunks were produced."
            continue

        oversized_chunks = [chunk for chunk in chunk_files if get_file_size(chunk) > OPENAI_AUDIO_LIMIT_BYTES]
        if oversized_chunks:
            last_error = (
                "Generated chunks are still above the OpenAI upload limit after adaptive compression. "
                "Try a shorter lecture segment or a stronger server."
            )
            continue

        update_job(job_id, status="processing", stage=f"Prepared {len(chunk_files)} lecture parts", progress=22)
        return chunk_files

    raise RuntimeError(last_error or "Audio preparation failed for this file.")


async def transcribe_audio(file_path: Path, job_id: str) -> str:
    def _transcribe() -> str:
        transcript_parts: list[str] = []
        models_to_try = [TRANSCRIPTION_MODEL]
        if FALLBACK_TRANSCRIPTION_MODEL and FALLBACK_TRANSCRIPTION_MODEL != TRANSCRIPTION_MODEL:
            models_to_try.append(FALLBACK_TRANSCRIPTION_MODEL)

        update_job(job_id, status="processing", stage="Checking lecture audio", progress=8)
        chunk_files = build_audio_chunks(file_path, job_id)
        total_chunks = max(len(chunk_files), 1)

        try:
            for index, chunk_path in enumerate(chunk_files, start=1):
                start_progress = 25 + int(((index - 1) / total_chunks) * 65)
                end_progress = 25 + int((index / total_chunks) * 65)
                update_job(
                    job_id,
                    status="processing",
                    stage=f"Transcribing lecture part {index} of {total_chunks}",
                    progress=start_progress,
                )
                last_error: Exception | None = None

                for model_name in models_to_try:
                    for attempt in range(1, TRANSCRIPTION_RETRIES + 1):
                        try:
                            update_job(
                                job_id,
                                status="processing",
                                stage=f"Transcribing lecture part {index} of {total_chunks}",
                                progress=start_progress,
                            )
                            with chunk_path.open("rb") as audio_file:
                                response = client.with_options(
                                    timeout=TRANSCRIPTION_REQUEST_TIMEOUT
                                ).audio.transcriptions.create(
                                    model=model_name,
                                    file=audio_file,
                                )
                            transcript_parts.append(response.text.strip())
                            update_job(
                                job_id,
                                status="processing",
                                stage=f"Finished chunk {index} of {total_chunks}",
                                progress=end_progress,
                            )
                            last_error = None
                            break
                        except InternalServerError as exc:
                            last_error = exc
                            if attempt < TRANSCRIPTION_RETRIES:
                                continue
                        except APIStatusError as exc:
                            last_error = exc
                            break
                    if last_error is None:
                        break
                else:
                    if last_error:
                        raise last_error

            return "\n\n".join(part for part in transcript_parts if part)
        finally:
            chunk_dir = UPLOAD_DIR / f"{file_path.stem}_chunks"
            if chunk_dir.exists():
                try:
                    for temp_path in chunk_dir.iterdir():
                        if temp_path.exists():
                            temp_path.unlink()
                    chunk_dir.rmdir()
                except OSError:
                    logger.warning("Could not delete chunk directory: %s", chunk_dir)

    return await asyncio.wait_for(asyncio.to_thread(_transcribe), timeout=TRANSCRIPTION_REQUEST_TIMEOUT)


def build_fallback_study_guide(transcript: str) -> str:
    cleaned = " ".join(transcript.split())
    sentence_candidates = re.split(r"(?<=[.!?])\s+", cleaned)
    sentences = [s.strip() for s in sentence_candidates if s.strip()]
    keywords = re.findall(r"\b[A-Za-z][A-Za-z0-9-]{4,}\b", transcript)

    frequency: dict[str, int] = {}
    stopwords = {
        "about",
        "after",
        "because",
        "before",
        "could",
        "their",
        "there",
        "these",
        "those",
        "which",
        "where",
        "while",
        "would",
    }
    for word in keywords:
        token = word.lower()
        if token in stopwords:
            continue
        frequency[token] = frequency.get(token, 0) + 1

    key_terms = [term.replace("-", " ") for term, _ in sorted(frequency.items(), key=lambda item: (-item[1], item[0]))[:6]]
    summary_sentences = sentences[:3] or ["The lecture transcript was available, but the AI summary step failed."]
    concept_bullets = key_terms[:5] or ["Main concepts were not clearly detected from the transcript."]
    question_topics = concept_bullets or ["the main lecture idea"]
    question_prompts = [
        "Define",
        "Describe",
        "Summarize",
        "Explain how to use",
        "Compare and contrast",
        "Apply",
        "Analyse",
        "Evaluate",
        "Connect",
        "Design an approach for",
    ]
    title_seed = key_terms[:3]
    title = " / ".join(term.title() for term in title_seed) if title_seed else "Lecture Notes"

    return "\n".join(
        [
            "**LECTURE TITLE**",
            title,
            "",
            "**SHORT SUMMARY**",
            *[f"- {sentence}" for sentence in summary_sentences],
            "",
            "**KEY CONCEPTS**",
            *[f"- {concept}" for concept in concept_bullets],
            "",
            "**IMPORTANT DEFINITIONS**",
            *[f"- {concept}: Review this concept in the transcript and expand it with your class notes." for concept in concept_bullets[:4]],
            "",
            "**IMPORTANT FORMULAS**",
            "- Not clearly detected in the fallback summary. Check the transcript for equations or numeric steps.",
            "",
            "**WORKED EXAMPLES**",
            "- Example problem: Choose one important concept from the lecture and explain how you would solve or apply it step by step.",
            "- Step 1: Identify the concept, formula, or method being used.",
            "- Step 2: Write down the known values, assumptions, or definitions.",
            "- Step 3: Apply the method in a clear sequence and explain each step.",
            "- Step 4: State the final result and what it means.",
            "",
            "**STEP-BY-STEP EXPLANATIONS**",
            "- Read the transcript from top to bottom and group the lecture into introduction, core method, and examples.",
            "- Highlight repeated ideas and convert them into short revision bullets.",
            "- Rewrite any lecturer demonstrations into your own words for exam preparation.",
            "",
            "**ADVANTAGES AND DISADVANTAGES**",
            "Advantages:",
            "- Compact notes make the core idea faster to revise before a quiz or exam.",
            "- Key concepts, flashcards, and questions help students move from reading to active recall.",
            "",
            "Disadvantages / cautions:",
            "- A short summary can hide missing detail if you never return to the transcript or class notes.",
            "- Students may remember words without understanding how to apply them if they skip worked examples.",
            "",
            "**COMMON MISTAKES TO AVOID**",
            "- Do not revise only the headings without checking the lecturer's examples.",
            "- Do not leave formulas or definitions in a half-understood state before test day.",
            "- Do not assume recognition means mastery; answer a question from memory to check yourself.",
            "",
            "**QUICK REVISION PLAN**",
            "- First 5 minutes: scan the summary and list the main ideas from memory.",
            "- Next 10 minutes: review definitions, formulas, and one worked example.",
            "- Next 10 minutes: answer two or three practice questions without notes.",
            "- Final 5 minutes: turn weak points into flashcards for the next study block.",
            "",
            "**VISUAL AIDS**",
            "| Study Tool | Simple Layout |",
            "| --- | --- |",
            "| Flow | Topic -> Method -> Result |",
            "| Relationship | Input -> Process -> Output |",
            "",
            "ASCII sketch:",
            "Start -> Key concept -> Example -> Exam point",
            "",
            "**REAL-WORLD EXAMPLES**",
            "- Link each key concept to one practical situation from your course or field.",
            "",
            "**PRACTICE QUESTIONS AND ANSWERS**",
            *[
                (
                    f"{index}. Question: {question_prompts[index - 1]} {question_topics[(index - 1) % len(question_topics)]}.\n\n"
                    f"Answer: Build from the lecture context, explain the method clearly, and show why it matters."
                )
                for index in range(1, 11)
            ],
            "",
            "**FLASHCARDS**",
            *[
                (
                    f"Q: What is {item}?\n\n"
                    f"A: It is one of the main ideas highlighted in the lecture and should be revised from the transcript."
                )
                for item in concept_bullets[:3]
            ],
            "",
            "**EXAM TIPS**",
            "- Start with the summary, then revise the transcript for missing detail.",
            "- Turn repeated terms into flashcards and test yourself after each revision block.",
        ]
    )


def make_formulas_human_readable(text: str) -> str:
    superscript_map = str.maketrans({
        "0": "⁰",
        "1": "¹",
        "2": "²",
        "3": "³",
        "4": "⁴",
        "5": "⁵",
        "6": "⁶",
        "7": "⁷",
        "8": "⁸",
        "9": "⁹",
        "+": "⁺",
        "-": "⁻",
        "=": "⁼",
        "(": "⁽",
        ")": "⁾",
        "a": "ᵃ",
        "b": "ᵇ",
        "c": "ᶜ",
        "d": "ᵈ",
        "e": "ᵉ",
        "f": "ᶠ",
        "g": "ᵍ",
        "h": "ʰ",
        "i": "ⁱ",
        "j": "ʲ",
        "k": "ᵏ",
        "l": "ˡ",
        "m": "ᵐ",
        "n": "ⁿ",
        "o": "ᵒ",
        "p": "ᵖ",
        "r": "ʳ",
        "s": "ˢ",
        "t": "ᵗ",
        "u": "ᵘ",
        "v": "ᵛ",
        "w": "ʷ",
        "x": "ˣ",
        "y": "ʸ",
        "z": "ᶻ",
        "A": "ᴬ",
        "B": "ᴮ",
        "D": "ᴰ",
        "E": "ᴱ",
        "G": "ᴳ",
        "H": "ᴴ",
        "I": "ᴵ",
        "J": "ᴶ",
        "K": "ᴷ",
        "L": "ᴸ",
        "M": "ᴹ",
        "N": "ᴺ",
        "O": "ᴼ",
        "P": "ᴾ",
        "R": "ᴿ",
        "T": "ᵀ",
        "U": "ᵁ",
        "V": "ⱽ",
        "W": "ᵂ",
        " ": " ",
    })
    subscript_map = str.maketrans({
        "0": "₀",
        "1": "₁",
        "2": "₂",
        "3": "₃",
        "4": "₄",
        "5": "₅",
        "6": "₆",
        "7": "₇",
        "8": "₈",
        "9": "₉",
        "+": "₊",
        "-": "₋",
        "=": "₌",
        "(": "₍",
        ")": "₎",
        "a": "ₐ",
        "e": "ₑ",
        "h": "ₕ",
        "i": "ᵢ",
        "j": "ⱼ",
        "k": "ₖ",
        "l": "ₗ",
        "m": "ₘ",
        "n": "ₙ",
        "o": "ₒ",
        "p": "ₚ",
        "r": "ᵣ",
        "s": "ₛ",
        "t": "ₜ",
        "u": "ᵤ",
        "v": "ᵥ",
        "x": "ₓ",
        " ": " ",
    })

    def to_superscript(value: str) -> str:
        return value.translate(superscript_map)

    def to_subscript(value: str) -> str:
        return value.translate(subscript_map)

    replacements = {
        r"\mathcal{L}": "L",
        r"\Gamma": "Gamma",
        r"\infty": "infinity",
        r"\geq": ">=",
        r"\leq": "<=",
        r"\quad": " ",
        r"\cdot": "*",
        r"\,": " ",
        r"\left": "",
        r"\right": "",
        r"\{": "{",
        r"\}": "}",
        r"\[": "",
        r"\]": "",
        "$$": "",
        "$": "",
    }

    cleaned = text
    for old, new in replacements.items():
        cleaned = cleaned.replace(old, new)

    cleaned = re.sub(r"\\text\{([^}]*)\}", r"\1", cleaned)
    cleaned = re.sub(r"\\frac\{([^}]*)\}\{([^}]*)\}", r"(\1)/(\2)", cleaned)
    cleaned = re.sub(r"\\int_0\^infinity", "integral from 0 to infinity", cleaned)
    cleaned = re.sub(r"\\int_a\^infinity", "integral from a to infinity", cleaned)
    cleaned = re.sub(r"\\int", "integral", cleaned)
    cleaned = re.sub(r"\bpi\b", "π", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\btheta\b", "θ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bomega\b", "ω", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\blambda\b", "λ", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace(">=", "≥").replace("<=", "≤").replace("!=", "≠")
    cleaned = cleaned.replace("integral from 0 to infinity", f"∫{to_subscript('0')}∞")
    cleaned = cleaned.replace("integral from a to infinity", f"∫{to_subscript('a')}∞")
    cleaned = re.sub(
        r"\^(\(([^)]+)\)|\{([^}]+)\}|([A-Za-z0-9+\- ]+))",
        lambda match: to_superscript(match.group(2) or match.group(3) or match.group(4) or ""),
        cleaned,
    )
    cleaned = re.sub(
        r"_(\(([^)]+)\)|\{([^}]+)\}|([A-Za-z0-9+\- ]+))",
        lambda match: to_subscript(match.group(2) or match.group(3) or match.group(4) or ""),
        cleaned,
    )
    cleaned = re.sub(r"\n([A-Z][A-Z \-]+)\n", lambda m: f"\n**{m.group(1).strip()}**\n\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def extract_section(markdown: str, heading: str) -> str:
    pattern = re.compile(
        rf"\*\*{re.escape(heading)}\*\*\s*(.*?)(?=\n\*\*[A-Z][A-Z \-&]+\*\*|\Z)",
        re.DOTALL,
    )
    match = pattern.search(markdown)
    if not match:
        return ""
    return match.group(1).strip()


def parse_flashcards(section_text: str) -> list[dict[str, str]]:
    lines = [line.strip() for line in section_text.splitlines() if line.strip()]
    cards: list[dict[str, str]] = []
    current_question = ""

    for line in lines:
        if line.startswith("- "):
            line = line[2:].strip()
        if line.startswith("Q:"):
            current_question = line[2:].strip()
        elif line.startswith("A:") and current_question:
            cards.append({"question": current_question, "answer": line[2:].strip()})
            current_question = ""

    return cards


def parse_quiz_questions(section_text: str) -> list[dict[str, str]]:
    pattern = re.compile(
        r"(?:^|\n)\s*(\d+)\.\s*Question:\s*(.*?)(?:\n\s*)+Answer:\s*(.*?)(?=\n\s*\d+\.\s*Question:|\Z)",
        re.DOTALL,
    )
    questions: list[dict[str, str]] = []
    for match in pattern.finditer(section_text):
        questions.append(
            {
                "number": match.group(1).strip(),
                "question": match.group(2).strip(),
                "answer": match.group(3).strip(),
            }
        )
    return questions


def replace_section(markdown: str, heading: str, new_body: str) -> str:
    pattern = re.compile(
        rf"(\*\*{re.escape(heading)}\*\*)\s*(.*?)(?=\n\*\*[A-Z][A-Z \-&]+\*\*|\Z)",
        re.DOTALL,
    )

    def _replace(match: re.Match[str]) -> str:
        heading_text = match.group(1)
        body = new_body.strip()
        return f"{heading_text}\n\n{body}\n\n"

    return pattern.sub(_replace, markdown, count=1)


def append_section_if_missing(markdown: str, heading: str, body: str) -> str:
    if extract_section(markdown, heading):
        return markdown.strip()
    cleaned = markdown.strip()
    separator = "\n\n" if cleaned else ""
    return f"{cleaned}{separator}**{heading}**\n\n{body.strip()}".strip()


def extract_bullet_points(section_text: str) -> list[str]:
    items: list[str] = []
    for line in (section_text or "").splitlines():
        cleaned = line.strip()
        if not cleaned:
            continue
        if cleaned.startswith("- "):
            items.append(cleaned[2:].strip())
        elif re.match(r"^\d+\.\s+", cleaned):
            items.append(re.sub(r"^\d+\.\s+", "", cleaned).strip())
    return items


def add_student_support_sections(summary: str) -> str:
    cleaned = (summary or "").strip()
    title_lines = [line.strip() for line in extract_section(cleaned, "LECTURE TITLE").splitlines() if line.strip()]
    topic_label = title_lines[0] if title_lines else "this lecture topic"
    concept_points = extract_bullet_points(extract_section(cleaned, "KEY CONCEPTS"))[:4]
    focus_one = concept_points[0] if concept_points else "the main concept"
    focus_two = concept_points[1] if len(concept_points) > 1 else "the worked examples"

    cleaned = append_section_if_missing(
        cleaned,
        "ADVANTAGES AND DISADVANTAGES",
        "\n".join(
            [
                "Advantages:",
                f"- Revising {topic_label} in short blocks makes it faster to spot the main method, definition, or formula.",
                f"- Linking {focus_one} to practice questions helps students remember how the idea is used in a real test.",
                "",
                "Disadvantages / cautions:",
                f"- {topic_label} can feel harder than it is when students memorize steps without understanding when to use {focus_one}.",
                f"- Skipping {focus_two} or example questions can make the topic look familiar without making it exam-ready.",
            ]
        ),
    )
    cleaned = append_section_if_missing(
        cleaned,
        "COMMON MISTAKES TO AVOID",
        "\n".join(
            [
                f"- Do not jump straight to the final answer before checking the meaning of {focus_one}.",
                "- Do not revise only the summary and ignore the worked example or practice question format.",
                "- Do not mix up a definition, a rule, and an application step as if they are the same thing.",
                "- Do a quick self-test after every revision block so weak areas show up early.",
            ]
        ),
    )
    cleaned = append_section_if_missing(
        cleaned,
        "QUICK REVISION PLAN",
        "\n".join(
            [
                f"- First 5 minutes: read the short summary and highlight the words that define {topic_label}.",
                f"- Next 10 minutes: rewrite {focus_one} and {focus_two} in your own words from memory.",
                "- Next 10 minutes: answer two practice questions without looking at the notes.",
                "- Final 5 minutes: check mistakes, correct them, and make one flashcard for anything still confusing.",
            ]
        ),
    )
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def tidy_study_guide_layout(summary: str) -> str:
    cleaned = (summary or "").replace("\r\n", "\n").strip()
    quiz_section = extract_section(cleaned, "PRACTICE QUESTIONS AND ANSWERS")
    flashcard_section = extract_section(cleaned, "FLASHCARDS")

    quiz_questions = parse_quiz_questions(quiz_section)
    if quiz_questions:
        formatted_quiz = "\n\n".join(
            f"{item['number']}. Question: {item['question']}\n\nAnswer: {item['answer']}"
            for item in quiz_questions
        )
        cleaned = replace_section(cleaned, "PRACTICE QUESTIONS AND ANSWERS", formatted_quiz)

    flashcards = parse_flashcards(flashcard_section)
    if flashcards:
        formatted_flashcards = "\n\n".join(
            f"Q: {item['question']}\n\nA: {item['answer']}"
            for item in flashcards
        )
        cleaned = replace_section(cleaned, "FLASHCARDS", formatted_flashcards)

    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def extract_study_assets(summary: str) -> dict:
    formula_section = extract_section(summary, "IMPORTANT FORMULAS")
    example_section = extract_section(summary, "WORKED EXAMPLES")
    flashcard_section = extract_section(summary, "FLASHCARDS")
    quiz_section = extract_section(summary, "PRACTICE QUESTIONS AND ANSWERS")

    return {
        "formula": formula_section or "No formula section was detected in the notes.",
        "worked_example": example_section or "No worked example section was detected in the notes.",
        "flashcards": parse_flashcards(flashcard_section),
        "quiz_questions": parse_quiz_questions(quiz_section),
    }


def determine_quiz_total_marks(summary: str, transcript: str, lecture_notes: str, lecture_slides: str) -> int:
    combined_size = sum(len((value or "").strip()) for value in [summary, transcript, lecture_notes, lecture_slides])
    return 50 if combined_size >= 24000 else 40


def build_group_subparts(labels: list[str]) -> list[dict[str, Any]]:
    return [{"label": label, "marks": 1} for label in labels]


def build_quiz_blueprint(total_marks: int) -> list[dict[str, Any]]:
    if total_marks >= 50:
        return [
            {"number": "1", "type": "short_answer", "marks": 2},
            {"number": "2", "type": "multiple_choice_group", "marks": 4, "subparts": build_group_subparts(["a", "b", "c", "d"])},
            {"number": "3", "type": "true_false_group", "marks": 5, "subparts": build_group_subparts(["a", "b", "c", "d", "e"])},
            {"number": "4", "type": "short_answer", "marks": 4},
            {"number": "5", "type": "short_answer", "marks": 5},
            {"number": "6", "type": "multiple_choice_group", "marks": 4, "subparts": build_group_subparts(["a", "b", "c", "d"])},
            {"number": "7", "type": "true_false_group", "marks": 5, "subparts": build_group_subparts(["a", "b", "c", "d", "e"])},
            {"number": "8", "type": "short_answer", "marks": 6},
            {"number": "9", "type": "short_answer", "marks": 7},
            {"number": "10", "type": "short_answer", "marks": 8},
        ]
    return [
        {"number": "1", "type": "short_answer", "marks": 2},
        {"number": "2", "type": "multiple_choice_group", "marks": 4, "subparts": build_group_subparts(["a", "b", "c", "d"])},
        {"number": "3", "type": "true_false_group", "marks": 5, "subparts": build_group_subparts(["a", "b", "c", "d", "e"])},
        {"number": "4", "type": "short_answer", "marks": 3},
        {"number": "5", "type": "short_answer", "marks": 4},
        {"number": "6", "type": "multiple_choice_group", "marks": 4, "subparts": build_group_subparts(["a", "b", "c", "d"])},
        {"number": "7", "type": "true_false_group", "marks": 5, "subparts": build_group_subparts(["a", "b", "c", "d", "e"])},
        {"number": "8", "type": "short_answer", "marks": 4},
        {"number": "9", "type": "short_answer", "marks": 4},
        {"number": "10", "type": "short_answer", "marks": 5},
    ]


def normalize_answer_points(value: Any, fallback_answer: str, marks: int) -> list[str]:
    items: list[str] = []
    if isinstance(value, list):
        for entry in value:
            cleaned = compact_text(entry)
            if cleaned:
                items.append(cleaned)
    elif isinstance(value, str):
        lines = [re.sub(r"^[-*\d.\s]+", "", part).strip() for part in value.splitlines()]
        items.extend(line for line in lines if line)

    if not items and fallback_answer:
        items = [segment.strip() for segment in re.split(r"\n+|;\s*", fallback_answer) if segment.strip()]

    minimum_points = min(max(marks, 2), 6)
    return items[: max(minimum_points, 1)]


def normalize_flashcards(raw_cards: Any, fallback_cards: list[dict[str, str]]) -> list[dict[str, str]]:
    cards: list[dict[str, str]] = []
    if isinstance(raw_cards, list):
        for entry in raw_cards:
            if not isinstance(entry, dict):
                continue
            question = compact_text(entry.get("question"))
            answer = compact_text(entry.get("answer"))
            if question and answer:
                cards.append({"question": question, "answer": answer})
    if cards:
        return cards[:12]
    return fallback_cards[:12]


def make_short_answer_question(
    number: str,
    marks: int,
    question_text: str,
    answer_text: str,
    answer_points: list[str],
) -> dict[str, Any]:
    safe_answer = answer_text or "\n".join(answer_points) or "No answer supplied."
    return {
        "number": number,
        "type": "short_answer",
        "marks": marks,
        "question": question_text,
        "answer": safe_answer,
        "answer_points": answer_points or [safe_answer],
    }


def normalize_options(raw_options: Any) -> list[str]:
    if not isinstance(raw_options, list):
        return []
    options = [compact_text(option) for option in raw_options if compact_text(option)]
    seen: set[str] = set()
    unique_options: list[str] = []
    for option in options:
        if option in seen:
            continue
        seen.add(option)
        unique_options.append(option)
    return unique_options


def build_structured_quiz_fallback(simple_questions: list[dict[str, str]], blueprint: list[dict[str, Any]]) -> list[dict[str, Any]]:
    fallback_questions: list[dict[str, Any]] = []
    for index, blueprint_item in enumerate(blueprint):
        source = simple_questions[index] if index < len(simple_questions) else {}
        question_text = compact_text(source.get("question"), f"Explain the key idea in part {blueprint_item['number']}.")
        answer_text = compact_text(source.get("answer"), "No answer supplied.")
        answer_points = normalize_answer_points([], answer_text, int(blueprint_item["marks"]))
        fallback_questions.append(
            make_short_answer_question(
                str(blueprint_item["number"]),
                int(blueprint_item["marks"]),
                question_text,
                answer_text,
                answer_points,
            )
        )
    return fallback_questions


def normalize_generated_quiz_questions(
    raw_questions: Any,
    blueprint: list[dict[str, Any]],
    fallback_questions: list[dict[str, str]],
) -> list[dict[str, Any]]:
    source_questions = raw_questions if isinstance(raw_questions, list) else []
    normalized_questions: list[dict[str, Any]] = []

    for index, blueprint_item in enumerate(blueprint):
        raw_question = source_questions[index] if index < len(source_questions) and isinstance(source_questions[index], dict) else {}
        fallback_source = fallback_questions[index] if index < len(fallback_questions) else {}
        number = str(blueprint_item["number"])
        marks = int(blueprint_item["marks"])
        question_text = compact_text(raw_question.get("question"), compact_text(fallback_source.get("question"), f"Question {number}"))
        answer_text = compact_text(raw_question.get("answer"), compact_text(fallback_source.get("answer"), "No answer supplied."))
        question_type = compact_text(raw_question.get("type"), str(blueprint_item["type"])).lower()

        if question_type == "short_answer":
            normalized_questions.append(
                make_short_answer_question(
                    number,
                    marks,
                    question_text,
                    answer_text,
                    normalize_answer_points(raw_question.get("answer_points"), answer_text, marks),
                )
            )
            continue

        if question_type not in {"multiple_choice_group", "true_false_group"}:
            normalized_questions.append(
                make_short_answer_question(
                    number,
                    marks,
                    question_text,
                    answer_text,
                    normalize_answer_points(raw_question.get("answer_points"), answer_text, marks),
                )
            )
            continue

        raw_subparts = raw_question.get("subparts") if isinstance(raw_question.get("subparts"), list) else []
        subpart_lookup = {
            compact_text(item.get("label")).lower(): item
            for item in raw_subparts
            if isinstance(item, dict) and compact_text(item.get("label"))
        }
        subparts: list[dict[str, Any]] = []
        valid_group = True

        for sub_blueprint in blueprint_item.get("subparts", []):
            label = str(sub_blueprint["label"]).lower()
            raw_subpart = subpart_lookup.get(label)
            if not raw_subpart:
                valid_group = False
                break

            subpart_question = compact_text(raw_subpart.get("question"))
            if not subpart_question:
                valid_group = False
                break

            if question_type == "true_false_group":
                options = ["True", "False"]
            else:
                options = normalize_options(raw_subpart.get("options"))
                if len(options) < 4:
                    valid_group = False
                    break
                options = options[:4]

            answer = compact_text(raw_subpart.get("answer"))
            resolved_answer = next((option for option in options if option.lower() == answer.lower()), "")
            if not resolved_answer:
                valid_group = False
                break

            subparts.append(
                {
                    "label": label,
                    "marks": int(sub_blueprint["marks"]),
                    "question": subpart_question,
                    "options": options,
                    "answer": resolved_answer,
                    "explanation": compact_text(raw_subpart.get("explanation"), "Review the matching concept in the notes."),
                }
            )

        if not valid_group:
            normalized_questions.append(
                make_short_answer_question(
                    number,
                    marks,
                    question_text,
                    answer_text,
                    normalize_answer_points(raw_question.get("answer_points"), answer_text, marks),
                )
            )
            continue

        normalized_questions.append(
            {
                "number": number,
                "type": question_type,
                "marks": marks,
                "question": question_text or ("Choose the correct answer for each subpart." if question_type == "multiple_choice_group" else "State whether each statement is true or false."),
                "answer": "\n".join(f"{item['label']}) {item['answer']}" for item in subparts),
                "subparts": subparts,
            }
        )

    return normalized_questions


async def generate_structured_study_assets(
    summary: str,
    transcript: str,
    lecture_notes: str,
    lecture_slides: str,
    job_id: str,
) -> dict[str, Any]:
    fallback_assets = extract_study_assets(summary)
    total_marks = determine_quiz_total_marks(summary, transcript, lecture_notes, lecture_slides)
    blueprint = build_quiz_blueprint(total_marks)

    source_blocks = [
        trimmed_context_block("STUDY GUIDE SUMMARY", summary, MAX_STUDY_GUIDE_INPUT_CHARS),
        trimmed_context_block("LECTURER NOTES", lecture_notes, MAX_STUDY_GUIDE_INPUT_CHARS // 2),
        trimmed_context_block("LECTURE SLIDES", lecture_slides, MAX_STUDY_GUIDE_INPUT_CHARS // 2),
        trimmed_context_block("LECTURE TRANSCRIPT", transcript, MAX_TRANSCRIPT_STUDY_GUIDE_INPUT_CHARS // 2),
        f"QUIZ BLUEPRINT\n{json.dumps(blueprint, ensure_ascii=False, indent=2)}",
    ]
    combined_source = "\n\n".join(block for block in source_blocks if block)

    def _generate_assets() -> dict[str, Any]:
        response = client.with_options(timeout=STUDY_GUIDE_REQUEST_TIMEOUT).chat.completions.create(
            model=ASSET_GENERATION_MODEL,
            max_completion_tokens=min(MAX_COMPLETION_TOKENS, 5000),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You build structured study assets for a university revision app. "
                        "Return only valid JSON with the keys formula, worked_example, flashcards, and quiz_questions.\n\n"
                        "Rules:\n"
                        "- Keep the test rising in difficulty from the first question to the last question, but do not label difficulty levels.\n"
                        "- Do not mention how a student should feel.\n"
                        "- Use plain readable formulas, never LaTeX.\n"
                        "- `formula` should be a compact markdown study sheet or a short note when no formula is relevant.\n"
                        "- `worked_example` should be a clear step-by-step example in markdown.\n"
                        "- `flashcards` should contain 10 to 12 items, each with `question` and `answer`.\n"
                        "- `quiz_questions` must follow the blueprint exactly for question number, question type, and marks.\n"
                        "- Short-answer questions need `question`, `answer`, and `answer_points` for partial-credit marking.\n"
                        "- Multiple-choice group questions need `question` and `subparts`. Each subpart needs `label`, `question`, `marks`, `options`, `answer`, and `explanation`.\n"
                        "- True/false group questions need `question` and `subparts`. Each subpart needs `label`, `question`, `marks`, `options`, `answer`, and `explanation`.\n"
                        "- For true/false questions, the options must be exactly [\"True\", \"False\"].\n"
                        "- Keep each option-based subpart worth 1 mark.\n"
                        f"- The total test must add up to {total_marks} marks.\n"
                        "- Return JSON only, with no markdown code fence."
                    ),
                },
                {"role": "user", "content": combined_source},
            ],
        )
        return parse_json_object(response.choices[0].message.content or "")

    try:
        update_job(job_id, status="processing", stage="Building flashcards and test", progress=82)
        generated_assets = await asyncio.to_thread(_generate_assets)
    except Exception as exc:
        logger.warning("Structured asset generation failed, using extracted fallback assets: %s", exc)
        generated_assets = {}

    quiz_questions = normalize_generated_quiz_questions(
        generated_assets.get("quiz_questions"),
        blueprint,
        fallback_assets["quiz_questions"],
    )
    if not quiz_questions:
        quiz_questions = build_structured_quiz_fallback(fallback_assets["quiz_questions"], blueprint)

    return {
        "formula": compact_text(generated_assets.get("formula"), fallback_assets["formula"]),
        "worked_example": compact_text(generated_assets.get("worked_example"), fallback_assets["worked_example"]),
        "flashcards": normalize_flashcards(generated_assets.get("flashcards"), fallback_assets["flashcards"]),
        "quiz_questions": quiz_questions,
    }


async def generate_study_guide(
    transcript: str,
    lecture_notes: str,
    lecture_slides: str,
    job_id: str,
) -> tuple[str, bool]:
    trimmed_transcript = transcript[:MAX_TRANSCRIPT_STUDY_GUIDE_INPUT_CHARS].strip()
    trimmed_notes = lecture_notes[:MAX_STUDY_GUIDE_INPUT_CHARS].strip()
    trimmed_slides = lecture_slides[:MAX_STUDY_GUIDE_INPUT_CHARS].strip()

    if len(transcript) > MAX_TRANSCRIPT_STUDY_GUIDE_INPUT_CHARS:
        trimmed_transcript += (
            "\n\nNOTE: The transcript was shortened for faster study-guide generation. "
            "Focus on the most important themes, formulas, definitions, and examples."
        )

    if len(lecture_notes) > MAX_STUDY_GUIDE_INPUT_CHARS:
        trimmed_notes += (
            "\n\nNOTE: The lecture notes were shortened. Prioritize the clearest formulas, worked examples, and lecturer definitions."
        )

    if len(lecture_slides) > MAX_STUDY_GUIDE_INPUT_CHARS:
        trimmed_slides += (
            "\n\nNOTE: The lecture slides were shortened. Prioritize slide headings, formulas, worked examples, and assessment clues."
        )

    user_content_parts = []
    if trimmed_notes:
        user_content_parts.append(f"LECTURER NOTES\n{trimmed_notes}")
    if trimmed_slides:
        user_content_parts.append(f"LECTURE SLIDES\n{trimmed_slides}")
    user_content_parts.append(f"LECTURE TRANSCRIPT\n{trimmed_transcript}")
    combined_user_content = "\n\n".join(user_content_parts)

    def _generate() -> str:
        update_job(job_id, status="processing", stage="Preparing transcript for notes", progress=20)
        response = client.with_options(timeout=STUDY_GUIDE_REQUEST_TIMEOUT).chat.completions.create(
            model=STUDY_GUIDE_MODEL,
            max_completion_tokens=MAX_COMPLETION_TOKENS,
            messages=[
                {"role": "system", "content": STUDY_GUIDE_PROMPT},
                {"role": "user", "content": combined_user_content},
            ],
        )
        return (response.choices[0].message.content or "").strip()

    try:
        update_job(job_id, status="processing", stage="Generating study guide", progress=55)
        summary = await asyncio.to_thread(_generate)
        cleaned_summary = tidy_study_guide_layout(make_formulas_human_readable(summary))
        return add_student_support_sections(cleaned_summary), False
    except Exception as exc:
        logger.warning("Primary study guide generation failed, using fallback summary: %s", exc)
        update_job(job_id, status="processing", stage="Generating fallback study guide", progress=75)
        fallback_source = "\n\n".join(
            part for part in [lecture_notes.strip(), lecture_slides.strip(), transcript.strip()] if part
        )
        cleaned_summary = tidy_study_guide_layout(make_formulas_human_readable(build_fallback_study_guide(fallback_source)))
        return add_student_support_sections(cleaned_summary), True


async def run_transcription_job(job_id: str, file_path: Path):
    try:
        update_job(job_id, status="processing", stage="Lecture received", progress=1)
        transcript = await transcribe_audio(file_path, job_id)
        if not transcript:
            raise RuntimeError("Transcription returned no text.")

        update_job(
            job_id,
            status="completed",
            stage="Transcription completed",
            progress=100,
            transcript=transcript,
        )
    except Exception as exc:
        logger.exception("Transcription job failed")
        update_job(
            job_id,
            status="failed",
            stage="Transcription failed",
            progress=100,
            error=format_job_error(exc),
        )
    finally:
        if file_path.exists():
            try:
                file_path.unlink()
            except OSError:
                logger.warning("Could not delete temp file: %s", file_path)


async def run_video_transcription_job(job_id: str, video_url: str):
    file_path: Path | None = None
    try:
        update_job(job_id, status="processing", stage="Video link received", progress=1)
        transcript = await asyncio.to_thread(fetch_youtube_transcript, video_url, job_id)
        if transcript:
            update_job(
                job_id,
                status="completed",
                stage="Video transcription completed",
                progress=100,
                transcript=transcript,
            )
            return

        transcript = await asyncio.to_thread(fetch_youtube_watch_page_captions, video_url, job_id)
        if transcript:
            update_job(
                job_id,
                status="completed",
                stage="Video transcription completed",
                progress=100,
                transcript=transcript,
            )
            return

        transcript = await asyncio.to_thread(download_subtitles_from_video_url, video_url, job_id)
        if transcript:
            update_job(
                job_id,
                status="completed",
                stage="Video transcription completed",
                progress=100,
                transcript=transcript,
            )
            return

        if yt_dlp is None:
            raise RuntimeError(
                "This video does not expose downloadable captions, and direct video downloading is not installed on the backend yet."
            )

        file_path = await asyncio.wait_for(
            asyncio.to_thread(download_audio_from_video_url, video_url, job_id),
            timeout=VIDEO_DOWNLOAD_TIMEOUT,
        )
        transcript = await transcribe_audio(file_path, job_id)
        if not transcript:
            raise RuntimeError("The video link was processed, but no transcript text was returned.")

        update_job(
            job_id,
            status="completed",
            stage="Video transcription completed",
            progress=100,
            transcript=transcript,
        )
    except Exception as exc:
        logger.exception("Video transcription job failed")
        update_job(
            job_id,
            status="failed",
            stage="Video transcription failed",
            progress=100,
            error=format_job_error(exc),
        )
    finally:
        if file_path and file_path.exists():
            try:
                file_path.unlink()
            except OSError:
                logger.warning("Could not delete downloaded video audio: %s", file_path)


async def run_summary_job(job_id: str, transcript: str, lecture_notes: str, lecture_slides: str):
    try:
        update_job(job_id, status="processing", stage="Starting study guide generation", progress=10)
        summary, used_fallback = await generate_study_guide(transcript, lecture_notes, lecture_slides, job_id)
        assets = await generate_structured_study_assets(summary, transcript, lecture_notes, lecture_slides, job_id)
        update_job(
            job_id,
            status="completed",
            stage="Study guide ready",
            progress=100,
            summary=summary,
            formula=assets["formula"],
            worked_example=assets["worked_example"],
            flashcards=assets["flashcards"],
            quiz_questions=assets["quiz_questions"],
            used_fallback=used_fallback,
        )
    except Exception as exc:
        logger.exception("Study guide job failed")
        update_job(
            job_id,
            status="failed",
            stage="Study guide failed",
            progress=100,
            error=format_job_error(exc),
        )


@app.post("/upload-audio/")
async def upload_audio(file: UploadFile = File(...), current_user: str = Depends(require_authenticated_user)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    job_id = create_job("transcription", owner_email=current_user)
    update_job(job_id, status="processing", stage="Starting upload", progress=1)

    try:
        ensure_openai_key()
        file_path = await save_upload_to_disk(file, job_id)
        file_size = get_file_size(file_path)
        if file_size > MAX_FILE_SIZE_BYTES:
            if file_path.exists():
                file_path.unlink()
            jobs.pop(job_id, None)
            raise HTTPException(
                status_code=413,
                detail=(
                    f"File is too large ({file_size / (1024 * 1024):.1f} MB). "
                    f"Please upload a file smaller than {MAX_FILE_SIZE_BYTES / (1024 * 1024):.0f} MB."
                ),
            )

        asyncio.create_task(run_transcription_job(job_id, file_path))
        return {"job_id": job_id}
    finally:
        await file.close()


@app.post("/transcribe-video-url/")
async def transcribe_video_url(
    payload: VideoUrlTranscriptionRequest,
    current_user: str = Depends(require_authenticated_user),
):
    try:
        video_url = normalize_video_url(payload.video_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    ensure_openai_key()
    if not can_process_video_url(video_url):
        raise HTTPException(status_code=500, detail="Video-link transcription is not configured on the backend yet.")

    job_id = create_job("video_transcription", owner_email=current_user)
    update_job(job_id, status="processing", stage="Preparing video link", progress=1)
    asyncio.create_task(run_video_transcription_job(job_id, video_url))
    return {"job_id": job_id}


@app.post("/extract-slide-text/")
async def extract_slide_text(file: UploadFile = File(...), current_user: str = Depends(require_authenticated_user)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No slide file selected.")

    ensure_openai_key()
    content_type = file.content_type or mimetypes.guess_type(file.filename)[0] or ""

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="The selected slide file is empty.")

        size_limit = MAX_IMAGE_UPLOAD_BYTES if content_type.startswith("image/") else MAX_SLIDE_UPLOAD_BYTES
        if len(file_bytes) > size_limit:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"Slide file is too large ({len(file_bytes) / (1024 * 1024):.1f} MB). "
                    f"Please keep it below {size_limit / (1024 * 1024):.0f} MB."
                ),
            )

        if is_text_upload(file.filename, content_type):
            text = file_bytes.decode("utf-8", errors="ignore").strip()
            if not text:
                raise HTTPException(status_code=400, detail="The slide text file does not contain readable text.")
            return {"text": text}

        if is_pdf_upload(file.filename, content_type):
            text = await asyncio.to_thread(extract_slide_text_from_pdf, file_bytes)
            if not text:
                raise HTTPException(status_code=422, detail="MABASO could not extract readable text from that PDF.")
            return {"text": text}

        if is_pptx_upload(file.filename, content_type):
            try:
                text = await asyncio.to_thread(extract_slide_text_from_pptx, file_bytes)
            except zipfile.BadZipFile as exc:
                raise HTTPException(status_code=400, detail="That PowerPoint file could not be opened. Use a .pptx file.") from exc

            if not text:
                raise HTTPException(status_code=422, detail="MABASO could not extract readable text from that PowerPoint file.")
            return {"text": text}

        if not content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="Upload a slide image, .pdf, .pptx, or a text-based slide file such as .txt or .md.",
            )

        image_data_url = build_data_url(file_bytes, content_type, file.filename)
        text = await asyncio.to_thread(extract_slide_text_from_image, image_data_url, file.filename)
        if not text:
            raise HTTPException(status_code=422, detail="MABASO could not read text from that slide image.")
        return {"text": text}
    finally:
        await file.close()


@app.post("/generate-study-guide/")
async def create_study_guide(payload: StudyGuideRequest, current_user: str = Depends(require_authenticated_user)):
    transcript = payload.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript is required to generate a study guide.")

    ensure_openai_key()
    job_id = create_job("study_guide", owner_email=current_user)
    asyncio.create_task(
        run_summary_job(
            job_id,
            transcript,
            payload.lecture_notes.strip(),
            payload.lecture_slides.strip(),
        )
    )
    return {"job_id": job_id}


@app.post("/mark-quiz-answer/")
async def mark_quiz_answer(
    question: str = Form(...),
    expected_answer: str = Form(...),
    student_answer: str = Form(""),
    question_type: str = Form("short_answer"),
    max_score: int = Form(1),
    answer_points_json: str = Form("[]"),
    subparts_json: str = Form("[]"),
    student_selection_json: str = Form("{}"),
    answer_image: UploadFile | None = File(None),
    current_user: str = Depends(require_authenticated_user),
):
    resolved_question_type = compact_text(question_type, "short_answer").lower()
    resolved_max_score = max(1, clamp_score(max_score, 100))

    if resolved_question_type in {"multiple_choice_group", "true_false_group"}:
        subparts = [item for item in parse_json_list(subparts_json) if isinstance(item, dict)]
        student_selection = parse_json_object(student_selection_json)
        return grade_option_based_question(resolved_question_type, subparts, student_selection)

    ensure_openai_key()
    answer_points = [compact_text(item) for item in parse_json_list(answer_points_json) if compact_text(item)]

    if not student_answer.strip() and answer_image is None:
        return {
            "score": 0,
            "max_score": resolved_max_score,
            "feedback": "No answer was submitted yet.",
            "extracted_answer": "",
            "mistakes": [],
        }

    image_data_url = ""

    try:
        if answer_image is not None:
            content_type = answer_image.content_type or mimetypes.guess_type(answer_image.filename or "")[0] or ""
            if not content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="Please upload an image for answer-photo marking.")

            image_bytes = await answer_image.read()
            if not image_bytes:
                raise HTTPException(status_code=400, detail="The uploaded answer image is empty.")
            if len(image_bytes) > MAX_IMAGE_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=(
                        f"Answer image is too large ({len(image_bytes) / (1024 * 1024):.1f} MB). "
                        f"Please keep it below {MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024):.0f} MB."
                    ),
                )

            image_data_url = build_data_url(image_bytes, content_type, answer_image.filename or "answer-image")

        result = await asyncio.to_thread(
            mark_quiz_answer_with_ai,
            question.strip(),
            expected_answer.strip(),
            student_answer.strip(),
            image_data_url,
            answer_points,
            resolved_max_score,
        )
        return result
    finally:
        if answer_image is not None:
            await answer_image.close()


@app.post("/ask-study-assistant/")
async def ask_study_assistant(
    payload: StudyChatRequest,
    current_user: str = Depends(require_authenticated_user),
):
    ensure_openai_key()
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="A question is required.")

    def _ask() -> str:
        use_vision = bool(payload.reference_images)
        response = client.with_options(timeout=VISION_REQUEST_TIMEOUT if use_vision else 45).chat.completions.create(
            model=VISION_MODEL if use_vision else STUDY_CHAT_MODEL,
            max_completion_tokens=1200,
            messages=build_chat_messages(payload),
        )
        return (response.choices[0].message.content or "").strip()

    answer = await asyncio.to_thread(_ask)
    return {"answer": make_formulas_human_readable(answer)}


@app.get("/collaboration/rooms")
async def list_collaboration_rooms(current_user: str = Depends(require_authenticated_user)):
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT DISTINCT r.*
            FROM collaboration_rooms r
            LEFT JOIN collaboration_room_members m
                ON m.room_id = r.id
            WHERE r.owner_email = ? OR m.email = ?
            ORDER BY r.updated_at DESC
            """,
            (current_user, current_user),
        ).fetchall()

    return {"rooms": [serialize_collaboration_room_card(row) for row in rows]}


@app.post("/collaboration/rooms")
async def create_collaboration_room(
    payload: CollaborationRoomCreateRequest,
    current_user: str = Depends(require_authenticated_user),
):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Room title is required.")

    transcript = payload.transcript.strip()
    summary = payload.summary.strip()
    lecture_notes = payload.lecture_notes.strip()
    lecture_slides = payload.lecture_slides.strip()
    if not any([transcript, summary, lecture_notes, lecture_slides]):
        raise HTTPException(status_code=400, detail="Create the collaboration room from a lecture that already has content.")

    room_id = uuid4().hex
    now_iso = utc_now().isoformat()
    invited_emails = normalize_invited_emails(payload.invited_emails, current_user)

    with get_db_connection() as connection:
        connection.execute(
            """
            INSERT INTO collaboration_rooms (
                id, owner_email, title, transcript, summary, formula, example,
                lecture_notes, lecture_slides, shared_notes, flashcards_json,
                quiz_questions_json, active_tab, test_visibility, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                room_id,
                current_user,
                title,
                transcript,
                summary,
                payload.formula.strip(),
                payload.example.strip(),
                lecture_notes,
                lecture_slides,
                payload.shared_notes.strip(),
                dump_json(payload.flashcards or []),
                dump_json(payload.quiz_questions or []),
                sanitize_collaboration_tab(payload.active_tab),
                normalize_test_visibility(payload.test_visibility),
                now_iso,
                now_iso,
            ),
        )
        connection.execute(
            """
            INSERT INTO collaboration_room_members (room_id, email, role, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (room_id, current_user, "owner", now_iso),
        )
        for email in invited_emails:
            connection.execute(
                """
                INSERT OR REPLACE INTO collaboration_room_members (room_id, email, role, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (room_id, email, "member", now_iso),
            )

    room = get_accessible_collaboration_room(room_id, current_user)
    return {"room": serialize_collaboration_room(room, current_user)}


@app.get("/collaboration/rooms/{room_id}")
async def get_collaboration_room(room_id: str, current_user: str = Depends(require_authenticated_user)):
    room = get_accessible_collaboration_room(room_id, current_user)
    return {"room": serialize_collaboration_room(room, current_user)}


@app.post("/collaboration/rooms/{room_id}/messages")
async def send_collaboration_message(
    room_id: str,
    payload: CollaborationMessageRequest,
    current_user: str = Depends(require_authenticated_user),
):
    room = get_accessible_collaboration_room(room_id, current_user)
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Type a collaboration message first.")

    now_iso = utc_now().isoformat()
    with get_db_connection() as connection:
        connection.execute(
            """
            INSERT INTO collaboration_room_messages (id, room_id, author_email, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (uuid4().hex, room["id"], current_user, content, now_iso),
        )
        connection.execute(
            "UPDATE collaboration_rooms SET updated_at = ? WHERE id = ?",
            (now_iso, room["id"]),
        )

    updated_room = get_accessible_collaboration_room(room_id, current_user)
    return {"room": serialize_collaboration_room(updated_room, current_user)}


@app.post("/collaboration/rooms/{room_id}/notes")
async def save_collaboration_notes(
    room_id: str,
    payload: CollaborationSharedNotesRequest,
    current_user: str = Depends(require_authenticated_user),
):
    room = get_accessible_collaboration_room(room_id, current_user)
    now_iso = utc_now().isoformat()
    with get_db_connection() as connection:
        connection.execute(
            """
            UPDATE collaboration_rooms
            SET shared_notes = ?, updated_at = ?
            WHERE id = ?
            """,
            (payload.shared_notes.strip(), now_iso, room["id"]),
        )

    updated_room = get_accessible_collaboration_room(room_id, current_user)
    return {"room": serialize_collaboration_room(updated_room, current_user)}


@app.post("/collaboration/rooms/{room_id}/active-tab")
async def update_collaboration_active_tab(
    room_id: str,
    payload: CollaborationActiveTabRequest,
    current_user: str = Depends(require_authenticated_user),
):
    room = get_accessible_collaboration_room(room_id, current_user)
    now_iso = utc_now().isoformat()
    with get_db_connection() as connection:
        connection.execute(
            """
            UPDATE collaboration_rooms
            SET active_tab = ?, updated_at = ?
            WHERE id = ?
            """,
            (sanitize_collaboration_tab(payload.active_tab), now_iso, room["id"]),
        )

    updated_room = get_accessible_collaboration_room(room_id, current_user)
    return {"room": serialize_collaboration_room(updated_room, current_user)}


@app.post("/collaboration/rooms/{room_id}/test-visibility")
async def update_collaboration_test_visibility(
    room_id: str,
    payload: CollaborationTestVisibilityRequest,
    current_user: str = Depends(require_authenticated_user),
):
    room = get_accessible_collaboration_room(room_id, current_user)
    if room["owner_email"] != current_user:
        raise HTTPException(status_code=403, detail="Only the room owner can change the test visibility.")

    now_iso = utc_now().isoformat()
    with get_db_connection() as connection:
        connection.execute(
            """
            UPDATE collaboration_rooms
            SET test_visibility = ?, updated_at = ?
            WHERE id = ?
            """,
            (normalize_test_visibility(payload.test_visibility), now_iso, room["id"]),
        )

    updated_room = get_accessible_collaboration_room(room_id, current_user)
    return {"room": serialize_collaboration_room(updated_room, current_user)}


@app.post("/collaboration/rooms/{room_id}/quiz-answers")
async def save_collaboration_quiz_answer(
    room_id: str,
    payload: CollaborationQuizAnswerRequest,
    current_user: str = Depends(require_authenticated_user),
):
    room = get_accessible_collaboration_room(room_id, current_user)
    question_number = payload.question_number.strip()
    if not question_number:
        raise HTTPException(status_code=400, detail="Question number is required.")

    now_iso = utc_now().isoformat()
    answer_text = payload.answer_text.strip()

    with get_db_connection() as connection:
        if answer_text:
            connection.execute(
                """
                INSERT INTO collaboration_room_answers (room_id, question_number, author_email, answer_text, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(room_id, question_number, author_email) DO UPDATE SET
                    answer_text = excluded.answer_text,
                    updated_at = excluded.updated_at
                """,
                (room["id"], question_number, current_user, answer_text, now_iso),
            )
        else:
            connection.execute(
                """
                DELETE FROM collaboration_room_answers
                WHERE room_id = ? AND question_number = ? AND author_email = ?
                """,
                (room["id"], question_number, current_user),
            )
        connection.execute(
            "UPDATE collaboration_rooms SET updated_at = ? WHERE id = ?",
            (now_iso, room["id"]),
        )

    updated_room = get_accessible_collaboration_room(room_id, current_user)
    return {"room": serialize_collaboration_room(updated_room, current_user)}


@app.post("/export-study-pack-pdf/")
async def export_study_pack_pdf(
    payload: PdfExportRequest,
    current_user: str = Depends(require_authenticated_user),
):
    title = payload.title.strip() or "MABASO Study Pack"
    pdf_bytes = await asyncio.to_thread(build_pdf_document, title, payload.sections)
    safe_name = sanitize_download_filename(title)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )
