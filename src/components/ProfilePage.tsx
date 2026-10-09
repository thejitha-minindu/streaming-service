import { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight, CreditCard, Heart, LoaderCircle, LogOut, MessageCircle, ShieldCheck, Wallet } from 'lucide-react';
import { api, type Account } from '../api';
import { money, plans } from '../data';

interface ProfilePageProps {
  account: Account | null;
  error: string;
  savedCount: number;
  onUpdate: (account: Account) => void;
  onChat: () => void;
  onRetry: () => void;
  onHome: () => void;
  onLibrary: () => void;
  onSignOut: () => Promise<void>;
  signingOut: boolean;
}

export default function ProfilePage({ account, error: accountError, savedCount, onUpdate, onChat, onRetry, onHome, onLibrary, onSignOut, signingOut }: ProfilePageProps) {
  const [busy, setBusy] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const paid = account?.subscription_status === 'active';
  const initials = account?.name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('') || 'S';
  const date = (value: string) => new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: account?.billing_timezone,
  }).format(new Date(value));

  async function buy() {
    setBusy(true); setPurchaseError('');
    try { onUpdate((await api.purchase()).account); }
    catch (error) { setPurchaseError(error instanceof Error ? error.message : 'Purchase failed. Please try again.'); }
    finally { setBusy(false); }
  }

  return <section className="profile-page" aria-labelledby="profile-heading">
    <div className="container profile-shell">
      <div className="profile-topbar"><button className="text-link profile-back" onClick={onHome}><ArrowLeft size={15} /> Back to discovering</button><button className="button button-outline button-small" disabled={signingOut} onClick={onSignOut}>{signingOut ? 'Logging out…' : 'Log out'} <LogOut size={15} /></button></div>
      <div className="profile-page-heading"><p className="eyebrow">YOUR ACCOUNT. YOUR CHOICE.</p><h1 id="profile-heading" tabIndex={-1}>A little world of your own.</h1><p>Your membership, your wallet, and a little help when you need it.</p></div>

      {!account ? <div className="profile-card profile-loading" role={accountError ? 'alert' : 'status'}>
        {accountError ? <><ShieldCheck size={25} /><h2>Let's reconnect.</h2><p>{accountError}</p><button className="button button-outline" onClick={onRetry}>Retry</button></> : <><LoaderCircle className="spin" size={25} /><h2>Getting your account ready…</h2><p>Your world will be here in a moment.</p></>}
      </div> : <>
        {accountError && <div className="profile-notice account-error" role="alert">We couldn't refresh your account. {accountError} <button className="text-link" onClick={onRetry}>Retry</button></div>}

        <div className="profile-overview profile-card">
          <div className="profile-person"><span className="profile-avatar" aria-hidden="true">{initials}</span><div><p className="eyebrow">MY ACCOUNT</p><h2>{account.name}</h2><p className="profile-email">{account.email}</p></div></div>
          <span className={`profile-status ${paid ? 'is-paid' : ''}`} role="status">{paid ? <ShieldCheck size={15} /> : <span className="profile-status-dot" />}{paid ? 'Paid member · Premium' : 'Non-paid member · Free'}</span>
        </div>

        <div className="profile-grid">
          <section className="profile-card profile-membership" aria-labelledby="membership-heading">
            <div className="profile-card-heading"><span className="profile-card-icon"><CreditCard size={20} strokeWidth={1.5} /></span><p className="eyebrow">YOUR MEMBERSHIP</p><span className="profile-small-tag">{paid ? 'ACTIVE' : 'FREE'}</span></div>
            <h2 id="membership-heading">{paid ? 'Premium. Every possibility.' : 'Your next chapter awaits.'}</h2>
            <p className="profile-card-description">{paid ? 'The full cinematic experience, made for you.' : 'A whole world of stories is here when you’re ready to return.'}</p>
            <div className="profile-plan-price"><strong>{money(account.price_cents / 100)}</strong><span>/ month{!paid && ' for Premium'}</span></div>
            {paid ? <ul className="profile-benefits">{plans.find(plan => plan.id === 'premium')!.features.map(feature => <li key={feature}><Check size={14} /><span>{feature}</span></li>)}</ul> : <p className="profile-cancelled-note">Your Premium access has ended. Buy now using your available wallet credit to start watching again.</p>}
            <div className="profile-billing-date"><CalendarDays size={16} /><span>{!paid && account.cancelled_at ? `Cancelled ${date(account.cancelled_at)}` : `Last charged ${date(account.charged_at)}`}</span></div>
            <button className="text-link profile-manage" onClick={onChat}>{paid ? 'Manage membership with support' : 'Questions about your membership?'} <ArrowRight size={15} /></button>
          </section>

          <section className="profile-card profile-wallet" aria-labelledby="wallet-heading">
            <div className="profile-card-heading"><span className="profile-card-icon"><Wallet size={20} strokeWidth={1.5} /></span><p className="eyebrow">YOUR WALLET</p><span className="profile-small-tag">USD</span></div>
            <h2 id="wallet-heading">A little credit. More possibilities.</h2>
            <p className="profile-card-description">Ready for your next great story.</p>
            <div className="profile-wallet-balance" aria-live="polite"><strong>{money(account.wallet_cents / 100)}</strong><span>Available wallet balance</span></div>
            <p className="profile-wallet-note">Refunds are credited here after an eligible cancellation. Use your balance towards your next Premium membership.</p>
            {!paid && <><button className="button button-primary full-width" disabled={busy || account.wallet_cents < account.price_cents} onClick={buy}>{busy ? <><LoaderCircle className="spin" size={17} /> Activating Premium…</> : <>Buy now · {money(account.price_cents / 100)} <ArrowRight size={17} /></>}</button><p className="profile-payment-note">{account.wallet_cents >= account.price_cents ? `${money(account.price_cents / 100)} will be paid from your wallet.` : 'Not enough wallet credit. Card payments are not connected in this demo.'}</p></>}
            {purchaseError && <p className="account-error" role="alert">{purchaseError}</p>}
            <div className="profile-wallet-footer"><ShieldCheck size={15} /><span>Demo wallet · No real card transactions</span></div>
          </section>

          <section className="profile-card profile-support" aria-labelledby="profile-support-heading">
            <span className="profile-card-icon"><MessageCircle size={23} strokeWidth={1.5} /></span><div className="profile-support-copy"><p className="eyebrow">WE'RE RIGHT HERE</p><h2 id="profile-support-heading">A little help, whenever you need it.</h2><p>Questions about your membership, cancellations, or refunds? Start a conversation with our assistant.</p></div><button className="button button-primary" onClick={onChat}>Chat with support <ArrowUpRight size={17} /></button>
          </section>

          <section className="profile-card profile-details" aria-labelledby="profile-details-heading">
            <p className="eyebrow">THE LITTLE DETAILS</p><h2 id="profile-details-heading">Account details</h2>
            <dl><div><dt>Name</dt><dd>{account.name}</dd></div><div><dt>Email address</dt><dd>{account.email}</dd></div><div><dt>Current plan</dt><dd>{paid ? 'Premium · Monthly' : 'Free · No paid subscription'}</dd></div><div><dt>Billing timezone</dt><dd>{account.billing_timezone.replace(/_/g, ' ')}</dd></div></dl>
          </section>

          <section className="profile-card profile-library" aria-labelledby="profile-library-heading">
            <span className="profile-card-icon"><Heart size={21} strokeWidth={1.5} /></span><p className="eyebrow">SAVED FOR A GOOD NIGHT IN</p><h2 id="profile-library-heading">Your next favorites, together.</h2><p>{savedCount ? `${savedCount} ${savedCount === 1 ? 'story' : 'stories'} saved in My list. Pick up wherever your curiosity takes you.` : 'A story catches your eye? Save it to My list and find it here whenever you’re ready.'}</p><button className="text-link" onClick={onLibrary}>Explore my library <ChevronRight size={17} /></button>
          </section>
        </div>
      </>}
    </div>
  </section>;
}
