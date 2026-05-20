from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import requests


def compact_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").replace("\x00", " ").strip()
    return text or fallback


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def shorten_text(value: str, limit: int, *, ellipsis: str = "...") -> str:
    cleaned = compact_text(value)
    if not cleaned or len(cleaned) <= limit:
        return cleaned
    clipped = cleaned[:limit].rsplit(" ", 1)[0].strip() or cleaned[:limit].strip()
    return f"{clipped}{ellipsis}"


def parse_content_range_total(value: str = "") -> int | None:
    match = re.search(r"/(\d+)$", value or "")
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


class SupabaseChatHistoryError(RuntimeError):
    pass


@dataclass
class SupabaseChatHistoryStore:
    base_url: str = ""
    service_key: str = ""
    schema: str = "public"
    timeout_seconds: float = 12.0
    user_cache: dict[str, dict[str, Any]] = field(default_factory=dict)

    @classmethod
    def from_env(cls) -> "SupabaseChatHistoryStore":
        return cls(
            base_url=compact_text(os.getenv("SUPABASE_URL")).rstrip("/"),
            service_key=compact_text(os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
            schema=compact_text(os.getenv("SUPABASE_DB_SCHEMA"), "public"),
            timeout_seconds=max(5.0, float(os.getenv("SUPABASE_REQUEST_TIMEOUT_SECONDS", "12"))),
        )

    @property
    def available(self) -> bool:
        return bool(self.base_url and self.service_key)

    def _headers(self, *, prefer: str = "return=representation") -> dict[str, str]:
        if not self.available:
            raise SupabaseChatHistoryError("Supabase chat history is not configured on the backend.")
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Profile": self.schema,
            "Content-Profile": self.schema,
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: Any | None = None,
        prefer: str = "return=representation",
    ) -> tuple[Any, requests.Response]:
        response = requests.request(
            method=method.upper(),
            url=f"{self.base_url}/rest/v1/{path.lstrip('/')}",
            headers=self._headers(prefer=prefer),
            params=params,
            json=json_body,
            timeout=self.timeout_seconds,
        )
        if not response.ok:
            detail = compact_text(response.text, f"Supabase request failed with {response.status_code}.")
            raise SupabaseChatHistoryError(detail)
        if response.status_code == 204 or not compact_text(response.text):
            return None, response
        try:
            return response.json(), response
        except ValueError:
            return None, response

    def _normalize_row(self, payload: Any) -> dict[str, Any] | None:
        if isinstance(payload, list):
            for item in payload:
                if isinstance(item, dict):
                    return item
            return None
        return payload if isinstance(payload, dict) else None

    def ensure_user(self, email: str) -> dict[str, Any]:
        normalized_email = compact_text(email).lower()
        if not normalized_email:
            raise SupabaseChatHistoryError("A valid email is required for conversation history.")
        cached = self.user_cache.get(normalized_email)
        if cached:
            return cached

        now = utc_now_iso()
        payload = {
            "email": normalized_email,
            "created_at": now,
            "updated_at": now,
        }
        data, _ = self._request(
            "POST",
            "users",
            params={"on_conflict": "email"},
            json_body=payload,
            prefer="resolution=merge-duplicates,return=representation",
        )
        row = self._normalize_row(data)
        if not row:
            raise SupabaseChatHistoryError("Supabase did not return the saved chat user row.")
        self.user_cache[normalized_email] = row
        return row

    def get_conversation(self, email: str, conversation_id: str) -> dict[str, Any] | None:
        normalized_email = compact_text(email).lower()
        normalized_id = compact_text(conversation_id)
        if not normalized_email or not normalized_id:
            return None
        data, _ = self._request(
            "GET",
            "conversations",
            params={
                "select": "*",
                "id": f"eq.{normalized_id}",
                "user_email": f"eq.{normalized_email}",
                "limit": "1",
            },
            prefer="return=representation",
        )
        return self._normalize_row(data)

    def ensure_conversation(
        self,
        *,
        email: str,
        conversation_id: str,
        title: str = "",
        lecture_label: str = "",
        context_key: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        normalized_email = compact_text(email).lower()
        normalized_id = compact_text(conversation_id)
        if not normalized_email or not normalized_id:
            raise SupabaseChatHistoryError("A valid conversation id and email are required.")

        existing = self.get_conversation(normalized_email, normalized_id)
        if existing:
            updates: dict[str, Any] = {"updated_at": utc_now_iso()}
            if lecture_label and compact_text(existing.get("lecture_label")) != lecture_label:
                updates["lecture_label"] = lecture_label
            if context_key and compact_text(existing.get("context_key")) != context_key:
                updates["context_key"] = context_key
            if metadata:
                merged_metadata = dict(existing.get("metadata_json") or {})
                merged_metadata.update(metadata)
                updates["metadata_json"] = merged_metadata
            if title and not compact_text(existing.get("title")):
                updates["title"] = title
            if len(updates) > 1:
                updated = self.update_conversation(
                    email=normalized_email,
                    conversation_id=normalized_id,
                    updates=updates,
                )
                return updated or existing
            return existing

        user_row = self.ensure_user(normalized_email)
        now = utc_now_iso()
        payload = {
            "id": normalized_id,
            "user_id": user_row["id"],
            "user_email": normalized_email,
            "title": compact_text(title),
            "lecture_label": compact_text(lecture_label),
            "context_key": compact_text(context_key),
            "preview_text": "",
            "last_message_preview": "",
            "memory_summary": "",
            "search_document": compact_text(title),
            "message_count": 0,
            "is_archived": False,
            "is_pinned": False,
            "metadata_json": metadata or {},
            "created_at": now,
            "updated_at": now,
            "last_message_at": now,
        }
        data, _ = self._request("POST", "conversations", json_body=payload)
        row = self._normalize_row(data)
        if not row:
            raise SupabaseChatHistoryError("Supabase did not return the saved conversation row.")
        return row

    def list_conversations(
        self,
        *,
        email: str,
        search: str = "",
        include_archived: bool = False,
        limit: int = 30,
        offset: int = 0,
    ) -> dict[str, Any]:
        normalized_email = compact_text(email).lower()
        search_query = compact_text(search)
        params: dict[str, Any] = {
            "select": "id,title,preview_text,last_message_preview,memory_summary,lecture_label,context_key,message_count,is_pinned,is_archived,metadata_json,last_message_at,created_at,updated_at",
            "user_email": f"eq.{normalized_email}",
            "order": "is_pinned.desc,updated_at.desc",
            "limit": str(max(1, min(limit, 100))),
            "offset": str(max(0, offset)),
        }
        if not include_archived:
            params["is_archived"] = "eq.false"
        if search_query:
            params["search_document"] = f"ilike.*{search_query.replace('*', ' ').replace('%', ' ')}*"

        data, response = self._request(
            "GET",
            "conversations",
            params=params,
            prefer="count=exact,return=representation",
        )
        items = data if isinstance(data, list) else []
        total = parse_content_range_total(response.headers.get("Content-Range", "")) or len(items)
        return {"items": items, "total": total}

    def get_messages(
        self,
        *,
        email: str,
        conversation_id: str,
        limit: int = 80,
        before: str = "",
    ) -> dict[str, Any]:
        normalized_email = compact_text(email).lower()
        normalized_id = compact_text(conversation_id)
        normalized_before = compact_text(before)
        params: dict[str, Any] = {
            "select": "id,conversation_id,role,content,timestamp,interaction_mode,provider,model,metadata_json",
            "conversation_id": f"eq.{normalized_id}",
            "user_email": f"eq.{normalized_email}",
            "order": "timestamp.desc,id.desc",
            "limit": str(max(1, min(limit, 120))),
        }
        if normalized_before:
            params["timestamp"] = f"lt.{normalized_before}"

        data, response = self._request(
            "GET",
            "messages",
            params=params,
            prefer="count=exact,return=representation",
        )
        descending_items = data if isinstance(data, list) else []
        total = parse_content_range_total(response.headers.get("Content-Range", "")) or len(descending_items)
        items = list(reversed(descending_items))
        next_before = compact_text(descending_items[-1].get("timestamp")) if descending_items else ""
        has_more = total > len(descending_items) and bool(descending_items)
        return {
            "items": items,
            "total": total,
            "has_more": has_more,
            "next_before": next_before,
        }

    def fetch_all_messages(self, *, email: str, conversation_id: str, batch_size: int = 200, max_messages: int = 2000) -> list[dict[str, Any]]:
        normalized_email = compact_text(email).lower()
        normalized_id = compact_text(conversation_id)
        offset = 0
        items: list[dict[str, Any]] = []
        while offset < max_messages:
            data, _ = self._request(
                "GET",
                "messages",
                params={
                    "select": "id,conversation_id,role,content,timestamp,interaction_mode,provider,model,metadata_json",
                    "conversation_id": f"eq.{normalized_id}",
                    "user_email": f"eq.{normalized_email}",
                    "order": "timestamp.asc,id.asc",
                    "limit": str(batch_size),
                    "offset": str(offset),
                },
                prefer="return=representation",
            )
            chunk = data if isinstance(data, list) else []
            if not chunk:
                break
            items.extend(chunk)
            if len(chunk) < batch_size:
                break
            offset += batch_size
        return items[:max_messages]

    def insert_messages(self, *, email: str, conversation_id: str, messages: list[dict[str, Any]]) -> None:
        normalized_email = compact_text(email).lower()
        normalized_id = compact_text(conversation_id)
        prepared = []
        for message in messages:
            message_id = compact_text(message.get("id"))
            role = compact_text(message.get("role")).lower()
            content = compact_text(message.get("content"))
            if not message_id or role not in {"user", "assistant"} or not content:
                continue
            prepared.append(
                {
                    "id": message_id,
                    "conversation_id": normalized_id,
                    "user_email": normalized_email,
                    "role": role,
                    "content": content,
                    "interaction_mode": compact_text(message.get("interaction_mode"), "text"),
                    "provider": compact_text(message.get("provider")),
                    "model": compact_text(message.get("model")),
                    "timestamp": compact_text(message.get("timestamp"), utc_now_iso()),
                    "metadata_json": message.get("metadata_json") or {},
                }
            )
        if not prepared:
            return
        self._request(
            "POST",
            "messages",
            params={"on_conflict": "id"},
            json_body=prepared,
            prefer="resolution=merge-duplicates,return=minimal",
        )

    def delete_last_assistant_message(self, *, email: str, conversation_id: str) -> None:
        normalized_email = compact_text(email).lower()
        normalized_id = compact_text(conversation_id)
        data, _ = self._request(
            "GET",
            "messages",
            params={
                "select": "id",
                "conversation_id": f"eq.{normalized_id}",
                "user_email": f"eq.{normalized_email}",
                "role": "eq.assistant",
                "order": "timestamp.desc,id.desc",
                "limit": "1",
            },
            prefer="return=representation",
        )
        row = self._normalize_row(data)
        message_id = compact_text((row or {}).get("id"))
        if not message_id:
            return
        self._request(
            "DELETE",
            "messages",
            params={
                "id": f"eq.{message_id}",
                "conversation_id": f"eq.{normalized_id}",
                "user_email": f"eq.{normalized_email}",
            },
            prefer="return=minimal",
        )

    def update_conversation(self, *, email: str, conversation_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        normalized_email = compact_text(email).lower()
        normalized_id = compact_text(conversation_id)
        payload = dict(updates or {})
        payload["updated_at"] = compact_text(payload.get("updated_at"), utc_now_iso())
        data, _ = self._request(
            "PATCH",
            "conversations",
            params={
                "id": f"eq.{normalized_id}",
                "user_email": f"eq.{normalized_email}",
            },
            json_body=payload,
        )
        return self._normalize_row(data)

    def delete_conversation(self, *, email: str, conversation_id: str) -> None:
        normalized_email = compact_text(email).lower()
        normalized_id = compact_text(conversation_id)
        self._request(
            "DELETE",
            "messages",
            params={
                "conversation_id": f"eq.{normalized_id}",
                "user_email": f"eq.{normalized_email}",
            },
            prefer="return=minimal",
        )
        self._request(
            "DELETE",
            "conversations",
            params={
                "id": f"eq.{normalized_id}",
                "user_email": f"eq.{normalized_email}",
            },
            prefer="return=minimal",
        )

    def build_memory_summary(self, messages: list[dict[str, Any]], existing_summary: str = "", *, keep_recent: int = 8, max_chars: int = 1500) -> str:
        older_messages = messages[:-keep_recent] if len(messages) > keep_recent else []
        lines: list[str] = []
        seen: set[str] = set()

        if compact_text(existing_summary):
            for raw_line in compact_text(existing_summary).splitlines():
                line = compact_text(raw_line)
                if line and line.lower() not in seen:
                    seen.add(line.lower())
                    lines.append(line)

        for message in older_messages[-18:]:
            role = compact_text(message.get("role")).lower()
            role_label = "Student" if role == "user" else "Assistant"
            content = shorten_text(message.get("content", ""), 180)
            if not content:
                continue
            line = f"- {role_label}: {content}"
            lowered = line.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            lines.append(line)

        if not lines:
            return ""

        summary = "Conversation memory summary:\n" + "\n".join(lines)
        return shorten_text(summary, max_chars)

    def refresh_conversation_state(
        self,
        *,
        email: str,
        conversation_id: str,
        title: str = "",
        lecture_label: str = "",
    ) -> dict[str, Any] | None:
        conversation = self.get_conversation(email, conversation_id)
        if not conversation:
            return None
        messages = self.fetch_all_messages(email=email, conversation_id=conversation_id, batch_size=200, max_messages=80)
        last_message = messages[-1] if messages else None
        preview_text = shorten_text((last_message or {}).get("content", ""), 220)
        memory_summary = self.build_memory_summary(messages, compact_text(conversation.get("memory_summary")))
        latest_snippets = " ".join(shorten_text(item.get("content", ""), 180) for item in messages[-12:])
        title_value = compact_text(title, compact_text(conversation.get("title")))
        lecture_value = compact_text(lecture_label, compact_text(conversation.get("lecture_label")))
        search_document = shorten_text(
            " ".join(part for part in [title_value, lecture_value, preview_text, memory_summary, latest_snippets] if compact_text(part)),
            6000,
        )
        return self.update_conversation(
            email=email,
            conversation_id=conversation_id,
            updates={
                "title": title_value,
                "lecture_label": lecture_value,
                "preview_text": preview_text,
                "last_message_preview": preview_text,
                "memory_summary": memory_summary,
                "search_document": search_document,
                "message_count": len(messages),
                "last_message_at": compact_text((last_message or {}).get("timestamp"), compact_text(conversation.get("last_message_at"), utc_now_iso())),
            },
        )

    def load_context_bundle(self, *, email: str, conversation_id: str, recent_limit: int = 8) -> dict[str, Any]:
        conversation = self.get_conversation(email, conversation_id)
        if not conversation:
            return {"conversation": None, "recent_messages": []}
        recent = self.get_messages(email=email, conversation_id=conversation_id, limit=recent_limit)
        return {
            "conversation": conversation,
            "recent_messages": recent["items"],
        }

    def export_conversation(self, *, email: str, conversation_id: str) -> dict[str, Any] | None:
        conversation = self.get_conversation(email, conversation_id)
        if not conversation:
            return None
        messages = self.fetch_all_messages(email=email, conversation_id=conversation_id)
        return {"conversation": conversation, "messages": messages}
