import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

function resolveApiBaseUrl() {
  const configuredUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    const host = window.location.hostname || "";
    const isLocalHost = host === "localhost" || host === "127.0.0.1" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if (isLocalHost) return "http://127.0.0.1:8000";
    return "https://mabaso-ai-api.onrender.com";
  }
  return "https://mabaso-ai-api.onrender.com";
}

const API_BASE_URL = resolveApiBaseUrl();
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const APPLE_CLIENT_ID = (import.meta.env.VITE_APPLE_CLIENT_ID || "").trim();
const APPLE_REDIRECT_URI = (import.meta.env.VITE_APPLE_REDIRECT_URI || "").trim();
const JOB_POLL_INTERVAL_MS = 2000;
const ROOM_REFRESH_INTERVAL_MS = 5000;
const ADMIN_DASHBOARD_REFRESH_MS = 10000;
const STUDY_SOURCE_EXTRACT_TIMEOUT_MS = 180000;
const SESSION_DURATION_LABEL = "1 hour 30 minutes";
const HISTORY_STORAGE_KEY = "mabaso-history-v1";
const WORKSPACE_DRAFT_STORAGE_KEY = "mabaso-workspace-draft-v1";
const PENDING_JOB_STORAGE_KEY = "mabaso-pending-job-v1";
const ADMIN_DASHBOARD_CACHE_KEY = "mabaso-admin-dashboard-v1";
const AUTH_TOKEN_KEY = "mabaso-auth-token";
const AUTH_EMAIL_KEY = "mabaso-auth-email";
const AUTH_MODE_KEY = "mabaso-auth-mode";
const AUTH_AVAILABLE_MODES_KEY = "mabaso-auth-available-modes";
const REMEMBERED_EMAIL_KEY = "mabaso-remembered-email";
const OUTPUT_LANGUAGE_KEY = "mabaso-output-language";
const RECOVERED_RECORDING_STORE_KEY = "lecture-recording";
const BRAND_ART_URL = "/mabaso-social.svg";
const MAX_HISTORY_ITEMS = 24;
const MAX_CHAT_REFERENCE_IMAGES = 4;
const MAX_QUIZ_ANSWER_IMAGES = 6;
const MIN_PASSWORD_LENGTH = 8;
const RECORDING_SILENCE_AUTO_STOP_MS = 10 * 60 * 1000;
const RECORDING_SILENCE_THRESHOLD = 0.02;
const LECTURE_MEDIA_ACCEPT = "audio/*,video/*";
const NOTE_SOURCE_ACCEPT = "image/*,.txt,.md,.text,.pdf,.docx";
const SLIDE_SOURCE_ACCEPT = "image/*,.txt,.md,.text,.pdf,.pptx,.docx";
const PAST_PAPER_ACCEPT = "image/*,.txt,.md,.text,.pdf,.pptx,.docx";
const BULK_LECTURE_ACCEPT = "audio/*,video/*,image/*,.txt,.md,.text,.pdf,.pptx,.docx";
const PRESENTATION_TEMPLATE_ACCEPT = ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const RUNTIME_DB_NAME = "mabaso-runtime";
const RUNTIME_DB_VERSION = 1;
const RUNTIME_DB_RECORDING_STORE = "recordings";
const outputLanguageOptions = [
  { value: "English", label: "English" },
  { value: "isiZulu", label: "isiZulu" },
  { value: "Afrikaans", label: "Afrikaans" },
  { value: "isiXhosa", label: "isiXhosa" },
  { value: "Sesotho", label: "Sesotho" },
  { value: "Setswana", label: "Setswana" },
  { value: "French", label: "French" },
  { value: "Portuguese", label: "Portuguese" },
];
const tabs = [
  { id: "guide", label: "Study Guide" },
  { id: "transcript", label: "Transcript" },
  { id: "formulas", label: "Formulas" },
  { id: "examples", label: "Worked Examples" },
  { id: "flashcards", label: "Flashcards" },
  { id: "quiz", label: "Test" },
  { id: "presentation", label: "PowerPoint Presentation" },
  { id: "podcast", label: "Podcast Generator" },
  { id: "chat", label: "Study Chat" },
  { id: "collaboration", label: "Collaboration" },
];
const workspaceTabs = tabs.filter((tab) => tab.id !== "collaboration");
const progressSteps = ["1. Sign in", "2. Capture lecture", "3. Study workspace", "4. Collaboration"];
const presentationDesigns = [
  {
    id: "emerald-scholar",
    name: "Emerald Scholar",
    accent: "Emerald focus",
    description: "Deep green lecture slides with sharp contrast, strong headings, and a polished academic feel.",
    previewClassName: "bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.35),transparent_42%),linear-gradient(135deg,#061912,#0f2b20_58%,#15392a)]",
    chipClassName: "border-emerald-300/30 bg-emerald-300/10 text-emerald-50",
    previewTitleClassName: "text-emerald-50",
    previewDecorationClassName: "after:absolute after:-right-8 after:top-6 after:h-28 after:w-36 after:rounded-full after:bg-emerald-200/20 after:blur-2xl",
  },
  {
    id: "sunset-classroom",
    name: "Sunset Classroom",
    accent: "Warm and bright",
    description: "Soft cream and orange slides for friendlier presentations, revision classes, and classroom explanations.",
    previewClassName: "bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.22),transparent_38%),linear-gradient(135deg,#fff8f1,#fff1e1_55%,#f6d2b6)]",
    chipClassName: "border-orange-300/40 bg-orange-300/15 text-orange-50",
    previewTitleClassName: "text-orange-950",
    previewDecorationClassName: "after:absolute after:-right-6 after:bottom-2 after:h-20 after:w-44 after:rounded-full after:bg-orange-200/55 after:blur-2xl",
  },
  {
    id: "midnight-grid",
    name: "Midnight Grid",
    accent: "Tech deck",
    description: "Dark navy slides with cool blue accents for modern demos, systems topics, and technical lectures.",
    previewClassName: "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.28),transparent_40%),linear-gradient(135deg,#020617,#0f172a_58%,#172554)]",
    chipClassName: "border-sky-300/35 bg-sky-300/10 text-sky-50",
    previewTitleClassName: "text-sky-50",
    previewDecorationClassName: "after:absolute after:right-3 after:top-4 after:h-24 after:w-24 after:rounded-[28px] after:border after:border-sky-200/20 after:bg-sky-300/10",
  },
  {
    id: "aurora-waves",
    name: "Aurora Waves",
    accent: "Blue ribbon",
    description: "Airy blue curves and soft light for clean lecture introductions, summaries, and concept walkthroughs.",
    previewClassName: "bg-[radial-gradient(circle_at_top_right,rgba(191,219,254,0.8),transparent_42%),linear-gradient(135deg,#f8fbff,#dbeafe_58%,#bfdbfe)]",
    chipClassName: "border-blue-300/40 bg-blue-300/20 text-blue-950",
    previewTitleClassName: "text-blue-700",
    previewDecorationClassName: "after:absolute after:right-0 after:bottom-0 after:h-28 after:w-44 after:rounded-[999px] after:bg-[radial-gradient(circle_at_center,rgba(96,165,250,0.4),transparent_60%)]",
  },
  {
    id: "glass-cube",
    name: "Glass Cube",
    accent: "Clean geometry",
    description: "Fresh mint geometry for engineering, business, and structured explanation decks.",
    previewClassName: "bg-[linear-gradient(135deg,#ecfeff,#d1fae5_46%,#bae6fd)]",
    chipClassName: "border-teal-300/45 bg-teal-300/20 text-teal-950",
    previewTitleClassName: "text-teal-950",
    previewDecorationClassName: "after:absolute after:right-4 after:top-3 after:h-24 after:w-24 after:rotate-12 after:rounded-[26px] after:border after:border-teal-600/20 after:bg-white/35",
  },
  {
    id: "celebration-night",
    name: "Celebration Night",
    accent: "Event style",
    description: "Dark celebratory slides with amber highlights for launches, recaps, and energetic storytelling.",
    previewClassName: "bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.2),transparent_30%),linear-gradient(135deg,#111827,#1f2937_60%,#312e81)]",
    chipClassName: "border-amber-300/40 bg-amber-300/15 text-amber-50",
    previewTitleClassName: "text-amber-50",
    previewDecorationClassName: "after:absolute after:right-6 after:top-5 after:h-4 after:w-4 after:rounded-full after:bg-amber-200 before:absolute before:right-12 before:top-10 before:h-3 before:w-3 before:rounded-full before:bg-white/70",
  },
  {
    id: "amber-lux",
    name: "Amber Lux",
    accent: "Black and gold",
    description: "Luxury black slides with gold light streaks for premium reports and standout final presentations.",
    previewClassName: "bg-[radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.55),transparent_30%),linear-gradient(135deg,#09090b,#18181b_56%,#3f3f46)]",
    chipClassName: "border-amber-300/40 bg-amber-300/15 text-amber-50",
    previewTitleClassName: "text-amber-100",
    previewDecorationClassName: "after:absolute after:right-0 after:bottom-1 after:h-20 after:w-40 after:rounded-[999px] after:bg-[linear-gradient(90deg,transparent,rgba(245,158,11,0.55),transparent)]",
  },
  {
    id: "festival-pop",
    name: "Festival Pop",
    accent: "Bright curve",
    description: "Playful pink gradients for lighter classroom decks, youth workshops, and visual revision packs.",
    previewClassName: "bg-[linear-gradient(135deg,#fff7fb,#ffe4f1_52%,#fed7e2)]",
    chipClassName: "border-pink-300/45 bg-pink-300/20 text-pink-950",
    previewTitleClassName: "text-pink-950",
    previewDecorationClassName: "after:absolute after:-left-6 after:bottom-0 after:h-14 after:w-[130%] after:rounded-t-[999px] after:bg-[linear-gradient(90deg,#ec4899,#a855f7,#38bdf8)]",
  },
  {
    id: "editorial-sage",
    name: "Editorial Sage",
    accent: "Magazine feel",
    description: "Calm editorial green for professional lectures, essays, and policy or humanities presentations.",
    previewClassName: "bg-[linear-gradient(135deg,#f7f7f2,#e9f2e4_60%,#d7e7cf)]",
    chipClassName: "border-lime-300/40 bg-lime-300/20 text-lime-950",
    previewTitleClassName: "text-emerald-950",
    previewDecorationClassName: "after:absolute after:right-5 after:bottom-5 after:h-20 after:w-16 after:rounded-[18px] after:bg-[linear-gradient(180deg,#a7f3d0,#fef3c7)]",
  },
  {
    id: "clinical-blue",
    name: "Clinical Blue",
    accent: "Lab visual",
    description: "Bright scientific blue styling that fits medical, biology, chemistry, and lab-based content.",
    previewClassName: "bg-[linear-gradient(135deg,#f4fbff,#e7f4fb_54%,#d4ecf8)]",
    chipClassName: "border-sky-300/40 bg-sky-300/20 text-sky-950",
    previewTitleClassName: "text-sky-800",
    previewDecorationClassName: "after:absolute after:right-4 after:bottom-3 after:h-24 after:w-24 after:rounded-full after:border after:border-sky-300/40 after:bg-white/50 before:absolute before:right-12 before:bottom-11 before:h-10 before:w-10 before:rounded-full before:border before:border-sky-200/50",
  },
  {
    id: "summit-minimal",
    name: "Summit Minimal",
    accent: "Soft summit",
    description: "Pastel geometric slides for polished study summaries, revision decks, and calm closing presentations.",
    previewClassName: "bg-[linear-gradient(135deg,#fffdea,#f5f3ff_56%,#dbeafe)]",
    chipClassName: "border-indigo-300/40 bg-indigo-300/20 text-indigo-950",
    previewTitleClassName: "text-indigo-800",
    previewDecorationClassName: "after:absolute after:right-0 after:bottom-0 after:h-24 after:w-36 after:bg-[linear-gradient(135deg,transparent_10%,rgba(79,70,229,0.15),rgba(96,165,250,0.25))] after:[clip-path:polygon(35%_100%,100%_100%,100%_15%)]",
  },
];

function getPresentationDesignFamily(designId) {
  if (["sunset-classroom", "glass-cube", "festival-pop", "clinical-blue", "summit-minimal"].includes(designId)) return "light";
  if (["midnight-grid", "aurora-waves", "celebration-night", "amber-lux"].includes(designId)) return "dark";
  return "emerald";
}

function getPresentationVisualTypeLabel(value) {
  const normalized = (value || "cluster").toLowerCase();
  if (normalized === "flow") return "Flow";
  if (normalized === "comparison") return "Comparison";
  if (normalized === "timeline") return "Timeline";
  if (normalized === "cycle") return "Cycle";
  if (normalized === "formula") return "Formula";
  if (normalized === "components") return "Components";
  if (normalized === "table") return "Table";
  if (normalized === "chart") return "Chart";
  if (normalized === "graph") return "Graph";
  if (normalized === "photo") return "Photo";
  if (normalized === "closing") return "Closing";
  return "Cluster";
}
const helpAboutSections = [
  {
    kicker: "How It Works",
    title: "What MABASO is doing in the background",
    description:
      "MABASO turns one lecture workspace into several study tools. It reads the sources you upload, combines them, and then builds a guide, formulas, worked examples, flashcards, a test, and optional study photos from the same lecture context.",
    points: [
      "The capture page is where you add lecture material. This can be a recorded lecture, a video file, live recording, typed notes, slide files, or past papers.",
      "When you press Transcribe Lecture, MABASO reads the audio or video first, creates a transcript, and then uses that transcript as the foundation for the rest of the pack.",
      "When you use Add Lecture Files, MABASO starts reading notes, slides, and past papers first, then moves into lecture transcription automatically so the guide can use all readable sources together.",
      "When you press Generate Study Guide, MABASO can still work even if you only uploaded notes, slides, or past papers. A transcript helps, but it is not the only valid source.",
      "The study workspace is the revision area. It lets the student move between the guide, transcript, formulas, worked examples, flashcards, the test, PowerPoint presentation, podcast, and study chat without uploading again.",
    ],
  },
  {
    kicker: "Best Upload Strategy",
    title: "Which files improve the results the most",
    description:
      "The strongest study packs usually come from combining different kinds of lecture evidence instead of relying on only one source.",
    points: [
      "Use a lecture recording or video file when you want the lecturer's wording, examples, and explanations captured directly.",
      "Add lecture notes when the lecturer gave a handout, typed outline, worksheet, memo, or Word document that already organizes the topic clearly.",
      "Add slides when headings, formulas, definitions, diagrams, or short exam clues were shown visually during class.",
      "Add past papers and the memo when you want the generated notes and test questions to follow the same assessment style, wording, and mark logic.",
    ],
  },
  {
    kicker: "What Students Should Notice",
    title: "Signals that the pack is high quality",
    description:
      "Students should not only read the guide. They should also check whether the generated pack actually matches the lecture and supports exam revision well.",
    points: [
      "The study guide should explain the topic at a high level first, then break it into steps, comparisons, and exam-useful points instead of only repeating raw transcript lines.",
      "The formulas section should feel readable like classroom board work, not like broken symbols or machine output.",
      "Worked examples should make the method obvious. If a worked example feels too short, the student should compare it with the guide and transcript before trusting it.",
      "When the topic includes physical things to recognise, such as machines, instruments, organs, structures, or valve types, the study photos should help the student connect names to real-world appearance.",
    ],
  },
  {
    kicker: "While Processing",
    title: "What the buttons and progress labels mean",
    description:
      "The large action buttons on the capture page now act like progress stations. The small text above each button tells the student what is happening right now and which stage is next.",
    points: [
      "Transcribe Lecture shows the progress for audio or video reading, transcript creation, and lecture preparation.",
      "Generate Study Guide shows source-reading stages for notes, slides, and past papers, then the deeper study-building stages such as guide writing, flashcards, and test generation.",
      "Open Study Workspace stays ready once the pack exists, so students know when they can move from capture into revision tools.",
      "If many files were uploaded together, MABASO sorts them in the background and sends them to the correct lecture section before study generation continues.",
    ],
  },
  {
    kicker: "Better Results",
    title: "How to make the generated notes more useful",
    description:
      "Students usually get the best outcome when they treat the generated pack like a guided revision set, not just a one-time summary.",
    points: [
      "Start with the study guide to understand the lesson structure, then jump to formulas and worked examples for difficult parts.",
      "Use flashcards after reading, not before. They work best after the student already understands the core explanation.",
      "Use the test when the student wants to discover weak points, and then return to the guide or transcript to repair those weak areas.",
      "Use the study chat after the guide exists. The answers are stronger when the guide, transcript, notes, and photos have already been built from the lecture.",
    ],
  },
  {
    kicker: "Files And Navigation",
    title: "What file types and navigation paths are supported",
    description:
      "The capture page accepts lecture media and supporting documents. Students can upload one file at a time or use the combined lecture-file button to let MABASO sort them automatically.",
    points: [
      "Lecture media supports common audio and video uploads, while notes, slides, and past papers support text, images, PDFs, PowerPoint files, and Word documents in DOCX format.",
      "Public video links work best when the lecture is openly accessible. Some YouTube links still need public captions, backend cookies, or a proxy before the server can read them.",
      "History stores the recent study packs built on this device so students can reopen them quickly without rebuilding everything immediately.",
      "Downloads are grouped under one Download menu in the study workspace so the student can choose the exact format they want instead of scanning several buttons.",
      "Back arrows appear on pages where students can return, which makes it easier to move between capture, help, study tools, and collaboration without losing direction.",
    ],
  },
  {
    kicker: "Progress And Quality",
    title: "How processing stages, source quality, and revisions should work",
    description:
      "Students should know what the app is doing and should also know when a source is weak enough to question before trusting the output.",
    points: [
      "The Transcribe Lecture button should carry the live transcription stages when lecture audio, video, or a public video link is being processed.",
      "The Generate Study Guide button should carry the live reading and guide-building stages when notes, slides, or past papers are being read or turned into revision material.",
      "Live recording now watches for 10 minutes of silence. When that happens, MABASO stops the recorder and starts transcription automatically. A manual stop still only saves the recording so the student stays in control.",
      "If a scan or source file is too messy, too broken, or too unreadable, students should expect weaker notes. Clean PDFs, typed notes, and clearer slide files usually produce stronger study packs.",
      "If the guide feels mixed up, too transcript-heavy, or too shallow, students should add better notes or slides and regenerate instead of trusting a weak first draft.",
    ],
  },
  {
    kicker: "Study Guide Photos",
    title: "When photos appear in the guide and what they are for",
    description:
      "The photo strip in the study guide is meant for concrete concepts that students benefit from seeing, not for every subject or every lecture.",
    points: [
      "Photo references should appear when the topic includes real objects, structures, instruments, machine parts, organ systems, valve types, or other physical categories students must recognise by sight.",
      "If the topic is mostly abstract, symbolic, theoretical, or calculation-based, the guide should rely on notes, formulas, and worked examples instead of forcing photos.",
      "The photos are there to improve recognition and understanding, not to replace the explanation in the guide itself.",
      "Students should still judge whether the photo matches the lecture topic closely. If it does not, the written guide and lecture sources should be trusted first.",
    ],
  },
];

let appleAuthScriptPromise = null;

function buildAppleRedirectUri() {
  if (APPLE_REDIRECT_URI) return APPLE_REDIRECT_URI;
  if (typeof window === "undefined") return "";
  return new URL("/", window.location.href).toString();
}

function isAppleWebSigninSupported() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname || "";
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  return window.location.protocol === "https:" && !isLocalHost;
}

function createBrowserSafeToken(length = 24) {
  if (typeof window === "undefined" || !window.crypto?.getRandomValues) {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 2 + length)}`;
  }
  const values = new Uint8Array(length);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("").slice(0, length * 2);
}

async function ensureAppleAuthScript() {
  if (typeof window === "undefined") throw new Error("Apple sign-in is only available in the browser.");
  if (window.AppleID?.auth) return window.AppleID;
  if (!appleAuthScriptPromise) {
    appleAuthScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-apple-signin="mabaso"]');
      const script = existingScript || document.createElement("script");
      const handleLoad = () => {
        if (window.AppleID?.auth) resolve(window.AppleID);
        else reject(new Error("Apple sign-in loaded, but the AppleID client is unavailable."));
      };
      const handleError = () => {
        appleAuthScriptPromise = null;
        reject(new Error("Apple sign-in could not be loaded right now."));
      };

      if (!existingScript) {
        script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
        script.async = true;
        script.defer = true;
        script.dataset.appleSignin = "mabaso";
        document.body.appendChild(script);
      }

      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });

      if (existingScript && window.AppleID?.auth) {
        resolve(window.AppleID);
      }
    });
  }
  return appleAuthScriptPromise;
}

function normalizeAppleSignInError(error) {
  const code = error?.error || error?.message || "";
  if (String(code).includes("popup_closed_by_user") || String(code).includes("user_cancelled_authorize")) {
    return "Apple sign-in was cancelled.";
  }
  return error?.message || "Apple sign-in failed.";
}

function normalizeHistoryOwnerEmail(email = "") {
  return (email || "").trim().toLowerCase();
}

function getHistoryStorageKey(email = "") {
  const normalizedEmail = normalizeHistoryOwnerEmail(email);
  return normalizedEmail ? `${HISTORY_STORAGE_KEY}:${normalizedEmail}` : HISTORY_STORAGE_KEY;
}

function getWorkspaceDraftStorageKey(email = "") {
  const normalizedEmail = normalizeHistoryOwnerEmail(email);
  return normalizedEmail ? `${WORKSPACE_DRAFT_STORAGE_KEY}:${normalizedEmail}` : WORKSPACE_DRAFT_STORAGE_KEY;
}

function getPendingJobStorageKey(email = "") {
  const normalizedEmail = normalizeHistoryOwnerEmail(email);
  return normalizedEmail ? `${PENDING_JOB_STORAGE_KEY}:${normalizedEmail}` : PENDING_JOB_STORAGE_KEY;
}

function getRecoveredRecordingStorageKey(email = "") {
  const normalizedEmail = normalizeHistoryOwnerEmail(email);
  return normalizedEmail ? `${RECOVERED_RECORDING_STORE_KEY}:${normalizedEmail}` : RECOVERED_RECORDING_STORE_KEY;
}

function parseHistoryTimestamp(value) {
  const text = (value || "").trim();
  if (!text) return 0;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeHistoryItems(items = []) {
  if (!Array.isArray(items)) return [];

  const byId = new Map();
  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const nextItem = { ...rawItem };
    const itemId = String(nextItem.id || "").trim();
    if (!itemId) continue;
    nextItem.id = itemId;
    nextItem.createdAt = nextItem.createdAt || new Date().toISOString();
    nextItem.updatedAt = nextItem.updatedAt || nextItem.createdAt;

    const existingItem = byId.get(itemId);
    if (!existingItem || parseHistoryTimestamp(nextItem.updatedAt) >= parseHistoryTimestamp(existingItem.updatedAt || existingItem.createdAt)) {
      byId.set(itemId, nextItem);
    }
  }

  return Array.from(byId.values())
    .sort((left, right) => parseHistoryTimestamp(right.updatedAt || right.createdAt) - parseHistoryTimestamp(left.updatedAt || left.createdAt))
    .slice(0, MAX_HISTORY_ITEMS);
}

function mergeHistoryItems(...collections) {
  return normalizeHistoryItems(collections.flat());
}

function loadHistoryItems(email = "") {
  try {
    const scopedKey = getHistoryStorageKey(email);
    const scopedValue = window.localStorage.getItem(scopedKey);
    if (scopedValue) return normalizeHistoryItems(JSON.parse(scopedValue));

    const legacyValue = window.localStorage.getItem(HISTORY_STORAGE_KEY) || "[]";
    return normalizeHistoryItems(JSON.parse(legacyValue));
  } catch {
    return [];
  }
}

function loadWorkspaceDraft(email = "") {
  try {
    const value = window.localStorage.getItem(getWorkspaceDraftStorageKey(email)) || "";
    if (!value) return null;
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveWorkspaceDraft(email = "", snapshot = null) {
  const storageKey = getWorkspaceDraftStorageKey(email);
  if (!snapshot || typeof snapshot !== "object") {
    window.localStorage.removeItem(storageKey);
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
}

function loadPendingJobSnapshot(email = "") {
  try {
    const value = window.localStorage.getItem(getPendingJobStorageKey(email)) || "";
    if (!value) return null;
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function savePendingJobSnapshot(email = "", snapshot = null) {
  const storageKey = getPendingJobStorageKey(email);
  if (!snapshot || typeof snapshot !== "object") {
    window.localStorage.removeItem(storageKey);
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
}

function loadAdminDashboardCache() {
  try {
    const value = window.localStorage.getItem(ADMIN_DASHBOARD_CACHE_KEY) || "";
    if (!value) return null;
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveAdminDashboardCache(snapshot = null) {
  if (!snapshot || typeof snapshot !== "object") {
    window.localStorage.removeItem(ADMIN_DASHBOARD_CACHE_KEY);
    return;
  }
  window.localStorage.setItem(ADMIN_DASHBOARD_CACHE_KEY, JSON.stringify(snapshot));
}

function openRuntimeDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = window.indexedDB.open(RUNTIME_DB_NAME, RUNTIME_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RUNTIME_DB_RECORDING_STORE)) {
        database.createObjectStore(RUNTIME_DB_RECORDING_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open the runtime database."));
  });
}

async function saveRecoveredRecordingToDb(email = "", payload = null) {
  if (!normalizeHistoryOwnerEmail(email) || !payload?.blob) return;
  try {
    const database = await openRuntimeDb();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(RUNTIME_DB_RECORDING_STORE, "readwrite");
      const store = transaction.objectStore(RUNTIME_DB_RECORDING_STORE);
      store.put({
        id: getRecoveredRecordingStorageKey(email),
        email: normalizeHistoryOwnerEmail(email),
        fileName: payload.fileName || "mabaso-lecture.wav",
        type: payload.type || payload.blob?.type || "audio/wav",
        updatedAt: new Date().toISOString(),
        blob: payload.blob,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save the recovered recording."));
    });
    database.close();
  } catch {
    // Ignore storage failures for recording recovery.
  }
}

async function loadRecoveredRecordingFromDb(email = "") {
  if (!normalizeHistoryOwnerEmail(email)) return null;
  try {
    const database = await openRuntimeDb();
    const result = await new Promise((resolve, reject) => {
      const transaction = database.transaction(RUNTIME_DB_RECORDING_STORE, "readonly");
      const store = transaction.objectStore(RUNTIME_DB_RECORDING_STORE);
      const request = store.get(getRecoveredRecordingStorageKey(email));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not load the recovered recording."));
    });
    database.close();
    return result && typeof result === "object" ? result : null;
  } catch {
    return null;
  }
}

async function clearRecoveredRecordingFromDb(email = "") {
  if (!normalizeHistoryOwnerEmail(email)) return;
  try {
    const database = await openRuntimeDb();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(RUNTIME_DB_RECORDING_STORE, "readwrite");
      const store = transaction.objectStore(RUNTIME_DB_RECORDING_STORE);
      store.delete(getRecoveredRecordingStorageKey(email));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not clear the recovered recording."));
    });
    database.close();
  } catch {
    // Ignore storage failures for recording recovery cleanup.
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getFileExtension(fileName = "") {
  const parts = (fileName || "").toLowerCase().split(".");
  return parts.length > 1 ? `.${parts.pop()}` : "";
}

function sanitizeFileName(value) {
  return (value || "mabaso-study-pack").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}

function formatGroupedSourceLabel(names = [], singularLabel = "file", pluralLabel = "files") {
  const cleanedNames = (names || []).map((name) => (name || "").trim()).filter(Boolean);
  if (!cleanedNames.length) return "";
  if (cleanedNames.length === 1) return cleanedNames[0] || `1 ${singularLabel}`;
  return `${cleanedNames.length} ${pluralLabel}`;
}

function isLectureMediaFile(selectedFile) {
  const fileName = (selectedFile?.name || "").toLowerCase();
  const contentType = (selectedFile?.type || "").toLowerCase();
  return Boolean(
    contentType.startsWith("audio/")
    || contentType.startsWith("video/")
    || /\.(mp3|wav|m4a|aac|ogg|flac|mp4|mov|avi|mkv|webm|mpeg|mpg)$/i.test(fileName),
  );
}

function classifyLectureBundleFile(selectedFile) {
  const fileName = (selectedFile?.name || "").toLowerCase();
  const extension = getFileExtension(fileName);
  const imageLike = (selectedFile?.type || "").toLowerCase().startsWith("image/");

  if (isLectureMediaFile(selectedFile)) return "lecture";
  if (/(memo|memorandum|marking guide|mark scheme|model answer|answer guide)/i.test(fileName)) return "past_paper";
  if (/(past paper|question paper|test paper|exam paper|assessment)/i.test(fileName)) return "past_paper";
  if (/(slide|slides|presentation|deck|powerpoint|chapter)/i.test(fileName) || extension === ".pptx") return "slide";
  if (/(note|notes|handout|summary|worksheet|study guide)/i.test(fileName)) return "note";
  if (imageLike) return "slide";
  if (extension === ".pdf") return "note";
  if ([".txt", ".md", ".text", ".docx"].includes(extension)) return "note";
  return "slide";
}

function extractHistoryTitle(summary, fallbackName) {
  const lines = (summary || "").split("\n").map((line) => line.replace(/\*\*/g, "").trim()).filter(Boolean);
  const index = lines.findIndex((line) => line.toUpperCase() === "LECTURE TITLE");
  return index >= 0 && lines[index + 1] ? lines[index + 1] : fallbackName || "Untitled lecture";
}

function flashcardsToText(flashcards) {
  return (flashcards || []).map((card, index) => `Flashcard ${index + 1}\nQ: ${card.question}\n\nA: ${card.answer}`).join("\n\n");
}

function isOptionBasedQuestion(question) {
  return ["multiple_choice_group", "true_false_group"].includes(question?.type);
}

function getQuestionMarks(question) {
  const directMarks = Number(question?.marks || 0);
  if (directMarks) return directMarks;
  return (question?.subparts || []).reduce((total, item) => total + Number(item?.marks || 0), 0) || 1;
}

function getTotalQuizMarks(questions) {
  return (questions || []).reduce((total, item) => total + getQuestionMarks(item), 0);
}

function buildExpectedAnswerText(question) {
  if (Array.isArray(question?.subparts) && question.subparts.length) {
    return question.subparts.map((item) => `${item.label}) ${item.answer}`).join("\n");
  }
  return question?.answer || "No answer available.";
}

function serializeQuizAnswerForRoom(question, answerValue) {
  if (isOptionBasedQuestion(question)) {
    if (!answerValue || typeof answerValue !== "object") return "";
    return (question.subparts || []).map((item) => `${item.label}) ${answerValue[item.label] || "No answer"}`).join("\n");
  }
  return typeof answerValue === "string" ? answerValue.trim() : "";
}

function parseStoredRoomQuizAnswer(question, answerText) {
  const rawValue = (answerText || "").trim();
  if (!rawValue) return isOptionBasedQuestion(question) ? {} : "";
  if (!isOptionBasedQuestion(question)) return rawValue;

  return (question.subparts || []).reduce((collected, subpart) => {
    const pattern = new RegExp(`(?:^|\\n)${subpart.label}\\)\\s*([^\\n]+)`);
    const match = pattern.exec(rawValue);
    if (match?.[1]) collected[subpart.label] = match[1].trim();
    return collected;
  }, {});
}

function formatVideoSourceLabel(urlValue) {
  if (!urlValue) return "";
  try {
    const url = new URL(urlValue);
    const path = url.pathname && url.pathname !== "/" ? url.pathname : "";
    return `${url.hostname.replace(/^www\./, "")}${path}`.slice(0, 80);
  } catch {
    return urlValue.slice(0, 80);
  }
}

function getPrimarySourceLabel({
  fileName = "",
  historyFileName = "",
  videoUrl = "",
  lectureNotesFileName = "",
  lectureSlideFileNames = [],
  pastQuestionPaperFileNames = [],
} = {}) {
  return fileName
    || historyFileName
    || formatVideoSourceLabel(videoUrl)
    || lectureNotesFileName
    || lectureSlideFileNames[0]
    || pastQuestionPaperFileNames[0]
    || "Saved lecture";
}

function createStudySourceEntry(name, text, prefix, extra = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (name || prefix || "Study source").trim() || "Study source",
    text: normalizeStudySourceText(text),
    prefix: prefix || "STUDY SOURCE",
    previewUrl: typeof extra.previewUrl === "string" ? extra.previewUrl : "",
    visualReferences: Array.isArray(extra.visualReferences) ? extra.visualReferences.filter((item) => typeof item === "string" && item.trim()) : [],
    fileType: typeof extra.fileType === "string" ? extra.fileType : "",
    visualSource: Boolean(extra.visualSource),
  };
}

function normalizeStudySourceText(text) {
  return (text || "")
    .split("\0").join(" ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[^\S\r\n]{2,}/g, " ")
    .trim();
}

function isLikelyReadableStudySourceText(text) {
  const cleaned = normalizeStudySourceText(text);
  if (!cleaned) return false;
  const compact = cleaned.replace(/\s+/g, "");
  if (!compact) return false;

  const alphanumericCount = (cleaned.match(/[A-Za-z0-9]/g) || []).length;
  const weirdCharacterCount = (cleaned.match(/[^A-Za-z0-9\s.,:;!?()[\]{}\-+*/=%<>'"&/@#\\]/g) || []).length;
  const longWords = cleaned.match(/[A-Za-z]{3,}/g) || [];

  if (compact.length >= 60 && weirdCharacterCount / compact.length > 0.22 && alphanumericCount / compact.length < 0.55) {
    return false;
  }

  if (longWords.length < 4 && alphanumericCount < 24) {
    return false;
  }

  return true;
}

function normalizeStudySourceEntries(entries, fallbackText = "", fallbackNames = [], defaultPrefix = "STUDY SOURCE") {
  const normalizedEntries = Array.isArray(entries)
    ? entries
      .map((entry) => ({
        id: entry?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: (entry?.name || defaultPrefix).trim() || defaultPrefix,
        text: (entry?.text || "").trim(),
        prefix: entry?.prefix || defaultPrefix,
        previewUrl: typeof entry?.previewUrl === "string" ? entry.previewUrl : "",
        visualReferences: Array.isArray(entry?.visualReferences) ? entry.visualReferences.filter((item) => typeof item === "string" && item.trim()) : [],
        fileType: typeof entry?.fileType === "string" ? entry.fileType : "",
        visualSource: Boolean(entry?.visualSource),
      }))
      .filter((entry) => entry.text)
    : [];

  if (normalizedEntries.length) return normalizedEntries;

  const cleanedFallbackText = (fallbackText || "").trim();
  if (!cleanedFallbackText) return [];

  return [
    createStudySourceEntry(
      (fallbackNames || []).find(Boolean) || `${defaultPrefix.toLowerCase().replace(/\s+/g, "-")}.txt`,
      cleanedFallbackText,
      defaultPrefix,
    ),
  ];
}

function mergeStudySourceEntries(currentEntries, incomingEntries) {
  const nextEntries = [...(currentEntries || [])];
  for (const entry of incomingEntries || []) {
    const existingIndex = nextEntries.findIndex((item) => item.name === entry.name);
    if (existingIndex >= 0) nextEntries[existingIndex] = entry;
    else nextEntries.push(entry);
  }
  return nextEntries;
}

function sanitizeStudySourceEntriesForHistory(entries) {
  return (entries || []).map((entry) => ({
    id: entry?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: entry?.name || "Study source",
    text: entry?.text || "",
    prefix: entry?.prefix || "STUDY SOURCE",
    fileType: entry?.fileType || "",
    visualSource: Boolean(entry?.visualSource),
    previewUrl: entry?.previewUrl || "",
    visualReferences: Array.isArray(entry?.visualReferences) ? entry.visualReferences.filter(Boolean).slice(0, 6) : [],
  }));
}

function buildUploadedVisualReferences(...sourceGroups) {
  return sourceGroups
    .flat()
    .flatMap((entry) => {
      const sources = Array.isArray(entry?.visualReferences) && entry.visualReferences.length
        ? entry.visualReferences
        : entry?.previewUrl ? [entry.previewUrl] : [];
      return sources.map((imageUrl, index) => ({
        id: entry?.id ? `${entry.id}-${index}` : `${entry?.name || "uploaded-source"}-${index}`,
        title: sources.length > 1 ? `${entry?.name || "Uploaded source visual"} ${index + 1}` : (entry?.name || "Uploaded source visual"),
        image_url: imageUrl,
        source_url: imageUrl,
        query: entry?.prefix || "Uploaded source",
        source_type: "uploaded",
      }));
    })
    .slice(0, 6);
}

function studySourceEntriesToText(entries, defaultPrefix = "STUDY SOURCE") {
  return (entries || [])
    .map((entry) => {
      const name = (entry?.name || "").trim();
      const text = (entry?.text || "").trim();
      if (!text) return "";
      return `${entry?.prefix || defaultPrefix}: ${name || defaultPrefix}\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function quizToText(questions) {
  return (questions || []).map((item) => {
    const lines = [`${item.number}. ${item.question} (${getQuestionMarks(item)} marks)`];
    if (isOptionBasedQuestion(item)) {
      (item.subparts || []).forEach((subpart) => {
        lines.push("");
        lines.push(`${subpart.label}) ${subpart.question}`);
        (subpart.options || []).forEach((option) => {
          lines.push(`- ${option}`);
        });
      });
      lines.push("", `Suggested Answer:\n${buildExpectedAnswerText(item)}`);
      return lines.join("\n");
    }
    lines.push("", `Suggested Answer: ${item.answer}`);
    return lines.join("\n");
  }).join("\n\n");
}

function chatToText(messages) {
  return (messages || []).map((item) => `${item.role === "assistant" ? "MABASO" : "Student"}: ${item.content}`).join("\n\n");
}

function _summarizePresentationSlidePoints(slide) {
  return (slide?.bullets || [])
    .map((item) => String(item || "").replace(/^[\s\-•]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

function buildQuizExportText(questions, answers = {}, results = {}) {
  return (questions || []).map((item) => {
    const result = results[item.number];
    const studentAnswer = serializeQuizAnswerForRoom(item, answers[item.number]);
    const lines = [
      `${item.number}. ${item.question} (${getQuestionMarks(item)} marks)`,
      "",
      `Suggested Answer: ${buildExpectedAnswerText(item)}`,
    ];
    if (isOptionBasedQuestion(item)) {
      (item.subparts || []).forEach((subpart) => {
        lines.push("");
        lines.push(`${subpart.label}) ${subpart.question}`);
        (subpart.options || []).forEach((option) => lines.push(`- ${option}`));
      });
    }
    if (studentAnswer) {
      lines.push("", `Student Answer: ${studentAnswer}`);
    }
    if (result) {
      lines.push("", `Marked Result: ${Number(result.score || 0)} / ${Number(result.max_score || getQuestionMarks(item) || 0)}`);
      if (result.extracted_answer) lines.push(`Detected Answer: ${result.extracted_answer}`);
      if (result.feedback) lines.push(`Feedback: ${result.feedback}`);
      if (Array.isArray(result.mistakes) && result.mistakes.length) {
        lines.push(`Needs Attention: ${result.mistakes.join("; ")}`);
      }
    }
    return lines.join("\n");
  }).join("\n\n");
}

function getQuizAnswerImageFiles(imagesByQuestion, questionNumber) {
  const value = imagesByQuestion?.[questionNumber];
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function getQuizAnswerImageLabel(files) {
  const imageFiles = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!imageFiles.length) return "";
  if (imageFiles.length === 1) return imageFiles[0].name;
  return `${imageFiles.length} photos selected`;
}

function parseFormulaRows(text) {
  return (text || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => line.replace(/^- /, "").trim()).map((line) => {
    if (line.includes("->")) {
      const [expression, result] = line.split("->");
      return { expression: expression.trim(), result: result.trim() };
    }
    if (line.includes("=")) {
      const [expression, ...rest] = line.split("=");
      return { expression: expression.trim(), result: rest.join("=").trim() };
    }
    return null;
  }).filter(Boolean);
}

function normalizeRenderedMathText(value) {
  return (value || "")
    .replace(/\u2265/g, "\u2265")
    .replace(/\u2264/g, "\u2264")
    .replace(/\u2260/g, "\u2260")
    .replace(/\u2192/g, "\u2192");
}

function prettifyMathText(value) {
  return (value || "").replace(/>=/g, "≥").replace(/<=/g, "≤").replace(/!=/g, "≠").replace(/->/g, "→");
}

function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
}

const adminCompactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const adminIntegerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const adminDecimalFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});
const ADMIN_CHART_COLORS = ["#4f46e5", "#06b6d4", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6"];

function toFiniteNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function formatAdminCompactNumber(value) {
  return adminCompactNumberFormatter.format(toFiniteNumber(value));
}

function formatAdminInteger(value) {
  return adminIntegerFormatter.format(Math.round(toFiniteNumber(value)));
}

function formatAdminDecimal(value) {
  return adminDecimalFormatter.format(toFiniteNumber(value));
}

function formatAdminPercent(value) {
  const amount = toFiniteNumber(value);
  const hasFraction = Math.abs(amount % 1) > 0.001;
  return `${hasFraction ? amount.toFixed(1) : Math.round(amount)}%`;
}

function formatAdminDuration(valueMs) {
  const ms = Math.max(0, toFiniteNumber(valueMs));
  if (ms >= 60000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  if (ms >= 1000) {
    return `${formatAdminDecimal(ms / 1000)}s`;
  }
  return `${Math.round(ms)} ms`;
}

function formatAdminSecondsDuration(valueSeconds) {
  return formatAdminDuration(toFiniteNumber(valueSeconds) * 1000);
}

function formatAdminBytes(bytes) {
  const size = Math.max(0, toFiniteNumber(bytes));
  if (size >= 1024 ** 4) return `${formatAdminDecimal(size / (1024 ** 4))} TB`;
  if (size >= 1024 ** 3) return `${formatAdminDecimal(size / (1024 ** 3))} GB`;
  if (size >= 1024 ** 2) return `${formatAdminDecimal(size / (1024 ** 2))} MB`;
  if (size >= 1024) return `${formatAdminDecimal(size / 1024)} KB`;
  return `${Math.round(size)} B`;
}

function formatAdminDate(value, options = { month: "short", day: "numeric" }) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleDateString(undefined, options);
}

function formatAdminDateTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function titleCaseWords(value = "") {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatAdminActionLabel(action = "") {
  return titleCaseWords(String(action || "").replace(/\./g, " "));
}

function getAdminHealthTone(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (["green", "active", "success", "low", "operational", "completed"].some((item) => normalized.includes(item))) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (["yellow", "processing", "queued", "medium", "warning", "pending"].some((item) => normalized.includes(item))) {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-rose-50 text-rose-700";
}

function getAdminActionTone(action = "") {
  const normalized = String(action || "").toLowerCase();
  if (normalized.includes("auth")) return "bg-violet-50 text-violet-700";
  if (normalized.includes("upload") || normalized.includes("slide") || normalized.includes("note")) return "bg-sky-50 text-sky-700";
  if (normalized.includes("study_guide") || normalized.includes("presentation") || normalized.includes("podcast")) return "bg-emerald-50 text-emerald-700";
  if (normalized.includes("admin")) return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function AdminLineChart({
  items = [],
  valueKey = "value",
  labelKey = "label",
  stroke = ADMIN_CHART_COLORS[0],
  formatter = formatAdminInteger,
}) {
  const normalizedItems = items
    .map((item) => ({
      label: item?.[labelKey] ?? "",
      value: toFiniteNumber(item?.[valueKey]),
    }))
    .filter((item) => item.label !== "" || item.value !== 0);

  if (!normalizedItems.length) {
    return <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">No chart data yet.</div>;
  }

  const width = 560;
  const height = 220;
  const paddingX = 18;
  const paddingTop = 16;
  const paddingBottom = 26;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;
  const values = normalizedItems.map((item) => item.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const span = Math.max(maxValue - minValue, 1);

  const points = normalizedItems.map((item, index) => {
    const x = normalizedItems.length === 1
      ? width / 2
      : paddingX + (index / (normalizedItems.length - 1)) * chartWidth;
    const y = paddingTop + (1 - ((item.value - minValue) / span)) * chartHeight;
    return { ...item, x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
  const keyLabelIndexes = Array.from(new Set([0, Math.floor((normalizedItems.length - 1) / 2), normalizedItems.length - 1]));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
        {Array.from({ length: 4 }).map((_, index) => {
          const y = paddingTop + (index / 3) * chartHeight;
          return <line key={index} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e2e8f0" strokeDasharray="4 8" />;
        })}
        <path d={areaPath} fill={stroke} fillOpacity="0.12" />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="4.5" fill="white" stroke={stroke} strokeWidth="2" />
            <circle cx={point.x} cy={point.y} r="2" fill={stroke} />
          </g>
        ))}
      </svg>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {keyLabelIndexes.map((index) => (
          <span key={`${normalizedItems[index]?.label}-${index}`} className="truncate">
            {normalizedItems[index]?.label}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {points.slice(-3).map((point) => (
          <div key={point.label} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            {point.label}: <span className="font-semibold text-slate-900">{formatter(point.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminMultiLineChart({
  items = [],
  labelKey = "label",
  series = [],
  formatter = formatAdminInteger,
}) {
  const normalizedItems = items
    .map((item) => ({
      label: item?.[labelKey] ?? "",
      ...Object.fromEntries(series.map((entry) => [entry.key, Math.max(0, toFiniteNumber(item?.[entry.key]))])),
    }))
    .filter((item) => item.label || series.some((entry) => item[entry.key] > 0));

  if (!normalizedItems.length || !series.length) {
    return <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">No chart data yet.</div>;
  }

  const width = 560;
  const height = 220;
  const paddingX = 18;
  const paddingTop = 16;
  const paddingBottom = 26;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;
  const values = normalizedItems.flatMap((item) => series.map((entry) => item[entry.key]));
  const maxValue = Math.max(...values, 1);

  const pointsBySeries = series.map((entry) => {
    const points = normalizedItems.map((item, index) => {
      const x = normalizedItems.length === 1
        ? width / 2
        : paddingX + (index / (normalizedItems.length - 1)) * chartWidth;
      const y = paddingTop + (1 - (item[entry.key] / maxValue)) * chartHeight;
      return { label: item.label, value: item[entry.key], x, y };
    });
    return { ...entry, points };
  });

  const keyLabelIndexes = Array.from(new Set([0, Math.floor((normalizedItems.length - 1) / 2), normalizedItems.length - 1]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        {pointsBySeries.map((entry) => (
          <div key={entry.key} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
        {Array.from({ length: 4 }).map((_, index) => {
          const y = paddingTop + (index / 3) * chartHeight;
          return <line key={index} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e2e8f0" strokeDasharray="4 8" />;
        })}
        {pointsBySeries.map((entry) => {
          const linePath = entry.points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
          const areaPath = `${linePath} L ${entry.points[entry.points.length - 1].x} ${height - paddingBottom} L ${entry.points[0].x} ${height - paddingBottom} Z`;
          return (
            <g key={entry.key}>
              <path d={areaPath} fill={entry.color} fillOpacity="0.07" />
              <path d={linePath} fill="none" stroke={entry.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {entry.points.map((point, index) => (
                <g key={`${entry.key}-${point.label}-${index}`}>
                  <circle cx={point.x} cy={point.y} r="4.5" fill="white" stroke={entry.color} strokeWidth="2" />
                  <circle cx={point.x} cy={point.y} r="2" fill={entry.color} />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {keyLabelIndexes.map((index) => (
          <span key={`${normalizedItems[index]?.label}-${index}`} className="truncate">
            {normalizedItems[index]?.label}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {pointsBySeries.map((entry) => {
          const latestPoint = entry.points[entry.points.length - 1];
          return (
            <div key={entry.key} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
              {entry.label}: <span className="font-semibold text-slate-900">{formatter(latestPoint?.value ?? 0)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminDonutChart({
  items = [],
  valueKey = "value",
  labelKey = "label",
  totalLabel = "Total",
  formatter = formatAdminCompactNumber,
}) {
  const normalizedItems = items
    .map((item, index) => ({
      label: item?.[labelKey] ?? "",
      value: Math.max(0, toFiniteNumber(item?.[valueKey])),
      color: item?.color || ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length],
    }))
    .filter((item) => item.value > 0);

  if (!normalizedItems.length) {
    return <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">Nothing to visualize yet.</div>;
  }

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const total = normalizedItems.reduce((sum, item) => sum + item.value, 0);
  const segmentOffsets = [];
  let runningOffset = 0;
  normalizedItems.forEach((item) => {
    segmentOffsets.push(runningOffset);
    const segmentLength = total ? (item.value / total) * circumference : 0;
    runningOffset += segmentLength;
  });

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-center">
      <div className="relative mx-auto h-40 w-40 shrink-0">
        <svg viewBox="0 0 120 120" className="h-40 w-40 -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="14" />
          {normalizedItems.map((item, index) => {
            const segmentLength = total ? (item.value / total) * circumference : 0;
            return (
              <circle
                key={item.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${segmentLength} ${circumference}`}
                strokeDashoffset={-segmentOffsets[index]}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-semibold text-slate-900">{formatter(total)}</p>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{totalLabel}</p>
        </div>
      </div>
      <div className="space-y-3">
        {normalizedItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate text-sm text-slate-700">{item.label}</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{formatter(item.value)}</p>
              <p className="text-xs text-slate-500">{formatAdminPercent((item.value / total) * 100)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminBarList({
  items = [],
  valueKey = "value",
  labelKey = "label",
  formatter = formatAdminCompactNumber,
  maxItems = 6,
}) {
  const normalizedItems = items
    .slice(0, maxItems)
    .map((item, index) => ({
      label: item?.[labelKey] ?? "",
      value: Math.max(0, toFiniteNumber(item?.[valueKey])),
      color: item?.color || ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length],
    }))
    .filter((item) => item.label);

  if (!normalizedItems.length) {
    return <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">No breakdown data yet.</div>;
  }

  const maxValue = Math.max(...normalizedItems.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {normalizedItems.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-700">{item.label}</p>
            <p className="text-sm font-semibold text-slate-900">{formatter(item.value)}</p>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-slate-100">
            <div className="h-2.5 rounded-full" style={{ width: `${Math.max(10, (item.value / maxValue) * 100)}%`, backgroundColor: item.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function getErrorHint(message) {
  const text = (message || "").toLowerCase();
  if (text.includes("openai_api_key")) return "Add your OpenAI API key to the backend environment.";
  if (text.includes("ffmpeg")) return "Install ffmpeg on the backend server for larger files.";
  if (text.includes("http 407") || text.includes("response 407") || text.includes("proxy rejected authentication")) {
    return "The backend proxy credentials are being rejected. Recheck your YouTube proxy URL or Webshare username and password on Render.";
  }
  if (text.includes("impersonate target")) return "If a video link still fails, leave YTDLP_IMPERSONATE_TARGET empty or add YouTube cookies or a proxy on the backend.";
  if (text.includes("blocked direct server-side download")) return "Try a video with public captions, or upload the lecture file directly.";
  if (text.includes("yt-dlp") || text.includes("video-link transcription") || text.includes("downloadable audio format")) {
    return "Try another public video link, or upload the lecture file directly. YouTube links may also need public captions or working backend cookies.";
  }
  if (text.includes("smtp")) return "Configure SMTP or MAIL variables on Render so verification codes can be sent.";
  if (text.includes("timed out")) return "Try again or split a very long lecture into smaller sections.";
  return "Check the backend logs for the exact failing stage.";
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function fetchWithTimeout(resource, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const nextOptions = { ...options, signal: options.signal || controller.signal };

  try {
    return await fetch(resource, nextOptions);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function getBackendConnectionTroubleshootingMessage(context = "") {
  const area = String(context || "").trim().toLowerCase();
  if (area === "study-guide") {
    return (
      "Study source ready, but the backend could not finish the study guide request. "
      + "This usually means the Render backend is sleeping, timed out, restarted during AI processing, or the network dropped. "
      + "If it keeps happening, check the backend service status and logs on Render."
    );
  }
  return (
    "The app could not reach the Mabaso server. This usually means the backend is sleeping, timed out, restarted while processing, "
    + "the API URL is wrong, or there is a network issue. If it keeps happening, check the backend service status and logs on Render."
  );
}

function getReadableRequestError(error) {
  if (isAbortError(error)) {
    return (
      "The Mabaso server took too long to respond. "
      + "The backend may be sleeping on Render, timing out, or restarting while processing. Please try again in a few seconds."
    );
  }

  const message = String(error?.message || "").trim();
  if (/failed to fetch/i.test(message)) {
    return getBackendConnectionTroubleshootingMessage();
  }

  return message || `${getBackendConnectionTroubleshootingMessage()} Please check the backend status.`;
}

function isTransientServerConnectionMessage(message) {
  return /could not reach the mabaso server|took too long to respond|failed to fetch|server reconnects|server wakes up/i.test(String(message || ""));
}

function isTransientHttpStatus(status) {
  return [502, 503, 504].includes(Number(status));
}

async function fetchJsonWithTransientRetries(resource, options = {}, { timeoutMs = 15000, retries = 0 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      const response = await fetchWithTimeout(resource, options, timeoutMs);
      const data = await parseJsonSafe(response);
      if (!response.ok) {
        const requestError = new Error(data.detail || "Request failed.");
        requestError.transient = isTransientHttpStatus(response.status) || isTransientServerConnectionMessage(requestError.message);
        requestError.response = response;
        requestError.data = data;
        throw requestError;
      }
      return { response, data };
    } catch (err) {
      const message = String(err?.message || "");
      const isTransient = isAbortError(err) || Boolean(err?.transient) || isTransientServerConnectionMessage(message);
      if (!isTransient || attempt >= retries) throw err;
      attempt += 1;
      await wait(1200 * attempt);
    }
  }
}

function buildClientRequestId(prefix = "req") {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function warmBackendServer() {
  try {
    await fetchJsonWithTransientRetries(`${API_BASE_URL}/health`, {}, { timeoutMs: 70000, retries: 1 });
    return true;
  } catch {
    return false;
  }
}

function decodeJwtPayload(token) {
  try {
    const [, payload = ""] = String(token || "").split(".");
    if (!payload) return {};
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4 || 4)) % 4)}`;
    return JSON.parse(window.atob(padded));
  } catch {
    return {};
  }
}

function extractEmailFromJwt(token) {
  const payload = decodeJwtPayload(token);
  return typeof payload?.email === "string" ? payload.email.trim() : "";
}

function getTokenExpiryTimestamp(token) {
  if (!token || !String(token).startsWith("mabaso.v1.")) return 0;
  try {
    const parts = String(token).split(".");
    const encodedPayload = parts[2] || "";
    if (!encodedPayload) return 0;
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4 || 4)) % 4)}`;
    const payload = JSON.parse(window.atob(padded));
    return Number(payload?.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

function parseInviteEmails(value) {
  return Array.from(new Set((value || "").split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean)));
}

function groupQuizAnswers(answerRows) {
  return (answerRows || []).reduce((grouped, item) => {
    const key = String(item.question_number || "");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
    return grouped;
  }, {});
}

function collaborationRoomToText(room) {
  if (!room) return "No collaboration room open.";
  const memberLines = (room.members || []).map((member) => `${member.email} (${member.role})`).join("\n");
  const messageLines = (room.messages || []).map((message) => `${message.author_email}: ${message.content}`).join("\n\n");
  const answerLines = (room.quiz_answers || []).map((answer) => `Q${answer.question_number} - ${answer.author_email}: ${answer.answer_text}`).join("\n");
  return [
    `Room: ${room.title}`,
    "",
    `Owner: ${room.owner_email}`,
    `Shared tool: ${room.active_tab}`,
    `Test visibility: ${room.test_visibility}`,
    "",
    "Members",
    memberLines || "No members yet.",
    "",
    "Shared notes",
    room.shared_notes || "No shared notes yet.",
    "",
    "Room chat",
    messageLines || "No messages yet.",
    "",
    "Visible answers",
    answerLines || "No visible answers yet.",
  ].join("\n");
}

function createEmptyPodcastData() {
  return {
    jobId: "",
    title: "",
    overview: "",
    script: "",
    segments: [],
    speakerCount: 2,
    targetMinutes: 10,
  };
}

function createEmptyTeacherLessonData() {
  return {
    jobId: "",
    title: "",
    overview: "",
    segments: [],
  };
}

function createEmptyPresentationData() {
  return {
    jobId: "",
    title: "",
    subtitle: "",
    designId: presentationDesigns[0].id,
    templateName: "",
    slides: [],
  };
}

function getPodcastTurnStartSeconds(segments, index) {
  const safeIndex = Math.max(0, Number(index || 0));
  return Math.max(
    0,
    (segments || [])
      .slice(0, safeIndex)
      .reduce((sum, segment) => sum + (Number(segment?.estimated_minutes || 0) * 60), 0),
  );
}

function normalizePodcastData(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    jobId: raw.jobId || raw.job_id || "",
    title: raw.title || "",
    overview: raw.overview || "",
    script: raw.script || "",
    segments: Array.isArray(raw.segments) ? raw.segments : [],
    speakerCount: Number(raw.speakerCount || raw.speaker_count || 2) >= 3 ? 3 : 2,
    targetMinutes: Number(raw.targetMinutes || raw.target_minutes || 10) || 10,
  };
}

function normalizeTeacherLessonData(value) {
  const raw = value && typeof value === "object" ? value : {};
  const rawSegments = Array.isArray(raw.segments) ? raw.segments : Array.isArray(raw.teacher_segments) ? raw.teacher_segments : [];
  return {
    jobId: raw.jobId || raw.job_id || "",
    title: raw.title || raw.teacher_title || "",
    overview: raw.overview || raw.teacher_overview || "",
    segments: rawSegments
      .filter((segment) => segment && typeof segment === "object")
      .map((segment, index) => ({
        index: Number(segment?.index || index + 1),
        sectionHeading: segment?.sectionHeading || segment?.section_heading || "SHORT SUMMARY",
        prompt: segment?.prompt || "",
        text: segment?.text || "",
        estimatedMinutes: Number(segment?.estimatedMinutes || segment?.estimated_minutes || 0),
      }))
      .filter((segment) => segment.text),
  };
}

function sanitizePodcastForHistory(value) {
  const podcast = normalizePodcastData(value);
  return {
    ...podcast,
    jobId: "",
    segments: (podcast.segments || []).map((segment, index) => ({
      index: Number(segment?.index || index + 1),
      speaker_key: segment?.speaker_key || "",
      speaker_name: segment?.speaker_name || "",
      speaker_role: segment?.speaker_role || "",
      voice: segment?.voice || "",
      text: segment?.text || "",
      estimated_minutes: Number(segment?.estimated_minutes || 0),
    })),
  };
}

function sanitizeTeacherLessonForHistory(value) {
  const lesson = normalizeTeacherLessonData(value);
  return {
    ...lesson,
    jobId: "",
  };
}

function normalizePresentationData(value) {
  const raw = value && typeof value === "object" ? value : {};
  const rawSlides = Array.isArray(raw.slides) ? raw.slides : Array.isArray(raw.presentation_slides) ? raw.presentation_slides : [];
  return {
    jobId: raw.jobId || raw.job_id || "",
    title: raw.title || raw.presentation_title || "",
    subtitle: raw.subtitle || raw.presentation_subtitle || "",
    designId: raw.designId || raw.design_id || raw.presentation_design_id || presentationDesigns[0].id,
    templateName: raw.templateName || raw.template_name || raw.presentation_template_name || "",
    slides: rawSlides
      .filter((slide) => slide && typeof slide === "object")
      .map((slide) => ({
        title: slide.title || "",
        bullets: Array.isArray(slide.bullets) ? slide.bullets.filter(Boolean).slice(0, 5) : [],
        visualTitle: slide.visual_title || slide.visualTitle || slide.note || "",
        visualType: slide.visual_type || slide.visualType || "cluster",
        visualItems: Array.isArray(slide.visual_items) ? slide.visual_items.filter(Boolean).slice(0, 4) : Array.isArray(slide.visualItems) ? slide.visualItems.filter(Boolean).slice(0, 4) : [],
        flowNote: slide.flow_note || slide.flowNote || "",
        referenceImageIndex: Number.isFinite(Number(slide.reference_image_index ?? slide.referenceImageIndex))
          ? Number(slide.reference_image_index ?? slide.referenceImageIndex)
          : -1,
      }))
      .filter((slide) => slide.title || slide.bullets.length),
  };
}

function sanitizePresentationForHistory(value) {
  const presentation = normalizePresentationData(value);
  return {
    ...presentation,
    jobId: "",
  };
}

function presentationToText(presentation) {
  const normalized = normalizePresentationData(presentation);
  const blocks = [];
  if (normalized.title) {
    blocks.push("POWERPOINT TITLE");
    blocks.push(normalized.title);
    blocks.push("");
  }
  if (normalized.subtitle) {
    blocks.push("SUBTITLE");
    blocks.push(normalized.subtitle);
    blocks.push("");
  }
  normalized.slides.forEach((slide, index) => {
    blocks.push(`SLIDE ${index + 1}: ${slide.title || "Untitled slide"}`);
    (slide.bullets || []).forEach((bullet) => blocks.push(`- ${bullet}`));
    if (slide.visualTitle) blocks.push(`Visual panel: ${slide.visualTitle} (${slide.visualType || "cluster"})`);
    (slide.visualItems || []).forEach((item) => blocks.push(`  * ${item}`));
    if (slide.flowNote) blocks.push(`Flow note: ${slide.flowNote}`);
    blocks.push("");
  });
  return blocks.join("\n").trim();
}

function teacherLessonToText(lesson) {
  const normalized = normalizeTeacherLessonData(lesson);
  const blocks = [];
  if (normalized.title) {
    blocks.push("TEACHER MODE TITLE");
    blocks.push(normalized.title);
    blocks.push("");
  }
  if (normalized.overview) {
    blocks.push("TEACHER MODE OVERVIEW");
    blocks.push(normalized.overview);
    blocks.push("");
  }
  normalized.segments.forEach((segment, index) => {
    blocks.push(`SEGMENT ${index + 1}: ${segment.sectionHeading}`);
    if (segment.prompt) blocks.push(`Prompt: ${segment.prompt}`);
    blocks.push(segment.text);
    blocks.push("");
  });
  return blocks.join("\n").trim();
}

function normalizeGuideHeading(value) {
  return (value || "").trim().toLowerCase();
}

function extractGuideSections(markdown) {
  const text = (markdown || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const matches = Array.from(text.matchAll(/\*\*([^*]+)\*\*\s*\n+([\s\S]*?)(?=\n\*\*[^*]+\*\*\s*\n|$)/g));
  if (!matches.length) {
    return [{ heading: "Study Guide", normalizedHeading: "study guide", content: text }];
  }
  const introText = text.slice(0, matches[0]?.index || 0).trim();
  const sections = matches
    .map((match) => ({
      heading: (match[1] || "").trim(),
      normalizedHeading: normalizeGuideHeading(match[1]),
      content: (match[2] || "").trim(),
    }))
    .filter((section) => section.heading && section.content);
  if (introText) {
    sections.unshift({
      heading: "Guide Overview",
      normalizedHeading: "guide overview",
      content: introText,
    });
  }
  return sections;
}

function getGuideSectionByHeading(sections, heading) {
  const normalizedHeading = normalizeGuideHeading(heading);
  return (sections || []).find((section) => section.normalizedHeading === normalizedHeading) || null;
}

function getPodcastEstimatedMinutes(podcast) {
  const total = (podcast?.segments || []).reduce((sum, segment) => sum + Number(segment?.estimated_minutes || 0), 0);
  if (total > 0) return total.toFixed(total >= 10 ? 0 : 1);
  if (podcast?.targetMinutes) return String(podcast.targetMinutes);
  return "0";
}

function getTeacherEstimatedMinutes(lesson) {
  const total = (lesson?.segments || []).reduce(
    (sum, segment) => sum + Number(segment?.estimatedMinutes || segment?.estimated_minutes || 0),
    0,
  );
  if (total > 0) return total.toFixed(total >= 10 ? 0 : 1);
  return "15";
}

function truncatePreviewText(value, limit = 1200) {
  const text = (value || "").trim();
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}...` : text;
}

function buildCollaborationPreview(room) {
  if (!room) return "Open a collaboration room to preview the shared study content.";
  if (room.active_tab === "guide") return truncatePreviewText((room.summary || "").replace(/\*\*/g, ""));
  if (room.active_tab === "formulas") return truncatePreviewText(room.formula || "");
  if (room.active_tab === "examples") return truncatePreviewText(room.example || "");
  if (room.active_tab === "flashcards") return truncatePreviewText(flashcardsToText(room.flashcards || []));
  if (room.active_tab === "quiz") return truncatePreviewText(quizToText(room.quiz_questions || []));
  if (room.active_tab === "transcript") return truncatePreviewText(room.transcript || "");
  return truncatePreviewText(room.shared_notes || "No shared content has been selected yet.");
}

export default function App() {
  const [authToken, setAuthToken] = useState(() => window.localStorage.getItem(AUTH_TOKEN_KEY) || "");
  const [authEmail, setAuthEmail] = useState(() => window.localStorage.getItem(AUTH_EMAIL_KEY) || "");
  const [authSessionMode, setAuthSessionMode] = useState(() => window.localStorage.getItem(AUTH_MODE_KEY) || "user");
  const [authAvailableModes, setAuthAvailableModes] = useState(() => {
    try {
      const value = window.localStorage.getItem(AUTH_AVAILABLE_MODES_KEY) || "[]";
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [authEmailInput, setAuthEmailInput] = useState(
    () => window.localStorage.getItem(REMEMBERED_EMAIL_KEY) || window.localStorage.getItem(AUTH_EMAIL_KEY) || "",
  );
  const [outputLanguage, setOutputLanguage] = useState(() => window.localStorage.getItem(OUTPUT_LANGUAGE_KEY) || "English");
  const [authPasswordInput, setAuthPasswordInput] = useState("");
  const [authConfirmPasswordInput, setAuthConfirmPasswordInput] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [registerStep, setRegisterStep] = useState("email");
  const [pendingRegistrationToken, setPendingRegistrationToken] = useState("");
  const [pendingEmailAuthMode, setPendingEmailAuthMode] = useState("");
  const [pendingEmailAuthEmail, setPendingEmailAuthEmail] = useState("");
  const [isSigningInWithPassword, setIsSigningInWithPassword] = useState(false);
  const [isRequestingEmailCode, setIsRequestingEmailCode] = useState(false);
  const [isVerifyingEmailCode, setIsVerifyingEmailCode] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);
  const [currentPage, setCurrentPage] = useState("capture");
  const [videoUrl, setVideoUrl] = useState("");
  const [isTranscribingVideo, setIsTranscribingVideo] = useState(false);
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [formula, setFormula] = useState("");
  const [example, setExample] = useState("");
  const [flashcards, setFlashcards] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [studyImages, setStudyImages] = useState([]);
  const [lectureNoteSources, setLectureNoteSources] = useState([]);
  const [lectureSlideSources, setLectureSlideSources] = useState([]);
  const [pastQuestionPaperSources, setPastQuestionPaperSources] = useState([]);
  const [pastQuestionMemo, setPastQuestionMemo] = useState("");
  const [presentationData, setPresentationData] = useState(createEmptyPresentationData);
  const [selectedPresentationDesign, setSelectedPresentationDesign] = useState(presentationDesigns[0].id);
  const [selectedPresentationSlideIndex, setSelectedPresentationSlideIndex] = useState(0);
  const [presentationTemplateFile, setPresentationTemplateFile] = useState(null);
  const [podcastData, setPodcastData] = useState(createEmptyPodcastData);
  const [teacherLessonData, setTeacherLessonData] = useState(createEmptyTeacherLessonData);
  const [podcastSpeakerCount, setPodcastSpeakerCount] = useState(2);
  const [podcastTargetMinutes, setPodcastTargetMinutes] = useState(10);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState("guide");
  const [currentJobType, setCurrentJobType] = useState("");
  const [usedFallbackSummary, setUsedFallbackSummary] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingPresentation, setIsGeneratingPresentation] = useState(false);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [isGeneratingTeacherLesson, setIsGeneratingTeacherLesson] = useState(false);
  const [isLoadingPodcastAudio, setIsLoadingPodcastAudio] = useState(false);
  const [isExtractingNotes, setIsExtractingNotes] = useState(false);
  const [isExtractingSlides, setIsExtractingSlides] = useState(false);
  const [isExtractingPastPapers, setIsExtractingPastPapers] = useState(false);
  const [isProcessingLectureBundle, setIsProcessingLectureBundle] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizAnswerImages, setQuizAnswerImages] = useState({});
  const [quizResults, setQuizResults] = useState({});
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isMarkingQuiz, setIsMarkingQuiz] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [roomQuizAnswers, setRoomQuizAnswers] = useState({});
  const [roomQuizAnswerImages, setRoomQuizAnswerImages] = useState({});
  const [roomQuizResults, setRoomQuizResults] = useState({});
  const [isMarkingRoomQuiz, setIsMarkingRoomQuiz] = useState(false);
  const [roomQuizSubmitted, setRoomQuizSubmitted] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatReferenceImages, setChatReferenceImages] = useState([]);
  const [isAskingChat, setIsAskingChat] = useState(false);
  const [historyItems, setHistoryItems] = useState(() => loadHistoryItems(window.localStorage.getItem(AUTH_EMAIL_KEY) || ""));
  const [activeHistoryId, setActiveHistoryId] = useState("");
  const [collaborationRooms, setCollaborationRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomTitleInput, setRoomTitleInput] = useState("");
  const [roomInviteInput, setRoomInviteInput] = useState("");
  const [newRoomVisibility, setNewRoomVisibility] = useState("private");
  const [roomSharedNotesDraft, setRoomSharedNotesDraft] = useState("");
  const [roomMessageDraft, setRoomMessageDraft] = useState("");
  const [followRoomView, setFollowRoomView] = useState(true);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isRoomLoading, setIsRoomLoading] = useState(false);
  const [isSavingRoomNotes, setIsSavingRoomNotes] = useState(false);
  const [isSendingRoomMessage, setIsSendingRoomMessage] = useState(false);
  const [supportMessageDraft, setSupportMessageDraft] = useState("");
  const [supportFeedback, setSupportFeedback] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [presentationView, setPresentationView] = useState("setup");
  const [adminDashboard, setAdminDashboard] = useState(() => loadAdminDashboardCache());
  const [isLoadingAdminDashboard, setIsLoadingAdminDashboard] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [adminSidebarTab, setAdminSidebarTab] = useState("overview");
  const fileInputRef = useRef(null);
  const lectureNotesFileInputRef = useRef(null);
  const lectureSlidesFileInputRef = useRef(null);
  const pastQuestionPaperFileInputRef = useRef(null);
  const bulkLectureFileInputRef = useRef(null);
  const chatImageInputRef = useRef(null);
  const presentationTemplateInputRef = useRef(null);
  const podcastAudioRef = useRef(null);
  const podcastAudioSegmentsRef = useRef([]);
  const podcastAudioUrlRef = useRef("");
  const presentationViewerRef = useRef(null);
  const videoUrlInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingAudioContextRef = useRef(null);
  const recordingSourceNodeRef = useRef(null);
  const recordingAnalyserRef = useRef(null);
  const recordingMonitorFrameRef = useRef(0);
  const recordingLastSoundAtRef = useRef(0);
  const recordingStopReasonRef = useRef("");
  const audioChunksRef = useRef([]);
  const googleButtonRef = useRef(null);
  const answerSyncTimersRef = useRef({});
  const historyHydratingRef = useRef(false);
  const skipNextHistorySyncRef = useRef(false);
  const historyOwnerEmailRef = useRef(normalizeHistoryOwnerEmail(window.localStorage.getItem(AUTH_EMAIL_KEY) || ""));
  const hasLoadedAdminDashboardRef = useRef(false);
  const hasRestoredWorkspaceDraftRef = useRef(false);
  const hasRestoredRecoveredRecordingRef = useRef(false);
  const hasResumedPendingJobRef = useRef(false);
  const teacherSectionRefs = useRef({});
  const teacherPlaybackRunRef = useRef(0);
  const [podcastAudioSegments, setPodcastAudioSegments] = useState([]);
  const [podcastAudioUrl, setPodcastAudioUrl] = useState("");
  const [activePodcastSegmentIndex, setActivePodcastSegmentIndex] = useState(0);
  const [isPodcastAutoPlaying, setIsPodcastAutoPlaying] = useState(false);
  const [teacherVoiceOptions, setTeacherVoiceOptions] = useState([]);
  const [selectedTeacherVoiceName, setSelectedTeacherVoiceName] = useState("");
  const [activeTeacherSegmentIndex, setActiveTeacherSegmentIndex] = useState(-1);
  const [isTeacherPlaying, setIsTeacherPlaying] = useState(false);
  const [isTeacherPaused, setIsTeacherPaused] = useState(false);

  const lectureNotes = studySourceEntriesToText(lectureNoteSources, "LECTURE NOTE");
  const lectureNoteFileNames = lectureNoteSources.map((item) => item.name);
  const lectureNotesFileName = formatGroupedSourceLabel(lectureNoteFileNames, "note file", "note files");
  const lectureSlides = studySourceEntriesToText(lectureSlideSources, "SLIDE SOURCE");
  const lectureSlideFileNames = lectureSlideSources.map((item) => item.name);
  const pastQuestionPapers = [studySourceEntriesToText(pastQuestionPaperSources, "PAST QUESTION PAPER"), pastQuestionMemo.trim() ? `PAST QUESTION PAPER MEMO\n${pastQuestionMemo.trim()}` : ""].filter(Boolean).join("\n\n");
  const pastQuestionPaperFileNames = pastQuestionPaperSources.map((item) => item.name);
  const uploadedVisualReferences = buildUploadedVisualReferences(lectureNoteSources, lectureSlideSources);
  const visualReferences = uploadedVisualReferences;
  const loading = isTranscribing || isTranscribingVideo || isGeneratingSummary || isGeneratingQuiz || isGeneratingPresentation || isGeneratingPodcast || isGeneratingTeacherLesson || isLoadingPodcastAudio || isExtractingNotes || isExtractingSlides || isExtractingPastPapers || isProcessingLectureBundle;
  const hasStudyInputs = Boolean(transcript.trim() || lectureNotes.trim() || lectureSlides.trim() || pastQuestionPapers.trim());
  const hasQuizGenerationInputs = Boolean(summary.trim() || transcript.trim() || lectureNotes.trim() || lectureSlides.trim() || pastQuestionPapers.trim());
  const slidesReadyForGuide = Boolean(lectureSlideSources.length && lectureSlides.trim()) && !isExtractingSlides;
  const slideGuideStatusLine = isExtractingSlides
    ? "Slides are still being read. Please wait before generating the study guide."
    : slidesReadyForGuide
      ? "Slide read successful. You can now generate the study guide."
      : "Slides are not read yet. Upload or finish reading the slides before generating the study guide.";
  const hasResults = Boolean(transcript || summary || formula || example || flashcards.length || quizQuestions.length || presentationData.slides.length || podcastData.script);
  const selectedQuizQuestions = quizQuestions;
  const deferredTranscript = useDeferredValue(transcript);
  const deferredSummary = useDeferredValue(summary);
  const deferredFormula = useDeferredValue(formula);
  const deferredExample = useDeferredValue(example);
  const deferredActiveRoomSummary = useDeferredValue(activeRoom?.summary || "");
  const deferredActiveRoomFormula = useDeferredValue(activeRoom?.formula || "");
  const deferredActiveRoomExample = useDeferredValue(activeRoom?.example || "");
  const formattedGuide = normalizeRenderedMathText(prettifyMathText(deferredSummary));
  const formattedFormula = normalizeRenderedMathText(prettifyMathText(deferredFormula));
  const formattedExample = normalizeRenderedMathText(prettifyMathText(deferredExample));
  const activeRoomFormattedGuide = normalizeRenderedMathText(prettifyMathText(deferredActiveRoomSummary));
  const activeRoomFormattedFormula = normalizeRenderedMathText(prettifyMathText(deferredActiveRoomFormula));
  const activeRoomFormattedExample = normalizeRenderedMathText(prettifyMathText(deferredActiveRoomExample));
  const formulaRows = parseFormulaRows(formattedFormula);
  const activeRoomFormulaRows = parseFormulaRows(activeRoomFormattedFormula);
  const currentTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || "Study Guide";
  const activePresentationDesign = presentationDesigns.find((design) => design.id === (presentationData.designId || selectedPresentationDesign)) || presentationDesigns[0];
  const activePresentationDesignFamily = getPresentationDesignFamily(activePresentationDesign?.id);
  const selectedPresentationTemplateName = presentationTemplateFile?.name || "";
  const generatedPresentationTemplateName = presentationData.templateName || "";
  const presentationViewerSlides = presentationData.slides.length
    ? [
      {
        title: presentationData.title || "Lecture Presentation",
        bullets: presentationData.subtitle ? [presentationData.subtitle] : [],
        visualTitle: "Topic",
        visualType: "title",
        visualItems: [],
        flowNote: "",
        referenceImageIndex: -1,
      },
      ...presentationData.slides,
    ]
    : [];
  const activePresentationSlide = presentationViewerSlides[selectedPresentationSlideIndex] || presentationViewerSlides[0] || null;
  const isPresentationJobActive = currentJobType === "presentation" && (isGeneratingPresentation || progress < 100 || !presentationData.slides.length);
  const presentationProgressValue = Math.max(0, Math.min(100, Number(isPresentationJobActive ? progress : presentationData.slides.length ? 100 : 0) || 0));
  const canOpenPresentationViewer = Boolean(presentationData.slides.length) && !isPresentationJobActive && presentationProgressValue >= 100;
  const presentationStageLine = isPresentationJobActive
    ? (status || "Generating slides, please wait...")
    : presentationData.slides.length
      ? "Your slides are ready to view, explain, and download."
      : "Pick a template, then let MABASO turn your lecture into a presentation deck.";
  const isAppleConfigured = Boolean(APPLE_CLIENT_ID);
  const appleSignInAvailable = isAppleConfigured && isAppleWebSigninSupported();
  const isRegisterMode = authMode === "register";
  const isResetMode = authMode === "reset";
  const isRegistrationEmailStep = isRegisterMode && registerStep === "email";
  const isRegistrationVerificationStep = isRegisterMode && registerStep === "verify";
  const isRegistrationPasswordStep = isRegisterMode && registerStep === "password";
  const showResetVerificationCard = isResetMode && Boolean(pendingEmailAuthEmail);
  const authMessageIsPositive = /^(verification code sent|support message sent|you are signed in|email verified)/i.test(authMessage.trim());
  const authMessageIsNeutral = /^(enter your email and a new password|opening your saved session|using the saved session|choose user mode or admin mode|enter your email and we will send a verification code|your study history stays linked to this email)/i.test(authMessage.trim());
  const authPasswordIsIncorrect = authMode === "login" && /email or password is incorrect|incorrect password/i.test(authMessage.trim());
  const authMessageIsError = Boolean(authMessage.trim()) && !authMessageIsPositive && !authMessageIsNeutral;
  const showAuthMessageBanner = Boolean(authMessage.trim()) && !authPasswordIsIncorrect;
  const activeStepIndex = ["capture", "about", "support"].includes(currentPage) ? 1 : currentPage === "workspace" ? 2 : currentPage === "collaboration" ? 3 : currentPage === "admin" ? 3 : -1;
  const activeHistoryItem = historyItems.find((item) => item.id === activeHistoryId) || null;
  const workspaceFileLabel = getPrimarySourceLabel({
    fileName: file?.name || "",
    historyFileName: activeHistoryItem?.fileName || "",
    videoUrl,
    lectureNotesFileName,
    lectureSlideFileNames,
    pastQuestionPaperFileNames,
  });
  const activeRoomQuizQuestions = activeRoom?.quiz_questions || [];
  const roomAnswerGroups = groupQuizAnswers(activeRoom?.quiz_answers || []);
  const roomToolLabel = tabs.find((tab) => tab.id === activeRoom?.active_tab)?.label || "Study Guide";
  const canExportCurrent = activeTab === "quiz"
    ? Boolean(selectedQuizQuestions.length)
    : hasResults || activeTab === "chat";
  const canShareCurrentTool = Boolean(activeRoom && !["podcast", "presentation"].includes(activeTab));
  const errorHint = getErrorHint(error);
  const showHistoryPanel = currentPage === "capture" || currentPage === "workspace";
  const activePodcastSegment = podcastAudioSegments[activePodcastSegmentIndex] || podcastData.segments[activePodcastSegmentIndex] || podcastData.segments[0] || null;
  const podcastEstimatedMinutes = getPodcastEstimatedMinutes(podcastData);
  const guideSections = extractGuideSections(formattedGuide || summary);
  const guideTitleSection = getGuideSectionByHeading(guideSections, "LECTURE TITLE");
  const guideSummarySection = getGuideSectionByHeading(guideSections, "SHORT SUMMARY");
  const visibleGuideSections = guideSections.filter(
    (section) => !["lecture title", "short summary"].includes(section.normalizedHeading),
  );
  const guideTopic = ((guideTitleSection?.content || "").split(/\n+/).find((line) => line.trim()) || "").trim()
    || extractHistoryTitle(formattedGuide || summary, workspaceFileLabel)
    || workspaceFileLabel
    || "Study Guide";
  const teacherEstimatedMinutes = getTeacherEstimatedMinutes(teacherLessonData);
  const activeTeacherSegment = teacherLessonData.segments[activeTeacherSegmentIndex] || teacherLessonData.segments[0] || null;
  const isAdminAccount = authAvailableModes.includes("admin");

  const getActiveWorkspaceOwnerEmail = () => normalizeHistoryOwnerEmail(authEmail || window.localStorage.getItem(AUTH_EMAIL_KEY) || authEmailInput || "");

  const buildWorkspaceSnapshot = (overrides = {}) => ({
    version: 1,
    savedAt: new Date().toISOString(),
    activeHistoryId: overrides.activeHistoryId ?? activeHistoryId ?? "",
    currentPage: overrides.currentPage ?? (currentPage === "admin" ? "capture" : currentPage),
    activeTab: overrides.activeTab ?? activeTab,
    videoUrl: overrides.videoUrl ?? videoUrl,
    transcript: overrides.transcript ?? transcript,
    summary: overrides.summary ?? summary,
    formula: overrides.formula ?? formula,
    example: overrides.example ?? example,
    flashcards: overrides.flashcards ?? flashcards,
    quizQuestions: overrides.quizQuestions ?? quizQuestions,
    studyImages: overrides.studyImages ?? studyImages,
    lectureNoteSources: overrides.lectureNoteSources ?? sanitizeStudySourceEntriesForHistory(lectureNoteSources),
    lectureSlideSources: overrides.lectureSlideSources ?? sanitizeStudySourceEntriesForHistory(lectureSlideSources),
    pastQuestionPaperSources: overrides.pastQuestionPaperSources ?? sanitizeStudySourceEntriesForHistory(pastQuestionPaperSources),
    pastQuestionMemo: overrides.pastQuestionMemo ?? pastQuestionMemo,
    presentationData: overrides.presentationData ?? normalizePresentationData(presentationData),
    selectedPresentationDesign: overrides.selectedPresentationDesign ?? selectedPresentationDesign,
    presentationView: overrides.presentationView ?? presentationView,
    podcastData: overrides.podcastData ?? normalizePodcastData(podcastData),
    podcastSpeakerCount: overrides.podcastSpeakerCount ?? podcastSpeakerCount,
    podcastTargetMinutes: overrides.podcastTargetMinutes ?? podcastTargetMinutes,
    teacherLessonData: overrides.teacherLessonData ?? normalizeTeacherLessonData(teacherLessonData),
    outputLanguage: overrides.outputLanguage ?? outputLanguage,
    workspaceFileName: overrides.workspaceFileName ?? file?.name ?? "",
  });

  const persistWorkspaceDraft = (overrides = {}) => {
    const ownerEmail = getActiveWorkspaceOwnerEmail();
    if (!ownerEmail) return;
    saveWorkspaceDraft(ownerEmail, buildWorkspaceSnapshot(overrides));
  };

  const applyWorkspaceSnapshot = (snapshot = {}, { preserveStatus = false } = {}) => {
    if (!snapshot || typeof snapshot !== "object") return;
    replacePodcastAudioUrl("");
    replacePodcastAudioSegments([]);
    stopTeacherPlayback({ resetIndex: true });
    startTransition(() => {
      setFile(null);
      setTranscript(snapshot.transcript || "");
      setSummary(snapshot.summary || "");
      setFormula(snapshot.formula || "");
      setExample(snapshot.example || "");
      setFlashcards(Array.isArray(snapshot.flashcards) ? snapshot.flashcards : []);
      setQuizQuestions(Array.isArray(snapshot.quizQuestions) ? snapshot.quizQuestions : []);
      setStudyImages(Array.isArray(snapshot.studyImages) ? snapshot.studyImages : []);
      setLectureNoteSources(normalizeStudySourceEntries(snapshot.lectureNoteSources, "", [], "LECTURE NOTE"));
      setLectureSlideSources(normalizeStudySourceEntries(snapshot.lectureSlideSources, "", [], "SLIDE SOURCE"));
      setPastQuestionPaperSources(normalizeStudySourceEntries(snapshot.pastQuestionPaperSources, "", [], "PAST QUESTION PAPER"));
      setPastQuestionMemo(snapshot.pastQuestionMemo || "");
      setPresentationData(normalizePresentationData(snapshot.presentationData));
      setSelectedPresentationDesign(snapshot.selectedPresentationDesign || presentationDesigns[0].id);
      setPresentationView(snapshot.presentationView || "setup");
      setPodcastData(normalizePodcastData(snapshot.podcastData));
      setPodcastSpeakerCount(Number(snapshot.podcastSpeakerCount || 2) >= 3 ? 3 : 2);
      setPodcastTargetMinutes(Number(snapshot.podcastTargetMinutes || 10) || 10);
      setTeacherLessonData(normalizeTeacherLessonData(snapshot.teacherLessonData));
      setOutputLanguage(snapshot.outputLanguage || outputLanguage);
      setVideoUrl(snapshot.videoUrl || "");
      setActiveHistoryId(snapshot.activeHistoryId || "");
      setActiveTab(snapshot.activeTab || "guide");
      setCurrentPage(snapshot.currentPage || "workspace");
      setActivePodcastSegmentIndex(0);
      setIsPodcastAutoPlaying(false);
      setActiveTeacherSegmentIndex(-1);
      setIsTeacherPlaying(false);
      setIsTeacherPaused(false);
    });
    if (!preserveStatus) {
      setStatus("Restored your saved workspace.");
    }
  };

  const persistPendingJob = (snapshot = null) => {
    const ownerEmail = getActiveWorkspaceOwnerEmail();
    if (!ownerEmail) return;
    savePendingJobSnapshot(ownerEmail, snapshot);
  };

  const clearPendingJob = () => {
    persistPendingJob(null);
  };

  const upsertWorkspaceHistoryItem = (item) => {
    const timestamp = new Date().toISOString();
    const existingId = item?.id || activeHistoryId || "";
    const existingItem = existingId ? historyItems.find((entry) => entry.id === existingId) : null;
    const nextItem = {
      ...(existingItem || {}),
      ...(item || {}),
      id: existingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: existingItem?.createdAt || item?.createdAt || timestamp,
      updatedAt: timestamp,
    };
    historyOwnerEmailRef.current = normalizeHistoryOwnerEmail(authEmail);
    setHistoryItems((current) => mergeHistoryItems([nextItem], current));
    setActiveHistoryId(nextItem.id);
    return nextItem;
  };

  const scrollTeacherToSection = (sectionHeading = "") => {
    const normalizedHeading = String(sectionHeading || "").trim().toLowerCase();
    if (!normalizedHeading) return;
    const matchingSection = guideSections.find((section) => section.normalizedHeading === normalizedHeading)
      || guideSections.find((section) => normalizedHeading.includes(section.normalizedHeading) || section.normalizedHeading.includes(normalizedHeading));
    const targetKey = matchingSection?.normalizedHeading || normalizedHeading;
    const targetNode = teacherSectionRefs.current[targetKey];
    if (targetNode?.scrollIntoView) {
      targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const stopTeacherPlayback = ({ resetIndex = false } = {}) => {
    teacherPlaybackRunRef.current += 1;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsTeacherPlaying(false);
    setIsTeacherPaused(false);
    if (resetIndex) setActiveTeacherSegmentIndex(-1);
  };

  useEffect(() => {
    setSelectedPresentationSlideIndex(0);
  }, [presentationData.jobId, presentationData.title]);

  useEffect(() => {
    if (presentationData.slides.length || isGeneratingPresentation) return;
    setPresentationView((current) => (current === "setup" ? current : "setup"));
  }, [isGeneratingPresentation, presentationData.slides.length]);

  useEffect(() => {
    if (!presentationData.slides.length && selectedPresentationSlideIndex !== 0) {
      setSelectedPresentationSlideIndex(0);
      return;
    }
    if (selectedPresentationSlideIndex >= presentationViewerSlides.length && presentationData.slides.length) {
      setSelectedPresentationSlideIndex(0);
    }
  }, [presentationData.slides.length, presentationViewerSlides.length, selectedPresentationSlideIndex]);

  const focusPresentationViewer = () => {
    if (!canOpenPresentationViewer) return;
    setPresentationView("viewer");
    setSelectedPresentationSlideIndex(0);
    window.requestAnimationFrame(() => {
      presentationViewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const clearHistory = () => {
    historyOwnerEmailRef.current = normalizeHistoryOwnerEmail(authEmail);
    setHistoryItems([]);
    setActiveHistoryId("");
    setStatus("History cleared for this email.");
  };

  const removeHistoryItem = (itemId) => {
    historyOwnerEmailRef.current = normalizeHistoryOwnerEmail(authEmail);
    setHistoryItems((current) => current.filter((entry) => entry.id !== itemId));
    if (activeHistoryId === itemId) setActiveHistoryId("");
  };

  const historyPanel = showHistoryPanel ? (
    <section className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_20px_70px_rgba(2,8,23,0.28)] backdrop-blur xl:p-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">History</p><h2 className="mt-2 text-3xl font-semibold text-white">Saved workspaces for this email.</h2></div>
        <div className="force-mobile-stack flex flex-wrap gap-3"><div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">{historyItems.length} saved item{historyItems.length === 1 ? "" : "s"}</div><button type="button" onClick={clearHistory} disabled={!historyItems.length} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50">Clear History</button></div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">{historyItems.length ? historyItems.map((item) => <article key={item.id} className={`rounded-[24px] border p-5 transition ${activeHistoryId === item.id ? "border-emerald-300/35 bg-emerald-300/10" : "border-white/10 bg-white/[0.04]"}`}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">{new Date(item.updatedAt || item.createdAt).toLocaleString()}</p><h3 className="phone-safe-copy mt-3 text-xl font-semibold text-white">{item.title}</h3><p className="phone-safe-copy mt-2 text-sm text-slate-300">{item.fileName || "Saved lecture"}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">{item.quizQuestions?.length || 0} test question{item.quizQuestions?.length === 1 ? "" : "s"}</span><span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">{item.lectureNotes?.trim() ? "Notes added" : "No notes"}</span><span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">{item.lectureSlideFileNames?.length || 0} slide source{(item.lectureSlideFileNames?.length || 0) === 1 ? "" : "s"}</span><span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">{item.pastQuestionPaperFileNames?.length || 0} past paper{(item.pastQuestionPaperFileNames?.length || 0) === 1 ? "" : "s"}</span></div></div><div className="force-mobile-stack flex flex-wrap gap-2"><button type="button" onClick={() => loadHistoryItem(item)} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeHistoryId === item.id ? "border border-white/10 bg-emerald-300/15 text-emerald-50" : "bg-white text-slate-950"}`}>{activeHistoryId === item.id ? "Opened" : "Open"}</button><button type="button" onClick={() => downloadHistoryItemPdf(item)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">Study Pack PDF</button><button type="button" onClick={() => downloadHistoryQuizPdf(item)} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-50">Test PDF</button><button type="button" onClick={() => removeHistoryItem(item.id)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">Remove</button></div></div><p className="phone-safe-copy mt-4 max-h-[8.2rem] overflow-hidden text-sm leading-7 text-slate-300">{(item.summary || "Saved study guide content will appear here.").replace(/\*\*/g, "")}</p></article>) : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-slate-300 lg:col-span-2">Your saved workspace history will appear here after the first successful study guide on any device signed in with this email.</div>}</div>
    </section>
  ) : null;

  const renderBackButton = (onClick, label) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80 text-white transition hover:bg-white/10"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M15 6 9 12l6 6M9 12h9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      </svg>
    </button>
  );

  const buildCaptureActionMeta = (target) => {
    const progressLabel = loading && progress > 0 ? `${Math.round(progress)}%` : "";
    const progressValue = Math.max(6, Math.min(100, Math.round(progress || 0)));

    if (target === "transcribe") {
      if (recording) {
        return {
          eyebrow: "Live recording",
          badge: "REC",
          detail: "Recording is running. MABASO auto-stops after 10 minutes of silence, while a manual stop only saves the file.",
          showProgress: false,
          progressValue: 0,
          statusLine: "",
        };
      }
      if (currentJobType === "transcription" || currentJobType === "video") {
        return {
          eyebrow: currentJobType === "video" ? "Reading video link" : "Transcribing lecture",
          badge: progressLabel || "Working",
          detail: status || "Preparing the lecture transcript.",
          showProgress: true,
          progressValue,
          statusLine: status || "Preparing the lecture transcript.",
        };
      }
      if (isProcessingLectureBundle) {
        return {
          eyebrow: "Auto-processing files",
          badge: "Working",
          detail: status || "Reading notes, slides, and lecture media from the uploaded bundle.",
          showProgress: false,
          progressValue: 0,
          statusLine: "",
        };
      }
      if (file) {
        return {
          eyebrow: "Lecture file ready",
          badge: "Ready",
          detail: `${file.name} is waiting for transcription.`,
          showProgress: false,
          progressValue: 0,
          statusLine: "",
        };
      }
      return {
        eyebrow: "Step 1",
        badge: "Waiting",
        detail: "Select a video or recording file, record live, or paste a video link first.",
        showProgress: false,
        progressValue: 0,
        statusLine: "",
      };
    }

    if (target === "guide") {
      if (["notes", "slides", "past_papers", "study_guide"].includes(currentJobType)) {
        return {
          eyebrow: currentJobType === "study_guide" ? "Building study pack" : `Reading ${currentJobType.replace("_", " ")}`,
          badge: progressLabel || "Working",
          detail: status || "Preparing lecture sources for the guide.",
          showProgress: true,
          progressValue,
          statusLine: status || "Preparing lecture sources for the guide.",
        };
      }
      if (isProcessingLectureBundle) {
        return {
          eyebrow: "Auto-processing files",
          badge: "Working",
          detail: status || "Reading notes, slides, and lecture media from the uploaded bundle.",
          showProgress: false,
          progressValue: 0,
          statusLine: "",
        };
      }
      if (hasStudyInputs) {
        return {
          eyebrow: "Study sources ready",
          badge: "Ready",
          detail: "Generate the guide from the transcript, notes, slides, and past papers already loaded.",
          showProgress: false,
          progressValue: 0,
          statusLine: "",
        };
      }
      return {
        eyebrow: "Step 2",
        badge: "Waiting",
        detail: "Add notes, slides, or past papers when you want a stronger study guide.",
        showProgress: false,
        progressValue: 0,
        statusLine: "",
      };
    }

    if (hasResults) {
      return {
        eyebrow: "Workspace ready",
        badge: "Open",
        detail: quizQuestions.length
          ? `${flashcards.length} flashcards and ${quizQuestions.length} test questions are ready in the study workspace.`
          : `${flashcards.length} flashcards are ready, and the test can be generated later only when you need it.`,
        showProgress: false,
        progressValue: 0,
        statusLine: "",
      };
    }

    return {
      eyebrow: "Step 3",
      badge: loading ? "Locked" : "Waiting",
      detail: "The study workspace opens after the lecture has been transcribed or the guide has been generated.",
      showProgress: false,
      progressValue: 0,
      statusLine: "",
    };
  };

  const buildCaptureActionSteps = (target, actionMeta) => {
    if (!actionMeta.showProgress) return [];

    const steps = target === "transcribe"
      ? ["Read the lecture source", "Create the transcript", "Prepare the lecture for study"]
      : ["Read the lecture sources", "Build the study guide", "Open the study workspace"];

    const progressValue = Math.max(0, Math.min(100, Number(actionMeta.progressValue || 0)));

    return steps.map((label, index) => {
      const threshold = ((index + 1) / steps.length) * 100;
      const previousThreshold = (index / steps.length) * 100;
      const isComplete = progressValue >= threshold;
      const isCurrent = !isComplete && progressValue >= previousThreshold;
      return {
        label,
        tone: isComplete ? "done" : isCurrent ? "current" : "waiting",
      };
    });
  };

  const transcribeActionMeta = buildCaptureActionMeta("transcribe");
  const guideActionMeta = buildCaptureActionMeta("guide");
  const transcribeActionSteps = buildCaptureActionSteps("transcribe", transcribeActionMeta);
  const guideActionSteps = buildCaptureActionSteps("guide", guideActionMeta);

  const replacePodcastAudioUrl = (nextUrl = "") => {
    if (podcastAudioUrlRef.current) window.URL.revokeObjectURL(podcastAudioUrlRef.current);
    podcastAudioUrlRef.current = nextUrl;
    setPodcastAudioUrl(nextUrl);
  };

  const replacePodcastAudioSegments = (segments = []) => {
    podcastAudioSegmentsRef.current = segments;
    setPodcastAudioSegments(segments);
  };

  const seekPodcastSeconds = (seconds) => {
    const audio = podcastAudioRef.current;
    if (!audio) return;
    const nextTime = Math.min(Math.max(0, audio.currentTime + seconds), audio.duration || Infinity);
    audio.currentTime = nextTime;
  };

  const jumpToPodcastTurn = (index) => {
    const audio = podcastAudioRef.current;
    setActivePodcastSegmentIndex(index);
    if (!audio) return;
    audio.currentTime = getPodcastTurnStartSeconds(podcastData.segments, index);
    if (isPodcastAutoPlaying) {
      audio.play().catch(() => setIsPodcastAutoPlaying(false));
    }
  };

  const handlePodcastTimeUpdate = () => {
    const audio = podcastAudioRef.current;
    if (!audio || !podcastData.segments.length) return;
    const currentTime = audio.currentTime || 0;
    let nextIndex = 0;
    for (let index = 0; index < podcastData.segments.length; index += 1) {
      const start = getPodcastTurnStartSeconds(podcastData.segments, index);
      const end = getPodcastTurnStartSeconds(podcastData.segments, index + 1);
      if (currentTime >= start && (index === podcastData.segments.length - 1 || currentTime < end)) {
        nextIndex = index;
        break;
      }
    }
    setActivePodcastSegmentIndex((current) => (current === nextIndex ? current : nextIndex));
  };

  const renderQuizSection = ({
    questions,
    answers,
    results,
    quizImages,
    submitted,
    isMarking,
    onMark,
    onAnswerChange,
    onOptionChange,
    onImageChange,
    sharedAnswerGroups = {},
    visibilityMode = "",
    scoreValue = 0,
    scopeId = "workspace",
    ownerControls = null,
    ownerNotice = "",
    emptyMessage = "Generate a test from the Test tab when you need one.",
  }) => {
    const totalMarks = getTotalQuizMarks(questions);
    const hasRoomVisibility = Boolean(visibilityMode);
    const visibilityLabel = visibilityMode === "shared" ? "Shared answers" : "Private answers";
    const visibilityDescription = visibilityMode === "shared"
      ? "Shared test mode lets members compare synced written answers while they work through the same room test."
      : "Private test mode keeps each learner's answers hidden from the rest of the room until the owner changes it.";

    return (
      <div>
        <div className="force-mobile-stack mb-5 flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">{questions.length} test question{questions.length === 1 ? "" : "s"} ready</div>
          <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">{totalMarks} total marks</div>
          <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">Written questions support camera and multiple photos.</div>
          {hasRoomVisibility ? <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50">Room test mode: {visibilityLabel}</div> : null}
          {scopeId === "workspace" ? <button type="button" onClick={() => pastQuestionPaperFileInputRef.current?.click()} disabled={loading} className="rounded-full border border-emerald-300/20 bg-slate-950/75 px-4 py-2 text-sm font-semibold text-emerald-50 disabled:opacity-50">Upload Past Paper</button> : null}
          <button type="button" onClick={onMark} disabled={!questions.length || isMarking} className="rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isMarking ? "Marking..." : "Mark Test"}</button>
          {submitted ? <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">Score: {scoreValue} / {totalMarks}</div> : null}
        </div>

        {scopeId === "workspace" ? (
          <div className="mb-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-4">
            <div className="force-mobile-stack flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Past Question Paper Reference</p>
                <p className="mt-2 text-sm leading-7 text-slate-200">Add past papers and a memo if you want the next study guide and test to follow that style.</p>
              </div>
              {pastQuestionPaperSources.length || pastQuestionMemo.trim() ? (
                <button type="button" onClick={() => generateStudyGuide()} disabled={loading || !hasStudyInputs} className="rounded-full border border-amber-300/20 bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-50 disabled:opacity-50">{isGeneratingSummary ? "Refreshing..." : "Refresh Study Guide"}</button>
              ) : null}
            </div>
            {pastQuestionPaperSources.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {pastQuestionPaperSources.map((source) => (
                  <div key={source.id} className="relative rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 pr-11 text-sm text-slate-200">
                    <button type="button" onClick={() => removePastQuestionPaperSource(source.id)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white transition hover:bg-white/10" aria-label={`Remove ${source.name}`}>&times;</button>
                    <p className="phone-safe-copy font-semibold text-white">{source.name}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.22em] text-emerald-200/70">{source.prefix || "PAST QUESTION PAPER"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">No past question paper added yet.</p>
            )}
            <div className="mt-4">
              <label className="block text-xs uppercase tracking-[0.22em] text-emerald-200/70">Memo / Marking Guide Reference</label>
              <textarea value={pastQuestionMemo} onChange={(event) => setPastQuestionMemo(event.target.value)} rows={7} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-7 text-slate-100 outline-none" placeholder="Paste the memo, marking guide, or model answers here. MABASO will use it as a reference when refreshing the study guide and generating the test." />
              <p className="mt-3 text-xs leading-6 text-slate-300">This memo stays with the current workspace.</p>
            </div>
          </div>
        ) : null}

        {hasRoomVisibility ? <div className="mb-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/10 px-4 py-4 text-sm leading-7 text-emerald-50"><p className="font-semibold">{visibilityLabel}</p><p className="mt-2 text-emerald-100/80">{visibilityDescription}</p>{ownerControls ? <div className="mt-4">{ownerControls}</div> : ownerNotice ? <p className="mt-3 text-emerald-100/80">{ownerNotice}</p> : null}</div> : null}

        <div className="space-y-4">
          {questions.length ? questions.map((item) => {
            const result = results[item.number];
            const maxMarks = getQuestionMarks(item);
            const questionScore = Number(result?.score || 0);
            const scoreRatio = maxMarks ? questionScore / maxMarks : 0;
            const answerTone = !submitted ? "border-white/10 bg-slate-900" : scoreRatio >= 1 ? "border-emerald-400/35 bg-emerald-500/10" : scoreRatio > 0 ? "border-amber-300/30 bg-amber-500/10" : "border-rose-400/35 bg-rose-500/10";
            const resultBadge = !submitted ? "" : scoreRatio >= 1 ? "Full marks" : scoreRatio > 0 ? "Partial credit" : "Needs correction";
            const resultBadgeTone = scoreRatio >= 1 ? "bg-emerald-950 text-emerald-100" : scoreRatio > 0 ? "bg-amber-950 text-amber-100" : "bg-rose-950 text-rose-100";
            const visibleRoomAnswers = (sharedAnswerGroups[item.number] || []).filter((answer) => answer.author_email !== authEmail);
            const typedAnswer = typeof answers[item.number] === "string" ? answers[item.number] : "";
            const selectedOptions = answers[item.number] && typeof answers[item.number] === "object" ? answers[item.number] : {};
            const answerImageFiles = getQuizAnswerImageFiles(quizImages, item.number);

            return (
              <div key={`${scopeId}-${item.number}`} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="phone-safe-copy font-semibold text-white">{item.number}. {item.question}</p>
                  <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-slate-200">{maxMarks} mark{maxMarks === 1 ? "" : "s"}</span>
                </div>
                {isOptionBasedQuestion(item) ? <div className="mt-4 space-y-4">{(item.subparts || []).map((subpart) => {
                  const subpartResult = result?.subpart_results?.find((entry) => entry.label === subpart.label);
                  return <div key={`${scopeId}-${item.number}-${subpart.label}`} className="rounded-2xl border border-white/10 bg-slate-950/75 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><p className="phone-safe-copy text-sm font-semibold text-white">{subpart.label}) {subpart.question}</p><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">{subpart.marks} mark</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{(subpart.options || []).map((option) => {
                    const checked = selectedOptions[subpart.label] === option;
                    return <label key={`${scopeId}-${subpart.label}-${option}`} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${checked ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-white/5 text-slate-200"}`}><input type="radio" name={`${scopeId}-${item.number}-${subpart.label}`} checked={checked} onChange={() => onOptionChange(item, subpart.label, option)} className="h-4 w-4 accent-emerald-400" /><span>{option}</span></label>;
                  })}</div>{submitted && subpartResult ? <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${subpartResult.is_correct ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-50" : "border-rose-300/25 bg-rose-500/10 text-slate-100"}`}><p>{subpartResult.marks_awarded} / {subpartResult.marks}</p><p className="mt-2 leading-7">{subpartResult.feedback}</p></div> : null}</div>;
                })}</div> : <><textarea value={typedAnswer} onChange={(event) => onAnswerChange(item, event.target.value)} rows={4} className={`mt-3 w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 outline-none ${answerTone}`} placeholder="Type your answer here..." /><div className="force-mobile-stack mt-3 flex flex-wrap items-center gap-3"><label className="inline-flex max-w-full cursor-pointer items-center gap-3 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50"><span className="phone-safe-copy">Photos</span><input type="file" accept="image/*" multiple className="hidden" onChange={(event) => { onImageChange(item.number, event.target.files); event.target.value = ""; }} /></label><label className="inline-flex max-w-full cursor-pointer items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"><span className="phone-safe-copy">Camera</span><input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(event) => { onImageChange(item.number, event.target.files); event.target.value = ""; }} /></label>{answerImageFiles.length ? <><span className="phone-safe-copy text-xs text-emerald-100/80">{getQuizAnswerImageLabel(answerImageFiles)}</span><div className="flex flex-wrap gap-2">{answerImageFiles.map((file) => <span key={`${scopeId}-${item.number}-${file.name}-${file.lastModified}`} className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs text-slate-200">{file.name}</span>)}</div></> : null}</div></>}
                {visibilityMode === "shared" && visibleRoomAnswers.length ? <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/75 p-3"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Team answers</p><div className="mt-3 space-y-3 text-sm text-slate-200">{visibleRoomAnswers.map((answer) => <div key={`${scopeId}-${answer.question_number}-${answer.author_email}`} className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="phone-safe-copy font-semibold text-white">{answer.author_email}</p><p className="phone-safe-copy mt-2 whitespace-pre-wrap break-words leading-7">{answer.answer_text}</p></div>)}</div></div> : null}
                {submitted && result ? <div className="mt-4 space-y-3"><div className="rounded-2xl border border-white/10 bg-slate-950/75 p-3"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">{isOptionBasedQuestion(item) ? "Answer Key" : "Suggested Answer"}</p><p className="phone-safe-copy mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">{buildExpectedAnswerText(item)}</p></div><div className={`rounded-2xl border p-3 ${scoreRatio >= 1 ? "border-emerald-300/25 bg-emerald-300/10" : scoreRatio > 0 ? "border-amber-300/25 bg-amber-500/10" : "border-rose-300/25 bg-rose-500/10"}`}><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.24em] text-slate-200">Marked Result</p><span className={`rounded-full px-3 py-1 text-xs font-semibold ${resultBadgeTone}`}>{resultBadge}</span></div><p className="mt-3 text-sm font-semibold text-white">{questionScore} / {Number(result.max_score || maxMarks)}</p>{result.extracted_answer ? <p className="phone-safe-copy mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-100">Detected answer: {result.extracted_answer}</p> : null}<p className="phone-safe-copy mt-2 text-sm leading-7 text-slate-200">{result.feedback}</p>{Array.isArray(result.mistakes) && result.mistakes.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-100">{result.mistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul> : null}</div></div> : null}
              </div>
            );
          }) : <div className="text-sm text-slate-300">{emptyMessage}</div>}
        </div>
      </div>
    );
  };

  const renderQuizGenerationPanel = () => {
    const quizProgressValue = currentJobType === "quiz" ? Math.max(0, Math.min(100, Number(progress || 0))) : 0;
    return (
      <div className="space-y-5">
        <div className="rounded-[26px] border border-emerald-300/15 bg-[linear-gradient(180deg,rgba(34,197,94,0.12),rgba(15,23,42,0.78))] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Optional Test</p>
              <h4 className="mt-2 text-2xl font-semibold text-white">Generate the test only when you need it.</h4>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">Your study guide, formulas, worked examples, and flashcards are already saved. Press the button below only when you want MABASO to spend tokens building a full test.</p>
            </div>
            <button type="button" onClick={generateQuiz} disabled={isGeneratingQuiz || !hasQuizGenerationInputs} className="rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {isGeneratingQuiz ? "Generating Test..." : "Generate Test"}
            </button>
          </div>
          {isGeneratingQuiz ? (
            <div className="mt-5">
              <div className="flex items-center gap-4">
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#4ade80,#22c55e)] transition-all duration-500" style={{ width: `${quizProgressValue}%` }} />
                </div>
                <span className="text-sm font-semibold text-emerald-50">{quizProgressValue}%</span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-200">{status || "Generating the test..."}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-4">
          <div className="force-mobile-stack flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Past Question Paper Reference</p>
              <p className="mt-2 text-sm leading-7 text-slate-200">Use past papers and a memo if you want the next generated test to follow that style more closely.</p>
            </div>
            <div className="force-mobile-stack flex flex-wrap gap-3">
              <button type="button" onClick={() => pastQuestionPaperFileInputRef.current?.click()} disabled={loading} className="rounded-full border border-emerald-300/20 bg-slate-950/75 px-4 py-2 text-sm font-semibold text-emerald-50 disabled:opacity-50">Upload Past Paper</button>
              {(pastQuestionPaperSources.length || pastQuestionMemo.trim()) ? (
                <button type="button" onClick={() => generateStudyGuide()} disabled={loading || !hasStudyInputs} className="rounded-full border border-amber-300/20 bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-50 disabled:opacity-50">
                  {isGeneratingSummary ? "Refreshing..." : "Refresh Study Guide"}
                </button>
              ) : null}
            </div>
          </div>

          {pastQuestionPaperSources.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {pastQuestionPaperSources.map((source) => (
                <div key={source.id} className="relative rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 pr-11 text-sm text-slate-200">
                  <button type="button" onClick={() => removePastQuestionPaperSource(source.id)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white transition hover:bg-white/10" aria-label={`Remove ${source.name}`}>&times;</button>
                  <p className="phone-safe-copy font-semibold text-white">{source.name}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.22em] text-emerald-200/70">{source.prefix || "PAST QUESTION PAPER"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-300">No past question paper added yet.</p>
          )}

          <div className="mt-4">
            <label className="block text-xs uppercase tracking-[0.22em] text-emerald-200/70">Memo / Marking Guide Reference</label>
            <textarea value={pastQuestionMemo} onChange={(event) => setPastQuestionMemo(event.target.value)} rows={7} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-7 text-slate-100 outline-none" placeholder="Paste the memo, marking guide, or model answers here. MABASO will use it as a reference when generating the test." />
            <p className="mt-3 text-xs leading-6 text-slate-300">Refresh the study guide after changing the memo if you want the rest of the workspace to follow the same style too.</p>
          </div>
        </div>
      </div>
    );
  };

  const showCollaborationHistoryPanel = currentPage === "capture" || currentPage === "collaboration";
  const collaborationHistoryPanel = showCollaborationHistoryPanel ? (
    <section className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_20px_70px_rgba(2,8,23,0.28)] backdrop-blur xl:p-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Collaboration History</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Your recent study rooms.</h2>
        </div>
        <div className="force-mobile-stack flex flex-wrap gap-3">
          <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">{collaborationRooms.length} room{collaborationRooms.length === 1 ? "" : "s"}</div>
          <button type="button" onClick={() => refreshCollaborationRooms()} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">Refresh Rooms</button>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">{collaborationRooms.length ? collaborationRooms.map((room) => <article key={room.id} className={`rounded-[24px] border p-5 transition ${activeRoomId === room.id ? "border-emerald-300/35 bg-emerald-300/10" : "border-white/10 bg-white/[0.04]"}`}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">{new Date(room.updated_at).toLocaleString()}</p><h3 className="phone-safe-copy mt-3 text-xl font-semibold text-white">{room.title}</h3><p className="phone-safe-copy mt-2 text-sm text-slate-300">Owner: {room.owner_email}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">{room.member_count} member{room.member_count === 1 ? "" : "s"}</span><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-50">Test mode: {room.test_visibility}</span><span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">Shared tool: {tabs.find((tab) => tab.id === room.active_tab)?.label || "Study Guide"}</span></div></div><div className="force-mobile-stack flex flex-wrap gap-2"><button type="button" onClick={async () => { setCurrentPage("collaboration"); await loadCollaborationRoom(room.id, { resetNotesDraft: true }); }} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">Open Room</button></div></div></article>) : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-slate-300 lg:col-span-2">Collaboration rooms will appear here after the first room is created.</div>}</div>
    </section>
  ) : null;

  const workspaceSnapshotPanel = (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workspace Snapshot</p>
      <div className="mt-4 space-y-3 text-sm text-slate-300">
        <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Lecture file: {workspaceFileLabel}</div>
        <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Lecture notes: {lectureNoteFileNames.length ? lectureNotesFileName || "Added" : "Not added"}</div>
        <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Slide sources: {lectureSlideFileNames.length || 0}</div>
        <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Past papers: {pastQuestionPaperFileNames.length || 0}</div>
        <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Memo reference: {pastQuestionMemo.trim() ? "Added" : "Not added"}</div>
        <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Study photos: {studyImages.length || 0}</div>
        <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Test questions: {quizQuestions.length || 0}</div>
        <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Presentation ready: {presentationData.slides.length ? "Yes" : "Not yet"}</div>
        <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Podcast ready: {podcastData.script ? "Yes" : "Not yet"}</div>
        <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Teacher mode ready: {teacherLessonData.segments.length ? "Yes" : "Not yet"}</div>
        <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Saved workspaces for this email: {historyItems.length}</div>
      </div>
    </div>
  );

  const renderHelpAboutPage = () => (
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_24px_80px_rgba(2,8,23,0.35)] backdrop-blur xl:p-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          {renderBackButton(() => setCurrentPage("capture"), "Back to capture page")}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Help & About</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">How the website works and what students should notice.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">This page explains the full study workflow, the meaning of each source type, what strong output should look like, and how students can use MABASO more like a real revision system instead of a one-click summary tool.</p>
          </div>
        </div>
        <div className="rounded-[24px] border border-emerald-300/20 bg-emerald-300/10 px-4 py-4 text-sm leading-7 text-emerald-50">
          Best results usually come from combining a lecture file, notes, slides, and past papers in the same workspace.
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Accepted Files</p>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Lecture media: audio and video files</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Notes: images, TXT, MD, PDF, DOCX</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Slides: images, TXT, MD, PDF, PPTX, DOCX</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Past papers: images, TXT, MD, PDF, PPTX, DOCX</div>
          </div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Student Workflow</p>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">1. Capture or upload the lecture sources.</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">2. Build the study guide and review the notes, formulas, and worked examples.</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">3. Use flashcards, test, presentation, podcast, and chat for active revision.</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">4. Reopen from history or move into collaboration when the pack is ready.</div>
          </div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Quality Check</p>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">The guide should teach the topic, not only repeat transcript lines.</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">The test should increase in challenge and match the lecture or past-paper style.</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Study photos should appear for concrete concepts that students benefit from seeing.</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">If something important feels thin, the student should compare the guide with the transcript and sources.</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {helpAboutSections.map((section) => (
          <article key={section.title} className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">{section.kicker}</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{section.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{section.description}</p>
            <div className="mt-5 space-y-3">
              {section.points.map((point) => (
                <div key={point} className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-4 text-sm leading-7 text-slate-200">
                  {point}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const renderSupportPage = () => (
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_24px_80px_rgba(2,8,23,0.35)] backdrop-blur xl:p-6">
      <div className="border-b border-white/10 pb-5">
        <div className="flex items-start gap-4">
          {renderBackButton(() => setCurrentPage("capture"), "Back to capture page")}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Support and Contact</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Send a complaint or support message.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Type what went wrong, what device you used, and what you expected to happen. You can return to the capture page with the back arrow when you are done.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5">
          <label className="block text-xs uppercase tracking-[0.24em] text-emerald-200/70">Message</label>
          <textarea
            value={supportMessageDraft}
            onChange={(event) => setSupportMessageDraft(event.target.value)}
            rows={12}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-7 text-slate-100 outline-none"
            placeholder="Write your complaint, bug report, or support request here..."
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={submitSupportMessage} disabled={isSendingSupport} className="rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {isSendingSupport ? "Sending..." : "Send Message"}
            </button>
            <button type="button" onClick={() => setCurrentPage("capture")} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Back to Capture Page
            </button>
          </div>
          {supportFeedback ? <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${/^Support message (sent|saved)/i.test(supportFeedback.trim()) ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50" : "border-rose-300/20 bg-rose-500/10 text-rose-100"}`}>{supportFeedback}</div> : null}
        </div>

        <div className="space-y-5">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">What To Include</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Which page you were using when the problem happened.</div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Your device, browser, or whether you were on iPhone.</div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">What you clicked and what appeared on screen.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const renderCollaborationPage = () => (
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_24px_80px_rgba(2,8,23,0.35)] backdrop-blur xl:p-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          {renderBackButton(() => setCurrentPage("workspace"), "Back to study workspace")}
          <div>
            <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-100">Step 4 of 4</div>
            <p className="mt-4 text-xs uppercase tracking-[0.3em] text-emerald-200/70">Collaboration</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Create or open a shared study room.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Students can move here after the study workspace to share notes, sync a revision tool, and chat inside one lecture room.</p>
          </div>
        </div>
        <div className="force-mobile-stack flex flex-wrap gap-3">
          <button type="button" onClick={() => refreshCollaborationRooms()} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">Refresh Rooms</button>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
        <div className="min-w-0 space-y-5">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Create room</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Invite your study group</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">Create an email-based collaboration room from this lecture. Invited students will see the same room when they sign in with those emails.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Room title</label>
                <input value={roomTitleInput} onChange={(event) => setRoomTitleInput(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none" placeholder={`${extractHistoryTitle(summary, workspaceFileLabel)} group room`} />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Invite by email</label>
                <textarea value={roomInviteInput} onChange={(event) => setRoomInviteInput(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none" placeholder="student1@email.com, student2@email.com" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Test answer visibility</label>
                <p className="mt-2 text-xs leading-6 text-slate-400">This setting affects the room test only. The room owner can change it later.</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setNewRoomVisibility("private")} className={`rounded-2xl border px-4 py-3 text-left text-sm ${newRoomVisibility === "private" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-slate-950/75 text-slate-200"}`}>
                    <p className="font-semibold">Private answers</p>
                    <p className="mt-2 text-xs leading-6 text-slate-300">Members can mark their own test answers, but they cannot see what others submitted.</p>
                  </button>
                  <button type="button" onClick={() => setNewRoomVisibility("shared")} className={`rounded-2xl border px-4 py-3 text-left text-sm ${newRoomVisibility === "shared" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-slate-950/75 text-slate-200"}`}>
                    <p className="font-semibold">Shared answers</p>
                    <p className="mt-2 text-xs leading-6 text-slate-300">Members can compare synced written answers while working on the same room test.</p>
                  </button>
                </div>
              </div>
              <button type="button" onClick={createCollaborationRoom} disabled={isCreatingRoom || (!summary && !transcript && !lectureNotes && !lectureSlides)} className="w-full rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isCreatingRoom ? "Creating room..." : "Create collaboration room"}</button>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <div className="force-mobile-stack flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Available rooms</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Your collaboration list</h3>
              </div>
              <button type="button" onClick={() => refreshCollaborationRooms()} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">Refresh</button>
            </div>
            <div className="mt-4 space-y-3">
              {collaborationRooms.length ? collaborationRooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={async () => {
                    setCurrentPage("collaboration");
                    await loadCollaborationRoom(room.id, { resetNotesDraft: true });
                  }}
                  className={`w-full rounded-2xl border p-4 text-left transition ${activeRoomId === room.id ? "border-emerald-300/35 bg-emerald-300/10" : "border-white/10 bg-slate-950/75 hover:bg-white/10"}`}
                >
                  <p className="phone-safe-copy text-sm font-semibold text-white">{room.title}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{room.member_count} member{room.member_count === 1 ? "" : "s"} • {room.test_visibility}</p>
                  <p className="mt-2 text-xs text-slate-400">Updated {new Date(room.updated_at).toLocaleString()}</p>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm leading-7 text-slate-300">No collaboration rooms yet. Create the first one from the current lecture.</div>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          {activeRoom ? (
            <>
              <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Active room</p>
                    <h3 className="phone-safe-copy mt-2 text-3xl font-semibold text-white">{activeRoom.title}</h3>
                    <p className="phone-safe-copy mt-3 text-sm leading-7 text-slate-300">Shared tool: {roomToolLabel}. Room owner: {activeRoom.owner_email}.</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.24em] text-emerald-200/70">Room test mode: {activeRoom.test_visibility === "shared" ? "Shared answers" : "Private answers"}</p>
                  </div>
                  <div className="force-mobile-stack flex flex-wrap gap-3">
                    <button type="button" onClick={syncCurrentTabToRoom} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50">Share current tool</button>
                    <button type="button" onClick={() => setFollowRoomView((current) => !current)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">{followRoomView ? "Following room view" : "Follow room view"}</button>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(activeRoom.members || []).map((member) => (
                    <span key={member.email} className="phone-safe-copy rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs text-slate-200">{member.email} {member.role === "owner" ? "(owner)" : ""}</span>
                  ))}
                </div>
                <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/70 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Shared revision pack</p>
                      <h4 className="mt-2 text-2xl font-semibold text-white">Guide, formulas, worked examples, flashcards, and test</h4>
                      <p className="mt-3 text-sm leading-7 text-slate-300">Choose a resource below to make it the room's shared revision focus.</p>
                    </div>
                    <div className="force-mobile-stack flex flex-wrap gap-2">
                      {[{ id: "guide", label: "Study Guide" }, { id: "formulas", label: "Formulas" }, { id: "examples", label: "Worked Examples" }, { id: "flashcards", label: "Flashcards" }, { id: "quiz", label: "Test" }].map((tab) => (
                        <button key={tab.id} type="button" onClick={async () => { setFollowRoomView(true); await shareTabToRoom(tab.id); }} className={`rounded-full px-4 py-2 text-sm ${activeRoom.active_tab === tab.id ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>{tab.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4">
                    {activeRoom.active_tab === "guide" ? <div className="notes-markdown phone-safe-copy rounded-2xl border border-white/10 bg-black/30 p-4 prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-strong:text-emerald-100 prose-li:text-slate-200"><ReactMarkdown>{activeRoomFormattedGuide || "No shared study guide selected yet."}</ReactMarkdown></div> : null}
                    {activeRoom.active_tab === "transcript" ? <div className="phone-safe-copy whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm leading-7 text-slate-200">{activeRoom.transcript || "No shared transcript selected yet."}</div> : null}
                    {activeRoom.active_tab === "formulas" ? (activeRoomFormulaRows.length ? <div className="overflow-x-auto rounded-2xl border border-white/10"><div className="min-w-[520px]"><div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] bg-emerald-300/10 text-sm font-semibold text-emerald-50"><div className="border-r border-white/10 px-4 py-3">Expression</div><div className="px-4 py-3">Readable Result</div></div>{activeRoomFormulaRows.map((row, index) => <div key={`${row.expression}-${index}`} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] border-t border-white/10 text-sm"><div className="border-r border-white/10 px-4 py-3 font-semibold text-white">{row.expression}</div><div className="px-4 py-3 font-mono text-slate-200">{row.result}</div></div>)}</div></div> : <div className="phone-safe-copy whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm leading-7 text-slate-200">{activeRoomFormattedFormula || "No shared formulas selected yet."}</div>) : null}
                    {activeRoom.active_tab === "examples" ? <div className="phone-safe-copy whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm leading-7 text-slate-200">{activeRoomFormattedExample || "No shared worked examples selected yet."}</div> : null}
                    {activeRoom.active_tab === "flashcards" ? <div className="grid gap-4 md:grid-cols-2">{(activeRoom.flashcards || []).length ? activeRoom.flashcards.map((card, index) => <div key={`${card.question}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Flashcard {index + 1}</p><p className="phone-safe-copy mt-3 font-semibold text-white">{card.question}</p><p className="phone-safe-copy mt-4 text-sm leading-7 text-slate-300">{card.answer}</p></div>) : <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm leading-7 text-slate-300 md:col-span-2">No shared flashcards selected yet.</div>}</div> : null}
                    {activeRoom.active_tab === "quiz" ? renderQuizSection({
                      questions: activeRoomQuizQuestions,
                      answers: roomQuizAnswers,
                      results: roomQuizResults,
                      quizImages: roomQuizAnswerImages,
                      submitted: roomQuizSubmitted,
                      isMarking: isMarkingRoomQuiz,
                      onMark: markRoomQuiz,
                      onAnswerChange: handleRoomQuizAnswerChange,
                      onOptionChange: handleRoomQuizOptionChange,
                      onImageChange: handleRoomQuizImageChange,
                      sharedAnswerGroups: roomAnswerGroups,
                      visibilityMode: activeRoom.test_visibility,
                      scoreValue: activeRoomQuizQuestions.reduce((total, item) => total + Number(roomQuizResults[item.number]?.score || 0), 0),
                      scopeId: `room-${activeRoom.id}`,
                      ownerControls: activeRoom.is_owner ? <div className="force-mobile-stack flex flex-wrap gap-3"><button type="button" onClick={() => changeRoomTestVisibility("private")} className={`rounded-full px-4 py-2 text-sm ${activeRoom.test_visibility === "private" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>Keep answers private</button><button type="button" onClick={() => changeRoomTestVisibility("shared")} className={`rounded-full px-4 py-2 text-sm ${activeRoom.test_visibility === "shared" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>Share answers in room</button></div> : null,
                      ownerNotice: activeRoom.is_owner ? "" : "Only the room owner can switch between private answers and shared answers for the room test.",
                      emptyMessage: "No room test has been added to this collaboration yet.",
                    }) : null}
                    {!["guide", "transcript", "formulas", "examples", "flashcards", "quiz"].includes(activeRoom.active_tab) ? <div className="phone-safe-copy whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm leading-7 text-slate-200">{buildCollaborationPreview(activeRoom) || "No shared content selected yet."}</div> : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5">
                  <div className="force-mobile-stack flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Shared notes</p>
                      <h4 className="mt-2 text-2xl font-semibold text-white">Everyone sees the same notes board</h4>
                    </div>
                    <button type="button" onClick={saveRoomNotes} disabled={isSavingRoomNotes} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50 disabled:opacity-50">{isSavingRoomNotes ? "Saving..." : "Save shared notes"}</button>
                  </div>
                  <textarea value={roomSharedNotesDraft} onChange={(event) => setRoomSharedNotesDraft(event.target.value)} rows={12} className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100 outline-none" placeholder="Write group notes, exam reminders, common mistakes, or a plan for the test..." />
                </div>

                <div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5">
                  <div className="force-mobile-stack flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Room chat</p>
                      <h4 className="mt-2 text-2xl font-semibold text-white">Live discussion</h4>
                    </div>
                    {isRoomLoading ? <span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">Syncing</span> : null}
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950 p-4">
                    {(activeRoom.messages || []).length ? (
                      <div className="space-y-3">
                        {activeRoom.messages.map((message) => (
                          <div key={message.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <p className="phone-safe-copy text-xs uppercase tracking-[0.2em] text-emerald-200/70">{message.author_email}</p>
                            <p className="phone-safe-copy mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{message.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm leading-7 text-slate-300">Room messages will appear here. Use this to coordinate who is revising which section.</p>
                    )}
                  </div>
                  <div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/80 p-4">
                    <div className="force-mobile-stack flex items-end gap-3">
                      <textarea value={roomMessageDraft} onChange={(event) => setRoomMessageDraft(event.target.value)} onKeyDown={handleRoomChatKeyDown} rows={1} className="min-h-[56px] flex-1 resize-none bg-transparent px-1 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500" placeholder="Type your message..." />
                      <button type="button" onClick={sendRoomMessage} disabled={isSendingRoomMessage} className="flex h-12 w-12 items-center justify-center self-end rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] text-white disabled:opacity-50 sm:self-auto" aria-label="Send room message">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                          <path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
                        </svg>
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">This room chat refreshes automatically.</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm leading-7 text-slate-300">Open a room from the list or create a new one to start shared notes, room chat, and group test settings.</div>
          )}
        </div>
      </div>
    </section>
  );

  const renderPresentationVisualPreview = (slide, { compact = false } = {}) => {
    const visualType = (slide?.visualType || "cluster").toLowerCase();
    const visualItems = (slide?.visualItems || []).filter(Boolean);
    const referenceImageIndex = Number.isFinite(Number(slide?.referenceImageIndex)) ? Number(slide.referenceImageIndex) : -1;
    const referenceImage = referenceImageIndex >= 0 ? (visualReferences[referenceImageIndex]?.image_url || "") : "";
    const shellClassName = activePresentationDesignFamily === "dark"
      ? "border-white/10 bg-slate-950/45 text-white"
      : activePresentationDesignFamily === "light"
        ? "border-slate-200 bg-white/90 text-slate-900"
        : "border-emerald-200/15 bg-emerald-950/35 text-white";
    const cardClassName = activePresentationDesignFamily === "light"
      ? "border-slate-200 bg-slate-50/90 text-slate-700"
      : "border-white/10 bg-white/10 text-slate-100";
    const mutedClassName = activePresentationDesignFamily === "light" ? "text-slate-500" : "text-slate-200/65";
    const barClassName = activePresentationDesignFamily === "light"
      ? "bg-[linear-gradient(180deg,#60a5fa,#2563eb)]"
      : "bg-[linear-gradient(180deg,#93c5fd,#38bdf8)]";

    if (visualType === "photo" && referenceImage) {
      return (
        <div className={`h-full overflow-hidden rounded-[22px] border ${shellClassName}`}>
          <img src={referenceImage} alt={slide?.visualTitle || "Lecture reference"} className="h-full w-full object-cover" loading="lazy" />
        </div>
      );
    }

    if (visualType === "table") {
      return (
        <div className={`h-full rounded-[22px] border p-3 ${shellClassName}`}>
          <div className={`grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] overflow-hidden rounded-2xl border ${cardClassName}`}>
            <div className="border-r border-current/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em]">Point</div>
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em]">Detail</div>
            {(visualItems.length ? visualItems : slide?.bullets || []).slice(0, compact ? 3 : 4).map((item, index) => {
              const [label, ...rest] = String(item).split(":");
              return (
                <div key={`${item}-${index}`} className="contents">
                  <div className="border-r border-t border-current/10 px-3 py-2 text-xs font-semibold">{label.trim()}</div>
                  <div className={`border-t border-current/10 px-3 py-2 text-xs ${mutedClassName}`}>{(rest.join(":").trim() || label.trim())}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (visualType === "chart" || visualType === "graph") {
      const chartItems = (visualItems.length ? visualItems : slide?.bullets || []).slice(0, compact ? 3 : 4);
      return (
        <div className={`h-full rounded-[22px] border p-3 ${shellClassName}`}>
          <div className="flex h-full items-end gap-2">
            {chartItems.map((item, index) => {
              const height = Math.min(92, 34 + item.length * 1.7 + index * 8);
              return (
                <div key={`${item}-${index}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <div className={`w-full rounded-t-2xl ${barClassName}`} style={{ height: `${height}%` }} />
                  <p className={`line-clamp-2 text-center text-[10px] ${mutedClassName}`}>{item}</p>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (visualType === "comparison") {
      const leftItems = visualItems.filter((_, index) => index % 2 === 0).slice(0, 2);
      const rightItems = visualItems.filter((_, index) => index % 2 === 1).slice(0, 2);
      return (
        <div className={`grid h-full grid-cols-2 gap-3 rounded-[22px] border p-3 ${shellClassName}`}>
          <div className={`rounded-2xl border p-3 ${cardClassName}`}>
            {leftItems.map((item, index) => <div key={`${item}-${index}`} className="rounded-xl border border-current/10 px-3 py-2 text-xs">{item}</div>)}
          </div>
          <div className={`rounded-2xl border p-3 ${cardClassName}`}>
            {(rightItems.length ? rightItems : leftItems).map((item, index) => <div key={`${item}-${index}`} className="rounded-xl border border-current/10 px-3 py-2 text-xs">{item}</div>)}
          </div>
        </div>
      );
    }

    if (visualType === "components") {
      const componentItems = (visualItems.length ? visualItems : slide?.bullets || []).slice(0, compact ? 4 : 5);
      const coreLabel = componentItems[0] || "Core unit";
      const outerItems = componentItems.slice(1, compact ? 4 : 5);
      const nodeClassName = activePresentationDesignFamily === "light"
        ? "border-slate-200 bg-slate-50/95 text-slate-700"
        : "border-white/10 bg-white/10 text-slate-100";
      return (
        <div className={`relative h-full rounded-[22px] border p-4 ${shellClassName}`}>
          <div className="absolute left-1/2 top-1/2 h-16 w-28 -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-current/10 bg-current/10" />
          <div className="absolute left-1/2 top-[26%] h-8 w-px -translate-x-1/2 bg-current/20" />
          <div className="absolute left-[28%] top-1/2 h-px w-12 -translate-y-1/2 bg-current/20" />
          <div className="absolute right-[28%] top-1/2 h-px w-12 -translate-y-1/2 bg-current/20" />
          <div className="absolute left-1/2 bottom-[24%] h-8 w-px -translate-x-1/2 bg-current/20" />
          <div className="relative grid h-full grid-cols-3 grid-rows-3 items-center justify-items-center gap-2">
            <span className={`col-start-2 row-start-2 flex min-h-[64px] w-full items-center justify-center rounded-[22px] border px-3 text-center text-xs font-semibold ${nodeClassName}`}>{coreLabel}</span>
            {outerItems[0] ? <span className={`col-start-2 row-start-1 flex min-h-[52px] w-full items-center justify-center rounded-[18px] border px-3 text-center text-[11px] ${nodeClassName}`}>{outerItems[0]}</span> : null}
            {outerItems[1] ? <span className={`col-start-1 row-start-2 flex min-h-[52px] w-full items-center justify-center rounded-[18px] border px-3 text-center text-[11px] ${nodeClassName}`}>{outerItems[1]}</span> : null}
            {outerItems[2] ? <span className={`col-start-3 row-start-2 flex min-h-[52px] w-full items-center justify-center rounded-[18px] border px-3 text-center text-[11px] ${nodeClassName}`}>{outerItems[2]}</span> : null}
            {outerItems[3] ? <span className={`col-start-2 row-start-3 flex min-h-[52px] w-full items-center justify-center rounded-[18px] border px-3 text-center text-[11px] ${nodeClassName}`}>{outerItems[3]}</span> : null}
          </div>
        </div>
      );
    }

    if (visualType === "timeline") {
      return (
        <div className={`h-full rounded-[22px] border p-4 ${shellClassName}`}>
          <div className="relative h-full pl-6">
            <div className="absolute left-2 top-0 h-full w-px bg-current/20" />
            {(visualItems.length ? visualItems : slide?.bullets || []).slice(0, compact ? 3 : 4).map((item, index) => (
              <div key={`${item}-${index}`} className="relative mb-3">
                <span className="absolute -left-[1.1rem] top-1.5 h-2.5 w-2.5 rounded-full bg-current/80" />
                <div className={`rounded-xl border px-3 py-2 text-xs ${cardClassName}`}>{item}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (visualType === "cycle") {
      return (
        <div className={`flex h-full items-center justify-center rounded-[22px] border p-4 ${shellClassName}`}>
          <div className="grid grid-cols-2 gap-3">
            {(visualItems.length ? visualItems : slide?.bullets || []).slice(0, compact ? 3 : 4).map((item, index) => (
              <div key={`${item}-${index}`} className={`flex aspect-square items-center justify-center rounded-full border px-3 text-center text-xs ${cardClassName}`}>{item}</div>
            ))}
          </div>
        </div>
      );
    }

    if (visualType === "formula") {
      return (
        <div className={`space-y-2 rounded-[22px] border p-3 ${shellClassName}`}>
          {(visualItems.length ? visualItems : slide?.bullets || []).slice(0, compact ? 3 : 4).map((item, index) => (
            <div key={`${item}-${index}`} className={`rounded-2xl border px-3 py-3 font-mono text-xs ${cardClassName}`}>{item}</div>
          ))}
        </div>
      );
    }

    if (visualType === "flow") {
      return (
        <div className={`space-y-2 rounded-[22px] border p-3 ${shellClassName}`}>
          {(visualItems.length ? visualItems : slide?.bullets || []).slice(0, compact ? 3 : 4).map((item, index) => (
            <div key={`${item}-${index}`} className="flex items-center gap-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${cardClassName}`}>{index + 1}</span>
              <div className={`min-w-0 flex-1 rounded-2xl border px-3 py-2 text-xs ${cardClassName}`}>{item}</div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={`relative h-full rounded-[22px] border p-4 ${shellClassName}`}>
        <div className="absolute left-1/2 top-[46%] h-16 w-28 -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-current/10 bg-current/10" />
        <div className="relative flex h-full flex-wrap items-center justify-center gap-2">
          {(visualItems.length ? visualItems : slide?.bullets || []).slice(0, compact ? 3 : 4).map((item, index) => (
            <span key={`${item}-${index}`} className={`rounded-full border px-3 py-2 text-[11px] ${cardClassName}`}>{item}</span>
          ))}
        </div>
      </div>
    );
  };

  const renderPresentationSlideCanvas = (slide, index, { thumbnail = false } = {}) => {
    const frameClassName = activePresentationDesignFamily === "dark"
      ? "border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.16),transparent_34%),linear-gradient(135deg,rgba(9,16,32,0.98),rgba(15,23,42,0.98),rgba(30,41,59,0.96))] text-white"
      : activePresentationDesignFamily === "light"
        ? "border-slate-200 bg-[radial-gradient(circle_at_top_right,rgba(191,219,254,0.45),transparent_30%),linear-gradient(135deg,#ffffff,#f8fafc_56%,#eff6ff)] text-slate-900"
        : "border-emerald-300/12 bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.16),transparent_30%),linear-gradient(135deg,#061912,#0f2b20_52%,#15392a)] text-white";
    const mutedClassName = activePresentationDesignFamily === "light" ? "text-slate-600" : "text-slate-200/72";
    const chipClassName = activePresentationDesignFamily === "light"
      ? "border-slate-200 bg-white/85 text-slate-700"
      : "border-white/10 bg-white/10 text-slate-100";
    const bulletCardClassName = activePresentationDesignFamily === "light"
      ? "border-slate-200/90 bg-white/90 text-slate-700"
      : "border-white/10 bg-slate-950/35 text-slate-100";
    const visualType = (slide?.visualType || "cluster").toLowerCase();

    if (visualType === "title") {
      return (
        <div className={`relative w-full overflow-hidden rounded-[28px] border ${thumbnail ? "p-3" : "min-h-[620px] p-6"} ${frameClassName}`}>
          <div className="absolute inset-0 opacity-80">
            <div className="absolute left-0 top-0 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-40 w-72 rounded-full bg-current/10 blur-3xl" />
          </div>
          <div className={`relative flex h-full flex-col justify-center ${thumbnail ? "gap-2 py-6" : "gap-4 py-14"}`}>
            <h5 className={`${thumbnail ? "text-xl" : "text-[3.2rem]"} font-semibold leading-tight`}>{slide?.title || "Lecture Presentation"}</h5>
            {slide?.bullets?.[0] ? <p className={`max-w-3xl ${thumbnail ? "text-[10px] leading-5" : "text-base leading-7"} ${mutedClassName}`}>{slide.bullets[0]}</p> : null}
          </div>
        </div>
      );
    }

    if (visualType === "closing") {
      return (
        <div className={`relative w-full overflow-hidden rounded-[28px] border ${thumbnail ? "p-3" : "min-h-[620px] p-6"} ${frameClassName}`}>
          <div className="absolute inset-0 opacity-80">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-current/10 blur-3xl" />
          </div>
          <div className="relative flex h-full items-center justify-center text-center">
            <h5 className={`${thumbnail ? "text-xl" : "text-[3.4rem]"} font-semibold leading-none`}>{slide?.title || "THANK YOU"}</h5>
          </div>
        </div>
      );
    }

    return (
      <div className={`relative w-full overflow-hidden rounded-[28px] border ${thumbnail ? "p-3" : "min-h-[620px] p-6"} ${frameClassName}`}>
        <div className="absolute inset-0 opacity-80">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-28 w-56 rounded-[999px] bg-current/5" />
        </div>
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${chipClassName}`}>Slide {index + 1}</span>
            {!thumbnail ? <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${chipClassName}`}>{getPresentationVisualTypeLabel(slide?.visualType)}</span> : null}
          </div>
          <div className={`${thumbnail ? "mt-3 space-y-3" : "mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_280px]"}`}>
            <div className="min-w-0">
              <h5 className={`${thumbnail ? "text-sm" : "text-[1.95rem]"} font-semibold leading-tight`}>{slide?.title || "Untitled slide"}</h5>
              {!thumbnail ? <p className={`mt-3 text-sm leading-6 ${mutedClassName}`}>{slide?.visualTitle || "Visual explanation for the lecture point on this slide."}</p> : null}
              <div className={`${thumbnail ? "mt-3 space-y-2" : "mt-5 space-y-3"}`}>
                {(slide?.bullets || []).slice(0, thumbnail ? 2 : 5).map((bullet, bulletIndex) => (
                  <div key={`${slide?.title}-${bulletIndex}`} className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${bulletCardClassName}`}>
                    {bullet}
                  </div>
                ))}
              </div>
            </div>
            <div className={`${thumbnail ? "hidden" : "block"} h-[250px]`}>
              {renderPresentationVisualPreview(slide)}
            </div>
          </div>
          {!thumbnail ? (
            <div className="mt-5 flex items-end justify-between gap-4">
              <p className={`max-w-2xl text-sm leading-6 ${mutedClassName}`}>{slide?.flowNote || "This slide keeps the lesson moving in a clear teaching order."}</p>
              <span className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${mutedClassName}`}>mabaso</span>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className={`line-clamp-2 text-[10px] leading-5 ${mutedClassName}`}>{slide?.flowNote || slide?.visualTitle || "Lecture flow note"}</p>
              <span className={`text-[9px] font-semibold uppercase tracking-[0.24em] ${mutedClassName}`}>mabaso</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* Legacy presentation panel kept temporarily for reference during the refactor.
  const renderPresentationPanelLegacy = () => (
    <div className="space-y-5">
      <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,23,42,0.92))] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] text-sky-100/75">AI Presentation Maker</p>
            <h4 className="mt-2 text-3xl font-semibold text-white">Build lecture slides with real structure, visuals, and flow.</h4>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">Choose a template first. Then click generate below and let MABASO turn your lecture guide, notes, slides, and past papers into a cleaner classroom deck with extracted visuals from your uploaded slide files.</p>
          </div>
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/70 p-5">
          <div className="grid gap-5 xl:grid-cols-[140px_minmax(0,1fr)]">
            <div className="flex items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,#fff7ed,#fed7aa)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-[linear-gradient(135deg,#fb923c,#fdba74)] text-4xl font-black text-white shadow-[0_18px_40px_rgba(251,146,60,0.35)]">P</div>
            </div>
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-white">{isPresentationJobActive ? "It takes about 1 minute to generate, please wait patiently..." : "Slides are ready to view and explain."}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{presentationStageLine}</p>
                </div>
                <button type="button" onClick={focusPresentationViewer} disabled={!presentationData.slides.length} className="rounded-2xl border border-sky-300/30 bg-white px-4 py-3 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50">View now</button>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#60a5fa,#2563eb)] transition-all duration-500" style={{ width: `${presentationProgressValue}%` }} />
                </div>
                <span className="text-sm font-semibold text-slate-200">{presentationProgressValue}%</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{activePresentationDesign.name}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{visualReferences.length} visual reference{visualReferences.length === 1 ? "" : "s"}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{presentationData.slides.length || 0} slide{presentationData.slides.length === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Template Gallery</p>
              <h5 className="mt-2 text-2xl font-semibold text-white">Start by choosing a template.</h5>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-300">Tables, graphs, photos, and comparison panels are now chosen automatically when the lecture content needs them. Uploaded slide or note images are used first when a photo panel fits the topic.</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {presentationDesigns.map((design) => {
              const isSelected = selectedPresentationDesign === design.id;
              return (
                <button
                  key={design.id}
                  type="button"
                  onClick={() => setSelectedPresentationDesign(design.id)}
                  className={`rounded-[26px] border p-4 text-left transition ${isSelected ? "border-sky-300/45 bg-sky-300/10 shadow-[0_16px_45px_rgba(14,165,233,0.14)]" : "border-white/10 bg-slate-950/70 hover:border-white/20 hover:bg-white/10"}`}
                >
                  <div className={`relative h-32 overflow-hidden rounded-[22px] border border-white/10 ${design.previewClassName} ${design.previewDecorationClassName}`}>
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.06))]" />
                    <div className="relative flex h-full flex-col justify-between p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${design.chipClassName}`}>{design.accent}</span>
                        {isSelected ? <span className="rounded-full border border-white/15 bg-white/30 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white">Selected</span> : null}
                      </div>
                      <div>
                        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${design.previewTitleClassName}`}>Presentation</p>
                        <p className={`mt-1 text-xl font-semibold ${design.previewTitleClassName}`}>Title</p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-white">{design.name}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{design.description}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-sky-300/15 bg-sky-300/10 px-4 py-4">
            <p className="text-sm leading-7 text-sky-50">Template selected: <span className="font-semibold text-white">{activePresentationDesign.name}</span>. Generate below, then review the deck view as soon as the progress reaches 100%.</p>
            <div className="force-mobile-stack flex flex-wrap gap-3">
              <button type="button" onClick={generatePresentation} disabled={loading || !hasStudyInputs} className="rounded-full bg-[linear-gradient(135deg,#2563eb,#0ea5e9)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isGeneratingPresentation ? "Generating Slides..." : "Generate Presentation"}</button>
              <button type="button" onClick={downloadPresentationFile} disabled={!presentationData.jobId} className="rounded-full border border-sky-300/20 bg-sky-300/10 px-5 py-3 text-sm font-semibold text-sky-50 disabled:opacity-50">Download PowerPoint</button>
            </div>
          </div>
        </div>
      </div>

      {presentationData.slides.length ? (
        <>
          <div ref={presentationViewerRef} className="rounded-[30px] border border-white/10 bg-slate-950/75 p-5 shadow-[0_20px_55px_rgba(2,8,23,0.35)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-sky-100/80">Current Deck</p>
                <h4 className="phone-safe-copy mt-2 text-2xl font-semibold text-white">{presentationData.title || "Lecture presentation"}</h4>
                <p className="phone-safe-copy mt-3 text-sm leading-7 text-slate-300">{presentationData.subtitle || "A concise lecture deck is ready for download."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200">{presentationData.slides.length} slides</div>
                <div className="rounded-full border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200">{activePresentationDesign.name}</div>
                <div className="rounded-full border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200">{outputLanguage}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-3">
                <div className="space-y-3">
                  {presentationData.slides.map((slide, index) => (
                    <button
                      key={`${slide.title}-${index}`}
                      type="button"
                      onClick={() => setSelectedPresentationSlideIndex(index)}
                      className={`w-full rounded-[24px] border p-2 text-left transition ${selectedPresentationSlideIndex === index ? "border-sky-300/40 bg-sky-300/10" : "border-white/10 bg-white/[0.03] hover:bg-white/10"}`}
                    >
                      {renderPresentationSlideCanvas(slide, index, { thumbnail: true })}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-center text-xs uppercase tracking-[0.22em] text-slate-400">Slide {selectedPresentationSlideIndex + 1}/{presentationData.slides.length}</p>
              </div>

              <div className="min-w-0">
                {activePresentationSlide ? renderPresentationSlideCanvas(activePresentationSlide, selectedPresentationSlideIndex) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(15,23,42,0.88))] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Slide Flow</p>
                <h4 className="mt-2 text-2xl font-semibold text-white">Clean summary of how the presentation moves from one idea to the next.</h4>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-slate-300">Each section below keeps the flow note short and adds a few clean bullet points so the user can quickly understand the presentation sequence before explaining or downloading it.</p>
            </div>
            <div className="mt-5 space-y-3">
              {presentationData.slides.map((slide, index) => (
                <button
                  key={`${slide.title}-flow-${index}`}
                  type="button"
                  onClick={() => setSelectedPresentationSlideIndex(index)}
                  className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${selectedPresentationSlideIndex === index ? "border-sky-300/35 bg-sky-300/10" : "border-white/10 bg-white/[0.03] hover:bg-white/10"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">Section {index + 1}</span>
                        <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">{getPresentationVisualTypeLabel(slide.visualType)}</span>
                      </div>
                      <p className="mt-3 text-lg font-semibold text-white">{slide.title || `Slide ${index + 1}`}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{slide.flowNote || slide.visualTitle || "This slide supports the lecture flow."}</p>
                      {summarizePresentationSlidePoints(slide).length ? (
                        <ul className="mt-3 space-y-2 text-sm text-slate-200">
                          {summarizePresentationSlidePoints(slide).map((point) => (
                            <li key={`${slide.title || index}-${point}`} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-300" />
                              <span className="min-w-0">{point}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">{(slide.bullets || []).length} points</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm leading-7 text-slate-300">Choose a template above, then generate the presentation. Once the deck is ready, you will see the slide progress, a “View now” action, the slide thumbnails, and a full flow explanation underneath.</div>
      )}
    </div>
  );

  */

  const renderPresentationPanel = () => {
    const showSetupView = presentationView === "setup";
    const showStatusView = presentationView === "status";
    const showViewerView = presentationView === "viewer" && presentationData.slides.length;

    return (
      <div className="space-y-5">
        <input
          ref={presentationTemplateInputRef}
          type="file"
          accept={PRESENTATION_TEMPLATE_ACCEPT}
          className="hidden"
          onChange={(event) => handlePresentationTemplateFileChange(event.target.files)}
        />
        {showSetupView ? (
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,23,42,0.92))] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.35)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.28em] text-sky-100/75">AI Presentation Maker</p>
                <h4 className="mt-2 text-3xl font-semibold text-white">Build lecture slides with real structure, useful visuals, and stronger teaching flow.</h4>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">Choose a template first. After you generate, the template page disappears and the presentation moves to its own progress page. Uploaded slide and note images are matched first when they truly fit the slide topic.</p>
              </div>
              {presentationData.slides.length ? <button type="button" onClick={focusPresentationViewer} className="rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-sm font-semibold text-sky-50">Open current deck</button> : null}
            </div>

            <div className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Template Gallery</p>
                  <h5 className="mt-2 text-2xl font-semibold text-white">Pick the deck style before you generate.</h5>
                </div>
                <p className="max-w-2xl text-sm leading-7 text-slate-300">The generated slides now aim for clearer classroom quality: stronger headings, better supporting points, and cleaner visual panels instead of loose extraction.</p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {presentationDesigns.map((design) => {
                  const isSelected = selectedPresentationDesign === design.id;
                  return (
                    <button
                      key={design.id}
                      type="button"
                      onClick={() => setSelectedPresentationDesign(design.id)}
                      className={`rounded-[26px] border p-4 text-left transition ${isSelected ? "border-sky-300/45 bg-sky-300/10 shadow-[0_16px_45px_rgba(14,165,233,0.14)]" : "border-white/10 bg-slate-950/70 hover:border-white/20 hover:bg-white/10"}`}
                    >
                      <div className={`relative h-32 overflow-hidden rounded-[22px] border border-white/10 ${design.previewClassName} ${design.previewDecorationClassName}`}>
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.06))]" />
                        <div className="relative flex h-full flex-col justify-between p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${design.chipClassName}`}>{design.accent}</span>
                            {isSelected ? <span className="rounded-full border border-white/15 bg-white/30 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white">Selected</span> : null}
                          </div>
                          <div>
                            <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${design.previewTitleClassName}`}>Presentation</p>
                            <p className={`mt-1 text-xl font-semibold ${design.previewTitleClassName}`}>Title</p>
                          </div>
                        </div>
                      </div>
                      <p className="mt-4 text-sm font-semibold text-white">{design.name}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{design.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/70 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Custom Template</p>
                    <h6 className="mt-2 text-xl font-semibold text-white">Upload your own PowerPoint template.</h6>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">MABASO will reuse your template design and rebuild the deck with the same generated slide order shown on the website.</p>
                    {selectedPresentationTemplateName ? <p className="mt-3 text-sm font-semibold text-sky-100">{selectedPresentationTemplateName}</p> : null}
                    {!selectedPresentationTemplateName && generatedPresentationTemplateName ? <p className="mt-3 text-sm text-slate-300">The current deck was generated with <span className="font-semibold text-white">{generatedPresentationTemplateName}</span>. Re-upload it if you want to use the same template design again.</p> : null}
                  </div>
                  <div className="force-mobile-stack flex flex-wrap gap-3">
                    <button type="button" onClick={() => presentationTemplateInputRef.current?.click()} disabled={loading} className="rounded-full border border-sky-300/30 bg-sky-300/10 px-5 py-3 text-sm font-semibold text-sky-50 disabled:opacity-50">{selectedPresentationTemplateName ? "Replace Template" : "Upload Template"}</button>
                    {selectedPresentationTemplateName ? <button type="button" onClick={clearPresentationTemplateSelection} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">Clear</button> : null}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-sky-300/15 bg-sky-300/10 px-4 py-4">
                <p className="text-sm leading-7 text-sky-50">{selectedPresentationTemplateName ? <>Preview style: <span className="font-semibold text-white">{activePresentationDesign.name}</span>. The download will use <span className="font-semibold text-white">{selectedPresentationTemplateName}</span> while matching the generated slide order shown here.</> : <>Template selected: <span className="font-semibold text-white">{activePresentationDesign.name}</span>. Press generate to move to the presentation progress page.</>}</p>
                <button type="button" onClick={generatePresentation} disabled={loading || !hasStudyInputs} className="rounded-full bg-[linear-gradient(135deg,#2563eb,#0ea5e9)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isGeneratingPresentation ? "Generating Slides..." : "Generate Presentation"}</button>
              </div>
            </div>
          </div>
        ) : null}

        {showStatusView ? (
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,23,42,0.92))] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.35)]">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5">
              <div className="grid gap-5 lg:grid-cols-[140px_minmax(0,1fr)]">
                <div className="flex items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,#fff7ed,#fed7aa)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-[linear-gradient(135deg,#fb923c,#fdba74)] text-4xl font-black text-white shadow-[0_18px_40px_rgba(251,146,60,0.35)]">P</div>
                </div>
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-white">{isPresentationJobActive ? "Presentation is being generated." : "Presentation is ready to view and explain."}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{presentationStageLine}</p>
                    </div>
                    <div className="force-mobile-stack flex flex-wrap gap-3">
                      <button type="button" onClick={() => setPresentationView("setup")} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">Templates</button>
                      <button type="button" onClick={focusPresentationViewer} disabled={!canOpenPresentationViewer} className="rounded-2xl border border-sky-300/30 bg-white px-4 py-3 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50">View now</button>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-4">
                    <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#60a5fa,#2563eb)] transition-all duration-500" style={{ width: `${presentationProgressValue}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-200">{presentationProgressValue}%</span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{activePresentationDesign.name}</span>
                    {generatedPresentationTemplateName ? <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs text-sky-50">Template: {generatedPresentationTemplateName}</span> : null}
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{visualReferences.length} lecture visual reference{visualReferences.length === 1 ? "" : "s"}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{presentationViewerSlides.length || 0} slide{presentationViewerSlides.length === 1 ? "" : "s"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showViewerView ? (
          <div ref={presentationViewerRef} className="space-y-5">
            <div className="rounded-[30px] border border-white/10 bg-slate-950/75 p-5 shadow-[0_20px_55px_rgba(2,8,23,0.35)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-100/80">Presentation Viewer</p>
                  <h4 className="phone-safe-copy mt-2 text-2xl font-semibold text-white">{presentationData.title || "Lecture presentation"}</h4>
                  <p className="phone-safe-copy mt-3 text-sm leading-7 text-slate-300">{presentationData.subtitle || "A concise lecture deck is ready for download."}</p>
                  {generatedPresentationTemplateName ? <p className="mt-3 text-xs uppercase tracking-[0.22em] text-sky-100/80">Download uses template: {generatedPresentationTemplateName}</p> : null}
                </div>
                <div className="force-mobile-stack flex flex-wrap gap-3">
                  <div className="flex flex-col items-start gap-2">
                    <button type="button" onClick={downloadPresentationFile} disabled={!presentationData.jobId} className="rounded-full bg-[linear-gradient(135deg,#2563eb,#0ea5e9)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Download PowerPoint</button>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/80">RECOMMENDED: download for better view</p>
                  </div>
                  <button type="button" onClick={() => setPresentationView("status")} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">Back to status</button>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[190px_minmax(0,1fr)] lg:items-start">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-3 lg:max-h-[760px] lg:overflow-y-auto">
                <div className="space-y-3">
                  {presentationViewerSlides.map((slide, index) => (
                    <button
                      key={`${slide.title}-${index}`}
                      type="button"
                      onClick={() => setSelectedPresentationSlideIndex(index)}
                      className={`w-full rounded-[24px] border p-1.5 text-left transition ${selectedPresentationSlideIndex === index ? "border-sky-300/40 bg-sky-300/10" : "border-white/10 bg-white/[0.03] hover:bg-white/10"}`}
                    >
                      {renderPresentationSlideCanvas(slide, index, { thumbnail: true })}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-center text-xs uppercase tracking-[0.22em] text-slate-400">Slide {selectedPresentationSlideIndex + 1}/{presentationViewerSlides.length}</p>
              </div>

              <div className="min-w-0">
                {activePresentationSlide ? renderPresentationSlideCanvas(activePresentationSlide, selectedPresentationSlideIndex) : null}
              </div>
            </div>
          </div>
        ) : null}

        {!showSetupView && !showStatusView && !showViewerView ? <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm leading-7 text-slate-300">Choose a template first, generate the presentation, then open the viewer when the counter reaches 100%.</div> : null}
      </div>
    );
  };

  const renderPodcastPanel = () => (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-amber-300/15 bg-[linear-gradient(180deg,rgba(120,53,15,0.28),rgba(12,10,9,0.92))] p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-100/80">Podcast Generator</p>
            <h4 className="mt-2 text-3xl font-semibold text-white">Turn the topic into a spoken debate.</h4>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">Full podcast audio, exam-focused turns, and named voices.</p>
          </div>
          <div className="force-mobile-stack flex flex-wrap gap-3">
            <button type="button" onClick={generatePodcast} disabled={loading || !hasStudyInputs} className="rounded-full bg-[linear-gradient(135deg,#f59e0b,#f97316)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isGeneratingPodcast ? "Generating Podcast..." : "Generate Podcast"}</button>
            <button type="button" onClick={downloadPodcastAudio} disabled={!podcastData.jobId} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-5 py-3 text-sm font-semibold text-amber-50 disabled:opacity-50">Download Audio</button>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Speakers</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[2, 3].map((count) => (
                <button key={count} type="button" onClick={() => setPodcastSpeakerCount(count)} className={`rounded-2xl border px-4 py-3 text-left text-sm ${podcastSpeakerCount === count ? "border-amber-300/35 bg-amber-300/10 text-amber-50" : "border-white/10 bg-slate-950/75 text-slate-200"}`}>
                  <p className="font-semibold">{count} voices</p>
                  <p className="mt-2 text-xs leading-6 text-slate-300">{count === 2 ? "Njabulo and Olwethu." : "Njabulo, Olwethu, and Melusi."}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.22em] text-slate-400">Target Length</label>
            <select value={podcastTargetMinutes} onChange={(event) => setPodcastTargetMinutes(Number(event.target.value) || 10)} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none">
              {[8, 10, 12, 14, 16].map((minutes) => <option key={minutes} value={minutes}>{minutes} minute podcast</option>)}
            </select>
            <p className="mt-3 text-xs leading-6 text-slate-300">The generator now pushes much closer to the length you choose.</p>
          </div>
        </div>
      </div>

      {podcastData.script ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-100/80">Current Podcast</p>
                  <h4 className="phone-safe-copy mt-2 text-2xl font-semibold text-white">{podcastData.title || "Lecture Debate Podcast"}</h4>
                  <p className="phone-safe-copy mt-3 text-sm leading-7 text-slate-300">{podcastData.overview || "The overview will appear here once the podcast is ready."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="rounded-full border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200">About {podcastEstimatedMinutes} min</div>
                  <div className="rounded-full border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200">{podcastData.speakerCount || podcastSpeakerCount} voices</div>
                  <div className="rounded-full border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200">{podcastData.segments.length} debate turns</div>
                </div>
              </div>
              {podcastAudioUrl ? (
                <div className="mt-5 rounded-[24px] border border-amber-300/15 bg-amber-300/10 p-4">
                  <div className="force-mobile-stack flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.22em] text-amber-100/80">Now Playing</p>
                      <h5 className="mt-2 text-xl font-semibold text-white">{activePodcastSegment?.speaker_name || "Full podcast"}</h5>
                      <p className="mt-2 text-sm leading-7 text-slate-200">{activePodcastSegment?.speaker_role || "Continuous playback"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => seekPodcastSeconds(-15)} disabled={!activePodcastSegment?.objectUrl} className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-white disabled:opacity-50" aria-label="Rewind 15 seconds">⏮</button>
                      <button type="button" onClick={() => { setIsPodcastAutoPlaying(true); podcastAudioRef.current?.play().catch(() => setIsPodcastAutoPlaying(false)); }} disabled={!activePodcastSegment?.objectUrl} className="rounded-full bg-[linear-gradient(135deg,#f59e0b,#f97316)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" aria-label="Play debate">▶️</button>
                      <button type="button" onClick={() => { setIsPodcastAutoPlaying(false); podcastAudioRef.current?.pause(); }} disabled={!activePodcastSegment?.objectUrl} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50" aria-label="Pause debate">⏸</button>
                      <button type="button" onClick={() => seekPodcastSeconds(15)} disabled={!activePodcastSegment?.objectUrl} className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-white disabled:opacity-50" aria-label="Fast forward 15 seconds">⏭</button>
                    </div>
                  </div>
                  <audio ref={podcastAudioRef} controls className="mt-4 w-full" src={activePodcastSegment?.objectUrl || podcastAudioUrl} onTimeUpdate={handlePodcastTimeUpdate} onPlay={() => setIsPodcastAutoPlaying(true)} onPause={() => setIsPodcastAutoPlaying(false)} onEnded={() => setIsPodcastAutoPlaying(false)} />
                  <p className="mt-3 text-xs text-slate-300">Full audio playback. Turn {activePodcastSegmentIndex + 1} of {podcastAudioSegments.length} is currently in focus.</p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-7 text-slate-300">The script is ready, but the full audio is not attached right now. Generate the podcast again to rebuild it.</div>
              )}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Turn List</p>
              <div className="mt-4 space-y-3">
                {podcastData.segments.length ? podcastData.segments.map((segment, index) => <button key={`${segment.speaker_key}-${index}`} type="button" onClick={() => jumpToPodcastTurn(index)} className={`w-full rounded-2xl border px-4 py-4 text-left transition ${activePodcastSegmentIndex === index ? "border-amber-300/35 bg-amber-300/10" : "border-white/10 bg-white/[0.04] hover:bg-white/10"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-white">{segment.speaker_name}</p><p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{segment.speaker_role}</p></div><span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">Turn {index + 1}</span></div><p className="phone-safe-copy mt-3 text-sm leading-7 text-slate-300">{segment.text}</p></button>) : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-7 text-slate-300">Podcast turns will appear here after generation.</div>}
              </div>
            </div>
          </div>

          <div className="notes-markdown phone-safe-copy rounded-[24px] border border-white/10 bg-black/60 p-5 prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-strong:text-amber-100 prose-li:text-slate-200">
            <ReactMarkdown>{podcastData.script}</ReactMarkdown>
          </div>
        </>
      ) : (
        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm leading-7 text-slate-300">Generate the podcast after loading your lecture material. The result includes one full audio track and a downloadable MP3.</div>
      )}
    </div>
  );

  const renderAdminPage = () => {
    const sidebarItems = [
      { id: "overview", label: "Dashboard", group: "Overview" },
      { id: "users", label: "Users", group: "Users" },
      { id: "activity", label: "Activity Log", group: "Users" },
      { id: "content", label: "Content Library", group: "Content & Tools" },
      { id: "ai", label: "AI Generation", group: "Content & Tools" },
      { id: "analytics", label: "Analytics", group: "Analytics" },
      { id: "health", label: "System Health", group: "System" },
      { id: "security", label: "Security", group: "System" },
      { id: "billing", label: "Billing", group: "System" },
      { id: "settings", label: "Settings", group: "System" },
    ];
    const sectionCardClass = "rounded-[32px] border border-slate-200/90 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]";
    const dashboard = adminDashboard || {};
    const overview = dashboard.overview || {};
    const overviewKpis = overview.kpis || {};
    const overviewCharts = overview.charts || {};
    const analytics = dashboard.analytics || {};
    const aiGeneration = dashboard.ai_generation || {};
    const content = dashboard.content || {};
    const systemHealth = dashboard.system_health || {};
    const security = dashboard.security || {};
    const users = dashboard.users || [];
    const activityLogs = dashboard.activity_logs || [];
    const failedJobs = aiGeneration.failed_jobs || [];
    const failedLoginCount = (security.failed_logins || []).length;
    const normalizedSearchQuery = adminSearchQuery.toLowerCase();
    const filteredUsers = users.filter((user) => `${user.email} ${user.role} ${user.status}`.toLowerCase().includes(normalizedSearchQuery));
    const filteredLogs = activityLogs.filter((log) => `${log.user} ${log.action} ${log.resource}`.toLowerCase().includes(normalizedSearchQuery));
    const filteredContent = (content.items || []).filter((item) => `${item.file_name} ${item.owner_email} ${item.title}`.toLowerCase().includes(normalizedSearchQuery));
    const dailyActivitySeries = (overviewCharts.daily_active_users || []).map((item) => ({
      label: formatAdminDate(item.date),
      value: item.active_users,
    }));
    const realTimeSeries = (overviewCharts.real_time_activity || []).map((item) => ({
      label: item.label,
      value: item.count,
    }));
    const featureUsageItems = (overviewCharts.feature_usage_breakdown || analytics.most_used_tools || [])
      .slice(0, 5)
      .map((item, index) => ({
        label: item.label,
        value: item.count,
        color: ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length],
      }));
    const outputMixItems = [
      { label: "Study Guides", value: aiGeneration.totals?.study_guides ?? 0, color: ADMIN_CHART_COLORS[0] },
      { label: "Presentations", value: aiGeneration.totals?.presentations ?? 0, color: ADMIN_CHART_COLORS[1] },
      { label: "Podcasts", value: aiGeneration.totals?.podcasts ?? 0, color: ADMIN_CHART_COLORS[2] },
      { label: "Tests", value: overviewKpis.tests_generated ?? 0, color: ADMIN_CHART_COLORS[3] },
    ].filter((item) => item.value > 0);
    const conversionFunnelItems = (overviewCharts.conversion_funnel || []).map((item, index) => ({
      label: item.label,
      value: item.count,
      color: ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length],
    }));
    const topUsers = [...users]
      .sort((left, right) => ((right.total_generations || 0) + (right.total_uploads || 0) + (right.sessions_count || 0)) - ((left.total_generations || 0) + (left.total_uploads || 0) + (left.sessions_count || 0)))
      .slice(0, 5);
    const recentActivityPreview = activityLogs.slice(0, 6);
    const storageLeaders = content.storage_insights?.top_users || [];
    const sessionHeatmapPreview = (analytics.session_heatmap || []).slice(0, 24);
    const maxSessionHeat = Math.max(...sessionHeatmapPreview.map((item) => toFiniteNumber(item.actions)), 1);
    const retentionItems = [
      { label: "Day 1", value: analytics.retention?.day_1 ?? 0 },
      { label: "Day 7", value: analytics.retention?.day_7 ?? 0 },
      { label: "Day 30", value: analytics.retention?.day_30 ?? 0 },
    ];
    const lastWeekTimestamp = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = users.filter((user) => {
      const createdAt = new Date(user.created_at).getTime();
      return Number.isFinite(createdAt) && createdAt >= lastWeekTimestamp;
    }).length;
    const activeSidebarItem = sidebarItems.find((item) => item.id === adminSidebarTab) || sidebarItems[0];
    const groupedSidebarItems = sidebarItems.reduce((groups, item) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
      return groups;
    }, {});
    const overviewCards = [
      {
        label: "Total Users",
        value: formatAdminInteger(overviewKpis.total_users ?? 0),
        detail: `${formatAdminInteger(newUsersThisWeek)} new this week`,
        icon: "U",
        accentClass: "bg-blue-50 text-blue-700",
      },
      {
        label: "Active Users (7D)",
        value: formatAdminInteger(overviewKpis.active_users_7d ?? 0),
        detail: `${formatAdminInteger(overviewKpis.active_users_24h ?? 0)} active in 24h`,
        icon: "A",
        accentClass: "bg-emerald-50 text-emerald-700",
      },
      {
        label: "Lectures Uploaded",
        value: formatAdminInteger(overviewKpis.lectures_uploaded_week ?? 0),
        detail: `${formatAdminInteger(overviewKpis.lectures_uploaded_today ?? 0)} uploads today`,
        icon: "L",
        accentClass: "bg-violet-50 text-violet-700",
      },
      {
        label: "Study Guides",
        value: formatAdminInteger(overviewKpis.study_guides_generated ?? 0),
        detail: `${formatAdminInteger(overviewKpis.tests_generated ?? 0)} tests generated`,
        icon: "G",
        accentClass: "bg-amber-50 text-amber-700",
      },
      {
        label: "AI Success Rate",
        value: formatAdminPercent(aiGeneration.success_rate_percent ?? 0),
        detail: `${formatAdminInteger(failedJobs.length)} recent failed jobs`,
        icon: "AI",
        accentClass: "bg-pink-50 text-pink-700",
      },
      {
        label: "Response Time",
        value: formatAdminDuration(systemHealth.api_response_time_ms ?? overviewKpis.avg_processing_time_ms ?? 0),
        detail: `${formatAdminInteger(systemHealth.queue_length ?? 0)} live jobs in queue`,
        icon: "R",
        accentClass: "bg-slate-100 text-slate-700",
      },
    ];

    const emptyPanel = (message) => (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
        {message}
      </div>
    );

    const renderTabContent = () => {
      if (adminSidebarTab === "overview") {
        return (
          <div className="space-y-6">
            <div className="grid gap-5 2xl:grid-cols-[1.45fr_1fr_1fr]">
              <article className={sectionCardClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">User Activity Overview</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">Daily active audience across the last month</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">WAU {formatAdminInteger(overviewCharts.wau ?? 0)}</span>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">MAU {formatAdminInteger(overviewCharts.mau ?? 0)}</span>
                  </div>
                </div>
                <div className="mt-5">
                  <AdminLineChart items={dailyActivitySeries} stroke={ADMIN_CHART_COLORS[0]} />
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Feature Usage Distribution</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">What administrators and students use most</h2>
                <div className="mt-5">
                  <AdminDonutChart items={featureUsageItems} totalLabel="Actions" />
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Session Pulse</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Five-minute request cadence</h2>
                <div className="mt-5">
                  <AdminLineChart items={realTimeSeries} stroke={ADMIN_CHART_COLORS[1]} />
                </div>
              </article>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <article className={sectionCardClass}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recent User Activity</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">Latest events happening in the platform</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{recentActivityPreview.length} visible</span>
                </div>
                <div className="mt-5 space-y-3">
                  {recentActivityPreview.length ? recentActivityPreview.map((log, index) => (
                    <div key={`${log.timestamp}-${index}`} className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getAdminActionTone(log.action)}`}>{formatAdminActionLabel(log.action)}</span>
                          <span className="text-sm font-semibold text-slate-900">{log.user}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{log.resource || "No resource recorded"} on {log.ip_address || "no IP"}.</p>
                      </div>
                      <div className="text-sm text-slate-500 xl:text-right">
                        <p>{formatAdminDateTime(log.timestamp)}</p>
                        <p className="mt-1 font-medium text-slate-700">{formatAdminDuration(log.duration_ms || 0)}</p>
                      </div>
                    </div>
                  )) : emptyPanel("Activity will appear here as soon as people start using the app.")}
                </div>
              </article>

              <article className={sectionCardClass}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Top Users By Usage</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">Who is driving the most lecture work</h2>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Ranked by sessions, uploads, and outputs</span>
                </div>
                <div className="mt-5 space-y-3">
                  {topUsers.length ? topUsers.map((user, index) => (
                    <div key={user.email} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-semibold text-indigo-700">{index + 1}</span>
                            <div className="min-w-0">
                              <p className="phone-safe-copy truncate text-sm font-semibold text-slate-900">{user.email}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{titleCaseWords(user.role)} account</p>
                            </div>
                          </div>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAdminHealthTone(user.status)}`}>{titleCaseWords(user.status)}</span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-white px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Sessions</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{formatAdminInteger(user.sessions_count || 0)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Uploads</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{formatAdminInteger(user.total_uploads || 0)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Generated</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{formatAdminInteger(user.total_generations || 0)}</p>
                        </div>
                      </div>
                    </div>
                  )) : emptyPanel("Top users will show up once saved study packs and sessions exist.")}
                </div>
              </article>
            </div>

            <div className="grid gap-5 xl:grid-cols-[0.95fr_0.95fr_1.1fr]">
              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">System Health</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Operational status at a glance</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "System State", value: titleCaseWords(systemHealth.state || "green"), tone: getAdminHealthTone(systemHealth.state || "green") },
                    { label: "API Response", value: formatAdminDuration(systemHealth.api_response_time_ms ?? 0), tone: "bg-sky-50 text-sky-700" },
                    { label: "Queue Length", value: formatAdminInteger(systemHealth.queue_length ?? 0), tone: "bg-violet-50 text-violet-700" },
                    { label: "Error Rate", value: formatAdminPercent(overviewKpis.error_rate_percent ?? 0), tone: "bg-amber-50 text-amber-700" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</p>
                      <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.tone}`}>Live metric</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recent Errors</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Latest failures recorded by the platform</h2>
                <div className="mt-5 space-y-3">
                  {failedJobs.length ? failedJobs.slice(0, 4).map((job, index) => (
                    <div key={`${job.timestamp}-${index}`} className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-rose-900">{formatAdminActionLabel(job.action)}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-rose-700">{job.email || "Unknown user"}</p>
                        </div>
                        <p className="text-xs text-rose-700">{formatAdminDateTime(job.timestamp)}</p>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-rose-900">{job.message}</p>
                    </div>
                  )) : emptyPanel("No failed jobs are recorded right now.")}
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Output Mix And Funnel</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">How requests move from upload to finished study tools</h2>
                <div className="mt-5 space-y-5">
                  <AdminDonutChart items={outputMixItems} totalLabel="Outputs" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Conversion funnel</p>
                    <div className="mt-3">
                      <AdminBarList items={conversionFunnelItems} />
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        );
      }

      if (adminSidebarTab === "users") {
        return (
          <article className={sectionCardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Users</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Account access, status, and usage</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{filteredUsers.length} visible</span>
            </div>
            <div className="mt-5 overflow-x-auto">
              {filteredUsers.length ? (
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Last Login</th>
                      <th className="px-3 py-2">Sessions</th>
                      <th className="px-3 py-2">Uploads</th>
                      <th className="px-3 py-2">Generated</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.email} className="rounded-[24px] bg-slate-50 align-top shadow-[inset_0_0_0_1px_rgba(226,232,240,1)]">
                        <td className="rounded-l-[24px] px-3 py-4">
                          <p className="phone-safe-copy text-sm font-semibold text-slate-900">{user.email}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Risk {titleCaseWords(user.risk_score || "low")}</p>
                        </td>
                        <td className="px-3 py-4 text-sm text-slate-700">{titleCaseWords(user.role)}</td>
                        <td className="px-3 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAdminHealthTone(user.status)}`}>{titleCaseWords(user.status)}</span>
                        </td>
                        <td className="px-3 py-4 text-sm text-slate-700">{user.last_login_at ? formatAdminDateTime(user.last_login_at) : "Never"}</td>
                        <td className="px-3 py-4 text-sm font-semibold text-slate-900">{formatAdminInteger(user.sessions_count || 0)}</td>
                        <td className="px-3 py-4 text-sm font-semibold text-slate-900">{formatAdminInteger(user.total_uploads || 0)}</td>
                        <td className="px-3 py-4 text-sm font-semibold text-slate-900">{formatAdminInteger(user.total_generations || 0)}</td>
                        <td className="rounded-r-[24px] px-3 py-4">
                          <div className="flex flex-wrap gap-2">
                            {user.status !== "suspended" ? (
                              <button type="button" onClick={() => updateAdminUserStatus(user.email, "suspended")} className="rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Suspend</button>
                            ) : (
                              <button type="button" onClick={() => updateAdminUserStatus(user.email, "active")} className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">Activate</button>
                            )}
                            <button type="button" onClick={() => forceLogoutAdminUser(user.email)} className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700">Force Logout</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : emptyPanel("No users match the current search.")}
            </div>
          </article>
        );
      }

      if (adminSidebarTab === "activity") {
        return (
          <article className={sectionCardClass}>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Activity Log</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Recent audit trail and event stream</h2>
            </div>
            <div className="mt-5 space-y-3">
              {filteredLogs.length ? filteredLogs.map((log, index) => (
                <div key={`${log.timestamp}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getAdminActionTone(log.action)}`}>{formatAdminActionLabel(log.action)}</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getAdminHealthTone(log.status)}`}>{titleCaseWords(log.status || "success")}</span>
                      </div>
                      <p className="mt-3 phone-safe-copy text-sm font-semibold text-slate-900">{log.user}</p>
                      <p className="mt-2 text-sm text-slate-600">{log.resource || "No resource recorded"} from {log.ip_address || "no IP"}.</p>
                    </div>
                    <div className="text-sm text-slate-500 xl:text-right">
                      <p>{formatAdminDateTime(log.timestamp)}</p>
                      <p className="mt-1 font-medium text-slate-700">{formatAdminDuration(log.duration_ms || 0)}</p>
                    </div>
                  </div>
                </div>
              )) : emptyPanel("No logs match the current search.")}
            </div>
          </article>
        );
      }

      if (adminSidebarTab === "content") {
        return (
          <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <article className={sectionCardClass}>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Content Library</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Saved lectures and generated study packs</h2>
              </div>
              <div className="mt-5 space-y-3">
                {filteredContent.length ? filteredContent.map((item, index) => (
                  <div key={`${item.file_name}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <p className="phone-safe-copy text-sm font-semibold text-slate-900">{item.file_name}</p>
                        <p className="mt-2 text-sm text-slate-600">{item.owner_email}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAdminHealthTone(item.processing_status)}`}>{titleCaseWords(item.processing_status)}</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      {[
                        { label: "Title", value: item.title || "Saved lecture" },
                        { label: "Uploaded", value: item.upload_date ? formatAdminDateTime(item.upload_date) : "Unknown" },
                        { label: "Output", value: item.output_generated === "Y" ? "Generated" : "Source only" },
                        { label: "Size", value: item.size_label || "--" },
                      ].map((detail) => (
                        <div key={`${item.file_name}-${detail.label}`} className="rounded-2xl bg-white px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{detail.label}</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{detail.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : emptyPanel("No saved study packs match the current search.")}
              </div>
            </article>

            <div className="space-y-5">
              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Storage Insights</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Tracked content footprint</h2>
                <div className="mt-5 rounded-[24px] bg-slate-50 px-4 py-5">
                  <p className="text-sm text-slate-600">Tracked study packs</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{formatAdminInteger(content.storage_insights?.tracked_study_packs ?? 0)}</p>
                </div>
                <div className="mt-4">
                  <AdminBarList
                    items={storageLeaders.map((item, index) => ({
                      label: item.email,
                      value: item.saved_items,
                      color: ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length],
                    }))}
                    formatter={formatAdminInteger}
                  />
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Output Mix</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Generated study assets by type</h2>
                <div className="mt-5">
                  <AdminDonutChart items={outputMixItems} totalLabel="Outputs" />
                </div>
              </article>
            </div>
          </div>
        );
      }

      if (adminSidebarTab === "ai") {
        return (
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <article className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">AI Generation</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Output volumes and model-driven activity</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Study guides", value: formatAdminInteger(aiGeneration.totals?.study_guides ?? 0) },
                  { label: "Presentations", value: formatAdminInteger(aiGeneration.totals?.presentations ?? 0) },
                  { label: "Podcasts", value: formatAdminInteger(aiGeneration.totals?.podcasts ?? 0) },
                  { label: "Success rate", value: formatAdminPercent(aiGeneration.success_rate_percent ?? 0) },
                  { label: "Average generation time", value: formatAdminDuration(aiGeneration.avg_generation_time_ms ?? 0) },
                  { label: "Tracked tests", value: formatAdminInteger(overviewKpis.tests_generated ?? 0) },
                ].map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <AdminDonutChart items={outputMixItems} totalLabel="Outputs" />
              </div>
            </article>

            <article className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Failed Jobs</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Recent AI failures and user impact</h2>
              <div className="mt-5 space-y-3">
                {failedJobs.length ? failedJobs.map((job, index) => (
                  <div key={`${job.timestamp}-${index}`} className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-rose-900">{formatAdminActionLabel(job.action)}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-rose-700">{job.email || "Unknown user"}</p>
                      </div>
                      <p className="text-xs text-rose-700">{formatAdminDateTime(job.timestamp)}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-rose-900">{job.message}</p>
                  </div>
                )) : emptyPanel("No failed AI jobs are recorded right now.")}
              </div>
            </article>
          </div>
        );
      }

      if (adminSidebarTab === "analytics") {
        return (
          <div className="space-y-6">
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Growth Trend</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Thirty-day active user movement</h2>
                <div className="mt-5">
                  <AdminLineChart items={dailyActivitySeries} stroke={ADMIN_CHART_COLORS[0]} />
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Most Used Tools</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Features taking the biggest share of usage</h2>
                <div className="mt-5">
                  <AdminBarList items={featureUsageItems} />
                </div>
              </article>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Session Heatmap</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Requests by hour of day</h2>
                <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                  {sessionHeatmapPreview.length ? sessionHeatmapPreview.map((item) => (
                    <div key={item.hour} className="rounded-[24px] border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex h-24 items-end">
                        <div className="w-full rounded-2xl bg-gradient-to-t from-indigo-500 to-sky-400" style={{ height: `${Math.max(8, (toFiniteNumber(item.actions) / maxSessionHeat) * 100)}%` }} />
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{item.hour}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">{formatAdminInteger(item.actions)}</p>
                    </div>
                  )) : [emptyPanel("Session heat data will appear here soon.")]}
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Retention And Drop-off</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">How well users come back and where they stop</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {retentionItems.map((item) => (
                    <div key={item.label} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">{formatAdminPercent(item.value)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <AdminBarList
                    items={(analytics.drop_off_points || []).map((item, index) => ({
                      label: item.label,
                      value: item.count,
                      color: ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length],
                    }))}
                    formatter={formatAdminInteger}
                  />
                </div>
                <div className="mt-5 rounded-[24px] bg-slate-50 px-4 py-4">
                  <p className="text-sm text-slate-600">Average response time</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminDuration(analytics.performance?.avg_response_time_ms ?? 0)}</p>
                  <p className="mt-4 text-sm text-slate-600">Actions per session</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminDecimal(analytics.performance?.actions_per_session ?? 0)}</p>
                </div>
              </article>
            </div>
          </div>
        );
      }

      if (adminSidebarTab === "health") {
        return (
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <article className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">System Health</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Current platform stability and device spread</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "State", value: titleCaseWords(systemHealth.state || "green"), tone: getAdminHealthTone(systemHealth.state || "green") },
                  { label: "API response", value: formatAdminDuration(systemHealth.api_response_time_ms ?? 0), tone: "bg-sky-50 text-sky-700" },
                  { label: "Queue length", value: formatAdminInteger(systemHealth.queue_length ?? 0), tone: "bg-violet-50 text-violet-700" },
                  { label: "Active jobs", value: formatAdminInteger((systemHealth.active_jobs || []).length), tone: "bg-emerald-50 text-emerald-700" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</p>
                    <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.tone}`}>Live signal</span>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900">Device activity</p>
                <div className="mt-3">
                  <AdminBarList
                    items={(security.device_tracking || []).slice(0, 6).map((item, index) => ({
                      label: item.device,
                      value: item.actions,
                      color: ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length],
                    }))}
                    formatter={formatAdminInteger}
                  />
                </div>
              </div>
            </article>

            <div className="space-y-5">
              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live Jobs</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">In-flight work happening right now</h2>
                <div className="mt-5 space-y-3">
                  {(systemHealth.active_jobs || []).length ? (systemHealth.active_jobs || []).map((job) => (
                    <div key={job.job_id} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{titleCaseWords(job.job_type || "job")}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAdminHealthTone(job.status)}`}>{formatAdminInteger(job.progress || 0)}%</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{job.stage || "Queued"}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{job.owner_email || "No owner"} • {titleCaseWords(job.status || "queued")}</p>
                    </div>
                  )) : emptyPanel("No queued or processing jobs right now.")}
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recent Failures</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">The latest errors affecting the system</h2>
                <div className="mt-5 space-y-3">
                  {(systemHealth.recent_failures || []).length ? (systemHealth.recent_failures || []).map((job, index) => (
                    <div key={`${job.timestamp}-${index}`} className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-4">
                      <p className="text-sm font-semibold text-rose-900">{formatAdminActionLabel(job.action)}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-rose-700">{job.email || "Unknown user"} • {formatAdminDateTime(job.timestamp)}</p>
                      <p className="mt-3 text-sm leading-6 text-rose-900">{job.message}</p>
                    </div>
                  )) : emptyPanel("No system failures were captured recently.")}
                </div>
              </article>
            </div>
          </div>
        );
      }

      if (adminSidebarTab === "security") {
        return (
          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <article className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Failed Logins</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Authentication failures and lockout signals</h2>
              <div className="mt-5 space-y-3">
                {(security.failed_logins || []).length ? (security.failed_logins || []).map((item, index) => (
                  <div key={`${item.timestamp}-${index}`} className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <p className="phone-safe-copy text-sm font-semibold text-rose-900">{item.email}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-rose-700">{item.ip_address || "No IP"} • {titleCaseWords(item.status)}</p>
                      </div>
                      <p className="text-xs text-rose-700">{formatAdminDateTime(item.timestamp)}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-rose-900">{item.reason}</p>
                  </div>
                )) : emptyPanel("No recent failed logins.")}
              </div>
            </article>

            <div className="space-y-5">
              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Suspicious Activity</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Accounts that need closer review</h2>
                <div className="mt-5 space-y-3">
                  {(security.suspicious_activity || []).length ? (security.suspicious_activity || []).map((item, index) => (
                    <div key={`${item.email}-${index}`} className="rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-4">
                      <p className="text-sm font-semibold text-amber-900">{item.email}</p>
                      <p className="mt-3 text-sm leading-6 text-amber-900">{item.reason}</p>
                    </div>
                  )) : emptyPanel("No suspicious activity rules are currently triggered.")}
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">IP Tracking</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Most active network origins</h2>
                <div className="mt-5 space-y-3">
                  {(security.ip_tracking || []).slice(0, 8).length ? (security.ip_tracking || []).slice(0, 8).map((item) => (
                    <div key={item.ip_address} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">{item.ip_address}</p>
                      <p className="mt-2 text-sm text-slate-600">{formatAdminInteger(item.actions)} actions</p>
                      <p className="mt-2 text-xs text-slate-500">{(item.users || []).join(", ") || "No mapped user"}</p>
                    </div>
                  )) : emptyPanel("No IP activity is available yet.")}
                </div>
              </article>
            </div>
          </div>
        );
      }

      if (adminSidebarTab === "billing") {
        return (
          <article className={sectionCardClass}>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Billing</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Subscription and revenue view</h2>
            <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-sm leading-7 text-slate-500">
              Billing metrics are still intentionally empty right now, so the dashboard keeps the structure ready without showing fake numbers.
            </div>
          </article>
        );
      }

      if (adminSidebarTab === "settings") {
        return (
          <div className="grid gap-5 xl:grid-cols-2">
            <article className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Languages</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Study output languages currently exposed</h2>
              <div className="mt-5 flex flex-wrap gap-3">
                {(dashboard.settings?.available_languages || outputLanguageOptions.map((item) => item.value)).map((language) => (
                  <span key={language} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">{language}</span>
                ))}
              </div>
            </article>

            <article className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Feature Flags</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Backend capabilities currently enabled</h2>
              <div className="mt-5 space-y-3">
                {Object.entries(dashboard.settings?.feature_flags || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <span className="text-sm text-slate-700">{titleCaseWords(key)}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${value ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{value ? "Enabled" : "Disabled"}</span>
                  </div>
                ))}
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm text-slate-600">Configured admin accounts</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminInteger(dashboard.settings?.admin_email_count ?? 0)}</p>
                </div>
              </div>
            </article>
          </div>
        );
      }

      return null;
    };

    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#eef2ff_0%,#f8fafc_40%,#eef6ff_100%)] text-slate-900">
        <main className="mx-auto max-w-[1680px] px-3 py-4 sm:px-5 lg:px-7 lg:py-7">
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,#0f172a_0%,#101f43_52%,#162c5b_100%)] text-white shadow-[0_26px_70px_rgba(15,23,42,0.28)]">
              <div className="border-b border-white/10 px-6 py-6">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/20 text-sm font-semibold text-indigo-100">MA</div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">StudyMate AI</p>
                    <p className="truncate text-xs uppercase tracking-[0.2em] text-slate-300">Admin Dashboard</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 px-4 py-5">
                {Object.entries(groupedSidebarItems).map(([group, items]) => (
                  <div key={group}>
                    <p className="px-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">{group}</p>
                    <div className="mt-3 grid gap-2">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setAdminSidebarTab(item.id)}
                          className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${adminSidebarTab === item.id ? "bg-[linear-gradient(135deg,#5b6bff,#7c8bff)] text-white shadow-[0_12px_30px_rgba(91,107,255,0.35)]" : "text-slate-200 hover:bg-white/10"}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Need help?</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Admin tools stay in sync with the live audit logs, saved workspaces, and active jobs from your backend.</p>
                </div>
              </div>
            </aside>

            <section className="min-w-0 space-y-6">
              <header className="rounded-[34px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">{activeSidebarItem.group}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${getAdminHealthTone(systemHealth.state || "green")}`}>{titleCaseWords(systemHealth.state || "green")} system</span>
                    </div>
                    <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">{activeSidebarItem.label}</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">Welcome back, {authEmail || "admin"}. This view turns your audit logs, saved workspaces, and system jobs into the analytics-heavy dashboard layout you asked for.</p>
                  </div>

                  <div className="flex flex-col gap-3 xl:items-end">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">Last 30 days</div>
                      <input
                        value={adminSearchQuery}
                        onChange={(event) => setAdminSearchQuery(event.target.value)}
                        className="w-full min-w-[240px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none sm:w-[320px]"
                        placeholder="Search users, files, or logs"
                      />
                      <button type="button" onClick={() => loadAdminDashboard()} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">Refresh</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{formatAdminInteger(failedLoginCount)} security alerts</span>
                      <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">{authEmail}</span>
                      <button type="button" onClick={() => chooseSessionMode("user")} className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">Student View</button>
                      <button type="button" onClick={logout} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Sign Out</button>
                    </div>
                  </div>
                </div>
              </header>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                {overviewCards.map((card) => (
                  <article key={card.label} className="rounded-[28px] border border-slate-200/90 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold ${card.accentClass}`}>{card.icon}</div>
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Live</span>
                    </div>
                    <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">{card.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">{card.value}</p>
                    <p className="mt-3 text-sm text-slate-500">{card.detail}</p>
                  </article>
                ))}
              </div>

              {renderTabContent()}
            </section>
          </div>

          {isLoadingAdminDashboard ? <div className="pointer-events-none fixed bottom-4 right-4 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.12)]">Refreshing admin data...</div> : null}
        </main>
      </div>
    );
  };

  const renderAdminDashboardPage = () => {
    const sidebarItems = [
      { id: "overview", label: "Dashboard", group: "Overview" },
      { id: "users", label: "Users", group: "Users" },
      { id: "activity", label: "User Activity", group: "Users" },
      { id: "sessions", label: "Sessions", group: "Users" },
      { id: "content", label: "Study Materials", group: "Content & Tools" },
      { id: "ai", label: "AI Generation", group: "Content & Tools" },
      { id: "analytics", label: "Usage Analytics", group: "Analytics" },
      { id: "health", label: "System Health", group: "System" },
      { id: "security", label: "Security", group: "System" },
      { id: "billing", label: "Billing", group: "System" },
      { id: "settings", label: "Settings", group: "System" },
    ];
    const sectionCardClass = "rounded-[30px] border border-slate-200/90 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]";
    const dashboard = adminDashboard || {};
    const overview = dashboard.overview || {};
    const overviewKpis = overview.kpis || {};
    const overviewCharts = overview.charts || {};
    const analytics = dashboard.analytics || {};
    const aiGeneration = dashboard.ai_generation || {};
    const content = dashboard.content || {};
    const storageInsights = content.storage_insights || {};
    const sessions = dashboard.sessions || {};
    const sessionTotals = sessions.totals || {};
    const sessionRows = sessions.table || [];
    const expiringSoonSessions = sessions.expiring_soon || [];
    const systemHealth = dashboard.system_health || {};
    const transcriptionQueue = systemHealth.transcription_queue || {};
    const security = dashboard.security || {};
    const users = dashboard.users || [];
    const activityLogs = dashboard.activity_logs || [];
    const failedJobs = aiGeneration.failed_jobs || [];
    const topUsersByUsage = storageInsights.top_users || [];
    const storageBreakdown = storageInsights.breakdown || {};
    const failedLoginCount = (security.failed_logins || []).length;
    const normalizedSearchQuery = adminSearchQuery.toLowerCase().trim();
    const matchesSearch = (value) => !normalizedSearchQuery || String(value || "").toLowerCase().includes(normalizedSearchQuery);
    const filteredUsers = users.filter((user) => matchesSearch(`${user.email} ${user.role} ${user.status} ${user.next_timeout_at}`));
    const filteredLogs = activityLogs.filter((log) => matchesSearch(`${log.user} ${log.action} ${log.resource} ${log.status} ${log.ip_address}`));
    const filteredContent = (content.items || []).filter((item) => matchesSearch(`${item.file_name} ${item.owner_email} ${item.title}`));
    const filteredSessions = sessionRows.filter((item) => matchesSearch(`${item.email} ${item.last_login_at} ${item.next_timeout_at}`));
    const activeSidebarItem = sidebarItems.find((item) => item.id === adminSidebarTab) || sidebarItems[0];
    const groupedSidebarItems = sidebarItems.reduce((groups, item) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
      return groups;
    }, {});
    const dashboardDateRangeLabel = `${formatAdminDate(Date.now() - (6 * 24 * 60 * 60 * 1000))} - ${formatAdminDate(Date.now())}`;
    const dashboardGeneratedAt = dashboard.generated_at ? formatAdminDateTime(dashboard.generated_at) : "Waiting for data";
    const dailyActivitySeries = (overviewCharts.daily_active_users || []).map((item) => ({
      label: formatAdminDate(item.date),
      active_users: item.active_users,
      new_users: item.new_users,
    }));
    const sessionTimelineSeries = (overviewCharts.user_sessions || sessions.timeline || []).map((item) => ({
      label: formatAdminDate(item.date),
      value: item.sessions,
    }));
    const featureUsageItems = (overviewCharts.feature_usage_breakdown || analytics.most_used_tools || [])
      .slice(0, 5)
      .map((item, index) => ({
        label: item.label,
        value: item.count,
        color: ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length],
      }));
    const outputMixItems = [
      { label: "Study Guides", value: aiGeneration.totals?.study_guides ?? 0, color: ADMIN_CHART_COLORS[0] },
      { label: "Presentations", value: aiGeneration.totals?.presentations ?? 0, color: ADMIN_CHART_COLORS[1] },
      { label: "Podcasts", value: aiGeneration.totals?.podcasts ?? 0, color: ADMIN_CHART_COLORS[2] },
      { label: "Tests", value: overviewKpis.tests_generated ?? 0, color: ADMIN_CHART_COLORS[3] },
    ].filter((item) => item.value > 0);
    const storageUsageItems = [
      { label: "Lecture Sources", value: storageBreakdown.lecture_sources_bytes ?? 0, color: ADMIN_CHART_COLORS[1] },
      { label: "Generated Content", value: storageBreakdown.generated_content_bytes ?? 0, color: ADMIN_CHART_COLORS[0] },
      { label: "Other Files", value: storageBreakdown.other_data_bytes ?? 0, color: ADMIN_CHART_COLORS[4] },
    ].filter((item) => item.value > 0);
    const queueBreakdownItems = [
      { label: "In Queue", value: transcriptionQueue.in_queue ?? 0, color: ADMIN_CHART_COLORS[3] },
      { label: "Processing", value: transcriptionQueue.processing ?? 0, color: ADMIN_CHART_COLORS[0] },
      { label: "Completed (7D)", value: transcriptionQueue.completed_7d ?? 0, color: ADMIN_CHART_COLORS[2] },
      { label: "Failed (7D)", value: transcriptionQueue.failed_7d ?? 0, color: ADMIN_CHART_COLORS[4] },
    ];
    const sessionHeatmapPreview = (analytics.session_heatmap || []).slice(0, 24);
    const maxSessionHeat = Math.max(...sessionHeatmapPreview.map((item) => toFiniteNumber(item.actions)), 1);
    const retentionItems = [
      { label: "Day 1", value: analytics.retention?.day_1 ?? 0 },
      { label: "Day 7", value: analytics.retention?.day_7 ?? 0 },
      { label: "Day 30", value: analytics.retention?.day_30 ?? 0 },
    ];
    const overviewCards = [
      {
        label: "Total Users",
        value: formatAdminInteger(overviewKpis.total_users ?? 0),
        detail: `${formatAdminInteger(overviewKpis.new_users_7d ?? 0)} new in the last 7 days`,
        icon: "U",
        accentClass: "bg-blue-50 text-blue-700",
      },
      {
        label: "Active Users (7D)",
        value: formatAdminInteger(overviewKpis.active_users_7d ?? 0),
        detail: `${formatAdminInteger(overviewKpis.active_users_24h ?? 0)} active in the last 24 hours`,
        icon: "A",
        accentClass: "bg-emerald-50 text-emerald-700",
      },
      {
        label: "Lectures Transcribed",
        value: formatAdminInteger(overviewKpis.lectures_transcribed ?? 0),
        detail: `${formatAdminInteger(overviewKpis.lectures_transcribed_week ?? 0)} completed in the last 7 days`,
        icon: "T",
        accentClass: "bg-violet-50 text-violet-700",
      },
      {
        label: "Study Materials Generated",
        value: formatAdminInteger(overviewKpis.study_materials_generated ?? 0),
        detail: `${formatAdminInteger(overviewKpis.study_guides_generated ?? 0)} saved guides`,
        icon: "M",
        accentClass: "bg-amber-50 text-amber-700",
      },
      {
        label: "Tests Generated",
        value: formatAdminInteger(overviewKpis.tests_generated ?? 0),
        detail: `${formatAdminInteger(overviewKpis.active_sessions ?? 0)} active sessions now`,
        icon: "Q",
        accentClass: "bg-rose-50 text-rose-700",
      },
      {
        label: "Storage Used",
        value: formatAdminBytes(overviewKpis.storage_used_bytes ?? 0),
        detail: `${formatAdminInteger(storageInsights.tracked_study_packs ?? 0)} tracked study packs`,
        icon: "S",
        accentClass: "bg-sky-50 text-sky-700",
      },
    ];

    const emptyPanel = (message) => (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
        {message}
      </div>
    );

    const renderOverview = () => (
      <div className="space-y-6">
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
          <article className={sectionCardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">User Activity Overview</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Active and new users across the last month</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">WAU {formatAdminInteger(overviewCharts.wau ?? 0)}</span>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">MAU {formatAdminInteger(overviewCharts.mau ?? 0)}</span>
              </div>
            </div>
            <div className="mt-5">
              <AdminMultiLineChart
                items={dailyActivitySeries}
                series={[
                  { key: "active_users", label: "Active Users", color: ADMIN_CHART_COLORS[0] },
                  { key: "new_users", label: "New Users", color: ADMIN_CHART_COLORS[1] },
                ]}
              />
            </div>
          </article>

          <article className={sectionCardClass}>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Feature Usage Distribution</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">What students use most</h2>
            <div className="mt-5">
              <AdminDonutChart items={featureUsageItems} totalLabel="Actions" />
            </div>
          </article>

          <article className={sectionCardClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">User Sessions</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Sessions, duration, and bounce rate</h2>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{formatAdminInteger(sessionTotals.expiring_soon_count ?? 0)} expiring soon</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Total Sessions", value: formatAdminInteger(sessionTotals.tracked_sessions_30d ?? 0) },
                { label: "Avg. Session Duration", value: formatAdminSecondsDuration(sessionTotals.avg_session_duration_seconds ?? 0) },
                { label: "Bounce Rate", value: formatAdminPercent(sessionTotals.bounce_rate_percent ?? 0) },
              ].map((item) => (
                <div key={item.label} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-3 text-xl font-semibold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <AdminLineChart items={sessionTimelineSeries} stroke={ADMIN_CHART_COLORS[0]} />
            </div>
          </article>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <article className={sectionCardClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recent User Activity</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Latest logins, uploads, and generation requests</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatAdminInteger(Math.min(activityLogs.length, 6))} rows</span>
            </div>
            <div className="mt-5 overflow-x-auto">
              {activityLogs.length ? (
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Event</th>
                      <th className="px-3 py-2">Details</th>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">IP Address</th>
                      <th className="px-3 py-2">Device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.slice(0, 6).map((log, index) => (
                      <tr key={`${log.timestamp}-${index}`} className="bg-slate-50 align-top shadow-[inset_0_0_0_1px_rgba(226,232,240,1)]">
                        <td className="rounded-l-[24px] px-3 py-4 text-sm font-semibold text-slate-900">{log.user}</td>
                        <td className="px-3 py-4"><span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getAdminActionTone(log.action)}`}>{formatAdminActionLabel(log.action)}</span></td>
                        <td className="px-3 py-4 text-sm text-slate-700">{log.resource || "No resource recorded"}</td>
                        <td className="px-3 py-4 text-sm text-slate-700">{formatAdminDateTime(log.timestamp)}</td>
                        <td className="px-3 py-4 text-sm text-slate-700">{log.ip_address || "--"}</td>
                        <td className="rounded-r-[24px] px-3 py-4 text-sm text-slate-500">{String(log.device || "Web").slice(0, 28)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : emptyPanel("Recent activity will appear here once people sign in and use the platform.")}
            </div>
          </article>

          <article className={sectionCardClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Top Users By Usage</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Who is driving the most study work</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Live ranking</span>
            </div>
            <div className="mt-5 overflow-x-auto">
              {topUsersByUsage.length ? (
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Lectures</th>
                      <th className="px-3 py-2">Materials</th>
                      <th className="px-3 py-2">Tests</th>
                      <th className="px-3 py-2">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topUsersByUsage.slice(0, 5).map((item) => (
                      <tr key={item.email} className="bg-slate-50 align-top shadow-[inset_0_0_0_1px_rgba(226,232,240,1)]">
                        <td className="rounded-l-[24px] px-3 py-4 text-sm font-semibold text-slate-900">{item.email}</td>
                        <td className="px-3 py-4 text-sm text-slate-700">{formatAdminInteger(item.lectures ?? 0)}</td>
                        <td className="px-3 py-4 text-sm text-slate-700">{formatAdminInteger(item.materials ?? 0)}</td>
                        <td className="px-3 py-4 text-sm text-slate-700">{formatAdminInteger(item.tests ?? 0)}</td>
                        <td className="rounded-r-[24px] px-3 py-4 text-sm text-slate-700">{formatAdminInteger(item.sessions ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : emptyPanel("Top users will show up once study history and sessions accumulate.")}
            </div>
          </article>
        </div>

        <div className="grid gap-5 xl:grid-cols-4">
          <article className={sectionCardClass}>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">System Health</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">{(systemHealth.state || "green") === "green" ? "All systems operational" : "Operational review"}</h2>
            <div className="mt-5 grid gap-3">
              {[
                { label: "API Response", value: formatAdminDuration(systemHealth.api_response_time_ms ?? 0) },
                { label: "Active Sessions", value: formatAdminInteger(systemHealth.active_sessions ?? 0) },
                { label: "Live Jobs", value: formatAdminInteger((systemHealth.active_jobs || []).length) },
                { label: "Error Rate", value: formatAdminPercent(overviewKpis.error_rate_percent ?? 0) },
              ].map((item) => (
                <div key={item.label} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-3 text-xl font-semibold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          </article>

          <article className={sectionCardClass}>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Transcription Queue</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Queue pressure and completion flow</h2>
            <div className="mt-5">
              <AdminBarList items={queueBreakdownItems} formatter={formatAdminInteger} maxItems={4} />
            </div>
          </article>

          <article className={sectionCardClass}>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recent Errors</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Latest failures captured by the platform</h2>
            <div className="mt-5 space-y-3">
              {failedJobs.length ? failedJobs.slice(0, 4).map((job, index) => (
                <div key={`${job.timestamp}-${index}`} className="rounded-[22px] border border-rose-100 bg-rose-50 px-4 py-4">
                  <p className="text-sm font-semibold text-rose-900">{formatAdminActionLabel(job.action)}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-rose-700">{job.email || "Unknown user"} / {formatAdminDateTime(job.timestamp)}</p>
                  <p className="mt-3 text-sm leading-6 text-rose-900">{job.message}</p>
                </div>
              )) : emptyPanel("No failed jobs are recorded right now.")}
            </div>
          </article>

          <article className={sectionCardClass}>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Storage Usage</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">How saved content is using storage</h2>
            <div className="mt-5">
              <AdminDonutChart items={storageUsageItems} totalLabel="Used" formatter={formatAdminBytes} />
            </div>
          </article>
        </div>
      </div>
    );

    const renderSimpleTable = (headers, rows, emptyMessage) => (
      <div className="mt-5 overflow-x-auto">
        {rows.length ? (
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                {headers.map((header) => <th key={header} className="px-3 py-2">{header}</th>)}
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        ) : emptyPanel(emptyMessage)}
      </div>
    );

    const renderTabContent = () => {
      if (adminSidebarTab === "overview") return renderOverview();

      if (adminSidebarTab === "users") {
        return (
          <article className={sectionCardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Users</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Account access, status, timeouts, and saved work</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatAdminInteger(filteredUsers.length)} visible</span>
            </div>
            {renderSimpleTable(
              ["User", "Role", "Status", "Last Login", "Next Timeout", "Sessions", "Lectures", "Materials", "Tests", "Actions"],
              filteredUsers.map((user) => (
                <tr key={user.email} className="bg-slate-50 align-top shadow-[inset_0_0_0_1px_rgba(226,232,240,1)]">
                  <td className="rounded-l-[24px] px-3 py-4">
                    <p className="phone-safe-copy text-sm font-semibold text-slate-900">{user.email}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Risk {titleCaseWords(user.risk_score || "low")}</p>
                  </td>
                  <td className="px-3 py-4 text-sm text-slate-700">{titleCaseWords(user.role)}</td>
                  <td className="px-3 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAdminHealthTone(user.status)}`}>{titleCaseWords(user.status)}</span></td>
                  <td className="px-3 py-4 text-sm text-slate-700">{user.last_login_at ? formatAdminDateTime(user.last_login_at) : "Never"}</td>
                  <td className="px-3 py-4 text-sm text-slate-700">{user.next_timeout_at ? formatAdminDateTime(user.next_timeout_at) : "No active session"}</td>
                  <td className="px-3 py-4 text-sm text-slate-700">{formatAdminInteger(user.sessions_count || 0)}</td>
                  <td className="px-3 py-4 text-sm text-slate-700">{formatAdminInteger(user.lectures_transcribed || 0)}</td>
                  <td className="px-3 py-4 text-sm text-slate-700">{formatAdminInteger(user.study_materials || 0)}</td>
                  <td className="px-3 py-4 text-sm text-slate-700">{formatAdminInteger(user.tests_generated || 0)}</td>
                  <td className="rounded-r-[24px] px-3 py-4">
                    <div className="flex flex-wrap gap-2">
                      {user.status !== "suspended" ? (
                        <button type="button" onClick={() => updateAdminUserStatus(user.email, "suspended")} className="rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Suspend</button>
                      ) : (
                        <button type="button" onClick={() => updateAdminUserStatus(user.email, "active")} className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">Activate</button>
                      )}
                      <button type="button" onClick={() => forceLogoutAdminUser(user.email)} className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700">Force Logout</button>
                    </div>
                  </td>
                </tr>
              )),
              "No users match the current search.",
            )}
          </article>
        );
      }

      if (adminSidebarTab === "activity") {
        return (
          <article className={sectionCardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">User Activity</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Audit trail with login, upload, and generation events</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatAdminInteger(filteredLogs.length)} rows</span>
            </div>
            {renderSimpleTable(
              ["User", "Event", "Status", "Resource", "Time", "IP Address", "Duration"],
              filteredLogs.map((log, index) => (
                <tr key={`${log.timestamp}-${index}`} className="bg-slate-50 align-top shadow-[inset_0_0_0_1px_rgba(226,232,240,1)]">
                  <td className="rounded-l-[24px] px-3 py-4 text-sm font-semibold text-slate-900">{log.user}</td>
                  <td className="px-3 py-4"><span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getAdminActionTone(log.action)}`}>{formatAdminActionLabel(log.action)}</span></td>
                  <td className="px-3 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAdminHealthTone(log.status)}`}>{titleCaseWords(log.status || "success")}</span></td>
                  <td className="px-3 py-4 text-sm text-slate-700">{log.resource || "No resource recorded"}</td>
                  <td className="px-3 py-4 text-sm text-slate-700">{formatAdminDateTime(log.timestamp)}</td>
                  <td className="px-3 py-4 text-sm text-slate-700">{log.ip_address || "--"}</td>
                  <td className="rounded-r-[24px] px-3 py-4 text-sm text-slate-700">{formatAdminDuration(log.duration_ms || 0)}</td>
                </tr>
              )),
              "No logs match the current search.",
            )}
          </article>
        );
      }

      if (adminSidebarTab === "sessions") {
        return (
          <div className="space-y-6">
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Sessions Overview</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Session volume and timeout behaviour</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Tracked Sessions (30D)", value: formatAdminInteger(sessionTotals.tracked_sessions_30d ?? 0) },
                    { label: "Avg Session Duration", value: formatAdminSecondsDuration(sessionTotals.avg_session_duration_seconds ?? 0) },
                    { label: "Bounce Rate", value: formatAdminPercent(sessionTotals.bounce_rate_percent ?? 0) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                      <p className="mt-3 text-xl font-semibold text-slate-950">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <AdminLineChart items={sessionTimelineSeries} stroke={ADMIN_CHART_COLORS[0]} />
                </div>
              </article>

              <article className={sectionCardClass}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Expiring Soon</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">Users close to timing out</h2>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{formatAdminInteger(expiringSoonSessions.length)} users</span>
                </div>
                <div className="mt-5 space-y-3">
                  {expiringSoonSessions.length ? expiringSoonSessions.map((item) => (
                    <div key={`${item.email}-${item.expires_at}`} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="phone-safe-copy text-sm font-semibold text-slate-900">{item.email}</p>
                          <p className="mt-2 text-sm text-slate-600">Timeout at {formatAdminDateTime(item.expires_at)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.minutes_left <= 5 ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                          {formatAdminInteger(item.minutes_left)} min left
                        </span>
                      </div>
                    </div>
                  )) : emptyPanel("No active sessions are close to expiring right now.")}
                </div>
              </article>
            </div>

            <article className={sectionCardClass}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Sessions Table</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">Active sessions, login times, and next timeouts</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatAdminInteger(filteredSessions.length)} visible</span>
              </div>
              {renderSimpleTable(
                ["User", "Active Sessions", "Last Login", "Next Timeout", "Avg Duration", "Bounce Rate", "Sessions (30D)", "Actions (30D)"],
                filteredSessions.map((item) => (
                  <tr key={item.email} className="bg-slate-50 align-top shadow-[inset_0_0_0_1px_rgba(226,232,240,1)]">
                    <td className="rounded-l-[24px] px-3 py-4 text-sm font-semibold text-slate-900">{item.email}</td>
                    <td className="px-3 py-4 text-sm text-slate-700">{formatAdminInteger(item.active_sessions ?? 0)}</td>
                    <td className="px-3 py-4 text-sm text-slate-700">{item.last_login_at ? formatAdminDateTime(item.last_login_at) : "Never"}</td>
                    <td className="px-3 py-4 text-sm text-slate-700">{item.next_timeout_at ? formatAdminDateTime(item.next_timeout_at) : "No timeout"}</td>
                    <td className="px-3 py-4 text-sm text-slate-700">{formatAdminSecondsDuration(item.avg_session_duration_seconds ?? 0)}</td>
                    <td className="px-3 py-4 text-sm text-slate-700">{formatAdminPercent(item.bounce_rate_percent ?? 0)}</td>
                    <td className="px-3 py-4 text-sm text-slate-700">{formatAdminInteger(item.total_sessions_30d ?? 0)}</td>
                    <td className="rounded-r-[24px] px-3 py-4 text-sm text-slate-700">{formatAdminInteger(item.total_actions ?? 0)}</td>
                  </tr>
                )),
                "No session rows match the current search.",
              )}
            </article>
          </div>
        );
      }

      if (adminSidebarTab === "content") {
        return (
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <article className={sectionCardClass}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Study Materials</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">Saved lectures, generated content, and ownership</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatAdminInteger(filteredContent.length)} rows</span>
              </div>
              {renderSimpleTable(
                ["File", "Owner", "Updated", "Output", "Size"],
                filteredContent.map((item, index) => (
                  <tr key={`${item.file_name}-${index}`} className="bg-slate-50 align-top shadow-[inset_0_0_0_1px_rgba(226,232,240,1)]">
                    <td className="rounded-l-[24px] px-3 py-4">
                      <p className="phone-safe-copy text-sm font-semibold text-slate-900">{item.file_name}</p>
                      <p className="mt-2 text-xs text-slate-500">{item.title || "Saved lecture"}</p>
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-700">{item.owner_email || "--"}</td>
                    <td className="px-3 py-4 text-sm text-slate-700">{item.upload_date ? formatAdminDateTime(item.upload_date) : "Unknown"}</td>
                    <td className="px-3 py-4 text-sm text-slate-700">{item.output_generated === "Y" ? "Generated" : "Source only"}</td>
                    <td className="rounded-r-[24px] px-3 py-4 text-sm text-slate-700">{formatAdminBytes(item.size_bytes ?? 0)}</td>
                  </tr>
                )),
                "No saved study packs match the current search.",
              )}
            </article>

            <div className="space-y-5">
              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Storage Insights</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Current storage footprint by content type</h2>
                <div className="mt-5">
                  <AdminDonutChart items={storageUsageItems} totalLabel="Used" formatter={formatAdminBytes} />
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Top Users By Storage</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Accounts holding the biggest saved history</h2>
                <div className="mt-5">
                  <AdminBarList
                    items={topUsersByUsage.slice(0, 6).map((item, index) => ({
                      label: item.email,
                      value: item.storage_bytes,
                      color: ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length],
                    }))}
                    formatter={formatAdminBytes}
                    maxItems={6}
                  />
                </div>
              </article>
            </div>
          </div>
        );
      }

      if (adminSidebarTab === "ai") {
        return (
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <article className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">AI Generation</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Output volumes, completion quality, and asset mix</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Study Guides", value: formatAdminInteger(aiGeneration.totals?.study_guides ?? 0) },
                  { label: "Presentations", value: formatAdminInteger(aiGeneration.totals?.presentations ?? 0) },
                  { label: "Podcasts", value: formatAdminInteger(aiGeneration.totals?.podcasts ?? 0) },
                  { label: "Success Rate", value: formatAdminPercent(aiGeneration.success_rate_percent ?? 0) },
                  { label: "Average Generation Time", value: formatAdminDuration(aiGeneration.avg_generation_time_ms ?? 0) },
                  { label: "Tracked Tests", value: formatAdminInteger(overviewKpis.tests_generated ?? 0) },
                ].map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <AdminDonutChart items={outputMixItems} totalLabel="Outputs" />
              </div>
            </article>

            <article className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Failed Jobs</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Recent AI failures and affected requests</h2>
              <div className="mt-5 space-y-3">
                {failedJobs.length ? failedJobs.map((job, index) => (
                  <div key={`${job.timestamp}-${index}`} className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-rose-900">{formatAdminActionLabel(job.action)}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-rose-700">{job.email || "Unknown user"}</p>
                      </div>
                      <p className="text-xs text-rose-700">{formatAdminDateTime(job.timestamp)}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-rose-900">{job.message}</p>
                  </div>
                )) : emptyPanel("No failed AI jobs are recorded right now.")}
              </div>
            </article>
          </div>
        );
      }

      if (adminSidebarTab === "analytics") {
        return (
          <div className="space-y-6">
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Growth Trend</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Active versus new users across the last month</h2>
                <div className="mt-5">
                  <AdminMultiLineChart
                    items={dailyActivitySeries}
                    series={[
                      { key: "active_users", label: "Active Users", color: ADMIN_CHART_COLORS[0] },
                      { key: "new_users", label: "New Users", color: ADMIN_CHART_COLORS[1] },
                    ]}
                  />
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Most Used Tools</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Features taking the biggest share of activity</h2>
                <div className="mt-5">
                  <AdminBarList items={featureUsageItems} />
                </div>
              </article>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Session Heatmap</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Requests by hour of day</h2>
                <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                  {sessionHeatmapPreview.length ? sessionHeatmapPreview.map((item) => (
                    <div key={item.hour} className="rounded-[24px] border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex h-24 items-end">
                        <div className="w-full rounded-2xl bg-gradient-to-t from-indigo-500 to-sky-400" style={{ height: `${Math.max(8, (toFiniteNumber(item.actions) / maxSessionHeat) * 100)}%` }} />
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{item.hour}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">{formatAdminInteger(item.actions)}</p>
                    </div>
                  )) : [emptyPanel("Session heat data will appear here soon.")]}
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Retention And Drop-off</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">How often users come back and where they stop</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {retentionItems.map((item) => (
                    <div key={item.label} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">{formatAdminPercent(item.value)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <AdminBarList
                    items={(analytics.drop_off_points || []).map((item, index) => ({
                      label: item.label,
                      value: item.count,
                      color: ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length],
                    }))}
                    formatter={formatAdminInteger}
                  />
                </div>
                <div className="mt-5 rounded-[24px] bg-slate-50 px-4 py-4">
                  <p className="text-sm text-slate-600">Average response time</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminDuration(analytics.performance?.avg_response_time_ms ?? 0)}</p>
                  <p className="mt-4 text-sm text-slate-600">Actions per session</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminDecimal(analytics.performance?.actions_per_session ?? 0)}</p>
                </div>
              </article>
            </div>
          </div>
        );
      }

      if (adminSidebarTab === "health") {
        return (
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <article className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">System Health</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Operational state, devices, and queue status</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "State", value: titleCaseWords(systemHealth.state || "green"), tone: getAdminHealthTone(systemHealth.state || "green") },
                  { label: "API Response", value: formatAdminDuration(systemHealth.api_response_time_ms ?? 0), tone: "bg-sky-50 text-sky-700" },
                  { label: "Queue Length", value: formatAdminInteger(systemHealth.queue_length ?? 0), tone: "bg-violet-50 text-violet-700" },
                  { label: "Active Sessions", value: formatAdminInteger(systemHealth.active_sessions ?? 0), tone: "bg-emerald-50 text-emerald-700" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</p>
                    <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.tone}`}>Live signal</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Device activity</p>
                  <div className="mt-3">
                    <AdminBarList
                      items={(security.device_tracking || []).slice(0, 6).map((item, index) => ({
                        label: item.device,
                        value: item.actions,
                        color: ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length],
                      }))}
                      formatter={formatAdminInteger}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Transcription queue</p>
                  <div className="mt-3">
                    <AdminBarList items={queueBreakdownItems} formatter={formatAdminInteger} maxItems={4} />
                  </div>
                </div>
              </div>
            </article>

            <div className="space-y-5">
              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live Jobs</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">In-flight work happening right now</h2>
                <div className="mt-5 space-y-3">
                  {(systemHealth.active_jobs || []).length ? (systemHealth.active_jobs || []).map((job) => (
                    <div key={job.job_id} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{titleCaseWords(job.job_type || "job")}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAdminHealthTone(job.status)}`}>{formatAdminInteger(job.progress || 0)}%</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{job.stage || "Queued"}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{job.owner_email || "No owner"} / {titleCaseWords(job.status || "queued")}</p>
                    </div>
                  )) : emptyPanel("No queued or processing jobs right now.")}
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recent Failures</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">The latest errors affecting the system</h2>
                <div className="mt-5 space-y-3">
                  {(systemHealth.recent_failures || []).length ? (systemHealth.recent_failures || []).map((job, index) => (
                    <div key={`${job.timestamp}-${index}`} className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-4">
                      <p className="text-sm font-semibold text-rose-900">{formatAdminActionLabel(job.action)}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-rose-700">{job.email || "Unknown user"} / {formatAdminDateTime(job.timestamp)}</p>
                      <p className="mt-3 text-sm leading-6 text-rose-900">{job.message}</p>
                    </div>
                  )) : emptyPanel("No system failures were captured recently.")}
                </div>
              </article>
            </div>
          </div>
        );
      }

      if (adminSidebarTab === "security") {
        return (
          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <article className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Failed Logins</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Authentication failures and lockout signals</h2>
              <div className="mt-5 space-y-3">
                {(security.failed_logins || []).length ? (security.failed_logins || []).map((item, index) => (
                  <div key={`${item.timestamp}-${index}`} className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <p className="phone-safe-copy text-sm font-semibold text-rose-900">{item.email}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-rose-700">{item.ip_address || "No IP"} / {titleCaseWords(item.status)}</p>
                      </div>
                      <p className="text-xs text-rose-700">{formatAdminDateTime(item.timestamp)}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-rose-900">{item.reason}</p>
                  </div>
                )) : emptyPanel("No recent failed logins.")}
              </div>
            </article>

            <div className="space-y-5">
              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Suspicious Activity</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Accounts that need closer review</h2>
                <div className="mt-5 space-y-3">
                  {(security.suspicious_activity || []).length ? (security.suspicious_activity || []).map((item, index) => (
                    <div key={`${item.email}-${index}`} className="rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-4">
                      <p className="text-sm font-semibold text-amber-900">{item.email}</p>
                      <p className="mt-3 text-sm leading-6 text-amber-900">{item.reason}</p>
                    </div>
                  )) : emptyPanel("No suspicious activity rules are currently triggered.")}
                </div>
              </article>

              <article className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">IP Tracking</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Most active network origins</h2>
                <div className="mt-5 space-y-3">
                  {(security.ip_tracking || []).slice(0, 8).length ? (security.ip_tracking || []).slice(0, 8).map((item) => (
                    <div key={item.ip_address} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">{item.ip_address}</p>
                      <p className="mt-2 text-sm text-slate-600">{formatAdminInteger(item.actions)} actions</p>
                      <p className="mt-2 text-xs text-slate-500">{(item.users || []).join(", ") || "No mapped user"}</p>
                    </div>
                  )) : emptyPanel("No IP activity is available yet.")}
                </div>
              </article>
            </div>
          </div>
        );
      }

      if (adminSidebarTab === "billing") {
        return (
          <article className={sectionCardClass}>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Billing</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Subscription and revenue view</h2>
            <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-sm leading-7 text-slate-500">
              Billing metrics are still intentionally empty right now, so the dashboard keeps the structure ready without showing fake numbers.
            </div>
          </article>
        );
      }

      if (adminSidebarTab === "settings") {
        return (
          <div className="grid gap-5 xl:grid-cols-2">
            <article className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Languages</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Study output languages currently exposed</h2>
              <div className="mt-5 flex flex-wrap gap-3">
                {(dashboard.settings?.available_languages || outputLanguageOptions.map((item) => item.value)).map((language) => (
                  <span key={language} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">{language}</span>
                ))}
              </div>
            </article>

            <article className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Feature Flags</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Backend capabilities currently enabled</h2>
              <div className="mt-5 space-y-3">
                {Object.entries(dashboard.settings?.feature_flags || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <span className="text-sm text-slate-700">{titleCaseWords(key)}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${value ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{value ? "Enabled" : "Disabled"}</span>
                  </div>
                ))}
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm text-slate-600">Configured admin accounts</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminInteger(dashboard.settings?.admin_email_count ?? 0)}</p>
                </div>
              </div>
            </article>
          </div>
        );
      }

      return renderAdminPage();
    };

    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#edf2ff_0%,#f8fafc_38%,#eef6ff_100%)] text-slate-900">
        <main className="mx-auto max-w-[1700px] px-3 py-4 sm:px-5 lg:px-7 lg:py-7">
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,#0f172a_0%,#101f43_52%,#162c5b_100%)] text-white shadow-[0_26px_70px_rgba(15,23,42,0.28)]">
              <div className="border-b border-white/10 px-6 py-6">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/20 text-sm font-semibold text-indigo-100">MA</div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">StudyMate AI</p>
                    <p className="truncate text-xs uppercase tracking-[0.2em] text-slate-300">Admin Dashboard</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 px-4 py-5">
                {Object.entries(groupedSidebarItems).map(([group, items]) => (
                  <div key={group}>
                    <p className="px-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">{group}</p>
                    <div className="mt-3 grid gap-2">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setAdminSidebarTab(item.id)}
                          className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${adminSidebarTab === item.id ? "bg-[linear-gradient(135deg,#5b6bff,#7c8bff)] text-white shadow-[0_12px_30px_rgba(91,107,255,0.35)]" : "text-slate-200 hover:bg-white/10"}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Need help?</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">This dashboard refreshes from your live backend so new logins, activity, queue changes, and session timeouts can appear without a manual reload.</p>
                </div>
              </div>
            </aside>

            <section className="min-w-0 space-y-6">
              <header className="rounded-[34px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">{activeSidebarItem.group}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${getAdminHealthTone(systemHealth.state || "green")}`}>{titleCaseWords(systemHealth.state || "green")} system</span>
                    </div>
                    <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">{activeSidebarItem.label}</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">Welcome back, {authEmail || "admin"}. This view tracks users, logins, session timeouts, saved study packs, queue activity, and recent failures from your backend.</p>
                  </div>

                  <div className="flex flex-col gap-3 xl:items-end">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">{dashboardDateRangeLabel}</div>
                      <input
                        value={adminSearchQuery}
                        onChange={(event) => setAdminSearchQuery(event.target.value)}
                        className="w-full min-w-[240px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none sm:w-[320px]"
                        placeholder="Search users, sessions, files, or logs"
                      />
                      <button type="button" onClick={() => loadAdminDashboard()} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">Refresh</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{formatAdminInteger(failedLoginCount)} security alerts</span>
                      <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Updated {dashboardGeneratedAt}</span>
                      <button type="button" onClick={() => chooseSessionMode("user")} className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">Student View</button>
                      <button type="button" onClick={logout} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Sign Out</button>
                    </div>
                  </div>
                </div>
              </header>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                {overviewCards.map((card) => (
                  <article key={card.label} className="rounded-[28px] border border-slate-200/90 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold ${card.accentClass}`}>{card.icon}</div>
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Live</span>
                    </div>
                    <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">{card.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">{card.value}</p>
                    <p className="mt-3 text-sm text-slate-500">{card.detail}</p>
                  </article>
                ))}
              </div>

              {renderTabContent()}
            </section>
          </div>

          {isLoadingAdminDashboard ? <div className="pointer-events-none fixed bottom-4 right-4 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.12)]">Refreshing admin data...</div> : null}
        </main>
      </div>
    );
  };

  const LegacyAdminPage = () => {
    const sidebarItems = [
      ["overview", "Overview"],
      ["users", "Users"],
      ["activity", "Activity Logs"],
      ["content", "Content"],
      ["ai", "AI Generation"],
      ["analytics", "Analytics"],
      ["health", "System Health"],
      ["security", "Security"],
      ["billing", "Billing"],
      ["settings", "Settings"],
    ];
    const dashboard = adminDashboard || {};
    const failedLoginCount = (dashboard.security?.failed_logins || []).length;
    const filteredUsers = (dashboard.users || []).filter((user) => `${user.email} ${user.role} ${user.status}`.toLowerCase().includes(adminSearchQuery.toLowerCase()));
    const filteredLogs = (dashboard.activity_logs || []).filter((log) => `${log.user} ${log.action} ${log.resource}`.toLowerCase().includes(adminSearchQuery.toLowerCase()));
    const filteredContent = (dashboard.content?.items || []).filter((item) => `${item.file_name} ${item.owner_email} ${item.title}`.toLowerCase().includes(adminSearchQuery.toLowerCase()));

    const overviewCards = [
      { label: "Total Users", value: dashboard.overview?.kpis?.total_users ?? 0 },
      { label: "Active 1h / 24h / 7d", value: `${dashboard.overview?.kpis?.active_users_1h ?? 0} / ${dashboard.overview?.kpis?.active_users_24h ?? 0} / ${dashboard.overview?.kpis?.active_users_7d ?? 0}` },
      { label: "Lectures Uploaded", value: `${dashboard.overview?.kpis?.lectures_uploaded_today ?? 0} today • ${dashboard.overview?.kpis?.lectures_uploaded_week ?? 0} week` },
      { label: "Guides / Tests", value: `${dashboard.overview?.kpis?.study_guides_generated ?? 0} / ${dashboard.overview?.kpis?.tests_generated ?? 0}` },
      { label: "Avg Processing", value: `${dashboard.overview?.kpis?.avg_processing_time_ms ?? 0} ms` },
      { label: "Error Rate", value: `${dashboard.overview?.kpis?.error_rate_percent ?? 0}%` },
      { label: "System Load", value: dashboard.overview?.kpis?.system_load ?? 0 },
      { label: "Health", value: (dashboard.system_health?.state || "green").toUpperCase() },
    ];

    return (
      <div className="min-h-screen bg-[var(--page-bg)] text-slate-100">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="hero-glow hero-glow-left" />
          <div className="hero-glow hero-glow-right" />
          <div className="hero-grid" />
        </div>
        <main className="relative mx-auto max-w-[1600px] px-3 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 rounded-[30px] border border-white/10 bg-slate-950/70 px-5 py-5 shadow-[0_24px_70px_rgba(2,8,23,0.35)] backdrop-blur">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <p className="brand-mark text-2xl font-black sm:text-4xl">MABASO</p>
                <p className="mt-2 text-sm uppercase tracking-[0.28em] text-emerald-200/70">Admin dashboard</p>
                <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Secure analytics and operations view.</h1>
              </div>
              <div className="flex flex-col gap-3 xl:items-end">
                <div className="flex flex-wrap items-center gap-3">
                  <input value={adminSearchQuery} onChange={(event) => setAdminSearchQuery(event.target.value)} className="w-full min-w-[240px] rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none sm:w-[320px]" placeholder="Search users, files, or logs" />
                  <button type="button" onClick={() => loadAdminDashboard()} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">Refresh</button>
                  <button type="button" onClick={() => chooseSessionMode("user")} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-50">Enter User Mode</button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">{failedLoginCount} security alerts</div>
                  <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">{authEmail}</div>
                  <button type="button" onClick={logout} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white">Sign Out</button>
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="rounded-[28px] border border-white/10 bg-slate-950/70 p-4 shadow-[0_24px_60px_rgba(2,8,23,0.3)] backdrop-blur">
              <p className="px-2 text-xs uppercase tracking-[0.28em] text-emerald-200/70">Navigation</p>
              <div className="mt-4 grid gap-2">
                {sidebarItems.map(([key, label]) => <button key={key} type="button" onClick={() => setAdminSidebarTab(key)} className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold ${adminSidebarTab === key ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}>{label}</button>)}
              </div>
            </aside>

            <section className="space-y-6">
              {(adminSidebarTab === "overview" || adminSidebarTab === "analytics" || adminSidebarTab === "health") ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{overviewCards.map((card) => <article key={card.label} className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">{card.label}</p><p className="mt-3 text-2xl font-semibold text-white">{card.value}</p></article>)}</div> : null}

              {adminSidebarTab === "overview" ? <div className="grid gap-5 xl:grid-cols-2"><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Real-time activity</p><div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-4">{(dashboard.overview?.charts?.real_time_activity || []).map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs text-slate-400">{item.label}</p><p className="mt-2 text-xl font-semibold text-white">{item.count}</p></div>)}</div></div><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Feature usage</p><div className="mt-4 space-y-3">{(dashboard.overview?.charts?.feature_usage_breakdown || []).slice(0, 8).map((item) => <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><span className="text-sm text-white">{item.label}</span><span className="text-sm font-semibold text-emerald-100">{item.count}</span></div>)}</div></div><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Conversion funnel</p><div className="mt-4 space-y-3">{(dashboard.overview?.charts?.conversion_funnel || []).map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className="text-sm text-white">{item.label}</p><p className="mt-2 text-xl font-semibold text-emerald-100">{item.count}</p></div>)}</div></div><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Retention</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{[{ label: "Day 1", value: dashboard.analytics?.retention?.day_1 ?? 0 }, { label: "Day 7", value: dashboard.analytics?.retention?.day_7 ?? 0 }, { label: "Day 30", value: dashboard.analytics?.retention?.day_30 ?? 0 }].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs text-slate-400">{item.label}</p><p className="mt-2 text-xl font-semibold text-white">{item.value}%</p></div>)}</div></div></div> : null}

              {adminSidebarTab === "users" ? <div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Users</p><h2 className="mt-2 text-2xl font-semibold text-white">User table and account controls</h2></div><div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">{filteredUsers.length} visible user{filteredUsers.length === 1 ? "" : "s"}</div></div><div className="mt-5 space-y-4">{filteredUsers.length ? filteredUsers.map((user) => <article key={user.email} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><p className="phone-safe-copy text-lg font-semibold text-white">{user.email}</p><p className="mt-2 text-sm text-slate-300">{user.role} • {user.status} • risk {user.risk_score}</p><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Last login", value: user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never" }, { label: "IP", value: user.last_login_ip || "--" }, { label: "Sessions", value: user.sessions_count }, { label: "Uploads / generations", value: `${user.total_uploads} / ${user.total_generations}` }].map((item) => <div key={`${user.email}-${item.label}`} className="rounded-2xl border border-white/10 bg-slate-950/75 px-3 py-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{item.label}</p><p className="mt-2 text-sm text-white">{item.value}</p></div>)}</div></div><div className="flex flex-wrap gap-2">{user.status !== "suspended" ? <button type="button" onClick={() => updateAdminUserStatus(user.email, "suspended")} className="rounded-full border border-rose-300/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100">Suspend</button> : <button type="button" onClick={() => updateAdminUserStatus(user.email, "active")} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-50">Activate</button>}<button type="button" onClick={() => forceLogoutAdminUser(user.email)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">Force Logout</button><button type="button" disabled className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-slate-500">Reset Password</button><button type="button" disabled className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-slate-500">Assign Role</button></div></div></article>) : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">No users match the current search.</div>}</div></div> : null}

              {adminSidebarTab === "activity" ? <div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Activity logs</p><h2 className="mt-2 text-2xl font-semibold text-white">Recent audit trail</h2><div className="mt-5 space-y-3">{filteredLogs.length ? filteredLogs.map((log, index) => <div key={`${log.timestamp}-${index}`} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4"><div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0"><p className="phone-safe-copy text-sm font-semibold text-white">{log.action}</p><p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{log.user} • {log.ip_address || "No IP"} • {log.status}</p></div><p className="text-sm text-slate-300">{new Date(log.timestamp).toLocaleString()}</p></div><p className="mt-3 text-sm leading-7 text-slate-200">{log.resource || "No resource"} • {log.duration_ms || 0} ms</p></div>) : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">No logs match the current search.</div>}</div></div> : null}

              {adminSidebarTab === "content" ? <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]"><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Content management</p><h2 className="mt-2 text-2xl font-semibold text-white">Lecture and study pack records</h2><div className="mt-5 space-y-3">{filteredContent.length ? filteredContent.map((item, index) => <div key={`${item.file_name}-${index}`} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4"><div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"><div><p className="phone-safe-copy text-sm font-semibold text-white">{item.file_name}</p><p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{item.owner_email} • {item.processing_status}</p></div><p className="text-sm text-slate-300">{item.upload_date ? new Date(item.upload_date).toLocaleString() : "Unknown date"}</p></div><div className="mt-3 grid gap-2 sm:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-slate-950/75 px-3 py-3 text-sm text-white">{item.title}</div><div className="rounded-2xl border border-white/10 bg-slate-950/75 px-3 py-3 text-sm text-white">Size: {item.size_label}</div><div className="rounded-2xl border border-white/10 bg-slate-950/75 px-3 py-3 text-sm text-white">Duration: {item.duration_label}</div><div className="rounded-2xl border border-white/10 bg-slate-950/75 px-3 py-3 text-sm text-white">Output: {item.output_generated}</div></div></div>) : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">No saved study packs match the current search.</div>}</div></div><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Storage insights</p><div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-sm text-slate-300">Tracked study packs</p><p className="mt-2 text-3xl font-semibold text-white">{dashboard.content?.storage_insights?.tracked_study_packs ?? 0}</p></div><div className="mt-4 space-y-3">{(dashboard.content?.storage_insights?.top_users || []).map((item) => <div key={item.email} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><span className="text-sm text-white">{item.email}</span><span className="text-sm font-semibold text-emerald-100">{item.saved_items}</span></div>)}</div></div></div> : null}

              {adminSidebarTab === "ai" ? <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">AI generation</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{[{ label: "Study guides", value: dashboard.ai_generation?.totals?.study_guides ?? 0 }, { label: "Presentations", value: dashboard.ai_generation?.totals?.presentations ?? 0 }, { label: "Podcasts", value: dashboard.ai_generation?.totals?.podcasts ?? 0 }, { label: "Success rate", value: `${dashboard.ai_generation?.success_rate_percent ?? 0}%` }, { label: "Avg generation time", value: `${dashboard.ai_generation?.avg_generation_time_ms ?? 0} ms` }].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p><p className="mt-2 text-2xl font-semibold text-white">{item.value}</p></div>)}</div></div><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Failed jobs</p><div className="mt-4 space-y-3">{(dashboard.ai_generation?.failed_jobs || []).length ? (dashboard.ai_generation?.failed_jobs || []).map((job, index) => <div key={`${job.timestamp}-${index}`} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4"><p className="text-sm font-semibold text-white">{job.action}</p><p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{job.email || "Unknown user"} • {new Date(job.timestamp).toLocaleString()}</p><p className="mt-3 text-sm leading-7 text-slate-200">{job.message}</p></div>) : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">No failed AI jobs are recorded right now.</div>}</div></div></div> : null}

              {adminSidebarTab === "analytics" ? <div className="grid gap-5 xl:grid-cols-2"><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Session heatmap</p><div className="mt-4 grid gap-2 sm:grid-cols-4 xl:grid-cols-6">{(dashboard.analytics?.session_heatmap || []).map((item) => <div key={item.hour} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center"><p className="text-xs text-slate-400">{item.hour}</p><p className="mt-2 text-lg font-semibold text-white">{item.actions}</p></div>)}</div></div><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Drop-off points</p><div className="mt-4 space-y-3">{(dashboard.analytics?.drop_off_points || []).map((item) => <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><span className="text-sm text-white">{item.label}</span><span className="text-sm font-semibold text-emerald-100">{item.count}</span></div>)}</div><div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-sm text-slate-300">Average response time</p><p className="mt-2 text-2xl font-semibold text-white">{dashboard.analytics?.performance?.avg_response_time_ms ?? 0} ms</p><p className="mt-4 text-sm text-slate-300">Actions per session</p><p className="mt-2 text-2xl font-semibold text-white">{dashboard.analytics?.performance?.actions_per_session ?? 0}</p></div></div></div> : null}

              {adminSidebarTab === "health" ? <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">System health</p><div className="mt-4 space-y-3">{[{ label: "State", value: (dashboard.system_health?.state || "green").toUpperCase() }, { label: "API response time", value: `${dashboard.system_health?.api_response_time_ms ?? 0} ms` }, { label: "Queue length", value: dashboard.system_health?.queue_length ?? 0 }].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p><p className="mt-2 text-xl font-semibold text-white">{item.value}</p></div>)}</div></div><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Live jobs</p><div className="mt-4 space-y-3">{(dashboard.system_health?.active_jobs || []).length ? (dashboard.system_health?.active_jobs || []).map((job) => <div key={job.job_id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-white">{job.job_type}</p><span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">{job.progress}%</span></div><p className="mt-2 text-sm text-slate-300">{job.stage}</p><p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{job.status} • {job.owner_email || "No owner"}</p></div>) : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">No queued or processing jobs right now.</div>}</div></div></div> : null}

              {adminSidebarTab === "security" ? <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Failed logins</p><div className="mt-4 space-y-3">{(dashboard.security?.failed_logins || []).length ? (dashboard.security?.failed_logins || []).map((item, index) => <div key={`${item.timestamp}-${index}`} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4"><div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"><div><p className="text-sm font-semibold text-white">{item.email}</p><p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{item.ip_address || "No IP"} • {item.status}</p></div><p className="text-sm text-slate-300">{new Date(item.timestamp).toLocaleString()}</p></div><p className="mt-3 text-sm leading-7 text-slate-200">{item.reason}</p></div>) : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">No recent failed logins.</div>}</div></div><div className="space-y-5"><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Suspicious activity</p><div className="mt-4 space-y-3">{(dashboard.security?.suspicious_activity || []).length ? (dashboard.security?.suspicious_activity || []).map((item, index) => <div key={`${item.email}-${index}`} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4"><p className="text-sm font-semibold text-white">{item.email}</p><p className="mt-2 text-sm leading-7 text-slate-200">{item.reason}</p></div>) : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">No suspicious activity rules are currently triggered.</div>}</div></div><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">IP tracking</p><div className="mt-4 space-y-3">{(dashboard.security?.ip_tracking || []).slice(0, 8).map((item) => <div key={item.ip_address} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4"><p className="text-sm font-semibold text-white">{item.ip_address}</p><p className="mt-2 text-sm text-slate-300">{item.actions} actions • {(item.users || []).join(", ") || "No mapped user"}</p></div>)}</div></div></div></div> : null}

              {adminSidebarTab === "billing" ? <div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Billing</p><div className="mt-5 rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-slate-300">Subscriptions and billing metrics are intentionally left empty for now, as requested.</div></div> : null}

              {adminSidebarTab === "settings" ? <div className="grid gap-5 xl:grid-cols-2"><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Languages</p><div className="mt-4 flex flex-wrap gap-2">{(dashboard.settings?.available_languages || outputLanguageOptions.map((item) => item.value)).map((language) => <span key={language} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white">{language}</span>)}</div></div><div className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Feature flags</p><div className="mt-4 space-y-3">{Object.entries(dashboard.settings?.feature_flags || {}).map(([key, value]) => <div key={key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><span className="text-sm text-white">{key}</span><span className={`rounded-full px-3 py-1 text-xs ${value ? "bg-emerald-300/10 text-emerald-50" : "bg-slate-900 text-slate-400"}`}>{value ? "Enabled" : "Disabled"}</span></div>)}</div></div></div> : null}
            </section>
          </div>

          {isLoadingAdminDashboard ? <div className="pointer-events-none fixed bottom-4 right-4 rounded-full border border-white/10 bg-slate-950/90 px-4 py-2 text-sm text-slate-200">Refreshing admin data...</div> : null}
        </main>
      </div>
    );
  };

  const clearSession = (message = "Please sign in again.") => {
    stopTeacherPlayback({ resetIndex: true });
    historyOwnerEmailRef.current = "";
    hasLoadedAdminDashboardRef.current = false;
    setAuthToken("");
    setAuthEmail("");
    setAuthSessionMode("user");
    setAuthAvailableModes([]);
    setAuthMode("login");
    setRegisterStep("email");
    setPendingRegistrationToken("");
    setAuthPasswordInput("");
    setAuthConfirmPasswordInput("");
    setShowAuthPassword(false);
    setAuthCodeInput("");
    setPendingEmailAuthMode("");
    setPendingEmailAuthEmail("");
    setIsSigningInWithPassword(false);
    setIsRequestingEmailCode(false);
    setIsVerifyingEmailCode(false);
    setHistoryItems([]);
    setActiveHistoryId("");
    setCurrentPage("capture");
    setSupportMessageDraft("");
    setSupportFeedback("");
    setActiveRoomId("");
    setActiveRoom(null);
    setCollaborationRooms([]);
    setAdminDashboard(null);
    setAdminSidebarTab("overview");
    setAdminSearchQuery("");
    replacePodcastAudioUrl("");
    replacePodcastAudioSegments([]);
    setActivePodcastSegmentIndex(0);
    setIsPodcastAutoPlaying(false);
    setTeacherLessonData(createEmptyTeacherLessonData());
    setSelectedTeacherVoiceName("");
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_EMAIL_KEY);
    window.localStorage.removeItem(AUTH_MODE_KEY);
    window.localStorage.removeItem(AUTH_AVAILABLE_MODES_KEY);
    setAuthMessage(message);
  };

  useEffect(() => {
    let cancelled = false;
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
    if (!token) {
      setAuthChecked(true);
      return undefined;
    }
    setAuthChecked(true);
    fetchWithTimeout(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }, 8000).then(async (response) => {
      const data = await parseJsonSafe(response);
      if (cancelled) return;
      if (response.status === 401) {
        clearSession("Sign in to continue.");
        return;
      }
      if (!response.ok) {
        setAuthMessage(data.detail || "Opening your saved session while the server reconnects.");
        return;
      }
      const nextToken = data.token || token;
      setAuthToken(nextToken);
      setAuthEmail(data.email || window.localStorage.getItem(AUTH_EMAIL_KEY) || "");
      setAuthEmailInput(data.email || window.localStorage.getItem(REMEMBERED_EMAIL_KEY) || "");
      setAuthSessionMode(data.session_mode || window.localStorage.getItem(AUTH_MODE_KEY) || "user");
      setAuthAvailableModes(Array.isArray(data.available_modes) ? data.available_modes : []);
      if ((data.session_mode || "") === "admin") {
        setCurrentPage("admin");
      }
    }).catch((error) => {
      if (cancelled) return;
      setAuthMessage(
        isAbortError(error)
          ? "Opening your saved session while the server wakes up."
          : "Using the saved session while the server finishes reconnecting.",
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const ownerEmail = historyOwnerEmailRef.current;
      if (!ownerEmail) return;
      const historyKey = getHistoryStorageKey(ownerEmail);
      window.localStorage.setItem(historyKey, JSON.stringify(normalizeHistoryItems(historyItems)));
    } catch {
      // Ignore storage errors.
    }
  }, [historyItems]);

  useEffect(() => {
    if (!authToken) return;
    window.localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    window.localStorage.setItem(AUTH_EMAIL_KEY, authEmail);
    window.localStorage.setItem(AUTH_MODE_KEY, authSessionMode || "user");
    window.localStorage.setItem(AUTH_AVAILABLE_MODES_KEY, JSON.stringify(authAvailableModes));
  }, [authAvailableModes, authEmail, authSessionMode, authToken]);

  useEffect(() => {
    if (!authEmailInput.trim()) return;
    window.localStorage.setItem(REMEMBERED_EMAIL_KEY, authEmailInput.trim());
  }, [authEmailInput]);

  useEffect(() => {
    if (!outputLanguage) return;
    window.localStorage.setItem(OUTPUT_LANGUAGE_KEY, outputLanguage);
  }, [outputLanguage]);

  useEffect(() => {
    if (!adminDashboard) return;
    saveAdminDashboardCache(adminDashboard);
  }, [adminDashboard]);

  useEffect(() => {
    if (!authChecked || !authEmail) return;
    const cachedHistory = loadHistoryItems(authEmail);
    historyOwnerEmailRef.current = normalizeHistoryOwnerEmail(authEmail);
    skipNextHistorySyncRef.current = true;
    setHistoryItems(cachedHistory);
    setActiveHistoryId((current) => (cachedHistory.some((item) => item.id === current) ? current : ""));
  }, [authChecked, authEmail]);

  useEffect(() => {
    hasRestoredWorkspaceDraftRef.current = false;
    hasRestoredRecoveredRecordingRef.current = false;
    hasResumedPendingJobRef.current = false;
  }, [authEmail]);

  useEffect(() => {
    const loadVoices = () => {
      const nextVoices = typeof window !== "undefined" && window.speechSynthesis
        ? window.speechSynthesis.getVoices().filter((voice) => voice.lang?.toLowerCase().startsWith("en") || outputLanguage.toLowerCase() !== "english")
        : [];
      setTeacherVoiceOptions(nextVoices);
      if (!selectedTeacherVoiceName && nextVoices.length) {
        const preferredVoice = nextVoices.find((voice) => /female|woman|zira|aria|samantha|google uk english female|michelle|serena/i.test(voice.name))
          || nextVoices.find((voice) => /google|microsoft|natural|english/i.test(voice.name))
          || nextVoices[0];
        if (preferredVoice?.name) setSelectedTeacherVoiceName(preferredVoice.name);
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [outputLanguage, selectedTeacherVoiceName]);

  useEffect(() => {
    if (!authChecked) return;
    const ownerEmail = getActiveWorkspaceOwnerEmail();
    if (!ownerEmail) return;

    const hasWorkspaceContent = Boolean(
      activeHistoryId
      || videoUrl.trim()
      || file?.name
      || transcript.trim()
      || summary.trim()
      || formula.trim()
      || example.trim()
      || flashcards.length
      || quizQuestions.length
      || studyImages.length
      || lectureNoteSources.length
      || lectureSlideSources.length
      || pastQuestionPaperSources.length
      || pastQuestionMemo.trim()
      || presentationData.slides.length
      || podcastData.script
      || teacherLessonData.segments.length
      || recording
    );

    if (!hasWorkspaceContent) {
      saveWorkspaceDraft(ownerEmail, null);
      return;
    }

    persistWorkspaceDraft();
  }, [
    activeHistoryId,
    activeTab,
    authChecked,
    authEmail,
    authEmailInput,
    currentPage,
    example,
    file,
    flashcards,
    formula,
    lectureNoteSources,
    lectureSlideSources,
    outputLanguage,
    pastQuestionMemo,
    pastQuestionPaperSources,
    podcastData,
    podcastSpeakerCount,
    podcastTargetMinutes,
    presentationData,
    presentationView,
    quizQuestions,
    recording,
    selectedPresentationDesign,
    studyImages,
    summary,
    teacherLessonData,
    transcript,
    videoUrl,
  ]);

  useEffect(() => {
    if (!authChecked || !authEmail || hasRestoredWorkspaceDraftRef.current) return;
    hasRestoredWorkspaceDraftRef.current = true;
    const snapshot = loadWorkspaceDraft(authEmail);
    if (!snapshot) return;
    const hasLiveWorkspace = Boolean(
      transcript.trim()
      || summary.trim()
      || formula.trim()
      || example.trim()
      || flashcards.length
      || quizQuestions.length
      || studyImages.length
      || lectureNoteSources.length
      || lectureSlideSources.length
      || pastQuestionPaperSources.length
      || podcastData.script
      || teacherLessonData.segments.length
    );
    if (hasLiveWorkspace) return;
    applyWorkspaceSnapshot(snapshot, { preserveStatus: true });
  }, [
    authChecked,
    authEmail,
    example,
    flashcards.length,
    formula,
    lectureNoteSources.length,
    lectureSlideSources.length,
    pastQuestionPaperSources.length,
    podcastData.script,
    quizQuestions.length,
    studyImages.length,
    summary,
    teacherLessonData.segments.length,
    transcript,
  ]);

  useEffect(() => {
    if (!authChecked || !authEmail || hasRestoredRecoveredRecordingRef.current) return;
    hasRestoredRecoveredRecordingRef.current = true;
    loadRecoveredRecordingFromDb(authEmail).then((record) => {
      if (!record?.blob || file?.name) return;
      const recoveredFile = new File([record.blob], record.fileName || "mabaso-lecture.wav", { type: record.type || "audio/wav" });
      startTransition(() => {
        setFile(recoveredFile);
        setVideoUrl("");
      });
      setStatus("Recovered your saved recording after refresh. You can transcribe it now.");
    }).catch(() => {
      // Ignore recovered recording load failures.
    });
  }, [authChecked, authEmail, file]);

  useEffect(() => {
    if (!authToken) return undefined;
    const interval = window.setInterval(() => {
      fetchWithTimeout(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } }, 8000).then(async (response) => {
        if (!response.ok) return;
        const data = await parseJsonSafe(response);
        if (data.token) {
          setAuthToken(data.token);
        }
        if (data.session_mode) setAuthSessionMode(data.session_mode);
        if (Array.isArray(data.available_modes)) setAuthAvailableModes(data.available_modes);
      }).catch(() => {
        // Keep the saved session locally if the server is temporarily unavailable.
      });
    }, 10 * 60 * 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [authToken]);

  useEffect(() => () => {
    if (podcastAudioUrlRef.current) window.URL.revokeObjectURL(podcastAudioUrlRef.current);
  }, []);

  useEffect(() => () => {
    cleanupRecordingMonitoring({ stopStream: true });
  }, []);

  useEffect(() => () => {
    stopTeacherPlayback({ resetIndex: true });
  }, []);

  useEffect(() => {
    if (!recording) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [recording]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return undefined;

    const clearHandlers = () => {
      ["play", "pause", "stop"].forEach((action) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Some browsers do not support clearing every action handler.
        }
      });
    };

    try {
      if (recording) {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: "Live Lecture Recording",
          artist: authEmail || "MABASO",
          album: "Lecture Capture",
        });
        navigator.mediaSession.setActionHandler("pause", () => stopRecording());
        navigator.mediaSession.setActionHandler("stop", () => stopRecording());
      } else if (isTeacherPlaying || isTeacherPaused) {
        const activeSegment = teacherLessonData.segments[activeTeacherSegmentIndex] || teacherLessonData.segments[0] || null;
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: teacherLessonData.title || "Teacher Mode",
          artist: activeSegment?.sectionHeading || "Study Guide",
          album: "MABASO Teacher Lesson",
        });
        navigator.mediaSession.setActionHandler("pause", () => pauseTeacherLesson());
        navigator.mediaSession.setActionHandler("play", () => resumeTeacherLesson());
        navigator.mediaSession.setActionHandler("stop", () => stopTeacherPlayback({ resetIndex: true }));
      } else {
        navigator.mediaSession.metadata = null;
        clearHandlers();
      }
    } catch {
      // Media Session support differs across browsers.
    }

    return () => {
      try {
        if (!recording && !isTeacherPlaying && !isTeacherPaused) {
          navigator.mediaSession.metadata = null;
        }
      } catch {
        // Ignore Media Session cleanup failures.
      }
      clearHandlers();
    };
  }, [activeTeacherSegmentIndex, authEmail, isTeacherPaused, isTeacherPlaying, recording, teacherLessonData]);

  useEffect(() => {
    if (!authToken) return undefined;
    const handleFocus = () => {
      refreshSessionIfNeeded().catch(() => {
        // Leave the current UI state alone until the next authenticated request surfaces the problem.
      });
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [authAvailableModes, authEmail, authSessionMode, authToken]);

  useEffect(() => {
    setIsDownloadMenuOpen(false);
  }, [activeTab, currentPage]);

  const applyAuthResponse = (data, fallbackEmail = "", { promptForMode = false } = {}) => {
    const nextToken = data?.token || "";
    const nextEmail = data?.email || fallbackEmail || "";
    const nextMode = data?.session_mode || "user";
    const nextAvailableModes = Array.isArray(data?.available_modes) ? data.available_modes : [];
    setAuthToken(nextToken);
    setAuthEmail(nextEmail);
    setAuthEmailInput(nextEmail || window.localStorage.getItem(REMEMBERED_EMAIL_KEY) || "");
    setAuthSessionMode(nextMode);
    setAuthAvailableModes(nextAvailableModes);
    if (nextMode === "admin") {
      setCurrentPage("admin");
      return;
    }
    if (promptForMode && nextAvailableModes.includes("admin")) {
      setCurrentPage("mode-select");
      return;
    }
    setCurrentPage("capture");
  };

  const refreshSessionIfNeeded = async (tokenOverride = "") => {
    const currentToken = tokenOverride || authToken;
    if (!currentToken) return currentToken;
    const expiryTimestamp = getTokenExpiryTimestamp(currentToken);
    if (!expiryTimestamp || expiryTimestamp - Date.now() > 12 * 60 * 1000) return currentToken;

    let transientAttempt = 0;
    while (true) {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${currentToken}` } }, 20000);
        const data = await parseJsonSafe(response);
        if (response.status === 401) {
          clearSession("Your session expired. Please sign in again.");
          throw new Error("Your session expired. Please sign in again.");
        }
        if (!response.ok) {
          const requestError = new Error(data.detail || "Could not refresh your session.");
          requestError.transient = isTransientHttpStatus(response.status) || isTransientServerConnectionMessage(requestError.message);
          throw requestError;
        }
        const nextToken = data.token || currentToken;
        setAuthToken(nextToken);
        setAuthEmail(data.email || authEmail || "");
        setAuthSessionMode(data.session_mode || authSessionMode || "user");
        setAuthAvailableModes(Array.isArray(data.available_modes) ? data.available_modes : authAvailableModes);
        return nextToken;
      } catch (err) {
        const message = String(err?.message || "");
        const isTransient = Boolean(err?.transient) || isTransientServerConnectionMessage(message);
        const tokenStillUsable = expiryTimestamp - Date.now() > 60 * 1000;

        if (isTransient && transientAttempt < 1) {
          transientAttempt += 1;
          await wait(1200 * transientAttempt);
          continue;
        }

        if (isTransient && tokenStillUsable) {
          setAuthMessage((current) => current || "Using your saved session while the server reconnects.");
          return currentToken;
        }

        throw err;
      }
    }
  };

  const finishGoogleLogin = async (credential) => {
    setAuthMessage("");
    const previewEmail = extractEmailFromJwt(credential);
    if (previewEmail) setAuthEmailInput(previewEmail);
    setIsGoogleSigningIn(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Google sign-in failed.");
      applyAuthResponse(data, data.email || previewEmail || "", { promptForMode: true });
      setStatus("Signed in successfully.");
      setAuthMessage(data?.available_modes?.includes("admin") ? "Choose user mode or admin mode to continue." : "You are signed in.");
    } catch (err) {
      setAuthMessage(err.message || "Google sign-in failed.");
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const finishAppleLogin = async ({ authorizationCode = "", idToken = "", nonce = "", state = "", user = null, redirectUri = "" }) => {
    setAuthMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/apple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorization_code: authorizationCode,
          id_token: idToken,
          nonce,
          state,
          user,
          redirect_uri: redirectUri,
        }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Apple sign-in failed.");
      applyAuthResponse(data, data.email || "", { promptForMode: true });
      setStatus("Signed in successfully.");
      setAuthMessage(data?.available_modes?.includes("admin") ? "Choose user mode or admin mode to continue." : "You are signed in.");
    } catch (err) {
      setAuthMessage(err.message || "Apple sign-in failed.");
    }
  };

  const resetRegistrationFlow = ({ keepEmail = true } = {}) => {
    setRegisterStep("email");
    setPendingRegistrationToken("");
    setPendingEmailAuthMode("");
    setPendingEmailAuthEmail("");
    setAuthCodeInput("");
    setAuthPasswordInput("");
    setAuthConfirmPasswordInput("");
    setShowAuthPassword(false);
    if (!keepEmail) setAuthEmailInput("");
  };

  const validateAuthEmailInput = (rawValue = authEmailInput) => {
    const email = String(rawValue || "").trim().toLowerCase();
    if (!email) throw new Error("Enter your email address.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
    return email;
  };

  const validateAuthPasswordInput = (rawValue = authPasswordInput) => {
    const password = String(rawValue || "");
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    return password;
  };

  const validateAuthPasswordConfirmation = () => {
    const password = validateAuthPasswordInput(authPasswordInput);
    if (password !== authConfirmPasswordInput) {
      throw new Error("Password and confirm password must match.");
    }
    return password;
  };

  const signInWithEmailPassword = async () => {
    let email = "";
    setAuthMessage("");
    try {
      email = validateAuthEmailInput();
      validateAuthPasswordInput();
    } catch (err) {
      setAuthMessage(err.message || "Enter your email and password.");
      return;
    }

    setIsSigningInWithPassword(true);
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/email-password/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: authPasswordInput,
          mode: "login",
        }),
      }, 20000);
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not sign in.");
      applyAuthResponse(data, email, { promptForMode: true });
      setAuthPasswordInput("");
      setAuthConfirmPasswordInput("");
      setAuthCodeInput("");
      setPendingRegistrationToken("");
      setRegisterStep("email");
      setPendingEmailAuthEmail("");
      setPendingEmailAuthMode("");
      setStatus("Signed in successfully.");
      setAuthMessage(data?.available_modes?.includes("admin") ? "Choose user mode or admin mode to continue." : "You are signed in.");
    } catch (err) {
      setAuthMessage(getReadableRequestError(err));
    } finally {
      setIsSigningInWithPassword(false);
    }
  };

  const requestRegistrationCode = async () => {
    let email = "";
    setAuthMessage("");
    try {
      email = validateAuthEmailInput();
    } catch (err) {
      setAuthMessage(err.message || "Enter your email address.");
      return;
    }

    setIsRequestingEmailCode(true);
    try {
      setStatus("Requesting verification code...");
      await fetchJsonWithTransientRetries(`${API_BASE_URL}/auth/email-password/register/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
        }),
      }, { timeoutMs: 70000, retries: 1 });
      setAuthEmailInput(email);
      setPendingEmailAuthEmail(email);
      setPendingEmailAuthMode("register");
      setPendingRegistrationToken("");
      setAuthCodeInput("");
      setAuthPasswordInput("");
      setAuthConfirmPasswordInput("");
      setRegisterStep("verify");
      setStatus("Verification code sent.");
      setAuthMessage("Verification code sent. Check your email, then verify it below.");
    } catch (err) {
      setAuthMessage(getReadableRequestError(err));
    } finally {
      setIsRequestingEmailCode(false);
    }
  };

  const verifyRegistrationCode = async () => {
    const email = pendingEmailAuthEmail || authEmailInput.trim().toLowerCase();
    if (!email) {
      setAuthMessage("Enter your email first.");
      return;
    }
    if (!authCodeInput.trim()) {
      setAuthMessage("Enter the verification code from your email.");
      return;
    }

    setIsVerifyingEmailCode(true);
    setAuthMessage("");
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/email-password/register/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code: authCodeInput.trim(),
        }),
      }, 20000);
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Verification failed.");
      if (!data.registration_token) throw new Error("Verification succeeded, but password setup could not continue. Please try again.");
      setPendingEmailAuthEmail(email);
      setPendingEmailAuthMode("register");
      setPendingRegistrationToken(data.registration_token);
      setAuthCodeInput("");
      setRegisterStep("password");
      setAuthMessage("Email verified. Create and confirm your password to finish the account.");
    } catch (err) {
      setAuthMessage(getReadableRequestError(err));
    } finally {
      setIsVerifyingEmailCode(false);
    }
  };

  const completeRegistrationWithPassword = async () => {
    let email = "";
    let password = "";
    setAuthMessage("");
    if (!pendingRegistrationToken) {
      setAuthMessage("Verify your email first before creating a password.");
      return;
    }
    try {
      email = validateAuthEmailInput(pendingEmailAuthEmail || authEmailInput);
      password = validateAuthPasswordConfirmation();
    } catch (err) {
      setAuthMessage(err.message || "Create and confirm your password.");
      return;
    }

    setIsSigningInWithPassword(true);
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/email-password/register/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          registration_token: pendingRegistrationToken,
        }),
      }, 20000);
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not create your account.");
      applyAuthResponse(data, email, { promptForMode: true });
      setAuthMode("login");
      setRegisterStep("email");
      setPendingRegistrationToken("");
      setAuthPasswordInput("");
      setAuthConfirmPasswordInput("");
      setAuthCodeInput("");
      setPendingEmailAuthEmail("");
      setPendingEmailAuthMode("");
      setStatus("Account created successfully.");
      setAuthMessage(
        data?.available_modes?.includes("admin")
          ? "Choose user mode or admin mode to continue."
          : "You are signed in. Your history will sync to this email on any device.",
      );
    } catch (err) {
      setAuthMessage(getReadableRequestError(err));
    } finally {
      setIsSigningInWithPassword(false);
    }
  };

  const requestEmailPasswordCode = async () => {
    setAuthMessage("");
    let email = "";
    let password = "";
    try {
      email = validateAuthEmailInput();
      password = authMode === "reset" ? validateAuthPasswordConfirmation() : validateAuthPasswordInput();
    } catch (err) {
      setAuthMessage(err.message || "Enter your email and password.");
      return;
    }

    setIsRequestingEmailCode(true);
    try {
      setStatus(authMode === "reset" ? "Requesting password reset code..." : "Requesting verification code...");
      await fetchJsonWithTransientRetries(`${API_BASE_URL}/auth/email-password/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          mode: authMode,
        }),
      }, { timeoutMs: 70000, retries: 1 });
      setAuthEmailInput(email);
      setPendingEmailAuthEmail(email);
      setPendingEmailAuthMode(authMode);
      setAuthCodeInput("");
      setStatus(authMode === "reset" ? "Password reset code sent." : "Verification code sent.");
      setAuthMessage("Verification code sent. Check your email, then enter the code below.");
    } catch (err) {
      setAuthMessage(getReadableRequestError(err));
    } finally {
      setIsRequestingEmailCode(false);
    }
  };

  const verifyEmailPasswordCode = async () => {
    const email = pendingEmailAuthEmail || authEmailInput.trim().toLowerCase();
    if (!email) {
      setAuthMessage("Enter your email first.");
      return;
    }
    if (!authCodeInput.trim()) {
      setAuthMessage("Enter the verification code from your email.");
      return;
    }
    try {
      if ((pendingEmailAuthMode || authMode) === "reset") {
        validateAuthPasswordConfirmation();
      } else {
        validateAuthPasswordInput();
      }
    } catch (err) {
      setAuthMessage(err.message || `Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setIsVerifyingEmailCode(true);
    setAuthMessage("");
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/email-password/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: authPasswordInput,
          code: authCodeInput.trim(),
          mode: pendingEmailAuthMode || authMode,
        }),
      }, 20000);
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Verification failed.");
      applyAuthResponse(data, email, { promptForMode: true });
      setAuthPasswordInput("");
      setAuthConfirmPasswordInput("");
      setAuthCodeInput("");
      setPendingRegistrationToken("");
      setRegisterStep("email");
      setPendingEmailAuthEmail("");
      setPendingEmailAuthMode("");
      setAuthMode("login");
      setStatus((pendingEmailAuthMode || authMode) === "reset" ? "Password reset successfully." : "Signed in successfully.");
      setAuthMessage(data?.available_modes?.includes("admin") ? "Choose user mode or admin mode to continue." : "You are signed in.");
    } catch (err) {
      setAuthMessage(getReadableRequestError(err));
    } finally {
      setIsVerifyingEmailCode(false);
    }
  };

  const handleAuthFormSubmit = async (event) => {
    event.preventDefault();
    if (isRegistrationVerificationStep) {
      await verifyRegistrationCode();
      return;
    }
    if (showResetVerificationCard) {
      await verifyEmailPasswordCode();
      return;
    }
    if (authMode === "login") {
      await signInWithEmailPassword();
      return;
    }
    if (isRegistrationEmailStep) {
      await requestRegistrationCode();
      return;
    }
    if (isRegistrationPasswordStep) {
      await completeRegistrationWithPassword();
      return;
    }
    if (isResetMode) {
      await requestEmailPasswordCode();
    }
  };

  const startForgotPassword = () => {
    setAuthMode("reset");
    setRegisterStep("email");
    setPendingRegistrationToken("");
    setPendingEmailAuthMode("");
    setPendingEmailAuthEmail("");
    setAuthCodeInput("");
    setAuthPasswordInput("");
    setAuthConfirmPasswordInput("");
    setAuthMessage("Enter your email and a new password, then verify with the code sent to your email.");
  };

  const openLoginMode = () => {
    setAuthMode("login");
    resetRegistrationFlow();
    setAuthMessage("");
  };

  const openRegisterMode = () => {
    setAuthMode("register");
    resetRegistrationFlow();
    setAuthMessage("Enter your email and we will send a verification code.");
  };

  const startAppleLogin = async () => {
    setAuthMessage("");
    if (!APPLE_CLIENT_ID) {
      setAuthMessage("Apple sign-in is not available on this website yet.");
      return;
    }
    if (!isAppleWebSigninSupported()) {
      setAuthMessage("Apple sign-in needs an HTTPS website on a real domain.");
      return;
    }

    setIsAppleSigningIn(true);
    try {
      await ensureAppleAuthScript();
      const redirectUri = buildAppleRedirectUri();
      const state = createBrowserSafeToken(24);
      const nonce = createBrowserSafeToken(24);

      window.AppleID.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: "name email",
        redirectURI: redirectUri,
        state,
        nonce,
        usePopup: true,
      });

      const result = await window.AppleID.auth.signIn();
      const authorization = result?.authorization || {};
      if (!authorization.code && !authorization.id_token) {
        throw new Error("Apple sign-in did not return a usable credential.");
      }
      if (authorization.state && authorization.state !== state) {
        throw new Error("Apple sign-in state verification failed.");
      }

      await finishAppleLogin({
        authorizationCode: authorization.code || "",
        idToken: authorization.id_token || "",
        nonce,
        state,
        user: result?.user || null,
        redirectUri,
      });
    } catch (error) {
      setAuthMessage(normalizeAppleSignInError(error));
    } finally {
      setIsAppleSigningIn(false);
    }
  };

  useEffect(() => {
    if (authToken || !authChecked) return;
    if (!GOOGLE_CLIENT_ID) {
      return;
    }

    let cancelled = false;
    const renderGoogleButton = () => {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return;
      googleButtonRef.current.innerHTML = "";
      const buttonWidth = Math.min(320, googleButtonRef.current.clientWidth || googleButtonRef.current.parentElement?.clientWidth || 320);
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (!response?.credential) {
            setAuthMessage("Google sign-in did not return a valid credential.");
            return;
          }
          await finishGoogleLogin(response.credential);
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "filled_black",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: buttonWidth,
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector('script[data-google-signin="mabaso"]');
    const script = existingScript || document.createElement("script");
    if (!existingScript) {
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.googleSignin = "mabaso";
      document.body.appendChild(script);
    }

    const handleLoad = () => {
      renderGoogleButton();
    };

    script.addEventListener("load", handleLoad);

    return () => {
      cancelled = true;
      script.removeEventListener("load", handleLoad);
    };
  }, [authChecked, authToken]);

  useEffect(() => {
    if (authToken || !authChecked || !APPLE_CLIENT_ID || !isAppleWebSigninSupported()) return;
    ensureAppleAuthScript().catch(() => {
      // The button can still try again on click.
    });
  }, [authChecked, authToken]);

  const authFetch = async (path, options = {}) => {
    const { timeoutMs = 30000, tokenOverride = "", ...requestOptions } = options;
    const currentToken = tokenOverride || authToken;
    if (!currentToken) throw new Error("Please sign in to continue.");
    const activeToken = await refreshSessionIfNeeded(tokenOverride);
    const headers = new Headers(requestOptions.headers || {});
    headers.set("Authorization", `Bearer ${activeToken}`);
    let response;
    try {
      response = await fetchWithTimeout(`${API_BASE_URL}${path}`, { ...requestOptions, headers }, timeoutMs);
    } catch (err) {
      throw new Error(getReadableRequestError(err));
    }
    if (response.status === 401) {
      clearSession("Your session expired. Please sign in again.");
      throw new Error("Your session expired. Please sign in again.");
    }
    return response;
  };

  const authJsonWithTransientRetries = async (path, options = {}, { timeoutMs = 30000, retries = 0, tokenOverride = "" } = {}) => {
    let attempt = 0;
    while (true) {
      try {
        const response = await authFetch(path, { ...options, timeoutMs, tokenOverride });
        const data = await parseJsonSafe(response);
        if (!response.ok) {
          const requestError = new Error(data.detail || "Request failed.");
          requestError.transient = isTransientHttpStatus(response.status) || isTransientServerConnectionMessage(requestError.message);
          requestError.response = response;
          requestError.data = data;
          throw requestError;
        }
        return { response, data };
      } catch (err) {
        const message = String(err?.message || "");
        const isTransient = Boolean(err?.transient) || isTransientServerConnectionMessage(message);
        if (!isTransient || attempt >= retries) throw err;
        attempt += 1;
        await wait(1200 * attempt);
      }
    }
  };

  const chooseSessionMode = async (mode, { silent = false } = {}) => {
    const targetMode = mode === "admin" ? "admin" : "user";
    if (targetMode === "user" && authSessionMode === "user") {
      setCurrentPage("capture");
      if (!silent) setStatus("User mode opened.");
      return;
    }

    try {
      const response = await authFetch("/auth/select-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: targetMode }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not switch session mode.");
      const nextToken = data.token || authToken;
      applyAuthResponse({ ...data, token: nextToken }, authEmail, { promptForMode: false });
      if (targetMode === "admin") {
        await loadAdminDashboard(true, nextToken);
      }
      if (!silent) setStatus(targetMode === "admin" ? "Admin mode opened." : "User mode opened.");
    } catch (err) {
      if (!silent) setError(err.message || "Could not switch session mode.");
    }
  };

  const pushHistoryToServer = async (items) => {
    const response = await authFetch("/history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: normalizeHistoryItems(items) }),
    });
    const data = await parseJsonSafe(response);
    if (!response.ok) throw new Error(data.detail || "Could not save history.");
    return normalizeHistoryItems(data.items || items);
  };

  const loadHistoryFromServer = async () => {
    const response = await authFetch("/history");
    const data = await parseJsonSafe(response);
    if (!response.ok) throw new Error(data.detail || "Could not load history.");
    return normalizeHistoryItems(data.items || []);
  };

  const loadAdminDashboard = async (silent = false, tokenOverride = "") => {
    if (!(tokenOverride || authToken)) return;
    const shouldShowLoader = !silent || !hasLoadedAdminDashboardRef.current;
    if (shouldShowLoader) setIsLoadingAdminDashboard(true);
    try {
      const response = await authFetch("/admin/dashboard", { tokenOverride });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not load the admin dashboard.");
      hasLoadedAdminDashboardRef.current = true;
      setAdminDashboard(data);
    } catch (err) {
      if (!silent) setError(err.message || "Could not load the admin dashboard.");
      if (/admin access/i.test(String(err?.message || "").toLowerCase())) {
        setCurrentPage("capture");
      }
    } finally {
      if (shouldShowLoader) setIsLoadingAdminDashboard(false);
    }
  };

  const updateAdminUserStatus = async (email, statusValue) => {
    try {
      const response = await authFetch(`/admin/users/${encodeURIComponent(email)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusValue }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not update this user.");
      setStatus(`${email} is now ${statusValue}.`);
      await loadAdminDashboard(true);
    } catch (err) {
      setError(err.message || "Could not update this user.");
    }
  };

  const forceLogoutAdminUser = async (email) => {
    try {
      const response = await authFetch(`/admin/users/${encodeURIComponent(email)}/force-logout`, {
        method: "POST",
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not force logout for this user.");
      setStatus(`${email} was signed out from active sessions.`);
      await loadAdminDashboard(true);
    } catch (err) {
      setError(err.message || "Could not force logout for this user.");
    }
  };

  useEffect(() => {
    if (!authChecked || !authToken || !authEmail) return undefined;

    let cancelled = false;
    historyHydratingRef.current = true;

    const hydrateHistory = async () => {
      try {
        const remoteItems = await loadHistoryFromServer();
        if (cancelled) return;
        const mergedItems = mergeHistoryItems(loadHistoryItems(authEmail), remoteItems);
        skipNextHistorySyncRef.current = true;
        setHistoryItems(mergedItems);
        setActiveHistoryId((current) => (mergedItems.some((item) => item.id === current) ? current : ""));

        const mergedChanged = JSON.stringify(mergedItems) !== JSON.stringify(remoteItems);
        if (mergedChanged) {
          await pushHistoryToServer(mergedItems);
        }
      } catch (err) {
        if (!cancelled) {
          setAuthMessage((current) => current || (err.message || "Could not sync your history right now."));
        }
      } finally {
        if (!cancelled) historyHydratingRef.current = false;
      }
    };

    hydrateHistory();

    return () => {
      cancelled = true;
      historyHydratingRef.current = false;
    };
  }, [authChecked, authEmail, authToken]);

  useEffect(() => {
    if (!authChecked || !authToken || !authEmail) return undefined;
    if (historyHydratingRef.current) return undefined;
    if (historyOwnerEmailRef.current !== normalizeHistoryOwnerEmail(authEmail)) return undefined;
    if (skipNextHistorySyncRef.current) {
      skipNextHistorySyncRef.current = false;
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      pushHistoryToServer(historyItems).then((serverItems) => {
        skipNextHistorySyncRef.current = true;
        setHistoryItems(serverItems);
      }).catch(() => {
        // Keep the local history cache if the server is temporarily unavailable.
      });
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authChecked, authEmail, authToken, historyItems]);

  const refreshCollaborationRooms = async (silent = false) => {
    if (!authToken) return;
    try {
      const response = await authFetch("/collaboration/rooms");
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not load collaboration rooms.");
      setCollaborationRooms(data.rooms || []);
    } catch (err) {
      if (!silent) setError(err.message || "Could not load collaboration rooms.");
    }
  };

  const loadCollaborationRoom = async (roomId, options = {}) => {
    const { silent = false, resetNotesDraft = false } = options;
    if (!roomId) return;
    if (!silent) setIsRoomLoading(true);
    try {
      const response = await authFetch(`/collaboration/rooms/${roomId}`);
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not open the collaboration room.");
      setActiveRoomId(roomId);
      setActiveRoom(data.room || null);
      if (resetNotesDraft) setRoomSharedNotesDraft(data.room?.shared_notes || "");
      if (!silent) setStatus(`Opened ${data.room?.title || "the collaboration room"}.`);
    } catch (err) {
      if (!silent) setError(err.message || "Could not open the collaboration room.");
    } finally {
      if (!silent) setIsRoomLoading(false);
    }
  };

  useEffect(() => {
    if (!authToken) {
      setCollaborationRooms([]);
      setActiveRoomId("");
      setActiveRoom(null);
      return;
    }
    refreshCollaborationRooms(true);
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !activeRoomId) return undefined;
    const interval = window.setInterval(() => {
      refreshCollaborationRooms(true);
      loadCollaborationRoom(activeRoomId, { silent: true });
    }, ROOM_REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [activeRoomId, authToken]);

  useEffect(() => {
    if (!authToken || authSessionMode !== "admin" || currentPage !== "admin") return undefined;
    loadAdminDashboard(true);
    const intervalId = window.setInterval(() => {
      loadAdminDashboard(true);
    }, ADMIN_DASHBOARD_REFRESH_MS);
    const handleDashboardRefresh = () => {
      if (document.visibilityState === "hidden") return;
      loadAdminDashboard(true);
    };
    window.addEventListener("focus", handleDashboardRefresh);
    document.addEventListener("visibilitychange", handleDashboardRefresh);
    return () => {
      window.removeEventListener("focus", handleDashboardRefresh);
      document.removeEventListener("visibilitychange", handleDashboardRefresh);
      window.clearInterval(intervalId);
    };
  }, [authSessionMode, authToken, currentPage]);

  useEffect(() => {
    if (!followRoomView || !activeRoom?.active_tab) return;
    setActiveTab(activeRoom.active_tab);
  }, [activeRoom?.active_tab, activeTab, followRoomView]);

  useEffect(() => {
    if (!activeRoom?.id) {
      setRoomQuizAnswers({});
      setRoomQuizAnswerImages({});
      setRoomQuizResults({});
      setRoomQuizSubmitted(false);
      return;
    }

    const nextAnswers = {};
    (activeRoom.quiz_questions || []).forEach((question) => {
      const matchingAnswer = (activeRoom.quiz_answers || []).find(
        (answer) => String(answer.question_number || "") === String(question.number || "") && answer.author_email === authEmail,
      );
      if (!matchingAnswer) return;
      nextAnswers[question.number] = parseStoredRoomQuizAnswer(question, matchingAnswer.answer_text);
    });

    setRoomQuizAnswers(nextAnswers);
    setRoomQuizAnswerImages({});
    setRoomQuizResults({});
    setRoomQuizSubmitted(false);
  }, [activeRoom?.id, authEmail]);

  useEffect(() => () => {
    Object.values(answerSyncTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
  }, []);

  useEffect(() => {
    if (!isPodcastAutoPlaying || !activePodcastSegment?.objectUrl || !podcastAudioRef.current) return;
    const timerId = window.setTimeout(() => {
      podcastAudioRef.current?.play().catch(() => {
        setIsPodcastAutoPlaying(false);
      });
    }, 120);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [activePodcastSegment?.objectUrl, activePodcastSegmentIndex, isPodcastAutoPlaying]);

  const getActiveContent = () => {
    if (activeTab === "guide") return formattedGuide || "No study guide generated yet.";
    if (activeTab === "transcript") return transcript || "No transcript generated yet.";
    if (activeTab === "formulas") return formattedFormula || "No formulas generated yet.";
    if (activeTab === "examples") return formattedExample || "No worked examples generated yet.";
    if (activeTab === "flashcards") return flashcardsToText(flashcards) || "No flashcards generated yet.";
    if (activeTab === "quiz") return buildQuizExportText(selectedQuizQuestions, quizAnswers, quizResults) || "No test generated yet.";
    if (activeTab === "presentation") return presentationToText(presentationData) || "No PowerPoint presentation generated yet.";
    if (activeTab === "podcast") return podcastData.script || "No podcast debate generated yet.";
    if (activeTab === "chat") return chatToText(chatMessages) || "No study chat yet.";
    return collaborationRoomToText(activeRoom);
  };

  const buildCurrentStudyPackSections = () => [
    { title: "Study Guide", content: formattedGuide || summary },
    { title: "Transcript", content: transcript },
    { title: "Past Question Paper References", content: pastQuestionPapers },
    { title: "Formulas", content: formattedFormula || formula },
    { title: "Worked Examples", content: formattedExample || example },
    { title: "Flashcards", content: flashcardsToText(flashcards) },
    { title: "Test", content: quizToText(quizQuestions) },
    { title: "PowerPoint Presentation", content: presentationToText(presentationData) },
    { title: "Podcast Debate Script", content: podcastData.script || "" },
    { title: "Teacher Mode Lesson", content: teacherLessonToText(teacherLessonData) },
    { title: "Study Chat", content: chatToText(chatMessages) },
  ].filter((section) => (section.content || "").trim());

  const addHistoryItem = (item) => {
    const nextItem = upsertWorkspaceHistoryItem(item);
    persistWorkspaceDraft({ activeHistoryId: nextItem.id });
    return nextItem;
  };

  const loadHistoryItem = (item) => {
    replacePodcastAudioUrl("");
    replacePodcastAudioSegments([]);
    stopTeacherPlayback({ resetIndex: true });
    setPresentationTemplateFile(null);
    if (presentationTemplateInputRef.current) presentationTemplateInputRef.current.value = "";
    historyOwnerEmailRef.current = normalizeHistoryOwnerEmail(authEmail);
    startTransition(() => {
      setTranscript(item.transcript || "");
      setSummary(item.summary || "");
      setFormula(item.formula || "");
      setExample(item.example || "");
      setFlashcards(item.flashcards || []);
      setQuizQuestions(item.quizQuestions || []);
      setStudyImages(item.studyImages || []);
      setLectureNoteSources(
        normalizeStudySourceEntries(
          item.lectureNoteSources,
          item.lectureNotes,
          item.lectureNoteFileNames || [item.lectureNotesFileName],
          "LECTURE NOTE",
        ),
      );
      setPastQuestionMemo(item.pastQuestionMemo || "");
      setLectureSlideSources(normalizeStudySourceEntries(item.lectureSlideSources, item.lectureSlides, item.lectureSlideFileNames, "SLIDE SOURCE"));
      setPastQuestionPaperSources(
        normalizeStudySourceEntries(
          item.pastQuestionPaperSources,
          item.pastQuestionPapers,
          item.pastQuestionPaperFileNames,
          "PAST QUESTION PAPER",
        ),
      );
      const nextPresentationData = normalizePresentationData(item.presentationData);
      setPresentationData(nextPresentationData);
      setPresentationView(nextPresentationData.slides.length ? "viewer" : "setup");
      setSelectedPresentationDesign(nextPresentationData.designId || presentationDesigns[0].id);
      setPodcastData(normalizePodcastData(item.podcastData));
      setTeacherLessonData(normalizeTeacherLessonData(item.teacherLessonData));
      setPodcastSpeakerCount(Number(item.podcastData?.speakerCount || item.podcastData?.speaker_count || 2) >= 3 ? 3 : 2);
      setPodcastTargetMinutes(Number(item.podcastData?.targetMinutes || item.podcastData?.target_minutes || 10) || 10);
      setActivePodcastSegmentIndex(0);
      setIsPodcastAutoPlaying(false);
      setActiveTeacherSegmentIndex(-1);
      setIsTeacherPlaying(false);
      setIsTeacherPaused(false);
      setQuizAnswers({});
      setQuizAnswerImages({});
      setQuizResults({});
      setQuizSubmitted(false);
      setChatMessages([]);
      setChatReferenceImages([]);
      setActiveHistoryId(item.id);
      setActiveTab("guide");
      setCurrentPage("workspace");
    });
    setStatus(`Loaded ${item.title} from history.`);
  };

  const resetGeneratedOutputs = () => {
    stopTeacherPlayback({ resetIndex: true });
    setTranscript("");
    setSummary("");
    setFormula("");
    setExample("");
    setFlashcards([]);
    setQuizQuestions([]);
    setStudyImages([]);
    setPresentationData(createEmptyPresentationData());
    setPresentationView("setup");
    setSelectedPresentationDesign(presentationDesigns[0].id);
    setPodcastData(createEmptyPodcastData());
    setTeacherLessonData(createEmptyTeacherLessonData());
    setPodcastSpeakerCount(2);
    setPodcastTargetMinutes(10);
    replacePodcastAudioUrl("");
    replacePodcastAudioSegments([]);
    setActivePodcastSegmentIndex(0);
    setIsPodcastAutoPlaying(false);
    setActiveTeacherSegmentIndex(-1);
    setIsTeacherPlaying(false);
    setIsTeacherPaused(false);
    setQuizAnswers({});
    setQuizAnswerImages({});
    setQuizResults({});
    setQuizSubmitted(false);
    setChatMessages([]);
    setChatReferenceImages([]);
    setUsedFallbackSummary(false);
    setActiveHistoryId("");
  };

  const logout = async () => {
    try {
      if (authToken) await authFetch("/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout API errors.
    } finally {
      clearSession("You have signed out.");
      setStatus("");
      setError("");
    }
  };

  const submitSupportMessage = async () => {
    const message = supportMessageDraft.trim();
    if (!message) {
      setSupportFeedback("Write your message before sending it.");
      return;
    }

    setIsSendingSupport(true);
    setSupportFeedback("");
    try {
      const { data } = await authJsonWithTransientRetries("/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          page: currentPage,
          client_request_id: buildClientRequestId("support"),
        }),
      }, { timeoutMs: 90000, retries: 2 });
      setSupportMessageDraft("");
      setSupportFeedback(data.message || "Support message sent.");
    } catch (err) {
      setSupportFeedback(err.message || "Your support message could not be sent.");
    } finally {
      setIsSendingSupport(false);
    }
  };

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    clearRecoveredRecordingFromDb(getActiveWorkspaceOwnerEmail());
    startTransition(() => {
      setFile(selectedFile);
      setVideoUrl("");
    });
    setError("");
    setStatus(`${selectedFile.name} selected.`);
  };

  const cleanupRecordingMonitoring = ({ stopStream = false } = {}) => {
    if (recordingMonitorFrameRef.current) {
      window.cancelAnimationFrame(recordingMonitorFrameRef.current);
      recordingMonitorFrameRef.current = 0;
    }
    if (recordingSourceNodeRef.current) {
      try {
        recordingSourceNodeRef.current.disconnect();
      } catch {
        // Ignore disconnect errors when the node is already detached.
      }
      recordingSourceNodeRef.current = null;
    }
    recordingAnalyserRef.current = null;
    if (recordingAudioContextRef.current) {
      recordingAudioContextRef.current.close().catch(() => {
        // Ignore audio context shutdown errors.
      });
      recordingAudioContextRef.current = null;
    }
    if (stopStream && recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    recordingStreamRef.current = null;
    recordingLastSoundAtRef.current = 0;
  };

  const beginRecordingSilenceMonitoring = (stream) => {
    cleanupRecordingMonitoring();
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const sourceNode = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.92;
    sourceNode.connect(analyser);

    recordingStreamRef.current = stream;
    recordingAudioContextRef.current = audioContext;
    recordingSourceNodeRef.current = sourceNode;
    recordingAnalyserRef.current = analyser;
    recordingLastSoundAtRef.current = Date.now();

    audioContext.resume().catch(() => {
      // Browsers can start the context suspended. Recording still continues even if resume fails.
    });

    const samples = new Uint8Array(analyser.fftSize);
    const monitor = () => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== "recording" || !recordingAnalyserRef.current) {
        recordingMonitorFrameRef.current = 0;
        return;
      }

      recordingAnalyserRef.current.getByteTimeDomainData(samples);
      let sumSquares = 0;
      for (const sample of samples) {
        const normalized = (sample - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / samples.length);
      const now = Date.now();
      if (rms >= RECORDING_SILENCE_THRESHOLD) {
        recordingLastSoundAtRef.current = now;
      } else if (recordingLastSoundAtRef.current && now - recordingLastSoundAtRef.current >= RECORDING_SILENCE_AUTO_STOP_MS) {
        recordingStopReasonRef.current = "silence";
        setRecording(false);
        setStatus("10 minutes of silence detected. Stopping the recording and preparing transcription...");
        recorder.stop();
        recordingMonitorFrameRef.current = 0;
        return;
      }

      recordingMonitorFrameRef.current = window.requestAnimationFrame(monitor);
    };

    recordingMonitorFrameRef.current = window.requestAnimationFrame(monitor);
  };

  const extractStudySourceFiles = async (selectedFiles, { sourceName, sourcePrefix, onProgress, onStatus }) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return { extractedEntries: [], addedNames: [], skippedNames: [] };

    const extractedEntries = [];
    const addedNames = [];
    const skippedNames = [];
    for (const [index, selectedFile] of files.entries()) {
      const isTextFile = selectedFile.type.startsWith("text/") || /\.(txt|md|text)$/i.test(selectedFile.name || "");
      const isImageFile = selectedFile.type.startsWith("image/");
      onProgress?.(Math.min(90, 15 + Math.round(((index + 1) / files.length) * 70)));
      onStatus?.(`Reading ${sourceName} ${index + 1} of ${files.length}: ${selectedFile.name}`);
      if (isTextFile) {
        const text = normalizeStudySourceText(await selectedFile.text());
        if (isLikelyReadableStudySourceText(text)) {
          extractedEntries.push(createStudySourceEntry(selectedFile.name, text, sourcePrefix, {
            fileType: selectedFile.type || "",
          }));
          addedNames.push(selectedFile.name);
        } else if (text) {
          skippedNames.push(selectedFile.name);
        }
        continue;
      }
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await authFetch("/extract-slide-text/", {
        method: "POST",
        body: formData,
        timeoutMs: STUDY_SOURCE_EXTRACT_TIMEOUT_MS,
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || `Could not read ${selectedFile.name}.`);
      const cleanedText = normalizeStudySourceText(data.text || "");
      const extractedVisualReferences = Array.isArray(data.image_urls)
        ? data.image_urls.filter((item) => typeof item === "string" && item.trim()).slice(0, 6)
        : [];
      if (isLikelyReadableStudySourceText(cleanedText)) {
        extractedEntries.push(createStudySourceEntry(selectedFile.name, cleanedText, sourcePrefix, {
          previewUrl: isImageFile
            ? await readFileAsDataUrl(selectedFile)
            : extractedVisualReferences[0] || "",
          visualReferences: isImageFile
            ? [await readFileAsDataUrl(selectedFile)]
            : extractedVisualReferences,
          fileType: selectedFile.type || "",
          visualSource: isImageFile || extractedVisualReferences.length > 0,
        }));
        addedNames.push(selectedFile.name);
      } else if (cleanedText) {
        skippedNames.push(selectedFile.name);
      }
    }

    if (!extractedEntries.length) {
      throw new Error(`No readable ${sourceName} content could be extracted. Try clearer notes, cleaner scans, or a text-based file.`);
    }

    return { extractedEntries, addedNames, skippedNames };
  };

  const createStudySourceBatchSnapshot = (currentSources, sourcePrefix) => ({
    extractedEntries: [],
    addedNames: [],
    skippedNames: [],
    nextSources: currentSources,
    text: studySourceEntriesToText(currentSources, sourcePrefix),
  });

  const extractAndApplyStudySourceFiles = async (selectedFiles, {
    sourceName,
    sourcePrefix,
    currentSources,
    setSources,
    setBusy,
    jobType,
    startStatus,
    successMessage,
    failureStatus,
    interactive = true,
  }) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return createStudySourceBatchSnapshot(currentSources, sourcePrefix);

    setBusy(true);
    if (interactive) {
      setCurrentJobType(jobType);
      setError("");
      setStatus(startStatus);
      setProgress(10);
    }

    try {
      const result = await extractStudySourceFiles(files, {
        sourceName,
        sourcePrefix,
        onProgress: interactive ? (value) => setProgress(value) : undefined,
        onStatus: interactive ? (nextStatus) => setStatus(nextStatus) : undefined,
      });
      const nextSources = mergeStudySourceEntries(currentSources, result.extractedEntries);
      startTransition(() => {
        setSources((existing) => mergeStudySourceEntries(existing, result.extractedEntries));
      });
      if (interactive) {
        setStatus(successMessage(result));
        setProgress(100);
      }
      return {
        ...result,
        nextSources,
        text: studySourceEntriesToText(nextSources, sourcePrefix),
      };
    } catch (err) {
      if (interactive) {
        setError(err.message || failureStatus);
        setStatus(failureStatus);
      }
      throw err;
    } finally {
      setBusy(false);
      if (interactive) {
        setCurrentJobType("");
        setProgress(0);
      }
    }
  };

  const transcribeLectureFile = async (selectedFile, options = {}) => {
    const {
      autoGenerateGuide = true,
      guideOverrides = {},
      initialStatus = "Submitting lecture for transcription...",
      failureStatus = "Transcription failed.",
      surfaceError = true,
      resetOutputsBeforeTranscribe = true,
    } = options;

    if (!selectedFile) {
      throw new Error("Upload or record a lecture first.");
    }

    setIsTranscribing(true);
    if (surfaceError) setError("");
    setStatus(initialStatus);
    setProgress(0);
    if (resetOutputsBeforeTranscribe) resetGeneratedOutputs();
    setActiveTab("transcript");
    setCurrentJobType("transcription");
    startTransition(() => {
      setFile(selectedFile);
      setVideoUrl("");
    });

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await authFetch("/upload-audio/", { method: "POST", body: formData });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || failureStatus);
      persistPendingJob({
        jobId: data.job_id,
        jobType: "transcription",
        autoGenerateGuide,
        savedAt: new Date().toISOString(),
      });
      const job = await pollJob(data.job_id, "transcription");
      const transcriptText = job.transcript || "";
      startTransition(() => {
        setTranscript(transcriptText);
      });
      clearPendingJob();
      clearRecoveredRecordingFromDb(getActiveWorkspaceOwnerEmail());

      if (autoGenerateGuide) {
        setStatus("Transcript ready. Generating study guide...");
        setProgress(100);
        await generateStudyGuide(transcriptText, guideOverrides);
      } else {
        setStatus("Transcript ready.");
        setProgress(100);
      }

      return transcriptText;
    } catch (err) {
      clearPendingJob();
      if (surfaceError) {
        setError(err.message || failureStatus);
        setStatus(failureStatus);
      }
      throw err;
    } finally {
      setIsTranscribing(false);
      setCurrentJobType("");
    }
  };

  const handleLectureNotesFileChange = async (selectedFiles) => {
    await extractAndApplyStudySourceFiles(selectedFiles, {
      sourceName: "lecture note",
      sourcePrefix: "LECTURE NOTE",
      currentSources: lectureNoteSources,
      setSources: setLectureNoteSources,
      setBusy: setIsExtractingNotes,
      jobType: "notes",
      startStatus: "Reading lecture notes...",
      successMessage: ({ addedNames, skippedNames }) => (
        `${addedNames.length} lecture note source${addedNames.length === 1 ? "" : "s"} added.${skippedNames.length ? ` Skipped ${skippedNames.length} unreadable file${skippedNames.length === 1 ? "" : "s"}.` : ""}`
      ),
      failureStatus: "Lecture note reading failed.",
    });
  };

  const handleLectureSlidesFilesChange = async (selectedFiles) => {
    await extractAndApplyStudySourceFiles(selectedFiles, {
      sourceName: "slide source",
      sourcePrefix: "SLIDE SOURCE",
      currentSources: lectureSlideSources,
      setSources: setLectureSlideSources,
      setBusy: setIsExtractingSlides,
      jobType: "slides",
      startStatus: "Reading slide sources...",
      successMessage: ({ addedNames, skippedNames }) => (
        `${addedNames.length} slide source${addedNames.length === 1 ? "" : "s"} added.${skippedNames.length ? ` Skipped ${skippedNames.length} unreadable file${skippedNames.length === 1 ? "" : "s"}.` : ""}`
      ),
      failureStatus: "Slide reading failed.",
    });
  };

  const handlePastQuestionPapersFilesChange = async (selectedFiles) => {
    await extractAndApplyStudySourceFiles(selectedFiles, {
      sourceName: "past question paper",
      sourcePrefix: "PAST QUESTION PAPER",
      currentSources: pastQuestionPaperSources,
      setSources: setPastQuestionPaperSources,
      setBusy: setIsExtractingPastPapers,
      jobType: "past_papers",
      startStatus: "Reading past question papers...",
      successMessage: ({ addedNames, skippedNames }) => (
        `${addedNames.length} past question paper${addedNames.length === 1 ? "" : "s"} added.${skippedNames.length ? ` Skipped ${skippedNames.length} unreadable file${skippedNames.length === 1 ? "" : "s"}.` : ""} Generate the study guide again to refresh notes and test questions with this reference.`
      ),
      failureStatus: "Past question paper reading failed.",
    });
  };

  const handleLectureBundleFilesChange = async (selectedFiles) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return;

    const lectureMediaFiles = [];
    const noteFiles = [];
    const slideFiles = [];
    const pastPaperFiles = [];

    for (const selectedFile of files) {
      const classification = classifyLectureBundleFile(selectedFile);
      if (classification === "lecture") {
        lectureMediaFiles.push(selectedFile);
      } else if (classification === "past_paper") {
        pastPaperFiles.push(selectedFile);
      } else if (classification === "note") {
        noteFiles.push(selectedFile);
      } else {
        slideFiles.push(selectedFile);
      }
    }

    const activeLectureMediaFile = lectureMediaFiles[0] || null;
    const noteBaseSources = lectureNoteSources;
    const slideBaseSources = lectureSlideSources;
    const pastPaperBaseSources = pastQuestionPaperSources;
    const warningMessages = [];

    setError("");
    setStatus(`Sorting ${files.length} lecture file${files.length === 1 ? "" : "s"} into the right sections...`);
    setProgress(4);
    setIsProcessingLectureBundle(true);

    if (activeLectureMediaFile) {
      startTransition(() => {
        setFile(activeLectureMediaFile);
        setVideoUrl("");
      });
    } else {
      resetGeneratedOutputs();
      startTransition(() => {
        setFile(null);
        setVideoUrl("");
      });
    }

    const notePromise = extractAndApplyStudySourceFiles(noteFiles, {
      sourceName: "lecture note",
      sourcePrefix: "LECTURE NOTE",
      currentSources: noteBaseSources,
      setSources: setLectureNoteSources,
      setBusy: setIsExtractingNotes,
      jobType: "notes",
      startStatus: "Reading lecture notes...",
      successMessage: () => "",
      failureStatus: "Lecture note reading failed.",
      interactive: false,
    });
    const slidePromise = extractAndApplyStudySourceFiles(slideFiles, {
      sourceName: "slide source",
      sourcePrefix: "SLIDE SOURCE",
      currentSources: slideBaseSources,
      setSources: setLectureSlideSources,
      setBusy: setIsExtractingSlides,
      jobType: "slides",
      startStatus: "Reading slide sources...",
      successMessage: () => "",
      failureStatus: "Slide reading failed.",
      interactive: false,
    });
    const pastPaperPromise = extractAndApplyStudySourceFiles(pastPaperFiles, {
      sourceName: "past question paper",
      sourcePrefix: "PAST QUESTION PAPER",
      currentSources: pastPaperBaseSources,
      setSources: setPastQuestionPaperSources,
      setBusy: setIsExtractingPastPapers,
      jobType: "past_papers",
      startStatus: "Reading past question papers...",
      successMessage: () => "",
      failureStatus: "Past question paper reading failed.",
      interactive: false,
    });
    const transcriptPromise = activeLectureMediaFile
      ? transcribeLectureFile(activeLectureMediaFile, {
        autoGenerateGuide: false,
        initialStatus: noteFiles.length || slideFiles.length || pastPaperFiles.length
          ? "Reading notes and slides, then transcribing the lecture automatically..."
          : "Submitting lecture for transcription...",
        surfaceError: false,
      })
      : Promise.resolve("");

    try {
      const [noteOutcome, slideOutcome, pastPaperOutcome, transcriptOutcome] = await Promise.allSettled([
        notePromise,
        slidePromise,
        pastPaperPromise,
        transcriptPromise,
      ]);

      const noteResult = noteOutcome.status === "fulfilled"
        ? noteOutcome.value
        : createStudySourceBatchSnapshot(noteBaseSources, "LECTURE NOTE");
      const slideResult = slideOutcome.status === "fulfilled"
        ? slideOutcome.value
        : createStudySourceBatchSnapshot(slideBaseSources, "SLIDE SOURCE");
      const pastPaperResult = pastPaperOutcome.status === "fulfilled"
        ? pastPaperOutcome.value
        : createStudySourceBatchSnapshot(pastPaperBaseSources, "PAST QUESTION PAPER");
      const transcriptText = transcriptOutcome.status === "fulfilled" ? transcriptOutcome.value : "";

      if (noteOutcome.status === "rejected") warningMessages.push(noteOutcome.reason?.message || "Lecture notes could not be read automatically.");
      if (slideOutcome.status === "rejected") warningMessages.push(slideOutcome.reason?.message || "Slides could not be read automatically.");
      if (pastPaperOutcome.status === "rejected") warningMessages.push(pastPaperOutcome.reason?.message || "Past papers could not be read automatically.");
      if (transcriptOutcome.status === "rejected") warningMessages.push(transcriptOutcome.reason?.message || "Lecture transcription failed.");

      const resolvedPastQuestionPapers = [
        pastPaperResult.text,
        pastQuestionMemo.trim() ? `PAST QUESTION PAPER MEMO\n${pastQuestionMemo.trim()}` : "",
      ].filter(Boolean).join("\n\n");

      if (!(transcriptText.trim() || noteResult.text.trim() || slideResult.text.trim() || resolvedPastQuestionPapers.trim())) {
        throw new Error(warningMessages[0] || "No lecture files were ready to process.");
      }

      setError("");
      setStatus("Lecture sources are ready. Generating the study guide...");
      await generateStudyGuide(transcriptText, {
        lectureNotesText: noteResult.text,
        lectureSlidesText: slideResult.text,
        pastQuestionPapersText: resolvedPastQuestionPapers,
        lectureNoteSources: noteResult.nextSources,
        lectureSlideSources: slideResult.nextSources,
        pastQuestionPaperSources: pastPaperResult.nextSources,
        pastQuestionMemo,
      });

      const summaryParts = [];
      if (activeLectureMediaFile) summaryParts.push("1 lecture file");
      if (noteResult.addedNames.length) summaryParts.push(`${noteResult.addedNames.length} note source${noteResult.addedNames.length === 1 ? "" : "s"}`);
      if (slideResult.addedNames.length) summaryParts.push(`${slideResult.addedNames.length} slide source${slideResult.addedNames.length === 1 ? "" : "s"}`);
      if (pastPaperResult.addedNames.length) summaryParts.push(`${pastPaperResult.addedNames.length} past paper source${pastPaperResult.addedNames.length === 1 ? "" : "s"}`);
      const extraMediaNote = lectureMediaFiles.length > 1 ? " The first lecture media file was kept as the active lecture file." : "";
      const warningNote = warningMessages.length ? ` ${warningMessages[0]}` : "";
      setStatus(`Lecture files processed: ${summaryParts.length ? summaryParts.join(", ") : "readable study sources"} ready.${extraMediaNote}${warningNote}`);
    } catch (err) {
      setError(err.message || "Lecture bundle processing failed.");
      setStatus("Lecture bundle processing failed.");
    } finally {
      setIsProcessingLectureBundle(false);
      setCurrentJobType("");
      setProgress(0);
    }
  };

  const removeLectureNoteSource = (sourceId) => {
    setLectureNoteSources((current) => current.filter((item) => item.id !== sourceId));
    setStatus("Lecture note source removed.");
  };

  const removeLectureSlideSource = (sourceId) => {
    setLectureSlideSources((current) => current.filter((item) => item.id !== sourceId));
    setStatus("Slide source removed.");
  };

  const removePastQuestionPaperSource = (sourceId) => {
    setPastQuestionPaperSources((current) => current.filter((item) => item.id !== sourceId));
    setStatus("Past question paper removed.");
  };

  const handleChatReferenceFilesChange = async (selectedFiles) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return;
    setError("");
    const remainingSlots = Math.max(0, MAX_CHAT_REFERENCE_IMAGES - chatReferenceImages.length);
    if (!remainingSlots) {
      setError(`You can attach up to ${MAX_CHAT_REFERENCE_IMAGES} reference images in one question.`);
      return;
    }
    try {
      const nextImages = [];
      for (const selectedFile of files.slice(0, remainingSlots)) {
        if (!selectedFile.type.startsWith("image/")) {
          throw new Error("Please upload image files for chat references.");
        }
        if (selectedFile.size > 5 * 1024 * 1024) {
          throw new Error("Each chat reference image must be smaller than 5 MB.");
        }
        const dataUrl = await readFileAsDataUrl(selectedFile);
        nextImages.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: selectedFile.name,
          dataUrl,
        });
      }
      setChatReferenceImages((current) => [...current, ...nextImages].slice(0, MAX_CHAT_REFERENCE_IMAGES));
      setStatus(`${nextImages.length} chat reference image${nextImages.length === 1 ? "" : "s"} added.`);
    } catch (err) {
      setError(err.message || "Could not read the reference image.");
    }
  };

  const removeChatReferenceImage = (imageId) => {
    setChatReferenceImages((current) => current.filter((item) => item.id !== imageId));
  };

  const startRecording = async () => {
    setError("");
    clearRecoveredRecordingFromDb(getActiveWorkspaceOwnerEmail());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordingStopReasonRef.current = "";
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const stopReason = recordingStopReasonRef.current || "manual";
        recordingStopReasonRef.current = "";
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        audioChunksRef.current = [];
        cleanupRecordingMonitoring({ stopStream: true });
        const recordedFile = new File([blob], "mabaso-lecture.wav", { type: "audio/wav" });
        await saveRecoveredRecordingToDb(getActiveWorkspaceOwnerEmail(), {
          blob,
          fileName: recordedFile.name,
          type: recordedFile.type,
        });
        startTransition(() => {
          setFile(recordedFile);
          setVideoUrl("");
        });
        setRecording(false);
        if (stopReason === "silence") {
          setStatus("10 minutes of silence detected. Transcribing the saved recording...");
          try {
            await transcribeLectureFile(recordedFile, {
              initialStatus: "10 minutes of silence detected. Transcribing the saved recording...",
            });
          } catch {
            // transcribeLectureFile already updates the UI error state when auto-processing fails.
          }
        } else {
          setStatus("Recording saved. It will still be here after refresh.");
        }
      };
      beginRecordingSilenceMonitoring(stream);
      mediaRecorderRef.current.start(1000);
      setRecording(true);
      setStatus("Recording started. MABASO will stop automatically after 10 minutes of silence.");
    } catch {
      cleanupRecordingMonitoring({ stopStream: true });
      setError("Microphone access failed. Please allow recording permissions.");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") return;
    recordingStopReasonRef.current = "manual";
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setStatus("Stopping the recording...");
  };

  const pollJob = async (jobId, jobType) => {
    let transientFailureCount = 0;
    while (true) {
      try {
        const response = await authFetch(`/jobs/${jobId}`, { timeoutMs: 120000 });
        const data = await parseJsonSafe(response);
        if (!response.ok) {
          const requestError = new Error(data.detail || "Could not read job status.");
          requestError.transient = isTransientHttpStatus(response.status) || isTransientServerConnectionMessage(requestError.message);
          throw requestError;
        }
        transientFailureCount = 0;
        setCurrentJobType(jobType);
        setStatus(data.stage || "Processing...");
        setProgress(Number(data.progress || 0));
        if (data.status === "failed") throw new Error(data.error || `${jobType} failed.`);
        if (data.status === "completed") return data;
        await wait(JOB_POLL_INTERVAL_MS);
      } catch (err) {
        const message = String(err?.message || "");
        const isTransient = Boolean(err?.transient) || isTransientServerConnectionMessage(message);
        if (!isTransient || transientFailureCount >= 5) throw err;
        transientFailureCount += 1;
        setStatus(`Connection dropped while checking ${jobType.replace(/_/g, " ")}. Retrying...`);
        await warmBackendServer();
        await wait(JOB_POLL_INTERVAL_MS * transientFailureCount);
      }
    }
  };

  const generateStudyGuide = async (transcriptText = transcript, sourceOverrides = {}) => {
    const resolvedTranscript = typeof transcriptText === "string" ? transcriptText : transcript;
    const resolvedLectureNoteSources = Array.isArray(sourceOverrides.lectureNoteSources) ? sourceOverrides.lectureNoteSources : lectureNoteSources;
    const resolvedLectureSlideSources = Array.isArray(sourceOverrides.lectureSlideSources) ? sourceOverrides.lectureSlideSources : lectureSlideSources;
    const resolvedPastQuestionPaperSources = Array.isArray(sourceOverrides.pastQuestionPaperSources) ? sourceOverrides.pastQuestionPaperSources : pastQuestionPaperSources;
    const resolvedPastQuestionMemo = typeof sourceOverrides.pastQuestionMemo === "string" ? sourceOverrides.pastQuestionMemo : pastQuestionMemo;
    const resolvedLectureNotes = typeof sourceOverrides.lectureNotesText === "string" ? sourceOverrides.lectureNotesText : lectureNotes;
    const resolvedLectureSlides = typeof sourceOverrides.lectureSlidesText === "string" ? sourceOverrides.lectureSlidesText : lectureSlides;
    const resolvedPastQuestionPapers = typeof sourceOverrides.pastQuestionPapersText === "string"
      ? sourceOverrides.pastQuestionPapersText
      : [
        studySourceEntriesToText(resolvedPastQuestionPaperSources, "PAST QUESTION PAPER"),
        resolvedPastQuestionMemo.trim() ? `PAST QUESTION PAPER MEMO\n${resolvedPastQuestionMemo.trim()}` : "",
      ].filter(Boolean).join("\n\n");
    if (!(resolvedTranscript.trim() || resolvedLectureNotes.trim() || resolvedLectureSlides.trim() || resolvedPastQuestionPapers.trim())) {
      return setError("Upload a transcript, notes, slides, or past question paper before generating a study guide.");
    }
    setIsGeneratingSummary(true);
    setError("");
    setUsedFallbackSummary(false);
    setCurrentJobType("study_guide");
    setStatus("Submitting study guide request...");
    setProgress(0);
    setChatMessages([]);
    try {
      let submitAttempt = 0;
      let jobRequest = null;
      while (!jobRequest) {
        try {
          const response = await authFetch("/generate-study-guide/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript: resolvedTranscript,
              lecture_notes: resolvedLectureNotes,
              lecture_slides: resolvedLectureSlides,
              past_question_papers: resolvedPastQuestionPapers,
              language: outputLanguage,
              reference_images: visualReferences.map((image) => image?.image_url).filter(Boolean).slice(0, 6),
            }),
            timeoutMs: 120000,
          });
          const data = await parseJsonSafe(response);
          if (!response.ok) {
            const requestError = new Error(data.detail || "Study guide generation failed.");
            requestError.transient = isTransientHttpStatus(response.status) || isTransientServerConnectionMessage(requestError.message);
            throw requestError;
          }
          jobRequest = data;
          persistPendingJob({
            jobId: data.job_id,
            jobType: "study_guide",
            savedAt: new Date().toISOString(),
          });
        } catch (err) {
          const message = String(err?.message || "");
          const isTransient = Boolean(err?.transient) || isTransientServerConnectionMessage(message);
          if (!isTransient || submitAttempt >= 3) throw err;
          submitAttempt += 1;
          setStatus("The Mabaso server is reconnecting. Retrying the study guide request...");
          await warmBackendServer();
          await wait(1400 * submitAttempt);
        }
      }
      const job = await pollJob(jobRequest.job_id, "study_guide");
      const resolvedLectureNoteFileNames = resolvedLectureNoteSources.map((item) => item.name);
      const resolvedLectureSlidesFileNames = resolvedLectureSlideSources.map((item) => item.name);
      const resolvedPastQuestionPaperFileNames = resolvedPastQuestionPaperSources.map((item) => item.name);
      const resolvedLectureNotesFileName = formatGroupedSourceLabel(resolvedLectureNoteFileNames, "note file", "note files");
      const sourceLabel = getPrimarySourceLabel({
        fileName: file?.name || "",
        videoUrl,
        lectureNotesFileName: resolvedLectureNotesFileName,
        lectureSlideFileNames: resolvedLectureSlidesFileNames,
        pastQuestionPaperFileNames: resolvedPastQuestionPaperFileNames,
      });
      replacePodcastAudioUrl("");
      replacePodcastAudioSegments([]);
      startTransition(() => {
        setSummary(job.summary || "");
        setFormula(job.formula || "");
        setExample(job.worked_example || "");
        setFlashcards(job.flashcards || []);
        setQuizQuestions([]);
        setStudyImages(Array.isArray(job.study_images) ? job.study_images : []);
        setQuizAnswers({});
        setQuizAnswerImages({});
        setQuizResults({});
        setQuizSubmitted(false);
        setPresentationData(createEmptyPresentationData());
        setPresentationView("setup");
        setSelectedPresentationDesign(presentationDesigns[0].id);
        setPodcastData(createEmptyPodcastData());
        setTeacherLessonData(createEmptyTeacherLessonData());
        setPodcastSpeakerCount(2);
        setPodcastTargetMinutes(10);
        setActivePodcastSegmentIndex(0);
        setIsPodcastAutoPlaying(false);
        setActiveTeacherSegmentIndex(-1);
        setIsTeacherPlaying(false);
        setIsTeacherPaused(false);
        addHistoryItem({
          id: activeHistoryId || "",
          title: extractHistoryTitle(job.summary || "", sourceLabel),
          fileName: sourceLabel,
          summary: job.summary || "",
          transcript: job.transcript || resolvedTranscript,
          formula: job.formula || "",
          example: job.worked_example || "",
          flashcards: job.flashcards || [],
          quizQuestions: [],
          studyImages: Array.isArray(job.study_images) ? job.study_images : [],
          lectureNotes: resolvedLectureNotes,
          lectureNotesFileName: resolvedLectureNotesFileName,
          lectureNoteSources: sanitizeStudySourceEntriesForHistory(resolvedLectureNoteSources),
          lectureNoteFileNames: resolvedLectureNoteFileNames,
          lectureSlides: resolvedLectureSlides,
          lectureSlideFileNames: resolvedLectureSlidesFileNames,
          lectureSlideSources: sanitizeStudySourceEntriesForHistory(resolvedLectureSlideSources),
          pastQuestionMemo: resolvedPastQuestionMemo,
          pastQuestionPapers: resolvedPastQuestionPapers,
          pastQuestionPaperFileNames: resolvedPastQuestionPaperFileNames,
          pastQuestionPaperSources: sanitizeStudySourceEntriesForHistory(resolvedPastQuestionPaperSources),
          presentationData: sanitizePresentationForHistory(createEmptyPresentationData()),
          podcastData: sanitizePodcastForHistory(createEmptyPodcastData()),
          teacherLessonData: sanitizeTeacherLessonForHistory(createEmptyTeacherLessonData()),
        });
      });
      clearPendingJob();
      setUsedFallbackSummary(Boolean(job.used_fallback));
      setActiveTab("guide");
      setCurrentPage("workspace");
      setStatus(job.used_fallback ? "Fallback study guide ready." : "Study guide ready.");
      setProgress(100);
    } catch (err) {
      const message = String(err?.message || "").trim();
      const isTransient = Boolean(err?.transient) || isTransientServerConnectionMessage(message);
      clearPendingJob();
      setError(isTransient ? getBackendConnectionTroubleshootingMessage("study-guide") : (err.message || "Study guide generation failed."));
      setStatus(resolvedTranscript.trim() ? "Transcript ready. Study guide generation failed." : "Study source ready. Study guide generation failed.");
    } finally {
      setIsGeneratingSummary(false);
      setCurrentJobType("");
    }
  };

  const generateQuiz = async () => {
    if (!hasQuizGenerationInputs) {
      return setError("Generate a study guide or add lecture material before creating the test.");
    }

    setIsGeneratingQuiz(true);
    setError("");
    setCurrentPage("workspace");
    setActiveTab("quiz");
    setStatus("Generating the test...");
    setProgress(0);
    setCurrentJobType("quiz");

    try {
      const response = await authFetch("/generate-quiz/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          summary,
          lecture_notes: lectureNotes,
          lecture_slides: lectureSlides,
          past_question_papers: pastQuestionPapers,
          language: outputLanguage,
        }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Test generation failed.");
      persistPendingJob({
        jobId: data.job_id,
        jobType: "quiz",
        savedAt: new Date().toISOString(),
      });
      const job = await pollJob(data.job_id, "quiz");
      const nextQuizQuestions = job.quiz_questions || [];
      startTransition(() => {
        setQuizQuestions(nextQuizQuestions);
        setQuizAnswers({});
        setQuizAnswerImages({});
        setQuizResults({});
        setQuizSubmitted(false);
      });
      const sourceLabel = getPrimarySourceLabel({
        fileName: file?.name || "",
        videoUrl,
        lectureNotesFileName,
        lectureSlideFileNames,
        pastQuestionPaperFileNames,
      });
      addHistoryItem({
        id: activeHistoryId || "",
        title: extractHistoryTitle(summary || "", sourceLabel),
        fileName: sourceLabel,
        summary,
        transcript,
        formula,
        example,
        flashcards,
        quizQuestions: nextQuizQuestions,
        studyImages,
        lectureNotes,
        lectureNotesFileName,
        lectureNoteSources: sanitizeStudySourceEntriesForHistory(lectureNoteSources),
        lectureNoteFileNames,
        lectureSlides,
        lectureSlideFileNames,
        lectureSlideSources: sanitizeStudySourceEntriesForHistory(lectureSlideSources),
        pastQuestionMemo,
        pastQuestionPapers,
        pastQuestionPaperFileNames,
        pastQuestionPaperSources: sanitizeStudySourceEntriesForHistory(pastQuestionPaperSources),
        presentationData: sanitizePresentationForHistory(presentationData),
        podcastData: sanitizePodcastForHistory(podcastData),
        teacherLessonData: sanitizeTeacherLessonForHistory(teacherLessonData),
      });
      clearPendingJob();
      setStatus("Test ready.");
      setProgress(100);
    } catch (err) {
      clearPendingJob();
      setError(err.message || "Test generation failed.");
      setStatus("Test generation failed.");
    } finally {
      setIsGeneratingQuiz(false);
      setCurrentJobType("");
    }
  };

  const generatePresentation = async () => {
    if (!(summary.trim() || transcript.trim() || lectureNotes.trim() || lectureSlides.trim() || pastQuestionPapers.trim())) {
      return setError("Generate a study guide or add lecture material before creating the PowerPoint presentation.");
    }

    setIsGeneratingPresentation(true);
    setError("");
    setCurrentPage("workspace");
    setActiveTab("presentation");
    setPresentationView("status");
    setSelectedPresentationSlideIndex(0);
    setPresentationData(createEmptyPresentationData());
    setStatus("Designing the PowerPoint presentation...");
    setProgress(0);
    setCurrentJobType("presentation");

    try {
      const response = await authFetch("/generate-presentation/", {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.append("transcript", transcript);
          formData.append("summary", summary);
          formData.append("lecture_notes", lectureNotes);
          formData.append("lecture_slides", lectureSlides);
          formData.append("past_question_papers", pastQuestionPapers);
          formData.append("design_id", selectedPresentationDesign);
          formData.append("language", outputLanguage);
          visualReferences.map((image) => image?.image_url).filter(Boolean).slice(0, 6).forEach((imageUrl) => {
            formData.append("reference_images", imageUrl);
          });
          if (presentationTemplateFile) formData.append("template_file", presentationTemplateFile);
          return formData;
        })(),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "PowerPoint generation failed.");
      persistPendingJob({
        jobId: data.job_id,
        jobType: "presentation",
        savedAt: new Date().toISOString(),
      });
      const job = await pollJob(data.job_id, "presentation");
      const nextPresentationData = normalizePresentationData({
        jobId: data.job_id,
        title: job.presentation_title,
        subtitle: job.presentation_subtitle,
        designId: job.presentation_design_id,
        templateName: job.presentation_template_name,
        slides: job.presentation_slides,
      });
      setPresentationData(nextPresentationData);
      setSelectedPresentationSlideIndex(0);
      setSelectedPresentationDesign(nextPresentationData.designId || selectedPresentationDesign);
      setActiveTab("presentation");
      setCurrentPage("workspace");
      setPresentationView("status");
      setProgress(100);
      const sourceLabel = getPrimarySourceLabel({
        fileName: file?.name || "",
        videoUrl,
        lectureNotesFileName,
        lectureSlideFileNames,
        pastQuestionPaperFileNames,
      });
      addHistoryItem({
        id: activeHistoryId || "",
        title: extractHistoryTitle(summary || nextPresentationData.title || "", sourceLabel),
        fileName: sourceLabel,
        summary,
        transcript,
        formula,
        example,
        flashcards,
        quizQuestions,
        studyImages,
        lectureNotes,
        lectureNotesFileName,
        lectureNoteSources: sanitizeStudySourceEntriesForHistory(lectureNoteSources),
        lectureNoteFileNames,
        lectureSlides,
        lectureSlideFileNames,
        lectureSlideSources: sanitizeStudySourceEntriesForHistory(lectureSlideSources),
        pastQuestionMemo,
        pastQuestionPapers,
        pastQuestionPaperFileNames,
        pastQuestionPaperSources: sanitizeStudySourceEntriesForHistory(pastQuestionPaperSources),
        presentationData: sanitizePresentationForHistory(nextPresentationData),
        podcastData: sanitizePodcastForHistory(podcastData),
        teacherLessonData: sanitizeTeacherLessonForHistory(teacherLessonData),
      });
      clearPendingJob();
      setStatus("PowerPoint presentation ready.");
    } catch (err) {
      clearPendingJob();
      setError(err.message || "PowerPoint generation failed.");
      setStatus("PowerPoint generation failed.");
    } finally {
      setIsGeneratingPresentation(false);
      setCurrentJobType("");
    }
  };

  const handlePresentationTemplateFileChange = (selectedFiles) => {
    const selectedFile = Array.from(selectedFiles || [])[0];
    if (!selectedFile) return;
    if (!String(selectedFile.name || "").toLowerCase().endsWith(".pptx")) {
      setPresentationTemplateFile(null);
      if (presentationTemplateInputRef.current) presentationTemplateInputRef.current.value = "";
      setError("Upload a PowerPoint template in .pptx format.");
      return;
    }
    setError("");
    setPresentationTemplateFile(selectedFile);
    setStatus(`${selectedFile.name} will be used as the presentation template. The download will follow the same generated slide order shown on the website.`);
  };

  const clearPresentationTemplateSelection = () => {
    setPresentationTemplateFile(null);
    if (presentationTemplateInputRef.current) presentationTemplateInputRef.current.value = "";
    setStatus("Custom presentation template cleared.");
  };

  const loadPodcastAudioTrack = async (jobId, segments = []) => {
    if (!jobId) {
      replacePodcastAudioUrl("");
      replacePodcastAudioSegments([]);
      setActivePodcastSegmentIndex(0);
      return;
    }

    setIsLoadingPodcastAudio(true);
    setCurrentJobType("podcast");
    try {
      setStatus("Loading full podcast audio...");
      const response = await authFetch(`/jobs/${jobId}/podcast-download`);
      if (!response.ok) {
        const data = await parseJsonSafe(response);
        throw new Error(data.detail || "Could not load the podcast audio.");
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      replacePodcastAudioUrl(objectUrl);
      replacePodcastAudioSegments((segments || []).map((segment) => ({ ...segment, objectUrl })));
      setActivePodcastSegmentIndex(0);
      setStatus("Podcast audio is ready.");
    } catch (err) {
      replacePodcastAudioUrl("");
      replacePodcastAudioSegments([]);
      setActivePodcastSegmentIndex(0);
      throw err;
    } finally {
      setIsLoadingPodcastAudio(false);
      setCurrentJobType("");
    }
  };

  const generatePodcast = async () => {
    if (!(summary.trim() || transcript.trim() || lectureNotes.trim() || lectureSlides.trim() || pastQuestionPapers.trim())) {
      return setError("Generate a study guide or add lecture material before creating the podcast debate.");
    }

    setIsGeneratingPodcast(true);
    setError("");
    setStatus("Writing the podcast debate...");
    setProgress(0);
    setCurrentJobType("podcast");
    setIsPodcastAutoPlaying(false);
    replacePodcastAudioUrl("");
    replacePodcastAudioSegments([]);
    setActivePodcastSegmentIndex(0);

    try {
      const response = await authFetch("/generate-podcast/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          summary,
          lecture_notes: lectureNotes,
          lecture_slides: lectureSlides,
          past_question_papers: pastQuestionPapers,
          speaker_count: podcastSpeakerCount,
          target_minutes: podcastTargetMinutes,
          language: outputLanguage,
        }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Podcast generation failed.");
      persistPendingJob({
        jobId: data.job_id,
        jobType: "podcast",
        savedAt: new Date().toISOString(),
      });
      const job = await pollJob(data.job_id, "podcast");
      const nextPodcastData = normalizePodcastData({
        jobId: data.job_id,
        title: job.podcast_title,
        overview: job.podcast_overview,
        script: job.podcast_script,
        segments: job.podcast_segments,
        speakerCount: podcastSpeakerCount,
        targetMinutes: podcastTargetMinutes,
      });
      setPodcastData(nextPodcastData);
      await loadPodcastAudioTrack(data.job_id, job.podcast_segments || []);
      setActiveTab("podcast");
      setCurrentPage("workspace");
      setProgress(100);
      const sourceLabel = getPrimarySourceLabel({
        fileName: file?.name || "",
        videoUrl,
        lectureNotesFileName,
        lectureSlideFileNames,
        pastQuestionPaperFileNames,
      });
      addHistoryItem({
        id: activeHistoryId || "",
        title: extractHistoryTitle(summary || nextPodcastData.script || "", sourceLabel),
        fileName: sourceLabel,
        summary,
        transcript,
        formula,
        example,
        flashcards,
        quizQuestions,
        studyImages,
        lectureNotes,
        lectureNotesFileName,
        lectureNoteSources: sanitizeStudySourceEntriesForHistory(lectureNoteSources),
        lectureNoteFileNames,
        lectureSlides,
        lectureSlideFileNames,
        lectureSlideSources: sanitizeStudySourceEntriesForHistory(lectureSlideSources),
        pastQuestionMemo,
        pastQuestionPapers,
        pastQuestionPaperFileNames,
        pastQuestionPaperSources: sanitizeStudySourceEntriesForHistory(pastQuestionPaperSources),
        presentationData: sanitizePresentationForHistory(presentationData),
        podcastData: sanitizePodcastForHistory(nextPodcastData),
        teacherLessonData: sanitizeTeacherLessonForHistory(teacherLessonData),
      });
      clearPendingJob();
    } catch (err) {
      clearPendingJob();
      setError(err.message || "Podcast generation failed.");
      setStatus("Podcast generation failed.");
    } finally {
      setIsGeneratingPodcast(false);
      setCurrentJobType("");
    }
  };

  const playTeacherLesson = (lesson = teacherLessonData, { startIndex = 0 } = {}) => {
    const normalizedLesson = normalizeTeacherLessonData(lesson);
    if (!normalizedLesson.segments.length) {
      setError("Generate teacher mode first so the lesson has something to explain.");
      return;
    }
    if (typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      setError("Teacher audio is not supported in this browser.");
      return;
    }

    const runId = teacherPlaybackRunRef.current + 1;
    teacherPlaybackRunRef.current = runId;
    window.speechSynthesis.cancel();

    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find((voice) => voice.name === selectedTeacherVoiceName)
      || voices.find((voice) => /female|woman|zira|aria|samantha|google uk english female|michelle|serena/i.test(voice.name))
      || voices[0]
      || null;

    const speakSegment = (segmentIndex) => {
      if (teacherPlaybackRunRef.current !== runId) return;
      if (segmentIndex >= normalizedLesson.segments.length) {
        setIsTeacherPlaying(false);
        setIsTeacherPaused(false);
        setActiveTeacherSegmentIndex(-1);
        setStatus("Teacher mode finished the lesson.");
        return;
      }

      const segment = normalizedLesson.segments[segmentIndex];
      const utterance = new window.SpeechSynthesisUtterance([segment.prompt, segment.text].filter(Boolean).join(" "));
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice?.lang || "en-US";
      utterance.rate = 0.94;
      utterance.pitch = 0.92;
      utterance.onstart = () => {
        if (teacherPlaybackRunRef.current !== runId) return;
        setActiveTeacherSegmentIndex(segmentIndex);
        setIsTeacherPlaying(true);
        setIsTeacherPaused(false);
        scrollTeacherToSection(segment.sectionHeading);
      };
      utterance.onend = () => {
        if (teacherPlaybackRunRef.current !== runId) return;
        speakSegment(segmentIndex + 1);
      };
      utterance.onerror = () => {
        if (teacherPlaybackRunRef.current !== runId) return;
        speakSegment(segmentIndex + 1);
      };
      window.speechSynthesis.speak(utterance);
    };

    setCurrentPage("workspace");
    setActiveTab("guide");
    setStatus("Teacher mode is explaining the study guide.");
    speakSegment(Math.max(0, Number(startIndex || 0)));
  };

  const pauseTeacherLesson = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (!window.speechSynthesis.speaking || window.speechSynthesis.paused) return;
    window.speechSynthesis.pause();
    setIsTeacherPlaying(false);
    setIsTeacherPaused(true);
    setStatus("Teacher mode paused.");
  };

  const resumeTeacherLesson = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsTeacherPlaying(true);
      setIsTeacherPaused(false);
      setStatus("Teacher mode resumed.");
      return;
    }
    playTeacherLesson(teacherLessonData, { startIndex: Math.max(0, activeTeacherSegmentIndex) });
  };

  const generateTeacherLesson = async ({ autoplay = true } = {}) => {
    if (!(summary.trim() || transcript.trim() || lectureNotes.trim() || lectureSlides.trim() || pastQuestionPapers.trim())) {
      return setError("Generate a study guide or add lecture material before opening teacher mode.");
    }

    stopTeacherPlayback({ resetIndex: true });
    setIsGeneratingTeacherLesson(true);
    setError("");
    setCurrentPage("workspace");
    setActiveTab("guide");
    setStatus("Preparing teacher mode...");
    setProgress(0);
    setCurrentJobType("teacher_lesson");

    try {
      const response = await authFetch("/generate-teacher-lesson/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          summary,
          lecture_notes: lectureNotes,
          lecture_slides: lectureSlides,
          past_question_papers: pastQuestionPapers,
          language: outputLanguage,
        }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Teacher mode generation failed.");
      persistPendingJob({
        jobId: data.job_id,
        jobType: "teacher_lesson",
        autoplay,
        savedAt: new Date().toISOString(),
      });
      const job = await pollJob(data.job_id, "teacher_lesson");
      const nextTeacherLessonData = normalizeTeacherLessonData({
        jobId: data.job_id,
        title: job.teacher_title,
        overview: job.teacher_overview,
        segments: job.teacher_segments,
      });
      setTeacherLessonData(nextTeacherLessonData);
      const sourceLabel = getPrimarySourceLabel({
        fileName: file?.name || "",
        videoUrl,
        lectureNotesFileName,
        lectureSlideFileNames,
        pastQuestionPaperFileNames,
      });
      addHistoryItem({
        id: activeHistoryId || "",
        title: extractHistoryTitle(summary || nextTeacherLessonData.title || "", sourceLabel),
        fileName: sourceLabel,
        summary,
        transcript,
        formula,
        example,
        flashcards,
        quizQuestions,
        studyImages,
        lectureNotes,
        lectureNotesFileName,
        lectureNoteSources: sanitizeStudySourceEntriesForHistory(lectureNoteSources),
        lectureNoteFileNames,
        lectureSlides,
        lectureSlideFileNames,
        lectureSlideSources: sanitizeStudySourceEntriesForHistory(lectureSlideSources),
        pastQuestionMemo,
        pastQuestionPapers,
        pastQuestionPaperFileNames,
        pastQuestionPaperSources: sanitizeStudySourceEntriesForHistory(pastQuestionPaperSources),
        presentationData: sanitizePresentationForHistory(presentationData),
        podcastData: sanitizePodcastForHistory(podcastData),
        teacherLessonData: sanitizeTeacherLessonForHistory(nextTeacherLessonData),
      });
      clearPendingJob();
      setStatus("Teacher mode is ready.");
      setProgress(100);
      if (autoplay) {
        window.setTimeout(() => {
          playTeacherLesson(nextTeacherLessonData);
        }, 0);
      }
    } catch (err) {
      clearPendingJob();
      setError(err.message || "Teacher mode generation failed.");
      setStatus("Teacher mode generation failed.");
    } finally {
      setIsGeneratingTeacherLesson(false);
      setCurrentJobType("");
    }
  };

  const upload = async () => {
    try {
      await transcribeLectureFile(file);
    } catch (err) {
      setError(err.message || "Transcription failed.");
      setStatus("Transcription failed.");
    }
  };

  const transcribeVideoLink = async () => {
    if (!videoUrl.trim()) return setError("Paste a video link first.");
    setIsTranscribingVideo(true);
    setError("");
    setStatus("Submitting video link for transcription...");
    setProgress(0);
    setFile(null);
    resetGeneratedOutputs();
    setActiveTab("transcript");
    setCurrentJobType("video");
    try {
      const response = await authFetch("/transcribe-video-url/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl.trim() }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Video-link transcription failed.");
      persistPendingJob({
        jobId: data.job_id,
        jobType: "video",
        autoGenerateGuide: true,
        savedAt: new Date().toISOString(),
      });
      const job = await pollJob(data.job_id, "video");
      startTransition(() => {
        setTranscript(job.transcript || "");
      });
      clearPendingJob();
      setStatus("Video transcript ready. Generating study guide...");
      setProgress(100);
      await generateStudyGuide(job.transcript || "");
    } catch (err) {
      clearPendingJob();
      setError(err.message || "Video-link transcription failed.");
      setStatus("Video-link transcription failed.");
    } finally {
      setIsTranscribingVideo(false);
      setCurrentJobType("");
    }
  };

  useEffect(() => {
    if (!authChecked || !authToken || !authEmail || hasResumedPendingJobRef.current !== false) return;
    const pendingJob = loadPendingJobSnapshot(authEmail);
    hasResumedPendingJobRef.current = true;
    if (!pendingJob?.jobId) return undefined;

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setStatus("Restoring your last in-progress task...");
        const resumedJob = await pollJob(
          pendingJob.jobId,
          pendingJob.jobType === "video" ? "video" : pendingJob.jobType,
        );
        if (cancelled) return;

        if (pendingJob.jobType === "transcription" || pendingJob.jobType === "video") {
          const recoveredTranscript = resumedJob.transcript || "";
          if (recoveredTranscript) {
            startTransition(() => {
              setTranscript(recoveredTranscript);
            });
          }
          clearPendingJob();
          clearRecoveredRecordingFromDb(authEmail);
          if (pendingJob.autoGenerateGuide && recoveredTranscript) {
            setStatus("Recovered the transcript. Rebuilding the study guide...");
            await generateStudyGuide(recoveredTranscript);
          } else {
            setStatus("Recovered the completed transcript after refresh.");
          }
          return;
        }

        const sourceLabel = getPrimarySourceLabel({
          fileName: file?.name || "",
          videoUrl,
          lectureNotesFileName,
          lectureSlideFileNames,
          pastQuestionPaperFileNames,
        });

        if (pendingJob.jobType === "study_guide") {
          startTransition(() => {
            setSummary(resumedJob.summary || "");
            setFormula(resumedJob.formula || "");
            setExample(resumedJob.worked_example || "");
            setFlashcards(resumedJob.flashcards || []);
            setStudyImages(Array.isArray(resumedJob.study_images) ? resumedJob.study_images : []);
            setTeacherLessonData(createEmptyTeacherLessonData());
            setActiveTab("guide");
            setCurrentPage("workspace");
          });
          addHistoryItem({
            id: activeHistoryId || "",
            title: extractHistoryTitle(resumedJob.summary || "", sourceLabel),
            fileName: sourceLabel,
            summary: resumedJob.summary || "",
            transcript: resumedJob.transcript || transcript,
            formula: resumedJob.formula || "",
            example: resumedJob.worked_example || "",
            flashcards: resumedJob.flashcards || [],
            quizQuestions,
            studyImages: Array.isArray(resumedJob.study_images) ? resumedJob.study_images : [],
            lectureNotes,
            lectureNotesFileName,
            lectureNoteSources: sanitizeStudySourceEntriesForHistory(lectureNoteSources),
            lectureNoteFileNames,
            lectureSlides,
            lectureSlideFileNames,
            lectureSlideSources: sanitizeStudySourceEntriesForHistory(lectureSlideSources),
            pastQuestionMemo,
            pastQuestionPapers,
            pastQuestionPaperFileNames,
            pastQuestionPaperSources: sanitizeStudySourceEntriesForHistory(pastQuestionPaperSources),
            presentationData: sanitizePresentationForHistory(presentationData),
            podcastData: sanitizePodcastForHistory(podcastData),
            teacherLessonData: sanitizeTeacherLessonForHistory(createEmptyTeacherLessonData()),
          });
          clearPendingJob();
          setStatus("Recovered the study guide after refresh.");
          return;
        }

        if (pendingJob.jobType === "quiz") {
          const nextQuizQuestions = resumedJob.quiz_questions || [];
          startTransition(() => {
            setQuizQuestions(nextQuizQuestions);
            setQuizAnswers({});
            setQuizAnswerImages({});
            setQuizResults({});
            setQuizSubmitted(false);
            setActiveTab("quiz");
            setCurrentPage("workspace");
          });
          addHistoryItem({
            id: activeHistoryId || "",
            title: extractHistoryTitle(summary || "", sourceLabel),
            fileName: sourceLabel,
            summary,
            transcript,
            formula,
            example,
            flashcards,
            quizQuestions: nextQuizQuestions,
            studyImages,
            lectureNotes,
            lectureNotesFileName,
            lectureNoteSources: sanitizeStudySourceEntriesForHistory(lectureNoteSources),
            lectureNoteFileNames,
            lectureSlides,
            lectureSlideFileNames,
            lectureSlideSources: sanitizeStudySourceEntriesForHistory(lectureSlideSources),
            pastQuestionMemo,
            pastQuestionPapers,
            pastQuestionPaperFileNames,
            pastQuestionPaperSources: sanitizeStudySourceEntriesForHistory(pastQuestionPaperSources),
            presentationData: sanitizePresentationForHistory(presentationData),
            podcastData: sanitizePodcastForHistory(podcastData),
            teacherLessonData: sanitizeTeacherLessonForHistory(teacherLessonData),
          });
          clearPendingJob();
          setStatus("Recovered the generated test after refresh.");
          return;
        }

        if (pendingJob.jobType === "presentation") {
          const nextPresentationData = normalizePresentationData({
            jobId: pendingJob.jobId,
            title: resumedJob.presentation_title,
            subtitle: resumedJob.presentation_subtitle,
            designId: resumedJob.presentation_design_id,
            templateName: resumedJob.presentation_template_name,
            slides: resumedJob.presentation_slides,
          });
          startTransition(() => {
            setPresentationData(nextPresentationData);
            setSelectedPresentationDesign(nextPresentationData.designId || selectedPresentationDesign);
            setPresentationView("status");
            setCurrentPage("workspace");
            setActiveTab("presentation");
          });
          addHistoryItem({
            id: activeHistoryId || "",
            title: extractHistoryTitle(summary || nextPresentationData.title || "", sourceLabel),
            fileName: sourceLabel,
            summary,
            transcript,
            formula,
            example,
            flashcards,
            quizQuestions,
            studyImages,
            lectureNotes,
            lectureNotesFileName,
            lectureNoteSources: sanitizeStudySourceEntriesForHistory(lectureNoteSources),
            lectureNoteFileNames,
            lectureSlides,
            lectureSlideFileNames,
            lectureSlideSources: sanitizeStudySourceEntriesForHistory(lectureSlideSources),
            pastQuestionMemo,
            pastQuestionPapers,
            pastQuestionPaperFileNames,
            pastQuestionPaperSources: sanitizeStudySourceEntriesForHistory(pastQuestionPaperSources),
            presentationData: sanitizePresentationForHistory(nextPresentationData),
            podcastData: sanitizePodcastForHistory(podcastData),
            teacherLessonData: sanitizeTeacherLessonForHistory(teacherLessonData),
          });
          clearPendingJob();
          setStatus("Recovered the PowerPoint presentation after refresh.");
          return;
        }

        if (pendingJob.jobType === "podcast") {
          const nextPodcastData = normalizePodcastData({
            jobId: pendingJob.jobId,
            title: resumedJob.podcast_title,
            overview: resumedJob.podcast_overview,
            script: resumedJob.podcast_script,
            segments: resumedJob.podcast_segments,
            speakerCount: podcastSpeakerCount,
            targetMinutes: podcastTargetMinutes,
          });
          setPodcastData(nextPodcastData);
          await loadPodcastAudioTrack(pendingJob.jobId, resumedJob.podcast_segments || []);
          setCurrentPage("workspace");
          setActiveTab("podcast");
          addHistoryItem({
            id: activeHistoryId || "",
            title: extractHistoryTitle(summary || nextPodcastData.script || "", sourceLabel),
            fileName: sourceLabel,
            summary,
            transcript,
            formula,
            example,
            flashcards,
            quizQuestions,
            studyImages,
            lectureNotes,
            lectureNotesFileName,
            lectureNoteSources: sanitizeStudySourceEntriesForHistory(lectureNoteSources),
            lectureNoteFileNames,
            lectureSlides,
            lectureSlideFileNames,
            lectureSlideSources: sanitizeStudySourceEntriesForHistory(lectureSlideSources),
            pastQuestionMemo,
            pastQuestionPapers,
            pastQuestionPaperFileNames,
            pastQuestionPaperSources: sanitizeStudySourceEntriesForHistory(pastQuestionPaperSources),
            presentationData: sanitizePresentationForHistory(presentationData),
            podcastData: sanitizePodcastForHistory(nextPodcastData),
            teacherLessonData: sanitizeTeacherLessonForHistory(teacherLessonData),
          });
          clearPendingJob();
          setStatus("Recovered the podcast after refresh.");
          return;
        }

        if (pendingJob.jobType === "teacher_lesson") {
          const nextTeacherLessonData = normalizeTeacherLessonData({
            jobId: pendingJob.jobId,
            title: resumedJob.teacher_title,
            overview: resumedJob.teacher_overview,
            segments: resumedJob.teacher_segments,
          });
          setTeacherLessonData(nextTeacherLessonData);
          addHistoryItem({
            id: activeHistoryId || "",
            title: extractHistoryTitle(summary || nextTeacherLessonData.title || "", sourceLabel),
            fileName: sourceLabel,
            summary,
            transcript,
            formula,
            example,
            flashcards,
            quizQuestions,
            studyImages,
            lectureNotes,
            lectureNotesFileName,
            lectureNoteSources: sanitizeStudySourceEntriesForHistory(lectureNoteSources),
            lectureNoteFileNames,
            lectureSlides,
            lectureSlideFileNames,
            lectureSlideSources: sanitizeStudySourceEntriesForHistory(lectureSlideSources),
            pastQuestionMemo,
            pastQuestionPapers,
            pastQuestionPaperFileNames,
            pastQuestionPaperSources: sanitizeStudySourceEntriesForHistory(pastQuestionPaperSources),
            presentationData: sanitizePresentationForHistory(presentationData),
            podcastData: sanitizePodcastForHistory(podcastData),
            teacherLessonData: sanitizeTeacherLessonForHistory(nextTeacherLessonData),
          });
          clearPendingJob();
          setStatus("Recovered teacher mode after refresh.");
          if (pendingJob.autoplay) {
            window.setTimeout(() => {
              playTeacherLesson(nextTeacherLessonData);
            }, 0);
          }
        }
      } catch (err) {
        if (!cancelled) {
          clearPendingJob();
          setAuthMessage((current) => current || (err.message || "Could not restore your in-progress task."));
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [authChecked, authEmail, authToken]);

  const askStudyAssistant = async () => {
    const question = chatQuestion.trim();
    if (!question) return setError("Ask a question first.");
    if (!summary && !transcript) return setError("Generate a transcript or study guide first.");
    setIsAskingChat(true);
    setError("");
    try {
      const response = await authFetch("/ask-study-assistant/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          transcript,
          summary,
          lecture_notes: lectureNotes,
          lecture_slides: lectureSlides,
          past_question_papers: pastQuestionPapers,
          history: chatMessages.slice(-6),
          reference_images: chatReferenceImages.map((item) => item.dataUrl),
          language: outputLanguage,
        }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Study chat failed.");
      const userMessage = chatReferenceImages.length ? `${question}\n\n[Reference images attached: ${chatReferenceImages.length}]` : question;
      setChatMessages((current) => [...current, { role: "user", content: userMessage }, { role: "assistant", content: data.answer || "No answer returned." }]);
      setChatQuestion("");
      setChatReferenceImages([]);
      setActiveTab("chat");
      setStatus("MABASO answered your question.");
    } catch (err) {
      setError(err.message || "Study chat failed.");
      setStatus("Study chat failed.");
    } finally {
      setIsAskingChat(false);
    }
  };

  const createCollaborationRoom = async () => {
    if (!summary && !transcript && !lectureNotes && !lectureSlides) return setError("Generate a transcript or study guide first, then create a collaboration room.");
    const resolvedTitle = roomTitleInput.trim() || `${extractHistoryTitle(summary, workspaceFileLabel)} group room`;
    setIsCreatingRoom(true);
    setError("");
    try {
      const response = await authFetch("/collaboration/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: resolvedTitle,
          transcript,
          summary,
          formula,
          example,
          lecture_notes: lectureNotes,
          lecture_slides: lectureSlides,
          shared_notes: roomSharedNotesDraft,
          flashcards,
          quiz_questions: selectedQuizQuestions,
          invited_emails: parseInviteEmails(roomInviteInput),
          active_tab: ["podcast", "presentation"].includes(activeTab) ? "guide" : activeTab,
          test_visibility: newRoomVisibility,
        }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not create the collaboration room.");
      setActiveRoomId(data.room?.id || "");
      setActiveRoom(data.room || null);
      setRoomSharedNotesDraft(data.room?.shared_notes || "");
      setRoomTitleInput(resolvedTitle);
      setRoomMessageDraft("");
      setCurrentPage("collaboration");
      if (data.room?.active_tab) setActiveTab(data.room.active_tab);
      refreshCollaborationRooms(true);
      setStatus(`Collaboration room "${resolvedTitle}" is ready.`);
    } catch (err) {
      setError(err.message || "Could not create the collaboration room.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const saveRoomNotes = async () => {
    if (!activeRoomId) return;
    setIsSavingRoomNotes(true);
    setError("");
    try {
      const response = await authFetch(`/collaboration/rooms/${activeRoomId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared_notes: roomSharedNotesDraft }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not save shared notes.");
      setActiveRoom(data.room || null);
      setStatus("Shared notes saved for the room.");
    } catch (err) {
      setError(err.message || "Could not save shared notes.");
    } finally {
      setIsSavingRoomNotes(false);
    }
  };

  const sendRoomMessage = async () => {
    if (!activeRoomId) return;
    if (!roomMessageDraft.trim()) return setError("Type a room message first.");
    setIsSendingRoomMessage(true);
    setError("");
    try {
      const response = await authFetch(`/collaboration/rooms/${activeRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: roomMessageDraft }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not send the room message.");
      setActiveRoom(data.room || null);
      setRoomMessageDraft("");
      refreshCollaborationRooms(true);
      setStatus("Collaboration message sent.");
    } catch (err) {
      setError(err.message || "Could not send the room message.");
    } finally {
      setIsSendingRoomMessage(false);
    }
  };

  const shareTabToRoom = async (tabId = activeTab) => {
    if (!activeRoomId) return;
    if (["podcast", "presentation"].includes(tabId)) {
      setError("Podcast and PowerPoint tools stay personal for now, so they cannot be synced into the collaboration room yet.");
      return;
    }
    try {
      const response = await authFetch(`/collaboration/rooms/${activeRoomId}/active-tab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_tab: tabId }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not sync the current tool.");
      setActiveRoom(data.room || null);
      refreshCollaborationRooms(true);
      const sharedLabel = tabs.find((tab) => tab.id === tabId)?.label || "Current tool";
      setStatus(`${sharedLabel} shared with the room.`);
    } catch (err) {
      setError(err.message || "Could not sync the current tool.");
    }
  };

  const syncCurrentTabToRoom = async () => {
    await shareTabToRoom(activeTab);
  };

  const changeRoomTestVisibility = async (value) => {
    if (!activeRoomId) return;
    try {
      const response = await authFetch(`/collaboration/rooms/${activeRoomId}/test-visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_visibility: value }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not update the room test visibility.");
      setActiveRoom(data.room || null);
      refreshCollaborationRooms(true);
      setStatus(`Room test visibility changed to ${value}.`);
    } catch (err) {
      setError(err.message || "Could not update the room test visibility.");
    }
  };

  const clearQuestionResult = (questionNumber) => {
    setQuizSubmitted(false);
    setQuizResults((current) => {
      const next = { ...current };
      delete next[questionNumber];
      return next;
    });
  };

  const syncRoomAnswer = async (question, value) => {
    if (!activeRoomId) return;
    const questionNumber = String(question?.number || "");
    const serializedValue = serializeQuizAnswerForRoom(question, value);
    const response = await authFetch(`/collaboration/rooms/${activeRoomId}/quiz-answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_number: questionNumber, answer_text: serializedValue }),
    });
    const data = await parseJsonSafe(response);
    if (!response.ok) throw new Error(data.detail || "Could not sync the collaboration answer.");
    if (data.room) setActiveRoom(data.room);
  };

  const queueRoomAnswerSync = (question, value) => {
    if (!activeRoomId) return;
    const key = String(question?.number || "");
    if (answerSyncTimersRef.current[key]) window.clearTimeout(answerSyncTimersRef.current[key]);
    answerSyncTimersRef.current[key] = window.setTimeout(async () => {
      try {
        await syncRoomAnswer(question, value);
      } catch (err) {
        setError(err.message || "Could not sync the collaboration answer.");
      } finally {
        delete answerSyncTimersRef.current[key];
      }
    }, 800);
  };

  const flushRoomAnswerSyncs = async (questions, answersMap) => {
    if (!activeRoomId) return;
    for (const question of questions || []) {
      const key = String(question?.number || "");
      if (answerSyncTimersRef.current[key]) {
        window.clearTimeout(answerSyncTimersRef.current[key]);
        delete answerSyncTimersRef.current[key];
      }
      try {
        await syncRoomAnswer(question, answersMap?.[question.number]);
      } catch (err) {
        setError(err.message || "Could not sync the collaboration answer.");
        break;
      }
    }
  };

  const handleStudyChatKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isAskingChat) askStudyAssistant();
    }
  };

  const handleRoomChatKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isSendingRoomMessage) sendRoomMessage();
    }
  };

  const exportPdf = async (title, sections) => {
    const response = await authFetch("/export-study-pack-pdf/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, sections }),
    });
    if (!response.ok) {
      const data = await parseJsonSafe(response);
      throw new Error(data.detail || "PDF export failed.");
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFileName(title)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const copyActiveContent = async () => {
    try {
      await navigator.clipboard.writeText(getActiveContent());
      setStatus(`${currentTabLabel} copied to clipboard.`);
    } catch {
      setError("Copy failed. Your browser may be blocking clipboard access.");
    }
  };

  const downloadActiveContent = async () => {
    try {
      const baseTitle = extractHistoryTitle(summary, file?.name || workspaceFileLabel || currentTabLabel);
      await exportPdf(`${baseTitle} - ${currentTabLabel}`, [{ title: currentTabLabel, content: getActiveContent() }]);
      setStatus(`${currentTabLabel} PDF downloaded.`);
    } catch (err) {
      setError(err.message || "PDF download failed.");
    }
  };

  const downloadFullStudyPackPdf = async () => {
    try {
      const title = extractHistoryTitle(summary, file?.name || workspaceFileLabel || "MABASO Study Pack");
      await exportPdf(title, buildCurrentStudyPackSections());
      setStatus("Full study pack PDF downloaded.");
    } catch (err) {
      setError(err.message || "Could not create the full study pack PDF.");
    }
  };

  const downloadQuizPdf = async () => {
    if (!selectedQuizQuestions.length) return setError("Generate test questions first.");
    try {
      const title = `${extractHistoryTitle(summary, file?.name || formatVideoSourceLabel(videoUrl) || "MABASO Test")} test`;
      await exportPdf(title, [{ title: "Test", content: buildQuizExportText(selectedQuizQuestions, quizAnswers, quizResults) }]);
      setStatus("Test PDF downloaded.");
    } catch (err) {
      setError(err.message || "Could not create the test PDF.");
    }
  };

  const downloadPresentationFile = async () => {
    if (!presentationData.jobId) return setError("Generate the PowerPoint presentation again to download the file.");
    try {
      const response = await authFetch(`/jobs/${presentationData.jobId}/presentation-download`);
      if (!response.ok) {
        const data = await parseJsonSafe(response);
        throw new Error(data.detail || "Could not download the PowerPoint presentation.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sanitizeFileName(presentationData.title || extractHistoryTitle(summary, workspaceFileLabel) || "lecture-presentation")}.pptx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatus("PowerPoint presentation downloaded.");
    } catch (err) {
      setError(err.message || "Could not download the PowerPoint presentation.");
    }
  };

  const downloadPodcastAudio = async () => {
    if (!podcastData.jobId) return setError("Generate the podcast again to download the audio.");
    try {
      const response = await authFetch(`/jobs/${podcastData.jobId}/podcast-download`);
      if (!response.ok) {
        const data = await parseJsonSafe(response);
        throw new Error(data.detail || "Could not download the podcast audio.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sanitizeFileName(podcastData.title || extractHistoryTitle(summary, workspaceFileLabel) || "lecture-podcast")}.mp3`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatus("Podcast audio downloaded.");
    } catch (err) {
      setError(err.message || "Could not download the podcast audio.");
    }
  };

  const downloadHistoryItemPdf = async (item) => {
    try {
      await exportPdf(item.title || item.fileName || "Saved lecture", [
        { title: "Study Guide", content: item.summary || "" },
        { title: "Transcript", content: item.transcript || "" },
        { title: "Past Question Paper References", content: item.pastQuestionPapers || "" },
        { title: "Formulas", content: item.formula || "" },
        { title: "Worked Examples", content: item.example || "" },
        { title: "Flashcards", content: flashcardsToText(item.flashcards || []) },
        { title: "Test", content: quizToText(item.quizQuestions || []) },
        { title: "PowerPoint Presentation", content: presentationToText(item.presentationData) },
        { title: "Podcast Debate Script", content: item.podcastData?.script || "" },
        { title: "Teacher Mode Lesson", content: teacherLessonToText(item.teacherLessonData) },
      ]);
      setStatus(`${item.title} PDF downloaded.`);
    } catch (err) {
      setError(err.message || "Could not create the history PDF.");
    }
  };

  const downloadHistoryQuizPdf = async (item) => {
    if (!(item.quizQuestions || []).length) {
      setError("This saved workspace does not have a generated test yet.");
      return;
    }
    try {
      await exportPdf(`${item.title || item.fileName || "Saved lecture"} test`, [
        { title: "Test", content: buildQuizExportText(item.quizQuestions || []) },
      ]);
      setStatus(`${item.title} test PDF downloaded.`);
    } catch (err) {
      setError(err.message || "Could not create the test PDF.");
    }
  };

  const handleQuizAnswerChange = (question, value) => {
    setQuizAnswers((current) => ({ ...current, [question.number]: value }));
    clearQuestionResult(question.number);
    queueRoomAnswerSync(question, value);
  };

  const handleQuizOptionChange = (question, label, option) => {
    const nextAnswer = {
      ...(quizAnswers[question.number] && typeof quizAnswers[question.number] === "object" ? quizAnswers[question.number] : {}),
      [label]: option,
    };
    setQuizAnswers((current) => ({ ...current, [question.number]: nextAnswer }));
    setQuizAnswerImages((current) => {
      const next = { ...current };
      delete next[question.number];
      return next;
    });
    clearQuestionResult(question.number);
    queueRoomAnswerSync(question, nextAnswer);
  };

  const handleQuizImageChange = (questionNumber, selectedFiles) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return;
    const validFiles = files.filter((file) => file?.type?.startsWith("image/"));
    if (!validFiles.length) return setError("Please upload image files for test answer marking.");
    setQuizAnswerImages((current) => ({
      ...current,
      [questionNumber]: [...getQuizAnswerImageFiles(current, questionNumber), ...validFiles].slice(0, MAX_QUIZ_ANSWER_IMAGES),
    }));
    clearQuestionResult(questionNumber);
    setStatus(`${validFiles.length} answer photo${validFiles.length === 1 ? "" : "s"} added for question ${questionNumber}.`);
  };

  const markQuiz = async () => {
    if (!selectedQuizQuestions.length) return;
    setIsMarkingQuiz(true);
    setError("");
    setStatus("Marking test answers...");
    try {
      const nextResults = {};
      for (const item of selectedQuizQuestions) {
        const typedAnswer = typeof quizAnswers[item.number] === "string" ? quizAnswers[item.number] : "";
        const selectedOptions = quizAnswers[item.number] && typeof quizAnswers[item.number] === "object" ? quizAnswers[item.number] : {};
        const imageFiles = getQuizAnswerImageFiles(quizAnswerImages, item.number);
        const hasOptionAnswer = isOptionBasedQuestion(item) && Object.values(selectedOptions).some(Boolean);
        if (!typedAnswer.trim() && !imageFiles.length && !hasOptionAnswer) {
          nextResults[item.number] = {
            score: 0,
            max_score: getQuestionMarks(item),
            extracted_answer: "",
            feedback: "No answer was submitted yet.",
            mistakes: [],
          };
          continue;
        }
        const formData = new FormData();
        formData.append("question", item.question);
        formData.append("expected_answer", buildExpectedAnswerText(item));
        formData.append("question_type", item.type || "short_answer");
        formData.append("max_score", String(getQuestionMarks(item)));
        formData.append("answer_points_json", JSON.stringify(item.answer_points || []));
        formData.append("subparts_json", JSON.stringify(item.subparts || []));
        formData.append("student_selection_json", JSON.stringify(selectedOptions));
        formData.append("student_answer", typedAnswer);
        if (!isOptionBasedQuestion(item)) imageFiles.forEach((imageFile) => formData.append("answer_images", imageFile));
        const response = await authFetch("/mark-quiz-answer/", { method: "POST", body: formData });
        const data = await parseJsonSafe(response);
        if (!response.ok) throw new Error(data.detail || `Could not mark question ${item.number}.`);
        nextResults[item.number] = data;
        setQuizResults((current) => ({ ...current, [item.number]: data }));
      }
      setQuizResults(nextResults);
      setQuizSubmitted(true);
      setStatus("Test marked. Review the colored answers below.");
    } catch (err) {
      setError(err.message || "Test marking failed.");
      setStatus("Test marking failed.");
    } finally {
      setIsMarkingQuiz(false);
    }
  };

  const clearRoomQuestionResult = (questionNumber) => {
    setRoomQuizSubmitted(false);
    setRoomQuizResults((current) => {
      const next = { ...current };
      delete next[questionNumber];
      return next;
    });
  };

  const handleRoomQuizAnswerChange = (question, value) => {
    setRoomQuizAnswers((current) => ({ ...current, [question.number]: value }));
    clearRoomQuestionResult(question.number);
    queueRoomAnswerSync(question, value);
  };

  const handleRoomQuizOptionChange = (question, label, option) => {
    const nextAnswer = {
      ...(roomQuizAnswers[question.number] && typeof roomQuizAnswers[question.number] === "object" ? roomQuizAnswers[question.number] : {}),
      [label]: option,
    };
    setRoomQuizAnswers((current) => ({ ...current, [question.number]: nextAnswer }));
    setRoomQuizAnswerImages((current) => {
      const next = { ...current };
      delete next[question.number];
      return next;
    });
    clearRoomQuestionResult(question.number);
    queueRoomAnswerSync(question, nextAnswer);
  };

  const handleRoomQuizImageChange = (questionNumber, selectedFiles) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return;
    const validFiles = files.filter((file) => file?.type?.startsWith("image/"));
    if (!validFiles.length) return setError("Please upload image files for test answer marking.");
    setRoomQuizAnswerImages((current) => ({
      ...current,
      [questionNumber]: [...getQuizAnswerImageFiles(current, questionNumber), ...validFiles].slice(0, MAX_QUIZ_ANSWER_IMAGES),
    }));
    clearRoomQuestionResult(questionNumber);
    setStatus(`${validFiles.length} answer photo${validFiles.length === 1 ? "" : "s"} added for room question ${questionNumber}.`);
  };

  const markRoomQuiz = async () => {
    if (!activeRoomQuizQuestions.length) return;
    setIsMarkingRoomQuiz(true);
    setError("");
    setStatus("Marking collaboration test answers...");
    try {
      await flushRoomAnswerSyncs(activeRoomQuizQuestions, roomQuizAnswers);
      const nextResults = {};
      for (const item of activeRoomQuizQuestions) {
        const typedAnswer = typeof roomQuizAnswers[item.number] === "string" ? roomQuizAnswers[item.number] : "";
        const selectedOptions = roomQuizAnswers[item.number] && typeof roomQuizAnswers[item.number] === "object" ? roomQuizAnswers[item.number] : {};
        const imageFiles = getQuizAnswerImageFiles(roomQuizAnswerImages, item.number);
        const hasOptionAnswer = isOptionBasedQuestion(item) && Object.values(selectedOptions).some(Boolean);
        if (!typedAnswer.trim() && !imageFiles.length && !hasOptionAnswer) {
          nextResults[item.number] = {
            score: 0,
            max_score: getQuestionMarks(item),
            extracted_answer: "",
            feedback: "No answer was submitted yet.",
            mistakes: [],
          };
          continue;
        }
        const formData = new FormData();
        formData.append("question", item.question);
        formData.append("expected_answer", buildExpectedAnswerText(item));
        formData.append("question_type", item.type || "short_answer");
        formData.append("max_score", String(getQuestionMarks(item)));
        formData.append("answer_points_json", JSON.stringify(item.answer_points || []));
        formData.append("subparts_json", JSON.stringify(item.subparts || []));
        formData.append("student_selection_json", JSON.stringify(selectedOptions));
        formData.append("student_answer", typedAnswer);
        if (!isOptionBasedQuestion(item)) imageFiles.forEach((imageFile) => formData.append("answer_images", imageFile));
        const response = await authFetch("/mark-quiz-answer/", { method: "POST", body: formData });
        const data = await parseJsonSafe(response);
        if (!response.ok) throw new Error(data.detail || `Could not mark question ${item.number}.`);
        nextResults[item.number] = data;
        setRoomQuizResults((current) => ({ ...current, [item.number]: data }));
      }
      setRoomQuizResults(nextResults);
      setRoomQuizSubmitted(true);
      setStatus("Collaboration test marked. Review the room answers below.");
    } catch (err) {
      setError(err.message || "Collaboration test marking failed.");
      setStatus("Collaboration test marking failed.");
    } finally {
      setIsMarkingRoomQuiz(false);
    }
  };

  const score = selectedQuizQuestions.reduce((total, item) => total + Number(quizResults[item.number]?.score || 0), 0);
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[var(--page-bg)] text-slate-100">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/70 px-8 py-10 text-center">
            <p className="brand-mark text-2xl font-black sm:text-4xl">MABASO.AI</p>
            <p className="mt-4 text-sm text-slate-300">Checking your session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!authToken) {
    return (
      <div className="min-h-screen bg-[var(--page-bg)] text-slate-100">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="hero-glow hero-glow-left" />
          <div className="hero-glow hero-glow-right" />
          <div className="hero-grid" />
        </div>
        <main className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid w-full gap-8 xl:grid-cols-[1fr_0.95fr]">
            <section className="rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_rgba(2,8,23,0.45)] backdrop-blur xl:p-8">
              <div className="flex flex-wrap gap-3">
                {progressSteps.map((step, index) => <div key={step} className={`rounded-full border px-4 py-2 text-sm ${index === 0 ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-slate-950/75 text-slate-300"}`}>{step}</div>)}
              </div>
              <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-4 sm:p-5">
                <img src={BRAND_ART_URL} alt="Mabaso AI microphone and study logo" className="mx-auto w-full max-w-[320px] rounded-[24px]" />
              </div>
              <p className="brand-mark mt-6 text-3xl font-black sm:text-5xl">MABASO</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">Mabaso AI turns lectures into a full study workspace for students.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">Upload or record a lecture, add notes or slides, and build transcripts, guides, flashcards, tests, presentations, podcasts, and collaboration rooms.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">AI lecture transcription</div>
                <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">Study guides and summaries</div>
                <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">Flashcards, tests, presentations, podcasts, past papers, and collaboration</div>
              </div>
            </section>
            <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_28px_80px_rgba(2,8,23,0.55)]">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Access</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Continue into Mabaso</h2>
              <div className="mt-8 space-y-5">
                <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4">
                  <label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Study material language</label>
                  <select value={outputLanguage} onChange={(event) => setOutputLanguage(event.target.value)} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none">
                    {outputLanguageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <p className="mt-3 text-sm leading-7 text-slate-300">Generated study guides, tests, presentations, podcasts, and study chat answers follow this language, including isiZulu.</p>
                </div>
                {authEmailInput ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100">
                    Last used on this device: {authEmailInput}
                  </div>
                ) : null}
                <div ref={googleButtonRef} className="min-h-[44px] w-full max-w-[320px] overflow-hidden" />
                {isGoogleSigningIn ? <div className="max-w-[320px] rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100">Finishing Google sign-in and opening your capture page...</div> : null}
                {isAppleConfigured ? (
                  <button
                    type="button"
                    onClick={startAppleLogin}
                    disabled={isAppleSigningIn || !appleSignInAvailable}
                    className="flex w-full max-w-[320px] items-center justify-center gap-3 rounded-full border border-white/10 bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path d="M16.37 12.48c.03 3.12 2.73 4.16 2.76 4.17-.02.07-.43 1.49-1.41 2.96-.85 1.27-1.73 2.53-3.12 2.56-1.37.03-1.81-.81-3.38-.81-1.56 0-2.06.79-3.35.84-1.34.05-2.36-1.35-3.22-2.61-1.75-2.53-3.08-7.15-1.29-10.26.89-1.54 2.48-2.51 4.21-2.54 1.31-.03 2.55.88 3.35.88.8 0 2.31-1.08 3.89-.92.66.03 2.52.27 3.71 2.01-.1.06-2.22 1.3-2.2 3.72Zm-2.72-6.31c.71-.86 1.18-2.04 1.05-3.22-1.02.04-2.26.68-2.99 1.54-.66.76-1.24 1.96-1.09 3.1 1.14.09 2.31-.58 3.03-1.42Z" fill="currentColor" />
                    </svg>
                    <span>{isAppleSigningIn ? "Connecting iPhone..." : "Continue with iPhone"}</span>
                  </button>
                ) : null}
                <form onSubmit={handleAuthFormSubmit} className="rounded-2xl border border-white/10 bg-slate-950/75 p-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={openLoginMode}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${["login", "reset"].includes(authMode) ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                    >
                      Log In
                    </button>
                    <button
                      type="button"
                      onClick={openRegisterMode}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${authMode === "register" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                    >
                      Create Account
                    </button>
                  </div>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label htmlFor="auth-email" className="block text-xs uppercase tracking-[0.24em] text-slate-400">Email</label>
                      <input
                        id="auth-email"
                        name="username"
                        type="email"
                        value={authEmailInput}
                        onChange={(event) => {
                          setAuthEmailInput(event.target.value);
                          if (authPasswordIsIncorrect) setAuthMessage("");
                        }}
                        readOnly={isRegistrationVerificationStep || isRegistrationPasswordStep}
                        className={`mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none ${isRegistrationVerificationStep || isRegistrationPasswordStep ? "cursor-not-allowed opacity-75" : ""}`}
                        placeholder="you@example.com"
                        autoComplete="username"
                        inputMode="email"
                        autoCapitalize="none"
                        spellCheck={false}
                      />
                      {isRegistrationEmailStep ? <p className="mt-2 text-xs leading-6 text-slate-400">Enter your email and we will verify it first, then let you create your password.</p> : null}
                      {isRegistrationVerificationStep ? <p className="mt-2 text-xs leading-6 text-emerald-200">Step 2 of 3. We sent a verification code to {pendingEmailAuthEmail || authEmailInput}.</p> : null}
                      {isRegistrationPasswordStep ? <p className="mt-2 text-xs leading-6 text-emerald-200">Step 3 of 3. Email verified for {pendingEmailAuthEmail || authEmailInput}. Create the password you will use on any device.</p> : null}
                    </div>

                    {(authMode === "login" || isResetMode || isRegistrationPasswordStep) ? (
                      <div>
                        <label htmlFor="auth-password" className="block text-xs uppercase tracking-[0.24em] text-slate-400">{isResetMode ? "New Password" : "Password"}</label>
                        <div className="relative mt-2">
                          <input
                            id="auth-password"
                            name={authMode === "login" ? "current-password" : "new-password"}
                            type={showAuthPassword ? "text" : "password"}
                            value={authPasswordInput}
                            onChange={(event) => {
                              setAuthPasswordInput(event.target.value);
                              if (authPasswordIsIncorrect) setAuthMessage("");
                            }}
                            className={`w-full rounded-2xl border px-4 py-3 pr-16 text-sm outline-none ${authPasswordIsIncorrect ? "border-rose-300/55 bg-rose-500/10 text-rose-50 placeholder:text-rose-200/70" : "border-white/10 bg-slate-900 text-white"}`}
                            placeholder={isRegistrationPasswordStep ? "Create a password" : isResetMode ? "Enter a new password" : "Enter your password"}
                            autoComplete={authMode === "login" ? "current-password" : "new-password"}
                          />
                          <button
                            type="button"
                            onClick={() => setShowAuthPassword((current) => !current)}
                            className="absolute right-2 top-1/2 inline-flex h-10 min-w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-slate-950/80 px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                            aria-label={showAuthPassword ? "Hide password" : "Show password"}
                            aria-pressed={showAuthPassword}
                          >
                            {showAuthPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                        <p className={`mt-2 text-xs leading-6 ${authPasswordIsIncorrect ? "text-rose-200" : "text-slate-400"}`}>
                          {authPasswordIsIncorrect ? "Incorrect password." : `Use at least ${MIN_PASSWORD_LENGTH} characters.`}
                        </p>
                        {authMode === "login" ? (
                          <button
                            type="button"
                            onClick={startForgotPassword}
                            className="mt-2 text-sm font-medium text-rose-200 transition hover:text-white"
                          >
                            Forgot Password?
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {(isResetMode || isRegistrationPasswordStep) ? (
                      <div>
                        <label htmlFor="auth-confirm-password" className="block text-xs uppercase tracking-[0.24em] text-slate-400">Confirm Password</label>
                        <input
                          id="auth-confirm-password"
                          name="confirm-password"
                          type={showAuthPassword ? "text" : "password"}
                          value={authConfirmPasswordInput}
                          onChange={(event) => setAuthConfirmPasswordInput(event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
                          placeholder="Confirm your password"
                          autoComplete="new-password"
                        />
                      </div>
                    ) : null}

                    {authMode === "login" ? (
                      <button
                        type="submit"
                        disabled={isSigningInWithPassword || isRequestingEmailCode || isVerifyingEmailCode}
                        className="w-full rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {isSigningInWithPassword ? "Logging In..." : "Log In"}
                      </button>
                    ) : null}

                    {isRegistrationEmailStep ? (
                      <div className="space-y-3">
                        <button
                          type="submit"
                          disabled={isRequestingEmailCode || isVerifyingEmailCode}
                          className="w-full rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {isRequestingEmailCode ? "Sending Verification Code..." : "Send Verification Code"}
                        </button>
                        <p className="text-xs leading-6 text-slate-400">Your study history stays linked to this email and loads again when you sign in on another device.</p>
                      </div>
                    ) : null}

                    {isRegistrationVerificationStep ? (
                      <div className="rounded-2xl border border-emerald-300/18 bg-emerald-300/8 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Verify Email</p>
                        <p className="mt-2 text-sm leading-7 text-slate-200">Enter the code sent to {pendingEmailAuthEmail} before you create the password for this account.</p>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={authCodeInput}
                          onChange={(event) => setAuthCodeInput(event.target.value)}
                          className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm tracking-[0.35em] text-white outline-none"
                          placeholder="000000"
                          autoComplete="one-time-code"
                        />
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={verifyRegistrationCode}
                            disabled={isVerifyingEmailCode}
                            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
                          >
                            {isVerifyingEmailCode ? "Verifying..." : "Verify Email"}
                          </button>
                          <button
                            type="button"
                            onClick={requestRegistrationCode}
                            disabled={isRequestingEmailCode || isVerifyingEmailCode}
                            className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            Resend Code
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              resetRegistrationFlow();
                              setAuthMessage("Enter your email and we will send a verification code.");
                            }}
                            className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
                          >
                            Use Another Email
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {isRegistrationPasswordStep ? (
                      <div className="space-y-3">
                        <p className="text-xs leading-6 text-slate-400">This account will remember your work with {pendingEmailAuthEmail} and sync study history after sign-in on any device.</p>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="submit"
                            disabled={isSigningInWithPassword}
                            className="rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {isSigningInWithPassword ? "Creating Account..." : "Create Account"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              resetRegistrationFlow();
                              setAuthMessage("Enter your email and we will send a verification code.");
                            }}
                            className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
                          >
                            Start Over
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {isResetMode ? (
                      <button
                        type="submit"
                        disabled={isRequestingEmailCode || isVerifyingEmailCode}
                        className="w-full rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {isRequestingEmailCode ? "Sending Reset Code..." : "Send Reset Code"}
                      </button>
                    ) : null}
                  </div>
                  {showResetVerificationCard ? (
                    <div className="mt-5 rounded-2xl border border-emerald-300/18 bg-emerald-300/8 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Verification</p>
                      <p className="mt-2 text-sm leading-7 text-slate-200">Enter the verification code sent to {pendingEmailAuthEmail} to finish resetting your password.</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={authCodeInput}
                        onChange={(event) => setAuthCodeInput(event.target.value)}
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm tracking-[0.35em] text-white outline-none"
                        placeholder="000000"
                        autoComplete="one-time-code"
                      />
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={verifyEmailPasswordCode}
                          disabled={isVerifyingEmailCode}
                          className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
                        >
                          {isVerifyingEmailCode ? "Verifying..." : "Verify and Reset Password"}
                        </button>
                        <button
                          type="button"
                          onClick={requestEmailPasswordCode}
                          disabled={isRequestingEmailCode || isVerifyingEmailCode}
                          className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Resend Code
                        </button>
                      </div>
                    </div>
                  ) : null}
                </form>
                {showAuthMessageBanner ? <div className={`rounded-2xl border px-4 py-3 text-sm ${authMessageIsError ? "border-rose-300/25 bg-rose-500/10 text-rose-100" : authMessageIsPositive ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-slate-950/75 text-slate-200"}`}>{authMessage}</div> : null}
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (authToken && currentPage === "mode-select" && isAdminAccount) {
    return (
      <div className="min-h-screen bg-[var(--page-bg)] text-slate-100">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="hero-glow hero-glow-left" />
          <div className="hero-glow hero-glow-right" />
          <div className="hero-grid" />
        </div>
        <main className="relative mx-auto flex min-h-screen max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
          <section className="w-full rounded-[32px] border border-white/10 bg-slate-950/75 p-6 shadow-[0_28px_80px_rgba(2,8,23,0.55)]">
            <p className="brand-mark text-2xl font-black sm:text-4xl">MABASO</p>
            <p className="mt-4 text-xs uppercase tracking-[0.3em] text-emerald-200/70">Mode selection</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Choose how this account should enter the platform.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">This login matches an admin account, but the admin area stays hidden unless you deliberately switch into admin mode.</p>
            <div className="mt-8 grid gap-5 xl:grid-cols-2">
              <button type="button" onClick={() => chooseSessionMode("user")} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-left transition hover:bg-white/10"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">User mode</p><h2 className="mt-3 text-2xl font-semibold text-white">Open the normal student workspace</h2><p className="mt-3 text-sm leading-7 text-slate-300">Capture lectures, generate study guides, and use the platform like a normal user.</p></button>
              <button type="button" onClick={() => chooseSessionMode("admin")} className="rounded-[28px] border border-emerald-300/20 bg-emerald-300/10 p-6 text-left transition hover:border-emerald-300/35"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Admin mode</p><h2 className="mt-3 text-2xl font-semibold text-white">Open the protected admin dashboard</h2><p className="mt-3 text-sm leading-7 text-slate-200">Review users, logs, AI generation activity, system health, and security alerts with server-side checks enforced.</p></button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-slate-200">Signed in as {authEmail}</div>
              <div className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-slate-200">Selected language: {outputLanguage}</div>
              <button type="button" onClick={logout} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white">Sign Out</button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (authToken && currentPage === "admin" && authSessionMode === "admin") {
    return renderAdminDashboardPage();
  }

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-glow hero-glow-left" />
        <div className="hero-glow hero-glow-right" />
        <div className="hero-grid" />
      </div>
      <main className="relative mx-auto max-w-7xl overflow-x-clip px-3 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-slate-950/65 px-5 py-4 shadow-[0_24px_70px_rgba(2,8,23,0.35)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div><p className="brand-mark text-2xl font-black sm:text-4xl">MABASO</p><p className="mt-2 text-sm text-slate-300">Record your lecture while teaching and get notes automatically.</p></div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            <div className="hidden flex-wrap items-center gap-3 sm:flex">
              <button type="button" onClick={() => setCurrentPage("capture")} className={`rounded-full px-4 py-2 text-sm ${currentPage === "capture" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}>Capture Lecture</button>
              <button type="button" onClick={() => setCurrentPage("workspace")} disabled={!hasResults} className={`rounded-full px-4 py-2 text-sm ${currentPage === "workspace" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"} disabled:opacity-50`}>Study Workspace</button>
              <button type="button" onClick={() => { setCurrentPage("collaboration"); refreshCollaborationRooms(true); }} disabled={!hasResults} className={`rounded-full px-4 py-2 text-sm ${currentPage === "collaboration" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"} disabled:opacity-50`}>Collaboration</button>
              {isAdminAccount ? <button type="button" onClick={() => setCurrentPage(authSessionMode === "admin" ? "admin" : "mode-select")} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50">{authSessionMode === "admin" ? "Admin Dashboard" : "Choose Mode"}</button> : null}
            </div>
            <div className="force-mobile-stack flex flex-wrap items-center gap-3">
              <label className="rounded-2xl border border-white/10 bg-slate-950/75 px-3 py-2 text-sm text-slate-200">
                <span className="mr-2 text-xs uppercase tracking-[0.18em] text-slate-400">Language</span>
                <select value={outputLanguage} onChange={(event) => setOutputLanguage(event.target.value)} className="bg-transparent text-sm text-white outline-none">
                  {outputLanguageOptions.map((option) => <option key={option.value} value={option.value} className="bg-slate-950 text-white">{option.label}</option>)}
                </select>
              </label>
              <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">Signed in as {authEmail}</div>
              <button type="button" onClick={logout} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">Sign Out</button>
            </div>
          </div>
        </header>
        <div className="mb-6 grid grid-cols-3 gap-3 sm:hidden">
          <button type="button" onClick={() => setCurrentPage("capture")} className={`min-h-[56px] rounded-[20px] px-4 py-3 text-sm font-semibold ${currentPage === "capture" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>Capture</button>
          <button type="button" onClick={() => setCurrentPage("workspace")} disabled={!hasResults} className={`min-h-[56px] rounded-[20px] px-4 py-3 text-sm font-semibold ${currentPage === "workspace" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"} disabled:opacity-50`}>Workspace</button>
          <button type="button" onClick={() => { setCurrentPage("collaboration"); refreshCollaborationRooms(true); }} disabled={!hasResults} className={`min-h-[56px] rounded-[20px] px-4 py-3 text-sm font-semibold ${currentPage === "collaboration" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"} disabled:opacity-50`}>Collaborate</button>
        </div>
        <div className="mb-6 hidden flex-wrap gap-3 sm:flex">{progressSteps.map((step, index) => <div key={step} className={`rounded-full border px-4 py-2 text-sm ${index === activeStepIndex ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : index < activeStepIndex ? "border-white/10 bg-white/5 text-white" : "border-white/10 bg-slate-950/75 text-slate-300"}`}>{step}</div>)}</div>

        {currentPage === "capture" ? <section className="mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_30px_80px_rgba(8,15,30,0.45)] backdrop-blur xl:p-8">
          <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-100">Step 2 of 4</div>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => setCurrentPage("about")} className="text-sm font-medium text-slate-300 transition hover:text-white">Help and About</button>
              <button type="button" onClick={() => { setSupportFeedback(""); setCurrentPage("support"); }} className="text-sm font-medium text-slate-300 transition hover:text-white">Support and Contact</button>
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(6,18,12,0.96),rgba(1,7,4,0.98))] p-5 shadow-[0_20px_60px_rgba(2,8,23,0.55)] xl:p-6">
              <div onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); setDragActive(false); handleLectureBundleFilesChange(event.dataTransfer.files); }} className={`rounded-[24px] border border-dashed p-5 transition ${dragActive ? "border-emerald-300 bg-emerald-300/10" : "border-white/15 bg-white/[0.03]"}`}>
                <div className="space-y-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#22c55e,#166534)] text-2xl font-black text-white">M</div>
                  <div><h2 className="text-2xl font-semibold text-white">Build your lecture workspace</h2><p className="mt-2 text-sm leading-7 text-slate-300">Add one source at a time or use one combined lecture-file upload and let MABASO sort notes, slides, past papers, and lecture media in the background, then process the whole bundle automatically.</p></div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading} className="min-h-[72px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white disabled:opacity-50"><span className="block text-sm font-semibold">Select Video / Recording File</span><span className="mt-2 block text-[10px] uppercase tracking-[0.22em] text-slate-400">Audio and video</span></button>
                    <button type="button" onClick={() => bulkLectureFileInputRef.current?.click()} disabled={loading} className="min-h-[72px] rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-left text-emerald-50 disabled:opacity-50"><span className="block text-sm font-semibold">Add Lecture Files</span><span className="mt-2 block text-[10px] uppercase tracking-[0.22em] text-emerald-100/80">Auto-sort and process mixed files</span></button>
                    <button type="button" onClick={recording ? stopRecording : startRecording} disabled={loading} className={`min-h-[72px] rounded-2xl px-4 py-3 text-left text-sm font-semibold ${recording ? "bg-rose-500 text-white" : "border border-emerald-300/20 bg-emerald-300/10 text-emerald-50"} disabled:opacity-50`}><span className="block">{recording ? "Stop Recording" : "Record Live Lecture"}</span><span className={`mt-2 block text-[10px] uppercase tracking-[0.22em] ${recording ? "text-rose-50/80" : "text-emerald-100/80"}`}>Auto-stop after 10 min silence</span></button>
                    <button type="button" onClick={() => lectureNotesFileInputRef.current?.click()} disabled={loading} className="min-h-[72px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white disabled:opacity-50"><span className="block text-sm font-semibold">Upload Notes</span><span className="mt-2 block text-[10px] uppercase tracking-[0.22em] text-slate-400">TXT MD PDF DOCX IMG</span></button>
                    <button type="button" onClick={() => lectureSlidesFileInputRef.current?.click()} disabled={loading} className="min-h-[72px] rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-left text-emerald-50 disabled:opacity-50"><span className="block text-sm font-semibold">Upload Slides</span><span className="mt-2 block text-[10px] uppercase tracking-[0.22em] text-emerald-100/80">IMG TXT MD PDF PPTX DOCX</span></button>
                    <button type="button" onClick={() => pastQuestionPaperFileInputRef.current?.click()} disabled={loading} className="min-h-[72px] rounded-2xl border border-emerald-300/20 bg-slate-950/75 px-4 py-3 text-left text-emerald-50 disabled:opacity-50"><span className="block text-sm font-semibold">Upload Past Paper</span><span className="mt-2 block text-[10px] uppercase tracking-[0.22em] text-emerald-100/80">IMG TXT MD PDF PPTX DOCX</span></button>
                    <button type="button" onClick={() => videoUrlInputRef.current?.focus()} disabled={loading} className="min-h-[72px] rounded-2xl border border-emerald-300/20 bg-slate-950/75 px-4 py-3 text-left text-emerald-50 disabled:opacity-50"><span className="block text-sm font-semibold">Use Video Link</span><span className="mt-2 block text-[10px] uppercase tracking-[0.22em] text-emerald-100/80">YouTube or public URL</span></button>
                  </div>
                  <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Video Link</p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input ref={videoUrlInputRef} value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none" placeholder="Paste a YouTube or public video URL here" />
                      <button type="button" onClick={transcribeVideoLink} disabled={loading || !videoUrl.trim()} className="rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isTranscribingVideo ? "Reading Link..." : "Transcribe Video Link"}</button>
                    </div>
                    <p className="mt-3 text-xs leading-6 text-slate-300">Use this when the lecture already exists online and you want the study guide, test, formulas, and worked examples from that video. Public captions help most, and some YouTube links still need backend cookies or a proxy when the server cannot read the link directly.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={upload} disabled={loading || !file} className="min-h-[124px] rounded-[22px] bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-4 text-left text-white disabled:opacity-50">
                      <span className="block text-base font-semibold">Transcribe Lecture</span>
                      {transcribeActionMeta.showProgress ? (
                        <div className="mt-4">
                          <div className="h-1.5 overflow-hidden rounded-full bg-black/20">
                            <div className="progress-bar h-full rounded-full bg-[linear-gradient(90deg,#dcfce7,#bbf7d0,#86efac)]" style={{ width: `${transcribeActionMeta.progressValue}%` }} />
                          </div>
                          <p className="mt-3 text-xs leading-6 text-emerald-50/90">{transcribeActionMeta.statusLine}</p>
                          <div className="mt-3 space-y-2">
                            {transcribeActionSteps.map((step) => <div key={step.label} className={`rounded-2xl border px-3 py-2 text-xs ${step.tone === "done" ? "border-emerald-200/25 bg-emerald-200/10 text-emerald-50" : step.tone === "current" ? "border-emerald-100/20 bg-black/15 text-white" : "border-white/10 bg-black/10 text-emerald-50/70"}`}>{step.label}</div>)}
                          </div>
                        </div>
                      ) : null}
                    </button>
                    <div>
                      <button type="button" onClick={() => generateStudyGuide()} disabled={loading || !hasStudyInputs} className="min-h-[124px] w-full rounded-[22px] bg-[linear-gradient(135deg,#f59e0b,#f97316)] px-5 py-4 text-left text-white disabled:opacity-50">
                        <span className="block text-base font-semibold">Generate Study Guide</span>
                        {guideActionMeta.showProgress ? (
                          <div className="mt-4">
                            <div className="h-1.5 overflow-hidden rounded-full bg-black/20">
                              <div className="progress-bar h-full rounded-full bg-[linear-gradient(90deg,#fde68a,#fdba74,#fb923c)]" style={{ width: `${guideActionMeta.progressValue}%` }} />
                            </div>
                            <p className="mt-3 text-xs leading-6 text-amber-50/90">{guideActionMeta.statusLine}</p>
                            <div className="mt-3 space-y-2">
                              {guideActionSteps.map((step) => <div key={step.label} className={`rounded-2xl border px-3 py-2 text-xs ${step.tone === "done" ? "border-amber-100/25 bg-amber-100/10 text-amber-50" : step.tone === "current" ? "border-amber-100/20 bg-black/15 text-white" : "border-white/10 bg-black/10 text-amber-50/70"}`}>{step.label}</div>)}
                            </div>
                          </div>
                        ) : null}
                      </button>
                      <p className={`mt-2 text-xs leading-6 ${slidesReadyForGuide ? "text-emerald-200" : "text-rose-200"}`}>{slideGuideStatusLine}</p>
                    </div>
                  </div>
                  {hasResults ? <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-50">Study workspace is ready. Open it from the Workspace tab above.</div> : null}
                  <input ref={fileInputRef} type="file" accept={LECTURE_MEDIA_ACCEPT} className="hidden" onChange={(event) => handleFileChange(event.target.files?.[0])} />
                  <input ref={bulkLectureFileInputRef} type="file" accept={BULK_LECTURE_ACCEPT} multiple className="hidden" onChange={(event) => { handleLectureBundleFilesChange(event.target.files); event.target.value = ""; }} />
                  <input ref={lectureNotesFileInputRef} type="file" accept={NOTE_SOURCE_ACCEPT} multiple className="hidden" onChange={(event) => { handleLectureNotesFileChange(event.target.files); event.target.value = ""; }} />
                  <input ref={lectureSlidesFileInputRef} type="file" accept={SLIDE_SOURCE_ACCEPT} multiple className="hidden" onChange={(event) => { handleLectureSlidesFilesChange(event.target.files); event.target.value = ""; }} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4"><div className="force-mobile-stack flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Lecture Notes</p><p className="mt-3 text-sm font-semibold text-white">{lectureNoteFileNames.length ? `${lectureNoteFileNames.length} source${lectureNoteFileNames.length === 1 ? "" : "s"} added` : "No notes added yet"}</p></div><button type="button" onClick={() => lectureNotesFileInputRef.current?.click()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-base font-bold text-white">+</span><span>Add More</span></button></div>{lectureNoteSources.length ? <div className="mt-4 grid gap-3">{lectureNoteSources.map((source) => <div key={source.id} className="relative rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 pr-11 text-sm text-slate-200"><button type="button" onClick={() => removeLectureNoteSource(source.id)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white transition hover:bg-white/10" aria-label={`Remove ${source.name}`}>&times;</button><p className="phone-safe-copy font-semibold text-white">{source.name}</p><p className="mt-2 text-xs uppercase tracking-[0.22em] text-emerald-200/70">{source.prefix || "LECTURE NOTE"}</p></div>)}</div> : <p className="mt-3 text-xs leading-6 text-slate-300">Accepted here: TXT, MD, PDF, DOCX, and clear note images.</p>}</div>
                <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-4"><div className="force-mobile-stack flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Lecture Slides</p><p className="mt-3 text-sm font-semibold text-white">{lectureSlideFileNames.length ? `${lectureSlideFileNames.length} source${lectureSlideFileNames.length === 1 ? "" : "s"} added` : "No slides added yet"}</p></div><button type="button" onClick={() => lectureSlidesFileInputRef.current?.click()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300/20 bg-slate-950/75 px-3 py-2 text-xs font-semibold text-emerald-50 disabled:opacity-50"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20 text-base font-bold text-emerald-100">+</span><span>Add More</span></button></div>{lectureSlideSources.length ? <div className="mt-4 grid gap-3">{lectureSlideSources.map((source) => <div key={source.id} className="relative rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 pr-11 text-sm text-slate-200"><button type="button" onClick={() => removeLectureSlideSource(source.id)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white transition hover:bg-white/10" aria-label={`Remove ${source.name}`}>&times;</button><p className="phone-safe-copy font-semibold text-white">{source.name}</p><p className="mt-2 text-xs uppercase tracking-[0.22em] text-emerald-200/70">{source.prefix || "SLIDE SOURCE"}</p></div>)}</div> : null}</div>
                <div className="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-4">
                  <div className="force-mobile-stack flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.24em] text-amber-100/80">Past Question Papers</p>
                      <p className="mt-3 text-sm font-semibold text-white">{pastQuestionPaperFileNames.length ? `${pastQuestionPaperFileNames.length} paper${pastQuestionPaperFileNames.length === 1 ? "" : "s"} added` : "No past papers added yet"}</p>
                    </div>
                    <button type="button" onClick={() => pastQuestionPaperFileInputRef.current?.click()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-300/20 bg-slate-950/75 px-3 py-2 text-xs font-semibold text-amber-50 disabled:opacity-50"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/20 text-base font-bold text-amber-100">+</span><span>Add Paper</span></button>
                  </div>
                  {pastQuestionPaperSources.length ? <div className="mt-4 grid gap-3">{pastQuestionPaperSources.map((source) => <div key={source.id} className="relative rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 pr-11 text-sm text-slate-200"><button type="button" onClick={() => removePastQuestionPaperSource(source.id)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white transition hover:bg-white/10" aria-label={`Remove ${source.name}`}>&times;</button><p className="phone-safe-copy font-semibold text-white">{source.name}</p><p className="mt-2 text-xs uppercase tracking-[0.22em] text-amber-100/80">{source.prefix || "PAST QUESTION PAPER"}</p></div>)}</div> : null}
                  <div className="mt-4">
                    <label className="block text-xs uppercase tracking-[0.22em] text-amber-100/80">Memo / Marking Guide</label>
                    <textarea value={pastQuestionMemo} onChange={(event) => setPastQuestionMemo(event.target.value)} rows={7} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-7 text-slate-100 outline-none" placeholder="Paste the memo, model answers, or marking guide here. It will be used as an extra reference for study-guide and test generation." />
                    <p className="mt-3 text-xs leading-6 text-slate-300">Useful when you want the generated notes and test to match the same style, answers, and mark logic.</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Selected File", value: workspaceFileLabel }, { label: "Size", value: file ? formatBytes(file.size) : videoUrl.trim() ? "Video link" : lectureNotes.trim() || lectureSlideFileNames.length || pastQuestionPaperFileNames.length ? "Study source" : activeHistoryItem ? "Saved workspace" : "Waiting" }, { label: "Status", value: isMarkingQuiz ? "Marking test" : isAskingChat ? "Answering" : loading ? currentJobType === "study_guide" ? "Generating notes" : currentJobType === "presentation" ? "Generating presentation" : currentJobType === "podcast" ? "Generating podcast" : currentJobType === "teacher_lesson" ? "Preparing teacher" : currentJobType === "notes" ? "Reading notes" : currentJobType === "slides" ? "Reading slides" : currentJobType === "past_papers" ? "Reading past papers" : currentJobType === "video" ? "Reading video link" : isProcessingLectureBundle ? "Processing lecture files" : "Transcribing" : hasResults ? "Ready" : "Waiting" }, { label: "Signed In", value: authEmail || "Not signed in" }].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-4"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{item.label}</p><p className="mt-3 break-words text-sm font-semibold text-white">{item.value}</p></div>)}</div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/75 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Latest capture update</p>
                <p className="mt-3 text-sm font-semibold text-white">{status || "Ready for your next lecture."}</p>
                {usedFallbackSummary ? <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">MABASO returned a fallback study guide instead of leaving the lecture blank.</div> : null}
                {error ? <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"><p className="font-semibold">Processing failed</p><p className="mt-2">{error}</p>{errorHint && !(error || "").toLowerCase().includes(errorHint.trim().toLowerCase()) ? <p className="mt-2 text-rose-100/80">{errorHint}</p> : null}</div> : null}
              </div>
            </aside>
        </section> : null}

        {currentPage === "workspace" ? <section className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_24px_80px_rgba(2,8,23,0.35)] backdrop-blur xl:p-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              {renderBackButton(() => setCurrentPage("capture"), "Back to capture page")}
              <div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Study Workspace</p><h2 className="mt-2 text-3xl font-semibold text-white">Choose the tool you want to use now.</h2></div>
            </div>
            <div className="overflow-x-auto pb-1"><div className="flex min-w-max gap-2">{workspaceTabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-full px-4 py-2 text-sm transition ${activeTab === tab.id ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"}`}>{tab.label}</button>)}<button type="button" onClick={() => { setCurrentPage("collaboration"); refreshCollaborationRooms(true); }} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50 transition hover:bg-emerald-300/15">Collaboration</button></div></div>
          </div>

          <div className="mt-6 space-y-5">
            <div className="min-w-0 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5">
              <div className="force-mobile-stack mb-4 flex flex-wrap items-center justify-between gap-4">
                <div><p className="text-xs uppercase tracking-[0.28em] text-slate-400">Study Tool</p><h3 className="mt-2 text-2xl font-semibold text-white">{currentTabLabel}</h3></div>
                <div className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs uppercase tracking-[0.25em] text-slate-300">{hasResults ? "Generated" : "Awaiting lecture"}</div>
              </div>
              <div className="force-mobile-stack mb-4 flex flex-wrap gap-3">
                <button type="button" onClick={copyActiveContent} disabled={!canExportCurrent} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50">Copy Current Section</button>
                <div className="relative">
                  <button type="button" onClick={() => setIsDownloadMenuOpen((current) => !current)} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50">Download</button>
                  {isDownloadMenuOpen ? <div className="absolute left-0 top-full z-20 mt-2 min-w-[220px] rounded-[22px] border border-white/10 bg-slate-950/95 p-2 shadow-[0_18px_40px_rgba(2,8,23,0.45)]"><button type="button" onClick={async () => { setIsDownloadMenuOpen(false); await downloadActiveContent(); }} disabled={!canExportCurrent} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-white transition hover:bg-white/5 disabled:opacity-50"><span>Current section PDF</span><span className="text-xs uppercase tracking-[0.2em] text-slate-400">{currentTabLabel}</span></button><button type="button" onClick={async () => { setIsDownloadMenuOpen(false); await downloadFullStudyPackPdf(); }} disabled={!hasResults} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-white transition hover:bg-white/5 disabled:opacity-50"><span>Full study pack PDF</span><span className="text-xs uppercase tracking-[0.2em] text-slate-400">All tools</span></button>{activeTab === "quiz" ? <button type="button" onClick={async () => { setIsDownloadMenuOpen(false); await downloadQuizPdf(); }} disabled={!selectedQuizQuestions.length} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-white transition hover:bg-white/5 disabled:opacity-50"><span>Test PDF</span><span className="text-xs uppercase tracking-[0.2em] text-slate-400">Quiz</span></button> : null}{activeTab === "presentation" ? <button type="button" onClick={async () => { setIsDownloadMenuOpen(false); await downloadPresentationFile(); }} disabled={!presentationData.jobId} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-white transition hover:bg-white/5 disabled:opacity-50"><span>PowerPoint file</span><span className="text-xs uppercase tracking-[0.2em] text-slate-400">PPTX</span></button> : null}{activeTab === "podcast" ? <button type="button" onClick={async () => { setIsDownloadMenuOpen(false); await downloadPodcastAudio(); }} disabled={!podcastData.jobId} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-white transition hover:bg-white/5 disabled:opacity-50"><span>Podcast audio</span><span className="text-xs uppercase tracking-[0.2em] text-slate-400">MP3</span></button> : null}</div> : null}
                </div>
                {canShareCurrentTool ? <button type="button" onClick={syncCurrentTabToRoom} className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-white">Share Current Tool</button> : null}
                <button type="button" onClick={() => { setCurrentPage("collaboration"); refreshCollaborationRooms(true); }} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50">Open Collaboration Page</button>
              </div>

              <div className={`content-panel min-h-[420px] w-full min-w-0 max-w-full rounded-[24px] border border-white/10 p-4 sm:p-5 ${activeTab === "guide" ? "bg-black/70" : "bg-slate-950/70"}`}>
                {activeTab === "guide" ? (
                  <div className="min-w-0 space-y-5">
                    <div
                      ref={(node) => {
                        if (node && guideTitleSection) teacherSectionRefs.current[guideTitleSection.normalizedHeading] = node;
                        else if (guideTitleSection) delete teacherSectionRefs.current[guideTitleSection.normalizedHeading];
                        if (node && guideSummarySection) teacherSectionRefs.current[guideSummarySection.normalizedHeading] = node;
                        else if (guideSummarySection) delete teacherSectionRefs.current[guideSummarySection.normalizedHeading];
                      }}
                      className="rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.16),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))] p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Lecture Topic</p>
                          <h4 className="mt-2 text-3xl font-semibold text-white">{guideTopic}</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">
                            {visibleGuideSections.length} guide section{visibleGuideSections.length === 1 ? "" : "s"}
                          </div>
                          <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-emerald-50">
                            Q&amp;A stays in the guide
                          </div>
                        </div>
                      </div>
                      {guideSummarySection?.content ? (
                        <div className="notes-markdown phone-safe-copy mt-4 prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-strong:text-emerald-100 prose-li:text-slate-200">
                          <ReactMarkdown>{guideSummarySection.content}</ReactMarkdown>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[24px] border border-emerald-300/20 bg-emerald-300/10 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.24em] text-emerald-100/80">Teacher Mode</p>
                          <h4 className="mt-2 text-2xl font-semibold text-white">Friendly lesson walkthrough that stays with the guide.</h4>
                          <p className="mt-3 text-sm leading-7 text-slate-200">This gives a longer 15+ minute explanation, spends extra time on worked examples, skips flashcards and Q&amp;A, and follows the guide while it speaks.</p>
                        </div>
                        <div className="force-mobile-stack flex flex-wrap gap-3">
                          <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-200">
                            {teacherLessonData.segments.length ? `${teacherEstimatedMinutes} min lesson` : "15+ min target"}
                          </div>
                          <button type="button" onClick={() => generateTeacherLesson({ autoplay: true })} disabled={loading || !hasStudyInputs} className="rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isGeneratingTeacherLesson ? "Building Teacher..." : teacherLessonData.segments.length ? "Rebuild Teacher" : "Build Teacher Lesson"}</button>
                          <button type="button" onClick={() => playTeacherLesson()} disabled={!teacherLessonData.segments.length} className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-white disabled:opacity-50">Play</button>
                          <button type="button" onClick={pauseTeacherLesson} disabled={!isTeacherPlaying} className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-white disabled:opacity-50">Pause</button>
                          <button type="button" onClick={resumeTeacherLesson} disabled={!teacherLessonData.segments.length || !isTeacherPaused} className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-white disabled:opacity-50">Resume</button>
                          <button type="button" onClick={() => stopTeacherPlayback({ resetIndex: true })} disabled={!isTeacherPlaying && !isTeacherPaused} className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-white disabled:opacity-50">Stop</button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm leading-7 text-slate-200">
                          {teacherLessonData.overview || "Generate teacher mode to hear a softer 15+ minute explanation that teaches the guide instead of reading it line by line."}
                          {activeTeacherSegment ? <p className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-3 text-sm text-emerald-50">Now covering: {activeTeacherSegment.sectionHeading}{activeTeacherSegment.prompt ? ` - ${activeTeacherSegment.prompt}` : ""}</p> : null}
                        </div>
                        <div>
                          <label className="block text-xs uppercase tracking-[0.22em] text-slate-300">Voice</label>
                          <select value={selectedTeacherVoiceName} onChange={(event) => setSelectedTeacherVoiceName(event.target.value)} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none">
                            {teacherVoiceOptions.length ? teacherVoiceOptions.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} ({voice.lang})</option>) : <option value="">Browser default voice</option>}
                          </select>
                        </div>
                      </div>
                    </div>

                    {studyImages.length ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Study Photos</p>
                          <p className="mt-2 text-sm leading-7 text-slate-300">Visual references matched to the guide so the notes can feel closer to the lecture material.</p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {studyImages.map((image, index) => (
                            <article key={`${image.image_url || image.source_url || image.title}-${index}`} className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/75">
                              <img src={image.image_url} alt={image.title || image.query || `Study photo ${index + 1}`} className="h-48 w-full object-cover" loading="lazy" />
                              <div className="space-y-2 p-4">
                                <p className="text-sm font-semibold text-white">{image.title || image.query || `Study photo ${index + 1}`}</p>
                                <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">{image.matched_section || image.query || "Study reference"}</p>
                                <p className="text-sm leading-6 text-slate-300">{image.key_highlight || image.diagram_label || "Use this image as a visual anchor while revising this section."}</p>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {visibleGuideSections.length ? (
                      <div className="space-y-4">
                        {visibleGuideSections.map((section, index) => {
                          const isActiveSection = activeTeacherSegment?.sectionHeading
                            ? (activeTeacherSegment.sectionHeading || "").trim().toLowerCase() === section.normalizedHeading
                              || (activeTeacherSegment.sectionHeading || "").trim().toLowerCase().includes(section.normalizedHeading)
                            : false;
                          return (
                            <article
                              key={`${section.heading}-${index}`}
                              ref={(node) => {
                                if (node) teacherSectionRefs.current[section.normalizedHeading] = node;
                                else delete teacherSectionRefs.current[section.normalizedHeading];
                              }}
                              className={`rounded-[24px] border p-4 transition ${isActiveSection ? "border-emerald-300/35 bg-emerald-300/10" : "border-white/10 bg-black/75"}`}
                            >
                              <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">{section.heading}</p>
                              <div className="notes-markdown phone-safe-copy mt-3 prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-strong:text-emerald-100 prose-li:text-slate-200">
                                <ReactMarkdown>{section.content}</ReactMarkdown>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="notes-markdown phone-safe-copy rounded-2xl bg-black/75 p-2 prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-strong:text-emerald-100 prose-li:text-slate-200">
                        <ReactMarkdown>{formattedGuide || "Your study guide will appear here after generation."}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                ) : null}
                {activeTab === "transcript" ? <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{deferredTranscript || "The lecture transcript will appear here after transcription."}</div> : null}
                {activeTab === "examples" ? <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{formattedExample || "Worked examples will appear here after study guide generation."}</div> : null}
                {activeTab === "formulas" ? (formulaRows.length ? <div className="overflow-x-auto rounded-2xl border border-white/10"><div className="min-w-[520px]"><div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] bg-emerald-300/10 text-sm font-semibold text-emerald-50"><div className="border-r border-white/10 px-4 py-3">Expression</div><div className="px-4 py-3">Readable Result</div></div>{formulaRows.map((row, index) => <div key={`${row.expression}-${index}`} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] border-t border-white/10 text-sm"><div className="border-r border-white/10 px-4 py-3 font-semibold text-white">{row.expression}</div><div className="px-4 py-3 font-mono text-slate-200">{row.result}</div></div>)}</div></div> : <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{formattedFormula || "Detected formulas will appear here after study guide generation."}</div>) : null}
                {activeTab === "flashcards" ? <div className="grid gap-4 md:grid-cols-2">{flashcards.length ? flashcards.map((card, index) => <div key={`${card.question}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Flashcard {index + 1}</p><p className="phone-safe-copy mt-3 font-semibold text-white">{card.question}</p><p className="phone-safe-copy mt-4 text-sm leading-7 text-slate-300">{card.answer}</p></div>) : <div className="text-sm text-slate-300">Flashcards will appear here after study guide generation.</div>}</div> : null}
                {activeTab === "quiz" ? (selectedQuizQuestions.length ? renderQuizSection({
                  questions: selectedQuizQuestions,
                  answers: quizAnswers,
                  results: quizResults,
                  quizImages: quizAnswerImages,
                  submitted: quizSubmitted,
                  isMarking: isMarkingQuiz,
                  onMark: markQuiz,
                  onAnswerChange: handleQuizAnswerChange,
                  onOptionChange: handleQuizOptionChange,
                  onImageChange: handleQuizImageChange,
                  sharedAnswerGroups: roomAnswerGroups,
                  visibilityMode: activeRoom ? activeRoom.test_visibility : "",
                  scoreValue: score,
                  scopeId: "workspace",
                }) : renderQuizGenerationPanel()) : null}
                {activeTab === "presentation" ? renderPresentationPanel() : null}
                {activeTab === "podcast" ? renderPodcastPanel() : null}
                {activeTab === "chat" ? <div className="flex h-full min-h-[360px] flex-col gap-4"><div className="flex-1 space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-4">{chatMessages.length ? chatMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === "assistant" ? "border border-emerald-300/15 bg-emerald-300/10 text-slate-100" : "ml-auto border border-white/10 bg-white/10 text-white"}`}><p className="mb-2 text-xs uppercase tracking-[0.24em] text-emerald-100/70">{message.role === "assistant" ? "MABASO" : "You"}</p><div className="whitespace-pre-wrap break-words">{message.content}</div></div>) : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm leading-7 text-slate-300">Ask for a simpler explanation, exam tips, a formula walkthrough, or help from a reference image.</div>}</div><div className="rounded-[26px] border border-white/10 bg-slate-950/80 p-4"><div className="force-mobile-stack flex items-end gap-3"><label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200"><span className="text-xl">+</span><input ref={chatImageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { handleChatReferenceFilesChange(event.target.files); event.target.value = ""; }} /></label><textarea value={chatQuestion} onChange={(event) => setChatQuestion(event.target.value)} onKeyDown={handleStudyChatKeyDown} rows={1} className="min-h-[56px] flex-1 resize-none bg-transparent px-1 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500" placeholder="Type your message..." /><button type="button" onClick={askStudyAssistant} disabled={isAskingChat} className="flex h-12 w-12 items-center justify-center self-end rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] text-white disabled:opacity-50 sm:self-auto" aria-label="Send message"><svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" /></svg></button></div><div className="mt-3 flex flex-wrap items-center gap-2">{chatReferenceImages.length ? chatReferenceImages.map((item) => <span key={item.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{item.name}<button type="button" onClick={() => removeChatReferenceImage(item.id)} className="text-slate-400 transition hover:text-white">x</button></span>) : <span className="text-xs text-slate-400">Add screenshots, notes, or handwritten references if they help the question.</span>}{chatReferenceImages.length ? <button type="button" onClick={() => setChatReferenceImages([])} disabled={!chatReferenceImages.length || isAskingChat} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white disabled:opacity-50">Clear images</button> : null}</div></div></div> : null}
                {activeTab === "collaboration" ? <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]"><div className="space-y-5"><div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Create room</p><h3 className="mt-2 text-2xl font-semibold text-white">Invite your study group</h3><p className="mt-3 text-sm leading-7 text-slate-300">Create an email-based collaboration room from this lecture. Invited students will see the same room when they sign in with those emails.</p><div className="mt-5 space-y-4"><div><label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Room title</label><input value={roomTitleInput} onChange={(event) => setRoomTitleInput(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none" placeholder={`${extractHistoryTitle(summary, workspaceFileLabel)} group room`} /></div><div><label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Invite by email</label><textarea value={roomInviteInput} onChange={(event) => setRoomInviteInput(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none" placeholder="student1@email.com, student2@email.com" /></div><div><label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Group test visibility</label><div className="mt-2 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setNewRoomVisibility("private")} className={`rounded-2xl border px-4 py-3 text-left text-sm ${newRoomVisibility === "private" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-slate-950/75 text-slate-200"}`}><p className="font-semibold">Private answers</p><p className="mt-2 text-xs leading-6 text-slate-300">Members cannot see what others are writing.</p></button><button type="button" onClick={() => setNewRoomVisibility("shared")} className={`rounded-2xl border px-4 py-3 text-left text-sm ${newRoomVisibility === "shared" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-slate-950/75 text-slate-200"}`}><p className="font-semibold">Shared answers</p><p className="mt-2 text-xs leading-6 text-slate-300">Members can compare typed answers inside the room.</p></button></div></div><button type="button" onClick={createCollaborationRoom} disabled={isCreatingRoom || (!summary && !transcript && !lectureNotes && !lectureSlides)} className="w-full rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isCreatingRoom ? "Creating room..." : "Create collaboration room"}</button></div></div><div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"><div className="force-mobile-stack flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Available rooms</p><h3 className="mt-2 text-xl font-semibold text-white">Your collaboration list</h3></div><button type="button" onClick={() => refreshCollaborationRooms()} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">Refresh</button></div><div className="mt-4 space-y-3">{collaborationRooms.length ? collaborationRooms.map((room) => <button key={room.id} type="button" onClick={async () => { setCurrentPage("workspace"); setActiveTab("collaboration"); await loadCollaborationRoom(room.id, { resetNotesDraft: true }); }} className={`w-full rounded-2xl border p-4 text-left transition ${activeRoomId === room.id ? "border-emerald-300/35 bg-emerald-300/10" : "border-white/10 bg-slate-950/75 hover:bg-white/10"}`}><p className="text-sm font-semibold text-white">{room.title}</p><p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{room.member_count} member{room.member_count === 1 ? "" : "s"} • {room.test_visibility}</p><p className="mt-2 text-xs text-slate-400">Updated {new Date(room.updated_at).toLocaleString()}</p></button>) : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm leading-7 text-slate-300">No collaboration rooms yet. Create the first one from the current lecture.</div>}</div></div></div><div className="space-y-5">{activeRoom ? <><div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Active room</p><h3 className="mt-2 text-3xl font-semibold text-white">{activeRoom.title}</h3><p className="mt-3 text-sm leading-7 text-slate-300">Shared tool: {roomToolLabel}. Room owner: {activeRoom.owner_email}.</p></div><div className="force-mobile-stack flex flex-wrap gap-3"><button type="button" onClick={syncCurrentTabToRoom} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50">Share current tool</button><button type="button" onClick={() => setFollowRoomView((current) => !current)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">{followRoomView ? "Following room view" : "Follow room view"}</button></div></div><div className="mt-5 flex flex-wrap gap-2">{(activeRoom.members || []).map((member) => <span key={member.email} className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs text-slate-200">{member.email} {member.role === "owner" ? "(owner)" : ""}</span>)}</div><div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/70 p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Shared revision pack</p><h4 className="mt-2 text-2xl font-semibold text-white">Guide, formulas, worked examples, flashcards, and test</h4><p className="mt-3 text-sm leading-7 text-slate-300">Choose a resource below to make it the room’s shared revision focus.</p></div><div className="flex flex-wrap gap-2">{[{ id: "guide", label: "Study Guide" }, { id: "formulas", label: "Formulas" }, { id: "examples", label: "Worked Examples" }, { id: "flashcards", label: "Flashcards" }, { id: "quiz", label: "Test" }].map((tab) => <button key={tab.id} type="button" onClick={async () => { setFollowRoomView(true); await shareTabToRoom(tab.id); }} className={`rounded-full px-4 py-2 text-sm ${activeRoom.active_tab === tab.id ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>{tab.label}</button>)}</div></div><div className="mt-4 whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm leading-7 text-slate-200">{buildCollaborationPreview(activeRoom) || "No shared content selected yet."}</div></div>{activeRoom.is_owner ? <div className="force-mobile-stack mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => changeRoomTestVisibility("private")} className={`rounded-full px-4 py-2 text-sm ${activeRoom.test_visibility === "private" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>Keep answers private</button><button type="button" onClick={() => changeRoomTestVisibility("shared")} className={`rounded-full px-4 py-2 text-sm ${activeRoom.test_visibility === "shared" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>Share answers in room</button></div> : null}</div><div className="grid gap-5 xl:grid-cols-2"><div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5"><div className="force-mobile-stack flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Shared notes</p><h4 className="mt-2 text-2xl font-semibold text-white">Everyone sees the same notes board</h4></div><button type="button" onClick={saveRoomNotes} disabled={isSavingRoomNotes} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50 disabled:opacity-50">{isSavingRoomNotes ? "Saving..." : "Save shared notes"}</button></div><textarea value={roomSharedNotesDraft} onChange={(event) => setRoomSharedNotesDraft(event.target.value)} rows={12} className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100 outline-none" placeholder="Write group notes, exam reminders, common mistakes, or a plan for the test..." /></div><div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Room chat</p><h4 className="mt-2 text-2xl font-semibold text-white">Live discussion</h4></div>{isRoomLoading ? <span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">Syncing</span> : null}</div><div className="mt-4 rounded-2xl border border-white/10 bg-slate-950 p-4">{(activeRoom.messages || []).length ? <div className="space-y-3">{activeRoom.messages.map((message) => <div key={message.id} className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">{message.author_email}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{message.content}</p></div>)}</div> : <p className="text-sm leading-7 text-slate-300">Room messages will appear here. Use this to coordinate who is revising which section.</p>}</div><div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/80 p-4"><div className="force-mobile-stack flex items-end gap-3"><textarea value={roomMessageDraft} onChange={(event) => setRoomMessageDraft(event.target.value)} onKeyDown={handleRoomChatKeyDown} rows={1} className="min-h-[56px] flex-1 resize-none bg-transparent px-1 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500" placeholder="Type your message..." /><button type="button" onClick={sendRoomMessage} disabled={isSendingRoomMessage} className="flex h-12 w-12 items-center justify-center self-end rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] text-white disabled:opacity-50 sm:self-auto" aria-label="Send room message"><svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" /></svg></button></div><p className="mt-3 text-xs text-slate-400">This room chat refreshes automatically.</p></div></div></div></> : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm leading-7 text-slate-300">Open a room from the list or create a new one to start shared notes, room chat, and group test settings.</div>}</div></div> : null}
              </div>
            </div>

            {workspaceSnapshotPanel}
          </div>
        </section> : null}

        {currentPage === "about" ? renderHelpAboutPage() : null}
        {currentPage === "support" ? renderSupportPage() : null}
        {currentPage === "collaboration" ? renderCollaborationPage() : null}

        <input
          ref={pastQuestionPaperFileInputRef}
          type="file"
          accept={PAST_PAPER_ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => {
            handlePastQuestionPapersFilesChange(event.target.files);
            event.target.value = "";
          }}
        />

        {historyPanel}
        {collaborationHistoryPanel}
      </main>
    </div>
  );
}
