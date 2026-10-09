export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? 'brand-compact' : ''}`}>
      <svg className="brand-symbol" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <circle cx="18" cy="18" r="13" stroke="currentColor" strokeWidth="1.7" />
        <ellipse cx="18" cy="18" rx="6.5" ry="13" transform="rotate(30 18 18)" stroke="currentColor" strokeWidth="1.4" />
        <ellipse cx="18" cy="18" rx="13" ry="5.3" transform="rotate(-27 18 18)" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="27.5" cy="9.5" r="2" fill="currentColor" />
      </svg>
      <span>Stream<span className="brand-light">Sphere</span></span>
    </span>
  );
}