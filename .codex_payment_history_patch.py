from pathlib import Path

path = Path("backend/main.py")
text = path.read_text(encoding="utf-8")
old = '''            SELECT id, checkout_session_id, plan_id, provider, provider_payment_id,
                   amount_zar, payment_status, paid_at, created_at, updated_at
            FROM billing_payments
            WHERE email = ?'''
new = '''            SELECT id, email, checkout_session_id, plan_id, provider, provider_payment_id,
                   amount_zar, payment_status, paid_at, created_at, updated_at,
                   billing_country_at_purchase, currency, refunded_amount_zar,
                   chargeback_status, provider_refund_status
            FROM billing_payments
            WHERE lower(email) = ?'''
if text.count(old) != 1:
    raise SystemExit(f"payment select count={text.count(old)}")
text = text.replace(old, new, 1)
old_return = '''    return [
        {
            "id": row["id"],
            "checkout_session_id": row["checkout_session_id"],
            "plan_id": normalize_billing_plan_id(row["plan_id"]),
            "provider": row["provider"],
            "provider_payment_id": row["provider_payment_id"],
            "amount_zar": row["amount_zar"],
            "payment_status": row["payment_status"],
            "paid_at": row["paid_at"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]'''
new_return = '''    history = []
    for row in rows:
        history.append({
            "id": row["id"],
            "checkout_session_id": row["checkout_session_id"],
            "plan_id": normalize_billing_plan_id(row["plan_id"]),
            "provider": row["provider"],
            "provider_payment_id": row["provider_payment_id"],
            "amount_zar": row["amount_zar"],
            "currency": row["currency"],
            "payment_status": row["payment_status"],
            "billing_country_at_purchase": row["billing_country_at_purchase"] or "unknown",
            "refunded_amount_zar": row["refunded_amount_zar"],
            "provider_refund_status": row["provider_refund_status"],
            "paid_at": row["paid_at"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "refund": get_payment_refund_summary(row),
        })
    return history'''
if text.count(old_return) != 1:
    raise SystemExit(f"payment return count={text.count(old_return)}")
text = text.replace(old_return, new_return, 1)
path.write_text(text, encoding="utf-8", newline="")
