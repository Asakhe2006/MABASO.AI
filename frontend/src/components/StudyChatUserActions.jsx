import { useEffect, useRef, useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";

export default function StudyChatUserActions({ message, disabled = false, onEdit, onError }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const copyQuestion = async () => {
    try {
      await navigator.clipboard.writeText(String(message?.content || ""));
      setCopied(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onError?.("Copy failed. Your browser may be blocking clipboard access.");
    }
  };

  return (
    <div className="study-chat-message-actions is-user-actions" aria-label="Question actions">
      <button type="button" className={`study-chat-message-action ${copied ? "is-copied" : ""}`} onClick={copyQuestion} aria-label={copied ? "Copied" : "Copy question"} title={copied ? "Copied" : "Copy"}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
      <button type="button" className="study-chat-message-action" onClick={() => onEdit?.(message)} disabled={disabled} aria-label="Edit question" title="Edit question">
        <Pencil aria-hidden="true" />
      </button>
    </div>
  );
}
