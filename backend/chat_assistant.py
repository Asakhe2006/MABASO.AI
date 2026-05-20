from __future__ import annotations

import json
import os
from typing import Any, Iterator

import requests


TEXT_CHAT_PROVIDER_ORDER = ("openai",)
VOICE_CHAT_PROVIDER_ORDER = ("gemini", "groq")
SUPPORTED_CHAT_PROVIDERS = ("openai", "gemini", "groq", "openrouter")


class ProviderStreamError(Exception):
    def __init__(
        self,
        provider: str,
        user_message: str,
        *,
        status_code: int = 502,
        retryable: bool = True,
    ) -> None:
        super().__init__(user_message)
        self.provider = provider
        self.user_message = user_message
        self.status_code = status_code
        self.retryable = retryable


def compact_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").replace("\x00", " ").strip()
    return text or fallback


def format_provider_name(provider: str) -> str:
    normalized = compact_text(provider).lower()
    return {
        "openai": "OpenAI",
        "gemini": "Gemini",
        "groq": "Groq",
        "openrouter": "OpenRouter",
    }.get(normalized, normalized.title() or "Provider")


def resolve_provider_attempts(forced_provider: str = "", *, voice_mode: bool = False) -> list[dict[str, str]]:
    normalized_forced = compact_text(forced_provider).lower()
    if normalized_forced in SUPPORTED_CHAT_PROVIDERS:
        ordered_names = [normalized_forced]
    else:
        ordered_names = list(VOICE_CHAT_PROVIDER_ORDER if voice_mode else TEXT_CHAT_PROVIDER_ORDER)

    attempts: list[dict[str, str]] = []
    for provider in ordered_names:
        attempts.append(
            {
                "provider": provider,
                "label": format_provider_name(provider),
                "model": resolve_provider_model(provider, voice_mode=voice_mode),
            }
        )
    return attempts


def resolve_provider_model(provider: str, *, voice_mode: bool = False) -> str:
    normalized = compact_text(provider).lower()
    if normalized == "openai":
        return compact_text(os.getenv("OPENAI_CHAT_MODEL"), "gpt-4.1-mini")
    if normalized == "gemini":
        if voice_mode:
            return compact_text(os.getenv("GEMINI_VOICE_CHAT_MODEL"), "gemini-2.5-flash")
        return compact_text(os.getenv("GEMINI_CHAT_MODEL"), "gemini-2.5-flash")
    if normalized == "groq":
        if voice_mode:
            return compact_text(os.getenv("GROQ_VOICE_CHAT_MODEL"), "llama-3.1-8b-instant")
        return compact_text(os.getenv("GROQ_CHAT_MODEL"), "llama-3.3-70b-versatile")
    if normalized == "openrouter":
        return compact_text(os.getenv("OPENROUTER_CHAT_MODEL"), "deepseek/deepseek-chat")
    return ""


def _resolve_provider_api_key(provider: str) -> str:
    normalized = compact_text(provider).lower()
    if normalized == "openai":
        return compact_text(os.getenv("OPENAI_API_KEY"))
    if normalized == "gemini":
        return compact_text(os.getenv("GEMINI_API_KEY"))
    if normalized == "groq":
        return compact_text(os.getenv("GROQ_API_KEY"))
    if normalized == "openrouter":
        return compact_text(os.getenv("OPENROUTER_API_KEY"))
    return ""


def _extract_json_error_message(payload: Any, fallback: str) -> str:
    if isinstance(payload, dict):
        error_payload = payload.get("error")
        if isinstance(error_payload, dict):
            for key in ("message", "status", "code"):
                value = compact_text(error_payload.get(key))
                if value:
                    return value
        for key in ("detail", "message", "error"):
            value = compact_text(payload.get(key))
            if value:
                return value
    return fallback


def _raise_for_response(provider: str, response: requests.Response, default_message: str) -> None:
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    fallback = compact_text(response.text, default_message)
    detail = _extract_json_error_message(payload, fallback)
    status_code = int(response.status_code or 502)
    label = format_provider_name(provider)
    if status_code == 429:
        detail = f"{label} is rate-limited right now."
    elif status_code in {401, 403}:
        detail = f"{label} rejected the backend API key."
    elif status_code >= 500:
        detail = f"{label} is temporarily unavailable right now."
    raise ProviderStreamError(
        provider,
        detail or default_message,
        status_code=status_code,
        retryable=status_code >= 500 or status_code == 429,
    )


def _extract_gemini_text(payload: Any) -> str:
    if not isinstance(payload, dict):
        return ""
    chunks: list[str] = []
    for candidate in payload.get("candidates") or []:
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content") or {}
        parts = content.get("parts") or []
        for part in parts:
            if not isinstance(part, dict):
                continue
            text = compact_text(part.get("text"))
            if text:
                chunks.append(text)
    return "".join(chunks)


def _convert_messages_to_gemini_contents(messages: list[dict[str, str]]) -> list[dict[str, Any]]:
    contents: list[dict[str, Any]] = []
    for message in messages:
        role = "model" if compact_text(message.get("role")).lower() == "assistant" else "user"
        text = compact_text(message.get("content"))
        if not text:
            continue
        contents.append({"role": role, "parts": [{"text": text}]})
    return contents


def iter_gemini_stream(
    *,
    system_prompt: str,
    messages: list[dict[str, str]],
    model: str = "",
    temperature: float = 0.55,
    max_output_tokens: int = 1200,
    timeout_seconds: float = 75,
) -> Iterator[str]:
    api_key = _resolve_provider_api_key("gemini")
    if not api_key:
        raise ProviderStreamError("gemini", "Gemini is not configured on the backend.")

    model = compact_text(model, resolve_provider_model("gemini"))
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"
    payload: dict[str, Any] = {
        "contents": _convert_messages_to_gemini_contents(messages),
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
        },
    }
    if compact_text(system_prompt):
        payload["system_instruction"] = {"parts": [{"text": compact_text(system_prompt)}]}

    try:
        with requests.post(
            url,
            headers={
                "x-goog-api-key": api_key,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=timeout_seconds,
            stream=True,
        ) as response:
            if not response.ok:
                _raise_for_response("gemini", response, "Gemini could not answer right now.")

            for raw_line in response.iter_lines(decode_unicode=True):
                line = compact_text(raw_line)
                if not line or line.startswith(":") or not line.startswith("data:"):
                    continue
                data = compact_text(line[5:])
                if not data or data == "[DONE]":
                    continue
                try:
                    chunk_payload = json.loads(data)
                except json.JSONDecodeError:
                    continue
                text = _extract_gemini_text(chunk_payload)
                if text:
                    yield text
    except requests.Timeout as exc:
        raise ProviderStreamError("gemini", "Gemini took too long to respond.") from exc
    except requests.RequestException as exc:
        raise ProviderStreamError("gemini", "The backend could not reach Gemini right now.") from exc


def _extract_openai_compatible_delta(payload: Any) -> str:
    if not isinstance(payload, dict):
        return ""
    choices = payload.get("choices") or []
    if not choices:
        return ""
    delta = choices[0].get("delta") or {}
    content = delta.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            text = compact_text(item.get("text"))
            if text:
                chunks.append(text)
        return "".join(chunks)
    return ""


def iter_openai_compatible_stream(
    *,
    provider: str,
    base_url: str,
    system_prompt: str,
    messages: list[dict[str, str]],
    model: str = "",
    temperature: float = 0.55,
    max_output_tokens: int = 1200,
    timeout_seconds: float = 75,
    extra_headers: dict[str, str] | None = None,
) -> Iterator[str]:
    api_key = _resolve_provider_api_key(provider)
    if not api_key:
        raise ProviderStreamError(provider, f"{format_provider_name(provider)} is not configured on the backend.")

    model = compact_text(model, resolve_provider_model(provider))
    request_messages = []
    if compact_text(system_prompt):
        request_messages.append({"role": "system", "content": compact_text(system_prompt)})
    for message in messages:
        role = "assistant" if compact_text(message.get("role")).lower() == "assistant" else "user"
        content = compact_text(message.get("content"))
        if content:
            request_messages.append({"role": role, "content": content})

    payload: dict[str, Any] = {
        "model": model,
        "messages": request_messages,
        "temperature": temperature,
        "stream": True,
    }
    if compact_text(provider).lower() in {"groq", "openai"}:
        payload["max_completion_tokens"] = max_output_tokens
    else:
        payload["max_tokens"] = max_output_tokens

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)

    try:
        with requests.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json=payload,
            timeout=timeout_seconds,
            stream=True,
        ) as response:
            if not response.ok:
                _raise_for_response(provider, response, f"{format_provider_name(provider)} could not answer right now.")

            for raw_line in response.iter_lines(decode_unicode=True):
                line = compact_text(raw_line)
                if not line or line.startswith(":") or not line.startswith("data:"):
                    continue
                data = compact_text(line[5:])
                if not data or data == "[DONE]":
                    continue
                try:
                    chunk_payload = json.loads(data)
                except json.JSONDecodeError:
                    continue
                text = _extract_openai_compatible_delta(chunk_payload)
                if text:
                    yield text
    except requests.Timeout as exc:
        raise ProviderStreamError(provider, f"{format_provider_name(provider)} took too long to respond.") from exc
    except requests.RequestException as exc:
        raise ProviderStreamError(provider, f"The backend could not reach {format_provider_name(provider)} right now.") from exc


def iter_provider_stream(
    provider: str,
    *,
    system_prompt: str,
    messages: list[dict[str, str]],
    model: str = "",
    temperature: float = 0.55,
    max_output_tokens: int = 1200,
    timeout_seconds: float = 75,
) -> Iterator[str]:
    normalized = compact_text(provider).lower()
    if normalized == "gemini":
        return iter_gemini_stream(
            system_prompt=system_prompt,
            messages=messages,
            model=model,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            timeout_seconds=timeout_seconds,
        )
    if normalized == "openai":
        return iter_openai_compatible_stream(
            provider="openai",
            base_url="https://api.openai.com/v1",
            system_prompt=system_prompt,
            messages=messages,
            model=model,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            timeout_seconds=timeout_seconds,
        )
    if normalized == "groq":
        return iter_openai_compatible_stream(
            provider="groq",
            base_url="https://api.groq.com/openai/v1",
            system_prompt=system_prompt,
            messages=messages,
            model=model,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            timeout_seconds=timeout_seconds,
        )
    if normalized == "openrouter":
        return iter_openai_compatible_stream(
            provider="openrouter",
            base_url="https://openrouter.ai/api/v1",
            system_prompt=system_prompt,
            messages=messages,
            model=model,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            timeout_seconds=timeout_seconds,
            extra_headers={
                "HTTP-Referer": compact_text(os.getenv("OPENROUTER_HTTP_REFERER"), "https://mabaso-ai-web.onrender.com"),
                "X-Title": compact_text(os.getenv("OPENROUTER_APP_TITLE"), "Mabaso AI Lecture Assistant"),
            },
        )
    raise ProviderStreamError(normalized, "No chat provider is configured for this request.", retryable=False)
