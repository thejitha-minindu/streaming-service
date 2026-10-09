# Email/password authentication

StreamSphere handles registration, sign-in and sessions in its Node backend. Supabase is used only as the database; no Supabase Auth provider, email confirmation, SMTP or redirect settings are required. The existing sign-in, sign-up and profile theme is retained.

## Apply the database migration

In the Supabase SQL Editor, run [`001_schema.sql`](../supabase/001_schema.sql), then [`005_normal_authentication.sql`](../supabase/005_normal_authentication.sql). For an existing installation with the base schema already installed, run only `005_normal_authentication.sql`. File `004_user_registration.sql` is retired.

The migration creates these private tables, accessible only through the backend service credential:

| Table | Purpose |
| --- | --- |
| `app_users` | Application user ID, name, normalized email, salted password hash |
| `app_sessions` | Hashed random session token, user ID, creation and expiration times |
| `user_profiles` | Links the application user to their membership/wallet account |

New registration creates the user, Paid Premium membership, $0 wallet and session in one transaction. The $15.99 charge is simulated for today's date; this is a demonstration, with no real payment. Each user's wallet and conversations remain separate. A browser cannot choose an existing account ID or its starting balance.

## Existing accounts

The migration preserves existing accounts, profiles, membership status, wallets and history. It removes this application's former trigger and profile foreign key to `auth.users`; it does not delete Supabase Auth records or affect other applications using them. Rerunning the migration preserves local passwords and sessions.

Existing demo members and former Supabase Auth members are imported without a local password. Their old passwords are not copied. After running the migration, set a local password from the project root:

```powershell
# Run from the project folder containing package.json.
npm run user:password
```

Press **Enter** at the email prompt to use the current demo user configured by `DEMO_USER_ID`, or enter another existing account's email. Set a password when prompted; password input is hidden. The command keeps the user's profile, membership, wallet and conversations and revokes their previous local sessions. Sign in at `/signin` using the email printed by the command and the password you chose. For the unchanged seed, the email is `alex@example.com`.

This is a one-time setup for existing users who do not yet have a local password. Users with a local password can simply continue signing in; do not reset it unnecessarily. This trusted operator command requires the backend `.env` configuration and must not be exposed as a public endpoint. An imported email is reserved: public sign-up cannot take over its existing wallet. There is no self-service password-reset or email-verification flow in this minimal demo.

For a new member, visit `/signup` and enter only **name, email and password**. There is no confirm-password field, email confirmation or additional onboarding. Successful registration signs them in immediately and opens `/profile`. Use **Log out** in the desktop navigation, mobile menu or profile to log out, then sign back in with the same email and password.

The runtime authentication backend consists of the existing four routes in `server/auth.mjs` and password/session hashing in `server/passwords.mjs`. It uses Node built-ins with no additional authentication package. The database handles account and session persistence.

## Run locally

Keep `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (secret/service_role key) in `.env`. Other existing backend settings remain unchanged. `SUPABASE_AUTH_KEY` is no longer used and can be removed. No frontend keys or extra authentication secrets are needed.

```powershell
npm install
npm run dev:api
```

In another terminal in the same project directory, run `npm run dev`. Sign up or sign in at `http://localhost:5173`; use **My account** for the wallet, membership and support. **Log out** is available in the desktop navigation, mobile menu and at the top of the profile, even if membership data fails to load.

If npm reports `Missing script: "user:password"`, check that this terminal and both development servers are using the updated project folder. Separate copies of the project do not share code changes. Run `npm run` to confirm that `user:password` is listed before continuing.

Passwords are salted and hashed with Node's scrypt (`N=32768`, `r=8`, `p=3`, 64-byte output). Plaintext passwords are neither stored nor returned. Sessions use 32 random bytes; only their SHA-256 hashes are stored in the database. A session lasts 30 days and remains valid across backend restarts. Expired or revoked sessions cannot access account APIs. Sign-out deletes the stored session and clears cookies; successful sign-in rotates the current browser session. Credential attempts are limited per IP. Use HTTPS in deployment.

The session cookie is `HttpOnly`, `SameSite=Lax`, scoped to `/api`, and `Secure` on HTTPS. Frontend code receives only public user details, never password hashes or session tokens. Browser POST requests require the configured origin and application header. The backend scopes profile, wallet, purchase and chat operations to the session's user. The watchlist remains locally separated by user. Deploy the frontend and `/api` under the same origin and rewrite `/profile`, `/signin` and `/signup` to the SPA entry point.

## Backend routes

| Route | Behavior |
| --- | --- |
| `GET /api/auth/session` | Returns the session's public user, or `null` |
| `POST /api/auth/signup` | Accepts `name`, `email`, `password`; creates account and signs in |
| `POST /api/auth/signin` | Checks email/password and creates a session |
| `POST /api/auth/signout` | Revokes the session and clears cookies |

Email-confirmation callbacks and Supabase Auth token refresh are removed. Previously issued Supabase Auth cookies no longer grant access and are cleared on local sign-in or sign-out.

## Agent Platform integration

The authenticated application's user ID (`app_users.id`) is sent as `user_id` in chat and consent requests. The real platform must pass this value as the required query parameter for `GET /api/tools/account`. The tool schema remains in `docs/streamsphere-tools.openapi.json`.

Cancellation callbacks still submit only `consent_id`; the backend resolves the account bound to that confirmation. Database checks enforce the account, charge, decision, amount and expiry. The paid-to-free transition and refund behavior are unchanged.

`npm run check:db` and `npm run check:chat` check the configured legacy `DEMO_USER_ID`; they do not sign in. If using the optional legacy seed, run `002_seed.sql` before `005_normal_authentication.sql`, then set its password with `npm run user:password`. To reset a presentation account, copy `003_reset_demo.sql` and replace every legacy UUID with its `user_profiles.account_id`. Reset deletes that account's chat, consent and transaction history, but preserves its user, password and profile.
