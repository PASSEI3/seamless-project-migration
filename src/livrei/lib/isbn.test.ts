import { describe, expect, it, vi } from 'vitest';
import { isValidIsbn, lookupIsbn, mapCategory, tierForCategory } from './isbn';

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe('ISBN lookup', () => {
  it('validates ISBN-13 and ISBN-10 checksums', () => {
    expect(isValidIsbn('978-85-359-0277-8')).toBe(true);
    expect(isValidIsbn('8535902775')).toBe(true);
    expect(isValidIsbn('9788535902770')).toBe(false);
  });

  it('uses Google Books first', async () => {
    const f = vi.fn(async () => json({ items: [{ volumeInfo: { title: '1984', authors: ['George Orwell'], categories: ['Fiction'] } }] }));
    const book = await lookupIsbn('9788535902778', f as unknown as typeof fetch);
    expect(book).toMatchObject({ title: '1984', author: 'George Orwell', category: 'Ficção', source: 'google' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('falls back to Open Library when Google Books has nothing', async () => {
    const f = vi.fn(async (url: string) =>
      url.includes('googleapis')
        ? json({ totalItems: 0 })
        : json({ 'ISBN:9788535902778': { title: 'O Hobbit', authors: [{ name: 'J.R.R. Tolkien' }], subjects: [{ name: 'Fantasy fiction' }] } }),
    );
    const book = await lookupIsbn('9788535902778', f as unknown as typeof fetch);
    expect(book).toMatchObject({ title: 'O Hobbit', author: 'J.R.R. Tolkien', category: 'Fantasia', source: 'openlibrary' });
  });

  it('falls back to Open Library when Google Books fails', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.includes('googleapis')) throw new Error('offline');
      return json({ 'ISBN:9788535902778': { title: 'Livro', authors: [] } });
    });
    expect(await lookupIsbn('9788535902778', f as unknown as typeof fetch)).toMatchObject({ source: 'openlibrary', author: 'Autor desconhecido' });
  });

  it('maps categories to app categories', () => {
    expect(mapCategory(['Juvenile Fiction'])).toBe('Infantil');
    expect(mapCategory(['Biography & Autobiography'])).toBe('Biografia');
    expect(mapCategory(['Self-Help'])).toBe('Autoajuda');
    expect(mapCategory([])).toBe('Outro');
  });

  it('Clássico/Biografia with ISBN are Premium', () => {
    expect(tierForCategory('Clássico', true)).toBe('PREMIUM');
    expect(tierForCategory('Ficção', true)).toBe('PADRÃO');
  });
});

describe('category priority', () => {
  it('fantasy wins over juvenile when both appear', () => {
    expect(mapCategory(['Fantasy fiction', 'Juvenile literature'])).toBe('Fantasia');
  });
});
