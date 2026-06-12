// small helper to persist session status
import { apiFetch } from '../lib/api';

export async function persistSessionStatus(sessionId, done) {
  return apiFetch(`/api/timetable/session/${sessionId}/status`, {
    method: 'POST',
    body: JSON.stringify({ done }),
  });
}
