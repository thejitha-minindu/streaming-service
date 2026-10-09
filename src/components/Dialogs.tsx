import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Heart, LoaderCircle, Play, Search } from 'lucide-react';
import Brand from './Brand';
import FilmCard from './FilmCard';
import {
  films, heroImage, infoContent, previewVideo, readStored, writeStored,
  type Billing, type Collection, type FilmTitle, type InfoPage,
} from '../data';



export function BillingControl({ billing, onChange, compact = false }: { billing: Billing; onChange: (value: Billing) => void; compact?: boolean }) {
  return (
    <div className={`billing-control ${compact ? 'billing-compact' : ''}`} role="group" aria-label="Billing frequency">
      {(['monthly', 'yearly'] as const).map(value => (
        <button key={value} className={billing === value ? 'is-active' : ''} onClick={() => onChange(value)} aria-pressed={billing === value}>
          {billing === value && <motion.span className="billing-highlight" layoutId={compact ? 'modal-billing' : 'page-billing'} transition={{ type: 'spring', stiffness: 400, damping: 35 }} />}
          <span>{value === 'monthly' ? 'Monthly' : 'Yearly'}</span>
          {value === 'yearly' && <span className="billing-saving">Save 20%</span>}
        </button>
      ))}
    </div>
  );
}

export function CatalogDialog({ initialCollection, favorites, onSelect }: {
  initialCollection: Collection;
  favorites: string[];
  onSelect: (film: FilmTitle) => void;
}) {
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState<Collection>(initialCollection);
  const searchId = useId();
  const collections: Collection[] = ['All', 'Movies', 'Series', 'Documentaries', 'My list'];
  const visible = films.filter(film => {
    const matchesCollection = collection === 'All' || (collection === 'My list' ? favorites.includes(film.id) : film.kind === collection);
    return matchesCollection && `${film.title} ${film.genre} ${film.synopsis}`.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <div className="catalog-content">
      <p className="eyebrow">FIND YOUR NEXT FAVORITE</p>
      <h3>A world worth exploring.</h3>
      <label className="catalog-search" htmlFor={searchId}>
        <Search size={19} aria-hidden="true" />
        <input id={searchId} type="search" placeholder="Search titles, genres, and stories" aria-label="Search the collection" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <div className="collection-tabs" role="group" aria-label="Filter the collection">
        {collections.map(item => <button key={item} className={collection === item ? 'active' : ''} onClick={() => setCollection(item)} aria-pressed={collection === item}>{item}{item === 'My list' && favorites.length > 0 && <span>{favorites.length}</span>}</button>)}
      </div>
      <p className="catalog-count" aria-live="polite">{visible.length} {visible.length === 1 ? 'story' : 'stories'} to discover</p>
      {visible.length > 0 ? <div className="catalog-grid">{visible.map(film => <FilmCard key={film.id} film={film} onSelect={onSelect} />)}</div> : (
        <div className="catalog-empty"><Search size={32} strokeWidth={1.3} /><h4>{collection === 'My list' && !query ? 'Your next favorites belong here.' : 'No stories found. Yet.'}</h4><p>{collection === 'My list' && !query ? 'Explore a title and tap the heart to save it to your list.' : 'Try a different title or a genre like sci-fi, romance, or nature.'}</p><button className="text-link" onClick={() => { setQuery(''); setCollection('All'); }}>Explore all stories <ArrowRight size={17} /></button></div>
      )}
      <p className="preview-note">An illustrative collection of StreamSphere originals. Full titles are not available to stream in this preview.</p>
    </div>
  );
}

export function FilmDialog({ film, saved, onSave, onSignup, onPreview }: {
  film: FilmTitle; saved: boolean; onSave: () => void; onSignup: () => void; onPreview: () => void;
}) {
  return (
    <div className="film-detail">
      <div className={`detail-poster poster-${film.posterStyle}`}>
        <img src={film.image} alt={`Cinematic artwork for ${film.title}`} />
        <span className="poster-shade" /><span className="poster-original">A STREAMSPHERE ORIGINAL</span><span className="poster-title">{film.posterTitle}</span>
      </div>
      <div className="detail-copy">
        <p className="eyebrow">STREAMSPHERE ORIGINAL</p>
        <h3>{film.title}</h3>
        <p className="detail-meta">{film.year}<span>&middot;</span>{film.duration}<span>&middot;</span>{film.rating}</p>
        <span className="detail-genre">{film.genre} {film.kind === 'Movies' ? 'film' : film.kind === 'Series' ? 'series' : 'documentary'}</span>
        <p className="detail-synopsis">{film.synopsis}</p>
        <button className="button button-primary full-width" onClick={onSignup}>View your membership <ArrowRight size={17} /></button>
        <div className="detail-actions">
          <button className={`text-link ${saved ? 'saved' : ''}`} aria-pressed={saved} onClick={onSave}><motion.span key={String(saved)} initial={{ scale: 0.7 }} animate={{ scale: 1 }}><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></motion.span>{saved ? 'Added to My list' : 'Add to My list'}</button>
          <button className="text-link" onClick={onPreview}><Play size={16} /> See the experience</button>
        </div>
        <p className="preview-note">An original title concept. This preview does not include the full film or series.</p>
      </div>
    </div>
  );
}

export function TrailerDialog({ onSignup }: { onSignup: () => void }) {
  const reduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => { setLoading(false); setError(true); }, 25000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  return (
    <div className="trailer-content">
      <div className="video-wrap">
        {!error && <video controls playsInline autoPlay={!reduceMotion} preload="metadata" poster={heroImage} onCanPlay={() => setLoading(false)} onError={() => { setError(true); setLoading(false); }} aria-label="StreamSphere atmospheric preview: a time-lapse of the Milky Way">
          <source src={previewVideo} type="video/mp4" onError={() => { setError(true); setLoading(false); }} />
          Your browser does not support this video. You can still explore our collection.
        </video>}
        {loading && <span className="video-loading" role="status"><LoaderCircle size={26} className="spin" /><span className="sr-only">Loading preview</span></span>}
        {error && <div className="video-error" role="status"><img src={heroImage} alt="A traveler looking out over an extraordinary new world" /><p>The preview is taking a little longer to arrive.<br /><button className="text-link" onClick={() => { setError(false); setLoading(true); }}>Try again <ArrowRight size={16} /></button></p></div>}
      </div>
      <div className="trailer-copy">
        <div><p className="eyebrow">A LITTLE GLIMPSE. A BIGGER WORLD.</p><h3>Meet your sense of wonder.</h3><p>15 seconds of escape. Imagine where a whole story could take you.</p><small>Atmosphere footage by Eclipse Chasers / Pexels. Silent preview.</small></div>
        <button className="button button-primary" onClick={onSignup}>Find your world <ArrowRight size={17} /></button>
      </div>
    </div>
  );
}

export function InfoDialog({ page }: { page: InfoPage }) {
  const content = infoContent[page];
  return (
    <div className="info-content">
      <Brand compact />
      <p className="eyebrow">{page === 'story' ? 'THE STREAMSPHERE STORY' : 'CLEAR, SIMPLE, HUMAN'}</p>
      <h3>{content.title}</h3>
      <p className="dialog-intro">{content.intro}</p>
      {content.sections.map(section => <section key={section.heading}><h4>{section.heading}</h4><p>{section.text}</p></section>)}
    </div>
  );
}

export function CookieDialog({ onSaved }: { onSaved: () => void }) {
  const stored = readStored<{ analytics: boolean; marketing: boolean }>('streamsphere-cookies', { analytics: false, marketing: false });
  const [analytics, setAnalytics] = useState(Boolean(stored?.analytics));
  const [marketing, setMarketing] = useState(Boolean(stored?.marketing));
  return (
    <div className="cookie-content">
      <p className="eyebrow">YOUR EXPERIENCE. YOUR CHOICE.</p>
      <h3>A little more control.</h3>
      <p className="dialog-intro">Optional cookies are off by default. This preview does not run analytics or advertising scripts.</p>
        <div className="cookie-option"><div><h4>Essential storage</h4><p>Keeps you signed in and your watchlist and chat session working.</p></div><span className="always-on"><Check size={15} /> Always on</span></div>
      <div className="cookie-option"><div><h4>Analytics</h4><p>Helps a future live service understand what works.</p></div><button className={`switch ${analytics ? 'on' : ''}`} role="switch" aria-label="Analytics cookies" aria-checked={analytics} onClick={() => setAnalytics(!analytics)}><span /></button></div>
      <div className="cookie-option"><div><h4>Personalized marketing</h4><p>Allows relevant offers on a future live service.</p></div><button className={`switch ${marketing ? 'on' : ''}`} role="switch" aria-label="Personalized marketing cookies" aria-checked={marketing} onClick={() => setMarketing(!marketing)}><span /></button></div>
      <button className="button button-primary full-width" onClick={() => { writeStored('streamsphere-cookies', { analytics, marketing }); onSaved(); }}>Save my preferences <Check size={17} /></button>
    </div>
  );
}

export function FAQItem({ question, answer, open, onToggle }: { question: string; answer: string; open: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <div className={`faq-item ${open ? 'faq-open' : ''}`}>
      <h3><button id={`${id}-button`} aria-expanded={open} aria-controls={`${id}-answer`} onClick={onToggle}><span>{question}</span><span className="faq-plus" aria-hidden="true"><span /><span /></span></button></h3>
      <div id={`${id}-answer`} role="region" aria-labelledby={`${id}-button`} aria-hidden={!open} className="faq-answer">
        <AnimatePresence initial={false}>
          {open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}><p>{answer}</p></motion.div>}
        </AnimatePresence>
      </div>
    </div>
  );
}
