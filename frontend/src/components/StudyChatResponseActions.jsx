import { useEffect, useRef, useState } from "react";
import { Check, Copy, Square, Volume2 } from "lucide-react";

const SPEECH_EVENT = "mabaso-study-chat-speech-change";
let activeSpeechMessageId = "";

function toPlainText(content = "") {
  return String(content || "")
    .replace(/```[\w-]*\s*([\s\S]*?)```/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-+*]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\|/g, "; ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function speechLocale(language = "English") {
  const value = String(language || "").toLowerCase();
  if (value.includes("zulu") || value.includes("isizulu")) return "zu-ZA";
  if (value.includes("afrikaans")) return "af-ZA";
  return "en-ZA";
}

function chunksForSpeech(text = "", maxLength = 380) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  const chunks = [];
  let current = "";
  sentences.forEach((sentence) => {
    if (current && `${current} ${sentence}`.length > maxLength) {
      chunks.push(current);
      current = sentence;
    } else {
      current = [current, sentence].filter(Boolean).join(" ");
    }
  });
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text];
}

function broadcastSpeech(messageId = "") {
  activeSpeechMessageId = messageId;
  window.dispatchEvent(new CustomEvent(SPEECH_EVENT, { detail: { messageId } }));
}

function cancelSpeech() {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  if (typeof window !== "undefined") broadcastSpeech("");
}

export default function StudyChatResponseActions({ messageId, content, language = "English", preferredVoice = "", onError }) {
  const [copied, setCopied] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const copyTimerRef = useRef(null);
  const speechRunRef = useRef(0);

  useEffect(() => {
    const onSpeechChange = (event) => setIsReading(event.detail?.messageId === messageId);
    window.addEventListener(SPEECH_EVENT, onSpeechChange);
    return () => {
      window.removeEventListener(SPEECH_EVENT, onSpeechChange);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      if (activeSpeechMessageId === messageId) cancelSpeech();
    };
  }, [messageId]);

  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(content));
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onError?.("Copy failed. Your browser may be blocking clipboard access.");
    }
  };

  const toggleReadAloud = () => {
    if (isReading) {
      speechRunRef.current += 1;
      cancelSpeech();
      return;
    }
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      onError?.("Read aloud is not supported by this browser.");
      return;
    }
    const spokenText = toPlainText(content);
    if (!spokenText) return;
    cancelSpeech();
    const runId = speechRunRef.current + 1;
    speechRunRef.current = runId;
    broadcastSpeech(messageId);
    const voices = window.speechSynthesis.getVoices();
    const locale = speechLocale(language);
    const selectedVoice = voices.find((voice) => voice.name === preferredVoice)
      || voices.find((voice) => voice.lang?.toLowerCase() === locale.toLowerCase())
      || voices.find((voice) => voice.lang?.toLowerCase().startsWith(locale.slice(0, 2).toLowerCase()));
    const chunks = chunksForSpeech(spokenText);
    let index = 0;
    const speakNext = () => {
      if (speechRunRef.current !== runId || activeSpeechMessageId !== messageId) return;
      if (index >= chunks.length) {
        broadcastSpeech("");
        return;
      }
      const utterance = new window.SpeechSynthesisUtterance(chunks[index]);
      index += 1;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.lang = selectedVoice?.lang || locale;
      utterance.rate = 0.96;
      utterance.onend = speakNext;
      utterance.onerror = (event) => {
        if (!["canceled", "interrupted"].includes(event.error)) onError?.("Read aloud stopped because the browser could not play this response.");
        if (activeSpeechMessageId === messageId) broadcastSpeech("");
      };
      window.speechSynthesis.speak(utterance);
    };
    speakNext();
  };

  return (
    <div className="study-chat-message-actions" aria-label="Response actions">
      <button type="button" className={`study-chat-message-action ${copied ? "is-copied" : ""}`} onClick={copyResponse} aria-label={copied ? "Copied" : "Copy response"} title={copied ? "Copied" : "Copy"}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
      <button type="button" className={`study-chat-message-action ${isReading ? "is-reading" : ""}`} onClick={toggleReadAloud} aria-label={isReading ? "Stop reading response" : "Read response aloud"} title={isReading ? "Stop reading" : "Read aloud"}>
        {isReading ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      </button>
    </div>
  );
}
