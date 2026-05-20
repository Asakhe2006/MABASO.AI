import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  AudioLines,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  Menu,
  MessageSquarePlus,
  Mic,
  MoonStar,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  SunMedium,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
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

function formatConversationTime(timestamp = "") {
  if (!timestamp) return "";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "";
  const now = new Date();
  const sameDay = parsed.toDateString() === now.toDateString();
  if (sameDay) return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return parsed.toLocaleDateString([], { month: "short", day: "numeric" });
}

function buildMessagePreview(content = "", fallback = "Ready for your first question") {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 86 ? `${text.slice(0, 83).trim()}...` : text;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function groupConversationsByDate(conversations = []) {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const previousWeek = new Date(today);
  previousWeek.setDate(previousWeek.getDate() - 7);

  const buckets = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    Older: [],
  };

  conversations.forEach((conversation) => {
    const stamp = new Date(conversation.updatedAt || conversation.lastMessageAt || conversation.createdAt || now.toISOString());
    const day = startOfDay(stamp);
    if (day.getTime() === today.getTime()) {
      buckets.Today.push(conversation);
      return;
    }
    if (day.getTime() === yesterday.getTime()) {
      buckets.Yesterday.push(conversation);
      return;
    }
    if (day > previousWeek) {
      buckets["Previous 7 Days"].push(conversation);
      return;
    }
    buckets.Older.push(conversation);
  });

  return Object.entries(buckets).filter(([, items]) => items.length > 0);
}

function conversationMatchesLocalFilter(conversation, query = "") {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;
  return [
    conversation?.title,
    conversation?.previewText,
    conversation?.lastMessagePreview,
    conversation?.lectureLabel,
    conversation?.memorySummary,
  ]
    .map((value) => String(value || "").toLowerCase())
    .some((value) => value.includes(normalizedQuery));
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

function VoiceStateIndicator({ theme = "dark", mode = "idle" }) {
  const activeBarTone = themed(theme, "bg-fuchsia-200", "bg-fuchsia-600");
  const idleBarTone = themed(theme, "bg-slate-500/40", "bg-slate-300");
  const isActive = mode !== "idle";
  return (
    <div className="inline-flex items-end gap-1.5">
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          className={`w-1.5 rounded-full ${isActive ? `animate-pulse ${activeBarTone}` : idleBarTone}`}
          style={{
            height: `${12 + ((index % 2) * 8)}px`,
            animationDelay: isActive ? `${index * 120}ms` : "0ms",
          }}
        />
      ))}
    </div>
  );
}

function SidebarSkeleton({ theme = "dark" }) {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={index}
          className={`animate-pulse rounded-[22px] border px-4 py-4 ${themed(theme, "border-white/8 bg-white/[0.04]", "border-slate-200 bg-white/70")}`}
        >
          <div className={`h-4 rounded-full ${themed(theme, "bg-white/10", "bg-slate-200")}`} />
          <div className={`mt-3 h-3 w-3/4 rounded-full ${themed(theme, "bg-white/8", "bg-slate-100")}`} />
        </div>
      ))}
    </div>
  );
}

function MessageSkeleton({ theme = "dark" }) {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((index) => (
        <div key={index} className={`flex gap-3 ${index % 2 ? "justify-end" : "justify-start"}`}>
          {index % 2 ? null : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f766e,#22c55e)] text-sm font-semibold text-white">
              AI
            </div>
          )}
          <div className={`w-full max-w-[78%] animate-pulse rounded-[24px] border px-4 py-4 ${themed(theme, "border-white/10 bg-white/[0.05]", "border-slate-200 bg-white")}`}>
            <div className={`h-3 rounded-full ${themed(theme, "bg-white/12", "bg-slate-200")}`} />
            <div className={`mt-3 h-3 w-5/6 rounded-full ${themed(theme, "bg-white/8", "bg-slate-100")}`} />
            <div className={`mt-2 h-3 w-2/3 rounded-full ${themed(theme, "bg-white/8", "bg-slate-100")}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SidebarActionButton({ children, onClick, theme = "dark", danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm transition ${
        danger
          ? themed(theme, "text-rose-100 hover:bg-rose-500/12", "text-rose-700 hover:bg-rose-50")
          : themed(theme, "text-slate-200 hover:bg-white/8", "text-slate-700 hover:bg-slate-100")
      }`}
    >
      {children}
    </button>
  );
}

function formatTranscriptSource(source = "") {
  return {
    idle: "Waiting",
    browser: "Browser live transcript",
    whisper: "Whisper final transcript",
    hybrid: "Hybrid corrected transcript",
  }[String(source || "").toLowerCase()] || "Hybrid voice mode";
}

function formatTranscriptConfidence(confidence = 0) {
  const bounded = Number.isFinite(Number(confidence)) ? Math.max(0, Math.min(1, Number(confidence))) : 0;
  return `${Math.round(bounded * 100)}%`;
}

function VoiceProfileCard({
  theme = "dark",
  profile,
  selected = false,
  previewing = false,
  preparing = false,
  onSelect,
}) {
  return (
    <motion.button
      type="button"
      layout
      onClick={onSelect}
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      aria-pressed={selected}
      className={`relative overflow-hidden rounded-[28px] border p-4 text-left transition ${
        selected
          ? themed(
            theme,
            "border-emerald-300/28 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.22),transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.96))] text-white shadow-[0_22px_50px_rgba(16,185,129,0.2)]",
            "border-emerald-200 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,253,250,0.98))] text-slate-900 shadow-[0_22px_44px_rgba(15,23,42,0.08)]",
          )
          : themed(
            theme,
            "border-white/10 bg-white/[0.04] text-slate-100 hover:border-white/16 hover:bg-white/[0.06]",
            "border-slate-200 bg-white/82 text-slate-800 hover:bg-white",
          )
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_36%,transparent)] opacity-80" />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${themed(theme, selected ? "text-emerald-100/78" : "text-emerald-200/70", selected ? "text-emerald-700" : "text-emerald-700")}`}>
              Voice {profile.rank}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <h4 className="text-lg font-semibold">{profile.name}</h4>
              {selected ? (
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${themed(theme, "bg-emerald-300/16 text-emerald-50", "bg-emerald-50 text-emerald-700")}`}>
                  <Check className="h-4 w-4" />
                </span>
              ) : null}
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${themed(theme, selected ? "bg-white/10 text-white" : "bg-white/[0.06] text-slate-200", selected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}`}>
            {profile.accent}
          </span>
        </div>

        <p className={`mt-3 text-sm leading-6 ${themed(theme, selected ? "text-slate-100/92" : "text-slate-300", selected ? "text-slate-600" : "text-slate-600")}`}>
          {profile.personality}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {[profile.style, `${profile.energy} energy`, profile.voiceName].map((item) => (
            <span
              key={item}
              className={`rounded-full px-3 py-1 text-[11px] ${themed(theme, selected ? "bg-white/10 text-white/92" : "bg-white/[0.06] text-slate-300", selected ? "bg-white text-slate-700" : "bg-slate-100 text-slate-600")}`}
            >
              {item}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className={`text-xs ${themed(theme, selected ? "text-emerald-50/80" : "text-slate-400", selected ? "text-emerald-700/90" : "text-slate-500")}`}>
            {previewing || preparing ? "Preview playing..." : "Tap to select and hear a preview"}
          </p>
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${themed(theme, selected ? "bg-black/20 text-white" : "bg-black/20 text-slate-200", selected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}`}>
            {preparing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {selected ? "Selected" : "Preview"}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export default function LectureAssistantPanel({ assistant, visible = true }) {
  if (!visible || !assistant) return null;

  const {
    activeConversation,
    canLoadMoreConversations,
    closePanel,
    copiedMessageId,
    composerRef,
    conversations,
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
    isPreparingVoicePreview,
    isSpeaking,
    isSyncingConversation,
    isVoiceReconnecting,
    lectureLabel,
    loadMoreConversations,
    loadOlderMessages,
    messages,
    messagesEndRef,
    mobileSidebarOpen,
    openMobileSidebar,
    openPanel,
    providerLabel,
    previewingVoiceId,
    previewSelectedVoiceWithDraft,
    regenerateLastResponse,
    renameConversation,
    searchQuery,
    selectedVoiceProfile,
    selectedVoiceProfileId,
    selectConversation,
    selectVoiceProfile,
    sendMessage,
    setDraft,
    setMobileSidebarOpen,
    setSearchQuery,
    setVoicePreviewDraft,
    showArchived,
    sidebarCollapsed,
    statusText,
    stopGenerating,
    stopVoiceChat,
    theme,
    toggleArchiveConversation,
    togglePinnedConversation,
    toggleShowArchived,
    toggleSidebarCollapsed,
    toggleTheme,
    toggleTts,
    toggleVoiceChat,
    totalConversationCount,
    ttsEnabled,
    voiceListeningEngine,
    voiceModeEnabled,
    voicePreviewDraft,
    voiceProfiles,
    voiceTranscriptConfidence,
    voiceTranscriptSource,
  } = assistant;

  const [actionMenuId, setActionMenuId] = useState("");
  const lastAssistantMessageId = [...messages].reverse().find((message) => message.role === "assistant")?.id || "";
  const isExpanded = Boolean(isOpen || isGenerating || isListening || isSpeaking || voiceModeEnabled || String(draft || "").trim());
  const filteredConversations = useMemo(
    () => conversations.filter((conversation) => conversationMatchesLocalFilter(conversation, searchQuery)),
    [conversations, searchQuery],
  );
  const groupedConversations = useMemo(() => groupConversationsByDate(filteredConversations), [filteredConversations]);
  const transcriptSourceLabel = formatTranscriptSource(voiceTranscriptSource);
  const transcriptConfidenceLabel = formatTranscriptConfidence(voiceTranscriptConfidence);

  const voiceStateMode = isVoiceReconnecting
    ? "reconnecting"
    : isListening
      ? "listening"
      : isSpeaking
        ? "speaking"
        : isGenerating && voiceModeEnabled
          ? "processing"
          : voiceModeEnabled
            ? "ready"
            : "idle";

  const voiceStateLabel = isVoiceReconnecting
    ? "Reconnecting..."
    : isListening
      ? "Listening..."
      : isSpeaking
        ? "Speaking..."
        : isGenerating && voiceModeEnabled
          ? "Processing..."
          : voiceModeEnabled
            ? "Voice turn active"
            : "Voice ready";

  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isGenerating) sendMessage();
    }
  };

  const handleComposerFocus = () => {
    if (!isOpen) openPanel({ focusComposer: false });
  };

  const handleRenameConversation = async (conversation) => {
    const nextTitle = typeof window !== "undefined"
      ? window.prompt("Rename chat", conversation.title || "")
      : "";
    if (!nextTitle || nextTitle.trim() === conversation.title) return;
    await renameConversation(conversation.id, nextTitle);
    setActionMenuId("");
  };

  const handleDeleteConversation = async (conversation) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this saved conversation?")) return;
    await deleteConversation(conversation.id);
    setActionMenuId("");
  };

  const renderConversationCard = (conversation) => {
    const isActive = conversation.id === activeConversation?.id;
    return (
      <div key={conversation.id} className="relative">
        <button
          type="button"
          onClick={() => {
            setActionMenuId("");
            selectConversation(conversation.id);
          }}
          className={`group w-full rounded-[24px] border px-4 py-3 text-left transition duration-200 ${
            isActive
              ? themed(
                theme,
                "border-emerald-300/30 bg-emerald-300/12 text-white shadow-[0_18px_40px_rgba(16,185,129,0.12)]",
                "border-emerald-200 bg-white text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
              )
              : themed(
                theme,
                "border-white/10 bg-slate-950/45 text-slate-200 hover:border-white/20 hover:bg-white/[0.05]",
                "border-slate-200 bg-white/80 text-slate-700 hover:bg-white",
              )
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${isActive
              ? themed(theme, "bg-white/10 text-emerald-50", "bg-emerald-50 text-emerald-700")
              : themed(theme, "bg-white/6 text-slate-200", "bg-slate-100 text-slate-600")}`}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{conversation.title || "Untitled chat"}</p>
                {conversation.isPinned ? (
                  <Pin className={`h-3.5 w-3.5 shrink-0 ${themed(theme, "text-amber-200", "text-amber-600")}`} />
                ) : null}
                {conversation.isArchived ? (
                  <Archive className={`h-3.5 w-3.5 shrink-0 ${themed(theme, "text-slate-400", "text-slate-500")}`} />
                ) : null}
              </div>
              <p className={`mt-1 truncate text-xs ${themed(theme, isActive ? "text-emerald-50/85" : "text-slate-400", isActive ? "text-emerald-700/90" : "text-slate-500")}`}>
                {buildMessagePreview(conversation.lastMessagePreview || conversation.previewText)}
              </p>
              <div className={`mt-2 flex items-center gap-2 text-[11px] ${themed(theme, isActive ? "text-emerald-50/75" : "text-slate-400", isActive ? "text-emerald-700/80" : "text-slate-500")}`}>
                <span>{formatConversationTime(conversation.updatedAt || conversation.lastMessageAt || conversation.createdAt)}</span>
                <span className="opacity-60">|</span>
                <span>{Math.max(conversation.messageCount || 0, conversation.messages?.length || 0)} messages</span>
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActionMenuId((current) => current === conversation.id ? "" : conversation.id)}
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full transition ${
            isActive
              ? themed(theme, "bg-white/10 text-white hover:bg-white/16", "bg-slate-100 text-slate-700 hover:bg-slate-200")
              : themed(theme, "bg-black/20 text-slate-200 hover:bg-white/10", "bg-white text-slate-600 hover:bg-slate-100")
          }`}
          aria-label="Conversation actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {actionMenuId === conversation.id ? (
          <div className={`absolute right-3 top-14 z-20 w-52 rounded-[24px] border p-2 shadow-[0_24px_60px_rgba(15,23,42,0.22)] backdrop-blur-xl ${themed(theme, "border-white/12 bg-slate-950/92", "border-slate-200 bg-white/96")}`}>
            <SidebarActionButton theme={theme} onClick={() => handleRenameConversation(conversation)}>
              <Pencil className="h-4 w-4" />
              Rename chat
            </SidebarActionButton>
            <SidebarActionButton theme={theme} onClick={() => togglePinnedConversation(conversation.id)}>
              <Pin className="h-4 w-4" />
              {conversation.isPinned ? "Unpin chat" : "Pin chat"}
            </SidebarActionButton>
            <SidebarActionButton theme={theme} onClick={() => toggleArchiveConversation(conversation.id)}>
              <Archive className="h-4 w-4" />
              {conversation.isArchived ? "Restore chat" : "Archive chat"}
            </SidebarActionButton>
            <SidebarActionButton theme={theme} onClick={() => exportConversation(conversation.id)}>
              <Download className="h-4 w-4" />
              Export chat
            </SidebarActionButton>
            <SidebarActionButton theme={theme} danger onClick={() => handleDeleteConversation(conversation)}>
              <Trash2 className="h-4 w-4" />
              Delete chat
            </SidebarActionButton>
          </div>
        ) : null}
      </div>
    );
  };

  const sidebarContent = (
    <div className={`flex h-full flex-col ${themed(theme, "bg-white/[0.03]", "bg-white/80")}`}>
      <div className={`border-b px-4 py-4 ${themed(theme, "border-white/8", "border-slate-200/80")}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={createConversation}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0f766e,#22c55e)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(34,197,94,0.28)] transition hover:translate-y-[-1px]"
          >
            <MessageSquarePlus className="h-4 w-4" />
            New Chat
          </button>
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className={`hidden h-11 w-11 items-center justify-center rounded-2xl transition lg:flex ${themed(theme, "border border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]", "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100")}`}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <div className={`mt-4 flex items-center gap-3 rounded-[22px] border px-4 py-3 ${themed(theme, "border-white/10 bg-white/[0.04]", "border-slate-200 bg-white")}`}>
          <Search className={`h-4 w-4 ${themed(theme, "text-slate-400", "text-slate-500")}`} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search chats"
            className={`w-full bg-transparent text-sm outline-none ${themed(theme, "placeholder:text-slate-500 text-slate-100", "placeholder:text-slate-400 text-slate-900")}`}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={toggleShowArchived}
            className={`rounded-full px-3 py-2 text-xs font-semibold transition ${showArchived
              ? themed(theme, "bg-emerald-300/14 text-emerald-50", "bg-emerald-50 text-emerald-700")
              : themed(theme, "bg-white/[0.05] text-slate-300 hover:bg-white/[0.08]", "bg-slate-100 text-slate-600 hover:bg-slate-200")}`}
          >
                    {showArchived ? "Showing archived" : "Hide archived"}
                  </button>
                  <span className={`text-xs ${themed(theme, "text-slate-400", "text-slate-500")}`}>
            {totalConversationCount || filteredConversations.length} saved chats
                  </span>
                </div>
              </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {isLoadingConversations && !filteredConversations.length ? <SidebarSkeleton theme={theme} /> : null}

        {!isLoadingConversations && !filteredConversations.length ? (
          <div className={`rounded-[24px] border border-dashed px-4 py-6 text-sm ${themed(theme, "border-white/10 bg-white/[0.03] text-slate-300", "border-slate-200 bg-white text-slate-600")}`}>
            No saved chats yet. Start a new conversation and it will appear here.
          </div>
        ) : null}

        <div className="space-y-6">
          {groupedConversations.map(([label, items]) => (
            <section key={label}>
              <div className="mb-3 flex items-center justify-between px-2">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themed(theme, "text-emerald-200/70", "text-emerald-700")}`}>{label}</p>
                <span className={`text-[11px] ${themed(theme, "text-slate-500", "text-slate-400")}`}>{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map(renderConversationCard)}
              </div>
            </section>
          ))}
        </div>

        {canLoadMoreConversations ? (
          <button
            type="button"
            onClick={loadMoreConversations}
            disabled={isLoadingMoreConversations}
            className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${themed(theme, "border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.08]", "border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
          >
            {isLoadingMoreConversations ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Load more chats
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <section className={`relative overflow-hidden rounded-[30px] border p-3 shadow-[0_24px_70px_rgba(2,8,23,0.22)] backdrop-blur-2xl sm:p-4 ${themed(theme, "border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.12),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.97),rgba(15,23,42,0.93))]", "border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))]")}`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.04),transparent)]" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-3 px-1 pb-4">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={openMobileSidebar}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition lg:hidden ${themed(theme, "border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.1]", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
              aria-label="Open chat history"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className={`text-xs uppercase tracking-[0.28em] ${themed(theme, "text-emerald-200/75", "text-emerald-700")}`}>Lecture Assistant</p>
              <h3 className={`mt-2 truncate text-xl font-semibold ${themed(theme, "text-white", "text-slate-900")}`}>
                {activeConversation?.title || "Ask anything from this lecture"}
              </h3>
              <p className={`mt-2 max-w-2xl text-sm ${themed(theme, "text-slate-300", "text-slate-600")}`}>
                {lectureLabel || "Use the loaded transcript, formulas, notes, and examples as context."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleTts}
              className={`rounded-full px-3 py-2 text-xs font-semibold transition ${ttsEnabled
                ? themed(theme, "border border-emerald-300/25 bg-emerald-300/12 text-emerald-50", "border border-emerald-200 bg-emerald-50 text-emerald-700")
                : themed(theme, "border border-white/10 bg-white/5 text-white hover:bg-white/10", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
            >
              <span className="inline-flex items-center gap-2">
                {ttsEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                {ttsEnabled ? "Voice replies on" : "Voice replies off"}
              </span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className={`rounded-full px-3 py-2 text-xs font-semibold transition ${themed(theme, "border border-white/10 bg-white/5 text-white hover:bg-white/10", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
            >
              <span className="inline-flex items-center gap-2">
                {theme === "dark" ? <SunMedium className="h-3.5 w-3.5" /> : <MoonStar className="h-3.5 w-3.5" />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </span>
            </button>
            {voiceModeEnabled ? (
              <button
                type="button"
                onClick={() => stopVoiceChat({ message: "Voice conversation ended." })}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${themed(theme, "border border-fuchsia-300/20 bg-fuchsia-400/10 text-fuchsia-100 hover:bg-fuchsia-400/15", "border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100")}`}
              >
                End voice
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

        {isExpanded ? (
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className={`hidden overflow-hidden rounded-[28px] border lg:block ${sidebarCollapsed ? "lg:w-[82px]" : ""} ${themed(theme, "border-white/10 bg-slate-950/45", "border-slate-200 bg-slate-50/70")}`}>
              {sidebarCollapsed ? (
                <div className="flex h-full flex-col items-center gap-3 px-3 py-4">
                  <button
                    type="button"
                    onClick={toggleSidebarCollapsed}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e,#22c55e)] text-white shadow-[0_18px_34px_rgba(34,197,94,0.28)]`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={createConversation}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${themed(theme, "border border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/[0.1]", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={openMobileSidebar}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${themed(theme, "border border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/[0.1]", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              ) : sidebarContent}
            </aside>

            <div className="min-w-0 space-y-4">
              <div className={`rounded-[28px] border px-4 py-4 ${themed(theme, "border-white/10 bg-white/[0.04]", "border-slate-200 bg-white/75")}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <VoiceStateIndicator theme={theme} mode={voiceStateMode} />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${themed(theme, "text-white", "text-slate-900")}`}>{voiceStateLabel}</p>
                      <p className={`mt-1 truncate text-sm ${themed(theme, "text-slate-300", "text-slate-600")}`}>{statusText}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-2 text-xs font-semibold ${themed(theme, "bg-cyan-400/12 text-cyan-100", "bg-cyan-50 text-cyan-700")}`}>
                      {providerLabel || "OpenAI text + voice routing ready"}
                    </span>
                    <span className={`rounded-full px-3 py-2 text-xs font-semibold ${hasLectureContext
                      ? themed(theme, "bg-emerald-300/12 text-emerald-50", "bg-emerald-50 text-emerald-700")
                      : themed(theme, "bg-amber-400/12 text-amber-100", "bg-amber-50 text-amber-700")}`}
                    >
                      {hasLectureContext ? "Lecture context loaded" : "General mode until a lecture is loaded"}
                    </span>
                    {isSyncingConversation ? (
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${themed(theme, "bg-white/[0.08] text-slate-100", "bg-slate-100 text-slate-700")}`}>
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        Saving...
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className={`overflow-hidden rounded-[30px] border p-4 sm:p-5 ${themed(theme, "border-white/10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.86),rgba(2,6,23,0.94))]", "border-slate-200 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.97))]")}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${themed(theme, "bg-cyan-400/12 text-cyan-100", "bg-cyan-50 text-cyan-700")}`}>
                        <AudioLines className="h-5 w-5" />
                      </span>
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-[0.26em] ${themed(theme, "text-cyan-100/78", "text-cyan-700")}`}>Voice Studio</p>
                        <h4 className={`mt-1 text-lg font-semibold ${themed(theme, "text-white", "text-slate-900")}`}>
                          {selectedVoiceProfile?.name || "Wave"} is ready for live conversation
                        </h4>
                      </div>
                    </div>
                    <p className={`mt-4 max-w-3xl text-sm leading-7 ${themed(theme, "text-slate-300", "text-slate-600")}`}>
                      Pick a voice, hear it instantly, and keep that personality for streaming replies. The assistant listens in English only, uses browser live captions for speed, and corrects the final turn with Groq Whisper.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-2 text-xs font-semibold ${themed(theme, "bg-cyan-400/12 text-cyan-100", "bg-cyan-50 text-cyan-700")}`}>
                      {voiceListeningEngine}
                    </span>
                    <span className={`rounded-full px-3 py-2 text-xs font-semibold ${themed(theme, "bg-white/[0.08] text-slate-100", "bg-slate-100 text-slate-700")}`}>
                      {transcriptSourceLabel}
                    </span>
                    <span className={`rounded-full px-3 py-2 text-xs font-semibold ${themed(theme, "bg-white/[0.08] text-slate-100", "bg-slate-100 text-slate-700")}`}>
                      Transcript confidence {transcriptConfidenceLabel}
                    </span>
                  </div>
                </div>

                <motion.div layout className="mt-5 grid gap-3 xl:grid-cols-4 md:grid-cols-2">
                  {voiceProfiles.map((profile) => (
                    <VoiceProfileCard
                      key={profile.id}
                      theme={theme}
                      profile={profile}
                      selected={profile.id === selectedVoiceProfileId}
                      previewing={previewingVoiceId === profile.id}
                      preparing={isPreparingVoicePreview && previewingVoiceId === profile.id}
                      onSelect={() => selectVoiceProfile(profile.id)}
                    />
                  ))}
                </motion.div>

                <div className={`mt-5 rounded-[28px] border p-4 ${themed(theme, "border-white/10 bg-white/[0.04]", "border-slate-200 bg-white/88")}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${themed(theme, "text-white", "text-slate-900")}`}>Try this voice</p>
                      <p className={`mt-1 text-sm ${themed(theme, "text-slate-300", "text-slate-600")}`}>
                        Type any sentence and the selected voice will read it back with the same pacing used in live responses.
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-2 text-xs font-semibold ${themed(theme, "bg-emerald-300/12 text-emerald-50", "bg-emerald-50 text-emerald-700")}`}>
                      Saved on this device
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div className={`rounded-[24px] border px-4 py-3 ${themed(theme, "border-white/10 bg-slate-950/45", "border-slate-200 bg-slate-50")}`}>
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className={`h-4 w-4 ${themed(theme, "text-cyan-100", "text-cyan-700")}`} />
                        <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${themed(theme, "text-cyan-100/75", "text-cyan-700")}`}>
                          Custom Preview
                        </p>
                      </div>
                      <textarea
                        value={voicePreviewDraft}
                        onChange={(event) => setVoicePreviewDraft(event.target.value)}
                        rows={2}
                        placeholder="Explain black holes simply."
                        className={`mt-3 min-h-[88px] w-full resize-none bg-transparent text-sm leading-7 outline-none ${themed(theme, "placeholder:text-slate-500 text-slate-100", "placeholder:text-slate-400 text-slate-900")}`}
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={previewSelectedVoiceWithDraft}
                        className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0891b2,#22c55e)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(8,145,178,0.24)] transition hover:translate-y-[-1px]"
                      >
                        {isPreparingVoicePreview ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Preview Voice
                      </button>
                      <div className={`rounded-2xl border px-4 py-3 text-sm ${themed(theme, "border-white/10 bg-black/20 text-slate-200", "border-slate-200 bg-slate-50 text-slate-600")}`}>
                        <p className="font-semibold">{selectedVoiceProfile?.name || "Wave"}</p>
                        <p className="mt-1 text-xs leading-6">
                          {selectedVoiceProfile?.style || "Polished"}
                          {" | "}
                          {selectedVoiceProfile?.energy || "Focused"} energy
                          {" | "}
                          {selectedVoiceProfile?.accent || "English"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${selectedVoiceProfileId}-${previewingVoiceId || "idle"}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                      className={`mt-4 rounded-[22px] px-4 py-3 text-sm ${themed(theme, "bg-white/[0.05] text-slate-200", "bg-slate-50 text-slate-600")}`}
                    >
                      {previewingVoiceId
                        ? `${selectedVoiceProfile?.name || "That voice"} is playing now.`
                        : `${selectedVoiceProfile?.name || "This voice"} will be used for streaming voice replies and restored the next time you come back.`}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className={`rounded-[28px] border px-4 py-4 sm:px-5 ${themed(theme, "border-white/10 bg-slate-950/60", "border-slate-200 bg-slate-50/75")}`}>
                {activeConversation?.hasMoreMessages ? (
                  <div className="mb-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => loadOlderMessages(activeConversation.id)}
                      disabled={isLoadingMoreMessages}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${themed(theme, "border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.08]", "border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
                    >
                      {isLoadingMoreMessages ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                      Load older messages
                    </button>
                  </div>
                ) : null}

                {isLoadingConversationMessages && !messages.length ? <MessageSkeleton theme={theme} /> : null}

                {!isLoadingConversationMessages && messages.length ? (
                  <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      {message.role === "assistant" ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f766e,#22c55e)] text-sm font-semibold text-white">AI</div>
                      ) : null}

                      <div className={`max-w-[90%] rounded-[26px] border px-4 py-3 ${message.role === "assistant"
                        ? themed(theme, "border-emerald-300/18 bg-emerald-300/10 text-slate-100", "border-emerald-100 bg-white text-slate-800")
                        : themed(theme, "border-white/10 bg-white/[0.08] text-white", "border-slate-200 bg-slate-900 text-white")}`}
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
                          {message.interactionMode === "voice" ? (
                            <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${message.role === "assistant"
                              ? themed(theme, "bg-fuchsia-400/12 text-fuchsia-100", "bg-fuchsia-50 text-fuchsia-700")
                              : "bg-white/10 text-white/80"}`}
                            >
                              Voice
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
                ) : null}

                {!isLoadingConversationMessages && !messages.length ? (
                  <div className={`rounded-[24px] border border-dashed px-5 py-6 ${themed(theme, "border-white/10 bg-white/[0.03] text-slate-300", "border-slate-200 bg-white text-slate-600")}`}>
                    <p className={`text-sm font-semibold ${themed(theme, "text-white", "text-slate-900")}`}>Ask naturally, like you would in ChatGPT or Copilot.</p>
                    <p className="mt-3 text-sm leading-7">
                      This chat now keeps persistent history, restores older conversations, saves voice transcripts, and continues threads without needing a page refresh.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className={`rounded-[28px] border px-4 py-4 ${themed(theme, "border-white/10 bg-white/[0.04]", "border-slate-200 bg-white/75")}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${themed(theme, "text-white", "text-slate-900")}`}>
                  {activeConversation?.messageCount || messages.length
                    ? `${Math.max(activeConversation?.messageCount || 0, messages.length)} saved messages in this chat`
                    : "Open a fresh chat or pick one from history"}
                </p>
                <p className={`mt-1 text-sm ${themed(theme, "text-slate-300", "text-slate-600")}`}>
                  {statusText}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectConversation(activeConversation?.id || createConversation(), { focusComposer: true })}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${themed(theme, "border border-white/10 bg-white/5 text-white hover:bg-white/10", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
                >
                  Resume chat
                </button>
                <button
                  type="button"
                  onClick={openMobileSidebar}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${themed(theme, "border border-white/10 bg-white/5 text-white hover:bg-white/10", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
                >
                  History
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`mt-4 rounded-[28px] border p-3 ${themed(theme, "border-white/10 bg-slate-950/82", "border-slate-200 bg-white/92")}`}>
          <div className="flex items-end gap-3">
            <textarea
              ref={composerRef}
              value={draft}
              onFocus={handleComposerFocus}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={isExpanded ? 2 : 1}
              placeholder={hasLectureContext ? "Ask anything from this lecture..." : "Ask a question, or load a lecture for grounded answers..."}
              className={`min-h-[56px] flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-7 outline-none ${themed(theme, "placeholder:text-slate-500 text-slate-100", "placeholder:text-slate-400 text-slate-900")}`}
            />
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleComposerFocus();
                  if (isSpeaking || isGenerating) {
                    interruptAssistantAndListen();
                    return;
                  }
                  toggleVoiceChat();
                }}
                className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${(isListening || isSpeaking || isVoiceReconnecting || voiceModeEnabled)
                  ? themed(theme, "border-fuchsia-300/35 bg-fuchsia-400/15 text-fuchsia-100", "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700")
                  : themed(theme, "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10", "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100")}`}
                aria-label={isSpeaking || isGenerating ? "Interrupt assistant and listen" : isListening ? "Stop voice chat" : voiceModeEnabled ? "Resume voice listening" : "Start voice chat"}
              >
                <Mic className="h-5 w-5" />
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
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f766e,#22c55e)] text-white shadow-[0_16px_34px_rgba(34,197,94,0.28)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
          <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 px-2 text-xs ${themed(theme, "text-slate-400", "text-slate-500")}`}>
            <span>Enter sends. Shift+Enter adds a new line.</span>
            <span>{voiceModeEnabled ? "Voice mode stays active across turns and can be interrupted with the mic." : "Tap the mic for fast voice conversation with saved transcript history."}</span>
          </div>
        </div>
      </div>

      <div className={`fixed inset-0 z-30 transition lg:hidden ${mobileSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
        <div
          className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
        <div className={`absolute inset-y-0 left-0 w-[88vw] max-w-[360px] overflow-hidden border-r shadow-[0_24px_70px_rgba(2,8,23,0.35)] transition ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"} ${themed(theme, "border-white/10 bg-slate-950/96", "border-slate-200 bg-slate-50/98")}`}>
          <div className={`flex items-center justify-between border-b px-4 py-4 ${themed(theme, "border-white/8", "border-slate-200")}`}>
            <div>
              <p className={`text-xs uppercase tracking-[0.24em] ${themed(theme, "text-emerald-200/70", "text-emerald-700")}`}>Chat history</p>
              <p className={`mt-1 text-sm ${themed(theme, "text-slate-300", "text-slate-600")}`}>Persistent conversations</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${themed(theme, "border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.1]", "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          {sidebarContent}
        </div>
      </div>

      <button
        type="button"
        onClick={createConversation}
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f766e,#22c55e)] text-white shadow-[0_18px_34px_rgba(34,197,94,0.32)] transition hover:scale-[1.02] lg:hidden"
        aria-label="New chat"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>
    </section>
  );
}
