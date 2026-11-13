ALTER TABLE public.books ADD COLUMN IF NOT EXISTS cover_url text, ADD COLUMN IF NOT EXISTS synopsis text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district text;

UPDATE public.profiles p SET district = NULLIF(trim(u.district), '')
  FROM public.user_private u WHERE u.user_id = p.id AND p.district IS NULL;

DROP FUNCTION IF EXISTS public.register_book(text, text, text, text, text, text, text, text[]);

CREATE OR REPLACE FUNCTION public.register_book(_title text, _author text, _isbn text, _category text, _tier text, _condition text, _notes text, _photo_paths text[], _synopsis text DEFAULT '', _cover_url text DEFAULT '')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _book_id uuid;
  _registered_before integer;
  _promo numeric(10,1);
  _acq_so_far numeric(10,1);
  _added numeric(10,1) := 0;
  _path text;
  _cover text := NULLIF(trim(COALESCE(_cover_url, '')), '');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND status = 'banido') THEN
    RAISE EXCEPTION 'account_banned';
  END IF;
  IF _photo_paths IS NULL OR array_length(_photo_paths, 1) <> 3 THEN
    RAISE EXCEPTION 'three_photos_required';
  END IF;
  FOREACH _path IN ARRAY _photo_paths LOOP
    IF _path IS NULL OR split_part(_path, '/', 1) <> _uid::text
       OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'book-photos' AND name = _path) THEN
      RAISE EXCEPTION 'photo_missing';
    END IF;
  END LOOP;

  -- Official covers only from the book databases; anything else falls back to the "Capa Frontal" photo.
  IF _cover IS NOT NULL AND (length(_cover) > 600 OR _cover !~ '^https://([a-z0-9-]+\.)*(google\.com|googleusercontent\.com|googleapis\.com|openlibrary\.org|archive\.org|brasilapi\.com\.br|mercadoeditorial\.org|cblservicos\.org\.br)/') THEN
    _cover := NULL;
  END IF;

  SELECT count(*) INTO _registered_before FROM public.books WHERE owner_id = _uid;

  INSERT INTO public.books (owner_id, title, author, isbn, category, tier, condition, notes, coin_value, photo_paths, synopsis, cover_url)
  VALUES (_uid, trim(_title), trim(_author), NULLIF(trim(_isbn), ''), _category, _tier, _condition, NULLIF(trim(_notes), ''),
          public.book_coin_value(_tier, _condition), _photo_paths,
          NULLIF(left(trim(COALESCE(_synopsis, '')), 4000), ''), _cover)
  RETURNING id INTO _book_id;

  SELECT COALESCE(SUM(amount), 0) INTO _promo FROM public.wallet_entries
   WHERE user_id = _uid AND kind IN ('welcome','acquisition') AND NOT locked AND (expires_at IS NULL OR expires_at > now());

  IF _registered_before = 0 THEN
    UPDATE public.wallet_entries
       SET locked = false,
           amount = LEAST(amount, GREATEST(0, 20.0 - _promo)),
           label = 'Bônus de Boas-Vindas - Ativado pelo 1º livro',
           expires_at = now() + interval '90 days',
           reference_id = _book_id
     WHERE user_id = _uid AND kind = 'welcome' AND locked
     RETURNING amount INTO _added;
    _added := COALESCE(_added, 0);
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO _acq_so_far FROM public.wallet_entries WHERE user_id = _uid AND kind = 'acquisition';
    _added := GREATEST(0, LEAST(0.5, 10.0 - _acq_so_far, 20.0 - _promo));
    IF _added > 0 THEN
      INSERT INTO public.wallet_entries (user_id, amount, kind, label, expires_at, reference_id)
      VALUES (_uid, _added, 'acquisition', 'Incentivo de Acervo - ' || (_registered_before + 1) || 'º Livro Cadastrado',
              now() + interval '90 days', _book_id);
      IF _acq_so_far + _added >= 10.0 THEN
        INSERT INTO public.wallet_entries (user_id, amount, kind, label)
        VALUES (_uid, 0, 'info', 'Limite promocional de acervo: Máximo 10,0 moedas extras.');
      END IF;
    END IF;
  END IF;

  PERFORM public.award_xp(_uid, 5, 'cadastro_livro', _book_id);

  RETURN jsonb_build_object('book_id', _book_id, 'coins_added', _added, 'coin_value', public.book_coin_value(_tier, _condition), 'xp_added', 5);
END;
$function$;

REVOKE ALL ON FUNCTION public.register_book(text, text, text, text, text, text, text, text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_book(text, text, text, text, text, text, text, text[], text, text) TO authenticated;