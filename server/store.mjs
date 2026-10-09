export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createStore(config, fetcher = fetch) {
  async function request(path, options = {}) {
    const key = config.supabaseKey;
    const response = await fetcher(`${config.supabaseUrl}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: key,
        // New sb_secret keys use apikey only; legacy JWT service_role keys also use Bearer.
        ...(!key.startsWith('sb_secret_') ? { Authorization: `Bearer ${key}` } : {}),
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (error.code === 'P0001') throw new HttpError(409, error.message);
      if (error.code === '23505') throw new HttpError(409, 'An account already uses this email. Please sign in.');
      if (error.code === 'P0002') throw new HttpError(404, 'Account or consent was not found. Check the database seed.');
      if (error.code === 'PGRST125') throw new HttpError(503, 'Invalid Supabase API path. Set SUPABASE_URL to the project URL without /rest/v1, then restart the API.');
      if (['PGRST205', 'PGRST202', '42P01', '42883'].includes(error.code)) throw new HttpError(503, 'Database setup is incomplete. Run supabase/001_schema.sql and supabase/005_normal_authentication.sql in your Supabase SQL Editor.');
      console.error('Supabase request failed:', response.status, error.code);
      throw new HttpError(503, 'Database unavailable. Check the Supabase configuration and setup scripts.');
    }
    return response.status === 204 ? null : response.json();
  }
  return {
    registerUser({ name, email, passwordHash, tokenHash, expiresAt }) {
      return request('rpc/register_app_user', { method: 'POST', body: JSON.stringify({ p_name: name, p_email: email, p_password_hash: passwordHash, p_token_hash: tokenHash, p_expires_at: expiresAt }) });
    },
    async userByEmail(email) {
      const rows = await request(`app_users?email=eq.${encodeURIComponent(email)}&select=id,name,email,password_hash`);
      return rows[0] || null;
    },
    createSession({ userId, tokenHash, expiresAt }) {
      return request('rpc/start_app_session', { method: 'POST', body: JSON.stringify({ p_user_id: userId, p_token_hash: tokenHash, p_expires_at: expiresAt }) });
    },
    sessionUser(tokenHash) { return request('rpc/get_app_session', { method: 'POST', body: JSON.stringify({ p_token_hash: tokenHash }) }); },
    deleteSession(tokenHash) { return request(`app_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`, { method: 'DELETE' }); },
    setUserPassword(email, passwordHash) { return request('rpc/set_app_user_password', { method: 'POST', body: JSON.stringify({ p_email: email, p_password_hash: passwordHash }) }); },
    forAccount(userId) { return createStore({ ...config, userId }, fetcher); },
    async registeredAccount(userId) {
      const rows = await request(`user_profiles?id=eq.${encodeURIComponent(userId)}&select=account_id`);
      if (!rows[0]) throw new HttpError(503, 'Your profile is not ready. Run supabase/005_normal_authentication.sql in the Supabase SQL Editor.');
      return createStore({ ...config, userId: rows[0].account_id }, fetcher);
    },
    async consentAccount(consentId) {
      const rows = await request(`agent_consents?id=eq.${encodeURIComponent(consentId)}&select=account_id`);
      if (!rows[0]) throw new HttpError(404, 'Confirmation was not found.');
      return createStore({ ...config, userId: rows[0].account_id }, fetcher);
    },
    async account() {
      const rows = await request(`demo_accounts?id=eq.${config.userId}&select=*`);
      if (!rows[0]) throw new HttpError(503, 'Demo member not found. Run supabase/002_seed.sql.');
      return rows[0];
    },
    rpc(name, args) { return request(`rpc/${name}`, { method: 'POST', body: JSON.stringify({ p_account_id: config.userId, ...args }) }); },
    async message(sessionId, role, content, consentId = null) {
      const rows = await request('chat_messages', { method: 'POST', body: JSON.stringify({ account_id: config.userId, session_id: sessionId, role, content, consent_id: consentId }) });
      return rows[0];
    },
    history(sessionId) {
      return request(`chat_messages?account_id=eq.${config.userId}&session_id=eq.${sessionId}&select=id,role,content,created_at,consent:agent_consents(id,action,refund_amount_cents,status,expires_at)&order=id.desc&limit=100`).then(rows => rows.reverse());
    },
  };
}
