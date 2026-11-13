import { lookupIsbnOnServer } from '@/livrei/isbn.functions';
import { lookupIsbn, type IsbnBook } from '@/livrei/lib/isbn';

/** Server lookup (with the Google Books key); falls back to a direct browser lookup if the server can't be reached. */
export async function findBookByIsbn(isbn: string): Promise<IsbnBook | null> {
  try {
    const { book } = await lookupIsbnOnServer({ data: { isbn } });
    return book;
  } catch {
    return lookupIsbn(isbn);
  }
}
