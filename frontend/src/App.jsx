import { useEffect, useRef, useState } from "react";
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
const SESSION_DURATION_LABEL = "1 hour 30 minutes";
const HISTORY_STORAGE_KEY = "mabaso-history-v1";
const AUTH_TOKEN_KEY = "mabaso-auth-token";
const AUTH_EMAIL_KEY = "mabaso-auth-email";
const REMEMBERED_EMAIL_KEY = "mabaso-remembered-email";
const BRAND_ART_URL = "/mabaso-social.svg";
const MAX_HISTORY_ITEMS = 24;
const MAX_CHAT_REFERENCE_IMAGES = 4;
const MAX_QUIZ_ANSWER_IMAGES = 6;
const MIN_PASSWORD_LENGTH = 8;
const LECTURE_MEDIA_ACCEPT = "audio/*,video/*";
const NOTE_SOURCE_ACCEPT = "image/*,.txt,.md,.text,.pdf,.docx";
const SLIDE_SOURCE_ACCEPT = "image/*,.txt,.md,.text,.pdf,.pptx,.docx";
const PAST_PAPER_ACCEPT = "image/*,.txt,.md,.text,.pdf,.pptx,.docx";
const BULK_LECTURE_ACCEPT = "audio/*,video/*,image/*,.txt,.md,.text,.pdf,.pptx,.docx";
const tabs = [
  { id: "guide", label: "Study Guide" },
  { id: "transcript", label: "Transcript" },
  { id: "formulas", label: "Formulas" },
  { id: "examples", label: "Worked Examples" },
  { id: "flashcards", label: "Flashcards" },
  { id: "quiz", label: "Test" },
  { id: "podcast", label: "Podcast Generator" },
  { id: "chat", label: "Study Chat" },
  { id: "collaboration", label: "Collaboration" },
];
const workspaceTabs = tabs.filter((tab) => tab.id !== "collaboration");
const progressSteps = ["1. Sign in", "2. Capture lecture", "3. Study workspace", "4. Collaboration"];
const helpAboutSections = [
  {
    kicker: "How It Works",
    title: "What MABASO is doing in the background",
    description:
      "MABASO turns one lecture workspace into several study tools. It reads the sources you upload, combines them, and then builds a guide, formulas, worked examples, flashcards, a test, and optional study photos from the same lecture context.",
    points: [
      "The capture page is where you add lecture material. This can be a recorded lecture, a video file, live recording, typed notes, slide files, or past papers.",
      "When you press Transcribe Lecture, MABASO reads the audio or video first, creates a transcript, and then uses that transcript as the foundation for the rest of the pack.",
      "When you press Generate Study Guide, MABASO can still work even if you only uploaded notes, slides, or past papers. A transcript helps, but it is not the only valid source.",
      "The study workspace is the revision area. It lets the student move between the guide, transcript, formulas, worked examples, flashcards, the test, podcast, and study chat without uploading again.",
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

function getHistoryStorageKey(email = "") {
  const normalizedEmail = (email || "").trim().toLowerCase();
  return normalizedEmail ? `${HISTORY_STORAGE_KEY}:${normalizedEmail}` : HISTORY_STORAGE_KEY;
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
  if (cleanedNames.length === 1) return cleanedNames[0];
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

function createStudySourceEntry(name, text, prefix) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (name || prefix || "Study source").trim() || "Study source",
    text: normalizeStudySourceText(text),
    prefix: prefix || "STUDY SOURCE",
  };
}

function normalizeStudySourceText(text) {
  return (text || "")
    .replace(/\u0000/g, " ")
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

function studyImagesToText(images) {
  return (images || [])
    .map((image, index) => `${index + 1}. ${image.title || image.query || "Reference photo"}\nSource: ${image.source_url || image.image_url || ""}`)
    .join("\n\n");
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

function getErrorHint(message) {
  const text = (message || "").toLowerCase();
  if (text.includes("openai_api_key")) return "Add your OpenAI API key to the backend environment.";
  if (text.includes("ffmpeg")) return "Install ffmpeg on the backend server for larger files.";
  if (text.includes("blocked direct server-side download")) return "Try a video with public captions, or upload the lecture file directly.";
  if (text.includes("yt-dlp") || text.includes("video-link transcription") || text.includes("downloadable audio format")) {
    return "Try another public video link, or upload the lecture file directly. YouTube links may also need public captions or working backend cookies.";
  }
  if (text.includes("smtp")) return "Configure SMTP variables so verification codes can be sent.";
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

function getReadableRequestError(error) {
  if (isAbortError(error)) {
    return "The Mabaso server took too long to respond. Try again in a few seconds.";
  }

  const message = String(error?.message || "").trim();
  if (/failed to fetch/i.test(message)) {
    return (
      "The app could not reach the Mabaso server. Refresh the page and try again. "
      + `If it keeps happening, check that Render web env VITE_API_BASE_URL is set to ${API_BASE_URL}.`
    );
  }

  return message || "The app could not reach the Mabaso server right now.";
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

function getPodcastEstimatedMinutes(podcast) {
  const total = (podcast?.segments || []).reduce((sum, segment) => sum + Number(segment?.estimated_minutes || 0), 0);
  if (total > 0) return total.toFixed(total >= 10 ? 0 : 1);
  if (podcast?.targetMinutes) return String(podcast.targetMinutes);
  return "0";
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
  const [authEmailInput, setAuthEmailInput] = useState(
    () => window.localStorage.getItem(REMEMBERED_EMAIL_KEY) || window.localStorage.getItem(AUTH_EMAIL_KEY) || "",
  );
  const [authPasswordInput, setAuthPasswordInput] = useState("");
  const [authCodeInput, setAuthCodeInput] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [pendingEmailAuthMode, setPendingEmailAuthMode] = useState("");
  const [pendingEmailAuthEmail, setPendingEmailAuthEmail] = useState("");
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
  const [podcastData, setPodcastData] = useState(createEmptyPodcastData);
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
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [isLoadingPodcastAudio, setIsLoadingPodcastAudio] = useState(false);
  const [isExtractingNotes, setIsExtractingNotes] = useState(false);
  const [isExtractingSlides, setIsExtractingSlides] = useState(false);
  const [isExtractingPastPapers, setIsExtractingPastPapers] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizAnswerImages, setQuizAnswerImages] = useState({});
  const [quizResults, setQuizResults] = useState({});
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
  const fileInputRef = useRef(null);
  const lectureNotesFileInputRef = useRef(null);
  const lectureSlidesFileInputRef = useRef(null);
  const pastQuestionPaperFileInputRef = useRef(null);
  const bulkLectureFileInputRef = useRef(null);
  const chatImageInputRef = useRef(null);
  const podcastAudioRef = useRef(null);
  const podcastAudioSegmentsRef = useRef([]);
  const podcastAudioUrlRef = useRef("");
  const videoUrlInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const googleButtonRef = useRef(null);
  const answerSyncTimersRef = useRef({});
  const historyHydratingRef = useRef(false);
  const skipNextHistorySyncRef = useRef(false);
  const [podcastAudioSegments, setPodcastAudioSegments] = useState([]);
  const [podcastAudioUrl, setPodcastAudioUrl] = useState("");
  const [activePodcastSegmentIndex, setActivePodcastSegmentIndex] = useState(0);
  const [isPodcastAutoPlaying, setIsPodcastAutoPlaying] = useState(false);

  const lectureNotes = studySourceEntriesToText(lectureNoteSources, "LECTURE NOTE");
  const lectureNoteFileNames = lectureNoteSources.map((item) => item.name);
  const lectureNotesFileName = formatGroupedSourceLabel(lectureNoteFileNames, "note file", "note files");
  const lectureSlides = studySourceEntriesToText(lectureSlideSources, "SLIDE SOURCE");
  const lectureSlideFileNames = lectureSlideSources.map((item) => item.name);
  const pastQuestionPapers = [studySourceEntriesToText(pastQuestionPaperSources, "PAST QUESTION PAPER"), pastQuestionMemo.trim() ? `PAST QUESTION PAPER MEMO\n${pastQuestionMemo.trim()}` : ""].filter(Boolean).join("\n\n");
  const pastQuestionPaperFileNames = pastQuestionPaperSources.map((item) => item.name);
  const loading = isTranscribing || isTranscribingVideo || isGeneratingSummary || isGeneratingPodcast || isLoadingPodcastAudio || isExtractingNotes || isExtractingSlides || isExtractingPastPapers;
  const hasStudyInputs = Boolean(transcript.trim() || lectureNotes.trim() || lectureSlides.trim() || pastQuestionPapers.trim());
  const hasResults = Boolean(transcript || summary || formula || example || flashcards.length || quizQuestions.length || podcastData.script);
  const selectedQuizQuestions = quizQuestions;
  const formattedGuide = normalizeRenderedMathText(prettifyMathText(summary));
  const formattedFormula = normalizeRenderedMathText(prettifyMathText(formula));
  const formattedExample = normalizeRenderedMathText(prettifyMathText(example));
  const activeRoomFormattedGuide = normalizeRenderedMathText(prettifyMathText(activeRoom?.summary || ""));
  const activeRoomFormattedFormula = normalizeRenderedMathText(prettifyMathText(activeRoom?.formula || ""));
  const activeRoomFormattedExample = normalizeRenderedMathText(prettifyMathText(activeRoom?.example || ""));
  const formulaRows = parseFormulaRows(formattedFormula);
  const activeRoomFormulaRows = parseFormulaRows(activeRoomFormattedFormula);
  const currentTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || "Study Guide";
  const isAppleConfigured = Boolean(APPLE_CLIENT_ID);
  const appleSignInAvailable = isAppleConfigured && isAppleWebSigninSupported();
  const loginMethodLabel = isAppleConfigured ? "Google, Apple, or email" : "Google or email";
  const emailAuthCodeRequested = Boolean(pendingEmailAuthEmail);
  const activeStepIndex = ["capture", "about", "support"].includes(currentPage) ? 1 : currentPage === "workspace" ? 2 : currentPage === "collaboration" ? 3 : -1;
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
  const canExportCurrent = hasResults || activeTab === "chat";
  const canShareCurrentTool = Boolean(activeRoom && activeTab !== "podcast");
  const errorHint = getErrorHint(error);
  const showHistoryPanel = currentPage === "capture" || currentPage === "workspace";
  const activePodcastSegment = podcastAudioSegments[activePodcastSegmentIndex] || podcastData.segments[activePodcastSegmentIndex] || podcastData.segments[0] || null;
  const podcastEstimatedMinutes = getPodcastEstimatedMinutes(podcastData);

  const clearHistory = () => {
    setHistoryItems([]);
    setActiveHistoryId("");
    setStatus("History cleared for this email.");
  };

  const removeHistoryItem = (itemId) => {
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
          detail: "Recording is running. Stop it when the lecture is finished so the file can be transcribed.",
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
        detail: `${flashcards.length} flashcards and ${quizQuestions.length} test questions are ready in the study workspace.`,
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
    emptyMessage = "Test questions will appear here after study guide generation.",
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
                <p className="mt-2 text-sm leading-7 text-slate-200">Add past papers and a memo if you want the next guide and test to follow that style.</p>
              </div>
              {pastQuestionPaperSources.length || pastQuestionMemo.trim() ? (
                <button type="button" onClick={() => generateStudyGuide()} disabled={loading || !hasStudyInputs} className="rounded-full border border-amber-300/20 bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-50 disabled:opacity-50">{isGeneratingSummary ? "Refreshing..." : "Refresh Notes + Test"}</button>
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
              <textarea value={pastQuestionMemo} onChange={(event) => setPastQuestionMemo(event.target.value)} rows={7} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-7 text-slate-100 outline-none" placeholder="Paste the memo, marking guide, or model answers here. MABASO will use it as a reference when refreshing the study guide and the test." />
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
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">3. Use flashcards, test, podcast, and chat for active revision.</div>
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
          {supportFeedback ? <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${supportFeedback.startsWith("Support message sent") ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50" : "border-rose-300/20 bg-rose-500/10 text-rose-100"}`}>{supportFeedback}</div> : null}
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

  const clearSession = (message = "Please sign in again.") => {
    setAuthToken("");
    setAuthEmail("");
    setAuthPasswordInput("");
    setAuthCodeInput("");
    setPendingEmailAuthMode("");
    setPendingEmailAuthEmail("");
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
    replacePodcastAudioUrl("");
    replacePodcastAudioSegments([]);
    setActivePodcastSegmentIndex(0);
    setIsPodcastAutoPlaying(false);
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_EMAIL_KEY);
    setAuthMessage(message);
  };

  useEffect(() => {
    let cancelled = false;
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
    if (!token) {
      setAuthChecked(true);
      return undefined;
    }
    fetchWithTimeout(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }, 8000).then(async (response) => {
      const data = await parseJsonSafe(response);
      if (cancelled) return;
      if (response.status === 401) {
        clearSession("Sign in to continue.");
        setAuthChecked(true);
        return;
      }
      if (!response.ok) {
        setAuthChecked(true);
        setAuthMessage(data.detail || "Opening your saved session while the server reconnects.");
        return;
      }
      const nextToken = data.token || token;
      setAuthToken(nextToken);
      setAuthEmail(data.email || window.localStorage.getItem(AUTH_EMAIL_KEY) || "");
      setAuthEmailInput(data.email || window.localStorage.getItem(REMEMBERED_EMAIL_KEY) || "");
      setAuthChecked(true);
    }).catch((error) => {
      if (cancelled) return;
      setAuthMessage(
        isAbortError(error)
          ? "Opening your saved session while the server wakes up."
          : "Using the saved session while the server finishes reconnecting.",
      );
      setAuthChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const historyKey = getHistoryStorageKey(authEmail);
      window.localStorage.setItem(historyKey, JSON.stringify(normalizeHistoryItems(historyItems)));
    } catch {
      // Ignore storage errors.
    }
  }, [authEmail, historyItems]);

  useEffect(() => {
    if (!authToken) return;
    window.localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    window.localStorage.setItem(AUTH_EMAIL_KEY, authEmail);
  }, [authEmail, authToken]);

  useEffect(() => {
    if (!authEmailInput.trim()) return;
    window.localStorage.setItem(REMEMBERED_EMAIL_KEY, authEmailInput.trim());
  }, [authEmailInput]);

  useEffect(() => {
    if (!authChecked || !authEmail) return;
    const cachedHistory = loadHistoryItems(authEmail);
    skipNextHistorySyncRef.current = true;
    setHistoryItems(cachedHistory);
    setActiveHistoryId((current) => (cachedHistory.some((item) => item.id === current) ? current : ""));
  }, [authChecked, authEmail]);

  useEffect(() => {
    if (!authToken) return undefined;
    const interval = window.setInterval(() => {
      fetchWithTimeout(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } }, 8000).then(async (response) => {
        if (!response.ok) return;
        const data = await parseJsonSafe(response);
        if (data.token) {
          setAuthToken(data.token);
        }
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

  useEffect(() => {
    setIsDownloadMenuOpen(false);
  }, [activeTab, currentPage]);

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
      setAuthToken(data.token || "");
      setAuthEmail(data.email || "");
      setAuthEmailInput(data.email || "");
      setCurrentPage("capture");
      setStatus("Signed in successfully.");
      setAuthMessage("You are signed in.");
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
      setAuthToken(data.token || "");
      setAuthEmail(data.email || "");
      setAuthEmailInput(data.email || "");
      setCurrentPage("capture");
      setStatus("Signed in successfully.");
      setAuthMessage("You are signed in.");
    } catch (err) {
      setAuthMessage(err.message || "Apple sign-in failed.");
    }
  };

  const validateEmailPasswordInputs = () => {
    const email = authEmailInput.trim().toLowerCase();
    if (!email) throw new Error("Enter your email address.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (authPasswordInput.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    return email;
  };

  const requestEmailPasswordCode = async () => {
    setAuthMessage("");
    let email = "";
    try {
      email = validateEmailPasswordInputs();
    } catch (err) {
      setAuthMessage(err.message || "Enter your email and password.");
      return;
    }

    setIsRequestingEmailCode(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/email-password/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: authPasswordInput,
          mode: authMode,
        }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not send a verification code.");
      setAuthEmailInput(email);
      setPendingEmailAuthEmail(email);
      setPendingEmailAuthMode(authMode);
      setAuthCodeInput("");
      setAuthMessage("Verification code sent. Check your email, then enter the code below.");
    } catch (err) {
      setAuthMessage(err.message || "Could not send a verification code.");
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
    if (authPasswordInput.length < MIN_PASSWORD_LENGTH) {
      setAuthMessage(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setIsVerifyingEmailCode(true);
    setAuthMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/email-password/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: authPasswordInput,
          code: authCodeInput.trim(),
          mode: pendingEmailAuthMode || authMode,
        }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Verification failed.");
      setAuthToken(data.token || "");
      setAuthEmail(data.email || email);
      setAuthEmailInput(data.email || email);
      setAuthPasswordInput("");
      setAuthCodeInput("");
      setPendingEmailAuthEmail("");
      setPendingEmailAuthMode("");
      setCurrentPage("capture");
      setStatus((pendingEmailAuthMode || authMode) === "register" ? "Account created successfully." : "Signed in successfully.");
      setAuthMessage("You are signed in.");
    } catch (err) {
      setAuthMessage(err.message || "Verification failed.");
    } finally {
      setIsVerifyingEmailCode(false);
    }
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
    if (!authToken) throw new Error("Please sign in to continue.");
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${authToken}`);
    let response;
    try {
      response = await fetchWithTimeout(`${API_BASE_URL}${path}`, { ...options, headers }, 30000);
    } catch (err) {
      throw new Error(getReadableRequestError(err));
    }
    if (response.status === 401) {
      clearSession("Your session expired. Please sign in again.");
      throw new Error("Your session expired. Please sign in again.");
    }
    return response;
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
    if (activeTab === "podcast") return podcastData.script || "No podcast debate generated yet.";
    if (activeTab === "chat") return chatToText(chatMessages) || "No study chat yet.";
    return collaborationRoomToText(activeRoom);
  };

  const buildCurrentStudyPackSections = () => [
    { title: "Study Guide", content: formattedGuide || summary },
    { title: "Study Photos", content: studyImagesToText(studyImages) },
    { title: "Transcript", content: transcript },
    { title: "Past Question Paper References", content: pastQuestionPapers },
    { title: "Formulas", content: formattedFormula || formula },
    { title: "Worked Examples", content: formattedExample || example },
    { title: "Flashcards", content: flashcardsToText(flashcards) },
    { title: "Test", content: quizToText(quizQuestions) },
    { title: "Podcast Debate Script", content: podcastData.script || "" },
    { title: "Study Chat", content: chatToText(chatMessages) },
  ].filter((section) => (section.content || "").trim());

  const addHistoryItem = (item) => {
    const timestamp = new Date().toISOString();
    const nextItem = {
      ...item,
      id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: item.createdAt || timestamp,
      updatedAt: timestamp,
    };
    setHistoryItems((current) => mergeHistoryItems([nextItem], current));
    setActiveHistoryId(nextItem.id);
  };

  const loadHistoryItem = (item) => {
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
    setPodcastData(normalizePodcastData(item.podcastData));
    setPodcastSpeakerCount(Number(item.podcastData?.speakerCount || item.podcastData?.speaker_count || 2) >= 3 ? 3 : 2);
    setPodcastTargetMinutes(Number(item.podcastData?.targetMinutes || item.podcastData?.target_minutes || 10) || 10);
    replacePodcastAudioUrl("");
    replacePodcastAudioSegments([]);
    setActivePodcastSegmentIndex(0);
    setIsPodcastAutoPlaying(false);
    setQuizAnswers({});
    setQuizAnswerImages({});
    setQuizResults({});
    setQuizSubmitted(false);
    setChatMessages([]);
    setChatReferenceImages([]);
    setActiveHistoryId(item.id);
    setActiveTab("guide");
    setCurrentPage("workspace");
    setStatus(`Loaded ${item.title} from history.`);
  };

  const resetGeneratedOutputs = () => {
    setTranscript("");
    setSummary("");
    setFormula("");
    setExample("");
    setFlashcards([]);
    setQuizQuestions([]);
    setStudyImages([]);
    setPodcastData(createEmptyPodcastData());
    setPodcastSpeakerCount(2);
    setPodcastTargetMinutes(10);
    replacePodcastAudioUrl("");
    replacePodcastAudioSegments([]);
    setActivePodcastSegmentIndex(0);
    setIsPodcastAutoPlaying(false);
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
      const response = await authFetch("/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          page: currentPage,
        }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Your support message could not be sent.");
      setSupportMessageDraft("");
      setSupportFeedback("Support message sent.");
    } catch (err) {
      setSupportFeedback(err.message || "Your support message could not be sent.");
    } finally {
      setIsSendingSupport(false);
    }
  };

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setVideoUrl("");
    setError("");
    setStatus(`${selectedFile.name} selected.`);
  };

  const handleLectureNotesFileChange = async (selectedFiles) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return;
    setIsExtractingNotes(true);
    setCurrentJobType("notes");
    setError("");
    setStatus("Reading lecture notes...");
    setProgress(10);
    try {
      const { extractedEntries, addedNames, skippedNames } = await extractStudySourceFiles(files, {
        sourceName: "lecture note",
        sourcePrefix: "LECTURE NOTE",
      });
      setLectureNoteSources((current) => mergeStudySourceEntries(current, extractedEntries));
      setStatus(
        `${addedNames.length} lecture note source${addedNames.length === 1 ? "" : "s"} added.${skippedNames.length ? ` Skipped ${skippedNames.length} unreadable file${skippedNames.length === 1 ? "" : "s"}.` : ""}`,
      );
      setProgress(100);
    } catch (err) {
      setError(err.message || "Lecture note reading failed.");
      setStatus("Lecture note reading failed.");
    } finally {
      setIsExtractingNotes(false);
      setCurrentJobType("");
      setProgress(0);
    }
  };

  const extractStudySourceFiles = async (selectedFiles, { sourceName, sourcePrefix }) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return { extractedEntries: [], addedNames: [], skippedNames: [] };

    const extractedEntries = [];
    const addedNames = [];
    const skippedNames = [];
    for (const [index, selectedFile] of files.entries()) {
      const isTextFile = selectedFile.type.startsWith("text/") || /\.(txt|md|text)$/i.test(selectedFile.name || "");
      setProgress(Math.min(90, 15 + Math.round(((index + 1) / files.length) * 70)));
      setStatus(`Reading ${sourceName} ${index + 1} of ${files.length}: ${selectedFile.name}`);
      if (isTextFile) {
        const text = normalizeStudySourceText(await selectedFile.text());
        if (isLikelyReadableStudySourceText(text)) {
          extractedEntries.push(createStudySourceEntry(selectedFile.name, text, sourcePrefix));
          addedNames.push(selectedFile.name);
        } else if (text) {
          skippedNames.push(selectedFile.name);
        }
        continue;
      }
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await authFetch("/extract-slide-text/", { method: "POST", body: formData });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || `Could not read ${selectedFile.name}.`);
      const cleanedText = normalizeStudySourceText(data.text || "");
      if (isLikelyReadableStudySourceText(cleanedText)) {
        extractedEntries.push(createStudySourceEntry(selectedFile.name, cleanedText, sourcePrefix));
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

  const handleLectureSlidesFilesChange = async (selectedFiles) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return;
    setIsExtractingSlides(true);
    setCurrentJobType("slides");
    setError("");
    setStatus("Reading slide sources...");
    setProgress(10);
    try {
      const { extractedEntries, addedNames, skippedNames } = await extractStudySourceFiles(files, {
        sourceName: "slide source",
        sourcePrefix: "SLIDE SOURCE",
      });
      setLectureSlideSources((current) => mergeStudySourceEntries(current, extractedEntries));
      setStatus(
        `${addedNames.length} slide source${addedNames.length === 1 ? "" : "s"} added.${skippedNames.length ? ` Skipped ${skippedNames.length} unreadable file${skippedNames.length === 1 ? "" : "s"}.` : ""}`,
      );
      setProgress(100);
    } catch (err) {
      setError(err.message || "Slide reading failed.");
      setStatus("Slide reading failed.");
    } finally {
      setIsExtractingSlides(false);
      setCurrentJobType("");
      setProgress(0);
    }
  };

  const handlePastQuestionPapersFilesChange = async (selectedFiles) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return;
    setIsExtractingPastPapers(true);
    setCurrentJobType("past_papers");
    setError("");
    setStatus("Reading past question papers...");
    setProgress(10);
    try {
      const { extractedEntries, addedNames, skippedNames } = await extractStudySourceFiles(files, {
        sourceName: "past question paper",
        sourcePrefix: "PAST QUESTION PAPER",
      });
      setPastQuestionPaperSources((current) => mergeStudySourceEntries(current, extractedEntries));
      setStatus(
        `${addedNames.length} past question paper${addedNames.length === 1 ? "" : "s"} added.${skippedNames.length ? ` Skipped ${skippedNames.length} unreadable file${skippedNames.length === 1 ? "" : "s"}.` : ""} Generate the study guide again to refresh notes and test questions with this reference.`,
      );
      setProgress(100);
    } catch (err) {
      setError(err.message || "Past question paper reading failed.");
      setStatus("Past question paper reading failed.");
    } finally {
      setIsExtractingPastPapers(false);
      setCurrentJobType("");
      setProgress(0);
    }
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

    setError("");
    setStatus(`Sorting ${files.length} lecture file${files.length === 1 ? "" : "s"} into the right sections...`);

    if (lectureMediaFiles.length) {
      handleFileChange(lectureMediaFiles[0]);
    }
    if (noteFiles.length) await handleLectureNotesFileChange(noteFiles);
    if (slideFiles.length) await handleLectureSlidesFilesChange(slideFiles);
    if (pastPaperFiles.length) await handlePastQuestionPapersFilesChange(pastPaperFiles);

    const summaryParts = [];
    if (lectureMediaFiles.length) summaryParts.push("1 lecture file ready");
    if (noteFiles.length) summaryParts.push(`${noteFiles.length} note source${noteFiles.length === 1 ? "" : "s"}`);
    if (slideFiles.length) summaryParts.push(`${slideFiles.length} slide source${slideFiles.length === 1 ? "" : "s"}`);
    if (pastPaperFiles.length) summaryParts.push(`${pastPaperFiles.length} past paper source${pastPaperFiles.length === 1 ? "" : "s"}`);

    if (summaryParts.length) {
      const extraMediaNote = lectureMediaFiles.length > 1 ? " The first lecture media file was kept as the active lecture file." : "";
      setStatus(`Lecture files sorted: ${summaryParts.join(", ")}.${extraMediaNote}`);
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        audioChunksRef.current = [];
        setFile(new File([blob], "mabaso-lecture.wav", { type: "audio/wav" }));
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current.start();
      setRecording(true);
      setStatus("Recording started.");
    } catch {
      setError("Microphone access failed. Please allow recording permissions.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setStatus("Recording saved.");
  };

  const pollJob = async (jobId, jobType) => {
    while (true) {
      const response = await authFetch(`/jobs/${jobId}`);
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not read job status.");
      setCurrentJobType(jobType);
      setStatus(data.stage || "Processing...");
      setProgress(Number(data.progress || 0));
      if (data.status === "failed") throw new Error(data.error || `${jobType} failed.`);
      if (data.status === "completed") return data;
      await wait(JOB_POLL_INTERVAL_MS);
    }
  };

  const generateStudyGuide = async (transcriptText = transcript) => {
    const resolvedTranscript = typeof transcriptText === "string" ? transcriptText : transcript;
    if (!(resolvedTranscript.trim() || lectureNotes.trim() || lectureSlides.trim() || pastQuestionPapers.trim())) {
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
      const response = await authFetch("/generate-study-guide/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: resolvedTranscript,
          lecture_notes: lectureNotes,
          lecture_slides: lectureSlides,
          past_question_papers: pastQuestionPapers,
        }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Study guide generation failed.");
      const job = await pollJob(data.job_id, "study_guide");
      setSummary(job.summary || "");
      setFormula(job.formula || "");
      setExample(job.worked_example || "");
      setFlashcards(job.flashcards || []);
      setQuizQuestions(job.quiz_questions || []);
      setStudyImages(job.study_images || []);
      setQuizAnswers({});
      setQuizAnswerImages({});
      setQuizResults({});
      setQuizSubmitted(false);
      setPodcastData(createEmptyPodcastData());
      setPodcastSpeakerCount(2);
      setPodcastTargetMinutes(10);
      replacePodcastAudioUrl("");
      replacePodcastAudioSegments([]);
      setActivePodcastSegmentIndex(0);
      setIsPodcastAutoPlaying(false);
      setUsedFallbackSummary(Boolean(job.used_fallback));
      setActiveTab("guide");
      setCurrentPage("workspace");
      setStatus(job.used_fallback ? "Fallback study guide ready." : "Study guide ready.");
      setProgress(100);
      const sourceLabel = getPrimarySourceLabel({
        fileName: file?.name || "",
        videoUrl,
        lectureNotesFileName,
        lectureSlideFileNames,
        pastQuestionPaperFileNames,
      });
      addHistoryItem({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        title: extractHistoryTitle(job.summary || "", sourceLabel),
        fileName: sourceLabel,
        summary: job.summary || "",
        transcript: job.transcript || resolvedTranscript,
        formula: job.formula || "",
        example: job.worked_example || "",
        flashcards: job.flashcards || [],
        quizQuestions: job.quiz_questions || [],
        studyImages: job.study_images || [],
        lectureNotes,
        lectureNotesFileName,
        lectureNoteSources,
        lectureNoteFileNames,
        lectureSlides,
        lectureSlideFileNames,
        lectureSlideSources,
        pastQuestionMemo,
        pastQuestionPapers,
        pastQuestionPaperFileNames,
        pastQuestionPaperSources,
        podcastData: sanitizePodcastForHistory(createEmptyPodcastData()),
      });
    } catch (err) {
      setError(err.message || "Study guide generation failed.");
      setStatus(resolvedTranscript.trim() ? "Transcript ready. Study guide generation failed." : "Study source ready. Study guide generation failed.");
    } finally {
      setIsGeneratingSummary(false);
      setCurrentJobType("");
    }
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
        }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Podcast generation failed.");
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
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
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
        lectureNoteSources,
        lectureNoteFileNames,
        lectureSlides,
        lectureSlideFileNames,
        lectureSlideSources,
        pastQuestionMemo,
        pastQuestionPapers,
        pastQuestionPaperFileNames,
        pastQuestionPaperSources,
        podcastData: sanitizePodcastForHistory(nextPodcastData),
      });
    } catch (err) {
      setError(err.message || "Podcast generation failed.");
      setStatus("Podcast generation failed.");
    } finally {
      setIsGeneratingPodcast(false);
      setCurrentJobType("");
    }
  };

  const upload = async () => {
    if (!file) return setError("Upload or record a lecture first.");
    setIsTranscribing(true);
    setError("");
    setStatus("Submitting lecture for transcription...");
    setProgress(0);
    resetGeneratedOutputs();
    setActiveTab("transcript");
    setCurrentJobType("transcription");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await authFetch("/upload-audio/", { method: "POST", body: formData });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Upload failed.");
      const job = await pollJob(data.job_id, "transcription");
      setTranscript(job.transcript || "");
      setStatus("Transcript ready. Generating study guide...");
      setProgress(100);
      await generateStudyGuide(job.transcript || "");
    } catch (err) {
      setError(err.message || "Transcription failed.");
      setStatus("Transcription failed.");
    } finally {
      setIsTranscribing(false);
      setCurrentJobType("");
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
      const job = await pollJob(data.job_id, "video");
      setTranscript(job.transcript || "");
      setStatus("Video transcript ready. Generating study guide...");
      setProgress(100);
      await generateStudyGuide(job.transcript || "");
    } catch (err) {
      setError(err.message || "Video-link transcription failed.");
      setStatus("Video-link transcription failed.");
    } finally {
      setIsTranscribingVideo(false);
      setCurrentJobType("");
    }
  };

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
          active_tab: activeTab === "podcast" ? "guide" : activeTab,
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
    if (tabId === "podcast") {
      setError("Podcast Generator is personal for now, so it cannot be synced into the collaboration room yet.");
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
        { title: "Study Photos", content: studyImagesToText(item.studyImages || []) },
        { title: "Transcript", content: item.transcript || "" },
        { title: "Past Question Paper References", content: item.pastQuestionPapers || "" },
        { title: "Formulas", content: item.formula || "" },
        { title: "Worked Examples", content: item.example || "" },
        { title: "Flashcards", content: flashcardsToText(item.flashcards || []) },
        { title: "Test", content: quizToText(item.quizQuestions || []) },
        { title: "Podcast Debate Script", content: item.podcastData?.script || "" },
      ]);
      setStatus(`${item.title} PDF downloaded.`);
    } catch (err) {
      setError(err.message || "Could not create the history PDF.");
    }
  };

  const downloadHistoryQuizPdf = async (item) => {
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
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">Upload or record a lecture, add notes or slides, and build transcripts, guides, flashcards, tests, podcasts, and collaboration rooms.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">AI lecture transcription</div>
                <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">Study guides and summaries</div>
                <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">Flashcards, tests, podcasts, past papers, and collaboration</div>
              </div>
            </section>
            <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_28px_80px_rgba(2,8,23,0.55)]">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Access</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Continue into Mabaso</h2>
              <div className="mt-8 space-y-5">
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
                <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("login");
                        setPendingEmailAuthMode("");
                        setPendingEmailAuthEmail("");
                        setAuthCodeInput("");
                        setAuthMessage("");
                      }}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${authMode === "login" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                    >
                      Email Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("register");
                        setPendingEmailAuthMode("");
                        setPendingEmailAuthEmail("");
                        setAuthCodeInput("");
                        setAuthMessage("");
                      }}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${authMode === "register" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                    >
                      Create Account
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Email</label>
                      <input
                        type="email"
                        value={authEmailInput}
                        onChange={(event) => setAuthEmailInput(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Password</label>
                      <input
                        type="password"
                        value={authPasswordInput}
                        onChange={(event) => setAuthPasswordInput(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
                        placeholder={authMode === "register" ? "Create a password" : "Enter your password"}
                        autoComplete={authMode === "register" ? "new-password" : "current-password"}
                      />
                      <p className="mt-2 text-xs leading-6 text-slate-400">Use at least {MIN_PASSWORD_LENGTH} characters.</p>
                    </div>
                    <button
                      type="button"
                      onClick={requestEmailPasswordCode}
                      disabled={isRequestingEmailCode || isVerifyingEmailCode}
                      className="w-full rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {isRequestingEmailCode ? "Sending Code..." : authMode === "register" ? "Create Account and Send Code" : "Send Sign-In Code"}
                    </button>
                  </div>
                  {emailAuthCodeRequested ? (
                    <div className="mt-5 rounded-2xl border border-emerald-300/18 bg-emerald-300/8 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Verification</p>
                      <p className="mt-2 text-sm leading-7 text-slate-200">Enter the verification code sent to {pendingEmailAuthEmail} to finish {pendingEmailAuthMode === "register" ? "creating your account" : "signing in"}.</p>
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
                          {isVerifyingEmailCode ? "Verifying..." : "Verify and Continue"}
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
                </div>
                {authMessage ? <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-slate-200">{authMessage}</div> : null}
              </div>
            </section>
          </div>
        </main>
      </div>
    );
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
            </div>
            <div className="force-mobile-stack flex flex-wrap items-center gap-3">
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
                  <div><h2 className="text-2xl font-semibold text-white">Build your lecture workspace</h2><p className="mt-2 text-sm leading-7 text-slate-300">Add one source at a time or use one combined lecture-file upload and let MABASO sort notes, slides, past papers, and lecture media in the background.</p></div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading} className="min-h-[72px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white disabled:opacity-50"><span className="block text-sm font-semibold">Select Video / Recording File</span><span className="mt-2 block text-[10px] uppercase tracking-[0.22em] text-slate-400">Audio and video</span></button>
                    <button type="button" onClick={() => bulkLectureFileInputRef.current?.click()} disabled={loading} className="min-h-[72px] rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-left text-emerald-50 disabled:opacity-50"><span className="block text-sm font-semibold">Add Lecture Files</span><span className="mt-2 block text-[10px] uppercase tracking-[0.22em] text-emerald-100/80">Mix media, notes, slides, past papers</span></button>
                    <button type="button" onClick={recording ? stopRecording : startRecording} disabled={loading} className={`min-h-[72px] rounded-2xl px-4 py-3 text-left text-sm font-semibold ${recording ? "bg-rose-500 text-white" : "border border-emerald-300/20 bg-emerald-300/10 text-emerald-50"} disabled:opacity-50`}><span className="block">{recording ? "Stop Recording" : "Record Live Lecture"}</span><span className={`mt-2 block text-[10px] uppercase tracking-[0.22em] ${recording ? "text-rose-50/80" : "text-emerald-100/80"}`}>Direct microphone capture</span></button>
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
                    <p className="mt-3 text-xs leading-6 text-slate-300">Use this when the lecture already exists online and you want the study guide, test, formulas, and worked examples from that video. Non-YouTube public links are also supported when the backend can read them.</p>
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
                    <button type="button" onClick={() => generateStudyGuide()} disabled={loading || !hasStudyInputs} className="min-h-[124px] rounded-[22px] bg-[linear-gradient(135deg,#f59e0b,#f97316)] px-5 py-4 text-left text-white disabled:opacity-50">
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

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Selected File", value: workspaceFileLabel }, { label: "Size", value: file ? formatBytes(file.size) : videoUrl.trim() ? "Video link" : lectureNotes.trim() || lectureSlideFileNames.length || pastQuestionPaperFileNames.length ? "Study source" : activeHistoryItem ? "Saved workspace" : "Waiting" }, { label: "Status", value: isMarkingQuiz ? "Marking test" : isAskingChat ? "Answering" : loading ? currentJobType === "study_guide" ? "Generating notes" : currentJobType === "podcast" ? "Generating podcast" : currentJobType === "notes" ? "Reading notes" : currentJobType === "slides" ? "Reading slides" : currentJobType === "past_papers" ? "Reading past papers" : currentJobType === "video" ? "Reading video link" : "Transcribing" : hasResults ? "Ready" : "Waiting" }, { label: "Signed In", value: authEmail || "Not signed in" }].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-4"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{item.label}</p><p className="mt-3 break-words text-sm font-semibold text-white">{item.value}</p></div>)}</div>

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

          <div className="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
            <aside className="min-w-0 space-y-4 xl:sticky xl:top-6">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workspace Snapshot</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Lecture file: {workspaceFileLabel}</div>
                  <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Lecture notes: {lectureNoteFileNames.length ? lectureNotesFileName || "Added" : "Not added"}</div>
                  <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Slide sources: {lectureSlideFileNames.length || 0}</div>
                  <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Past papers: {pastQuestionPaperFileNames.length || 0}</div>
                  <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Memo reference: {pastQuestionMemo.trim() ? "Added" : "Not added"}</div>
                  <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Test questions: {quizQuestions.length || 0}</div>
                  <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Podcast ready: {podcastData.script ? "Yes" : "Not yet"}</div>
                  <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Saved workspaces for this email: {historyItems.length}</div>
                </div>
              </div>
            </aside>

            <div className="min-w-0 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5">
              <div className="force-mobile-stack mb-4 flex flex-wrap items-center justify-between gap-4">
                <div><p className="text-xs uppercase tracking-[0.28em] text-slate-400">Study Tool</p><h3 className="mt-2 text-2xl font-semibold text-white">{currentTabLabel}</h3></div>
                <div className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs uppercase tracking-[0.25em] text-slate-300">{hasResults ? "Generated" : "Awaiting lecture"}</div>
              </div>
              <div className="force-mobile-stack mb-4 flex flex-wrap gap-3">
                <button type="button" onClick={copyActiveContent} disabled={!canExportCurrent} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50">Copy Current Section</button>
                <div className="relative">
                  <button type="button" onClick={() => setIsDownloadMenuOpen((current) => !current)} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50">Download</button>
                  {isDownloadMenuOpen ? <div className="absolute left-0 top-full z-20 mt-2 min-w-[220px] rounded-[22px] border border-white/10 bg-slate-950/95 p-2 shadow-[0_18px_40px_rgba(2,8,23,0.45)]"><button type="button" onClick={async () => { setIsDownloadMenuOpen(false); await downloadActiveContent(); }} disabled={!canExportCurrent} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-white transition hover:bg-white/5 disabled:opacity-50"><span>Current section PDF</span><span className="text-xs uppercase tracking-[0.2em] text-slate-400">{currentTabLabel}</span></button><button type="button" onClick={async () => { setIsDownloadMenuOpen(false); await downloadFullStudyPackPdf(); }} disabled={!hasResults} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-white transition hover:bg-white/5 disabled:opacity-50"><span>Full study pack PDF</span><span className="text-xs uppercase tracking-[0.2em] text-slate-400">All tools</span></button>{activeTab === "quiz" ? <button type="button" onClick={async () => { setIsDownloadMenuOpen(false); await downloadQuizPdf(); }} disabled={!selectedQuizQuestions.length} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-white transition hover:bg-white/5 disabled:opacity-50"><span>Test PDF</span><span className="text-xs uppercase tracking-[0.2em] text-slate-400">Quiz</span></button> : null}{activeTab === "podcast" ? <button type="button" onClick={async () => { setIsDownloadMenuOpen(false); await downloadPodcastAudio(); }} disabled={!podcastData.jobId} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-white transition hover:bg-white/5 disabled:opacity-50"><span>Podcast audio</span><span className="text-xs uppercase tracking-[0.2em] text-slate-400">MP3</span></button> : null}</div> : null}
                </div>
                {canShareCurrentTool ? <button type="button" onClick={syncCurrentTabToRoom} className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-white">Share Current Tool</button> : null}
                <button type="button" onClick={() => { setCurrentPage("collaboration"); refreshCollaborationRooms(true); }} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50">Open Collaboration Page</button>
              </div>

              <div className={`content-panel min-h-[420px] w-full min-w-0 max-w-full rounded-[24px] border border-white/10 p-4 sm:p-5 ${activeTab === "guide" ? "bg-black/70" : "bg-slate-950/70"}`}>
                {activeTab === "guide" ? <div className="min-w-0 space-y-4">{studyImages.length ? <div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-4"><div><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Visual references</p><h4 className="mt-2 text-xl font-semibold text-white">Photo guides for concepts students should recognise by sight.</h4><p className="mt-2 text-sm leading-7 text-slate-300">Use these real photos together with the notes below when the lesson includes physical objects, structures, machines, instruments, or clearly named types.</p></div><div className="mt-4 grid gap-4 md:grid-cols-2">{studyImages.map((image, index) => <a key={`${image.image_url}-${index}`} href={image.source_url || image.image_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80 transition hover:border-emerald-300/30"><div className="aspect-[4/3] overflow-hidden bg-black/40"><img src={image.image_url} alt={image.title || image.query || "Study reference"} className="h-full w-full object-cover" loading="lazy" /></div><div className="space-y-2 p-4"><p className="phone-safe-copy text-sm font-semibold text-white">{image.title || image.query || "Reference photo"}</p><p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">{image.query || "Real photo"}</p><p className="text-xs text-slate-400">Open source photo for concept recognition</p></div></a>)}</div></div> : null}<div className="notes-markdown phone-safe-copy rounded-2xl bg-black/75 p-2 prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-strong:text-emerald-100 prose-li:text-slate-200"><ReactMarkdown>{formattedGuide || "Your study guide will appear here after generation."}</ReactMarkdown></div></div> : null}
                {activeTab === "transcript" ? <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{transcript || "The lecture transcript will appear here after transcription."}</div> : null}
                {activeTab === "examples" ? <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{formattedExample || "Worked examples will appear here after study guide generation."}</div> : null}
                {activeTab === "formulas" ? (formulaRows.length ? <div className="overflow-x-auto rounded-2xl border border-white/10"><div className="min-w-[520px]"><div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] bg-emerald-300/10 text-sm font-semibold text-emerald-50"><div className="border-r border-white/10 px-4 py-3">Expression</div><div className="px-4 py-3">Readable Result</div></div>{formulaRows.map((row, index) => <div key={`${row.expression}-${index}`} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] border-t border-white/10 text-sm"><div className="border-r border-white/10 px-4 py-3 font-semibold text-white">{row.expression}</div><div className="px-4 py-3 font-mono text-slate-200">{row.result}</div></div>)}</div></div> : <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{formattedFormula || "Detected formulas will appear here after study guide generation."}</div>) : null}
                {activeTab === "flashcards" ? <div className="grid gap-4 md:grid-cols-2">{flashcards.length ? flashcards.map((card, index) => <div key={`${card.question}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Flashcard {index + 1}</p><p className="phone-safe-copy mt-3 font-semibold text-white">{card.question}</p><p className="phone-safe-copy mt-4 text-sm leading-7 text-slate-300">{card.answer}</p></div>) : <div className="text-sm text-slate-300">Flashcards will appear here after study guide generation.</div>}</div> : null}
                {activeTab === "quiz" ? renderQuizSection({
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
                }) : null}
                {activeTab === "podcast" ? renderPodcastPanel() : null}
                {activeTab === "chat" ? <div className="flex h-full min-h-[360px] flex-col gap-4"><div className="flex-1 space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-4">{chatMessages.length ? chatMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === "assistant" ? "border border-emerald-300/15 bg-emerald-300/10 text-slate-100" : "ml-auto border border-white/10 bg-white/10 text-white"}`}><p className="mb-2 text-xs uppercase tracking-[0.24em] text-emerald-100/70">{message.role === "assistant" ? "MABASO" : "You"}</p><div className="whitespace-pre-wrap break-words">{message.content}</div></div>) : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm leading-7 text-slate-300">Ask for a simpler explanation, exam tips, a formula walkthrough, or help from a reference image.</div>}</div><div className="rounded-[26px] border border-white/10 bg-slate-950/80 p-4"><div className="force-mobile-stack flex items-end gap-3"><label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200"><span className="text-xl">+</span><input ref={chatImageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { handleChatReferenceFilesChange(event.target.files); event.target.value = ""; }} /></label><textarea value={chatQuestion} onChange={(event) => setChatQuestion(event.target.value)} onKeyDown={handleStudyChatKeyDown} rows={1} className="min-h-[56px] flex-1 resize-none bg-transparent px-1 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500" placeholder="Type your message..." /><button type="button" onClick={askStudyAssistant} disabled={isAskingChat} className="flex h-12 w-12 items-center justify-center self-end rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] text-white disabled:opacity-50 sm:self-auto" aria-label="Send message"><svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" /></svg></button></div><div className="mt-3 flex flex-wrap items-center gap-2">{chatReferenceImages.length ? chatReferenceImages.map((item) => <span key={item.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{item.name}<button type="button" onClick={() => removeChatReferenceImage(item.id)} className="text-slate-400 transition hover:text-white">x</button></span>) : <span className="text-xs text-slate-400">Add screenshots, notes, or handwritten references if they help the question.</span>}{chatReferenceImages.length ? <button type="button" onClick={() => setChatReferenceImages([])} disabled={!chatReferenceImages.length || isAskingChat} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white disabled:opacity-50">Clear images</button> : null}</div></div></div> : null}
                {activeTab === "collaboration" ? <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]"><div className="space-y-5"><div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Create room</p><h3 className="mt-2 text-2xl font-semibold text-white">Invite your study group</h3><p className="mt-3 text-sm leading-7 text-slate-300">Create an email-based collaboration room from this lecture. Invited students will see the same room when they sign in with those emails.</p><div className="mt-5 space-y-4"><div><label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Room title</label><input value={roomTitleInput} onChange={(event) => setRoomTitleInput(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none" placeholder={`${extractHistoryTitle(summary, workspaceFileLabel)} group room`} /></div><div><label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Invite by email</label><textarea value={roomInviteInput} onChange={(event) => setRoomInviteInput(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none" placeholder="student1@email.com, student2@email.com" /></div><div><label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Group test visibility</label><div className="mt-2 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setNewRoomVisibility("private")} className={`rounded-2xl border px-4 py-3 text-left text-sm ${newRoomVisibility === "private" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-slate-950/75 text-slate-200"}`}><p className="font-semibold">Private answers</p><p className="mt-2 text-xs leading-6 text-slate-300">Members cannot see what others are writing.</p></button><button type="button" onClick={() => setNewRoomVisibility("shared")} className={`rounded-2xl border px-4 py-3 text-left text-sm ${newRoomVisibility === "shared" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-slate-950/75 text-slate-200"}`}><p className="font-semibold">Shared answers</p><p className="mt-2 text-xs leading-6 text-slate-300">Members can compare typed answers inside the room.</p></button></div></div><button type="button" onClick={createCollaborationRoom} disabled={isCreatingRoom || (!summary && !transcript && !lectureNotes && !lectureSlides)} className="w-full rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isCreatingRoom ? "Creating room..." : "Create collaboration room"}</button></div></div><div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"><div className="force-mobile-stack flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Available rooms</p><h3 className="mt-2 text-xl font-semibold text-white">Your collaboration list</h3></div><button type="button" onClick={() => refreshCollaborationRooms()} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">Refresh</button></div><div className="mt-4 space-y-3">{collaborationRooms.length ? collaborationRooms.map((room) => <button key={room.id} type="button" onClick={async () => { setCurrentPage("workspace"); setActiveTab("collaboration"); await loadCollaborationRoom(room.id, { resetNotesDraft: true }); }} className={`w-full rounded-2xl border p-4 text-left transition ${activeRoomId === room.id ? "border-emerald-300/35 bg-emerald-300/10" : "border-white/10 bg-slate-950/75 hover:bg-white/10"}`}><p className="text-sm font-semibold text-white">{room.title}</p><p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{room.member_count} member{room.member_count === 1 ? "" : "s"} • {room.test_visibility}</p><p className="mt-2 text-xs text-slate-400">Updated {new Date(room.updated_at).toLocaleString()}</p></button>) : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm leading-7 text-slate-300">No collaboration rooms yet. Create the first one from the current lecture.</div>}</div></div></div><div className="space-y-5">{activeRoom ? <><div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Active room</p><h3 className="mt-2 text-3xl font-semibold text-white">{activeRoom.title}</h3><p className="mt-3 text-sm leading-7 text-slate-300">Shared tool: {roomToolLabel}. Room owner: {activeRoom.owner_email}.</p></div><div className="force-mobile-stack flex flex-wrap gap-3"><button type="button" onClick={syncCurrentTabToRoom} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50">Share current tool</button><button type="button" onClick={() => setFollowRoomView((current) => !current)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">{followRoomView ? "Following room view" : "Follow room view"}</button></div></div><div className="mt-5 flex flex-wrap gap-2">{(activeRoom.members || []).map((member) => <span key={member.email} className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs text-slate-200">{member.email} {member.role === "owner" ? "(owner)" : ""}</span>)}</div><div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/70 p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Shared revision pack</p><h4 className="mt-2 text-2xl font-semibold text-white">Guide, formulas, worked examples, flashcards, and test</h4><p className="mt-3 text-sm leading-7 text-slate-300">Choose a resource below to make it the room’s shared revision focus.</p></div><div className="flex flex-wrap gap-2">{[{ id: "guide", label: "Study Guide" }, { id: "formulas", label: "Formulas" }, { id: "examples", label: "Worked Examples" }, { id: "flashcards", label: "Flashcards" }, { id: "quiz", label: "Test" }].map((tab) => <button key={tab.id} type="button" onClick={async () => { setFollowRoomView(true); await shareTabToRoom(tab.id); }} className={`rounded-full px-4 py-2 text-sm ${activeRoom.active_tab === tab.id ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>{tab.label}</button>)}</div></div><div className="mt-4 whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm leading-7 text-slate-200">{buildCollaborationPreview(activeRoom) || "No shared content selected yet."}</div></div>{activeRoom.is_owner ? <div className="force-mobile-stack mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => changeRoomTestVisibility("private")} className={`rounded-full px-4 py-2 text-sm ${activeRoom.test_visibility === "private" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>Keep answers private</button><button type="button" onClick={() => changeRoomTestVisibility("shared")} className={`rounded-full px-4 py-2 text-sm ${activeRoom.test_visibility === "shared" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>Share answers in room</button></div> : null}</div><div className="grid gap-5 xl:grid-cols-2"><div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5"><div className="force-mobile-stack flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Shared notes</p><h4 className="mt-2 text-2xl font-semibold text-white">Everyone sees the same notes board</h4></div><button type="button" onClick={saveRoomNotes} disabled={isSavingRoomNotes} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50 disabled:opacity-50">{isSavingRoomNotes ? "Saving..." : "Save shared notes"}</button></div><textarea value={roomSharedNotesDraft} onChange={(event) => setRoomSharedNotesDraft(event.target.value)} rows={12} className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100 outline-none" placeholder="Write group notes, exam reminders, common mistakes, or a plan for the test..." /></div><div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Room chat</p><h4 className="mt-2 text-2xl font-semibold text-white">Live discussion</h4></div>{isRoomLoading ? <span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">Syncing</span> : null}</div><div className="mt-4 rounded-2xl border border-white/10 bg-slate-950 p-4">{(activeRoom.messages || []).length ? <div className="space-y-3">{activeRoom.messages.map((message) => <div key={message.id} className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">{message.author_email}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{message.content}</p></div>)}</div> : <p className="text-sm leading-7 text-slate-300">Room messages will appear here. Use this to coordinate who is revising which section.</p>}</div><div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/80 p-4"><div className="force-mobile-stack flex items-end gap-3"><textarea value={roomMessageDraft} onChange={(event) => setRoomMessageDraft(event.target.value)} onKeyDown={handleRoomChatKeyDown} rows={1} className="min-h-[56px] flex-1 resize-none bg-transparent px-1 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500" placeholder="Type your message..." /><button type="button" onClick={sendRoomMessage} disabled={isSendingRoomMessage} className="flex h-12 w-12 items-center justify-center self-end rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] text-white disabled:opacity-50 sm:self-auto" aria-label="Send room message"><svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" /></svg></button></div><p className="mt-3 text-xs text-slate-400">This room chat refreshes automatically.</p></div></div></div></> : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm leading-7 text-slate-300">Open a room from the list or create a new one to start shared notes, room chat, and group test settings.</div>}</div></div> : null}
              </div>
            </div>
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
