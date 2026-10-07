from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import quote_plus

import requests


REFUND_REASON_CODES = {
    "accidental_purchase",
    "accidental_renewal",
    "duplicate_charge",
    "incorrect_amount",
    "technical_problem",
    "subscription_not_working",
    "other",
}

MANUAL_REVIEW_REASONS = {"duplicate_charge", "incorrect_amount", "technical_problem", "subscription_not_working"}
SUCCESSFUL_PAYMENT_STATUSES = {"complete", "complete_payment", "paid", "success", "active"}
ACTIVE_REFUND_STATUSES = {
    "eligible",
    "auto_approved",
    "manual_review",
    "approved",
    "processing",
    "provider_accepted",
}


def _env_int(name: str, default: int, minimum: int = 0) -> int:
    try:
        return max(minimum, int(os.getenv(name, str(default)).strip()))
    except (TypeError, ValueError):
        return default


def _env_decimal(name: str, default: str) -> Decimal:
    try:
        return max(Decimal("0"), Decimal(os.getenv(name, default).strip()))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def normalize_country(value: Any) -> str:
    country = str(value or "").strip().upper()
    return country if len(country) == 2 and country.isalpha() else ""


def parse_utc(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def money(value: Any) -> Decimal:
    try:
        return max(Decimal("0"), Decimal(str(value or "0")).quantize(Decimal("0.01")))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")


@dataclass(frozen=True)
class RefundPolicyConfig:
    za_window_days: int
    default_window_days: int
    country_overrides: dict[str, int]
    light_usage_max_events: int
    light_usage_max_estimated_cost: Decimal
    auto_approve_enabled: bool

    @classmethod
    def from_env(cls) -> "RefundPolicyConfig":
        raw_overrides = os.getenv("REFUND_COUNTRY_POLICY_JSON", "{}").strip() or "{}"
        try:
            decoded = json.loads(raw_overrides)
        except (TypeError, ValueError):
            decoded = {}
        overrides: dict[str, int] = {}
        if isinstance(decoded, dict):
            for key, value in decoded.items():
                country = normalize_country(key)
                try:
                    days = max(0, int(value))
                except (TypeError, ValueError):
                    continue
                if country:
                    overrides[country] = days
        return cls(
            za_window_days=_env_int("REFUND_ZA_WINDOW_DAYS", 14, 1),
            default_window_days=_env_int("REFUND_DEFAULT_WINDOW_DAYS", 7, 1),
            country_overrides=overrides,
            light_usage_max_events=_env_int("REFUND_LIGHT_USAGE_MAX_EVENTS", 3, 0),
            light_usage_max_estimated_cost=_env_decimal("REFUND_LIGHT_USAGE_MAX_ESTIMATED_COST_ZAR", "10.00"),
            auto_approve_enabled=os.getenv("REFUND_AUTO_APPROVE_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"},
        )

    def window_for_country(self, country: str) -> tuple[int, str]:
        normalized = normalize_country(country)
        if normalized in self.country_overrides:
            return self.country_overrides[normalized], "statutory_or_configured_override"
        if normalized == "ZA":
            return self.za_window_days, "company_goodwill_policy"
        return self.default_window_days, "company_goodwill_policy"


def evaluate_refund_eligibility(
    *,
    payment_status: str,
    paid_at: str,
    billing_country_at_purchase: str,
    original_amount: Any,
    refunded_amount: Any,
    chargeback_status: str = "",
    reason_code: str,
    usage_snapshot: dict[str, Any] | None = None,
    now: datetime | None = None,
    config: RefundPolicyConfig | None = None,
) -> dict[str, Any]:
    policy = config or RefundPolicyConfig.from_env()
    normalized_reason = str(reason_code or "").strip().lower()
    if normalized_reason not in REFUND_REASON_CODES:
        raise ValueError("Unsupported refund reason.")
    charge_time = parse_utc(paid_at)
    current_time = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    country = normalize_country(billing_country_at_purchase)
    window_days, policy_type = policy.window_for_country(country)
    original = money(original_amount)
    refunded = min(original, money(refunded_amount))
    remaining = max(Decimal("0.00"), original - refunded)
    usage = usage_snapshot or {}
    usage_events = max(0, int(usage.get("total_paid_feature_events") or 0))
    estimated_cost = money(usage.get("estimated_ai_cost_since_charge") or 0)
    within_window = bool(charge_time and current_time <= charge_time + timedelta(days=window_days))
    days_since_payment = max(0, (current_time.date() - charge_time.date()).days) if charge_time else None

    result = {
        "eligible": False,
        "status": "manual_review",
        "reason": "manual_review_required",
        "billing_country_at_purchase": country or "unknown",
        "eligibility_window_days": window_days,
        "policy_type": policy_type,
        "within_window": within_window,
        "days_since_payment": days_since_payment,
        "remaining_refundable_amount": f"{remaining:.2f}",
        "automatic_or_manual": "manual",
    }
    if str(payment_status or "").strip().lower() not in SUCCESSFUL_PAYMENT_STATUSES:
        return {**result, "status": "rejected", "reason": "payment_not_successful"}
    if remaining <= 0:
        return {**result, "status": "rejected", "reason": "no_refundable_balance"}
    if str(chargeback_status or "").strip().lower() in {"active", "open", "pending", "disputed", "chargeback"}:
        return {**result, "status": "rejected", "reason": "active_chargeback_or_dispute"}
    if not charge_time:
        return {**result, "reason": "payment_date_requires_review"}
    if not country:
        return {**result, "reason": "billing_country_requires_review"}
    if not within_window and normalized_reason not in MANUAL_REVIEW_REASONS:
        return {**result, "status": "rejected", "reason": "goodwill_window_expired"}
    if not within_window:
        return {**result, "reason": "exception_or_consumer_right_review"}
    light_usage = usage_events <= policy.light_usage_max_events and estimated_cost <= policy.light_usage_max_estimated_cost
    if normalized_reason in MANUAL_REVIEW_REASONS or not light_usage:
        return {**result, "eligible": True, "status": "manual_review", "reason": "manual_review_required"}
    if policy.auto_approve_enabled:
        return {
            **result,
            "eligible": True,
            "status": "auto_approved",
            "reason": "inside_window_and_light_usage",
            "automatic_or_manual": "automatic",
        }
    return {**result, "eligible": True, "status": "eligible", "reason": "inside_window_and_light_usage"}


class PayFastApiError(RuntimeError):
    def __init__(self, message: str, *, status_code: int = 502, safe_payload: dict[str, Any] | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.safe_payload = safe_payload or {}


class PayFastApiClient:
    def __init__(self, *, merchant_id: str, passphrase: str, sandbox: bool = False, timeout_seconds: int = 20):
        self.merchant_id = str(merchant_id or "").strip()
        self.passphrase = str(passphrase or "").strip()
        self.sandbox = bool(sandbox)
        self.timeout_seconds = max(5, int(timeout_seconds))
        self.base_url = "https://api.payfast.co.za"

    @property
    def configured(self) -> bool:
        return bool(self.merchant_id and self.passphrase)

    def _timestamp(self) -> str:
        za_tz = timezone(timedelta(hours=2))
        return datetime.now(za_tz).replace(microsecond=0).isoformat()

    def _headers(self, body: dict[str, Any] | None = None, query: dict[str, Any] | None = None) -> dict[str, str]:
        timestamp = self._timestamp()
        signature_values: dict[str, Any] = {
            "merchant-id": self.merchant_id,
            "passphrase": self.passphrase,
            "timestamp": timestamp,
            "version": "v1",
        }
        for source in (body or {}, query or {}):
            for key, value in source.items():
                if key != "testing" and value not in (None, ""):
                    signature_values[key] = value
        parameter_string = "&".join(
            f"{key}={quote_plus(str(value).strip())}"
            for key, value in sorted(signature_values.items())
            if value not in (None, "")
        )
        return {
            "merchant-id": self.merchant_id,
            "version": "v1",
            "timestamp": timestamp,
            "signature": hashlib.md5(parameter_string.encode("utf-8")).hexdigest(),
            "Accept": "application/json",
        }

    def _request(self, method: str, path: str, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.configured:
            raise PayFastApiError("PayFast API credentials are not configured.", status_code=503)
        query = {"testing": "true"} if self.sandbox else {}
        try:
            response = requests.request(
                method,
                f"{self.base_url}{path}",
                params=query,
                json=body or None,
                headers={**self._headers(body=body, query=query), "Content-Type": "application/json"},
                timeout=self.timeout_seconds,
            )
        except requests.Timeout as exc:
            raise PayFastApiError("PayFast took too long to respond.", status_code=504) from exc
        except requests.RequestException as exc:
            raise PayFastApiError("Could not reach PayFast.", status_code=502) from exc
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        if not response.ok or (isinstance(payload, dict) and str(payload.get("status", "")).lower() == "failed"):
            safe_message = "PayFast rejected the request."
            if isinstance(payload, dict):
                data = payload.get("data") or {}
                safe_message = str(data.get("message") or payload.get("message") or safe_message)[:300]
            raise PayFastApiError(safe_message, status_code=response.status_code or 502, safe_payload=payload if isinstance(payload, dict) else {})
        return payload if isinstance(payload, dict) else {"data": payload}

    def query_refund(self, payment_id: str) -> dict[str, Any]:
        return self._request("GET", f"/refunds/query/{quote_plus(str(payment_id).strip())}")

    def create_refund(self, payment_id: str, *, amount_cents: int, reason: str, bank_details: dict[str, Any] | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {
            "amount": str(max(0, int(amount_cents))),
            "reason": str(reason or "Refund approved by Mabaso AI")[:255],
            "notify_buyer": True,
            "notify_merchant": False,
        }
        if bank_details:
            for key in ("bank_account_holder", "bank_name", "bank_branch_code", "bank_account_number", "bank_account_type"):
                if bank_details.get(key):
                    body[key] = str(bank_details[key]).strip()
        return self._request("POST", f"/refunds/{quote_plus(str(payment_id).strip())}", body=body)

    def cancel_subscription(self, token: str) -> dict[str, Any]:
        return self._request("PUT", f"/subscriptions/{quote_plus(str(token).strip())}/cancel")

    def fetch_subscription(self, token: str) -> dict[str, Any]:
        """Fetch an existing PayFast subscription using its server-side token only."""
        return self._request("GET", f"/subscriptions/{quote_plus(str(token).strip())}")
