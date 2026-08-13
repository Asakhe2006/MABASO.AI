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
  const ownerDocument = element.ownerDocument;
  const nodeFilter = ownerDocument?.defaultView?.NodeFilter;
  if (ownerDocument && nodeFilter) {
    const walker = ownerDocument.createTreeWalker(element, nodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest(".katex, script, noscript, style, textarea, pre, code")) {
          return nodeFilter.FILTER_REJECT;
        }
        return nodeFilter.FILTER_ACCEPT;
      },
    });
    const textNodes = [];
    let textNode = walker.nextNode();
    while (textNode) {
      textNodes.push(textNode);
      textNode = walker.nextNode();
    }
    textNodes.forEach((node) => {
      const normalized = normalizeMathMarkdown(node.nodeValue || "");
      if (normalized !== node.nodeValue) node.nodeValue = normalized;
    });
  }
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
    <div className={`math-markdown academic-math ${className}`.trim()}>
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
