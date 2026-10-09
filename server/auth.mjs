import { randomBytes } from 'node:crypto';
import { HttpError } from './store.mjs';
import { hashPassword, verifyPassword, hashSessionToken } from './passwords.mjs';

const sessionSeconds = 30 * 24 * 60 * 60;
function sessionToken(request) {
  for (const item of (request.headers.cookie || '').split(';')) {
    const match = item.trim().match(/^ss_session=([a-f0-9]{64})$/);
    if (match) return match[1];
  }
  return null;
}

export function createAuth(config, store) {
  const attempts = new Map();
  const secure = config.origin.startsWith('https:') ? '; Secure' : '';
  const publicUser = user => ({ id: user.id, email: user.email, name: user.name });
  function setSession(response, token) {
    const attributes = `Path=/api; HttpOnly; SameSite=Lax${secure}`;
    response.setHeader('Set-Cookie', [
      `ss_session=${token || ''}; ${attributes}; Max-Age=${token ? sessionSeconds : 0}`,
      // Remove cookies left by the previous authentication implementation.
      `ss_access=; ${attributes}; Max-Age=0`,
      `ss_refresh=; ${attributes}; Max-Age=0`,
    ]);
  }
  async function sessionUser(request, response) {
    const token = sessionToken(request);
    if (!token) return null;
    const user = await store.sessionUser(hashSessionToken(token));
    if (!user) { setSession(response, null); return null; }
    return publicUser(user);
  }
  function checkAttempts(request) {
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.until <= now) attempts.delete(ip);
    const ip = request.socket?.remoteAddress || 'unknown';
    const entry = attempts.get(ip) || { count: 0, until: now + 10 * 60 * 1000 };
    attempts.set(ip, entry);
    if (++entry.count > 20) throw new HttpError(429, 'Too many sign-in attempts. Please try again in 10 minutes.');
  }
  return {
    async requireUser(request, response) {
      const user = await sessionUser(request, response);
      if (!user) throw new HttpError(401, 'Please sign in to access your account.');
      return user;
    },
    async handle(path, method, body, request, response) {
      if (path === '/api/auth/session' && method === 'GET') return { user: await sessionUser(request, response) };
      if (path === '/api/auth/signout' && method === 'POST') {
        const token = sessionToken(request);
        if (token) await store.deleteSession(hashSessionToken(token));
        setSession(response, null);
        return { user: null };
      }
      if (method !== 'POST' || !['/api/auth/signin', '/api/auth/signup'].includes(path)) throw new HttpError(404, 'Authentication route not found.');
      checkAttempts(request);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(400, 'Enter a valid email address.');
      if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) throw new HttpError(400, 'Password must contain 8–128 characters.');
      const token = randomBytes(32).toString('hex');
      const tokenHash = hashSessionToken(token);
      const expiresAt = new Date(Date.now() + sessionSeconds * 1000).toISOString();
      let user;
      if (path.endsWith('/signup')) {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (name.length < 2 || name.length > 100) throw new HttpError(400, 'Enter your name (2–100 characters).');
        user = await store.registerUser({ name, email, passwordHash: await hashPassword(body.password), tokenHash, expiresAt });
      } else {
        user = await store.userByEmail(email);
        if (!await verifyPassword(body.password, user?.password_hash)) throw new HttpError(401, 'Incorrect email or password.');
        await store.createSession({ userId: user.id, tokenHash, expiresAt });
      }
      // Rotate the browser session after successful authentication.
      const old = sessionToken(request);
      if (old) await store.deleteSession(hashSessionToken(old));
      setSession(response, token);
      return { user: publicUser(user) };
    },
  };
}
