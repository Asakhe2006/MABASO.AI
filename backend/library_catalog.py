"""Safe metadata helpers for Mabaso AI's personal Library.

File bytes stay in private object storage.  This module only handles compact,
owner-scoped organisational metadata such as folders, favourites, and links.
"""

from __future__ import annotations

import ipaddress
import re
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic import BaseModel, Field


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


class LibraryPreferenceUpdate(BaseModel):
    auto_save_links: bool


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
