-- Migration: create timetables and timetable_sessions

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS timetables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  data TEXT,
  last_saved TEXT
);

CREATE TABLE IF NOT EXISTS timetable_sessions (
  id INTEGER PRIMARY KEY,
  timetable_id INTEGER,
  session_index INTEGER,
  subject TEXT,
  category TEXT,
  done INTEGER DEFAULT 0,
  updated_at TEXT,
  FOREIGN KEY(timetable_id) REFERENCES timetables(id)
);
