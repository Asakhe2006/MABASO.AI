const CODE_FRAGMENT_PATTERN = /(```[\s\S]*?```|`[^`\n]*`)/g;
const LATEX_COMMAND_PATTERN = /\\(?:begin|end|frac|dfrac|tfrac|sqrt|sum|prod|int|iint|iiint|oint|lim|vec|hat|bar|overline|underline|mathbf|mathrm|mathbb|mathcal|left|right|partial|nabla|infty|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|rho|sigma|tau|phi|psi|omega)\b/;
const MATH_LINE_PATTERN = /(?:=|\u2248|\u2260|\u2264|\u2265|\u2192|\u2190|\u2194|\u2211|\u222b|\u221a|\u221e|\\(?:frac|sqrt|sum|int|lim|begin|vec|mathbf|mathbb))/;
const LATEX_COMMANDS_WITHOUT_SLASH = /(^|[^\\\w])(frac|dfrac|tfrac|sqrt|sum|prod|int|iint|iiint|oint|lim|vec|hat|bar|overline|mathbf|mathrm|mathbb|mathcal|partial|nabla|infty|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|rho|sigma|tau|phi|psi|omega)(?=\s*[{_^]|\b)/g;

function normalizeLatexBody(value = "") {
  return String(value || "")
    .replace(LATEX_COMMANDS_WITHOUT_SLASH, "$1\\$2")
    .replace(/\u2212/g, "-")
    .replace(/\u00d7/g, "\\times ")
    .replace(/\u00f7/g, "\\div ")
    .replace(/\u2264/g, "\\le ")
    .replace(/\u2265/g, "\\ge ")
    .replace(/\u2260/g, "\\ne ")
    .replace(/\u2248/g, "\\approx ")
    .replace(/\u2192/g, "\\to ")
    .replace(/\u221e/g, "\\infty ");
}

function normalizeTextSegment(value = "") {
  let text = String(value || "")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => `$$${normalizeLatexBody(body)}$$`)
    .replace(/\\\(([^\n]*?)\\\)/g, (_, body) => `$${normalizeLatexBody(body)}$`)
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, body) => `$$${normalizeLatexBody(body)}$$`)
    .replace(/\$([^$\n]+?)\$/g, (_, body) => `$${normalizeLatexBody(body)}$`);

  text = text.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes("$") || /^\s*\|/.test(line)) return line;
    const looksLikeBareLatex = LATEX_COMMAND_PATTERN.test(trimmed);
    const proseWordCount = (trimmed.match(/\b[A-Za-z]{3,}\b/g) || []).length;
    const looksLikeStandaloneEquation = MATH_LINE_PATTERN.test(trimmed)
      && trimmed.length <= 360
      && proseWordCount <= 5
      && !/[.!?]\s*$/.test(trimmed)
      && !/^[-*+]\s+/.test(trimmed);
    if (!looksLikeBareLatex && !looksLikeStandaloneEquation) return line;
    const indentation = line.match(/^\s*/)?.[0] || "";
    return `${indentation}$$${normalizeLatexBody(trimmed)}$$`;
  }).join("\n");

  text = text.replace(/\$\$\s*\$\$/g, "").replace(/\n{3,}/g, "\n\n");
  const displayDelimiterCount = (text.match(/\$\$/g) || []).length;
  if (displayDelimiterCount % 2 === 1) return `${text}$$`;
  const withoutDisplayMath = text.replace(/\$\$[\s\S]*?\$\$/g, "");
  const inlineDelimiterCount = (withoutDisplayMath.match(/(?<!\\)\$/g) || []).length;
  return inlineDelimiterCount % 2 === 1 ? `${text}$` : text;
}

export function normalizeMathMarkdown(value = "") {
  return String(value || "")
    .split(CODE_FRAGMENT_PATTERN)
    .map((fragment, index) => (index % 2 === 1 ? fragment : normalizeTextSegment(fragment)))
    .join("");
}

export const MATH_MARKDOWN_FIXTURES = Object.freeze({
  calculus: "$$\\int_0^\\infty e^{-st}f(t)\\,dt$$",
  fourier: "$$X(\\omega)=\\int_{-\\infty}^{\\infty}x(t)e^{-j\\omega t}\\,dt$$",
  laplace: "$$\\mathcal{L}\\{f(t)\\}=F(s)$$",
  linearAlgebra: "$$A=\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}$$",
  statistics: "$$\\bar{x}=\\frac{1}{n}\\sum_{i=1}^{n}x_i$$",
  piecewise: "$$f(x)=\\begin{cases}x^2,&x\\ge0\\\\-x,&x<0\\end{cases}$$",
  alignedDerivation: "$$\\begin{aligned}F(s)&=\\int_0^\\infty e^{-st}f(t)\\,dt\\\\&=\\frac{1}{s^2}\\end{aligned}$$",
  limitAndVector: "$$\\lim_{n\\to\\infty}\\sum_{k=1}^{n}\\frac{\\vec{v}_k}{n}=\\boldsymbol{\\mu}$$",
});
