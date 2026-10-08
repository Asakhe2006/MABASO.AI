# Mabaso AI Admin Diagnostics and Refund Requests Guide

This guide describes the controls available only to authorised Mabaso AI administrators. Diagnostics reads the same account, entitlement, quota, billing, PayFast, authentication, and generation records used by the application. It does not provide a manual plan override and never displays payment credentials, complete provider tokens, cookies, passwords, or API secrets.

## Diagnostics navigation

### Refresh diagnostics

Reloads the current system summary, issue counts, health checks, and recent diagnostic events. It does not change a user account. Use it after a deployment, webhook, recovery, or provider operation when you need the newest persisted state.

### User Inspector

Searches accounts by the identifiers supported by the backend, then opens one authoritative user snapshot. Selecting a user loads their account status, effective entitlement, trial and subscription state, quota profile, payment records, refund records, authentication sessions, and generation jobs. The inspector deliberately reads server records instead of trusting browser state.

### Recalculate entitlement

Runs the normal Mabaso AI entitlement resolver again for the selected user. It does not force a plan and does not edit PayFast. Use it to confirm whether an active paid subscription, active verified trial, or Free fallback is currently winning the normal precedence rules.

### User Timeline

Shows meaningful account events in newest-first order, including authentication, billing, trial, quota, generation, notification, error, and admin actions. Request and trace IDs connect related events without storing full AI responses or secrets.

### Entitlement Trace

Explains each decision checked by the normal entitlement resolver. A matched paid Expert or Pro subscription takes precedence over a trial; an active verified trial takes precedence over Free. This view diagnoses decisions but does not change them.

### Trial Trace

Lists trial eligibility, the minimum account activity requirement, permanent trial-use evidence, start/end dates, PayFast state, and effective access. Selecting an account opens its checkout and entitlement evidence. A permanent claim helps prevent the same identity or verified payment method from receiving another promotional trial.

### Quota Trace

Shows the server-selected quota profile and recorded usage for each capability. It helps explain allowed or blocked requests. Changing a browser value cannot change these counters because enforcement occurs on the backend.

### Payments & Refunds

Displays payment and refund records for the selected user. Payment trace shows the stored provider status and safe reference. Refund trace shows request status and customer-safe provider failures. Refund decisions are performed in the separate Refund Requests page.

### Recover missed PayFast confirmation

Use this fallback only when PayFast has a real subscription but Mabaso AI missed its confirmation. The field accepts either a real PayFast subscription token or a `mabaso-...` checkout reference.

- A subscription token is validated with PayFast, matched to the selected user and expected plan, and checked for an active status, correct recurring amount, no completed charge for a trial, and a future first billing date.
- A checkout reference first searches Mabaso AI's owned checkout and verified-event records. It is never sent to a PayFast token endpoint. Recovery continues only if an authoritative saved event supplies a real subscription token, which is then verified normally.
- Running recovery more than once returns an already-confirmed result and does not create another subscription, payment, trial, or history event.
- A missing token, customer mismatch, already-used different trial, provider error, or insufficient confirmation leaves access unchanged.

Every attempt creates a safe admin audit entry containing the actor, target user, identifier type, checkout reference where relevant, result, and time. Raw subscription tokens are omitted.

### Authentication

Shows safe session metadata such as login time, last activity, location summary, and session status. It never shows session cookies, bearer tokens, refresh tokens, passwords, or OAuth credentials.

### Background Jobs

Shows persisted generation operations and their current activity/status. Use it to diagnose work that is queued, generating, completed, or failed without logging generated response bodies.

### API Errors & Traces

Shows sanitised warnings and errors with request or trace IDs. It is intended for locating a failing request while keeping stack traces and secrets out of the normal admin interface.

### System & Deployment

Shows backend and database health, latency, safe configuration presence, deployment identifiers, the generated PayFast notification URL, and checkouts waiting unusually long for confirmation. Selecting a PayFast issue opens the affected user trace.

## Refund Requests controls

### Status filters

Pending shows requests needing attention. Under review shows requests an administrator opened. Processing shows requests submitted to PayFast but not yet finally confirmed. Refunded shows provider-confirmed outcomes. Rejected shows admin decisions not to refund. Failed shows genuine provider attempts that failed. All combines every state. Counts come from stored refund records rather than placeholders.

### Refresh requests

Reloads the selected status and counts. It never submits or retries a refund.

### Search

Filters the already authorised list by customer, payment, plan, reason, safe provider reference, or status. It cannot search or expose normal users outside the admin endpoint.

### View details

Loads the original trusted payment, request amount, purchase country, policy window, usage since payment, safe payment method, provider state, notification state, admin notes, and append-only audit history. Opening a pending request records it as under review.

### Approve refund

Opens a confirmation dialog showing the trusted customer, plan, original payment, refund amount, and provider. Confirmation asks the backend to re-load the request and payment, validate ownership and amount, check PayFast eligibility, prevent duplicate processing, and submit the real refund. The UI shows Refunded only after the provider result supports it.

### Reject refund

Requires a structured reason and, for Other, an admin note. It records the decision and customer notification without exposing internal fraud or risk signals. Rejection does not call the provider refund operation.

### Retry refund

Appears only for a failed provider attempt. The backend queries the latest provider state and retries only when doing so is safe. It is not a generic repeat button and cannot be used to refund twice.

### Refresh PayFast status

Appears while a submitted refund is processing or provider-accepted. It queries the provider state and updates the local record; it does not create another refund request.

### Retry admin email

Appears only when the stored administrator-notification delivery failed. It retries that notification independently. The original refund request remains stored even when email delivery fails.

### Confirmation-dialog Cancel

Closes the dialog without changing the request or contacting PayFast.

## Operational safety

Automatic refund approval remains disabled. All approval, rejection, retry, recovery, and review events are audited. Administrators cannot enter an arbitrary customer, PayFast payment ID, or refund amount in the action request; the backend resolves those values from trusted records. Financial records are retained separately from short-lived diagnostic events.
