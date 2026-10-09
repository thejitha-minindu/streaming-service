export function readConfig(env = process.env) {
  const required = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'DEMO_USER_ID', 'TOOL_API_KEY'];
  for (const key of required) if (!env[key]) throw new Error(`Missing ${key}. Copy .env.example to .env and complete the setup.`);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(env.DEMO_USER_ID)) throw new Error('DEMO_USER_ID must be a valid UUID.');
  if (env.TOOL_API_KEY.length < 32) throw new Error('TOOL_API_KEY must contain at least 32 characters.');
  for (const key of ['SUPABASE_URL', 'AGENT_CHAT_URL', 'AGENT_CONSENT_URL']) {
    if (!env[key]) continue;
    const url = new URL(env[key]);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      throw new Error(`${key} must use HTTPS (HTTP is allowed for localhost tests).`);
    }
  }
  const port = Number(env.PORT || 3001);
  const agentTimeout = Number(env.AGENT_TIMEOUT_MS || 60000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  if (!Number.isInteger(agentTimeout) || agentTimeout < 1000 || agentTimeout > 120000) throw new Error('AGENT_TIMEOUT_MS must be between 1000 and 120000.');
  const chatProvider = env.CHAT_PROVIDER || (env.GEMINI_API_KEY ? 'gemini' : 'agent-platform');
  if (!['gemini', 'agent-platform'].includes(chatProvider)) throw new Error('CHAT_PROVIDER must be gemini or agent-platform.');
  const geminiModel = env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!/^[a-zA-Z0-9._-]+$/.test(geminiModel)) throw new Error('Invalid GEMINI_MODEL. Enter a model ID, such as gemini-2.5-flash.');
  return {
    port, host: env.HOST || '127.0.0.1', origin: new URL(env.APP_ORIGIN || 'http://localhost:5173').origin,
    // Supabase's dashboard also shows the REST base URL. Accept either format.
    supabaseUrl: env.SUPABASE_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, ''), supabaseKey: env.SUPABASE_SECRET_KEY,
    userId: env.DEMO_USER_ID, toolKey: env.TOOL_API_KEY,
    chatUrl: env.AGENT_CHAT_URL, consentUrl: env.AGENT_CONSENT_URL,
    agentKey: env.AGENT_API_KEY, tenantId: env.AGENT_TENANT_ID, agentTimeout,
    chatProvider, geminiKey: env.GEMINI_API_KEY?.trim(), geminiModel,
  };
}

export function chatConfigured(config) {
  return config.chatProvider === 'gemini' ? Boolean(config.geminiKey) : Boolean(config.chatUrl && config.consentUrl && config.agentKey && config.tenantId);
}
