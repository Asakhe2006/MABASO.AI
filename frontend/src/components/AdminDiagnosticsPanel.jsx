import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TABS = [
  ["inspector", "User Inspector"],
  ["timeline", "User Timeline"],
  ["entitlement", "Entitlement Trace"],
  ["trials", "Trial Trace"],
  ["quotas", "Quota Trace"],
  ["billing", "Payments & Refunds"],
  ["authentication", "Authentication"],
  ["generations", "Background Jobs"],
  ["events", "API Errors & Traces"],
  ["system", "System & Deployment"],
];

const formatDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const title = (value) => String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const requestJson = async (authFetch, path, options = {}) => {
  const response = await authFetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.message || "Diagnostics request failed.");
  return payload;
};

function Metric({ label, value, tone = "slate" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-800",
    rose: "bg-rose-50 text-rose-800",
    amber: "bg-amber-50 text-amber-800",
    sky: "bg-sky-50 text-sky-800",
    slate: "bg-slate-50 text-slate-800",
  };
  return <div className={`rounded-2xl px-4 py-3 ${tones[tone] || tones.slate}`}><p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p><p className="mt-2 break-words text-lg font-semibold">{value ?? "--"}</p></div>;
}

function Timeline({ items = [] }) {
  return (
    <div className="space-y-3">
      {items.length ? items.map((item) => (
        <article key={`${item.source}-${item.id}-${item.created_at}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${item.severity === "ERROR" || item.severity === "CRITICAL" ? "bg-rose-100 text-rose-700" : item.severity === "WARNING" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{item.severity || "INFO"}</span>
              <strong className="text-sm text-slate-900">{title(item.event_type)}</strong>
            </div>
            <time className="text-xs text-slate-500">{formatDate(item.created_at)}</time>
          </div>
          {item.message ? <p className="mt-3 text-sm leading-6 text-slate-700">{item.message}</p> : null}
          {item.request_id || item.trace_id ? <p className="mt-2 break-all font-mono text-[11px] text-slate-500">{item.request_id || item.trace_id}</p> : null}
        </article>
      )) : <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No trace events match this view.</p>}
    </div>
  );
}

export default function AdminDiagnosticsPanel({ authFetch }) {
  const authFetchRef = useRef(authFetch);
  const [tab, setTab] = useState("inspector");
  const [overview, setOverview] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");

  useEffect(() => {
    authFetchRef.current = authFetch;
  }, [authFetch]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await requestJson(authFetchRef.current, "/admin/diagnostics/overview"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const payload = await requestJson(authFetchRef.current, `/admin/diagnostics/users/search?q=${encodeURIComponent(query)}&limit=20`);
        if (active) setResults(payload.users || []);
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    }, query ? 240 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const inspectUser = async (email, nextTab = "inspector") => {
    if (!email) return;
    if (email !== selectedEmail) {
      setRecoveryToken("");
      setRecoveryMessage("");
    }
    setLoading(true);
    setError("");
    try {
      const payload = await requestJson(authFetchRef.current, `/admin/diagnostics/users/${encodeURIComponent(email)}`);
      setSelectedEmail(email);
      setSnapshot(payload);
      setTab(nextTab);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const recalculate = async () => {
    if (!selectedEmail) return;
    setLoading(true);
    try {
      await requestJson(authFetchRef.current, `/admin/diagnostics/users/${encodeURIComponent(selectedEmail)}/recalculate-entitlement`, { method: "POST" });
      await inspectUser(selectedEmail, tab);
    } catch (requestError) {
      setError(requestError.message);
      setLoading(false);
    }
  };

  const recoverPayFastTrial = async () => {
    const identifier = recoveryToken.trim();
    if (!selectedEmail || !identifier) return;
    const checkout = (snapshot?.checkout_sessions || []).find((item) => ["pending", "confirmation_pending"].includes(String(item?.status || "").toLowerCase()));
    setRecoveryBusy(true);
    setRecoveryMessage("");
    setError("");
    try {
      const payload = await requestJson(
        authFetchRef.current,
        `/admin/diagnostics/users/${encodeURIComponent(selectedEmail)}/recover-payfast-trial`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, checkout_id: checkout?.id || "" }),
        },
      );
      setRecoveryToken("");
      setRecoveryMessage(payload.message || "PayFast verified the subscription and the trial was recovered.");
      await inspectUser(selectedEmail, "billing");
      await loadOverview();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRecoveryBusy(false);
    }
  };

  const recentErrors = useMemo(() => (overview?.recent_events || []).filter((event) => ["ERROR", "CRITICAL", "WARNING"].includes(event.severity)), [overview]);
  const trialUsers = overview?.trial_users || [];
  const entitlement = snapshot?.entitlement || {};
  const state = snapshot?.state_comparison || {};
  const recoveryCheckout = (snapshot?.checkout_sessions || []).find((checkout) => ["pending", "confirmation_pending"].includes(String(checkout?.status || "").toLowerCase()));
  // Retain the previous JSX during this additive rollout, but render the
  // clearer dual-identifier recovery panel below instead.
  const pendingCheckout = null;

  return (
    <section className="space-y-5" aria-busy={loading}>
      <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">Diagnostics</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">Trace billing, access, quota, authentication, and generation decisions.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">This view reads the same entitlement and quota resolvers used by Mabaso AI. It never reveals tokens, provider secrets, passwords, or raw authorization headers.</p></div>
          <button type="button" onClick={loadOverview} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Refresh diagnostics</button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Diagnostic views">{TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}>{label}</button>)}</div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</div> : null}

      <details className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-base font-semibold text-slate-950">How Diagnostics controls work</summary>
        <div className="mt-4 grid gap-4 text-sm leading-6 text-slate-600 md:grid-cols-2">
          <p><strong className="block text-slate-900">Refresh diagnostics</strong>Reloads health, issue counts, and traces without changing accounts.</p>
          <p><strong className="block text-slate-900">Select a user</strong>Loads that account&apos;s authoritative entitlement, billing, quota, authentication, and generation records.</p>
          <p><strong className="block text-slate-900">Recalculate entitlement</strong>Runs the normal resolver again. It never forces or edits a plan.</p>
          <p><strong className="block text-slate-900">Trace tabs</strong>Explain the stored timeline, entitlement decision, trial, quota, payments, sessions, jobs, errors, and deployment state.</p>
          <p><strong className="block text-slate-900">Verify and recover</strong>Verifies a real PayFast token, or resolves a checkout reference to verified persisted evidence, before restoring missed state.</p>
          <p><strong className="block text-slate-900">System issue links</strong>Open the affected account so provider and local state can be compared safely.</p>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">The complete operational guide is stored in docs/admin-diagnostics-refunds-guide.md for deployment and support use.</p>
      </details>

      {tab === "billing" && recoveryCheckout ? (
        <article className="rounded-[18px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-950">Recover missed PayFast confirmation</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-amber-900">Use this when PayFast successfully created a subscription but Mabaso AI missed the confirmation. Enter either the real PayFast subscription token or this customer&apos;s Mabaso AI checkout reference. A checkout reference only locates persisted evidence; it never activates access by itself.</p>
          <p className="mt-3 break-all text-xs font-semibold text-amber-800">Pending checkout: {recoveryCheckout.id}</p>
          <div className="mt-4 flex flex-col gap-3 lg:flex-row">
            <label className="min-w-0 flex-1">
              <span className="mb-2 block text-xs font-semibold text-amber-950">PayFast subscription token or checkout reference</span>
              <input type="text" autoComplete="off" value={recoveryToken} onChange={(event) => setRecoveryToken(event.target.value)} placeholder="Paste subscription token or mabaso-... checkout reference" className="w-full rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-indigo-400" />
            </label>
            <button type="button" onClick={() => void recoverPayFastTrial()} disabled={recoveryBusy || recoveryToken.trim().length < 20} className="self-end rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{recoveryBusy ? "Verifying with PayFast..." : "Verify and recover"}</button>
          </div>
          <div className="mt-3 grid gap-1 text-xs leading-5 text-amber-800">
            <span>Subscription token: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</span>
            <span>Checkout reference: mabaso-xxxxxxxxxxxxxxxxxxxxxxxx</span>
          </div>
          {recoveryMessage ? <p className="mt-3 text-sm font-semibold text-emerald-800" role="status">{recoveryMessage}</p> : null}
          <p className="mt-3 text-xs leading-5 text-amber-800">Tokens stay in the protected backend. Audit records contain the identifier type and checkout reference only; raw tokens and payment credentials are never logged.</p>
        </article>
      ) : null}

      {tab === "inspector" ? (
        <div className="grid gap-5 2xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500" htmlFor="diagnostic-user-search">Find a user</label>
            <input id="diagnostic-user-search" value={query} onChange={(event) => setQuery(event.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400" placeholder="Email or user ID" />
            <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">{results.map((user) => <button key={user.email} type="button" onClick={() => inspectUser(user.email)} className={`w-full rounded-2xl border px-4 py-3 text-left ${selectedEmail === user.email ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}><strong className="block break-all text-sm text-slate-900">{user.email}</strong><span className="mt-1 block text-xs text-slate-500">{title(user.trial_status)} · {title(user.subscription_status)} · {formatDate(user.last_login_at)}</span></button>)}</div>
          </aside>
          <div className="space-y-5">
            {snapshot ? <>
              <article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="break-all text-lg font-semibold text-slate-950">{snapshot.account?.email}</p><p className="mt-1 text-sm text-slate-500">User ID {snapshot.account?.user_id || "not recorded"}</p></div><button type="button" onClick={recalculate} className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700">Recalculate entitlement</button></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Effective entitlement" value={title(entitlement.entitlement)} tone="emerald" /><Metric label="Decision reason" value={title(entitlement.reason)} tone="sky" /><Metric label="Quota profile" value={title(entitlement.quota_profile)} /><Metric label="Account status" value={title(snapshot.account?.account_status)} /></div>
              </article>
              <article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-950">Entitlement decision trace</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">{(snapshot.entitlement_trace || []).map((step, index) => <div key={step.step} className={`rounded-2xl px-4 py-3 ${step.matched ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-600"}`}><span className="text-xs font-bold">{index + 1}</span><p className="mt-1 text-sm font-semibold">{title(step.step)}</p><p className="mt-1 text-xs">{step.matched ? "Matched" : "Not matched"}</p></div>)}</div>
              </article>
              <article className={`rounded-[18px] border p-5 shadow-sm ${state.mismatch_detected ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}><h3 className="text-lg font-semibold text-slate-950">State comparison</h3><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Database plan" value={title(state.database_plan)} /><Metric label="Database subscription" value={title(state.database_subscription)} /><Metric label="Trial" value={title(state.trial_status)} /><Metric label="Resolved" value={title(state.resolved_entitlement)} tone="emerald" /><Metric label="Quota" value={title(state.quota_profile)} /><Metric label="Provider" value={title(state.provider_status)} /><Metric label="Latest checkout" value={title(state.latest_checkout_status)} /><Metric label="Provider token" value={state.provider_token_recorded ? "Recorded securely" : "Not recorded"} tone={state.provider_token_recorded ? "emerald" : "amber"} /></div>{state.mismatch_detected ? <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-900">{state.mismatch_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p className="mt-4 text-sm text-emerald-700">No state mismatch detected.</p>}</article>
              <article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-semibold text-slate-950">Quota trace</h3><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(snapshot.usage?.features || []).map((feature) => <Metric key={feature.feature} label={feature.label} value={feature.unlimited ? `${feature.used} used · Unlimited` : `${feature.used} / ${feature.limit} · ${feature.remaining} remaining`} tone={feature.remaining === 0 ? "rose" : "slate"} />)}</div></article>
            </> : <div className="rounded-[18px] border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Select a user to inspect the authoritative account, trial, subscription, quota, payment, refund, authentication, and generation state.</div>}
          </div>
        </div>
      ) : null}

      {tab === "timeline" ? <article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xl font-semibold text-slate-950">{selectedEmail ? `${selectedEmail} timeline` : "User timeline"}</h3><p className="mt-2 text-sm text-slate-500">Authentication, trial, billing, generation, quota, and admin events are ordered newest first.</p><div className="mt-5"><Timeline items={snapshot?.timeline || []} /></div></article> : null}

      {tab === "entitlement" ? <article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xl font-semibold text-slate-950">Entitlement trace</h3><p className="mt-2 text-sm text-slate-500">This is the real resolver decision, not an independent dashboard calculation.</p>{snapshot ? <><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Effective entitlement" value={title(entitlement.entitlement)} tone="emerald" /><Metric label="Reason" value={title(entitlement.reason)} tone="sky" /><Metric label="Plan source" value={title(entitlement.source || entitlement.reason)} /></div><div className="mt-5 space-y-2">{(snapshot.entitlement_trace || []).map((step, index) => <div key={step.step} className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${step.matched ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-600"}`}><span>{index + 1}. {title(step.step)}</span><strong>{step.matched ? "YES" : "NO"}</strong></div>)}</div></> : <p className="mt-5 text-sm text-slate-500">Select a user in User Inspector.</p>}</article> : null}

      {tab === "trials" ? <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]"><article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-semibold text-slate-950">Free-trial accounts</h3><p className="mt-2 text-sm text-slate-500">Provider-backed trial records and permanent trial-use state.</p></div><div className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">{overview?.trial_counts?.active || 0} active</div></div><div className="mt-5 max-h-[560px] space-y-2 overflow-y-auto">{trialUsers.length ? trialUsers.map((user) => <button key={user.email} type="button" onClick={() => void inspectUser(user.email, "trials")} className={`w-full rounded-2xl border p-4 text-left ${selectedEmail === user.email ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}><div className="flex flex-wrap items-center justify-between gap-2"><strong className="break-all text-sm text-slate-900">{user.email}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${user.trial_status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>{title(user.trial_status)}</span></div><p className="mt-2 text-xs text-slate-500">Ends {formatDate(user.trial_ends_at || user.current_period_end)}</p><p className="mt-1 text-xs text-slate-500">PayFast {title(user.provider_status || user.latest_checkout_status || "not recorded")}</p></button>) : <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">No eligible, active, used, converted, or expired trial accounts were returned.</p>}</div></article><article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xl font-semibold text-slate-950">Selected trial trace</h3>{snapshot ? <><p className="mt-2 break-all text-sm text-slate-500">{snapshot.account?.email}</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Eligible" value={snapshot.trial?.eligible ? "Yes" : "No"} tone={snapshot.trial?.eligible ? "emerald" : "slate"} /><Metric label="Eligibility reason" value={title(snapshot.trial?.eligibility_reason)} /><Metric label="Account sessions" value={`${snapshot.trial?.session_count || 0} / ${snapshot.trial?.sessions_required || 3}`} /><Metric label="Trial status" value={title(snapshot.trial?.status)} /><Metric label="Started" value={formatDate(snapshot.trial?.started_at)} /><Metric label="Ends" value={formatDate(snapshot.trial?.ends_at)} /><Metric label="Already used" value={snapshot.trial?.used ? "Yes" : "No"} /><Metric label="Permanent claim" value={snapshot.trial?.claim?.id ? "Recorded" : "Not recorded"} tone={snapshot.trial?.claim?.id ? "emerald" : "amber"} /><Metric label="Payment fingerprint" value={snapshot.trial?.claim?.payment_fingerprint_recorded ? "Hashed record" : "Provider did not supply one"} /><Metric label="Provider token" value={snapshot.trial?.claim?.provider_token_recorded ? "Hashed record" : "Not recorded"} /><Metric label="Remaining" value={`${Math.floor((snapshot.trial?.remaining_seconds || 0) / 3600)} hours`} /><Metric label="Effective access" value={title(entitlement.entitlement)} tone="sky" /></div><div className="mt-5 space-y-2">{(snapshot.checkout_sessions || []).map((checkout) => <div key={checkout.id} className="rounded-2xl bg-slate-50 p-4 text-sm"><div className="flex justify-between gap-3"><strong>{title(checkout.plan_id)}</strong><span>{title(checkout.status)}</span></div><p className="mt-2 text-xs text-slate-500">Checkout {checkout.id} · {formatDate(checkout.updated_at)}</p></div>)}</div></> : <p className="mt-5 text-sm text-slate-500">Select a trial account to view eligibility, checkout, entitlement, and permanent-use evidence.</p>}</article></div> : null}

      {tab === "quotas" ? <article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xl font-semibold text-slate-950">Quota trace</h3><p className="mt-2 text-sm text-slate-500">Server-side usage and remaining allowance from the active quota profile.</p>{snapshot ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(snapshot.usage?.features || []).map((feature) => <Metric key={feature.feature} label={feature.label} value={feature.unlimited ? `${feature.used} used · Unlimited` : `${feature.used} / ${feature.limit} · ${feature.remaining} remaining`} tone={feature.remaining === 0 ? "rose" : "slate"} />)}</div> : <p className="mt-5 text-sm text-slate-500">Select a user in User Inspector.</p>}</article> : null}

      {tab === "billing" && pendingCheckout && !state.provider_token_recorded ? <article className="rounded-[18px] border border-amber-200 bg-amber-50 p-5 shadow-sm"><h3 className="text-xl font-semibold text-slate-950">Recover missed PayFast confirmation</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-amber-900">Use this only for the existing subscription shown for this customer in PayFast. Mabaso AI will query PayFast and verify that the subscription is active, has not charged, uses the expected recurring amount, and has a future first billing date before changing any local trial access.</p><p className="mt-3 break-all text-xs font-semibold text-amber-800">Pending checkout: {pendingCheckout.id}</p><div className="mt-4 flex flex-col gap-3 lg:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">PayFast subscription token</span><input type="password" autoComplete="off" value={recoveryToken} onChange={(event) => setRecoveryToken(event.target.value)} placeholder="Paste the PayFast subscription token" className="w-full rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-indigo-400" /></label><button type="button" onClick={() => void recoverPayFastTrial()} disabled={recoveryBusy || recoveryToken.trim().length < 20} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{recoveryBusy ? "Verifying with PayFast..." : "Verify and recover trial"}</button></div>{recoveryMessage ? <p className="mt-3 text-sm font-semibold text-emerald-800" role="status">{recoveryMessage}</p> : null}<p className="mt-3 text-xs leading-5 text-amber-800">The token is sent only to the protected backend and is never displayed in diagnostics, returned by the API, or written to audit metadata.</p></article> : null}

      {tab === "billing" ? <div className="grid gap-5 xl:grid-cols-2"><article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xl font-semibold text-slate-950">Payment trace</h3><div className="mt-4 space-y-3">{(snapshot?.payments || []).length ? snapshot.payments.map((payment) => <div key={payment.id} className="rounded-2xl bg-slate-50 p-4 text-sm"><div className="flex justify-between gap-3"><strong>{title(payment.plan_id)}</strong><span>{payment.currency || "ZAR"} {payment.amount || payment.amount_zar || "--"}</span></div><p className="mt-2 text-slate-500">{title(payment.payment_status || payment.status)} · {formatDate(payment.paid_at || payment.created_at)}</p><p className="mt-1 break-all font-mono text-xs text-slate-400">{payment.pf_payment_id || payment.provider_payment_id || "No provider ID"}</p></div>) : <p className="text-sm text-slate-500">No payments for the selected user.</p>}</div></article><article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xl font-semibold text-slate-950">Refund trace</h3><div className="mt-4 space-y-3">{(snapshot?.refunds || []).length ? snapshot.refunds.map((refund) => <div key={refund.id} className="rounded-2xl bg-slate-50 p-4 text-sm"><div className="flex justify-between gap-3"><strong>{title(refund.status)}</strong><span>{refund.currency} {refund.requested_amount}</span></div><p className="mt-2 text-slate-500">{title(refund.reason_code)} · {formatDate(refund.requested_at)}</p>{refund.provider_error ? <p className="mt-2 text-rose-700">{refund.provider_error}</p> : null}</div>) : <p className="text-sm text-slate-500">No refund requests for the selected user.</p>}</div></article></div> : null}

      {tab === "authentication" ? <article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xl font-semibold text-slate-950">Authentication trace</h3><p className="mt-2 text-sm text-slate-500">Safe session metadata only; tokens, cookies, passwords, and OAuth secrets are never displayed.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(snapshot?.sessions || []).map((session) => <div key={session.session_id} className="rounded-2xl bg-slate-50 p-4 text-sm"><strong>{title(session.status)}</strong><p className="mt-2 text-slate-500">Login {formatDate(session.login_at)}</p><p className="mt-1 text-slate-500">Last activity {formatDate(session.last_activity_at)}</p><p className="mt-1 text-slate-500">{session.city || "Unknown city"}, {session.country || "Unknown country"}</p></div>)}</div></article> : null}

      {tab === "generations" ? <article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xl font-semibold text-slate-950">Background generation jobs</h3><div className="mt-5 space-y-3">{(snapshot?.generations || []).length ? snapshot.generations.map((generation) => <div key={generation.generation_id} className="rounded-2xl bg-slate-50 p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{title(generation.status)}</strong><span>{title(generation.activity_type)}</span></div><p className="mt-2 break-all font-mono text-xs text-slate-500">{generation.generation_id}</p><p className="mt-2 text-slate-500">Started {formatDate(generation.started_at)} · Updated {formatDate(generation.updated_at)}</p></div>) : <p className="text-sm text-slate-500">No background generations for the selected user.</p>}</div></article> : null}

      {tab === "events" ? <article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xl font-semibold text-slate-950">API errors and trace IDs</h3><p className="mt-2 text-sm text-slate-500">Only sanitized operational messages are shown. High-volume token updates are not logged.</p><div className="mt-5"><Timeline items={recentErrors} /></div></article> : null}

      {tab === "system" ? <div className="grid gap-5 xl:grid-cols-2"><article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xl font-semibold text-slate-950">System health</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><Metric label="Backend" value={title(overview?.system_health?.backend)} tone="emerald" /><Metric label="Database" value={title(overview?.system_health?.database)} tone="emerald" /><Metric label="Database latency" value={`${overview?.system_health?.database_latency_ms ?? "--"} ms`} /><Metric label="Backend type" value={title(overview?.system_health?.database_backend)} /></div><div className={`mt-5 rounded-2xl border p-4 ${overview?.billing_sync_issue_count ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><div className="flex items-center justify-between gap-3"><strong className="text-slate-950">PayFast confirmation issues</strong><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{overview?.billing_sync_issue_count || 0}</span></div><div className="mt-3 space-y-2">{(overview?.billing_sync_issues || []).map((issue) => <button key={issue.id} type="button" onClick={() => void inspectUser(issue.email, "trials")} className="block w-full rounded-xl bg-white p-3 text-left text-sm"><strong className="break-all text-slate-900">{issue.email}</strong><span className="mt-1 block text-xs text-slate-500">{title(issue.plan_id)} · {title(issue.status)} · {formatDate(issue.created_at)}</span></button>)}</div>{!overview?.billing_sync_issue_count ? <p className="mt-2 text-sm text-emerald-800">No PayFast checkouts are waiting unusually long for verified confirmation.</p> : null}</div></article><article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xl font-semibold text-slate-950">Deployment and safe configuration</h3><div className="mt-4 space-y-2">{Object.entries(overview?.environment_checks || {}).map(([key, configured]) => <div key={key} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="font-mono text-slate-700">{key}</span><span className={configured ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{configured ? "Configured" : "Missing"}</span></div>)}</div><p className="mt-4 break-all text-xs text-slate-500">Backend commit: {overview?.deployment?.backend_commit || "unknown"}</p><p className="mt-2 break-all text-xs text-slate-500">PayFast notify URL: {overview?.deployment?.payfast_notify_url || "not configured"}</p></article></div> : null}

      {loading ? <div className="fixed bottom-5 right-5 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-xl" aria-live="polite">Loading diagnostics…</div> : null}
    </section>
  );
}
