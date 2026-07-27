# Mabaso AI - AGENTS.md

## Project Mission

Mabaso AI is an AI-powered learning platform that helps students transform lectures, notes, videos, PDFs and presentations into a complete interactive study experience.

Every change must make the platform feel more professional, easier to use, more educational and more reliable.

Never sacrifice existing functionality for visual improvements.

Always preserve backwards compatibility unless explicitly instructed otherwise.

------------------------------------------------------------

# PRIMARY GOAL

Build Mabaso AI to the quality of world-class educational software.

Use ChatGPT, Microsoft Copilot, Notion, Linear, Apple, Gamma and Google Workspace as references for quality, usability and polish.

DO NOT copy their branding or UI.

Keep Mabaso AI's own identity.

------------------------------------------------------------

# BEFORE WRITING CODE

Before modifying code:

Understand the current implementation.

Trace where the feature starts and ends.

Search for every component using that feature.

Search frontend and backend.

Search exports.

Search API.

Search mobile styles.

Search desktop styles.

Never patch only one location if multiple implementations exist.

Always determine the root cause.

Never guess.

------------------------------------------------------------

# FIX ROOT CAUSE

Never apply cosmetic fixes.

Never hide bugs.

Always identify:

- why it happens
- where it happens
- every place affected
- whether mobile and desktop share the same logic
- whether exports share the same logic

If the same logic exists in multiple places, unify it.

------------------------------------------------------------

# UI STANDARD

Every page must feel premium.

Use:

• excellent spacing

• excellent typography

• proper alignment

• balanced white space

• smooth animations

• professional colours

• subtle shadows

• rounded corners

• accessibility

Avoid:

heavy borders

clutter

misalignment

oversized shadows

poor spacing

AI-looking interfaces

------------------------------------------------------------

# Mabaso AI Performance, Memory, and ChatGPT-Style Platform Requirements

## Website Speed and Performance Requirements

The website must always prioritize fast loading speed and a smooth user experience.

The platform should feel as fast and responsive as modern AI platforms such as ChatGPT.

Agents must always consider:

- reduce unnecessary frontend rendering
- avoid loading heavy components before they are needed
- use lazy loading for large pages and tools
- optimize images before displaying them
- compress large files where possible
- avoid unnecessary API calls
- cache reusable data
- prevent repeated database requests
- optimize backend response times
- show smooth loading states instead of freezing screens
- avoid UI lag when switching workspace tabs
- optimize mobile performance especially on slower networks

The website should load the main interface first, then load advanced features in the background.

Priority loading order:

1. Authentication and main layout
2. Sidebar and navigation
3. User history/materials
4. Current workspace
5. AI tools and heavy components

The user should never feel like the website is waiting unnecessarily.

---

# ChatGPT-Style History and Memory System

Mabaso AI must inherit the conversation and history experience of ChatGPT.

The platform should not behave like a temporary webpage.

Everything important should persist securely to the user's account.

## User History Requirements

Users should have a permanent history system similar to ChatGPT.

The system should store:

- previous AI conversations
- uploaded lectures
- generated study guides
- generated tests
- flashcards
- formulas
- worked examples
- PowerPoint generations
- podcast generations
- teacher mode sessions
- shared study rooms
- personal notes
- highlights and edits

Users should be able to:

- reopen previous sessions
- continue conversations
- search history
- rename saved sessions
- delete individual history items
- clear selected history
- continue where they stopped

---

# ChatGPT-Style Conversation Experience

The AI chat experience should feel similar to ChatGPT.

Requirements:

- messages should remain available after refresh
- conversations should automatically save
- users should see previous chats in history
- AI responses should stream when possible
- show typing/loading states
- support continuing previous discussions
- maintain conversation context

Example:

User:

"Explain chapter 3 again but easier."

The AI should understand the previous lecture context instead of starting from zero.

---

# Workspace Memory

The Study Workspace should remember user activity.

The system should remember:

- last opened tab
- last viewed topic
- scroll position where possible
- edits made
- highlights added
- generated content
- selected language
- user preferences

After returning:

The user should continue from where they left.

---

# ChatGPT-Inspired Website Design Principles

Mabaso AI should inherit the best design principles from ChatGPT.

The interface should be:

- clean
- minimal
- distraction-free
- professional
- easy to navigate
- focused on content

Avoid:

- unnecessary boxes
- excessive borders
- cluttered layouts
- confusing buttons
- crowded screens

---

# Main Layout Requirements

The website should follow a ChatGPT-like structure:

## Desktop

Left side:

- collapsible sidebar
- history
- saved materials
- navigation tools

Center:

- main AI workspace
- study content
- conversations

Top:

- profile
- search
- settings

---

## Mobile

The mobile experience must behave like ChatGPT mobile.

Requirements:

- fixed top navigation
- sidebar opening from the side
- no disappearing controls while scrolling
- readable content width
- proper spacing
- large enough touch targets

Always keep visible:

- menu button
- search
- profile
- back navigation when needed

---

# ChatGPT-Style Search

Users should be able to search their own Mabaso AI history.

Search should find:

- old lectures
- conversations
- generated study guides
- notes
- flashcards
- tests

Example:

Search:

"Newton laws"

Results:

- previous physics lecture
- highlighted notes
- AI conversations
- generated examples

---

# AI Personalisation

Mabaso AI should become more personalised over time.

The system can learn:

- preferred explanation style
- preferred language
- frequently studied subjects
- weak topics
- previous mistakes

The goal is to create a personal AI study assistant.

---

# Reliability Requirements

Agents must always test:

- refresh persistence
- logout/login persistence
- history saving
- mobile responsiveness
- slow internet behaviour
- backend failure handling

The website must never lose user work.

Important user-generated data must be saved safely.

---

# Database Requirements

History data should be structured properly.

Avoid storing everything only in browser storage.

Important data should be stored in the backend database.

Examples:

Users table:

- profile information
- preferences

History table:

- conversations
- generated content
- timestamps

Workspace table:

- current progress
- edits
- highlights

Files table:

- uploaded materials
- generated files
s
---

# Overall Product Standard

Every new feature added to Mabaso AI must be evaluated with this question:

"Does this feel like a modern AI platform similar to ChatGPT?"

The final experience should feel like:

ChatGPT + Microsoft Copilot + Notion + Quizlet + AI Tutor

The website should be fast, intelligent, persistent, and personalised.

# DESIGN REFERENCES

Target quality similar to:

ChatGPT

Microsoft Copilot

Apple

Notion

Linear

Gamma

Google Workspace

Do NOT clone them.

Only learn from their design principles.

------------------------------------------------------------

# MOBILE FIRST

Every feature must work perfectly on phones.

Never finish desktop while mobile remains broken.

Always test:

portrait

landscape

small Android

large Android

tablet

desktop

No horizontal scrolling.

No clipped cards.

No hidden buttons.

No overflowing text.

------------------------------------------------------------

# STUDY WORKSPACE

The study workspace is the most important screen.

Requirements:

Sticky top controls.

Sticky navigation.

Correct sidebar behaviour.

Responsive layout.

Correct scrolling.

Buttons always accessible.

Workspace fills available screen.

Desktop and mobile share functionality.

Sidebar never covers important controls.

Search must remain accessible.

Profile button always reachable.

Navigation should feel similar to ChatGPT.

------------------------------------------------------------

# STUDY GUIDE

The Study Guide is Mabaso AI's flagship feature.

It should feel like an interactive university textbook.

NOT an AI-generated article.

Always optimise for learning.

Preferred structure:

Definition

Explanation

Diagram

Example

Worked Example

Real-world Example

Exam Tip

Common Mistake

Deep Dive

Summary

Revision Questions

Key Takeaways

------------------------------------------------------------

# EDUCATIONAL QUALITY

Replace long paragraphs with:

bullet lists

tables

timelines

flowcharts

comparison tables

process diagrams

decision trees

worked examples

formula boxes

summary boxes

Use whichever format teaches best.

Do not force paragraphs.

------------------------------------------------------------

# IMAGES

Images must never be decorative only.

Each figure requires:

Figure Number

Title

Caption

Explanation

Exam Importance

What to Notice

Images stay beside the content they explain.

Never move images to the end.

------------------------------------------------------------

# TABLES

Allow educational tables whenever they improve understanding.

Tables must:

render correctly

export correctly

remain responsive

appear identically on:

Web

PDF

DOCX

------------------------------------------------------------

# EXPORTS

The website is the source of truth.

PDF

DOCX

future exports

must render exactly the same content.

Never maintain separate formatting logic.

Use one shared content pipeline.

Content order must remain identical.

------------------------------------------------------------

# EDITOR

The editor must behave like Microsoft Word.

Requirements:

Reliable editing.

Reliable selection.

Autosave.

Undo.

Redo.

Highlighting.

Erasing.

Selection persistence.

No disappearing cursor.

No lost formatting.

------------------------------------------------------------

# HIGHLIGHT MODE

Highlight mode must:

work on desktop

work on touch devices

preserve text selection

allow colour selection

support erase

autosave

remain after refresh

appear in exports

------------------------------------------------------------

# POWERPOINT

Presentations must feel professionally designed.

Avoid text-heavy slides.

Use:

icons

diagrams

timelines

process graphics

comparison layouts

speaker notes

visual hierarchy

consistent spacing

------------------------------------------------------------

# PODCASTS

Podcast scripts should sound natural.

Avoid robotic wording.

Use conversational educational language.

------------------------------------------------------------

# FLASHCARDS

Flashcards should:

test understanding

not memorisation only

mix recall

application

comparison

critical thinking

------------------------------------------------------------

# ORAL EXAMS

Uploaded material is priority context.

However:

If the user asks a general academic question,

answer from trusted academic knowledge.

Do NOT refuse simply because it wasn't uploaded.

Explain when information comes from general knowledge.

------------------------------------------------------------

# CHAT

The AI should:

teach

encourage

explain

guide

not simply answer.

Prefer teaching over dumping information.

------------------------------------------------------------

# AI WRITING STYLE

Avoid AI phrases.

Avoid:

"In today's world..."

"It is important to note..."

"As we can see..."

Write like an experienced university lecturer.

------------------------------------------------------------

# ACCESSIBILITY

Support:

keyboard

screen readers

high contrast

large touch targets

reduced motion

------------------------------------------------------------

# PERFORMANCE

Prefer efficient solutions.

Avoid unnecessary renders.

Avoid duplicated API calls.

Avoid duplicated state.

Avoid duplicated exports.

------------------------------------------------------------

# REACT

Prefer:

small reusable components

custom hooks

clear naming

clean architecture

avoid giant files

------------------------------------------------------------

# BACKEND

Business logic belongs in backend.

Frontend should not duplicate backend rules.

------------------------------------------------------------

# DATABASE

Never duplicate data.

Keep schema consistent.

Avoid unnecessary queries.

------------------------------------------------------------

# SECURITY

Never expose secrets.

Never expose private keys.

Validate all user input.

Sanitize uploaded content.

------------------------------------------------------------

# TESTING

Before considering work complete:

Build frontend.

Build backend.

Test desktop.

Test Android.

Test exports.

Test editor.

Test highlight.

Test downloads.

Test history.

Test oral exam.

Test study guide.

------------------------------------------------------------

# COMPLETION CHECKLIST

Never say "fixed" until:

✓ Code compiles

✓ Build passes

✓ Runtime tested

✓ Mobile tested

✓ Desktop tested

✓ No console errors

✓ No regression introduced

✓ Feature fully functional

If any item fails, continue working until the implementation is complete.

------------------------------------------------------------

# AI RESPONSE FORMATTING RULES

Mabaso AI responses must never expose raw Markdown symbols to the user.

The interface must render:

- bold text as actual bold text
- headings as actual headings
- bullet points as clean bullets
- numbered steps as proper numbered lists
- links as clickable links
- code as styled code blocks
- tables as real responsive tables
- formulas as properly rendered equations
- paragraphs with correct spacing

Do not render AI answers as plain strings when they may contain Markdown. Use the existing safe Markdown renderer where possible, such as `MobileFirstMarkdown`, `AssistantMarkdown`, `react-markdown`, `remark-gfm`, `remark-math`, and `rehype-katex`.

Never solve raw Markdown by blindly deleting symbols such as `*`, `**`, `##`, or `###`; that can damage formulas, code, multiplication symbols, footnotes, and intended academic content. Render Markdown properly instead.

AI writing should prefer direct answers, short paragraphs, useful headings, clean lists only for real lists, numbered steps for procedures, tables for comparisons, no filler introductions, no excessive bold text, no repeated conclusions, no fake quotations, and no excessive emojis.

On mobile, responses must fit the viewport: `width: 100%`, `max-width: 100%`, `min-width: 0`, wrapped long words and URLs, scrollable tables/code blocks, comfortable line height, and no horizontal clipping.
