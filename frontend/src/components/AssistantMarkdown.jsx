import { useState } from "react";
import { Check, Copy } from "lucide-react";
import MathMarkdown from "./MathMarkdown";

function themed(theme, darkValue, lightValue) {
  return theme === "light" ? lightValue : darkValue;
}

function cleanMarkdownProps({ node, ...props }) {
  void node;
  return props;
}

function CopyableCodeBlock({ children, className = "", theme = "dark", ...props }) {
  const [copied, setCopied] = useState(false);
  const codeText = String(children || "").replace(/\n$/, "");

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
      <button type="button" className="assistant-code-copy" onClick={copyCode} aria-label={copied ? "Code copied" : "Copy code"}>
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <code className={`block overflow-x-auto rounded-[22px] p-4 pr-24 font-mono text-[13px] ${themed(theme, "bg-[#0b1120] text-slate-100", "bg-slate-950 text-slate-100")} ${className || ""}`} {...props}>
        {children}
      </code>
    </div>
  );
}

export default function AssistantMarkdown({ content = "", theme = "dark" }) {
  return (
    <div className={`assistant-markdown text-sm leading-7 ${themed(theme, "text-slate-100", "text-slate-800")}`}>
      <MathMarkdown
        content={content}
        components={{
          h1: (props) => <h1 className="mb-3 text-xl font-semibold" {...cleanMarkdownProps(props)} />,
          h2: (props) => <h2 className="mb-3 text-lg font-semibold" {...cleanMarkdownProps(props)} />,
          h3: (props) => <h3 className="mb-2 text-base font-semibold" {...cleanMarkdownProps(props)} />,
          p: (props) => <p className="mb-3 last:mb-0" {...cleanMarkdownProps(props)} />,
          ul: (props) => <ul className="mb-3 list-disc pl-5 last:mb-0" {...cleanMarkdownProps(props)} />,
          ol: (props) => <ol className="mb-3 list-decimal pl-5 last:mb-0" {...cleanMarkdownProps(props)} />,
          li: (props) => <li className="mb-1" {...cleanMarkdownProps(props)} />,
          blockquote: (props) => (
            <blockquote
              className={`mb-3 rounded-2xl border-l-4 px-4 py-3 italic ${themed(theme, "border-emerald-300/45 bg-white/5 text-slate-200", "border-emerald-600/55 bg-emerald-50 text-slate-700")}`}
              {...cleanMarkdownProps(props)}
            />
          ),
          a: (props) => (
            <a
              className={`underline underline-offset-4 ${themed(theme, "text-cyan-200 hover:text-white", "text-cyan-700 hover:text-cyan-900")}`}
              target="_blank"
              rel="noreferrer"
              {...cleanMarkdownProps(props)}
            />
          ),
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
