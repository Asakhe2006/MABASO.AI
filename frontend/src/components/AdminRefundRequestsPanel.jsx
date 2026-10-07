import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Search, X } from "lucide-react";

const FILTERS = [["pending", "Pending"], ["under_review", "Under review"], ["processing", "Processing"], ["refunded", "Refunded"], ["rejected", "Rejected"], ["failed", "Failed"], ["all", "All"]];
const REJECTION_REASONS = [["outside_refund_period", "Outside refund period"], ["usage_exceeds_policy_threshold", "Usage exceeds policy threshold"], ["payment_already_refunded", "Payment already refunded"], ["transaction_not_eligible", "Transaction not eligible"], ["invalid_request", "Invalid request"], ["other", "Other"]];
const PENDING = new Set(["requested", "eligible", "manual_review", "auto_approved"]);
const APPROVABLE = new Set(["requested", "eligible", "manual_review", "auto_approved", "under_review"]);
const title = (value) => String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value, currency = "ZAR") => new Intl.NumberFormat("en-ZA", { style: "currency", currency: currency || "ZAR" }).format(Number(value || 0));
const date = (value) => {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("en-ZA");
};
const requestJson = async (authFetch, path, options = {}) => {
  const response = await authFetch(path, { cache: "no-store", timeoutMs: 45000, ...options, headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.message || "The refund action could not be completed.");
  return payload;
};

function StatusBadge({ status }) {
  const value = String(status || "unknown").toLowerCase();
  const tone = ["refunded", "partially_refunded"].includes(value) ? "bg-emerald-100 text-emerald-800" : ["failed", "rejected"].includes(value) ? "bg-rose-100 text-rose-800" : ["processing", "provider_accepted"].includes(value) ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800";
  return <span className={"inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] " + tone}>{title(value)}</span>;
}

function Detail({ label, value, wide = false }) {
  return <div className={"rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 " + (wide ? "sm:col-span-2" : "")}><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-2 break-words text-sm font-medium leading-6 text-slate-900">{value || "Not recorded"}</p></div>;
}

function ConfirmDialog({ action, refund, busy, reason, setReason, note, setNote, close, confirm }) {
  if (!action || !refund) return null;
  const reject = action === "reject";
  const retry = action === "retry";
  return <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
    <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
      <div className="flex items-start gap-3"><span className="rounded-full bg-amber-100 p-2 text-amber-700"><AlertTriangle className="h-5 w-5" /></span><div><h3 className="text-xl font-bold text-slate-950">{reject ? "Reject refund request?" : retry ? "Retry failed refund?" : "Approve refund?"}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{reject ? "This records an admin decision and notifies the customer." : retry ? "The backend will query PayFast first and resubmit only when retrying is safe." : "Approving initiates a real PayFast refund. Refunded is shown only after provider confirmation."}</p></div></div>
      <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700"><p><strong>Customer:</strong> {refund.customer_name} ({refund.email})</p><p><strong>Plan:</strong> {refund.plan_name}</p><p><strong>Original payment:</strong> {money(refund.original_amount, refund.currency)}</p><p><strong>Refund amount:</strong> {money(refund.requested_amount, refund.currency)}</p><p><strong>Provider:</strong> {title(refund.payment_provider || "PayFast")}</p></div>
      {reject ? <label className="mt-5 block text-sm font-semibold text-slate-800">Rejection reason<select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"><option value="">Select a reason</option>{REJECTION_REASONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label> : null}
      <label className="mt-4 block text-sm font-semibold text-slate-800">Admin note {reject && reason === "other" ? "(required)" : "(optional)"}<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} className="mt-2 w-full resize-none rounded-2xl border border-slate-300 px-4 py-3" /></label>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={close} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">Cancel</button><button type="button" disabled={busy || (reject && (!reason || (reason === "other" && !note.trim())))} onClick={confirm} className={"rounded-full px-5 py-3 text-sm font-bold text-white disabled:opacity-50 " + (reject ? "bg-rose-600" : "bg-slate-950")}>{busy ? "Processing..." : reject ? "Reject refund" : retry ? "Retry safely" : "Approve " + money(refund.requested_amount, refund.currency) + " refund"}</button></div>
    </div>
  </div>;
}

export default function AdminRefundRequestsPanel({ authFetch, initialRefundId = "", onPendingCountChange }) {
  const [filter, setFilter] = useState("pending");
  const [query, setQuery] = useState("");
  const [refunds, setRefunds] = useState([]);
  const [counts, setCounts] = useState({});
  const [selected, setSelected] = useState(null);
  const [audit, setAudit] = useState([]);
  const [provider, setProvider] = useState({});
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async (status = filter) => {
    setLoading(true);
    setError("");
    try {
      const payload = await requestJson(authFetch, "/admin/refunds?status=" + encodeURIComponent(status) + "&limit=100");
      setRefunds(Array.isArray(payload.refunds) ? payload.refunds : []);
      setCounts(payload.counts || {});
      onPendingCountChange?.(Number(payload.counts?.pending || 0));
    } catch (nextError) { setError(nextError.message); } finally { setLoading(false); }
  }, [authFetch, filter, onPendingCountChange]);

  const open = useCallback(async (id, markReviewed = true) => {
    if (!id) return;
    setDetailsLoading(true);
    setError("");
    try {
      let payload = await requestJson(authFetch, "/admin/refunds/" + encodeURIComponent(id));
      if (markReviewed && PENDING.has(String(payload.refund_request?.status || "").toLowerCase())) {
        await requestJson(authFetch, "/admin/refunds/" + encodeURIComponent(id) + "/review", { method: "POST" });
        payload = await requestJson(authFetch, "/admin/refunds/" + encodeURIComponent(id));
        void load();
      }
      setSelected(payload.refund_request || null);
      setAudit(Array.isArray(payload.audit_history) ? payload.audit_history : []);
      setProvider(payload.provider_response || {});
    } catch (nextError) { setError(nextError.message); } finally { setDetailsLoading(false); }
  }, [authFetch, load]);

  useEffect(() => { void load(filter); }, [filter, load]);
  useEffect(() => { if (initialRefundId) void open(initialRefundId); }, [initialRefundId, open]);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return refunds;
    return refunds.filter((item) => [item.customer_name, item.email, item.plan_name, item.payment_id, item.pf_payment_id, item.reason_code, item.reason_text, item.status].join(" ").toLowerCase().includes(search));
  }, [query, refunds]);

  const act = async () => {
    if (!selected || !action) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const endpoint = action === "approve" ? "approve" : action === "reject" ? "reject" : "retry";
      const payload = await requestJson(authFetch, "/admin/refunds/" + encodeURIComponent(selected.id) + "/" + endpoint, { method: "POST", body: JSON.stringify({ admin_note: note.trim(), decision_reason: reason }) });
      setMessage(payload.message || "Refund request updated.");
      setAction(""); setNote(""); setReason("");
      await load(); await open(selected.id, false);
    } catch (nextError) { setError(nextError.message); } finally { setBusy(false); }
  };
  const simpleAction = async (endpoint) => {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const payload = await requestJson(authFetch, "/admin/refunds/" + encodeURIComponent(selected.id) + "/" + endpoint, { method: "POST" });
      setMessage(payload.message || "Refund request updated.");
      await load(); await open(selected.id, false);
    } catch (nextError) { setError(nextError.message); } finally { setBusy(false); }
  };

  return <section className="space-y-5">
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-600">Billing control</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Refund Requests</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Review the original charge, policy result, usage snapshot, provider state, and audit history before sending money. Automatic refunds remain disabled.</p></div><button type="button" disabled={loading} onClick={() => load()} className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white"><RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> Refresh requests</button></div>
      <div className="mt-5 flex flex-wrap gap-2" role="tablist">{FILTERS.map(([value, label]) => <button type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} key={value} className={"rounded-full px-4 py-2 text-sm font-semibold " + (filter === value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700")}>{label} <span className="ml-1 opacity-75">{counts[value] ?? 0}</span></button>)}</div>
      <label className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><Search className="h-4 w-4 text-slate-400" /><span className="sr-only">Search refunds</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm text-slate-900 outline-none" placeholder="Search customer, payment, plan, reason, or status" /></label>
    </div>
    {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</div> : null}
    {message ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{message}</div> : null}
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.07)]"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500"><tr>{["Customer", "Plan", "Original / requested", "Payment / request", "Provider", "Reason", "Policy & usage", "Status", "Action"].map((label) => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{visible.map((item) => <tr className="border-t border-slate-100 align-top text-slate-700" key={item.id}><td className="px-4 py-4"><p className="font-semibold text-slate-950">{item.customer_name}</p><p className="mt-1 break-all text-xs text-slate-500">{item.email}</p></td><td className="px-4 py-4">{item.plan_name || title(item.plan_id)}</td><td className="px-4 py-4">{money(item.original_amount, item.currency)}<p className="mt-1 text-xs text-slate-500">Requested {money(item.requested_amount, item.currency)}</p></td><td className="px-4 py-4">{date(item.payment_date)}<p className="mt-1 text-xs text-slate-500">Requested {date(item.requested_at)}</p></td><td className="px-4 py-4">{title(item.payment_provider || "PayFast")}<p className="mt-1 text-xs text-slate-500">{item.payment_method || "PayFast"}</p></td><td className="max-w-[220px] px-4 py-4"><p className="font-medium text-slate-900">{title(item.reason_code)}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.reason_text || "No explanation supplied"}</p></td><td className="px-4 py-4">{item.eligibility_window_days} day window<p className="mt-1 text-xs text-slate-500">{title(item.eligibility_reason)} · {item.usage_snapshot?.total_paid_feature_events || 0} paid events</p></td><td className="px-4 py-4"><StatusBadge status={item.status} /></td><td className="px-4 py-4"><button type="button" onClick={() => open(item.id)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-800">View details</button></td></tr>)}</tbody></table></div>{loading ? <div className="flex items-center justify-center gap-3 border-t border-slate-100 p-8 text-sm text-slate-600"><RefreshCw className="h-5 w-5 animate-spin text-emerald-600" /> Loading refund requests...</div> : null}{!loading && !visible.length ? <div className="border-t border-slate-100 p-8 text-center text-sm text-slate-500">No refund requests match this view.</div> : null}</div>
    {selected ? <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true"><div className="mx-auto w-full max-w-5xl rounded-[30px] bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-600">Refund review</p><h3 className="mt-2 text-2xl font-bold text-slate-950">{selected.customer_name} · {selected.plan_name}</h3><div className="mt-3"><StatusBadge status={selected.status} /></div></div><button type="button" onClick={() => setSelected(null)} className="rounded-full border border-slate-200 p-2 text-slate-600" aria-label="Close refund details"><X className="h-5 w-5" /></button></div>
      {detailsLoading ? <div className="mt-6 flex items-center gap-3 text-sm text-slate-600"><RefreshCw className="h-5 w-5 animate-spin text-emerald-600" /> Loading details...</div> : <><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Detail label="Customer" value={selected.customer_name + " · " + selected.email} wide /><Detail label="Plan" value={selected.plan_name || title(selected.plan_id)} /><Detail label="Original charge" value={money(selected.original_amount, selected.currency)} /><Detail label="Refund requested" value={money(selected.requested_amount, selected.currency)} /><Detail label="Payment date" value={date(selected.payment_date)} /><Detail label="Request date" value={date(selected.requested_at)} /><Detail label="Payment status" value={title(selected.payment_status)} /><Detail label="Payment method" value={selected.payment_method || "PayFast"} /><Detail label="Safe provider reference" value={selected.pf_payment_id} /><Detail label="Country at purchase" value={selected.billing_country_at_purchase || "Unknown"} /><Detail label="Policy window" value={selected.eligibility_window_days + " calendar days · " + title(selected.policy_type)} wide /><Detail label="Eligibility" value={title(selected.eligibility_reason) + " · " + title(selected.automatic_or_manual)} wide /><Detail label="Customer reason" value={title(selected.reason_code) + (selected.reason_text ? " — " + selected.reason_text : "")} wide /><Detail label="Admin notes" value={selected.admin_note || "No admin notes yet"} wide /></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-4"><h4 className="font-bold text-slate-950">Usage since payment</h4><div className="mt-3 grid grid-cols-2 gap-2 text-sm">{Object.entries(selected.usage_snapshot || {}).filter(([, value]) => typeof value !== "object").map(([key, value]) => <div className="rounded-xl bg-slate-50 p-3" key={key}><span className="text-xs text-slate-500">{title(key)}</span><p className="mt-1 font-semibold text-slate-900">{String(value)}</p></div>)}</div></div><div className="rounded-2xl border border-slate-200 p-4"><h4 className="font-bold text-slate-950">Provider and notification state</h4><div className="mt-3 space-y-2 text-sm text-slate-700"><p><strong>PayFast:</strong> {title(selected.provider_status || "not submitted")}</p><p><strong>Admin email:</strong> {title(selected.admin_notification_status || "pending")}</p><p><strong>Customer email:</strong> {title(selected.customer_notification_status || "pending")}</p>{selected.provider_error ? <p className="rounded-xl bg-rose-50 p-3 text-rose-800">{selected.provider_error}</p> : null}{Object.keys(provider).length ? <pre className="max-h-40 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(provider, null, 2)}</pre> : null}</div></div></div>
      <div className="mt-5 rounded-2xl border border-slate-200 p-4"><h4 className="font-bold text-slate-950">Audit history</h4><div className="mt-3 space-y-2">{audit.length ? audit.map((event) => <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3 text-sm sm:flex-row sm:justify-between" key={event.id}><div><p className="font-semibold text-slate-900">{title(event.action)}</p><p className="text-xs text-slate-500">{event.actor_email || event.actor_type}</p></div><time className="text-xs text-slate-500">{date(event.created_at)}</time></div>) : <p className="text-sm text-slate-500">No audit events recorded.</p>}</div></div>
      <div className="mt-6 flex flex-wrap gap-3">{APPROVABLE.has(String(selected.status || "").toLowerCase()) ? <><button type="button" disabled={busy} onClick={() => setAction("approve")} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white">Approve refund</button><button type="button" disabled={busy} onClick={() => setAction("reject")} className="rounded-full bg-rose-600 px-5 py-3 text-sm font-bold text-white">Reject refund</button></> : null}{String(selected.status).toLowerCase() === "failed" ? <button type="button" disabled={busy} onClick={() => setAction("retry")} className="rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950">Retry refund</button> : null}{["processing", "provider_accepted"].includes(String(selected.status).toLowerCase()) ? <button type="button" disabled={busy} onClick={() => simpleAction("refresh")} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800">Refresh PayFast status</button> : null}{String(selected.admin_notification_status).toLowerCase() === "failed" ? <button type="button" disabled={busy} onClick={() => simpleAction("notify-admin")} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800">Retry admin email</button> : null}</div></>}</div></div> : null}
    <ConfirmDialog action={action} refund={selected} busy={busy} reason={reason} setReason={setReason} note={note} setNote={setNote} close={() => { setAction(""); setReason(""); setNote(""); }} confirm={act} />
  </section>;
}
