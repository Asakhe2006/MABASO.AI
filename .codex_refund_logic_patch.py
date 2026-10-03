from pathlib import Path

path = Path("backend/main.py")
text = path.read_text(encoding="utf-8")
anchor = 'def list_user_payment_history(email: str, limit: int = 12) -> list[dict[str, Any]]:\n'
if text.count(anchor) != 1:
    raise SystemExit(f"logic anchor count={text.count(anchor)}")

logic = r'''def get_refund_policy_config() -> RefundPolicyConfig:
    return RefundPolicyConfig.from_env()


def get_payfast_api_client() -> PayFastApiClient:
    return PayFastApiClient(
        merchant_id=PAYFAST_MERCHANT_ID,
        passphrase=PAYFAST_PASSPHRASE,
        sandbox=PAYFAST_SANDBOX,
        timeout_seconds=max(5, get_early_int_env("PAYFAST_API_TIMEOUT_SECONDS", 20)),
    )


def record_refund_audit(
    refund_request_id: str,
    payment_id: str,
    action: str,
    *,
    actor_email: str = "",
    actor_type: str = "system",
    metadata: dict[str, Any] | None = None,
    connection: Any | None = None,
) -> None:
    values = (
        uuid4().hex,
        compact_text(refund_request_id),
        compact_text(payment_id),
        normalize_email(actor_email) if compact_text(actor_email) else "",
        compact_text(actor_type, "system"),
        compact_text(action),
        json.dumps(metadata or {}, ensure_ascii=False),
        utc_now().isoformat(),
    )
    query = """
        INSERT INTO refund_audit_events (
            id, refund_request_id, payment_id, actor_email, actor_type,
            action, safe_metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    if connection is not None:
        connection.execute(query, values)
        return
    with get_db_connection() as owned_connection:
        owned_connection.execute(query, values)


def get_usage_snapshot_since_charge(email: str, paid_at: str) -> dict[str, Any]:
    normalized_email = normalize_email(email)
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT feature, quantity, metadata_json, created_at
            FROM billing_usage_events
            WHERE lower(email) = ? AND created_at >= ?
            ORDER BY created_at ASC
            """,
            (normalized_email, compact_text(paid_at)),
        ).fetchall()
    counts: dict[str, int] = {}
    estimated_cost = Decimal("0.00")
    for row in rows:
        feature = normalize_billing_plan_id(row["feature"])
        counts[feature] = counts.get(feature, 0) + max(0, int(row["quantity"] or 0))
        try:
            metadata = json.loads(compact_text(row["metadata_json"], "{}"))
        except json.JSONDecodeError:
            metadata = {}
        if isinstance(metadata, dict):
            for key in ("estimated_ai_cost_zar", "estimated_cost_zar", "cost_zar"):
                if metadata.get(key) is not None:
                    estimated_cost += refund_money(metadata.get(key))
                    break
    total_events = sum(counts.values())
    return {
        "from_charge_at": compact_text(paid_at),
        "captured_at": utc_now().isoformat(),
        "features": counts,
        "chats": int(counts.get("ai_chat", 0) + counts.get("study_chat", 0)),
        "reports": int(counts.get("report", 0)),
        "study_guides": int(counts.get("study_guide", 0)),
        "flashcards": int(counts.get("flashcards", 0)),
        "exams": int(counts.get("quiz", 0) + counts.get("practice_test", 0)),
        "powerpoints": int(counts.get("presentation", 0)),
        "podcasts": int(counts.get("podcast", 0)),
        "transcriptions": int(counts.get("transcription", 0) + counts.get("video", 0)),
        "total_paid_feature_events": total_events,
        "estimated_ai_cost_since_charge": f"{estimated_cost:.2f}",
    }


def serialize_refund_request(row: Any) -> dict[str, Any]:
    if not row:
        return {}
    try:
        usage_snapshot = json.loads(compact_text(row["usage_snapshot_json"], "{}"))
    except json.JSONDecodeError:
        usage_snapshot = {}
    return {
        "id": row["id"],
        "payment_id": row["payment_id"],
        "pf_payment_id": row["pf_payment_id"],
        "email": row["email"],
        "original_amount": row["original_amount"],
        "requested_amount": row["requested_amount"],
        "approved_amount": row["approved_amount"],
        "currency": row["currency"],
        "billing_country_at_purchase": row["billing_country_at_purchase"] or "unknown",
        "reason_code": row["reason_code"],
        "reason_text": row["reason_text"],
        "status": row["status"],
        "eligibility_window_days": int(row["eligibility_window_days"] or 0),
        "policy_type": row["policy_type"],
        "eligibility_reason": row["eligibility_reason"],
        "requested_at": row["requested_at"],
        "approved_at": row["approved_at"],
        "rejected_at": row["rejected_at"],
        "processed_at": row["processed_at"],
        "completed_at": row["completed_at"],
        "provider_refund_reference": row["provider_refund_reference"],
        "provider_status": row["provider_status"],
        "provider_error": row["provider_error"],
        "usage_snapshot": usage_snapshot,
        "estimated_ai_cost_since_charge": row["estimated_ai_cost_since_charge"],
        "automatic_or_manual": row["automatic_or_manual"],
        "admin_user_id": row["admin_user_id"],
        "admin_note": row["admin_note"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_refund_requests_for_user(email: str) -> list[dict[str, Any]]:
    with get_db_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM refund_requests WHERE lower(email) = ? ORDER BY created_at DESC LIMIT 50",
            (normalize_email(email),),
        ).fetchall()
    return [serialize_refund_request(row) for row in rows]


def get_payment_refund_summary(payment_row: Any, *, now: datetime | None = None) -> dict[str, Any]:
    if not payment_row:
        return {"eligible": False, "status": "unavailable", "reason": "payment_not_found"}
    usage_snapshot = get_usage_snapshot_since_charge(payment_row["email"], payment_row["paid_at"])
    try:
        eligibility = evaluate_refund_eligibility(
            payment_status=payment_row["payment_status"],
            paid_at=payment_row["paid_at"],
            billing_country_at_purchase=payment_row["billing_country_at_purchase"],
            original_amount=payment_row["amount_zar"],
            refunded_amount=payment_row["refunded_amount_zar"],
            chargeback_status=payment_row["chargeback_status"],
            reason_code="accidental_purchase",
            usage_snapshot=usage_snapshot,
            now=now,
            config=get_refund_policy_config(),
        )
    except ValueError:
        eligibility = {"eligible": False, "status": "unavailable", "reason": "policy_error"}
    with get_db_connection() as connection:
        active = connection.execute(
            """
            SELECT id, status FROM refund_requests
            WHERE payment_id = ? AND status NOT IN ('rejected', 'failed', 'cancelled', 'refunded')
            ORDER BY created_at DESC LIMIT 1
            """,
            (payment_row["id"],),
        ).fetchone()
    if active:
        eligibility = {**eligibility, "eligible": False, "status": active["status"], "reason": "refund_request_exists", "refund_request_id": active["id"]}
    return eligibility


'''
text = text.replace(anchor, logic + anchor, 1)
path.write_text(text, encoding="utf-8", newline="")
