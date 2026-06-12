import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/api';
import './App.css';

function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [timetable, setTimetable] = useState({ sessions: [] });
  const [lastSaved, setLastSaved] = useState(null);
  const [message, setMessage] = useState('');

  // simulate auth-ready gating; in real app hook into auth provider
  useEffect(() => {
    // placeholder: assume auth becomes ready quickly
    const t = setTimeout(() => setIsAuthReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isAuthReady) return; // safe guard
    loadTimetable();
  }, [isAuthReady]);

  async function loadTimetable() {
    try {
      const data = await apiFetch('/api/timetable');
      setTimetable(data || { sessions: [] });
      setLastSaved(data && data.last_saved);
      setMessage('Loaded timetable');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      console.error('Failed to load timetable', err);
      setMessage('Failed to load timetable');
    }
  }

  async function handleRefresh() {
    try {
      // use cache-bust so dev proxies/origins revalidate
      const data = await apiFetch('/api/timetable?admin=1', { method: 'GET', cacheBust: true });
      setTimetable(data || { sessions: [] });
      setLastSaved(data && data.last_saved);
      setMessage('Updated');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      console.error('Refresh failed', err);
      setMessage('Refresh failed');
    }
  }

  async function markDone(sessionId, done) {
    try {
      await apiFetch(`/api/timetable/session/${sessionId}/status`, { method: 'POST', body: JSON.stringify({ done }) });
      // authoritative reload
      loadTimetable();
      setMessage(done ? 'Session marked done' : 'Session status saved');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      console.error('Failed to mark session', err);
      setMessage('Failed to save session');
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>MABASO Timetable (Admin)</h1>
        <div className="controls">
          <button onClick={handleRefresh} disabled={!isAuthReady}>Refresh</button>
          <span className="last-saved">Last saved: {lastSaved || 'never'}</span>
        </div>
        <div className="message">{message}</div>
      </header>

      <main>
        <ul>
          {(timetable.sessions || []).map((s, i) => (
            <li key={s.id || i} className={`session ${s.done ? 'done' : ''}`}>
              <div className="session-info">
                <strong>{s.subject || s.id}</strong>
                <span className="cat">{s.category}</span>
              </div>
              <div className="session-actions">
                <button onClick={() => markDone(s.id, !s.done)}>{s.done ? 'Undo' : 'Mark done'}</button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

export default App;
