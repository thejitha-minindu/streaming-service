import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createHandler } from '../app.mjs';
import { readConfig } from '../config.mjs';

const env = {
  SUPABASE_URL: 'https://deployment-test.supabase.co', SUPABASE_SECRET_KEY: 'test-server-key',
  DEMO_USER_ID: '11111111-1111-4111-8111-111111111111', TOOL_API_KEY: 'deployment-test-tool-key-with-32-characters',
  APP_ORIGIN: 'https://streamsphere.example', CHAT_PROVIDER: 'agent-platform',
};
async function invoke(handler, { url, method = 'GET', body, raw, cookie, getter } = {}) {
  const request = Readable.from(raw === undefined ? [] : [Buffer.from(raw)]);
  request.url = url;
  request.method = method;
  request.headers = { origin: env.APP_ORIGIN, ...(method === 'POST' ? { 'content-type': 'application/json', 'x-streamsphere-client': 'web' } : {}), ...(cookie ? { cookie } : {}) };
  request.socket = { remoteAddress: '127.0.0.1' };
  if (getter) Object.defineProperty(request, 'body', { get: getter });
  else if (body !== undefined) request.body = body;
  const headers = {};
  const response = { setHeader: (key, value) => { headers[key.toLowerCase()] = value; }, writeHead(status, extra = {}) { this.status = status; for (const [key, value] of Object.entries(extra)) headers[key.toLowerCase()] = value; }, end(value) { this.body = JSON.parse(value); } };
  await handler(request, response);
  return { status: response.status, body: response.body, headers };
}
function setEnvironment(t, values) {
  // Isolated test process; do not load a local .env or use live credentials.
  for (const key of [...Object.keys(env), 'AGENT_CHAT_URL', 'AGENT_CONSENT_URL', 'AGENT_API_KEY', 'AGENT_TENANT_ID', 'VERCEL_URL']) {
    const original = process.env[key];
    if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key];
    t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
  }
}

test('HTTP handler accepts Vercel parsed bodies and local streams with the same validation', async () => {
  const received = [];
  const handler = createHandler({ config: readConfig(env), store: {}, auth: { async handle(path, method, body) { received.push(body); return { user: null }; } } });
  const credentials = { email: 'member@example.com', password: 'demo-password' };
  for (const input of [{ body: credentials }, { body: JSON.stringify(credentials) }, { body: Buffer.from(JSON.stringify(credentials)) }, { raw: JSON.stringify(credentials) }]) {
    assert.equal((await invoke(handler, { url: '/api/auth/signin', method: 'POST', ...input })).status, 200);
    assert.deepEqual(received.at(-1), credentials);
  }
  for (const input of [{ body: 'malformed' }, { body: [] }, { body: 123 }, { getter: () => { throw new SyntaxError('malformed provider body'); } }]) {
    assert.equal((await invoke(handler, { url: '/api/auth/signin', method: 'POST', ...input })).status, 400);
  }
  for (const input of [{ body: { value: 'a'.repeat(17000) } }, { raw: JSON.stringify({ value: 'a'.repeat(17000) }) }]) {
    assert.equal((await invoke(handler, { url: '/api/auth/signin', method: 'POST', ...input })).status, 413);
  }
  assert.equal(received.length, 4);
});

test('Vercel function routes signup, sessions, scoped queries and logout without a listening server', async t => {
  setEnvironment(t, env);
  const userId = randomUUID(), sessions = new Map(), requested = [];
  let user;
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, env.SUPABASE_URL);
    requested.push(url);
    const path = url.pathname.replace('/rest/v1/', '');
    const args = options.body ? JSON.parse(options.body) : {};
    if (path === 'rpc/register_app_user') {
      user = { id: userId, name: args.p_name, email: args.p_email, password_hash: args.p_password_hash };
      sessions.set(args.p_token_hash, user);
      return Response.json({ id: userId, name: user.name, email: user.email });
    }
    if (path === 'rpc/get_app_session') return Response.json(sessions.get(args.p_token_hash) || null);
    if (path === 'app_sessions' && options.method === 'DELETE') { sessions.delete(url.searchParams.get('token_hash').slice(3)); return new Response(null, { status: 204 }); }
    if (path === 'user_profiles') { assert.equal(url.searchParams.get('id'), `eq.${userId}`); return Response.json([{ account_id: userId }]); }
    if (path === 'demo_accounts') return Response.json([{ id: userId, wallet_cents: 0, subscription_status: 'active' }]);
    if (path === 'chat_messages') return Response.json([]);
    throw new Error(`Unexpected database request: ${path}`);
  });
  const { default: handler } = await import(`../../api/index.js?test=${randomUUID()}`);
  const health = await invoke(handler, { url: '/api/index?__api_path=health' });
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(requested.length, 0);
  const created = await invoke(handler, { url: '/api/index?__api_path=auth%2Fsignup', method: 'POST', body: { name: 'Hosted Member', email: 'member@example.com', password: 'demo-password' } });
  assert.equal(created.status, 200);
  assert.equal(created.body.user.id, userId);
  assert.equal(created.body.user.password_hash, undefined);
  const cookie = created.headers['set-cookie'][0].split(';')[0];
  assert.match(created.headers['set-cookie'][0], /HttpOnly; SameSite=Lax; Secure/);
  assert.equal((await invoke(handler, { url: '/api/auth/session', cookie })).body.user.id, userId);
  assert.equal((await invoke(handler, { url: '/api/index?__api_path=account', cookie })).body.account.id, userId);
  const sessionId = randomUUID();
  assert.equal((await invoke(handler, { url: `/api/index?__api_path=chat&session_id=${sessionId}`, cookie })).status, 200);
  assert.equal(requested.at(-1).searchParams.get('session_id'), `eq.${sessionId}`);
  assert.equal((await invoke(handler, { url: '/api/index?__api_path=auth%2Fsignout', method: 'POST', body: {}, cookie })).status, 200);
  assert.equal(sessions.size, 0);
  assert.equal((await invoke(handler, { url: '/api/index?__api_path=account', cookie })).status, 401);
  const unknown = await invoke(handler, { url: '/api/index?__api_path=missing', cookie });
  assert.equal(unknown.status, 401);
});

test('hosted initialization reports missing configuration as JSON without exposing secrets', async t => {
  setEnvironment(t, { ...env, SUPABASE_SECRET_KEY: undefined });
  t.mock.method(console, 'error', () => {});
  const { default: handler } = await import(`../../api/index.js?test=${randomUUID()}`);
  const failed = await invoke(handler, { url: '/api/index?__api_path=health' });
  assert.equal(failed.status, 503);
  assert.match(failed.body.error, /Vercel environment variables/);
  assert.ok(!JSON.stringify(failed).includes(env.TOOL_API_KEY));
  assert.equal(failed.headers['cache-control'], 'no-store');
});

test('configuration supports the Vercel URL and an explicit custom domain', () => {
  assert.equal(readConfig({ ...env, APP_ORIGIN: undefined, VERCEL_URL: 'preview.vercel.app' }).origin, 'https://preview.vercel.app');
  assert.equal(readConfig({ ...env, VERCEL_URL: 'preview.vercel.app' }).origin, env.APP_ORIGIN);
  assert.throws(() => readConfig({ ...env, APP_ORIGIN: 'http://remote.example' }), /APP_ORIGIN must use HTTPS/);
});
