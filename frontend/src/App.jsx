import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const JOB_POLL_INTERVAL_MS = 2000;
const HISTORY_STORAGE_KEY = "mabaso-history-v1";
const MAX_HISTORY_ITEMS = 6;

const featurePills = ["Transcript", "Slides + Notes", "Flashcards", "AI Quiz Marking"];

const highlights = [
  {
    title: "Lecture To Revision Kit",
    description: "Turn raw audio plus notes or slides into summaries, worked examples, formulas, and fast exam prep notes.",
  },
  {
    title: "Built For Long Sessions",
    description: "Record or upload full lectures, then let MABASO shape the content into clean study material.",
  },
  {
    title: "Revision That Feels Personal",
    description: "Get content organized for student-friendly review instead of scrolling through one giant transcript.",
  },
];

const trustNotes = [
  "Supports audio and video lecture uploads",
  "Can combine lecturer notes or slide content with the transcript",
  "Real backend progress is shown while processing",
  "Study notes are generated after transcription with fallback protection",
];

const howItWorks = [
  "Upload or record a lecture session.",
  "Optionally add lecturer notes or slide images so MABASO can combine them with the recording.",
  "MABASO transcribes the lecture and reports real progress from the backend.",
  "The study guide and quiz are then generated from the transcript plus any added notes or slide content.",
];

const tabs = [
  { id: "guide", label: "Study Guide" },
  { id: "transcript", label: "Transcript" },
  { id: "formulas", label: "Formulas" },
  { id: "examples", label: "Worked Examples" },
  { id: "flashcards", label: "Flashcards" },
  { id: "quiz", label: "Quiz" },
];

function loadHistoryItems() {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractHistoryTitle(summary, fallbackName) {
  const lines = (summary || "")
    .split("\n")
    .map((line) => line.replace(/\*\*/g, "").trim())
    .filter(Boolean);

  const lectureTitleIndex = lines.findIndex((line) => line.toUpperCase() === "LECTURE TITLE");
  if (lectureTitleIndex >= 0 && lines[lectureTitleIndex + 1]) {
    return lines[lectureTitleIndex + 1];
  }

  return fallbackName || "Untitled lecture";
}

function formatHistoryDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function sanitizeFileName(value) {
  return (value || "mabaso-study-pack")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function flashcardsToText(flashcards) {
  return (flashcards || [])
    .map((card, index) => `Flashcard ${index + 1}\nQ: ${card.question}\nA: ${card.answer}`)
    .join("\n\n");
}

function quizToText(quizQuestions) {
  return (quizQuestions || [])
    .map((item) => `${item.number}. ${item.question}\nAnswer: ${item.answer}`)
    .join("\n\n");
}

function buildPdfMarkup(title, sections) {
  const sectionMarkup = sections
    .filter((section) => section.content)
    .map(
      (section) => `
        <section style="margin-top: 20px;">
          <h2 style="margin: 0 0 10px; font-size: 18px; color: #0f172a;">${escapeHtml(section.title)}</h2>
          <div style="white-space: pre-wrap; font-size: 12px; line-height: 1.75; color: #1f2937;">${escapeHtml(section.content)}</div>
        </section>
      `,
    )
    .join("");

  return `
    <div style="padding: 28px; background: #ffffff; color: #111827; font-family: Helvetica, Arial, sans-serif;">
      <h1 style="margin: 0 0 16px; font-size: 24px; color: #0f172a;">${escapeHtml(title)}</h1>
      ${sectionMarkup}
    </div>
  `;
}

async function downloadPdfDocument(fileName, title, sections) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=980,height=900");
  if (!printWindow) {
    throw new Error("Popup blocked");
  }

  const safeFileName = `${sanitizeFileName(fileName)}.pdf`;
  const markup = buildPdfMarkup(title, sections);

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(safeFileName)}</title>
        <style>
          body {
            margin: 0;
            background: #f3f4f6;
          }

          @media print {
            body {
              background: #ffffff;
            }
          }
        </style>
      </head>
      <body>${markup}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onafterprint = () => {
    printWindow.close();
  };

  window.setTimeout(() => {
    printWindow.print();
  }, 300);
}

function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${mb.toFixed(1)} MB`;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getErrorHint(message) {
  const text = (message || "").toLowerCase();
  if (text.includes("openai_api_key")) {
    return "Add your OpenAI API key to the backend environment before deploying or running the server.";
  }
  if (text.includes("ffmpeg")) {
    return "ffmpeg is required for large audio or video files. Make sure it is installed and available in PATH on the server.";
  }
  if (text.includes("pypdf")) {
    return "PDF slide support needs the pypdf package installed on the backend server. Install backend requirements before deploying.";
  }
  if (text.includes("timed out")) {
    return "Large files can still time out. Try a shorter file, stronger server resources, or a smaller audio bitrate.";
  }
  if (text.includes("status 5")) {
    return "This looks like an upstream OpenAI problem. Retry the request or let the fallback path handle the summary step.";
  }
  return "Check the backend terminal logs for the exact failing stage before deploying.";
}

function parseFormulaRows(formulaText) {
  return formulaText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^- /, "").trim())
    .map((line) => {
      if (line.includes("->")) {
        const [expression, result] = line.split("->");
        return { expression: expression.trim(), result: result.trim() };
      }
      if (line.includes("=")) {
        const [expression, ...rest] = line.split("=");
        return { expression: expression.trim(), result: rest.join("=").trim() };
      }
      return null;
    })
    .filter(Boolean);
}

function prettifyMathText(value) {
  if (!value) return "";

  const superscriptMap = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
    "+": "⁺",
    "-": "⁻",
    "=": "⁼",
    "(": "⁽",
    ")": "⁾",
    a: "ᵃ",
    b: "ᵇ",
    c: "ᶜ",
    d: "ᵈ",
    e: "ᵉ",
    f: "ᶠ",
    g: "ᵍ",
    h: "ʰ",
    i: "ⁱ",
    j: "ʲ",
    k: "ᵏ",
    l: "ˡ",
    m: "ᵐ",
    n: "ⁿ",
    o: "ᵒ",
    p: "ᵖ",
    r: "ʳ",
    s: "ˢ",
    t: "ᵗ",
    u: "ᵘ",
    v: "ᵛ",
    w: "ʷ",
    x: "ˣ",
    y: "ʸ",
    z: "ᶻ",
    A: "ᴬ",
    B: "ᴮ",
    D: "ᴰ",
    E: "ᴱ",
    G: "ᴳ",
    H: "ᴴ",
    I: "ᴵ",
    J: "ᴶ",
    K: "ᴷ",
    L: "ᴸ",
    M: "ᴹ",
    N: "ᴺ",
    O: "ᴼ",
    P: "ᴾ",
    R: "ᴿ",
    T: "ᵀ",
    U: "ᵁ",
    V: "ⱽ",
    W: "ᵂ",
    " ": " ",
  };

  const subscriptMap = {
    "0": "₀",
    "1": "₁",
    "2": "₂",
    "3": "₃",
    "4": "₄",
    "5": "₅",
    "6": "₆",
    "7": "₇",
    "8": "₈",
    "9": "₉",
    "+": "₊",
    "-": "₋",
    "=": "₌",
    "(": "₍",
    ")": "₎",
    a: "ₐ",
    e: "ₑ",
    h: "ₕ",
    i: "ᵢ",
    j: "ⱼ",
    k: "ₖ",
    l: "ₗ",
    m: "ₘ",
    n: "ₙ",
    o: "ₒ",
    p: "ₚ",
    r: "ᵣ",
    s: "ₛ",
    t: "ₜ",
    u: "ᵤ",
    v: "ᵥ",
    x: "ₓ",
    " ": " ",
  };

  const toSuper = (chunk) =>
    Array.from(chunk || "")
      .map((char) => superscriptMap[char] || char)
      .join("");

  const toSub = (chunk) =>
    Array.from(chunk || "")
      .map((char) => subscriptMap[char] || char)
      .join("");

  return value
    .replace(/\bintegral from 0 to infinity\b/gi, `∫${toSub("0")}∞`)
    .replace(/\bintegral from a to infinity\b/gi, `∫${toSub("a")}∞`)
    .replace(/\bpi\b/gi, "π")
    .replace(/\btheta\b/gi, "θ")
    .replace(/\bomega\b/gi, "ω")
    .replace(/\blambda\b/gi, "λ")
    .replace(/>=/g, "≥")
    .replace(/<=/g, "≤")
    .replace(/!=/g, "≠")
    .replace(/\^(\(([^)]+)\)|\{([^}]+)\}|([A-Za-z0-9+\- ]+))/g, (_, __, groupA, groupB, groupC) =>
      toSuper(groupA || groupB || groupC || ""),
    )
    .replace(/_(\(([^)]+)\)|\{([^}]+)\}|([A-Za-z0-9+\- ]+))/g, (_, __, groupA, groupB, groupC) =>
      toSub(groupA || groupB || groupC || ""),
    );
}

function normalizeAnswerText(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default function App() {
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
  const [activeTab, setActiveTab] = useState("guide");
  const [dragActive, setDragActive] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isExtractingSlides, setIsExtractingSlides] = useState(false);
  const [usedFallbackSummary, setUsedFallbackSummary] = useState(false);
  const [currentJobType, setCurrentJobType] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizAnswerImages, setQuizAnswerImages] = useState({});
  const [quizResults, setQuizResults] = useState({});
  const [isMarkingQuiz, setIsMarkingQuiz] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [historyItems, setHistoryItems] = useState(loadHistoryItems);
  const [activeHistoryId, setActiveHistoryId] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const lectureNotesFileInputRef = useRef(null);
  const lectureSlidesFileInputRef = useRef(null);

  const loading = isTranscribing || isGeneratingSummary || isExtractingSlides;
  const hasTranscript = Boolean(transcript);
  const hasResults = Boolean(transcript || summary || formula || example);
  const selectedQuizQuestions = quizQuestions.slice(0, quizCount);
  const formattedGuide = prettifyMathText(summary);
  const formattedFormula = prettifyMathText(formula);
  const formattedExample = prettifyMathText(example);
  const formulaRows = parseFormulaRows(formattedFormula);

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyItems));
    } catch {
      // Ignore storage errors so the app still works normally.
    }
  }, [historyItems]);

  const tabContent = {
    guide: formattedGuide || "Your study guide will appear here after generation.",
    transcript: transcript || "The lecture transcript will appear here after transcription.",
    formulas: formattedFormula || "Detected formulas will appear here after study guide generation.",
    examples: formattedExample || "Worked examples will appear here after study guide generation.",
    flashcards: flashcards.length
      ? flashcards.map((card, index) => `Flashcard ${index + 1}\nQ: ${card.question}\nA: ${card.answer}`).join("\n\n")
      : "Flashcards will appear here after study guide generation.",
    quiz: selectedQuizQuestions.length
      ? selectedQuizQuestions.map((item) => `${item.number}. ${item.question}\nAnswer: ${item.answer}`).join("\n\n")
      : "Quiz questions will appear here after study guide generation.",
  };

  const buildCurrentStudyPackSections = () => [
    { title: "Study Guide", content: tabContent.guide },
    { title: "Transcript", content: tabContent.transcript },
    { title: "Formulas", content: tabContent.formulas },
    { title: "Worked Examples", content: tabContent.examples },
    { title: "Flashcards", content: flashcardsToText(flashcards) },
    { title: "Quiz", content: quizToText(quizQuestions) },
  ];

  const addHistoryItem = (nextItem) => {
    setHistoryItems((current) => [nextItem, ...current].slice(0, MAX_HISTORY_ITEMS));
    setActiveHistoryId(nextItem.id);
  };

  const loadHistoryItem = (item) => {
    setSummary(item.summary || "");
    setTranscript(item.transcript || "");
    setFormula(item.formula || "");
    setExample(item.example || "");
    setFlashcards(item.flashcards || []);
    setQuizQuestions(item.quizQuestions || []);
    setQuizAnswers({});
    setQuizAnswerImages({});
    setQuizResults({});
    setQuizSubmitted(false);
    setActiveHistoryId(item.id);
    setActiveTab("guide");
    setStatus(`Loaded ${item.title} from history.`);
  };

  const removeHistoryItem = (historyId) => {
    setHistoryItems((current) => current.filter((item) => item.id !== historyId));
    if (activeHistoryId === historyId) {
      setActiveHistoryId("");
    }
  };

  const clearHistory = () => {
    setHistoryItems([]);
    setActiveHistoryId("");
    setStatus("History cleared.");
  };

  const stats = useMemo(
    () => [
      { label: "Selected File", value: file ? file.name : "No file selected" },
      { label: "Size", value: file ? formatBytes(file.size) : "Waiting" },
      {
        label: "Status",
        value: isMarkingQuiz
          ? "Marking quiz"
          : loading
            ? currentJobType === "study_guide"
              ? "Generating summary"
              : currentJobType === "slides"
                ? "Reading slides"
                : "Transcribing"
            : hasResults
              ? "Ready"
              : "Waiting to upload",
      },
    ],
    [currentJobType, file, hasResults, isMarkingQuiz, loading],
  );

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError("");
  };

  const handleLectureNotesFileChange = async (selectedFile) => {
    if (!selectedFile) return;
    try {
      const text = await selectedFile.text();
      setLectureNotes(text);
      setLectureNotesFileName(selectedFile.name);
      setStatus("Lecture notes added. They will be combined with the transcript.");
    } catch {
      setError("Could not read the lecture notes file. Use a text-based notes file or paste the notes.");
    }
  };

  const handleLectureSlidesFilesChange = async (selectedFiles) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return;

    setIsExtractingSlides(true);
    setError("");
    setCurrentJobType("slides");
    setStatus(files.length === 1 ? `Reading slide source: ${files[0].name}` : "Reading lecture slide sources...");
    setProgress(15);

    try {
      const extractedParts = [];
      const addedFileNames = [];

      for (const [index, selectedFile] of files.entries()) {
        const progressValue = Math.min(90, 15 + Math.round(((index + 1) / files.length) * 70));
        setStatus(`Reading slide source ${index + 1} of ${files.length}: ${selectedFile.name}`);
        setProgress(progressValue);
        const isTextFile =
          selectedFile.type.startsWith("text/") || /\.(txt|md|text)$/i.test(selectedFile.name || "");

        if (isTextFile) {
          const text = await selectedFile.text();
          if (text.trim()) {
            extractedParts.push(`SLIDE SOURCE: ${selectedFile.name}\n${text.trim()}`);
            addedFileNames.push(selectedFile.name);
          }
          continue;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);

        const response = await fetch(`${API_BASE_URL}/extract-slide-text/`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || `Could not read ${selectedFile.name}.`);
        }

        if (data.text?.trim()) {
          extractedParts.push(`SLIDE SOURCE: ${selectedFile.name}\n${data.text.trim()}`);
          addedFileNames.push(selectedFile.name);
        }
      }

      if (!extractedParts.length) {
        throw new Error("No slide text could be extracted from the selected files.");
      }

      setLectureSlides((current) => [current.trim(), extractedParts.join("\n\n")].filter(Boolean).join("\n\n"));
      setLectureSlideFileNames((current) => Array.from(new Set([...current, ...addedFileNames])));
      setStatus(
        `${addedFileNames.length} slide source${addedFileNames.length === 1 ? "" : "s"} added. MABASO will use them with the recording.`,
      );
      setProgress(100);
    } catch (err) {
      setError(err.message || "Could not process the selected slide files.");
      setStatus("Slide reading failed.");
    } finally {
      setIsExtractingSlides(false);
      setCurrentJobType("");
      setProgress(0);
    }
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
        const audioFile = new File([blob], "mabaso-lecture.wav", { type: "audio/wav" });
        setFile(audioFile);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch {
      setError("Microphone access failed. Please allow recording permissions.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const pollJob = async (jobId, jobType) => {
    while (true) {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not fetch job status.");
      }

      setCurrentJobType(jobType);
      setStatus(data.stage || "Processing...");
      setProgress(Number(data.progress || 0));

      if (data.status === "failed") {
        throw new Error(data.error || `${jobType} failed.`);
      }

      if (data.status === "completed") {
        return data;
      }

      await wait(JOB_POLL_INTERVAL_MS);
    }
  };

  const generateStudyGuide = async (transcriptText) => {
    if (!transcriptText.trim()) {
      setError("Transcript is empty, so a study guide cannot be generated.");
      return;
    }

    setIsGeneratingSummary(true);
    setError("");
    setUsedFallbackSummary(false);
    setCurrentJobType("study_guide");
    setStatus("Submitting study guide request...");
    setProgress(0);

    try {
      const response = await fetch(`${API_BASE_URL}/generate-study-guide/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: transcriptText,
          lecture_notes: lectureNotes,
          lecture_slides: lectureSlides,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Study guide generation failed.");
      }

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
    if (!file) {
      setError("Upload or record a file first.");
      return;
    }

    setIsTranscribing(true);
    setError("");
    setStatus("Submitting lecture for transcription...");
    setProgress(0);
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
    setUsedFallbackSummary(false);
    setActiveTab("transcript");
    setCurrentJobType("transcription");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/upload-audio/`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Upload failed.");
      }

      const job = await pollJob(data.job_id, "transcription");
      setTranscript(job.transcript || "");
      setStatus("Transcript ready. Generating study guide...");
      setProgress(100);
      await generateStudyGuide(job.transcript || "");
    } catch (err) {
      setError(err.message || "Something went wrong while transcribing the lecture.");
      setStatus("Transcription failed");
    } finally {
      setIsTranscribing(false);
      setCurrentJobType("");
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const droppedFile = event.dataTransfer.files?.[0];
    handleFileChange(droppedFile);
  };

  const copyActiveContent = async () => {
    try {
      await navigator.clipboard.writeText(tabContent[activeTab]);
      setStatus("Current section copied to clipboard.");
    } catch {
      setError("Copy failed. Your browser may be blocking clipboard access.");
    }
  };

  const downloadActiveContent = async () => {
    try {
      const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label || "Study Section";
      await downloadPdfDocument(`mabaso-${activeTab}`, activeLabel, [
        {
          title: activeLabel,
          content: tabContent[activeTab],
        },
      ]);
      setStatus(`${activeLabel} PDF view opened. Save it from the print dialog.`);
    } catch {
      setError("PDF download failed. Please try again.");
    }
  };

  const downloadFullStudyPackPdf = async () => {
    try {
      const title = extractHistoryTitle(summary, file?.name || "MABASO Study Pack");
      await downloadPdfDocument(title, title, buildCurrentStudyPackSections());
      setStatus("Full study pack PDF view opened. Save it from the print dialog.");
    } catch {
      setError("Could not create the full study pack PDF.");
    }
  };

  const downloadHistoryItemPdf = async (item) => {
    try {
      await downloadPdfDocument(item.title || item.fileName || "mabaso-history-item", item.title || "MABASO History Item", [
        { title: "Study Guide", content: item.summary },
        { title: "Transcript", content: item.transcript },
        { title: "Formulas", content: item.formula },
        { title: "Worked Examples", content: item.example },
        { title: "Flashcards", content: flashcardsToText(item.flashcards) },
        { title: "Quiz", content: quizToText(item.quizQuestions) },
      ]);
      setStatus(`Opened ${item.title} for PDF saving.`);
    } catch {
      setError("Could not create the history PDF.");
    }
  };

  const handleQuizAnswerChange = (questionNumber, value) => {
    setQuizAnswers((current) => ({
      ...current,
      [questionNumber]: value,
    }));
    setQuizSubmitted(false);
    setQuizResults({});
  };

  const handleQuizImageChange = (questionNumber, selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      setError("Please upload an image file for quiz answer marking.");
      return;
    }
    setQuizAnswerImages((current) => ({
      ...current,
      [questionNumber]: selectedFile,
    }));
    setQuizSubmitted(false);
    setQuizResults({});
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

        if (imageFile) {
          const formData = new FormData();
          formData.append("question", item.question);
          formData.append("expected_answer", item.answer);
          formData.append("student_answer", typedAnswer);
          formData.append("answer_image", imageFile);

          const response = await fetch(`${API_BASE_URL}/mark-quiz-answer/`, {
            method: "POST",
            body: formData,
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.detail || `Could not mark question ${item.number}.`);
          }

          nextResults[item.number] = data;
          continue;
        }

        const studentAnswer = normalizeAnswerText(typedAnswer);
        const expectedAnswer = normalizeAnswerText(item.answer);
        const isCorrect = Boolean(studentAnswer) && studentAnswer === expectedAnswer;

        nextResults[item.number] = {
          score: isCorrect ? 1 : 0,
          extracted_answer: typedAnswer.trim(),
          feedback: typedAnswer.trim()
            ? isCorrect
              ? "Matched against the suggested answer."
              : "The typed answer did not match the suggested answer closely enough."
            : "No answer was submitted yet.",
        };
      }

      setQuizResults(nextResults);
      setQuizSubmitted(true);
      setStatus("Quiz marked. Review your score and feedback below.");
    } catch (err) {
      setError(err.message || "Quiz marking failed.");
      setStatus("Quiz marking failed.");
    } finally {
      setIsMarkingQuiz(false);
    }
  };

  const score = selectedQuizQuestions.reduce((total, item) => total + Number(quizResults[item.number]?.score || 0), 0);

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-glow hero-glow-left" />
        <div className="hero-glow hero-glow-right" />
        <div className="hero-grid" />
      </div>

      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-8 rounded-[32px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_30px_80px_rgba(8,15,30,0.45)] backdrop-blur xl:p-8">
          <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {featurePills.map((pill) => (
                  <span
                    key={pill}
                    className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.26em] text-emerald-100"
                  >
                    {pill}
                  </span>
                ))}
              </div>

              <div className="max-w-3xl">
                <p className="brand-mark mb-4 text-3xl font-black sm:text-5xl">MABASO.AI</p>
                <h1 className="max-w-2xl text-5xl font-semibold leading-[0.94] tracking-[-0.04em] text-white sm:text-6xl xl:text-7xl">
                  Lecture intelligence that turns class recordings into beautiful revision material.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                  MABASO helps students transform lectures into a sharper study workspace with transcripts,
                  concept summaries, formulas, worked examples, and exam-focused notes in one place.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {highlights.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  >
                    <h2 className="text-lg font-semibold text-white">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                  </article>
                ))}
              </div>

              <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                {trustNotes.map((note) => (
                  <div key={note} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            <aside className="relative rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,28,65,0.92),rgba(8,14,30,0.96))] p-5 shadow-[0_20px_60px_rgba(2,8,23,0.55)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Studio</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Upload Your Lecture</h2>
                </div>
                <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-emerald-100">
                  {loading ? "Live" : "Ready"}
                </div>
              </div>

              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`rounded-[24px] border border-dashed p-5 transition ${
                  dragActive
                    ? "border-emerald-300 bg-emerald-300/10"
                    : "border-white/15 bg-white/[0.03]"
                }`}
              >
                <div className="space-y-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#22c55e,#166534)] text-2xl font-black text-white shadow-lg shadow-emerald-900/30">
                    M
                  </div>
                  <div>
                    <h3 className="text-xl font-medium text-white">Drag in a lecture file</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Drop an audio or video file here, or browse from your device. MABASO transcribes first,
                      then builds your study guide from the saved transcript.
                    </p>
                    <p className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-50">
                      Record your lecture while teaching and get notes automatically.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Choose Lecture File
                    </button>
                    <button
                      type="button"
                      onClick={recording ? stopRecording : startRecording}
                      disabled={loading}
                      className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                        recording
                          ? "bg-rose-500 text-white hover:bg-rose-400"
                          : "bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {recording ? "Stop Recording" : "Record Live Lecture"}
                    </button>
                    <button
                      type="button"
                      onClick={upload}
                      disabled={loading || !file}
                      className="rounded-full bg-[linear-gradient(135deg,#2563eb,#7c3aed)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isTranscribing ? "Transcribing..." : isGeneratingSummary ? "Generating..." : "Transcribe Lecture"}
                    </button>
                    <button
                      type="button"
                      onClick={() => generateStudyGuide(transcript)}
                      disabled={loading || !hasTranscript}
                      className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isGeneratingSummary ? "Generating Guide..." : "Generate Study Guide"}
                    </button>
                    <button
                      type="button"
                      onClick={() => lectureNotesFileInputRef.current?.click()}
                      disabled={loading}
                      className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Upload Lecture Notes
                    </button>
                    <button
                      type="button"
                      onClick={() => lectureSlidesFileInputRef.current?.click()}
                      disabled={loading}
                      className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Upload Slides
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/*"
                    className="hidden"
                    onChange={(event) => handleFileChange(event.target.files?.[0])}
                  />
                  <input
                    ref={lectureNotesFileInputRef}
                    type="file"
                    accept=".txt,.md,.text"
                    className="hidden"
                    onChange={(event) => handleLectureNotesFileChange(event.target.files?.[0])}
                  />
                  <input
                    ref={lectureSlidesFileInputRef}
                    type="file"
                    accept="image/*,.txt,.md,.text,.pdf,.pptx"
                    multiple
                    className="hidden"
                    onChange={(event) => handleLectureSlidesFilesChange(event.target.files)}
                  />

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Optional Lecturer Notes</p>
                        {lectureNotesFileName && (
                          <span className="text-xs text-emerald-100">{lectureNotesFileName}</span>
                        )}
                      </div>
                      <textarea
                        value={lectureNotes}
                        onChange={(event) => setLectureNotes(event.target.value)}
                        rows={5}
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none"
                        placeholder="Paste lecture notes here or upload a text notes file. MABASO will combine these notes with the transcript when generating the study guide."
                      />
                    </div>

                    <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Optional Lecture Slides</p>
                          {lectureSlideFileNames.length ? (
                            <span className="mt-2 inline-block text-xs text-emerald-100">
                              {lectureSlideFileNames.length} sources added
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => lectureSlidesFileInputRef.current?.click()}
                          disabled={loading}
                          title="Add slide image, PDF, or PowerPoint file"
                          className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-300/12 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20 text-base font-bold text-emerald-100">
                            +
                          </span>
                          <span>Add PDF / PPTX</span>
                        </button>
                      </div>
                      {lectureSlideFileNames.length ? (
                        <p className="mt-3 text-xs leading-6 text-emerald-100/80">{lectureSlideFileNames.join(", ")}</p>
                      ) : null}
                      <textarea
                        value={lectureSlides}
                        onChange={(event) => setLectureSlides(event.target.value)}
                        rows={5}
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none"
                        placeholder="Paste slide text here, or upload slide images, PDF slides, or PowerPoint (.pptx) files above. MABASO will use the slide content with the recording to build stronger formulas, examples, and quiz questions."
                      />
                      <p className="mt-3 text-xs leading-6 text-emerald-100/75">
                        Use the <span className="font-semibold text-emerald-50">+</span> button above to add slide images, PDF slides, or PowerPoint files.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {stats.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{item.label}</p>
                    <p className="mt-3 line-clamp-2 text-sm font-medium text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              {file && (
                <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-4 text-sm text-emerald-50">
                  <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">Selected Lecture</p>
                  <p className="mt-2 break-all text-base font-medium">{file.name}</p>
                </div>
              )}

              {loading && (
                <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">{status}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {currentJobType === "study_guide"
                          ? "Your transcript is ready. MABASO is now turning it into revision notes."
                          : currentJobType === "slides"
                            ? "MABASO is reading your slide sources so they can strengthen the guide and quiz."
                            : "MABASO is preparing and transcribing your lecture in stages for better accuracy."}
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 px-3 py-2 text-sm text-emerald-100">
                      {`${progress}%`}
                    </div>
                  </div>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="progress-bar h-full rounded-full bg-[linear-gradient(90deg,#22c55e,#4ade80,#166534)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {usedFallbackSummary && (
                <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
                  The main study-guide request was slow or unavailable, so MABASO generated a fallback study guide from your transcript.
                </div>
              )}

              {error && (
                <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                  <p className="font-semibold text-rose-50">Processing failed</p>
                  <p className="mt-2">{error}</p>
                  <p className="mt-3 text-xs text-rose-100/80">{getErrorHint(error)}</p>
                </div>
              )}
            </aside>
          </div>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-white/10 bg-slate-950/60 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">How It Works</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">A cleaner flow from lecture to revision.</h2>
            <div className="mt-6 grid gap-4">
              {howItWorks.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-300/10 text-sm font-semibold text-emerald-100">
                    0{index + 1}
                  </div>
                  <p className="text-sm leading-7 text-slate-300">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(12,20,40,0.92),rgba(29,78,216,0.22))] p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.28em] text-fuchsia-200/70">Why Students Use It</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">More signal, less lecture clutter.</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Best For</p>
                <p className="mt-3 text-lg font-medium text-white">
                  Students revising long lectures, concept-heavy classes, and exam-focused modules.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Outcome</p>
                <p className="mt-3 text-lg font-medium text-white">
                  Clear notes, extractable formulas, flashcard-ready content, and faster study sessions.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_24px_80px_rgba(2,8,23,0.35)] backdrop-blur xl:p-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Study Workspace</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Review your lecture in a calmer, smarter format.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Switch between transcript, formulas, worked examples, and the generated guide without losing the context of your lecture.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    activeTab === tab.id
                      ? "bg-white text-slate-950"
                      : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[0.32fr_0.68fr]">
            <aside className="space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workspace Focus</p>
                <h3 className="mt-3 text-xl font-semibold text-white">
                  {tabs.find((tab) => tab.id === activeTab)?.label}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {activeTab === "guide" &&
                    "Use this panel for quick revision, short summaries, and structured exam-prep notes."}
                  {activeTab === "transcript" &&
                    "Use the transcript when you need the original lecture context or want to search for missing details."}
                  {activeTab === "formulas" &&
                    "Keep the formulas section open while revising numerically heavy topics or derivations."}
                  {activeTab === "examples" &&
                    "Worked examples help bridge theory and application when the lecture becomes abstract."}
                  {activeTab === "flashcards" &&
                    "Use flashcards for active recall and quick revision after reading the study guide."}
                  {activeTab === "quiz" &&
                    "Pick how many questions you want, answer them, and let MABASO score your quiz instantly."}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(15,23,42,0.28))] p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-100/70">Quick Tips</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-200">
                  <li>Transcribe first for large files so you preserve the lecture text before generating notes.</li>
                  <li>Use the study guide tab for quick revision and the transcript tab for the original context.</li>
                  <li>Use Generate Study Guide again if you want to rerun the summary from the saved transcript.</li>
                  <li>Use flashcards for recall practice and the quiz tab to test yourself with marks.</li>
                </ul>
              </div>
            </aside>

            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Current View</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">
                    {tabs.find((tab) => tab.id === activeTab)?.label}
                  </h3>
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.25em] text-slate-300">
                  {hasResults ? "Generated" : "Awaiting lecture"}
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={copyActiveContent}
                  disabled={!hasResults}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copy Current Section
                </button>
                <button
                  type="button"
                  onClick={downloadActiveContent}
                  disabled={!hasResults}
                  className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download Section PDF
                </button>
                <button
                  type="button"
                  onClick={downloadFullStudyPackPdf}
                  disabled={!hasResults}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download Full PDF
                </button>
              </div>

              <div
                className={`content-panel min-h-[420px] rounded-[24px] border border-white/10 p-5 ${
                  activeTab === "guide" ? "bg-black" : "bg-slate-950/70"
                }`}
              >
                {activeTab === "guide" ? (
                  <div className="notes-markdown rounded-2xl bg-black prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-strong:text-emerald-100 prose-li:text-slate-200">
                    <ReactMarkdown>{tabContent.guide}</ReactMarkdown>
                  </div>
                ) : activeTab === "formulas" ? (
                  formulaRows.length ? (
                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] bg-emerald-300/10 text-sm font-semibold text-emerald-50">
                        <div className="border-r border-white/10 px-4 py-3">Expression</div>
                        <div className="px-4 py-3">Readable Result</div>
                      </div>
                      {formulaRows.map((row, index) => (
                        <div
                          key={`${row.expression}-${index}`}
                          className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] border-t border-white/10 text-sm"
                        >
                          <div className="border-r border-white/10 px-4 py-3 font-semibold text-white">
                            {row.expression}
                          </div>
                          <div className="px-4 py-3 text-slate-200">{row.result}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                      {tabContent.formulas}
                    </div>
                  )
                ) : activeTab === "flashcards" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {flashcards.length ? (
                      flashcards.map((card, index) => (
                        <div key={`${card.question}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Flashcard {index + 1}</p>
                          <p className="mt-3 font-semibold text-white">{card.question}</p>
                          <p className="mt-3 text-sm leading-7 text-slate-300">{card.answer}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-300">Flashcards will appear here after study guide generation.</div>
                    )}
                  </div>
                ) : activeTab === "quiz" ? (
                  <div>
                    <div className="mb-5 flex flex-wrap items-center gap-3">
                      <label className="text-sm text-slate-300" htmlFor="quiz-count">
                        Number of questions
                      </label>
                      <select
                        id="quiz-count"
                        value={quizCount}
                        onChange={(event) => {
                          setQuizCount(Number(event.target.value));
                          setQuizAnswers({});
                          setQuizAnswerImages({});
                          setQuizResults({});
                          setQuizSubmitted(false);
                        }}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                      >
                        {[3, 5, 10].map((count) => (
                          <option key={count} value={count}>
                            {count}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={markQuiz}
                        disabled={!selectedQuizQuestions.length || isMarkingQuiz}
                        className="rounded-full bg-[linear-gradient(135deg,#2563eb,#7c3aed)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {isMarkingQuiz ? "Marking..." : "Mark Quiz"}
                      </button>
                      {quizSubmitted && (
                        <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
                          Score: {score} / {selectedQuizQuestions.length}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {selectedQuizQuestions.length ? (
                        selectedQuizQuestions.map((item) => (
                          <div key={item.number} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                            <p className="font-semibold text-white">
                              {item.number}. {item.question}
                            </p>
                            <textarea
                              value={quizAnswers[item.number] || ""}
                              onChange={(event) => handleQuizAnswerChange(item.number, event.target.value)}
                              rows={4}
                              className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none"
                              placeholder="Type your answer here..."
                            />
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50 transition hover:bg-emerald-300/15">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/20 text-lg font-semibold text-emerald-100">
                                  +
                                </span>
                                <span>Upload answer photo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(event) => handleQuizImageChange(item.number, event.target.files?.[0])}
                                />
                              </label>
                              {quizAnswerImages[item.number] && (
                                <span className="text-xs text-emerald-100/80">{quizAnswerImages[item.number].name}</span>
                              )}
                            </div>
                            {quizSubmitted && (
                              <div className="mt-3 space-y-3">
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Suggested Answer</p>
                                  <p className="mt-2 text-sm leading-7 text-slate-300">{item.answer}</p>
                                </div>
                                {quizResults[item.number] && (
                                  <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Marked Result</p>
                                      <span className="rounded-full border border-emerald-300/20 bg-black/20 px-3 py-1 text-xs text-emerald-50">
                                        Score: {quizResults[item.number].score ? "1 / 1" : "0 / 1"}
                                      </span>
                                    </div>
                                    {quizResults[item.number].extracted_answer && (
                                      <p className="mt-3 text-sm leading-7 text-emerald-50">
                                        Detected answer: {quizResults[item.number].extracted_answer}
                                      </p>
                                    )}
                                    <p className="mt-2 text-sm leading-7 text-slate-200">{quizResults[item.number].feedback}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-300">Quiz questions will appear here after study guide generation.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                    {tabContent[activeTab]}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_20px_70px_rgba(2,8,23,0.28)] backdrop-blur xl:p-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">History</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Everything MABASO generated for this browser.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Reopen previous study guides, return to older lectures, or download a saved item as PDF without generating it again.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200">
                {historyItems.length} saved item{historyItems.length === 1 ? "" : "s"}
              </div>
              <button
                type="button"
                onClick={clearHistory}
                disabled={!historyItems.length}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear History
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {historyItems.length ? (
              historyItems.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-[24px] border p-5 transition ${
                    activeHistoryId === item.id
                      ? "border-emerald-300/35 bg-emerald-300/10"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">{formatHistoryDate(item.createdAt)}</p>
                      <h3 className="mt-3 text-xl font-semibold text-white">{item.title}</h3>
                      <p className="mt-2 text-sm text-slate-300">{item.fileName || "Saved lecture"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadHistoryItem(item)}
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:scale-[1.01]"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadHistoryItemPdf(item)}
                        className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/15"
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => removeHistoryItem(item.id)}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="mt-4 max-h-[8.2rem] overflow-hidden text-sm leading-7 text-slate-300">
                    {(item.summary || "Saved study guide content will appear here.").replace(/\*\*/g, "")}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-slate-300 lg:col-span-2">
                Your generated history will appear here after the first successful study guide. Each saved item can be reopened or exported as PDF.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
