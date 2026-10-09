# StreamSphere — Agent Platform demo tenant

For publishing this project, see [GitHub setup](docs/github-setup.md). The repository includes a credential-free environment template and automated build/test workflow.

**Vercel hosting:** see [frontend and backend deployment](docs/vercel-deployment.md). The included `api/index.js` and `vercel.json` deploy the backend alongside the Vite frontend. Add your server environment variables in Vercel and set `APP_ORIGIN` to the hosted HTTPS URL, then redeploy. Your existing Supabase data is reused.

**Registration setup:** run [`supabase/005_normal_authentication.sql`](supabase/005_normal_authentication.sql) after the base schema. The backend handles normal email/password sign-up and sign-in; Supabase is only the database. No Auth provider or email-confirmation setup is needed. See [sign-up and sign-in instructions](docs/authentication.md), including local password setup for existing accounts. New users have their own account, membership, wallet and chat; each starts on Paid Premium with $0 demo wallet credit.

**Keep the current user:** if that user has no local password yet, run `npm run user:password`, press Enter at the email prompt and choose a password. This uses `DEMO_USER_ID` and preserves the account, wallet and membership. Sign in at `/signin`, then use **Log out** in the navigation or profile. New users can register at `/signup` with just name, email and password and are signed in immediately.

Run all commands and both development servers from the same updated project directory. If `user:password` is missing from `npm run`, the terminal is using an older project copy.

The existing React/Vite design connects to a minimal Node backend and Supabase. Your **real Agent Platform** can handle conversation, reasoning, policy retrieval, and orchestration. This website is its demo tenant: it forwards chat and exposes authenticated business tools. Direct Gemini support is also available for testing this demo without configuring the real platform.

Each newly registered member starts **Paid · Premium**, charged a simulated **$15.99 today**, with a **$0.00 wallet**. After user approval and the platform's cancellation tool call, that account becomes **Non-paid · Free** with a **$15.99 wallet** and **Buy now**. Buy now spends that credit to restore Premium. There are no real card payments/refunds or full-length films.

## 1. Create the Supabase database

Create a Supabase project. In its **SQL Editor**, run these files in order:

1. [`supabase/001_schema.sql`](supabase/001_schema.sql): tables, RLS, permissions, transactional functions.
2. Optional: [`supabase/002_seed.sql`](supabase/002_seed.sql): legacy paid demo member for CLI checks. The ID must match `DEMO_USER_ID`; this seed does not set a password.
3. [`supabase/005_normal_authentication.sql`](supabase/005_normal_authentication.sql): local users, sessions, registration functions and migration of existing accounts. For an existing database with `001` already applied, run only `005`. File `004` is retired. Existing members need a local password set with `npm run user:password` before signing in.

Keep the Data API enabled with the `public` schema exposed. Copy the project URL and a **secret key** (`sb_secret_...`) or legacy **service_role** key from the API settings. An anon/publishable key cannot run this backend.

| Table | Purpose |
| --- | --- |
| `demo_accounts` | Profile, subscription, charge, timezone, price, wallet |
| `app_users` | User identity, normalized email and salted password hash |
| `app_sessions` | Hashed session tokens and expiration times |
| `user_profiles` | Links each application user to their own membership account |
| `agent_consents` | Session, platform token/execution, exact action/amount/charge, decision, expiry |
| `wallet_transactions` | Refund credits and purchases, unique refund per consent |
| `chat_messages` | Persisted conversation, linked to consent |
| `audit_events` | Approvals requested/granted/denied, tools executed, purchases |

Money is **integer USD cents**. Same-day eligibility uses the account's billing timezone (`Asia/Colombo` by default). The backend hashes passwords with scrypt, stores revocable database sessions and selects the authenticated user's account. Browser roles have no table/function access; the backend uses service_role. Reference: Supabase [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database functions](https://supabase.com/docs/guides/database/functions).

## 2. Configure the backend

Requires **Node.js 22.19+** (Node 24 also works).

```powershell
npm install
npm run setup
```

`setup` creates `.env` if needed and generates a missing `TOOL_API_KEY`, preserving existing values and keeping secrets out of terminal output. Fill in the other values in `.env`:

| Variable | Enter |
| --- | --- |
| `SUPABASE_URL` | Project root: `https://your-project.supabase.co` (a trailing `/rest/v1` is also accepted) |
| `SUPABASE_SECRET_KEY` | Server-side secret or legacy service_role key |
| `DEMO_USER_ID` | `11111111-1111-4111-8111-111111111111`, matching seed |
| `CHAT_PROVIDER` | `agent-platform` for your real system, or `gemini` for direct demo chat |
| `GEMINI_API_KEY` | Server-only Google Gemini API key, required for the Gemini provider |
| `GEMINI_MODEL` | Defaults to `gemini-2.5-flash` |
| `AGENT_CHAT_URL` | Full chat endpoint of your real platform |
| `AGENT_CONSENT_URL` | Full endpoint to resume/decline executions |
| `AGENT_API_KEY` | Your tenant's platform credential |
| `AGENT_TENANT_ID` | Tenant ID configured on your platform |
| `TOOL_API_KEY` | Generated by setup; copy this value from `.env` to your platform's tool credential |
| `APP_ORIGIN` | `http://localhost:5173` locally; exact browser origin |
| `PORT` / `HOST` | Defaults `3001` / `127.0.0.1` |
| `AGENT_TIMEOUT_MS` | Defaults `60000`, maximum `120000` |

Do not prefix secrets with `VITE_`. `.env` is gitignored, and keys are never sent to the browser.

For direct Gemini chat, set `CHAT_PROVIDER=gemini`, `GEMINI_API_KEY`, and `GEMINI_MODEL` in `.env`, then restart `npm run dev:api`. The `AGENT_*` credentials are not needed in this mode. Run `npm run check:chat` to verify a real reply without changing membership or wallet. Gemini receives recent conversation text and current membership/wallet context. It can request a cancellation confirmation; only clicking the confirmation button executes the existing transactional Supabase function. Refund amounts and eligibility are calculated on the backend and enforced by the database. The UI design stays the same. Switching providers requires a fresh confirmation for pending actions.

For your real platform, set `CHAT_PROVIDER=agent-platform` and fill in all four `AGENT_*` settings. Your attachment does not define its HTTP request/response format. The implemented contract is documented in [`docs/agent-integration.md`](docs/agent-integration.md) and isolated in [`server/agent.mjs`](server/agent.mjs). Translate fields/headers there if your API differs. Chat uses **JSON request/response**, not SSE token streaming. Missing/unreachable provider configuration produces an explicit error; there is no fake chatbot fallback.

## 3. Run

Terminal 1:

```powershell
npm run dev:api
```

Terminal 2:

```powershell
npm run dev
```

Open **http://localhost:5173** and select **Get started** to register or **Sign in** for an existing account. Vite proxies `/api` to Node. Use the same hostname as `APP_ORIGIN`. Account APIs require sign-in and work independently of chat-provider configuration.

**My account** opens the dedicated `/profile` page, showing the member's profile, paid/free status, plan benefits and latest charge, wallet, support chat, and saved library. Refresh and browser Back/Forward are supported. A production static host must rewrite frontend routes such as `/profile` to `index.html` (keeping `/api` proxied to Node).

To check Supabase and the seeded member independently of the frontend/chatbot, run `npm run check:db`. It prints connection status, membership, and wallet without displaying credentials. If tables are missing, run schema then seed in the SQL Editor; if only the member is missing, run seed. `PGRST125` indicates an invalid request path, rather than a missing table.

For a build preview, run `npm run build`, then `npm run preview`, with `npm run start:api` running in another terminal. For hosting, serve `dist` and reverse proxy `/api` to Node under the **same origin**. Update `APP_ORIGIN`; set `HOST=0.0.0.0` if needed for a container/reverse proxy. The default backend binds to loopback.

Each signed-in user has a separate membership, wallet and conversation history. Machine tool endpoints always require `TOOL_API_KEY`, and account lookup requires the verified `user_id` sent in the chat request.

## 4. Connect the real Agent Platform

1. Configure the StreamSphere tenant and fill in the `AGENT_*` values.
2. Import [`docs/streamsphere-tools.openapi.json`](docs/streamsphere-tools.openapi.json), replacing the server URL with your reachable HTTPS backend URL.
3. Configure `Authorization: Bearer <TOOL_API_KEY>` as the platform's tool credential.
4. Upload [`docs/streamsphere-policy.txt`](docs/streamsphere-policy.txt) as the tenant's policy document.
5. Implement the documented consent response/resume contract. After `approved: true`, call `POST /api/tools/cancel-subscription` with the local `consent_id` provided in the resume request. This single transaction cancels and optionally refunds.

An AWS-hosted agent cannot call your laptop's `localhost`. Use an HTTPS deployment/controlled tunnel for the tool routes, or run your real platform locally. Never call the business tools from the widget or expose their secret.

## 5. Present the scenario

1. Register at `/signup` and sign in. A new account starts Paid Premium with today's simulated charge and a $0 wallet. For a repeat presentation, copy [`supabase/003_reset_demo.sql`](supabase/003_reset_demo.sql) and replace every legacy UUID with this user's `user_profiles.account_id` before running it. **Reset deletes that account's chat, consent, transaction, and audit records.** Rerunning schema/seed alone intentionally preserves existing state.
2. Below the hero, the signed-in membership strip shows **Paid member** and **$0.00**. Open **My account** for details.
3. Open **Support** and ask: `I forgot to cancel my subscription and was charged today. Can I cancel and get a refund?`
4. Your agent looks up the signed-in account (passing its `user_id` to the account tool) and returns a consent request. **Keep Subscription** leaves membership and wallet unchanged.
5. Ask again and choose **Cancel & Refund**. After your platform calls the tool, the wallet becomes **$15.99**, membership becomes **Non-paid**, and the CTA becomes **Buy now**.
6. Reload to verify persistence. **Buy now** spends the wallet credit to restore Premium and $0 wallet.

Approvals expire after 15 minutes, or billing-local midnight for refunds, whichever comes first. Declined/expired approvals, changed charges, and repeated callbacks cannot issue another refund. Older charges may be cancelled with approval and **zero refund** (`action: "cancel_subscription"`, `refund_amount_cents: 0`). Premium access ends immediately.

If a tool succeeds but the agent response fails, the UI refreshes database state. An approved action can be retried with the same ID. Old callbacks cannot cancel a repurchased membership. UI account state refreshes after chat and every five seconds while visible.

## Verification and code

```powershell
npm test
npm run build
```

`npm test` runs the full local suite: supplied SQL in isolated PostgreSQL (PGlite), plus actual HTTP backend/adapter requests to a test upstream. It needs the SQL files but no real credentials. PGlite is a **development dependency only**; the runtime backend uses Node built-ins and Supabase REST.

GitHub Actions runs `npm run test:ci` and `npm run build`. This smaller test suite covers password hashing, registration, sign-in/sign-out, sessions, API access, account isolation, and hosted-function routing/body handling using test stores. CI requires no SQL files or database connection and does not test database migrations or refund transactions. Keep running `npm test` locally when changing database or refund behavior.

| File | Purpose |
| --- | --- |
| `server/index.mjs`, `server/config.mjs` | Startup/environment validation |
| `api/index.js`, `vercel.json`, `server/backend.mjs` | Vercel API entry point, routing and shared backend initialization |
| `server/app.mjs` | Browser APIs and authenticated tools |
| `server/auth.mjs`, `server/passwords.mjs` | Email/password authentication, scrypt hashes, protected session cookies and sign-out |
| `server/agent.mjs` | Real Agent Platform protocol adapter |
| `server/gemini.mjs` | Direct Gemini chat and database-backed confirmations |
| `server/store.mjs` | Server-only Supabase transport |
| `src/api.ts` | Same-origin frontend client |
| `src/components/MemberAccount.tsx` | Homepage membership summary |
| `src/components/ProfilePage.tsx` | Profile, plan details, wallet, support, repurchase |
| `src/components/AuthPage.tsx` | Themed registration and sign-in pages |
| `src/components/SupportChat.tsx` | Conversation and consent buttons |
| `supabase/*.sql` | Schema, seed, manual demo reset |

The cinematic artwork, charcoal/coral theme, typography, catalog, watchlist, and responsive layout are retained. External media is provided by Pexels/Unsplash and fonts by Google Fonts. Other pricing plans and annual billing remain illustrative.
