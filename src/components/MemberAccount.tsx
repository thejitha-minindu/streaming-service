import { ArrowRight, MessageCircle, Wallet } from 'lucide-react';
import type { Account } from '../api';
import { money } from '../data';

export function MemberSummary({ account, error, onAccount, onChat, onRetry, signedIn = false, loading = false }: {
  account: Account | null; error: string; onAccount: () => void; onChat: () => void; onRetry: () => void;
  signedIn?: boolean; loading?: boolean;
}) {
  return <section className="member-section" aria-label="Your membership">
    <div className="container member-summary" aria-live="polite">
      <div className="member-identity"><span className="member-avatar">{account?.name.charAt(0) || 'S'}</span><div>
        <p className="eyebrow">YOUR STREAMSPHERE</p><h2>{account ? `Welcome back, ${account.name.split(' ')[0]}.` : error ? 'Your account is unavailable.' : loading || signedIn ? 'Loading your membership…' : 'Your next chapter is waiting.'}</h2>
        {!signedIn && !loading && <p>Sign in for your membership, wallet, and personal support.</p>}
        {account && <p>{account.subscription_status === 'active' ? 'Premium · Paid member' : 'Free · Non-paid member'}</p>}
        {error && <p className="account-error" role="alert">{error} <button className="text-link" onClick={onRetry}>Retry</button></p>}
      </div></div>
      {account && <div className="member-wallet"><Wallet size={20} /><div><span>Wallet balance</span><strong>{money(account.wallet_cents / 100)}</strong></div></div>}
      <div className="member-actions"><button className="button button-outline button-small" onClick={onChat}><MessageCircle size={16} /> Get support</button><button className="button button-primary button-small" onClick={onAccount}>{!signedIn ? 'Sign in' : account?.subscription_status === 'cancelled' ? 'Buy now' : 'My membership'} <ArrowRight size={15} /></button></div>
    </div>
  </section>;
}

