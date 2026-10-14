import { createElement, useEffect, useState } from "react";
import { ChevronDown, FileImage, Folder, FolderOpen, Link, LoaderCircle, Star } from "lucide-react";
import "./LibrarySidebarSection.css";

export default function LibrarySidebarSection({ authFetch, onOpenLibrary }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState({ recent: [], favorites: [], folders: [], images: [], links: [] });

  useEffect(() => {
    if (!expanded) return undefined;
    let cancelled = false;
    authFetch("/api/library/overview?limit=4", { timeoutMs: 12000 })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Could not load Library shortcuts.");
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview({ recent: [], favorites: [], folders: [], images: [], links: [] });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authFetch, expanded]);

  const shortcuts = [
    ["Recent files", "all", overview.recent, FolderOpen],
    ["Favourites", "favorites", overview.favorites, Star],
    ["Folders", "folders", overview.folders, Folder],
    ["Images", "images", overview.images, FileImage],
    ["Saved links", "links", overview.links, Link],
  ];

  const toggleExpanded = () => {
    if (!expanded) setLoading(true);
    setExpanded((value) => !value);
  };

  return <section className="study-chat-library-section">
    <div className="study-chat-library-row">
      <button type="button" className="study-chat-library-open" onClick={() => onOpenLibrary("all", "")}><FolderOpen aria-hidden="true" /><span>Library</span></button>
      <button type="button" className="study-chat-library-toggle" aria-label={expanded ? "Collapse Library shortcuts" : "Expand Library shortcuts"} aria-expanded={expanded} onClick={toggleExpanded}><ChevronDown className={expanded ? "is-open" : ""} aria-hidden="true" /></button>
    </div>
    {expanded ? <div className="study-chat-library-shortcuts">
      {loading ? <span className="study-chat-library-loading"><LoaderCircle className="animate-spin" />Loading Library…</span> : shortcuts.map(([label, section, items, Icon]) => <div key={section}>
        <button type="button" className="study-chat-library-category" onClick={() => onOpenLibrary(section, "")}>{createElement(Icon, { "aria-hidden": true })}<span>{label}</span><small>{items.length}</small></button>
        {items.slice(0, 2).map((item) => <button type="button" className="study-chat-library-item" key={`${section}-${item.id}`} onClick={() => onOpenLibrary(section, item.id, item.url || "")}><span>{item.name || item.title}</span></button>)}
      </div>)}
    </div> : null}
  </section>;
}
