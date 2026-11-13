import { supabase } from '@/integrations/supabase/client';
import type { Book, BookListing, BookTier, ConservationState } from '@/livrei/types';
import { getPhotoUrls } from '@/livrei/lib/bookStorage';
import { formatCityUf, isSameCity } from '@/livrei/lib/cep';
import { defaultSynopsis } from '@/livrei/lib/isbn';

const COVERS = ['cover-1', 'cover-2', 'cover-3', 'cover-4', 'cover-5', 'cover-6', 'cover-7', 'cover-8'];
export const coverFor = (id: string) => COVERS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COVERS.length]!;

export interface BookRow {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  category: string | null;
  tier: string;
  condition: string;
  notes: string | null;
  photo_paths: string[];
  cover_url: string | null;
  synopsis: string | null;
}

export interface FeedBookRow extends BookRow {
  owner_id: string;
  owner: { display_name: string; city: string | null; uf: string | null; district: string | null; status: string } | null;
}

export const BOOK_COLUMNS = 'id, title, author, isbn, category, tier, condition, notes, photo_paths, cover_url, synopsis';

/** Database row → app book; a blank synopsis gets the friendly default with the owner's name. */
export function rowToBook(r: BookRow, ownerName: string | undefined, urlByPath: Map<string, string>): Book {
  return {
    id: r.id,
    title: r.title,
    author: r.author,
    isbn: r.isbn ?? undefined,
    category: r.category ?? undefined,
    tier: r.tier as BookTier,
    condition: r.condition as ConservationState,
    notes: r.notes ?? undefined,
    synopsis: r.synopsis?.trim() || defaultSynopsis(ownerName),
    coverUrl: r.cover_url ?? undefined,
    coverClass: coverFor(r.id),
    coverEmoji: '📖',
    photoUrls: (r.photo_paths ?? []).map((p) => urlByPath.get(p) ?? '').filter(Boolean),
  };
}

/** Turns database rows into feed cards, hiding the reader's own books and banned owners. */
export function rowsToListings(rows: FeedBookRow[], userId: string, urlByPath: Map<string, string>): BookListing[] {
  return rows
    .filter((r) => r.owner_id !== userId && r.owner?.status !== 'banido')
    .map((r) => {
      const ownerName = r.owner?.display_name || 'Leitor LIVREI';
      return {
        id: r.id,
        ownerId: r.owner_id,
        ownerName,
        city: formatCityUf(r.owner?.city, r.owner?.uf) || 'Cidade não informada',
        district: r.owner?.district ?? undefined,
        distanceKm: null,
        source: 'real' as const,
        book: rowToBook(r, ownerName, urlByPath),
      };
    });
}

/** Real readers' books when there are any; otherwise the sample books keep the feed alive. */
export function pickFeedListings(real: BookListing[], samples: BookListing[]): BookListing[] {
  if (real.length > 0) return real;
  return samples.map((l) => ({ ...l, source: 'sample' as const }));
}

/** Signed links for every photo of the given rows (private bucket). */
export async function signedUrlMap(paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const urls = await getPhotoUrls(paths, 6 * 3600);
  return new Map(paths.map((p, i) => [p, urls[i] ?? '']));
}

export async function loadFeedListings(userId: string): Promise<BookListing[]> {
  const { data, error } = await supabase
    .from('books')
    .select(`${BOOK_COLUMNS}, owner_id, owner:profiles!books_owner_id_fkey(display_name, city, uf, district, status)`)
    .eq('status', 'disponivel')
    .neq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as unknown as FeedBookRow[];
  const urlByPath = await signedUrlMap(rows.flatMap((r) => r.photo_paths ?? []));
  return rowsToListings(rows, userId, urlByPath);
}

/** Saves a like on a real reader's book; the database creates the Match Direto when it's mutual. */
export async function likeRealBook(userId: string, bookId: string): Promise<{ matched: boolean }> {
  const { error } = await supabase.from('book_likes').insert({ user_id: userId, book_id: bookId });
  if (error && error.code !== '23505') throw error;
  const { data } = await supabase
    .from('matches')
    .select('id')
    .in('status', ['novo', 'conversando'])
    .or(`book_a.eq.${bookId},book_b.eq.${bookId}`)
    .limit(1);
  return { matched: (data ?? []).length > 0 };
}

/** "1.2 km" / "~8 km"; null when the distance is unknown (real readers, no GPS yet). */
export function formatDistance(km: number | null): string | null {
  if (km === null) return null;
  return km < 5 ? `${km} km` : `~${Math.round(km)} km`;
}

export interface ReaderPlace { city: string; district?: string | undefined }

const normDistrict = (v?: string) => (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

/** 'bairro' = same city and neighbourhood, 'cidade' = same city, 'fora' = elsewhere. */
export function proximityOf(listing: Pick<BookListing, 'city' | 'district'>, me: ReaderPlace): 'bairro' | 'cidade' | 'fora' {
  if (!me.city || !isSameCity(me.city, listing.city)) return 'fora';
  const a = normDistrict(me.district);
  return a && a === normDistrict(listing.district) ? 'bairro' : 'cidade';
}

export type ProximityFilter = 'nacional' | 'cidade' | 'bairro';

export function matchesProximity(listing: Pick<BookListing, 'city' | 'district'>, me: ReaderPlace, filter: ProximityFilter): boolean {
  if (filter === 'nacional') return true;
  const p = proximityOf(listing, me);
  return filter === 'cidade' ? p !== 'fora' : p === 'bairro';
}
