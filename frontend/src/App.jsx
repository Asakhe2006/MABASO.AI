import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const JOB_POLL_INTERVAL_MS = 2000;
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
  { id: "quiz", label: "Quiz" },
  { id: "chat", label: "Study Chat" },
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

function quizToText(questions) {
  return (questions || []).map((item) => `${item.number}. ${item.question}\nAnswer: ${item.answer}`).join("\n\n");
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
    const studentAnswer = (answers[item.number] || "").trim();
    const lines = [
      `${item.number}. ${item.question}`,
      "",
      `Suggested Answer: ${item.answer || "No answer available."}`,
    ];
    if (studentAnswer) {
      lines.push("", `Student Answer: ${studentAnswer}`);
    }
    if (result) {
      lines.push("", `Marked Result: ${Number(result.score || 0) > 0 ? "Correct" : "Needs correction"}`);
      if (result.extracted_answer) lines.push(`Detected Answer: ${result.extracted_answer}`);
      if (result.feedback) lines.push(`Feedback: ${result.feedback}`);
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
  const [quizCount, setQuizCount] = useState(5);
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
  const fileInputRef = useRef(null);
  const lectureNotesFileInputRef = useRef(null);
  const lectureSlidesFileInputRef = useRef(null);
  const chatImageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const googleButtonRef = useRef(null);

  const loading = isTranscribing || isGeneratingSummary || isExtractingSlides;
  const hasTranscript = Boolean(transcript);
  const hasResults = Boolean(transcript || summary || formula || example);
  const selectedQuizQuestions = quizQuestions.slice(0, quizCount);
  const formattedGuide = normalizeRenderedMathText(prettifyMathText(summary));
  const formattedFormula = normalizeRenderedMathText(prettifyMathText(formula));
  const formattedExample = normalizeRenderedMathText(prettifyMathText(example));
  const formulaRows = parseFormulaRows(formattedFormula);
  const currentTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || "Study Guide";
  const activeHistoryItem = historyItems.find((item) => item.id === activeHistoryId) || null;
  const workspaceFileLabel = file?.name || activeHistoryItem?.fileName || "No lecture selected";

  const clearSession = (message = "Please sign in again.") => {
    setAuthToken("");
    setAuthEmail("");
    setCodeSent(false);
    setVerificationCode("");
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
        width: 320,
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

  const getActiveContent = () => {
    if (activeTab === "guide") return formattedGuide || "No study guide generated yet.";
    if (activeTab === "transcript") return transcript || "No transcript generated yet.";
    if (activeTab === "formulas") return formattedFormula || "No formulas generated yet.";
    if (activeTab === "examples") return formattedExample || "No worked examples generated yet.";
    if (activeTab === "flashcards") return flashcardsToText(flashcards) || "No flashcards generated yet.";
    if (activeTab === "quiz") return buildQuizExportText(selectedQuizQuestions, quizAnswers, quizResults) || "No quiz generated yet.";
    return chatToText(chatMessages) || "No study chat yet.";
  };

  const buildCurrentStudyPackSections = () => [
    { title: "Study Guide", content: formattedGuide || summary },
    { title: "Transcript", content: transcript },
    { title: "Formulas", content: formattedFormula || formula },
    { title: "Worked Examples", content: formattedExample || example },
    { title: "Flashcards", content: flashcardsToText(flashcards) },
    { title: "Quiz", content: quizToText(quizQuestions) },
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
      setStatus(job.used_fallback ? "Fallback study guide ready." : "Study guide ready.");
      setProgress(100);
      addHistoryItem({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        title: extractHistoryTitle(job.summary || "", file?.name || "Saved lecture"),
        fileName: file?.name || "Saved lecture",
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
      await exportPdf(currentTabLabel, [{ title: currentTabLabel, content: getActiveContent() }]);
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
    if (!selectedQuizQuestions.length) return setError("Generate quiz questions first.");
    try {
      const title = `${extractHistoryTitle(summary, file?.name || "MABASO Quiz")} quiz`;
      await exportPdf(title, [{ title: "Quiz", content: buildQuizExportText(selectedQuizQuestions, quizAnswers, quizResults) }]);
      setStatus("Quiz PDF downloaded.");
    } catch (err) {
      setError(err.message || "Could not create the quiz PDF.");
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
        { title: "Quiz", content: quizToText(item.quizQuestions || []) },
      ]);
      setStatus(`${item.title} PDF downloaded.`);
    } catch (err) {
      setError(err.message || "Could not create the history PDF.");
    }
  };

  const downloadHistoryQuizPdf = async (item) => {
    try {
      await exportPdf(`${item.title || item.fileName || "Saved lecture"} quiz`, [
        { title: "Quiz", content: buildQuizExportText(item.quizQuestions || []) },
      ]);
      setStatus(`${item.title} quiz PDF downloaded.`);
    } catch (err) {
      setError(err.message || "Could not create the quiz PDF.");
    }
  };

  const handleQuizAnswerChange = (questionNumber, value) => {
    setQuizAnswers((current) => ({ ...current, [questionNumber]: value }));
    setQuizSubmitted(false);
    setQuizResults((current) => {
      const next = { ...current };
      delete next[questionNumber];
      return next;
    });
  };

  const handleQuizImageChange = (questionNumber, selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) return setError("Please upload an image file for quiz answer marking.");
    setQuizAnswerImages((current) => ({ ...current, [questionNumber]: selectedFile }));
    setQuizSubmitted(false);
    setQuizResults((current) => {
      const next = { ...current };
      delete next[questionNumber];
      return next;
    });
    setStatus(`Answer photo added for question ${questionNumber}.`);
  };

  const markQuiz = async () => {
    if (!selectedQuizQuestions.length) return;
    setIsMarkingQuiz(true);
    setError("");
    setStatus("Marking quiz answers...");
    try {
      const nextResults = {};
      for (const item of selectedQuizQuestions) {
        const typedAnswer = quizAnswers[item.number] || "";
        const imageFile = quizAnswerImages[item.number];
        if (!typedAnswer.trim() && !imageFile) {
          nextResults[item.number] = { score: 0, extracted_answer: "", feedback: "No answer was submitted yet." };
          continue;
        }
        const formData = new FormData();
        formData.append("question", item.question);
        formData.append("expected_answer", item.answer);
        formData.append("student_answer", typedAnswer);
        if (imageFile) formData.append("answer_image", imageFile);
        const response = await authFetch("/mark-quiz-answer/", { method: "POST", body: formData });
        const data = await parseJsonSafe(response);
        if (!response.ok) throw new Error(data.detail || `Could not mark question ${item.number}.`);
        nextResults[item.number] = data;
      }
      setQuizResults(nextResults);
      setQuizSubmitted(true);
      setStatus("Quiz marked. Review the colored answers below.");
    } catch (err) {
      setError(err.message || "Quiz marking failed.");
      setStatus("Quiz marking failed.");
    } finally {
      setIsMarkingQuiz(false);
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
            <section className="rounded-[32px] border border-white/10 bg-slate-950/65 p-6 shadow-[0_30px_90px_rgba(2,8,23,0.45)] backdrop-blur xl:p-8">
              <div className="flex flex-wrap gap-2">
                {["Transcript", "Slides + Notes", "Email Login", "Study Chat", "AI Quiz Marking"].map((pill) => (
                  <span key={pill} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.26em] text-emerald-100">{pill}</span>
                ))}
              </div>
              <p className="brand-mark mt-6 text-3xl font-black sm:text-5xl">MABASO.AI</p>
              <h1 className="mt-4 text-5xl font-semibold leading-[0.96] tracking-[-0.04em] text-white sm:text-6xl">Secure lecture intelligence for students who want better notes, faster.</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Sign in with your email, upload a lecture, mix in notes or slides, then revise with study guides, formulas, quizzes, and follow-up AI chat in one workspace.</p>
            </section>
            <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,22,44,0.94),rgba(5,10,20,0.98))] p-6 shadow-[0_28px_80px_rgba(2,8,23,0.55)]">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Google Access</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Sign in with Google</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Use your Google account to open your study workspace quickly without email codes or passwords inside this app.
              </p>
              <div className="mt-8 space-y-5">
                {authEmailInput ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100">
                    Last used on this device: {authEmailInput}
                  </div>
                ) : null}
                <div ref={googleButtonRef} className="min-h-[44px]" />
                <div className="rounded-2xl border border-emerald-300/18 bg-emerald-300/8 px-4 py-4 text-sm leading-7 text-slate-200">
                  Record your lecture while teaching and get notes automatically. This device remembers the Google email you used and keeps you signed in until you sign out or the session expires.
                </div>
                {authMessage ? <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">{authMessage}</div> : null}
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
      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-slate-950/65 px-5 py-4 shadow-[0_24px_70px_rgba(2,8,23,0.35)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div><p className="brand-mark text-2xl font-black sm:text-4xl">MABASO.AI</p><p className="mt-2 text-sm text-slate-300">Record your lecture while teaching and get notes automatically.</p></div>
          <div className="flex flex-wrap items-center gap-3"><div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200">Signed in as {authEmail}</div><button type="button" onClick={logout} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">Sign Out</button></div>
        </header>

        <section className="mb-8 rounded-[32px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_30px_80px_rgba(8,15,30,0.45)] backdrop-blur xl:p-8">
          <div className="grid gap-8 xl:grid-cols-[1fr_0.95fr]">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-100">MABASO.AI Workspace</div>
              <h1 className="text-5xl font-semibold leading-[0.96] tracking-[-0.04em] text-white sm:text-6xl">Choose the study help you need next.</h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">Transcribe your lecture, bring in notes or slides when you want them, then revise, test yourself, or ask MABASO with a reference image.</p>
              <div className="grid gap-3 sm:grid-cols-3">{[
                { title: "Study Guide", text: "Keep revision notes, formulas, and worked examples together." },
                { title: "Quiz Zone", text: "Mark typed or photo answers with tolerant AI checking." },
                { title: "Study Chat", text: "Ask follow-up questions with text or image references." },
              ].map((item) => <div key={item.title} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4"><p className="text-xs uppercase tracking-[0.24em] text-emerald-100/70">{item.title}</p><p className="mt-3 text-sm leading-7 text-slate-200">{item.text}</p></div>)}</div>
            </div>

            <aside className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,28,65,0.92),rgba(8,14,30,0.96))] p-5 shadow-[0_20px_60px_rgba(2,8,23,0.55)]">
              <div onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); setDragActive(false); handleFileChange(event.dataTransfer.files?.[0]); }} className={`rounded-[24px] border border-dashed p-5 transition ${dragActive ? "border-emerald-300 bg-emerald-300/10" : "border-white/15 bg-white/[0.03]"}`}>
                <div className="space-y-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#22c55e,#166534)] text-2xl font-black text-white">M</div>
                  <div><h2 className="text-2xl font-semibold text-white">Build your lecture workspace</h2><p className="mt-2 text-sm leading-6 text-slate-300">Add the lecture first, attach extra material only when you need it, and start transcription below.</p></div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">Choose Lecture File</button>
                    <button type="button" onClick={recording ? stopRecording : startRecording} disabled={loading} className={`rounded-full px-5 py-3 text-sm font-semibold ${recording ? "bg-rose-500 text-white" : "bg-emerald-400/15 text-emerald-100"} disabled:opacity-60`}>{recording ? "Stop Recording" : "Record Live Lecture"}</button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => lectureNotesFileInputRef.current?.click()} disabled={loading} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Upload Notes</button>
                    <button type="button" onClick={() => lectureSlidesFileInputRef.current?.click()} disabled={loading} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm font-semibold text-emerald-50 disabled:opacity-50">Upload Slides</button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={upload} disabled={loading || !file} className="rounded-full bg-[linear-gradient(135deg,#2563eb,#7c3aed)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isTranscribing ? "Transcribing..." : isGeneratingSummary ? "Generating..." : "Transcribe Lecture"}</button>
                    <button type="button" onClick={() => generateStudyGuide(transcript)} disabled={loading || !hasTranscript} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm font-semibold text-emerald-50 disabled:opacity-50">{isGeneratingSummary ? "Generating Guide..." : "Generate Study Guide"}</button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="audio/*,video/*" className="hidden" onChange={(event) => handleFileChange(event.target.files?.[0])} />
                  <input ref={lectureNotesFileInputRef} type="file" accept=".txt,.md,.text" className="hidden" onChange={(event) => handleLectureNotesFileChange(event.target.files?.[0])} />
                  <input ref={lectureSlidesFileInputRef} type="file" accept="image/*,.txt,.md,.text,.pdf,.pptx" multiple className="hidden" onChange={(event) => handleLectureSlidesFilesChange(event.target.files)} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Lecture Notes</p><p className="mt-3 text-sm font-semibold text-white">{lectureNotesFileName || (lectureNotes.trim() ? "Notes added" : "No notes added yet")}</p><p className="mt-3 text-sm leading-7 text-slate-300">Use the Upload Notes button when you want lecturer material blended into the study guide.</p></div>
                <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Lecture Slides</p><p className="mt-3 text-sm font-semibold text-white">{lectureSlideFileNames.length ? `${lectureSlideFileNames.length} source${lectureSlideFileNames.length === 1 ? "" : "s"} added` : "No slides added yet"}</p></div><button type="button" onClick={() => lectureSlidesFileInputRef.current?.click()} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-emerald-50 disabled:opacity-50"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20 text-base font-bold text-emerald-100">+</span><span>Add PDF / PPTX</span></button></div>{lectureSlideFileNames.length ? <div className="mt-4 flex flex-wrap gap-2">{lectureSlideFileNames.slice(0, 4).map((name) => <span key={name} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-200">{name}</span>)}{lectureSlideFileNames.length > 4 ? <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-200">+{lectureSlideFileNames.length - 4} more</span> : null}</div> : <p className="mt-3 text-sm leading-7 text-slate-300">Upload slide images, PDF slides, or PowerPoint files only when you want them included.</p>}</div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Selected File", value: workspaceFileLabel }, { label: "Size", value: file ? formatBytes(file.size) : activeHistoryItem ? "Saved workspace" : "Waiting" }, { label: "Status", value: isMarkingQuiz ? "Marking quiz" : isAskingChat ? "Answering" : loading ? currentJobType === "study_guide" ? "Generating notes" : currentJobType === "slides" ? "Reading slides" : "Transcribing" : hasResults ? "Ready" : "Waiting" }, { label: "Signed In", value: authEmail || "Not signed in" }].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{item.label}</p><p className="mt-3 text-sm font-semibold text-white">{item.value}</p></div>)}</div>

              <div className="mt-5 min-h-[150px] rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-white">{status || "Ready for your next lecture."}</p><p className="mt-2 text-sm leading-7 text-slate-300">{currentJobType === "study_guide" ? "MABASO is building your notes from the lecture context." : currentJobType === "slides" ? "MABASO is reading slide material." : loading ? "MABASO is preparing and transcribing your lecture in stages for better accuracy." : "Upload a lecture, then revise it from one stable workspace."}</p></div><div className="rounded-full border border-white/10 bg-slate-950 px-3 py-2 text-xs font-semibold text-emerald-100">{Math.round(progress)}%</div></div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"><div className="progress-bar h-full rounded-full bg-[linear-gradient(90deg,#22c55e,#10b981,#4ade80)] transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>
                {usedFallbackSummary ? <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">MABASO returned a fallback study guide instead of leaving the lecture blank.</div> : null}
                {error ? <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"><p className="font-semibold">Processing failed</p><p className="mt-2">{error}</p><p className="mt-2 text-rose-100/80">{getErrorHint(error)}</p></div> : null}
              </div>
            </aside>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_24px_80px_rgba(2,8,23,0.35)] backdrop-blur xl:p-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Study Workspace</p><h2 className="mt-2 text-3xl font-semibold text-white">Choose what you want to work on next.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Open your guide, revisit formulas, test yourself, or ask MABASO with a photo reference.</p></div>
            <div className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-full px-4 py-2 text-sm transition ${activeTab === tab.id ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"}`}>{tab.label}</button>)}</div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
            <aside className="space-y-4 xl:sticky xl:top-6">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workspace Snapshot</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">Lecture file: {workspaceFileLabel}</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">Lecture notes: {lectureNotes.trim() ? lectureNotesFileName || "Added" : "Not added"}</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">Slide sources: {lectureSlideFileNames.length || 0}</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">Quiz questions: {quizQuestions.length || 0}</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">Saved workspaces: {historyItems.length}</div>
                </div>
              </div>
            </aside>

            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div><p className="text-xs uppercase tracking-[0.28em] text-slate-400">Current View</p><h3 className="mt-2 text-2xl font-semibold text-white">{currentTabLabel}</h3></div>
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.25em] text-slate-300">{hasResults ? "Generated" : "Awaiting lecture"}</div>
              </div>
              <div className="mb-4 flex flex-wrap gap-3">
                <button type="button" onClick={copyActiveContent} disabled={!hasResults && activeTab !== "chat"} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50">Copy Current Section</button>
                <button type="button" onClick={downloadActiveContent} disabled={!hasResults && activeTab !== "chat"} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50 disabled:opacity-50">Download Section PDF</button>
                <button type="button" onClick={downloadFullStudyPackPdf} disabled={!hasResults} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50">Download Full PDF</button>
                {activeTab === "quiz" ? <button type="button" onClick={downloadQuizPdf} disabled={!selectedQuizQuestions.length} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50 disabled:opacity-50">Download Quiz PDF</button> : null}
              </div>

              <div className={`content-panel min-h-[520px] rounded-[24px] border border-white/10 p-5 ${activeTab === "guide" ? "bg-black" : "bg-slate-950/70"}`}>
                {activeTab === "guide" ? <div className="notes-markdown rounded-2xl bg-black prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-strong:text-emerald-100 prose-li:text-slate-200"><ReactMarkdown>{formattedGuide || "Your study guide will appear here after generation."}</ReactMarkdown></div> : null}
                {activeTab === "transcript" ? <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{transcript || "The lecture transcript will appear here after transcription."}</div> : null}
                {activeTab === "examples" ? <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{formattedExample || "Worked examples will appear here after study guide generation."}</div> : null}
                {activeTab === "formulas" ? (formulaRows.length ? <div className="overflow-hidden rounded-2xl border border-white/10"><div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] bg-emerald-300/10 text-sm font-semibold text-emerald-50"><div className="border-r border-white/10 px-4 py-3">Expression</div><div className="px-4 py-3">Readable Result</div></div>{formulaRows.map((row, index) => <div key={`${row.expression}-${index}`} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] border-t border-white/10 text-sm"><div className="border-r border-white/10 px-4 py-3 font-semibold text-white">{row.expression}</div><div className="px-4 py-3 font-mono text-slate-200">{row.result}</div></div>)}</div> : <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{formattedFormula || "Detected formulas will appear here after study guide generation."}</div>) : null}
                {activeTab === "flashcards" ? <div className="grid gap-4 md:grid-cols-2">{flashcards.length ? flashcards.map((card, index) => <div key={`${card.question}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Flashcard {index + 1}</p><p className="mt-3 font-semibold text-white">{card.question}</p><p className="mt-4 text-sm leading-7 text-slate-300">{card.answer}</p></div>) : <div className="text-sm text-slate-300">Flashcards will appear here after study guide generation.</div>}</div> : null}
                {activeTab === "quiz" ? <div><div className="mb-5 flex flex-wrap items-center gap-3"><label className="text-sm text-slate-300" htmlFor="quiz-count">Number of questions</label><select id="quiz-count" value={quizCount} onChange={(event) => { setQuizCount(Number(event.target.value)); setQuizAnswers({}); setQuizAnswerImages({}); setQuizResults({}); setQuizSubmitted(false); }} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">{[3, 5, 10].map((count) => <option key={count} value={count}>{count}</option>)}</select><button type="button" onClick={markQuiz} disabled={!selectedQuizQuestions.length || isMarkingQuiz} className="rounded-full bg-[linear-gradient(135deg,#2563eb,#7c3aed)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isMarkingQuiz ? "Marking..." : "Mark Quiz"}</button>{quizSubmitted ? <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">Score: {score} / {selectedQuizQuestions.length}</div> : null}</div><div className="space-y-4">{selectedQuizQuestions.length ? selectedQuizQuestions.map((item) => { const result = quizResults[item.number]; const isCorrect = Number(result?.score || 0) > 0; const answerTone = !quizSubmitted ? "border-white/10 bg-slate-900" : isCorrect ? "border-emerald-400/35 bg-emerald-500/10" : "border-rose-400/35 bg-rose-500/10"; return <div key={item.number} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="font-semibold text-white">{item.number}. {item.question}</p><textarea value={quizAnswers[item.number] || ""} onChange={(event) => handleQuizAnswerChange(item.number, event.target.value)} rows={4} className={`mt-3 w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 outline-none ${answerTone}`} placeholder="Type your answer here..." /><div className="mt-3 flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/20 text-lg font-semibold text-emerald-100">+</span><span>Upload answer photo</span><input type="file" accept="image/*" className="hidden" onChange={(event) => handleQuizImageChange(item.number, event.target.files?.[0])} /></label>{quizAnswerImages[item.number] ? <span className="text-xs text-emerald-100/80">{quizAnswerImages[item.number].name}</span> : null}</div>{quizSubmitted && result ? <div className="mt-4 space-y-3"><div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Suggested Answer</p><p className="mt-2 text-sm leading-7 text-slate-300">{item.answer}</p></div><div className={`rounded-2xl border p-3 ${isCorrect ? "border-emerald-300/25 bg-emerald-300/10" : "border-rose-300/25 bg-rose-500/10"}`}><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.24em] text-slate-200">Marked Result</p><span className={`rounded-full px-3 py-1 text-xs font-semibold ${isCorrect ? "bg-emerald-950 text-emerald-100" : "bg-rose-950 text-rose-100"}`}>{isCorrect ? "Correct" : "Needs correction"}</span></div>{result.extracted_answer ? <p className="mt-3 text-sm leading-7 text-slate-100">Detected answer: {result.extracted_answer}</p> : null}<p className="mt-2 text-sm leading-7 text-slate-200">{result.feedback}</p></div></div> : null}</div>; }) : <div className="text-sm text-slate-300">Quiz questions will appear here after study guide generation.</div>}</div></div> : null}
                {activeTab === "chat" ? <div className="flex h-full min-h-[440px] flex-col"><div className="mb-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-7 text-slate-300">Ask MABASO about the lecture and attach a photo of a slide, handwritten working, or question when you want visual reference.</div><div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4">{chatMessages.length ? chatMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === "assistant" ? "bg-emerald-300/10 text-slate-100" : "ml-auto bg-white/10 text-white"}`}><p className="mb-2 text-xs uppercase tracking-[0.24em] text-emerald-100/70">{message.role === "assistant" ? "MABASO" : "Student"}</p><div className="whitespace-pre-wrap">{message.content}</div></div>) : <div className="flex h-full min-h-[280px] items-center justify-center text-center text-sm text-slate-400">Ask your first question after generating a transcript or study guide.</div>}</div><div className="mt-4 space-y-3"><textarea value={chatQuestion} onChange={(event) => setChatQuestion(event.target.value)} rows={3} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none" placeholder="Ask something like: Explain the main formula again in a simpler way." /><div className="flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/20 text-lg font-semibold text-emerald-100">+</span><span>Add reference image</span><input ref={chatImageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { handleChatReferenceFilesChange(event.target.files); event.target.value = ""; }} /></label>{chatReferenceImages.map((item) => <span key={item.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{item.name}<button type="button" onClick={() => removeChatReferenceImage(item.id)} className="text-slate-400 transition hover:text-white">x</button></span>)}</div><div className="flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setChatReferenceImages([])} disabled={!chatReferenceImages.length || isAskingChat} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white disabled:opacity-50">Clear images</button><button type="button" onClick={askStudyAssistant} disabled={isAskingChat} className="rounded-2xl bg-[linear-gradient(135deg,#2563eb,#7c3aed)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isAskingChat ? "Answering..." : "Ask MABASO"}</button></div></div></div> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_20px_70px_rgba(2,8,23,0.28)] backdrop-blur xl:p-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">History</p><h2 className="mt-2 text-3xl font-semibold text-white">Saved workspaces on this device.</h2></div>
            <div className="flex flex-wrap gap-3"><div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200">{historyItems.length} saved item{historyItems.length === 1 ? "" : "s"}</div><button type="button" onClick={() => { setHistoryItems([]); setActiveHistoryId(""); setStatus("History cleared."); }} disabled={!historyItems.length} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50">Clear History</button></div>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">{historyItems.length ? historyItems.map((item) => <article key={item.id} className={`rounded-[24px] border p-5 transition ${activeHistoryId === item.id ? "border-emerald-300/35 bg-emerald-300/10" : "border-white/10 bg-white/[0.04]"}`}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">{new Date(item.createdAt).toLocaleString()}</p><h3 className="mt-3 text-xl font-semibold text-white">{item.title}</h3><p className="mt-2 text-sm text-slate-300">{item.fileName || "Saved lecture"}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-200">{item.quizQuestions?.length || 0} quiz question{item.quizQuestions?.length === 1 ? "" : "s"}</span><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-200">{item.lectureNotes?.trim() ? "Notes added" : "No notes"}</span><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-200">{item.lectureSlideFileNames?.length || 0} slide source{(item.lectureSlideFileNames?.length || 0) === 1 ? "" : "s"}</span></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => loadHistoryItem(item)} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">Open</button><button type="button" onClick={() => downloadHistoryItemPdf(item)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">Study Pack PDF</button><button type="button" onClick={() => downloadHistoryQuizPdf(item)} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-50">Quiz PDF</button><button type="button" onClick={() => { setHistoryItems((current) => current.filter((entry) => entry.id !== item.id)); if (activeHistoryId === item.id) setActiveHistoryId(""); }} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">Remove</button></div></div><p className="mt-4 max-h-[8.2rem] overflow-hidden text-sm leading-7 text-slate-300">{(item.summary || "Saved study guide content will appear here.").replace(/\*\*/g, "")}</p></article>) : <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-slate-300 lg:col-span-2">Your saved workspace history will appear here after the first successful study guide.</div>}</div>
        </section>
      </main>
    </div>
  );
}
