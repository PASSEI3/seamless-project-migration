-- Who may see another reader's public profile: themselves, owners of books currently listed, and match partners.
CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.books b WHERE b.owner_id = _profile_id AND b.status = 'disponivel')
    OR EXISTS (SELECT 1 FROM public.matches m
                WHERE (m.user_a = auth.uid() AND m.user_b = _profile_id)
                   OR (m.user_b = auth.uid() AND m.user_a = _profile_id))
  )
$$;

-- Who may open a book photo: the uploader, anyone while the book is listed, and the trade partners of that book.
CREATE OR REPLACE FUNCTION public.can_view_book_photo(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    split_part(_object_name, '/', 1) = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.books b
       WHERE _object_name = ANY (b.photo_paths)
         AND (b.status = 'disponivel'
              OR EXISTS (SELECT 1 FROM public.matches m
                          WHERE b.id IN (m.book_a, m.book_b)
                            AND auth.uid() IN (m.user_a, m.user_b)))
    )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_profile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_book_photo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_book_photo(text) TO authenticated;

DROP POLICY IF EXISTS "Signed-in users read profiles" ON public.profiles;
CREATE POLICY "Readers see own, listing owners and match partners"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.can_view_profile(id));

-- The moderation reason is never readable from the app.
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, display_name, city, avatar_url, xp, status, created_at, updated_at, uf, favorite_genres, favorite_authors, district)
  ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Signed-in users view book photos" ON storage.objects;
CREATE POLICY "Readers view photos of listed or traded books"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'book-photos' AND public.can_view_book_photo(name));