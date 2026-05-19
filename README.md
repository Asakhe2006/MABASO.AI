# MABASO AI

Live site: https://mabaso-ai-web.onrender.com/

Mabaso AI is a study workspace for lecture capture, transcripts, study guides, tests, collaboration, and a secure lecture conversation assistant.

## Stack

- Frontend: React + Vite + Tailwind-style utility classes
- Backend: FastAPI
- Database: SQLite
- Deployment: Render

## Lecture Assistant

The lecture assistant now uses secure backend streaming and never exposes provider API keys in the browser.

Flow:

`Browser UI -> Mabaso backend -> Gemini / Groq / OpenRouter -> streamed reply`

Endpoints:

- `POST /api/chat/stream`
- `POST /api/chat/gemini`
- `POST /api/chat/groq`
- `POST /api/chat/openrouter`

Provider order:

1. Gemini `gemini-2.5-flash`
2. Groq `llama-3.3-70b-versatile`
3. OpenRouter `deepseek/deepseek-chat`

## Local Setup

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend default local URL: `http://localhost:5173`  
Backend default local URL: `http://127.0.0.1:8000`

## Environment

Copy `.env.example` into your real environment setup and fill in the keys you need.

Important assistant variables:

- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `GEMINI_CHAT_MODEL`
- `GROQ_CHAT_MODEL`
- `OPENROUTER_CHAT_MODEL`
- `LECTURE_ASSISTANT_SYSTEM_PROMPT`

## Notes

- The floating lecture assistant stores conversation history in browser `localStorage` per signed-in user.
- Voice input uses the browser speech recognition API.
- Optional voice reply playback uses browser text-to-speech.
- Admin dashboard range controls support `1 day`, `7 days`, `1 month`, and `1 year`.
