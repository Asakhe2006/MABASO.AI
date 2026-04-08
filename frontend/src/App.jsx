import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const JOB_POLL_INTERVAL_MS = 2000;
const ROOM_REFRESH_INTERVAL_MS = 5000;
const HISTORY_STORAGE_KEY = "mabaso-history-v1";
const AUTH_TOKEN_KEY = "mabaso-auth-token";
const AUTH_EMAIL_KEY = "mabaso-auth-email";
const REMEMBERED_EMAIL_KEY = "mabaso-remembered-email";
const MAX_HISTORY_ITEMS = 8;
const MAX_CHAT_REFERENCE_IMAGES = 4;
const tabs = [
  { id: "guide", label: "Study Guide" },
  { id: "transcript", label: "Transcript" },
  { id: "formulas", label: "Formulas" },
  { id: "examples", label: "Worked Examples" },
  { id: "flashcards", label: "Flashcards" },
  { id: "quiz", label: "Test" },
  { id: "chat", label: "Study Chat" },
  { id: "collaboration", label: "Collaboration" },
];

function loadHistoryItems() {
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function sanitizeFileName(value) {
  return (value || "mabaso-study-pack").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
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
    .replace(/â‰¥/g, "\u2265")
    .replace(/â‰¤/g, "\u2264")
    .replace(/â‰ /g, "\u2260")
    .replace(/â†’/g, "\u2192");
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
  if (text.includes("yt-dlp") || text.includes("video-link transcription")) return "Install yt-dlp on the backend, or use a YouTube link with public captions.";
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

function extractMarkdownSection(markdown, heading) {
  const pattern = new RegExp(`\\*\\*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*[A-Z][A-Z \\-&]+\\*\\*|$)`);
  const match = pattern.exec(markdown || "");
  return match?.[1]?.trim() || "";
}

function toSimpleBullets(text) {
  return (text || "").split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean);
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
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [currentPage, setCurrentPage] = useState("capture");
  const [videoUrl, setVideoUrl] = useState("");
  const [isTranscribingVideo, setIsTranscribingVideo] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [formula, setFormula] = useState("");
  const [example, setExample] = useState("");
  const [flashcards, setFlashcards] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [lectureNotes, setLectureNotes] = useState("");
  const [lectureNotesFileName, setLectureNotesFileName] = useState("");
  const [lectureSlides, setLectureSlides] = useState("");
  const [lectureSlideFileNames, setLectureSlideFileNames] = useState([]);
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
  const [isExtractingSlides, setIsExtractingSlides] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizAnswerImages, setQuizAnswerImages] = useState({});
  const [quizResults, setQuizResults] = useState({});
  const [isMarkingQuiz, setIsMarkingQuiz] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatReferenceImages, setChatReferenceImages] = useState([]);
  const [isAskingChat, setIsAskingChat] = useState(false);
  const [historyItems, setHistoryItems] = useState(loadHistoryItems);
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
  const fileInputRef = useRef(null);
  const lectureNotesFileInputRef = useRef(null);
  const lectureSlidesFileInputRef = useRef(null);
  const chatImageInputRef = useRef(null);
  const videoUrlInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const googleButtonRef = useRef(null);
  const answerSyncTimersRef = useRef({});

  const loading = isTranscribing || isTranscribingVideo || isGeneratingSummary || isExtractingSlides;
  const hasTranscript = Boolean(transcript);
  const hasResults = Boolean(transcript || summary || formula || example || flashcards.length || quizQuestions.length);
  const selectedQuizQuestions = quizQuestions;
  const formattedGuide = normalizeRenderedMathText(prettifyMathText(summary));
  const formattedFormula = normalizeRenderedMathText(prettifyMathText(formula));
  const formattedExample = normalizeRenderedMathText(prettifyMathText(example));
  const formulaRows = parseFormulaRows(formattedFormula);
  const currentTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || "Study Guide";
  const activeHistoryItem = historyItems.find((item) => item.id === activeHistoryId) || null;
  const workspaceFileLabel = file?.name || activeHistoryItem?.fileName || formatVideoSourceLabel(videoUrl) || "No lecture selected";
  const roomAnswerGroups = groupQuizAnswers(activeRoom?.quiz_answers || []);
  const roomToolLabel = tabs.find((tab) => tab.id === activeRoom?.active_tab)?.label || "Study Guide";
  const canExportCurrent = activeTab === "collaboration" ? Boolean(activeRoom) : hasResults || activeTab === "chat";
  const errorHint = getErrorHint(error);
  const showHistoryPanel = currentPage === "capture" || currentPage === "workspace";

  const clearHistory = () => {
    setHistoryItems([]);
    setActiveHistoryId("");
    setStatus("History cleared.");
  };

  const removeHistoryItem = (itemId) => {
    setHistoryItems((current) => current.filter((entry) => entry.id !== itemId));
    if (activeHistoryId === itemId) setActiveHistoryId("");
  };

  const historyPanel = showHistoryPanel ? (
    <section className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_20px_70px_rgba(2,8,23,0.28)] backdrop-blur xl:p-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">History</p><h2 className="mt-2 text-3xl font-semibold text-white">Saved workspaces on this device.</h2></div>
        <div className="force-mobile-stack flex flex-wrap gap-3"><div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">{historyItems.length} saved item{historyItems.length === 1 ? "" : "s"}</div><button type="button" onClick={clearHistory} disabled={!historyItems.length} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50">Clear History</button></div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">{historyItems.length ? historyItems.map((item) => <article key={item.id} className={`rounded-[24px] border p-5 transition ${activeHistoryId === item.id ? "border-emerald-300/35 bg-emerald-300/10" : "border-white/10 bg-white/[0.04]"}`}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">{new Date(item.createdAt).toLocaleString()}</p><h3 className="mt-3 text-xl font-semibold text-white">{item.title}</h3><p className="mt-2 text-sm text-slate-300">{item.fileName || "Saved lecture"}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">{item.quizQuestions?.length || 0} test question{item.quizQuestions?.length === 1 ? "" : "s"}</span><span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">{item.lectureNotes?.trim() ? "Notes added" : "No notes"}</span><span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">{item.lectureSlideFileNames?.length || 0} slide source{(item.lectureSlideFileNames?.length || 0) === 1 ? "" : "s"}</span></div></div><div className="force-mobile-stack flex flex-wrap gap-2"><button type="button" onClick={() => loadHistoryItem(item)} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">Open</button><button type="button" onClick={() => downloadHistoryItemPdf(item)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">Study Pack PDF</button><button type="button" onClick={() => downloadHistoryQuizPdf(item)} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-50">Test PDF</button><button type="button" onClick={() => removeHistoryItem(item.id)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">Remove</button></div></div><p className="mt-4 max-h-[8.2rem] overflow-hidden text-sm leading-7 text-slate-300">{(item.summary || "Saved study guide content will appear here.").replace(/\*\*/g, "")}</p></article>) : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-slate-300 lg:col-span-2">Your saved workspace history will appear here after the first successful study guide.</div>}</div>
    </section>
  ) : null;

  const clearSession = (message = "Please sign in again.") => {
    setAuthToken("");
    setAuthEmail("");
    setCodeSent(false);
    setVerificationCode("");
    setCurrentPage("capture");
    setActiveRoomId("");
    setActiveRoom(null);
    setCollaborationRooms([]);
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
    fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(async (response) => {
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Session check failed.");
      if (cancelled) return;
      setAuthToken(token);
      setAuthEmail(data.email || window.localStorage.getItem(AUTH_EMAIL_KEY) || "");
      setAuthEmailInput(data.email || window.localStorage.getItem(REMEMBERED_EMAIL_KEY) || "");
      setAuthChecked(true);
    }).catch(() => {
      if (cancelled) return;
      clearSession("Sign in to continue.");
      setAuthChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyItems));
    } catch {
      // Ignore storage errors.
    }
  }, [historyItems]);

  useEffect(() => {
    if (!authToken) return;
    window.localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    window.localStorage.setItem(AUTH_EMAIL_KEY, authEmail);
  }, [authEmail, authToken]);

  useEffect(() => {
    if (!authEmailInput.trim()) return;
    window.localStorage.setItem(REMEMBERED_EMAIL_KEY, authEmailInput.trim());
  }, [authEmailInput]);

  const finishGoogleLogin = async (credential) => {
    setAuthMessage("");
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
    }
  };

  useEffect(() => {
    if (authToken || !authChecked) return;
    if (!GOOGLE_CLIENT_ID) {
      setAuthMessage("Google login is not configured on the website yet. Missing VITE_GOOGLE_CLIENT_ID.");
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

  const authFetch = async (path, options = {}) => {
    if (!authToken) throw new Error("Please sign in to continue.");
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${authToken}`);
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    if (response.status === 401) {
      clearSession("Your session expired. Please sign in again.");
      throw new Error("Your session expired. Please sign in again.");
    }
    return response;
  };

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
    if (!followRoomView || !activeRoom?.active_tab || activeTab === "collaboration") return;
    setActiveTab(activeRoom.active_tab);
  }, [activeRoom?.active_tab, activeTab, followRoomView]);

  useEffect(() => () => {
    Object.values(answerSyncTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
  }, []);

  const getActiveContent = () => {
    if (activeTab === "guide") return formattedGuide || "No study guide generated yet.";
    if (activeTab === "transcript") return transcript || "No transcript generated yet.";
    if (activeTab === "formulas") return formattedFormula || "No formulas generated yet.";
    if (activeTab === "examples") return formattedExample || "No worked examples generated yet.";
    if (activeTab === "flashcards") return flashcardsToText(flashcards) || "No flashcards generated yet.";
    if (activeTab === "quiz") return buildQuizExportText(selectedQuizQuestions, quizAnswers, quizResults) || "No test generated yet.";
    if (activeTab === "chat") return chatToText(chatMessages) || "No study chat yet.";
    return collaborationRoomToText(activeRoom);
  };

  const buildCurrentStudyPackSections = () => [
    { title: "Study Guide", content: formattedGuide || summary },
    { title: "Transcript", content: transcript },
    { title: "Formulas", content: formattedFormula || formula },
    { title: "Worked Examples", content: formattedExample || example },
    { title: "Flashcards", content: flashcardsToText(flashcards) },
    { title: "Test", content: quizToText(quizQuestions) },
    { title: "Study Chat", content: chatToText(chatMessages) },
  ];

  const addHistoryItem = (item) => {
    setHistoryItems((current) => [item, ...current].slice(0, MAX_HISTORY_ITEMS));
    setActiveHistoryId(item.id);
  };

  const loadHistoryItem = (item) => {
    setTranscript(item.transcript || "");
    setSummary(item.summary || "");
    setFormula(item.formula || "");
    setExample(item.example || "");
    setFlashcards(item.flashcards || []);
    setQuizQuestions(item.quizQuestions || []);
    setLectureNotes(item.lectureNotes || "");
    setLectureNotesFileName(item.lectureNotesFileName || "");
    setLectureSlides(item.lectureSlides || "");
    setLectureSlideFileNames(item.lectureSlideFileNames || []);
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
    setQuizAnswers({});
    setQuizAnswerImages({});
    setQuizResults({});
    setQuizSubmitted(false);
    setChatMessages([]);
    setChatReferenceImages([]);
    setUsedFallbackSummary(false);
    setActiveHistoryId("");
  };

  const requestVerificationCode = async () => {
    if (!authEmailInput.trim()) return setAuthMessage("Enter your email address first.");
    setIsRequestingCode(true);
    setAuthMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/request-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: authEmailInput.trim() }) });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not send verification code.");
      setCodeSent(true);
      setAuthMessage(`Verification code sent to ${data.email || authEmailInput.trim()}.`);
    } catch (err) {
      setAuthMessage(err.message || "Could not send verification code.");
    } finally {
      setIsRequestingCode(false);
    }
  };

  const verifyCodeAndLogin = async () => {
    if (!authEmailInput.trim() || !verificationCode.trim()) return setAuthMessage("Enter both your email and verification code.");
    setIsVerifyingCode(true);
    setAuthMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: authEmailInput.trim(), code: verificationCode.trim() }) });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Could not verify the code.");
      setAuthToken(data.token || "");
      setAuthEmail(data.email || authEmailInput.trim());
      setAuthEmailInput(data.email || authEmailInput.trim());
      setVerificationCode("");
      setCodeSent(false);
      setStatus("Signed in successfully.");
      setAuthMessage("You are signed in.");
    } catch (err) {
      setAuthMessage(err.message || "Could not verify the code.");
    } finally {
      setIsVerifyingCode(false);
    }
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

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setVideoUrl("");
    setError("");
    setStatus(`${selectedFile.name} selected.`);
  };

  const handleLectureNotesFileChange = async (selectedFile) => {
    if (!selectedFile) return;
    try {
      const text = await selectedFile.text();
      setLectureNotes(text);
      setLectureNotesFileName(selectedFile.name);
      setStatus("Lecture notes added.");
    } catch {
      setError("Could not read the lecture notes file.");
    }
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
      const extractedParts = [];
      const addedNames = [];
      for (const [index, selectedFile] of files.entries()) {
        const isTextFile = selectedFile.type.startsWith("text/") || /\.(txt|md|text)$/i.test(selectedFile.name || "");
        setProgress(Math.min(90, 15 + Math.round(((index + 1) / files.length) * 70)));
        setStatus(`Reading slide source ${index + 1} of ${files.length}: ${selectedFile.name}`);
        if (isTextFile) {
          const text = await selectedFile.text();
          if (text.trim()) {
            extractedParts.push(`SLIDE SOURCE: ${selectedFile.name}\n${text.trim()}`);
            addedNames.push(selectedFile.name);
          }
          continue;
        }
        const formData = new FormData();
        formData.append("file", selectedFile);
        const response = await authFetch("/extract-slide-text/", { method: "POST", body: formData });
        const data = await parseJsonSafe(response);
        if (!response.ok) throw new Error(data.detail || `Could not read ${selectedFile.name}.`);
        if (data.text?.trim()) {
          extractedParts.push(`SLIDE SOURCE: ${selectedFile.name}\n${data.text.trim()}`);
          addedNames.push(selectedFile.name);
        }
      }
      if (!extractedParts.length) throw new Error("No readable slide content could be extracted.");
      setLectureSlides((current) => [current.trim(), extractedParts.join("\n\n")].filter(Boolean).join("\n\n"));
      setLectureSlideFileNames((current) => Array.from(new Set([...current, ...addedNames])));
      setStatus(`${addedNames.length} slide source${addedNames.length === 1 ? "" : "s"} added.`);
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

  const generateStudyGuide = async (transcriptText) => {
    if (!transcriptText.trim()) return setError("Transcript is empty, so a study guide cannot be generated yet.");
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
        body: JSON.stringify({ transcript: transcriptText, lecture_notes: lectureNotes, lecture_slides: lectureSlides }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) throw new Error(data.detail || "Study guide generation failed.");
      const job = await pollJob(data.job_id, "study_guide");
      setSummary(job.summary || "");
      setFormula(job.formula || "");
      setExample(job.worked_example || "");
      setFlashcards(job.flashcards || []);
      setQuizQuestions(job.quiz_questions || []);
      setQuizAnswers({});
      setQuizAnswerImages({});
      setQuizResults({});
      setQuizSubmitted(false);
      setUsedFallbackSummary(Boolean(job.used_fallback));
      setActiveTab("guide");
      setCurrentPage("workspace");
      setStatus(job.used_fallback ? "Fallback study guide ready." : "Study guide ready.");
      setProgress(100);
      const sourceLabel = file?.name || formatVideoSourceLabel(videoUrl) || "Saved lecture";
      addHistoryItem({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        title: extractHistoryTitle(job.summary || "", sourceLabel),
        fileName: sourceLabel,
        summary: job.summary || "",
        transcript: job.transcript || transcriptText,
        formula: job.formula || "",
        example: job.worked_example || "",
        flashcards: job.flashcards || [],
        quizQuestions: job.quiz_questions || [],
        lectureNotes,
        lectureNotesFileName,
        lectureSlides,
        lectureSlideFileNames,
      });
    } catch (err) {
      setError(err.message || "Study guide generation failed.");
      setStatus("Transcript ready. Study guide generation failed.");
    } finally {
      setIsGeneratingSummary(false);
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
          active_tab: activeTab,
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
      setCurrentPage("workspace");
      setActiveTab("collaboration");
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

  const queueRoomAnswerSync = (question, value) => {
    if (!activeRoomId) return;
    const questionNumber = String(question?.number || "");
    const key = questionNumber;
    const serializedValue = serializeQuizAnswerForRoom(question, value);
    if (answerSyncTimersRef.current[key]) window.clearTimeout(answerSyncTimersRef.current[key]);
    answerSyncTimersRef.current[key] = window.setTimeout(async () => {
      try {
        const response = await authFetch(`/collaboration/rooms/${activeRoomId}/quiz-answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question_number: questionNumber, answer_text: serializedValue }),
        });
        const data = await parseJsonSafe(response);
        if (!response.ok) throw new Error(data.detail || "Could not sync the collaboration answer.");
        if (data.room) setActiveRoom(data.room);
      } catch (err) {
        setError(err.message || "Could not sync the collaboration answer.");
      }
    }, 800);
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

  const downloadHistoryItemPdf = async (item) => {
    try {
      await exportPdf(item.title || item.fileName || "Saved lecture", [
        { title: "Study Guide", content: item.summary || "" },
        { title: "Transcript", content: item.transcript || "" },
        { title: "Formulas", content: item.formula || "" },
        { title: "Worked Examples", content: item.example || "" },
        { title: "Flashcards", content: flashcardsToText(item.flashcards || []) },
        { title: "Test", content: quizToText(item.quizQuestions || []) },
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

  const handleQuizImageChange = (questionNumber, selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) return setError("Please upload an image file for test answer marking.");
    setQuizAnswerImages((current) => ({ ...current, [questionNumber]: selectedFile }));
    clearQuestionResult(questionNumber);
    setStatus(`Handwritten answer photo added for question ${questionNumber}.`);
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
        const imageFile = quizAnswerImages[item.number];
        const hasOptionAnswer = isOptionBasedQuestion(item) && Object.values(selectedOptions).some(Boolean);
        if (!typedAnswer.trim() && !imageFile && !hasOptionAnswer) {
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
        if (!isOptionBasedQuestion(item) && imageFile) formData.append("answer_image", imageFile);
        const response = await authFetch("/mark-quiz-answer/", { method: "POST", body: formData });
        const data = await parseJsonSafe(response);
        if (!response.ok) throw new Error(data.detail || `Could not mark question ${item.number}.`);
        nextResults[item.number] = data;
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

  const score = selectedQuizQuestions.reduce((total, item) => total + Number(quizResults[item.number]?.score || 0), 0);
  const totalQuizMarks = getTotalQuizMarks(selectedQuizQuestions);

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
                {["1. Sign in", "2. Capture lecture", "3. Study workspace"].map((step, index) => <div key={step} className={`rounded-full border px-4 py-2 text-sm ${index === 0 ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-slate-950/75 text-slate-300"}`}>{step}</div>)}
              </div>
              <p className="brand-mark mt-6 text-3xl font-black sm:text-5xl">MABASO.AI</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">Sign in, capture the lecture, then open the study workspace.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">The workspace is now split into clear steps so students do not land in crowded screens on phones before the lecture is ready.</p>
            </section>
            <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_28px_80px_rgba(2,8,23,0.55)]">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Google Access</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Sign in with Google</h2>
              <div className="mt-8 space-y-5">
                {authEmailInput ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100">
                    Last used on this device: {authEmailInput}
                  </div>
                ) : null}
                <div ref={googleButtonRef} className="min-h-[44px] w-full max-w-[320px] overflow-hidden" />
                <div className="rounded-2xl border border-emerald-300/18 bg-emerald-300/8 px-4 py-4 text-sm leading-7 text-slate-200">
                  Record your lecture while teaching and get notes automatically. This device remembers the Google email you used and keeps you signed in until you sign out or the session expires.
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
          <div><p className="brand-mark text-2xl font-black sm:text-4xl">MABASO.AI</p><p className="mt-2 text-sm text-slate-300">Record your lecture while teaching and get notes automatically.</p></div>
          <div className="force-mobile-stack flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setCurrentPage("capture")} className={`rounded-full px-4 py-2 text-sm ${currentPage === "capture" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}>Capture Lecture</button>
            <button type="button" onClick={() => setCurrentPage("workspace")} disabled={!hasResults} className={`rounded-full px-4 py-2 text-sm ${currentPage === "workspace" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"} disabled:opacity-50`}>Study Workspace</button>
            <div className="phone-safe-copy rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">Signed in as {authEmail}</div>
            <button type="button" onClick={logout} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">Sign Out</button>
          </div>
        </header>
        <div className="mb-6 flex flex-wrap gap-3">{["1. Sign in", "2. Capture lecture", "3. Study workspace"].map((step, index) => { const activeIndex = currentPage === "capture" ? 1 : 2; return <div key={step} className={`rounded-full border px-4 py-2 text-sm ${index === activeIndex ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : index < activeIndex ? "border-white/10 bg-white/5 text-white" : "border-white/10 bg-slate-950/75 text-slate-300"}`}>{step}</div>; })}</div>

        {currentPage === "capture" ? <section className="mb-8 rounded-[32px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_30px_80px_rgba(8,15,30,0.45)] backdrop-blur xl:p-8">
          <div className="grid gap-8 xl:grid-cols-[1fr_0.95fr]">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-100">Step 2 of 3</div>
              <h1 className="text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">Capture the lecture first, then move into the study workspace.</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300">This step is focused on uploading, recording, notes, slides, and processing so the phone layout stays lighter and nothing important gets cropped.</p>
            </div>

            <aside className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(6,18,12,0.96),rgba(1,7,4,0.98))] p-5 shadow-[0_20px_60px_rgba(2,8,23,0.55)]">
              <div onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); setDragActive(false); handleFileChange(event.dataTransfer.files?.[0]); }} className={`rounded-[24px] border border-dashed p-5 transition ${dragActive ? "border-emerald-300 bg-emerald-300/10" : "border-white/15 bg-white/[0.03]"}`}>
                <div className="space-y-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#22c55e,#166534)] text-2xl font-black text-white">M</div>
                  <div><h2 className="text-2xl font-semibold text-white">Build your lecture workspace</h2></div>
                  <div className="force-mobile-stack flex flex-wrap gap-3">
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">Choose Lecture File</button>
                    <button type="button" onClick={recording ? stopRecording : startRecording} disabled={loading} className={`rounded-full px-5 py-3 text-sm font-semibold ${recording ? "bg-rose-500 text-white" : "bg-emerald-400/15 text-emerald-100"} disabled:opacity-60`}>{recording ? "Stop Recording" : "Record Live Lecture"}</button>
                    <button type="button" onClick={() => videoUrlInputRef.current?.focus()} disabled={loading} className="rounded-full border border-emerald-300/20 bg-slate-950/75 px-5 py-3 text-sm font-semibold text-emerald-50 disabled:opacity-50">Use Video Link</button>
                  </div>
                  <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Video Link</p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input ref={videoUrlInputRef} value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none" placeholder="Paste a YouTube or video URL here" />
                      <button type="button" onClick={transcribeVideoLink} disabled={loading || !videoUrl.trim()} className="rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isTranscribingVideo ? "Reading Link..." : "Transcribe Video Link"}</button>
                    </div>
                    <p className="mt-3 text-xs leading-6 text-slate-300">Use this when the lecture already exists online and you want the study guide, test, formulas, and worked examples from that video.</p>
                  </div>
                  <div className="force-mobile-stack flex flex-wrap gap-3">
                    <button type="button" onClick={() => lectureNotesFileInputRef.current?.click()} disabled={loading} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Upload Notes</button>
                    <button type="button" onClick={() => lectureSlidesFileInputRef.current?.click()} disabled={loading} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm font-semibold text-emerald-50 disabled:opacity-50">Upload Slides</button>
                  </div>
                  <div className="force-mobile-stack flex flex-wrap gap-3">
                    <button type="button" onClick={upload} disabled={loading || !file} className="rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isTranscribing ? "Transcribing..." : isGeneratingSummary ? "Generating..." : "Transcribe Lecture"}</button>
                    <button type="button" onClick={() => generateStudyGuide(transcript)} disabled={loading || !hasTranscript} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm font-semibold text-emerald-50 disabled:opacity-50">{isGeneratingSummary ? "Generating Guide..." : "Generate Study Guide"}</button>
                    <button type="button" onClick={() => setCurrentPage("workspace")} disabled={!hasResults} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Open Study Workspace</button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="audio/*,video/*" className="hidden" onChange={(event) => handleFileChange(event.target.files?.[0])} />
                  <input ref={lectureNotesFileInputRef} type="file" accept=".txt,.md,.text" className="hidden" onChange={(event) => handleLectureNotesFileChange(event.target.files?.[0])} />
                  <input ref={lectureSlidesFileInputRef} type="file" accept="image/*,.txt,.md,.text,.pdf,.pptx" multiple className="hidden" onChange={(event) => handleLectureSlidesFilesChange(event.target.files)} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Lecture Notes</p><p className="mt-3 text-sm font-semibold text-white">{lectureNotesFileName || (lectureNotes.trim() ? "Notes added" : "No notes added yet")}</p></div>
                <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-4"><div className="force-mobile-stack flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Lecture Slides</p><p className="mt-3 text-sm font-semibold text-white">{lectureSlideFileNames.length ? `${lectureSlideFileNames.length} source${lectureSlideFileNames.length === 1 ? "" : "s"} added` : "No slides added yet"}</p></div><button type="button" onClick={() => lectureSlidesFileInputRef.current?.click()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300/20 bg-slate-950/75 px-3 py-2 text-xs font-semibold text-emerald-50 disabled:opacity-50"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20 text-base font-bold text-emerald-100">+</span><span>Add PDF / PPTX</span></button></div>{lectureSlideFileNames.length ? <div className="mt-4 flex flex-wrap gap-2">{lectureSlideFileNames.slice(0, 4).map((name) => <span key={name} className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">{name}</span>)}{lectureSlideFileNames.length > 4 ? <span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-200">+{lectureSlideFileNames.length - 4} more</span> : null}</div> : null}</div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Selected File", value: workspaceFileLabel }, { label: "Size", value: file ? formatBytes(file.size) : videoUrl.trim() ? "Video link" : activeHistoryItem ? "Saved workspace" : "Waiting" }, { label: "Status", value: isMarkingQuiz ? "Marking test" : isAskingChat ? "Answering" : loading ? currentJobType === "study_guide" ? "Generating notes" : currentJobType === "slides" ? "Reading slides" : currentJobType === "video" ? "Reading video link" : "Transcribing" : hasResults ? "Ready" : "Waiting" }, { label: "Signed In", value: authEmail || "Not signed in" }].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-4"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{item.label}</p><p className="mt-3 break-words text-sm font-semibold text-white">{item.value}</p></div>)}</div>

              <div className="mt-5 min-h-[150px] rounded-2xl border border-white/10 bg-slate-950/75 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">{status || "Ready for your next lecture."}</p></div><div className="rounded-full border border-white/10 bg-slate-950 px-3 py-2 text-xs font-semibold text-emerald-100">{Math.round(progress)}%</div></div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"><div className="progress-bar h-full rounded-full bg-[linear-gradient(90deg,#22c55e,#10b981,#4ade80)] transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>
                {usedFallbackSummary ? <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">MABASO returned a fallback study guide instead of leaving the lecture blank.</div> : null}
                {error ? <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"><p className="font-semibold">Processing failed</p><p className="mt-2">{error}</p>{errorHint && errorHint.trim().toLowerCase() !== (error || "").trim().toLowerCase() ? <p className="mt-2 text-rose-100/80">{errorHint}</p> : null}</div> : null}
              </div>
            </aside>
          </div>
        </section> : null}

        {currentPage === "workspace" ? <section className="rounded-[32px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_24px_80px_rgba(2,8,23,0.35)] backdrop-blur xl:p-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Study Workspace</p><h2 className="mt-2 text-3xl font-semibold text-white">Choose the tool you want to use now.</h2></div>
            <div className="overflow-x-auto pb-1"><div className="flex min-w-max gap-2">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-full px-4 py-2 text-sm transition ${activeTab === tab.id ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"}`}>{tab.label}</button>)}</div></div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
            <aside className="space-y-4 xl:sticky xl:top-6">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workspace Snapshot</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Lecture file: {workspaceFileLabel}</div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Lecture notes: {lectureNotes.trim() ? lectureNotesFileName || "Added" : "Not added"}</div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Slide sources: {lectureSlideFileNames.length || 0}</div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Test questions: {quizQuestions.length || 0}</div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">Saved workspaces: {historyItems.length}</div>
                </div>
              </div>
            </aside>

            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div><p className="text-xs uppercase tracking-[0.28em] text-slate-400">Current View</p><h3 className="mt-2 text-2xl font-semibold text-white">{currentTabLabel}</h3></div>
                <div className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs uppercase tracking-[0.25em] text-slate-300">{activeTab === "collaboration" ? "Shared mode" : hasResults ? "Generated" : "Awaiting lecture"}</div>
              </div>
              <div className="force-mobile-stack mb-4 flex flex-wrap gap-3">
                <button type="button" onClick={copyActiveContent} disabled={!canExportCurrent} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50">Copy Current Section</button>
                <button type="button" onClick={downloadActiveContent} disabled={!canExportCurrent} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50 disabled:opacity-50">Download Section PDF</button>
                <button type="button" onClick={downloadFullStudyPackPdf} disabled={!hasResults} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50">Download Full PDF</button>
                {activeTab === "quiz" ? <button type="button" onClick={downloadQuizPdf} disabled={!selectedQuizQuestions.length} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50 disabled:opacity-50">Download Test PDF</button> : null}
                {activeRoom ? <button type="button" onClick={syncCurrentTabToRoom} className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-white">Share Current Tool</button> : null}
              </div>

              <div className={`content-panel min-h-[420px] rounded-[24px] border border-white/10 p-4 sm:p-5 ${activeTab === "guide" ? "bg-black/70" : "bg-slate-950/70"}`}>
                {activeTab === "guide" ? <div className="space-y-4"><div className="notes-markdown rounded-2xl bg-black/75 p-2 prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-strong:text-emerald-100 prose-li:text-slate-200"><ReactMarkdown>{formattedGuide || "Your study guide will appear here after generation."}</ReactMarkdown></div></div> : null}
                {activeTab === "transcript" ? <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{transcript || "The lecture transcript will appear here after transcription."}</div> : null}
                {activeTab === "examples" ? <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{formattedExample || "Worked examples will appear here after study guide generation."}</div> : null}
                {activeTab === "formulas" ? (formulaRows.length ? <div className="overflow-x-auto rounded-2xl border border-white/10"><div className="min-w-[520px]"><div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] bg-emerald-300/10 text-sm font-semibold text-emerald-50"><div className="border-r border-white/10 px-4 py-3">Expression</div><div className="px-4 py-3">Readable Result</div></div>{formulaRows.map((row, index) => <div key={`${row.expression}-${index}`} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] border-t border-white/10 text-sm"><div className="border-r border-white/10 px-4 py-3 font-semibold text-white">{row.expression}</div><div className="px-4 py-3 font-mono text-slate-200">{row.result}</div></div>)}</div></div> : <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{formattedFormula || "Detected formulas will appear here after study guide generation."}</div>) : null}
                {activeTab === "flashcards" ? <div className="grid gap-4 md:grid-cols-2">{flashcards.length ? flashcards.map((card, index) => <div key={`${card.question}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Flashcard {index + 1}</p><p className="mt-3 font-semibold text-white">{card.question}</p><p className="mt-4 text-sm leading-7 text-slate-300">{card.answer}</p></div>) : <div className="text-sm text-slate-300">Flashcards will appear here after study guide generation.</div>}</div> : null}
                {activeTab === "quiz" ? <div><div className="mb-5 flex flex-wrap items-center gap-3"><div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">{selectedQuizQuestions.length} test question{selectedQuizQuestions.length === 1 ? "" : "s"} ready</div><div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">{totalQuizMarks} total marks</div><div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">Handwritten photos stay only on written questions.</div>{activeRoom ? <div className="rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">Room visibility: {activeRoom.test_visibility === "shared" ? "Shared answers" : "Private answers"}</div> : null}<button type="button" onClick={markQuiz} disabled={!selectedQuizQuestions.length || isMarkingQuiz} className="rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isMarkingQuiz ? "Marking..." : "Mark Test"}</button>{quizSubmitted ? <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">Score: {score} / {totalQuizMarks}</div> : null}</div><div className="space-y-4">{selectedQuizQuestions.length ? selectedQuizQuestions.map((item) => { const result = quizResults[item.number]; const maxMarks = getQuestionMarks(item); const questionScore = Number(result?.score || 0); const scoreRatio = maxMarks ? questionScore / maxMarks : 0; const answerTone = !quizSubmitted ? "border-white/10 bg-slate-900" : scoreRatio >= 1 ? "border-emerald-400/35 bg-emerald-500/10" : scoreRatio > 0 ? "border-amber-300/30 bg-amber-500/10" : "border-rose-400/35 bg-rose-500/10"; const resultBadge = !quizSubmitted ? "" : scoreRatio >= 1 ? "Full marks" : scoreRatio > 0 ? "Partial credit" : "Needs correction"; const resultBadgeTone = scoreRatio >= 1 ? "bg-emerald-950 text-emerald-100" : scoreRatio > 0 ? "bg-amber-950 text-amber-100" : "bg-rose-950 text-rose-100"; const visibleRoomAnswers = (roomAnswerGroups[item.number] || []).filter((answer) => answer.author_email !== authEmail); const typedAnswer = typeof quizAnswers[item.number] === "string" ? quizAnswers[item.number] : ""; const selectedOptions = quizAnswers[item.number] && typeof quizAnswers[item.number] === "object" ? quizAnswers[item.number] : {}; return <div key={item.number} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><p className="font-semibold text-white">{item.number}. {item.question}</p><span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-slate-200">{maxMarks} mark{maxMarks === 1 ? "" : "s"}</span></div>{isOptionBasedQuestion(item) ? <div className="mt-4 space-y-4">{(item.subparts || []).map((subpart) => { const subpartResult = result?.subpart_results?.find((entry) => entry.label === subpart.label); return <div key={`${item.number}-${subpart.label}`} className="rounded-2xl border border-white/10 bg-slate-950/75 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><p className="text-sm font-semibold text-white">{subpart.label}) {subpart.question}</p><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">{subpart.marks} mark</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{(subpart.options || []).map((option) => { const checked = selectedOptions[subpart.label] === option; return <label key={`${subpart.label}-${option}`} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${checked ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-white/5 text-slate-200"}`}><input type="radio" name={`${item.number}-${subpart.label}`} checked={checked} onChange={() => handleQuizOptionChange(item, subpart.label, option)} className="h-4 w-4 accent-emerald-400" /><span>{option}</span></label>; })}</div>{quizSubmitted && subpartResult ? <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${subpartResult.is_correct ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-50" : "border-rose-300/25 bg-rose-500/10 text-slate-100"}`}><p>{subpartResult.marks_awarded} / {subpartResult.marks}</p><p className="mt-2 leading-7">{subpartResult.feedback}</p></div> : null}</div>; })}</div> : <><textarea value={typedAnswer} onChange={(event) => handleQuizAnswerChange(item, event.target.value)} rows={4} className={`mt-3 w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 outline-none ${answerTone}`} placeholder="Type your answer here..." /><div className="mt-3 flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/20 text-lg font-semibold text-emerald-100">+</span><span>Upload handwritten answer photo</span><input type="file" accept="image/*" className="hidden" onChange={(event) => handleQuizImageChange(item.number, event.target.files?.[0])} /></label>{quizAnswerImages[item.number] ? <span className="text-xs text-emerald-100/80">{quizAnswerImages[item.number].name}</span> : null}</div></>}{activeRoom?.test_visibility === "shared" && visibleRoomAnswers.length ? <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/75 p-3"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Team answers</p><div className="mt-3 space-y-3 text-sm text-slate-200">{visibleRoomAnswers.map((answer) => <div key={`${answer.question_number}-${answer.author_email}`} className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="font-semibold text-white">{answer.author_email}</p><p className="mt-2 whitespace-pre-wrap break-words leading-7">{answer.answer_text}</p></div>)}</div></div> : null}{quizSubmitted && result ? <div className="mt-4 space-y-3"><div className="rounded-2xl border border-white/10 bg-slate-950/75 p-3"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">{isOptionBasedQuestion(item) ? "Answer Key" : "Suggested Answer"}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">{buildExpectedAnswerText(item)}</p></div><div className={`rounded-2xl border p-3 ${scoreRatio >= 1 ? "border-emerald-300/25 bg-emerald-300/10" : scoreRatio > 0 ? "border-amber-300/25 bg-amber-500/10" : "border-rose-300/25 bg-rose-500/10"}`}><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.24em] text-slate-200">Marked Result</p><span className={`rounded-full px-3 py-1 text-xs font-semibold ${resultBadgeTone}`}>{resultBadge}</span></div><p className="mt-3 text-sm font-semibold text-white">{questionScore} / {Number(result.max_score || maxMarks)}</p>{result.extracted_answer ? <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-100">Detected answer: {result.extracted_answer}</p> : null}<p className="mt-2 text-sm leading-7 text-slate-200">{result.feedback}</p>{Array.isArray(result.mistakes) && result.mistakes.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-100">{result.mistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul> : null}</div></div> : null}</div>; }) : <div className="text-sm text-slate-300">Test questions will appear here after study guide generation.</div>}</div></div> : null}
                {activeTab === "chat" ? <div className="flex h-full min-h-[360px] flex-col gap-4"><div className="flex-1 space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-4">{chatMessages.length ? chatMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === "assistant" ? "border border-emerald-300/15 bg-emerald-300/10 text-slate-100" : "ml-auto border border-white/10 bg-white/10 text-white"}`}><p className="mb-2 text-xs uppercase tracking-[0.24em] text-emerald-100/70">{message.role === "assistant" ? "MABASO" : "You"}</p><div className="whitespace-pre-wrap break-words">{message.content}</div></div>) : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm leading-7 text-slate-300">Ask for a simpler explanation, exam tips, a formula walkthrough, or help from a reference image.</div>}</div><div className="rounded-[26px] border border-white/10 bg-slate-950/80 p-4"><div className="force-mobile-stack flex items-end gap-3"><label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200"><span className="text-xl">+</span><input ref={chatImageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { handleChatReferenceFilesChange(event.target.files); event.target.value = ""; }} /></label><textarea value={chatQuestion} onChange={(event) => setChatQuestion(event.target.value)} onKeyDown={handleStudyChatKeyDown} rows={1} className="min-h-[56px] flex-1 resize-none bg-transparent px-1 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500" placeholder="Type your message..." /><button type="button" onClick={askStudyAssistant} disabled={isAskingChat} className="flex h-12 w-12 items-center justify-center self-end rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] text-white disabled:opacity-50 sm:self-auto" aria-label="Send message"><svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" /></svg></button></div><div className="mt-3 flex flex-wrap items-center gap-2">{chatReferenceImages.length ? chatReferenceImages.map((item) => <span key={item.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{item.name}<button type="button" onClick={() => removeChatReferenceImage(item.id)} className="text-slate-400 transition hover:text-white">x</button></span>) : <span className="text-xs text-slate-400">Add screenshots, notes, or handwritten references if they help the question.</span>}{chatReferenceImages.length ? <button type="button" onClick={() => setChatReferenceImages([])} disabled={!chatReferenceImages.length || isAskingChat} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white disabled:opacity-50">Clear images</button> : null}</div></div></div> : null}
                {activeTab === "collaboration" ? <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]"><div className="space-y-5"><div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Create room</p><h3 className="mt-2 text-2xl font-semibold text-white">Invite your study group</h3><p className="mt-3 text-sm leading-7 text-slate-300">Create an email-based collaboration room from this lecture. Invited students will see the same room when they sign in with those emails.</p><div className="mt-5 space-y-4"><div><label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Room title</label><input value={roomTitleInput} onChange={(event) => setRoomTitleInput(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none" placeholder={`${extractHistoryTitle(summary, workspaceFileLabel)} group room`} /></div><div><label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Invite by email</label><textarea value={roomInviteInput} onChange={(event) => setRoomInviteInput(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none" placeholder="student1@email.com, student2@email.com" /></div><div><label className="block text-xs uppercase tracking-[0.24em] text-slate-400">Group test visibility</label><div className="mt-2 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setNewRoomVisibility("private")} className={`rounded-2xl border px-4 py-3 text-left text-sm ${newRoomVisibility === "private" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-slate-950/75 text-slate-200"}`}><p className="font-semibold">Private answers</p><p className="mt-2 text-xs leading-6 text-slate-300">Members cannot see what others are writing.</p></button><button type="button" onClick={() => setNewRoomVisibility("shared")} className={`rounded-2xl border px-4 py-3 text-left text-sm ${newRoomVisibility === "shared" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-slate-950/75 text-slate-200"}`}><p className="font-semibold">Shared answers</p><p className="mt-2 text-xs leading-6 text-slate-300">Members can compare typed answers inside the room.</p></button></div></div><button type="button" onClick={createCollaborationRoom} disabled={isCreatingRoom || (!summary && !transcript && !lectureNotes && !lectureSlides)} className="w-full rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isCreatingRoom ? "Creating room..." : "Create collaboration room"}</button></div></div><div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"><div className="force-mobile-stack flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Available rooms</p><h3 className="mt-2 text-xl font-semibold text-white">Your collaboration list</h3></div><button type="button" onClick={() => refreshCollaborationRooms()} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">Refresh</button></div><div className="mt-4 space-y-3">{collaborationRooms.length ? collaborationRooms.map((room) => <button key={room.id} type="button" onClick={async () => { setCurrentPage("workspace"); setActiveTab("collaboration"); await loadCollaborationRoom(room.id, { resetNotesDraft: true }); }} className={`w-full rounded-2xl border p-4 text-left transition ${activeRoomId === room.id ? "border-emerald-300/35 bg-emerald-300/10" : "border-white/10 bg-slate-950/75 hover:bg-white/10"}`}><p className="text-sm font-semibold text-white">{room.title}</p><p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{room.member_count} member{room.member_count === 1 ? "" : "s"} • {room.test_visibility}</p><p className="mt-2 text-xs text-slate-400">Updated {new Date(room.updated_at).toLocaleString()}</p></button>) : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm leading-7 text-slate-300">No collaboration rooms yet. Create the first one from the current lecture.</div>}</div></div></div><div className="space-y-5">{activeRoom ? <><div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Active room</p><h3 className="mt-2 text-3xl font-semibold text-white">{activeRoom.title}</h3><p className="mt-3 text-sm leading-7 text-slate-300">Shared tool: {roomToolLabel}. Room owner: {activeRoom.owner_email}.</p></div><div className="force-mobile-stack flex flex-wrap gap-3"><button type="button" onClick={syncCurrentTabToRoom} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50">Share current tool</button><button type="button" onClick={() => setFollowRoomView((current) => !current)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">{followRoomView ? "Following room view" : "Follow room view"}</button></div></div><div className="mt-5 flex flex-wrap gap-2">{(activeRoom.members || []).map((member) => <span key={member.email} className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs text-slate-200">{member.email} {member.role === "owner" ? "(owner)" : ""}</span>)}</div><div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/70 p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Shared revision pack</p><h4 className="mt-2 text-2xl font-semibold text-white">Guide, formulas, worked examples, flashcards, and test</h4><p className="mt-3 text-sm leading-7 text-slate-300">Choose a resource below to make it the room’s shared revision focus.</p></div><div className="flex flex-wrap gap-2">{[{ id: "guide", label: "Study Guide" }, { id: "formulas", label: "Formulas" }, { id: "examples", label: "Worked Examples" }, { id: "flashcards", label: "Flashcards" }, { id: "quiz", label: "Test" }].map((tab) => <button key={tab.id} type="button" onClick={async () => { setFollowRoomView(true); await shareTabToRoom(tab.id); }} className={`rounded-full px-4 py-2 text-sm ${activeRoom.active_tab === tab.id ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>{tab.label}</button>)}</div></div><div className="mt-4 whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm leading-7 text-slate-200">{buildCollaborationPreview(activeRoom) || "No shared content selected yet."}</div></div>{activeRoom.is_owner ? <div className="force-mobile-stack mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => changeRoomTestVisibility("private")} className={`rounded-full px-4 py-2 text-sm ${activeRoom.test_visibility === "private" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>Keep answers private</button><button type="button" onClick={() => changeRoomTestVisibility("shared")} className={`rounded-full px-4 py-2 text-sm ${activeRoom.test_visibility === "shared" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white"}`}>Share answers in room</button></div> : null}</div><div className="grid gap-5 xl:grid-cols-2"><div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5"><div className="force-mobile-stack flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Shared notes</p><h4 className="mt-2 text-2xl font-semibold text-white">Everyone sees the same notes board</h4></div><button type="button" onClick={saveRoomNotes} disabled={isSavingRoomNotes} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50 disabled:opacity-50">{isSavingRoomNotes ? "Saving..." : "Save shared notes"}</button></div><textarea value={roomSharedNotesDraft} onChange={(event) => setRoomSharedNotesDraft(event.target.value)} rows={12} className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100 outline-none" placeholder="Write group notes, exam reminders, common mistakes, or a plan for the test..." /></div><div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Room chat</p><h4 className="mt-2 text-2xl font-semibold text-white">Live discussion</h4></div>{isRoomLoading ? <span className="rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">Syncing</span> : null}</div><div className="mt-4 rounded-2xl border border-white/10 bg-slate-950 p-4">{(activeRoom.messages || []).length ? <div className="space-y-3">{activeRoom.messages.map((message) => <div key={message.id} className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">{message.author_email}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{message.content}</p></div>)}</div> : <p className="text-sm leading-7 text-slate-300">Room messages will appear here. Use this to coordinate who is revising which section.</p>}</div><div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/80 p-4"><div className="force-mobile-stack flex items-end gap-3"><textarea value={roomMessageDraft} onChange={(event) => setRoomMessageDraft(event.target.value)} onKeyDown={handleRoomChatKeyDown} rows={1} className="min-h-[56px] flex-1 resize-none bg-transparent px-1 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500" placeholder="Type your message..." /><button type="button" onClick={sendRoomMessage} disabled={isSendingRoomMessage} className="flex h-12 w-12 items-center justify-center self-end rounded-full bg-[linear-gradient(135deg,#166534,#22c55e)] text-white disabled:opacity-50 sm:self-auto" aria-label="Send room message"><svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" /></svg></button></div><p className="mt-3 text-xs text-slate-400">This room chat refreshes automatically.</p></div></div></div></> : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm leading-7 text-slate-300">Open a room from the list or create a new one to start shared notes, room chat, and group test settings.</div>}</div></div> : null}
              </div>
            </div>
          </div>
        </section> : null}

        {historyPanel}
      </main>
    </div>
  );
}
