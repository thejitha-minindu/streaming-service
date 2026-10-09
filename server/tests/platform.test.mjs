import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../app.mjs';
import { createAgent } from '../agent.mjs';
import { createGeminiAgent } from '../gemini.mjs';
import { createStore, HttpError } from '../store.mjs';
import { readConfig } from '../config.mjs';
import { createAuth } from '../auth.mjs';
import { hashPassword } from '../passwords.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const toolKey = 'test-tool-secret-that-is-at-least-32-characters';
const schema = await readFile(new URL('../../supabase/001_schema.sql', import.meta.url), 'utf8');
const seed = await readFile(new URL('../../supabase/002_seed.sql', import.meta.url), 'utf8');
const reset = await readFile(new URL('../../supabase/003_reset_demo.sql', import.meta.url), 'utf8');

async function database(t) {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(schema);
  await db.exec(seed);
  t.after(() => db.close());
  const store = {
    async account() { return (await db.query('select * from public.demo_accounts where id = $1', [userId])).rows[0]; },
    async rpc(name, args) {
      const params = { p_account_id: userId, ...args };
      const placeholders = Object.keys(params).map((key, i) => `${key} => $${i + 1}`).join(',');
      try { return (await db.query(`select public.${name}(${placeholders}) as value`, Object.values(params))).rows[0].value; }
      catch (error) { throw new HttpError(error.code === 'P0002' ? 404 : 409, error.message); }
    },
    async message(sessionId, role, content, consentId = null) {
      return (await db.query('insert into public.chat_messages(account_id, session_id, role, content, consent_id) values ($1,$2,$3,$4,$5) returning *', [userId, sessionId, role, content, consentId])).rows[0];
    },
    async history(sessionId) {
      return (await db.query("select m.id, m.role, m.content, case when c.id is null then null else to_jsonb(c) - 'upstream_token' end as consent from public.chat_messages m left join public.agent_consents c on c.id = m.consent_id where m.account_id = $1 and m.session_id = $2 order by m.id", [userId, sessionId])).rows;
    },
  };
  return { db, store };
}

async function pending(store, sessionId = randomUUID(), action = 'cancel_and_refund') {
  return store.rpc('request_demo_consent', {
    p_session_id: sessionId, p_execution_id: randomUUID(), p_upstream_token: randomUUID(),
    p_action: action, p_refund_amount_cents: action === 'cancel_and_refund' ? 1599 : 0,
  });
}
async function approve(store, consent) {
  return store.rpc('decide_demo_consent', { p_session_id: consent.session_id, p_consent_id: consent.id, p_approved: true });
}
async function execute(store, consent) {
  return store.rpc('execute_demo_cancellation', { p_consent_id: consent.id });
}
async function listen(server, t) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('same-day approval atomically cancels, credits $15.99 once, survives seed, and wallet repurchase works', async t => {
  const { db, store } = await database(t);
  assert.equal((await store.account()).wallet_cents, 0);
  assert.equal((await store.account()).subscription_status, 'active');
  const consent = await pending(store);
  await assert.rejects(execute(store, consent), /approval is required/);
  await approve(store, consent);
  const result = await execute(store, consent);
  assert.equal(result.account.wallet_cents, 1599);
  assert.equal(result.account.subscription_status, 'cancelled');
  const replay = await execute(store, consent);
  assert.equal(replay.already_executed, true);
  assert.equal(replay.account.wallet_cents, 1599);
  assert.equal((await db.query('select count(*)::int as n from public.wallet_transactions')).rows[0].n, 1);
  const events = (await db.query('select event from public.audit_events order by id')).rows.map(row => row.event);
  assert.deepEqual(events, ['user_approval_requested', 'user_approval_granted', 'tool_executed']);
  await db.exec(seed);
  assert.equal((await store.account()).wallet_cents, 1599);
  const purchase = await store.rpc('purchase_demo_subscription', {});
  assert.equal(purchase.wallet_cents, 0);
  assert.equal(purchase.subscription_status, 'active');
  // An old callback cannot cancel a newly purchased subscription.
  assert.equal((await execute(store, consent)).account.subscription_status, 'active');
  await store.rpc('purchase_demo_subscription', {});
  assert.equal((await db.query('select count(*)::int as n from public.wallet_transactions')).rows[0].n, 2);
  await db.exec(reset);
  assert.equal((await store.account()).wallet_cents, 0);
  assert.equal((await db.query('select count(*)::int as n from public.agent_consents')).rows[0].n, 0);
});

test('declined, foreign-session, expired, and changed-charge consent cannot issue refunds', async t => {
  const { db, store } = await database(t);
  const declined = await pending(store);
  await assert.rejects(store.rpc('decide_demo_consent', { p_session_id: randomUUID(), p_consent_id: declined.id, p_approved: true }), /no rows/);
  await store.rpc('decide_demo_consent', { p_session_id: declined.session_id, p_consent_id: declined.id, p_approved: false });
  await assert.rejects(execute(store, declined), /approval is required/);
  await assert.rejects(approve(store, declined), /cannot be changed/);
  const expired = await pending(store);
  await approve(store, expired);
  await db.query("update public.agent_consents set expires_at = now() - interval '1 minute' where id = $1", [expired.id]);
  await assert.rejects(execute(store, expired), /expired/);
  const changed = await pending(store);
  await approve(store, changed);
  await db.exec("update public.demo_accounts set charged_at = charged_at - interval '1 hour'");
  await assert.rejects(execute(store, changed), /Subscription changed/);
  assert.equal((await store.account()).wallet_cents, 0);
  assert.equal((await store.account()).subscription_status, 'active');
});

test('older charge can be cancelled with approval but cannot be refunded; amount is enforced', async t => {
  const { db, store } = await database(t);
  await assert.rejects(store.rpc('request_demo_consent', { p_session_id: randomUUID(), p_execution_id: 'wrong-amount', p_upstream_token: randomUUID(), p_action: 'cancel_and_refund', p_refund_amount_cents: 9999 }), /Incorrect refund amount/);
  await db.exec("update public.demo_accounts set charged_at = now() - interval '2 days'");
  await assert.rejects(pending(store), /same-day charges/);
  const consent = await pending(store, randomUUID(), 'cancel_subscription');
  await approve(store, consent);
  const result = await execute(store, consent);
  assert.equal(result.account.wallet_cents, 0);
  assert.equal(result.account.subscription_status, 'cancelled');
  await assert.rejects(store.rpc('purchase_demo_subscription', {}), /Not enough wallet credit/);
});

test('parallel callbacks and separately approved consents cannot double-credit the same charge', async t => {
  const { store } = await database(t);
  const a = await pending(store);
  const b = await pending(store);
  await approve(store, a); await approve(store, b);
  const results = await Promise.allSettled([execute(store, a), execute(store, a), execute(store, b)]);
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 2);
  assert.equal((await store.account()).wallet_cents, 1599);
});

test('anonymous and authenticated Supabase roles cannot read balances or execute financial functions', async t => {
  const { db, store } = await database(t);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from public.demo_accounts'), /permission denied/);
    await assert.rejects(db.query('select public.purchase_demo_subscription($1)', [userId]), /permission denied/);
    await db.exec('reset role');
  }
  // Reapplying schema is safe and retains restrictions.
  await db.exec(schema);
  await db.exec('set role service_role');
  assert.equal((await store.account()).wallet_cents, 0);
  const consent = await pending(store);
  await approve(store, consent);
  assert.equal((await execute(store, consent)).account.wallet_cents, 1599);
  await db.exec('reset role');
});

test('HTTP chat → real adapter → consent → authenticated callback updates the database; keep subscription does not', async t => {
  const { store } = await database(t);
  let appUrl;
  let lastChat;
  let lastDecision;
  const upstream = createServer(async (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer upstream-secret');
    assert.equal(req.headers['x-tenant-id'], 'streamsphere');
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/chat') {
      lastChat = body;
      res.end(JSON.stringify({ reply: 'Cancel today’s charge and refund $15.99 to your wallet?', consent: { token: randomUUID(), execution_id: randomUUID(), action: 'cancel_and_refund', refund_amount_cents: 1599 } }));
    } else {
      lastDecision = body;
      assert.equal(req.headers['idempotency-key'], body.consent_id);
      if (body.approved) {
        const tool = await fetch(`${appUrl}/api/tools/cancel-subscription`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${toolKey}` }, body: JSON.stringify({ consent_id: body.consent_id }) });
        assert.equal(tool.status, 200);
      }
      res.end(JSON.stringify({ reply: body.approved ? 'Cancelled. $15.99 is now in your wallet.' : 'Your membership stays active.' }));
    }
  });
  const upstreamUrl = await listen(upstream, t);
  const config = { authRequired: false, userId, toolKey, origin: 'http://localhost:5173', chatUrl: `${upstreamUrl}/chat`, consentUrl: `${upstreamUrl}/consent`, agentKey: 'upstream-secret', tenantId: 'streamsphere', agentTimeout: 5000 };
  appUrl = await listen(createApp({ config, store, agent: createAgent(config) }), t);
  async function post(path, body, extra = {}) {
    return fetch(`${appUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-StreamSphere-Client': 'web', ...extra }, body: JSON.stringify(body) });
  }
  assert.equal((await fetch(`${appUrl}/api/tools/account`)).status, 401);
  assert.equal((await post('/api/subscription/purchase', {}, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('/api/chat', { session_id: 'bad', message: 'hi' })).status, 400);
  assert.equal((await post('/api/chat/consent', { session_id: randomUUID(), consent_id: randomUUID(), approved: 'true' })).status, 400);
  const session = randomUUID();
  const chat = await (await post('/api/chat', { session_id: session, user_id: randomUUID(), tenant_id: 'attacker', message: 'Please cancel and refund.' })).json();
  assert.equal(lastChat.user_id, userId);
  assert.equal(lastChat.account.wallet_cents, 0);
  assert.equal(lastChat.tenant_id, undefined);
  assert.equal(chat.message.consent.upstream_token, undefined);
  const deniedTool = await post('/api/tools/cancel-subscription', { consent_id: chat.message.consent.id }, { Authorization: `Bearer ${toolKey}` });
  assert.equal(deniedTool.status, 409);
  const keep = await (await post('/api/chat/consent', { session_id: session, consent_id: chat.message.consent.id, approved: false })).json();
  assert.equal(keep.account.subscription_status, 'active');
  assert.equal(lastDecision.approved, false);
  const second = await (await post('/api/chat', { session_id: session, message: 'I changed my mind. Cancel and refund.' })).json();
  const confirmed = await (await post('/api/chat/consent', { session_id: session, consent_id: second.message.consent.id, approved: true })).json();
  assert.equal(confirmed.account.wallet_cents, 1599);
  assert.equal(confirmed.account.subscription_status, 'cancelled');
  const replay = await (await post('/api/chat/consent', { session_id: session, consent_id: second.message.consent.id, approved: true })).json();
  assert.equal(replay.account.wallet_cents, 1599);
  const history = await (await fetch(`${appUrl}/api/chat?session_id=${session}`)).json();
  assert.equal(history.messages.find(m => m.consent?.id === second.message.consent.id).consent.status, 'executed');
  const purchase = await (await post('/api/subscription/purchase', {})).json();
  assert.equal(purchase.account.wallet_cents, 0);
  assert.equal(purchase.account.subscription_status, 'active');
});

test('adapter reports missing configuration, invalid consent, upstream failure, and timeout instead of fake replies', async () => {
  await assert.rejects(createAgent({}).chat({}), /not configured/);
  const config = { chatUrl: 'https://agent.example/chat', agentKey: 'key', tenantId: 'tenant', agentTimeout: 1000 };
  await assert.rejects(createAgent(config, async () => new Response('oops', { status: 502 })).chat({}), /could not complete/);
  await assert.rejects(createAgent(config, async () => new Response(JSON.stringify({ reply: 'Hi', consent: { token: 'bad' } }))).chat({}), /Invalid.*consent/);
  await assert.rejects(createAgent(config, async () => { throw new Error('timeout'); }).chat({}), /did not respond in time/);
});

test('Gemini chat requests confirmation; only approval cancels and refunds, with safe retry', async t => {
  const { store } = await database(t);
  const config = { authRequired: false, userId, toolKey, origin: 'http://localhost:5173', chatProvider: 'gemini', geminiKey: 'server-only-test-key', geminiModel: 'gemini-2.5-flash', agentTimeout: 5000 };
  let body;
  const agent = createGeminiAgent(config, store, async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    assert.equal(options.headers['x-goog-api-key'], config.geminiKey);
    assert.ok(!url.includes(config.geminiKey));
    body = JSON.parse(options.body);
    return Response.json({ candidates: [{ content: { parts: [{ functionCall: { name: 'request_cancellation', args: { refund_amount_cents: 99999 } } }] } }] });
  });
  const appUrl = await listen(createApp({ config, store, agent }), t);
  const post = async (path, data) => {
    const response = await fetch(`${appUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-StreamSphere-Client': 'web' }, body: JSON.stringify(data) });
    assert.equal(response.status, 200);
    return response.json();
  };
  const health = await (await fetch(`${appUrl}/api/health`)).json();
  assert.equal(health.agent_configured, true);
  assert.equal(health.chat_provider, 'gemini');
  const session = randomUUID();
  const request = { session_id: session, message: 'Cancel my paid service and refund today’s charge.' };
  const first = await post('/api/chat', request);
  assert.equal(body.contents.length, 1);
  assert.equal(first.message.consent.refund_amount_cents, 1599);
  assert.equal(first.account.wallet_cents, 0);
  assert.equal(first.account.subscription_status, 'active');
  assert.ok(!JSON.stringify(first).includes(config.geminiKey));
  await post('/api/chat/consent', { session_id: session, consent_id: first.message.consent.id, approved: false });
  assert.equal((await store.account()).wallet_cents, 0);
  const second = await post('/api/chat', request);
  const decision = { session_id: session, consent_id: second.message.consent.id, approved: true };
  const confirmed = await post('/api/chat/consent', decision);
  assert.equal(confirmed.account.wallet_cents, 1599);
  assert.equal(confirmed.account.subscription_status, 'cancelled');
  assert.equal((await post('/api/chat/consent', decision)).account.wallet_cents, 1599);
});

test('Gemini returns normal text, hides thoughts, and reports key/quota failures without secrets', async () => {
  const config = { geminiKey: 'private-test-key', geminiModel: 'gemini-2.5-flash', agentTimeout: 1000 };
  const store = { history: async () => [], account: async () => ({ subscription_status: 'active', wallet_cents: 0 }) };
  const input = { sessionId: randomUUID(), message: 'Hi', account: { subscription_status: 'active', billing_timezone: 'Asia/Colombo', charged_at: new Date().toISOString(), price_cents: 1599, wallet_cents: 0 } };
  const normal = createGeminiAgent(config, store, async () => Response.json({ candidates: [{ content: { parts: [{ text: 'hidden reasoning', thought: true }, { text: 'Hello! You have Premium.' }] } }] }));
  assert.equal((await normal.chat(input)).reply, 'Hello! You have Premium.');
  for (const [status, pattern] of [[400, /Gemini rejected/], [403, /Gemini rejected/], [429, /quota/], [404, /model is unavailable/]]) {
    const agent = createGeminiAgent(config, store, async () => new Response(config.geminiKey, { status }));
    await assert.rejects(agent.chat(input), pattern);
  }
  await assert.rejects(createGeminiAgent({}, store).chat(input), /needs GEMINI_API_KEY/);
  await assert.rejects(normal.consent({ consent: { execution_id: 'real-platform-execution' }, approved: true }), /provider changed/);
});

test('Supabase REST transport supports secret and legacy keys without exposing them to clients', async () => {
  for (const supabaseKey of ['sb_secret_example', 'legacy.jwt.key']) {
    let received;
    const store = createStore({ supabaseUrl: 'https://project.supabase.co', supabaseKey, userId }, async (url, options) => {
      received = { url, ...options };
      return new Response(JSON.stringify([{ id: userId }]));
    });
    assert.equal((await store.account()).id, userId);
    assert.equal(received.headers.apikey, supabaseKey);
    assert.equal(received.headers.Authorization, supabaseKey.startsWith('sb_secret_') ? undefined : `Bearer ${supabaseKey}`);
    assert.match(received.url, /demo_accounts\?id=eq\./);
  }
});

test('configuration fails clearly when secrets or secure URLs are missing', () => {
  assert.throws(() => readConfig({}), /Missing SUPABASE_URL/);
  const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_example', DEMO_USER_ID: userId, TOOL_API_KEY: toolKey };
  assert.equal(readConfig(env).port, 3001);
  assert.equal(readConfig({ ...env, GEMINI_API_KEY: 'test-key' }).chatProvider, 'gemini');
  assert.equal(readConfig({ ...env, GEMINI_API_KEY: 'test-key', CHAT_PROVIDER: 'agent-platform' }).chatProvider, 'agent-platform');
  assert.throws(() => readConfig({ ...env, CHAT_PROVIDER: 'invalid' }), /CHAT_PROVIDER/);
  assert.equal(readConfig({ ...env, SUPABASE_URL: 'https://project.supabase.co/' }).supabaseUrl, 'https://project.supabase.co');
  assert.equal(readConfig({ ...env, SUPABASE_URL: 'https://project.supabase.co/rest/v1/' }).supabaseUrl, 'https://project.supabase.co');
  assert.equal(readConfig({ ...env, SUPABASE_URL: 'https://project.supabase.co/rest/v1' }).supabaseUrl, 'https://project.supabase.co');
  assert.throws(() => readConfig({ ...env, SUPABASE_URL: 'http://remote.example' }), /must use HTTPS/);
  assert.throws(() => readConfig({ ...env, TOOL_API_KEY: 'short' }), /at least 32/);
});

test('local registration is atomic, sessions expire/revoke, and browser roles cannot read credentials', async t => {
  const { db, store } = await database(t);
  const migration = await readFile(new URL('../../supabase/005_normal_authentication.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  const hash = `scrypt$32768$8$3$${'a'.repeat(32)}$${'b'.repeat(128)}`;
  const token = 'c'.repeat(64), expiry = new Date(Date.now() + 3600000).toISOString();
  const register = (email, tokenHash = token, until = expiry) => db.query('select public.register_app_user($1,$2,$3,$4,$5) as value', ['New Member', email, hash, tokenHash, until]);
  const user = (await register(' NEW@example.com ')).rows[0].value;
  assert.deepEqual(Object.keys(user).sort(), ['email', 'id', 'name']);
  assert.equal(user.email, 'new@example.com');
  const account = (await db.query('select * from public.demo_accounts where id=$1', [user.id])).rows[0];
  assert.equal(account.name, 'New Member');
  assert.equal(account.wallet_cents, 0);
  assert.equal(account.subscription_status, 'active');
  assert.equal((await store.account()).wallet_cents, 0);
  assert.equal((await db.query('select account_id from public.user_profiles where id=$1', [user.id])).rows[0].account_id, user.id);
  const session = async tokenHash => (await db.query('select public.get_app_session($1) as value', [tokenHash])).rows[0].value;
  assert.deepEqual(await session(token), user);
  await assert.rejects(register('new@example.com', 'd'.repeat(64)), /already uses/);
  await assert.rejects(register('rollback@example.com', token), /duplicate key/);
  await assert.rejects(register('expired@example.com', 'e'.repeat(64), new Date(Date.now() - 10000).toISOString()), /Invalid session expiry/);
  assert.equal((await db.query("select count(*)::int as n from public.app_users where email in ('rollback@example.com','expired@example.com')")).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int as n from public.demo_accounts where email in ('rollback@example.com','expired@example.com')")).rows[0].n, 0);
  await db.query("update public.app_sessions set created_at=now()-interval '2 hours', expires_at=now()-interval '1 hour' where token_hash=$1", [token]);
  assert.equal(await session(token), null);
  await db.query('select public.start_app_session($1,$2,$3)', [user.id, 'd'.repeat(64), expiry]);
  assert.equal((await db.query('select count(*)::int as n from public.app_sessions where user_id=$1', [user.id])).rows[0].n, 1);
  await db.query('select public.set_app_user_password($1,$2)', [user.email, hash]);
  assert.equal(await session('d'.repeat(64)), null);
  await db.query('select public.start_app_session($1,$2,$3)', [user.id, 'e'.repeat(64), expiry]);
  await db.query('delete from public.app_sessions where token_hash=$1', ['e'.repeat(64)]);
  assert.equal(await session('e'.repeat(64)), null);
  await db.exec(migration);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    for (const table of ['app_users', 'app_sessions', 'user_profiles']) await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
    await assert.rejects(db.query('select public.get_app_session($1)', [token]), /permission denied/);
    await assert.rejects(register('unauthorized@example.com'), /permission denied/);
    await db.exec('reset role');
  }
  const legacyConsent = await pending(store);
  await assert.rejects(store.rpc('decide_demo_consent', { p_account_id: user.id, p_session_id: legacyConsent.session_id, p_consent_id: legacyConsent.id, p_approved: true }), /no rows/);
});

test('upgrade detaches Supabase Auth while preserving mapped identities, wallets and local passwords', async t => {
  const { db, store } = await database(t);
  const migration = await readFile(new URL('../../supabase/005_normal_authentication.sql', import.meta.url), 'utf8');
  const authId = randomUUID(), accountId = randomUUID();
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create table public.user_profiles(id uuid primary key references auth.users(id) on delete cascade, account_id uuid not null unique references public.demo_accounts(id), created_at timestamptz default now());
    create function public.create_registered_member() returns trigger language plpgsql as $$ begin return new; end; $$;
    create trigger streamsphere_user_registered after insert on auth.users for each row execute function public.create_registered_member();`);
  await db.query('insert into auth.users values ($1)', [authId]);
  await db.query("insert into public.demo_accounts(id,name,email,wallet_cents,subscription_status) values ($1,'Existing Member','existing@example.com',123,'cancelled')", [accountId]);
  await db.query('insert into public.user_profiles(id,account_id) values ($1,$2)', [authId, accountId]);
  await db.exec(migration);
  assert.equal((await db.query("select count(*)::int as n from pg_trigger where tgname='streamsphere_user_registered'")).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int as n from pg_constraint where conrelid='public.user_profiles'::regclass and confrelid='auth.users'::regclass")).rows[0].n, 0);
  const user = (await db.query('select * from public.app_users where id=$1', [authId])).rows[0];
  assert.equal(user.email, 'existing@example.com');
  assert.equal(user.password_hash, null);
  assert.equal((await db.query('select account_id from public.user_profiles where id=$1', [authId])).rows[0].account_id, accountId);
  // The seed has no former auth.users record: backfill must work after detaching the FK.
  assert.equal((await db.query('select account_id from public.user_profiles where id=$1', [userId])).rows[0].account_id, userId);
  const password = 'existing-member-password';
  const hash = await hashPassword(password);
  const token = 'f'.repeat(64), expiry = new Date(Date.now() + 3600000).toISOString();
  await assert.rejects(db.query('select public.start_app_session($1,$2,$3)', [authId, token, expiry]), /Local password/);
  await assert.rejects(db.query('select public.register_app_user($1,$2,$3,$4,$5)', ['Takeover', user.email, hash, token, expiry]), /already uses/);
  await db.query('select public.set_app_user_password($1,$2)', [user.email, hash]);
  const localStore = {
    userByEmail: async email => (await db.query('select * from public.app_users where email=$1', [email])).rows[0] || null,
    createSession: ({ userId, tokenHash, expiresAt }) => db.query('select public.start_app_session($1,$2,$3)', [userId, tokenHash, expiresAt]),
    sessionUser: async tokenHash => (await db.query('select public.get_app_session($1) as value', [tokenHash])).rows[0].value,
    deleteSession: tokenHash => db.query('delete from public.app_sessions where token_hash=$1', [tokenHash]),
  };
  const auth = createAuth({ origin: 'http://localhost:5173' }, localStore);
  let cookies;
  const response = { setHeader: (key, value) => { if (key === 'Set-Cookie') cookies = value; } };
  const request = cookie => ({ headers: { cookie }, socket: { remoteAddress: '127.0.0.1' } });
  // The retained user can sign in, sign out, and return to the same account.
  for (let i = 0; i < 2; i++) {
    const signedIn = await auth.handle('/api/auth/signin', 'POST', { email: user.email, password }, request(''), response);
    assert.equal(signedIn.user.id, authId);
    const cookie = cookies[0].split(';')[0];
    assert.equal((await auth.requireUser(request(cookie), response)).id, authId);
    assert.equal((await db.query('select account_id from public.user_profiles where id=$1', [authId])).rows[0].account_id, accountId);
    await auth.handle('/api/auth/signout', 'POST', {}, request(cookie), response);
    await assert.rejects(auth.requireUser(request(cookie), response), error => error.status === 401);
  }
  await db.query('select public.start_app_session($1,$2,$3)', [authId, token, expiry]);
  await db.exec(migration);
  await db.query('delete from auth.users where id=$1', [authId]);
  assert.equal((await db.query('select public.get_app_session($1) as value', [token])).rows[0].value.id, authId);
  assert.equal((await db.query('select password_hash from public.app_users where id=$1', [authId])).rows[0].password_hash, hash);
  const account = (await db.query('select * from public.demo_accounts where id=$1', [accountId])).rows[0];
  assert.equal(account.wallet_cents, 123);
  assert.equal(account.subscription_status, 'cancelled');
  assert.equal((await store.account()).wallet_cents, 0);
});
