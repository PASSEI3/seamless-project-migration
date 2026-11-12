/** ISBN lookup: Google Books first, Open Library as fallback (both public, no key). */

export interface IsbnBook {
  isbn: string;
  title: string;
  author: string;
  category: string;
  source: 'google' | 'openlibrary';
}

export function normalizeIsbn(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9X]/g, '');
}

export function isValidIsbn(raw: string): boolean {
  const isbn = normalizeIsbn(raw);
  if (/^\d{13}$/.test(isbn)) {
    const sum = isbn.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
    return sum % 10 === 0;
  }
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = isbn.split('').reduce((acc, d, i) => acc + (d === 'X' ? 10 : Number(d)) * (10 - i), 0);
    return sum % 11 === 0;
  }
  return false;
}

const strip = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Order matters: the first rule that matches wins.
const CATEGORY_RULES: [string, string[]][] = [
  ['Clássico', ['classic', 'classico']],
  ['Biografia', ['biograph', 'autobiograph', 'memoir', 'biografia']],
  ['Autoajuda', ['self-help', 'self help', 'autoajuda', 'auto-ajuda', 'personal development', 'desenvolvimento pessoal']],
  ['Fantasia', ['fantasy', 'fantasia']],
  ['Suspense', ['thriller', 'suspense', 'mystery', 'misterio', 'horror', 'terror', 'crime', 'detective', 'policial']],
  ['Romance', ['romance', 'love stor']],
  ['Infantil', ['juvenile', 'children', 'infantil', 'infanto', 'young adult']],
  ['Não-ficção', ['history', 'historia', 'science', 'ciencia', 'business', 'philosophy', 'filosofia', 'psychology', 'psicologia', 'nonfiction', 'non-fiction', 'education', 'educacao', 'politic', 'economics', 'economia', 'religion', 'religiao', 'health', 'saude', 'cooking', 'culinaria', 'study', 'didatic', 'textbook']],
  ['Ficção', ['fiction', 'ficcao', 'literat', 'novel']],
];

export function mapCategory(raw: string[] | undefined): string {
  const text = strip((raw ?? []).join(' | '));
  if (!text) return 'Outro';
  for (const [category, keys] of CATEGORY_RULES) {
    if (keys.some((k) => text.includes(k))) return category;
  }
  return 'Outro';
}

async function fromGoogle(isbn: string, fetchImpl: typeof fetch): Promise<IsbnBook | null> {
  const res = await fetchImpl(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: { volumeInfo?: { title?: string; subtitle?: string; authors?: string[]; categories?: string[] } }[] };
  const info = data.items?.[0]?.volumeInfo;
  if (!info?.title) return null;
  return {
    isbn,
    title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
    author: (info.authors ?? []).join(', ') || 'Autor desconhecido',
    category: mapCategory(info.categories),
    source: 'google',
  };
}

async function fromOpenLibrary(isbn: string, fetchImpl: typeof fetch): Promise<IsbnBook | null> {
  const res = await fetchImpl(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, { title?: string; subtitle?: string; authors?: { name: string }[]; subjects?: { name: string }[] }>;
  const info = data[`ISBN:${isbn}`];
  if (!info?.title) return null;
  return {
    isbn,
    title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
    author: (info.authors ?? []).map((a) => a.name).join(', ') || 'Autor desconhecido',
    category: mapCategory((info.subjects ?? []).map((s) => s.name)),
    source: 'openlibrary',
  };
}

export async function lookupIsbn(raw: string, fetchImpl: typeof fetch = fetch): Promise<IsbnBook | null> {
  const isbn = normalizeIsbn(raw);
  if (!isValidIsbn(isbn)) return null;
  for (const source of [fromGoogle, fromOpenLibrary]) {
    try {
      const book = await source(isbn, fetchImpl);
      if (book) return book;
    } catch {
      // try the next source
    }
  }
  return null;
}

/** Same rule as manual registration: Clássico/Biografia with ISBN are Premium. */
export function tierForCategory(category: string, hasIsbn: boolean): 'PADRÃO' | 'PREMIUM' {
  return hasIsbn && ['Clássico', 'Biografia'].includes(category) ? 'PREMIUM' : 'PADRÃO';
}
