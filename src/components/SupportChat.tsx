import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, LoaderCircle, MessageCircle, ShieldCheck } from 'lucide-react';
import { api, chatSession, type Account, type ChatMessage, type ChatResult } from '../api';
import { money } from '../data';

export default function SupportChat({ onAccount }: { onAccount: (account: Account) => void }) {
  const [sessionId] = useState(chatSession);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    api.history(sessionId).then(result => { if (active) setMessages(result.messages); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' }); }, [messages, busy, error]);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  async function refresh() {
    const [history, account] = await Promise.all([api.history(sessionId), api.account()]);
    setMessages(history.messages); onAccount(account.account);
  }
  function apply(result: ChatResult) {
    onAccount(result.account);
    if (result.messages) setMessages(result.messages);
    else if (result.message) setMessages(previous => [...previous, result.message!]);
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy || loading) return;
    setInput(''); setBusy(true); setError('');
    setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'user', content: text }]);
    try { apply(await api.chat(sessionId, text)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send your message.'); }
    finally {
      // Recover database state even when a tool succeeded but the agent response timed out.
      await refresh().catch(() => {}); setBusy(false); inputRef.current?.focus();
    }
  }
  async function decide(message: ChatMessage, approved: boolean) {
    if (!message.consent || busy) return;
    setBusy(true); setError('');
    try { apply(await api.consent(sessionId, message.consent.id, approved)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not submit your decision.'); }
    finally { await refresh().catch(() => {}); setBusy(false); }
  }
  return <div className="support-chat">
    <div className="chat-heading"><span className="chat-symbol"><MessageCircle size={23} /></span><div><p className="eyebrow">A LITTLE HELP, RIGHT HERE</p><h3>StreamSphere assistant</h3><p>Memberships, cancellations &amp; refunds</p></div></div>
    <div className="chat-messages" role="log" aria-label="Support conversation" aria-live="polite" aria-relevant="additions text">
      <div className="chat-message assistant"><span className="chat-role">StreamSphere</span><p>Hi! How can I help with your membership today?</p></div>
      {loading && <p className="chat-status" role="status">Loading your conversation…</p>}
      {messages.map(message => <div key={message.id} className={`chat-message ${message.role}`}><span className="chat-role">{message.role === 'user' ? 'You' : 'StreamSphere'}</span><p>{message.content}</p>
        {message.consent && <div className="chat-consent">
          <p><ShieldCheck size={16} /> Your confirmation is required</p>
          <small>{message.consent.action === 'cancel_and_refund' ? `${money(message.consent.refund_amount_cents / 100)} will be credited to your wallet. This refund is only available today.` : 'Your membership will be cancelled without a refund.'} Your Premium access ends immediately.</small>
          {['pending', 'approved'].includes(message.consent.status) && new Date(message.consent.expires_at).getTime() > clock ? <div className="consent-actions"><button className="button button-primary button-small" disabled={busy} onClick={() => decide(message, true)}>{message.consent.status === 'approved' ? 'Retry approved action' : message.consent.action === 'cancel_and_refund' ? 'Cancel & Refund' : 'Cancel subscription'}</button>{message.consent.status === 'pending' && <button className="button button-outline button-small" disabled={busy} onClick={() => decide(message, false)}>Keep Subscription</button>}</div> : <small className="consent-state">{message.consent.status === 'executed' ? 'Completed' : message.consent.status === 'declined' ? 'You chose to keep your subscription.' : 'Confirmation expired. Ask the assistant again.'}</small>}
        </div>}
      </div>)}
      {busy && <p className="chat-status" role="status"><LoaderCircle size={15} className="spin" /> The assistant is working…</p>}
      <div ref={endRef} />
    </div>
    {error && <div className="chat-error" role="alert">{error}<button className="text-link" disabled={busy} onClick={() => { refresh().then(() => setError('')).catch(e => setError(e.message)); }}>Refresh conversation &amp; membership</button></div>}
    <form className="chat-form" onSubmit={send}><label className="sr-only" htmlFor="support-message">Your message</label><input ref={inputRef} id="support-message" placeholder="Ask about your membership…" autoComplete="off" maxLength={4000} value={input} disabled={busy || loading} onChange={event => setInput(event.target.value)} /><button type="submit" className="chat-send" aria-label="Send message" disabled={busy || loading || !input.trim()}><ArrowUp size={20} /></button></form>
    <p className="chat-footnote">Powered by Agent Platform · Demo wallet credits only</p>
  </div>;
}
