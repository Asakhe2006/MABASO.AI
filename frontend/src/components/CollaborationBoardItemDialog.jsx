import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function CollaborationBoardItemDialog({ item, canEdit, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({
    title: item?.title || "",
    content: item?.content || "",
    checklist: (item?.checklist || []).join("\n"),
  }));
  const [saveState, setSaveState] = useState("");
  const readyRef = useRef(false);
  const saveRef = useRef(onSave);
  const itemRef = useRef(item);
  const saveInFlightRef = useRef(false);
  const queuedDraftRef = useRef(null);
  const mountedRef = useRef(true);
  saveRef.current = onSave;
  itemRef.current = item;

  useEffect(() => () => { mountedRef.current = false; }, []);

  const persistDraft = async (nextDraft) => {
    if (saveInFlightRef.current) {
      queuedDraftRef.current = nextDraft;
      return;
    }
    saveInFlightRef.current = true;
    if (mountedRef.current) setSaveState("saving");
    try {
      await saveRef.current({
        ...itemRef.current,
        title: nextDraft.title,
        content: nextDraft.content,
        checklist: nextDraft.checklist.split("\n").map((entry) => entry.trim()).filter(Boolean),
      });
      if (mountedRef.current) setSaveState("saved");
    } catch {
      if (mountedRef.current) setSaveState("error");
    } finally {
      saveInFlightRef.current = false;
      const queuedDraft = queuedDraftRef.current;
      queuedDraftRef.current = null;
      if (queuedDraft) void persistDraft(queuedDraft);
    }
  };

  useEffect(() => {
    setDraft({
      title: item?.title || "",
      content: item?.content || "",
      checklist: (item?.checklist || []).join("\n"),
    });
    setSaveState("");
    readyRef.current = false;
    const timer = window.setTimeout(() => { readyRef.current = true; }, 0);
    return () => window.clearTimeout(timer);
  }, [item?.id]);

  useEffect(() => {
    if (!canEdit || !readyRef.current) return undefined;
    const timer = window.setTimeout(() => {
      void persistDraft({ ...draft });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [canEdit, draft.checklist, draft.content, draft.title, item?.id, item?.item_type]);

  if (!item) return null;
  return (
    <div className="collaboration-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`collaboration-board-reader collaboration-board-item-${item.item_type}`} role="dialog" aria-modal="true" aria-label="Board item" onMouseDown={(event) => event.stopPropagation()}>
        <div className="collaboration-board-reader-header">
          <div><p>{String(item.item_type || "note").replaceAll("_", " ")}</p>{canEdit ? <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} aria-label="Board item title" /> : <h3>{item.title || "Room note"}</h3>}</div>
          <button type="button" onClick={onClose} aria-label="Close board item"><X aria-hidden="true" /></button>
        </div>
        {canEdit ? (
          <>
            <textarea className="collaboration-board-reader-copy" value={draft.content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} aria-label="Board item text" />
            {item.item_type === "task" ? <textarea className="collaboration-board-reader-checklist" value={draft.checklist} onChange={(event) => setDraft((current) => ({ ...current, checklist: event.target.value }))} aria-label="Checklist, one task per line" /> : null}
            <small className={saveState === "error" ? "is-error" : ""}>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved for everyone" : saveState === "error" ? "Could not save. Keep this open and try again." : "Edits save automatically"}</small>
          </>
        ) : (
          <>
            {item.content ? <p className="collaboration-board-reader-copy">{item.content}</p> : null}
            {(item.checklist || []).length ? <ul>{item.checklist.map((task, index) => <li key={`reader-${item.id}-${index}`}>☐ {task}</li>)}</ul> : null}
          </>
        )}
        {item.due_at ? <small>Due {item.due_at}</small> : null}
      </section>
    </div>
  );
}
