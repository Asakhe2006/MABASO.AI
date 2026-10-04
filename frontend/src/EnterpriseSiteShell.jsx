import { createElement, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion as Motion } from "framer-motion";
import * as LucideIcons from "lucide-react";

import { findFooterLinksByRoutes, footerLinkGroups } from "./sitePageConfig";

const cardMotion = {
  initial: false,
  transition: { duration: 0 },
};

const INTERNAL_PLANNING_COPY = /suggested visual|visual direction|public visitors?|public page|page should|layout architecture|design notes|placeholder|polished sample|premium .*cards?|what it should feel like|hero \+|cta rail/i;

function isUsefulPublicCopy(value = "") {
  const text = String(value || "").trim();
  return Boolean(text) && !INTERNAL_PLANNING_COPY.test(text);
}

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
  return createElement(resolveIcon(name), { className, "aria-hidden": "true" });
}

function pageActionLabel(access = "public") {
  if (access === "admin") return "Restricted";
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
  const previewHighlights = (page.contains || [])
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
            {previewHighlights.map((item) => (
              <div
                key={`${page.route}-preview-highlight-${item.title}`}
                className="rounded-[22px] border border-white/8 bg-slate-950/50 p-4"
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
              </div>
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
  onPrepareSignIn,
  googleButtonRef,
  isGoogleSigningIn,
}) {
  return (
    <div
      className="rounded-[24px] border border-cyan-300/15 bg-white/[0.04] p-4"
      onPointerDownCapture={() => onPrepareSignIn?.()}
      onClickCapture={() => onPrepareSignIn?.()}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Get Started</p>
          <p className="mt-1 text-xs leading-6 text-slate-300">Use the same Google sign-in flow directly from here.</p>
        </div>
        <LucideIcons.ArrowRight className="h-5 w-5 text-cyan-100" aria-hidden="true" />
      </div>
      <div ref={googleButtonRef} data-fullwidth="true" className="mt-4 min-h-[46px] w-full" />
      {isGoogleSigningIn ? <p className="mt-3 text-xs text-cyan-100">Finishing Google Sign-In...</p> : null}
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
  supportForm = {},
  onSupportFieldChange,
  onSupportSubmit,
  isAuthenticated = false,
}) {
  const categories = supportForm.categories || ["General help", "Account access", "Study tools", "Collaboration", "Billing and payments"];
  return (
    <section className="mt-8 rounded-[30px] border border-white/10 bg-slate-950/70 p-5 xl:p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Mabaso AI Support</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Send your question securely.</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Describe the page you were using, what you clicked, and what you expected to happen. The message is delivered to Mabaso AI Support without publishing the support mailbox.</p>
      <form className="mt-6 grid gap-4" onSubmit={(event) => { event.preventDefault(); onSupportSubmit?.(); }}>
        {!isAuthenticated ? <label><span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Your email</span><input type="email" required value={supportForm.email || ""} onChange={(event) => onSupportFieldChange?.("email", event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300" placeholder="you@example.com" /></label> : null}
        <label><span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Topic</span><select value={supportForm.category || categories[0]} onChange={(event) => onSupportFieldChange?.("category", event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#07140f] px-4 py-3 text-sm text-white outline-none focus:border-emerald-300">{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label><span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Question</span><textarea required rows={6} maxLength={3000} value={supportForm.message || ""} onChange={(event) => onSupportFieldChange?.("message", event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none focus:border-emerald-300" placeholder="Tell us what you need help with..." /></label>
        <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={supportForm.isSubmitting || !(supportForm.message || "").trim()} className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-bold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-50">{supportForm.isSubmitting ? "Sending..." : "Send to Mabaso AI Support"}</button>{supportForm.feedback ? <p className="text-sm text-emerald-100" role="status">{supportForm.feedback}</p> : null}</div>
      </form>
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
      <div className="enterprise-provider-footer">
        <span>AI generation powered by</span>
        <strong className="provider-mark provider-openai"><span aria-hidden="true">◎</span> OpenAI</strong>
        <strong className="provider-mark provider-gemini"><LucideIcons.Sparkles aria-hidden="true" /> Google Gemini</strong>
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
          <Motion.button
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
          </Motion.button>
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
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{page.adminGuard?.title || "Restricted access required"}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{page.adminGuard?.description || "This page is reserved for authorized Mabaso AI operators."}</p>
          <div className="mt-8 grid gap-4 xl:grid-cols-3">
            {[
              "Security alerts and operational logs remain restricted to authorized operators.",
              "Student-mode sessions should return to the main workspace or the public company trust pages.",
              "If you have elevated access, enter through the protected mode flow after authentication.",
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

function EnterpriseNavigation({ currentRoute, isAuthenticated, onNavigate, onOpenApp, onOpenSignIn, onPrepareSignIn }) {
  const [isOpen, setIsOpen] = useState(false);
  const groups = [
    { label: "Platform", links: footerLinkGroups.find((group) => group.title === "Product")?.links.slice(0, 5) || [] },
    { label: "Features", links: [
      ...(footerLinkGroups.find((group) => group.title === "AI Tools")?.links || []),
      { label: "Flashcards", route: "/product/flashcards" },
      { label: "Test Generator", route: "/product/ai-test-generator" },
    ] },
    { label: "Resources", links: footerLinkGroups.find((group) => group.title === "Resources")?.links || [] },
  ];
  const navigate = (route) => {
    setIsOpen(false);
    onNavigate(route);
  };
  const signIn = () => {
    onPrepareSignIn?.(currentRoute);
    onOpenSignIn?.();
  };
  return (
    <header className="enterprise-public-nav">
      <button type="button" onClick={() => navigate("/")} className="enterprise-public-brand">Mabaso AI</button>
      <button type="button" onClick={() => setIsOpen((open) => !open)} className="enterprise-public-menu" aria-label={isOpen ? "Close navigation" : "Open navigation"} aria-expanded={isOpen}>
        {isOpen ? <LucideIcons.X aria-hidden="true" /> : <LucideIcons.Menu aria-hidden="true" />}
      </button>
      <nav className={`enterprise-public-links ${isOpen ? "is-open" : ""}`} aria-label="Mabaso AI pages">
        {groups.map((group) => (
          <details key={group.label}>
            <summary>{group.label}<LucideIcons.ChevronDown aria-hidden="true" /></summary>
            <div>
              {group.links.map((link) => <button key={link.route} type="button" className={currentRoute === link.route ? "is-active" : ""} onClick={() => navigate(link.route)}>{link.label}</button>)}
            </div>
          </details>
        ))}
        <button type="button" className={currentRoute === "/pricing" ? "is-active" : ""} onClick={() => navigate("/pricing")}>Pricing</button>
        <button type="button" onClick={() => navigate("/for-institutions")}>For Institutions</button>
      </nav>
      <div className="enterprise-public-actions">
        {isAuthenticated ? (
          <button type="button" className="enterprise-public-primary" onClick={() => onOpenApp("capture")}>Open app</button>
        ) : (
          <>
            <button type="button" className="enterprise-public-signin" onClick={signIn}>Sign in</button>
            <button type="button" className="enterprise-public-primary" onClick={signIn}>Get started</button>
          </>
        )}
      </div>
    </header>
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
  googleButtonRef,
  isGoogleSigningIn = false,
  supportForm,
  onSupportFieldChange,
  onSupportSubmit,
}) {
  const [faqQuery, setFaqQuery] = useState("");
  const [activeFaqIndex, setActiveFaqIndex] = useState(0);
  const [activeDocumentSection, setActiveDocumentSection] = useState("overview");

  const isLocked = false; // Product documentation is public; only live user data is session-gated.
  const isProseOnlyGuide = page.route.startsWith("/collaboration/");
  const filteredFaq = useMemo(() => {
    if (!page.faq?.length) return [];
    const normalizedQuery = faqQuery.trim().toLowerCase();
    if (!normalizedQuery) return page.faq;
    return page.faq.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(normalizedQuery));
  }, [faqQuery, page.faq]);
  const visibleContains = (page.contains || []).filter((item) => isUsefulPublicCopy(`${item.title} ${item.description}`));
  // Public product pages should read like useful documentation, not a wall of
  // short marketing capability labels. Detailed tools remain available in the
  // authenticated workspace and in the page's full prose/FAQ sections.
  const visibleModules = [];
  const visibleWorkflow = (page.workflow || []).filter(isUsefulPublicCopy);
  const visibleFileGroups = (page.fileGroups || [])
    .map((group) => ({ ...group, items: (group.items || []).filter(isUsefulPublicCopy) }))
    .filter((group) => isUsefulPublicCopy(group.label) && group.items.length);
  const documentSections = useMemo(() => [
    { id: "overview", label: "Overview", visible: true },
    { id: "key-information", label: "Key information", visible: visibleContains.length > 0 },
    { id: "capabilities", label: "Details", visible: visibleModules.length > 0 },
    { id: "workflow", label: "How it works", visible: visibleWorkflow.length > 0 },
    { id: "supported-content", label: "Supported content", visible: visibleFileGroups.length > 0 },
    { id: "developer-examples", label: "Examples", visible: Boolean(page.codeSamples?.length) },
    { id: "questions", label: "Questions", visible: Boolean(page.faq?.length) },
    { id: "full-content", label: "Full details", visible: Boolean(page.markdown) },
  ].filter((section) => section.visible), [page.codeSamples, page.faq, page.markdown, visibleContains.length, visibleFileGroups.length, visibleModules.length, visibleWorkflow.length]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const nodes = documentSections.map((section) => document.getElementById(section.id)).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (visible?.target?.id) setActiveDocumentSection(visible.target.id);
    }, { rootMargin: "-18% 0px -68%", threshold: [0.05, 0.35] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [documentSections]);

  if (adminBlocked) {
    return <ProtectedAdminState page={page} onNavigate={onNavigate} onOpenApp={onOpenApp} />;
  }

  return (
    <div className="enterprise-site-shell min-h-screen bg-[var(--page-bg)] text-slate-100">
      <main className={`relative mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 ${isProseOnlyGuide ? "enterprise-prose-only-guide" : ""}`}>
        <EnterpriseNavigation currentRoute={currentRoute} isAuthenticated={isAuthenticated} onNavigate={onNavigate} onOpenApp={onOpenApp} onOpenSignIn={onOpenSignIn} onPrepareSignIn={onPrepareSignIn} />

        <section id="overview" className="enterprise-page-hero enterprise-document-header">
          <div>
            <Motion.div className="enterprise-page-copy" {...cardMotion}>
              <button type="button" onClick={() => onNavigate("/")} className="enterprise-document-breadcrumb"><LucideIcons.ChevronLeft className="h-4 w-4" aria-hidden="true" />Mabaso AI</button>
              <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">{page.hero?.eyebrow || `${page.category} / ${page.title}`}</p>
              <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl xl:text-5xl">{page.hero?.headline || page.title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{page.hero?.description || page.metadata?.description}</p>
              <p className="enterprise-document-updated">Last updated {page.updatedAt || "6 August 2026"}</p>
            </Motion.div>
          </div>
        </section>

        <nav className="enterprise-document-toc" aria-label="On this page">
          <details open>
            <summary>On this page<LucideIcons.ChevronDown className="h-4 w-4" aria-hidden="true" /></summary>
            <div>
              {documentSections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className={activeDocumentSection === section.id ? "is-active" : ""}>{section.label}</a>
              ))}
            </div>
          </details>
        </nav>

        {page.pricingPlans?.length ? (
          <section className="enterprise-pricing-section" aria-labelledby="pricing-plan-heading">
            <p className="enterprise-document-label">Current plans</p>
            <h2 id="pricing-plan-heading">Choose the level that matches your study load.</h2>
            <div className="enterprise-pricing-grid">
              {page.pricingPlans.map((plan) => (
                <article key={plan.name}>
                  <p>{plan.name}</p>
                  <h3>{plan.price}</h3>
                  {plan.alternatives ? <small>{plan.alternatives}</small> : null}
                  <p>{plan.description}</p>
                  <details>
                    <summary>Plan limits and access<LucideIcons.ChevronDown aria-hidden="true" /></summary>
                    <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                  </details>
                  <button type="button" onClick={() => onOpenApp(plan.name === "Free" ? "capture" : "payments")}>{plan.action}</button>
                </article>
              ))}
            </div>
            <p className="enterprise-pricing-note">Eligible accounts can begin the seven-day trial through PayFast. PayFast securely authorises the recurring subscription and collects the supported payment details; Mabaso AI never receives card credentials. The first subscription charge is scheduled after the displayed trial period unless the user cancels the renewal.</p>
          </section>
        ) : null}

        <div className="relative mt-8">
          <div className={`${isLocked ? "pointer-events-none select-none blur-[12px] saturate-[0.65] opacity-45" : ""}`}>
            {visibleContains.length ? (
              <section id="key-information" className="enterprise-public-prose-list">
                {visibleContains.map((item) => (
                  <Motion.div
                    key={`${page.route}-contains-${item.title}`}
                    {...cardMotion}
                    className="enterprise-public-prose-item"
                  >
                    <h2>{item.title}</h2>
                    <p>{item.description}</p>
                  </Motion.div>
                ))}
              </section>
            ) : null}

            {visibleModules.length ? (
              <section id="capabilities" className="enterprise-capability-list mt-8" aria-labelledby="enterprise-capabilities-heading">
                <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/70">Capabilities</p>
                <h2 id="enterprise-capabilities-heading" className="mt-2 text-2xl font-semibold text-white">What you can do</h2>
                <div className="mt-5 grid gap-x-8 gap-y-3 lg:grid-cols-2">
                  {visibleModules.map((module) => (
                    <div key={`${page.route}-module-${module.title}`} className="border-b border-emerald-100/10 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center text-emerald-300">
                          <SiteIcon name={module.icon} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-white">{module.title}</h3>
                          <div className="mt-2 grid gap-1.5">
                            {module.items?.map((item) => (
                              <div key={item} className="flex items-start gap-2.5 py-1">
                                <LucideIcons.Check className="mt-1 h-4 w-4 text-emerald-300" aria-hidden="true" />
                                <p className="text-sm leading-6 text-slate-200">{item}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {visibleWorkflow.length ? (
              <section id="workflow" className="enterprise-document-section">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Workflow</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">How Mabaso AI works</h2>
                <ol className="enterprise-workflow-prose">
                  {visibleWorkflow.map((item, index) => (
                    <li key={`${page.route}-workflow-${item}`}>
                      <span>{index + 1}</span>
                      <p>{item}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {visibleFileGroups.length ? (
              <section id="supported-content" className="enterprise-information-list mt-8">
                {visibleFileGroups.map((group) => (
                  <Motion.div key={`${page.route}-files-${group.label}`} {...cardMotion} className="enterprise-information-item">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{group.label}</p>
                    <div className="mt-4 grid gap-2">
                      {group.items?.map((item) => (
                        <div key={item} className="enterprise-inline-list-item">
                          {item}
                        </div>
                      ))}
                    </div>
                  </Motion.div>
                ))}
              </section>
            ) : null}

            {page.codeSamples?.length ? (
              <section id="developer-examples" className="enterprise-document-section">
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

            {["/support/contact-support", "/support/help-center"].includes(page.route) ? (
              <ContactSupportForm
                supportForm={supportForm}
                onSupportFieldChange={onSupportFieldChange}
                onSupportSubmit={onSupportSubmit}
                isAuthenticated={isAuthenticated}
              />
            ) : null}

            {page.faq?.length ? (
              <section id="questions" className="enterprise-document-section">
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
                      <div key={`${page.route}-faq-${item.question}`} className="enterprise-faq-row">
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
              <section id="full-content" className="enterprise-document-section">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Full page content</p>
                <div className="notes-markdown enterprise-legal-copy mt-5 max-w-none text-slate-100">
                  <ReactMarkdown>{page.markdown}</ReactMarkdown>
                </div>
              </section>
            ) : null}

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

        {page.hero?.ctas?.length ? (
          <section className="enterprise-document-next-actions" aria-label="Recommended next actions">
            <div className="flex flex-wrap gap-3">
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
          </section>
        ) : null}

        <RelatedPageRail routes={page.relatedPages} onNavigate={onNavigate} />
        <FooterCrossLinks routes={page.footerCrossLinks} onNavigate={onNavigate} />
        <EnterpriseFooter currentRoute={currentRoute} onNavigate={onNavigate} />
      </main>
    </div>
  );
}

const PROTECTED_ROUTE_DETAILS = {
  "/app/capture": [
    { title: "How lecture capture works", description: "Capture is the starting point for a study workspace. A student can record a lecture or add supported notes, slides, past papers, audio, video, or documents. Mabaso AI keeps the selected sources together so later tools use the correct course material instead of an unrelated previous workspace." },
    { title: "What happens after upload", description: "The platform validates the source, extracts usable text or audio, and shows a real loading state while processing continues. Once the source is ready, the student can create a Study Guide and then open formulas, worked examples, flashcards, quizzes, reports, presentations, podcasts, mind maps, and other supported tools separately." },
    { title: "Saving and privacy", description: "A completed workspace is saved to the signed-in account and appears in My Materials. Uploads, generated content, edits, and history are private unless the owner deliberately shares a supported item or adds it to an authorised Collaboration Room." },
  ],
  "/app/workspace": [
    { title: "One workspace for every study tool", description: "The Study Workspace keeps the transcript or source material, Study Guide, formulas, worked examples, flashcards, tests, notes, presentations, reports, podcasts, mind maps, and study images together. Opening a saved workspace restores the material that belongs to that history item." },
    { title: "Study Guide reading and editing", description: "Study Guides are organised as interactive textbook sections with definitions, explanations, examples, formulas, exam tips, common mistakes, summaries, and revision prompts when the source supports them. Students can edit, highlight, navigate slides in Focus Mode, and save changes back to their account." },
    { title: "Generation is deliberate", description: "Heavy tools do not run merely because a workspace opens. The student chooses which tool to generate, sees loading feedback for that tool, and keeps existing results while another supported output is created." },
  ],
  "/app/chat": [
    { title: "Private saved conversations", description: "AI Chat supports follow-up questions, saved conversation history, per-chat message limits, plan-based daily quotas, model modes, copying, editing a question, read aloud, code-block word wrap, and reopening an earlier discussion from Recents." },
    { title: "Responses can finish in the background", description: "A response continues when the student moves to another Mabaso AI page. When it finishes, an in-app notification can return the user to the exact answer, while an unread indicator remains on the conversation until it is opened." },
    { title: "Current information and source context", description: "Mabaso AI uses the current conversation and any authorised learning context. When a question genuinely requires current internet information, the web-search route uses real retrieved sources and citations rather than displaying a fake search status." },
  ],
  "/app/materials": [
    { title: "Persistent study history", description: "My Materials lists saved workspaces from the authenticated account. Recent metadata is loaded first so the history can appear quickly, while the complete Study Guide and other large outputs are fetched only when the student opens that item." },
    { title: "Continue where you stopped", description: "Opening a material restores its correct source, generated tools, edits, highlights, and available downloads. A downgrade or approved refund changes future access but does not delete the user's existing chats, materials, documents, or account." },
    { title: "Controlled sharing", description: "The material menu separates opening, copying a read-only share link, updating an existing shared snapshot, disabling a link, and deleting the owner's history item. A private workspace URL is never treated as a public share link." },
  ],
  "/app/payments": [
    { title: "Billing and usage in one account page", description: "My Payments shows the current plan or PayFast-authorised trial, remaining daily usage, PayFast transaction history, manual PayShap requests, refund status, and the controls for cancelling future recurring charges." },
    { title: "Trials, cancellation, and refunds are separate", description: "An eligible trial begins through PayFast so renewal can be authorised securely. Cancelling stops future recurring charges, while a refund request applies to a particular successful charge and is checked independently against payment status, remaining refundable amount, usage, country-at-purchase policy, and applicable consumer rights." },
    { title: "Payment support", description: "The page includes a secure payment-query form. Users can send the payment reference and an explanation to Mabaso AI Support without the website exposing the support mailbox or requesting unnecessary banking secrets." },
  ],
  "/app/timetable": [
    { title: "Plan a realistic study week", description: "The Study Timetable combines subjects, priorities, performance, examination dates, available days, preferred session lengths, and break choices. The result is editable and stays linked to the signed-in account." },
    { title: "Fast restoration", description: "A cached timetable appears immediately when available while the authoritative account copy refreshes in the background. The interface distinguishes loading from an empty timetable so slow connections do not falsely claim that no plan exists." },
    { title: "Track actual progress", description: "Students mark sessions complete only after doing the work. Missed and completed sessions remain visible so the schedule can support honest revision planning rather than simply producing a decorative calendar." },
  ],
  "/app/collaboration": [
    { title: "Rooms are permission-controlled study spaces", description: "A room owner creates the room, invites students, manages settings, and can approve discovered users who request access. Pending users cannot read private chat, board items, member data, shared files, or Room AI context until membership is approved." },
    { title: "Communication and shared course material", description: "Approved members can use room chat, voice notes, the collaboration board, shared images and files, and supported Mabaso study materials. Shared Study Guides, formulas, worked examples, notes, flashcards, quizzes, presentations, reports, podcasts, and mind maps keep their saved room history instead of being regenerated whenever the room opens." },
    { title: "Realtime activity and owner controls", description: "Meaningful room actions create a concise activity record for authorised members. Admin Control can synchronise the owner's supported room view for followers, while leaving or removal immediately stops private realtime delivery and backend access." },
  ],
  "/study-session": [
    { title: "A distraction-reduced revision session", description: "Study Session provides a full-screen timer, active material context, notes, focus tracking, and text-based study help. It is intended for working through a planned block rather than generating unrelated content." },
    { title: "Progress remains connected", description: "The session uses the signed-in workspace and timetable context where available. Leaving the focus surface returns the student to the application without publishing private notes or replacing the underlying saved material." },
    { title: "Responsive controls", description: "The timer, navigation, notes, and exit controls remain reachable on desktop, tablet, and mobile screens. Content scrolls inside the study surface instead of forcing the entire page wider than the device." },
  ],
};

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
  const routeDetails = PROTECTED_ROUTE_DETAILS[route.route] || [
    { title: "What this protected page does", description: route.description },
    { title: "Why sign-in is required", description: "The page works with account history, private study data, billing information, or authorised collaboration state. Mabaso AI verifies the signed-in user before returning that data." },
    { title: "What happens after sign-in", description: "The requested workspace opens directly after authentication and restores only information the current account is allowed to access." },
  ];
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
    contains: routeDetails,
    workflow: [
      "Read the feature explanation and choose Sign In when you are ready to use the live page.",
      "Mabaso AI validates the secure session and identifies the current account.",
      "The backend checks ownership or room permission before returning private data.",
      "The app opens the requested page and restores that account's saved state.",
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
