import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Maximize2, X } from "lucide-react";

export default function CollaborationRoomStudyGuide({
  title,
  intro,
  sections,
  canGenerate,
  isGenerating,
  onGenerate,
  renderMarkdown,
  hasSourceMaterial = false,
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [isFullView, setIsFullView] = useState(false);
  const slides = [
    ...(String(intro || "").trim() ? [{ id: "intro", title, content: intro }] : []),
    ...(sections || [])
      .filter((section) => String(section?.content || "").trim())
      .map((section, index) => ({
        id: `${section.normalizedHeading || section.heading || "section"}-${index}`,
        title: section.displayHeading || section.heading || `Section ${index + 1}`,
        content: section.content,
      })),
  ];
  const activeIndex = Math.min(Math.max(slideIndex, 0), Math.max(slides.length - 1, 0));
  const activeSlide = slides[activeIndex];

  useEffect(() => {
    if (!isFullView) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsFullView(false);
      if (event.key === "ArrowLeft") setSlideIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setSlideIndex((current) => Math.min(slides.length - 1, current + 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullView, slides.length]);

  if (!activeSlide) {
    return (
      <section className="collaboration-embedded-tool collaboration-room-study-guide is-empty">
        <div className="collaboration-tool-prerequisite">
          <FileText aria-hidden="true" />
          <div>
            <strong>No Study Guide has been shared yet</strong>
            <p>{hasSourceMaterial
              ? "The room owner can generate a Study Guide from the material already in this Room."
              : "Share or upload lecture material first. Room tools only generate from real course content."}</p>
          </div>
          {canGenerate && hasSourceMaterial ? (
            <button type="button" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate Study Guide"}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  const renderSlide = (fullView = false) => (
    <article className={`collaboration-guide-slide ${fullView ? "is-full-view" : ""}`}>
      <p>{activeSlide.id === "intro" ? "Shared Study Guide" : `Slide ${activeIndex + 1}`}</p>
      <h3>{activeSlide.title}</h3>
      <div className="collaboration-guide-slide-content">{renderMarkdown(activeSlide.content)}</div>
    </article>
  );
  const navigation = (fullView = false) => (
    <div className={`collaboration-guide-slide-nav ${fullView ? "is-full-view" : ""}`} aria-label="Room study guide slide navigation">
      <button type="button" onClick={() => setSlideIndex((current) => Math.max(0, current - 1))} disabled={activeIndex <= 0}>
        <ArrowLeft aria-hidden="true" />Previous
      </button>
      <strong>{activeIndex + 1} / {slides.length}</strong>
      <button type="button" onClick={() => setSlideIndex((current) => Math.min(slides.length - 1, current + 1))} disabled={activeIndex >= slides.length - 1}>
        Next<ArrowLeft className="rotate-180" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <>
      <section className="collaboration-embedded-tool collaboration-room-study-guide">
        <div className="collaboration-embedded-tool-heading">
          <div><small>Study Guide</small><h3>Shared room slide reader</h3></div>
          <div className="collaboration-guide-heading-actions">
            {canGenerate ? <button type="button" onClick={onGenerate} disabled={isGenerating}>{isGenerating ? "Generating..." : "Regenerate"}</button> : null}
            <button type="button" className="is-secondary" onClick={() => setIsFullView(true)} aria-label="Open the room study guide in full view"><Maximize2 aria-hidden="true" />Full view</button>
          </div>
        </div>
        {renderSlide()}
        {navigation()}
      </section>
      {isFullView ? (
        <div className="collaboration-guide-full-view" role="dialog" aria-modal="true" aria-label="Room study guide full view">
          <header><div><small>Shared Study Guide</small><h2>{title}</h2></div><button type="button" onClick={() => setIsFullView(false)} aria-label="Close full view"><X aria-hidden="true" /></button></header>
          <div className="collaboration-guide-full-content">{renderSlide(true)}</div>
          {navigation(true)}
          <div className="collaboration-guide-slide-thumbnails" aria-label="Room study guide slide thumbnails">
            {slides.map((slide, index) => <button key={slide.id} type="button" onClick={() => setSlideIndex(index)} className={index === activeIndex ? "is-active" : ""}><span>{index + 1}</span><strong>{slide.title}</strong></button>)}
          </div>
        </div>
      ) : null}
    </>
  );
}
