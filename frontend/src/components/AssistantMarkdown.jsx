import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

function themed(theme, darkValue, lightValue) {
  return theme === "light" ? lightValue : darkValue;
}

export default function AssistantMarkdown({ content = "", theme = "dark" }) {
  return (
    <div className={`assistant-markdown text-sm leading-7 ${themed(theme, "text-slate-100", "text-slate-800")}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ node, ...props }) => <h1 className="mb-3 text-xl font-semibold" {...props} />,
          h2: ({ node, ...props }) => <h2 className="mb-3 text-lg font-semibold" {...props} />,
          h3: ({ node, ...props }) => <h3 className="mb-2 text-base font-semibold" {...props} />,
          p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
          ul: ({ node, ...props }) => <ul className="mb-3 list-disc pl-5 last:mb-0" {...props} />,
          ol: ({ node, ...props }) => <ol className="mb-3 list-decimal pl-5 last:mb-0" {...props} />,
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote
              className={`mb-3 rounded-2xl border-l-4 px-4 py-3 italic ${themed(theme, "border-emerald-300/45 bg-white/5 text-slate-200", "border-emerald-600/55 bg-emerald-50 text-slate-700")}`}
              {...props}
            />
          ),
          a: ({ node, ...props }) => (
            <a
              className={`underline underline-offset-4 ${themed(theme, "text-cyan-200 hover:text-white", "text-cyan-700 hover:text-cyan-900")}`}
              target="_blank"
              rel="noreferrer"
              {...props}
            />
          ),
          code: ({ inline, className, children, ...props }) => {
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
            return (
              <code className={`block overflow-x-auto rounded-[22px] p-4 font-mono text-[13px] ${themed(theme, "bg-[#0b1120] text-slate-100", "bg-slate-950 text-slate-100")} ${className || ""}`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ node, ...props }) => <pre className="mb-3 last:mb-0" {...props} />,
          table: ({ node, ...props }) => (
            <div className="mb-3 overflow-x-auto last:mb-0">
              <table className={`min-w-full overflow-hidden rounded-2xl ${themed(theme, "border-separate border-spacing-0", "border-separate border-spacing-0")}`} {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className={`border-b px-3 py-2 text-left text-xs uppercase tracking-[0.18em] ${themed(theme, "border-white/10 bg-white/5 text-slate-300", "border-slate-200 bg-slate-100 text-slate-600")}`} {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className={`border-b px-3 py-2 align-top ${themed(theme, "border-white/10 text-slate-200", "border-slate-200 text-slate-700")}`} {...props} />
          ),
        }}
      >
        {String(content || "")}
      </ReactMarkdown>
    </div>
  );
}
