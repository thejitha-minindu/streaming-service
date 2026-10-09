import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { api, type AuthUser } from '../api';
import { heroImage } from '../data';

interface Props {
  mode: 'signin' | 'signup';
  onMode: (mode: 'signin' | 'signup') => void;
  onSuccess: (user: AuthUser) => void;
  onHome: () => void;
  sessionError?: string;
}

export default function AuthPage({ mode, onMode, onSuccess, onHome, sessionError }: Props) {
  const signup = mode === 'signup';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const result = signup ? await api.signup(name.trim(), email.trim(), password) : await api.signin(email.trim(), password);
      setPassword('');
      if (!result.user) throw new Error('Unable to sign in. Please try again.');
      onSuccess(result.user);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to continue. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section className="auth-page" aria-labelledby="auth-heading">
    <div className="container auth-layout">
      <div className="auth-story"><img src={heroImage} alt="" /><div className="auth-story-shade" /><div className="auth-story-copy"><p className="eyebrow">EVERY STORY. ONE WORLD.</p><h2>Your next chapter<br />starts here.</h2><p>A little escape. A new favorite. A world that feels like yours.</p><ul><li><Check size={16} /> Extraordinary stories, together</li><li><Check size={16} /> Your membership, on your terms</li><li><Check size={16} /> A little help, whenever you need it</li></ul></div></div>
      <div className="auth-card profile-card">
        <button className="text-link auth-back" onClick={onHome}><ArrowLeft size={14} /> Back to discovering</button>
        <span className="profile-card-icon"><LockKeyhole size={21} /></span>
        <p className="eyebrow">{signup ? 'MAKE YOURSELF AT HOME' : 'YOUR WORLD IS WAITING'}</p>
        <h1 id="auth-heading" tabIndex={-1}>{signup ? 'Create your account.' : 'Welcome back.'}</h1>
        <p className="auth-description">{signup ? 'Your name, email, and a password. Then you’re in.' : 'Sign in with your email and password to pick up where you left off.'}</p>
        <form className="auth-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            {signup && <label htmlFor="auth-name">Full name<input id="auth-name" name="name" autoComplete="name" placeholder="Your name" minLength={2} maxLength={100} required value={name} onChange={e => setName(e.target.value)} /></label>}
            <label htmlFor="auth-email">Email address<input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label htmlFor="auth-password">Password<span className="auth-password"><input id="auth-password" name="password" aria-label="Password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} placeholder={signup ? 'At least 8 characters' : 'Your password'} minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
            {(error || sessionError) && <p className="auth-error" role="alert">{error || sessionError}</p>}
            <button type="submit" className="button button-primary full-width">{busy ? <><LoaderCircle className="spin" size={17} /> {signup ? 'Creating your account…' : 'Signing you in…'}</> : <>{signup ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></>}</button>
          </fieldset>
        </form>
        <p className="auth-switch">{signup ? 'Already part of the story?' : 'New to StreamSphere?'} <button className="text-link" disabled={busy} onClick={() => onMode(signup ? 'signin' : 'signup')}>{signup ? 'Sign in' : 'Create an account'} <ArrowRight size={13} /></button></p>
        <p className="auth-note"><ShieldCheck size={14} /> Your account. Your choice. Always.</p>
      </div>
    </div>
  </section>;
}
