import AssistantMarkdown from "./AssistantMarkdown";

function themed(theme, darkValue, lightValue) {
  return theme === "light" ? lightValue : darkValue;
}

function formatMessageTime(timestamp = "") {
  if (!timestamp) return "";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function buildMessagePreview(content = "", fallback = "New lecture chat") {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 44 ? `${text.slice(0, 41).trim()}...` : text;
}

function TypingIndicator({ theme = "dark" }) {
  const dotTone = themed(theme, "bg-emerald-200/90", "bg-emerald-600");
  return (
    <div className="inline-flex items-center gap-1.5">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`h-2.5 w-2.5 animate-pulse rounded-full ${dotTone}`}
          style={{ animationDelay: `${index * 150}ms` }}
        />
      ))}
    </div>
  );
}

export default function LectureAssistantPanel({ assistant, visible = true }) {
  if (!visible || !assistant) return null;

  const {
    activeConversation,
    closePanel,
    copiedMessageId,
    composerRef,
    conversations,
    copyMessage,
    createConversation,
    deleteConversation,
    draft,
    hasLectureContext,
    isGenerating,
    isListening,
    isOpen,
    lectureLabel,
    messages,
    messagesEndRef,
    openPanel,
    providerLabel,
    regenerateLastResponse,
    selectConversation,
    sendMessage,
    setDraft,
    startListening,
    statusText,
    stopGenerating,
    theme,
    toggleTheme,
    toggleTts,
    ttsEnabled,
  } = assistant;

  const lastAssistantMessageId = [...messages].reverse().find((message) => message.role === "assistant")?.id || "";
  const savedMessageCount = messages.length;
  const isExpanded = Boolean(isOpen || isGenerating || isListening || String(draft || "").trim());
  const recentConversations = conversations.slice(0, 5);

  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isGenerating) sendMessage();
    }
  };

  const handleComposerFocus = () => {
    if (!isOpen) openPanel({ focusComposer: false });
  };

  const handleDeleteCurrentConversation = () => {
    if (!activeConversation?.id) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this saved lecture conversation?")) return;
    deleteConversation(activeConversation.id);
  };

  return (
    <section className={`rounded-[28px] border p-4 shadow-[0_24px_60px_rgba(2,8,23,0.22)] backdrop-blur-xl sm:p-5 ${themed(theme, "border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))]", "border-slate-200 bg-white/95")}`}>
      {isExpanded ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-xs uppercase tracking-[0.28em] ${themed(theme, "text-emerald-200/70", "text-emerald-700")}`}>Lecture Assistant</p>
              <h3 className={`mt-2 text-xl font-semibold ${themed(theme, "text-white", "text-slate-900")}`}>Ask anything from this lecture</h3>
              <p className={`mt-2 text-sm ${themed(theme, "text-slate-300", "text-slate-600")}`}>{lectureLabel || "Use the loaded transcript, guide, formulas, and examples as context."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createConversation}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${themed(theme, "border border-white/10 bg-white/5 text-white hover:bg-white/10", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
              >
                New Chat
              </button>
              <button
                type="button"
                onClick={toggleTts}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${ttsEnabled
                  ? themed(theme, "border border-emerald-300/25 bg-emerald-300/12 text-emerald-50", "border border-emerald-200 bg-emerald-50 text-emerald-700")
                  : themed(theme, "border border-white/10 bg-white/5 text-white hover:bg-white/10", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
              >
                {ttsEnabled ? "Voice Replies On" : "Voice Replies Off"}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${themed(theme, "border border-white/10 bg-white/5 text-white hover:bg-white/10", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
              >
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
              {activeConversation?.messages?.length ? (
                <button
                  type="button"
                  onClick={handleDeleteCurrentConversation}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${themed(theme, "border border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15", "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100")}`}
                >
                  Delete Chat
                </button>
              ) : null}
              {!isGenerating && !isListening && !String(draft || "").trim() ? (
                <button
                  type="button"
                  onClick={closePanel}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${themed(theme, "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white", "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900")}`}
                >
                  Minimize
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-2 text-xs font-semibold ${themed(theme, "bg-cyan-400/12 text-cyan-100", "bg-cyan-50 text-cyan-700")}`}>{providerLabel || "Gemini to Groq fallback ready"}</span>
            <span className={`rounded-full px-3 py-2 text-xs font-semibold ${hasLectureContext
              ? themed(theme, "bg-emerald-300/12 text-emerald-50", "bg-emerald-50 text-emerald-700")
              : themed(theme, "bg-amber-400/12 text-amber-100", "bg-amber-50 text-amber-700")}`}
            >
              {hasLectureContext ? "Lecture context loaded" : "Load a lecture first"}
            </span>
            <span className={`rounded-full px-3 py-2 text-xs font-semibold ${isListening
              ? themed(theme, "bg-fuchsia-400/12 text-fuchsia-100", "bg-fuchsia-50 text-fuchsia-700")
              : themed(theme, "bg-white/5 text-slate-300", "bg-slate-100 text-slate-600")}`}
            >
              {isListening ? "Listening now" : "Voice input ready"}
            </span>
          </div>

          {recentConversations.length > 1 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {recentConversations.map((conversation) => {
                const isActive = conversation.id === activeConversation?.id;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => selectConversation(conversation.id)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${isActive
                      ? themed(theme, "bg-emerald-300/12 text-emerald-50", "bg-emerald-50 text-emerald-700")
                      : themed(theme, "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
                  >
                    {buildMessagePreview(conversation.title)}
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-xs uppercase tracking-[0.28em] ${themed(theme, "text-emerald-200/70", "text-emerald-700")}`}>Lecture Assistant</p>
            <p className={`mt-2 text-sm ${themed(theme, "text-slate-300", "text-slate-600")}`}>
              {savedMessageCount
                ? `${savedMessageCount} saved message${savedMessageCount === 1 ? "" : "s"} in this lecture chat.`
                : "Tap inside the Ask anything box to open the full lecture chat here."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-2 text-xs font-semibold ${hasLectureContext
              ? themed(theme, "bg-emerald-300/12 text-emerald-50", "bg-emerald-50 text-emerald-700")
              : themed(theme, "bg-amber-400/12 text-amber-100", "bg-amber-50 text-amber-700")}`}
            >
              {hasLectureContext ? "Ready here" : "Lecture not loaded"}
            </span>
            <span className={`rounded-full px-3 py-2 text-xs font-semibold ${themed(theme, "bg-white/5 text-slate-300", "bg-slate-100 text-slate-600")}`}>
              {providerLabel || "Secure streaming chat"}
            </span>
          </div>
        </div>
      )}

      {isExpanded ? (
        <>
          <div className={`mt-4 rounded-[24px] border px-4 py-3 text-sm ${themed(theme, "border-white/10 bg-white/[0.03] text-slate-300", "border-slate-200 bg-slate-50 text-slate-600")}`}>
            {statusText}
          </div>

          <div className={`mt-4 rounded-[24px] border px-4 py-4 sm:px-5 ${themed(theme, "border-white/10 bg-slate-950/70", "border-slate-200 bg-slate-50/80")}`}>
            {messages.length ? (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.role === "assistant" ? (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f766e,#22c55e)] text-sm font-semibold text-white">AI</div>
                    ) : null}
                    <div className={`max-w-[88%] rounded-[24px] border px-4 py-3 ${message.role === "assistant"
                      ? themed(theme, "border-emerald-300/18 bg-emerald-300/10 text-slate-100", "border-emerald-100 bg-white text-slate-800")
                      : themed(theme, "border-white/10 bg-white/8 text-white", "border-slate-200 bg-slate-900 text-white")}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${message.role === "assistant"
                          ? themed(theme, "text-emerald-100/75", "text-emerald-700")
                          : "text-white/70"}`}
                        >
                          {message.role === "assistant" ? "Mabaso AI" : "You"}
                        </p>
                        {message.provider ? (
                          <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${message.role === "assistant"
                            ? themed(theme, "bg-white/8 text-slate-200", "bg-slate-100 text-slate-600")
                            : "bg-white/10 text-white/80"}`}
                          >
                            {message.provider}
                          </span>
                        ) : null}
                        {formatMessageTime(message.timestamp) ? (
                          <span className={`text-[11px] ${themed(theme, "text-slate-400", message.role === "assistant" ? "text-slate-500" : "text-white/65")}`}>
                            {formatMessageTime(message.timestamp)}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3">
                        {message.role === "assistant" ? (
                          <AssistantMarkdown content={message.content} theme={theme} />
                        ) : (
                          <p className="whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => copyMessage(message.id, message.content)}
                          className={`font-semibold transition ${themed(theme, "text-slate-200 hover:text-white", message.role === "assistant" ? "text-slate-600 hover:text-slate-900" : "text-white/85 hover:text-white")}`}
                        >
                          {copiedMessageId === message.id ? "Copied" : "Copy"}
                        </button>
                        {message.role === "assistant" && message.id === lastAssistantMessageId && !isGenerating ? (
                          <button
                            type="button"
                            onClick={regenerateLastResponse}
                            className={`font-semibold transition ${themed(theme, "text-emerald-100 hover:text-white", "text-emerald-700 hover:text-emerald-800")}`}
                          >
                            Regenerate
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {message.role === "user" ? (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">You</div>
                    ) : null}
                  </div>
                ))}

                {isGenerating ? (
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f766e,#22c55e)] text-sm font-semibold text-white">AI</div>
                    <div className={`rounded-[24px] border px-4 py-3 ${themed(theme, "border-emerald-300/18 bg-emerald-300/10", "border-emerald-100 bg-white")}`}>
                      <TypingIndicator theme={theme} />
                    </div>
                  </div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className={`rounded-[20px] border border-dashed px-4 py-5 ${themed(theme, "border-white/10 bg-white/[0.02] text-slate-300", "border-slate-200 bg-white text-slate-600")}`}>
                <p className={`text-sm font-semibold ${themed(theme, "text-white", "text-slate-900")}`}>Ask naturally, like you would in Copilot or ChatGPT.</p>
                <p className="mt-3 text-sm leading-7">This chat stays inside your lecture workspace, remembers conversation history in this browser, and streams replies securely from the backend.</p>
              </div>
            )}
          </div>
        </>
      ) : null}

      <div className={`mt-4 rounded-[24px] border p-3 ${themed(theme, "border-white/10 bg-slate-950/82", "border-slate-200 bg-white")}`}>
        <div className="flex items-end gap-3">
          <textarea
            ref={composerRef}
            value={draft}
            onFocus={handleComposerFocus}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            rows={isExpanded ? 2 : 1}
            placeholder={hasLectureContext ? "Ask anything from this lecture..." : "Load a transcript or study guide first..."}
            className={`min-h-[56px] flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-7 outline-none ${themed(theme, "placeholder:text-slate-500 text-slate-100", "placeholder:text-slate-400 text-slate-900")}`}
          />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                handleComposerFocus();
                startListening();
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${isListening
                ? themed(theme, "border-fuchsia-300/35 bg-fuchsia-400/15 text-fuchsia-100", "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700")
                : themed(theme, "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10", "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100")}`}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M12 4a3 3 0 0 1 3 3v4a3 3 0 1 1-6 0V7a3 3 0 0 1 3-3Zm-6 7a1 1 0 0 1 2 0 4 4 0 1 0 8 0 1 1 0 1 1 2 0 6 6 0 0 1-5 5.91V20h2a1 1 0 1 1 0 2H9a1 1 0 0 1 0-2h2v-2.09A6 6 0 0 1 6 11Z" fill="currentColor" />
              </svg>
            </button>

            {isGenerating ? (
              <button
                type="button"
                onClick={stopGenerating}
                className={`rounded-full px-4 py-3 text-sm font-semibold transition ${themed(theme, "bg-rose-500/90 text-white hover:bg-rose-500", "bg-rose-600 text-white hover:bg-rose-700")}`}
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!assistant.canSend}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f766e,#22c55e)] text-white transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
