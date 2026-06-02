# MABASO.AI Voice Assistant Performance Audit

## Summary

The main risk was not only model speed. The chat already renders an optimistic assistant message, but server synchronization and blocking persistence could delay completion and make messages appear unstable. The fix prioritizes `Generate -> Render -> Save -> Sync`.

## Fixes Applied

- Added one-provider-per-voice-session locking in the frontend.
- Added `preferred_provider` to backend chat requests.
- Changed voice provider retries to retry the same provider instead of switching providers mid-session.
- Moved conversation persistence after the `done` event so database writes no longer block visible responses.
- Added background persistence audit logging for database save latency.
- Added frontend trace IDs, duplicate request detection, and per-turn latency metrics.
- Preserved optimistic local messages during server sync when the server returns conversation metadata without messages.
- Added a compact latency readout in the assistant panel.

## Slowest API Calls To Watch

| Area | Expected risk | Current mitigation |
| --- | --- | --- |
| AI provider stream | Network and provider latency | First token and generation metrics added |
| Voice transcription | Audio upload and speech model time | Speech-to-text latency metric added |
| Conversation persistence | Supabase writes, title generation, memory summary | Persistence moved to background |
| Conversation list sync | Server sync can merge over local state | Local streamed messages are preserved |

## Slowest Frontend Operations To Watch

- Large assistant message lists rendering markdown repeatedly.
- Voice transcript updates while recording.
- Speech synthesis chunk queue while streaming text.
- Conversation list hydration after server sync.

## State Synchronization Issues

- Risk: server conversation metadata can arrive before messages and overwrite local rendered turns.
- Fix: local messages with matching trace/client request IDs remain preserved during merge.
- Risk: duplicate send clicks or voice restarts can create competing turns.
- Fix: duplicate request fingerprints are blocked for a short window.

## Database Bottlenecks

- Conversation persistence inserts user and assistant messages, fetches recent messages, fetches up to 80 messages, generates/updates memory summary, and updates the conversation.
- This is now background work after the response is visible.
- Database latency is logged through `lecture_assistant.persist` audit entries.

## Voice Provider Bottlenecks

- Provider switching during voice mode can create slow, inconsistent sessions.
- Voice mode now locks to one provider and retries that provider.
- Text mode remains OpenAI-only.

## Recommendations Ranked By Impact

1. Add backend dashboards for `lecture_assistant.chat` and `lecture_assistant.persist` audit durations.
2. Add persistent per-user voice provider preference when users manually choose a provider.
3. Code-split the assistant panel and markdown renderer to reduce initial bundle size.
4. Add server-side idempotency lookup for repeated `client_request_id` values.
5. Add a warm endpoint ping from deployment scheduler for voice transcription and chat providers.
6. Move conversation title generation to a separate background job so persistence is even lighter.

## Targets

- Text visible within 2 seconds when provider first-token latency allows it.
- Voice playback starts within 3–4 seconds after speech-to-text and first text chunks.
- No disappearing messages after server sync.
- Stable provider behavior during voice sessions.
