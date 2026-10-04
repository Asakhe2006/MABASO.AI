import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Camera, CheckCheck, Copy, Ellipsis, LoaderCircle, Mic, Paperclip, Pause, Play, Reply, Send, Smile, Trash2, X } from "lucide-react";

const EMOJIS = ["🙂", "👍", "👏", "🎓", "📚", "💡", "✅", "❤️"];

function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function displaySender(message, currentUserEmail) {
  if (message.author_email === currentUserEmail) return "You";
  return String(message.author_name || message.author_email || "Room member").split("@")[0];
}

function waveformFor(message) {
  const seed = String(message.id || message.created_at || "voice").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Array.from({ length: 34 }, (_, index) => 22 + ((seed * (index + 5) + index * 31) % 65));
}

function VoiceMessage({ message, mediaUrl, activeVoiceId, setActiveVoiceId }) {
  const audioRef = useRef(null);
  const [duration, setDuration] = useState(Number(message.duration_seconds || 0));
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [failed, setFailed] = useState(false);
  const bars = useMemo(() => waveformFor(message), [message]);
  const isPlaying = activeVoiceId === message.id;

  useEffect(() => {
    if (!isPlaying && audioRef.current && !audioRef.current.paused) audioRef.current.pause();
  }, [isPlaying]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setFailed(false);
    if (!audio.paused) {
      audio.pause();
      setActiveVoiceId("");
      return;
    }
    setActiveVoiceId(message.id);
    try {
      await audio.play();
    } catch {
      setFailed(true);
      setActiveVoiceId("");
    }
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const seek = (event) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };
  const cyclePlaybackRate = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  };
  return (
    <div className="collab-voice-player">
      <audio
        ref={audioRef}
        src={message.local_url || mediaUrl}
        crossOrigin="use-credentials"
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => { setCurrentTime(0); setActiveVoiceId(""); }}
        onError={() => setFailed(true)}
      />
      <button type="button" onClick={toggle} aria-label={isPlaying ? "Pause voice message" : "Play voice message"}>
        {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>
      <button type="button" className="collab-waveform" onClick={seek} aria-label="Seek voice message" aria-valuemin="0" aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(currentTime)} role="slider">
        {bars.map((height, index) => <i key={index} className={index / bars.length <= progress ? "is-played" : ""} style={{ height: `${height}%` }} />)}
      </button>
      <small>{failed ? "Unavailable" : `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, "0")}`}</small>
      <button type="button" className="collab-voice-speed" onClick={cyclePlaybackRate} aria-label={`Playback speed ${playbackRate} times`}>{playbackRate}×</button>
    </div>
  );
}

function ChatImageMessage({ message, mediaUrl }) {
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = message.local_url || mediaUrl(message.media_id);
  return (
    <>
      <button type="button" className="collab-chat-photo" onClick={() => setExpanded(true)} aria-label="Enlarge room chat photo">
        {failed ? <span>Photo unavailable</span> : <img src={source} alt="" loading="lazy" onError={() => setFailed(true)} />}
      </button>
      {expanded ? <div className="collab-chat-photo-viewer" role="dialog" aria-modal="true" aria-label="Room chat photo" onClick={() => setExpanded(false)}><button type="button" onClick={() => setExpanded(false)} aria-label="Close photo"><X aria-hidden="true" /></button><img src={source} alt="" onClick={(event) => event.stopPropagation()} /></div> : null}
    </>
  );
}

function MessageActions({ message, isOwn, onReply, onDelete, onClose }) {
  return (
    <div className="collab-message-actions" role="menu">
      <button type="button" onClick={() => { onReply(message); onClose(); }}><Reply aria-hidden="true" /> Reply</button>
      <button type="button" onClick={async () => { await navigator.clipboard.writeText(message.content || "Voice note"); onClose(); }}><Copy aria-hidden="true" /> Copy</button>
      {isOwn && !message.pending ? <button type="button" className="is-danger" onClick={() => { onDelete(message); onClose(); }}><Trash2 aria-hidden="true" /> Delete</button> : null}
    </div>
  );
}

function MessageBubble({ message, previous, currentUserEmail, activeVoiceId, setActiveVoiceId, mediaUrl, onReply, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef(null);
  const isOwn = message.author_email === currentUserEmail;
  const startsGroup = !previous || previous.author_email !== message.author_email || previous.message_type !== message.message_type;
  return (
    <article
      className={`mabaso-chat-message ${isOwn ? "is-own" : "is-received"} ${startsGroup ? "starts-group" : "continues-group"} ${message.pending ? "is-pending" : ""}`}
      onPointerDown={(event) => { if (event.pointerType !== "mouse") pressTimer.current = window.setTimeout(() => setMenuOpen(true), 520); }}
      onPointerUp={() => window.clearTimeout(pressTimer.current)}
      onPointerCancel={() => window.clearTimeout(pressTimer.current)}
    >
      <div className="mabaso-chat-bubble">
        {startsGroup ? <strong>{displaySender(message, currentUserEmail)}</strong> : null}
        {message.reply_preview ? <blockquote><b>{message.reply_preview.author_name || "Reply"}</b>{message.reply_preview.content}</blockquote> : null}
        {message.message_type === "audio" && (message.media_id || message.local_url) ? (
          <VoiceMessage message={message} mediaUrl={message.local_url || mediaUrl(message.media_id)} activeVoiceId={activeVoiceId} setActiveVoiceId={setActiveVoiceId} />
        ) : message.message_type === "image" && (message.media_id || message.local_url) ? (
          <ChatImageMessage message={message} mediaUrl={mediaUrl} />
        ) : <p>{message.content}</p>}
        <span className="mabaso-chat-meta">{formatMessageTime(message.created_at)} {isOwn ? <CheckCheck aria-label={message.pending ? "Sending" : "Sent"} /> : null}</span>
        <button type="button" className="mabaso-message-menu" aria-label="Message actions" onClick={() => setMenuOpen((current) => !current)}><Ellipsis aria-hidden="true" /></button>
        {menuOpen ? <MessageActions message={message} isOwn={isOwn} onReply={onReply} onDelete={onDelete} onClose={() => setMenuOpen(false)} /> : null}
      </div>
    </article>
  );
}

export default function CollaborationChat({
  room,
  rooms = [],
  currentUserEmail,
  draft,
  setDraft,
  onSend,
  onDeleteMessage,
  onOpenRoom,
  onBack,
  onAttach,
  onCamera,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onPauseRecording,
  onResumeRecording,
  voiceDraft,
  onSendVoiceDraft,
  onDeleteVoiceDraft,
  isRecording = false,
  isRecordingPaused = false,
  isUploadingVoice = false,
  isSending = false,
  isLoading = false,
  mediaUrl,
  onLoadOlder,
  isLoadingOlder = false,
  mobileActive = false,
  desktopExpanded = false,
  onToggleExpanded,
  minimized = false,
  onToggleMinimized,
}) {
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const previousCountRef = useRef(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [activeVoiceId, setActiveVoiceId] = useState("");
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [search, setSearch] = useState("");
  const [olderState, setOlderState] = useState({ roomId: "", exhausted: false });
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const messages = useMemo(() => room?.messages || [], [room?.messages]);
  const olderExhausted = olderState.roomId === room?.id && olderState.exhausted;

  useEffect(() => {
    if (!isRecording) return undefined;
    const startedAt = Date.now();
    const update = () => setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    const frame = window.requestAnimationFrame(update);
    const timer = window.setInterval(update, 250);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, [isRecording]);

  useEffect(() => {
    const list = listRef.current;
    const countChanged = messages.length > previousCountRef.current;
    previousCountRef.current = messages.length;
    if (!list || !countChanged) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 140;
    const frame = window.requestAnimationFrame(() => {
      if (nearBottom || messages[messages.length - 1]?.author_email === currentUserEmail) {
        list.scrollTop = list.scrollHeight;
        setShowNewMessage(false);
      } else setShowNewMessage(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentUserEmail, messages]);

  const send = () => {
    const value = draft.trim();
    if (!value || isSending) return;
    onSend?.({ replyTo: replyingTo });
    setReplyingTo(null);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") { setShowEmoji(false); setReplyingTo(null); return; }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const roomName = room?.title || "Mabaso AI Room";
  const filteredRooms = rooms.filter((item) => `${item.title} ${item.latest_message?.content || ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <section className={`mabaso-room-chat ${mobileActive ? "is-mobile-active" : ""} ${desktopExpanded ? "is-desktop-expanded" : ""} ${minimized ? "is-minimized" : ""}`} aria-label="Room chat">
      <aside className="mabaso-chat-room-list">
        <div className="mabaso-chat-list-brand"><span>MA</span><div><strong>Mabaso AI</strong><small>Collaboration chat</small></div></div>
        <label className="mabaso-chat-search"><span className="sr-only">Search room conversations</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" /></label>
        <div className="mabaso-chat-room-items">{filteredRooms.map((item) => <button key={item.id} type="button" className={item.id === room?.id ? "is-active" : ""} onClick={() => onOpenRoom?.(item.id)}><span>{String(item.title || "M").slice(0, 2).toUpperCase()}</span><div><strong>{item.title}</strong><small>{item.latest_message?.content || `${item.member_count || 1} members`}</small></div><time>{formatMessageTime(item.latest_message?.created_at)}</time></button>)}</div>
      </aside>
      <div className="mabaso-chat-conversation">
        <header className="mabaso-chat-header">
          <button type="button" className="mabaso-chat-back" onClick={onBack} aria-label="Back to rooms">←</button>
          <span className="mabaso-chat-avatar">MA</span>
          <div><h2>{roomName}</h2><p>{room ? `${room.member_count || room.members?.length || 1} members` : "Open a room"}</p></div>
          <button type="button" className="mabaso-chat-minimize" onClick={onToggleMinimized} aria-label={minimized ? "Restore room chat" : "Minimize room chat"}>{minimized ? "Restore chat" : "—"}</button>
          <button type="button" className="mabaso-chat-expand" onClick={onToggleExpanded} aria-label={desktopExpanded ? "Restore collaboration panels" : "Expand room chat"}>{desktopExpanded ? <X aria-hidden="true" /> : <Ellipsis aria-hidden="true" />}</button>
        </header>
        <div ref={listRef} className="mabaso-chat-message-list" onScroll={(event) => { const node = event.currentTarget; if (node.scrollHeight - node.scrollTop - node.clientHeight < 100) setShowNewMessage(false); }}>
          {messages.length >= 50 && !olderExhausted ? <button type="button" className="mabaso-load-older" disabled={isLoadingOlder} onClick={async () => { const loaded = await onLoadOlder?.(); if (!loaded) setOlderState({ roomId: room?.id || "", exhausted: true }); }}>{isLoadingOlder ? "Loading earlier messages…" : "Load earlier messages"}</button> : null}
          {messages.length ? messages.map((message, index) => <MessageBubble key={message.id} message={message} previous={messages[index - 1]} currentUserEmail={currentUserEmail} activeVoiceId={activeVoiceId} setActiveVoiceId={setActiveVoiceId} mediaUrl={mediaUrl} onReply={(item) => { setReplyingTo(item); textareaRef.current?.focus(); }} onDelete={onDeleteMessage} />) : isLoading ? <div className="mabaso-chat-empty" role="status" aria-live="polite"><span>MA</span><h3>Loading room chat…</h3><p>Your messages are being opened securely.</p></div> : <div className="mabaso-chat-empty"><span>MA</span><h3>Start the conversation.</h3><p>Share questions, lecture discussions, voice notes and study ideas with your classmates.</p></div>}
        </div>
        {showNewMessage ? <button type="button" className="mabaso-new-message" onClick={() => { const list = listRef.current; if (list) list.scrollTop = list.scrollHeight; setShowNewMessage(false); }}><ArrowDown aria-hidden="true" /> New message</button> : null}
        <footer className="mabaso-chat-composer-shell">
          {replyingTo ? <div className="mabaso-replying"><div><strong>Replying to {displaySender(replyingTo, currentUserEmail)}</strong><span>{replyingTo.content || "Voice note"}</span></div><button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply"><X aria-hidden="true" /></button></div> : null}
          {isRecording ? <div className="mabaso-recording-state"><span className={`mabaso-recording-dot ${isRecordingPaused ? "is-paused" : ""}`} /> <strong>{isRecordingPaused ? "Paused" : "Recording voice note"} {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</strong><button type="button" onClick={isRecordingPaused ? onResumeRecording : onPauseRecording}>{isRecordingPaused ? "Resume" : "Pause"}</button><button type="button" className="is-cancel" onClick={onCancelRecording}>Delete</button><button type="button" onClick={onStopRecording}>Review</button></div> : voiceDraft ? (
            <div className="mabaso-voice-draft" role="status">
              <audio src={voiceDraft.url} controls preload="metadata" />
              <button type="button" className="is-cancel" onClick={onDeleteVoiceDraft} disabled={isUploadingVoice}><Trash2 aria-hidden="true" /><span>Delete</span></button>
              <button type="button" className="is-primary" onClick={onSendVoiceDraft} disabled={isUploadingVoice}>{isUploadingVoice ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}<span>{voiceDraft.failed ? "Retry" : "Send"}</span></button>
            </div>
          ) : (
            <div className="mabaso-chat-composer">
              <button type="button" onClick={() => setShowEmoji((current) => !current)} aria-label="Open emoji picker"><Smile aria-hidden="true" /></button>
              <textarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} rows={1} placeholder="Type a message…" aria-label="Room message" />
              <button type="button" onClick={onAttach} aria-label="Attach saved material"><Paperclip aria-hidden="true" /></button>
              <button type="button" onClick={onCamera} aria-label="Attach image"><Camera aria-hidden="true" /></button>
              {draft.trim() ? <button type="button" className="is-primary" onClick={send} disabled={isSending} aria-label="Send message">{isSending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}</button> : <button type="button" className="is-primary" onClick={onStartRecording} disabled={!room || isUploadingVoice} aria-label="Record voice message">{isUploadingVoice ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Mic aria-hidden="true" />}</button>}
              {showEmoji ? <div className="mabaso-emoji-picker">{EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => { setDraft(`${draft}${emoji}`); setShowEmoji(false); textareaRef.current?.focus(); }}>{emoji}</button>)}</div> : null}
            </div>
          )}
        </footer>
      </div>
    </section>
  );
}
