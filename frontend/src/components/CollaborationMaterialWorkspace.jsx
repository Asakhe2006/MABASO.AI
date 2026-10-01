import { LoaderCircle, Maximize2, Pause, Play, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function titleForType(type = "material") {
  return String(type).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PresentationViewer({ presentation, renderVisual, page, onPageChange }) {
  const slides = presentation?.slides || [];
  const [index, setIndex] = useState(0);
  const activeIndex = Number.isFinite(Number(page)) ? Math.min(slides.length - 1, Math.max(0, Number(page) - 1)) : index;
  const setPageIndex = (next) => { setIndex(next); onPageChange?.(next + 1); };
  const slide = slides[activeIndex];
  if (!slide) return <p className="collab-material-empty">No presentation slides are stored with this material.</p>;
  return <div className="collab-presentation-viewer"><div className="collab-slide-stage"><div className="collab-slide-copy"><small>Slide {activeIndex + 1} of {slides.length}</small><h2>{slide.title || `Slide ${activeIndex + 1}`}</h2>{slide.subtitle ? <p>{slide.subtitle}</p> : null}<ul>{(slide.bullets || slide.points || []).map((bullet, bulletIndex) => <li key={bulletIndex}>{typeof bullet === "string" ? bullet : bullet.text || bullet.title}</li>)}</ul>{slide.speakerNotes ? <details><summary>Speaker notes</summary><p>{slide.speakerNotes}</p></details> : null}</div>{renderVisual ? <div className="collab-slide-visual">{renderVisual(slide)}</div> : null}</div><div className="collab-slide-controls"><button type="button" onClick={() => setPageIndex(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0}>Previous</button><span>{activeIndex + 1} / {slides.length}</span><button type="button" onClick={() => setPageIndex(Math.min(slides.length - 1, activeIndex + 1))} disabled={activeIndex >= slides.length - 1}>Next</button></div></div>;
}

function buildStudyGuideSlides(snapshot = {}, fallbackTitle = "Study Guide") {
  const source = String(snapshot.summary || snapshot.transcript || "").trim();
  const slides = [];
  const headingPattern = /^#{1,4}\s+(.+)$/gm;
  const matches = [...source.matchAll(headingPattern)];
  if (!matches.length && source) {
    slides.push({ id: "overview", title: fallbackTitle, content: source });
  } else if (source) {
    const introduction = source.slice(0, matches[0]?.index || 0).trim();
    if (introduction) slides.push({ id: "overview", title: fallbackTitle, content: introduction });
    matches.forEach((match, index) => {
      const start = Number(match.index || 0) + match[0].length;
      const end = index + 1 < matches.length ? Number(matches[index + 1].index || source.length) : source.length;
      slides.push({ id: `section-${index}`, title: match[1].trim(), content: source.slice(start, end).trim() });
    });
  }
  if (snapshot.formula) slides.push({ id: "formulas", title: "Formula Sheet", content: snapshot.formula });
  if (snapshot.example) slides.push({ id: "examples", title: "Worked Examples", content: snapshot.example });
  return slides.filter((slide) => slide.title || slide.content);
}

function StudyGuideViewer({ snapshot, title, renderMarkdown, page, onPageChange }) {
  const slides = useMemo(() => buildStudyGuideSlides(snapshot, title), [snapshot, title]);
  const [index, setIndex] = useState(0);
  const [fullView, setFullView] = useState(false);
  const activeIndex = Number.isFinite(Number(page)) ? Math.min(Math.max(0, slides.length - 1), Math.max(0, Number(page) - 1)) : Math.min(index, Math.max(0, slides.length - 1));
  const setPageIndex = (next) => { setIndex(next); onPageChange?.(next + 1); };
  const slide = slides[activeIndex];

  useEffect(() => {
    if (!fullView) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setFullView(false);
      if (event.key === "ArrowLeft") setPageIndex(Math.max(0, activeIndex - 1));
      if (event.key === "ArrowRight") setPageIndex(Math.min(slides.length - 1, activeIndex + 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, fullView, slides.length]);

  if (!slide) return <p className="collab-material-empty">This shared Study Guide has no readable slide content.</p>;
  const renderSlide = (isFull = false) => (
    <article className={`collab-study-guide-slide ${isFull ? "is-full" : ""}`}>
      <small>Study Guide · Slide {activeIndex + 1}</small>
      <h2>{slide.title}</h2>
      <div>{renderMarkdown(slide.content)}</div>
      {slide.id === "overview" && (snapshot.study_images || []).length ? (
        <div className="collab-study-guide-figures">
          {snapshot.study_images.slice(0, 2).map((image, imageIndex) => (
            <figure key={image.id || image.image_url || imageIndex}>
              <img src={image.image_url || image.url} alt={image.title || image.caption || `Study figure ${imageIndex + 1}`} loading="lazy" />
              <figcaption>{image.title || image.caption || `Figure ${imageIndex + 1}`}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </article>
  );
  const controls = (className = "") => (
    <div className={`collab-slide-controls ${className}`}>
      <button type="button" onClick={() => setPageIndex(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0}>Previous</button>
      <span>{activeIndex + 1} / {slides.length}</span>
      <button type="button" onClick={() => setPageIndex(Math.min(slides.length - 1, activeIndex + 1))} disabled={activeIndex >= slides.length - 1}>Next</button>
    </div>
  );
  return <div className="collab-study-guide-viewer"><button type="button" className="collab-study-guide-expand" onClick={() => setFullView(true)}><Maximize2 aria-hidden="true" /> Full view</button>{renderSlide()}{controls()}{fullView ? <div className="collab-study-guide-fullscreen" role="dialog" aria-modal="true" aria-label={`${title} full view`}><header><div><small>Shared Study Guide</small><h2>{title}</h2></div><button type="button" onClick={() => setFullView(false)} aria-label="Close full view"><X aria-hidden="true" /></button></header><main>{renderSlide(true)}</main>{controls("is-full-view")}<nav aria-label="Study Guide slides">{slides.map((item, slideIndex) => <button key={item.id} type="button" className={slideIndex === activeIndex ? "is-active" : ""} onClick={() => setPageIndex(slideIndex)}><span>{slideIndex + 1}</span>{item.title}</button>)}</nav></div> : null}</div>;
}

function PodcastViewer({ podcast }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const source = podcast?.audio_url || podcast?.audioUrl || podcast?.url || "";
  return <div className="collab-podcast-viewer"><button type="button" disabled={!source} onClick={async () => { const audio = audioRef.current; if (!audio) return; if (audio.paused) { await audio.play(); setPlaying(true); } else { audio.pause(); setPlaying(false); } }}>{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</button><div><h3>{podcast?.title || "Study podcast"}</h3><p>{source ? "Play this shared study podcast without leaving the room." : "The podcast script is available below; no saved audio file was attached."}</p></div>{source ? <audio ref={audioRef} src={source} preload="metadata" onEnded={() => setPlaying(false)} /> : null}</div>;
}

function MediaViewer({ item, url }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (!url) return <p className="collab-material-empty">This media reference is unavailable.</p>;
  return <div className={`collab-inline-media ${expanded ? "is-expanded" : ""}`}><div className="collab-media-status">{loading ? <><LoaderCircle className="animate-spin" aria-hidden="true" /> Loading {item.material_type}…</> : failed ? `The ${item.material_type} could not be loaded.` : null}</div>{item.material_type === "video" ? <video src={url} controls playsInline preload="metadata" crossOrigin="use-credentials" onLoadedMetadata={() => setLoading(false)} onCanPlay={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} /> : <img src={url} alt={item.title || "Shared room image"} onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} />}<button type="button" className="collab-media-expand" onClick={() => setExpanded((current) => !current)} aria-label={expanded ? "Restore media" : "Enlarge media"}>{expanded ? <X aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}</button></div>;
}

export default function CollaborationMaterialWorkspace({ item, mediaUrl, renderMarkdown, renderPresentationVisual, renderMindMap, noteQualityPanel, page, onPageChange }) {
  const snapshot = useMemo(() => item?.source?.snapshot || {}, [item?.source?.snapshot]);
  const type = item?.material_type || "study_guide";
  const body = useMemo(() => snapshot.summary || snapshot.transcript || "", [snapshot]);
  useEffect(() => { window.requestAnimationFrame(() => document.querySelector(".collab-material-document")?.scrollTo?.({ top: 0 })); }, [item?.id]);
  if (!item) return null;
  return <section className="collab-material-workspace" aria-label={`${item.title} workspace`}><header><div><small>{titleForType(type)}</small><h2>{item.title}</h2><p>Shared by {item.owner_email || "a room member"}</p></div></header><div className="collab-material-document">
    {type === "video" || type === "image" ? <MediaViewer item={item} url={mediaUrl} /> : null}
    {type === "presentation" ? <PresentationViewer presentation={snapshot.presentation} renderVisual={renderPresentationVisual} page={page} onPageChange={onPageChange} /> : null}
    {type === "note" ? noteQualityPanel : null}
    {type === "podcast" ? <><PodcastViewer podcast={{ ...(snapshot.podcast || {}), audio_url: snapshot.podcast?.audio_url || mediaUrl }} />{snapshot.podcast?.script ? <article>{renderMarkdown(snapshot.podcast.script)}</article> : null}</> : null}
    {type === "mind_map" ? <article className="collab-mind-map"><h3>{snapshot.mind_map?.title || snapshot.mind_map?.root?.title || "Shared mind map"}</h3>{snapshot.mind_map?.root && renderMindMap ? renderMindMap(snapshot.mind_map.root) : <p className="collab-material-empty">This shared mind map has no visual data.</p>}</article> : null}
    {type === "flashcards" ? <div className="collab-flashcard-grid">{(snapshot.flashcards || []).map((card, index) => <article key={index}><small>Card {index + 1}</small><h3>{card.front || card.question || card.term}</h3><p>{card.back || card.answer || card.definition}</p></article>)}</div> : null}
    {type === "quiz" ? <div className="collab-quiz-list">{(snapshot.quiz_questions || []).map((question, index) => <article key={index}><small>Question {index + 1}</small><h3>{question.question || question.prompt || question}</h3>{question.answer ? <details><summary>Show answer</summary><p>{question.answer}</p></details> : null}</article>)}</div> : null}
    {["study_guide", "material"].includes(type) && body ? <StudyGuideViewer snapshot={snapshot} title={item.title || "Study Guide"} renderMarkdown={renderMarkdown} page={page} onPageChange={onPageChange} /> : null}
    {!["video", "image", "presentation", "note", "podcast", "mind_map", "flashcards", "quiz", "study_guide", "material"].includes(type) && body ? <article>{renderMarkdown(body)}</article> : null}
    {!body && !snapshot.presentation?.slides?.length && !snapshot.podcast && !snapshot.mind_map && !(snapshot.flashcards || []).length && !(snapshot.quiz_questions || []).length && !["video", "image", "note"].includes(type) ? <p className="collab-material-empty">This shared item has no preview data. Its owner may need to share it again.</p> : null}
  </div></section>;
}
