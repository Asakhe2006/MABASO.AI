import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ACADEMIC_READING_THEME, getAcademicExportTypography } from "../src/academicReadingTheme.js";

const css = await readFile(new URL("../src/academicReadingTheme.css", import.meta.url), "utf8");
const globalCss = await readFile(new URL("../src/index.css", import.meta.url), "utf8");
const assistant = await readFile(new URL("../src/components/AssistantMarkdown.jsx", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const publicSite = await readFile(new URL("../src/EnterpriseSiteShell.jsx", import.meta.url), "utf8");

assert.equal(ACADEMIC_READING_THEME.readingWidthPx, 800);
assert.equal(ACADEMIC_READING_THEME.bodyPx, 16);
assert.equal(ACADEMIC_READING_THEME.mobileBodyPx, 15.5);
assert.equal(ACADEMIC_READING_THEME.lineHeight, 1.65);
assert.equal(getAcademicExportTypography().bodyPt, 12);
assert.match(css, /--academic-display-math:\s*19px/);
assert.match(css, /\.academic-reading-theme \.katex-display/);
assert.match(css, /max-width:\s*var\(--academic-reading-width\)/);
assert.match(assistant, /academic-reading-theme/);
assert.match(app, /academic-reading-document/);
assert.match(globalCss, /body\.study-guide-focus-open > \.study-guide-focus-stage \.study-guide-slide-nav\s*\{[\s\S]*?grid-area:\s*nav\s*!important/);
assert.match(globalCss, /body\.study-guide-focus-open > \.study-guide-focus-stage \.study-guide-section-slides > \.study-guide-section-card\s*\{[\s\S]*?height:\s*100%\s*!important/);
assert.match(publicSite, /const PRODUCT_EXPLANATIONS = \{/);
for (const route of [
  "/product/study-workspace",
  "/product/lecture-capture",
  "/product/ai-study-guide",
  "/product/worked-examples",
  "/product/flashcards",
  "/product/ai-test-generator",
  "/ai-tools/podcast-generator",
  "/ai-tools/powerpoint-generator",
  "/ai-tools/study-chat",
]) {
  assert.match(publicSite, new RegExp(`\\"${route.replaceAll("/", "\\/")}\\"\\s*:`));
}

console.log("Verified Academic Reading Theme, full-screen Focus Mode layout, and detailed public tool explanations.");
