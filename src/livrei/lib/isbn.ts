/**
 * ISBN lookup cascade (all free): Google Books → BrasilAPI (CBL, Brazilian books) → Open Library.
 * The first source with a title wins; later sources only fill a missing official cover or synopsis.
 */

export type IsbnSource = 'google' | 'brasilapi' | 'openlibrary';

export interface IsbnBook {
  isbn: string;
  title: string;
  author: string;
  category: string;
  source: IsbnSource;
  /** Official cover (https) when a database has one. */
  coverUrl?: string | undefined;
  /** Official synopsis (plain text) when a database has one. */
  synopsis?: string | undefined;
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

/** Removes HTML tags/entities that Google Books puts in descriptions. */
export function cleanSynopsis(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text ? text.slice(0, 4000) : undefined;
}

/** Only https covers are kept (http links are upgraded). */
export function cleanCoverUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const url = raw.trim().replace(/^http:\/\//i, 'https://').replace(/&edge=curl/g, '');
  return /^https:\/\//i.test(url) ? url : undefined;
}

const joinTitle = (title: string, subtitle?: string | null) => (subtitle ? `${title}: ${subtitle}` : title);

async function fromGoogle(isbn: string, fetchImpl: typeof fetch, apiKey?: string): Promise<IsbnBook | null> {
  const key = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
  const res = await fetchImpl(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    items?: { volumeInfo?: { title?: string; subtitle?: string; authors?: string[]; categories?: string[]; description?: string; imageLinks?: Record<string, string> } }[];
  };
  const info = data.items?.[0]?.volumeInfo;
  if (!info?.title) return null;
  const links = info.imageLinks ?? {};
  return {
    isbn,
    title: joinTitle(info.title, info.subtitle),
    author: (info.authors ?? []).join(', ') || 'Autor desconhecido',
    category: mapCategory(info.categories),
    source: 'google',
    coverUrl: cleanCoverUrl(links['large'] ?? links['medium'] ?? links['thumbnail'] ?? links['smallThumbnail']),
    synopsis: cleanSynopsis(info.description),
  };
}

async function fromBrasilApi(isbn: string, fetchImpl: typeof fetch): Promise<IsbnBook | null> {
  const res = await fetchImpl(`https://brasilapi.com.br/api/isbn/v1/${isbn}`);
  if (!res.ok) return null;
  const info = (await res.json()) as { title?: string; subtitle?: string | null; authors?: string[]; subjects?: string[]; synopsis?: string | null; cover_url?: string | null };
  if (!info?.title) return null;
  return {
    isbn,
    title: joinTitle(info.title, info.subtitle),
    author: (info.authors ?? []).join(', ') || 'Autor desconhecido',
    category: mapCategory(info.subjects),
    source: 'brasilapi',
    coverUrl: cleanCoverUrl(info.cover_url),
    synopsis: cleanSynopsis(info.synopsis),
  };
}

async function fromOpenLibrary(isbn: string, fetchImpl: typeof fetch): Promise<IsbnBook | null> {
  const res = await fetchImpl(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, {
    title?: string; subtitle?: string; authors?: { name: string }[]; subjects?: { name: string }[];
    cover?: { large?: string; medium?: string; small?: string }; excerpts?: { text?: string }[];
  }>;
  const info = data[`ISBN:${isbn}`];
  if (!info?.title) return null;
  return {
    isbn,
    title: joinTitle(info.title, info.subtitle),
    author: (info.authors ?? []).map((a) => a.name).join(', ') || 'Autor desconhecido',
    category: mapCategory((info.subjects ?? []).map((s) => s.name)),
    source: 'openlibrary',
    coverUrl: cleanCoverUrl(info.cover?.large ?? info.cover?.medium),
    synopsis: cleanSynopsis(info.excerpts?.[0]?.text),
  };
}

export async function lookupIsbn(raw: string, fetchImpl: typeof fetch = fetch, googleApiKey?: string): Promise<IsbnBook | null> {
  const isbn = normalizeIsbn(raw);
  if (!isValidIsbn(isbn)) return null;
  const sources: ((i: string, f: typeof fetch) => Promise<IsbnBook | null>)[] = [
    (i, f) => fromGoogle(i, f, googleApiKey),
    fromBrasilApi,
    fromOpenLibrary,
  ];
  let book: IsbnBook | null = null;
  for (const source of sources) {
    if (book?.coverUrl && book.synopsis) break;
    try {
      const hit = await source(isbn, fetchImpl);
      if (!hit) continue;
      if (!book) book = hit;
      else book = { ...book, coverUrl: book.coverUrl ?? hit.coverUrl, synopsis: book.synopsis ?? hit.synopsis };
    } catch {
      // try the next source
    }
  }
  return book;
}

/** Same rule as manual registration: Clássico/Biografia with ISBN are Premium. */
export function tierForCategory(category: string, hasIsbn: boolean): 'PADRÃO' | 'PREMIUM' {
  return hasIsbn && ['Clássico', 'Biografia'].includes(category) ? 'PREMIUM' : 'PADRÃO';
}

/** Friendly text shown when the reader leaves the synopsis blank. */
export function defaultSynopsis(ownerName: string | undefined): string {
  const name = ownerName?.trim() || 'um leitor LIVREI';
  return `Exemplar físico disponível para troca na estante de ${name}. Confira as 3 fotos reais do estado de conservação.`;
}
