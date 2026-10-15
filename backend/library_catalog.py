"""Safe metadata helpers for Mabaso AI's personal Library.

File bytes stay in private object storage.  This module only handles compact,
owner-scoped organisational metadata such as folders, favourites, and links.
"""

from __future__ import annotations

import ipaddress
import re
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic import BaseModel, Field, field_validator


SENSITIVE_QUERY_KEYS = re.compile(
    r"(?:^|_)(?:access_?token|auth|authorization|code|credential|jwt|key|otp|pass(?:word)?|session|signature)(?:$|_)",
    re.IGNORECASE,
)


class LibraryFolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class LibraryFolderUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    is_favorite: bool | None = None


class LibraryFileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=180)
    folder_id: str | None = Field(default=None, max_length=80)
    is_favorite: bool | None = None


class LibraryBulkUpdate(BaseModel):
    file_ids: list[str] = Field(default_factory=list, max_length=60)
    folder_id: str | None = Field(default=None, max_length=80)
    is_favorite: bool | None = None


class LibraryLinkCreate(BaseModel):
    url: str = Field(min_length=8, max_length=2048)
    title: str = Field(default="", max_length=240)
    description: str = Field(default="", max_length=500)
    source_type: str = Field(default="manual", max_length=40)
    folder_id: str = Field(default="", max_length=80)


class LibraryLinkUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=240)
    description: str | None = Field(default=None, max_length=500)
    folder_id: str | None = Field(default=None, max_length=80)
    is_favorite: bool | None = None


class LibraryLinkImport(BaseModel):
    links: list[LibraryLinkCreate] = Field(default_factory=list, max_length=20)


LIBRARY_SEARCH_DEPTHS = {"quick", "balanced", "thorough"}
LIBRARY_VIEWS = {"list", "grid"}
LIBRARY_SORTS = {"newest", "oldest", "name_asc", "name_desc", "largest", "smallest"}
LIBRARY_SEARCH_SCOPES = {"all", "selected"}
LIBRARY_DUPLICATE_POLICIES = {"ask", "skip", "keep_both"}

DEFAULT_LIBRARY_SETTINGS: dict[str, Any] = {
    "automatic_search": False,
    "search_depth": "balanced",
    "show_sources": True,
    "include_documents": True,
    "include_images": False,
    "include_recordings": True,
    "include_links": False,
    "auto_save_chat_uploads": True,
    "auto_save_generated_files": True,
    "auto_save_links": False,
    "default_view": "list",
    "default_sort": "newest",
    "search_scope": "all",
    "selected_folder_ids": [],
    "excluded_folder_ids": [],
    "duplicate_policy": "ask",
    "search_file_contents": True,
    "storage_warnings": True,
}


def normalize_library_settings(value: Any) -> dict[str, Any]:
    supplied = value if isinstance(value, dict) else {}
    result = dict(DEFAULT_LIBRARY_SETTINGS)
    for key in (
        "automatic_search", "show_sources", "include_documents", "include_images",
        "include_recordings", "include_links", "auto_save_chat_uploads",
        "auto_save_generated_files", "auto_save_links", "search_file_contents",
        "storage_warnings",
    ):
        if key in supplied:
            result[key] = bool(supplied[key])
    for key, allowed in (
        ("search_depth", LIBRARY_SEARCH_DEPTHS),
        ("default_view", LIBRARY_VIEWS),
        ("default_sort", LIBRARY_SORTS),
        ("search_scope", LIBRARY_SEARCH_SCOPES),
        ("duplicate_policy", LIBRARY_DUPLICATE_POLICIES),
    ):
        candidate = str(supplied.get(key, result[key]) or "").strip().lower()
        result[key] = candidate if candidate in allowed else result[key]
    for key in ("selected_folder_ids", "excluded_folder_ids"):
        values = supplied.get(key, [])
        result[key] = list(dict.fromkeys(str(item).strip() for item in values if str(item).strip()))[:100] if isinstance(values, list) else []
    return result


class LibraryPreferenceUpdate(BaseModel):
    automatic_search: bool | None = None
    search_depth: str | None = None
    show_sources: bool | None = None
    include_documents: bool | None = None
    include_images: bool | None = None
    include_recordings: bool | None = None
    include_links: bool | None = None
    auto_save_chat_uploads: bool | None = None
    auto_save_generated_files: bool | None = None
    auto_save_links: bool | None = None
    default_view: str | None = None
    default_sort: str | None = None
    search_scope: str | None = None
    selected_folder_ids: list[str] | None = Field(default=None, max_length=100)
    excluded_folder_ids: list[str] | None = Field(default=None, max_length=100)
    duplicate_policy: str | None = None
    search_file_contents: bool | None = None
    storage_warnings: bool | None = None

    @field_validator("search_depth")
    @classmethod
    def validate_search_depth(cls, value: str | None):
        if value is not None and value not in LIBRARY_SEARCH_DEPTHS:
            raise ValueError("Choose quick, balanced, or thorough search.")
        return value

    @field_validator("default_view")
    @classmethod
    def validate_view(cls, value: str | None):
        if value is not None and value not in LIBRARY_VIEWS:
            raise ValueError("Choose list or grid view.")
        return value

    @field_validator("default_sort")
    @classmethod
    def validate_sort(cls, value: str | None):
        if value is not None and value not in LIBRARY_SORTS:
            raise ValueError("Choose a supported Library sort order.")
        return value

    @field_validator("search_scope")
    @classmethod
    def validate_scope(cls, value: str | None):
        if value is not None and value not in LIBRARY_SEARCH_SCOPES:
            raise ValueError("Choose all folders or selected folders.")
        return value

    @field_validator("duplicate_policy")
    @classmethod
    def validate_duplicate_policy(cls, value: str | None):
        if value is not None and value not in LIBRARY_DUPLICATE_POLICIES:
            raise ValueError("Choose ask, skip, or keep both.")
        return value


class LibraryDeleteAllRequest(BaseModel):
    confirmation: str = Field(min_length=1, max_length=20)


def row_value(row: Any, key: str, default: Any = "") -> Any:
    try:
        value = row[key]
    except (KeyError, IndexError, TypeError):
        return default
    return default if value is None else value


def clean_folder_name(value: str) -> str:
    name = re.sub(r"[\x00-\x1f\x7f]+", " ", str(value or ""))
    name = re.sub(r"\s+", " ", name).strip()[:80]
    if not name or name in {".", ".."}:
        raise ValueError("Enter a folder name.")
    return name


def normalize_saved_link(value: str) -> tuple[str, str]:
    raw = str(value or "").strip()[:2048]
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Enter a public HTTP or HTTPS website address.")
    host = parsed.hostname.lower().rstrip(".")
    if host == "localhost" or host.endswith(".local"):
        raise ValueError("Private network links cannot be saved.")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address and not address.is_global:
        raise ValueError("Private network links cannot be saved.")
    safe_query: list[tuple[str, str]] = []
    for key, item in parse_qsl(parsed.query, keep_blank_values=True, max_num_fields=80):
        if SENSITIVE_QUERY_KEYS.search(key):
            raise ValueError("This link appears to contain private sign-in information and was not saved.")
        safe_query.append((key[:100], item[:500]))
    normalized = urlunparse((parsed.scheme, parsed.netloc.lower(), parsed.path or "/", "", urlencode(safe_query), ""))
    return normalized[:2048], host


def serialize_folder(row: Any) -> dict[str, Any]:
    return {
        "id": str(row_value(row, "id")),
        "name": str(row_value(row, "name", "Folder")),
        "is_favorite": bool(int(row_value(row, "is_favorite", 0) or 0)),
        "created_at": str(row_value(row, "created_at")),
        "updated_at": str(row_value(row, "updated_at")),
        "item_count": int(row_value(row, "item_count", 0) or 0),
    }


def serialize_link(row: Any) -> dict[str, Any]:
    return {
        "id": str(row_value(row, "id")),
        "url": str(row_value(row, "url")),
        "title": str(row_value(row, "title") or row_value(row, "domain", "Saved link")),
        "description": str(row_value(row, "description")),
        "domain": str(row_value(row, "domain")),
        "source_type": str(row_value(row, "source_type", "manual")),
        "folder_id": str(row_value(row, "folder_id")),
        "is_favorite": bool(int(row_value(row, "is_favorite", 0) or 0)),
        "created_at": str(row_value(row, "created_at")),
        "updated_at": str(row_value(row, "updated_at")),
        "item_type": "link",
    }
