"""Searchable, non-personal Mabaso AI product knowledge.

The index is built from the repository's public page configuration, public
markdown guides and the small verified product metadata file. It never indexes
user records, private rooms, billing records or saved materials.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
import re
from typing import Any


CANONICAL_ORIGIN = "https://mabaso-ai-web.onrender.com"
TOKEN_PATTERN = re.compile(r"[a-z0-9][a-z0-9_-]{1,}", re.IGNORECASE)
PRODUCT_INTENT_PATTERN = re.compile(
    r"(?:\bmabaso(?:\s+ai)?\b|\b(?:collaboration rooms?|saved materials?|study workspace|study chat|"
    r"free trial|payfast|payshap|refund|subscription|my plan|my attempts?|room invitation|admin control)\b)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class KnowledgeChunk:
    source_type: str
    route: str
    page_title: str
    section_heading: str
    content: str
    visibility: str
    content_hash: str

    def safe_dict(self) -> dict[str, str]:
        row = asdict(self)
        row["source_url"] = f"{CANONICAL_ORIGIN}{self.route}" if self.route.startswith("/") else ""
        return row


def is_mabaso_product_query(question: str) -> bool:
    return bool(PRODUCT_INTENT_PATTERN.search(str(question or "")))


def _tokens(value: str) -> set[str]:
    ignored = {"about", "does", "from", "have", "into", "mabaso", "that", "their", "this", "what", "when", "where", "which", "with", "your"}
    return {token.lower() for token in TOKEN_PATTERN.findall(value or "") if token.lower() not in ignored}


def _chunk(*, source_type: str, route: str, title: str, heading: str, content: str, visibility: str) -> KnowledgeChunk | None:
    cleaned = re.sub(r"\s+", " ", content or "").strip()
    if len(cleaned) < 40:
        return None
    digest = hashlib.sha256(f"{route}\n{heading}\n{cleaned}".encode("utf-8")).hexdigest()[:20]
    return KnowledgeChunk(source_type, route, title, heading, cleaned[:5000], visibility, digest)


def _decode_js_string(value: str) -> str:
    try:
        return json.loads(f'"{value}"')
    except Exception:
        return value.replace("\\n", " ").replace("\\\"", '"')


def _frontend_root() -> Path:
    return Path(__file__).resolve().parents[1] / "frontend" / "src"


def build_product_index() -> list[KnowledgeChunk]:
    chunks: list[KnowledgeChunk] = []
    frontend_root = _frontend_root()
    config_path = frontend_root / "sitePageConfig.js"
    if config_path.exists():
        source = config_path.read_text(encoding="utf-8")
        # Main route declarations use four spaces. Nested CTA/link routes are
        # deliberately excluded so their surrounding page text is not assigned
        # to the wrong URL.
        route_matches = list(re.finditer(r'^ {4}route:\s*"([^"]+)"', source, re.MULTILINE))
        for index, match in enumerate(route_matches):
            route = match.group(1)
            if not route.startswith("/"):
                continue
            end = route_matches[index + 1].start() if index + 1 < len(route_matches) else min(len(source), match.start() + 24_000)
            segment = source[match.start():end]
            access_match = re.search(r'^ {4}access:\s*"([^"]+)"', segment, re.MULTILINE)
            access = access_match.group(1) if access_match else "public"
            title_match = re.search(r'\btitle:\s*"((?:\\.|[^"])*)"', segment)
            page_title = _decode_js_string(title_match.group(1)) if title_match else route.strip("/").replace("-", " ").title()
            strings = [_decode_js_string(item) for item in re.findall(r'(?:headline|description|question|answer):\s*"((?:\\.|[^"])*)"', segment)]
            for offset in range(0, len(strings), 5):
                content = " ".join(strings[offset:offset + 5])
                item = _chunk(
                    source_type="public_page" if access == "public" else "internal_product_docs",
                    route=route,
                    title=page_title,
                    heading=page_title if offset == 0 else f"{page_title} details {offset // 5 + 1}",
                    content=content,
                    visibility="public" if access == "public" else "authenticated_feature_documentation",
                )
                if item:
                    chunks.append(item)

    content_dir = frontend_root / "content"
    for path in sorted(content_dir.glob("*.md")) if content_dir.exists() else []:
        text = path.read_text(encoding="utf-8")
        sections = re.split(r"(?m)^(#{1,3})\s+(.+?)\s*$", text)
        current_heading = path.stem.replace("-", " ").title()
        route = "/company/terms" if path.name == "terms-and-conditions.md" else "/collaboration/shared-study-rooms"
        for index in range(0, len(sections), 3):
            if index + 2 < len(sections):
                current_heading = sections[index + 2].strip()
                content = sections[index + 3] if index + 3 < len(sections) else ""
            else:
                content = sections[index]
            item = _chunk(
                source_type="public_documentation",
                route=route,
                title=path.stem.replace("-", " ").title(),
                heading=current_heading,
                content=content,
                visibility="public",
            )
            if item:
                chunks.append(item)

    metadata_path = Path(__file__).with_name("mabaso_product_knowledge.json")
    if metadata_path.exists():
        try:
            payload = json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception:
            payload = {}
        if isinstance(payload, dict):
            for key, value in payload.items():
                if isinstance(value, (str, int, float, bool)):
                    item = _chunk(
                        source_type="verified_product_metadata",
                        route="/company/about",
                        title="Mabaso AI product information",
                        heading=str(key).replace("_", " ").title(),
                        content=f"{str(key).replace('_', ' ').title()}: {value}",
                        visibility="public",
                    )
                    if item:
                        chunks.append(item)
    deduped: dict[str, KnowledgeChunk] = {chunk.content_hash: chunk for chunk in chunks}
    return list(deduped.values())


PRODUCT_INDEX = build_product_index()


def search_product_knowledge(question: str, *, limit: int = 6) -> list[dict[str, Any]]:
    query_tokens = _tokens(question)
    ranked: list[tuple[float, KnowledgeChunk]] = []
    for chunk in PRODUCT_INDEX:
        title_tokens = _tokens(f"{chunk.page_title} {chunk.section_heading} {chunk.route}")
        content_tokens = _tokens(chunk.content)
        direct = len(query_tokens & content_tokens)
        title = len(query_tokens & title_tokens)
        phrase_bonus = 2 if str(question or "").lower().strip(" ?") in chunk.content.lower() else 0
        score = direct + (title * 2.5) + phrase_bonus
        if score > 0:
            ranked.append((score, chunk))
    ranked.sort(key=lambda item: (-item[0], item[1].route, item[1].section_heading))
    return [chunk.safe_dict() for _, chunk in ranked[:max(1, min(int(limit or 6), 10))]]


def build_product_context(results: list[dict[str, Any]]) -> str:
    blocks: list[str] = []
    for index, result in enumerate(results, start=1):
        blocks.append(
            f"[MABASO SOURCE {index}]\nPage: {result.get('page_title', '')}\n"
            f"Section: {result.get('section_heading', '')}\nURL: {result.get('source_url', '')}\n"
            f"Information: {result.get('content', '')}"
        )
    return "\n\n".join(blocks)
