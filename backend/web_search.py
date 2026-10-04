"""Safe, low-cost web retrieval for Mabaso AI Chat.

The default search provider uses DuckDuckGo's public HTML results and needs no
API key. An optional Brave Search API key can be configured for installations
that prefer its supported API. Retrieved pages are untrusted evidence: callers
must never treat page text as application instructions.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from html.parser import HTMLParser
import ipaddress
import os
import re
import socket
import time
from typing import Any
from urllib.parse import parse_qs, quote_plus, unquote, urljoin, urlparse

import requests


SEARCH_TIMEOUT_SECONDS = max(3.0, float(os.getenv("WEB_SEARCH_TIMEOUT_SECONDS", "9")))
SEARCH_MAX_RESULTS = max(2, min(int(os.getenv("WEB_SEARCH_MAX_RESULTS", "6")), 10))
PAGE_MAX_BYTES = max(64_000, min(int(os.getenv("WEB_PAGE_MAX_BYTES", "900000")), 2_000_000))
BRAVE_SEARCH_API_KEY = os.getenv("BRAVE_SEARCH_API_KEY", "").strip()
USER_AGENT = "MabasoAI-WebResearch/1.0 (+https://mabaso-ai-web.onrender.com/)"


CURRENT_INFORMATION_PATTERN = re.compile(
    r"(?:\b(?:today|tonight|yesterday|current|currently|latest|recent|now|open now|"
    r"this week|this month|this year|weather|forecast|price|score|results?|news|"
    r"president|minister|ceo|applications?|bursar(?:y|ies)|funding|deadline|fixtures?)\b|"
    r"\bsearch (?:the )?web\b|\blook (?:this|it) up\b|\bfind (?:the )?latest\b)",
    re.IGNORECASE,
)
EXPLICIT_SEARCH_PATTERN = re.compile(
    r"\b(?:search|browse|look up|find online|check online|on the web|from the web)\b",
    re.IGNORECASE,
)
URL_PATTERN = re.compile(r"https?://[^\s<>\]\[\)\(\"']+", re.IGNORECASE)
SOUTH_AFRICA_RELEVANCE_PATTERN = re.compile(
    r"\b(?:bursar(?:y|ies)|university applications?|student funding|nsfas|learnerships?|"
    r"matric|campus|tuition|financial aid)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class SearchSource:
    title: str
    url: str
    publisher: str
    snippet: str
    retrieved_at: str
    content: str = ""

    def safe_dict(self) -> dict[str, str]:
        return asdict(self)


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self._in_title = False
        self._ignored = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        lowered = tag.lower()
        if lowered in {"script", "style", "noscript", "svg"}:
            self._ignored += 1
        if lowered == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        if lowered in {"script", "style", "noscript", "svg"} and self._ignored:
            self._ignored -= 1
        if lowered == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        text = re.sub(r"\s+", " ", data or " ").strip()
        if not text or self._ignored:
            return
        if self._in_title:
            self.title = f"{self.title} {text}".strip()
        else:
            self.parts.append(text)


class _DuckDuckGoParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.results: list[dict[str, str]] = []
        self._current: dict[str, str] | None = None
        self._capture_title = False
        self._capture_snippet = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        classes = set((attr.get("class") or "").split())
        if tag == "a" and "result__a" in classes:
            self._current = {"title": "", "url": attr.get("href") or "", "snippet": ""}
            self._capture_title = True
        elif self._current is not None and ("result__snippet" in classes or "result__body" in classes):
            self._capture_snippet = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._capture_title:
            self._capture_title = False
        if tag in {"a", "div"} and self._capture_snippet:
            self._capture_snippet = False
        if tag == "div" and self._current and self._current.get("title") and self._current.get("url"):
            self.results.append(self._current)
            self._current = None

    def handle_data(self, data: str) -> None:
        if self._current is None:
            return
        text = re.sub(r"\s+", " ", data or " ").strip()
        if not text:
            return
        if self._capture_title:
            self._current["title"] = f"{self._current['title']} {text}".strip()
        elif self._capture_snippet:
            self._current["snippet"] = f"{self._current['snippet']} {text}".strip()


def extract_user_url(question: str) -> str:
    match = URL_PATTERN.search(str(question or ""))
    return (match.group(0).rstrip(".,;:!?") if match else "")[:2048]


def should_use_web_search(question: str) -> bool:
    text = str(question or "").strip()
    if not text or extract_user_url(text):
        return False
    return bool(EXPLICIT_SEARCH_PATTERN.search(text) or CURRENT_INFORMATION_PATTERN.search(text))


def build_search_query(question: str) -> str:
    query = re.sub(r"\s+", " ", str(question or "")).strip()[:500]
    if SOUTH_AFRICA_RELEVANCE_PATTERN.search(query) and not re.search(
        r"\b(?:south africa|south african|usa|united states|uk|united kingdom|canada|australia|india|europe)\b",
        query,
        re.IGNORECASE,
    ):
        query = f"{query} South Africa"
    return query


def _is_public_ip(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified)


def validate_public_url(url: str, *, allowed_hosts: set[str] | None = None) -> str:
    parsed = urlparse(str(url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Only public HTTP or HTTPS URLs are supported.")
    host = parsed.hostname.lower().rstrip(".")
    if host == "localhost" or host.endswith(".local"):
        raise ValueError("Private network addresses are not supported.")
    if allowed_hosts and host not in {item.lower().rstrip(".") for item in allowed_hosts}:
        raise ValueError("This host is not approved for this operation.")
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)}
    except OSError as exc:
        raise ValueError("The website address could not be resolved.") from exc
    if not addresses or any(not _is_public_ip(address) for address in addresses):
        raise ValueError("Private network addresses are not supported.")
    return parsed.geturl()


def _unwrap_duckduckgo_url(value: str) -> str:
    url = unquote(str(value or ""))
    if url.startswith("//"):
        url = f"https:{url}"
    parsed = urlparse(url)
    if parsed.hostname and parsed.hostname.endswith("duckduckgo.com"):
        target = parse_qs(parsed.query).get("uddg", [""])[0]
        if target:
            return unquote(target)
    return url


def _publisher(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _request(url: str, *, headers: dict[str, str] | None = None, params: dict[str, str] | None = None) -> requests.Response:
    return requests.get(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml", **(headers or {})},
        params=params,
        timeout=(4, SEARCH_TIMEOUT_SECONDS),
        allow_redirects=True,
        stream=True,
    )


def read_public_page(url: str) -> dict[str, str]:
    safe_url = validate_public_url(url)
    response = _request(safe_url)
    final_url = validate_public_url(response.url)
    response.raise_for_status()
    content_type = (response.headers.get("content-type") or "").lower()
    if "text/html" not in content_type and "text/plain" not in content_type:
        raise ValueError("This URL does not contain a supported web page.")
    chunks: list[bytes] = []
    size = 0
    for chunk in response.iter_content(32_768):
        size += len(chunk)
        if size > PAGE_MAX_BYTES:
            raise ValueError("The page is too large to read safely.")
        chunks.append(chunk)
    encoding = response.encoding or "utf-8"
    raw = b"".join(chunks).decode(encoding, errors="replace")
    parser = _TextExtractor()
    parser.feed(raw)
    content = re.sub(r"\s+", " ", " ".join(parser.parts)).strip()
    return {
        "title": parser.title[:240] or _publisher(final_url),
        "url": final_url,
        "publisher": _publisher(final_url),
        "content": content[:12_000],
        "retrieved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def _search_brave(query: str, limit: int) -> list[dict[str, str]]:
    response = requests.get(
        "https://api.search.brave.com/res/v1/web/search",
        headers={"Accept": "application/json", "X-Subscription-Token": BRAVE_SEARCH_API_KEY, "User-Agent": USER_AGENT},
        params={"q": query, "count": limit, "country": "za", "search_lang": "en"},
        timeout=(4, SEARCH_TIMEOUT_SECONDS),
    )
    response.raise_for_status()
    rows = ((response.json() or {}).get("web") or {}).get("results") or []
    return [{"title": str(row.get("title") or ""), "url": str(row.get("url") or ""), "snippet": str(row.get("description") or "")} for row in rows]


def _search_duckduckgo(query: str, limit: int) -> list[dict[str, str]]:
    response = _request("https://html.duckduckgo.com/html/", params={"q": query, "kl": "za-en"})
    response.raise_for_status()
    raw = response.content[:PAGE_MAX_BYTES].decode(response.encoding or "utf-8", errors="replace")
    parser = _DuckDuckGoParser()
    parser.feed(raw)
    return parser.results[:limit]


def search_web(question: str, *, limit: int | None = None, retrieve_pages: int = 4) -> dict[str, Any]:
    query = build_search_query(question)
    if not query:
        raise ValueError("A search query is required.")
    safe_limit = max(2, min(int(limit or SEARCH_MAX_RESULTS), SEARCH_MAX_RESULTS))
    provider = "brave" if BRAVE_SEARCH_API_KEY else "duckduckgo"
    started = time.perf_counter()
    rows = _search_brave(query, safe_limit) if BRAVE_SEARCH_API_KEY else _search_duckduckgo(query, safe_limit)
    sources: list[SearchSource] = []
    seen: set[str] = set()
    for row in rows:
        url = _unwrap_duckduckgo_url(row.get("url") or "")
        try:
            safe_url = validate_public_url(url)
        except ValueError:
            continue
        if safe_url in seen:
            continue
        seen.add(safe_url)
        page: dict[str, str] = {}
        if len(sources) < max(0, min(retrieve_pages, safe_limit)):
            try:
                page = read_public_page(safe_url)
            except (requests.RequestException, ValueError):
                page = {}
        sources.append(
            SearchSource(
                title=(page.get("title") or row.get("title") or _publisher(safe_url))[:240],
                url=(page.get("url") or safe_url)[:2048],
                publisher=(page.get("publisher") or _publisher(safe_url))[:160],
                snippet=re.sub(r"\s+", " ", row.get("snippet") or "").strip()[:600],
                retrieved_at=page.get("retrieved_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                content=(page.get("content") or "")[:8000],
            )
        )
        if len(sources) >= safe_limit:
            break
    return {
        "query": query,
        "provider": provider,
        "sources": [source.safe_dict() for source in sources],
        "duration_ms": int((time.perf_counter() - started) * 1000),
    }


def build_grounding_context(sources: list[dict[str, Any]]) -> str:
    blocks: list[str] = []
    for index, source in enumerate(sources, start=1):
        evidence = str(source.get("content") or source.get("snippet") or "").strip()[:5000]
        if not evidence:
            continue
        blocks.append(
            f"[SOURCE {index}]\nTitle: {source.get('title', '')}\nPublisher: {source.get('publisher', '')}\n"
            f"URL: {source.get('url', '')}\nRetrieved: {source.get('retrieved_at', '')}\nEvidence: {evidence}"
        )
    return "\n\n".join(blocks)
