import { describe, expect, it, vi } from 'vitest';
import { cleanSynopsis, defaultSynopsis, isValidIsbn, lookupIsbn, mapCategory, tierForCategory } from './isbn';

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const ISBN = '9788535902778';

describe('ISBN lookup cascade', () => {
  it('validates ISBN-13 and ISBN-10 checksums', () => {
    expect(isValidIsbn('978-85-359-0277-8')).toBe(true);
    expect(isValidIsbn('8535902775')).toBe(true);
    expect(isValidIsbn('9788535902770')).toBe(false);
  });

  it('uses Google Books first, with the key, and stops when cover and synopsis came back', async () => {
    const f = vi.fn(async (_url: string) => json({ items: [{ volumeInfo: {
      title: '1984', authors: ['George Orwell'], categories: ['Fiction'],
      description: '<p>Um <b>clássico</b>.</p>', imageLinks: { thumbnail: 'http://books.google.com/x?id=1&edge=curl' },
    } }] }));
    const book = await lookupIsbn(ISBN, f as unknown as typeof fetch, 'KEY123');
    expect(book).toMatchObject({ title: '1984', source: 'google', synopsis: 'Um clássico.', coverUrl: 'https://books.google.com/x?id=1' });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0]![0]).toContain('&key=KEY123');
  });

  it('BrasilAPI is the 2nd source (Brazilian books, Portuguese synopsis)', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.includes('googleapis')) return json({ totalItems: 0 });
      if (url.includes('brasilapi')) return json({ title: 'Dom Casmurro', authors: ['Machado de Assis'], subjects: ['Literatura'], synopsis: 'Bentinho e Capitu.', cover_url: 'https://brasilapi.com.br/capa.jpg' });
      throw new Error('should not reach Open Library');
    });
    const book = await lookupIsbn(ISBN, f as unknown as typeof fetch);
    expect(book).toMatchObject({ title: 'Dom Casmurro', source: 'brasilapi', synopsis: 'Bentinho e Capitu.', coverUrl: 'https://brasilapi.com.br/capa.jpg' });
  });

  it('Open Library is the 3rd source and fills a missing cover', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.includes('googleapis')) throw new Error('quota');
      if (url.includes('brasilapi')) return json({ title: 'O Hobbit', authors: ['J.R.R. Tolkien'], synopsis: 'Bilbo.', cover_url: null });
      return json({ [`ISBN:${ISBN}`]: { title: 'The Hobbit', authors: [{ name: 'Tolkien' }], cover: { large: 'https://covers.openlibrary.org/b/id/1-L.jpg' } } });
    });
    const book = await lookupIsbn(ISBN, f as unknown as typeof fetch);
    expect(book).toMatchObject({ title: 'O Hobbit', source: 'brasilapi', synopsis: 'Bilbo.', coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg' });
  });

  it('returns null when none of the 3 databases knows the ISBN', async () => {
    const f = vi.fn(async (url: string) => (url.includes('openlibrary') ? json({}) : json({}, false)));
    expect(await lookupIsbn(ISBN, f as unknown as typeof fetch)).toBeNull();
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('maps categories to app categories', () => {
    expect(mapCategory(['Juvenile Fiction'])).toBe('Infantil');
    expect(mapCategory(['Biography & Autobiography'])).toBe('Biografia');
    expect(mapCategory(['Self-Help'])).toBe('Autoajuda');
    expect(mapCategory(['Fantasy fiction', 'Juvenile literature'])).toBe('Fantasia');
    expect(mapCategory([])).toBe('Outro');
  });

  it('Clássico/Biografia with ISBN are Premium', () => {
    expect(tierForCategory('Clássico', true)).toBe('PREMIUM');
    expect(tierForCategory('Ficção', true)).toBe('PADRÃO');
  });

  it('strips HTML from synopses', () => {
    expect(cleanSynopsis('<p>A&amp;B</p>')).toBe('A&B');
  });

  it('blank synopsis gets the friendly default with the owner name', () => {
    expect(defaultSynopsis('Ana')).toBe('Exemplar físico disponível para troca na estante de Ana. Confira as 3 fotos reais do estado de conservação.');
  });
});
