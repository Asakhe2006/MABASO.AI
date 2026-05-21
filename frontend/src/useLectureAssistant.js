import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  buildVoicePersonalityPrompt,
  buildVoicePreviewText,
  buildVoiceProfileOptions,
  resolveVoiceProfile,
} from "./assistantVoiceProfiles";

const ASSISTANT_STORAGE_PREFIX = "mabaso-lecture-assistant-v2";
const LEGACY_ASSISTANT_STORAGE_PREFIX = "mabaso-lecture-assistant-v1";
const ASSISTANT_THEME_STORAGE_KEY = "mabaso-lecture-assistant-theme";
const ASSISTANT_TTS_STORAGE_KEY = "mabaso-lecture-assistant-tts";
const ASSISTANT_VOICE_PROFILE_STORAGE_KEY = "mabaso-lecture-assistant-voice-profile";
const ASSISTANT_VOICE_PREVIEW_DRAFT_STORAGE_KEY = "mabaso-lecture-assistant-voice-preview-draft";
const MAX_SAVED_CONVERSATIONS = 120;
const CONVERSATION_LIST_PAGE_SIZE = 30;
const CONVERSATION_MESSAGE_PAGE_SIZE = 80;
const CONVERSATION_SEARCH_DEBOUNCE_MS = 260;
const LECTURE_ASSISTANT_VOICE_OUTPUT_LANGUAGE = "English";
const LECTURE_ASSISTANT_VOICE_TRANSCRIPTION_LANGUAGE = "en";
const LECTURE_ASSISTANT_VOICE_RECOGNITION_LOCALES = ["en-US", "en-GB"];
const LECTURE_ASSISTANT_VOICE_PRIMARY_LOCALE = LECTURE_ASSISTANT_VOICE_RECOGNITION_LOCALES[0];
const VOICE_VAD_ASSET_BASE_PATH = "/voice-vad/";
const VOICE_DEFAULT_PREVIEW_TEXT = "Explain black holes simply.";
const VOICE_CHAT_RESTART_DELAY_MS = 1100;
const VOICE_CHAT_NETWORK_RETRY_DELAY_MS = 1800;
const VOICE_CHAT_MAX_NETWORK_RETRIES = 3;
const VOICE_CHAT_INITIAL_IDLE_TIMEOUT_MS = 15000;
const VOICE_CHAT_SILENCE_TIMEOUT_MS = 3200;
const VOICE_CHAT_NO_SPEECH_RETRY_DELAY_MS = 650;
const VOICE_CHAT_MAX_NO_SPEECH_RETRIES = 3;
const VOICE_REPLY_CHUNK_PAUSE_MS = 95;
const VOICE_STREAM_MIN_CHARS = 75;
const VOICE_STREAM_MAX_CHARS = 170;
const VOICE_CHAT_UNEXPECTED_END_RETRY_DELAY_MS = 900;
const VOICE_CHAT_MAX_UNEXPECTED_END_RETRIES = 3;
const VOICE_TRANSCRIPTION_DEBOUNCE_MS = 480;
const VOICE_TRANSCRIPTION_MIN_CHUNKS = 1;
const VOICE_TRANSCRIPTION_SILENCE_THRESHOLD = 0.014;
const VOICE_TRANSCRIPTION_ACTIVITY_THRESHOLD = 0.028;
const VOICE_SILERO_POSITIVE_THRESHOLD = 0.72;
const VOICE_SILERO_NEGATIVE_THRESHOLD = 0.48;
const VOICE_SILERO_REDEMPTION_MS = 1550;
const VOICE_SILERO_PRE_SPEECH_PAD_MS = 240;
const VOICE_SILERO_MIN_SPEECH_MS = 420;
const VOICE_VAD_MIN_SPEECH_MS = 420;
const VOICE_VAD_MIN_ACTIVE_FRAMES = 4;
const VOICE_VAD_MIN_SILENCE_FRAMES = 8;
const VOICE_VAD_MIN_TRANSCRIPT_CHARS = 3;
const VOICE_VAD_MIN_NOISE_FLOOR = 0.004;
const VOICE_VAD_NOISE_FLOOR_SMOOTHING = 0.1;
const VOICE_VAD_RMS_MULTIPLIER = 2.4;
const VOICE_VAD_PEAK_MULTIPLIER = 1.9;
const VOICE_FAST_FINALIZE_WITH_PUNCTUATION_MS = 900;
const VOICE_FAST_FINALIZE_WITH_CONFIDENCE_MS = 1250;
const VOICE_DEFAULT_POST_SPEECH_SILENCE_MS = 1700;
const VOICE_MIN_CONFIDENT_TRANSCRIPT_CHARS = 28;
const VOICE_PREVIEW_RESUME_DELAY_MS = 420;
const VOICE_RECENT_SPOKEN_REFERENCE_LIMIT = 360;
const VOICE_TURN_INTENT_MIN_SCORE = 0.56;
const VOICE_TURN_INTENT_RETRY_SCORE = 0.38;
const VOICE_INTERRUPTION_INTENT_MIN_SCORE = 0.62;
const VOICE_INTERRUPTION_MIN_WORDS = 2;
const VOICE_ECHO_REJECTION_OVERLAP = 0.48;
const VOICE_INTERRUPTION_COOLDOWN_MS = 900;
const VOICE_INTERRUPTION_MIN_SPEECH_MS = 240;
const VOICE_INTERRUPTION_FORCE_SPEECH_MS = 540;
const VOICE_INTERRUPTION_MIN_ACTIVE_FRAMES = 3;
const VOICE_INTERRUPTION_MIN_SILENCE_FRAMES = 4;
const VOICE_INTERRUPTION_MIN_TRANSCRIPT_CHARS = 4;
const VOICE_INTERRUPTION_MIN_ACTIVITY_CONFIDENCE = 0.48;
const VOICE_INTERRUPTION_ACTIVITY_THRESHOLD = 0.02;
const VOICE_INTERRUPTION_PEAK_THRESHOLD = 0.05;
const VOICE_INTERRUPTION_RESUME_DELAY_MS = 12;
const VOICE_INTERRUPTION_FORCE_LISTEN_MS = 280;
const VOICE_INTERRUPTION_FORCE_LISTEN_ACTIVITY_SCORE = 1.28;
const VOICE_INTERRUPTION_FORCE_LISTEN_FRAMES = 6;
const VOICE_TRANSCRIPT_QUEUE_RETRY_MS = 140;
const VOICE_TRANSCRIPT_QUEUE_CLARIFY_DELAY_MS = 220;
const VOICE_TRANSCRIPT_PROCESS_CONFIDENCE_THRESHOLD = 0.44;
const VOICE_TRANSCRIPT_CLARIFY_CONFIDENCE_THRESHOLD = 0.34;
const VOICE_TRANSCRIPT_MIN_CLARIFY_CHARS = 8;
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
  const cleaned = compactText(question) || compactText(lectureLabel) || "Ready for your first question";
  return cleaned.length > 56 ? `${cleaned.slice(0, 53).trim()}...` : cleaned;
}

function resolveLectureAssistantVoiceRecognitionLocales() {
  return [...LECTURE_ASSISTANT_VOICE_RECOGNITION_LOCALES];
}

function resolveSpeechRecognitionLocales() {
  return [...LECTURE_ASSISTANT_VOICE_RECOGNITION_LOCALES];
}

function resolveSpeechLocale() {
  return resolveSpeechRecognitionLocales()[0] || LECTURE_ASSISTANT_VOICE_PRIMARY_LOCALE;
}

function resolveSpeechLanguageCode() {
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

function buildEnhancedMicrophoneConstraints() {
  const supportedConstraints = typeof navigator !== "undefined" && navigator.mediaDevices?.getSupportedConstraints
    ? navigator.mediaDevices.getSupportedConstraints()
    : {};
  const audioConstraints = {
    echoCancellation: supportedConstraints.echoCancellation ? { ideal: true } : true,
    noiseSuppression: supportedConstraints.noiseSuppression ? { ideal: true } : true,
    autoGainControl: supportedConstraints.autoGainControl ? { ideal: true } : true,
    channelCount: supportedConstraints.channelCount ? { ideal: 1, max: 1 } : 1,
    sampleRate: supportedConstraints.sampleRate ? { ideal: 16000 } : undefined,
    sampleSize: supportedConstraints.sampleSize ? { ideal: 16 } : undefined,
    latency: supportedConstraints.latency ? { ideal: 0.02, max: 0.08 } : undefined,
  };
  if (supportedConstraints.voiceIsolation) {
    audioConstraints.voiceIsolation = { ideal: true };
  }
  if (supportedConstraints.suppressLocalAudioPlayback) {
    audioConstraints.suppressLocalAudioPlayback = true;
  }
  return {
    audio: Object.fromEntries(
      Object.entries(audioConstraints).filter(([, value]) => typeof value !== "undefined"),
    ),
  };
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

function buildMessagePreview(content = "", fallback = "Ready for your first question") {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 110 ? `${text.slice(0, 107).trim()}...` : text;
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

function countTranscriptWords(transcript = "") {
  const cleaned = normalizeVoiceTranscript(transcript, { preserveCase: false });
  return cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
}

function estimateTextOverlapRatio(text = "", reference = "") {
  const normalizedText = normalizeVoiceTranscript(text, { preserveCase: false });
  const normalizedReference = normalizeVoiceTranscript(reference, { preserveCase: false });
  if (!normalizedText || !normalizedReference) return 0;
  const textWords = normalizedText.split(/\s+/).filter(Boolean);
  const referenceWords = new Set(normalizedReference.split(/\s+/).filter(Boolean));
  if (!textWords.length || !referenceWords.size) return 0;
  const overlap = textWords.filter((word) => referenceWords.has(word)).length;
  return clampNumber(overlap / Math.max(1, textWords.length), 0, 1);
}

function analyzeVoiceIntent({
  transcript = "",
  previewTranscript = "",
  spokenReference = "",
  transcriptConfidence = null,
} = {}) {
  const cleaned = normalizeVoiceTranscript(transcript);
  const normalized = cleaned.toLowerCase();
  const wordCount = countTranscriptWords(cleaned);
  const confidence = Number.isFinite(Number(transcriptConfidence))
    ? clampNumber(Number(transcriptConfidence), 0, 1)
    : estimateTranscriptConfidence(cleaned, previewTranscript);
  const echoOverlap = estimateTextOverlapRatio(cleaned, spokenReference);
  const previewOverlap = estimateTextOverlapRatio(cleaned, previewTranscript);

  if (!cleaned) {
    return {
      cleaned,
      score: 0,
      confidence,
      wordCount: 0,
      echoOverlap,
      previewOverlap,
      shouldProcess: false,
      shouldRetry: false,
      reason: "empty",
    };
  }

  let score = confidence * 0.36;
  if (wordCount >= 4) score += 0.12;
  if (wordCount >= 7) score += 0.08;
  if (/[?]$/.test(cleaned)) score += 0.08;
  if (/^(what|why|how|when|where|who|can|could|would|will|is|are|do|does|did|should|please|explain|summarize|define|compare|help|show|tell|give|walk|solve|read|list|quiz|test)\b/i.test(normalized)) {
    score += 0.18;
  }
  if (/\b(can you|could you|would you|please|help me|show me|tell me|explain|summarize|compare|walk me through|quiz me|test me)\b/i.test(normalized)) {
    score += 0.12;
  }
  if (/\b(mabaso|assistant|ai)\b/i.test(normalized)) score += 0.08;
  if (/^(stop|wait|hold on|pause|listen)\b/i.test(normalized)) score += 0.16;
  if (/^(yeah|yes|okay|ok|right|hmm|mm|uh|um|hello|hi)\b/i.test(normalized) && wordCount <= 3) {
    score -= 0.18;
  }
  if (/\b(he said|she said|they said|the movie|the show|breaking news|subscribe now)\b/i.test(normalized)) {
    score -= 0.14;
  }
  if (echoOverlap >= VOICE_ECHO_REJECTION_OVERLAP) {
    score -= 0.42;
  }
  if (previewOverlap >= 0.6 && wordCount <= 3) {
    score -= 0.08;
  }

  const boundedScore = clampNumber(score, 0, 1);
  const shortCommand = /^(stop|wait|pause|continue|hello|hi)\b/i.test(normalized);
  const shouldProcess = echoOverlap < VOICE_ECHO_REJECTION_OVERLAP
    && (
      boundedScore >= VOICE_TURN_INTENT_MIN_SCORE
      || (wordCount >= 6 && boundedScore >= 0.5)
      || (shortCommand && boundedScore >= 0.46)
    );
  const shouldRetry = !shouldProcess && boundedScore >= VOICE_TURN_INTENT_RETRY_SCORE;

  return {
    cleaned,
    score: boundedScore,
    confidence,
    wordCount,
    echoOverlap,
    previewOverlap,
    shouldProcess,
    shouldRetry,
    reason: echoOverlap >= VOICE_ECHO_REJECTION_OVERLAP ? "echo" : (shouldRetry ? "ambiguous" : "background"),
  };
}

function analyzeVoiceInterruptionIntent({
  transcript = "",
  spokenReference = "",
  transcriptConfidence = null,
  speechDurationMs = 0,
} = {}) {
  const baseAnalysis = analyzeVoiceIntent({
    transcript,
    spokenReference,
    transcriptConfidence,
  });
  const normalized = baseAnalysis.cleaned.toLowerCase();
  const interruptionCommand = /^(wait|hold on|stop|pause|listen|actually|sorry|no|but)\b/i.test(baseAnalysis.cleaned);
  const interruptionRedirect = /\b(i meant|what about|go back|start over|not that|one second|hang on|can you|could you|would you|explain|show me|tell me)\b/i.test(normalized);

  let boostedScore = baseAnalysis.score;
  if (interruptionCommand) boostedScore += 0.2;
  if (interruptionRedirect) boostedScore += 0.14;
  if (speechDurationMs >= VOICE_INTERRUPTION_MIN_SPEECH_MS) boostedScore += 0.05;
  if (baseAnalysis.wordCount >= 3) boostedScore += 0.04;
  boostedScore = clampNumber(boostedScore, 0, 1);

  const shouldInterrupt = baseAnalysis.echoOverlap < VOICE_ECHO_REJECTION_OVERLAP
    && (
      interruptionCommand
      || interruptionRedirect
      || boostedScore >= VOICE_INTERRUPTION_INTENT_MIN_SCORE
      || (
        speechDurationMs >= VOICE_INTERRUPTION_FORCE_SPEECH_MS
        && baseAnalysis.cleaned.length >= VOICE_INTERRUPTION_MIN_TRANSCRIPT_CHARS
        && boostedScore >= VOICE_INTERRUPTION_MIN_ACTIVITY_CONFIDENCE
      )
    );

  return {
    ...baseAnalysis,
    score: boostedScore,
    interruptionCommand,
    interruptionRedirect,
    shouldInterrupt,
  };
}

function mergeVoiceSeedTranscript(seedTranscript = "", transcript = "") {
  const seed = normalizeVoiceTranscript(seedTranscript);
  const nextTranscript = normalizeVoiceTranscript(transcript);
  if (!seed) return nextTranscript;
  if (!nextTranscript) return seed;
  const normalizedSeed = seed.toLowerCase();
  const normalizedTranscript = nextTranscript.toLowerCase();
  if (normalizedTranscript.startsWith(normalizedSeed) || normalizedTranscript.includes(normalizedSeed)) {
    return nextTranscript;
  }
  if (normalizedSeed.includes(normalizedTranscript)) {
    return seed;
  }
  return normalizeVoiceTranscript(`${seed} ${nextTranscript}`);
}

function buildSpeechFriendlyText(value = "") {
  let text = String(value || "");
  if (!text.trim()) return "";
  text = text
    .replace(/```[\s\S]*?```/g, " Code example shown in the chat. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\bhttps?:\/\/\S+/gi, " link ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\$\$?([^$]+)\$\$?/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/&/g, " and ")
    .replace(/\|/g, ", ")
    .replace(/[<>()[\]{}]/g, " ")
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

function buildOnnxWasmPaths(basePath = VOICE_VAD_ASSET_BASE_PATH) {
  const normalizedBasePath = compactText(basePath, VOICE_VAD_ASSET_BASE_PATH).replace(/\/?$/, "/");
  return {
    mjs: `${normalizedBasePath}ort-wasm-simd-threaded.mjs`,
    wasm: `${normalizedBasePath}ort-wasm-simd-threaded.wasm`,
  };
}

function buildLectureAssistantVoiceTranscriptionPrompt({
  lectureLabel = "",
  partialTranscript = "",
  contextHint = "",
} = {}) {
  return compactText(
    [
      "English only transcription.",
      "The student is asking a lecture question in English.",
      "Do not auto-detect another language.",
      "Do not translate or answer the question.",
      compactText(lectureLabel) ? `Lecture label: ${compactText(lectureLabel).slice(0, 100)}.` : "",
      compactText(contextHint) ? `Lecture topic hints: ${compactText(contextHint).slice(0, 220)}.` : "",
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

function extractReadySpeechChunks(buffer = "", { flush = false, maxChars = VOICE_STREAM_MAX_CHARS } = {}) {
  let remaining = String(buffer || "").replace(/\s+/g, " ").trim();
  const ready = [];
  const safeMaxChars = Math.max(VOICE_STREAM_MIN_CHARS, Number(maxChars) || VOICE_STREAM_MAX_CHARS);

  while (remaining) {
    const punctuationMatch = remaining.match(/^([\s\S]*?[.!?](?=\s|$))/);
    if (punctuationMatch?.[1]) {
      ready.push(punctuationMatch[1].trim());
      remaining = remaining.slice(punctuationMatch[1].length).trimStart();
      continue;
    }

    if (remaining.length >= safeMaxChars) {
      const candidate = remaining.slice(0, safeMaxChars);
      const splitIndex = Math.max(
        candidate.lastIndexOf(". "),
        candidate.lastIndexOf("? "),
        candidate.lastIndexOf("! "),
        candidate.lastIndexOf(", "),
        candidate.lastIndexOf("; "),
        candidate.lastIndexOf(": "),
        candidate.lastIndexOf(" "),
      );
      const boundary = splitIndex >= VOICE_STREAM_MIN_CHARS ? splitIndex + 1 : safeMaxChars;
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

function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function buildConversationPreview(messages = [], fallback = "") {
  const latestMessage = [...messages].reverse().find((message) => compactText(message?.content));
  return buildMessagePreview(latestMessage?.content || "", fallback);
}

function createConversationRecord({
  id = "",
  contextKey = "",
  lectureLabel = "",
  title = "Ready for your first question",
  messages = [],
  previewText = "",
  lastMessagePreview = "",
  messageCount = 0,
  isPinned = false,
  isArchived = false,
  createdAt = "",
  updatedAt = "",
  lastMessageAt = "",
  memorySummary = "",
  metadata = {},
  hasMoreMessages = false,
  nextBefore = "",
  source = "local",
  isDraft = true,
} = {}) {
  const timestamp = nowIso();
  const normalizedMessages = Array.isArray(messages) ? messages : [];
  const effectiveCreatedAt = compactText(createdAt, timestamp);
  const effectiveUpdatedAt = compactText(updatedAt, normalizedMessages[normalizedMessages.length - 1]?.timestamp || effectiveCreatedAt);
  return {
    id: compactText(id, createClientId("conversation")),
    title: compactText(title, deriveConversationTitle("", lectureLabel)),
    lectureLabel: compactText(lectureLabel),
    contextKey: compactText(contextKey),
    createdAt: effectiveCreatedAt,
    updatedAt: effectiveUpdatedAt,
    lastMessageAt: compactText(lastMessageAt, effectiveUpdatedAt),
    previewText: compactText(previewText, buildConversationPreview(normalizedMessages)),
    lastMessagePreview: compactText(lastMessagePreview, compactText(previewText, buildConversationPreview(normalizedMessages))),
    messageCount: Math.max(normalizedMessages.length, Number(messageCount) || 0),
    isPinned: normalizeBoolean(isPinned),
    isArchived: normalizeBoolean(isArchived),
    memorySummary: compactText(memorySummary),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    hasMoreMessages: normalizeBoolean(hasMoreMessages),
    nextBefore: compactText(nextBefore),
    source: compactText(source, "local"),
    isDraft: normalizeBoolean(isDraft, source !== "server"),
    messages: normalizedMessages,
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
    .sort((left, right) => {
      if (Boolean(right.isPinned) !== Boolean(left.isPinned)) {
        return Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned));
      }
      return new Date(right.updatedAt || right.lastMessageAt || 0).getTime() - new Date(left.updatedAt || left.lastMessageAt || 0).getTime();
    })
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

  return createConversationRecord({
    id,
    title: compactText(rawConversation.title, messages.find((message) => message.role === "user")?.content || "Ready for your first question"),
    lectureLabel: compactText(rawConversation.lectureLabel),
    contextKey: compactText(rawConversation.contextKey),
    createdAt,
    updatedAt,
    lastMessageAt: compactText(rawConversation.lastMessageAt, updatedAt),
    previewText: compactText(rawConversation.previewText),
    lastMessagePreview: compactText(rawConversation.lastMessagePreview),
    messageCount: Number(rawConversation.messageCount) || messages.length,
    isPinned: Boolean(rawConversation.isPinned),
    isArchived: Boolean(rawConversation.isArchived),
    memorySummary: compactText(rawConversation.memorySummary),
    metadata: rawConversation.metadata && typeof rawConversation.metadata === "object" ? rawConversation.metadata : {},
    hasMoreMessages: Boolean(rawConversation.hasMoreMessages),
    nextBefore: compactText(rawConversation.nextBefore),
    source: compactText(rawConversation.source, messages.length ? "local" : "server"),
    isDraft: normalizeBoolean(rawConversation.isDraft, !messages.length && compactText(rawConversation.source) !== "server"),
    messages,
  });
}

function conversationMatchesSearch(conversation, query = "") {
  const normalizedQuery = compactText(query).toLowerCase();
  if (!normalizedQuery) return true;
  const haystack = [
    conversation?.title,
    conversation?.previewText,
    conversation?.lastMessagePreview,
    conversation?.memorySummary,
    conversation?.lectureLabel,
    ...(Array.isArray(conversation?.messages) ? conversation.messages.map((message) => message?.content) : []),
  ]
    .map((value) => compactText(value).toLowerCase())
    .filter(Boolean)
    .join(" ");
  return haystack.includes(normalizedQuery);
}

function mergeConversationRecord(existingConversation, incomingConversation, { source = "server" } = {}) {
  const normalizedIncoming = normalizeConversationRecord({
    ...(incomingConversation || {}),
    source: compactText(incomingConversation?.source, source),
    isDraft: normalizeBoolean(incomingConversation?.isDraft, compactText(incomingConversation?.source, source) !== "server"),
  });
  if (!normalizedIncoming) return existingConversation || null;

  const existingMessages = Array.isArray(existingConversation?.messages) ? existingConversation.messages : [];
  const incomingMessages = Array.isArray(normalizedIncoming.messages) ? normalizedIncoming.messages : [];
  const mergedMessages = incomingMessages.length ? incomingMessages : existingMessages;
  const mergedMetadata = {
    ...(existingConversation?.metadata && typeof existingConversation.metadata === "object" ? existingConversation.metadata : {}),
    ...(normalizedIncoming.metadata && typeof normalizedIncoming.metadata === "object" ? normalizedIncoming.metadata : {}),
  };
  const effectiveSource = compactText(normalizedIncoming.source, compactText(existingConversation?.source, source));

  return createConversationRecord({
    ...(existingConversation || {}),
    ...normalizedIncoming,
    title: compactText(normalizedIncoming.title, compactText(existingConversation?.title, "Ready for your first question")),
    lectureLabel: compactText(normalizedIncoming.lectureLabel, compactText(existingConversation?.lectureLabel)),
    contextKey: compactText(normalizedIncoming.contextKey, compactText(existingConversation?.contextKey)),
    messages: mergedMessages,
    previewText: compactText(
      normalizedIncoming.previewText,
      compactText(existingConversation?.previewText, buildConversationPreview(mergedMessages)),
    ),
    lastMessagePreview: compactText(
      normalizedIncoming.lastMessagePreview,
      compactText(existingConversation?.lastMessagePreview, buildConversationPreview(mergedMessages)),
    ),
    messageCount: Math.max(
      Number(normalizedIncoming.messageCount) || 0,
      Number(existingConversation?.messageCount) || 0,
      mergedMessages.length,
    ),
    hasMoreMessages: normalizeBoolean(
      normalizedIncoming.hasMoreMessages,
      normalizeBoolean(existingConversation?.hasMoreMessages),
    ),
    nextBefore: compactText(normalizedIncoming.nextBefore, compactText(existingConversation?.nextBefore)),
    memorySummary: compactText(normalizedIncoming.memorySummary, compactText(existingConversation?.memorySummary)),
    source: effectiveSource,
    isDraft: normalizeBoolean(normalizedIncoming.isDraft, effectiveSource !== "server"),
    metadata: mergedMetadata,
  });
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
  requestConversationList,
  requestConversation,
  requestConversationMessages,
  requestConversationUpdate,
  requestConversationDelete,
  requestConversationExport,
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
  const legacyStorageKey = useMemo(
    () => buildConversationStorageKey(authEmail).replace(ASSISTANT_STORAGE_PREFIX, LEGACY_ASSISTANT_STORAGE_PREFIX),
    [authEmail],
  );
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [isLoadingConversationMessages, setIsLoadingConversationMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [isSyncingConversation, setIsSyncingConversation] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [totalConversationCount, setTotalConversationCount] = useState(0);
  const [speechVoices, setSpeechVoices] = useState([]);
  const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useState("wave");
  const [voicePreviewDraft, setVoicePreviewDraft] = useState(VOICE_DEFAULT_PREVIEW_TEXT);
  const [previewingVoiceId, setPreviewingVoiceId] = useState("");
  const [isPreparingVoicePreview, setIsPreparingVoicePreview] = useState(false);
  const [voiceListeningEngine, setVoiceListeningEngine] = useState("Hybrid English voice mode");
  const [voiceTranscriptConfidence, setVoiceTranscriptConfidence] = useState(0);
  const [voiceTranscriptSource, setVoiceTranscriptSource] = useState("idle");
  const [assistantAudioState, setAssistantAudioState] = useState("idle");
  const [voiceInterrupted, setVoiceInterrupted] = useState(false);
  const [isProcessingVoiceTurn, setIsProcessingVoiceTurn] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const remoteSyncAvailable = Boolean(
    compactText(authEmail)
    && typeof requestConversationList === "function"
    && typeof requestConversation === "function",
  );

  const hasLoadedStorageRef = useRef(false);
  const lastContextKeyRef = useRef("");
  const remoteSyncEnabledRef = useRef(false);
  const remoteHydratedRef = useRef(false);
  const searchTimerRef = useRef(0);
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
  const voicePreviewMuteUntilRef = useRef(0);
  const sileroVadModuleRef = useRef(null);
  const sileroVadImportPromiseRef = useRef(null);
  const sileroVadInstanceRef = useRef(null);
  const sileroVadEnabledRef = useRef(false);
  const previewVoiceRunRef = useRef(0);
  const selectedVoiceProfileRef = useRef(null);
  const previewResumeStateRef = useRef({ shouldResumeListening: false, continueVoiceChat: false });
  const voiceSpeechReferenceRef = useRef("");
  const voiceInterruptionRecognitionRef = useRef(null);
  const voiceInterruptionMonitorStreamRef = useRef(null);
  const voiceInterruptionMonitorContextRef = useRef(null);
  const voiceInterruptionMonitorAnalyserRef = useRef(null);
  const voiceInterruptionMonitorFrameRef = useRef(0);
  const voiceInterruptionMonitorRunRef = useRef(0);
  const voiceInterruptionMonitorStartingRef = useRef(false);
  const voiceInterruptionSeedRef = useRef("");
  const voiceInterruptionTranscriptRef = useRef("");
  const voiceInterruptionSpeechStartedAtRef = useRef(0);
  const voiceInterruptionResetTimerRef = useRef(0);
  const voiceLastInterruptionAtRef = useRef(0);
  const isGeneratingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const sendMessageRef = useRef(null);
  const voiceTranscriptQueueRef = useRef([]);
  const voiceTranscriptQueueTimerRef = useRef(0);
  const voiceTranscriptQueueBusyRef = useRef(false);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0] || null,
    [activeConversationId, conversations],
  );
  const messages = activeConversation?.messages || [];
  const serverConversationCount = useMemo(
    () => conversations.filter((conversation) => compactText(conversation?.source) === "server" && !conversation?.isDraft).length,
    [conversations],
  );
  const canLoadMoreConversations = remoteSyncAvailable && serverConversationCount < totalConversationCount;
  const voiceProfiles = useMemo(() => buildVoiceProfileOptions(speechVoices), [speechVoices]);
  const selectedVoiceProfile = useMemo(
    () => resolveVoiceProfile(voiceProfiles, selectedVoiceProfileId),
    [selectedVoiceProfileId, voiceProfiles],
  );
  const voiceTranscriptionContextHint = useMemo(
    () => [
      compactText(lectureLabel),
      compactText(summary).slice(0, 160),
      compactText(formulas).slice(0, 120),
      compactText(workedExamples).slice(0, 120),
      compactText(lectureNotes).slice(0, 120),
      compactText(lectureSlides).slice(0, 120),
    ].filter(Boolean).join(" "),
    [formulas, lectureLabel, lectureNotes, lectureSlides, summary, workedExamples],
  );

  const isVoicePreviewMuted = () => Date.now() < voicePreviewMuteUntilRef.current;

  const markVoiceInterrupted = () => {
    if (typeof window !== "undefined") {
      window.clearTimeout(voiceInterruptionResetTimerRef.current);
      voiceInterruptionResetTimerRef.current = window.setTimeout(() => {
        voiceInterruptionResetTimerRef.current = 0;
        setVoiceInterrupted(false);
      }, VOICE_INTERRUPTION_COOLDOWN_MS);
    }
    voiceLastInterruptionAtRef.current = Date.now();
    setVoiceInterrupted(true);
  };

  const clearPreviewResumeState = () => {
    previewResumeStateRef.current = { shouldResumeListening: false, continueVoiceChat: false };
  };

  const rememberPreviewResumeState = () => {
    previewResumeStateRef.current = {
      shouldResumeListening: Boolean(isListening || voiceModeEnabledRef.current),
      continueVoiceChat: Boolean(voiceModeEnabledRef.current),
    };
  };

  const appendSpokenReference = (text = "") => {
    const cleaned = compactText(buildSpeechFriendlyText(text));
    if (!cleaned) return;
    const combined = compactText(`${voiceSpeechReferenceRef.current} ${cleaned}`.trim());
    voiceSpeechReferenceRef.current = combined.slice(-VOICE_RECENT_SPOKEN_REFERENCE_LIMIT);
  };

  const stopVoiceInterruptionRecognition = () => {
    if (!voiceInterruptionRecognitionRef.current) return;
    try {
      voiceInterruptionRecognitionRef.current.onresult = null;
      voiceInterruptionRecognitionRef.current.onerror = null;
      voiceInterruptionRecognitionRef.current.onend = null;
      voiceInterruptionRecognitionRef.current.stop();
    } catch {
      // Ignore speech-recognition shutdown errors.
    }
    voiceInterruptionRecognitionRef.current = null;
  };

  const stopVoiceInterruptionMonitor = () => {
    voiceInterruptionMonitorRunRef.current += 1;
    voiceInterruptionMonitorStartingRef.current = false;
    voiceInterruptionTranscriptRef.current = "";
    voiceInterruptionSpeechStartedAtRef.current = 0;
    if (typeof window !== "undefined") {
      window.cancelAnimationFrame?.(voiceInterruptionMonitorFrameRef.current);
      voiceInterruptionMonitorFrameRef.current = 0;
    }
    if (voiceInterruptionMonitorContextRef.current) {
      try {
        voiceInterruptionMonitorContextRef.current.close();
      } catch {
        // Ignore interruption-monitor audio-context shutdown failures.
      }
      voiceInterruptionMonitorContextRef.current = null;
    }
    if (voiceInterruptionMonitorStreamRef.current) {
      try {
        voiceInterruptionMonitorStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignore interruption-monitor stream shutdown failures.
      }
      voiceInterruptionMonitorStreamRef.current = null;
    }
    voiceInterruptionMonitorAnalyserRef.current = null;
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined") {
      window.clearTimeout(speechRestartTimerRef.current);
      window.clearTimeout(voiceReplyChunkTimerRef.current);
    }
    stopVoiceInterruptionRecognition();
    stopVoiceInterruptionMonitor();
    voiceReplyRunRef.current += 1;
    previewVoiceRunRef.current += 1;
    voiceSpeechQueueRef.current = [];
    voiceSpeechBufferRef.current = "";
    voiceSpeechPlaybackActiveRef.current = false;
    voiceSpeechStreamDoneRef.current = false;
    voiceSpeechReferenceRef.current = "";
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPreviewingVoiceId("");
    setIsPreparingVoicePreview(false);
    setIsSpeaking(false);
  };

  const resolveSpeechSynthesisVoiceForProfile = (profile = selectedVoiceProfileRef.current) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const browserVoices = window.speechSynthesis.getVoices?.() || [];
    const normalizedVoiceUri = compactText(profile?.voiceURI);
    if (normalizedVoiceUri) {
      const exactMatch = browserVoices.find((voice) => compactText(voice?.voiceURI) === normalizedVoiceUri);
      if (exactMatch) return exactMatch;
    }
    return pickSpeechSynthesisVoice(
      compactText(profile?.voiceLang, compactText(profile?.locale, LECTURE_ASSISTANT_VOICE_PRIMARY_LOCALE)),
      browserVoices,
      { englishOnly: true },
    ) || null;
  };

  const resolveVoicePlaybackProfile = (profile = selectedVoiceProfileRef.current) => ({
    locale: compactText(profile?.voiceLang, compactText(profile?.locale, LECTURE_ASSISTANT_VOICE_PRIMARY_LOCALE)),
    voice: resolveSpeechSynthesisVoiceForProfile(profile),
    rate: Number(profile?.rate) || 1,
    pitch: Number(profile?.pitch) || 1,
    chunkPauseMs: Number(profile?.chunkPauseMs) || VOICE_REPLY_CHUNK_PAUSE_MS,
    streamMaxChars: Number(profile?.streamMaxChars) || VOICE_STREAM_MAX_CHARS,
  });

  const loadSileroVadModule = async () => {
    if (sileroVadModuleRef.current) return sileroVadModuleRef.current;
    if (sileroVadImportPromiseRef.current) return sileroVadImportPromiseRef.current;
    sileroVadImportPromiseRef.current = import("@ricky0123/vad-web")
      .then((module) => {
        sileroVadModuleRef.current = module;
        return module;
      })
      .finally(() => {
        sileroVadImportPromiseRef.current = null;
      });
    return sileroVadImportPromiseRef.current;
  };

  const destroySileroVad = async () => {
    sileroVadEnabledRef.current = false;
    const activeVad = sileroVadInstanceRef.current;
    sileroVadInstanceRef.current = null;
    if (!activeVad) return;
    try {
      await activeVad.destroy?.();
    } catch {
      // Ignore Silero VAD teardown failures.
    }
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
    void destroySileroVad();
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

  const pauseVoiceInputForPreview = () => {
    rememberPreviewResumeState();
    if (typeof window !== "undefined") {
      window.clearTimeout(speechRestartTimerRef.current);
      speechRestartTimerRef.current = 0;
    }
    clearVoiceListeningTimer();
    setIsVoiceReconnecting(false);
    if (recognitionRef.current || isListening || voiceInputModeRef.current === "whisper") {
      stopListening();
    }
  };

  const resumeVoiceInputAfterPreview = ({ fallbackMessage = "Voice preview finished." } = {}) => {
    const resumeState = { ...previewResumeStateRef.current };
    clearPreviewResumeState();
    if (!resumeState.shouldResumeListening) {
      if (!isGeneratingRef.current && !isSpeakingRef.current) {
        setStatusText(fallbackMessage);
      }
      return;
    }
    if (typeof window === "undefined") return;
    const delayMs = Math.max(
      VOICE_PREVIEW_RESUME_DELAY_MS,
      Math.max(voicePreviewMuteUntilRef.current - Date.now(), 0) + 140,
    );
    window.clearTimeout(speechRestartTimerRef.current);
    speechRestartTimerRef.current = window.setTimeout(() => {
      speechRestartTimerRef.current = 0;
      if (isVoicePreviewMuted()) {
        resumeVoiceInputAfterPreview({ fallbackMessage });
        return;
      }
      startListening({ continueVoiceChat: resumeState.continueVoiceChat });
    }, delayMs);
    setStatusText("Preview finished. Restoring listening...");
  };

  const attemptVoiceInterruption = ({
    transcript = voiceInterruptionTranscriptRef.current,
    speechDurationMs = 0,
    activityConfidence = 0,
    speechFrameCount = 0,
  } = {}) => {
    if (voiceInterruptionRequestedRef.current) return true;
    const normalizedTranscript = normalizeVoiceTranscript(transcript);
    const transcriptWordCount = countTranscriptWords(normalizedTranscript);
    const hasTranscriptIntentHint = /^(wait|hold on|stop|pause|listen|actually|sorry|no|but|can|could|would|what|why|how|when|where|who|hey|hello|excuse me|explain|show|tell|help)\b/i.test(normalizedTranscript);
    const shouldForceListen = speechDurationMs >= VOICE_INTERRUPTION_FORCE_LISTEN_MS
      && speechFrameCount >= VOICE_INTERRUPTION_FORCE_LISTEN_FRAMES
      && activityConfidence >= VOICE_INTERRUPTION_FORCE_LISTEN_ACTIVITY_SCORE
      && (
        !normalizedTranscript
        || hasTranscriptIntentHint
        || transcriptWordCount >= 2
      );
    if (!normalizedTranscript && !shouldForceListen && speechDurationMs < VOICE_INTERRUPTION_FORCE_SPEECH_MS) return false;
    const transcriptConfidence = normalizedTranscript
      ? estimateTranscriptConfidence(normalizedTranscript)
      : 0;
    const analysis = analyzeVoiceInterruptionIntent({
      transcript: normalizedTranscript,
      spokenReference: voiceSpeechReferenceRef.current,
      transcriptConfidence,
      speechDurationMs,
    });
    const shouldSpeculativelyInterrupt = shouldForceListen
      && (
        !normalizedTranscript
        || analysis.shouldRetry
        || analysis.confidence >= 0.4
        || hasTranscriptIntentHint
      );
    if (!analysis.shouldInterrupt && !shouldSpeculativelyInterrupt) return false;
    if (
      !shouldSpeculativelyInterrupt
      && !shouldForceListen
      && !analysis.interruptionCommand
      && !analysis.interruptionRedirect
      && analysis.cleaned.length < VOICE_INTERRUPTION_MIN_TRANSCRIPT_CHARS
    ) {
      return false;
    }
    triggerVoiceInterruption(analysis.cleaned || normalizedTranscript);
    return true;
  };

  const triggerVoiceInterruption = (capturedTranscript = "") => {
    if (Date.now() - voiceLastInterruptionAtRef.current < VOICE_INTERRUPTION_COOLDOWN_MS) return;
    const normalizedSeed = normalizeVoiceTranscript(capturedTranscript);
    const interruptionMessage = normalizedSeed
      ? "Interrupted. Listening for the rest of your request..."
      : "Interrupted. Listening...";
    if (normalizedSeed) {
      voiceInterruptionSeedRef.current = normalizedSeed;
      setDraft(normalizedSeed);
    }
    voiceInterruptionRequestedRef.current = true;
    markVoiceInterrupted();
    setStatusText(interruptionMessage);
    stopSpeaking();
    if (typeof window !== "undefined") {
      window.clearTimeout(speechRestartTimerRef.current);
      speechRestartTimerRef.current = window.setTimeout(() => {
        speechRestartTimerRef.current = 0;
        startListening({ continueVoiceChat: true, allowInterruptionResume: true });
      }, VOICE_INTERRUPTION_RESUME_DELAY_MS);
    }
    if (isGeneratingRef.current) {
      stopGenerating({ preserveVoiceMode: true, restartListening: false });
      return;
    }
  };

  const startVoiceInterruptionRecognition = (runId) => {
    if (
      typeof window === "undefined"
      || isVoicePreviewMuted()
      || !voiceModeEnabledRef.current
      || voiceInterruptionRecognitionRef.current
    ) {
      return;
    }
    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) return;

    try {
      const recognition = new RecognitionCtor();
      recognition.lang = resolveSpeechLocale();
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        let heardText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcriptText = compactText(result?.[0]?.transcript);
          if (!transcriptText) continue;
          heardText += `${transcriptText} `;
        }
        voiceInterruptionTranscriptRef.current = normalizeVoiceTranscript(heardText);
        const speechDurationMs = voiceInterruptionSpeechStartedAtRef.current
          ? Date.now() - voiceInterruptionSpeechStartedAtRef.current
          : 0;
        void attemptVoiceInterruption({
          transcript: voiceInterruptionTranscriptRef.current,
          speechDurationMs,
        });
      };
      recognition.onerror = () => {
        // Auto-interruption is best-effort. Button interruption still works even if this fails.
      };
      recognition.onend = () => {
        if (voiceInterruptionRecognitionRef.current !== recognition) return;
        voiceInterruptionRecognitionRef.current = null;
        if (
          voiceReplyRunRef.current !== runId
          || isVoicePreviewMuted()
          || !voiceModeEnabledRef.current
        ) {
          return;
        }
        startVoiceInterruptionRecognition(runId);
      };
      voiceInterruptionRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      voiceInterruptionRecognitionRef.current = null;
    }
  };

  const startVoiceInterruptionMonitor = async (runId) => {
    if (
      typeof window === "undefined"
      || typeof navigator === "undefined"
      || !navigator.mediaDevices?.getUserMedia
      || isVoicePreviewMuted()
      || !voiceModeEnabledRef.current
      || voiceInterruptionMonitorStreamRef.current
      || voiceInterruptionMonitorStartingRef.current
    ) {
      return;
    }

    const monitorRunId = voiceInterruptionMonitorRunRef.current + 1;
    voiceInterruptionMonitorRunRef.current = monitorRunId;
    voiceInterruptionMonitorStartingRef.current = true;
    voiceInterruptionTranscriptRef.current = "";
    voiceInterruptionSpeechStartedAtRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia(buildEnhancedMicrophoneConstraints());
      if (
        monitorRunId !== voiceInterruptionMonitorRunRef.current
        || runId !== voiceReplyRunRef.current
        || isVoicePreviewMuted()
        || !voiceModeEnabledRef.current
      ) {
        voiceInterruptionMonitorStartingRef.current = false;
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        voiceInterruptionMonitorStartingRef.current = false;
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const audioContext = new AudioContextCtor({ sampleRate: 16000 });
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNode.connect(analyser);

      voiceInterruptionMonitorStartingRef.current = false;
      voiceInterruptionMonitorStreamRef.current = stream;
      voiceInterruptionMonitorContextRef.current = audioContext;
      voiceInterruptionMonitorAnalyserRef.current = analyser;

      const audioSampleBuffer = new Uint8Array(analyser.fftSize);
      let noiseFloorRms = VOICE_VAD_MIN_NOISE_FLOOR;
      let noiseFloorPeak = VOICE_INTERRUPTION_ACTIVITY_THRESHOLD;
      let activeFrameCount = 0;
      let silenceFrameCount = 0;
      let speechDetected = false;
      let strongestActivityConfidence = 0;

      const monitorInterruption = () => {
        if (
          monitorRunId !== voiceInterruptionMonitorRunRef.current
          || runId !== voiceReplyRunRef.current
          || isVoicePreviewMuted()
          || !voiceModeEnabledRef.current
        ) {
          return;
        }

        const activeAnalyser = voiceInterruptionMonitorAnalyserRef.current;
        if (!activeAnalyser) return;

        activeAnalyser.getByteTimeDomainData(audioSampleBuffer);
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
          VOICE_INTERRUPTION_ACTIVITY_THRESHOLD,
          VOICE_VAD_MIN_NOISE_FLOOR,
          noiseFloorRms * VOICE_VAD_RMS_MULTIPLIER,
        );
        const dynamicPeakThreshold = Math.max(
          VOICE_INTERRUPTION_PEAK_THRESHOLD,
          noiseFloorPeak * VOICE_VAD_PEAK_MULTIPLIER,
        );
        const isSpeechFrame = rms >= dynamicRmsThreshold || peak >= dynamicPeakThreshold;
        const activityConfidence = Math.max(
          dynamicRmsThreshold > 0 ? rms / dynamicRmsThreshold : 0,
          dynamicPeakThreshold > 0 ? peak / dynamicPeakThreshold : 0,
        );

        if (!isSpeechFrame) {
          noiseFloorRms = clampNumber(
            noiseFloorRms + (rms - noiseFloorRms) * VOICE_VAD_NOISE_FLOOR_SMOOTHING,
            VOICE_VAD_MIN_NOISE_FLOOR,
            VOICE_INTERRUPTION_ACTIVITY_THRESHOLD,
          );
          noiseFloorPeak = clampNumber(
            noiseFloorPeak + (peak - noiseFloorPeak) * VOICE_VAD_NOISE_FLOOR_SMOOTHING,
            VOICE_INTERRUPTION_ACTIVITY_THRESHOLD,
            VOICE_INTERRUPTION_PEAK_THRESHOLD,
          );
        }

        if (isSpeechFrame) {
          activeFrameCount += 1;
          silenceFrameCount = 0;
          strongestActivityConfidence = Math.max(strongestActivityConfidence, activityConfidence);
          if (activeFrameCount >= VOICE_INTERRUPTION_MIN_ACTIVE_FRAMES) {
            if (!speechDetected) {
              speechDetected = true;
              voiceInterruptionSpeechStartedAtRef.current = Date.now();
            }
            const speechDurationMs = voiceInterruptionSpeechStartedAtRef.current
              ? Date.now() - voiceInterruptionSpeechStartedAtRef.current
              : 0;
            void attemptVoiceInterruption({
              transcript: voiceInterruptionTranscriptRef.current,
              speechDurationMs,
              activityConfidence: strongestActivityConfidence,
              speechFrameCount: activeFrameCount,
            });
          }
        } else {
          activeFrameCount = 0;
          if (speechDetected) {
            silenceFrameCount += 1;
            if (silenceFrameCount >= VOICE_INTERRUPTION_MIN_SILENCE_FRAMES) {
              speechDetected = false;
              silenceFrameCount = 0;
              strongestActivityConfidence = 0;
              voiceInterruptionSpeechStartedAtRef.current = 0;
              voiceInterruptionTranscriptRef.current = "";
            }
          } else {
            strongestActivityConfidence = 0;
          }
        }

        voiceInterruptionMonitorFrameRef.current = window.requestAnimationFrame(monitorInterruption);
      };

      voiceInterruptionMonitorFrameRef.current = window.requestAnimationFrame(monitorInterruption);
    } catch {
      stopVoiceInterruptionMonitor();
    }
  };

  const previewVoiceProfile = ({
    profileId = selectedVoiceProfileRef.current?.id,
    customText = "",
    updateDraft = false,
  } = {}) => {
    const profile = resolveVoiceProfile(voiceProfiles, profileId);
    if (!profile) return false;
    const previewText = compactText(buildSpeechFriendlyText(buildVoicePreviewText(profile, customText)));
    if (!previewText) return false;
    if (updateDraft) {
      setVoicePreviewDraft(compactText(customText, previewText));
    }
    if (typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      setStatusText("Voice previews need browser speech synthesis support.");
      return false;
    }
    if (isGenerating) {
      setStatusText("Finish or interrupt the current reply before previewing a voice.");
      return false;
    }

    const previewMuteMs = Math.max(3200, previewText.length * 68);
    voicePreviewMuteUntilRef.current = Date.now() + previewMuteMs;
    pauseVoiceInputForPreview();
    stopSpeaking();
    const playbackProfile = resolveVoicePlaybackProfile(profile);
    const runId = previewVoiceRunRef.current + 1;
    previewVoiceRunRef.current = runId;
    setPreviewingVoiceId(profile.id);
    setIsPreparingVoicePreview(true);

    const utterance = new window.SpeechSynthesisUtterance(previewText);
    utterance.lang = compactText(playbackProfile.locale, LECTURE_ASSISTANT_VOICE_PRIMARY_LOCALE);
    utterance.voice = playbackProfile.voice;
    utterance.rate = playbackProfile.rate;
    utterance.pitch = playbackProfile.pitch;
    utterance.onstart = () => {
      if (previewVoiceRunRef.current !== runId) return;
      setIsPreparingVoicePreview(false);
      setStatusText(`Previewing ${profile.name}.`);
    };
    utterance.onend = () => {
      if (previewVoiceRunRef.current !== runId) return;
      voicePreviewMuteUntilRef.current = Math.max(voicePreviewMuteUntilRef.current, Date.now() + 700);
      setPreviewingVoiceId("");
      setIsPreparingVoicePreview(false);
      resumeVoiceInputAfterPreview();
    };
    utterance.onerror = () => {
      if (previewVoiceRunRef.current !== runId) return;
      voicePreviewMuteUntilRef.current = Date.now() + 500;
      setPreviewingVoiceId("");
      setIsPreparingVoicePreview(false);
      resumeVoiceInputAfterPreview({ fallbackMessage: "That voice preview could not play in this browser." });
    };

    window.speechSynthesis.speak(utterance);
    return true;
  };

  const selectVoiceProfile = (profileId, { preview = true } = {}) => {
    const profile = resolveVoiceProfile(voiceProfiles, profileId);
    if (!profile) return false;
    setSelectedVoiceProfileId(profile.id);
    if (preview) {
      window.setTimeout(() => {
        previewVoiceProfile({ profileId: profile.id });
      }, 40);
    }
    return true;
  };

  const previewSelectedVoiceWithDraft = () => previewVoiceProfile({
    profileId: selectedVoiceProfileRef.current?.id,
    customText: voicePreviewDraft,
    updateDraft: true,
  });

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
    stopVoiceInterruptionRecognition();
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

  const playNextVoiceSpeechChunk = (runId, playbackProfile) => {
    if (voiceReplyRunRef.current !== runId) return;
    if (voiceSpeechPlaybackActiveRef.current) return;
    const nextChunk = voiceSpeechQueueRef.current.shift();
    if (!nextChunk) {
      finalizeVoiceReplyIfReady(runId);
      return;
    }
    voiceSpeechPlaybackActiveRef.current = true;
    const utterance = new window.SpeechSynthesisUtterance(nextChunk);
    utterance.lang = compactText(playbackProfile?.locale, LECTURE_ASSISTANT_VOICE_PRIMARY_LOCALE);
    utterance.voice = playbackProfile?.voice || null;
    utterance.rate = Number(playbackProfile?.rate) || 1.03;
    utterance.pitch = Number(playbackProfile?.pitch) || 1;
    utterance.onstart = () => {
      if (voiceReplyRunRef.current !== runId) return;
      appendSpokenReference(nextChunk);
      startVoiceInterruptionRecognition(runId);
      void startVoiceInterruptionMonitor(runId);
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
          : Number(playbackProfile?.chunkPauseMs) || VOICE_REPLY_CHUNK_PAUSE_MS;
      voiceReplyChunkTimerRef.current = window.setTimeout(() => {
        voiceReplyChunkTimerRef.current = 0;
        playNextVoiceSpeechChunk(runId, playbackProfile);
      }, trailingPauseMs);
    };
    utterance.onerror = () => {
      if (voiceReplyRunRef.current !== runId) return;
      stopVoiceInterruptionRecognition();
      voiceSpeechPlaybackActiveRef.current = false;
      setIsSpeaking(false);
      if (voiceModeEnabledRef.current) {
        applyVoiceModeEnabled(false);
      }
      setStatusText("The reply is ready, but browser text-to-speech could not play it.");
    };
    window.speechSynthesis.speak(utterance);
  };

  const queueVoiceSpeechFromText = (textFragment = "", { flush = false, maxChars = VOICE_STREAM_MAX_CHARS } = {}) => {
    const fragment = String(textFragment || "");
    if (!fragment && !flush) return;
    voiceSpeechBufferRef.current = `${voiceSpeechBufferRef.current}${fragment}`;
    const { ready, remaining } = extractReadySpeechChunks(voiceSpeechBufferRef.current, { flush, maxChars });
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
    const playbackProfile = resolveVoicePlaybackProfile();
    const runId = voiceReplyRunRef.current + 1;
    voiceReplyRunRef.current = runId;
    voiceSpeechQueueRef.current = [];
    voiceSpeechBufferRef.current = "";
    voiceSpeechPlaybackActiveRef.current = false;
    voiceSpeechStreamDoneRef.current = false;
    return {
      runId,
      enqueueText: (fragment = "", options = {}) => {
        queueVoiceSpeechFromText(fragment, {
          ...options,
          maxChars: Number(playbackProfile?.streamMaxChars) || VOICE_STREAM_MAX_CHARS,
        });
        playNextVoiceSpeechChunk(runId, playbackProfile);
      },
      markDone: () => {
        voiceSpeechStreamDoneRef.current = true;
        queueVoiceSpeechFromText("", {
          flush: true,
          maxChars: Number(playbackProfile?.streamMaxChars) || VOICE_STREAM_MAX_CHARS,
        });
        playNextVoiceSpeechChunk(runId, playbackProfile);
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
    stopVoiceInterruptionRecognition();
    stopVoiceInterruptionMonitor();
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
    if (typeof window !== "undefined") {
      window.clearTimeout(voiceTranscriptQueueTimerRef.current);
      voiceTranscriptQueueTimerRef.current = 0;
    }
    clearVoiceListeningTimer();
    voiceInterruptionRequestedRef.current = false;
    voiceTranscriptQueueRef.current = [];
    voiceTranscriptQueueBusyRef.current = false;
    speechRecognitionErrorRef.current = "";
    recognitionStopReasonRef.current = "";
    ignoreRecognitionEndRef.current = false;
    manualRecognitionStopRef.current = false;
    resetVoiceRecoveryState({ resetLocale: true });
    syncRecognitionLocales({ resetIndex: true });
    setIsVoiceReconnecting(false);
    setVoiceTranscriptConfidence(0);
    setVoiceTranscriptSource("idle");
    setVoiceListeningEngine("Hybrid English voice mode");
    applyVoiceModeEnabled(false);
    clearPreviewResumeState();
    voiceInterruptionSeedRef.current = "";
    stopListening();
    stopSpeaking();
    setIsProcessingVoiceTurn(false);
    setStatusText(message);
  };

  const scheduleVoiceTranscriptQueueFlush = (delayMs = 0) => {
    if (typeof window === "undefined") return;
    window.clearTimeout(voiceTranscriptQueueTimerRef.current);
    voiceTranscriptQueueTimerRef.current = window.setTimeout(() => {
      voiceTranscriptQueueTimerRef.current = 0;
      void flushVoiceTranscriptQueue();
    }, Math.max(0, delayMs));
  };

  const respondToUnclearVoiceTurn = ({
    transcript = "",
    confidence = 0,
    continueVoiceChat = true,
    reason = "",
  } = {}) => {
    const cleanedTranscript = normalizeVoiceTranscript(transcript);
    const shouldClarify = Boolean(
      cleanedTranscript
      && (
        reason === "ambiguous"
        || confidence >= VOICE_TRANSCRIPT_CLARIFY_CONFIDENCE_THRESHOLD
        || cleanedTranscript.length >= VOICE_TRANSCRIPT_MIN_CLARIFY_CHARS
      )
    );
    const clarificationMessage = confidence < VOICE_TRANSCRIPT_CLARIFY_CONFIDENCE_THRESHOLD
      ? "I didn't fully catch that. Could you repeat it a little more clearly?"
      : "I caught part of that, but not enough to answer confidently. Could you repeat it?";
    const message = shouldClarify
      ? clarificationMessage
      : "That sounded more like background audio than a clear question, so I ignored it.";

    if (cleanedTranscript) {
      setDraft(cleanedTranscript);
    }

    if (voiceModeEnabledRef.current && continueVoiceChat) {
      if (ttsEnabledRef.current && shouldClarify) {
        setStatusText(message);
        speakReply(message);
        return;
      }
      scheduleVoiceListeningRestart({
        delayMs: VOICE_TRANSCRIPT_QUEUE_CLARIFY_DELAY_MS,
        continueVoiceChat: true,
        reconnecting: false,
        statusMessage: shouldClarify ? message : "Background audio ignored. Listening again...",
      });
      return;
    }

    setStatusText(message);
  };

  const flushVoiceTranscriptQueue = async () => {
    if (voiceTranscriptQueueBusyRef.current) return;
    if (!voiceTranscriptQueueRef.current.length) {
      setIsProcessingVoiceTurn(false);
      return;
    }
    if (
      isVoicePreviewMuted()
      || voiceInterruptionRequestedRef.current
      || isGeneratingRef.current
      || Boolean(abortControllerRef.current)
    ) {
      setIsProcessingVoiceTurn(true);
      scheduleVoiceTranscriptQueueFlush(VOICE_TRANSCRIPT_QUEUE_RETRY_MS);
      return;
    }

    const sendVoiceMessage = sendMessageRef.current;
    if (typeof sendVoiceMessage !== "function") {
      scheduleVoiceTranscriptQueueFlush(VOICE_TRANSCRIPT_QUEUE_RETRY_MS);
      return;
    }

    const nextTurn = voiceTranscriptQueueRef.current.shift();
    if (!nextTurn) {
      setIsProcessingVoiceTurn(false);
      return;
    }

    voiceTranscriptQueueBusyRef.current = true;
    setIsProcessingVoiceTurn(true);

    try {
      const intentAnalysis = analyzeVoiceIntent({
        transcript: nextTurn.transcript,
        previewTranscript: nextTurn.previewTranscript,
        spokenReference: nextTurn.spokenReference,
        transcriptConfidence: nextTurn.transcriptConfidence,
      });

      if (!intentAnalysis.shouldProcess) {
        respondToUnclearVoiceTurn({
          transcript: intentAnalysis.cleaned,
          confidence: intentAnalysis.confidence,
          continueVoiceChat: nextTurn.continueVoiceChat,
          reason: intentAnalysis.reason,
        });
        return;
      }

      const shouldProcessImmediately = intentAnalysis.confidence >= VOICE_TRANSCRIPT_PROCESS_CONFIDENCE_THRESHOLD
        || intentAnalysis.wordCount >= 5
        || intentAnalysis.cleaned.length >= VOICE_MIN_CONFIDENT_TRANSCRIPT_CHARS;

      if (!shouldProcessImmediately && intentAnalysis.reason !== "echo") {
        respondToUnclearVoiceTurn({
          transcript: intentAnalysis.cleaned,
          confidence: intentAnalysis.confidence,
          continueVoiceChat: nextTurn.continueVoiceChat,
          reason: "ambiguous",
        });
        return;
      }

      setDraft(intentAnalysis.cleaned);
      setStatusText(
        intentAnalysis.confidence < 0.55
          ? "Sending your voice question with low-confidence transcription..."
          : "Sending your voice question...",
      );

      const delivered = await sendVoiceMessage({
        promptText: intentAnalysis.cleaned,
        interactionMode: "voice",
      });

      if (
        !delivered
        && (
          voiceInterruptionRequestedRef.current
          || isGeneratingRef.current
          || Boolean(abortControllerRef.current)
        )
      ) {
        voiceTranscriptQueueRef.current.unshift(nextTurn);
        scheduleVoiceTranscriptQueueFlush(VOICE_TRANSCRIPT_QUEUE_RETRY_MS);
      }
    } finally {
      voiceTranscriptQueueBusyRef.current = false;
      if (voiceTranscriptQueueRef.current.length) {
        scheduleVoiceTranscriptQueueFlush(VOICE_TRANSCRIPT_QUEUE_RETRY_MS);
      } else {
        setIsProcessingVoiceTurn(false);
      }
    }
  };

  const queueVoiceTranscriptTurn = ({
    transcript = "",
    transcriptConfidence = null,
    previewTranscript = "",
    source = "voice",
    continueVoiceChat = true,
  } = {}) => {
    const cleanedTranscript = normalizeVoiceTranscript(transcript);
    if (!cleanedTranscript) return false;
    const confidence = Number.isFinite(Number(transcriptConfidence))
      ? clampNumber(Number(transcriptConfidence), 0, 1)
      : estimateTranscriptConfidence(cleanedTranscript, previewTranscript);

    voiceTranscriptQueueRef.current.push({
      transcript: cleanedTranscript,
      transcriptConfidence: confidence,
      previewTranscript: normalizeVoiceTranscript(previewTranscript),
      source: compactText(source, "voice"),
      continueVoiceChat,
      spokenReference: voiceSpeechReferenceRef.current,
      capturedAt: Date.now(),
    });

    setDraft(cleanedTranscript);
    setVoiceTranscriptConfidence(confidence);
    setVoiceTranscriptSource(compactText(source, "voice"));
    setIsProcessingVoiceTurn(true);
    setStatusText(
      confidence < VOICE_TRANSCRIPT_PROCESS_CONFIDENCE_THRESHOLD
        ? "Voice turn captured. Validating the transcript..."
        : "Voice turn captured. Processing your question...",
    );
    scheduleVoiceTranscriptQueueFlush(voiceInterruptionRequestedRef.current ? VOICE_TRANSCRIPT_QUEUE_RETRY_MS : 30);
    return true;
  };

  const updateConversation = (conversationId, updater) => {
    setConversations((current) => {
      const next = current.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        const updated = typeof updater === "function" ? updater(conversation) : updater;
        return mergeConversationRecord(conversation, {
          ...updated,
          updatedAt: compactText(updated?.updatedAt, nowIso()),
          source: compactText(updated?.source, conversation.source || "local"),
          isDraft: normalizeBoolean(updated?.isDraft, normalizeBoolean(conversation.isDraft, compactText(conversation.source, "local") !== "server")),
        }, { source: compactText(updated?.source, conversation.source || "local") });
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
      source: remoteSyncAvailable ? "local" : "local",
      isDraft: true,
    });
    setConversations((current) => sortConversations([nextConversation, ...current]));
    setActiveConversationId(nextConversation.id);
    return nextConversation;
  };

  const createConversation = () => {
    const existingEmptyConversation = conversations.find(
      (conversation) => conversation.isDraft && !conversation.messages.length && !conversation.isArchived,
    );
    if (existingEmptyConversation) {
      setActiveConversationId(existingEmptyConversation.id);
      setMobileSidebarOpen(false);
      openPanel();
      setDraft("");
      setStatusText("Fresh chat ready.");
      setActiveProvider("");
      return existingEmptyConversation.id;
    }
    const nextConversation = createConversationRecord({
      contextKey: normalizedContextKey,
      lectureLabel,
      source: "local",
      isDraft: true,
    });
    setConversations((current) => sortConversations([nextConversation, ...current]));
    setActiveConversationId(nextConversation.id);
    setMobileSidebarOpen(false);
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

  const hydrateConversationList = async ({
    search = "",
    offset = 0,
    append = false,
  } = {}) => {
    if (!remoteSyncAvailable || typeof requestConversationList !== "function") return false;
    if (append) setIsLoadingMoreConversations(true);
    else setIsLoadingConversations(true);

    try {
      const data = await requestConversationList({
        search,
        limit: CONVERSATION_LIST_PAGE_SIZE,
        offset,
        archived: showArchived,
      });
      const remoteItems = Array.isArray(data?.items) ? data.items : [];
      setTotalConversationCount(Number(data?.total) || remoteItems.length);
      remoteSyncEnabledRef.current = true;

      startTransition(() => {
        setConversations((current) => {
          const nextMap = new Map();
          const rememberConversation = (conversationLike, fallbackSource = "local") => {
            if (!conversationLike?.id) return;
            const existing = nextMap.get(conversationLike.id) || current.find((item) => item.id === conversationLike.id) || null;
            const merged = mergeConversationRecord(existing, conversationLike, {
              source: compactText(conversationLike.source, existing?.source || fallbackSource),
            });
            if (merged) nextMap.set(merged.id, merged);
          };

          if (append) {
            current.forEach((conversation) => rememberConversation(conversation, compactText(conversation.source, "local")));
          } else {
            current
              .filter((conversation) => conversation.isDraft || compactText(conversation.source) !== "server")
              .forEach((conversation) => {
                if (!showArchived && conversation.isArchived && conversation.id !== activeConversationId) return;
                if (!conversationMatchesSearch(conversation, search) && conversation.id !== activeConversationId) return;
                rememberConversation(conversation, compactText(conversation.source, "local"));
              });
            const activeExisting = current.find((conversation) => conversation.id === activeConversationId);
            if (activeExisting) rememberConversation(activeExisting, compactText(activeExisting.source, "local"));
          }

          remoteItems.forEach((item) => {
            rememberConversation({
              ...item,
              source: "server",
              isDraft: false,
            }, "server");
          });

          const next = sortConversations([...nextMap.values()]);
          return next.length ? next : [createConversationRecord({ contextKey: normalizedContextKey, lectureLabel })];
        });
      });
      return true;
    } catch (error) {
      const message = compactText(error?.message, "Conversation history could not sync right now.");
      if (/not configured/i.test(message)) {
        remoteSyncEnabledRef.current = false;
      }
      if (!append) {
        setStatusText(message);
      }
      return false;
    } finally {
      if (append) setIsLoadingMoreConversations(false);
      else setIsLoadingConversations(false);
    }
  };

  const loadConversation = async (conversationId, { silent = false } = {}) => {
    const normalizedConversationId = compactText(conversationId);
    if (!normalizedConversationId || !remoteSyncAvailable || typeof requestConversation !== "function") return null;
    if (!silent) setIsLoadingConversationMessages(true);

    try {
      const data = await requestConversation(normalizedConversationId, {
        messageLimit: CONVERSATION_MESSAGE_PAGE_SIZE,
      });
      const mergedConversation = {
        ...(data?.conversation || {}),
        hasMoreMessages: Boolean(data?.has_more),
        nextBefore: compactText(data?.next_before),
        messageCount: Number(data?.total_messages) || Number(data?.conversation?.messageCount) || 0,
        source: "server",
        isDraft: false,
      };
      startTransition(() => {
        setConversations((current) => sortConversations(current.map((conversation) => (
          conversation.id === normalizedConversationId
            ? mergeConversationRecord(conversation, mergedConversation, { source: "server" })
            : conversation
        ))));
      });
      return mergedConversation;
    } catch (error) {
      if (!silent) {
        setStatusText(compactText(error?.message, "That conversation could not be loaded right now."));
      }
      return null;
    } finally {
      if (!silent) setIsLoadingConversationMessages(false);
    }
  };

  const loadOlderMessages = async (conversationId = activeConversation?.id) => {
    const normalizedConversationId = compactText(conversationId);
    const targetConversation = conversations.find((conversation) => conversation.id === normalizedConversationId) || activeConversation;
    if (
      !normalizedConversationId
      || !targetConversation?.hasMoreMessages
      || isLoadingMoreMessages
      || typeof requestConversationMessages !== "function"
    ) {
      return false;
    }

    setIsLoadingMoreMessages(true);
    try {
      const data = await requestConversationMessages(normalizedConversationId, {
        before: compactText(targetConversation.nextBefore),
        limit: CONVERSATION_MESSAGE_PAGE_SIZE,
      });
      const incomingItems = Array.isArray(data?.items)
        ? data.items.map((item) => normalizeConversationRecord({
          id: normalizedConversationId,
          messages: [item],
          createdAt: targetConversation.createdAt,
          updatedAt: targetConversation.updatedAt,
        })?.messages?.[0]).filter(Boolean)
        : [];
      updateConversation(normalizedConversationId, (conversation) => ({
        ...conversation,
        messages: [...incomingItems, ...conversation.messages],
        hasMoreMessages: Boolean(data?.has_more),
        nextBefore: compactText(data?.next_before),
        messageCount: Math.max(Number(data?.total) || 0, conversation.messageCount || 0, conversation.messages.length + incomingItems.length),
        source: "server",
        isDraft: false,
      }));
      return incomingItems.length > 0;
    } catch (error) {
      setStatusText(compactText(error?.message, "Older messages could not be loaded right now."));
      return false;
    } finally {
      setIsLoadingMoreMessages(false);
    }
  };

  const selectConversation = (conversationId, { focusComposer = false } = {}) => {
    const normalizedConversationId = compactText(conversationId);
    if (!normalizedConversationId) return;
    setActiveConversationId(normalizedConversationId);
    setMobileSidebarOpen(false);
    openPanel({ focusComposer });

    const selectedConversation = conversations.find((conversation) => conversation.id === normalizedConversationId);
    if (remoteSyncAvailable && selectedConversation && !selectedConversation.isDraft) {
      void loadConversation(normalizedConversationId, { silent: Boolean(selectedConversation.messages.length) });
    }
  };

  const syncConversationPatch = async (conversationId, patch = {}, successMessage = "") => {
    const normalizedConversationId = compactText(conversationId);
    if (!normalizedConversationId) return false;
    const existingConversation = conversations.find((conversation) => conversation.id === normalizedConversationId);
    if (!existingConversation) return false;

    const previousSnapshot = existingConversation;
    updateConversation(normalizedConversationId, (conversation) => ({
      ...conversation,
      ...patch,
      source: compactText(conversation.source, existingConversation.source || "local"),
      isDraft: normalizeBoolean(conversation.isDraft, existingConversation.isDraft),
    }));

    if (!remoteSyncAvailable || typeof requestConversationUpdate !== "function" || existingConversation.isDraft) {
      if (successMessage) setStatusText(successMessage);
      return true;
    }

    setIsSyncingConversation(true);
    try {
      const data = await requestConversationUpdate(normalizedConversationId, patch);
      if (data?.conversation) {
        updateConversation(normalizedConversationId, (conversation) => mergeConversationRecord(conversation, {
          ...data.conversation,
          source: "server",
          isDraft: false,
        }, { source: "server" }));
      }
      if (successMessage) setStatusText(successMessage);
      return true;
    } catch (error) {
      updateConversation(normalizedConversationId, previousSnapshot);
      setStatusText(compactText(error?.message, "That conversation update could not be saved."));
      return false;
    } finally {
      setIsSyncingConversation(false);
    }
  };

  const renameConversation = async (conversationId, nextTitle) => {
    const normalizedTitle = compactText(nextTitle).slice(0, 80);
    if (!normalizedTitle) return false;
    return syncConversationPatch(conversationId, { title: normalizedTitle }, "Conversation renamed.");
  };

  const togglePinnedConversation = async (conversationId, nextPinnedValue) => {
    const existingConversation = conversations.find((conversation) => conversation.id === conversationId);
    if (!existingConversation) return false;
    const resolvedValue = typeof nextPinnedValue === "boolean" ? nextPinnedValue : !existingConversation.isPinned;
    return syncConversationPatch(
      conversationId,
      { is_pinned: resolvedValue, isPinned: resolvedValue },
      resolvedValue ? "Conversation pinned." : "Conversation unpinned.",
    );
  };

  const toggleArchivedConversation = async (conversationId, nextArchivedValue) => {
    const existingConversation = conversations.find((conversation) => conversation.id === conversationId);
    if (!existingConversation) return false;
    const resolvedValue = typeof nextArchivedValue === "boolean" ? nextArchivedValue : !existingConversation.isArchived;
    const updated = await syncConversationPatch(
      conversationId,
      { is_archived: resolvedValue, isArchived: resolvedValue },
      resolvedValue ? "Conversation archived." : "Conversation restored.",
    );
    if (updated && resolvedValue && !showArchived && activeConversationId === conversationId) {
      const fallbackConversation = conversations.find(
        (conversation) => conversation.id !== conversationId && !conversation.isArchived,
      );
      if (fallbackConversation?.id) {
        selectConversation(fallbackConversation.id);
      } else {
        createConversation();
      }
    }
    return updated;
  };

  const deleteConversation = async (conversationId) => {
    const normalizedConversationId = compactText(conversationId);
    if (!normalizedConversationId) return false;
    if (normalizedConversationId === activeConversationId && isGenerating) {
      stopGenerating();
    }

    const conversationToDelete = conversations.find((conversation) => conversation.id === normalizedConversationId);
    if (!conversationToDelete) return false;
    const previousActiveConversationId = activeConversationId;
    const remainingConversations = conversations.filter((conversation) => conversation.id !== normalizedConversationId);
    const fallbackConversation = remainingConversations.length
      ? null
      : createConversationRecord({ contextKey: normalizedContextKey, lectureLabel });
    const fallbackConversationId = remainingConversations[0]?.id || fallbackConversation?.id || "";
    setConversations(sortConversations(remainingConversations.length ? remainingConversations : [fallbackConversation]));
    if (normalizedConversationId === activeConversationId) {
      setActiveConversationId(fallbackConversationId);
    }

    if (!remoteSyncAvailable || typeof requestConversationDelete !== "function" || conversationToDelete.isDraft) {
      setStatusText("Conversation deleted.");
      return true;
    }

    setIsSyncingConversation(true);
    try {
      await requestConversationDelete(normalizedConversationId);
      setStatusText("Conversation deleted.");
      return true;
    } catch (error) {
      startTransition(() => {
        setConversations((current) => sortConversations([conversationToDelete, ...current.filter((conversation) => conversation.id !== normalizedConversationId)]));
      });
      setActiveConversationId(previousActiveConversationId || conversationToDelete.id);
      setStatusText(compactText(error?.message, "That conversation could not be deleted."));
      return false;
    } finally {
      setIsSyncingConversation(false);
    }
  };

  const exportConversation = async (conversationId = activeConversation?.id) => {
    const normalizedConversationId = compactText(conversationId);
    if (!normalizedConversationId || typeof requestConversationExport !== "function") return false;
    try {
      const data = await requestConversationExport(normalizedConversationId);
      const markdown = compactText(data?.markdown);
      if (!markdown || typeof window === "undefined") {
        setStatusText("Conversation export is not available here.");
        return false;
      }
      const filename = `${compactText(data?.title, "lecture-assistant-chat")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "lecture-assistant-chat"}.md`;
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(objectUrl);
      setStatusText("Conversation exported.");
      return true;
    } catch (error) {
      setStatusText(compactText(error?.message, "That conversation could not be exported."));
      return false;
    }
  };

  const loadMoreConversations = async () => {
    if (!canLoadMoreConversations || isLoadingMoreConversations) return false;
    return hydrateConversationList({
      search: deferredSearchQuery,
      offset: serverConversationCount,
      append: true,
    });
  };

  const startBrowserListening = ({ continueVoiceChat = false, allowInterruptionResume = false } = {}) => {
    if (isListening && !allowInterruptionResume) {
      stopVoiceChat({ message: "Voice conversation ended." });
      return;
    }
    if ((isSpeakingRef.current || isGeneratingRef.current) && !allowInterruptionResume) {
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
    setVoiceListeningEngine("Browser SpeechRecognition only");
    setVoiceTranscriptSource("idle");
    setVoiceTranscriptConfidence(0);
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

    const seededInterruptionTranscript = compactText(voiceInterruptionSeedRef.current);
    voiceInterruptionSeedRef.current = "";
    let finalTranscript = seededInterruptionTranscript ? `${seededInterruptionTranscript} ` : "";
    let latestTranscript = seededInterruptionTranscript;
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
      if (seededInterruptionTranscript) {
        setDraft(seededInterruptionTranscript);
      }
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
      if (isVoicePreviewMuted()) return;
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcriptText = result?.[0]?.transcript || "";
        if (result.isFinal) finalTranscript += `${transcriptText} `;
        else interimTranscript += transcriptText;
      }
      latestTranscript = mergeVoiceSeedTranscript(
        seededInterruptionTranscript,
        `${finalTranscript}${interimTranscript}`.replace(/\s+/g, " ").trim(),
      );
      resetVoiceRecoveryState();
      setVoiceTranscriptSource("browser");
      setVoiceTranscriptConfidence(estimateTranscriptConfidence(latestTranscript));
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
      const spokenQuestion = compactText(mergeVoiceSeedTranscript(seededInterruptionTranscript, compactText(finalTranscript, latestTranscript)));
      if (manualRecognitionStopRef.current) {
        manualRecognitionStopRef.current = false;
        setIsVoiceReconnecting(false);
        return;
      }
      if (isVoicePreviewMuted()) {
        setIsVoiceReconnecting(false);
        setStatusText("Voice preview finished. Tap the mic when you want to speak.");
        return;
      }
      if (spokenQuestion) {
        const intentAnalysis = analyzeVoiceIntent({
          transcript: spokenQuestion,
          transcriptConfidence: estimateTranscriptConfidence(spokenQuestion),
        });
        if (!intentAnalysis.shouldProcess) {
          respondToUnclearVoiceTurn({
            transcript: intentAnalysis.cleaned,
            confidence: intentAnalysis.confidence,
            continueVoiceChat,
            reason: intentAnalysis.reason,
          });
          return;
        }
        setIsVoiceReconnecting(false);
        resetVoiceRecoveryState();
        queueVoiceTranscriptTurn({
          transcript: intentAnalysis.cleaned,
          transcriptConfidence: intentAnalysis.confidence,
          source: "browser",
          continueVoiceChat,
        });
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
    if (isVoicePreviewMuted()) {
      return "";
    }
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
      contextHint: voiceTranscriptionContextHint,
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
        const transcriptConfidence = estimateTranscriptConfidence(text, voicePreviewTranscriptRef.current);
        setVoiceTranscriptConfidence(transcriptConfidence);
        setVoiceTranscriptSource(
          compactText(voicePreviewTranscriptRef.current) && normalizeVoiceTranscript(voicePreviewTranscriptRef.current) !== text
            ? "hybrid"
            : "whisper",
        );
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

  const startWhisperListening = async ({ continueVoiceChat = false, allowInterruptionResume = false } = {}) => {
    if (isListening && !allowInterruptionResume) {
      stopVoiceChat({ message: "Voice conversation ended." });
      return;
    }
    if ((isSpeakingRef.current || isGeneratingRef.current) && !allowInterruptionResume) {
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
      startBrowserListening({ continueVoiceChat, allowInterruptionResume });
      return;
    }

    const mimeType = getSupportedRecordingMimeType();
    if (!mimeType) {
      setStatusText("This browser cannot record mic audio here, so voice chat is falling back to browser speech recognition.");
      startBrowserListening({ continueVoiceChat, allowInterruptionResume });
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
    const seededInterruptionTranscript = compactText(voiceInterruptionSeedRef.current);
    voiceInterruptionSeedRef.current = "";
    voiceRecorderChunksRef.current = [];
    voiceRecorderChunkCountRef.current = 0;
    voiceLastRequestedChunkCountRef.current = 0;
    voiceWhisperTranscriptRef.current = seededInterruptionTranscript;
    voicePreviewTranscriptRef.current = seededInterruptionTranscript;
    voiceHasWhisperTranscriptRef.current = false;
    voiceCaptureFinalizingRef.current = false;
    voiceLastWhisperRequestAtRef.current = 0;
    setVoiceTranscriptConfidence(0);
    setVoiceTranscriptSource("idle");
    setVoiceListeningEngine("Groq Whisper + browser live preview");
    if (seededInterruptionTranscript) {
      setDraft(seededInterruptionTranscript);
    }

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
      const microphoneStream = await navigator.mediaDevices.getUserMedia(buildEnhancedMicrophoneConstraints());
      if (captureId !== voiceCaptureRunRef.current) {
        microphoneStream.getTracks().forEach((track) => track.stop());
        return;
      }

      microphoneStreamRef.current = microphoneStream;
      const recorder = mimeType
        ? new window.MediaRecorder(microphoneStream, { mimeType })
        : new window.MediaRecorder(microphoneStream);
      mediaRecorderRef.current = recorder;

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
            if (isVoicePreviewMuted()) return;
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
              const result = event.results[index];
              const transcriptText = compactText(result?.[0]?.transcript);
              if (!transcriptText) continue;
              if (result.isFinal) previewFinalTranscript += `${transcriptText} `;
              else previewInterimTranscript = transcriptText;
            }
            const previewText = mergeVoiceSeedTranscript(
              seededInterruptionTranscript,
              `${previewFinalTranscript} ${previewInterimTranscript}`,
            );
            voicePreviewTranscriptRef.current = previewText;
            if (!voiceHasWhisperTranscriptRef.current && previewText) {
              setVoiceTranscriptSource("browser");
              setVoiceTranscriptConfidence(estimateTranscriptConfidence(previewText));
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

      let sileroVadStarted = false;
      try {
        const vadModule = await loadSileroVadModule();
        if (captureId === voiceCaptureRunRef.current && vadModule?.MicVAD?.new) {
          const vadInstance = await vadModule.MicVAD.new({
            model: "v5",
            baseAssetPath: VOICE_VAD_ASSET_BASE_PATH,
            onnxWASMBasePath: buildOnnxWasmPaths(),
            getStream: async () => microphoneStream,
            pauseStream: async () => {},
            resumeStream: async () => microphoneStream,
            positiveSpeechThreshold: VOICE_SILERO_POSITIVE_THRESHOLD,
            negativeSpeechThreshold: VOICE_SILERO_NEGATIVE_THRESHOLD,
            redemptionMs: VOICE_SILERO_REDEMPTION_MS,
            preSpeechPadMs: VOICE_SILERO_PRE_SPEECH_PAD_MS,
            minSpeechMs: VOICE_SILERO_MIN_SPEECH_MS,
            submitUserSpeechOnPause: true,
            onSpeechStart: () => {
              if (captureId !== voiceCaptureRunRef.current || voiceCaptureFinalizingRef.current) return;
              clearVoiceListeningTimer();
              setVoiceTranscriptSource((current) => current === "idle" ? "browser" : current);
              setStatusText("Speech detected. Groq Whisper is validating the transcript...");
            },
            onSpeechRealStart: () => {
              if (captureId !== voiceCaptureRunRef.current || voiceCaptureFinalizingRef.current) return;
              setStatusText("Listening in English with Groq Whisper and Silero VAD...");
            },
            onVADMisfire: () => {
              if (captureId !== voiceCaptureRunRef.current || voiceCaptureFinalizingRef.current) return;
              const candidateTranscript = compactText(
                voiceWhisperTranscriptRef.current,
                voicePreviewTranscriptRef.current,
              );
              if (!candidateTranscript) {
                setStatusText("Small background noise ignored. Still listening in English...");
              }
              clearVoiceListeningTimer();
              if (typeof window !== "undefined") {
                voiceListeningTimerRef.current = window.setTimeout(() => {
                  if (captureId !== voiceCaptureRunRef.current || voiceCaptureFinalizingRef.current) return;
                  void finalizeWhisperTurn("silence_timeout");
                }, compactText(candidateTranscript) ? 900 : VOICE_CHAT_INITIAL_IDLE_TIMEOUT_MS);
              }
            },
            onSpeechEnd: async () => {
              if (captureId !== voiceCaptureRunRef.current || voiceCaptureFinalizingRef.current) return;
              await schedulePartialWhisperTranscription({ force: false });
              void finalizeWhisperTurn("silence_timeout");
            },
          });
          if (captureId === voiceCaptureRunRef.current) {
            sileroVadInstanceRef.current = vadInstance;
            sileroVadEnabledRef.current = true;
            sileroVadStarted = true;
            setVoiceListeningEngine("Silero VAD + Groq Whisper + browser preview");
          } else {
            await vadInstance.destroy?.();
          }
        }
      } catch {
        sileroVadStarted = false;
        sileroVadEnabledRef.current = false;
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

        finalTranscript = mergeVoiceSeedTranscript(
          seededInterruptionTranscript,
          compactText(finalTranscript, previewTranscript),
        );
        if (isVoicePreviewMuted()) {
          setStatusText("Voice preview finished. Tap the mic when you want to speak.");
          return;
        }
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
          respondToUnclearVoiceTurn({
            transcript: finalTranscript,
            confidence: transcriptConfidence,
            continueVoiceChat,
            reason: "ambiguous",
          });
          return;
        }
        const intentAnalysis = analyzeVoiceIntent({
          transcript: finalTranscript,
          previewTranscript,
          transcriptConfidence,
        });
        if (!intentAnalysis.shouldProcess) {
          respondToUnclearVoiceTurn({
            transcript: intentAnalysis.cleaned,
            confidence: intentAnalysis.confidence,
            continueVoiceChat,
            reason: intentAnalysis.reason,
          });
          return;
        }

        resetVoiceRecoveryState();
        queueVoiceTranscriptTurn({
          transcript: intentAnalysis.cleaned,
          transcriptConfidence: intentAnalysis.confidence,
          previewTranscript,
          source: compactText(previewTranscript) && normalizeVoiceTranscript(previewTranscript) !== finalTranscript
            ? "hybrid"
            : "whisper",
          continueVoiceChat,
        });
      };

      recorder.start(520);
      setIsListening(true);
      setStatusText(continueVoiceChat
        ? `Listening in English with ${sileroVadStarted ? "Silero VAD and " : ""}Groq Whisper for your next question...`
        : `Voice chat is on in English. ${sileroVadStarted ? "Silero VAD is active. " : ""}Speak your question now.`);

      clearVoiceListeningTimer();
      if (typeof window !== "undefined") {
        voiceListeningTimerRef.current = window.setTimeout(() => {
          if (captureId !== voiceCaptureRunRef.current || voiceCaptureFinalizingRef.current) return;
          void finalizeWhisperTurn("silence_timeout");
        }, VOICE_CHAT_INITIAL_IDLE_TIMEOUT_MS);
      }

      if (!sileroVadStarted) {
        setVoiceListeningEngine("Groq Whisper + browser preview + fallback VAD");
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
                  clearVoiceListeningTimer();
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
              setVoiceTranscriptConfidence(0);
              setVoiceTranscriptSource("idle");
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
      }
    } catch (error) {
      clearWhisperCaptureArtifacts();
      setIsListening(false);
      setIsVoiceReconnecting(false);
      setVoiceListeningEngine("Browser SpeechRecognition fallback");
      setStatusText(`${getMicrophoneAccessErrorMessage(error)} Falling back to browser speech recognition if available.`);
      startBrowserListening({ continueVoiceChat, allowInterruptionResume });
    }
  };

  const startListening = ({ continueVoiceChat = false, allowInterruptionResume = false } = {}) => {
    if (isVoicePreviewMuted()) {
      setStatusText("Voice preview is still finishing. Wait a moment, then start talking.");
      return;
    }
    if (
      typeof requestTranscription === "function"
      && typeof window !== "undefined"
      && typeof navigator !== "undefined"
      && typeof window.MediaRecorder !== "undefined"
      && navigator.mediaDevices?.getUserMedia
    ) {
      void startWhisperListening({ continueVoiceChat, allowInterruptionResume });
      return;
    }
    startBrowserListening({ continueVoiceChat, allowInterruptionResume });
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
        setStatusText(voiceInterruptionRequestedRef.current ? "Interrupted. Listening..." : "Generation stopped.");
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
    triggerVoiceInterruption("");
  };

  const sendMessage = async ({
    promptText = draft,
    baseMessages = null,
    appendUserMessage = true,
    interactionMode = "text",
  } = {}) => {
    const resolvedInteractionMode = compactText(interactionMode, "text").toLowerCase() === "voice" ? "voice" : "text";
    const useVoiceInteraction = resolvedInteractionMode === "voice";
    if (useVoiceInteraction && isVoicePreviewMuted()) {
      setStatusText("Voice preview just played. Wait a moment, then speak again.");
      return false;
    }
    const question = compactText(
      useVoiceInteraction
        ? (normalizeVoiceTranscript(promptText) || promptText)
        : promptText,
    );
    if (!question) {
      setStatusText("Type or speak a question first.");
      return false;
    }
    if (isGeneratingRef.current) return false;

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
    const baseContextMessages = [...currentMessages];
    if (!appendUserMessage && baseContextMessages.length) {
      const lastContextMessage = baseContextMessages[baseContextMessages.length - 1];
      if (lastContextMessage?.role === "user" && compactText(lastContextMessage.content) === question) {
        baseContextMessages.pop();
      }
    }
    const requestMessages = baseContextMessages
      .filter((message) => ["user", "assistant"].includes(message.role) && compactText(message.content))
      .slice(-10);

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
      source: compactText(conversation.source, "local"),
      isDraft: normalizeBoolean(conversation.isDraft, true),
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
    setIsSyncingConversation(true);
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
        context_key: normalizedContextKey,
        lecture_label: compactText(lectureLabel),
        client_request_id: createClientId("chat"),
        interaction_mode: resolvedInteractionMode,
        append_user_message: appendUserMessage,
        regenerate_last_assistant: !appendUserMessage,
        user_message_id: nextUserMessage?.id || "",
        assistant_message_id: nextAssistantMessage.id,
        voice_profile_id: useVoiceInteraction ? compactText(selectedVoiceProfileRef.current?.id, "wave") : "",
        voice_profile_label: useVoiceInteraction ? compactText(selectedVoiceProfileRef.current?.name) : "",
        voice_style_prompt: useVoiceInteraction ? buildVoicePersonalityPrompt(selectedVoiceProfileRef.current) : "",
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
        if (event === "conversation_saved") {
          if (data?.conversation?.id !== targetConversationId) return;
          updateConversation(targetConversationId, (conversation) => mergeConversationRecord(conversation, {
            ...data.conversation,
            source: "server",
            isDraft: false,
          }, { source: "server" }));
          setIsSyncingConversation(false);
          return;
        }
        if (event === "title_updated") {
          if (compactText(data?.conversation_id) !== targetConversationId) return;
          updateConversation(targetConversationId, (conversation) => ({
            ...conversation,
            title: compactText(data?.title, conversation.title),
            source: "server",
            isDraft: false,
          }));
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
      setIsSyncingConversation(false);
      return true;
    } catch (error) {
      if (error?.name === "AbortError") {
        if (!compactText(streamedText)) removeMessageById(targetConversationId, nextAssistantMessage.id);
        else patchMessage(targetConversationId, nextAssistantMessage.id, { status: "complete" });
        setIsSyncingConversation(false);
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
      setIsSyncingConversation(false);
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
    if (isGeneratingRef.current || !activeConversation) return false;
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
      const primaryPayload = window.localStorage.getItem(storageKey);
      const legacyPayload = primaryPayload ? "" : window.localStorage.getItem(legacyStorageKey);
      const storedConversations = JSON.parse(primaryPayload || legacyPayload || "[]");
      const normalized = Array.isArray(storedConversations)
        ? storedConversations.map(normalizeConversationRecord).filter(Boolean)
        : [];
      const fallbackConversation = createConversationRecord({ contextKey: normalizedContextKey, lectureLabel });
      const storedActiveConversationId = compactText(window.localStorage.getItem(`${storageKey}:active`));
      startTransition(() => {
        setConversations(normalized.length ? sortConversations(normalized) : [fallbackConversation]);
        setActiveConversationId(storedActiveConversationId || normalized[0]?.id || fallbackConversation.id);
      });
      setTheme(compactText(window.localStorage.getItem(ASSISTANT_THEME_STORAGE_KEY), "dark"));
      const storedVoiceRepliesEnabled = window.localStorage.getItem(ASSISTANT_TTS_STORAGE_KEY) === "true";
      setSelectedVoiceProfileId(compactText(window.localStorage.getItem(ASSISTANT_VOICE_PROFILE_STORAGE_KEY), "wave"));
      setVoicePreviewDraft(compactText(window.localStorage.getItem(ASSISTANT_VOICE_PREVIEW_DRAFT_STORAGE_KEY), VOICE_DEFAULT_PREVIEW_TEXT));
      ttsEnabledRef.current = storedVoiceRepliesEnabled;
      setTtsEnabled(storedVoiceRepliesEnabled);
    } catch {
      const fallbackConversation = createConversationRecord({ contextKey: normalizedContextKey, lectureLabel });
      setConversations([fallbackConversation]);
      setActiveConversationId(fallbackConversation.id);
    } finally {
      hasLoadedStorageRef.current = true;
      lastContextKeyRef.current = normalizedContextKey;
      remoteHydratedRef.current = false;
    }
  }, [legacyStorageKey, storageKey, normalizedContextKey, lectureLabel]);

  useEffect(() => {
    if (!hasLoadedStorageRef.current || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(sortConversations(conversations)));
    if (activeConversationId) {
      window.localStorage.setItem(`${storageKey}:active`, activeConversationId);
    }
  }, [activeConversationId, conversations, storageKey]);

  useEffect(() => {
    remoteSyncEnabledRef.current = remoteSyncAvailable;
  }, [remoteSyncAvailable]);

  useEffect(() => {
    if (!hasLoadedStorageRef.current || !remoteSyncAvailable || remoteHydratedRef.current) return;
    remoteHydratedRef.current = true;
    void hydrateConversationList({ search: "", offset: 0, append: false });
  }, [remoteSyncAvailable, storageKey]);

  useEffect(() => {
    if (!hasLoadedStorageRef.current || !remoteSyncAvailable || typeof window === "undefined") return undefined;
    window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => {
      void hydrateConversationList({
        search: compactText(deferredSearchQuery),
        offset: 0,
        append: false,
      });
    }, CONVERSATION_SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = 0;
    };
  }, [deferredSearchQuery, remoteSyncAvailable, showArchived]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ASSISTANT_THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ASSISTANT_TTS_STORAGE_KEY, String(ttsEnabled));
  }, [ttsEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ASSISTANT_VOICE_PROFILE_STORAGE_KEY, compactText(selectedVoiceProfileId, "wave"));
  }, [selectedVoiceProfileId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ASSISTANT_VOICE_PREVIEW_DRAFT_STORAGE_KEY, compactText(voicePreviewDraft, VOICE_DEFAULT_PREVIEW_TEXT));
  }, [voicePreviewDraft]);

  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  useEffect(() => {
    voiceModeEnabledRef.current = voiceModeEnabled;
  }, [voiceModeEnabled]);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    if (!voiceTranscriptQueueRef.current.length || isGenerating) return;
    scheduleVoiceTranscriptQueueFlush(40);
  }, [isGenerating]);

  useEffect(() => {
    selectedVoiceProfileRef.current = selectedVoiceProfile;
  }, [selectedVoiceProfile]);

  useEffect(() => {
    const nextAudioState = (previewingVoiceId || isPreparingVoicePreview)
      ? "previewing"
      : isListening
        ? "listening"
        : isSpeaking
          ? "speaking"
          : (isGenerating || isProcessingVoiceTurn) && voiceModeEnabled
            ? "processing"
            : voiceInterrupted
              ? "interrupted"
              : voiceModeEnabled
                ? "ready"
                : "idle";
    setAssistantAudioState((current) => current === nextAudioState ? current : nextAudioState);
  }, [
    isGenerating,
    isProcessingVoiceTurn,
    isListening,
    isPreparingVoicePreview,
    isSpeaking,
    previewingVoiceId,
    voiceInterrupted,
    voiceModeEnabled,
  ]);

  useEffect(() => {
    if (!voiceProfiles.length || selectedVoiceProfile) return;
    setSelectedVoiceProfileId(voiceProfiles[0].id);
  }, [selectedVoiceProfile, voiceProfiles]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const hydrateSpeechVoices = () => {
      try {
        const nextVoices = window.speechSynthesis.getVoices?.() || [];
        setSpeechVoices(nextVoices);
      } catch {
        setSpeechVoices([]);
      }
    };
    hydrateSpeechVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", hydrateSpeechVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", hydrateSpeechVoices);
    };
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
    if (!conversations.length) return;
    if (!activeConversationId || !conversations.some((conversation) => conversation.id === activeConversationId)) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (!activeConversation?.id || !remoteSyncAvailable || activeConversation.isDraft) return;
    if (activeConversation.messages.length) return;
    void loadConversation(activeConversation.id, { silent: true });
  }, [activeConversation?.id, activeConversation?.isDraft, activeConversation?.messages.length, remoteSyncAvailable]);

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
      window.clearTimeout(voiceInterruptionResetTimerRef.current);
      window.clearTimeout(voiceTranscriptQueueTimerRef.current);
    }
    clearPreviewResumeState();
    clearVoiceListeningTimer();
    stopListening();
    stopSpeaking();
    window.clearTimeout(copyResetTimerRef.current);
  }, []);

  return {
    activeConversation,
    activeConversationId,
    activeProvider,
    assistantAudioState,
    canSend: Boolean(compactText(draft)) && !isGenerating,
    canLoadMoreConversations,
    closePanel,
    composerRef,
    conversations,
    copiedMessageId,
    copyMessage,
    createConversation,
    deleteConversation,
    draft,
    exportConversation,
    hasLectureContext,
    isGenerating,
    interruptAssistantAndListen,
    isListening,
    isLoadingConversationMessages,
    isLoadingConversations,
    isLoadingMoreConversations,
    isLoadingMoreMessages,
    isOpen,
    isSpeaking,
    isSyncingConversation,
    isVoiceReconnecting,
    isPreparingVoicePreview,
    voiceModeEnabled,
    lectureLabel: compactText(lectureLabel),
    loadMoreConversations,
    loadOlderMessages,
    messages,
    messagesEndRef,
    mobileSidebarOpen,
    openPanel,
    openMobileSidebar: () => setMobileSidebarOpen(true),
    providerLabel: formatProviderLabel(activeProvider || messages[messages.length - 1]?.provider),
    previewingVoiceId,
    previewSelectedVoiceWithDraft,
    previewVoiceProfile,
    regenerateLastResponse,
    renameConversation,
    searchQuery,
    selectedVoiceProfile,
    selectedVoiceProfileId,
    sendMessage,
    selectVoiceProfile,
    setDraft,
    setMobileSidebarOpen,
    setSearchQuery,
    setShowArchived,
    setSidebarCollapsed,
    setTheme,
    setVoicePreviewDraft,
    selectConversation,
    showArchived,
    sidebarCollapsed,
    startListening,
    statusText,
    stopGenerating,
    stopListening,
    stopSpeaking,
    stopVoiceChat,
    theme,
    toggleListening: startListening,
    togglePanel,
    toggleArchiveConversation: toggleArchivedConversation,
    togglePinnedConversation,
    toggleShowArchived: () => setShowArchived((current) => !current),
    toggleSidebarCollapsed: () => setSidebarCollapsed((current) => !current),
    toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark"),
    toggleTts: toggleVoiceReplies,
    toggleVoiceChat: () => {
      if (isSpeakingRef.current || isGeneratingRef.current) {
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
    totalConversationCount,
    ttsEnabled,
    voiceListeningEngine,
    voiceInterrupted,
    voicePreviewDraft,
    voiceProfiles,
    voiceTranscriptConfidence,
    voiceTranscriptSource,
  };
}
