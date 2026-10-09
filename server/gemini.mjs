import { randomUUID } from 'node:crypto';
import { HttpError } from './store.mjs';

const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export function createGeminiAgent(config, store, fetcher = fetch) {
  return {
    async chat({ sessionId, message, account }) {
      if (!config.geminiKey) throw new HttpError(503, 'Support chat needs GEMINI_API_KEY in the backend .env file. Restart the API after updating it.');
      const day = value => new Intl.DateTimeFormat('en-CA', { timeZone: account.billing_timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
      const eligible = account.subscription_status === 'active' && day(account.charged_at) === day(Date.now());
      const history = (await store.history(sessionId)).slice(-20);
      const contents = history.map(row => ({
        role: row.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: row.content + (row.consent ? `\n[Confirmation status: ${row.consent.status}]` : '') }],
      }));
      if (history.at(-1)?.role !== 'user' || history.at(-1)?.content !== message) contents.push({ role: 'user', parts: [{ text: message }] });
      const context = {
        membership: account.subscription_status === 'active' ? 'Paid Premium' : 'Non-paid Free',
        price: money(account.price_cents), wallet: money(account.wallet_cents),
        same_day_refund_eligible: eligible, charged_at: account.charged_at, timezone: account.billing_timezone,
      };
      let response;
      try {
        response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiKey },
          signal: AbortSignal.timeout(config.agentTimeout),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: `You are StreamSphere customer support. Be friendly, concise, and use plain text. Current authoritative account: ${JSON.stringify(context)}. Answer membership, wallet and streaming support questions. Paid Premium ends immediately on cancellation. Only charges from today in the billing timezone qualify for a full refund to the demo wallet, never a card or cash. Older charges can be cancelled without a refund. Buy now uses wallet credit to repurchase Premium. When the user asks to cancel/remove their paid service or requests a refund, call request_cancellation to show the confirmation buttons. Do not call it for informational questions, a user declining cancellation, or an already Free account. The function only requests confirmation. Never claim a cancellation, refund, or purchase has completed based on conversation text. Only the current account state is authoritative. A typed yes cannot execute cancellation: the user must click the confirmation button. Never invent account changes or refund amounts.` }] },
            contents,
            tools: [{ functionDeclarations: [{ name: 'request_cancellation', description: 'Show the user a confirmation to cancel their current paid membership, including the refund if eligible. Does not cancel or credit anything.' }] }],
            generationConfig: { maxOutputTokens: 2048 },
          }),
        });
      } catch { throw new HttpError(504, 'Support chat could not reach Gemini. Please try again.'); }
      if (!response.ok) {
        if ([400, 401, 403].includes(response.status)) throw new HttpError(502, 'Gemini rejected the request. Check GEMINI_API_KEY and API access on the backend, then restart the API.');
        if (response.status === 429) throw new HttpError(503, 'Gemini quota or rate limit reached. Check the API project quota and billing, then try again.');
        if (response.status === 404) throw new HttpError(502, 'The configured Gemini model is unavailable. Check GEMINI_MODEL on the backend.');
        throw new HttpError(502, 'Gemini could not complete this request. Please try again.');
      }
      let result;
      try { result = await response.json(); } catch { throw new HttpError(502, 'Gemini returned an unreadable response. Please try again.'); }
      const parts = result.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter(part => part.functionCall && !part.thought);
      if (calls.length) {
        if (calls.length !== 1 || calls[0].functionCall.name !== 'request_cancellation') throw new HttpError(502, 'Unexpected support action. Please try again.');
        if (account.subscription_status !== 'active') return { reply: `You are already on the Free plan. Your wallet balance is ${money(account.wallet_cents)}.` };
        return {
          reply: eligible
            ? `Cancel Premium and credit ${money(account.price_cents)} to your demo wallet? Premium access ends immediately. Please use the confirmation buttons below.`
            : 'Cancel Premium? Access ends immediately. This charge is outside the same-day refund window, so no refund will be credited. Please use the confirmation buttons below.',
          consent: { token: randomUUID(), execution_id: `gemini:${randomUUID()}`, action: eligible ? 'cancel_and_refund' : 'cancel_subscription', refund_amount_cents: eligible ? account.price_cents : 0 },
        };
      }
      const reply = parts.filter(part => typeof part.text === 'string' && !part.thought).map(part => part.text).join('').trim();
      if (!reply || reply.length > 20000) throw new HttpError(502, 'Gemini did not return a usable reply. Please rephrase and try again.');
      return { reply };
    },
    async consent({ consent, approved }) {
      if (!consent.execution_id.startsWith('gemini:')) throw new HttpError(409, 'Chat provider changed. Please ask support for a new confirmation.');
      if (!approved) {
        const account = await store.account();
        return { reply: `Cancellation declined. Your current plan is ${account.subscription_status === 'active' ? 'Paid Premium' : 'Free'}, and your wallet balance is ${money(account.wallet_cents)}.` };
      }
      // The database checks approval, expiry, charge binding and idempotency atomically.
      const result = await store.rpc('execute_demo_cancellation', { p_consent_id: consent.id });
      return { reply: `Your Premium membership has been cancelled. You are now on the Free plan.${result.refund_amount_cents ? ` ${money(result.refund_amount_cents)} was credited to your demo wallet.` : ' No refund was eligible.'} Your wallet balance is ${money(result.account.wallet_cents)}. You can use Buy now to purchase Premium with wallet credit.` };
    },
  };
}
