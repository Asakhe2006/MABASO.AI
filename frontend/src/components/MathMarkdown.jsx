import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import renderMathInElement from "katex/contrib/auto-render";
import "katex/dist/katex.min.css";
import { normalizeMathMarkdown } from "../mathRendering";

const KATEX_OPTIONS = Object.freeze({
  strict: "ignore",
  throwOnError: false,
  trust: false,
  output: "htmlAndMathml",
});

// eslint-disable-next-line react-refresh/only-export-components
export function renderMathInHtmlElement(element) {
  if (!element) return;
  renderMathInElement(element, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
      { left: "$", right: "$", display: false },
    ],
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
    strict: "ignore",
    throwOnError: false,
    trust: false,
  });
}

export default function MathMarkdown({ content = "", components, className = "" }) {
  return (
    <div className={`math-markdown ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[[remarkMath, { singleDollarTextMath: true }], remarkGfm]}
        rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
        components={components}
      >
        {normalizeMathMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
}
