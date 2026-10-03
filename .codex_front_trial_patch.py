from pathlib import Path

path = Path("frontend/src/App.jsx")
text = path.read_text(encoding="utf-8")
changes = [
    (
        '{billingCheckoutPlanId === "payfast:trial:pro_student" ? "Opening PayFast..." : "Start 7-day free trial"}',
        '{billingCheckoutPlanId === "trial:pro_student" ? "Starting trial..." : "Start 7-day free trial"}',
    ),
    (
        'Card required. R0 today, then R50 monthly after seven days unless cancelled. One trial per account.',
        'No card required. Pro access starts immediately for seven days. One trial per account.',
    ),
    (
        '    const provider = String(paymentProvider || "").trim().toLowerCase() === "payfast" ? "payfast" : "payshap";\n    if (trial) {\n      setSelectedBillingPlan(null);\n      setManualPaymentRequest(null);\n    }\n    setBillingCheckoutMessage(trial ? "Opening the secure PayFast trial setup..." : provider === "payfast" ? "PayFast page is opening..." : "Generating your PayShap payment reference...");\n    const checkoutKey = `${provider}:${trial ? "trial:" : ""}${plan.id}`;',
        '    const provider = String(paymentProvider || "").trim().toLowerCase() === "payfast" ? "payfast" : "payshap";\n    if (trial) {\n      setSelectedBillingPlan(null);\n      setManualPaymentRequest(null);\n    }\n    setBillingCheckoutMessage(trial ? "Starting your free trial..." : provider === "payfast" ? "PayFast page is opening..." : "Generating your PayShap payment reference...");\n    const checkoutKey = trial ? `trial:${plan.id}` : `${provider}:${plan.id}`;',
    ),
    (
        '    try {\n      if (provider === "payfast") {',
        '''    try {
      if (trial) {
        const response = await authFetch("/api/billing/trial/start", {
          method: "POST",
          timeoutMs: 15000,
        });
        const data = await parseJsonSafe(response);
        if (!response.ok) throw new Error(data.detail || "Could not start the free trial.");
        setBillingCheckoutMessage(data.message || "Your Pro trial is active.");
        await refreshBillingStatus();
        return;
      }
      if (provider === "payfast") {''',
    ),
]
for old, new in changes:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match, found {count}: {old[:120]!r}")
    text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8", newline="")
