# Agent Platform HTTP contract

The browser calls only StreamSphere. Our backend adds the signed-in application's user identity from its database session and configured tenant credentials. Client-provided user/tenant IDs, amounts, or subscription status cannot override database values. Translate your existing API protocol in `server/agent.mjs` if necessary. See `docs/authentication.md` for registration setup.

## Browser endpoints

| Method/path | Request | Result |
| --- | --- | --- |
| `GET /api/account` | — | `{ "account": { ... } }` |
| `GET /api/chat?session_id=<uuid>` | — | `{ "messages": [...] }`, newest 100, chronological |
| `POST /api/chat` | `{ "session_id": "<uuid>", "message": "..." }` | Message/account |
| `POST /api/chat/consent` | `{ "session_id": "<uuid>", "consent_id": "<uuid>", "approved": true }` | Message/account, or history/account on completed replay |
| `POST /api/subscription/purchase` | `{}` | Account, spends demo wallet credit |
| `GET /api/health` | — | Process health and agent configuration flag |

POST uses `Content-Type: application/json` and `X-StreamSphere-Client: web`. Browser Origin must match `APP_ORIGIN`. Account, chat and purchase APIs require a verified Auth session in backend-managed HttpOnly cookies. Authentication endpoints are documented in `docs/authentication.md`. A tab UUID is kept in sessionStorage and reset at sign-in/sign-out. Conversations persist per account in Supabase. **Your platform must retain conversation context by user_id and session_id.** The UUIDs below are illustrative; actual requests contain the signed-in Auth user ID and their linked database account ID.

## Backend → platform chat

`POST <AGENT_CHAT_URL>` with:

```http
Authorization: Bearer <AGENT_API_KEY>
X-Tenant-Id: <AGENT_TENANT_ID>
Content-Type: application/json
```

```json
{
  "session_id": "browser-tab-session-uuid",
  "user_id": "11111111-1111-4111-8111-111111111111",
  "message": "I forgot to cancel and was charged today. Can I get a refund?",
  "account": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Alex Morgan",
    "email": "alex@example.com",
    "subscription_status": "active",
    "plan": "premium",
    "price_cents": 1599,
    "wallet_cents": 0,
    "charged_at": "<seed timestamp>",
    "billing_timezone": "Asia/Colombo"
  }
}
```

The actual payload includes the full database account, including update/cancellation timestamps. On your platform authenticate tenant identity from the credential.

Ordinary response: `{ "reply": "How can I help?" }`.

Consent-required response:

```json
{
  "reply": "I can cancel Premium and refund today's $15.99 charge to your wallet. This refund is only available today, and Premium access ends immediately. Do you want to proceed?",
  "consent": {
    "token": "opaque-upstream-resume-token",
    "execution_id": "your-execution-id",
    "action": "cancel_and_refund",
    "refund_amount_cents": 1599
  }
}
```

For an older charge use `action: "cancel_subscription"` and `refund_amount_cents: 0`, explaining no refund is available. The backend validates the action/amount, keeps the upstream token private, and returns a new local consent UUID to the browser. **Do not execute cancellation during the initial chat request**; the tool refuses until a user approval is recorded. Reply prose alone cannot change membership.

## Backend → platform resume/decline

`POST <AGENT_CONSENT_URL>` with the same auth headers and `Idempotency-Key: <local-consent-uuid>`:

```json
{
  "session_id": "browser-tab-session-uuid",
  "user_id": "11111111-1111-4111-8111-111111111111",
  "consent_token": "opaque-upstream-resume-token",
  "consent_id": "local-consent-uuid",
  "execution_id": "your-execution-id",
  "approved": true
}
```

Our backend records the decision first. On approval, resume the execution and call the business tool with **this local consent_id**. On `approved: false`, execute no financial action and reply that membership stays active. Return `{ "reply": "..." }`. Honor the idempotency key on retries. No tenant administrator approval is involved.

After tool success, say the subscription was cancelled and the amount credited to the **demo wallet**. Do not claim a real card refund or bank settlement timeframe.

## Platform → StreamSphere business tools

Both routes require `Authorization: Bearer <TOOL_API_KEY>`. Configure the HTTPS URL and secret in your platform, never in the browser. Importable schema: `docs/streamsphere-tools.openapi.json`.

### GET /api/tools/account?user_id=<verified-auth-user-uuid>

The `user_id` query parameter is required. Use the value supplied in the backend's chat/resume payload; the tool resolves it through `user_profiles` to the correct membership account.

Returns the full database account and authoritative policy metadata (account abbreviated below):

```json
{
  "account": { "subscription_status": "active", "price_cents": 1599, "wallet_cents": 0 },
  "policy": {
    "same_day_refund_eligible": true,
    "refund_amount_cents": 1599,
    "currency": "USD",
    "timezone": "Asia/Colombo",
    "user_consent_required": true,
    "access_ends": "immediately",
    "refund_destination": "demo_wallet"
  }
}
```

Check `same_day_refund_eligible` before offering a refund. The database checks again at execution.

### POST /api/tools/cancel-subscription

```json
{ "consent_id": "local-consent-uuid-from-resume-request" }
```

This **single atomic tool** cancels and, for `cancel_and_refund`, credits the wallet. Do not configure separate cancellation and refund tools. Account, amount, and charge are read from the approved database record, never chosen by the callback.

Success (account abbreviated):

```json
{
  "account": { "subscription_status": "cancelled", "wallet_cents": 1599 },
  "refund_amount_cents": 1599,
  "already_executed": false
}
```

Replay returns `already_executed: true` with the current account, without another credit. An old callback after repurchase cannot cancel the new subscription.

## Errors and scope

Errors use `{ "error": "human-readable message" }`. Statuses: `400` invalid input, `401` missing/expired session or invalid tool key, `403` browser origin/header, `404` record/route missing, `409` policy/consent conflict, `413` body too large, `415` content type, `429` browser rate limit, `502` platform failure/invalid reply, `503` configuration/database unavailable, `504` timeout. If a reply fails after a tool succeeded, refresh account/consent state before retrying; the browser does this automatically.

Conversation and approval/tool records live here. Intent classification, models, tokens, reasoning, tenant provisioning, RAG, and the complete execution audit remain in your real Agent Platform. JSON responses are implemented; adapt SSE in the adapter if your API requires it.
