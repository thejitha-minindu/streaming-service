import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, Check, Compass, Download, Heart, Laptop, LogOut, Menu,
  MessageCircle, Monitor, Play, Plus, ShieldCheck, Smartphone, Sparkles, Star, X,
} from 'lucide-react';
import Brand from './components/Brand';
import FilmCard from './components/FilmCard';
import Modal from './components/Modal';
import { MemberSummary } from './components/MemberAccount';
import ProfilePage from './components/ProfilePage';
import SupportChat from './components/SupportChat';
import AuthPage from './components/AuthPage';
import { api, type Account, type AuthUser } from './api';
import {
  BillingControl, CatalogDialog, CookieDialog, FAQItem, FilmDialog, InfoDialog,
  TrailerDialog,
} from './components/Dialogs';
import {
  faqs, films, heroImage, memberPhotos, money, planPrice, plans, readStored, testimonials, writeStored,
  type Billing, type Collection, type FilmTitle, type InfoPage,
} from './data';

type SiteModal =
  | { type: 'chat' }
  | { type: 'catalog'; collection: Collection }
  | { type: 'film'; film: FilmTitle }
  | { type: 'trailer' }
  | { type: 'info'; page: InfoPage }
  | { type: 'cookies' }
  | null;

const heroStagger = { hidden: {}, visible: { transition: { staggerChildren: 0.14, delayChildren: 0.15 } } };
const heroEntrance = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } } };

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className={className} initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

function Stars() {
  return <span className="stars" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} strokeWidth={1.2} fill="currentColor" />)}</span>;
}

function DeviceShowcase({ onPreview, saved, onSave }: { onPreview: () => void; saved: boolean; onSave: () => void }) {
  const [device, setDevice] = useState<'tv' | 'laptop' | 'phone'>('tv');
  const devices = [{ id: 'tv', label: 'Smart TV', icon: Monitor }, { id: 'laptop', label: 'Laptop', icon: Laptop }, { id: 'phone', label: 'Phone', icon: Smartphone }] as const;

  return (
    <section className="showcase-section section-space" id="experience" aria-labelledby="showcase-heading">
      <div className="container showcase-layout">
        <Reveal className="showcase-copy">
          <p className="eyebrow">YOUR WORLD. ON EVERY SCREEN.</p>
          <h2 id="showcase-heading">Big-screen magic.<br />Any-size screen.</h2>
          <p className="section-description">From the living room to the last train home, your favorite stories go where you go. Pick up right where the good part left off.</p>
          <div className="device-tabs" role="tablist" aria-label="Preview StreamSphere on a device">
            {devices.map(({ id, label, icon: Icon }) => <button key={id} id={`device-tab-${id}`} role="tab" aria-selected={device === id} aria-controls="device-preview" tabIndex={device === id ? 0 : -1} className={device === id ? 'selected' : ''} onClick={() => setDevice(id)} onKeyDown={event => {
              const index = devices.findIndex(item => item.id === device);
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                event.preventDefault();
                const next = devices[(index + (event.key === 'ArrowRight' ? 1 : -1) + devices.length) % devices.length].id;
                setDevice(next);
                document.getElementById(`device-tab-${next}`)?.focus();
              } else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                const next = devices[event.key === 'Home' ? 0 : devices.length - 1].id;
                setDevice(next);
                document.getElementById(`device-tab-${next}`)?.focus();
              }
            }}><Icon size={23} strokeWidth={1.5} /><span>{label}</span>{device === id && <motion.span className="device-tab-line" layoutId="device-tab-line" />}</button>)}
          </div>
          <p className="device-note">One account. Seamlessly connected.</p>
        </Reveal>
        <Reveal className="device-stage" delay={0.12}>
          <div className="device-glow" aria-hidden="true" />
          <div id="device-preview" role="tabpanel" aria-labelledby={`device-tab-${device}`} className="device-panel">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={device} className={`device device-${device}`} initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: -5 }} transition={{ duration: 0.25 }}>
                <div className="device-bezel">
                  {device === 'phone' && <div className="phone-notch" aria-hidden="true" />}
                  <div className="device-screen">
                    <img className="device-screen-image" src={heroImage} alt="StreamSphere interface featuring Beyond the Horizon" loading="lazy" width="1280" height="720" />
                    <div className="device-screen-shade" />
                    <div className="screen-nav"><Brand compact /><div className="screen-nav-items" aria-hidden="true"><span className="screen-nav-active">For you</span><span>Movies</span><span>Series</span></div><span className="screen-avatar" aria-hidden="true">S</span></div>
                    <div className="screen-story">
                      <p>A STREAMSPHERE ORIGINAL</p>
                      <h3>BEYOND<br />THE HORIZON</h3>
                      <span className="screen-story-meta">2026 &nbsp; &middot; &nbsp; Adventure &nbsp; &middot; &nbsp; 2h 12m</span>
                      <div className="screen-actions"><button onClick={onPreview}><Play size={11} fill="currentColor" /> Play preview</button><button className={saved ? 'screen-saved' : ''} onClick={onSave} aria-label={saved ? 'Remove Beyond the Horizon from My list' : 'Add Beyond the Horizon to My list'} aria-pressed={saved}>{saved ? <Check size={14} /> : <Plus size={14} />}</button></div>
                    </div>
                    <div className="screen-bottom"><span>Stories that stay with you.</span><span aria-hidden="true">4K UHD</span></div>
                  </div>
                </div>
                {device === 'tv' && <div className="tv-stand" aria-hidden="true"><span /><span /></div>}
                {device === 'laptop' && <div className="laptop-base" aria-hidden="true"><span /></div>}
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function initialFavorites(key: string) {
  const value = readStored<unknown>(key, []);
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && films.some(film => film.id === item)))] : [];
}

export default function App() {
  const [profilePage, setProfilePage] = useState(() => /^\/profile\/?$/.test(window.location.pathname));
  const [authPage, setAuthPage] = useState<'signin' | 'signup' | null>(() => /^\/(signin|signup)\/?$/.test(window.location.pathname) ? window.location.pathname.includes('signup') ? 'signup' : 'signin' : null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const userRef = useRef(user);
  userRef.current = user;
  const authInitialization = useRef<ReturnType<typeof api.session> | null>(null);
  const [modal, setModal] = useState<SiteModal>(null);
  const [billing, setBilling] = useState<Billing>('monthly');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountError] = useState('');
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const [toast, setToast] = useState('');
  const pageRef = useRef<HTMLDivElement>(null);
  const closeModal = useCallback(() => setModal(null), []);
  const notify = useCallback((message: string) => setToast(message), []);
  const modalOpen = modal !== null;
  const homeLink = (anchor: string) => `${profilePage || authPage ? '/' : ''}#${anchor}`;

  useEffect(() => {
    const onPopState = () => {
      setProfilePage(/^\/profile\/?$/.test(window.location.pathname));
      setAuthPage(/^\/(signin|signup)\/?$/.test(window.location.pathname) ? window.location.pathname.includes('signup') ? 'signup' : 'signin' : null);
      setModal(null);
      setMobileMenu(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.title = authPage ? `${authPage === 'signup' ? 'Create account' : 'Sign in'} | StreamSphere` : profilePage ? 'My account | StreamSphere' : 'StreamSphere | Every Story. One World.';
    if (profilePage) document.getElementById('profile-heading')?.focus({ preventScroll: true });
    if (authPage) document.getElementById('auth-heading')?.focus({ preventScroll: true });
  }, [profilePage, authPage]);
  useEffect(() => {
    let active = true;
    if (!authInitialization.current) authInitialization.current = api.session();
    const pending = authInitialization.current;
    pending.then(result => {
      if (!active) return;
      setUser(result.user);
      if (result.user && /^\/(signin|signup)\/?$/.test(window.location.pathname)) {
        window.history.replaceState(null, '', '/profile'); setAuthPage(null); setProfilePage(true);
      }
    }).catch(e => { if (active) setAuthError(e.message); }).finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const expire = () => { setUser(null); setAccount(null); setModal(null); };
    window.addEventListener('streamsphere-session-expired', expire);
    return () => window.removeEventListener('streamsphere-session-expired', expire);
  }, []);
  useEffect(() => {
    if (!authLoading && profilePage && !user) {
      window.history.replaceState(null, '', '/signin'); setProfilePage(false); setAuthPage('signin');
    }
  }, [authLoading, profilePage, user]);
  const refreshAccount = useCallback(async () => {
    if (!user) { setAccount(null); setAccountError(''); return; }
    try {
      const result = await api.account();
      if (userRef.current?.id === user.id) { setAccount(result.account); setAccountError(''); }
    } catch (error) { if (userRef.current?.id === user.id) setAccountError(error instanceof Error ? error.message : 'Could not load your account.'); }
  }, [user?.id]);
  useEffect(() => {
    void refreshAccount();
    const timer = window.setInterval(() => { if (!document.hidden) void refreshAccount(); }, 5000);
    const onFocus = () => { void refreshAccount(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [refreshAccount]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    const onResize = () => { if (window.innerWidth >= 900) setMobileMenu(false); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
  }, []);

  useEffect(() => {
    if (!mobileMenu) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMobileMenu(false); document.getElementById('mobile-menu-toggle')?.focus(); } };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileMenu]);

  useEffect(() => {
    if (modalOpen) pageRef.current?.setAttribute('inert', '');
    else pageRef.current?.removeAttribute('inert');
    return () => pageRef.current?.removeAttribute('inert');
  }, [modalOpen]);

  useEffect(() => { setFavorites(user ? initialFavorites(`streamsphere-watchlist:${user.id}`) : []); }, [user?.id]);
  const favoritesOwner = useRef<string | null>(null);
  useEffect(() => {
    if (user && favoritesOwner.current === user.id) writeStored(`streamsphere-watchlist:${user.id}`, favorites);
    favoritesOwner.current = user?.id || null;
  }, [favorites, user?.id]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openAccount() {
    if (!user) { openAuth('signin'); return; }
    setMobileMenu(false);
    setModal(null);
    if (!/^\/profile\/?$/.test(window.location.pathname)) window.history.pushState(null, '', '/profile');
    setProfilePage(true);
    setAuthPage(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function openHome() {
    setMobileMenu(false);
    setModal(null);
    window.history.pushState(null, '', '/');
    setProfilePage(false);
    setAuthPage(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function openAuth(mode: 'signin' | 'signup') {
    setMobileMenu(false); setModal(null); setProfilePage(false); setAuthPage(mode); setAuthError('');
    window.history.pushState(null, '', `/${mode}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function signedIn(next: AuthUser) {
    setUser(next); setAccount(null); setAuthError('');
    try { sessionStorage.removeItem('streamsphere-chat-session'); } catch { /* Storage can be disabled. */ }
    window.history.replaceState(null, '', '/profile'); setAuthPage(null); setProfilePage(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await api.signout();
      setUser(null); setAccount(null); setFavorites([]); setModal(null);
      try { sessionStorage.removeItem('streamsphere-chat-session'); } catch { /* Storage can be disabled. */ }
      openHome(); notify('You have been logged out. See you for the next story.');
    } catch (e) { notify(e instanceof Error ? e.message : 'Could not log out. Please try again.'); }
    finally { setSigningOut(false); }
  }
  function openChat() { if (user) setModal({ type: 'chat' }); else openAuth('signin'); }

  function openCatalog(collection: Collection = 'All') {
    if (collection === 'My list' && !user) { openAuth('signin'); return; }
    setMobileMenu(false);
    setModal({ type: 'catalog', collection });
  }

  function toggleFavorite(id: string) {
    if (!user) { openAuth('signin'); return; }
    const saved = favorites.includes(id);
    setFavorites(previous => saved ? previous.filter(item => item !== id) : [...previous, id]);
    notify(saved ? 'Removed from My list' : 'A new favorite, saved to My list');
  }

  const modalTitle = modal?.type === 'chat' ? 'Chat with StreamSphere support' : modal?.type === 'catalog' ? 'Explore the StreamSphere collection' : modal?.type === 'film' ? modal.film.title : modal?.type === 'trailer' ? 'Watch the StreamSphere experience' : modal?.type === 'cookies' ? 'Your cookie preferences' : modal?.type === 'info' ? `StreamSphere ${modal.page}` : '';
  const modalClass = modal?.type === 'chat' ? 'modal-chat' : modal?.type === 'catalog' ? 'modal-catalog' : modal?.type === 'trailer' ? 'modal-trailer' : modal?.type === 'film' ? 'modal-film' : modal?.type === 'info' ? 'modal-info' : '';

  return (
    <MotionConfig reducedMotion="user">
      <div ref={pageRef} className="site" id="top">
        <a className="skip-link" href="#main">Skip to content</a>
        <motion.header className={`site-header ${profilePage || authPage || scrolled || mobileMenu ? 'header-solid' : ''}`} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="container navbar">
            <a className="brand-link" href={homeLink('top')} aria-label="StreamSphere home"><Brand /></a>
            <nav className="desktop-nav" aria-label="Main navigation"><a href={homeLink('discover')}>Discover</a><a href={homeLink('features')}>Why StreamSphere</a><a href={homeLink('pricing')}>Pricing</a><a href={homeLink('faq')}>FAQs</a></nav>
            <div className="nav-actions"><button className="nav-signin" onClick={() => user ? openCatalog('My list') : openAuth('signin')}>{user ? 'My library' : 'Sign in'}</button>{user && <button className="nav-signin nav-logout" disabled={signingOut} onClick={signOut}>{signingOut ? 'Logging out…' : 'Log out'} <LogOut size={14} /></button>}<button className="button button-primary button-small" disabled={authLoading} onClick={() => user ? openAccount() : openAuth('signup')}>{user ? account?.subscription_status === 'cancelled' ? 'Buy now' : 'My account' : 'Get started'} <ArrowUpRight size={15} /></button></div>
            <button id="mobile-menu-toggle" className="menu-toggle icon-button" aria-label={mobileMenu ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenu} aria-controls={mobileMenu ? 'mobile-navigation' : undefined} onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X size={23} /> : <Menu size={23} />}</button>
          </div>
          <AnimatePresence>{mobileMenu && <motion.nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}><div className="container"><a href={homeLink('discover')} onClick={() => setMobileMenu(false)}>Discover <ArrowUpRight size={17} /></a><a href={homeLink('features')} onClick={() => setMobileMenu(false)}>Why StreamSphere <ArrowUpRight size={17} /></a><a href={homeLink('pricing')} onClick={() => setMobileMenu(false)}>Pricing <ArrowUpRight size={17} /></a><a href={homeLink('faq')} onClick={() => setMobileMenu(false)}>FAQs <ArrowUpRight size={17} /></a><button onClick={() => { setMobileMenu(false); openCatalog('My list'); }}>My library <ArrowRight size={17} /></button>{user ? <button disabled={signingOut} onClick={signOut}>{signingOut ? 'Logging out…' : 'Log out'} <LogOut size={17} /></button> : <button onClick={() => openAuth('signin')}>Sign in <ArrowRight size={17} /></button>}<button className="button button-primary" onClick={() => user ? openAccount() : openAuth('signup')}>{user ? account?.subscription_status === 'cancelled' ? 'Buy now' : 'My account' : 'Create account'} <ArrowUpRight size={17} /></button></div></motion.nav>}</AnimatePresence>
        </motion.header>

        <main id="main" tabIndex={-1}>
          {authPage ? <AuthPage key={authPage} mode={authPage} onMode={openAuth} onSuccess={signedIn} onHome={openHome} sessionError={authError} /> : profilePage ? <ProfilePage account={account} error={accountError} savedCount={favorites.length} onSignOut={signOut} signingOut={signingOut} onUpdate={next => { if (user && userRef.current?.id === user.id) setAccount(next); }} onChat={openChat} onRetry={refreshAccount} onHome={openHome} onLibrary={() => openCatalog('My list')} /> : <>
          <section className="hero" aria-labelledby="hero-heading">
            <div className="hero-media" aria-hidden="true"><img src={heroImage} alt="" width="1280" height="720" fetchPriority="high" /></div>
            <div className="hero-shade" aria-hidden="true" />
            <motion.div className="container hero-content" variants={heroStagger} initial="hidden" animate="visible">
              <motion.p className="eyebrow hero-eyebrow" variants={heroEntrance}>A WORLD WORTH GETTING LOST IN</motion.p>
              <motion.h1 id="hero-heading" variants={heroEntrance}><span className="hero-line">Every story.</span><span className="hero-line">One <span className="hero-brand">StreamSphere.</span></span></motion.h1>
              <motion.p className="hero-description" variants={heroEntrance}>Extraordinary movies. Unmissable series. A whole world of entertainment, brought together for you.</motion.p>
              <motion.div className="hero-cta-group" variants={heroEntrance}><button className="button button-primary" onClick={() => openAccount()}>{!user ? 'Start your story' : account?.subscription_status === 'cancelled' ? 'Buy now' : 'My membership'} <ArrowRight size={18} /></button><button className="watch-button" onClick={() => setModal({ type: 'trailer' })}><span className="watch-play"><Play size={13} fill="currentColor" /></span>Watch the experience</button></motion.div>
              <motion.p className="hero-reassurance" variants={heroEntrance}>Great stories. Your membership. Your choice.</motion.p>
            </motion.div>
          </section>

          <MemberSummary signedIn={Boolean(user)} loading={authLoading} account={account} error={accountError} onAccount={openAccount} onChat={openChat} onRetry={refreshAccount} />
          <section className="social-proof" aria-label="A community of story lovers"><div className="container social-proof-content"><div className="community-avatars" aria-hidden="true">{memberPhotos.map((image, index) => <img src={image} key={image} alt="" loading="lazy" width="40" height="40" style={{ zIndex: 4 - index }} />)}</div><p><strong>Great stories. Even better company.</strong><span>A whole world of movie lovers. Right here.</span></p><span className="proof-divider" aria-hidden="true" /><span className="proof-endnote">Find your people. Find your next play.</span></div></section>

          <section className="discover-section section-space" id="discover" aria-labelledby="discover-heading">
            <div className="container">
              <Reveal className="section-heading-row"><div><p className="eyebrow">THE STORIES YOU'LL STAY UP FOR</p><h2 id="discover-heading">Meet your next obsession.</h2><p className="section-description">Fresh perspectives. Familiar favorites. Unforgettable originals.</p></div><button className="text-link" onClick={() => openCatalog()}>Explore the collection <ArrowUpRight size={18} /></button></Reveal>
              <div className="film-grid">{films.slice(0, 5).map((film, index) => <Reveal key={film.id} delay={index * 0.065}><FilmCard film={film} onSelect={selected => setModal({ type: 'film', film: selected })} /></Reveal>)}</div>
              <div className="collection-footnote"><span>New worlds. New stories. Every week.</span><button className="text-link" onClick={() => openCatalog('Movies')}>Find your kind of movie <ArrowRight size={15} /></button></div>
            </div>
          </section>

          <section className="features-section section-space" id="features" aria-labelledby="features-heading">
            <div className="container">
              <Reveal className="section-heading centered"><p className="eyebrow">LESS FRICTION. MORE FEELING.</p><h2 id="features-heading">Everything you love.<br />Nothing in the way.</h2><p className="section-description">Thoughtfully made for the way you actually watch.</p></Reveal>
              <div className="features-grid">{[
                { icon: Compass, title: 'Feels like it knows you.', description: 'Find the unexpected favorite, not the endless scroll. Personal recommendations put stories you will love front and center.' },
                { icon: Sparkles, title: 'Cinema, without compromise.', description: 'Feel every frame with stunning 4K, rich HDR, and immersive sound. No ads. No interruptions. Just the story.' },
                { icon: Download, title: 'A little escape, anywhere.', description: 'Download your favorites and take them with you. Long flights, short commutes, or a quiet moment all to yourself.' },
              ].map(({ icon: Icon, title, description }, index) => <Reveal key={title} className="feature" delay={index * 0.09}><Icon className="feature-icon" size={27} strokeWidth={1.4} /><h3>{title}</h3><p>{description}</p></Reveal>)}</div>
              <p className="feature-disclaimer">4K, HDR, and downloads available with Premium and Family on supported devices.</p>
            </div>
          </section>

          <DeviceShowcase onPreview={() => setModal({ type: 'trailer' })} saved={favorites.includes('beyond-the-horizon')} onSave={() => toggleFavorite('beyond-the-horizon')} />

          <section className="benefits-section" aria-labelledby="benefits-heading"><div className="container benefits-layout"><Reveal className="benefits-image"><img src="https://images.pexels.com/photos/9807277/pexels-photo-9807277.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" alt="Friends sharing a relaxed movie night together on a sofa" loading="lazy" width="1200" height="627" /></Reveal><Reveal className="benefits-copy" delay={0.12}><p className="eyebrow">A PLACE FOR EVERY TASTE</p><h2 id="benefits-heading">Your people.<br />Their plot twists.</h2><p className="section-description">Your dramas. Their sci-fi. A little world for the kids. Personal profiles make one subscription feel like it belongs to everyone.</p><ul className="benefit-points"><li><Check size={16} /> Personal favorites, in every profile</li><li><Check size={16} /> Watch together, or do your own thing</li><li><Check size={16} /> A safe, happy space for younger viewers</li></ul><a className="text-link" href={homeLink('pricing')}>Find your perfect plan <ArrowUpRight size={17} /></a></Reveal></div></section>

          <section className="testimonials-section section-space" aria-labelledby="testimonials-heading"><div className="container"><Reveal className="section-heading centered"><p className="eyebrow">GOOD COMPANY. GREAT STORIES.</p><h2 id="testimonials-heading">The reviews are in.</h2><p className="section-description">Less scrolling. More &ldquo;just one more episode.&rdquo;</p></Reveal><div className="testimonials-grid">{testimonials.map((testimonial, index) => <Reveal key={testimonial.name} delay={index * 0.08}><figure className="testimonial"><Stars /><blockquote>&ldquo;{testimonial.quote}&rdquo;</blockquote><figcaption><img src={testimonial.image} alt="" loading="lazy" width="42" height="42" /><div><strong>{testimonial.name}</strong><span>{testimonial.location}</span></div></figcaption></figure></Reveal>)}</div><p className="member-story-note">Illustrative stories from our imagined community.</p></div></section>

          <section className="pricing-section section-space" id="pricing" aria-labelledby="pricing-heading"><div className="container"><Reveal className="section-heading centered"><p className="eyebrow">ONE SUBSCRIPTION. SO MANY POSSIBILITIES.</p><h2 id="pricing-heading">Your escape. Your way.</h2><p className="section-description">A world of entertainment, for less than a night out.</p><BillingControl billing={billing} onChange={setBilling} /></Reveal><div className="pricing-grid">{plans.map((plan, index) => {
            const price = planPrice(plan, billing);
            return <Reveal key={plan.id} delay={index * 0.08} className={`pricing-plan ${plan.id === 'premium' ? 'pricing-featured' : ''}`}><div className="plan-heading"><h3>{plan.name}</h3>{plan.id === 'premium' && <span className="popular-label">MOST POPULAR</span>}</div><p className="plan-description">{plan.description}</p><div className="plan-price" aria-live="polite"><AnimatePresence mode="wait" initial={false}><motion.span key={billing} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}>{money(price.monthly)}</motion.span></AnimatePresence><span>/ month</span></div><p className="plan-billing-note">{billing === 'yearly' ? `${money(price.total)} billed yearly` : 'Billed monthly. No commitments.'}</p><div className="plan-divider" /><ul>{plan.features.map(feature => <li key={feature}><Check size={15} strokeWidth={1.7} /><span>{feature}</span></li>)}</ul><button className={`button full-width ${plan.id === 'premium' ? 'button-primary' : 'button-outline'}`} onClick={() => openAccount()}>{plan.id === 'premium' ? (account?.subscription_status === 'cancelled' ? 'Buy now' : 'My membership') : 'Preview plan'}<ArrowRight size={17} /></button></Reveal>;
          })}</div><Reveal className="pricing-reassurance"><ShieldCheck size={16} /><p>This demo uses Premium monthly. Cancel through support.<span>Prices in USD. Other plans and annual billing are previews.</span></p></Reveal></div></section>

          <section className="faq-section section-space" id="faq" aria-labelledby="faq-heading"><div className="container faq-layout"><Reveal className="faq-copy"><p className="eyebrow">A LITTLE CLARITY</p><h2 id="faq-heading">Good questions.<br />Simple answers.</h2><p className="section-description">Everything to know before you press play.</p><button className="text-link" onClick={() => setModal({ type: 'info', page: 'story' })}>Get to know StreamSphere <ArrowUpRight size={17} /></button></Reveal><Reveal className="faq-list" delay={0.1}>{faqs.map((faq, index) => <FAQItem key={faq.question} {...faq} open={openFAQ === index} onToggle={() => setOpenFAQ(openFAQ === index ? null : index)} />)}</Reveal></div></section>

          <section className="closing-section" aria-labelledby="closing-heading"><img className="closing-background" src={heroImage} alt="" loading="lazy" width="1280" height="720" /><div className="closing-shade" /><Reveal className="container closing-content"><p className="eyebrow">MAKE YOUR NEXT NIGHT IN EXTRAORDINARY</p><h2 id="closing-heading">Your next chapter<br />starts here.</h2><p>The story you've been waiting for is waiting for you.</p><button className="button button-primary" onClick={() => openAccount()}>Find your world <ArrowRight size={18} /></button><span className="closing-note">Your next favorite is waiting.</span></Reveal></section>
          </>}
        </main>

        <footer className="site-footer"><div className="container"><div className="footer-top"><div className="footer-brand"><a className="brand-link" href={homeLink('top')} aria-label="StreamSphere home"><Brand /></a><p>A world of stories.<br />One extraordinary place to watch.</p></div><div className="footer-link-group"><h3>Explore</h3><button onClick={() => openCatalog('Movies')}>Movies</button><button onClick={() => openCatalog('Series')}>TV series</button><button onClick={() => openCatalog('Documentaries')}>Documentaries</button><button onClick={() => openCatalog()}>Sphere Originals</button></div><div className="footer-link-group"><h3>StreamSphere</h3><button onClick={() => setModal({ type: 'info', page: 'story' })}>Our story</button><a href={homeLink('pricing')}>Plans &amp; pricing</a><a href={homeLink('experience')}>Supported devices</a><button onClick={openChat}>Help center</button></div><div className="footer-link-group"><h3>The Fine Print</h3><button onClick={() => setModal({ type: 'info', page: 'privacy' })}>Privacy policy</button><button onClick={() => setModal({ type: 'info', page: 'terms' })}>Terms of use</button><button onClick={() => setModal({ type: 'cookies' })}>Cookie preferences</button><button onClick={openAccount}>Your account</button></div></div><div className="footer-bottom"><p>&copy; {new Date().getFullYear()} StreamSphere. A world worth watching.</p><div><a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Visit Instagram, opens in a new tab">Instagram <ArrowUpRight size={12} /></a><a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" aria-label="Visit YouTube, opens in a new tab">YouTube <ArrowUpRight size={12} /></a><span className="footer-globe"><span aria-hidden="true">&#9678;</span> Made for everywhere</span></div></div></div></footer>
      </div>

      {!modalOpen && <button className="support-launcher" onClick={openChat} aria-label="Chat with StreamSphere support"><MessageCircle size={22} /><span>Support</span></button>}
      <AnimatePresence>
        {modal && <Modal title={modalTitle} className={modalClass} onClose={closeModal}>
          {modal.type === 'chat' && <SupportChat key={user?.id} onAccount={next => { if (user && userRef.current?.id === user.id) setAccount(next); }} />}
          {modal.type === 'catalog' && <CatalogDialog key={modal.collection} initialCollection={modal.collection} favorites={favorites} onSelect={film => setModal({ type: 'film', film })} />}
          {modal.type === 'film' && <FilmDialog film={modal.film} saved={favorites.includes(modal.film.id)} onSave={() => toggleFavorite(modal.film.id)} onSignup={() => openAccount()} onPreview={() => setModal({ type: 'trailer' })} />}
          {modal.type === 'trailer' && <TrailerDialog onSignup={() => openAccount()} />}
          {modal.type === 'info' && <InfoDialog page={modal.page} />}
          {modal.type === 'cookies' && <CookieDialog onSaved={() => { closeModal(); notify('Your cookie preferences are saved'); }} />}
        </Modal>}
      </AnimatePresence>
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="true"><AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}><Heart size={16} />{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={14} /></button></motion.div>}</AnimatePresence></div>
    </MotionConfig>
  );
}
