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


# ChatGPT-Style History URLs, Cookie Sessions, and Secure Workspace Access

## Main Goal

Mabaso AI must use a secure ChatGPT-style system where each saved lecture, study workspace, and AI conversation has its own unique URL.

Example:

```text
https://mabaso-ai-web.onrender.com/c/6a66496f-5cc0-83ea-93b1-07fa70210f88
```

or:

```text
https://mabaso-ai-web.onrender.com/workspace/6a66496f-5cc0-83ea-93b1-07fa70210f88
```

The long number in the URL is a conversation or workspace ID.

It identifies which saved item the user wants to open.

It is not the user’s login session and it is not a cookie.

Mabaso AI must use both:

1. A unique workspace or conversation ID in the URL.
2. A secure HttpOnly cookie session that identifies the signed-in user.

The URL tells the backend what content is requested.

The session cookie tells the backend who is requesting it.

The backend must verify that the signed-in user owns or is authorised to access the requested content before returning it.

---

# Important Security Difference

## Workspace or Conversation ID

Example:

```text
6a66496f-5cc0-83ea-93b1-07fa70210f88
```

Purpose:

* identifies a specific conversation
* identifies a study workspace
* allows users to reopen saved work
* allows browser navigation
* allows ChatGPT-style history links

This ID may appear in the website URL.

It must not contain:

* the user’s email
* student number
* real name
* password
* access token
* session token
* payment details
* predictable database sequence

Use a random UUID or similarly strong, non-sequential identifier.

Do not use predictable URLs such as:

```text
/workspace/1
/workspace/2
/workspace/3
```

---

## Cookie Session

A session cookie is private browser data created after a successful sign-in.

It is used to prove which user is currently authenticated.

The cookie must never appear:

* in the URL
* inside page text
* in local storage
* in session storage
* in browser console logs
* in analytics
* in error messages
* in screenshots
* in frontend state that can be read by JavaScript when using HttpOnly cookies

The browser should automatically send the cookie to the backend.

The cookie session should use settings equivalent to:

```text
HttpOnly = true
Secure = true in production
SameSite = correctly configured
Path = /
Controlled expiry
```

The frontend should use:

```js
credentials: "include"
```

for requests that depend on the cookie session.

---

# Correct Security Flow

When a user opens:

```text
/workspace/6a66496f-5cc0-83ea-93b1-07fa70210f88
```

the backend must perform this flow:

```text
Read the session cookie
        ↓
Validate the session
        ↓
Identify the signed-in user
        ↓
Read the workspace ID from the URL
        ↓
Check that the user owns or may access that workspace
        ↓
If authorised: return the workspace
If unauthorised: reject the request
```

Never return a workspace only because the ID exists.

Knowing or copying the URL must not give access to another student’s information.

---

# Required Backend Ownership Check

Every private resource must be loaded using both:

* the resource ID
* the authenticated user ID

Correct database logic:

```sql
SELECT *
FROM workspaces
WHERE public_id = :workspace_id
AND user_id = :authenticated_user_id;
```

Incorrect logic:

```sql
SELECT *
FROM workspaces
WHERE public_id = :workspace_id;
```

The incorrect query creates an insecure direct object reference vulnerability.

The same protection must apply to:

* conversations
* workspaces
* lecture uploads
* transcripts
* study guides
* formulas
* worked examples
* flashcards
* tests
* answer images
* PowerPoint files
* podcast files
* study notes
* highlights
* edits
* timetable data
* billing records
* support records
* private collaboration rooms
* generated downloads

---

# Private Resource API Rules

Create or update protected endpoints similar to:

```http
GET /workspaces/{workspace_id}
GET /conversations/{conversation_id}
GET /history
DELETE /workspaces/{workspace_id}
PATCH /workspaces/{workspace_id}
POST /workspaces/{workspace_id}/messages
GET /workspaces/{workspace_id}/downloads/{file_id}
```

Every endpoint must:

1. Require a valid authenticated session.
2. Validate that the session has not expired.
3. identify the current user from the server-side session.
4. validate the supplied resource ID.
5. verify ownership or collaboration permission.
6. reject access when ownership is missing.
7. never trust a frontend-supplied `user_id`.
8. never reveal whether another user’s private resource exists.

For unauthorised resource access, prefer a safe response such as:

```http
404 Not Found
```

This can avoid confirming that another user’s workspace exists.

For a missing or expired session, return:

```http
401 Unauthorized
```

---

# ChatGPT-Style Website History

Mabaso AI should show saved workspaces in a collapsible sidebar similar to ChatGPT.

The sidebar should contain:

* recent study workspaces
* recent AI conversations
* lecture titles
* dates or grouped history periods
* a new lecture button
* history search
* rename action
* delete action
* archive action where supported
* a menu for more actions

Example history groups:

```text
Today

ARM Microcontroller Lecture
Laplace Transform Revision
Digital Signal Processing Test

Yesterday

Circuit Analysis Lecture
Fourier Series Study Guide

Previous 7 Days

Engineering Mathematics
Embedded Systems Practice
```

The history must come from the authenticated user’s backend account.

Do not rely only on browser local storage.

---

# Opening a History Item

When a user selects an item from history:

1. Update the URL using its public workspace ID.
2. Show a loading state.
3. Request the workspace from the backend.
4. Send the cookie session automatically.
5. Verify the current user owns it.
6. Load all saved content.
7. restore the correct workspace tab.
8. restore saved edits and highlights.
9. restore the conversation context.
10. update the selected history item in the sidebar.

Example URL:

```text
/workspace/6a66496f-5cc0-83ea-93b1-07fa70210f88
```

The URL should remain stable after refresh.

---

# Creating a New Workspace

When a new lecture is uploaded or recording starts:

1. The backend creates a new workspace record.
2. Generate a secure random public ID.
3. Associate the workspace with the authenticated user.
4. Store the title and creation date.
5. Return the public ID.
6. Update the browser URL.
7. Add the workspace to history.
8. Begin upload and generation processing.

The URL should change from a general page such as:

```text
/capture
```

to a workspace URL such as:

```text
/workspace/6a66496f-5cc0-83ea-93b1-07fa70210f88
```

when a real workspace has been created.

---

# Automatic Workspace Naming

New workspace history should receive an automatic title based on:

* lecture title
* uploaded filename
* detected topic
* first meaningful user message
* course or subject name

Examples:

```text
Introduction to Microcontrollers
Laplace Transform Lecture
Database Normalisation Notes
Past Paper Revision — Calculus
```

Avoid names such as:

```text
New Workspace 1
Untitled
Upload
History Item
```

Allow the user to rename the workspace.

Renaming must update the backend immediately or through autosave.

---

# History Search

Add a ChatGPT-style history search.

Search should find matches in:

* workspace title
* lecture title
* subject
* course
* conversation content
* study-guide headings
* transcript keywords
* file names
* created date where useful

The search must only search records belonging to the authenticated user.

Search results must never include another student’s private work.

---

# Website Address Bar Behaviour

The workspace or conversation ID should be visible in the website address bar.

Example:

```text
https://mabaso-ai-web.onrender.com/workspace/6a66496f-5cc0-83ea-93b1-07fa70210f88
```

This allows:

* refreshing the page
* reopening the saved workspace
* browser navigation
* bookmarking a private workspace
* ChatGPT-style history behaviour

However, opening the URL must still require a valid session and ownership check.

Do not display the cookie value anywhere on the website.

Only the workspace ID should appear in the URL.

---

# Direct Link Behaviour

When a user pastes or opens a private workspace link:

## Valid session and correct owner

```text
Open the workspace
```

## No valid session

```text
Show sign-in
```

After successful sign-in:

* check whether the signed-in user owns the requested workspace
* open it only when authorised
* otherwise show a safe “Workspace not found” page

## Signed in as a different user

```text
Do not open the workspace
Do not reveal its title
Do not reveal its owner
Do not reveal uploaded file names
Do not reveal whether it exists
```

Show:

```text
This workspace could not be found or you do not have access to it.
```

---

# Session Verification Before Rendering

Mabaso AI must never briefly show Capture Lecture, Study Workspace, My Materials, collaboration content, or admin data before checking the session.

Use an authentication state such as:

```text
checking
authenticated
unauthenticated
```

During `checking`, show only:

```text
Checking your session…
```

Do not render private content.

Correct flow:

```text
Website opens
        ↓
Check session using /auth/me
        ↓
Session valid?
       ↙        ↘
     Yes         No
      ↓           ↓
Load private     Clear private
workspace        browser state
                  ↓
               Show sign-in
```

---

# Expired Session Behaviour

When a long-time session has expired:

* do not open Capture Lecture
* do not open the previous workspace
* do not display previous lecture titles
* do not display old history
* do not display the user’s profile
* do not display previous tabs
* do not display admin content
* do not wait several seconds while showing private content

Instead:

```text
Open Mabaso AI
        ↓
Checking your session…
        ↓
Session expired
        ↓
Sign-in page
        ↓
Your session has expired. Please sign in again.
```

The website must not first open the protected page and then log out.

---

# Browser Back and Forward Protection

After logout or session expiry:

* replace the private URL with the sign-in or public landing URL
* prevent browser Back from revealing private cached content
* recheck authentication when a protected URL is restored
* clear private frontend state
* clear private query caches
* cancel active private requests

Use route replacement:

```js
navigate("/signin", { replace: true });
```

The protected-route guard must still block old workspace links even if they remain in browser history.

---

# Multi-Tab Logout Protection

If a user logs out or the session expires in one browser tab, all Mabaso AI tabs should:

* clear private state
* stop audio or recording
* close collaboration connections
* stop active API operations
* redirect to sign-in
* stop showing private workspaces

Use a mechanism such as:

```text
BroadcastChannel
```

or:

```text
storage event
```

Do not broadcast session cookies or private content.

---

# Saved Workspace Restoration

Mabaso AI should restore the user’s previous position only after session verification.

It may remember:

* last workspace
* last opened study tool
* selected topic
* scroll position
* edit mode
* highlight mode
* highlighted text
* draft chat message
* generated content
* selected language

Restoration order:

1. Verify the cookie session.
2. identify the authenticated user.
3. load that user’s saved history.
4. validate the workspace ID.
5. verify ownership.
6. restore the workspace.

Never restore private state before the user has been verified.

Never allow a second user on the same device to inherit the first user’s workspace.

---

# Collaboration Access

Private collaboration rooms require a separate permission check.

A user may access a room only when:

* the user owns the room
* the user was invited
* the user is an approved member
* the room is intentionally public according to the platform rules

A workspace shared into a collaboration room must not become public by default.

The backend must verify both:

* room membership
* permission to access the shared workspace

---

# Public Sharing Must Be Separate

Normal workspace URLs must remain private.

Do not make this URL publicly shareable:

```text
/workspace/6a66496f-5cc0-83ea-93b1-07fa70210f88
```

If Mabaso AI later adds public sharing, use a separate controlled sharing system, for example:

```text
/share/unique-share-token
```

Public sharing must require:

* explicit user action
* separate share token
* revocation
* expiry where appropriate
* view-only permissions by default
* no exposure of account details
* no exposure of unrelated workspace history

Never treat the private workspace ID as a public sharing token.

---

# Database Requirements

Workspace tables should contain fields similar to:

```text
id
public_id
user_id
title
subject
workspace_type
created_at
updated_at
last_opened_at
archived_at
deleted_at
```

Conversation tables should contain:

```text
id
public_id
workspace_id
user_id
title
created_at
updated_at
```

Message tables should contain:

```text
id
conversation_id
user_id
role
content
created_at
```

Use indexes for:

```text
public_id
user_id
workspace_id
updated_at
```

Add unique constraints for public IDs.

All backend queries must be user-scoped.

---

# Supabase Security

If Supabase is used, enable Row Level Security on private tables.

Private records should not be directly readable by anonymous users.

Policies must ensure:

```text
Authenticated user ID equals record owner ID
```

When the backend uses a service-role key:

* keep it only on the backend
* never expose it to Vite or frontend code
* enforce ownership inside backend queries
* audit all access to private data

Do not assume service-role access automatically enforces user privacy.

---

# Cookie Session Security Requirements

Codex must inspect the current cookie/session implementation and ensure:

* the cookie is HttpOnly
* the cookie is Secure in production
* SameSite matches the frontend/backend deployment
* the cookie has an expiry
* the backend validates expiry
* the backend validates session revocation
* logout invalidates the server session
* logout expires the browser cookie
* `/auth/me` checks the real session
* protected endpoints reject expired sessions
* authentication does not depend only on local storage
* access tokens are not saved in local storage
* raw cookie values are never logged

---

# Frontend Design Requirements

The feature should be visible on the website through:

## Desktop Sidebar

* New Lecture button
* Search history
* recent workspaces
* saved chats
* My Materials
* Collaboration
* My Timetable
* Settings
* profile menu

## Mobile Sidebar

* slide-out history drawer
* search history
* recent workspaces
* new lecture action
* account menu

## Main Header

Show:

* current workspace title
* workspace status
* share action where allowed
* download action
* profile menu

The long workspace ID should remain mainly in the address bar.

Do not place the raw UUID prominently inside the content area unless needed for support or debugging.

---

# Loading States

When opening a workspace, show:

```text
Opening your workspace…
```

When checking authentication, show:

```text
Checking your session…
```

When history is loading, show small skeleton rows in the sidebar.

Do not freeze the whole website.

Do not display an empty Capture Lecture page while the real workspace loads.

Do not display another workspace’s cached data.

---

# Performance Requirements

The ChatGPT-style history system must remain fast.

Codex should:

* load recent history first
* paginate older history
* lazy-load large workspace content
* cache safe static assets
* avoid caching private API responses in shared caches
* prevent duplicate history requests
* avoid loading every complete workspace into the sidebar
* fetch only history metadata for the sidebar
* fetch full workspace content only when selected
* optimise database indexes
* cancel stale requests when switching workspaces
* use loading skeletons instead of blocking the page

Sidebar history metadata should contain only what is needed, such as:

```text
public_id
title
updated_at
workspace_type
```

Do not load full transcripts, study guides, tests, podcasts, and messages for every sidebar item.

---

# Error Behaviour

## Workspace not found

```text
This workspace could not be found.
```

## No permission

Prefer the same safe response:

```text
This workspace could not be found or you do not have access to it.
```

## Expired session

```text
Your session has expired. Please sign in again.
```

## Network failure

```text
We could not open this workspace. Check your connection and try again.
```

## Deleted workspace

```text
This workspace is no longer available.
```

Do not expose:

* database IDs
* stack traces
* SQL errors
* session token values
* cookie names where unnecessary
* another user’s information

---

# Files Codex Must Inspect

Codex must inspect and update the existing implementation, including:

```text
frontend/src/App.jsx
frontend/src/App.css
frontend/src/index.css
backend/main.py
render.yaml
Supabase migrations
authentication middleware
/auth/me
logout endpoint
history endpoints
workspace endpoints
conversation endpoints
download endpoints
collaboration endpoints
frontend routing
browser history handling
localStorage usage
sessionStorage usage
service worker files
cookie configuration
central API request wrapper
```

Search for:

```text
localStorage
sessionStorage
isAuthenticated
currentUser
currentPage
workspaceId
conversationId
history
/auth/me
logout
401
403
navigate
pushState
replaceState
fetchWithTimeout
credentials
cookie
```

Do not create a second disconnected history or authentication system.

Repair and extend the current architecture.

---

# Tests Codex Must Complete

Test all of the following:

1. A signed-in user can create a workspace.
2. The new workspace receives a random public ID.
3. The workspace URL appears in the address bar.
4. Refreshing the URL opens the same workspace.
5. The workspace appears in the correct user’s sidebar history.
6. Renaming updates the sidebar and backend.
7. Deleting removes access to the workspace.
8. A signed-out user cannot open a private workspace URL.
9. A different signed-in user cannot open the URL.
10. Copying the URL does not bypass ownership checks.
11. An expired session does not briefly reveal the workspace.
12. Browser Back after logout does not reveal private content.
13. Browser Forward after logout does not reveal private content.
14. A valid user can reopen their own old workspace.
15. A second user on the same device sees only their own history.
16. The cookie does not appear in the URL.
17. The cookie is not readable from frontend JavaScript.
18. No access token exists in local storage.
19. Private API responses are not stored in shared caches.
20. History search returns only the authenticated user’s records.
21. Direct API calls reject another user’s workspace ID.
22. Download endpoints verify ownership.
23. Collaboration access verifies room membership.
24. Logging out in one tab logs out all open tabs.
25. Workspace restoration occurs only after authentication verification.
26. Slow session checking shows only a neutral loading screen.
27. Stale API responses cannot repopulate data after logout.
28. Sequential ID guessing is impossible.
29. Public sharing is separate from private workspace URLs.
30. Mobile and desktop use the same secure backend access rules.

---

# Definition of Complete

The feature is complete only when Mabaso AI behaves like this:

```text
User signs in
        ↓
Secure session cookie is created
        ↓
User creates or opens a workspace
        ↓
A unique workspace ID appears in the URL
        ↓
The browser sends the private cookie automatically
        ↓
The backend identifies the user
        ↓
The backend verifies workspace ownership
        ↓
The workspace opens
```

When another person copies the private URL:

```text
Copied workspace URL
        ↓
Backend checks their session
        ↓
They are not the owner
        ↓
No private data is returned
```

When the session has expired:

```text
Open private workspace URL
        ↓
Checking your session…
        ↓
Session invalid
        ↓
Sign-in page
        ↓
No workspace content is shown
```

The workspace ID should appear in the website address bar.

The cookie session must remain private and invisible.

The URL identifies what should be opened.

The cookie session identifies who is requesting it.

The backend ownership check decides whether access is allowed.
