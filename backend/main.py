from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import logging
import time
from typing import Optional
from datetime import datetime
from backend import timetable_generator

logger = logging.getLogger("mabaso.backend")
logging.basicConfig(level=logging.INFO)

DB_PATH = "./backend/db.sqlite"

app = FastAPI()

# CORS configuration - allow our frontend origin and localhost for dev
origins = [
    "https://mabaso-ai-web.onrender.com",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Minimal DB helpers (sqlite)
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # migrations should create tables; just ensure file exists
    conn.commit()
    conn.close()

def get_db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

class TimetableIn(BaseModel):
    name: str
    sessions: list

class SessionStatusIn(BaseModel):
    done: bool

@app.on_event("startup")
def startup_event():
    init_db()
    logger.info("Backend startup complete")

# Admin diagnostics route
@app.get("/admin/diagnostics")
def admin_diagnostics():
    conn = get_db_conn()
    c = conn.cursor()
    try:
        c.execute("SELECT MAX(last_saved) as last_saved FROM timetables")
        timetables_last = c.fetchone()[0]
        c.execute("SELECT MAX(updated_at) as updated_at FROM timetable_sessions")
        sessions_last = c.fetchone()[0]
    except Exception as e:
        logger.warning("Diagnostics DB check failed: %s", e)
        timetables_last = None
        sessions_last = None
    finally:
        conn.close()

    logger.info("Admin diagnostics requested - timetables_last=%s sessions_last=%s", timetables_last, sessions_last)
    return {"timetables_last": timetables_last, "timetable_sessions_last": sessions_last}

# Create timetable
@app.post("/api/timetable")
def create_timetable(payload: TimetableIn):
    conn = get_db_conn()
    c = conn.cursor()
    now = datetime.utcnow().isoformat()
    c.execute(
        "INSERT INTO timetables (name, data, last_saved) VALUES (?, ?, ?)",
        (payload.name, str(payload.sessions), now),
    )
    timetable_id = c.lastrowid
    conn.commit()
    conn.close()
    logger.info("Timetable '%s' saved id=%s last_saved=%s", payload.name, timetable_id, now)
    return {"id": timetable_id, "last_saved": now}

# Get timetable (latest)
@app.get("/api/timetable")
def get_timetable():
    conn = get_db_conn()
    c = conn.cursor()
    c.execute("SELECT id, name, data, last_saved FROM timetables ORDER BY last_saved DESC LIMIT 1")
    row = c.fetchone()
    conn.close()
    if not row:
        return {"id": None, "name": None, "sessions": []}
    logger.info("Timetable served id=%s last_saved=%s", row[0], row[3])
    return {"id": row[0], "name": row[1], "sessions": row[2], "last_saved": row[3]}

# Persist session status
@app.post("/api/timetable/session/{session_id}/status")
def set_session_status(session_id: int, payload: SessionStatusIn):
    conn = get_db_conn()
    c = conn.cursor()
    now = datetime.utcnow().isoformat()
    c.execute(
        "UPDATE timetable_sessions SET done = ?, updated_at = ? WHERE id = ?",
        (1 if payload.done else 0, now, session_id),
    )
    if c.rowcount == 0:
        # create a row if missing
        c.execute(
            "INSERT INTO timetable_sessions (id, done, updated_at) VALUES (?, ?, ?)",
            (session_id, 1 if payload.done else 0, now),
        )
    conn.commit()
    conn.close()
    logger.info("Session status updated id=%s done=%s at=%s", session_id, payload.done, now)
    return {"id": session_id, "done": payload.done, "updated_at": now}

# Optional generator API
@app.post("/api/timetable/generate")
def generate_timetable(params: Optional[dict] = None):
    # params can include desired slots, subject priorities, etc.
    params = params or {}
    generated, diagnostics = timetable_generator.generate(params)
    # save as a new timetable
    conn = get_db_conn()
    c = conn.cursor()
    now = datetime.utcnow().isoformat()
    c.execute("INSERT INTO timetables (name, data, last_saved) VALUES (?, ?, ?)", ("generated", str(generated), now))
    conn.commit()
    conn.close()
    logger.info("Generated timetable saved last_saved=%s diagnostics=%s", now, diagnostics)
    return {"timetable": generated, "diagnostics": diagnostics, "last_saved": now}
