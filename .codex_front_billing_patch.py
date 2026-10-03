from pathlib import Path

path = Path("frontend/src/App.jsx")
text = path.read_text(encoding="utf-8")

old = '''  const [paymentRequests, setPaymentRequests] = useState([]);
  const [manualPaymentDetails, setManualPaymentDetails] = useState(null);'''
new = '''  const [paymentRequests, setPaymentRequests] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [billingCountry, setBillingCountry] = useState("");
  const [refundPayment, setRefundPayment] = useState(null);
  const [refundReason, setRefundReason] = useState("accidental_purchase");
  const [refundExplanation, setRefundExplanation] = useState("");
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [showCancelSubscriptionConfirm, setShowCancelSubscriptionConfirm] = useState(false);
  const [manualPaymentDetails, setManualPaymentDetails] = useState(null);'''
if text.count(old) != 1:
    raise SystemExit(f"state count={text.count(old)}")
text = text.replace(old, new, 1)

old = '''      const nextPaymentRequests = data.payment_requests || data.account?.payment_requests || [];
      const nextManualPaymentDetails = data.manual_payment?.payment_details || data.account?.manual_payment?.payment_details || null;
      setBillingUsage(nextUsage);
      setBillingSubscription(nextSubscription);
      setPaymentRequests(Array.isArray(nextPaymentRequests) ? nextPaymentRequests : []);'''
new = '''      const nextPaymentRequests = data.payment_requests || data.account?.payment_requests || [];
      const nextPaymentHistory = data.payment_history || data.account?.payment_history || [];
      const nextManualPaymentDetails = data.manual_payment?.payment_details || data.account?.manual_payment?.payment_details || null;
      setBillingUsage(nextUsage);
      setBillingSubscription(nextSubscription);
      setPaymentRequests(Array.isArray(nextPaymentRequests) ? nextPaymentRequests : []);
      setPaymentHistory(Array.isArray(nextPaymentHistory) ? nextPaymentHistory : []);'''
if text.count(old) != 1:
    raise SystemExit(f"refresh count={text.count(old)}")
text = text.replace(old, new, 1)

old = '          body: JSON.stringify({ plan_id: plan.id, trial }),'
new = '          body: JSON.stringify({ plan_id: plan.id, trial, billing_country: billingCountry.trim().toUpperCase() }),'
if text.count(old) != 1:
    raise SystemExit(f"checkout body count={text.count(old)}")
text = text.replace(old, new, 1)

old = '''      if (provider === "payfast") {
        const response = await authFetch("/api/billing/checkout", {'''
new = '''      if (provider === "payfast") {
        const normalizedBillingCountry = billingCountry.trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(normalizedBillingCountry)) {
          throw new Error("Enter the two-letter billing country used for this payment, for example ZA.");
        }
        const response = await authFetch("/api/billing/checkout", {'''
if text.count(old) != 1:
    raise SystemExit(f"country validation count={text.count(old)}")
text = text.replace(old, new, 1)

function_anchor = '  const confirmManualPaymentSubmitted = async (paymentId = "") => {'
if text.count(function_anchor) != 1:
    raise SystemExit(f"function anchor count={text.count(function_anchor)}")
functions = '''  const submitRefundRequest = async () => {
    if (!refundPayment?.id || isSubmittingRefund) return;
    setIsSubmittingRefund(true);
    setBillingCheckoutMessage("");
    try {
      const response = await authFetch("/billing/refund-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: refundPayment.id, reason_code: refundReason, reason_text: refundExplanation }),
        timeoutMs: 20000,
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not submit the refund request.");
      setBillingCheckoutMessage(data.message || "Refund request received.");
      setRefundPayment(null);
      setRefundExplanation("");
      await refreshBillingStatus();
    } catch (err) {
      setBillingCheckoutMessage(getReadableRequestError(err));
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  const cancelActiveSubscription = async () => {
    setBillingCheckoutMessage("");
    try {
      const response = await authFetch("/billing/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Customer requested cancellation" }),
        timeoutMs: 25000,
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not cancel the subscription.");
      setBillingCheckoutMessage(data.message || "Future recurring charges are cancelled.");
      setShowCancelSubscriptionConfirm(false);
      await refreshBillingStatus();
    } catch (err) {
      setBillingCheckoutMessage(getReadableRequestError(err));
    }
  };

'''
text = text.replace(function_anchor, functions + function_anchor, 1)

country_anchor = '''            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => startBillingCheckout(selectedBillingPlan, "payfast")}'''
country_replacement = '''            <label className="mt-4 block max-w-sm">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Billing country</span>
              <input
                value={billingCountry}
                onChange={(event) => setBillingCountry(event.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase())}
                placeholder="ZA"
                inputMode="text"
                autoComplete="country"
                aria-label="Two-letter billing country"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-semibold uppercase text-white outline-none focus:border-emerald-400"
              />
              <span className="mt-1 block text-xs text-slate-400">Use the country for this payment. It is saved with the transaction and cannot be changed later.</span>
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => startBillingCheckout(selectedBillingPlan, "payfast")}'''
if text.count(country_anchor) != 1:
    raise SystemExit(f"country UI count={text.count(country_anchor)}")
text = text.replace(country_anchor, country_replacement, 1)

subscription_anchor = '''            {billingSubscription.message ? <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">{billingSubscription.message}</p> : null}
          </div>
        ) : null}
        {billingUsage?.features?.length ? ('''
subscription_ui = '''            {billingSubscription.message ? <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">{billingSubscription.message}</p> : null}
            {billingSubscription.active && billingSubscription.provider === "payfast" ? (
              <div className="mt-4">
                {showCancelSubscriptionConfirm ? (
                  <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-50">
                    <p className="font-semibold">Cancel future recurring charges?</p>
                    <p className="mt-1 text-xs leading-5 text-rose-100/80">Your paid access remains until the current paid period ends. This does not automatically request a refund.</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => void cancelActiveSubscription()} className="rounded-full bg-rose-400 px-4 py-2 text-xs font-bold text-rose-950">Confirm cancellation</button>
                      <button type="button" onClick={() => setShowCancelSubscriptionConfirm(false)} className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold">Keep subscription</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowCancelSubscriptionConfirm(true)} className="rounded-full border border-rose-300/25 px-4 py-2 text-xs font-bold text-rose-100">Cancel subscription</button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        {paymentHistory.length ? (
          <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Payment History</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Cancellation stops future charges. A refund request applies to one completed transaction and is checked by the backend and PayFast.</p>
            <div className="mt-4 space-y-2">
              {paymentHistory.map((payment) => (
                <div key={payment.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-sm text-slate-200">
                    <p className="font-semibold text-white">{String(payment.plan_id || "plan").replaceAll("_", " ")} · R{payment.amount_zar}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatAdminDateTime(payment.paid_at)} · {payment.payment_status} · {payment.billing_country_at_purchase || "country unknown"}</p>
                    {payment.refund?.status && payment.refund.status !== "eligible" ? <p className="mt-1 text-xs text-amber-200">Refund: {String(payment.refund.status).replaceAll("_", " ")}</p> : null}
                  </div>
                  {payment.refund?.eligible ? <button type="button" onClick={() => setRefundPayment(payment)} className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-xs font-bold text-emerald-100">Request refund</button> : null}
                </div>
              ))}
            </div>
            {refundPayment ? (
              <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">Request refund · R{refundPayment.amount_zar}</p><p className="mt-1 text-xs leading-5 text-emerald-100/80">South African customers receive Mabaso AI's extended 14-day refund-request window. Eligibility also depends on payment status, usage and applicable consumer law.</p></div><button type="button" onClick={() => setRefundPayment(null)} aria-label="Close refund request" className="rounded-full p-2 hover:bg-white/10"><X className="h-4 w-4" /></button></div>
                <select value={refundReason} onChange={(event) => setRefundReason(event.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="accidental_purchase">Accidental purchase</option><option value="accidental_renewal">Accidental renewal</option><option value="duplicate_charge">Duplicate charge</option><option value="incorrect_amount">Charged incorrect amount</option><option value="technical_problem">Technical/service problem</option><option value="subscription_not_working">Subscription did not work</option><option value="other">Other</option>
                </select>
                <textarea value={refundExplanation} onChange={(event) => setRefundExplanation(event.target.value.slice(0, 1000))} placeholder="Optional explanation" className="mt-3 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
                <button type="button" onClick={() => void submitRefundRequest()} disabled={isSubmittingRefund} className="mt-3 rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-emerald-950 disabled:opacity-60">{isSubmittingRefund ? "Submitting..." : "Submit refund request"}</button>
              </div>
            ) : null}
          </div>
        ) : null}
        {billingUsage?.features?.length ? ('''
if text.count(subscription_anchor) != 1:
    raise SystemExit(f"subscription UI count={text.count(subscription_anchor)}")
text = text.replace(subscription_anchor, subscription_ui, 1)

path.write_text(text, encoding="utf-8", newline="")
