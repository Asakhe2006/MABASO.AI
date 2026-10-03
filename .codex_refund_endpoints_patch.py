from pathlib import Path

path = Path("backend/main.py")
text = path.read_text(encoding="utf-8")
text = text.replace(
    'class RefundAdminDecision(BaseModel):\n    admin_note: str = ""',
    'class RefundAdminDecision(BaseModel):\n    admin_note: str = ""\n    bank_details: dict[str, str] = {}',
    1,
)
anchor = '@app.post("/api/billing/trial/start")\n'
if text.count(anchor) != 1:
    raise SystemExit(f"endpoint anchor count={text.count(anchor)}")

endpoints = r'''def send_refund_status_email(email: str, refund: dict[str, Any], status_message: str) -> None:
    settings = get_transactional_email_settings()
    message = EmailMessage()
    message["Subject"] = f"Mabaso AI refund update: {status_message}"
    message["From"] = settings["from_email"]
    message["To"] = email
    message.set_content(
        "Hello,\n\n"
        f"Your Mabaso AI refund request for payment {compact_text(refund.get('payment_id'))} is now: {status_message}.\n\n"
        f"Amount requested: R{compact_text(refund.get('requested_amount'), '0.00')}\n"
        f"Status: {compact_text(refund.get('status'), 'unknown')}\n\n"
        "Your chats, saved materials, documents, and account are not deleted by a cancellation or refund.\n\n"
        "Mabaso AI"
    )
    send_transactional_message(message)


async def deliver_refund_status_email(email: str, refund: dict[str, Any], status_message: str) -> None:
    try:
        await asyncio.to_thread(send_refund_status_email, email, refund, status_message)
    except Exception as exc:
        logger.warning("Refund status email failed request=%s error=%s", compact_text(refund.get("id")), safe_email_delivery_error(exc))


def _extract_payfast_refund_query(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    data = payload.get("data")
    if isinstance(data, dict):
        response = data.get("response")
        if isinstance(response, dict):
            return response
        return data
    return payload


def _load_refund_request(refund_id: str, *, connection: Any | None = None) -> Any:
    query = "SELECT * FROM refund_requests WHERE id = ?"
    if connection is not None:
        return connection.execute(query, (compact_text(refund_id),)).fetchone()
    with get_db_connection() as owned_connection:
        return owned_connection.execute(query, (compact_text(refund_id),)).fetchone()


@app.get("/billing/refund-policy")
def get_refund_policy(
    payment_id: str = Query(default=""),
    current_user: str = Depends(require_authenticated_user),
):
    config = get_refund_policy_config()
    base = {
        "za_window_days": config.za_window_days,
        "default_window_days": config.default_window_days,
        "country_overrides": config.country_overrides,
        "za_policy_type": "company_goodwill_policy",
        "legal_notice": "Applicable mandatory consumer rights can override Mabaso AI's goodwill window.",
    }
    if not compact_text(payment_id):
        return base
    with get_db_connection() as connection:
        payment = connection.execute(
            "SELECT * FROM billing_payments WHERE id = ? AND lower(email) = ?",
            (compact_text(payment_id), normalize_email(current_user)),
        ).fetchone()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found.")
    return {**base, "payment": get_payment_refund_summary(payment)}


@app.get("/billing/payments")
def get_customer_payments(current_user: str = Depends(require_authenticated_user)):
    return {"payments": list_user_payment_history(current_user, limit=50)}


@app.get("/billing/refund-requests/me")
def get_customer_refund_requests(current_user: str = Depends(require_authenticated_user)):
    return {"refund_requests": list_refund_requests_for_user(current_user)}


@app.post("/billing/refund-requests")
def create_customer_refund_request(
    payload: RefundRequestCreate,
    background_tasks: BackgroundTasks,
    current_user: str = Depends(require_authenticated_user),
):
    email = normalize_email(current_user)
    payment_id = compact_text(payload.payment_id)
    reason_code = compact_text(payload.reason_code).lower()
    if reason_code not in REFUND_REASON_CODES:
        raise HTTPException(status_code=400, detail="Select a valid refund reason.")
    reason_text = compact_text(payload.reason_text)[:1000]
    with get_db_connection() as connection:
        payment = connection.execute(
            "SELECT * FROM billing_payments WHERE id = ? AND lower(email) = ?",
            (payment_id, email),
        ).fetchone()
        user = connection.execute("SELECT user_id FROM users WHERE lower(email) = ?", (email,)).fetchone()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found.")
    usage_snapshot = get_usage_snapshot_since_charge(email, payment["paid_at"])
    try:
        eligibility = evaluate_refund_eligibility(
            payment_status=payment["payment_status"],
            paid_at=payment["paid_at"],
            billing_country_at_purchase=payment["billing_country_at_purchase"],
            original_amount=payment["amount_zar"],
            refunded_amount=payment["refunded_amount_zar"],
            chargeback_status=payment["chargeback_status"],
            reason_code=reason_code,
            usage_snapshot=usage_snapshot,
            config=get_refund_policy_config(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    remaining = compact_text(eligibility.get("remaining_refundable_amount"), "0.00")
    now_iso = utc_now().isoformat()
    refund_id = uuid4().hex
    idempotency_key = hashlib.sha256(f"refund:{email}:{payment_id}".encode("utf-8")).hexdigest()
    with get_db_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        existing = connection.execute("SELECT * FROM refund_requests WHERE idempotency_key = ?", (idempotency_key,)).fetchone()
        if existing:
            serialized = serialize_refund_request(existing)
            return {"message": "This payment already has a refund request.", "refund_request": serialized, "idempotent": True}
        subscription = connection.execute(
            "SELECT provider_token FROM billing_subscriptions WHERE lower(email) = ?",
            (email,),
        ).fetchone()
        connection.execute(
            """
            INSERT INTO refund_requests (
                id, user_id, email, payment_id, pf_payment_id, subscription_id, provider_token,
                original_amount, requested_amount, approved_amount, currency,
                billing_country_at_purchase, reason_code, reason_text, status,
                eligibility_window_days, policy_type, eligibility_reason, requested_at,
                usage_snapshot_json, estimated_ai_cost_since_charge, automatic_or_manual,
                idempotency_key, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                refund_id,
                compact_text(user["user_id"] if user else ""),
                email,
                payment_id,
                compact_text(payment["provider_payment_id"]),
                compact_text(payment["checkout_session_id"]),
                compact_text(subscription["provider_token"] if subscription else ""),
                compact_text(payment["amount_zar"], "0.00"),
                remaining,
                "0.00",
                compact_text(payment["currency"], "ZAR"),
                normalize_billing_country(payment["billing_country_at_purchase"]),
                reason_code,
                reason_text,
                eligibility["status"],
                int(eligibility.get("eligibility_window_days") or 0),
                compact_text(eligibility.get("policy_type"), "company_goodwill_policy"),
                compact_text(eligibility.get("reason")),
                now_iso,
                json.dumps(usage_snapshot, ensure_ascii=False),
                compact_text(usage_snapshot.get("estimated_ai_cost_since_charge"), "0.00"),
                compact_text(eligibility.get("automatic_or_manual"), "manual"),
                idempotency_key,
                now_iso,
                now_iso,
            ),
        )
        record_refund_audit(
            refund_id,
            payment_id,
            "refund.requested",
            actor_email=email,
            actor_type="customer",
            metadata={"status": eligibility["status"], "reason_code": reason_code},
            connection=connection,
        )
        created = _load_refund_request(refund_id, connection=connection)
    serialized = serialize_refund_request(created)
    background_tasks.add_task(deliver_refund_status_email, email, serialized, "request received")
    return {"message": "Refund request received.", "refund_request": serialized, "idempotent": False}


@app.post("/billing/subscription/cancel")
def cancel_customer_subscription(
    payload: SubscriptionCancelRequest,
    background_tasks: BackgroundTasks,
    current_user: str = Depends(require_authenticated_user),
):
    email = normalize_email(current_user)
    with get_db_connection() as connection:
        subscription = connection.execute("SELECT * FROM billing_subscriptions WHERE lower(email) = ?", (email,)).fetchone()
    if not subscription or compact_text(subscription["status"]).lower() != "active":
        raise HTTPException(status_code=409, detail="There is no active paid subscription to cancel.")
    token = compact_text(subscription["provider_token"])
    if compact_text(subscription["provider"]).lower() == "payfast":
        if not token:
            raise HTTPException(status_code=409, detail="The PayFast subscription token is missing. Support has been notified.")
        try:
            provider_result = get_payfast_api_client().cancel_subscription(token)
        except PayFastApiError as exc:
            logger.warning("PayFast cancellation failed email=%s error=%s", email, str(exc))
            raise HTTPException(status_code=exc.status_code, detail="PayFast could not cancel the recurring subscription. No cancellation was recorded; please retry or contact support.") from exc
    else:
        provider_result = {"status": "not_recurring", "data": {"response": True}}
    now_iso = utc_now().isoformat()
    cancel_at = compact_text(subscription["current_period_end"], now_iso)
    with get_db_connection() as connection:
        connection.execute(
            "UPDATE billing_subscriptions SET status = 'cancel_at_period_end', cancel_at = ?, updated_at = ? WHERE lower(email) = ?",
            (cancel_at, now_iso, email),
        )
        connection.execute(
            "INSERT INTO billing_events (id, email, checkout_session_id, provider, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (uuid4().hex, email, "", compact_text(subscription["provider"], "system"), "SUBSCRIPTION_CANCELLED", json.dumps({"cancel_at": cancel_at, "reason": compact_text(payload.reason)[:300], "provider_status": compact_text(provider_result.get("status"))}, ensure_ascii=False), now_iso),
        )
    return {"message": "Future recurring charges are cancelled. Paid access remains available until the end of the paid period.", "cancel_at": cancel_at}


@app.get("/admin/refunds")
def list_admin_refunds(
    status: str = Query(default=""),
    current_admin: str = Depends(require_admin_user),
):
    normalized_status = compact_text(status).lower()
    with get_db_connection() as connection:
        if normalized_status:
            rows = connection.execute("SELECT * FROM refund_requests WHERE status = ? ORDER BY created_at DESC LIMIT 200", (normalized_status,)).fetchall()
        else:
            rows = connection.execute("SELECT * FROM refund_requests ORDER BY created_at DESC LIMIT 200").fetchall()
    return {"refunds": [serialize_refund_request(row) for row in rows]}


@app.post("/admin/refunds/{refund_id}/reject")
def reject_admin_refund(
    refund_id: str,
    payload: RefundAdminDecision,
    background_tasks: BackgroundTasks,
    current_admin: str = Depends(require_admin_user),
):
    now_iso = utc_now().isoformat()
    with get_db_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = _load_refund_request(refund_id, connection=connection)
        if not row:
            raise HTTPException(status_code=404, detail="Refund request not found.")
        if compact_text(row["status"]).lower() in {"processing", "provider_accepted", "refunded"}:
            raise HTTPException(status_code=409, detail="This refund can no longer be rejected.")
        connection.execute(
            "UPDATE refund_requests SET status = 'rejected', rejected_at = ?, admin_user_id = ?, admin_note = ?, updated_at = ? WHERE id = ?",
            (now_iso, normalize_email(current_admin), compact_text(payload.admin_note)[:1000], now_iso, refund_id),
        )
        record_refund_audit(refund_id, row["payment_id"], "refund.rejected", actor_email=current_admin, actor_type="admin", metadata={"note_present": bool(compact_text(payload.admin_note))}, connection=connection)
        updated = _load_refund_request(refund_id, connection=connection)
    serialized = serialize_refund_request(updated)
    background_tasks.add_task(deliver_refund_status_email, serialized["email"], serialized, "rejected")
    return {"message": "Refund request rejected.", "refund_request": serialized}


@app.post("/admin/refunds/{refund_id}/approve")
def approve_admin_refund(
    refund_id: str,
    payload: RefundAdminDecision,
    background_tasks: BackgroundTasks,
    current_admin: str = Depends(require_admin_user),
):
    admin_email = normalize_email(current_admin)
    now_iso = utc_now().isoformat()
    with get_db_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = _load_refund_request(refund_id, connection=connection)
        if not row:
            raise HTTPException(status_code=404, detail="Refund request not found.")
        current_status = compact_text(row["status"]).lower()
        if current_status in {"processing", "provider_accepted", "refunded"}:
            return {"message": "This refund is already being processed.", "refund_request": serialize_refund_request(row), "idempotent": True}
        if current_status in {"rejected", "cancelled", "failed"}:
            raise HTTPException(status_code=409, detail=f"This refund request is {current_status}.")
        cursor = connection.execute(
            "UPDATE refund_requests SET status = 'processing', approved_at = ?, processed_at = ?, approved_amount = requested_amount, admin_user_id = ?, admin_note = ?, updated_at = ? WHERE id = ? AND status = ?",
            (now_iso, now_iso, admin_email, compact_text(payload.admin_note)[:1000], now_iso, refund_id, current_status),
        )
        if int(cursor.rowcount or 0) != 1:
            raise HTTPException(status_code=409, detail="Another administrator is already processing this refund.")
        payment = connection.execute("SELECT * FROM billing_payments WHERE id = ? AND lower(email) = ?", (row["payment_id"], normalize_email(row["email"]))).fetchone()
        subscription = connection.execute("SELECT * FROM billing_subscriptions WHERE lower(email) = ?", (normalize_email(row["email"]),)).fetchone()
        record_refund_audit(refund_id, row["payment_id"], "refund.approved", actor_email=admin_email, actor_type="admin", metadata={}, connection=connection)
    if not payment:
        raise HTTPException(status_code=404, detail="The original payment no longer exists.")
    payment_id = compact_text(payment["provider_payment_id"])
    if not payment_id:
        with get_db_connection() as connection:
            connection.execute("UPDATE refund_requests SET status = 'manual_review', provider_error = ?, updated_at = ? WHERE id = ?", ("PayFast payment ID missing", utc_now().isoformat(), refund_id))
        raise HTTPException(status_code=409, detail="This payment requires manual review because its PayFast transaction ID is missing.")
    client = get_payfast_api_client()
    try:
        query_payload = client.query_refund(payment_id)
        query = _extract_payfast_refund_query(query_payload)
        available_cents = max(0, int(query.get("amount_available_for_refund") or 0))
        requested_cents = int(refund_money(row["requested_amount"]) * 100)
        if compact_text(query.get("status")).upper() != "REFUNDABLE" or available_cents <= 0:
            raise PayFastApiError("PayFast reports that this payment is not refundable.", status_code=409, safe_payload=query)
        amount_cents = min(requested_cents, available_cents)
        is_full_refund = amount_cents >= int(refund_money(payment["amount_zar"]) * 100)
        refund_method = compact_text((query.get("refund_full") if is_full_refund else query.get("refund_partial") or {}).get("method")).upper()
        if refund_method == "BANK_PAYOUT" and not payload.bank_details:
            with get_db_connection() as connection:
                connection.execute("UPDATE refund_requests SET status = 'manual_review', provider_status = 'bank_details_required', provider_response_json = ?, updated_at = ? WHERE id = ?", (json.dumps({"status": query.get("status"), "refund_method": refund_method}, ensure_ascii=False), utc_now().isoformat(), refund_id))
                record_refund_audit(refund_id, row["payment_id"], "refund.bank_details_required", actor_email=admin_email, actor_type="admin", metadata={"refund_method": refund_method}, connection=connection)
            raise HTTPException(status_code=409, detail="PayFast requires bank payout details for this refund. Collect only the fields shown in the PayFast refund query, then approve again.")
        if is_full_refund and subscription and compact_text(subscription["status"]).lower() in {"active", "cancel_at_period_end"} and compact_text(subscription["provider"]).lower() == "payfast":
            token = compact_text(subscription["provider_token"])
            if token:
                client.cancel_subscription(token)
        provider_payload = client.create_refund(
            payment_id,
            amount_cents=amount_cents,
            reason=compact_text(row["reason_text"], row["reason_code"]),
            bank_details=payload.bank_details,
        )
    except PayFastApiError as exc:
        logger.warning("PayFast refund failed request=%s error=%s", refund_id, str(exc))
        with get_db_connection() as connection:
            connection.execute("UPDATE refund_requests SET status = 'failed', provider_status = 'failed', provider_error = ?, provider_response_json = ?, updated_at = ? WHERE id = ?", (str(exc)[:300], json.dumps(exc.safe_payload, ensure_ascii=False), utc_now().isoformat(), refund_id))
            record_refund_audit(refund_id, row["payment_id"], "refund.provider_failed", actor_email=admin_email, actor_type="admin", metadata={"error": str(exc)[:200]}, connection=connection)
        raise HTTPException(status_code=exc.status_code, detail=f"PayFast refund failed: {str(exc)}") from exc
    provider_data = _extract_payfast_refund_query(provider_payload)
    provider_reference = compact_text(provider_data.get("refund_id") or provider_data.get("reference") or payment_id)
    with get_db_connection() as connection:
        connection.execute(
            "UPDATE refund_requests SET status = 'provider_accepted', provider_status = 'accepted', provider_refund_reference = ?, provider_response_json = ?, provider_error = '', updated_at = ? WHERE id = ?",
            (provider_reference, json.dumps(provider_payload, ensure_ascii=False), utc_now().isoformat(), refund_id),
        )
        record_refund_audit(refund_id, row["payment_id"], "refund.provider_accepted", actor_email=admin_email, actor_type="admin", metadata={"provider_reference": provider_reference}, connection=connection)
        updated = _load_refund_request(refund_id, connection=connection)
    serialized = serialize_refund_request(updated)
    background_tasks.add_task(deliver_refund_status_email, serialized["email"], serialized, "submitted to PayFast")
    return {"message": "Refund submitted to PayFast. Completion will be confirmed separately.", "refund_request": serialized}


@app.post("/admin/refunds/{refund_id}/refresh")
def refresh_admin_refund(
    refund_id: str,
    background_tasks: BackgroundTasks,
    current_admin: str = Depends(require_admin_user),
):
    row = _load_refund_request(refund_id)
    if not row:
        raise HTTPException(status_code=404, detail="Refund request not found.")
    if compact_text(row["status"]).lower() == "refunded":
        return {"message": "Refund already completed.", "refund_request": serialize_refund_request(row), "idempotent": True}
    payment_id = compact_text(row["pf_payment_id"])
    if not payment_id:
        raise HTTPException(status_code=409, detail="PayFast payment ID is missing.")
    try:
        query_payload = get_payfast_api_client().query_refund(payment_id)
    except PayFastApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=f"Could not refresh PayFast refund status: {str(exc)}") from exc
    query = _extract_payfast_refund_query(query_payload)
    status = compact_text(query.get("status")).upper()
    completed = status == "COMPLETED" or int(query.get("amount_available_for_refund") or 0) == 0
    now_iso = utc_now().isoformat()
    with get_db_connection() as connection:
        if completed:
            connection.execute("UPDATE refund_requests SET status = 'refunded', provider_status = 'completed', completed_at = ?, provider_response_json = ?, updated_at = ? WHERE id = ?", (now_iso, json.dumps(query_payload, ensure_ascii=False), now_iso, refund_id))
            connection.execute("UPDATE billing_payments SET refunded_amount_zar = ?, provider_refund_status = 'refunded', updated_at = ? WHERE id = ?", (row["approved_amount"], now_iso, row["payment_id"]))
            subscription = connection.execute("SELECT provider_payment_id FROM billing_subscriptions WHERE lower(email) = ?", (normalize_email(row["email"]),)).fetchone()
            if subscription and compact_text(subscription["provider_payment_id"]) == payment_id:
                connection.execute("UPDATE billing_subscriptions SET status = 'refunded', cancel_at = ?, updated_at = ? WHERE lower(email) = ?", (now_iso, now_iso, normalize_email(row["email"])))
            record_refund_audit(refund_id, row["payment_id"], "refund.completed", actor_email=current_admin, actor_type="admin", metadata={}, connection=connection)
        else:
            connection.execute("UPDATE refund_requests SET provider_status = ?, provider_response_json = ?, updated_at = ? WHERE id = ?", (compact_text(query.get("status"), "pending").lower(), json.dumps(query_payload, ensure_ascii=False), now_iso, refund_id))
        updated = _load_refund_request(refund_id, connection=connection)
    serialized = serialize_refund_request(updated)
    if completed:
        sync_user_account_snapshot(serialized["email"])
        background_tasks.add_task(deliver_refund_status_email, serialized["email"], serialized, "completed")
    return {"message": "Refund completed." if completed else "Refund is still being processed by PayFast.", "refund_request": serialized}


'''
text = text.replace(anchor, endpoints + anchor, 1)
path.write_text(text, encoding="utf-8", newline="")
