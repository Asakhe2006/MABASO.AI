# Mabaso AI Website Description

## What the website does

Mabaso AI is an AI-powered study website for students. It turns lecture material into a full study workspace instead of giving only a simple summary.

The website can:
- accept a lecture as an uploaded audio or video file
- record a live lecture from the browser
- read a YouTube or public video link
- accept lecture notes, slide files, and past question papers
- transcribe lecture audio into text
- combine all uploaded sources into one study pack
- generate a study guide, formulas, worked examples, flashcards, a test, a PowerPoint, a podcast, and AI chat help
- save the work to the user's account history
- let students collaborate in shared study rooms
- provide an admin dashboard for managing users and platform activity

## Main user flow

1. The user signs in and chooses the output language.
2. The user goes to the Capture Lecture page.
3. The user uploads or records the lecture, and can also add notes, slides, and past papers.
4. The website transcribes the lecture and builds a study guide.
5. The user opens the Study Workspace and switches between study tools.
6. The user can save, download, reopen, or share the generated study pack.

## Where the features are in the website

### 1. Landing and sign-in

This is the first screen a user sees.

Features on this page:
- output language selection for generated content
- email-based sign-in
- email and password sign-in
- Google sign-in
- Apple sign-in
- admin mode selection for admin accounts

Purpose:
- lets the user enter the platform
- stores the session so the user can continue working later

### 2. Capture Lecture page

This is the main input page of the website.

Features on this page:
- upload audio or video lecture files
- upload a mixed bundle of lecture files and let the app sort them automatically
- record a live lecture from the browser
- include microphone audio
- include shared tab or system audio when the browser supports it
- paste a YouTube or public video link for transcription
- upload lecture notes
- upload lecture slides
- upload past question papers
- paste a memo or marking guide for past papers
- see processing status, progress bars, and error messages
- open Help and About
- open Support and Contact

Purpose:
- gathers all study sources before generation starts
- prepares the raw material that the AI tools use later

### 3. Study Workspace

This is the main revision area of the website. After the lecture has been processed, the user moves here and chooses a tool tab.

Main tabs and features:

#### Study Guide
- shows the main AI-generated study guide
- organizes the topic into readable sections
- can show visual learning cards and study images when useful
- includes Teacher Mode

Teacher Mode inside the Study Guide:
- builds a spoken lesson from the guide
- plays a longer walkthrough of the topic
- lets the user pause, resume, and stop
- lets the user ask a spoken question while the lesson is playing
- answers the question and then returns to the lesson

#### Transcript
- shows the full lecture transcript after transcription

#### Formulas
- extracts and formats formula-related content from the guide

#### Worked Examples
- shows step-by-step example sections from the study guide

#### Flashcards
- shows revision flashcards generated from the lecture

#### Test
- generates a quiz from the lecture material
- supports timed test sessions
- supports marking and feedback
- supports written answers
- supports multiple-choice style questions
- supports image uploads for answers
- can use past papers and marking guides as extra references

#### PowerPoint Presentation
- generates a lecture presentation from the study material
- lets the user choose from multiple presentation styles
- supports uploading a custom PowerPoint template
- shows generation progress
- includes a built-in slide viewer
- allows PowerPoint download

#### Podcast Generator
- turns the lecture into a spoken debate or discussion
- supports 2 or 3 speakers
- lets the user choose a target duration
- generates a script and audio
- allows MP3 download

#### Study Chat
- lets the user ask questions about the lecture
- answers based on the generated study context
- supports image attachments for reference

#### Workspace actions
- copy the current section
- download the current section as PDF
- download the full study pack as PDF
- download the test as PDF
- download the PowerPoint file
- download the podcast audio
- share the current tool into collaboration

### 4. My Materials

This page is the saved history area for the signed-in user.

Features on this page:
- shows saved lecture workspaces
- reopens an older study pack
- downloads a saved study pack PDF
- downloads a saved test PDF
- removes a saved item
- clears all saved history

Purpose:
- gives the user a library of previous study packs without rebuilding them from scratch

### 5. Collaboration

This is the group study area of the website.

Features on this page:
- create a collaboration room
- invite members by email
- choose private or shared test-answer visibility
- open existing rooms
- share the current study tool into the room
- follow the room's active shared tool
- write shared notes
- send room chat messages
- compare answers when the room is in shared-answer mode

Purpose:
- lets students revise the same lecture together
- keeps the room centered on one shared study pack

### 6. Help and About

This page explains how the website works in plain language.

It includes:
- accepted file types
- the student workflow
- quality checks for good study output
- advice on combining lecture recordings, notes, slides, and past papers
- guidance on when study photos should appear

### 7. Support and Contact

This page lets a user send a complaint, bug report, or support request.

It is used for:
- reporting problems
- describing what the user expected to happen
- explaining which page, browser, or device was being used

### 8. Admin Dashboard

This area is only for admin users.

Features in the admin dashboard:
- platform overview cards
- user analytics
- session analytics
- feature usage statistics
- saved content and storage insights
- AI generation metrics
- activity logs and audit trails
- system health monitoring
- security alerts
- user suspension and reactivation
- force logout for users
- settings and feature-flag visibility

Purpose:
- helps admins manage users, monitor system health, and review platform usage

## Inputs the website accepts

The website supports:
- audio files
- video files
- YouTube or public video URLs
- images
- TXT files
- Markdown files
- PDF files
- DOCX files
- PPTX files

These can be used as:
- lecture media
- lecture notes
- lecture slides
- past papers
- marking guides or memos

## Outputs the website creates

The website can produce:
- a lecture transcript
- a study guide
- formulas
- worked examples
- flashcards
- a test with feedback
- a teacher-mode lesson
- a PowerPoint presentation
- a podcast with audio
- chat answers based on the lecture
- PDF exports

## What happens behind the scenes

Behind the user interface, the website:
- transcribes uploaded or linked lecture audio
- reads text from PDFs, PowerPoint files, Word files, and images
- combines the transcript, notes, slides, and past papers into one context
- uses AI to generate different study tools from the same lecture
- stores user sessions and study history
- stores collaboration rooms, room messages, and shared notes
- stores support requests and admin activity logs

## Where the main code is

The main code is concentrated in a few places:

- `frontend/src/App.jsx`
  This file contains most of the website interface, page switching, state management, workspace tools, collaboration UI, downloads, and admin dashboard screens.

- `backend/main.py`
  This file contains the backend API, authentication, transcription jobs, study-guide generation, quiz marking, presentation generation, podcast generation, collaboration endpoints, support handling, history sync, and admin data logic.

- `frontend/src/App.css` and `frontend/src/index.css`
  These files contain the visual styling for the frontend.

- `render.yaml`
  This file contains deployment configuration for the project.

## Short summary

Mabaso AI is a full lecture-to-study platform. Its biggest strength is that one lecture can become many tools at the same time: transcript, study guide, formulas, examples, flashcards, test, podcast, presentation, chat help, saved history, and collaboration rooms.
