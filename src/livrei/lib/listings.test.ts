import { describe, it, expect } from 'vitest';
import { pickFeedListings, rowsToListings, type FeedBookRow } from './listings';
import type { BookListing } from '@/livrei/types';

const row = (id: string, owner: string, status = 'ativo'): FeedBookRow => ({
  id, owner_id: owner, title: `Livro ${id}`, author: 'Autor', isbn: null, category: 'Romance',
  tier: 'PADRÃO', condition: 'Seminovo', notes: null, photo_paths: [`${owner}/${id}-1.webp`],
  owner: { display_name: 'Ana', city: 'Fortaleza', uf: 'CE', status },
});
const sample = { id: 's1', ownerId: 'u1', city: 'São Paulo - SP', distanceKm: 1.2, book: { id: 'b1' } } as unknown as BookListing;

describe('feed listings', () => {
  it('hides the signed-in reader’s own books', () => {
    const out = rowsToListings([row('a', 'me'), row('b', 'other')], 'me', new Map());
    expect(out.map((l) => l.id)).toEqual(['b']);
  });

  it('hides books from banned readers', () => {
    expect(rowsToListings([row('a', 'other', 'banido')], 'me', new Map())).toEqual([]);
  });

  it('uses the signed photo link for the card', () => {
    const out = rowsToListings([row('a', 'other')], 'me', new Map([['other/a-1.webp', 'https://x/signed']]));
    expect(out[0]!.book.photoUrls).toEqual(['https://x/signed']);
    expect(out[0]!.city).toBe('Fortaleza - CE');
  });

  it('shows sample books only when no real reader has books', () => {
    expect(pickFeedListings([], [sample]).map((l) => l.source)).toEqual(['sample']);
    const real = rowsToListings([row('b', 'other')], 'me', new Map());
    expect(pickFeedListings(real, [sample]).map((l) => l.id)).toEqual(['b']);
  });
});
