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

function describeConversationTime(timestamp = "") {
  if (!timestamp) return "Now";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "Now";
  return parsed.toLocaleDateString([], { month: "short", day: "numeric" });
}

function buildMessagePreview(content = "", fallback = "New lecture chat") {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 78 ? `${text.slice(0, 75).trim()}...` : text;
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
    togglePanel,
    toggleTheme,
    toggleTts,
    ttsEnabled,
  } = assistant;

  const lastAssistantMessageId = [...messages].reverse().find((message) => message.role === "assistant")?.id || "";

  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isGenerating) sendMessage();
    }
  };

  const handleDeleteConversation = (conversationId) => {
    if (!conversationId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this saved lecture conversation?")) return;
    deleteConversation(conversationId);
  };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex max-w-[calc(100vw-1rem)] flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      <section
        className={`pointer-events-auto w-[min(980px,calc(100vw-1rem))] transition-all duration-300 ${
          isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
        }`}
        aria-hidden={!isOpen}
      >
        <div className={`overflow-hidden rounded-[30px] border shadow-[0_28px_90px_rgba(15,23,42,0.28)] backdrop-blur-2xl ${themed(theme, "border-white/10 bg-slate-950/92", "border-slate-200/90 bg-white/95")}`}>
          <div className="grid max-h-[min(78vh,820px)] min-h-[460px] lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className={`hidden min-h-0 flex-col border-r lg:flex ${themed(theme, "border-white/10 bg-white/[0.03]", "border-slate-200 bg-slate-50/80")}`}>
              <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5">
                <div>
                  <p className={`text-xs uppercase tracking-[0.28em] ${themed(theme, "text-emerald-200/70", "text-emerald-700")}`}>Saved Chats</p>
                  <p className={`mt-2 text-sm ${themed(theme, "text-slate-300", "text-slate-600")}`}>{conversations.length} stored locally in this browser</p>
                </div>
                <button
                  type="button"
                  onClick={createConversation}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${themed(theme, "border border-white/10 bg-white/5 text-white hover:bg-white/10", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
                >
                  New Chat
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
                {conversations.map((conversation) => {
                  const isActive = conversation.id === activeConversation?.id;
                  return (
                    <div
                      key={conversation.id}
                      className={`rounded-[22px] border p-3 transition ${isActive
                        ? themed(theme, "border-emerald-300/30 bg-emerald-300/10", "border-emerald-200 bg-emerald-50")
                        : themed(theme, "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]", "border-slate-200 bg-white hover:bg-slate-100")}`}
                    >
                      <button type="button" onClick={() => selectConversation(conversation.id)} className="w-full text-left">
                        <p className={`text-sm font-semibold ${themed(theme, "text-white", "text-slate-900")}`}>{buildMessagePreview(conversation.title, "New lecture chat")}</p>
                        <p className={`mt-2 text-xs ${themed(theme, "text-slate-400", "text-slate-500")}`}>{buildMessagePreview(conversation.lectureLabel || lectureLabel, "Current lecture")}</p>
                        <p className={`mt-3 text-[11px] uppercase tracking-[0.22em] ${themed(theme, "text-slate-500", "text-slate-400")}`}>{describeConversationTime(conversation.updatedAt)}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteConversation(conversation.id)}
                        className={`mt-3 text-xs font-medium transition ${themed(theme, "text-rose-200/90 hover:text-white", "text-rose-600 hover:text-rose-700")}`}
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </aside>

            <div className="flex min-h-0 flex-col">
              <div className={`border-b px-4 pb-4 pt-5 sm:px-5 ${themed(theme, "border-white/10", "border-slate-200")}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-xs uppercase tracking-[0.28em] ${themed(theme, "text-emerald-200/70", "text-emerald-700")}`}>Lecture Assistant</p>
                    <h2 className={`mt-2 text-xl font-semibold ${themed(theme, "text-white", "text-slate-900")}`}>Modern lecture chat with secure streaming replies</h2>
                    <p className={`mt-2 text-sm ${themed(theme, "text-slate-300", "text-slate-600")}`}>{lectureLabel || "Open a lecture and ask follow-up questions about it."}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${themed(theme, "border border-white/10 bg-white/5 text-white hover:bg-white/10", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
                    >
                      {theme === "dark" ? "Light Mode" : "Dark Mode"}
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
                      onClick={togglePanel}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${themed(theme, "border border-white/10 bg-white/5 text-white hover:bg-white/10", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={createConversation}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${themed(theme, "border border-white/10 bg-white/5 text-white hover:bg-white/10", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
                  >
                    New Chat
                  </button>
                  {conversations.slice(0, 6).map((conversation) => {
                    const isActive = conversation.id === activeConversation?.id;
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => selectConversation(conversation.id)}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${isActive
                          ? themed(theme, "bg-emerald-300/12 text-emerald-50", "bg-emerald-50 text-emerald-700")
                          : themed(theme, "border border-white/10 bg-white/5 text-slate-200", "border border-slate-200 bg-white text-slate-700")}`}
                      >
                        {buildMessagePreview(conversation.title, "Chat")}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-2 text-xs font-semibold ${themed(theme, "bg-cyan-400/12 text-cyan-100", "bg-cyan-50 text-cyan-700")}`}>{providerLabel || "Ready"}</span>
                  <span className={`rounded-full px-3 py-2 text-xs ${hasLectureContext
                    ? themed(theme, "bg-emerald-300/12 text-emerald-50", "bg-emerald-50 text-emerald-700")
                    : themed(theme, "bg-amber-400/12 text-amber-100", "bg-amber-50 text-amber-700")}`}
                  >
                    {hasLectureContext ? "Lecture context loaded" : "Load a lecture first"}
                  </span>
                  <span className={`rounded-full px-3 py-2 text-xs ${isListening
                    ? themed(theme, "bg-fuchsia-400/12 text-fuchsia-100", "bg-fuchsia-50 text-fuchsia-700")
                    : themed(theme, "bg-white/5 text-slate-300", "bg-slate-100 text-slate-600")}`}
                  >
                    {isListening ? "Listening" : "Voice input ready"}
                  </span>
                </div>
              </div>

              <div className={`border-b px-4 py-3 text-sm ${themed(theme, "border-white/10 text-slate-300", "border-slate-200 text-slate-600")}`}>
                {statusText}
              </div>

              <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 ${themed(theme, "bg-transparent", "bg-white/40")}`}>
                {messages.length ? (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        {message.role === "assistant" ? (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f766e,#22c55e)] text-sm font-semibold text-white">AI</div>
                        ) : null}
                        <div className={`max-w-[88%] rounded-[26px] border px-4 py-3 sm:px-5 ${message.role === "assistant"
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
                  <div className={`rounded-[28px] border border-dashed p-6 ${themed(theme, "border-white/10 bg-white/[0.03] text-slate-300", "border-slate-200 bg-white/70 text-slate-600")}`}>
                    <p className={`text-sm font-semibold ${themed(theme, "text-white", "text-slate-900")}`}>Ask naturally, like you would in Copilot or ChatGPT.</p>
                    <p className="mt-3 text-sm leading-7">This assistant keeps lecture chat history in your browser, streams replies from the backend, and can switch from Gemini to Groq to OpenRouter automatically if needed.</p>
                  </div>
                )}
              </div>

              <div className={`border-t px-4 pb-4 pt-4 sm:px-5 ${themed(theme, "border-white/10", "border-slate-200")}`}>
                <div className={`rounded-[28px] border p-3 ${themed(theme, "border-white/10 bg-slate-950/70", "border-slate-200 bg-white")}`}>
                  <div className="flex items-end gap-3">
                    <textarea
                      ref={composerRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      rows={2}
                      placeholder={hasLectureContext ? "Ask anything from this lecture..." : "Load a transcript or study guide first..."}
                      className={`min-h-[76px] flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-7 outline-none ${themed(theme, "placeholder:text-slate-500 text-slate-100", "placeholder:text-slate-400 text-slate-900")}`}
                    />
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={startListening}
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
              </div>
            </div>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => openPanel({ focusComposer: true })}
        className="pointer-events-auto flex items-center gap-3 rounded-full bg-[linear-gradient(135deg,#052e2b,#0f766e,#22c55e)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)] transition hover:translate-y-[-1px]"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H11l-4.2 3.2A1 1 0 0 1 5.2 18.4V16.8A2.5 2.5 0 0 1 4 14.5v-8Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
            <path d="M8 9.5h8M8 12.5h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          </svg>
        </span>
        <span className="text-left">
          <span className="block text-[11px] uppercase tracking-[0.26em] text-emerald-100/80">Lecture AI</span>
          <span className="block text-sm">{isOpen ? "Assistant Open" : "Ask a question"}</span>
        </span>
      </button>
    </div>
  );
}
