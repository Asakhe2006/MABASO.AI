import { useEffect, useState } from "react";
import { Bookmark, Check, Copy, WrapText } from "lucide-react";
import MathMarkdown from "./MathMarkdown";
import { getAcademicReadingCssVariables } from "../academicReadingTheme";
import "./AssistantMarkdown.css";

function themed(theme, darkValue, lightValue) {
  return theme === "light" ? lightValue : darkValue;
}

function cleanMarkdownProps({ node, ...props }) {
  void node;
  return props;
}

function CopyableCodeBlock({ children, className = "", theme = "dark", ...props }) {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(() => {
    try {
      return window.localStorage.getItem("mabaso-ai-code-word-wrap") === "true";
    } catch {
      return false;
    }
  });
  const codeText = String(children || "").replace(/\n$/, "");

  useEffect(() => {
    const syncPreference = (event) => setWordWrap(Boolean(event?.detail));
    window.addEventListener("mabaso-code-word-wrap", syncPreference);
    return () => window.removeEventListener("mabaso-code-word-wrap", syncPreference);
  }, []);

  const toggleWordWrap = () => {
    const next = !wordWrap;
    setWordWrap(next);
    try {
      window.localStorage.setItem("mabaso-ai-code-word-wrap", String(next));
    } catch {
      // The current code block still updates if local preference storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent("mabaso-code-word-wrap", { detail: next }));
  };

  const copyCode = async () => {
    if (!codeText) return;
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="assistant-code-block">
      <div className="assistant-code-actions">
        <button type="button" className={`assistant-code-wrap ${wordWrap ? "is-active" : ""}`} onClick={toggleWordWrap} aria-label={wordWrap ? "Disable word wrap" : "Enable word wrap"} title={wordWrap ? "Disable word wrap" : "Enable word wrap"}>
          <WrapText className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" className="assistant-code-copy" onClick={copyCode} aria-label={copied ? "Code copied" : "Copy code"}>
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <code className={`assistant-code-content ${wordWrap ? "is-wrapped" : ""} block overflow-x-auto rounded-[22px] p-4 pr-24 font-mono text-[13px] ${themed(theme, "bg-[#0b1120] text-slate-100", "bg-slate-950 text-slate-100")} ${className || ""}`} {...props}>
        {children}
      </code>
    </div>
  );
}

function SaveableLink({ href = "", children, theme = "dark", onSaveLink, ...props }) {
  const [saved, setSaved] = useState(false);
  const isPublicWebLink = /^https?:\/\//i.test(href);
  const linkLabel = Array.isArray(children)
    ? children.filter((item) => typeof item === "string" || typeof item === "number").join(" ")
    : (typeof children === "string" || typeof children === "number" ? String(children) : href);

  const save = async () => {
    if (!isPublicWebLink || !onSaveLink) return;
    const ok = await onSaveLink(href, linkLabel || href);
    if (ok !== false) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    }
  };

  return (
    <span className="assistant-saveable-link">
      <a
        href={href}
        className={`underline underline-offset-4 ${themed(theme, "text-cyan-200 hover:text-white", "text-cyan-700 hover:text-cyan-900")}`}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
      {onSaveLink && isPublicWebLink ? (
        <button type="button" onClick={save} aria-label={saved ? "Saved to Library" : "Save link to Library"} title={saved ? "Saved to Library" : "Save to Library"}>
          {saved ? <Check aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
        </button>
      ) : null}
    </span>
  );
}

export default function AssistantMarkdown({ content = "", theme = "dark", onSaveLink = null }) {
  return (
    <div
      className={`assistant-markdown academic-reading-theme ${themed(theme, "text-slate-100", "text-slate-800")}`}
      style={getAcademicReadingCssVariables()}
    >
      <MathMarkdown
        content={content}
        components={{
          h1: (props) => <h1 {...cleanMarkdownProps(props)} />,
          h2: (props) => <h2 {...cleanMarkdownProps(props)} />,
          h3: (props) => <h3 {...cleanMarkdownProps(props)} />,
          p: (props) => <p {...cleanMarkdownProps(props)} />,
          ul: (props) => <ul {...cleanMarkdownProps(props)} />,
          ol: (props) => <ol {...cleanMarkdownProps(props)} />,
          li: (props) => <li {...cleanMarkdownProps(props)} />,
          blockquote: (props) => (
            <blockquote
              className={`mb-3 rounded-2xl border-l-4 px-4 py-3 italic ${themed(theme, "border-emerald-300/45 bg-white/5 text-slate-200", "border-emerald-600/55 bg-emerald-50 text-slate-700")}`}
              {...cleanMarkdownProps(props)}
            />
          ),
          a: (props) => <SaveableLink theme={theme} onSaveLink={onSaveLink} {...cleanMarkdownProps(props)} />,
          code: (componentProps) => {
            const { inline, className, children, ...props } = cleanMarkdownProps(componentProps);
            if (inline) {
              return (
                <code
                  className={`rounded-lg px-1.5 py-0.5 font-mono text-[0.92em] ${themed(theme, "bg-white/10 text-emerald-100", "bg-slate-900/10 text-emerald-700")}`}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <CopyableCodeBlock className={className} theme={theme} {...props}>{children}</CopyableCodeBlock>;
          },
          pre: (props) => <pre className="mb-3 last:mb-0" {...cleanMarkdownProps(props)} />,
          table: (props) => (
            <div className="mb-3 overflow-x-auto last:mb-0">
              <table className={`min-w-full overflow-hidden rounded-2xl ${themed(theme, "border-separate border-spacing-0", "border-separate border-spacing-0")}`} {...cleanMarkdownProps(props)} />
            </div>
          ),
          th: (props) => (
            <th className={`border-b px-3 py-2 text-left text-xs uppercase tracking-[0.18em] ${themed(theme, "border-white/10 bg-white/5 text-slate-300", "border-slate-200 bg-slate-100 text-slate-600")}`} {...cleanMarkdownProps(props)} />
          ),
          td: (props) => (
            <td className={`border-b px-3 py-2 align-top ${themed(theme, "border-white/10 text-slate-200", "border-slate-200 text-slate-700")}`} {...cleanMarkdownProps(props)} />
          ),
        }}
      />
    </div>
  );
}
