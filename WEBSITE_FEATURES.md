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


I have expanded your description into a more advanced **ChatGPT-style platform specification** that includes the features you previously requested: Copilot-style AI, realtime voice, mobile-first workspace, Word-like editing/highlighting, AI memory, subscriptions, security, analytics, South African language support, future AI training capabilities, and a larger platform vision.

You can use this as a master document for your Codex `AGENTS.md`, project documentation, or development roadmap.

---

# Mabaso AI — Advanced AI Study Platform Specification

## Platform Vision

Mabaso AI is an advanced AI-powered education platform that transforms lectures, learning materials, and academic content into a complete intelligent study environment.

Instead of only summarising information, Mabaso AI works like a combination of:

* ChatGPT for academic conversations
* Microsoft Copilot for teaching assistance
* Notion for organised study notes
* Quizlet for revision
* PowerPoint AI for presentations
* Podcast AI for audio learning
* Google Drive-style storage for student materials

The goal is to create a complete AI study companion that follows the student throughout their academic journey.

---

# Core Platform Capabilities

Mabaso AI can:

* upload lecture audio and video files
* record live classroom lectures
* capture microphone input
* capture browser tab audio when supported
* capture system audio when supported
* process YouTube/public lecture links
* process lecture notes
* process PowerPoint slides
* process PDF textbooks
* process DOCX documents
* process images of handwritten notes
* process past exam papers
* process marking guides/memos

The AI combines all sources into one intelligent study knowledge base.

The student does not study isolated files.

The AI understands the complete lecture context.

---

# AI Knowledge Processing System

Behind the platform:

The AI pipeline should:

1. Receive uploaded material.

2. Extract information from:

* audio transcription
* PDF text
* PowerPoint slides
* Word documents
* images
* handwritten notes
* previous exam papers

3. Combine information into one academic knowledge base.

4. Identify:

* important concepts
* definitions
* formulas
* examples
* repeated exam topics
* lecturer emphasis
* missing explanations
* difficult concepts

5. Generate personalised study resources.

---

# User Authentication System

## Sign-In Options

Users can access Mabaso AI using:

* email and password
* Google login
* Apple login

The platform must support:

* secure sessions
* persistent login
* logout
* account recovery
* profile management

---

# Language Intelligence System

Mabaso AI should support multiple output languages.

Initial languages:

* English
* isiZulu
* isiXhosa
* Sesotho
* Setswana
* Afrikaans

Future expansion:

* all South African languages
* international languages

The AI should maintain:

* academic accuracy
* correct technical terminology
* natural explanations

Example:

A student can upload an engineering lecture in English and request:

"Explain this in isiZulu but keep formulas and technical terms unchanged."

---

# Main User Journey

## Step 1 — Account Creation

Student:

* creates account
* selects preferred language
* chooses academic level
* chooses institution/course information

The system personalises future responses.

---

# Step 2 — Capture Lecture Workspace

This is the entry point for learning.

Students can:

## Upload

* audio
* video
* PDF
* DOCX
* PPTX
* TXT
* Markdown
* images

## Record

Browser recording:

* microphone
* classroom lecture
* online lecture
* browser audio

## Import

* YouTube lecture
* public educational videos

---

# Processing Experience

The platform should show:

* upload progress
* transcription progress
* AI processing stages
* estimated completion time

Example:

```
Uploading lecture...
✓ Audio extracted

Transcribing...
✓ 45 minutes processed

Understanding concepts...
✓ 120 concepts identified

Creating study workspace...
✓ Complete
```

---

# Study Workspace

The Study Workspace is the main learning environment.

It should feel similar to ChatGPT:

* clean interface
* large reading area
* minimal distractions
* smooth animations
* conversation-style interactions

---

# Study Guide System

The AI creates a structured study guide.

It should include:

## Automatic Structure

* topic overview
* learning objectives
* definitions
* explanations
* examples
* common mistakes
* exam tips
* summary points

---

# Advanced Study Guide Editor

The study guide should behave like Microsoft Word.

Features:

## Edit Mode

Users can:

* edit generated text
* rewrite sections
* add personal notes
* correct information

## Highlight Mode

The highlighter should work like Word:

Features:

* highlight text
* select colours
* permanent saving
* autosave
* refresh persistence
* erase highlights

Highlight data must be stored with the study guide.

Example:

```
Student highlights:
"Newton's Second Law"

Colour:
Yellow

Saved:
Database
```

---

# Study Guide Actions

Each section should have:

* copy icon
* download icon
* regenerate icon
* edit icon
* highlight icon

Icons should match ChatGPT style.

---

# Mobile Study Experience

Mobile should behave like ChatGPT mobile.

Requirements:

## Fixed Header

Always visible:

* sidebar button
* search button
* profile button
* back button when needed

Scrolling should only move content.

---

## Mobile Sidebar

Should:

* slide from side
* occupy around quarter/half screen
* not cover everything
* behave like ChatGPT sidebar

---

## Mobile Workspace

Requirements:

* no unnecessary borders
* no squeezed content
* ChatGPT-like font size
* proper spacing
* readable paragraphs
* images placed naturally

---

# AI Teacher Mode

A major Mabaso AI feature.

Teacher Mode converts the study guide into a personal AI teacher.

Capabilities:

## Voice Teaching

The AI can:

* explain lessons aloud
* pause
* continue
* repeat explanations
* simplify concepts

---

## Voice Conversation

Similar to ChatGPT Voice.

Student:

"Explain this formula."

AI:

"Let me explain step by step..."

Features:

* microphone button
* speech recognition
* voice streaming
* interruption handling
* natural conversation

---

# AI Study Chat

ChatGPT-style academic assistant.

Capabilities:

* answer questions
* explain difficult concepts
* use uploaded lecture context
* analyse images
* solve questions
* explain mistakes

Supports:

* text input
* voice input
* image upload

---

# Transcript Workspace

Provides:

* complete lecture transcript
* timestamps
* search
* copy sections
* highlight important parts

---

# Formula Generator

Extracts:

* equations
* symbols
* definitions
* variable meanings
* examples

---

# Worked Examples

Creates:

* step-by-step solutions
* explanations
* common mistakes
* alternative methods

---

# Flashcards

AI creates:

* question cards
* answer cards
* difficulty levels
* spaced repetition

Future:

AI automatically schedules revision.

---

# AI Testing System

The testing engine supports:

## Question Types

* multiple choice
* written answers
* calculations
* diagrams
* image answers

## Features

* timed exams
* automatic marking
* explanations
* performance analytics

Uses:

* lecture content
* past papers
* marking guides

---

# AI PowerPoint Generator

Creates professional presentations.

Features:

* multiple themes
* custom templates
* university style
* business style
* lecturer style

Supports:

* uploaded PowerPoint templates
* slide preview
* editing
* downloading

---

# AI Podcast Generator

Transforms lectures into audio discussions.

Options:

* two speakers
* three speakers
* interview style
* debate style
* teaching style

Controls:

* duration
* difficulty level
* language

Output:

* script
* audio file

---

# My Materials Library

Student cloud storage.

Contains:

* previous lectures
* study guides
* tests
* presentations
* podcasts

Functions:

* reopen
* download
* delete
* search

---

# Collaboration Rooms

Students can study together.

Features:

## Rooms

* private rooms
* public rooms
* university groups

## Collaboration

* shared notes
* shared chat
* shared tests
* answer comparison
* shared study guide

---

# Smart Study Planner

Future advanced feature.

AI creates study plans using:

* exams
* deadlines
* available time
* difficulty

Features:

* automatic rescheduling
* missed-work recovery
* progress tracking
* motivation messages

---

# AI Memory System

Future ChatGPT-style memory.

The AI remembers:

* preferred language
* learning style
* previous mistakes
* weak topics
* favourite explanations

Example:

"Explain physics like you explained circuits last week."

---

# Subscription Platform

Plans:

## Free

Includes:

* limited generations
* basic chat
* limited storage

## Premium

Includes:

* unlimited study tools
* voice teacher
* more storage
* advanced AI models

## Institution

Includes:

* universities
* lecturers
* departments

---

# Payment System

Supports:

* PayFast
* PayShap
* subscription verification

Security:

* prevent subscription abuse
* monitor suspicious accounts
* track usage

---

# Admin Dashboard

Admin controls:

## User Management

* view users
* suspend users
* reactivate users
* force logout

## Analytics

Track:

* active users
* generated study guides
* tests created
* storage usage
* AI usage

## Security

Monitor:

* suspicious activity
* duplicate accounts
* subscription abuse
* failed payments

---

# System Architecture

## Frontend

Main files:

```
frontend/src/App.jsx
frontend/src/App.css
frontend/src/index.css
```

Responsibilities:

* interface
* routing
* workspace
* UI states
* downloads
* collaboration
* admin screens

---

## Backend

Main file:

```
backend/main.py
```

Responsibilities:

* authentication
* AI generation
* transcription
* file processing
* database operations
* collaboration APIs
* subscriptions
* admin APIs

---

# Future AI Expansion

Mabaso AI can become a complete education ecosystem.

Future features:

## AI Tutor Avatar

A visual AI teacher.

## Student Result Prediction

AI analyses:

* tests
* assignments
* study behaviour

Predicts:

* academic performance
* improvement areas

## University Assistant

Helps students:

* apply to universities
* understand requirements
* choose courses
* compare programs

## Lecturer Platform

Teachers can:

* upload courses
* generate materials
* create exams
* analyse class performance

---

# Final Product Vision

Mabaso AI is not only a study summariser.

It is an AI education platform where:

One lecture becomes:

* transcript
* study guide
* formulas
* examples
* flashcards
* tests
* presentations
* podcasts
* AI conversations
* personalised teaching

The platform should continuously evolve toward becoming a complete AI learning companion for students worldwide.
