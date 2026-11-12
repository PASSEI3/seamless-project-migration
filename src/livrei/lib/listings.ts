import { supabase } from '@/integrations/supabase/client';
import type { BookListing, BookTier, ConservationState } from '@/livrei/types';
import { getPhotoUrls } from '@/livrei/lib/bookStorage';
import { formatCityUf, isSameCity } from '@/livrei/lib/cep';

const COVERS = ['cover-1', 'cover-2', 'cover-3', 'cover-4', 'cover-5', 'cover-6', 'cover-7', 'cover-8'];
export const coverFor = (id: string) => COVERS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COVERS.length]!;

export interface FeedBookRow {
  id: string;
  owner_id: string;
  title: string;
  author: string;
  isbn: string | null;
  category: string | null;
  tier: string;
  condition: string;
  notes: string | null;
  photo_paths: string[];
  owner: { display_name: string; city: string | null; uf: string | null; status: string } | null;
}

/** Turns database rows into feed cards, hiding the reader's own books and banned owners. */
export function rowsToListings(rows: FeedBookRow[], userId: string, urlByPath: Map<string, string>): BookListing[] {
  return rows
    .filter((r) => r.owner_id !== userId && r.owner?.status !== 'banido')
    .map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      ownerName: r.owner?.display_name || 'Leitor LIVREI',
      city: formatCityUf(r.owner?.city, r.owner?.uf) || 'Cidade não informada',
      distanceKm: null,
      source: 'real' as const,
      book: {
        id: r.id,
        title: r.title,
        author: r.author,
        isbn: r.isbn ?? undefined,
        category: r.category ?? undefined,
        tier: r.tier as BookTier,
        condition: r.condition as ConservationState,
        notes: r.notes ?? undefined,
        coverClass: coverFor(r.id),
        coverEmoji: '📖',
        photoUrls: r.photo_paths.map((p) => urlByPath.get(p) ?? '').filter(Boolean),
      },
    }));
}

/** Real readers' books when there are any; otherwise the sample books keep the feed alive. */
export function pickFeedListings(real: BookListing[], samples: BookListing[]): BookListing[] {
  if (real.length > 0) return real;
  return samples.map((l) => ({ ...l, source: 'sample' as const }));
}

export async function loadFeedListings(userId: string): Promise<BookListing[]> {
  const { data, error } = await supabase
    .from('books')
    .select('id, owner_id, title, author, isbn, category, tier, condition, notes, photo_paths, owner:profiles!books_owner_id_fkey(display_name, city, uf, status)')
    .eq('status', 'disponivel')
    .neq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as unknown as FeedBookRow[];
  const paths = rows.flatMap((r) => r.photo_paths ?? []);
  const urls = paths.length ? await getPhotoUrls(paths, 6 * 3600) : [];
  const urlByPath = new Map(paths.map((p, i) => [p, urls[i] ?? '']));
  return rowsToListings(rows, userId, urlByPath);
}

/** "1.2 km" / "~8 km"; null when the distance is unknown (real readers, no GPS yet). */
export function formatDistance(km: number | null): string | null {
  if (km === null) return null;
  return km < 5 ? `${km} km` : `~${Math.round(km)} km`;
}

/** Known distance within the limit, or — when unknown — same city as the reader. */
export function isWithinDistance(listing: BookListing, maxKm: number, userCity: string): boolean {
  if (listing.distanceKm !== null) return listing.distanceKm <= maxKm;
  return isSameCity(userCity, listing.city);
}
