import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { HttpError } from './store.mjs';
import { chatConfigured } from './config.mjs';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value, field) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new HttpError(400, `${field} must be a UUID.`);
  return value;
}
function authorizeTool(request, secret) {
  const received = Buffer.from(request.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new HttpError(401, 'Invalid tool credentials.');
}
async function readBody(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Send application/json.');
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 16384) throw new HttpError(413, 'Request is too large.');
  }
  let body;
  try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid JSON body.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Expected a JSON object.');
  return body;
}

export function createApp({ config, store: baseStore, agent: baseAgent, auth, scope }) {
  const activeSessions = new Set();
  const rateLimits = new Map();
  async function locked(sessionId, run) {
    if (activeSessions.has(sessionId)) throw new HttpError(409, 'Please wait for the current chat request to finish.');
    activeSessions.add(sessionId);
    try { return await run(); } finally { activeSessions.delete(sessionId); }
  }
  async function saveReply(store, sessionId, result) {
    let consent = null;
    if (result.consent) {
      const c = result.consent;
      consent = await store.rpc('request_demo_consent', {
        p_session_id: sessionId, p_execution_id: c.execution_id, p_upstream_token: c.token,
        p_action: c.action, p_refund_amount_cents: c.refund_amount_cents,
      });
    }
    const row = await store.message(sessionId, 'assistant', result.reply, consent?.id);
    return {
      message: { id: row.id, role: 'assistant', content: result.reply, consent },
      // Always read actual database state, never infer membership from agent prose.
      account: await store.account(),
    };
  }
  return createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const url = new URL(request.url, 'http://localhost');
      const method = request.method;
      const tool = url.pathname.startsWith('/api/tools/');
      if (tool) authorizeTool(request, config.toolKey);
      else {
        // Browser mutations require the same origin and an application header.
        if (request.headers.origin && request.headers.origin !== config.origin) throw new HttpError(403, 'Origin is not allowed.');
        if (method === 'POST' && request.headers['x-streamsphere-client'] !== 'web') throw new HttpError(403, 'Missing application request header.');
        const now = Date.now();
        for (const [key, limit] of rateLimits) if (limit.until <= now) rateLimits.delete(key);
        const ip = request.socket.remoteAddress;
        const limit = rateLimits.get(ip) || { count: 0, until: now + 60000 };
        if (++limit.count > 120) throw new HttpError(429, 'Too many requests. Please try again in a minute.');
        rateLimits.set(ip, limit);
      }
      let store = baseStore;
      let agent = baseAgent;
      if (url.pathname.startsWith('/api/auth/')) {
        if (!auth) throw new HttpError(503, 'Authentication is not configured.');
        const body = method === 'POST' ? await readBody(request) : undefined;
        const data = await auth.handle(url.pathname, method, body, request, response);
        response.writeHead(200);
        response.end(JSON.stringify(data));
        return;
      }
      if (!tool && url.pathname !== '/api/health' && config.authRequired !== false) {
        if (!auth || !scope) throw new HttpError(503, 'Authentication is not configured.');
        const user = await auth.requireUser(request, response);
        ({ store, agent } = await scope(user));
      }
      let data;
      if (method === 'GET' && url.pathname === '/api/health') {
        data = { ok: true, agent_configured: chatConfigured(config), chat_provider: config.chatProvider || 'agent-platform' };
      } else if (method === 'GET' && url.pathname === '/api/account') {
        data = { account: await store.account() };
      } else if (method === 'GET' && url.pathname === '/api/chat') {
        data = { messages: await store.history(uuid(url.searchParams.get('session_id'), 'session_id')) };
      } else if (method === 'POST' && url.pathname === '/api/chat') {
        const body = await readBody(request);
        const sessionId = uuid(body.session_id, 'session_id');
        if (typeof body.message !== 'string' || !body.message.trim() || body.message.trim().length > 4000) throw new HttpError(400, 'Enter a message between 1 and 4000 characters.');
        data = await locked(sessionId, async () => {
          const account = await store.account();
          const message = body.message.trim();
          await store.message(sessionId, 'user', message);
          const result = await agent.chat({ sessionId, message, account });
          return saveReply(store, sessionId, result);
        });
      } else if (method === 'POST' && url.pathname === '/api/chat/consent') {
        const body = await readBody(request);
        const sessionId = uuid(body.session_id, 'session_id');
        const consentId = uuid(body.consent_id, 'consent_id');
        if (typeof body.approved !== 'boolean') throw new HttpError(400, 'approved must be a boolean.');
        data = await locked(sessionId, async () => {
          const consent = await store.rpc('decide_demo_consent', { p_session_id: sessionId, p_consent_id: consentId, p_approved: body.approved });
          if (consent.status === 'executed') {
            return { account: await store.account(), messages: await store.history(sessionId) };
          }
          const result = await agent.consent({ sessionId, consent, approved: body.approved });
          return saveReply(store, sessionId, result);
        });
      } else if (method === 'POST' && url.pathname === '/api/subscription/purchase') {
        await readBody(request);
        data = { account: await store.rpc('purchase_demo_subscription', {}) };
      } else if (method === 'GET' && url.pathname === '/api/tools/account') {
        store = await baseStore.registeredAccount(uuid(url.searchParams.get('user_id'), 'user_id'));
        const account = await store.account();
        const day = value => new Intl.DateTimeFormat('en-CA', { timeZone: account.billing_timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
        data = { account, policy: {
          same_day_refund_eligible: account.subscription_status === 'active' && day(account.charged_at) === day(Date.now()),
          refund_amount_cents: account.price_cents, currency: 'USD', timezone: account.billing_timezone,
          user_consent_required: true, access_ends: 'immediately', refund_destination: 'demo_wallet',
        } };
      } else if (method === 'POST' && url.pathname === '/api/tools/cancel-subscription') {
        const body = await readBody(request);
        const consentId = uuid(body.consent_id, 'consent_id');
        if (baseStore.consentAccount) store = await baseStore.consentAccount(consentId);
        // The account, charge and amount come from the database, never tool input.
        data = await store.rpc('execute_demo_cancellation', { p_consent_id: consentId });
      } else {
        throw new HttpError(404, 'API route not found.');
      }
      response.writeHead(200);
      response.end(JSON.stringify(data));
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error('API request failed:', error.name);
      response.writeHead(status);
      response.end(JSON.stringify({ error: status === 500 ? 'Unexpected backend error. Please try again.' : error.message }));
    }
  });
}
