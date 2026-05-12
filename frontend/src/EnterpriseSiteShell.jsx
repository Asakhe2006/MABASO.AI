import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";

import { findFooterLinksByRoutes, footerLinkGroups } from "./sitePageConfig";

const cardMotion = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: "easeOut" },
};

function toPascalCase(value = "") {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function resolveIcon(name = "") {
  const key = toPascalCase(name);
  return LucideIcons[key] || LucideIcons.Sparkles;
}

function SiteIcon({ name, className = "h-5 w-5" }) {
  const Icon = resolveIcon(name);
  return <Icon className={className} aria-hidden="true" />;
}

function pageActionLabel(access = "public") {
  if (access === "admin") return "Admin only";
  if (access === "login") return "Login required";
  return "Public";
}

function actionButtonClass(variant = "secondary") {
  if (variant === "primary") {
    return "bg-[linear-gradient(135deg,#2563eb,#38bdf8)] text-white shadow-[0_16px_45px_rgba(37,99,235,0.28)] hover:shadow-[0_20px_60px_rgba(56,189,248,0.3)]";
  }
  if (variant === "ghost") {
    return "border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]";
  }
  return "border border-white/10 bg-slate-950/75 text-white hover:bg-white/[0.08]";
}

function WorkspacePreview({ page }) {
  const previewTabs = page.hero?.preview?.tabs || [];
  const previewRows = page.hero?.preview?.rows || [];
  const previewHighlights = (page.contains || page.layout || [])
    .slice(0, 3)
    .map((item, index) => ({
      title: item.title || `Core surface ${index + 1}`,
      description: item.description || page.hero?.description || "This page explains how the feature works inside Mabaso AI.",
      badge: index === 0 ? "Primary" : "Linked",
    }));

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.22),transparent_28%),linear-gradient(160deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92),rgba(8,47,73,0.92))] p-5 shadow-[0_32px_90px_rgba(8,15,35,0.45)] backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.34em] text-cyan-100/70">{page.hero?.preview?.kicker || "Platform preview"}</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{page.hero?.preview?.title || page.title}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{page.hero?.preview?.subtitle || page.hero?.description}</p>
        </div>
        <div className="hidden rounded-full border border-cyan-200/15 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-cyan-100 lg:block">
          {pageActionLabel(page.access)}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {previewTabs.map((tab, index) => (
          <div
            key={`${page.route}-${tab}`}
            className={`rounded-full px-4 py-2 text-sm ${index === 0 ? "bg-white text-slate-950" : "border border-white/10 bg-slate-950/55 text-slate-200"}`}
          >
            {tab}
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
        <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Live product surface</p>
          <div className="mt-4 grid gap-3">
            {previewHighlights.map((item, index) => (
              <motion.div
                key={`${page.route}-preview-highlight-${item.title}`}
                className="rounded-[22px] border border-white/8 bg-slate-950/50 p-4"
                initial={{ opacity: 0.35, x: index * 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.08 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Workspace focus</p>
                    <p className="mt-3 text-base font-semibold text-white">{item.title}</p>
                  </div>
                  <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-100">
                    {item.badge}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-300">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="rounded-[26px] border border-white/10 bg-slate-950/72 p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">At a glance</p>
          <div className="mt-4 space-y-3">
            {previewRows.map((row) => (
              <div key={`${page.route}-${row.label}`} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{row.label}</p>
                <p className="mt-2 text-sm font-medium text-white">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CtaButton({ cta, onAction }) {
  return (
    <button
      type="button"
      onClick={() => onAction(cta)}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${actionButtonClass(cta.variant)}`}
    >
      <span>{cta.label}</span>
      <LucideIcons.ArrowRight className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function AuthOverlayButtons({
  onSignIn,
  onPrepareSignIn,
  googleButtonRef,
  isGoogleSigningIn,
}) {
  return (
    <div
      className="relative"
      onPointerDownCapture={() => onPrepareSignIn?.()}
      onClickCapture={() => onPrepareSignIn?.()}
    >
      <button
        type="button"
        onClick={onSignIn}
        className="w-full rounded-full bg-[linear-gradient(135deg,#2563eb,#38bdf8)] px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_60px_rgba(37,99,235,0.32)] transition hover:shadow-[0_24px_70px_rgba(37,99,235,0.38)]"
      >
        {isGoogleSigningIn ? "Finishing Google Sign-In..." : "Get Started"}
      </button>
      <div ref={googleButtonRef} className="absolute inset-0 z-20 overflow-hidden opacity-0" aria-hidden="true" />
    </div>
  );
}

function LoginWall({
  title,
  description,
  benefits = [],
  onSignIn,
  onPrepareSignIn,
  googleButtonRef,
  isGoogleSigningIn,
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[32px] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.95))] p-6 shadow-[0_36px_120px_rgba(2,6,23,0.58)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-cyan-100">
          <LucideIcons.LockKeyhole className="h-4 w-4" aria-hidden="true" />
          Secure access
        </div>
        <h3 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-white">{title}</h3>
        <p className="mt-4 text-sm leading-7 text-slate-300">{description}</p>
        {benefits.length ? (
          <div className="mt-6 grid gap-3">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <LucideIcons.CheckCircle2 className="mt-0.5 h-5 w-5 text-cyan-200" aria-hidden="true" />
                <p className="text-sm leading-7 text-slate-100">{benefit}</p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-6">
          <AuthOverlayButtons
            onSignIn={onSignIn}
            onPrepareSignIn={onPrepareSignIn}
            googleButtonRef={googleButtonRef}
            isGoogleSigningIn={isGoogleSigningIn}
          />
        </div>
      </div>
    </div>
  );
}

function ContactSupportForm({
  supportForm,
  onSupportFieldChange,
  onSupportSubmit,
  isAuthenticated = false,
}) {
  if (!supportForm) return null;
  const feedbackTone = /^support message (sent|saved)/i.test((supportForm.feedback || "").trim())
    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
    : "border-rose-300/20 bg-rose-500/10 text-rose-100";

  return (
    <section className="mt-8 rounded-[30px] border border-white/10 bg-slate-950/70 p-5 xl:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Live Support Form</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Send feedback directly to the Mabaso AI admin inbox</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            Describe what went wrong, what you expected to happen, and where it happened in the platform. Mabaso AI attaches account and browser context automatically when it is available.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200">
          {isAuthenticated ? "Signed-in support flow" : "Public support flow"}
        </span>
      </div>
      <label className="mt-6 block rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
        <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Message</span>
        <textarea
          value={supportForm.message || ""}
          onChange={(event) => onSupportFieldChange?.("message", event.target.value)}
          rows={10}
          placeholder="Tell us what happened, what page you were on, and what you expected to happen."
          className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-4 text-sm leading-7 text-white outline-none"
        />
      </label>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onSupportSubmit?.()}
          disabled={supportForm.isSubmitting}
          className="rounded-full bg-[linear-gradient(135deg,#2563eb,#38bdf8)] px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {supportForm.isSubmitting ? "Sending..." : "Send Support Message"}
        </button>
      </div>
      {supportForm.feedback ? (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${feedbackTone}`}>
          {supportForm.feedback}
        </div>
      ) : null}
    </section>
  );
}

export function EnterpriseFooter({ currentRoute = "/", onNavigate }) {
  return (
    <footer className="mt-12 rounded-[32px] border border-white/10 bg-slate-950/68 px-5 py-8 shadow-[0_26px_80px_rgba(2,8,23,0.38)] backdrop-blur xl:px-8">
      <div className="flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button type="button" onClick={() => onNavigate("/")} className="brand-mark text-left text-2xl font-black">
            Mabaso AI
          </button>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Enterprise-style learning infrastructure for lecture capture, AI study generation, collaboration, and academic workflows.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => onNavigate("/company/security")} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]">
            Security
          </button>
          <button type="button" onClick={() => onNavigate("/company/privacy")} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]">
            Privacy
          </button>
          <button type="button" onClick={() => onNavigate("/company/terms")} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]">
            Terms
          </button>
        </div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-4 xl:grid-cols-8">
        {footerLinkGroups.map((group) => (
          <div key={group.title}>
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500">{group.title}</p>
            <div className="mt-4 grid gap-2">
              {group.links.map((link) => {
                const active = currentRoute === link.route;
                return (
                  <button
                    key={link.route}
                    type="button"
                    onClick={() => onNavigate(link.route)}
                    className={`text-left text-sm transition ${active ? "text-cyan-200" : "text-slate-300 hover:text-white"}`}
                  >
                    {link.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}

function RelatedPageRail({ routes = [], title = "Related pages", onNavigate }) {
  const pages = findFooterLinksByRoutes(routes);
  if (!pages.length) return null;

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Explore next</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{title}</h3>
        </div>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {pages.map((page) => (
          <motion.button
            key={page.route}
            type="button"
            onClick={() => onNavigate(page.route)}
            {...cardMotion}
            className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 text-left shadow-[0_18px_60px_rgba(2,8,23,0.28)] transition hover:bg-white/[0.08]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{page.category}</p>
                <h4 className="mt-3 text-xl font-semibold text-white">{page.title}</h4>
              </div>
              <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
                {pageActionLabel(page.access)}
              </div>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">{page.metadata?.description}</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100">
              Open page
              <LucideIcons.ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

function FooterCrossLinks({ routes = [], onNavigate }) {
  const pages = findFooterLinksByRoutes(routes);
  if (!pages.length) return null;

  return (
    <section className="mt-10 rounded-[28px] border border-white/10 bg-slate-950/70 p-5">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Footer cross-links</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {pages.map((page) => (
          <button
            key={page.route}
            type="button"
            onClick={() => onNavigate(page.route)}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
          >
            {page.title}
          </button>
        ))}
      </div>
    </section>
  );
}

function ProtectedAdminState({ page, onNavigate, onOpenApp }) {
  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-glow hero-glow-left" />
        <div className="hero-glow hero-glow-right" />
        <div className="hero-grid" />
      </div>
      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[34px] border border-rose-300/12 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.16),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.97),rgba(15,23,42,0.94))] p-6 shadow-[0_34px_100px_rgba(2,6,23,0.55)] xl:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/15 bg-rose-400/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-rose-100">
            <LucideIcons.ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Access denied
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{page.adminGuard?.title || "Administrative access required"}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{page.adminGuard?.description || "This page is reserved for authorized Mabaso AI administrators."}</p>
          <div className="mt-8 grid gap-4 xl:grid-cols-3">
            {[
              "Security alerts and operational logs remain restricted to authorized administrators.",
              "Student-mode sessions should return to the main workspace or the public company trust pages.",
              "If you have admin access, enter through the protected admin mode flow after authentication.",
            ].map((message) => (
              <div key={message} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-slate-200">
                {message}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => onOpenApp("capture")} className="rounded-full bg-[linear-gradient(135deg,#2563eb,#38bdf8)] px-5 py-3 text-sm font-semibold text-white">
              Return to Student Workspace
            </button>
            <button type="button" onClick={() => onNavigate("/company/security")} className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white">
              Read Security
            </button>
          </div>
        </div>
        <RelatedPageRail routes={page.relatedPages} onNavigate={onNavigate} />
        <FooterCrossLinks routes={page.footerCrossLinks} onNavigate={onNavigate} />
        <EnterpriseFooter currentRoute={page.route} onNavigate={onNavigate} />
      </main>
    </div>
  );
}

export function EnterpriseSiteShell({
  page,
  currentRoute,
  isAuthenticated = false,
  adminBlocked = false,
  onNavigate,
  onOpenApp,
  onOpenSignIn,
  onPrepareSignIn,
  onOpenCreateAccount,
  onStartApple,
  googleButtonRef,
  isGoogleSigningIn = false,
  isAppleSigningIn = false,
  supportForm,
  onSupportFieldChange,
  onSupportSubmit,
}) {
  const [faqQuery, setFaqQuery] = useState("");
  const [activeFaqIndex, setActiveFaqIndex] = useState(0);

  const isLocked = !isAuthenticated && page.access !== "public";
  const filteredFaq = useMemo(() => {
    if (!page.faq?.length) return [];
    const normalizedQuery = faqQuery.trim().toLowerCase();
    if (!normalizedQuery) return page.faq;
    return page.faq.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(normalizedQuery));
  }, [faqQuery, page.faq]);

  if (adminBlocked) {
    return <ProtectedAdminState page={page} onNavigate={onNavigate} onOpenApp={onOpenApp} />;
  }

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-glow hero-glow-left" />
        <div className="hero-glow hero-glow-right" />
        <div className="hero-grid" />
      </div>
      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[30px] border border-white/10 bg-slate-950/70 px-5 py-4 shadow-[0_24px_80px_rgba(2,8,23,0.4)] backdrop-blur xl:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => onNavigate("/")} className="brand-mark text-left text-2xl font-black">
                Mabaso AI
              </button>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span>{page.category}</span>
                <span className="text-slate-600">/</span>
                <span>{page.title}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-cyan-100">
                  {pageActionLabel(page.access)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => onNavigate("/product/study-workspace")} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]">
                Explore Product
              </button>
              <button type="button" onClick={() => onOpenApp("capture")} className="rounded-full bg-[linear-gradient(135deg,#2563eb,#38bdf8)] px-4 py-2 text-sm font-semibold text-white">
                {isAuthenticated ? "Open App" : "Start with Capture"}
              </button>
            </div>
          </div>
        </header>

        <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.9),rgba(15,23,42,0.82))] p-6 shadow-[0_32px_100px_rgba(2,8,23,0.42)] backdrop-blur xl:p-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <motion.div {...cardMotion}>
              <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">{page.hero?.eyebrow || `${page.category} / ${page.title}`}</p>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl xl:text-6xl">{page.hero?.headline || page.title}</h1>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-slate-300 sm:text-base">{page.hero?.description || page.metadata?.description}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                {(page.hero?.ctas || []).map((cta) => (
                  <CtaButton key={`${page.route}-${cta.label}`} cta={cta} onAction={(item) => {
                    if (item.action === "route") {
                      onNavigate(item.target);
                      return;
                    }
                    if (item.action === "open-signin") {
                      onPrepareSignIn?.(page.route);
                      onOpenSignIn();
                      return;
                    }
                    if (item.action === "open-app") {
                      onOpenApp(item.target);
                      return;
                    }
                    onNavigate("/");
                  }} />
                ))}
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {(page.hero?.metrics || []).map((metric) => (
                  <div key={`${page.route}-${metric.label}`} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{metric.label}</p>
                    <p className="mt-3 text-xl font-semibold text-white">{metric.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div {...cardMotion}>
              <WorkspacePreview page={page} />
            </motion.div>
          </div>
        </section>

        <div className="relative mt-8">
          <div className={`${isLocked ? "pointer-events-none select-none blur-[12px] saturate-[0.65] opacity-45" : ""}`}>
            {page.contains?.length ? (
              <section className="grid gap-4 xl:grid-cols-3">
                {page.contains.map((item, index) => (
                  <motion.div
                    key={`${page.route}-contains-${item.title}`}
                    {...cardMotion}
                    transition={{ ...cardMotion.transition, delay: index * 0.05 }}
                    className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(2,8,23,0.25)]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-100">
                      <SiteIcon name={item.icon} />
                    </div>
                    <h2 className="mt-5 text-xl font-semibold text-white">{item.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
                  </motion.div>
                ))}
              </section>
            ) : null}

            <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <motion.div {...cardMotion} className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 xl:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Layout architecture</p>
                <div className="mt-5 grid gap-4">
                  {page.layout?.map((item) => (
                    <div key={`${page.route}-layout-${item.title}`} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{item.description}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
              <motion.div {...cardMotion} className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 xl:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Modules and page contents</p>
                <div className="mt-5 grid gap-4">
                  {page.modules?.map((module) => (
                    <div key={`${page.route}-module-${module.title}`} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-cyan-100">
                          <SiteIcon name={module.icon} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-white">{module.title}</h3>
                          <div className="mt-3 grid gap-2">
                            {module.items?.map((item) => (
                              <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-3">
                                <LucideIcons.Check className="mt-1 h-4 w-4 text-cyan-100" aria-hidden="true" />
                                <p className="text-sm leading-7 text-slate-200">{item}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </section>

            {page.workflow?.length ? (
              <section className="mt-8 rounded-[30px] border border-white/10 bg-slate-950/70 p-5 xl:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Workflow</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Step-by-step platform flow</h2>
                <div className="mt-6 grid gap-4 xl:grid-cols-3">
                  {page.workflow.map((item, index) => (
                    <motion.div key={`${page.route}-workflow-${item}`} {...cardMotion} transition={{ ...cardMotion.transition, delay: index * 0.05 }} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/12 text-sm font-semibold text-cyan-100">{index + 1}</div>
                        <p className="text-sm leading-7 text-slate-100">{item}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            ) : null}

            {page.fileGroups?.length ? (
              <section className="mt-8 grid gap-4 xl:grid-cols-3">
                {page.fileGroups.map((group) => (
                  <motion.div key={`${page.route}-files-${group.label}`} {...cardMotion} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{group.label}</p>
                    <div className="mt-4 grid gap-2">
                      {group.items?.map((item) => (
                        <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-slate-100">
                          {item}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </section>
            ) : null}

            {page.codeSamples?.length ? (
              <section className="mt-8 rounded-[30px] border border-white/10 bg-slate-950/70 p-5 xl:p-6">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Developer examples</p>
                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  {page.codeSamples.map((sample) => (
                    <div key={`${page.route}-code-${sample.title}`} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#020617]">
                      <div className="border-b border-white/10 bg-white/[0.04] px-4 py-3">
                        <p className="text-sm font-semibold text-white">{sample.title}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">{sample.language}</p>
                      </div>
                      <pre className="overflow-x-auto px-4 py-4 text-xs leading-6 text-slate-200"><code>{sample.code}</code></pre>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {page.route === "/support/contact-support" ? (
              <ContactSupportForm
                supportForm={supportForm}
                onSupportFieldChange={onSupportFieldChange}
                onSupportSubmit={onSupportSubmit}
                isAuthenticated={isAuthenticated}
              />
            ) : null}

            {page.faq?.length ? (
              <section className="mt-8 rounded-[30px] border border-white/10 bg-slate-950/70 p-5 xl:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">FAQ</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Questions and answers</h2>
                  </div>
                  <input
                    value={faqQuery}
                    onChange={(event) => setFaqQuery(event.target.value)}
                    placeholder="Search this page"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none lg:max-w-sm"
                  />
                </div>
                <div className="mt-6 grid gap-3">
                  {(filteredFaq.length ? filteredFaq : [{ question: page.emptyState?.title || "Nothing matched", answer: page.emptyState?.description || "Try a different search phrase." }]).map((item, index) => {
                    const isOpen = index === activeFaqIndex;
                    return (
                      <div key={`${page.route}-faq-${item.question}`} className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04]">
                        <button
                          type="button"
                          onClick={() => setActiveFaqIndex(isOpen ? -1 : index)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                        >
                          <span className="text-sm font-semibold text-white">{item.question}</span>
                          {isOpen ? <LucideIcons.Minus className="h-4 w-4 text-cyan-100" /> : <LucideIcons.Plus className="h-4 w-4 text-cyan-100" />}
                        </button>
                        {isOpen ? <div className="border-t border-white/10 px-4 py-4 text-sm leading-7 text-slate-300">{item.answer}</div> : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {page.markdown ? (
              <section className="mt-8 rounded-[30px] border border-white/10 bg-slate-950/70 p-5 xl:p-6">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Full page content</p>
                <div className="notes-markdown mt-5 max-w-none rounded-[26px] bg-white p-5 text-slate-900 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-6">
                  <ReactMarkdown>{page.markdown}</ReactMarkdown>
                </div>
              </section>
            ) : null}

            <section className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
              <motion.div {...cardMotion} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Suggested visuals</p>
                <div className="mt-4 grid gap-2">
                  {(page.visuals || []).map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3">
                      <LucideIcons.Sparkles className="mt-1 h-4 w-4 text-cyan-100" aria-hidden="true" />
                      <p className="text-sm leading-7 text-slate-100">{item}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
              <motion.div {...cardMotion} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Empty state</p>
                <h3 className="mt-4 text-xl font-semibold text-white">{page.emptyState?.title || "Ready for content"}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{page.emptyState?.description}</p>
              </motion.div>
              <motion.div {...cardMotion} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Enterprise design notes</p>
                <div className="mt-4 grid gap-2">
                  {(page.designNotes || []).map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-sm leading-7 text-slate-200">
                      {item}
                    </div>
                  ))}
                </div>
              </motion.div>
            </section>
          </div>

          {isLocked ? (
            <LoginWall
              title={page.lockedPreview?.title || `Sign in to unlock ${page.title}`}
              description={page.lockedPreview?.description || "This route contains protected Mabaso AI content that becomes available after authentication."}
              benefits={page.lockedPreview?.benefits || []}
              onSignIn={onOpenSignIn}
              onPrepareSignIn={() => onPrepareSignIn?.(page.route)}
              googleButtonRef={googleButtonRef}
              isGoogleSigningIn={isGoogleSigningIn}
            />
          ) : null}
        </div>

        <RelatedPageRail routes={page.relatedPages} onNavigate={onNavigate} />
        <FooterCrossLinks routes={page.footerCrossLinks} onNavigate={onNavigate} />
        <EnterpriseFooter currentRoute={currentRoute} onNavigate={onNavigate} />
      </main>
    </div>
  );
}

export function ProtectedWorkspacePreview({
  route,
  onNavigate,
  onOpenApp,
  onOpenSignIn,
  onPrepareSignIn,
  onOpenCreateAccount,
  onStartApple,
  googleButtonRef,
  isGoogleSigningIn = false,
  isAppleSigningIn = false,
}) {
  const previewPage = {
    route: route.route,
    title: route.title,
    category: "Workspace",
    access: route.access,
    metadata: {
      title: `${route.title} | Mabaso AI`,
      description: route.description,
    },
    hero: {
      eyebrow: "Protected Workspace Route",
      headline: route.title,
      description: route.description,
      ctas: [
        { label: "Sign In", action: "open-signin", variant: "primary" },
        { label: "View Product Pages", action: "route", target: "/product/study-workspace", variant: "secondary" },
      ],
      metrics: [
        { label: "Access", value: "Login required" },
        { label: "Surface", value: "Live workspace" },
        { label: "Protection", value: "Session-gated" },
      ],
      preview: {
        kicker: "Protected preview",
        title: "Blurred workspace shell with secure access overlay",
        subtitle: "This route contains live lecture data, generated study content, exports, or collaboration state and stays locked until the user authenticates.",
        tabs: ["Workspace", "History", "Exports", "Security"],
        rows: [
          { label: "Data type", value: "User-linked lecture content" },
          { label: "Reason for lock", value: "Uploads, history, or generated outputs" },
          { label: "Entry point", value: "Sign in to continue" },
        ],
      },
    },
    contains: [
      { icon: "shield-check", title: "Authenticated session required", description: "This area holds user-linked study materials, generated outputs, or collaboration context." },
      { icon: "lock-keyhole", title: "Blurred preview by default", description: "Unauthenticated visitors see a darkened workspace preview rather than live academic data." },
      { icon: "arrow-right-left", title: "Direct app handoff", description: "Once signed in, the visitor is routed into the real Mabaso AI workspace route." },
    ],
    layout: [
      { title: "Protected workspace shell", description: "Present the app route like a premium blurred preview instead of a blank redirect." },
      { title: "Session benefit framing", description: "Explain why authentication exists: transcripts, history, exports, and collaboration are private." },
      { title: "Secure CTA rail", description: "Keep clear actions for sign-in, Google, Apple, and account creation." },
    ],
    modules: [
      {
        icon: "layout-dashboard",
        title: "Route contents",
        items: [
          route.description,
          "Private lecture material and generated results",
          "Authenticated navigation into the full app shell",
        ],
      },
    ],
    visuals: [
      "Blurred workspace cards with premium navy gradients",
      "Glassmorphism login wall with enterprise trust language",
      "Protected-route chips and session-aware messaging",
    ],
    emptyState: {
      title: "Protected route preview ready",
      description: "The route preview remains visible even before login so visitors understand what unlocks after authentication.",
    },
    designNotes: [
      "Protected routes should feel intentionally gated, not broken.",
      "The overlay needs to be reassuring and premium rather than punitive.",
      "Public visitors should still understand the value behind the login wall.",
    ],
    relatedPages: ["/product/study-workspace", "/product/lecture-capture", "/company/security"],
    footerCrossLinks: ["/company/privacy", "/company/terms", "/support/help-center"],
    lockedPreview: {
      title: "Secure workspace access starts with sign-in",
      description: "This route contains lecture uploads, AI-generated study content, saved materials, or collaboration context that Mabaso AI protects behind authenticated sessions.",
      benefits: [
        "Open your live lecture capture and study workspace",
        "Protect transcripts, downloads, and saved materials",
        "Keep collaboration rooms and exports tied to your account",
      ],
    },
  };

  return (
    <EnterpriseSiteShell
      page={previewPage}
      currentRoute={route.route}
      isAuthenticated={false}
      onNavigate={onNavigate}
      onOpenApp={onOpenApp}
      onOpenSignIn={onOpenSignIn}
      onPrepareSignIn={onPrepareSignIn}
      onOpenCreateAccount={onOpenCreateAccount}
      onStartApple={onStartApple}
      googleButtonRef={googleButtonRef}
      isGoogleSigningIn={isGoogleSigningIn}
      isAppleSigningIn={isAppleSigningIn}
    />
  );
}
