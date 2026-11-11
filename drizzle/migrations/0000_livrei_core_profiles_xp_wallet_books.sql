-- ============ Roles (admin actions such as fraud bans) ============
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ Profiles (name, city, avatar, XP, status) ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  city text,
  avatar_url text,
  xp integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'banido')),
  banned_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
-- Users may edit only their public fields; XP and status change only through server functions.
GRANT UPDATE (display_name, city, avatar_url) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============ XP history ============
CREATE TABLE public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('cadastro_livro', 'troca_pin', 'avaliacao', 'prazo_48h_vencido', 'fraude')),
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX xp_events_user_idx ON public.xp_events (user_id, created_at DESC);
GRANT SELECT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own XP history" ON public.xp_events FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ Wallet (decimal coins in 0,5 steps, never rounded) ============
CREATE TABLE public.wallet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(10,1) NOT NULL CHECK (mod(amount * 2, 1) = 0),
  kind text NOT NULL CHECK (kind IN ('welcome', 'acquisition', 'trade', 'spend', 'expiry', 'info')),
  label text NOT NULL,
  locked boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_entries_user_idx ON public.wallet_entries (user_id, created_at DESC);
GRANT SELECT ON public.wallet_entries TO authenticated;
GRANT ALL ON public.wallet_entries TO service_role;
ALTER TABLE public.wallet_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own wallet" ON public.wallet_entries FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ Books (3 mandatory photos) ============
CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 1),
  author text NOT NULL CHECK (length(trim(author)) > 1),
  isbn text,
  category text,
  tier text NOT NULL CHECK (tier IN ('PADRÃO', 'PREMIUM')),
  condition text NOT NULL CHECK (condition IN ('Novo/Lacrado', 'Seminovo', 'Bom Estado', 'Marcas de Uso')),
  notes text,
  coin_value numeric(10,1) NOT NULL,
  photo_paths text[] NOT NULL CHECK (array_length(photo_paths, 1) = 3),
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'em_troca', 'trocado')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX books_owner_idx ON public.books (owner_id, created_at DESC);
CREATE INDEX books_feed_idx ON public.books (status, created_at DESC);
GRANT SELECT, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users browse books" ON public.books FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners delete own available books" ON public.books FOR DELETE TO authenticated USING (owner_id = auth.uid() AND status = 'disponivel');

-- ============ Coin value rule: common 10,0 / premium 30,0 / +5,0 if Novo/Lacrado ============
CREATE OR REPLACE FUNCTION public.book_coin_value(_tier text, _condition text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (CASE WHEN _tier = 'PREMIUM' THEN 30.0 ELSE 10.0 END)
       + (CASE WHEN _condition = 'Novo/Lacrado' THEN 5.0 ELSE 0 END)
$$;

-- ============ XP helper (internal only) ============
CREATE OR REPLACE FUNCTION public.award_xp(_user_id uuid, _delta integer, _reason text, _reference uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.xp_events (user_id, delta, reason, reference_id) VALUES (_user_id, _delta, _reason, _reference);
  UPDATE public.profiles SET xp = xp + _delta, updated_at = now() WHERE id = _user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.award_xp(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;

-- ============ Wallet balance (unlocked, not expired) ============
CREATE OR REPLACE FUNCTION public.wallet_summary()
RETURNS TABLE (balance numeric, promo_active numeric, welcome_locked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE NOT locked AND (expires_at IS NULL OR expires_at > now())), 0)::numeric(10,1),
    COALESCE(SUM(amount) FILTER (WHERE kind IN ('welcome','acquisition') AND NOT locked AND (expires_at IS NULL OR expires_at > now())), 0)::numeric(10,1),
    COALESCE(bool_or(kind = 'welcome' AND locked), false)
  FROM public.wallet_entries WHERE user_id = auth.uid()
$$;

-- ============ Book registration: validates 3 photos, applies coin + XP rules ============
CREATE OR REPLACE FUNCTION public.register_book(
  _title text, _author text, _isbn text, _category text, _tier text, _condition text, _notes text, _photo_paths text[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _book_id uuid;
  _registered_before integer;
  _promo numeric(10,1);
  _acq_so_far numeric(10,1);
  _added numeric(10,1) := 0;
  _path text;
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

  SELECT count(*) INTO _registered_before FROM public.books WHERE owner_id = _uid;

  INSERT INTO public.books (owner_id, title, author, isbn, category, tier, condition, notes, coin_value, photo_paths)
  VALUES (_uid, trim(_title), trim(_author), NULLIF(trim(_isbn), ''), _category, _tier, _condition, NULLIF(trim(_notes), ''),
          public.book_coin_value(_tier, _condition), _photo_paths)
  RETURNING id INTO _book_id;

  SELECT COALESCE(SUM(amount), 0) INTO _promo FROM public.wallet_entries
   WHERE user_id = _uid AND kind IN ('welcome','acquisition') AND NOT locked AND (expires_at IS NULL OR expires_at > now());

  IF _registered_before = 0 THEN
    -- 1st book unlocks the welcome bonus (respecting the 20,0 promo cap); earned coins expire in 90 days
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

  PERFORM public.award_xp(_uid, 10, 'cadastro_livro', _book_id);

  RETURN jsonb_build_object('book_id', _book_id, 'coins_added', _added, 'coin_value', public.book_coin_value(_tier, _condition));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.register_book(text, text, text, text, text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_book(text, text, text, text, text, text, text, text[]) TO authenticated;

-- ============ Admin-only: 48h deadline penalty and fraud ban ============
CREATE OR REPLACE FUNCTION public.apply_deadline_penalty(_user_id uuid, _reference uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public.award_xp(_user_id, -15, 'prazo_48h_vencido', _reference);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_deadline_penalty(uuid, uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.ban_user_for_fraud(_user_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET status = 'banido', banned_reason = _reason, updated_at = now() WHERE id = _user_id;
  INSERT INTO public.xp_events (user_id, delta, reason) VALUES (_user_id, 0, 'fraude');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ban_user_for_fraud(uuid, text) FROM PUBLIC, anon;

-- ============ Signup: profile + locked welcome bonus ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1), ''),
          NEW.raw_user_meta_data ->> 'avatar_url');
  INSERT INTO public.wallet_entries (user_id, amount, kind, label, locked)
  VALUES (NEW.id, 10.0, 'welcome', 'Bônus de Boas-Vindas - Inativo (ative cadastrando seu 1º livro)', true);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ Storage: book photos live under <user_id>/... ============
CREATE POLICY "Users upload own book photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Signed-in users view book photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'book-photos');
CREATE POLICY "Users delete own book photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'book-photos' AND (storage.foldername(name))[1] = auth.uid()::text);