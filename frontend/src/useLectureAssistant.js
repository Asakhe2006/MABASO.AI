import { useEffect, useMemo, useRef, useState } from "react";

const ASSISTANT_STORAGE_PREFIX = "mabaso-lecture-assistant-v1";
const ASSISTANT_THEME_STORAGE_KEY = "mabaso-lecture-assistant-theme";
const ASSISTANT_TTS_STORAGE_KEY = "mabaso-lecture-assistant-tts";
const MAX_SAVED_CONVERSATIONS = 24;

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
  const [statusText, setStatusText] = useState("Open the lecture assistant to ask follow-up questions with streaming replies.");
  const [activeProvider, setActiveProvider] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState("");

  const hasLoadedStorageRef = useRef(false);
  const lastContextKeyRef = useRef("");
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const composerRef = useRef(null);
  const copyResetTimerRef = useRef(0);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0] || null,
    [activeConversationId, conversations],
  );
  const messages = activeConversation?.messages || [];

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const speakReply = (text = "") => {
    const spokenText = compactText(text);
    if (!ttsEnabled || !spokenText) return;
    if (typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      setStatusText("This browser cannot read replies aloud, but the answer is ready.");
      return;
    }
    stopSpeaking();
    const utterance = new window.SpeechSynthesisUtterance(spokenText);
    utterance.lang = resolveSpeechLocale(outputLanguage);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      setStatusText("The reply is ready, but browser text-to-speech could not play it.");
    };
    window.speechSynthesis.speak(utterance);
  };

  const stopListening = () => {
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

  const startListening = () => {
    if (isListening) {
      stopListening();
      return;
    }
    const SpeechRecognitionCtor = typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
    if (!SpeechRecognitionCtor) {
      setStatusText("Browser voice input is not available here.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = resolveSpeechLocale(outputLanguage);
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    let finalTranscript = "";
    recognition.onstart = () => {
      setIsListening(true);
      setStatusText("Listening... speak naturally, then stop when you are done.");
    };
    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcriptText = result?.[0]?.transcript || "";
        if (result.isFinal) finalTranscript += `${transcriptText} `;
        else interimTranscript += transcriptText;
      }
      setDraft(`${finalTranscript}${interimTranscript}`.trimStart());
    };
    recognition.onerror = () => {
      setStatusText("Voice input had a browser error. You can type your question instead.");
      setIsListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      setStatusText(finalTranscript.trim() ? "Voice captured. Review it or send it now." : "Voice input stopped.");
    };

    try {
      recognition.start();
    } catch {
      setStatusText("Voice input could not start in this browser tab.");
      setIsListening(false);
    }
  };

  const stopGenerating = () => {
    abortControllerRef.current?.abort?.();
    abortControllerRef.current = null;
    setIsGenerating(false);
    setStatusText("Generation stopped.");
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
    setStatusText("Connecting to Gemini...");
    setActiveProvider("");

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let streamedText = "";

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
          setStatusText(`${data.label || formatProviderLabel(data.provider)} is replying...`);
          return;
        }
        if (event === "delta") {
          const chunk = String(data.text || "");
          if (!chunk) return;
          streamedText += chunk;
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
          patchMessage(targetConversationId, nextAssistantMessage.id, (message) => ({
            ...message,
            provider: compactText(data.provider, message.provider),
            model: compactText(data.model, message.model),
            status: "complete",
          }));
          setStatusText(`${data.label || formatProviderLabel(data.provider)} finished the reply.`);
          return;
        }
        if (event === "error") {
          throw new Error(compactText(data.message, "The lecture assistant could not finish that reply."));
        }
      });

      if (!compactText(streamedText)) {
        throw new Error("The lecture assistant did not return any text.");
      }

      speakReply(streamedText);
      return true;
    } catch (error) {
      if (error?.name === "AbortError") {
        if (!compactText(streamedText)) removeMessageById(targetConversationId, nextAssistantMessage.id);
        else patchMessage(targetConversationId, nextAssistantMessage.id, { status: "complete" });
        setStatusText("Generation stopped.");
        return false;
      }
      if (!compactText(streamedText)) removeMessageById(targetConversationId, nextAssistantMessage.id);
      else patchMessage(targetConversationId, nextAssistantMessage.id, { status: "complete" });
      setStatusText(compactText(error?.message, "The lecture assistant could not answer right now."));
      return false;
    } finally {
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
      setTtsEnabled(window.localStorage.getItem(ASSISTANT_TTS_STORAGE_KEY) === "true");
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
    isListening,
    isOpen,
    isSpeaking,
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
    theme,
    toggleListening: startListening,
    togglePanel,
    toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark"),
    toggleTts: () => setTtsEnabled((current) => !current),
    ttsEnabled,
  };
}
