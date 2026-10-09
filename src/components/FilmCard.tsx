import { Play } from 'lucide-react';
import type { FilmTitle } from '../data';

export default function FilmCard({ film, onSelect }: { film: FilmTitle; onSelect: (film: FilmTitle) => void }) {
  return (
    <article className="film-card">
      <button className={`poster-button poster-${film.posterStyle}`} onClick={() => onSelect(film)} aria-label={`Explore ${film.title}`}>
        <img src={film.image} alt="" loading="lazy" width="400" height="600" />
        <span className="poster-shade" />
        <span className="poster-original">A STREAMSPHERE ORIGINAL</span>
        <span className="poster-title">{film.posterTitle}</span>
        <span className="poster-play" aria-hidden="true"><Play size={23} fill="currentColor" strokeWidth={1.4} /></span>
        <span className="poster-action">Discover the story</span>
      </button>
      <h3><button onClick={() => onSelect(film)}>{film.title}</button></h3>
      <p>{film.genre}<span aria-hidden="true">&middot;</span>{film.kind === 'Movies' ? 'Film' : film.kind === 'Series' ? 'Series' : 'Documentary'}</p>
    </article>
  );
}