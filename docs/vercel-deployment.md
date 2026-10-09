# Deploy the frontend and backend on Vercel

The Vite build creates static frontend files. It does not start `npm run dev:api`. This project now includes `api/index.js`, a Vercel Node function that runs the same backend request handler as the local server. `vercel.json` sends `/api/*` to that function and serves the SPA for `/profile`, `/signin` and `/signup`.

## Project settings

Use the repository root as Vercel's **Root Directory** (the folder containing `package.json`, `api/` and `vercel.json`). Select **Vite**, build with `npm run build`, and use `dist` as the output directory. Select Node.js **22.x** or **24.x**. Keep Fluid Compute enabled; the API function is configured for a 120-second maximum duration.

Commit and push the updated files, including `api/index.js`, `vercel.json`, `server/backend.mjs` and the other modified server files. Do not upload only `dist/`: that contains the frontend alone. Do not use `npm run dev:api` as the build command.

## Environment variables

In **Vercel → Project → Settings → Environment Variables**, add the following for **Production**, using the values from your local backend `.env`. They are server-only variables; do not prefix them with `VITE_` or commit the actual values.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Your existing Supabase project URL |
| `SUPABASE_SECRET_KEY` | Your existing secret/service_role key |
| `DEMO_USER_ID` | Your existing demo member UUID; default `11111111-1111-4111-8111-111111111111` |
| `TOOL_API_KEY` | Your existing backend tool credential, at least 32 characters |
| `APP_ORIGIN` | The exact HTTPS website origin, e.g. `https://your-project.vercel.app` |
| `CHAT_PROVIDER` | `gemini` or `agent-platform`, matching your desired provider |

For Gemini, also set `GEMINI_API_KEY` and `GEMINI_MODEL` (e.g. `gemini-2.5-flash`). For the real Agent Platform, set `AGENT_CHAT_URL`, `AGENT_CONSENT_URL`, `AGENT_API_KEY` and `AGENT_TENANT_ID`. Those endpoints must be reachable over HTTPS from Vercel. Optionally set `AGENT_TIMEOUT_MS=45000` to leave time for database requests within the function's duration.

`APP_ORIGIN` must be the address you actually open in the browser, without a path. Do not use `http://localhost:5173` for the hosted site. For a custom domain, use its HTTPS origin. When `APP_ORIGIN` is omitted, the backend defaults to Vercel's deployment URL from `VERCEL_URL`; an explicitly configured production origin takes precedence. To use a preview deployment, configure its matching origin in the Preview environment or leave Preview's `APP_ORIGIN` unset.

The backend `.env` on your laptop is not automatically copied to Vercel. `HOST` and `PORT` are only used by the local HTTP server and are not needed by the hosted function. After changing environment variables, **redeploy** so the deployment receives them.

Your Supabase database is already set up. Keep using the same project: existing users, passwords, memberships and wallets will remain available. This deployment does not run SQL migrations or reset any data.

## Verify after redeploying

1. Open `https://your-project.vercel.app/api/health`. It must return JSON with `"ok": true`; this verifies that the backend starts with its environment configuration. It does not check database connectivity.
2. Open `/api/auth/session` while signed out. It should return `{"user":null}`.
3. Sign in with your existing account, open **My account**, and check the membership and wallet. This verifies the database connection. Use **Log out** and sign in again to check session revocation.
4. Reload `/profile`, `/signin` or `/signup` directly to verify the page routes.

If `/api/health` returns HTML or a 404, the deployed commit is missing the function/routing files, the Vercel Root Directory is wrong, or only static output was deployed. A JSON 503 mentioning setup means environment configuration is incomplete; check the deployment's **Function logs** for the missing setting. `Origin is not allowed` means `APP_ORIGIN` does not match the browser address. A database error after signing in means the Supabase URL/key or account schema is unavailable, rather than a frontend-only deployment.

The frontend and API use the same domain, so login cookies work without a separate API URL or cross-domain CORS configuration. Sessions persist in Supabase across function instances and restarts. Rate limiting and the chat-in-progress lock remain per instance for this minimal demo; refund safety and duplicate-credit prevention remain transactional in the database.

If using your real Agent Platform, update its registered business-tool URLs to `https://your-project.vercel.app/api/tools/account` and `/api/tools/cancel-subscription`, retaining the same bearer `TOOL_API_KEY` and signed-in `user_id` contract.

References: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [function duration](https://vercel.com/docs/functions/configuring-functions/duration).
