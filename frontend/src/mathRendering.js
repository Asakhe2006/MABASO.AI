const CODE_FRAGMENT_PATTERN = /(```[\s\S]*?```|`[^`\n]*`)/g;
const LATEX_COMMAND_PATTERN = /\\(?:begin|end|frac|dfrac|tfrac|sqrt|sum|prod|int|iint|iiint|oint|lim|vec|hat|bar|overline|underline|mathbf|mathrm|mathbb|mathcal|left|right|partial|nabla|infty|alpha|beta|gamma|delta|epsilon|varepsilon|theta|lambda|mu|nu|pi|rho|sigma|tau|phi|varphi|psi|omega|Omega)\b/;
const MATH_LINE_PATTERN = /(?:=|\u2248|\u2260|\u2264|\u2265|\u2192|\u2190|\u2194|\u2211|\u222b|\u221a|\u221e|[A-Za-z]\s*\^\s*[-+{(]|\b(?:sin|cos|tan|log|ln|lim)\s*\(|\\(?:frac|sqrt|sum|int|lim|begin|vec|mathbf|mathbb))/;
const LATEX_COMMANDS_WITHOUT_SLASH = /(^|[^\\\w])(frac|dfrac|tfrac|sqrt|sum|prod|int|iint|iiint|oint|lim|vec|hat|bar|overline|mathbf|mathrm|mathbb|mathcal|partial|nabla|infty|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|rho|sigma|tau|phi|psi|omega)(?=\s*[{_^]|\b)/g;
const SUPERSCRIPT_TO_LATEX = Object.freeze({
  "\u2070": "0",
  "\u00b9": "1",
  "\u00b2": "2",
  "\u00b3": "3",
  "\u2074": "4",
  "\u2075": "5",
  "\u2076": "6",
  "\u2077": "7",
  "\u2078": "8",
  "\u2079": "9",
  "\u207a": "+",
  "\u207b": "-",
  "\u207d": "(",
  "\u207e": ")",
});
const SUBSCRIPT_TO_LATEX = Object.freeze({
  "\u2080": "0",
  "\u2081": "1",
  "\u2082": "2",
  "\u2083": "3",
  "\u2084": "4",
  "\u2085": "5",
  "\u2086": "6",
  "\u2087": "7",
  "\u2088": "8",
  "\u2089": "9",
  "\u208a": "+",
  "\u208b": "-",
  "\u208d": "(",
  "\u208e": ")",
});
const GREEK_TO_LATEX = Object.freeze({
  "\u03b1": "\\alpha ",
  "\u03b2": "\\beta ",
  "\u03b3": "\\gamma ",
  "\u03b4": "\\delta ",
  "\u03b5": "\\epsilon ",
  "\u03b8": "\\theta ",
  "\u03bb": "\\lambda ",
  "\u03bc": "\\mu ",
  "\u03bd": "\\nu ",
  "\u03c0": "\\pi ",
  "\u03c1": "\\rho ",
  "\u03c3": "\\sigma ",
  "\u03c4": "\\tau ",
  "\u03c6": "\\phi ",
  "\u03c8": "\\psi ",
  "\u03c9": "\\omega ",
  "\u03a3": "\\Sigma ",
  "\u03a9": "\\Omega ",
});

function convertDecorativeScripts(value = "", mapping, marker) {
  return String(value || "").replace(
    new RegExp(`[${Object.keys(mapping).join("")}]+`, "g"),
    (match) => `${marker}{${[...match].map((char) => mapping[char] || char).join("")}}`,
  );
}

function normalizeLatexBody(value = "") {
  return convertDecorativeScripts(
    convertDecorativeScripts(String(value || ""), SUPERSCRIPT_TO_LATEX, "^"),
    SUBSCRIPT_TO_LATEX,
    "_",
  )
    .replace(/[αβγδεθλμνπρστφψωΣΩ]/g, (match) => GREEK_TO_LATEX[match] || match)
    .replace(LATEX_COMMANDS_WITHOUT_SLASH, "$1\\$2")
    .replace(/\u2212/g, "-")
    .replace(/\u00d7/g, "\\times ")
    .replace(/\u00f7/g, "\\div ")
    .replace(/\u2264/g, "\\le ")
    .replace(/\u2265/g, "\\ge ")
    .replace(/\u2260/g, "\\ne ")
    .replace(/\u2248/g, "\\approx ")
    .replace(/\u2192/g, "\\to ")
    .replace(/\u2190/g, "\\leftarrow ")
    .replace(/\u2194/g, "\\leftrightarrow ")
    .replace(/\u2211/g, "\\sum ")
    .replace(/\u222b/g, "\\int ")
    .replace(/\u221a/g, "\\sqrt")
    .replace(/\u221e/g, "\\infty ")
    .replace(/\b([A-Za-z])\s*\^\s*([A-Za-z0-9]+)\b/g, "$1^{$2}")
    .replace(/\b([A-Za-z])\s*_\s*([A-Za-z0-9]+)\b/g, "$1_{$2}")
    .replace(/\\sum\s*_\s*([^\\\s]+)\s*\^\s*([^\\\s]+)/g, "\\sum_{$1}^{$2}")
    .replace(/\\int\s*_\s*([^\\\s]+)\s*\^\s*([^\\\s]+)/g, "\\int_{$1}^{$2}")
    .replace(/\s{2,}/g, " ")
    .trim();
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
