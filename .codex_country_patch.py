from pathlib import Path

path = Path("backend/main.py")
text = path.read_text(encoding="utf-8")

old = '''            SELECT id, email, plan_id, amount_zar, provider, provider_payment_id,
                   provider_token, status, checkout_fields_json, raw_event_json,
                   created_at, updated_at
            FROM billing_checkout_sessions'''
new = '''            SELECT id, email, plan_id, amount_zar, provider, provider_payment_id,
                   provider_token, status, checkout_fields_json, raw_event_json,
                   billing_country_at_purchase, created_at, updated_at
            FROM billing_checkout_sessions'''
if text.count(old) != 1:
    raise SystemExit(f"checkout selector count={text.count(old)}")
text = text.replace(old, new, 1)

old = '''    plan = get_billing_plan(payload.plan_id)
    is_trial = bool(payload.trial)
    require_payfast_configured(require_subscription=is_trial)'''
new = '''    plan = get_billing_plan(payload.plan_id)
    is_trial = bool(payload.trial)
    billing_country = normalize_billing_country(payload.billing_country)
    if compact_text(payload.billing_country) and not billing_country:
        raise HTTPException(status_code=400, detail="Billing country must be a two-letter country code.")
    if not billing_country:
        with get_db_connection() as connection:
            country_row = connection.execute("SELECT billing_country FROM users WHERE lower(email) = ?", (email,)).fetchone()
        billing_country = normalize_billing_country(country_row["billing_country"] if country_row else "")
    require_payfast_configured(require_subscription=is_trial)'''
if text.count(old) != 1:
    raise SystemExit(f"checkout country count={text.count(old)}")
text = text.replace(old, new, 1)

old = '''            INSERT INTO billing_checkout_sessions (
                id, email, plan_id, amount_zar, provider, status,
                checkout_fields_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'''
new = '''            INSERT INTO billing_checkout_sessions (
                id, email, plan_id, amount_zar, provider, status,
                checkout_fields_json, billing_country_at_purchase, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
if text.count(old) != 1:
    raise SystemExit(f"checkout insert count={text.count(old)}")
text = text.replace(old, new, 1)
old_values = '''                json.dumps(fields, ensure_ascii=False),
                now_iso,
                now_iso,'''
new_values = '''                json.dumps(fields, ensure_ascii=False),
                billing_country,
                now_iso,
                now_iso,'''
if text.count(old_values) < 1:
    raise SystemExit("checkout values not found")
# The first matching block after checkout construction is the checkout insert.
checkout_pos = text.index('INSERT INTO billing_checkout_sessions (')
values_pos = text.index(old_values, checkout_pos)
text = text[:values_pos] + text[values_pos:].replace(old_values, new_values, 1)

old = '''            INSERT INTO billing_payments (
                id, email, checkout_session_id, plan_id, provider, provider_payment_id,
                amount_zar, payment_status, raw_event_json, paid_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
new = '''            INSERT INTO billing_payments (
                id, email, checkout_session_id, plan_id, provider, provider_payment_id,
                amount_zar, payment_status, raw_event_json, billing_country_at_purchase,
                currency, paid_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
if text.count(old) < 1:
    raise SystemExit("PayFast payment insert not found")
pos = text.index('def upsert_paid_subscription_from_payfast')
insert_pos = text.index(old, pos)
text = text[:insert_pos] + text[insert_pos:].replace(old, new, 1)

old_values = '''                next_status,
                raw_event_json,
                now_iso,
                now_iso,
                now_iso,'''
new_values = '''                next_status,
                raw_event_json,
                normalize_billing_country(session["billing_country_at_purchase"]),
                "ZAR",
                now_iso,
                now_iso,
                now_iso,'''
pos = text.index('def upsert_paid_subscription_from_payfast')
value_pos = text.index(old_values, pos)
text = text[:value_pos] + text[value_pos:].replace(old_values, new_values, 1)
path.write_text(text, encoding="utf-8", newline="")
