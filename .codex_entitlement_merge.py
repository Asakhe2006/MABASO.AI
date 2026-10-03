from pathlib import Path

path = Path("backend/main.py")
text = path.read_text(encoding="utf-8")
needle = '''def get_effective_plan_id(email: str) -> str:
    return compact_text(resolve_entitlement(email).get("plan_id"), "free")
'''
replacement = '''def get_effective_plan_id(email: str) -> str:
    return compact_text(resolve_entitlement(email).get("plan_id"), "free")


def get_effective_subscription_snapshot(email: str) -> tuple[dict[str, Any], dict[str, Any]]:
    subscription = get_user_subscription(email)
    entitlement = resolve_entitlement(email)
    if entitlement.get("trial_active"):
        subscription = {
            **subscription,
            "status": "trialing",
            "plan_id": entitlement["plan_id"],
            "provider": "mabaso_trial",
            "amount_zar": "0.00",
            "current_period_start": entitlement.get("trial_started_at", ""),
            "current_period_end": entitlement.get("trial_ends_at", ""),
            "active": True,
            "renewal_status": "trial",
            "expired": False,
        }
    return {**subscription, "entitlement": entitlement}, entitlement
'''
if text.count(needle) != 1:
    raise SystemExit(f"merge helper insertion count={text.count(needle)}")
text = text.replace(needle, replacement, 1)
text = text.replace(
    '    subscription = get_user_subscription(normalized_email)\n    usage = get_billing_usage_summary(normalized_email)\n    monthly_usage = get_monthly_usage_summary(normalized_email)',
    '    subscription, entitlement = get_effective_subscription_snapshot(normalized_email)\n    usage = get_billing_usage_summary(normalized_email)\n    monthly_usage = get_monthly_usage_summary(normalized_email)',
    1,
)
old_endpoint = '''    subscription = get_user_subscription(normalized_email)
    entitlement = resolve_entitlement(normalized_email)
    subscription = {**subscription, "entitlement": entitlement}
    usage = get_billing_usage_summary(normalized_email)'''
new_endpoint = '''    subscription, entitlement = get_effective_subscription_snapshot(normalized_email)
    usage = get_billing_usage_summary(normalized_email)'''
if text.count(old_endpoint) != 1:
    raise SystemExit(f"endpoint merge count={text.count(old_endpoint)}")
text = text.replace(old_endpoint, new_endpoint, 1)
path.write_text(text, encoding="utf-8", newline="")
