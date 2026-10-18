import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, CheckSquare, FileText, FlaskConical, Grid2X2, List, MoreVertical, Search, Star, StickyNote, UsersRound, X } from "lucide-react";
import "./SavedMaterialsHub.css";

const titleOf = (item) => String(item?.title || item?.fileName || "Saved study material").trim();
const summaryOf = (item) => String(item?.summary || item?.lectureNotes || "Open this saved workspace to continue learning.").replace(/\*\*/g, " ").replace(/\s+/g, " ").trim();
const dateValue = (item) => new Date(item?.updatedAt || item?.createdAt || 0).getTime() || 0;

function StudyGuideIntro({ ready, onDone, onSkip }) {
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  useEffect(() => { const id = window.setTimeout(() => onDoneRef.current?.(), 3000); return () => window.clearTimeout(id); }, []);
  return <div className="mabaso-book-intro" role="status" aria-live="polite">
    <button type="button" onClick={onSkip}>Skip</button>
    <div className="mabaso-book" aria-hidden="true"><i className="book-cover left" /><i className="book-spine" /><i className="book-cover right" /><span>M</span></div>
    <div className="book-particles" aria-hidden="true"><i>+</i><i>π</i><i>✦</i><i>∑</i><i>✓</i></div>
    <h2>Let&apos;s learn something new!</h2>
    <p>{ready ? "Your study guide is ready!" : "Opening your study guide..."}</p>
  </div>;
}

export default function SavedMaterialsHub({ items = [], loading, rooms = [], activeId, openingId, onBack, onOpen, onOpenTool, onDownload, onShare, onDelete, onToggleFlag, onOpenRoom, onCreateRoom }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState(() => window.localStorage.getItem("mabaso.saved-materials.view") || "list");
  const [selectedId, setSelectedId] = useState("");
  const [menuId, setMenuId] = useState("");
  const [introItem, setIntroItem] = useState(null);
  const selected = items.find((item) => item.id === selectedId) || null;
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matchesCategory = (item) => category === "all"
      || (category === "slides" && (item.lectureSlideFileNames?.length || item.presentationData?.slides?.length))
      || (category === "pdfs" && /\.pdf$/i.test(item.fileName || ""))
      || (category === "tests" && item.quizQuestions?.length)
      || (category === "papers" && item.pastQuestionPaperFileNames?.length)
      || (category === "favorites" && item.isFavorite);
    const next = items.filter((item) => matchesCategory(item) && (!term || `${titleOf(item)} ${item.fileName || ""} ${summaryOf(item)} ${(item.tags || []).join(" ")}`.toLowerCase().includes(term)));
    return [...next].sort((a, b) => sort === "oldest" ? dateValue(a) - dateValue(b) : sort === "az" ? titleOf(a).localeCompare(titleOf(b)) : sort === "za" ? titleOf(b).localeCompare(titleOf(a)) : dateValue(b) - dateValue(a));
  }, [category, items, query, sort]);
  const counts = useMemo(() => ({ all: items.length, slides: items.filter((x) => x.lectureSlideFileNames?.length || x.presentationData?.slides?.length).length, pdfs: items.filter((x) => /\.pdf$/i.test(x.fileName || "")).length, tests: items.filter((x) => x.quizQuestions?.length).length, papers: items.filter((x) => x.pastQuestionPaperFileNames?.length).length, favorites: items.filter((x) => x.isFavorite).length }), [items]);
  const setViewPersisted = (next) => { setView(next); window.localStorage.setItem("mabaso.saved-materials.view", next); };
  const openGuide = (item) => setIntroItem(item);
  const finishIntro = () => { const item = introItem; setIntroItem(null); if (item) onOpenTool(item, "guide"); };
  useEffect(() => {
    const closeTransientUi = (event) => {
      if (event.key !== "Escape") return;
      if (introItem) setIntroItem(null);
      else if (menuId) setMenuId("");
      else if (selectedId) setSelectedId("");
    };
    window.addEventListener("keydown", closeTransientUi);
    return () => window.removeEventListener("keydown", closeTransientUi);
  }, [introItem, menuId, selectedId]);

  return <section className="saved-materials-hub">
    {introItem ? <StudyGuideIntro ready={Boolean(introItem.summary)} onDone={finishIntro} onSkip={finishIntro} /> : null}
    <header className="saved-materials-heading"><button type="button" onClick={onBack} aria-label="Back"><ArrowLeft /></button><div><small>Personal study resources</small><h1>Saved materials</h1><p>All your study materials, organised and ready to learn.</p></div><strong>{items.length} saved</strong></header>
    <div className="saved-materials-toolbar"><label><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search materials..." /></label><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort materials"><option value="recent">Recently saved</option><option value="oldest">Oldest saved</option><option value="az">Name A–Z</option><option value="za">Name Z–A</option></select><div><button type="button" className={view === "grid" ? "active" : ""} onClick={() => setViewPersisted("grid")} aria-label="Grid view"><Grid2X2 /></button><button type="button" className={view === "list" ? "active" : ""} onClick={() => setViewPersisted("list")} aria-label="List view"><List /></button></div></div>
    <nav className="saved-material-tabs" aria-label="Material categories">{[["all","All"],["slides","Slides"],["pdfs","PDFs"],["tests","Tests"],["papers","Past Papers"],["favorites","Favourites"]].map(([id,label]) => <button type="button" key={id} className={category === id ? "active" : ""} onClick={() => setCategory(id)}>{label} ({counts[id]})</button>)}</nav>
    {menuId ? <button type="button" className="saved-material-menu-scrim" aria-label="Close material menu" onClick={() => setMenuId("")} /> : null}
    <div className={`saved-materials-body ${selected ? "has-details" : ""}`}><div className={`saved-materials-list is-${view}`}>
      {loading ? [1,2,3].map((n) => <div key={n} className="saved-material-skeleton" />) : filtered.length ? filtered.map((item) => <article key={item.id} className={activeId === item.id ? "active" : ""} onClick={() => setSelectedId(item.id)}>
        <button type="button" className="material-select" aria-label={`Select ${titleOf(item)}`}><CheckSquare /></button><div className="material-thumb"><FileText /><span>{/\.pdf$/i.test(item.fileName || "") ? "PDF" : "FILE"}</span></div><div className="material-copy"><time>{new Date(item.updatedAt || item.createdAt).toLocaleString()}</time><h2>{titleOf(item)}</h2><small>{item.fileName || "Mabaso AI workspace"}</small><p>{summaryOf(item).slice(0, 220)}</p><div className="material-counts"><span>{item.quizQuestions?.length || 0} test questions</span><span>{item.lectureNotes?.trim() ? "Notes saved" : "No notes"}</span><span>{item.lectureSlideFileNames?.length || 0} slide sources</span><span>{item.pastQuestionPaperFileNames?.length || 0} past papers</span></div></div>
        <button type="button" className={`material-star ${item.isFavorite ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); onToggleFlag(item, "isFavorite"); }} aria-label="Toggle favourite"><Star /></button>
        <div className="material-actions" onClick={(e) => e.stopPropagation()}><button type="button" className="primary" onClick={() => onOpen(item)}>{openingId === item.id ? "Opening..." : "Open"}</button><button type="button" onClick={() => openGuide(item)}><BookOpen />Study Guide</button><button type="button" onClick={() => onOpenTool(item, "quiz")}><FlaskConical />Test Me</button><button type="button" onClick={() => onOpenTool(item, "quality")}><StickyNote />Notes</button><div className="material-menu-anchor"><button type="button" onClick={() => setMenuId(menuId === item.id ? "" : item.id)} aria-label="More actions"><MoreVertical /></button>{menuId === item.id ? <div className="saved-material-menu"><button onClick={() => onOpenTool(item, "flashcards")}>Open Flashcards</button><button onClick={() => onShare(item)}>Share</button><button onClick={() => onDownload(item)}>Download Study Pack</button><button onClick={() => onToggleFlag(item, "isPinned")}>{item.isPinned ? "Unpin" : "Pin"}</button><button className="danger" onClick={() => onDelete(item)}>Delete</button></div> : null}</div></div>
      </article>) : <div className="saved-materials-empty"><BookOpen /><h2>{query ? "No materials match your search." : "Your learning collection starts here."}</h2><p>{query ? "Clear the search or choose another category." : "Generate a Study Guide to save your first learning workspace."}</p></div>}
    </div>{selected ? <aside className="saved-material-details"><button type="button" onClick={() => setSelectedId("")} aria-label="Close details"><X /></button><div className="material-thumb large"><FileText /></div><h2>{titleOf(selected)}</h2><p>{selected.fileName || "Mabaso AI workspace"}</p><nav><button className="active">Overview</button><button>Resources</button><button>Notes ({selected.lectureNotes?.trim() ? 1 : 0})</button></nav><dl><div><dt>Date saved</dt><dd>{new Date(selected.createdAt || selected.updatedAt).toLocaleString()}</dd></div><div><dt>Last updated</dt><dd>{new Date(selected.updatedAt || selected.createdAt).toLocaleString()}</dd></div><div><dt>Quick summary</dt><dd>{summaryOf(selected).slice(0, 500)}</dd></div></dl><button type="button" className="details-open" onClick={() => onOpen(selected)}>Open now</button><div className="details-tools"><button onClick={() => onOpenTool(selected,"quiz")}>Open Exam</button><button onClick={() => onOpenTool(selected,"flashcards")}>Flashcards</button><button onClick={() => onOpenTool(selected,"quality")}>Open Notes</button><button onClick={() => onCreateRoom?.(selected)}><UsersRound />Study room</button></div></aside> : null}</div>
    <footer className="recent-material-rooms"><div><UsersRound /><span><h2>Recent study rooms</h2><p>Continue group revision from your saved materials.</p></span></div><button type="button" onClick={() => onCreateRoom?.(selected)}>Create a study room</button>{rooms.slice(0,2).map((room) => <article key={room.id}><span><strong>{room.title}</strong><small>{room.member_count} members · {room.is_private ? "Private" : "Shared"}</small></span><button type="button" onClick={() => onOpenRoom(room.id)}>Open room</button></article>)}</footer>
  </section>;
}
