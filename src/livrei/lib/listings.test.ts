import { describe, it, expect } from 'vitest';
import { matchesProximity, pickFeedListings, proximityOf, rowsToListings, type FeedBookRow } from './listings';
import type { BookListing } from '@/livrei/types';

const row = (id: string, owner: string, status = 'ativo', extra: Partial<FeedBookRow> = {}): FeedBookRow => ({
  id, owner_id: owner, title: `Livro ${id}`, author: 'Autor', isbn: null, category: 'Romance',
  tier: 'PADRÃO', condition: 'Seminovo', notes: null, photo_paths: [`${owner}/${id}-1.webp`],
  cover_url: null, synopsis: null,
  owner: { display_name: 'Ana', city: 'Fortaleza', uf: 'CE', district: 'Aldeota', status },
  ...extra,
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

  it('uses the signed photo link and the owner city', () => {
    const out = rowsToListings([row('a', 'other')], 'me', new Map([['other/a-1.webp', 'https://x/signed']]));
    expect(out[0]!.book.photoUrls).toEqual(['https://x/signed']);
    expect(out[0]!.city).toBe('Fortaleza - CE');
  });

  it('keeps the official cover and fills a blank synopsis with the default text', () => {
    const [withCover] = rowsToListings([row('a', 'other', 'ativo', { cover_url: 'https://books.google.com/c.jpg' })], 'me', new Map());
    expect(withCover!.book.coverUrl).toBe('https://books.google.com/c.jpg');
    expect(withCover!.book.synopsis).toBe('Exemplar físico disponível para troca na estante de Ana. Confira as 3 fotos reais do estado de conservação.');
    const [withText] = rowsToListings([row('b', 'other', 'ativo', { synopsis: 'Uma história.' })], 'me', new Map());
    expect(withText!.book.synopsis).toBe('Uma história.');
  });

  it('shows sample books only when no real reader has books', () => {
    expect(pickFeedListings([], [sample]).map((l) => l.source)).toEqual(['sample']);
    const real = rowsToListings([row('b', 'other')], 'me', new Map());
    expect(pickFeedListings(real, [sample]).map((l) => l.id)).toEqual(['b']);
  });
});

describe('proximity by the reader’s city', () => {
  const me = { city: 'Fortaleza - CE', district: 'Aldeota' };
  it('same city and bairro → bairro; same city → cidade; elsewhere → fora', () => {
    expect(proximityOf({ city: 'Fortaleza - CE', district: 'aldeota' }, me)).toBe('bairro');
    expect(proximityOf({ city: 'Fortaleza - CE', district: 'Meireles' }, me)).toBe('cidade');
    expect(proximityOf({ city: 'São Paulo - SP' }, me)).toBe('fora');
  });

  it('"Na sua cidade" includes the bairro; "Mesmo bairro" only the bairro', () => {
    const meireles = { city: 'Fortaleza - CE', district: 'Meireles' };
    expect(matchesProximity(meireles, me, 'cidade')).toBe(true);
    expect(matchesProximity(meireles, me, 'bairro')).toBe(false);
    expect(matchesProximity({ city: 'Recife - PE' }, me, 'nacional')).toBe(true);
  });
});

describe('proximityOf without a reader location', () => {
  it('returns fora instead of throwing when the reader is missing', () => {
    expect(proximityOf({ city: 'Fortaleza - CE' }, undefined)).toBe('fora');
  });
});
