import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ACADEMIC_READING_THEME, getAcademicExportTypography } from "../src/academicReadingTheme.js";

const css = await readFile(new URL("../src/academicReadingTheme.css", import.meta.url), "utf8");
const assistant = await readFile(new URL("../src/components/AssistantMarkdown.jsx", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

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

console.log("Verified shared Academic Reading Theme tokens, renderer classes, and export typography.");
