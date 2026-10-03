from pathlib import Path

path = Path("backend/main.py")
text = path.read_text(encoding="utf-8")
changes = [
    (
        'PAYFAST_TRIAL_INITIAL_AMOUNT_ZAR = os.getenv("PAYFAST_TRIAL_INITIAL_AMOUNT_ZAR", "0.00").strip()',
        'PAYFAST_TRIAL_INITIAL_AMOUNT_ZAR = os.getenv("PAYFAST_TRIAL_INITIAL_AMOUNT_ZAR", "0.00").strip()\nFREE_TRIAL_DAYS = max(1, get_early_int_env("FREE_TRIAL_DAYS", 7))\nFREE_TRIAL_PLAN_ID = os.getenv("FREE_TRIAL_PLAN_ID", "pro_student").strip() or "pro_student"',
    ),
    (
        '            "subscription_end_at": "TEXT NOT NULL DEFAULT \'\'",\n            "usage_reset_at":',
        '            "subscription_end_at": "TEXT NOT NULL DEFAULT \'\'",\n            "trial_status": "TEXT NOT NULL DEFAULT \'eligible\'",\n            "trial_started_at": "TEXT NOT NULL DEFAULT \'\'",\n            "trial_ends_at": "TEXT NOT NULL DEFAULT \'\'",\n            "trial_used_at": "TEXT NOT NULL DEFAULT \'\'",\n            "billing_country": "TEXT NOT NULL DEFAULT \'\'",\n            "usage_reset_at":',
    ),
    (
        'def get_effective_plan_id(email: str) -> str:\n    if is_admin_email(email):\n        return "premium_student"\n    row = get_active_subscription_row(email)\n    if not row:\n        return "free"\n    plan_id = normalize_billing_plan_id(row["plan_id"])\n    return get_billing_quota_plan_id(plan_id)',
        '''def resolve_entitlement(email: str, *, now: datetime | None = None) -> dict[str, Any]:
    """Single authoritative paid/trial/free access decision."""
    normalized_email = normalize_email(email)
    resolved_now = now or utc_now()
    if is_admin_email(normalized_email):
        return {
            "entitlement": "expert", "plan_id": "premium_student", "access_level": "premium_student",
            "trial_active": False, "trial_started_at": "", "trial_ends_at": "",
            "subscription_active": True, "subscription_status": "active", "quota_profile": "premium_student",
            "reason": "admin_protected_access",
        }
    paid = get_active_subscription_row(normalized_email)
    if paid:
        plan_id = get_billing_quota_plan_id(normalize_billing_plan_id(paid["plan_id"]))
        return {
            "entitlement": "expert" if plan_id == "premium_student" else "pro",
            "plan_id": plan_id, "access_level": plan_id, "trial_active": False,
            "trial_started_at": "", "trial_ends_at": "", "subscription_active": True,
            "subscription_status": compact_text(paid["status"], "active"), "quota_profile": plan_id,
            "reason": "active_paid_subscription",
        }
    with get_db_connection() as connection:
        trial = connection.execute(
            "SELECT trial_status, trial_started_at, trial_ends_at, trial_used_at FROM users WHERE lower(email) = ?",
            (normalized_email,),
        ).fetchone()
    trial_ends = parse_billing_datetime(trial["trial_ends_at"]) if trial else None
    trial_active = bool(trial and compact_text(trial["trial_status"]).lower() == "active" and trial_ends and trial_ends > resolved_now)
    if trial_active:
        plan_id = get_billing_quota_plan_id(FREE_TRIAL_PLAN_ID)
        return {
            "entitlement": "trial", "plan_id": plan_id, "access_level": plan_id,
            "trial_active": True, "trial_started_at": compact_text(trial["trial_started_at"]),
            "trial_ends_at": compact_text(trial["trial_ends_at"]), "subscription_active": False,
            "subscription_status": "trialing", "quota_profile": plan_id, "reason": "active_no_card_trial",
        }
    if trial and compact_text(trial["trial_status"]).lower() == "active" and trial_ends and trial_ends <= resolved_now:
        with get_db_connection() as connection:
            connection.execute(
                "UPDATE users SET trial_status = 'expired', updated_at = ? WHERE lower(email) = ? AND trial_status = 'active'",
                (resolved_now.isoformat(), normalized_email),
            )
    return {
        "entitlement": "free", "plan_id": "free", "access_level": "free", "trial_active": False,
        "trial_started_at": compact_text(trial["trial_started_at"] if trial else ""),
        "trial_ends_at": compact_text(trial["trial_ends_at"] if trial else ""),
        "subscription_active": False, "subscription_status": "free", "quota_profile": "free",
        "reason": "trial_expired" if trial_ends and trial_ends <= resolved_now else "no_active_subscription_or_trial",
    }


def get_effective_plan_id(email: str) -> str:
    return compact_text(resolve_entitlement(email).get("plan_id"), "free")''',
    ),
    (
        '@app.get("/api/billing/subscription")\nasync def get_billing_subscription(current_user: str = Depends(require_authenticated_user)):\n    normalized_email = normalize_email(current_user)\n    subscription = get_user_subscription(normalized_email)\n    usage = get_billing_usage_summary(normalized_email)',
        '@app.get("/api/billing/subscription")\nasync def get_billing_subscription(current_user: str = Depends(require_authenticated_user)):\n    normalized_email = normalize_email(current_user)\n    subscription = get_user_subscription(normalized_email)\n    entitlement = resolve_entitlement(normalized_email)\n    subscription = {**subscription, "entitlement": entitlement}\n    usage = get_billing_usage_summary(normalized_email)',
    ),
    (
        '            "last_synced_at": utc_now().isoformat(),\n        },\n        "subscription": subscription,\n        "usage": usage,',
        '            "last_synced_at": utc_now().isoformat(),\n        },\n        "subscription": subscription,\n        "entitlement": entitlement,\n        "usage": usage,',
    ),
    (
        '@app.post("/api/billing/checkout")\nasync def create_billing_checkout(',
        '''@app.post("/api/billing/trial/start")
def start_free_trial(
    request: Request,
    current_user: str = Depends(require_authenticated_user),
):
    email = normalize_email(current_user)
    now = utc_now()
    now_iso = now.isoformat()
    trial_end = (now + timedelta(days=FREE_TRIAL_DAYS)).isoformat()
    with get_db_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(
            "INSERT OR IGNORE INTO users (email, created_at, user_id, updated_at) VALUES (?, ?, ?, ?)",
            (email, now_iso, uuid4().hex, now_iso),
        )
        user = connection.execute(
            "SELECT trial_status, trial_started_at, trial_ends_at, trial_used_at FROM users WHERE lower(email) = ?",
            (email,),
        ).fetchone()
        paid = connection.execute(
            "SELECT status, current_period_end FROM billing_subscriptions WHERE lower(email) = ?",
            (email,),
        ).fetchone()
        paid_end = parse_billing_datetime(paid["current_period_end"]) if paid else None
        if paid and compact_text(paid["status"]).lower() == "active" and paid_end and paid_end > now:
            raise HTTPException(status_code=409, detail="Your paid subscription is already active.")
        existing_end = parse_billing_datetime(user["trial_ends_at"]) if user else None
        already_active = bool(
            user
            and compact_text(user["trial_status"]).lower() == "active"
            and existing_end
            and existing_end > now
        )
        if already_active:
            pass
        if user and compact_text(user["trial_used_at"]):
            if not already_active:
                raise HTTPException(status_code=409, detail="This account has already used its free trial.")
        if not already_active:
            connection.execute(
                """
                UPDATE users SET trial_status = 'active', trial_started_at = ?, trial_ends_at = ?,
                    trial_used_at = ?, updated_at = ? WHERE lower(email) = ?
                """,
                (now_iso, trial_end, now_iso, now_iso, email),
            )
    entitlement = resolve_entitlement(email, now=now)
    if already_active:
        return {"message": "Your free trial is already active.", "entitlement": entitlement, "idempotent": True}
    logger.info("Trial activation user=%s entitlement=%s reason=%s ends_at=%s", email, entitlement["entitlement"], entitlement["reason"], trial_end)
    record_audit_log(action="billing.trial.started", email=email, request=request, resource_type="billing_trial", resource_name=FREE_TRIAL_PLAN_ID, metadata={"trial_days": FREE_TRIAL_DAYS, "trial_ends_at": trial_end})
    return {"message": f"Your {FREE_TRIAL_DAYS}-day Pro trial is active.", "entitlement": entitlement, "idempotent": False}


@app.get("/admin/billing/entitlements/{user_email}")
def diagnose_user_entitlement(user_email: str, current_admin: str = Depends(require_admin_user)):
    email = validate_email_address(user_email)
    with get_db_connection() as connection:
        user = connection.execute(
            "SELECT current_plan_id, subscription_status, trial_status, trial_started_at, trial_ends_at, trial_used_at FROM users WHERE lower(email) = ?",
            (email,),
        ).fetchone()
    return {"user": dict(user) if user else None, "effective": resolve_entitlement(email)}


@app.post("/api/billing/checkout")
async def create_billing_checkout(''',
    ),
]
for old, new in changes:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match, found {count}: {old[:110]!r}")
    text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8", newline="")
