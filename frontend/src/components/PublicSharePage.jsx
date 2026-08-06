import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Check, Copy, ExternalLink, LoaderCircle } from "lucide-react";
import AssistantMarkdown from "./AssistantMarkdown";
import { renderMathInHtmlElement } from "./MathMarkdown";
import { getAcademicReadingCssVariables } from "../academicReadingTheme";

function resolveApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  return import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
}

function parseSharePath(pathname) {
  const match = String(pathname || "").match(/^\/share\/(material|chat)\/([^/?#]+)/i);
  return match ? { type: match[1].toLowerCase(), token: match[2] } : null;
}

function SharedAcademicHtml({ content = "" }) {
  const contentRef = useRef(null);

  useEffect(() => {
    renderMathInHtmlElement(contentRef.current);
  }, [content]);

  return (
    <div
      ref={contentRef}
      className="public-share-rich-html academic-reading-theme"
      style={getAcademicReadingCssVariables()}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

function MaterialSnapshot({ snapshot }) {
  const editedSections = Object.entries(snapshot.studyGuideDocumentHtml || {});
  return (
    <article className="public-share-document">
      <h1>{snapshot.title || "Shared study material"}</h1>
      {editedSections.length ? editedSections.map(([section, content]) => (
        <section key={section} className="public-share-section">
          <h2>{section.replace(/[-_]+/g, " ")}</h2>
          <SharedAcademicHtml content={content} />
        </section>
      )) : <AssistantMarkdown content={snapshot.summary || "This shared material has no readable study guide content."} theme="dark" />}
      {(snapshot.studyImages || []).map((image, index) => (
        <figure key={`${image.url}-${index}`} className="public-share-figure">
          <img src={image.url} alt={image.title || image.caption || `Figure ${index + 1}`} loading="lazy" />
          <figcaption><strong>{image.figureNumber || `Figure ${index + 1}`}{image.title ? `: ${image.title}` : ""}</strong>{image.caption ? <span>{image.caption}</span> : null}{image.explanation ? <span>{image.explanation}</span> : null}</figcaption>
        </figure>
      ))}
    </article>
  );
}

function ChatSnapshot({ snapshot }) {
  return (
    <article className="public-share-document public-share-chat">
      <h1>{snapshot.title || "Shared Mabaso AI conversation"}</h1>
      {(snapshot.messages || []).map((message, index) => (
        <section key={message.id || index} className={`public-share-message is-${message.role}`}>
          <AssistantMarkdown content={message.content} theme="dark" />
        </section>
      ))}
    </article>
  );
}

export default function PublicSharePage() {
  const route = useMemo(() => parseSharePath(window.location.pathname), []);
  const [state, setState] = useState(() => route
    ? { loading: true, share: null, error: "" }
    : { loading: false, share: null, error: "This shared link is unavailable." });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const robots = document.querySelector('meta[name="robots"]') || document.head.appendChild(document.createElement("meta"));
    robots.setAttribute("name", "robots");
    robots.setAttribute("content", "noindex, nofollow");
    if (!route) {
      return () => { active = false; };
    }
    fetch(`${resolveApiBaseUrl()}/api/public/share/${route.type}/${encodeURIComponent(route.token)}`, {
      method: "GET",
      credentials: "omit",
      headers: { Accept: "application/json" },
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "This shared link is unavailable.");
      if (active) setState({ loading: false, share: data.share, error: "" });
    }).catch((error) => {
      if (active) setState({ loading: false, share: null, error: error.message || "This shared link is unavailable." });
    });
    return () => { active = false; };
  }, [route]);

  const continuePrivately = () => window.location.assign(`/?continue=${route?.type || "share"}`);
  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="public-share-page">
      <header className="public-share-header">
        <button type="button" onClick={continuePrivately} aria-label="Return to Mabaso AI"><ArrowLeft aria-hidden="true" /></button>
        <span>MABASO AI</span>
        <div className="public-share-header-actions">
          <button type="button" className={copied ? "is-copied" : ""} onClick={copyShareLink} aria-label={copied ? "Share link copied" : "Copy share link"}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            <span>{copied ? "Copied" : "Copy link"}</span>
          </button>
          <button type="button" className="public-share-continue" onClick={continuePrivately}>Continue in Mabaso AI <ExternalLink aria-hidden="true" /></button>
        </div>
      </header>
      {state.loading ? <div className="public-share-state"><LoaderCircle className="animate-spin" aria-hidden="true" /><span>Opening shared content...</span></div> : null}
      {state.error ? <div className="public-share-state"><AlertCircle aria-hidden="true" /><h1>This shared link is unavailable</h1><p>{state.error}</p></div> : null}
      {state.share?.resource_type === "material" ? <MaterialSnapshot snapshot={state.share.snapshot || {}} /> : null}
      {state.share?.resource_type === "chat" ? <ChatSnapshot snapshot={state.share.snapshot || {}} /> : null}
      {state.share ? <footer className="public-share-footer"><button type="button" onClick={continuePrivately}>Continue privately in Mabaso AI</button><a href="/?support=share" rel="noopener noreferrer">Report this shared content</a></footer> : null}
    </main>
  );
}
