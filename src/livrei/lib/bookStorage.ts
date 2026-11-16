import { supabase } from '@/integrations/supabase/client';
import type { Book } from '@/livrei/types';

const BUCKET = 'book-photos';

/**
 * Uploads the 3 compressed photos and registers the book in Lovable Cloud.
 * Coin value, welcome bonus, incentives and XP are computed by the database.
 * Returns null when nobody is signed in (demo mode).
 */
export async function saveBookToCloud(book: Book, photos: Blob[]) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;
  if (photos.length !== 3) throw new Error('São necessárias 3 fotos');

  const batch = crypto.randomUUID();
  const paths: string[] = [];
  for (const [i, blob] of photos.entries()) {
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.id}/${batch}-${i + 1}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type,
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) {
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      throw error;
    }
    paths.push(path);
  }

  const { data, error } = await supabase.rpc('register_book', {
    _title: book.title,
    _author: book.author,
    _isbn: book.isbn ?? '',
    _category: book.category ?? 'Outro',
    _tier: book.tier ?? 'PADRÃO',
    _condition: book.condition,
    _notes: book.notes ?? '',
    _photo_paths: paths,
    _synopsis: book.synopsis ?? '',
    _cover_url: book.coverUrl ?? '',
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove(paths);
    throw error;
  }
  return data as { book_id: string; coins_added: number; coin_value: number };
}

/** Short-lived links to show private book photos in the feed. */
export async function getPhotoUrls(paths: string[], expiresIn = 3600): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, expiresIn);
  if (error || !data) return [];
  return data.map((d) => d.signedUrl ?? '');
}
