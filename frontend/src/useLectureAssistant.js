import { useEffect, useMemo, useRef, useState } from "react";

const ASSISTANT_STORAGE_PREFIX = "mabaso-lecture-assistant-v1";
const ASSISTANT_THEME_STORAGE_KEY = "mabaso-lecture-assistant-theme";
const ASSISTANT_TTS_STORAGE_KEY = "mabaso-lecture-assistant-tts";
const MAX_SAVED_CONVERSATIONS = 24;
const VOICE_CHAT_RESTART_DELAY_MS = 1100;
const VOICE_CHAT_NETWORK_RETRY_DELAY_MS = 1800;
const VOICE_CHAT_MAX_NETWORK_RETRIES = 2;
const VOICE_CHAT_INITIAL_IDLE_TIMEOUT_MS = 8000;
const VOICE_CHAT_SILENCE_TIMEOUT_MS = 2600;
const VOICE_REPLY_CHUNK_PAUSE_MS = 120;
const VOICE_STREAM_MIN_CHARS = 120;
const VOICE_STREAM_MAX_CHARS = 240;
const VOICE_CHAT_UNEXPECTED_END_RETRY_DELAY_MS = 900;
const VOICE_CHAT_MAX_UNEXPECTED_END_RETRIES = 2;

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

function resolveSpeechLocale(language = "English") {
  const normalized = compactText(language, "English").toLowerCase();
  if (normalized === "isizulu") return "zu-ZA";
  if (normalized === "afrikaans") return "af-ZA";
  if (normalized === "isixhosa") return "xh-ZA";
  if (normalized === "sesotho") return "st-ZA";
  if (normalized === "setswana") return "tn-ZA";
  if (normalized === "french") return "fr-FR";
  if (normalized === "portuguese") return "pt-PT";
  return "en-US";
}

function formatProviderLabel(provider = "") {
  const normalized = compactText(provider).toLowerCase();
  return {
    gemini: "Gemini 2.5 Flash",
    groq: "Groq Llama 3.3 70B",
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
  if (normalized === "language-not-supported") return "This browser does not support the selected speech language.";
  return "Voice input had a browser error. You can type your question instead.";
}

function pickSpeechSynthesisVoice(locale = "", voices = []) {
  if (!Array.isArray(voices) || !voices.length) return null;
  const normalizedLocale = compactText(locale).toLowerCase();
  if (!normalizedLocale) return voices[0] || null;
  const languageCode = normalizedLocale.split("-")[0];
  return (
    voices.find((voice) => compactText(voice?.lang).toLowerCase() === normalizedLocale)
    || voices.find((voice) => compactText(voice?.lang).toLowerCase().startsWith(`${languageCode}-`))
    || voices.find((voice) => compactText(voice?.lang).toLowerCase() === languageCode)
    || voices[0]
    || null
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
  const voiceUnexpectedEndRetryCountRef = useRef(0);
  const voiceReplyRunRef = useRef(0);
  const voiceReplyChunkTimerRef = useRef(0);
  const voiceSpeechQueueRef = useRef([]);
  const voiceSpeechBufferRef = useRef("");
  const voiceSpeechPlaybackActiveRef = useRef(false);
  const voiceSpeechStreamDoneRef = useRef(false);
  const voiceInterruptionRequestedRef = useRef(false);
  const recognitionStopReasonRef = useRef("");
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
    utterance.onstart = () => {
      if (voiceReplyRunRef.current !== runId) return;
      setIsSpeaking(true);
      setIsVoiceReconnecting(false);
      setStatusText(isGenerating ? "Speaking while the answer keeps streaming..." : "Speaking the answer aloud...");
    };
    utterance.onend = () => {
      if (voiceReplyRunRef.current !== runId) return;
      voiceSpeechPlaybackActiveRef.current = false;
      voiceReplyChunkTimerRef.current = window.setTimeout(() => {
        voiceReplyChunkTimerRef.current = 0;
        playNextVoiceSpeechChunk(runId, preferredLocale, selectedVoice);
      }, VOICE_REPLY_CHUNK_PAUSE_MS);
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
      voiceSpeechQueueRef.current.push(...ready);
    }
  };

  const startVoiceSpeechStream = () => {
    if (typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      return false;
    }
    stopSpeaking();
    const preferredLocale = resolveSpeechLocale(outputLanguage);
    const selectedVoice = pickSpeechSynthesisVoice(preferredLocale, window.speechSynthesis.getVoices?.() || []) || null;
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
    const spokenText = compactText(text);
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
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore browser speech-recognition stop failures.
      }
      recognitionRef.current = null;
    }
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

  const startListening = ({ continueVoiceChat = false } = {}) => {
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
    if (!hasLectureContext) {
      setStatusText("Load a lecture transcript or study guide first.");
      return;
    }

    openPanel({ focusComposer: false });
    if (!ttsEnabledRef.current) {
      setVoiceRepliesEnabled(true);
    }
    applyVoiceModeEnabled(true);
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
    recognition.lang = resolveSpeechLocale(outputLanguage);
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
      voiceNetworkRetryCountRef.current = 0;
      voiceUnexpectedEndRetryCountRef.current = 0;
      setIsListening(true);
      setIsVoiceReconnecting(false);
      setStatusText(continueVoiceChat
        ? "Listening for your next question..."
        : "Voice chat is on. Speak your question now.");
      scheduleListeningTimeout(
        VOICE_CHAT_INITIAL_IDLE_TIMEOUT_MS,
        "No speech detected yet. Finishing the voice turn...",
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
      if (errorCode === "no-speech" && voiceModeEnabledRef.current) {
        recognitionStopReasonRef.current = "no_speech_retry";
        ignoreRecognitionEndRef.current = true;
        setIsListening(false);
        scheduleVoiceListeningRestart({
          delayMs: 420,
          continueVoiceChat: true,
          statusMessage: "Still listening. Speak whenever you are ready...",
        });
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
        voiceUnexpectedEndRetryCountRef.current = 0;
        setDraft(spokenQuestion);
        setStatusText("Sending your voice question...");
        await sendMessage({ promptText: spokenQuestion });
        return;
      }
      if (speechRecognitionErrorRef.current) return;

      if (stopReason === "silence_timeout") {
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
  } = {}) => {
    const question = compactText(promptText);
    if (!question) {
      setStatusText("Type or speak a question first.");
      return false;
    }
    if (!hasLectureContext) {
      setStatusText("Load a lecture transcript or study guide first.");
      return false;
    }
    if (isGenerating) return false;

    openPanel();
    setIsVoiceReconnecting(false);
    stopSpeaking();
    stopListening();

    const targetConversation = ensureActiveConversation();
    const targetConversationId = targetConversation.id;
    const currentMessages = Array.isArray(baseMessages) ? baseMessages : targetConversation.messages;
    const nextUserMessage = appendUserMessage ? createConversationMessage("user", question) : null;
    const nextAssistantMessage = createConversationMessage("assistant", "", { status: "streaming" });
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
    setStatusText(voiceModeEnabledRef.current ? "Processing your voice question..." : "Connecting to Gemini...");
    setActiveProvider("");

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let streamedText = "";
    const shouldStreamVoiceReply = Boolean(voiceModeEnabledRef.current && ttsEnabledRef.current);
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
        language: outputLanguage,
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
          setStatusText(voiceModeEnabledRef.current
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
          setStatusText(voiceModeEnabledRef.current
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

      if (!voiceSpeechStream) {
        speakReply(streamedText);
      } else {
        voiceSpeechStream.markDone();
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
        if (voiceModeEnabledRef.current) {
          applyVoiceModeEnabled(false);
        }
        setStatusText("Generation stopped.");
        return false;
      }
      if (!compactText(streamedText)) removeMessageById(targetConversationId, nextAssistantMessage.id);
      else patchMessage(targetConversationId, nextAssistantMessage.id, { status: "complete" });
      stopSpeaking();
      if (voiceModeEnabledRef.current) {
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
    canSend: Boolean(compactText(draft)) && !isGenerating && hasLectureContext,
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
