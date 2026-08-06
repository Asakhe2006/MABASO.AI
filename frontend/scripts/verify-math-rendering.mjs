import assert from "node:assert/strict";
import katex from "katex";
import { MATH_MARKDOWN_FIXTURES, normalizeMathMarkdown } from "../src/mathRendering.js";

function displayExpressions(markdown) {
  return [...markdown.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((match) => match[1].trim());
}

for (const [name, markdown] of Object.entries(MATH_MARKDOWN_FIXTURES)) {
  const normalized = normalizeMathMarkdown(markdown);
  const expressions = displayExpressions(normalized);
  assert.ok(expressions.length, `${name} must contain display math`);
  for (const expression of expressions) {
    const rendered = katex.renderToString(expression, {
      displayMode: true,
      output: "htmlAndMathml",
      strict: "ignore",
      throwOnError: false,
      trust: false,
    });
    assert.match(rendered, /katex-mathml/, `${name} must include accessible MathML`);
    assert.match(rendered, /katex-html/, `${name} must include visual KaTeX output`);
  }
}

const repaired = normalizeMathMarkdown("frac{1}{2} + sqrt{x} = 3");
assert.match(repaired, /\$\$\\frac\{1\}\{2\} \+ \\sqrt\{x\} = 3\$\$/);

const alternateDelimiters = normalizeMathMarkdown("Inline \\(x_i^2\\) and display:\n\\[\\sum_{i=1}^n x_i\\]");
assert.match(alternateDelimiters, /Inline \$x_i\^2\$/);
assert.match(alternateDelimiters, /\$\$\\sum_\{i=1\}\^n x_i\$\$/);

const protectedCode = "```js\nconst price = '$50';\n```";
assert.equal(normalizeMathMarkdown(protectedCode), protectedCode);

const streamedPartial = normalizeMathMarkdown("The transform is $$X(\\omega)=\\int_0^");
assert.equal((streamedPartial.match(/\$\$/g) || []).length % 2, 0, "partial display math must remain renderable while streaming");

console.log(`Verified ${Object.keys(MATH_MARKDOWN_FIXTURES).length} advanced math fixtures and normalization safeguards.`);
