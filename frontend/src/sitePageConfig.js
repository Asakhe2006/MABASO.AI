import termsAndConditionsMarkdown from "./content/terms-and-conditions.md?raw";

const primaryCta = (label, action, target = "") => ({ label, action, target, variant: "primary" });
const secondaryCta = (label, action, target = "") => ({ label, action, target, variant: "secondary" });
const tertiaryCta = (label, action, target = "") => ({ label, action, target, variant: "ghost" });

const page = ({
  route,
  title,
  category,
  access,
  hero,
  metadata,
  aliases = [],
  contains = [],
  layout = [],
  modules = [],
  workflow = [],
  fileGroups = [],
  codeSamples = [],
  faq = [],
  markdown = "",
  visuals = [],
  emptyState,
  designNotes = [],
  relatedPages = [],
  footerCrossLinks = [],
  lockedPreview = null,
  adminGuard = null,
}) => ({
  route,
  aliases,
  title,
  category,
  access,
  hero,
  metadata,
  contains,
  layout,
  modules,
  workflow,
  fileGroups,
  codeSamples,
  faq,
  markdown,
  visuals,
  emptyState,
  designNotes,
  relatedPages,
  footerCrossLinks,
  lockedPreview,
  adminGuard,
});

export const footerLinkGroups = [
  {
    title: "Product",
    links: [
      { label: "Study Workspace", route: "/product/study-workspace" },
      { label: "Lecture Capture", route: "/product/lecture-capture" },
      { label: "AI Study Guide", route: "/product/ai-study-guide" },
      { label: "Transcript Generator", route: "/product/transcript-generator" },
      { label: "Formula Extraction", route: "/product/formula-extraction" },
      { label: "Worked Examples", route: "/product/worked-examples" },
      { label: "Flashcards", route: "/product/flashcards" },
      { label: "AI Test Generator", route: "/product/ai-test-generator" },
    ],
  },
  {
    title: "AI Tools",
    links: [
      { label: "Mabaso AI Tutor", route: "/ai-tools/mabaso-ai-tutor" },
      { label: "Podcast Generator", route: "/ai-tools/podcast-generator" },
      { label: "PowerPoint Generator", route: "/ai-tools/powerpoint-generator" },
      { label: "Study Chat", route: "/ai-tools/study-chat" },
    ],
  },
  {
    title: "Collaboration",
    links: [
      { label: "Shared Study Rooms", route: "/collaboration/shared-study-rooms" },
      { label: "Group Study Features", route: "/collaboration/group-study-features" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Supported File Types", route: "/resources/supported-file-types" },
      { label: "Study Workflow", route: "/resources/study-workflow" },
      { label: "AI Accuracy Guide", route: "/resources/ai-accuracy-guide" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", route: "/support/help-center" },
      { label: "Contact Support", route: "/support/contact-support" },
      { label: "FAQ", route: "/support/faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Mabaso AI", route: "/company/about" },
      { label: "Security", route: "/company/security" },
      { label: "Privacy Policy", route: "/company/privacy" },
      { label: "Terms & Conditions", route: "/company/terms" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "API Documentation", route: "/developers/api-documentation" },
      { label: "Integrations", route: "/developers/integrations" },
    ],
  },
  {
    title: "Admin",
    links: [
      { label: "Admin Dashboard", route: "/admin/dashboard" },
    ],
  },
];

export const sitePages = [
  page({
    route: "/product/study-workspace",
    title: "Study Workspace",
    category: "Product",
    access: "login",
    metadata: {
      title: "Study Workspace | Mabaso AI",
      description: "Explore the Mabaso AI study workspace where one lecture becomes guides, flashcards, tests, examples, transcripts, podcasts, presentations, and exports.",
    },
    hero: {
      eyebrow: "Product / Workspace",
      headline: "One lecture becomes a complete revision workspace.",
      description: "Study Workspace is the operating system of Mabaso AI. Students move from transcript to guide, guide to worked examples, then into flashcards, tests, collaboration, exports, and AI study chat without rebuilding context.",
      ctas: [
        primaryCta("Start Studying", "open-app", "workspace"),
        secondaryCta("Upload a Lecture", "open-app", "capture"),
      ],
      metrics: [
        { label: "Live tools", value: "9" },
        { label: "Study pack exports", value: "PDF, PPTX, MP3" },
        { label: "Collaboration handoff", value: "1 click" },
      ],
      preview: {
        kicker: "Animated workspace preview",
        title: "Guide, transcript, formulas, examples, test, chat",
        subtitle: "A premium floating-tab shell shows students exactly where each learning mode lives.",
        tabs: ["Guide", "Transcript", "Examples", "Quiz", "Chat"],
        rows: [
          { label: "Generated pack", value: "Ready for revision" },
          { label: "Navigation", value: "Smart tab memory and exports" },
          { label: "Progress", value: "Resume from saved materials" },
        ],
      },
    },
    contains: [
      { icon: "layout-dashboard", title: "Persistent tool switching", description: "Students move across study modes without losing lecture context." },
      { icon: "brain-circuit", title: "AI-generated study pack", description: "Guides, formulas, examples, flashcards, and tests arrive from the same source material." },
      { icon: "save", title: "Saved progress", description: "History, downloads, and collaboration handoff keep work reusable across sessions." },
    ],
    layout: [
      { title: "Hero + workspace shell", description: "A wide hero introduces the workspace with floating tab previews and live output badges." },
      { title: "Tool architecture grid", description: "Each study tool is framed as a card with use case, outcome, and protected-data rules." },
      { title: "Conversion CTA rail", description: "The page ends with product CTAs into lecture capture and the live workspace." },
    ],
    modules: [
      {
        icon: "panels-top-left",
        title: "Page modules",
        items: [
          "Animated workspace preview with floating tabs",
          "Study workflow diagram from capture to collaboration",
          "Protected data note for downloads, transcripts, and saved packs",
        ],
      },
      {
        icon: "sparkles",
        title: "Content architecture",
        items: [
          "Top-level guide summary for first-pass understanding",
          "Dense revision tools for exam practice and memory recall",
          "Smart navigation that keeps students in the same workspace shell",
        ],
      },
      {
        icon: "shield-check",
        title: "Access rules",
        items: [
          "Public visitors can inspect the feature overview and screenshots",
          "Live study packs, downloads, and saved work require login",
          "Blurred previews appear when protected workspace content is opened without a session",
        ],
      },
    ],
    workflow: [
      "Upload or record a lecture",
      "Generate transcript and study pack",
      "Switch between tools inside one workspace",
      "Export or share into collaboration",
    ],
    visuals: [
      "Floating tab demo with active tool glow states",
      "Study workflow diagram from capture to AI generation to downloads",
      "Pinned workspace cards showing transcript, guide, test, and chat together",
    ],
    emptyState: {
      title: "No workspace yet",
      description: "Show a glass panel with ghost tabs, a disabled download rail, and a clear CTA to upload the first lecture.",
    },
    designNotes: [
      "Use wide split layouts with a premium dashboard rhythm rather than a blog-like content column.",
      "Keep status chips, export chips, and tab pills in the same enterprise visual language as the live app.",
      "Motion should feel calm and product-led: soft hover lift, blur transitions, and tab glow handoffs.",
    ],
    relatedPages: ["/product/lecture-capture", "/product/ai-study-guide", "/collaboration/shared-study-rooms"],
    footerCrossLinks: ["/support/help-center", "/company/security", "/company/terms"],
    lockedPreview: {
      title: "Live study packs require sign-in",
      description: "Workspace previews can be explored publicly, but transcripts, saved materials, AI outputs, downloads, and collaboration state are protected.",
      benefits: [
        "Resume progress across lectures and devices",
        "Unlock PDF, PowerPoint, and podcast exports",
        "Open collaboration rooms and saved history",
      ],
    },
  }),
  page({
    route: "/product/lecture-capture",
    title: "Lecture Capture",
    category: "Product",
    access: "login",
    metadata: {
      title: "Lecture Capture | Mabaso AI",
      description: "See how Mabaso AI captures lecture recordings, YouTube links, notes, slides, and mixed file bundles before AI study generation starts.",
    },
    hero: {
      eyebrow: "Product / Capture",
      headline: "Capture lecture material from files, live recording, or public video links.",
      description: "Lecture Capture is the intake layer for Mabaso AI. It accepts recordings, slide decks, notes, past papers, and online lecture links, then routes them into a clean AI study pipeline.",
      ctas: [
        primaryCta("Upload a Lecture", "open-app", "capture"),
        secondaryCta("View Study Workflow", "route", "/resources/study-workflow"),
      ],
      metrics: [
        { label: "Input modes", value: "File, live, URL" },
        { label: "Bundle sorting", value: "Automatic" },
        { label: "Status visibility", value: "Real time" },
      ],
      preview: {
        kicker: "Processing animation",
        title: "Drag, drop, record, paste, and track progress",
        subtitle: "The capture surface shows upload states, queue badges, and progress milestones before generation begins.",
        tabs: ["Upload", "Record", "Video URL", "Notes", "Slides"],
        rows: [
          { label: "Supported bundles", value: "Lecture media + study files" },
          { label: "Live progress", value: "Upload, extract, transcribe" },
          { label: "Safety rails", value: "Validated formats and limits" },
        ],
      },
    },
    contains: [
      { icon: "upload-cloud", title: "Drag-and-drop upload demo", description: "Video, audio, notes, slides, and past papers enter from one capture page." },
      { icon: "mic", title: "Live browser recording", description: "Microphone and shared-audio capture are presented as guided, browser-aware flows." },
      { icon: "link", title: "YouTube and public URL intake", description: "Video-link transcription is explained with routing, status messages, and supported hosts." },
    ],
    layout: [
      { title: "Capture control bar", description: "A multi-input hero card presents upload, record, and link entry points first." },
      { title: "Format and trust section", description: "Supported file types, limits, and processing recommendations sit beside the intake UI." },
      { title: "Pipeline timeline", description: "A progress strip explains upload, extraction, transcription, and study generation handoff." },
    ],
    modules: [
      {
        icon: "hard-drive-upload",
        title: "What the page contains",
        items: [
          "Drag-and-drop upload zone with accepted file badges",
          "Recording surface with system-audio guidance",
          "Live queue states and processing milestone cards",
        ],
      },
      {
        icon: "workflow",
        title: "Page architecture",
        items: [
          "Input-first layout at the top",
          "Progress and quality signals in the middle",
          "Recommendations and support links at the bottom",
        ],
      },
      {
        icon: "shield-check",
        title: "Access rules",
        items: [
          "Public visitors can inspect supported file types and flow explanations",
          "Actual uploads, processing jobs, and capture history require login",
          "Protected upload views render with a darkened, blurred workspace overlay when signed out",
        ],
      },
    ],
    fileGroups: [
      { label: "Lecture media", items: ["Audio recordings", "Video recordings", "Browser-tab captures"] },
      { label: "Supporting study files", items: ["Notes", "Slides", "Past papers", "Marking memos"] },
      { label: "Online sources", items: ["Approved public video hosts", "YouTube-style public links"] },
    ],
    visuals: [
      "Animated drag-and-drop upload module",
      "Live recording waveform with capture source badges",
      "Processing progress ladder with extraction and transcription states",
    ],
    emptyState: {
      title: "No lecture source selected",
      description: "Render a premium drop zone with floating upload chips, a supported-files rail, and a guided first-upload CTA.",
    },
    designNotes: [
      "Capture should feel operational and trustworthy, like an enterprise ingest console rather than a simple file input.",
      "Status text must be short, clear, and always mapped to a visible stage.",
      "Use layered glass cards to separate input controls from processing diagnostics.",
    ],
    relatedPages: ["/resources/supported-file-types", "/resources/study-workflow", "/product/study-workspace"],
    footerCrossLinks: ["/support/help-center", "/company/security", "/company/privacy"],
    lockedPreview: {
      title: "Secure capture starts after login",
      description: "Uploads, live recordings, processing queues, and saved lecture history are protected by authenticated session controls.",
      benefits: [
        "Attach notes, slides, and past papers to the same lecture",
        "Track upload and transcription states in one place",
        "Store and reopen lecture workspaces later",
      ],
    },
  }),
  page({
    route: "/product/ai-study-guide",
    title: "AI Study Guide",
    category: "Product",
    access: "public",
    metadata: {
      title: "AI Study Guide | Mabaso AI",
      description: "Structured lecture summaries, adaptive explanations, topic sections, and revision-ready learning cards powered by Mabaso AI.",
    },
    hero: {
      eyebrow: "Product / AI Study Guide",
      headline: "Structured study guides that teach, not just summarize.",
      description: "The AI Study Guide page explains how Mabaso AI transforms lecture context into subject-aware notes, sectioned explanations, formulas, visuals, and practice questions that feel closer to a premium revision product than a raw transcript dump.",
      ctas: [
        primaryCta("Generate a Study Guide", "open-app", "capture"),
        secondaryCta("See AI Accuracy Guide", "route", "/resources/ai-accuracy-guide"),
      ],
      metrics: [
        { label: "Output structure", value: "Adaptive" },
        { label: "Revision blocks", value: "Multi-format" },
        { label: "Public access", value: "Overview only" },
      ],
      preview: {
        kicker: "Guide preview",
        title: "Overview, section cards, examples, questions, and flashcards",
        subtitle: "Expandable topic sections and study cards show how the guide becomes a revision surface instead of a flat page.",
        tabs: ["Overview", "Key Concepts", "Examples", "Questions"],
        rows: [
          { label: "Guide style", value: "Mobile-first and skimmable" },
          { label: "Subject handling", value: "Topic-aware structure" },
          { label: "Linked outputs", value: "Quiz, flashcards, formulas" },
        ],
      },
    },
    contains: [
      { icon: "book-open-text", title: "Structured summaries", description: "Guides open with a clean lecture overview before deeper study modules begin." },
      { icon: "layers-3", title: "Expandable topic sections", description: "Content architecture separates core ideas, worked logic, and revision aids." },
      { icon: "sparkles", title: "Adaptive explanation cards", description: "Definitions, comparisons, visual hints, and exam tips appear only when useful." },
    ],
    layout: [
      { title: "Hero + guide preview", description: "Lead with a wide study-guide shell and a short explanation of how AI organizes the topic." },
      { title: "Topic architecture section", description: "Map how Mabaso AI breaks lectures into overview, concepts, examples, visuals, and practice." },
      { title: "Trust and best-results section", description: "Show how better notes, slides, and past papers improve guide quality." },
    ],
    modules: [
      {
        icon: "panel-top",
        title: "Main content sections",
        items: [
          "Short summary and lecture orientation",
          "Concept breakdown cards and linked subsections",
          "Practice questions, flashcards, and supporting examples",
        ],
      },
      {
        icon: "graduation-cap",
        title: "What it should feel like",
        items: [
          "A premium edtech guide rather than an AI transcript rewrite",
          "Clear enough for first-pass understanding",
          "Structured enough for exam revision and later recall",
        ],
      },
      {
        icon: "badge-check",
        title: "Enterprise notes",
        items: [
          "Public page explains capabilities and shows polished examples",
          "Live generated guides and saved content stay in the authenticated workspace",
          "Guide previews should use layered cards, not dense essay layouts",
        ],
      },
    ],
    visuals: [
      "Expandable topic cards with highlight callouts",
      "Suggested visual callout blocks for difficult ideas",
      "Preview row showing how the guide links into formulas, tests, and flashcards",
    ],
    emptyState: {
      title: "No study guide generated yet",
      description: "Use a white glass note card with placeholder sections and a subtle CTA ribbon to upload lecture material.",
    },
    designNotes: [
      "Keep the guide section bright and editorial inside the dark page shell to mirror the live workspace style.",
      "Use large spacing and high-clarity headings so the page feels like a product walkthrough, not a policy page.",
      "Show one excellent sample block instead of many tiny screenshots.",
    ],
    relatedPages: ["/product/worked-examples", "/product/formula-extraction", "/resources/ai-accuracy-guide"],
    footerCrossLinks: ["/company/about", "/company/terms", "/support/faq"],
  }),
  page({
    route: "/product/transcript-generator",
    title: "Transcript Generator",
    category: "Product",
    access: "login",
    metadata: {
      title: "Transcript Generator | Mabaso AI",
      description: "Lecture-to-text conversion with transcript viewing, search, timestamps, and study-tool handoff powered by Mabaso AI.",
    },
    hero: {
      eyebrow: "Product / Transcript",
      headline: "Turn lecture audio into a searchable transcript foundation.",
      description: "Transcript Generator explains the lecture-to-text layer that powers every downstream study tool. It frames timestamps, transcript search, speaker handling, and how raw text becomes a study-ready source.",
      ctas: [
        primaryCta("Transcribe a Lecture", "open-app", "capture"),
        secondaryCta("Open Study Workspace", "open-app", "workspace"),
      ],
      metrics: [
        { label: "Transcript role", value: "Foundation layer" },
        { label: "Searchability", value: "Section aware" },
        { label: "Protected data", value: "Yes" },
      ],
      preview: {
        kicker: "Transcript viewer demo",
        title: "Audio-to-text with search and AI handoff",
        subtitle: "Use a clean transcript panel with highlighted search terms, anchored sections, and live AI generation badges.",
        tabs: ["Transcript", "Search", "Sections", "Export"],
        rows: [
          { label: "Purpose", value: "Source of truth for study tools" },
          { label: "Search", value: "Find definitions and examples quickly" },
          { label: "Protection", value: "Session and export controlled" },
        ],
      },
    },
    contains: [
      { icon: "audio-lines", title: "Lecture-to-text conversion", description: "Explains how uploaded audio or video is transformed into study-ready text." },
      { icon: "search", title: "Search-in-transcript UI", description: "Highlights how students find concepts, formulas, and moments in a long lecture." },
      { icon: "link-2", title: "AI handoff", description: "Shows how the transcript feeds guides, tests, chat, and examples." },
    ],
    layout: [
      { title: "Hero viewer", description: "Show a simulated transcript panel with search and anchored sections." },
      { title: "Processing explanation", description: "Explain upload, transcript creation, and how fallback logic protects the flow." },
      { title: "Protected data strip", description: "Clarify that live transcripts, downloads, and saved lecture text require authentication." },
    ],
    modules: [
      {
        icon: "scroll-text",
        title: "Core modules",
        items: [
          "Transcript viewer demo",
          "Audio-sync and search preview cards",
          "Study-tool dependency section",
        ],
      },
      {
        icon: "file-clock",
        title: "Access rules",
        items: [
          "Public visitors can learn how the transcript engine works",
          "Actual transcript content, history, and exports require login",
          "Unauthorized access shows a blurred transcript sheet under a glass overlay",
        ],
      },
      {
        icon: "arrow-right-left",
        title: "Related flows",
        items: [
          "Move from transcript into study guide generation",
          "Open worked examples and formula extraction downstream",
          "Use transcript context inside Study Chat",
        ],
      },
    ],
    visuals: [
      "Transcript viewer with search highlights",
      "Audio sync strip and timestamp markers",
      "Downstream pipeline card from transcript to study guide and chat",
    ],
    emptyState: {
      title: "Transcript preview unavailable",
      description: "Display a blurred lecture text surface with a prompt to upload a lecture or continue into the capture flow.",
    },
    designNotes: [
      "The transcript page should feel utility-driven, like a serious productivity workspace rather than a landing page.",
      "Keep the transcript preview readable but intentionally protected when the user is signed out.",
      "Use search highlights and section anchors as the key visual differentiators.",
    ],
    relatedPages: ["/product/ai-study-guide", "/product/study-workspace", "/ai-tools/study-chat"],
    footerCrossLinks: ["/support/help-center", "/company/security", "/resources/ai-accuracy-guide"],
    lockedPreview: {
      title: "Transcript data is protected",
      description: "Lecture transcripts can contain user-uploaded classroom content, so live transcript views and saved lecture text require a signed-in workspace.",
      benefits: [
        "Keep transcript history linked to your account",
        "Search across lecture context before generating study tools",
        "Export or reuse transcripts in later sessions",
      ],
    },
  }),
  page({
    route: "/product/formula-extraction",
    title: "Formula Extraction",
    category: "Product",
    access: "public",
    metadata: {
      title: "Formula Extraction | Mabaso AI",
      description: "Automatic formula detection and formula-sheet generation for math, science, and engineering lectures in Mabaso AI.",
    },
    hero: {
      eyebrow: "Product / Formula Extraction",
      headline: "Pull formulas out of dense lectures and turn them into clean revision sheets.",
      description: "Formula Extraction focuses on the moments students usually lose first: equations, relationships, transform pairs, and variable meaning. The page shows how Mabaso AI turns them into a readable formula layer.",
      ctas: [
        primaryCta("Generate a Formula Sheet", "open-app", "capture"),
        secondaryCta("See Worked Examples", "route", "/product/worked-examples"),
      ],
      metrics: [
        { label: "Subjects", value: "Math, science, engineering" },
        { label: "Output style", value: "Readable sheets" },
        { label: "Variable clarity", value: "Highlighted" },
      ],
      preview: {
        kicker: "Formula cards",
        title: "Grouped equations with variables and quick meaning",
        subtitle: "Show formula rows, mappings, and highlighted variables in a premium revision-first card system.",
        tabs: ["Formula Sheet", "Mappings", "Variables"],
        rows: [
          { label: "Formatting", value: "Readable and structured" },
          { label: "Grouping", value: "Topic and concept based" },
          { label: "Usage", value: "Revision and quick recall" },
        ],
      },
    },
    contains: [
      { icon: "sigma", title: "Automatic formula detection", description: "Equations are separated from noisy lecture text and grouped into a cleaner reference sheet." },
      { icon: "binary", title: "Variable highlighting", description: "Important symbols and values are explained in context where possible." },
      { icon: "calculator", title: "Formula-to-example handoff", description: "Users can move from formula sheets into worked examples and tests." },
    ],
    layout: [
      { title: "Formula hero table", description: "Use a bright preview card with expression and readable-result columns." },
      { title: "Context modules", description: "Pair formula groups with variable notes, pitfalls, and example usage." },
      { title: "Revision CTA bar", description: "Close with direct links into examples, tests, and study guides." },
    ],
    modules: [
      {
        icon: "square-sigma",
        title: "What the page contains",
        items: [
          "Grouped equation cards",
          "Readable mappings and standard-result rows",
          "Variable notes for hard-to-remember expressions",
        ],
      },
      {
        icon: "flask-conical",
        title: "Academic fit",
        items: [
          "Engineering transform pairs",
          "Mathematics relationships",
          "Science equations and symbolic summaries",
        ],
      },
      {
        icon: "layout-list",
        title: "Enterprise design rules",
        items: [
          "Avoid massive markdown tables in favor of mobile-safe split cards",
          "Keep formulas visually quiet and high-contrast inside white study surfaces",
          "Use blue-glow accent chips only for topic labels and sheet status",
        ],
      },
    ],
    visuals: [
      "Animated formula cards with hover states",
      "Grouped equations with variable highlight chips",
      "Connection card showing formula to worked-example flow",
    ],
    emptyState: {
      title: "No formulas detected yet",
      description: "Display a clean formula-sheet shell with placeholder rows and a note that not every lecture naturally contains formulas.",
    },
    designNotes: [
      "Formula pages should feel precise, uncluttered, and academic.",
      "Use white study sheets framed by dark enterprise chrome to keep the tool premium and readable.",
      "Leave enough room for symbolic content so the layout never feels cramped.",
    ],
    relatedPages: ["/product/worked-examples", "/product/ai-test-generator", "/resources/ai-accuracy-guide"],
    footerCrossLinks: ["/company/about", "/company/terms", "/support/faq"],
  }),
  page({
    route: "/product/worked-examples",
    title: "Worked Examples",
    category: "Product",
    access: "login",
    metadata: {
      title: "Worked Examples | Mabaso AI",
      description: "AI-generated step-by-step worked examples with subject-aware reasoning for mathematics, engineering, and technical learning.",
    },
    hero: {
      eyebrow: "Product / Worked Examples",
      headline: "Step-by-step worked examples with method, reasoning, and exam flow.",
      description: "Worked Examples is where the platform moves from knowing the topic to solving with it. The page explains how Mabaso AI generates subject-aware solution paths that teach the method, not just the answer.",
      ctas: [
        primaryCta("Build Worked Examples", "open-app", "capture"),
        secondaryCta("Open Formula Extraction", "route", "/product/formula-extraction"),
      ],
      metrics: [
        { label: "Reasoning style", value: "Step by step" },
        { label: "Subject fit", value: "Adaptive" },
        { label: "Saved outputs", value: "Protected" },
      ],
      preview: {
        kicker: "Solution flow preview",
        title: "Method, reasoning, checkpoints, and final result",
        subtitle: "Use a premium vertical solution rail with numbered steps, pitfall notes, and exam-style logic cards.",
        tabs: ["Method", "Steps", "Checks", "Exam Notes"],
        rows: [
          { label: "Structure", value: "Sequential and explainable" },
          { label: "Use case", value: "Learning and exam review" },
          { label: "Protection", value: "Saved examples require login" },
        ],
      },
    },
    contains: [
      { icon: "list-ordered", title: "Step-by-step solving", description: "Examples are split into logical stages so students can follow the reasoning path." },
      { icon: "brain", title: "Adaptive explanation structure", description: "The solution style adjusts to the subject and problem type." },
      { icon: "graduation-cap", title: "Exam-style teaching", description: "Worked examples clarify both process and likely assessment logic." },
    ],
    layout: [
      { title: "Hero example rail", description: "Start with a large example preview that feels like a guided solver canvas." },
      { title: "Reasoning grid", description: "Explain method, checkpoints, and common mistakes as separate cards." },
      { title: "Protected examples note", description: "Clarify that generated examples and saved solution sets belong to authenticated study sessions." },
    ],
    modules: [
      {
        icon: "route",
        title: "What each page contains",
        items: [
          "Engineering and mathematics walkthrough cards",
          "Exam-style explanation blocks",
          "Common-mistake callouts next to each method",
        ],
      },
      {
        icon: "panel-right-open",
        title: "Content architecture",
        items: [
          "Problem framing first",
          "Step sequence second",
          "Answer checks and revision takeaways last",
        ],
      },
      {
        icon: "lock-keyhole",
        title: "Access rules",
        items: [
          "Public visitors can see feature explanations and polished sample cards",
          "Generated examples, saved solution history, and room sharing require login",
          "A blurred example stream appears under the enterprise login wall when protected example data is requested without a session",
        ],
      },
    ],
    visuals: [
      "Vertical step rail with numbered cards",
      "Mathematics walkthrough with highlighted substitutions",
      "Engineering example card with assumptions and checks",
    ],
    emptyState: {
      title: "Worked examples are still being prepared",
      description: "Use a softly blurred example canvas with numbered placeholders and a CTA to generate from the lecture workspace.",
    },
    designNotes: [
      "Examples should feel premium and instructional, not like plain markdown blocks.",
      "Use strong hierarchy between step numbers, formulas, and explanatory text.",
      "Keep each step chunk short enough to scan on mobile while still feeling serious on desktop.",
    ],
    relatedPages: ["/product/formula-extraction", "/product/ai-test-generator", "/ai-tools/mabaso-ai-tutor"],
    footerCrossLinks: ["/support/help-center", "/resources/ai-accuracy-guide", "/company/terms"],
    lockedPreview: {
      title: "Saved worked examples require sign-in",
      description: "Solution history, shared examples, and personalized generated content are attached to authenticated lecture workspaces.",
      benefits: [
        "Generate examples from your own lecture content",
        "Save solution sets to history and collaboration rooms",
        "Move directly from examples into quizzes and Mabaso AI Tutor",
      ],
    },
  }),
  page({
    route: "/product/flashcards",
    title: "Flashcards",
    category: "Product",
    access: "public",
    metadata: {
      title: "Flashcards | Mabaso AI",
      description: "AI-generated revision flashcards, recall prompts, and memory-support patterns inside the Mabaso AI study system.",
    },
    hero: {
      eyebrow: "Product / Flashcards",
      headline: "Revision cards built from the same lecture context as the rest of the study pack.",
      description: "Flashcards in Mabaso AI are not isolated quiz toys. They are generated from the same guide, examples, transcript, and lecture support files so recall practice stays aligned with the actual class material.",
      ctas: [
        primaryCta("Generate Flashcards", "open-app", "capture"),
        secondaryCta("Open AI Test Generator", "route", "/product/ai-test-generator"),
      ],
      metrics: [
        { label: "Card source", value: "Lecture-aware" },
        { label: "Memory use", value: "Recall practice" },
        { label: "Flow", value: "Guide -> cards -> test" },
      ],
      preview: {
        kicker: "Flip-card preview",
        title: "Question, answer, cue, and revision follow-through",
        subtitle: "Flashcards should feel like a premium memory mode with clean motion and study-ready language.",
        tabs: ["Recall", "Review", "Quiz bridge"],
        rows: [
          { label: "Card style", value: "Short and focused" },
          { label: "Recall mode", value: "Fast repetition" },
          { label: "Bridge", value: "Feeds into test prep" },
        ],
      },
    },
    contains: [
      { icon: "rectangle-ellipsis", title: "Smart revision cards", description: "Short prompts focus on high-value concepts, not filler." },
      { icon: "repeat-2", title: "Memory support", description: "Flashcards act as the quick-recall layer between reading and testing." },
      { icon: "bolt", title: "Lecture alignment", description: "Cards stay connected to the same lecture context as the study guide." },
    ],
    layout: [
      { title: "Hero flip-card canvas", description: "Use a centered flashcard stack with subtle 3D motion and a progress strip." },
      { title: "Study strategy section", description: "Explain when students should switch from reading into recall mode." },
      { title: "Cross-tool CTA strip", description: "Connect cards to tests, worked examples, and Mabaso AI Tutor." },
    ],
    modules: [
      {
        icon: "brain-circuit",
        title: "Main modules",
        items: [
          "Flip-card animation",
          "Recall and answer preview states",
          "Memory tracking and handoff to tests",
        ],
      },
      {
        icon: "library-big",
        title: "Content architecture",
        items: [
          "High-priority concepts first",
          "Definitions and distinctions second",
          "Exam-trap reminders last",
        ],
      },
      {
        icon: "badge-info",
        title: "Design notes",
        items: [
          "Keep cards large, bright, and tactile within the dark page shell",
          "Use motion sparingly so the page still feels enterprise-grade",
          "Anchor the page in outcomes, not gamification gimmicks",
        ],
      },
    ],
    visuals: [
      "Flip-card stack animation",
      "Progress dots with streak summary chips",
      "Bridge card from flashcards to AI test mode",
    ],
    emptyState: {
      title: "No flashcards generated yet",
      description: "Render a centered placeholder card deck with a clear CTA to create a lecture-based revision set.",
    },
    designNotes: [
      "The page should feel premium and calm, not playful in a way that weakens trust.",
      "Use large type and short copy blocks to keep flashcards instantly scannable.",
      "Cards should visually connect to the rest of the study workspace through shared accent colors.",
    ],
    relatedPages: ["/product/ai-study-guide", "/product/ai-test-generator", "/ai-tools/mabaso-ai-tutor"],
    footerCrossLinks: ["/resources/study-workflow", "/support/faq", "/company/about"],
  }),
  page({
    route: "/product/ai-test-generator",
    title: "AI Test Generator",
    category: "Product",
    access: "login",
    metadata: {
      title: "AI Test Generator | Mabaso AI",
      description: "Generate timed tests, written answers, MCQs, answer-image submissions, and marking feedback with Mabaso AI.",
    },
    hero: {
      eyebrow: "Product / AI Test Generator",
      headline: "Turn lecture context into tests, timers, submissions, and marking feedback.",
      description: "AI Test Generator explains how Mabaso AI moves from study to assessment. It previews timed testing, written answers, MCQ flows, answer-image uploads, and AI marking feedback in one premium exam surface.",
      ctas: [
        primaryCta("Create a Test", "open-app", "workspace"),
        secondaryCta("Upload a Lecture", "open-app", "capture"),
      ],
      metrics: [
        { label: "Test styles", value: "Written + MCQ" },
        { label: "Answer uploads", value: "Text + image" },
        { label: "Session mode", value: "Timed" },
      ],
      preview: {
        kicker: "Exam UI preview",
        title: "Question flow, timer, answers, and feedback",
        subtitle: "Use a premium assessment shell with timer chips, answer states, and grading cards that feel robust and trustworthy.",
        tabs: ["Test", "Timer", "Uploads", "Feedback"],
        rows: [
          { label: "Question types", value: "Structured and mixed" },
          { label: "Feedback", value: "AI-assisted marking" },
          { label: "Protection", value: "Results and scores require login" },
        ],
      },
    },
    contains: [
      { icon: "clipboard-check", title: "Quiz generation", description: "The page explains how questions are generated from the study context." },
      { icon: "timer-reset", title: "Timed testing", description: "Timed sessions and countdown states create a real exam-feel workflow." },
      { icon: "badge-percent", title: "Marking and feedback", description: "AI feedback highlights mistakes, scores, and what to improve next." },
    ],
    layout: [
      { title: "Exam shell first", description: "Show the timer and question rail at the top so the product intent is immediately clear." },
      { title: "Submission mechanics second", description: "Explain text answers, MCQs, camera uploads, and marking workflow." },
      { title: "Past-paper intelligence last", description: "Show how past papers and memos sharpen the test style." },
    ],
    modules: [
      {
        icon: "file-question",
        title: "Main modules",
        items: [
          "Timed test interface",
          "Written and option-based answer cards",
          "Feedback and marking results panels",
        ],
      },
      {
        icon: "camera",
        title: "Submission support",
        items: [
          "Answer-photo upload cards",
          "Memo and past-paper reinforcement",
          "Group-study visibility modes inside collaboration",
        ],
      },
      {
        icon: "shield-check",
        title: "Access rules",
        items: [
          "Public page shows the exam UX and feature architecture",
          "Real test attempts, scores, uploads, and answer history require login",
          "Protected previews use blur, darkening, and an enterprise sign-in wall",
        ],
      },
    ],
    visuals: [
      "Exam UI with timer and answer inputs",
      "Grading preview with feedback chips and score bars",
      "Past-paper reference panel beside the test flow",
    ],
    emptyState: {
      title: "No assessment has started yet",
      description: "Display a polished pre-test card with question count placeholders, a disabled timer, and a CTA to generate a lecture-based test.",
    },
    designNotes: [
      "The test page should feel credible enough for real revision, with zero playful visual noise.",
      "Timer and score states must be immediately legible on both mobile and desktop.",
      "Use stronger contrast and card borders here than on softer content pages so the assessment surface feels controlled.",
    ],
    relatedPages: ["/product/flashcards", "/product/worked-examples", "/collaboration/group-study-features"],
    footerCrossLinks: ["/support/help-center", "/company/security", "/company/terms"],
    lockedPreview: {
      title: "Tests, scores, and uploads are account-protected",
      description: "Assessment history, answer files, grading feedback, and collaboration answer visibility all require a signed-in user workspace.",
      benefits: [
        "Keep timed test progress tied to your account",
        "Upload answer images and view AI marking feedback",
        "Share room-safe tests with collaborators",
      ],
    },
  }),
  page({
    route: "/ai-tools/mabaso-ai-tutor",
    aliases: ["/ai-tools/teacher-mode"],
    title: "Mabaso AI Tutor",
    category: "AI Tools",
    access: "login",
    metadata: {
      title: "Mabaso AI Tutor | Mabaso AI",
      description: "Low-latency AI tutoring with a hybrid realtime voice stack, VAD-powered interruptions, workspace-aware teaching, and premium tutor controls inside Mabaso AI.",
    },
    hero: {
      eyebrow: "AI Tools / Mabaso AI Tutor",
      headline: "A premium AI tutor session built on smart realtime voice, not expensive always-on streaming.",
      description: "Mabaso AI Tutor uses a hybrid architecture: live teaching runs on a cheaper realtime voice engine with VAD, smart mic sleep, and interruption handling, while study guides, transcripts, quizzes, and exports stay on background text workflows. The result still feels premium, fast, and deeply grounded in your workspace.",
      ctas: [
        primaryCta("Start Teach Session", "open-app", "workspace"),
        secondaryCta("View Study Guide", "route", "/product/ai-study-guide"),
      ],
      metrics: [
        { label: "Realtime lane", value: "Smart saver by default" },
        { label: "Interruptions", value: "VAD + natural handoff" },
        { label: "Free voice", value: "5 min per day" },
      ],
      preview: {
        kicker: "Tutor session interface",
        title: "Voice orb, live transcript, tutor controls, and study-context memory",
        subtitle: "Design the page like a premium AI copilot: animated speaking states, tutor settings, smart-saver voice controls, live question capture, and a guide-aware transcript rail.",
        tabs: ["Session", "Voice", "Transcript", "Guide Sync"],
        rows: [
          { label: "Experience", value: "Hybrid realtime teaching flow" },
          { label: "Controls", value: "Start, speak, interrupt, sleep, end" },
          { label: "Protection", value: "Tutor sessions require login" },
        ],
      },
    },
    contains: [
      { icon: "audio-waveform", title: "Hybrid realtime tutoring", description: "A live tutor flow uses a cheaper realtime voice engine by default, then reserves heavier reasoning for the moments that need it." },
      { icon: "message-square-more", title: "Natural interruption handling", description: "Students can cut in with questions, let VAD detect speech, and receive in-context answers without losing their place." },
      { icon: "files", title: "Multi-modal teaching context", description: "The tutor can explain notes, slides, transcripts, formulas, graphs, and uploaded revision materials together." },
    ],
    layout: [
      { title: "Tutor hero with live session shell", description: "Lead with an AI tutor interface that includes a speaking orb, waveform motion, transcript, and active section handoff." },
      { title: "Settings and teaching controls", description: "Explain voice, speaking pace, teaching style, response depth, interruption controls, and session-state visibility." },
      { title: "Cross-tool learning rail", description: "Connect Mabaso AI Tutor back to the guide, worked examples, Study Chat, and revision outputs." },
    ],
    modules: [
      {
        icon: "headphones",
        title: "Main modules",
        items: [
          "Animated tutor orb, waveform, and session status states",
          "Voice selector, speaking pace, teaching style, response-depth, and smart-saver engine controls",
          "Live transcript, question capture, and guide-following context panel",
        ],
      },
      {
        icon: "mic-2",
        title: "Tutor behavior",
        items: [
          "Teach concepts step by step with examples and understanding checks",
          "Slow down when the topic becomes difficult or formula-heavy",
          "Answer with warm, human-like language instead of robotic text dumps",
        ],
      },
      {
        icon: "lock-keyhole",
        title: "Access rules",
        items: [
          "Public page explains the tutor experience and shows a polished voice-session preview",
          "Generated tutor sessions, transcripts, and active voice interactions require login",
          "Blurred tutor controls appear behind the enterprise login wall when protected session playback is requested without a session",
        ],
      },
    ],
    visuals: [
      "Speaking orb with subtle electric-blue glow states",
      "Waveform and transcript rail beside the active guide section",
      "Tutor settings panel with voice, pace, style, and response-depth controls",
    ],
    emptyState: {
      title: "Tutor session not prepared yet",
      description: "Display a premium tutor card with a disabled orb, muted waveform, inactive controls, and a CTA to start the session from the workspace.",
    },
    designNotes: [
      "The experience should feel premium, intelligent, smooth, and highly responsive rather than like a basic TTS player.",
      "Treat the live voice lane as a cost-controlled premium layer: smart mic activation, silence timeout, VAD, and short spoken confirmations by default.",
      "Use dark backgrounds, electric-blue accents, glass surfaces, and subtle glow to push the interface toward a modern AI copilot feel.",
      "Keep the live teaching state, transcript, and guide-following behavior visibly connected so the tutor always feels grounded in study context.",
    ],
    relatedPages: ["/product/ai-study-guide", "/product/worked-examples", "/ai-tools/study-chat"],
    footerCrossLinks: ["/support/faq", "/company/about", "/company/terms"],
    lockedPreview: {
      title: "Interactive tutor sessions require sign-in",
      description: "The voice tutor, saved transcript state, and student-question context are generated from your own protected lecture workspace.",
      benefits: [
        "Start a guide-aware AI teaching session from your study materials",
        "Interrupt naturally with questions without losing context",
        "Resume Mabaso AI Tutor later from saved workspace history",
      ],
    },
  }),
  page({
    route: "/ai-tools/podcast-generator",
    title: "Podcast Generator",
    category: "AI Tools",
    access: "login",
    metadata: {
      title: "Podcast Generator | Mabaso AI",
      description: "Convert lecture material into AI-generated podcast debates with speaker profiles, target duration, and MP3 export.",
    },
    hero: {
      eyebrow: "AI Tools / Podcast Generator",
      headline: "Convert lecture content into a debate-style revision podcast.",
      description: "Podcast Generator turns study material into named-speaker discussion audio with a selectable duration, scripted turns, and downloadable MP3 output for revision away from the screen.",
      ctas: [
        primaryCta("Generate a Podcast", "open-app", "workspace"),
        secondaryCta("Upload a Lecture", "open-app", "capture"),
      ],
      metrics: [
        { label: "Speakers", value: "2 or 3" },
        { label: "Output", value: "Script + MP3" },
        { label: "Use case", value: "Audio revision" },
      ],
      preview: {
        kicker: "Podcast player",
        title: "Speaker cards, turn list, and full-audio playback",
        subtitle: "The preview should feel like a premium AI audio product with a podcast rail, speaker identity, and clean playback controls.",
        tabs: ["Player", "Speakers", "Script", "Download"],
        rows: [
          { label: "Format", value: "Lecture-to-podcast" },
          { label: "Playback", value: "Full track + turn focus" },
          { label: "Protection", value: "Audio and downloads require login" },
        ],
      },
    },
    contains: [
      { icon: "podcast", title: "Lecture-to-podcast conversion", description: "The page frames how revision content becomes a spoken multi-speaker format." },
      { icon: "users-round", title: "Named speaker profiles", description: "Two- or three-voice structures give the audio a clear discussion rhythm." },
      { icon: "download", title: "MP3 generation", description: "Students can download a full revision track for offline listening." },
    ],
    layout: [
      { title: "Audio-first hero", description: "Lead with the player shell and speaker cards rather than paragraphs of copy." },
      { title: "Script and turn architecture", description: "Explain how the generated script maps to speaker turns and revision goals." },
      { title: "Download and workflow CTA", description: "Close with calls to generate, listen, and return to the study workspace." },
    ],
    modules: [
      {
        icon: "audio-lines",
        title: "Main modules",
        items: [
          "Podcast player with segment awareness",
          "Speaker cards and target-length controls",
          "Script preview with downloadable output cues",
        ],
      },
      {
        icon: "clock-3",
        title: "Content structure",
        items: [
          "Overview and setup first",
          "Turn list and speaking roles second",
          "Script and download panel last",
        ],
      },
      {
        icon: "shield-check",
        title: "Access rules",
        items: [
          "Public page explains the podcast product and shows sample structures",
          "Real generation, playback assets, and MP3 downloads require login",
          "Blurred audio panels appear for signed-out visitors trying to open protected podcast output",
        ],
      },
    ],
    visuals: [
      "Podcast player with waveform and chapter markers",
      "Speaker profile cards with roles and durations",
      "Script preview card with download status chip",
    ],
    emptyState: {
      title: "Podcast not generated yet",
      description: "Use an audio card placeholder with muted transport controls, a target-duration pill, and a CTA to generate a study podcast.",
    },
    designNotes: [
      "This page should feel closer to a polished AI audio product than a simple file-download feature.",
      "Use warm amber accents to differentiate the audio tool family from the broader blue enterprise shell.",
      "Keep the player controls large, calm, and trustworthy.",
    ],
    relatedPages: ["/ai-tools/mabaso-ai-tutor", "/product/study-workspace", "/product/ai-study-guide"],
    footerCrossLinks: ["/support/help-center", "/company/security", "/company/privacy"],
    lockedPreview: {
      title: "Podcast generation and downloads require sign-in",
      description: "Audio assets are generated from your protected study material and tied to your lecture workspace, history, and download controls.",
      benefits: [
        "Generate a revision podcast from your lecture",
        "Download MP3 audio and return later",
        "Switch between script reading and audio listening",
      ],
    },
  }),
  page({
    route: "/ai-tools/powerpoint-generator",
    title: "PowerPoint Generator",
    category: "AI Tools",
    access: "login",
    metadata: {
      title: "PowerPoint Generator | Mabaso AI",
      description: "Create lecture slide decks with premium templates, custom PowerPoint files, a built-in viewer, and generation progress in Mabaso AI.",
    },
    hero: {
      eyebrow: "AI Tools / PowerPoint Generator",
      headline: "Generate premium lecture presentations from the same study context.",
      description: "PowerPoint Generator packages a lecture into structured slides with style selection, custom template support, generation progress, and a built-in slide viewer that mirrors the resulting deck.",
      ctas: [
        primaryCta("Generate Slides", "open-app", "workspace"),
        secondaryCta("View Study Workspace", "route", "/product/study-workspace"),
      ],
      metrics: [
        { label: "Output", value: "PPTX" },
        { label: "Template system", value: "Built-in + custom" },
        { label: "Viewer", value: "In browser" },
      ],
      preview: {
        kicker: "Slide deck preview",
        title: "Template gallery, generation status, and viewer",
        subtitle: "The page should feel like a serious AI presentation product with slide thumbnails, template cards, and generation telemetry.",
        tabs: ["Templates", "Status", "Viewer", "Download"],
        rows: [
          { label: "Styles", value: "Premium visual systems" },
          { label: "Custom templates", value: "Supported" },
          { label: "Protection", value: "Deck files require login" },
        ],
      },
    },
    contains: [
      { icon: "presentation", title: "Automatic lecture slides", description: "The page explains how lecture context becomes a presentation structure." },
      { icon: "swatches", title: "Template and style system", description: "Built-in themes and uploaded custom templates support brand and course needs." },
      { icon: "monitor-play", title: "Built-in viewer", description: "Users can inspect the deck before downloading the final PowerPoint file." },
    ],
    layout: [
      { title: "Template-first hero", description: "Show a premium deck gallery as the first visual moment." },
      { title: "Generation and viewer stack", description: "Explain the status screen and how the viewer mirrors the final deck." },
      { title: "Export CTA strip", description: "Close with download, workspace, and related-tool links." },
    ],
    modules: [
      {
        icon: "gallery-vertical-end",
        title: "Main modules",
        items: [
          "Template chooser with premium visual themes",
          "Generation status panel with progress feedback",
          "Slide viewer with thumbnail navigation",
        ],
      },
      {
        icon: "file-stack",
        title: "Content architecture",
        items: [
          "Setup and design selection first",
          "Generation status second",
          "Viewer and download last",
        ],
      },
      {
        icon: "lock-keyhole",
        title: "Access rules",
        items: [
          "Public page explains the generator and shows gallery examples",
          "Real slide generation, custom templates, and PPTX downloads require login",
          "Blurred decks and a glass sign-in wall protect live generated content from unsigned users",
        ],
      },
    ],
    visuals: [
      "Premium slide gallery with theme cards",
      "Viewer with thumbnail rail and active slide canvas",
      "Generation progress shell with status ladder",
    ],
    emptyState: {
      title: "No presentation generated yet",
      description: "Show a locked slide canvas with theme samples and a CTA to build a lecture deck from the workspace.",
    },
    designNotes: [
      "Make the page feel closer to a design-quality presentation product than a utility export screen.",
      "Use stronger glass depth and glow in the template gallery than on text-heavy pages.",
      "Keep the viewer layout clean and spacious, with minimal chrome around the active slide canvas.",
    ],
    relatedPages: ["/ai-tools/podcast-generator", "/product/study-workspace", "/resources/study-workflow"],
    footerCrossLinks: ["/company/about", "/company/security", "/support/faq"],
    lockedPreview: {
      title: "Generated slide decks require sign-in",
      description: "Deck files, custom templates, and saved presentation history belong to protected study sessions and download controls.",
      benefits: [
        "Choose premium templates or upload your own",
        "Preview the full slide deck before export",
        "Download a lecture-ready PowerPoint file",
      ],
    },
  }),
  page({
    route: "/ai-tools/study-chat",
    title: "Study Chat",
    category: "AI Tools",
    access: "login",
    metadata: {
      title: "Study Chat | Mabaso AI",
      description: "Context-aware AI study chat with lecture memory, image-assisted questions, and guided follow-up inside Mabaso AI.",
    },
    hero: {
      eyebrow: "AI Tools / Study Chat",
      headline: "Ask the lecture anything with context-aware AI chat.",
      description: "Study Chat brings lecture memory into conversation. It uses the guide, transcript, notes, slides, past papers, and optional reference images to answer with more context than a generic chatbot.",
      ctas: [
        primaryCta("Open Study Chat", "open-app", "workspace"),
        secondaryCta("See AI Accuracy Guide", "route", "/resources/ai-accuracy-guide"),
      ],
      metrics: [
        { label: "Context", value: "Lecture aware" },
        { label: "Image support", value: "Yes" },
        { label: "History", value: "Protected" },
      ],
      preview: {
        kicker: "AI chat interface",
        title: "Context cards, image references, and smart follow-up",
        subtitle: "The page should frame Study Chat as a reliable academic assistant layered over the lecture workspace.",
        tabs: ["Chat", "Images", "Context", "Follow-up"],
        rows: [
          { label: "Awareness", value: "Guide + transcript + notes" },
          { label: "Input", value: "Text and reference images" },
          { label: "Protection", value: "Conversation history requires login" },
        ],
      },
    },
    contains: [
      { icon: "messages-square", title: "Lecture-aware answers", description: "Responses are grounded in the current lecture workspace context." },
      { icon: "image-plus", title: "Image-assisted questions", description: "Students can add screenshots, notes, or handwritten references to a question." },
      { icon: "shield-check", title: "Protected conversations", description: "Chat history and live academic context stay behind authentication." },
    ],
    layout: [
      { title: "Conversation hero", description: "Show a premium chat shell with context badges, answer cards, and input controls." },
      { title: "Context intelligence section", description: "Explain how the chat uses transcript, guide, slides, and past papers." },
      { title: "Trust and access section", description: "Clarify protected history, image uploads, and follow-up behavior." },
    ],
    modules: [
      {
        icon: "bot",
        title: "Main modules",
        items: [
          "Chat interface with message roles",
          "Reference-image attachment rail",
          "Follow-up behavior and context reminder cards",
        ],
      },
      {
        icon: "database-zap",
        title: "Context architecture",
        items: [
          "Guide and transcript awareness first",
          "Supporting notes and images second",
          "Follow-up and clarification loop last",
        ],
      },
      {
        icon: "lock-keyhole-open",
        title: "Access rules",
        items: [
          "Public page showcases the product and a polished preview",
          "Actual chats, history, uploads, and context-aware responses require login",
          "Blurred message threads and a glass sign-in wall protect conversation data when signed out",
        ],
      },
    ],
    visuals: [
      "AI chat shell with context badges",
      "Reference-image attachment chips",
      "Answer card with linked lecture context strip",
    ],
    emptyState: {
      title: "No question asked yet",
      description: "Render a large empty chat surface with a context note, ghost prompt suggestions, and a CTA to open the workspace chat.",
    },
    designNotes: [
      "Chat should feel like a serious academic co-pilot, not a casual messenger clone.",
      "Use deep navy surfaces, soft borders, and focused spacing to keep the interface premium.",
      "The context-awareness explanation must be visible without overwhelming the conversation design.",
    ],
    relatedPages: ["/product/transcript-generator", "/product/ai-study-guide", "/resources/ai-accuracy-guide"],
    footerCrossLinks: ["/company/security", "/support/help-center", "/company/privacy"],
    lockedPreview: {
      title: "Study Chat requires sign-in",
      description: "Conversation history, uploaded references, and lecture context are personal workspace data protected behind your session.",
      benefits: [
        "Ask questions against your own lecture materials",
        "Attach screenshots and notes for better answers",
        "Keep your study conversations saved across sessions",
      ],
    },
  }),
  page({
    route: "/collaboration/shared-study-rooms",
    title: "Shared Study Rooms",
    category: "Collaboration",
    access: "login",
    metadata: {
      title: "Shared Study Rooms | Mabaso AI",
      description: "Invite collaborators, sync study tools, share notes, and revise one lecture together inside Mabaso AI study rooms.",
    },
    hero: {
      eyebrow: "Collaboration / Shared Study Rooms",
      headline: "Create study rooms around a real lecture workspace, not isolated chat threads.",
      description: "Shared Study Rooms give students a lecture-centered collaboration layer: shared notes, synced tools, room chat, and test-answer visibility modes that keep the group anchored to one revision pack.",
      ctas: [
        primaryCta("Open Collaboration", "open-app", "collaboration"),
        secondaryCta("Explore Group Study Features", "route", "/collaboration/group-study-features"),
      ],
      metrics: [
        { label: "Room type", value: "Lecture centered" },
        { label: "Shared tools", value: "Guide, test, flashcards, notes" },
        { label: "Protection", value: "Members only" },
      ],
      preview: {
        kicker: "Shared workspace preview",
        title: "Participants, shared notes, synced tools, and room chat",
        subtitle: "Show a real-time collaboration shell with member chips, room context, and active tool syncing.",
        tabs: ["Room", "Notes", "Tool Sync", "Chat"],
        rows: [
          { label: "Room creation", value: "Invite by email" },
          { label: "Shared focus", value: "Guide, quiz, flashcards, notes" },
          { label: "Protection", value: "Authenticated and room scoped" },
        ],
      },
    },
    contains: [
      { icon: "users", title: "Shared lecture rooms", description: "Rooms stay attached to a specific study pack so group discussion remains contextual." },
      { icon: "sticky-note", title: "Shared notes board", description: "Everyone sees the same pinned note surface for reminders and plans." },
      { icon: "send", title: "Room chat and synced tool focus", description: "Participants can chat and keep the room aligned on one study tool at a time." },
    ],
    layout: [
      { title: "Collaboration hero shell", description: "Lead with the room layout: members, notes, active tool, and chat." },
      { title: "Permission and visibility section", description: "Explain owner controls, invite model, and answer visibility settings." },
      { title: "Adoption CTA strip", description: "Guide visitors into the live collaboration experience after sign-in." },
    ],
    modules: [
      {
        icon: "users-2",
        title: "Main modules",
        items: [
          "Room creation and invite flow",
          "Shared notes board",
          "Room chat and active-tool sync panel",
        ],
      },
      {
        icon: "waypoints",
        title: "Collaboration architecture",
        items: [
          "One lecture room per revision context",
          "Shared focus tool in the center",
          "Notes, chat, and test controls around it",
        ],
      },
      {
        icon: "shield-check",
        title: "Access rules",
        items: [
          "All collaboration features require login",
          "Room membership, shared notes, and answer visibility are protected user data",
          "Signed-out visitors see a blurred team workspace with a premium login wall",
        ],
      },
    ],
    visuals: [
      "Live participant chips and room-status pills",
      "Shared notes board with collaborative cards",
      "Room chat shell beside the synced active-tool preview",
    ],
    emptyState: {
      title: "No study room created yet",
      description: "Render an empty shared room canvas with invite placeholders and a CTA to open collaboration after sign-in.",
    },
    designNotes: [
      "Collaboration must feel mature, secure, and team-ready rather than social or noisy.",
      "Use wider desktop layouts so the room can show notes, chat, and active tool together.",
      "Keep member identity, ownership, and room focus visually obvious at all times.",
    ],
    relatedPages: ["/collaboration/group-study-features", "/product/study-workspace", "/product/ai-test-generator"],
    footerCrossLinks: ["/company/security", "/support/help-center", "/company/privacy"],
    lockedPreview: {
      title: "Shared study rooms are member-protected",
      description: "Room notes, participant lists, answer visibility, and shared study content require authenticated access tied to invited members.",
      benefits: [
        "Invite teammates into a lecture-specific room",
        "Share the current study tool in one click",
        "Coordinate revision through notes, chat, and room controls",
      ],
    },
  }),
  page({
    route: "/collaboration/group-study-features",
    title: "Group Study Features",
    category: "Collaboration",
    access: "login",
    metadata: {
      title: "Group Study Features | Mabaso AI",
      description: "Permissions, shared answers, room ownership, real-time notes, and collaborative revision controls in Mabaso AI.",
    },
    hero: {
      eyebrow: "Collaboration / Group Study Features",
      headline: "Permission-aware collaboration for teams that revise together.",
      description: "Group Study Features explains the governance layer of collaboration: room ownership, visibility modes, shared-answer settings, note flows, and real-time study alignment across the same lecture pack.",
      ctas: [
        primaryCta("Create a Study Room", "open-app", "collaboration"),
        secondaryCta("View Shared Study Rooms", "route", "/collaboration/shared-study-rooms"),
      ],
      metrics: [
        { label: "Visibility modes", value: "Private or shared" },
        { label: "Room control", value: "Owner managed" },
        { label: "Collab trust", value: "Protected" },
      ],
      preview: {
        kicker: "Permissions preview",
        title: "Room visibility, shared answers, and moderation controls",
        subtitle: "A premium governance view shows how collaboration stays structured and safe at scale.",
        tabs: ["Permissions", "Answers", "Notes", "Ownership"],
        rows: [
          { label: "Owner actions", value: "Visibility and room focus control" },
          { label: "Member flow", value: "Shared notes and answer comparison" },
          { label: "Protection", value: "Sign-in required" },
        ],
      },
    },
    contains: [
      { icon: "shield", title: "Permission controls", description: "Owner-managed settings keep group revision organized and intentional." },
      { icon: "eye", title: "Answer visibility modes", description: "Rooms can keep answers private or allow shared answer comparison." },
      { icon: "notebook-tabs", title: "Real-time shared notes", description: "Teams collaborate on one lecture pack through notes and synchronized context." },
    ],
    layout: [
      { title: "Permission-led hero", description: "Start with governance and answer-visibility cards rather than generic collaboration copy." },
      { title: "Feature modules", description: "Show shared notes, answer modes, and room ownership as separate, clear modules." },
      { title: "Security reassurance band", description: "Tie collaboration trust back to authenticated membership and platform monitoring." },
    ],
    modules: [
      {
        icon: "list-checks",
        title: "Feature modules",
        items: [
          "Owner controls and room settings",
          "Shared-answer and private-answer modes",
          "Shared notes and coordination flows",
        ],
      },
      {
        icon: "panel-left-dashed",
        title: "Page architecture",
        items: [
          "Governance overview first",
          "Real-time collaboration examples second",
          "Trust, safety, and adoption CTA last",
        ],
      },
      {
        icon: "lock",
        title: "Access rules",
        items: [
          "All group-study features are login protected",
          "Notes, room messages, answer comparisons, and room controls are treated as user data",
          "Visitors without a session see blurred room-state cards behind a premium login wall",
        ],
      },
    ],
    visuals: [
      "Permission cards for private vs shared answers",
      "Shared whiteboard-style note canvas",
      "Owner control panel with room state and moderation chips",
    ],
    emptyState: {
      title: "No team collaboration has started yet",
      description: "Use a soft glass governance card set with placeholder permissions and a CTA to create the first room.",
    },
    designNotes: [
      "This page should look like enterprise collaboration software, not a school discussion board.",
      "Keep ownership and visibility states strong and unmistakable.",
      "Use security language carefully to reinforce trust without turning the page into a legal document.",
    ],
    relatedPages: ["/collaboration/shared-study-rooms", "/product/ai-test-generator", "/company/security"],
    footerCrossLinks: ["/support/help-center", "/company/privacy", "/company/terms"],
    lockedPreview: {
      title: "Group-study controls require secure membership",
      description: "Permissions, shared-answer modes, and room-level notes only make sense inside authenticated member spaces.",
      benefits: [
        "Manage who sees answers in collaborative tests",
        "Keep shared notes synced to the lecture room",
        "Protect participant identity and room context",
      ],
    },
  }),
  page({
    route: "/resources/supported-file-types",
    title: "Supported File Types",
    category: "Resources",
    access: "public",
    metadata: {
      title: "Supported File Types | Mabaso AI",
      description: "Browse supported audio, video, image, PDF, DOCX, PPTX, and text formats for Mabaso AI lecture capture and study generation.",
    },
    hero: {
      eyebrow: "Resources / Supported File Types",
      headline: "Know exactly which files work best before you upload.",
      description: "Supported File Types is the operational upload guide for Mabaso AI. It explains which lecture media, study files, and document formats work well, and how to prepare them for better AI results.",
      ctas: [
        primaryCta("Upload a Lecture", "open-app", "capture"),
        secondaryCta("Read the Study Workflow", "route", "/resources/study-workflow"),
      ],
      metrics: [
        { label: "Media types", value: "Audio, video, image" },
        { label: "Document types", value: "PDF, DOCX, PPTX, TXT, MD" },
        { label: "Purpose", value: "Capture readiness" },
      ],
      preview: {
        kicker: "File type cards",
        title: "Lecture media, notes, slides, past papers, and memos",
        subtitle: "Use structured file cards and upload recommendations instead of a raw compatibility list.",
        tabs: ["Media", "Documents", "Images", "Best Practice"],
        rows: [
          { label: "Lecture media", value: "Audio and video" },
          { label: "Study sources", value: "Text, slides, images" },
          { label: "Recommendations", value: "Clean, readable, structured" },
        ],
      },
    },
    contains: [
      { icon: "file-audio-2", title: "Audio formats", description: "Recommended for lecture recordings and voice-based capture." },
      { icon: "file-video-2", title: "Video formats", description: "Recommended when the lecture includes spoken explanation and visual context." },
      { icon: "files", title: "Study documents", description: "PDF, PPTX, DOCX, TXT, MD, and image-based learning materials." },
    ],
    layout: [
      { title: "Compatibility cards first", description: "Lead with grouped file-type cards rather than prose paragraphs." },
      { title: "Preparation guidance second", description: "Explain readability, scan quality, and why clean source files matter." },
      { title: "Action CTA last", description: "Send visitors into lecture capture once they know what to upload." },
    ],
    fileGroups: [
      { label: "Lecture media", items: ["Audio files", "Video files", "Browser-recorded lecture captures"] },
      { label: "Study documents", items: ["PDF files", "PowerPoint files", "Word documents", "Text and Markdown files"] },
      { label: "Visual sources", items: ["Images of notes", "Slides", "Past papers", "Diagrams and references"] },
    ],
    modules: [
      {
        icon: "badge-help",
        title: "Best-practice recommendations",
        items: [
          "Use clear, readable PDFs rather than low-quality scans when possible",
          "Upload structured lecture notes for stronger study guides",
          "Combine recordings, slides, and past papers for the best outputs",
        ],
      },
    ],
    visuals: [
      "File-type cards with iconography and short explanations",
      "Upload recommendation rail with quality badges",
      "Mini workflow from file prep to AI generation",
    ],
    emptyState: {
      title: "No file guidance selected",
      description: "Render a grouped upload guide with calm placeholder cards and a CTA to open lecture capture.",
    },
    designNotes: [
      "The page should feel like a polished operations guide, not a developer compatibility dump.",
      "Keep the file-card grid bright and easy to scan on mobile.",
      "Use trust-focused language around clean inputs and better AI outcomes.",
    ],
    relatedPages: ["/resources/study-workflow", "/resources/ai-accuracy-guide", "/product/lecture-capture"],
    footerCrossLinks: ["/support/help-center", "/company/security", "/company/privacy"],
  }),
  page({
    route: "/resources/study-workflow",
    title: "Study Workflow",
    category: "Resources",
    access: "public",
    metadata: {
      title: "Study Workflow | Mabaso AI",
      description: "Understand the full Mabaso AI workflow from lecture upload and transcription through study generation, revision, collaboration, and exports.",
    },
    hero: {
      eyebrow: "Resources / Study Workflow",
      headline: "See the entire Mabaso AI learning flow from upload to export.",
      description: "Study Workflow visualizes how the platform operates: capture lecture material, transcribe, generate study tools, revise, collaborate, and export the final outputs.",
      ctas: [
        primaryCta("Start the Workflow", "open-app", "capture"),
        secondaryCta("View Supported File Types", "route", "/resources/supported-file-types"),
      ],
      metrics: [
        { label: "Stages", value: "6" },
        { label: "Outputs", value: "Multi-format" },
        { label: "Flow type", value: "Lecture-to-workspace" },
      ],
      preview: {
        kicker: "Animated workflow diagram",
        title: "Upload -> transcribe -> generate -> revise -> collaborate -> export",
        subtitle: "This page should feel like the clean operating model of the product, with motion-led diagrams and clear outcomes.",
        tabs: ["Capture", "Generate", "Revise", "Share"],
        rows: [
          { label: "Step 1", value: "Upload or record" },
          { label: "Step 2", value: "Generate AI study tools" },
          { label: "Step 3", value: "Revise, collaborate, export" },
        ],
      },
    },
    contains: [
      { icon: "workflow", title: "Full platform timeline", description: "Every major product stage is mapped in sequence for easy understanding." },
      { icon: "circuit-board", title: "AI generation handoff", description: "The page clarifies how transcription becomes a study workspace." },
      { icon: "download-cloud", title: "Revision and export outcomes", description: "Shows where flashcards, tests, podcasts, PowerPoints, and PDFs fit." },
    ],
    workflow: [
      "Upload lecture files or record live",
      "Transcribe and extract lecture context",
      "Generate study guide, formulas, examples, flashcards, and test",
      "Use Mabaso AI Tutor, Study Chat, podcast, and presentation tools",
      "Collaborate in shared rooms",
      "Download study outputs and reopen history later",
    ],
    layout: [
      { title: "Animated process hero", description: "The workflow itself is the hero visual, not a static text block." },
      { title: "Stage explanation grid", description: "Break each major stage into a card with input, action, and outcome." },
      { title: "Conversion CTA rail", description: "Offer direct entry into lecture capture and study workspace after the explanation." },
    ],
    modules: [
      {
        icon: "boxes",
        title: "Content architecture",
        items: [
          "Input stage",
          "AI transformation stage",
          "Revision stage",
          "Collaboration and export stage",
        ],
      },
    ],
    visuals: [
      "Animated workflow timeline with glowing connectors",
      "Stage cards with input and output badges",
      "Export endpoint cards for PDF, PowerPoint, and MP3",
    ],
    emptyState: {
      title: "Workflow preview unavailable",
      description: "Use a bright timeline skeleton with six stage placeholders and a CTA to start from lecture capture.",
    },
    designNotes: [
      "This page should feel like the platform operating model that a serious AI company would publish.",
      "Use connected motion and clear stage hierarchy to make the flow memorable.",
      "Keep each stage outcome short and concrete.",
    ],
    relatedPages: ["/product/lecture-capture", "/product/study-workspace", "/resources/ai-accuracy-guide"],
    footerCrossLinks: ["/company/about", "/support/help-center", "/company/terms"],
  }),
  page({
    route: "/resources/ai-accuracy-guide",
    title: "AI Accuracy Guide",
    category: "Resources",
    access: "public",
    metadata: {
      title: "AI Accuracy Guide | Mabaso AI",
      description: "Learn how Mabaso AI generation works, where AI limitations exist, and how to get stronger results from notes, slides, recordings, and past papers.",
    },
    hero: {
      eyebrow: "Resources / AI Accuracy Guide",
      headline: "Get the strongest results by understanding how the AI works.",
      description: "AI Accuracy Guide explains the practical trust model behind Mabaso AI: what source quality matters, where AI can simplify or miss context, and how students can get more reliable outputs.",
      ctas: [
        primaryCta("Improve My Results", "open-app", "capture"),
        secondaryCta("Read Security", "route", "/company/security"),
      ],
      metrics: [
        { label: "Focus", value: "Trust and quality" },
        { label: "Best results", value: "Combined sources" },
        { label: "Audience", value: "Students and teams" },
      ],
      preview: {
        kicker: "Trust and quality system",
        title: "Source quality, output limits, and better-result practices",
        subtitle: "Use premium safety and quality cards rather than fear-heavy legal styling.",
        tabs: ["How it works", "Limits", "Best results", "Verification"],
        rows: [
          { label: "Input quality", value: "Critical" },
          { label: "AI behavior", value: "Helpful but not infallible" },
          { label: "Recommendation", value: "Verify important material" },
        ],
      },
    },
    contains: [
      { icon: "brain-circuit", title: "How generation works", description: "The page explains how different source types combine into study outputs." },
      { icon: "alert-triangle", title: "Known limitations", description: "Clarifies where AI may simplify, omit, or misread noisy source material." },
      { icon: "badge-check", title: "Best-result practices", description: "Shows how notes, slides, recordings, and past papers strengthen outputs together." },
    ],
    layout: [
      { title: "Trust hero", description: "Lead with confidence-building explanations, not defensive warnings." },
      { title: "Quality playbook", description: "Use practical guidance cards for source quality, verification, and regeneration." },
      { title: "Action section", description: "Close with capture and support CTAs for users who need better results or help." },
    ],
    modules: [
      {
        icon: "gauge",
        title: "Best-result guidance",
        items: [
          "Use clean lecture notes when possible",
          "Add slides for structure and formulas",
          "Include past papers and memos for assessment style",
          "Regenerate when the first draft is too transcript-heavy or shallow",
        ],
      },
      {
        icon: "shield",
        title: "Trust framing",
        items: [
          "AI outputs should support learning, not replace academic judgment",
          "Important academic, scientific, and technical information should be independently checked",
          "The strongest workflow combines multiple source types instead of one weak source",
        ],
      },
    ],
    visuals: [
      "Quality ladder from weak input to strong multi-source input",
      "Trust card system for verification and best practices",
      "Flow card showing regenerate-and-improve loop",
    ],
    emptyState: {
      title: "No AI quality guide section selected",
      description: "Render a premium trust card stack with calm blue accents and a CTA to improve lecture inputs.",
    },
    designNotes: [
      "This page should reassure and educate, not sound defensive or uncertain.",
      "Use strong design polish so the trust content feels product-grade, not like a compliance afterthought.",
      "Balance clarity and restraint: serious without becoming alarmist.",
    ],
    relatedPages: ["/company/security", "/support/help-center", "/product/ai-study-guide"],
    footerCrossLinks: ["/company/privacy", "/company/terms", "/support/faq"],
  }),
  page({
    route: "/support/help-center",
    title: "Help Center",
    category: "Support",
    access: "public",
    metadata: {
      title: "Help Center | Mabaso AI",
      description: "Search articles, troubleshoot uploads, transcription, exports, browser issues, and workspace problems in the Mabaso AI Help Center.",
    },
    hero: {
      eyebrow: "Support / Help Center",
      headline: "Searchable help for uploads, generation, exports, browsers, and collaboration.",
      description: "Help Center is the public service layer of Mabaso AI. It groups support topics around the real product journey so users can solve problems quickly before opening a ticket.",
      ctas: [
        primaryCta("Open Contact Support", "route", "/support/contact-support"),
        secondaryCta("Browse FAQ", "route", "/support/faq"),
      ],
      metrics: [
        { label: "Coverage", value: "Capture to export" },
        { label: "Format", value: "Searchable support cards" },
        { label: "Availability", value: "Public" },
      ],
      preview: {
        kicker: "Searchable help index",
        title: "Uploads, browsers, transcription, downloads, and account issues",
        subtitle: "Use a premium enterprise help layout with search, categories, and quick actions.",
        tabs: ["Uploads", "Generation", "Browser", "Export"],
        rows: [
          { label: "Fast path", value: "Search first, ticket second" },
          { label: "Coverage", value: "Full platform lifecycle" },
          { label: "Related", value: "FAQ and support contact" },
        ],
      },
    },
    contains: [
      { icon: "search-code", title: "Searchable help articles", description: "Visitors can scan support cards by problem type and workflow stage." },
      { icon: "triangle-alert", title: "Troubleshooting cards", description: "Upload issues, browser issues, export problems, and generation failures are separated cleanly." },
      { icon: "life-buoy", title: "Escalation path", description: "Each section connects to Contact Support and FAQ for deeper help." },
    ],
    layout: [
      { title: "Search hero", description: "Lead with a large search field and category cards in an enterprise help style." },
      { title: "Troubleshooting grid", description: "Group help by upload, generation, browser, collaboration, and export stages." },
      { title: "Escalation section", description: "End with direct paths into contact support and legal/trust pages." },
    ],
    modules: [
      {
        icon: "folder-search-2",
        title: "Help categories",
        items: [
          "Upload and file-format issues",
          "Transcription and generation delays",
          "Browser, audio, and recording issues",
          "Download and export problems",
        ],
      },
    ],
    faq: [
      { question: "Why is my lecture file not uploading?", answer: "Check the supported file types, file size, and whether the source is a clean audio or video file. Large or blocked file types can fail before processing starts." },
      { question: "Why did the study guide feel incomplete?", answer: "Guide quality depends on source quality. Adding notes, slides, and past papers usually improves output depth and structure." },
      { question: "Why can I not download my podcast or presentation?", answer: "Downloads are tied to generated assets in your signed-in workspace. If generation is still running or the job expired, regenerate the asset." },
      { question: "Why is shared audio unavailable during recording?", answer: "Browser support varies. Desktop Chrome or Edge usually gives the strongest browser-tab audio capture options." },
    ],
    visuals: [
      "Enterprise help search bar with category chips",
      "Troubleshooting card grid grouped by product stage",
      "Escalation rail linking to FAQ and support contact",
    ],
    emptyState: {
      title: "No help articles match yet",
      description: "Use a calm empty-search state that suggests popular categories and routes users into support contact if they still need help.",
    },
    designNotes: [
      "Help pages should feel clear and product-native, not like an outsourced support portal.",
      "Use bright cards inside a dark shell to keep help content readable and structured.",
      "Search, categories, and escalation CTAs should all be visible above the fold.",
    ],
    relatedPages: ["/support/contact-support", "/support/faq", "/resources/supported-file-types"],
    footerCrossLinks: ["/company/security", "/company/privacy", "/company/terms"],
  }),
  page({
    route: "/support/contact-support",
    title: "Contact Support",
    category: "Support",
    access: "public",
    metadata: {
      title: "Contact Support | Mabaso AI",
      description: "Contact Mabaso AI through direct support channels including email, in-app messaging guidance, and phone support details.",
    },
    hero: {
      eyebrow: "Support / Contact Support",
      headline: "How to contact Mabaso AI for support and enquiries.",
      description: "Contact Support explains the direct Mabaso AI support channels for email enquiries, in-app messaging guidance, and phone contact instead of using a built-in support ticket form.",
      ctas: [
        primaryCta("Browse Help Center", "route", "/support/help-center"),
        secondaryCta("View FAQ", "route", "/support/faq"),
      ],
      metrics: [
        { label: "Email support", value: "Direct" },
        { label: "Public page", value: "Yes" },
        { label: "Phone contact", value: "Available" },
      ],
      preview: {
        kicker: "Contact options preview",
        title: "Email, in-app messaging, and phone support in one clear contact guide",
        subtitle: "Use a support page that feels like a serious product company contact article, not a form-heavy ticket screen.",
        tabs: ["Email", "Messaging", "Phone", "Help"],
        rows: [
          { label: "Primary email", value: "mabasoasakhe10@gmail.com" },
          { label: "Phone and messaging", value: "0717020081" },
          { label: "Best results", value: "Include the page, action, and expected result" },
        ],
      },
    },
    contains: [
      { icon: "mail", title: "Direct email support", description: "Users can send enquiries straight to Mabaso AI support by email." },
      { icon: "messages-square", title: "In-app messaging guidance", description: "Signed-in users can use Mabaso AI while following the listed contact guidance." },
      { icon: "phone-call", title: "Phone contact", description: "The page exposes the number to use for direct calls and messaging support." },
    ],
    layout: [
      { title: "Contact-led hero", description: "Bring the email and phone routes into the first fold instead of using a submission form." },
      { title: "Support options table", description: "Show contact channels in a clean comparison table like a SaaS help article." },
      { title: "Response guidance", description: "Close with simple advice on what information helps Mabaso AI respond faster." },
    ],
    modules: [
      {
        icon: "clipboard-list",
        title: "Suggested form modules",
        items: [
          "Contact options comparison table",
          "Direct email action",
          "Phone and in-app messaging section",
          "Response guidance note",
        ],
      },
      {
        icon: "shield-check",
        title: "Access guidance",
        items: [
          "The page is public so visitors can understand the support path",
          "No built-in support form is required on this page",
          "Signed-in users can still use Mabaso AI while following the listed support channels",
        ],
      },
    ],
    visuals: [
      "Support article layout with a clean comparison table",
      "Direct contact cards for email and phone",
      "Product-style help section with quiet trust signals",
    ],
    emptyState: {
      title: "No contact method highlighted yet",
      description: "Render the support contact table and direct email or phone actions so the page still feels complete and trustworthy.",
    },
    designNotes: [
      "This page should feel trustworthy and procedural, not casual.",
      "Use article structure and contact cards instead of a ticket-form layout.",
      "Keep the support paths obvious so users immediately know where to email or call.",
    ],
    relatedPages: ["/support/help-center", "/support/faq", "/company/security"],
    footerCrossLinks: ["/company/privacy", "/company/terms", "/company/about"],
  }),
  page({
    route: "/support/faq",
    title: "FAQ",
    category: "Support",
    access: "public",
    metadata: {
      title: "FAQ | Mabaso AI",
      description: "Browse frequently asked questions about accounts, uploads, AI generation, downloads, collaboration, and trust in Mabaso AI.",
    },
    hero: {
      eyebrow: "Support / FAQ",
      headline: "Answers to the questions users ask most often.",
      description: "FAQ is a searchable public knowledge layer that helps visitors understand accounts, AI generation, file support, collaboration, privacy, and export behavior before they commit to the platform.",
      ctas: [
        primaryCta("Search Help Center", "route", "/support/help-center"),
        secondaryCta("Contact Support", "route", "/support/contact-support"),
      ],
      metrics: [
        { label: "Format", value: "Searchable accordion" },
        { label: "Coverage", value: "Accounts to exports" },
        { label: "Audience", value: "Visitors and users" },
      ],
      preview: {
        kicker: "FAQ system",
        title: "Account, uploads, AI, collaboration, and trust questions",
        subtitle: "A premium accordion system with category-aware search keeps the page practical and lightweight.",
        tabs: ["Accounts", "Uploads", "AI", "Exports"],
        rows: [
          { label: "Use case", value: "Fast self-service answers" },
          { label: "Navigation", value: "Search and expand" },
          { label: "Escalation", value: "Help Center and Support" },
        ],
      },
    },
    contains: [
      { icon: "circle-help", title: "Accordion UI", description: "Questions are grouped and expandable so answers stay fast to scan." },
      { icon: "search", title: "Searchable system", description: "Visitors can narrow answers by topic and wording." },
      { icon: "arrow-up-right", title: "Escalation paths", description: "Each answer can push into Help Center or Contact Support when needed." },
    ],
    layout: [
      { title: "Search first", description: "A large search bar and quick topic chips sit above the accordion." },
      { title: "Category groupings", description: "Separate account, upload, generation, collaboration, export, and privacy questions." },
      { title: "Escalation footer", description: "End with direct actions into help and support." },
    ],
    faq: [
      { question: "Do I need an account to use Mabaso AI?", answer: "You can explore public product and company pages without an account, but live workspaces, uploads, study generation, saved materials, and collaboration require sign-in." },
      { question: "Which file types are supported?", answer: "Mabaso AI supports common lecture media plus notes, slides, images, PDFs, PowerPoint files, Word documents, and text-based study sources." },
      { question: "Can Mabaso AI mark written answers?", answer: "Yes. The platform supports written test answers, image-assisted answer uploads, and AI marking feedback inside the authenticated workspace." },
      { question: "Can I collaborate with other students?", answer: "Yes. Shared study rooms let invited members view a lecture-centered collaboration space with notes, room chat, and study-tool syncing." },
      { question: "Are AI outputs always correct?", answer: "No AI system is perfect. Mabaso AI is designed as a supplementary study tool, and important information should still be independently verified." },
      { question: "Can I download my generated work?", answer: "Yes. Study packs, tests, presentations, and podcast audio can be exported from the authenticated workspace when the relevant asset has been generated." },
    ],
    visuals: [
      "Searchable accordion with category chips",
      "FAQ cards that expand without breaking the premium page rhythm",
      "Escalation CTA rail into help and support",
    ],
    emptyState: {
      title: "No FAQ answer matches that search",
      description: "Show suggested topics, then send users into Help Center or Contact Support from a polished fallback card.",
    },
    designNotes: [
      "FAQ must feel as polished as a product page, not buried support text.",
      "Use generous spacing and consistent accordion motion to keep it premium.",
      "Keep answers short, useful, and easy to escalate when they are not enough.",
    ],
    relatedPages: ["/support/help-center", "/support/contact-support", "/resources/ai-accuracy-guide"],
    footerCrossLinks: ["/company/privacy", "/company/terms", "/company/security"],
  }),
  page({
    route: "/company/about",
    title: "About Mabaso AI",
    category: "Company",
    access: "public",
    metadata: {
      title: "About Mabaso AI | Mabaso AI",
      description: "Learn about Mabaso AI, its educational mission, learning philosophy, and why the platform is building an AI-native study system for modern students.",
    },
    hero: {
      eyebrow: "Company / About",
      headline: "Building AI study systems that feel more like real learning software than generic content generation.",
      description: "About Mabaso AI presents the company mission, education vision, and why the product is being shaped as a serious learning platform for structured study, not a loose AI tool collection.",
      ctas: [
        primaryCta("Start Using Mabaso AI", "open-app", "capture"),
        secondaryCta("Read Security", "route", "/company/security"),
      ],
      metrics: [
        { label: "Focus", value: "AI-powered education" },
        { label: "Mission", value: "Smarter learning" },
        { label: "Experience goal", value: "Structured and modern" },
      ],
      preview: {
        kicker: "Company story",
        title: "Mission, philosophy, and product ambition",
        subtitle: "This page should feel like a confident AI company narrative with editorial spacing and product-centered storytelling.",
        tabs: ["Mission", "Philosophy", "Platform", "Future"],
        rows: [
          { label: "Core idea", value: "Lecture-to-learning workspace" },
          { label: "Audience", value: "Students and learning teams" },
          { label: "Tone", value: "Trustworthy and ambitious" },
        ],
      },
    },
    markdown: `
## About Mabaso AI

Mabaso AI is an AI-powered educational platform designed to help students learn smarter, study faster, and understand difficult concepts more effectively.

The platform combines modern artificial intelligence tools with structured educational techniques to generate study guides, worked examples, revision materials, AI-assisted explanations, and learning support systems that feel connected instead of fragmented.

## Our Mission

Our mission is to simplify learning through intelligent educational technology.

We aim to help students:

- Understand concepts more deeply
- Improve problem-solving skills
- Save study time
- Organize academic content efficiently
- Access personalized educational assistance

## Learning Philosophy

Mabaso AI is designed around a simple belief: students learn better when explanation, practice, recall, collaboration, and export all live in one coherent workspace.

That is why the platform is built around lecture context, not isolated AI prompts.
`,
    contains: [
      { icon: "building-2", title: "Company mission", description: "Explains why Mabaso AI exists and the educational problem it is solving." },
      { icon: "lightbulb", title: "Learning philosophy", description: "Shows the structured-study vision behind the product." },
      { icon: "rocket", title: "Platform direction", description: "Frames Mabaso AI as an ambitious AI education platform, not a small side utility." },
    ],
    layout: [
      { title: "Editorial hero", description: "Lead with company vision in a premium narrative layout, not a generic founder page." },
      { title: "Mission and philosophy grid", description: "Break the story into mission cards, product beliefs, and user outcomes." },
      { title: "Forward-looking CTA", description: "Close with product links so the company story stays connected to real workflows." },
    ],
    modules: [
      {
        icon: "timeline",
        title: "Suggested content blocks",
        items: [
          "Mission cards",
          "Learning philosophy blocks",
          "Product ambition timeline",
        ],
      },
    ],
    visuals: [
      "Editorial mission cards with subtle glow accents",
      "Product evolution timeline",
      "Quote-style philosophy blocks over a navy gradient",
    ],
    emptyState: {
      title: "Company story still expanding",
      description: "Render a premium editorial placeholder with mission headlines and a CTA into the live product pages.",
    },
    designNotes: [
      "This page should feel like a real AI company, not a personal project bio.",
      "Use editorial spacing, bold typography, and limited but strong accent color.",
      "Keep the story grounded in product direction and student outcomes.",
    ],
    relatedPages: ["/company/security", "/company/privacy", "/product/study-workspace"],
    footerCrossLinks: ["/company/terms", "/support/help-center", "/resources/study-workflow"],
  }),
  page({
    route: "/company/security",
    title: "Security",
    category: "Company",
    access: "public",
    metadata: {
      title: "Security | Mabaso AI",
      description: "Understand Mabaso AI security controls including secure uploads, encrypted transport, session monitoring, AI abuse prevention, admin auditing, and platform hardening.",
    },
    hero: {
      eyebrow: "Company / Security",
      headline: "Security architecture designed to protect uploads, sessions, AI usage, and collaboration.",
      description: "Security explains how Mabaso AI approaches trust: secure uploads, session controls, response headers, rate limiting, route hardening, monitoring, and admin-level auditing for sensitive product operations.",
      ctas: [
        primaryCta("Read Privacy Policy", "route", "/company/privacy"),
        secondaryCta("Contact Support", "route", "/support/contact-support"),
      ],
      metrics: [
        { label: "Upload hardening", value: "Validated" },
        { label: "Session controls", value: "Tracked" },
        { label: "AI abuse prevention", value: "Rate-limited" },
      ],
      preview: {
        kicker: "Enterprise trust layer",
        title: "Encryption, secure uploads, monitoring, and admin auditing",
        subtitle: "This page should feel serious, technical, and calm enough to increase trust without reading like pure compliance copy.",
        tabs: ["Transport", "Uploads", "Sessions", "Monitoring"],
        rows: [
          { label: "In transit", value: "HTTPS and secure headers" },
          { label: "Uploads", value: "Validated and constrained" },
          { label: "Monitoring", value: "Audits and safeguards" },
        ],
      },
    },
    contains: [
      { icon: "shield-check", title: "Secure uploads", description: "File validation, route hardening, and safer document parsing reduce upload risk." },
      { icon: "key-round", title: "Session monitoring", description: "Authenticated sessions, expiry windows, and activity logging protect user access." },
      { icon: "cpu", title: "AI abuse prevention", description: "Rate limits and guarded generation flows reduce spam, scraping, and prompt abuse." },
    ],
    layout: [
      { title: "Trust hero", description: "Start with security posture, not marketing slogans." },
      { title: "Control categories", description: "Break the page into uploads, sessions, AI routes, admin monitoring, and platform headers." },
      { title: "Support reassurance", description: "Close with privacy, terms, and support links for users who need more context." },
    ],
    modules: [
      {
        icon: "server-cog",
        title: "Security controls",
        items: [
          "Strict response headers and browser protections",
          "Upload validation, type checks, and safer Office-document handling",
          "Rate limiting for auth, AI routes, and support workflows",
        ],
      },
      {
        icon: "scan-eye",
        title: "Monitoring and trust",
        items: [
          "Audit logging for sensitive product actions",
          "Admin alerts and session analytics",
          "Secure handling for protected user routes and collaboration flows",
        ],
      },
      {
        icon: "lock-keyhole",
        title: "Design notes",
        items: [
          "Use enterprise-grade trust visuals such as shield cards, control diagrams, and subtle telemetry panels",
          "Avoid alarmist red-heavy styling unless it is tied to access-denied states",
          "Keep technical claims clear and tied to real platform behavior",
        ],
      },
    ],
    visuals: [
      "Security control cards with transport, upload, and session groupings",
      "Platform monitoring panel showing audits and health signals",
      "Route-protection diagram for public, authenticated, and admin-only states",
    ],
    emptyState: {
      title: "Security details unavailable",
      description: "Render a trust-focused control panel skeleton with privacy and support links so the page never feels abandoned.",
    },
    designNotes: [
      "This page must feel enterprise-grade and credible.",
      "Use precise language and clean cards rather than hype-heavy copy.",
      "Trust increases when security claims stay connected to real product surfaces and controls.",
    ],
    relatedPages: ["/company/privacy", "/company/terms", "/support/contact-support"],
    footerCrossLinks: ["/resources/ai-accuracy-guide", "/company/about", "/developers/api-documentation"],
  }),
  page({
    route: "/company/privacy",
    title: "Privacy Policy",
    category: "Company",
    access: "public",
    metadata: {
      title: "Privacy Policy | Mabaso AI",
      description: "Learn what data Mabaso AI stores, how uploads, transcripts, collaboration records, sessions, and analytics are handled, and how privacy fits into the platform.",
    },
    hero: {
      eyebrow: "Company / Privacy",
      headline: "A privacy policy built around uploads, study history, and collaboration data.",
      description: "Privacy Policy explains what Mabaso AI stores, why it stores it, and how session data, transcripts, uploads, collaboration records, support requests, and usage analytics fit into the product.",
      ctas: [
        primaryCta("Read Terms", "route", "/company/terms"),
        secondaryCta("View Security", "route", "/company/security"),
      ],
      metrics: [
        { label: "Scope", value: "Uploads to analytics" },
        { label: "Audience", value: "Public" },
        { label: "Companion pages", value: "Security and terms" },
      ],
      preview: {
        kicker: "Privacy architecture",
        title: "Account data, uploads, transcripts, collaboration, and analytics",
        subtitle: "Frame the policy in product language first, then support it with structured legal clarity.",
        tabs: ["Accounts", "Uploads", "History", "Analytics"],
        rows: [
          { label: "Stored data", value: "Operational and user-facing" },
          { label: "Purpose", value: "Functionality and security" },
          { label: "Support", value: "Related to security and terms" },
        ],
      },
    },
    markdown: `
## Privacy Overview

Mabaso AI may store account data, uploaded study materials, generated study packs, collaboration records, support requests, and technical usage signals in order to run the platform securely and reliably.

## Data Categories

- Account information used for authentication and session management
- Uploaded lecture files, notes, slides, and supporting study sources
- Generated transcripts, study guides, tests, podcast assets, and presentation outputs
- Collaboration room messages, shared notes, and room-level study interactions
- Support requests, diagnostics, and operational security logs

## Why Data Is Stored

Data is used to:

- Provide the Mabaso AI service
- Reopen previous study sessions
- Improve platform stability and abuse detection
- Support collaboration and export workflows
- Monitor system performance and secure the platform
`,
    contains: [
      { icon: "database", title: "Stored data categories", description: "Explains the account, upload, output, collaboration, and support data the platform may store." },
      { icon: "history", title: "Study history handling", description: "Clarifies why generated materials and history can be reopened later." },
      { icon: "line-chart", title: "Analytics and operational logs", description: "Explains how technical usage signals help security, support, and product health." },
    ],
    layout: [
      { title: "Policy hero", description: "Open with a product-aware privacy summary before deeper legal structure." },
      { title: "Data categories", description: "Use grouped cards for account data, uploads, outputs, collaboration, and analytics." },
      { title: "Linked trust pages", description: "Cross-link privacy to security, terms, and support without burying users in legal text." },
    ],
    modules: [
      {
        icon: "folder-lock",
        title: "Suggested policy modules",
        items: [
          "Account and session data",
          "Upload and transcript handling",
          "Study history and collaboration storage",
          "Analytics, security logs, and support records",
        ],
      },
    ],
    visuals: [
      "Data-category cards with calm trust styling",
      "Platform data flow from uploads to workspace history",
      "Cross-link rail to security and terms pages",
    ],
    emptyState: {
      title: "Privacy policy section missing",
      description: "Render a structured trust card layout so policy content still feels complete and intentional.",
    },
    designNotes: [
      "Privacy pages should stay readable and product-aware, not purely legal in tone.",
      "Use grouped cards and short summaries before deeper policy sections.",
      "Trust increases when privacy is explained in the same language users understand the product with.",
    ],
    relatedPages: ["/company/security", "/company/terms", "/support/contact-support"],
    footerCrossLinks: ["/company/about", "/resources/ai-accuracy-guide", "/developers/api-documentation"],
  }),
  page({
    route: "/company/terms",
    aliases: ["/terms-and-conditions"],
    title: "Terms & Conditions",
    category: "Company",
    access: "public",
    metadata: {
      title: "Terms & Conditions | Mabaso AI",
      description: "Read the Mabaso AI terms covering accounts, AI limitations, uploads, acceptable use, collaboration, downloads, privacy, and service policies.",
    },
    hero: {
      eyebrow: "Company / Terms",
      headline: "Clear platform rules for AI study generation, uploads, collaboration, and account use.",
      description: "Terms & Conditions lays out the rules that govern Mabaso AI: platform access, acceptable use, AI limitations, media uploads, collaboration, downloads, storage, privacy, and account policy.",
      ctas: [
        primaryCta("Read Privacy Policy", "route", "/company/privacy"),
        secondaryCta("View Security", "route", "/company/security"),
      ],
      metrics: [
        { label: "Effective date", value: "February 2026" },
        { label: "Scope", value: "Accounts to AI outputs" },
        { label: "Access", value: "Public" },
      ],
      preview: {
        kicker: "Legal overview",
        title: "Accounts, uploads, AI limitations, and platform rules",
        subtitle: "A premium legal page should still feel readable and product-native, with strong hierarchy and calm enterprise polish.",
        tabs: ["Accounts", "Uploads", "AI", "Platform Rules"],
        rows: [
          { label: "Audience", value: "All visitors and users" },
          { label: "Purpose", value: "Platform governance" },
          { label: "Related", value: "Privacy and security" },
        ],
      },
    },
    markdown: termsAndConditionsMarkdown,
    contains: [
      { icon: "scale", title: "Platform rules", description: "Covers acceptable use, account responsibility, uploads, and collaboration behavior." },
      { icon: "brain", title: "AI limitation framing", description: "Clarifies that AI outputs are supplementary and should be verified when important." },
      { icon: "file-warning", title: "Upload and ownership terms", description: "Explains what users may upload and the rights needed to do so." },
    ],
    layout: [
      { title: "Legal hero", description: "Open with a concise summary and quick context before the full text starts." },
      { title: "Full terms body", description: "Render the markdown in a bright, editorial card inside the dark enterprise shell." },
      { title: "Related trust pages", description: "Link out to privacy, security, and support once the terms content ends." },
    ],
    modules: [
      {
        icon: "shield-alert",
        title: "Key policy themes",
        items: [
          "Account eligibility and responsibility",
          "User uploads and acceptable use",
          "AI-generated content limitations",
          "Data storage, privacy, and platform access rules",
        ],
      },
    ],
    visuals: [
      "Editorial legal page styling with structured headings",
      "Related trust links in a soft glass CTA rail",
      "Compact legal-summary cards before the full text block",
    ],
    emptyState: {
      title: "Terms content unavailable",
      description: "Show a legal-summary placeholder and keep related trust-page links visible until content is restored.",
    },
    designNotes: [
      "Terms must look like a serious SaaS legal page, not a pasted document.",
      "Use strong heading hierarchy, wide spacing, and readable line length.",
      "Keep the page clean and bright to reduce fatigue when reading long content.",
    ],
    relatedPages: ["/company/privacy", "/company/security", "/support/contact-support"],
    footerCrossLinks: ["/company/about", "/support/help-center", "/developers/api-documentation"],
  }),
  page({
    route: "/developers/api-documentation",
    title: "API Documentation",
    category: "Developers",
    access: "public",
    metadata: {
      title: "API Documentation | Mabaso AI",
      description: "Stripe-style API documentation for Mabaso AI covering authentication, uploads, generation routes, and sample request and response structures.",
    },
    hero: {
      eyebrow: "Developers / API Documentation",
      headline: "A Stripe-style API reference for authentication, uploads, generation, and exports.",
      description: "API Documentation presents Mabaso AI as an extensible product platform. It explains authentication, upload routes, generation endpoints, job polling, and response shapes in a developer-first layout.",
      ctas: [
        primaryCta("Explore Integrations", "route", "/developers/integrations"),
        secondaryCta("Read Security", "route", "/company/security"),
      ],
      metrics: [
        { label: "Style", value: "Developer first" },
        { label: "Coverage", value: "Auth, jobs, uploads, generation" },
        { label: "Audience", value: "Public" },
      ],
      preview: {
        kicker: "API shell",
        title: "Authentication, uploads, generation, and response examples",
        subtitle: "This page should feel like a serious product platform reference with endpoint cards and code examples side by side.",
        tabs: ["Auth", "Uploads", "Jobs", "Generation"],
        rows: [
          { label: "Reference style", value: "Endpoint + response examples" },
          { label: "Auth", value: "Bearer token" },
          { label: "Flow", value: "Request -> job -> result" },
        ],
      },
    },
    contains: [
      { icon: "braces", title: "Endpoint reference", description: "Covers auth, uploads, generation, and study-job patterns." },
      { icon: "key-square", title: "Authentication model", description: "Explains bearer tokens, protected routes, and session-sensitive APIs." },
      { icon: "terminal-square", title: "Response examples", description: "Shows job IDs, success responses, and generation request shapes." },
    ],
    layout: [
      { title: "Docs hero", description: "Lead with the API framing and a compact endpoint architecture overview." },
      { title: "Endpoint and code split", description: "Use a two-column developer layout with endpoint descriptions beside code blocks." },
      { title: "Platform trust section", description: "Close with rate-limit, security, and integration references." },
    ],
    modules: [
      {
        icon: "network",
        title: "Suggested reference groups",
        items: [
          "Authentication and session routes",
          "Lecture upload and extraction routes",
          "Study generation and polling routes",
          "Protected admin and support endpoints",
        ],
      },
    ],
    codeSamples: [
      {
        title: "Authenticate and attach a bearer token",
        language: "http",
        code: `POST /auth/email-password/login
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "••••••••",
  "mode": "login"
}

Response:
{
  "email": "student@example.com",
  "token": "mabaso.v1....",
  "session_mode": "user"
}`,
      },
      {
        title: "Upload a lecture and receive a job ID",
        language: "http",
        code: `POST /upload-audio/
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=<lecture-recording.mp4>

Response:
{
  "job_id": "job_lecture_123"
}`,
      },
      {
        title: "Generate a study guide from lecture context",
        language: "json",
        code: `POST /generate-study-guide/
Authorization: Bearer <token>
Content-Type: application/json

{
  "transcript": "Lecture transcript...",
  "lecture_notes": "Notes...",
  "lecture_slides": "Slides...",
  "past_question_papers": "Past paper text...",
  "language": "English",
  "reference_images": []
}`,
      },
    ],
    visuals: [
      "Stripe-like developer layout with docs rail and code panel",
      "Endpoint cards with method and protection chips",
      "Request-to-job-to-result lifecycle diagram",
    ],
    emptyState: {
      title: "API examples are still being prepared",
      description: "Use a developer-shell placeholder with endpoint chips, code skeletons, and links into integrations and security.",
    },
    designNotes: [
      "The docs page should feel product-platform ready, even if the API is still internal.",
      "Use monospace code panels with quiet glow rather than heavy neon developer styling.",
      "Security and rate-limit notes should appear naturally inside the docs, not as detached warnings.",
    ],
    relatedPages: ["/developers/integrations", "/company/security", "/company/privacy"],
    footerCrossLinks: ["/company/terms", "/support/help-center", "/resources/study-workflow"],
  }),
  page({
    route: "/developers/integrations",
    title: "Integrations",
    category: "Developers",
    access: "public",
    metadata: {
      title: "Integrations | Mabaso AI",
      description: "Explore planned Mabaso AI integrations for Google Drive, Zoom, Teams, Notion, and Canvas LMS in a product-platform roadmap style.",
    },
    hero: {
      eyebrow: "Developers / Integrations",
      headline: "A future-ready integrations layer for the study workspace.",
      description: "Integrations describes how Mabaso AI can evolve into a connected learning platform across Google Drive, Zoom, Microsoft Teams, Notion, and learning-management systems like Canvas.",
      ctas: [
        primaryCta("Read API Documentation", "route", "/developers/api-documentation"),
        secondaryCta("Start with Lecture Capture", "open-app", "capture"),
      ],
      metrics: [
        { label: "Focus", value: "Workflow connectivity" },
        { label: "Targets", value: "Drive, Zoom, Teams, Notion, Canvas" },
        { label: "Style", value: "Platform roadmap" },
      ],
      preview: {
        kicker: "Integration roadmap",
        title: "Capture, storage, meetings, notes, and LMS connectivity",
        subtitle: "This page should feel like a serious platform roadmap, not a vague wishlist.",
        tabs: ["Storage", "Meetings", "Notes", "LMS"],
        rows: [
          { label: "Google Drive", value: "Import notes and exports" },
          { label: "Zoom and Teams", value: "Meeting and lecture workflow capture" },
          { label: "Canvas", value: "Course-material alignment" },
        ],
      },
    },
    contains: [
      { icon: "cloud", title: "Storage integrations", description: "Google Drive and similar services can become source and export paths." },
      { icon: "video", title: "Meeting-platform integrations", description: "Zoom and Teams can support lecture capture and scheduled workflows." },
      { icon: "plug-zap", title: "Learning-platform integrations", description: "Notion and Canvas-style systems can extend study-material intake and organization." },
    ],
    layout: [
      { title: "Roadmap hero", description: "Show integration targets as polished platform cards above the fold." },
      { title: "Use-case architecture", description: "Explain what each integration would unlock in capture, storage, collaboration, or revision." },
      { title: "Developer CTA band", description: "Connect visitors back to API docs and security posture." },
    ],
    modules: [
      {
        icon: "plug",
        title: "Target integrations",
        items: [
          "Google Drive for imports and exports",
          "Zoom for lecture-ready meeting workflows",
          "Teams for enterprise collaboration alignment",
          "Notion for structured note intake",
          "Canvas LMS for course-linked study flows",
        ],
      },
    ],
    visuals: [
      "Platform-card grid for future integrations",
      "Workflow diagrams showing import and export handoffs",
      "Roadmap strip connecting API docs to ecosystem expansion",
    ],
    emptyState: {
      title: "Integration details are still evolving",
      description: "Render roadmap cards with use-case summaries and links to API docs and platform security.",
    },
    designNotes: [
      "This page should feel like a believable platform roadmap from a growing AI company.",
      "Keep each integration grounded in actual workflow outcomes, not generic partner logos.",
      "Use subtle motion and connector lines to show ecosystem direction without overpromising dates.",
    ],
    relatedPages: ["/developers/api-documentation", "/product/lecture-capture", "/company/security"],
    footerCrossLinks: ["/company/about", "/support/help-center", "/resources/study-workflow"],
  }),
  page({
    route: "/admin/dashboard",
    title: "Admin Dashboard",
    category: "Admin",
    access: "admin",
    metadata: {
      title: "Admin Dashboard | Mabaso AI",
      description: "Administrative analytics, AI usage metrics, sessions, security alerts, and platform health for authorized Mabaso AI administrators.",
    },
    hero: {
      eyebrow: "Admin / Protected",
      headline: "Platform analytics, AI usage, security alerts, and operational controls for authorized administrators.",
      description: "Admin Dashboard represents the protected operations center of Mabaso AI. It brings together user metrics, AI generation usage, session intelligence, security alerts, content insights, and platform health monitoring.",
      ctas: [
        primaryCta("Open Admin Dashboard", "open-admin"),
        secondaryCta("Read Security", "route", "/company/security"),
      ],
      metrics: [
        { label: "Access", value: "Admin only" },
        { label: "Focus", value: "Operations and governance" },
        { label: "Monitoring", value: "Users, AI, sessions, security" },
      ],
      preview: {
        kicker: "Operations center preview",
        title: "Analytics, AI generation, sessions, storage, and alerts",
        subtitle: "The admin route must feel locked down, observability-heavy, and unmistakably protected.",
        tabs: ["Overview", "Users", "Sessions", "Security"],
        rows: [
          { label: "Audience", value: "Authorized administrators only" },
          { label: "Signals", value: "Usage, health, alerts" },
          { label: "Protection", value: "Strict access guard" },
        ],
      },
    },
    contains: [
      { icon: "bar-chart-3", title: "Analytics overview", description: "Platform usage, active users, AI output totals, and system health live together." },
      { icon: "shield-alert", title: "Security visibility", description: "Alerts, suspicious activity, failed logins, and admin audit flows are central." },
      { icon: "user-cog", title: "Administrative control", description: "User state management, force logout, and protected operations are admin scoped." },
    ],
    layout: [
      { title: "Operations hero", description: "Lead with administrative purpose and a protected-state visual, not public marketing." },
      { title: "Signal modules", description: "Group analytics, AI metrics, sessions, content, health, and security into an enterprise admin structure." },
      { title: "Guard and denial states", description: "Make unauthorized access states visually strong and explicit." },
    ],
    modules: [
      {
        icon: "radar",
        title: "Core dashboard areas",
        items: [
          "Overview analytics and KPI cards",
          "Users, sessions, and content visibility",
          "AI generation metrics and failed jobs",
          "Security alerts and system-health diagnostics",
        ],
      },
      {
        icon: "lock",
        title: "Access rules",
        items: [
          "Route requires login and admin authorization",
          "Unauthorized visitors see a premium access-denied screen",
          "Non-admin signed-in users are blocked from platform operations data",
        ],
      },
    ],
    visuals: [
      "Observability-heavy dashboard preview with charts and control cards",
      "Admin access-denied state with secure styling",
      "Security alert panel and session analytics cards",
    ],
    emptyState: {
      title: "Admin data is unavailable",
      description: "Render a secured telemetry shell with locked cards and clear messaging that administrative data is protected.",
    },
    designNotes: [
      "The admin route should feel like a real operations console, not a hidden settings page.",
      "Unauthorized and locked states must look premium and final, not like missing features.",
      "Use a lighter enterprise admin canvas to differentiate it from the student-facing dark workspace.",
    ],
    relatedPages: ["/company/security", "/developers/api-documentation", "/support/contact-support"],
    footerCrossLinks: ["/company/privacy", "/company/terms", "/company/about"],
    lockedPreview: {
      title: "Admin access is restricted",
      description: "Administrative analytics, security alerts, user controls, and audit data are only available to authorized Mabaso AI administrators.",
      benefits: [
        "Monitor platform health and AI generation usage",
        "Review sessions, users, and security alerts",
        "Manage protected operational controls",
      ],
    },
    adminGuard: {
      title: "Administrative access required",
      description: "This route is reserved for authorized Mabaso AI administrators. Sign in with an admin account or return to the student workspace.",
    },
  }),
];

export const protectedWorkspaceRoutes = [
  {
    route: "/app/capture",
    title: "Lecture Capture Workspace",
    description: "Capture lecture recordings, notes, slides, and past papers in a secure authenticated workspace.",
    access: "login",
  },
  {
    route: "/app/workspace",
    title: "Study Workspace",
    description: "Open the live AI study workspace with transcript, guide, examples, tests, exports, and collaboration handoff.",
    access: "login",
  },
  {
    route: "/app/materials",
    title: "Saved Materials",
    description: "Reopen generated study packs, saved tests, and export-ready history tied to the signed-in account.",
    access: "login",
  },
  {
    route: "/app/collaboration",
    title: "Collaboration Rooms",
    description: "Access shared study rooms, room notes, synced tools, and collaborative answer visibility settings.",
    access: "login",
  },
];

export function findSitePageByRoute(route = "/") {
  const normalized = route === "/" ? "/" : route.replace(/\/+$/, "") || "/";
  return sitePages.find((entry) => entry.route === normalized || entry.aliases.includes(normalized)) || null;
}

export function findFooterLinksByRoutes(routes = []) {
  return routes.map((route) => sitePages.find((entry) => entry.route === route)).filter(Boolean);
}

export function findProtectedWorkspaceRoute(route = "/") {
  const normalized = route === "/" ? "/" : route.replace(/\/+$/, "") || "/";
  return protectedWorkspaceRoutes.find((entry) => entry.route === normalized) || null;
}
