import { HttpError } from './store.mjs';

// Integration boundary: map your real Agent Platform request/response fields here.
// No local model, canned cancellation detection, or browser access to API secrets.
export function createAgent(config, fetcher = fetch) {
  async function call(url, payload, idempotencyKey) {
    if (!url || !config.agentKey || !config.tenantId) {
      throw new HttpError(503, 'The Agent Platform is not configured. Set AGENT_CHAT_URL, AGENT_CONSENT_URL, AGENT_API_KEY and AGENT_TENANT_ID on the backend.');
    }
    let response;
    try {
      response = await fetcher(url, {
        method: 'POST', headers: {
          'Content-Type': 'application/json', Authorization: `Bearer ${config.agentKey}`,
          'X-Tenant-Id': config.tenantId,
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(config.agentTimeout),
      });
    } catch {
      throw new HttpError(504, 'The Agent Platform did not respond in time. Check your membership before retrying an approved action.');
    }
    if (!response.ok) throw new HttpError(502, 'The Agent Platform could not complete this request. Please try again.');
    let result;
    try { result = await response.json(); } catch { throw new HttpError(502, 'The Agent Platform must return a JSON response.'); }
    if (typeof result.reply !== 'string' || !result.reply.trim() || result.reply.length > 20000) {
      throw new HttpError(502, 'Unexpected Agent Platform response. Check server/agent.mjs and the integration guide.');
    }
    if (result.consent) {
      const c = result.consent;
      if (typeof c.token !== 'string' || !c.token || c.token.length > 4096 ||
          typeof c.execution_id !== 'string' || !c.execution_id || c.execution_id.length > 256 ||
          !['cancel_and_refund', 'cancel_subscription'].includes(c.action) ||
          !Number.isSafeInteger(c.refund_amount_cents) || c.refund_amount_cents < 0) {
        throw new HttpError(502, 'Invalid Agent Platform consent response. Check the documented consent contract.');
      }
    }
    return result;
  }
  return {
    chat({ sessionId, message, account }) {
      return call(config.chatUrl, { session_id: sessionId, user_id: config.userId, message, account });
    },
    consent({ sessionId, consent, approved }) {
      return call(config.consentUrl, {
        session_id: sessionId, user_id: config.userId, consent_token: consent.upstream_token,
        consent_id: consent.id, execution_id: consent.execution_id, approved,
      }, consent.id);
    },
  };
}
