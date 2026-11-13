import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { lookupIsbn } from '@/livrei/lib/isbn';

/** Runs the ISBN cascade on the server so the Google Books key never reaches the phone. */
export const lookupIsbnOnServer = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ isbn: z.string().min(10).max(20) }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env['GOOGLE_BOOKS_API_KEY'] || undefined;
    const book = await lookupIsbn(data.isbn, fetch, key);
    return { book };
  });
