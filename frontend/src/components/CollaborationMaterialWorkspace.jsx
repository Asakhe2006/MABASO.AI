import { LoaderCircle, Maximize2, Pause, Play, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function titleForType(type = "material") {
  return String(type).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PresentationViewer({ presentation, renderVisual }) {
  const slides = presentation?.slides || [];
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  if (!slide) return <p className="collab-material-empty">No presentation slides are stored with this material.</p>;
  return <div className="collab-presentation-viewer"><div className="collab-slide-stage"><div className="collab-slide-copy"><small>Slide {index + 1} of {slides.length}</small><h2>{slide.title || `Slide ${index + 1}`}</h2>{slide.subtitle ? <p>{slide.subtitle}</p> : null}<ul>{(slide.bullets || slide.points || []).map((bullet, bulletIndex) => <li key={bulletIndex}>{typeof bullet === "string" ? bullet : bullet.text || bullet.title}</li>)}</ul>{slide.speakerNotes ? <details><summary>Speaker notes</summary><p>{slide.speakerNotes}</p></details> : null}</div>{renderVisual ? <div className="collab-slide-visual">{renderVisual(slide)}</div> : null}</div><div className="collab-slide-controls"><button type="button" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0}>Previous</button><span>{index + 1} / {slides.length}</span><button type="button" onClick={() => setIndex((current) => Math.min(slides.length - 1, current + 1))} disabled={index >= slides.length - 1}>Next</button></div></div>;
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

export default function CollaborationMaterialWorkspace({ item, mediaUrl, renderMarkdown, renderPresentationVisual, renderMindMap, noteQualityPanel }) {
  const snapshot = item?.source?.snapshot || {};
  const type = item?.material_type || "study_guide";
  const body = useMemo(() => snapshot.summary || snapshot.transcript || "", [snapshot]);
  useEffect(() => { window.requestAnimationFrame(() => document.querySelector(".collab-material-document")?.scrollTo?.({ top: 0 })); }, [item?.id]);
  if (!item) return null;
  return <section className="collab-material-workspace" aria-label={`${item.title} workspace`}><header><div><small>{titleForType(type)}</small><h2>{item.title}</h2><p>Shared by {item.owner_email || "a room member"}</p></div></header><div className="collab-material-document">
    {type === "video" || type === "image" ? <MediaViewer item={item} url={mediaUrl} /> : null}
    {type === "presentation" ? <PresentationViewer presentation={snapshot.presentation} renderVisual={renderPresentationVisual} /> : null}
    {type === "note" ? noteQualityPanel : null}
    {type === "podcast" ? <><PodcastViewer podcast={snapshot.podcast} />{snapshot.podcast?.script ? <article>{renderMarkdown(snapshot.podcast.script)}</article> : null}</> : null}
    {type === "mind_map" ? <article className="collab-mind-map"><h3>{snapshot.mind_map?.title || snapshot.mind_map?.root?.title || "Shared mind map"}</h3>{snapshot.mind_map?.root && renderMindMap ? renderMindMap(snapshot.mind_map.root) : <p className="collab-material-empty">This shared mind map has no visual data.</p>}</article> : null}
    {type === "flashcards" ? <div className="collab-flashcard-grid">{(snapshot.flashcards || []).map((card, index) => <article key={index}><small>Card {index + 1}</small><h3>{card.front || card.question || card.term}</h3><p>{card.back || card.answer || card.definition}</p></article>)}</div> : null}
    {type === "quiz" ? <div className="collab-quiz-list">{(snapshot.quiz_questions || []).map((question, index) => <article key={index}><small>Question {index + 1}</small><h3>{question.question || question.prompt || question}</h3>{question.answer ? <details><summary>Show answer</summary><p>{question.answer}</p></details> : null}</article>)}</div> : null}
    {["study_guide", "material"].includes(type) && body ? <article className="collab-study-guide-document">{renderMarkdown(body)}{snapshot.formula ? <section><h2>Formulas</h2>{renderMarkdown(snapshot.formula)}</section> : null}{snapshot.example ? <section><h2>Worked examples</h2>{renderMarkdown(snapshot.example)}</section> : null}{(snapshot.study_images || []).length ? <section className="collab-study-images"><h2>Study images</h2>{snapshot.study_images.map((image, index) => <figure key={image.id || image.image_url || index}><img src={image.image_url || image.url} alt={image.title || image.caption || `Study figure ${index + 1}`} loading="lazy" /><figcaption><strong>{image.title || `Figure ${index + 1}`}</strong>{image.caption ? <span>{image.caption}</span> : null}</figcaption></figure>)}</section> : null}</article> : null}
    {!["video", "image", "presentation", "note", "podcast", "mind_map", "flashcards", "quiz", "study_guide", "material"].includes(type) && body ? <article>{renderMarkdown(body)}</article> : null}
    {!body && !snapshot.presentation?.slides?.length && !snapshot.podcast && !snapshot.mind_map && !(snapshot.flashcards || []).length && !(snapshot.quiz_questions || []).length && !["video", "image", "note"].includes(type) ? <p className="collab-material-empty">This shared item has no preview data. Its owner may need to share it again.</p> : null}
  </div></section>;
}
