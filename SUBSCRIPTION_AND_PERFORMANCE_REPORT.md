# MABASO.AI Subscription And Performance Report

## Fair Subscription Plan

The subscription model should protect students from accidental spending while still giving the platform room to pay for AI, storage, transcription, and export costs.

### Recommended Plans

| Plan | Target user | What to include | User-protection rule |
| --- | --- | --- | --- |
| Free Study | New and light users | Small monthly credits, limited exports, basic study tools | No card required |
| Student Plus | Regular students | Higher credits, reports, quizzes, mind maps, PDF/DOCX exports | Overages off by default |
| Pro Research | Heavy academic users | Large files, priority queue, advanced reports, presentations | Hard monthly spend cap |
| Team / Institution | Tutors, schools, departments | Shared seats, pooled credits, admin controls, audit logs | Invoice approval before billing |

### Anti-Ripoff Requirements

- Show exact included credits before checkout.
- Show a live usage meter inside the account and admin views.
- Warn users at 50%, 80%, and 100% usage.
- Keep paid overages disabled unless the user explicitly enables them.
- Make cancellation and downgrade controls visible.
- Never show guessed billing numbers when backend billing data is unavailable.
- Add a short refund or renewal-grace policy for accidental renewals.

## Performance Audit

### Components Causing Most Render Risk

- `frontend/src/App.jsx`: one very large stateful component; every high-frequency state update can re-render the full workspace.
- Quiz timer: previously depended on a freshly recreated `markQuiz` function, causing the interval effect to reset every render while the test was active.
- Collaboration polling: refreshed every few seconds for authenticated users even when the collaboration screen was not visible.
- Teacher transcript auto-scroll: smooth-scrolled on every transcript append and could fight manual reading.

### Memory Leak Risks

- Event listeners are mostly cleaned up correctly.
- Intervals and timeouts generally have cleanup, but high-frequency effects must avoid unstable dependencies.
- Voice, recording, and realtime teacher flows are the highest-risk areas because they use streams, timers, and browser APIs together.

### Animation Bottlenecks

- The active study-guide section used an infinite focus-pulse animation.
- Shimmer animations are still present for progress bars but now respect `prefers-reduced-motion`.
- Framer Motion usage in the public site is entrance-based, not an obvious infinite loop.

### Scroll Bottlenecks

- The workspace tool tabs use horizontal scrolling inside a vertical page.
- Touch scrolling is now isolated with a stable horizontal scroll class to reduce touch gesture conflicts.
- Auto-scroll now only runs when the transcript viewer is already near the bottom.

## Fixes Applied

- Stabilized the quiz countdown with a `markQuizRef` and avoided redundant state updates.
- Scoped collaboration polling to visible collaboration screens only.
- Prevented hidden-tab visibility events from triggering session refresh work.
- Converted teacher transcript auto-scroll from forced smooth scrolling to conditional bottom-follow behavior.
- Added stable horizontal touch scrolling for the workspace tab strip.
- Reduced the active study-guide pulse from infinite to one-shot.
- Added reduced-motion CSS safeguards.
- Added an admin billing plan that does not invent revenue or usage metrics.

## Recommended Next Additions

- Backend billing tables for plans, subscriptions, credit grants, credit usage, invoices, refunds, and audit logs.
- Stripe or Paystack integration with webhooks and idempotency keys.
- Per-tool cost accounting so users see what reports, mind maps, uploads, and exports consume.
- Account page with plan, credits remaining, next renewal date, cancellation, and spend cap controls.
- Admin billing dashboard fed only from real backend metrics.
