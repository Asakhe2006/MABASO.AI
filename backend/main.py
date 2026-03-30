import asyncio
import base64
from io import BytesIO
import logging
import mimetypes
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from uuid import uuid4
from xml.etree import ElementTree as ET

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import APIStatusError, InternalServerError, OpenAI
from pydantic import BaseModel

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
client = OpenAI()

TRANSCRIPTION_MODEL = os.getenv("TRANSCRIPTION_MODEL", "gpt-4o-transcribe")
FALLBACK_TRANSCRIPTION_MODEL = os.getenv("FALLBACK_TRANSCRIPTION_MODEL", "whisper-1")
STUDY_GUIDE_MODEL = os.getenv("STUDY_GUIDE_MODEL", "gpt-4.1-mini")
VISION_MODEL = os.getenv("VISION_MODEL", "gpt-4.1-mini")
MAX_COMPLETION_TOKENS = int(os.getenv("MAX_COMPLETION_TOKENS", "8000"))
MAX_FILE_SIZE_BYTES = int(os.getenv("MAX_FILE_SIZE_BYTES", str(250 * 1024 * 1024)))
OPENAI_AUDIO_LIMIT_BYTES = int(os.getenv("OPENAI_AUDIO_LIMIT_BYTES", str(25 * 1024 * 1024)))
CHUNK_DURATION_SECONDS = int(os.getenv("CHUNK_DURATION_SECONDS", "300"))
CHUNK_OVERLAP_SECONDS = int(os.getenv("CHUNK_OVERLAP_SECONDS", "20"))
TRANSCRIPTION_AUDIO_BITRATE = os.getenv("TRANSCRIPTION_AUDIO_BITRATE", "48k")
TRANSCRIPTION_AUDIO_SAMPLE_RATE = os.getenv("TRANSCRIPTION_AUDIO_SAMPLE_RATE", "16000")
MAX_STUDY_GUIDE_INPUT_CHARS = int(os.getenv("MAX_STUDY_GUIDE_INPUT_CHARS", "30000"))
STUDY_GUIDE_REQUEST_TIMEOUT = float(os.getenv("STUDY_GUIDE_REQUEST_TIMEOUT", "90"))
VISION_REQUEST_TIMEOUT = float(os.getenv("VISION_REQUEST_TIMEOUT", "45"))
TRANSCRIPTION_REQUEST_TIMEOUT = float(os.getenv("TRANSCRIPTION_REQUEST_TIMEOUT", "1200"))
TRANSCRIPTION_RETRIES = int(os.getenv("TRANSCRIPTION_RETRIES", "2"))
MAX_IMAGE_UPLOAD_BYTES = int(os.getenv("MAX_IMAGE_UPLOAD_BYTES", str(15 * 1024 * 1024)))
MAX_SLIDE_UPLOAD_BYTES = int(os.getenv("MAX_SLIDE_UPLOAD_BYTES", str(30 * 1024 * 1024)))
UPLOAD_DIR = Path(tempfile.gettempdir()) / "lecture-ai-project"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

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
- In VISUAL AIDS, include simple ASCII diagrams, neat comparison tables, flow layouts, or graph sketches when they help explain the topic.
- Only include a bar graph, line graph, axis sketch, or trend diagram when the lecture discusses data, change over time, or relationships between variables. Do not invent fake numerical data.
- Use simple text layouts that students can read easily in plain Markdown.
- In PRACTICE QUESTIONS AND ANSWERS, create 10 numbered question-and-answer pairs using this exact style:
  1. Question: ...
  
     Answer: ...
- Leave a blank line between each question and its answer, and a blank line between each numbered question block.
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


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_job(job_type: str) -> str:
    job_id = uuid4().hex
    jobs[job_id] = {
        "job_id": job_id,
        "job_type": job_type,
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


def parse_quiz_marking_response(content: str) -> dict[str, str | int]:
    parsed = {
        "score": 0,
        "extracted_answer": "",
        "feedback": "The answer image was reviewed.",
    }

    for line in content.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        normalized_key = key.strip().upper()
        cleaned_value = value.strip()
        if normalized_key == "SCORE":
            parsed["score"] = 1 if cleaned_value.startswith("1") else 0
        elif normalized_key == "EXTRACTED_ANSWER":
            parsed["extracted_answer"] = cleaned_value
        elif normalized_key == "FEEDBACK":
            parsed["feedback"] = cleaned_value or parsed["feedback"]

    return parsed


def mark_quiz_answer_with_ai(
    question: str,
    expected_answer: str,
    student_answer: str = "",
    answer_image_data_url: str = "",
) -> dict[str, str | int]:
    user_parts: list[dict] = [
        {
            "type": "text",
            "text": (
                "Grade this student answer against the expected answer.\n\n"
                f"Question: {question}\n"
                f"Expected answer: {expected_answer}\n"
                f"Typed student answer: {student_answer or 'No typed answer provided.'}\n\n"
                "Be fair if the meaning is correct even when wording differs. "
                "Return exactly three lines:\n"
                "SCORE: 0 or 1\n"
                "EXTRACTED_ANSWER: short plain-text version of what the student answered\n"
                "FEEDBACK: one short helpful sentence"
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
                    "You may read typed answers, handwritten work, or both. "
                    "Only award SCORE: 1 when the answer is substantially correct."
                ),
            },
            {"role": "user", "content": user_parts},
        ],
    )
    content = (response.choices[0].message.content or "").strip()
    return parse_quiz_marking_response(content)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
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

    update_job(job_id, status="processing", stage="Compressing lecture audio", progress=15)
    compressed_audio = chunk_dir / "compressed.mp3"
    compress_command = [
        ffmpeg_path,
        "-y",
        "-i",
        str(file_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        TRANSCRIPTION_AUDIO_SAMPLE_RATE,
        "-b:a",
        TRANSCRIPTION_AUDIO_BITRATE,
        str(compressed_audio),
    ]

    compress_result = subprocess.run(
        compress_command,
        capture_output=True,
        text=True,
        check=False,
    )
    if compress_result.returncode != 0:
        raise RuntimeError(f"ffmpeg could not extract audio from this file: {compress_result.stderr.strip()}")

    if compressed_audio.exists() and get_file_size(compressed_audio) <= OPENAI_AUDIO_LIMIT_BYTES:
        update_job(job_id, status="processing", stage="Audio prepared successfully", progress=20)
        return [compressed_audio]

    update_job(job_id, status="processing", stage="Splitting lecture into parts", progress=18)
    segment_pattern = chunk_dir / "chunk_%03d.mp3"
    split_command = [
        ffmpeg_path,
        "-y",
        "-i",
        str(compressed_audio),
        "-f",
        "segment",
        "-segment_time",
        str(CHUNK_DURATION_SECONDS),
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
        raise RuntimeError(f"ffmpeg could not split this file into chunks: {split_result.stderr.strip()}")

    chunk_files = sorted(chunk_dir.glob("chunk_*.mp3"))
    if not chunk_files:
        raise RuntimeError("Audio splitting completed, but no chunks were produced.")

    oversized_chunks = [chunk.name for chunk in chunk_files if get_file_size(chunk) > OPENAI_AUDIO_LIMIT_BYTES]
    if oversized_chunks:
        raise RuntimeError(
            "Some generated audio chunks are still too large for OpenAI transcription. Try lowering CHUNK_DURATION_SECONDS."
        )

    update_job(job_id, status="processing", stage=f"Prepared {len(chunk_files)} lecture parts", progress=22)
    return chunk_files


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
                    f"{index}. Question: Explain {item}.\n\n"
                    f"   Answer: Define it, describe why it matters, and connect it to the lecture context."
                )
                for index, item in enumerate(concept_bullets[:3], start=1)
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


async def generate_study_guide(
    transcript: str,
    lecture_notes: str,
    lecture_slides: str,
    job_id: str,
) -> tuple[str, bool]:
    trimmed_transcript = transcript[:MAX_STUDY_GUIDE_INPUT_CHARS].strip()
    trimmed_notes = lecture_notes[:MAX_STUDY_GUIDE_INPUT_CHARS].strip()
    trimmed_slides = lecture_slides[:MAX_STUDY_GUIDE_INPUT_CHARS].strip()

    if len(transcript) > MAX_STUDY_GUIDE_INPUT_CHARS:
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
        return make_formulas_human_readable(summary), False
    except Exception as exc:
        logger.warning("Primary study guide generation failed, using fallback summary: %s", exc)
        update_job(job_id, status="processing", stage="Generating fallback study guide", progress=75)
        fallback_source = "\n\n".join(
            part for part in [lecture_notes.strip(), lecture_slides.strip(), transcript.strip()] if part
        )
        return make_formulas_human_readable(build_fallback_study_guide(fallback_source)), True


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


async def run_summary_job(job_id: str, transcript: str, lecture_notes: str, lecture_slides: str):
    try:
        update_job(job_id, status="processing", stage="Starting study guide generation", progress=10)
        summary, used_fallback = await generate_study_guide(transcript, lecture_notes, lecture_slides, job_id)
        assets = extract_study_assets(summary)
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
async def upload_audio(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    job_id = create_job("transcription")
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


@app.post("/extract-slide-text/")
async def extract_slide_text(file: UploadFile = File(...)):
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
async def create_study_guide(payload: StudyGuideRequest):
    transcript = payload.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript is required to generate a study guide.")

    ensure_openai_key()
    job_id = create_job("study_guide")
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
    answer_image: UploadFile | None = File(None),
):
    ensure_openai_key()

    if not student_answer.strip() and answer_image is None:
        return {
            "score": 0,
            "feedback": "No answer was submitted yet.",
            "extracted_answer": "",
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
        )
        return result
    finally:
        if answer_image is not None:
            await answer_image.close()
