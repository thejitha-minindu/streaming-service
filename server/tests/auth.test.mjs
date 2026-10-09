import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAuth } from '../auth.mjs';
import { createApp } from '../app.mjs';
import { createStore, HttpError } from '../store.mjs';
import { hashPassword, verifyPassword, hashSessionToken } from '../passwords.mjs';

const config = { supabaseUrl: 'https://project.supabase.co', supabaseKey: 'server-secret', origin: 'https://streamsphere.example', toolKey: 'a-tool-key-with-at-least-32-characters' };
const credentials = { name: 'First Member', email: 'first@example.com', password: 'a-good-password' };
function responseHeaders() {
  const headers = {};
  return { headers, setHeader: (key, value) => { headers[key] = value; } };
}
function request(cookie = '') { return { headers: { cookie }, socket: { remoteAddress: '127.0.0.1' } }; }
function cookieFrom(response) { return response.headers['Set-Cookie'][0].split(';')[0]; }
function memoryStore() {
  const users = new Map(), sessions = new Map();
  return {
    users, sessions,
    async registerUser({ name, email, passwordHash, tokenHash, expiresAt }) {
      if (users.has(email)) throw new HttpError(409, 'An account already uses this email.');
      const user = { id: randomUUID(), name, email, password_hash: passwordHash };
      users.set(email, user);
      sessions.set(tokenHash, { user, expiresAt });
      return user;
    },
    async userByEmail(email) { return users.get(email) || null; },
    async createSession({ userId, tokenHash, expiresAt }) {
      const user = [...users.values()].find(user => user.id === userId);
      sessions.set(tokenHash, { user, expiresAt });
    },
    async sessionUser(tokenHash) {
      const session = sessions.get(tokenHash);
      return session && Date.parse(session.expiresAt) > Date.now() ? session.user : null;
    },
    async deleteSession(tokenHash) { sessions.delete(tokenHash); },
  };
}
async function signup(auth, body = credentials) {
  const res = responseHeaders();
  const result = await auth.handle('/api/auth/signup', 'POST', body, request(), res);
  return { ...result, res, cookie: cookieFrom(res) };
}

test('password hashing uses random salts and verifies without storing plaintext', async () => {
  const first = await hashPassword(credentials.password);
  const second = await hashPassword(credentials.password);
  assert.notEqual(first, second);
  assert.match(first, /^scrypt\$32768\$8\$3\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verifyPassword(credentials.password, first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
  assert.equal(await verifyPassword(credentials.password, null), false);
  assert.equal(await verifyPassword(credentials.password, 'malformed'), false);
});

test('signup signs in immediately with public data and a hashed, protected session', async () => {
  const store = memoryStore();
  const auth = createAuth(config, store);
  const created = await signup(auth, { ...credentials, email: ' FIRST@example.com ', name: ' First Member ', account_id: randomUUID(), wallet_cents: 99999 });
  assert.deepEqual(created.user, { id: created.user.id, name: credentials.name, email: credentials.email });
  const saved = store.users.get(credentials.email);
  assert.notEqual(saved.password_hash, credentials.password);
  assert.equal(created.user.password_hash, undefined);
  assert.match(created.cookie, /^ss_session=[a-f0-9]{64}$/);
  assert.match(created.res.headers['Set-Cookie'][0], /Path=\/api; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000/);
  const token = created.cookie.slice('ss_session='.length);
  assert.ok(store.sessions.has(hashSessionToken(token)));
  assert.ok(!store.sessions.has(token));
  assert.ok(created.res.headers['Set-Cookie'].slice(1).every(value => value.includes('Max-Age=0')));
  assert.deepEqual(await createAuth(config, store).requireUser(request(created.cookie), responseHeaders()), created.user);
  await assert.rejects(signup(auth), error => error.status === 409);
  assert.equal(store.users.size, 1);
});

test('signin verifies credentials, rotates sessions, and signout revokes copied cookies', async () => {
  const store = memoryStore(), auth = createAuth(config, store);
  const created = await signup(auth);
  for (const body of [{ ...credentials, password: 'wrong-password' }, { ...credentials, email: 'unknown@example.com' }]) {
    await assert.rejects(auth.handle('/api/auth/signin', 'POST', body, request(), responseHeaders()), error => error.status === 401 && error.message === 'Incorrect email or password.');
  }
  const res = responseHeaders();
  const signed = await auth.handle('/api/auth/signin', 'POST', { ...credentials, email: ' FIRST@example.com ' }, request(created.cookie), res);
  const cookie = cookieFrom(res);
  assert.equal(signed.user.id, created.user.id);
  assert.notEqual(cookie, created.cookie);
  assert.equal(store.sessions.size, 1);
  await assert.rejects(auth.requireUser(request(created.cookie), responseHeaders()), error => error.status === 401);
  const out = responseHeaders();
  assert.deepEqual(await auth.handle('/api/auth/signout', 'POST', {}, request(cookie), out), { user: null });
  assert.equal(store.sessions.size, 0);
  assert.ok(out.headers['Set-Cookie'].every(value => value.includes('Max-Age=0')));
  await assert.rejects(auth.requireUser(request(cookie), responseHeaders()), error => error.status === 401);
});

test('expired, forged and former provider cookies cannot authenticate; callback is removed', async () => {
  const store = memoryStore(), auth = createAuth(config, store);
  const created = await signup(auth);
  [...store.sessions.values()][0].expiresAt = new Date(Date.now() - 1000).toISOString();
  for (const cookie of [created.cookie, `ss_session=${'f'.repeat(64)}`, 'ss_session=malformed', 'ss_access=old; ss_refresh=old', '']) {
    const res = responseHeaders();
    assert.deepEqual(await auth.handle('/api/auth/session', 'GET', undefined, request(cookie), res), { user: null });
    await assert.rejects(auth.requireUser(request(cookie), res), error => error.status === 401);
  }
  await assert.rejects(auth.handle('/api/auth/callback', 'POST', {}, request(), responseHeaders()), error => error.status === 404);
});

test('invalid credentials are rejected before writes and credential attempts are bounded', async () => {
  const store = memoryStore(), auth = createAuth(config, store);
  for (const invalid of [{ ...credentials, email: 'bad' }, { ...credentials, password: 'short' }, { ...credentials, name: '' }]) {
    await assert.rejects(signup(auth, invalid), error => error.status === 400);
  }
  assert.equal(store.users.size, 0);
  const limited = createAuth(config, store);
  for (let i = 0; i < 20; i++) await assert.rejects(signup(limited, { ...credentials, email: 'bad' }), error => error.status === 400);
  await assert.rejects(signup(limited), error => error.status === 429);
});

test('HTTP account/chat/purchase require a local session and ignore supplied account identity', async t => {
  const store = memoryStore(), auth = createAuth(config, store);
  const first = await signup(auth), second = await signup(auth, { ...credentials, email: 'second@example.com' });
  const selected = [];
  const server = createApp({ config, store: {}, auth, scope: async user => {
    selected.push(user.id);
    return { store: { account: async () => ({ id: user.id, wallet_cents: 0 }), history: async () => [{ content: `private:${user.id}` }], rpc: async () => ({ id: user.id }) }, agent: {} };
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const postHeaders = { Origin: config.origin, 'Content-Type': 'application/json', 'X-StreamSphere-Client': 'web' };
  for (const path of ['/api/account', `/api/chat?session_id=${randomUUID()}`]) assert.equal((await fetch(base + path)).status, 401);
  assert.equal((await fetch(`${base}/api/subscription/purchase`, { method: 'POST', headers: postHeaders, body: '{}' })).status, 401);
  for (const member of [first, second]) {
    const account = await fetch(`${base}/api/account?user_id=${randomUUID()}`, { headers: { Cookie: member.cookie } }).then(response => response.json());
    assert.equal(account.account.id, member.user.id);
    const history = await fetch(`${base}/api/chat?session_id=${randomUUID()}&user_id=${randomUUID()}`, { headers: { Cookie: member.cookie } }).then(response => response.json());
    assert.equal(history.messages[0].content, `private:${member.user.id}`);
    const purchase = await fetch(`${base}/api/subscription/purchase`, { method: 'POST', headers: { ...postHeaders, Cookie: member.cookie }, body: JSON.stringify({ user_id: randomUUID() }) }).then(response => response.json());
    assert.equal(purchase.account.id, member.user.id);
  }
  assert.equal(selected.length, 6);
  const csrf = await fetch(`${base}/api/auth/signin`, { method: 'POST', headers: { ...postHeaders, Origin: 'https://evil.example' }, body: JSON.stringify(credentials) });
  assert.equal(csrf.status, 403);
});

test('database transport uses application tables/RPCs and keeps account filters server-owned', async () => {
  const calls = [], first = randomUUID(), second = randomUUID();
  const store = createStore({ ...config, userId: first }, async (url, options) => {
    calls.push({ url, options });
    assert.ok(!url.includes('/auth/v1'));
    return Response.json(url.includes('user_profiles') ? [{ account_id: second }] : url.includes('demo_accounts') ? [{ id: second }] : null);
  });
  const memberStore = await store.registeredAccount(first);
  assert.equal((await memberStore.account()).id, second);
  assert.ok(calls[0].url.includes(`user_profiles?id=eq.${first}`));
  assert.ok(calls[1].url.includes(`demo_accounts?id=eq.${second}`));
  await store.registerUser({ name: 'Member', email: credentials.email, passwordHash: 'hash', tokenHash: 'token', expiresAt: 'expiry', accountId: second });
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { p_name: 'Member', p_email: credentials.email, p_password_hash: 'hash', p_token_hash: 'token', p_expires_at: 'expiry' });
  const missing = createStore(config, async () => Response.json([]));
  await assert.rejects(missing.registeredAccount(first), error => error instanceof HttpError && /005_normal_authentication/.test(error.message));
});
