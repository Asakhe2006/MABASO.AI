import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const assistantHookSource = await readFile(new URL("../src/useLectureAssistant.js", import.meta.url), "utf8");
const assistantPanelSource = await readFile(new URL("../src/components/LectureAssistantPanel.jsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

assert.doesNotMatch(
  appSource,
  /studyChatEndRef\.current\?\.scrollIntoView[\s\S]{0,180}chatMessages\[chatMessages\.length - 1\]\?\.content/,
  "Study Chat must not auto-scroll on every streamed token.",
);
assert.match(appSource, /pendingStudyChatAnchorIdRef/, "Study Chat must anchor the start of a new assistant response once.");
assert.match(appSource, /study-chat-jump-latest/, "Study Chat must offer a user-controlled jump-to-latest action.");
assert.match(appSource, /active-study-chat-messages/, "Current Subject chat must use its own bounded scroll surface.");
assert.match(appSource, /onDelta:\s*\(streamedAnswer\)/, "Current Subject chat must stream into its assistant message.");
assert.doesNotMatch(
  assistantHookSource,
  /messagesEndRef\.current\?\.scrollIntoView[\s\S]{0,160}\[isGenerating,\s*isOpen,\s*messages\.length\]/,
  "AI Chat must not follow the bottom while streaming.",
);
assert.match(assistantHookSource, /pendingAssistantAnchorIdRef/, "AI Chat must anchor a new answer once.");
assert.equal(
  (assistantPanelSource.match(/<TypingIndicator theme=\{theme\} \/>/g) || []).length,
  1,
  "AI Chat must render one generating indicator inside the pending assistant message.",
);
assert.match(cssSource, /\.ai-streaming-dots > span[\s\S]*width:\s*5px[\s\S]*height:\s*5px/, "Chat loading dots must remain compact.");
assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/, "Chat motion must respect reduced-motion preferences.");

console.log("Chat scroll, streaming, and composer safeguards passed.");
