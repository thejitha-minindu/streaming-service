export type Billing = 'monthly' | 'yearly';
export type PlanId = 'basic' | 'premium' | 'family';
export type Collection = 'All' | 'Movies' | 'Series' | 'Documentaries' | 'My list';
export type InfoPage = 'story' | 'privacy' | 'terms';

export interface FilmTitle {
  id: string;
  title: string;
  posterTitle: string;
  genre: string;
  kind: 'Movies' | 'Series' | 'Documentaries';
  year: number;
  duration: string;
  rating: string;
  image: string;
  synopsis: string;
  posterStyle: string;
}

export const heroImage = '/images/hero-cinematic.jpg';
export const previewVideo = 'https://videos.pexels.com/video-files/27775202/12221015_3240_2160_25fps.mp4';

export const films: FilmTitle[] = [
  {
    id: 'orbit', title: 'Orbit', posterTitle: 'ORBIT', genre: 'Sci-Fi', kind: 'Series',
    year: 2026, duration: '1 season', rating: '13+', image: '/images/orbit.jpg',
    synopsis: "At the edge of known space, a missing crew's final signal draws one astronaut into a mystery bigger than the universe.",
    posterStyle: 'orbit',
  },
  {
    id: 'after-hours', title: 'After Hours', posterTitle: 'AFTER HOURS', genre: 'Thriller', kind: 'Movies',
    year: 2026, duration: '1h 58m', rating: '16+', image: '/images/after-hours.jpg',
    synopsis: 'One night. One wrong turn. A chance encounter on the rain-soaked streets of New York becomes a race to uncover a city-wide conspiracy.',
    posterStyle: 'after-hours',
  },
  {
    id: 'wild-earth', title: 'Wild Earth', posterTitle: 'WILD EARTH', genre: 'Nature', kind: 'Documentaries',
    year: 2026, duration: '6 episodes', rating: 'All ages',
    image: 'https://images.pexels.com/photos/28283858/pexels-photo-28283858.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    synopsis: 'Journey to the places that still take our breath away. An intimate, extraordinary portrait of our planet and the life that calls it home.',
    posterStyle: 'wild-earth',
  },
  {
    id: 'golden-days', title: 'Golden Days', posterTitle: 'Golden Days', genre: 'Romance', kind: 'Movies',
    year: 2025, duration: '1h 46m', rating: '13+', image: '/images/golden-days.jpg',
    synopsis: 'A summer on the Italian coast. An unexpected connection. Two strangers discover that the best journeys are the ones you never planned.',
    posterStyle: 'golden-days',
  },
  {
    id: 'the-last-kingdom', title: 'The Last Kingdom', posterTitle: 'THE LAST KINGDOM', genre: 'Fantasy', kind: 'Series',
    year: 2025, duration: '2 seasons', rating: '16+', image: '/images/the-last-kingdom.jpg',
    synopsis: 'With a forgotten kingdom on the brink of war, an unlikely guardian must choose between the life they know and the world they could save.',
    posterStyle: 'the-last-kingdom',
  },
  {
    id: 'beyond-the-horizon', title: 'Beyond the Horizon', posterTitle: 'BEYOND THE HORIZON', genre: 'Adventure', kind: 'Movies',
    year: 2026, duration: '2h 12m', rating: '13+', image: heroImage,
    synopsis: 'Beyond the last familiar star, a lone traveler finds a world that should not exist. A breathtaking adventure about the things that make us human.',
    posterStyle: 'horizon',
  },
];

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  price: number;
  features: string[];
}

export const plans: Plan[] = [
  {
    id: 'basic', name: 'Basic', description: 'Your own little escape.', price: 6.99,
    features: ['Beautiful Full HD streaming', 'Watch on 1 device at a time', '1 personal profile', 'Always ad-free'],
  },
  {
    id: 'premium', name: 'Premium', description: 'The full cinematic experience.', price: 15.99,
    features: ['Stunning 4K UHD + HDR', 'Watch on 2 devices at a time', '5 personal profiles', 'Download and watch offline'],
  },
  {
    id: 'family', name: 'Family', description: 'More worlds, under one roof.', price: 17.99,
    features: ['Stunning 4K UHD + HDR', 'Watch on 4 devices at a time', '6 profiles, including kids', 'Download and watch offline'],
  },
];

export const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2,
}).format(value);

export function planPrice(plan: Plan, billing: Billing) {
  const total = Math.round(plan.price * 12 * 0.8 * 100) / 100;
  return { monthly: billing === 'yearly' ? total / 12 : plan.price, total };
}

export const faqs = [
  {
    question: 'What is StreamSphere?',
    answer: 'StreamSphere brings extraordinary movies, unmissable series, and exclusive originals together in one beautifully simple streaming experience. Discover stories from around the world, with no ads and new favorites arriving every week.',
  },
  {
    question: 'How does this demo membership work?',
    answer: 'Your demo account starts with a paid Premium membership at $15.99 per month and a $0 wallet. Ask the assistant for help with your membership. The account and wallet are saved by our backend; no real card payments are collected. Other plans and annual billing are illustrative.',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes. Ask the support assistant to cancel. Same-day charges are eligible for a full refund to your demo wallet. Later cancellations are not refundable. You must confirm in chat before the action runs, and Premium access ends immediately.',
  },
  {
    question: 'Which devices can I watch on?',
    answer: 'Watch on your smart TV, laptop, tablet, or phone. StreamSphere is designed for modern web browsers, iOS, Android, and supported smart TVs. Your profiles, watchlist, and progress stay in sync across your devices.',
  },
  {
    question: 'Can I download titles to watch offline?',
    answer: 'Yes. Premium and Family include downloads on supported mobile devices. Save your favorites before you travel, then take a little entertainment with you, even without an internet connection.',
  },
  {
    question: 'Is StreamSphere available in my country?',
    answer: 'StreamSphere is built for a global audience, with international stories, subtitles, and multiple audio languages. The live service will confirm availability at checkout. Titles and supported languages may vary by region.',
  },
];

export const memberPhotos = [
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&crop=faces&w=100&h=100&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&crop=faces&w=100&h=100&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&crop=faces&w=100&h=100&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&crop=faces&w=100&h=100&q=80',
];

export const testimonials = [
  { name: 'Maya R.', location: 'London, UK', image: memberPhotos[0], quote: "Finally, a streaming service that gets my taste. I've found more favorites in a month than I did all last year." },
  { name: 'Daniel K.', location: 'Toronto, Canada', image: memberPhotos[1], quote: 'The picture quality is incredible. Friday nights have officially become movie nights. Honestly, we look forward to staying in.' },
  { name: 'Sofia M.', location: 'Barcelona, Spain', image: memberPhotos[2], quote: 'One profile for my dramas, one for his sci-fi, and a little world for the kids. Everyone gets their own happy ending.' },
];

export const infoContent: Record<InfoPage, { title: string; intro: string; sections: { heading: string; text: string }[] }> = {
  story: {
    title: 'A world of stories. A place to belong.',
    intro: 'We believe a great story can take you somewhere new, bring you closer to someone, or make an ordinary Tuesday feel extraordinary.',
    sections: [
      { heading: 'Made for the love of watching', text: 'StreamSphere is a concept for a more thoughtful streaming experience: a carefully curated collection, beautifully presented, with discovery that feels personal.' },
      { heading: 'Stories without borders', text: 'Our vision brings local voices and global favorites together. From intimate independent films to expansive new worlds, there should always be something that feels like you.' },
      { heading: 'About this experience', text: 'This is an interactive product preview. Film titles, membership plans, and member stories are illustrative. Accounts support email and password sign-in. No live streaming catalog or payment processing is connected.' },
    ],
  },
  privacy: {
    title: 'Your privacy matters.',
    intro: 'A simple explanation of how this interactive preview handles your information.',
    sections: [
      { heading: 'Your account and conversations', text: 'Your profile, subscription, wallet, chat messages, and consent decisions are stored in our database through our backend. Passwords are stored as salted hashes. Support messages and relevant account details are sent to the configured support provider. Keep sensitive personal information out of support conversations.' },
      { heading: 'Third-party media', text: 'Some images, fonts, and preview footage are delivered by Unsplash, Pexels, and Google Fonts. These providers may receive standard connection information when the assets load.' },
      { heading: 'Your choices', text: 'Your watchlist and cookie preferences stay in your browser. A conversation identifier is kept for this browser tab. Clearing browser storage does not remove server records; the demo operator can reset them with the supplied database script. No advertising or analytics scripts run in this preview.' },
    ],
  },
  terms: {
    title: 'A few ground rules.',
    intro: 'These terms describe the StreamSphere interactive preview, not an active paid streaming service.',
    sections: [
      { heading: 'Demo only', text: 'Films and member testimonials are illustrative. Premium membership, cancellation, and wallet credits are demonstration records stored by the backend. Buy now spends demo wallet credit. Sign-in uses your email and password; no real card charge or card refund takes place.' },
      { heading: 'Your saved experience', text: 'Your watchlist is saved in your browser. Demo membership, wallet, chat, and approval records are stored on the server. Availability of externally hosted preview footage depends on its provider.' },
      { heading: 'A future live service', text: 'Actual availability, billing, licensing, refund policies, and account terms must be provided and accepted before any live service launch.' },
    ],
  },
};

export function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The experience still works when browser storage is unavailable.
  }
}
