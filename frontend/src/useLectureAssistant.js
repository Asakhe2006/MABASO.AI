import { useEffect, useMemo, useRef, useState } from "react";

const ASSISTANT_STORAGE_PREFIX = "mabaso-lecture-assistant-v1";
const ASSISTANT_THEME_STORAGE_KEY = "mabaso-lecture-assistant-theme";
const ASSISTANT_TTS_STORAGE_KEY = "mabaso-lecture-assistant-tts";
const MAX_SAVED_CONVERSATIONS = 24;
const LECTURE_ASSISTANT_VOICE_OUTPUT_LANGUAGE = "English";
const LECTURE_ASSISTANT_VOICE_TRANSCRIPTION_LANGUAGE = "en";
const LECTURE_ASSISTANT_VOICE_RECOGNITION_LOCALES = ["en-US", "en-GB"];
const LECTURE_ASSISTANT_VOICE_PRIMARY_LOCALE = LECTURE_ASSISTANT_VOICE_RECOGNITION_LOCALES[0];
const VOICE_CHAT_RESTART_DELAY_MS = 1100;
const VOICE_CHAT_NETWORK_RETRY_DELAY_MS = 1800;
const VOICE_CHAT_MAX_NETWORK_RETRIES = 3;
const VOICE_CHAT_INITIAL_IDLE_TIMEOUT_MS = 15000;
const VOICE_CHAT_SILENCE_TIMEOUT_MS = 3200;
const VOICE_CHAT_NO_SPEECH_RETRY_DELAY_MS = 650;
const VOICE_CHAT_MAX_NO_SPEECH_RETRIES = 3;
const VOICE_REPLY_CHUNK_PAUSE_MS = 120;
const VOICE_STREAM_MIN_CHARS = 75;
const VOICE_STREAM_MAX_CHARS = 170;
const VOICE_CHAT_UNEXPECTED_END_RETRY_DELAY_MS = 900;
const VOICE_CHAT_MAX_UNEXPECTED_END_RETRIES = 3;
const VOICE_TRANSCRIPTION_DEBOUNCE_MS = 600;
const VOICE_TRANSCRIPTION_MIN_CHUNKS = 1;
const VOICE_TRANSCRIPTION_SILENCE_THRESHOLD = 0.014;
const VOICE_TRANSCRIPTION_ACTIVITY_THRESHOLD = 0.028;
const VOICE_VAD_MIN_SPEECH_MS = 700;
const VOICE_VAD_MIN_ACTIVE_FRAMES = 4;
const VOICE_VAD_MIN_SILENCE_FRAMES = 8;
const VOICE_VAD_MIN_TRANSCRIPT_CHARS = 6;
const VOICE_VAD_MIN_NOISE_FLOOR = 0.004;
const VOICE_VAD_NOISE_FLOOR_SMOOTHING = 0.1;
const VOICE_VAD_RMS_MULTIPLIER = 2.4;
const VOICE_VAD_PEAK_MULTIPLIER = 1.9;
const VOICE_FAST_FINALIZE_WITH_PUNCTUATION_MS = 900;
const VOICE_FAST_FINALIZE_WITH_CONFIDENCE_MS = 1250;
const VOICE_DEFAULT_POST_SPEECH_SILENCE_MS = 1700;
const VOICE_MIN_CONFIDENT_TRANSCRIPT_CHARS = 28;
const RECORDING_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
];

function compactText(value = "", fallback = "") {
  const text = String(value || "").replace(/\u0000/g, " ").trim();
  return text || fallback;
}

function createClientId(prefix = "assistant") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmailForStorage(email = "") {
  return compactText(email, "guest").toLowerCase();
}

function buildConversationStorageKey(email = "") {
  return `${ASSISTANT_STORAGE_PREFIX}:${normalizeEmailForStorage(email)}`;
}

function deriveConversationTitle(question = "", lectureLabel = "") {
  const cleaned = compactText(question) || compactText(lectureLabel) || "New lecture chat";
  return cleaned.length > 56 ? `${cleaned.slice(0, 53).trim()}...` : cleaned;
}

function resolveLectureAssistantVoiceRecognitionLocales() {
  return [...LECTURE_ASSISTANT_VOICE_RECOGNITION_LOCALES];
}

function resolveSpeechRecognitionLocales(language = "English") {
  const normalized = compactText(language, "English").toLowerCase();
  const locales = [];
  const pushLocale = (locale) => {
    const normalizedLocale = compactText(locale);
    if (normalizedLocale && !locales.includes(normalizedLocale)) {
      locales.push(normalizedLocale);
    }
  };

  if (normalized === "isizulu") {
    pushLocale("zu-ZA");
    pushLocale("en-ZA");
    pushLocale("en-US");
    return locales;
  }
  if (normalized === "afrikaans") {
    pushLocale("af-ZA");
    pushLocale("en-ZA");
    pushLocale("en-US");
    return locales;
  }
  if (normalized === "isixhosa") {
    pushLocale("xh-ZA");
    pushLocale("en-ZA");
    pushLocale("en-US");
    return locales;
  }
  if (normalized === "sesotho") {
    pushLocale("st-ZA");
    pushLocale("en-ZA");
    pushLocale("en-US");
    return locales;
  }
  if (normalized === "setswana") {
    pushLocale("tn-ZA");
    pushLocale("en-ZA");
    pushLocale("en-US");
    return locales;
  }
  if (normalized === "french") {
    pushLocale("fr-FR");
    pushLocale("en-ZA");
    pushLocale("en-US");
    return locales;
  }
  if (normalized === "portuguese") {
    pushLocale("pt-PT");
    pushLocale("en-ZA");
    pushLocale("en-US");
    return locales;
  }

  pushLocale("en-ZA");
  pushLocale("en-GB");
  pushLocale("en-US");
  return locales;
}

function resolveSpeechLocale(language = "English") {
  return resolveSpeechRecognitionLocales(language)[0] || "en-ZA";
}

function resolveSpeechLanguageCode(language = "English") {
  const normalized = compactText(language, "English").toLowerCase();
  if (normalized === "isizulu") return "zu";
  if (normalized === "afrikaans") return "af";
  if (normalized === "isixhosa") return "xh";
  if (normalized === "sesotho") return "st";
  if (normalized === "setswana") return "tn";
  if (normalized === "french") return "fr";
  if (normalized === "portuguese") return "pt";
  return "en";
}

function formatProviderLabel(provider = "") {
  const normalized = compactText(provider).toLowerCase();
  return {
    openai: "OpenAI",
    gemini: "Gemini 2.5 Flash",
    groq: "Groq Llama",
    openrouter: "OpenRouter DeepSeek",
  }[normalized] || "Lecture Assistant";
}

function getSpeechRecognitionErrorMessage(errorCode = "") {
  const normalized = compactText(errorCode).toLowerCase();
  if (normalized === "no-speech") return "No speech was detected. Try again and speak a little closer to the microphone.";
  if (normalized === "audio-capture") return "No working microphone was found. Check your browser microphone device.";
  if (normalized === "not-allowed" || normalized === "service-not-allowed") {
    return "Microphone permission was blocked. Allow microphone access for this site and try again.";
  }
  if (normalized === "network") return "Browser microphone transcription lost its connection. The AI models are still available, so tap the mic again in Chrome or Edge.";
  if (normalized === "aborted") return "Voice chat was stopped before speech was captured.";
  if (normalized === "language-not-supported") return "This browser does not support the lecture assistant's English speech mode.";
  return "Voice input had a browser error. You can type your question instead.";
}

function getSupportedRecordingMimeType() {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") return "";
  if (typeof window.MediaRecorder.isTypeSupported !== "function") return "";
  return RECORDING_MIME_CANDIDATES.find((type) => window.MediaRecorder.isTypeSupported(type)) || "";
}

function getRecordingFileExtension(mimeType = "") {
  const normalized = compactText(mimeType).toLowerCase();
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("mp4") || normalized.includes("aac") || normalized.includes("m4a")) return "m4a";
  return "webm";
}

function getMicrophoneAccessErrorMessage(error) {
  const message = compactText(error?.message);
  if (error?.name === "NotAllowedError" || /permission|denied|not allowed/i.test(message)) {
    return "Microphone permission was denied. Allow microphone access for this site and try again.";
  }
  if (error?.name === "NotFoundError" || /not found|device/i.test(message)) {
    return "No working microphone was found. Check your browser microphone device.";
  }
  if (error?.name === "NotReadableError" || /notreadable|hardware|track start|in use/i.test(message)) {
    return "The browser could not open your microphone. Close other apps using the mic and try again.";
  }
  return "The browser could not start microphone capture for voice chat.";
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeVoiceTranscript(value = "", { preserveCase = true } = {}) {
  let cleaned = String(value || "").replace(/\u0000/g, " ");
  cleaned = cleaned
    .replace(/\b(uh|um|erm|hmm|mm+|ah|eh)\b/gi, " ")
    .replace(/(\b\w+\b)(\s+\1\b){2,}/gi, "$1")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
  if (!preserveCase) cleaned = cleaned.toLowerCase();
  return cleaned;
}

function estimateTranscriptConfidence(transcript = "", previewTranscript = "") {
  const cleaned = normalizeVoiceTranscript(transcript);
  if (!cleaned) return 0;
  let score = 0.52;
  const preview = normalizeVoiceTranscript(previewTranscript, { preserveCase: false });
  const normalized = cleaned.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 4) score += 0.1;
  if (cleaned.length >= VOICE_MIN_CONFIDENT_TRANSCRIPT_CHARS) score += 0.12;
  if (/[.?!]$/.test(cleaned)) score += 0.08;
  if (/(\b\w+\b)(\s+\1\b)/i.test(normalized)) score -= 0.12;
  if (/\b(uh|um|erm|hmm)\b/i.test(transcript)) score -= 0.08;
  if (preview) {
    const previewWords = new Set(preview.split(/\s+/).filter(Boolean));
    const overlapCount = words.filter((word) => previewWords.has(word)).length;
    if (words.length > 0) {
      score += clampNumber(overlapCount / words.length, 0, 0.18);
    }
  }
  return clampNumber(score, 0, 0.98);
}

function buildSpeechFriendlyText(value = "") {
  let text = String(value || "");
  if (!text.trim()) return "";
  text = text
    .replace(/```[\s\S]*?```/g, " Code example shown in the chat. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\$\$?([^$]+)\$\$?/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\|/g, ", ")
    .replace(/\b(?:#{1,6}|[-*+])\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(/\b([A-Z]{2,})\b/g, (match) => {
    if (match.length <= 4) return match.split("").join(" ");
    return match;
  });
  return text;
}

function chooseAcknowledgementPrefix(question = "") {
  const normalized = normalizeVoiceTranscript(question, { preserveCase: false });
  if (!normalized) return "";
  if (normalized.startsWith("why") || normalized.startsWith("how")) return "Right, ";
  if (normalized.includes("can you") || normalized.includes("could you")) return "Okay, ";
  if (normalized.includes("i don't understand") || normalized.includes("im confused") || normalized.includes("i am confused")) {
    return "I see, ";
  }
  return "";
}

function resolveAdaptiveVoicePauseMs({ transcript = "", previewTranscript = "", speechDetected = false } = {}) {
  if (!speechDetected) return VOICE_CHAT_INITIAL_IDLE_TIMEOUT_MS;
  const cleaned = normalizeVoiceTranscript(transcript);
  const confidence = estimateTranscriptConfidence(cleaned, previewTranscript);
  if (/[.?!]["']?$/.test(cleaned) && cleaned.length >= VOICE_MIN_CONFIDENT_TRANSCRIPT_CHARS) {
    return VOICE_FAST_FINALIZE_WITH_PUNCTUATION_MS;
  }
  if (confidence >= 0.74 && cleaned.length >= VOICE_MIN_CONFIDENT_TRANSCRIPT_CHARS) {
    return VOICE_FAST_FINALIZE_WITH_CONFIDENCE_MS;
  }
  return VOICE_DEFAULT_POST_SPEECH_SILENCE_MS;
}

function isEnglishSpeechSynthesisVoice(voice) {
  return compactText(voice?.lang).toLowerCase().startsWith("en");
}

function pickSpeechSynthesisVoice(locale = "", voices = [], { englishOnly = false } = {}) {
  const voicePool = englishOnly ? voices.filter((voice) => isEnglishSpeechSynthesisVoice(voice)) : voices;
  if (!Array.isArray(voicePool) || !voicePool.length) return englishOnly ? pickSpeechSynthesisVoice(locale, voices) : null;
  const normalizedLocale = compactText(locale).toLowerCase();
  if (!normalizedLocale) return voicePool[0] || null;
  const languageCode = normalizedLocale.split("-")[0];
  return (
    voicePool.find((voice) => /natural|neural|aria|samantha|serena|google uk english female|microsoft david|microsoft ava/i.test(compactText(voice?.name)))
    || voicePool.find((voice) => compactText(voice?.lang).toLowerCase() === normalizedLocale && /natural|neural|google|microsoft/i.test(compactText(voice?.name)))
    || voicePool.find((voice) => compactText(voice?.lang).toLowerCase().startsWith(`${languageCode}-`) && /natural|neural|google|microsoft/i.test(compactText(voice?.name)))
    || voicePool.find((voice) => compactText(voice?.lang).toLowerCase() === normalizedLocale)
    || voicePool.find((voice) => compactText(voice?.lang).toLowerCase().startsWith(`${languageCode}-`))
    || voicePool.find((voice) => compactText(voice?.lang).toLowerCase() === languageCode)
    || voicePool[0]
    || null
  );
}

function buildLectureAssistantVoiceTranscriptionPrompt({ lectureLabel = "", partialTranscript = "" } = {}) {
  return compactText(
    [
      "English only transcription.",
      "The student is asking a lecture question in English.",
      "Do not auto-detect another language.",
      "Do not translate or answer the question.",
      compactText(lectureLabel) ? `Lecture label: ${compactText(lectureLabel).slice(0, 100)}.` : "",
      compactText(partialTranscript) ? `Existing partial English transcript: ${compactText(partialTranscript).slice(-180)}.` : "",
    ].filter(Boolean).join(" "),
  );
}

function buildSpeechChunks(text = "", maxChars = 320) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];
  const chunks = [];
  let buffer = "";

  for (const sentence of sentences) {
    const nextSentence = sentence.trim();
    if (!nextSentence) continue;
    if (!buffer) {
      buffer = nextSentence;
      continue;
    }
    if (`${buffer} ${nextSentence}`.length <= maxChars) {
      buffer = `${buffer} ${nextSentence}`;
      continue;
    }
    chunks.push(buffer);
    buffer = nextSentence;
  }

  if (buffer) chunks.push(buffer);
  return chunks;
}

function extractReadySpeechChunks(buffer = "", { flush = false } = {}) {
  let remaining = String(buffer || "").replace(/\s+/g, " ").trim();
  const ready = [];

  while (remaining) {
    const punctuationMatch = remaining.match(/^([\s\S]*?[.!?](?=\s|$))/);
    if (punctuationMatch?.[1]) {
      ready.push(punctuationMatch[1].trim());
      remaining = remaining.slice(punctuationMatch[1].length).trimStart();
      continue;
    }

    if (remaining.length >= VOICE_STREAM_MAX_CHARS) {
      const candidate = remaining.slice(0, VOICE_STREAM_MAX_CHARS);
      const splitIndex = Math.max(
        candidate.lastIndexOf(". "),
        candidate.lastIndexOf("? "),
        candidate.lastIndexOf("! "),
        candidate.lastIndexOf(", "),
        candidate.lastIndexOf("; "),
        candidate.lastIndexOf(": "),
        candidate.lastIndexOf(" "),
      );
      const boundary = splitIndex >= VOICE_STREAM_MIN_CHARS ? splitIndex + 1 : VOICE_STREAM_MAX_CHARS;
      ready.push(candidate.slice(0, boundary).trim());
      remaining = remaining.slice(boundary).trimStart();
      continue;
    }

    if (flush && remaining) {
      ready.push(remaining.trim());
      remaining = "";
    }
    break;
  }

  return { ready, remaining };
}

function createConversationRecord({ contextKey = "", lectureLabel = "", title = "New lecture chat" } = {}) {
  const timestamp = nowIso();
  return {
    id: createClientId("conversation"),
    title,
    lectureLabel: compactText(lectureLabel),
    contextKey: compactText(contextKey),
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
  };
}

function createConversationMessage(role, content = "", extra = {}) {
  return {
    id: createClientId(role),
    role: compactText(role, "assistant"),
    content: String(content || ""),
    timestamp: nowIso(),
    provider: compactText(extra.provider),
    model: compactText(extra.model),
    interactionMode: compactText(extra.interactionMode, role === "user" ? "text" : ""),
    status: compactText(extra.status, "complete"),
  };
}

function sortConversations(conversations = []) {
  return [...conversations]
    .sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime())
    .slice(0, MAX_SAVED_CONVERSATIONS);
}

function normalizeConversationRecord(rawConversation, index = 0) {
  if (!rawConversation || typeof rawConversation !== "object") return null;
  const id = compactText(rawConversation.id, createClientId(`conversation-${index}`));
  const messages = Array.isArray(rawConversation.messages)
    ? rawConversation.messages
      .map((message, messageIndex) => {
        if (!message || typeof message !== "object") return null;
        const role = compactText(message.role, "assistant").toLowerCase();
        if (!["user", "assistant"].includes(role)) return null;
        const content = String(message.content || "");
        if (!content.trim()) return null;
        return {
          id: compactText(message.id, `${id}-message-${messageIndex}`),
          role,
          content,
          timestamp: compactText(message.timestamp, rawConversation.updatedAt || rawConversation.createdAt || nowIso()),
          provider: compactText(message.provider),
          model: compactText(message.model),
          interactionMode: compactText(message.interactionMode, role === "user" ? "text" : ""),
          status: compactText(message.status, "complete"),
        };
      })
      .filter(Boolean)
    : [];

  const createdAt = compactText(rawConversation.createdAt, nowIso());
  const updatedAt = compactText(rawConversation.updatedAt, messages[messages.length - 1]?.timestamp || createdAt);

  return {
    id,
    title: compactText(rawConversation.title, messages.find((message) => message.role === "user")?.content || "New lecture chat"),
    lectureLabel: compactText(rawConversation.lectureLabel),
    contextKey: compactText(rawConversation.contextKey),
    createdAt,
    updatedAt,
    messages,
  };
}

function parseSseEventBlock(rawBlock = "") {
  const lines = String(rawBlock || "").split(/\r?\n/);
  let eventName = "message";
  const dataLines = [];
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventName = compactText(line.slice(6), "message");
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!dataLines.length) return null;
  const joined = dataLines.join("\n");
  try {
    return { event: eventName, data: JSON.parse(joined) };
  } catch {
    return { event: eventName, data: { message: joined } };
  }
}

async function readErrorResponse(response) {
  const text = await response.text();
  if (!text) return "The lecture assistant request failed.";
  try {
    const parsed = JSON.parse(text);
    return compactText(parsed.detail || parsed.message || parsed.error, text);
  } catch {
    return text;
  }
}

async function consumeAssistantStream(response, onEvent) {
  if (!response.body) throw new Error("The assistant stream did not return any data.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const parsed = parseSseEventBlock(block);
      if (parsed) onEvent(parsed);
      separatorIndex = buffer.indexOf("\n\n");
    }
  }

  const trailingBlock = compactText(buffer);
  if (trailingBlock) {
    const parsed = parseSseEventBlock(trailingBlock);
    if (parsed) onEvent(parsed);
  }
}

export function useLectureAssistant({
  requestStream,
  requestTranscription,
  authEmail = "",
  contextKey = "",
  lectureLabel = "",
  outputLanguage = "English",
  transcript = "",
  summary = "",
  formulas = "",
  workedExamples = "",
  lectureNotes = "",
  lectureSlides = "",
  pastQuestionPapers = "",
  draft = "",
  setDraft,
  onLegacyMessagesChange,
}) {
  const storageKey = useMemo(() => buildConversationStorageKey(authEmail), [authEmail]);
  const hasLectureContext = Boolean(
    compactText(summary)
    || compactText(transcript)
    || compactText(formulas)
    || compactText(workedExamples)
    || compactText(lectureNotes)
    || compactText(lectureSlides)
    || compactText(pastQuestionPapers),
  );
  const normalizedContextKey = useMemo(() => (
    compactText(contextKey)
    || [
      compactText(lectureLabel),
      compactText(summary).slice(0, 120),
      compactText(transcript).slice(0, 120),
    ].filter(Boolean).join("|")
  ), [contextKey, lectureLabel, summary, transcript]);

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceReconnecting, setIsVoiceReconnecting] = useState(false);
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  const [statusText, setStatusText] = useState("Ask a follow-up question and the lecture assistant will answer here with a streaming reply.");
  const [activeProvider, setActiveProvider] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState("");

  const hasLoadedStorageRef = useRef(false);
  const lastContextKeyRef = useRef("");
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const composerRef = useRef(null);
  const copyResetTimerRef = useRef(0);
  const speechRestartTimerRef = useRef(0);
  const voiceListeningTimerRef = useRef(0);
  const speechRecognitionErrorRef = useRef("");
  const manualRecognitionStopRef = useRef(false);
  const ignoreRecognitionEndRef = useRef(false);
  const voiceNetworkRetryCountRef = useRef(0);
  const voiceNoSpeechRetryCountRef = useRef(0);
  const voiceUnexpectedEndRetryCountRef = useRef(0);
  const voiceRecognitionLocalesRef = useRef(resolveLectureAssistantVoiceRecognitionLocales());
  const voiceRecognitionLocaleIndexRef = useRef(0);
  const voiceReplyRunRef = useRef(0);
  const voiceReplyChunkTimerRef = useRef(0);
  const voiceSpeechQueueRef = useRef([]);
  const voiceSpeechBufferRef = useRef("");
  const voiceSpeechPlaybackActiveRef = useRef(false);
  const voiceSpeechStreamDoneRef = useRef(false);
  const voiceInterruptionRequestedRef = useRef(false);
  const recognitionStopReasonRef = useRef("");
  const voiceInputModeRef = useRef("");
  const mediaRecorderRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const voiceAudioContextRef = useRef(null);
  const voiceAnalyserRef = useRef(null);
  const voiceAnimationFrameRef = useRef(0);
  const voiceRecorderChunksRef = useRef([]);
  const voiceRecorderChunkCountRef = useRef(0);
  const voiceLastRequestedChunkCountRef = useRef(0);
  const voiceTranscriptionInFlightRef = useRef(false);
  const voiceTranscriptionPromiseRef = useRef(Promise.resolve(""));
  const voiceTranscriptionAbortRef = useRef(null);
  const voiceLastWhisperRequestAtRef = useRef(0);
  const voiceWhisperTranscriptRef = useRef("");
  const voicePreviewTranscriptRef = useRef("");
  const voiceHasWhisperTranscriptRef = useRef(false);
  const voiceCaptureRunRef = useRef(0);
  const voiceCaptureFinalizingRef = useRef(false);
  const voiceStopCaptureRef = useRef(() => {});
  const voicePreviewRecognitionRef = useRef(null);
  const ttsEnabledRef = useRef(false);
  const voiceModeEnabledRef = useRef(false);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0] || null,
    [activeConversationId, conversations],
  );
  const messages = activeConversation?.messages || [];

  const stopSpeaking = () => {
    if (typeof window !== "undefined") {
      window.clearTimeout(speechRestartTimerRef.current);
      window.clearTimeout(voiceReplyChunkTimerRef.current);
    }
    voiceReplyRunRef.current += 1;
    voiceSpeechQueueRef.current = [];
    voiceSpeechBufferRef.current = "";
    voiceSpeechPlaybackActiveRef.current = false;
    voiceSpeechStreamDoneRef.current = false;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const stopPreviewRecognition = () => {
    if (voicePreviewRecognitionRef.current) {
      try {
        voicePreviewRecognitionRef.current.onresult = null;
        voicePreviewRecognitionRef.current.onerror = null;
        voicePreviewRecognitionRef.current.onend = null;
        voicePreviewRecognitionRef.current.stop();
      } catch {
        // Ignore preview-recognition shutdown failures.
      }
      voicePreviewRecognitionRef.current = null;
    }
  };

  const clearWhisperCaptureArtifacts = ({ abortTranscription = true } = {}) => {
    if (typeof window !== "undefined") {
      window.cancelAnimationFrame?.(voiceAnimationFrameRef.current);
      voiceAnimationFrameRef.current = 0;
    }
    stopPreviewRecognition();
    if (abortTranscription && voiceTranscriptionAbortRef.current) {
      try {
        voiceTranscriptionAbortRef.current.abort();
      } catch {
        // Ignore abort shutdown errors.
      }
      voiceTranscriptionAbortRef.current = null;
    }
    if (voiceAudioContextRef.current) {
      try {
        voiceAudioContextRef.current.close();
      } catch {
        // Ignore audio-context shutdown failures.
      }
      voiceAudioContextRef.current = null;
    }
    if (microphoneStreamRef.current) {
      try {
        microphoneStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignore microphone track shutdown failures.
      }
      microphoneStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    voiceAnalyserRef.current = null;
    voiceStopCaptureRef.current = () => {};
    voiceInputModeRef.current = "";
    voiceCaptureFinalizingRef.current = false;
  };

  const clearVoiceListeningTimer = () => {
    if (typeof window === "undefined") return;
    window.clearTimeout(voiceListeningTimerRef.current);
    voiceListeningTimerRef.current = 0;
  };

  const setVoiceRepliesEnabled = (nextValue) => {
    const resolved = Boolean(nextValue);
    ttsEnabledRef.current = resolved;
    setTtsEnabled(resolved);
  };

  const toggleVoiceReplies = () => {
    setTtsEnabled((current) => {
      const nextValue = !current;
      ttsEnabledRef.current = nextValue;
      return nextValue;
    });
  };

  const applyVoiceModeEnabled = (nextValue) => {
    const resolved = Boolean(nextValue);
    voiceModeEnabledRef.current = resolved;
    setVoiceModeEnabled(resolved);
  };

  const syncRecognitionLocales = ({ resetIndex = false } = {}) => {
    const nextLocales = resolveLectureAssistantVoiceRecognitionLocales();
    voiceRecognitionLocalesRef.current = nextLocales;
    if (resetIndex || voiceRecognitionLocaleIndexRef.current >= nextLocales.length) {
      voiceRecognitionLocaleIndexRef.current = 0;
    }
    return nextLocales;
  };

  const resetVoiceRecoveryState = ({ resetLocale = false } = {}) => {
    voiceNetworkRetryCountRef.current = 0;
    voiceNoSpeechRetryCountRef.current = 0;
    voiceUnexpectedEndRetryCountRef.current = 0;
    if (resetLocale) {
      voiceRecognitionLocaleIndexRef.current = 0;
    }
  };

  const moveToNextRecognitionLocale = () => {
    const locales = voiceRecognitionLocalesRef.current;
    if (!Array.isArray(locales) || locales.length <= 1) return false;
    if (voiceRecognitionLocaleIndexRef.current >= locales.length - 1) return false;
    voiceRecognitionLocaleIndexRef.current += 1;
    return true;
  };

  const scheduleVoiceListeningRestart = ({
    delayMs = VOICE_CHAT_RESTART_DELAY_MS,
    continueVoiceChat = true,
    statusMessage = "Listening for your next question...",
    reconnecting = false,
  } = {}) => {
    if (typeof window === "undefined") return;
    window.clearTimeout(speechRestartTimerRef.current);
    setIsVoiceReconnecting(reconnecting);
    speechRestartTimerRef.current = window.setTimeout(() => {
      speechRestartTimerRef.current = 0;
      if (!voiceModeEnabledRef.current) {
        setIsVoiceReconnecting(false);
        return;
      }
      startListening({ continueVoiceChat });
    }, delayMs);
    setStatusText(statusMessage);
  };

  const finalizeVoiceReplyIfReady = (runId) => {
    if (voiceReplyRunRef.current !== runId) return;
    if (voiceSpeechPlaybackActiveRef.current) return;
    if (voiceSpeechQueueRef.current.length) return;
    if (!voiceSpeechStreamDoneRef.current) {
      setIsSpeaking(false);
      if (voiceModeEnabledRef.current) {
        setStatusText("Thinking through the rest of the answer...");
      }
      return;
    }
    setIsSpeaking(false);
    voiceSpeechBufferRef.current = "";
    voiceSpeechQueueRef.current = [];
    voiceSpeechPlaybackActiveRef.current = false;
    voiceSpeechStreamDoneRef.current = false;
    if (!voiceModeEnabledRef.current) {
      setStatusText("The answer is ready.");
      return;
    }
    scheduleVoiceListeningRestart({
      delayMs: 380,
      continueVoiceChat: true,
      statusMessage: "Reply finished. Listening for your next question...",
    });
  };

  const playNextVoiceSpeechChunk = (runId, preferredLocale, selectedVoice) => {
    if (voiceReplyRunRef.current !== runId) return;
    if (voiceSpeechPlaybackActiveRef.current) return;
    const nextChunk = voiceSpeechQueueRef.current.shift();
    if (!nextChunk) {
      finalizeVoiceReplyIfReady(runId);
      return;
    }
    voiceSpeechPlaybackActiveRef.current = true;
    const utterance = new window.SpeechSynthesisUtterance(nextChunk);
    utterance.lang = preferredLocale;
    utterance.voice = selectedVoice;
    utterance.rate = 1.03;
    utterance.pitch = 1;
    utterance.onstart = () => {
      if (voiceReplyRunRef.current !== runId) return;
      setIsSpeaking(true);
      setIsVoiceReconnecting(false);
      setStatusText(isGenerating ? "Speaking while the answer keeps streaming..." : "Speaking the answer aloud...");
    };
    utterance.onend = () => {
      if (voiceReplyRunRef.current !== runId) return;
      voiceSpeechPlaybackActiveRef.current = false;
      const trailingPauseMs = /[.?!]["']?$/.test(nextChunk)
        ? 90
        : /[,;:]["']?$/.test(nextChunk)
          ? 60
          : VOICE_REPLY_CHUNK_PAUSE_MS;
      voiceReplyChunkTimerRef.current = window.setTimeout(() => {
        voiceReplyChunkTimerRef.current = 0;
        playNextVoiceSpeechChunk(runId, preferredLocale, selectedVoice);
      }, trailingPauseMs);
    };
    utterance.onerror = () => {
      if (voiceReplyRunRef.current !== runId) return;
      voiceSpeechPlaybackActiveRef.current = false;
      setIsSpeaking(false);
      if (voiceModeEnabledRef.current) {
        applyVoiceModeEnabled(false);
      }
      setStatusText("The reply is ready, but browser text-to-speech could not play it.");
    };
    window.speechSynthesis.speak(utterance);
  };

  const queueVoiceSpeechFromText = (textFragment = "", { flush = false } = {}) => {
    const fragment = String(textFragment || "");
    if (!fragment && !flush) return;
    voiceSpeechBufferRef.current = `${voiceSpeechBufferRef.current}${fragment}`;
    const { ready, remaining } = extractReadySpeechChunks(voiceSpeechBufferRef.current, { flush });
    voiceSpeechBufferRef.current = remaining;
    if (ready.length) {
      voiceSpeechQueueRef.current.push(...ready.map((chunk) => buildSpeechFriendlyText(chunk)).filter(Boolean));
    }
  };

  const startVoiceSpeechStream = () => {
    if (typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      return false;
    }
    stopSpeaking();
    const preferredLocale = LECTURE_ASSISTANT_VOICE_PRIMARY_LOCALE;
    const selectedVoice = pickSpeechSynthesisVoice(
      preferredLocale,
      window.speechSynthesis.getVoices?.() || [],
      { englishOnly: true },
    ) || null;
    const runId = voiceReplyRunRef.current + 1;
    voiceReplyRunRef.current = runId;
    voiceSpeechQueueRef.current = [];
    voiceSpeechBufferRef.current = "";
    voiceSpeechPlaybackActiveRef.current = false;
    voiceSpeechStreamDoneRef.current = false;
    return {
      runId,
      preferredLocale,
      selectedVoice,
      enqueueText: (fragment = "", options = {}) => {
        queueVoiceSpeechFromText(fragment, options);
        playNextVoiceSpeechChunk(runId, preferredLocale, selectedVoice);
      },
      markDone: () => {
        voiceSpeechStreamDoneRef.current = true;
        queueVoiceSpeechFromText("", { flush: true });
        playNextVoiceSpeechChunk(runId, preferredLocale, selectedVoice);
      },
    };
  };

  const speakReply = (text = "") => {
    const spokenText = compactText(buildSpeechFriendlyText(text));
    if (!ttsEnabledRef.current || !spokenText) return;
    if (typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      if (voiceModeEnabledRef.current) {
        applyVoiceModeEnabled(false);
      }
      setStatusText("This browser cannot read replies aloud, but the answer is ready.");
      return;
    }
    const stream = startVoiceSpeechStream();
    if (!stream) return;
    stream.enqueueText(spokenText, { flush: true });
    stream.markDone();
  };

  const stopListening = () => {
    manualRecognitionStopRef.current = true;
    clearVoiceListeningTimer();
    if (voiceInputModeRef.current === "whisper") {
      try {
        voiceStopCaptureRef.current?.("manual_stop");
      } catch {
        // Ignore whisper-capture shutdown failures.
      }
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore browser speech-recognition stop failures.
      }
      recognitionRef.current = null;
    }
    stopPreviewRecognition();
    setIsListening(false);
  };

  const stopVoiceChat = ({ message = "Voice chat stopped." } = {}) => {
    if (typeof window !== "undefined") {
      window.clearTimeout(speechRestartTimerRef.current);
      speechRestartTimerRef.current = 0;
    }
    clearVoiceListeningTimer();
    voiceInterruptionRequestedRef.current = false;
    speechRecognitionErrorRef.current = "";
    recognitionStopReasonRef.current = "";
    ignoreRecognitionEndRef.current = false;
    manualRecognitionStopRef.current = false;
    resetVoiceRecoveryState({ resetLocale: true });
    syncRecognitionLocales({ resetIndex: true });
    setIsVoiceReconnecting(false);
    applyVoiceModeEnabled(false);
    stopListening();
    stopSpeaking();
    setStatusText(message);
  };

  const updateConversation = (conversationId, updater) => {
    setConversations((current) => {
      const next = current.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        const updated = typeof updater === "function" ? updater(conversation) : updater;
        return {
          ...updated,
          updatedAt: compactText(updated.updatedAt, nowIso()),
        };
      });
      return sortConversations(next);
    });
  };

  const removeMessageById = (conversationId, messageId) => {
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.filter((message) => message.id !== messageId),
      updatedAt: nowIso(),
    }));
  };

  const patchMessage = (conversationId, messageId, patch) => {
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => (
        message.id === messageId
          ? { ...message, ...(typeof patch === "function" ? patch(message) : patch) }
          : message
      )),
      updatedAt: nowIso(),
    }));
  };

  const ensureActiveConversation = () => {
    if (activeConversation) return activeConversation;
    const nextConversation = createConversationRecord({
      contextKey: normalizedContextKey,
      lectureLabel,
    });
    setConversations((current) => sortConversations([nextConversation, ...current]));
    setActiveConversationId(nextConversation.id);
    return nextConversation;
  };

  const createConversation = () => {
    const nextConversation = createConversationRecord({
      contextKey: normalizedContextKey,
      lectureLabel,
    });
    setConversations((current) => sortConversations([nextConversation, ...current]));
    setActiveConversationId(nextConversation.id);
    setDraft("");
    setStatusText("Started a fresh lecture conversation.");
    setActiveProvider("");
    return nextConversation.id;
  };

  const openPanel = ({ focusComposer = true } = {}) => {
    setIsOpen(true);
    if (!focusComposer || typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      composerRef.current?.focus?.();
    });
  };

  const closePanel = () => setIsOpen(false);
  const togglePanel = () => {
    if (isOpen) closePanel();
    else openPanel();
  };

  const startBrowserListening = ({ continueVoiceChat = false } = {}) => {
    if (isListening) {
      stopVoiceChat({ message: "Voice conversation ended." });
      return;
    }
    if (isSpeaking || isGenerating) {
      setStatusText("Tap the mic again to interrupt the reply and continue talking.");
      return;
    }
    const SpeechRecognitionCtor = typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
    if (!SpeechRecognitionCtor) {
      setIsVoiceReconnecting(false);
      applyVoiceModeEnabled(false);
      setStatusText("Browser voice chat needs Chrome or Edge with microphone access.");
      return;
    }

    openPanel({ focusComposer: false });
    if (!ttsEnabledRef.current) {
      setVoiceRepliesEnabled(true);
    }
    applyVoiceModeEnabled(true);
    if (!continueVoiceChat) {
      resetVoiceRecoveryState({ resetLocale: true });
    }
    const recognitionLocales = syncRecognitionLocales({ resetIndex: !continueVoiceChat });
    const recognitionLocale = recognitionLocales[voiceRecognitionLocaleIndexRef.current] || recognitionLocales[0] || LECTURE_ASSISTANT_VOICE_PRIMARY_LOCALE;
    setIsVoiceReconnecting(false);
    speechRecognitionErrorRef.current = "";
    manualRecognitionStopRef.current = false;
    ignoreRecognitionEndRef.current = false;
    recognitionStopReasonRef.current = "";
    if (typeof window !== "undefined") {
      window.clearTimeout(speechRestartTimerRef.current);
      speechRestartTimerRef.current = 0;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = recognitionLocale;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    let finalTranscript = "";
    let latestTranscript = "";
    const finishListeningTurn = (stopReason) => {
      recognitionStopReasonRef.current = stopReason;
      try {
        recognition.stop();
      } catch {
        // Ignore browser recognition stop failures.
      }
    };
    const scheduleListeningTimeout = (delayMs, statusMessage = "") => {
      clearVoiceListeningTimer();
      if (typeof window === "undefined") return;
      voiceListeningTimerRef.current = window.setTimeout(() => {
        voiceListeningTimerRef.current = 0;
        if (!recognitionRef.current) return;
        if (statusMessage) setStatusText(statusMessage);
        finishListeningTurn("silence_timeout");
      }, delayMs);
    };

    recognition.onstart = () => {
      setIsListening(true);
      setIsVoiceReconnecting(false);
      setStatusText(continueVoiceChat
        ? (hasLectureContext
          ? "Listening for your next question..."
          : "Listening again. No lecture is loaded yet, so answers will be general until you load one.")
        : (hasLectureContext
          ? "Voice chat is on. Speak your question now."
          : "Voice chat is on. Speak now. No lecture is loaded yet, so answers will be general until you load one."));
      scheduleListeningTimeout(
        VOICE_CHAT_INITIAL_IDLE_TIMEOUT_MS,
        "No speech detected yet. Re-arming the microphone...",
      );
    };
    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcriptText = result?.[0]?.transcript || "";
        if (result.isFinal) finalTranscript += `${transcriptText} `;
        else interimTranscript += transcriptText;
      }
      latestTranscript = `${finalTranscript}${interimTranscript}`.replace(/\s+/g, " ").trim();
      resetVoiceRecoveryState();
      setDraft(latestTranscript);
      scheduleListeningTimeout(
        VOICE_CHAT_SILENCE_TIMEOUT_MS,
        "Pause detected. Finishing your voice turn...",
      );
    };
    recognition.onerror = (event) => {
      if (manualRecognitionStopRef.current && event?.error === "aborted") return;
      clearVoiceListeningTimer();
      const errorCode = compactText(event?.error).toLowerCase();
      if (errorCode === "language-not-supported" && voiceModeEnabledRef.current) {
        const switchedLocale = moveToNextRecognitionLocale();
        if (switchedLocale) {
          recognitionStopReasonRef.current = "language_retry";
          ignoreRecognitionEndRef.current = true;
          setIsListening(false);
          scheduleVoiceListeningRestart({
            delayMs: 500,
            continueVoiceChat: true,
            reconnecting: true,
            statusMessage: "Switching to the backup English microphone locale...",
          });
          return;
        }
        setIsVoiceReconnecting(false);
        setStatusText("This browser could not start the lecture assistant's English speech mode. Try Chrome or Edge.");
        return;
      }
      if (errorCode === "no-speech" && voiceModeEnabledRef.current) {
        setIsListening(false);
        if (voiceNoSpeechRetryCountRef.current < VOICE_CHAT_MAX_NO_SPEECH_RETRIES) {
          voiceNoSpeechRetryCountRef.current += 1;
          recognitionStopReasonRef.current = "no_speech_retry";
          ignoreRecognitionEndRef.current = true;
          const switchedLocale = voiceNoSpeechRetryCountRef.current >= 2 ? moveToNextRecognitionLocale() : false;
          scheduleVoiceListeningRestart({
            delayMs: VOICE_CHAT_NO_SPEECH_RETRY_DELAY_MS + (voiceNoSpeechRetryCountRef.current - 1) * 250,
            continueVoiceChat: true,
            reconnecting: switchedLocale || voiceNoSpeechRetryCountRef.current > 1,
            statusMessage: switchedLocale
              ? "Trying the microphone again with the backup English locale..."
              : "Still listening. Speak whenever you are ready...",
          });
          return;
        }
        setIsVoiceReconnecting(false);
        setStatusText("I couldn't hear a clear English voice signal from the microphone. Check the selected mic, permission, and distance from the mic, then tap the mic again.");
        return;
      }
      if (errorCode === "network" && voiceModeEnabledRef.current) {
        recognitionStopReasonRef.current = "network_retry";
        ignoreRecognitionEndRef.current = true;
        setIsListening(false);
        if (voiceNetworkRetryCountRef.current < VOICE_CHAT_MAX_NETWORK_RETRIES) {
          voiceNetworkRetryCountRef.current += 1;
          scheduleVoiceListeningRestart({
            delayMs: VOICE_CHAT_NETWORK_RETRY_DELAY_MS + (voiceNetworkRetryCountRef.current - 1) * 900,
            continueVoiceChat: true,
            reconnecting: true,
            statusMessage: `Reconnecting microphone (${voiceNetworkRetryCountRef.current}/${VOICE_CHAT_MAX_NETWORK_RETRIES})...`,
          });
          return;
        }
        setIsVoiceReconnecting(false);
        setStatusText("Browser microphone transcription disconnected repeatedly. Voice mode is still open, so tap the mic to resume in Chrome or Edge.");
        return;
      }
      speechRecognitionErrorRef.current = getSpeechRecognitionErrorMessage(event?.error);
      if (errorCode !== "aborted") {
        setIsVoiceReconnecting(false);
        applyVoiceModeEnabled(false);
      }
      setStatusText(speechRecognitionErrorRef.current);
      setIsListening(false);
    };
    recognition.onend = async () => {
      recognitionRef.current = null;
      setIsListening(false);
      clearVoiceListeningTimer();
      if (ignoreRecognitionEndRef.current) {
        ignoreRecognitionEndRef.current = false;
        return;
      }
      const stopReason = compactText(recognitionStopReasonRef.current).toLowerCase();
      recognitionStopReasonRef.current = "";
      const spokenQuestion = compactText(finalTranscript, latestTranscript);
      if (manualRecognitionStopRef.current) {
        manualRecognitionStopRef.current = false;
        setIsVoiceReconnecting(false);
        return;
      }
      if (spokenQuestion) {
        setIsVoiceReconnecting(false);
        resetVoiceRecoveryState();
        setDraft(spokenQuestion);
        setStatusText("Sending your voice question...");
        await sendMessage({ promptText: spokenQuestion, interactionMode: "voice" });
        return;
      }
      if (speechRecognitionErrorRef.current) return;

      if (stopReason === "silence_timeout") {
        if (voiceModeEnabledRef.current && continueVoiceChat) {
          if (voiceNoSpeechRetryCountRef.current < VOICE_CHAT_MAX_NO_SPEECH_RETRIES) {
            voiceNoSpeechRetryCountRef.current += 1;
            scheduleVoiceListeningRestart({
              delayMs: 420,
              continueVoiceChat: true,
              statusMessage: voiceNoSpeechRetryCountRef.current === 1
                ? "Pause detected. Listening again..."
                : "I did not catch any clear speech yet. Listening again...",
            });
            return;
          }
          setIsVoiceReconnecting(false);
          setStatusText("I didn't catch any clear words before the pause. Tap the mic and try again.");
          return;
        }
        setStatusText(continueVoiceChat
          ? "Voice mode is still on. Start speaking again or tap the mic."
          : "No speech was captured. Tap the mic and try again.");
        return;
      }

      if (voiceModeEnabledRef.current && continueVoiceChat && voiceUnexpectedEndRetryCountRef.current < VOICE_CHAT_MAX_UNEXPECTED_END_RETRIES) {
        voiceUnexpectedEndRetryCountRef.current += 1;
        scheduleVoiceListeningRestart({
          delayMs: VOICE_CHAT_UNEXPECTED_END_RETRY_DELAY_MS + (voiceUnexpectedEndRetryCountRef.current - 1) * 700,
          continueVoiceChat: true,
          reconnecting: true,
          statusMessage: `Microphone paused unexpectedly. Reconnecting (${voiceUnexpectedEndRetryCountRef.current}/${VOICE_CHAT_MAX_UNEXPECTED_END_RETRIES})...`,
        });
        return;
      }

      setIsVoiceReconnecting(false);
      setStatusText(continueVoiceChat
        ? "Voice mode is still open, but the microphone paused. Tap the mic to continue."
        : "No speech was captured. Tap the mic and try again.");
    };

    try {
      recognition.start();
    } catch {
      applyVoiceModeEnabled(false);
      setStatusText("Voice input could not start in this browser tab.");
      setIsListening(false);
    }
  };

  const transcribeAudioBlobWithWhisper = async ({
    audioBlob,
    captureId,
    final = false,
  } = {}) => {
    if (!requestTranscription || !audioBlob || !audioBlob.size) {
      return compactText(voiceWhisperTranscriptRef.current);
    }

    if (voiceTranscriptionInFlightRef.current) {
      try {
        await voiceTranscriptionPromiseRef.current;
      } catch {
        // The final request below will surface the real error if needed.
      }
    }

    if (captureId !== voiceCaptureRunRef.current) {
      return compactText(voiceWhisperTranscriptRef.current);
    }

    const mimeType = audioBlob.type || getSupportedRecordingMimeType() || "audio/webm";
    const extension = getRecordingFileExtension(mimeType);
    const filename = `lecture-voice-${captureId}.${extension}`;
    const formData = new FormData();
    formData.append("file", audioBlob, filename);
    formData.append("language", LECTURE_ASSISTANT_VOICE_TRANSCRIPTION_LANGUAGE);
    formData.append("output_language", LECTURE_ASSISTANT_VOICE_OUTPUT_LANGUAGE);
    formData.append("lecture_label", compactText(lectureLabel));
    formData.append("partial", final ? "false" : "true");
    formData.append("prompt", buildLectureAssistantVoiceTranscriptionPrompt({
      lectureLabel,
      partialTranscript: !final ? voiceWhisperTranscriptRef.current : "",
    }));

    const controller = new AbortController();
    voiceTranscriptionAbortRef.current = controller;
    voiceLastWhisperRequestAtRef.current = Date.now();

    const runTranscription = (async () => {
      const response = await requestTranscription(formData, controller.signal);
      if (!response.ok) {
        throw new Error(await readErrorResponse(response));
      }
      const data = await response.json().catch(() => ({}));
      const text = normalizeVoiceTranscript(data.text || data.transcript);
      if (text) {
        voiceWhisperTranscriptRef.current = text;
        voiceHasWhisperTranscriptRef.current = true;
        if (captureId === voiceCaptureRunRef.current) {
          setDraft(text);
          if (!final) {
            setStatusText("Listening in English with Groq Whisper...");
          }
        }
      }
      return text;
    })();

    voiceTranscriptionInFlightRef.current = true;
    voiceTranscriptionPromiseRef.current = runTranscription;

    try {
      return await runTranscription;
    } finally {
      voiceTranscriptionInFlightRef.current = false;
      if (voiceTranscriptionAbortRef.current === controller) {
        voiceTranscriptionAbortRef.current = null;
      }
    }
  };

  const startWhisperListening = async ({ continueVoiceChat = false } = {}) => {
    if (isListening) {
      stopVoiceChat({ message: "Voice conversation ended." });
      return;
    }
    if (isSpeaking || isGenerating) {
      setStatusText("Tap the mic again to interrupt the reply and continue talking.");
      return;
    }
    if (
      typeof window === "undefined"
      || typeof navigator === "undefined"
      || typeof requestTranscription !== "function"
      || typeof window.MediaRecorder === "undefined"
      || !navigator.mediaDevices?.getUserMedia
    ) {
      startBrowserListening({ continueVoiceChat });
      return;
    }

    const mimeType = getSupportedRecordingMimeType();
    if (!mimeType) {
      setStatusText("This browser cannot record mic audio here, so voice chat is falling back to browser speech recognition.");
      startBrowserListening({ continueVoiceChat });
      return;
    }

    openPanel({ focusComposer: false });
    if (!ttsEnabledRef.current) {
      setVoiceRepliesEnabled(true);
    }
    applyVoiceModeEnabled(true);
    if (!continueVoiceChat) {
      resetVoiceRecoveryState({ resetLocale: true });
    }
    const recognitionLocales = syncRecognitionLocales({ resetIndex: !continueVoiceChat });
    const recognitionLocale = recognitionLocales[voiceRecognitionLocaleIndexRef.current] || recognitionLocales[0] || LECTURE_ASSISTANT_VOICE_PRIMARY_LOCALE;
    setIsVoiceReconnecting(false);
    speechRecognitionErrorRef.current = "";
    manualRecognitionStopRef.current = false;
    ignoreRecognitionEndRef.current = false;
    recognitionStopReasonRef.current = "";
    if (typeof window !== "undefined") {
      window.clearTimeout(speechRestartTimerRef.current);
      speechRestartTimerRef.current = 0;
    }

    const captureId = voiceCaptureRunRef.current + 1;
    voiceCaptureRunRef.current = captureId;
    voiceInputModeRef.current = "whisper";
    voiceRecorderChunksRef.current = [];
    voiceRecorderChunkCountRef.current = 0;
    voiceLastRequestedChunkCountRef.current = 0;
    voiceWhisperTranscriptRef.current = "";
    voicePreviewTranscriptRef.current = "";
    voiceHasWhisperTranscriptRef.current = false;
    voiceCaptureFinalizingRef.current = false;
    voiceLastWhisperRequestAtRef.current = 0;

    const schedulePartialWhisperTranscription = async ({ force = false } = {}) => {
      if (captureId !== voiceCaptureRunRef.current) return "";
      if (!voiceRecorderChunksRef.current.length) return compactText(voiceWhisperTranscriptRef.current);
      if (!force && voiceRecorderChunkCountRef.current < VOICE_TRANSCRIPTION_MIN_CHUNKS) {
        return compactText(voiceWhisperTranscriptRef.current);
      }
      if (!force && voiceRecorderChunkCountRef.current <= voiceLastRequestedChunkCountRef.current) {
        return compactText(voiceWhisperTranscriptRef.current);
      }
      if (!force && Date.now() - voiceLastWhisperRequestAtRef.current < VOICE_TRANSCRIPTION_DEBOUNCE_MS) {
        return compactText(voiceWhisperTranscriptRef.current);
      }
      const audioBlob = new Blob(voiceRecorderChunksRef.current, { type: mimeType });
      if (!audioBlob.size) return compactText(voiceWhisperTranscriptRef.current);
      voiceLastRequestedChunkCountRef.current = voiceRecorderChunkCountRef.current;
      try {
        return await transcribeAudioBlobWithWhisper({ audioBlob, captureId, final: force });
      } catch {
        return compactText(voiceWhisperTranscriptRef.current);
      }
    };

    const finalizeWhisperTurn = async (reason = "silence_timeout") => {
      if (captureId !== voiceCaptureRunRef.current || voiceCaptureFinalizingRef.current) return;
      voiceCaptureFinalizingRef.current = true;
      clearVoiceListeningTimer();
      setIsListening(false);
      stopPreviewRecognition();
      setStatusText(
        reason === "manual_stop"
          ? "Voice conversation ended."
          : "Transcribing your voice with Groq Whisper...",
      );
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          clearWhisperCaptureArtifacts({ abortTranscription: false });
        }
        return;
      }
      clearWhisperCaptureArtifacts({ abortTranscription: false });
    };

    voiceStopCaptureRef.current = (reason = "manual_stop") => {
      if (captureId !== voiceCaptureRunRef.current) return;
      clearVoiceListeningTimer();
      if (reason !== "silence_timeout" && reason !== "send_turn") {
        voiceCaptureFinalizingRef.current = false;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          clearWhisperCaptureArtifacts();
        }
      } else {
        clearWhisperCaptureArtifacts();
      }
      setIsListening(false);
    };

    try {
      const microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: { ideal: 1, max: 1 },
          sampleRate: { ideal: 16000 },
          sampleSize: { ideal: 16 },
          latency: { ideal: 0.02 },
        },
      });
      if (captureId !== voiceCaptureRunRef.current) {
        microphoneStream.getTracks().forEach((track) => track.stop());
        return;
      }

      microphoneStreamRef.current = microphoneStream;
      const recorder = mimeType
        ? new window.MediaRecorder(microphoneStream, { mimeType })
        : new window.MediaRecorder(microphoneStream);
      mediaRecorderRef.current = recorder;

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioContextCtor) {
        try {
          const audioContext = new AudioContextCtor({ sampleRate: 16000 });
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 2048;
          const sourceNode = audioContext.createMediaStreamSource(microphoneStream);
          sourceNode.connect(analyser);
          voiceAudioContextRef.current = audioContext;
          voiceAnalyserRef.current = analyser;
        } catch {
          voiceAudioContextRef.current = null;
          voiceAnalyserRef.current = null;
        }
      }

      const PreviewRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (PreviewRecognitionCtor) {
        try {
          const previewRecognition = new PreviewRecognitionCtor();
          previewRecognition.lang = recognitionLocale;
          previewRecognition.interimResults = true;
          previewRecognition.continuous = true;
          let previewFinalTranscript = "";
          let previewInterimTranscript = "";
          previewRecognition.onresult = (event) => {
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
              const result = event.results[index];
              const transcriptText = compactText(result?.[0]?.transcript);
              if (!transcriptText) continue;
              if (result.isFinal) previewFinalTranscript += `${transcriptText} `;
              else previewInterimTranscript = transcriptText;
            }
            const previewText = normalizeVoiceTranscript(`${previewFinalTranscript} ${previewInterimTranscript}`);
            voicePreviewTranscriptRef.current = previewText;
            if (!voiceHasWhisperTranscriptRef.current && previewText) {
              setDraft(previewText);
              setStatusText("Listening in English... partial transcript updating live.");
            }
          };
          previewRecognition.onerror = () => {
            // Whisper remains the primary transcription path, so preview errors are non-fatal.
          };
          previewRecognition.onend = () => {
            if (captureId !== voiceCaptureRunRef.current || !voiceModeEnabledRef.current || voiceCaptureFinalizingRef.current) return;
            try {
              previewRecognition.start();
            } catch {
              // Ignore preview restart failures.
            }
          };
          voicePreviewRecognitionRef.current = previewRecognition;
          try {
            previewRecognition.start();
          } catch {
            voicePreviewRecognitionRef.current = null;
          }
        } catch {
          voicePreviewRecognitionRef.current = null;
        }
      }

      recorder.ondataavailable = (event) => {
        const chunk = event?.data;
        if (!chunk || !chunk.size || captureId !== voiceCaptureRunRef.current) return;
        voiceRecorderChunksRef.current.push(chunk);
        voiceRecorderChunkCountRef.current += 1;
        void schedulePartialWhisperTranscription();
      };

      recorder.onstop = async () => {
        const wasFinalizing = voiceCaptureFinalizingRef.current;
        const audioBlob = new Blob(voiceRecorderChunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        const previewTranscript = compactText(voicePreviewTranscriptRef.current);
        clearWhisperCaptureArtifacts({ abortTranscription: false });

        if (!wasFinalizing) {
          return;
        }

        let finalTranscript = compactText(voiceWhisperTranscriptRef.current);
        try {
          const transcribed = await transcribeAudioBlobWithWhisper({ audioBlob, captureId, final: true });
          finalTranscript = compactText(transcribed, finalTranscript);
        } catch (error) {
          finalTranscript = compactText(finalTranscript, previewTranscript);
          if (!finalTranscript) {
            setStatusText(compactText(error?.message, "Groq Whisper could not transcribe that voice turn."));
          }
        }

        finalTranscript = normalizeVoiceTranscript(compactText(finalTranscript, previewTranscript));
        const transcriptConfidence = estimateTranscriptConfidence(finalTranscript, previewTranscript);
        if (transcriptConfidence < 0.4 && compactText(previewTranscript).length > finalTranscript.length) {
          finalTranscript = normalizeVoiceTranscript(previewTranscript);
        }
        if (!finalTranscript) {
          if (voiceModeEnabledRef.current && continueVoiceChat && voiceNoSpeechRetryCountRef.current < VOICE_CHAT_MAX_NO_SPEECH_RETRIES) {
            voiceNoSpeechRetryCountRef.current += 1;
            scheduleVoiceListeningRestart({
              delayMs: 420,
              continueVoiceChat: true,
              reconnecting: voiceNoSpeechRetryCountRef.current > 1,
              statusMessage: "I didn't catch a clear voice turn yet. Listening again...",
            });
            return;
          }
          setStatusText("I couldn't hear a clear voice question. Check the mic level and try again.");
          return;
        }
        if (transcriptConfidence < 0.32 && finalTranscript.length < 18) {
          setStatusText("I only caught a weak partial voice turn. Try speaking a little longer or closer to the microphone.");
          return;
        }

        resetVoiceRecoveryState();
        setDraft(finalTranscript);
        setStatusText(transcriptConfidence < 0.55 ? "Sending your voice question with low-confidence transcription..." : "Sending your voice question...");
        await sendMessage({ promptText: finalTranscript, interactionMode: "voice" });
      };

      recorder.start(650);
      setIsListening(true);
      setStatusText(continueVoiceChat
        ? "Listening in English with Groq Whisper for your next question..."
        : "Voice chat is on in English. Speak your question now.");

      const listenStartedAt = Date.now();
      let lastSpeechDetectedAt = listenStartedAt;
      let speechDetected = false;
      let speechStartedAt = 0;
      let activeFrameCount = 0;
      let silenceFrameCount = 0;
      let noiseFloorRms = VOICE_VAD_MIN_NOISE_FLOOR;
      let noiseFloorPeak = VOICE_TRANSCRIPTION_SILENCE_THRESHOLD;
      const audioSampleBuffer = new Uint8Array(2048);

      const monitorSilence = () => {
        if (captureId !== voiceCaptureRunRef.current || voiceCaptureFinalizingRef.current) return;
        const analyser = voiceAnalyserRef.current;
        const now = Date.now();
        if (analyser) {
          analyser.getByteTimeDomainData(audioSampleBuffer);
          let sumSquares = 0;
          let peak = 0;
          for (let index = 0; index < audioSampleBuffer.length; index += 1) {
            const normalized = (audioSampleBuffer[index] - 128) / 128;
            const magnitude = Math.abs(normalized);
            sumSquares += normalized * normalized;
            if (magnitude > peak) peak = magnitude;
          }
          const rms = Math.sqrt(sumSquares / audioSampleBuffer.length);
          const dynamicRmsThreshold = Math.max(
            VOICE_TRANSCRIPTION_SILENCE_THRESHOLD,
            VOICE_VAD_MIN_NOISE_FLOOR,
            noiseFloorRms * VOICE_VAD_RMS_MULTIPLIER,
          );
          const dynamicPeakThreshold = Math.max(
            VOICE_TRANSCRIPTION_ACTIVITY_THRESHOLD,
            noiseFloorPeak * VOICE_VAD_PEAK_MULTIPLIER,
          );
          const isSpeechFrame = rms >= dynamicRmsThreshold || peak >= dynamicPeakThreshold;
          if (!isSpeechFrame) {
            noiseFloorRms = clampNumber(
              noiseFloorRms + (rms - noiseFloorRms) * VOICE_VAD_NOISE_FLOOR_SMOOTHING,
              VOICE_VAD_MIN_NOISE_FLOOR,
              VOICE_TRANSCRIPTION_SILENCE_THRESHOLD,
            );
            noiseFloorPeak = clampNumber(
              noiseFloorPeak + (peak - noiseFloorPeak) * VOICE_VAD_NOISE_FLOOR_SMOOTHING,
              VOICE_TRANSCRIPTION_SILENCE_THRESHOLD,
              VOICE_TRANSCRIPTION_ACTIVITY_THRESHOLD,
            );
          }

          if (isSpeechFrame) {
            activeFrameCount += 1;
            silenceFrameCount = 0;
            if (activeFrameCount >= VOICE_VAD_MIN_ACTIVE_FRAMES) {
              if (!speechDetected) {
                speechStartedAt = now;
                setStatusText("Listening in English with Groq Whisper...");
              }
              speechDetected = true;
              lastSpeechDetectedAt = now;
            }
          } else {
            activeFrameCount = 0;
            if (speechDetected) {
              silenceFrameCount += 1;
            }
          }
        }

        const candidateTranscript = compactText(
          voiceWhisperTranscriptRef.current,
          voicePreviewTranscriptRef.current,
        );
        const pauseWindowMs = resolveAdaptiveVoicePauseMs({
          transcript: candidateTranscript,
          previewTranscript: voicePreviewTranscriptRef.current,
          speechDetected,
        });
        if (!speechDetected && now - listenStartedAt >= VOICE_CHAT_INITIAL_IDLE_TIMEOUT_MS) {
          void finalizeWhisperTurn("silence_timeout");
          return;
        }
        if (
          speechDetected
          && silenceFrameCount >= VOICE_VAD_MIN_SILENCE_FRAMES
          && now - lastSpeechDetectedAt >= pauseWindowMs
        ) {
          const speechDurationMs = speechStartedAt ? now - speechStartedAt : 0;
          if (speechDurationMs < VOICE_VAD_MIN_SPEECH_MS && candidateTranscript.length < VOICE_VAD_MIN_TRANSCRIPT_CHARS) {
            speechDetected = false;
            speechStartedAt = 0;
            activeFrameCount = 0;
            silenceFrameCount = 0;
            lastSpeechDetectedAt = now;
            voiceRecorderChunksRef.current = [];
            voiceRecorderChunkCountRef.current = 0;
            voiceLastRequestedChunkCountRef.current = 0;
            voiceWhisperTranscriptRef.current = "";
            voicePreviewTranscriptRef.current = "";
            voiceHasWhisperTranscriptRef.current = false;
            setDraft("");
            setStatusText("Small background noise ignored. Still listening in English...");
            voiceAnimationFrameRef.current = window.requestAnimationFrame(monitorSilence);
            return;
          }
          void finalizeWhisperTurn("silence_timeout");
          return;
        }
        voiceAnimationFrameRef.current = window.requestAnimationFrame(monitorSilence);
      };

      voiceAnimationFrameRef.current = window.requestAnimationFrame(monitorSilence);
    } catch (error) {
      clearWhisperCaptureArtifacts();
      setIsListening(false);
      setIsVoiceReconnecting(false);
      setStatusText(`${getMicrophoneAccessErrorMessage(error)} Falling back to browser speech recognition if available.`);
      startBrowserListening({ continueVoiceChat });
    }
  };

  const startListening = ({ continueVoiceChat = false } = {}) => {
    if (
      typeof requestTranscription === "function"
      && typeof window !== "undefined"
      && typeof navigator !== "undefined"
      && typeof window.MediaRecorder !== "undefined"
      && navigator.mediaDevices?.getUserMedia
    ) {
      void startWhisperListening({ continueVoiceChat });
      return;
    }
    startBrowserListening({ continueVoiceChat });
  };

  const stopGenerating = ({ preserveVoiceMode = false, restartListening = false } = {}) => {
    abortControllerRef.current?.abort?.();
    abortControllerRef.current = null;
    setIsGenerating(false);
    if (preserveVoiceMode && voiceModeEnabledRef.current) {
      if (restartListening) {
        scheduleVoiceListeningRestart({
          delayMs: 180,
          continueVoiceChat: true,
          statusMessage: "AI interrupted. Listening...",
        });
      } else {
        setStatusText("Generation stopped.");
      }
      return;
    }
    setStatusText("Generation stopped.");
  };

  const interruptAssistantAndListen = () => {
    if (!voiceModeEnabledRef.current) {
      startListening();
      return;
    }
    voiceInterruptionRequestedRef.current = true;
    stopSpeaking();
    stopGenerating({ preserveVoiceMode: true, restartListening: true });
  };

  const sendMessage = async ({
    promptText = draft,
    baseMessages = null,
    appendUserMessage = true,
    interactionMode = "text",
  } = {}) => {
    const resolvedInteractionMode = compactText(interactionMode, "text").toLowerCase() === "voice" ? "voice" : "text";
    const useVoiceInteraction = resolvedInteractionMode === "voice";
    const question = compactText(
      useVoiceInteraction
        ? (normalizeVoiceTranscript(promptText) || promptText)
        : promptText,
    );
    if (!question) {
      setStatusText("Type or speak a question first.");
      return false;
    }
    if (isGenerating) return false;

    openPanel();
    setIsVoiceReconnecting(false);
    stopSpeaking();
    if (recognitionRef.current || isListening) {
      stopListening();
    }

    const targetConversation = ensureActiveConversation();
    const targetConversationId = targetConversation.id;
    const currentMessages = Array.isArray(baseMessages) ? baseMessages : targetConversation.messages;
    const nextUserMessage = appendUserMessage
      ? createConversationMessage("user", question, { interactionMode: resolvedInteractionMode })
      : null;
    const nextAssistantMessage = createConversationMessage("assistant", "", {
      status: "streaming",
      interactionMode: resolvedInteractionMode,
    });
    const requestMessages = (appendUserMessage
      ? [...currentMessages, nextUserMessage]
      : [...currentMessages]
    ).filter((message) => ["user", "assistant"].includes(message.role) && compactText(message.content));

    updateConversation(targetConversationId, (conversation) => ({
      ...conversation,
      title: appendUserMessage && conversation.messages.length === 0
        ? deriveConversationTitle(question, lectureLabel)
        : compactText(conversation.title, deriveConversationTitle(question, lectureLabel)),
      lectureLabel: compactText(lectureLabel),
      contextKey: compactText(normalizedContextKey),
      messages: [
        ...currentMessages,
        ...(appendUserMessage && nextUserMessage ? [nextUserMessage] : []),
        nextAssistantMessage,
      ],
      updatedAt: nowIso(),
    }));

    setDraft("");
    setIsGenerating(true);
    setStatusText(useVoiceInteraction
      ? (hasLectureContext ? "Processing your voice question..." : "Processing your voice question without lecture context...")
      : (hasLectureContext ? "Connecting to OpenAI..." : "Connecting to OpenAI without lecture context..."));
    setActiveProvider("");

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let streamedText = "";
    const shouldStreamVoiceReply = Boolean(useVoiceInteraction && ttsEnabledRef.current);
    const voiceSpeechStream = shouldStreamVoiceReply ? startVoiceSpeechStream() : null;

    try {
      const response = await requestStream({
        question,
        transcript,
        summary,
        formulas,
        worked_examples: workedExamples,
        lecture_notes: lectureNotes,
        lecture_slides: lectureSlides,
        past_question_papers: pastQuestionPapers,
        messages: requestMessages.map((message) => ({
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
        })),
        language: useVoiceInteraction ? LECTURE_ASSISTANT_VOICE_OUTPUT_LANGUAGE : outputLanguage,
        voice_mode: useVoiceInteraction,
        session_id: targetConversationId,
        conversation_id: targetConversationId,
        lecture_label: compactText(lectureLabel),
        client_request_id: createClientId("chat"),
      }, controller.signal);

      if (!response.ok) {
        throw new Error(await readErrorResponse(response));
      }

      await consumeAssistantStream(response, ({ event, data }) => {
        if (event === "provider_attempt") {
          setStatusText(`Trying ${data.label || formatProviderLabel(data.provider)}...`);
          return;
        }
        if (event === "fallback") {
          setStatusText(data.message || "Switching to a backup model...");
          return;
        }
        if (event === "provider_selected") {
          setActiveProvider(compactText(data.provider));
          patchMessage(targetConversationId, nextAssistantMessage.id, {
            provider: compactText(data.provider),
            model: compactText(data.model),
          });
          setStatusText(useVoiceInteraction
            ? `${data.label || formatProviderLabel(data.provider)} is replying in voice mode...`
            : `${data.label || formatProviderLabel(data.provider)} is replying...`);
          return;
        }
        if (event === "delta") {
          const chunk = String(data.text || "");
          if (!chunk) return;
          streamedText += chunk;
          if (voiceSpeechStream) {
            voiceSpeechStream.enqueueText(chunk);
          }
          patchMessage(targetConversationId, nextAssistantMessage.id, (message) => ({
            ...message,
            content: `${message.content || ""}${chunk}`,
            provider: compactText(data.provider, message.provider),
            model: compactText(data.model, message.model),
            status: "streaming",
          }));
          return;
        }
        if (event === "done") {
          setActiveProvider(compactText(data.provider));
          if (voiceSpeechStream) {
            voiceSpeechStream.markDone();
          }
          patchMessage(targetConversationId, nextAssistantMessage.id, (message) => ({
            ...message,
            provider: compactText(data.provider, message.provider),
            model: compactText(data.model, message.model),
            status: "complete",
          }));
          setStatusText(useVoiceInteraction
            ? `${data.label || formatProviderLabel(data.provider)} finished streaming. Voice reply may still be speaking...`
            : `${data.label || formatProviderLabel(data.provider)} finished the reply.`);
          return;
        }
        if (event === "error") {
          throw new Error(compactText(data.message, "The lecture assistant could not finish that reply."));
        }
      });

      if (!compactText(streamedText)) {
        throw new Error("The lecture assistant did not return any text.");
      }

      if (voiceSpeechStream) {
        voiceSpeechStream.markDone();
      } else if (useVoiceInteraction) {
        speakReply(streamedText);
      }
      return true;
    } catch (error) {
      if (error?.name === "AbortError") {
        if (!compactText(streamedText)) removeMessageById(targetConversationId, nextAssistantMessage.id);
        else patchMessage(targetConversationId, nextAssistantMessage.id, { status: "complete" });
        if (voiceInterruptionRequestedRef.current) {
          voiceInterruptionRequestedRef.current = false;
          return false;
        }
        if (useVoiceInteraction && voiceModeEnabledRef.current) {
          applyVoiceModeEnabled(false);
        }
        setStatusText("Generation stopped.");
        return false;
      }
      if (!compactText(streamedText)) removeMessageById(targetConversationId, nextAssistantMessage.id);
      else patchMessage(targetConversationId, nextAssistantMessage.id, { status: "complete" });
      stopSpeaking();
      if (useVoiceInteraction && voiceModeEnabledRef.current) {
        applyVoiceModeEnabled(false);
      }
      setStatusText(compactText(error?.message, "The lecture assistant could not answer right now."));
      return false;
    } finally {
      voiceInterruptionRequestedRef.current = false;
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const regenerateLastResponse = async () => {
    if (isGenerating || !activeConversation) return false;
    const conversationMessages = [...activeConversation.messages];
    const lastAssistantIndex = [...conversationMessages].reverse().findIndex((message) => message.role === "assistant");
    if (lastAssistantIndex < 0) return false;
    const resolvedAssistantIndex = conversationMessages.length - 1 - lastAssistantIndex;
    const trimmedMessages = conversationMessages.slice(0, resolvedAssistantIndex);
    const lastUserMessage = [...trimmedMessages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) return false;
    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      messages: trimmedMessages,
      updatedAt: nowIso(),
    }));
    return sendMessage({
      promptText: lastUserMessage.content,
      baseMessages: trimmedMessages,
      appendUserMessage: false,
      interactionMode: compactText(lastUserMessage.interactionMode, "text"),
    });
  };

  const deleteConversation = (conversationId) => {
    if (conversationId === activeConversationId && isGenerating) {
      stopGenerating();
    }
    setConversations((current) => {
      const next = current.filter((conversation) => conversation.id !== conversationId);
      if (next.length) return sortConversations(next);
      return [createConversationRecord({ contextKey: normalizedContextKey, lectureLabel })];
    });
    if (conversationId === activeConversationId) {
      setActiveConversationId("");
    }
    setStatusText("Conversation deleted.");
  };

  const copyMessage = async (messageId, content) => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setStatusText("Clipboard copy is not available in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(String(content || ""));
      setCopiedMessageId(messageId);
      window.clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedMessageId("");
      }, 1800);
      setStatusText("Message copied.");
    } catch {
      setStatusText("Message copy failed.");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedConversations = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      const normalized = Array.isArray(storedConversations)
        ? storedConversations.map(normalizeConversationRecord).filter(Boolean)
        : [];
      const fallbackConversation = createConversationRecord({ contextKey: normalizedContextKey, lectureLabel });
      const storedActiveConversationId = compactText(window.localStorage.getItem(`${storageKey}:active`));
      setConversations(normalized.length ? sortConversations(normalized) : [fallbackConversation]);
      setActiveConversationId(storedActiveConversationId || normalized[0]?.id || fallbackConversation.id);
      setTheme(compactText(window.localStorage.getItem(ASSISTANT_THEME_STORAGE_KEY), "dark"));
      const storedVoiceRepliesEnabled = window.localStorage.getItem(ASSISTANT_TTS_STORAGE_KEY) === "true";
      ttsEnabledRef.current = storedVoiceRepliesEnabled;
      setTtsEnabled(storedVoiceRepliesEnabled);
    } catch {
      const fallbackConversation = createConversationRecord({ contextKey: normalizedContextKey, lectureLabel });
      setConversations([fallbackConversation]);
      setActiveConversationId(fallbackConversation.id);
    } finally {
      hasLoadedStorageRef.current = true;
      lastContextKeyRef.current = normalizedContextKey;
    }
  }, [storageKey, normalizedContextKey, lectureLabel]);

  useEffect(() => {
    if (!hasLoadedStorageRef.current || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(sortConversations(conversations)));
    if (activeConversationId) {
      window.localStorage.setItem(`${storageKey}:active`, activeConversationId);
    }
  }, [activeConversationId, conversations, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ASSISTANT_THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ASSISTANT_TTS_STORAGE_KEY, String(ttsEnabled));
  }, [ttsEnabled]);

  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  useEffect(() => {
    voiceModeEnabledRef.current = voiceModeEnabled;
  }, [voiceModeEnabled]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.getVoices();
    } catch {
      // Ignore speech-synthesis warmup failures.
    }
  }, []);

  useEffect(() => {
    voiceRecognitionLocalesRef.current = resolveLectureAssistantVoiceRecognitionLocales();
    voiceRecognitionLocaleIndexRef.current = 0;
  }, []);

  useEffect(() => {
    onLegacyMessagesChange?.(
      messages
        .filter((message) => ["user", "assistant"].includes(message.role) && compactText(message.content))
        .map((message) => ({ role: message.role, content: message.content })),
    );
  }, [messages, onLegacyMessagesChange]);

  useEffect(() => {
    if (!hasLoadedStorageRef.current) return;
    const previousContextKey = lastContextKeyRef.current;
    if (!previousContextKey) {
      lastContextKeyRef.current = normalizedContextKey;
      return;
    }
    if (previousContextKey === normalizedContextKey) return;
    lastContextKeyRef.current = normalizedContextKey;

    if (!activeConversation) {
      const nextConversation = createConversationRecord({ contextKey: normalizedContextKey, lectureLabel });
      setConversations((current) => sortConversations([nextConversation, ...current]));
      setActiveConversationId(nextConversation.id);
      return;
    }

    if (!activeConversation.messages.length) {
      updateConversation(activeConversation.id, (conversation) => ({
        ...conversation,
        contextKey: normalizedContextKey,
        lectureLabel: compactText(lectureLabel),
        updatedAt: nowIso(),
      }));
      return;
    }

    const nextConversation = createConversationRecord({ contextKey: normalizedContextKey, lectureLabel });
    setConversations((current) => sortConversations([nextConversation, ...current]));
    setActiveConversationId(nextConversation.id);
    setStatusText("Started a fresh chat for the current lecture.");
  }, [activeConversation, lectureLabel, normalizedContextKey]);

  useEffect(() => {
    if (!activeConversationId && conversations[0]?.id) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    const focusComposer = () => composerRef.current?.focus?.();
    window.requestAnimationFrame(focusComposer);
    window.setTimeout(focusComposer, 120);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
    });
  }, [isGenerating, isOpen, messages.length]);

  useEffect(() => () => {
    abortControllerRef.current?.abort?.();
    if (typeof window !== "undefined") {
      window.clearTimeout(speechRestartTimerRef.current);
      window.clearTimeout(voiceReplyChunkTimerRef.current);
    }
    clearVoiceListeningTimer();
    stopListening();
    stopSpeaking();
    window.clearTimeout(copyResetTimerRef.current);
  }, []);

  return {
    activeConversation,
    activeConversationId,
    activeProvider,
    canSend: Boolean(compactText(draft)) && !isGenerating,
    closePanel,
    composerRef,
    conversations,
    copiedMessageId,
    copyMessage,
    createConversation,
    deleteConversation,
    draft,
    hasLectureContext,
    isGenerating,
    interruptAssistantAndListen,
    isListening,
    isOpen,
    isSpeaking,
    isVoiceReconnecting,
    voiceModeEnabled,
    lectureLabel: compactText(lectureLabel),
    messages,
    messagesEndRef,
    openPanel,
    providerLabel: formatProviderLabel(activeProvider || messages[messages.length - 1]?.provider),
    regenerateLastResponse,
    selectConversation: setActiveConversationId,
    sendMessage,
    setDraft,
    setTheme,
    startListening,
    statusText,
    stopGenerating,
    stopListening,
    stopSpeaking,
    stopVoiceChat,
    theme,
    toggleListening: startListening,
    togglePanel,
    toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark"),
    toggleTts: toggleVoiceReplies,
    toggleVoiceChat: () => {
      if (isSpeaking || isGenerating) {
        interruptAssistantAndListen();
        return;
      }
      if (isListening) {
        stopVoiceChat({ message: "Voice conversation ended." });
        return;
      }
      if (voiceModeEnabledRef.current) {
        startListening({ continueVoiceChat: true });
        return;
      }
      startListening();
    },
    ttsEnabled,
  };
}
