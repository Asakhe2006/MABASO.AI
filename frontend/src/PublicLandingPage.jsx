import {
  BookOpen,
  ChevronDown,
  FileText,
  GraduationCap,
  MessageCircle,
  Mic,
  Presentation,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Platform",
    items: [
      ["Study Workspace", "/product/study-workspace"],
      ["Lecture Capture", "/product/lecture-capture"],
      ["Saved Materials", "/app/materials"],
      ["Study Timetable", "/app/timetable"],
      ["Collaboration", "/collaboration/shared-study-rooms"],
      ["AI Study Chat", "/ai-tools/study-chat"],
    ],
  },
  {
    label: "Features",
    items: [
      ["Study Guides", "/product/ai-study-guide"],
      ["Worked Examples", "/product/worked-examples"],
      ["Formula Extraction", "/product/formula-extraction"],
      ["Presentations", "/ai-tools/powerpoint-generator"],
      ["Podcasts", "/ai-tools/podcast-generator"],
      ["Tests and Flashcards", "/product/ai-test-generator"],
    ],
  },
  {
    label: "Resources",
    items: [
      ["Study Workflow", "/resources/study-workflow"],
      ["Help Centre", "/support/help-center"],
      ["Security", "/company/security"],
    ],
  },
];

const STUDY_TOOLS = [
  [<BookOpen aria-hidden="true" />, "Study Guides", "/product/ai-study-guide"],
  [<GraduationCap aria-hidden="true" />, "Flashcards", "/product/flashcards"],
  [<FileText aria-hidden="true" />, "Tests", "/product/ai-test-generator"],
  [<FileText aria-hidden="true" />, "Worked Examples", "/product/worked-examples"],
  [<Presentation aria-hidden="true" />, "Presentations", "/ai-tools/powerpoint-generator"],
  [<Mic aria-hidden="true" />, "Podcasts", "/ai-tools/podcast-generator"],
  [<MessageCircle aria-hidden="true" />, "Study Chat", "/ai-tools/study-chat"],
  [<FileText aria-hidden="true" />, "Materials", "/app/materials"],
  [<Users aria-hidden="true" />, "Collaboration", "/collaboration/shared-study-rooms"],
];

export default function PublicLandingPage({
  brandArtUrl,
  googleButtonRef,
  outputLanguage,
  outputLanguageOptions,
  onLanguageChange,
  onNavigate,
  onStartGoogle,
  onPrepareGoogle,
  rememberedEmail = "",
  authMessage = "",
  authMessageIsError = false,
  isGoogleSigningIn = false,
}) {
  const navigate = (route) => {
    onNavigate(route);
  };
  const startGoogle = () => {
    onPrepareGoogle?.("/app/capture");
    onStartGoogle?.("/app/capture");
  };

  return (
    <div className="public-landing">
      <header className="public-landing-nav">
        <button type="button" className="public-landing-brand" onClick={() => navigate("/")}>Mabaso AI</button>
        <nav className="public-landing-links" aria-label="Public navigation">
          {NAV_GROUPS.map((group) => (
            <details key={group.label} className="public-nav-dropdown">
              <summary>{group.label}<ChevronDown aria-hidden="true" /></summary>
              <div className="public-nav-dropdown-menu">
                {group.items.map(([label, route]) => <button key={route} type="button" onClick={() => navigate(route)}>{label}</button>)}
              </div>
            </details>
          ))}
          <button type="button" onClick={() => navigate("/pricing")}>Pricing</button>
          <button type="button" onClick={() => navigate("/for-institutions")}>For Institutions</button>
        </nav>
        <div className="public-landing-auth-actions">
          <button type="button" className="public-sign-in" onClick={startGoogle}>Sign in</button>
          <button type="button" className="public-get-started" onClick={startGoogle}>Get started</button>
        </div>
      </header>

      <main>
        <section className="public-landing-hero">
          <div className="public-hero-copy">
            <h1>Turn lectures into your complete <span>study workspace.</span></h1>
            <p>Upload, record, or prompt a lecture workspace, then create structured guides, worked examples, formulas, flashcards, tests, mind maps, presentations, podcasts, timetables, and persistent Study Chat support.</p>
            <div className="public-hero-actions">
              <button type="button" className="public-get-started" onClick={startGoogle}>Get started for free</button>
              <button type="button" className="public-secondary-action" onClick={() => navigate("/resources/study-workflow")}>See how it works</button>
            </div>
            <div className="public-trust-row">
              <span><Mic aria-hidden="true" /> Lecture transcription</span>
              <span><BookOpen aria-hidden="true" /> Smart study tools</span>
              <span><ShieldCheck aria-hidden="true" /> Secure and private</span>
            </div>
          </div>

          <div className="public-brand-visual">
            <img src={brandArtUrl} alt="Mabaso AI study microphone" />
          </div>

          <aside className="public-access-panel" aria-label="Google sign in">
            <p className="public-section-label">Access your account</p>
            <h2>Continue into Mabaso AI</h2>
            <label>
              <span>Study material language</span>
              <select value={outputLanguage} onChange={(event) => onLanguageChange(event.target.value)}>
                {outputLanguageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <p className="public-access-note">Study guides, tests, presentations, podcasts, and Study Chat answers use this language.</p>
            {rememberedEmail ? <p className="public-last-account">Last used: <strong>{rememberedEmail}</strong></p> : null}
            <div onPointerDownCapture={() => onPrepareGoogle?.("/app/capture")} onClickCapture={() => onPrepareGoogle?.("/app/capture")}>
              <div ref={googleButtonRef} data-fullwidth="true" className="public-google-button" />
            </div>
            {isGoogleSigningIn ? <p className="public-auth-status">Opening your workspace...</p> : null}
            {authMessage ? <p className={`public-auth-status ${authMessageIsError ? "is-error" : ""}`}>{authMessage}</p> : null}
            <p className="public-terms">By continuing, you agree to the Mabaso AI <button type="button" onClick={() => navigate("/company/terms")}>Terms</button> and <button type="button" onClick={() => navigate("/company/privacy")}>Privacy Policy</button>.</p>
          </aside>
        </section>

        <section className="public-tool-strip" aria-label="Mabaso AI study tools">
          <div><p>AI tools for</p><strong>smarter studying</strong></div>
          {STUDY_TOOLS.map(([icon, label, route]) => <button key={label} type="button" onClick={() => navigate(route)}>{icon}<span>{label}</span></button>)}
        </section>

        <section className="public-platform-section">
          <p className="public-section-label">Explore the platform</p>
          <h2>Everything students need in one intelligent workspace.</h2>
          <div className="public-platform-links">
            <button type="button" onClick={() => navigate("/product/study-workspace")}><BookOpen aria-hidden="true" /><strong>Study Workspace</strong><span>Upload, organise, edit, and study from one persistent workspace.</span></button>
            <button type="button" onClick={() => navigate("/resources/study-workflow")}><Sparkles aria-hidden="true" /><strong>Study Workflow</strong><span>Move from lecture capture to focused revision without losing context.</span></button>
            <button type="button" onClick={() => navigate("/company/security")}><ShieldCheck aria-hidden="true" /><strong>Security and Privacy</strong><span>Account-scoped history and protected workspace access.</span></button>
            <button type="button" onClick={() => navigate("/developers/api-documentation")}><FileText aria-hidden="true" /><strong>API Documentation</strong><span>Integration information for approved developers and institutions.</span></button>
          </div>
        </section>
        <footer className="public-provider-footer">
          <span>AI generation powered by</span>
          <strong className="provider-mark provider-openai"><span aria-hidden="true">◎</span> OpenAI</strong>
          <strong className="provider-mark provider-gemini"><Sparkles aria-hidden="true" /> Google Gemini</strong>
        </footer>
      </main>
      <nav className="public-mobile-bottom-nav" aria-label="Mobile public navigation">
        <button type="button" onClick={() => navigate("/product/study-workspace")}>Platform</button>
        <button type="button" onClick={() => navigate("/product/ai-study-guide")}>Features</button>
        <button type="button" onClick={() => navigate("/resources/study-workflow")}>Resources</button>
        <button type="button" onClick={() => navigate("/pricing")}>Pricing</button>
      </nav>
    </div>
  );
}
