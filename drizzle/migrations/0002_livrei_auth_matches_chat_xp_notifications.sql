-- ============ Profile extras (public to signed-in readers) ============
ALTER TABLE public.profiles
  ADD COLUMN uf text,
  ADD COLUMN favorite_genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN favorite_authors text[] NOT NULL DEFAULT '{}';
GRANT UPDATE (display_name, city, uf, avatar_url, favorite_genres, favorite_authors) ON public.profiles TO authenticated;

-- ============ Private personal data (CPF, phone, address) — owner only ============
CREATE TABLE public.user_private (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  cpf text,
  phone text,
  cep text,
  street text,
  number text,
  district text,
  city text,
  uf text,
  portaria_ok boolean NOT NULL DEFAULT false,
  reference text CHECK (reference IS NULL OR length(reference) <= 255),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_private TO authenticated;
GRANT ALL ON public.user_private TO service_role;
ALTER TABLE public.user_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads private data" ON public.user_private FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owner inserts private data" ON public.user_private FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner updates private data" ON public.user_private FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ Signup: profile (name, city, tastes) + locked welcome bonus ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, city, uf, favorite_genres, favorite_authors)
  VALUES (NEW.id,
          COALESCE(_meta ->> 'full_name', _meta ->> 'name', split_part(NEW.email, '@', 1), ''),
          _meta ->> 'avatar_url',
          NULLIF(_meta ->> 'city', ''),
          NULLIF(upper(_meta ->> 'uf'), ''),
          CASE WHEN jsonb_typeof(_meta -> 'genres') = 'array'
               THEN ARRAY(SELECT jsonb_array_elements_text(_meta -> 'genres')) ELSE '{}'::text[] END,
          CASE WHEN jsonb_typeof(_meta -> 'authors') = 'array'
               THEN ARRAY(SELECT jsonb_array_elements_text(_meta -> 'authors')) ELSE '{}'::text[] END);
  INSERT INTO public.wallet_entries (user_id, amount, kind, label, locked)
  VALUES (NEW.id, 10.0, 'welcome', 'Bônus de Boas-Vindas - Inativo (ative cadastrando seu 1º livro)', true);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============ Official XP table: +5 per book registered (3 photos) ============
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
$$;

-- ============ Notifications (in-app + push outbox) ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('match_direto', 'desapego', 'chat', 'uber_urgente')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  push_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_push_pending_idx ON public.notifications (created_at) WHERE push_sent_at IS NULL;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users mark own notifications read" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _kind text, _title text, _body text, _data jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, kind, title, body, data) VALUES (_user_id, _kind, _title, _body, COALESCE(_data, '{}'::jsonb));
$$;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ============ Likes (wishlist) ============
CREATE TABLE public.book_likes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);
CREATE INDEX book_likes_book_idx ON public.book_likes (book_id);
GRANT SELECT, INSERT, DELETE ON public.book_likes TO authenticated;
GRANT ALL ON public.book_likes TO service_role;
ALTER TABLE public.book_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users and book owners read likes" ON public.book_likes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.owner_id = auth.uid()));
CREATE POLICY "Users like others' books" ON public.book_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.owner_id <> auth.uid()));
CREATE POLICY "Users remove own likes" ON public.book_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ Matches (created only by the mutual-like trigger) ============
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_a uuid REFERENCES public.books(id) ON DELETE SET NULL,
  book_b uuid REFERENCES public.books(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'direto' CHECK (kind IN ('direto')),
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'conversando', 'finalizado', 'cancelado')),
  -- R$ 2,00 fees: set only by the payment backend (service role), never by the app
  fee_paid_a boolean NOT NULL DEFAULT false,
  fee_paid_b boolean NOT NULL DEFAULT false,
  received_a boolean NOT NULL DEFAULT false,
  received_b boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK (user_a <> user_b)
);
CREATE INDEX matches_user_a_idx ON public.matches (user_a, created_at DESC);
CREATE INDEX matches_user_b_idx ON public.matches (user_b, created_at DESC);
GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read matches" ON public.matches FOR SELECT TO authenticated USING (auth.uid() IN (user_a, user_b));

-- Each participant's secret 4-digit PIN (only the owner can read it)
CREATE TABLE public.match_pins (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin text NOT NULL CHECK (pin ~ '^[0-9]{4}$'),
  failed_attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, user_id)
);
GRANT SELECT ON public.match_pins TO authenticated;
GRANT ALL ON public.match_pins TO service_role;
ALTER TABLE public.match_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own PIN" ON public.match_pins FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.trade_ratings (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, rater_id)
);
GRANT SELECT ON public.trade_ratings TO authenticated;
GRANT ALL ON public.trade_ratings TO service_role;
ALTER TABLE public.trade_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read ratings" ON public.trade_ratings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND auth.uid() IN (m.user_a, m.user_b)));

-- ============ Chat: readable/writable only after BOTH fees are paid ============
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_match_idx ON public.chat_messages (match_id, created_at);

CREATE OR REPLACE FUNCTION public.can_chat(_match_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
     WHERE m.id = _match_id AND auth.uid() IN (m.user_a, m.user_b)
       AND m.fee_paid_a AND m.fee_paid_b AND m.status <> 'cancelado'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_chat(uuid) TO authenticated;

GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read chat after both fees" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.can_chat(match_id));
CREATE POLICY "Participants write chat after both fees" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_chat(match_id));

-- ============ Trigger: mutual like => Match Direto + PINs + push ============
CREATE OR REPLACE FUNCTION public.create_match_on_mutual_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _owner uuid;
  _their_book_title text;
  _my_book uuid;
  _my_book_title text;
  _match uuid;
BEGIN
  SELECT owner_id, title INTO _owner, _their_book_title FROM public.books WHERE id = NEW.book_id AND status = 'disponivel';
  IF _owner IS NULL OR _owner = NEW.user_id THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.matches m WHERE m.status IN ('novo','conversando') AND NEW.book_id IN (m.book_a, m.book_b)) THEN
    RETURN NEW;
  END IF;

  SELECT b.id, b.title INTO _my_book, _my_book_title
    FROM public.book_likes bl JOIN public.books b ON b.id = bl.book_id
   WHERE bl.user_id = _owner AND b.owner_id = NEW.user_id AND b.status = 'disponivel'
     AND NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.status IN ('novo','conversando') AND b.id IN (m.book_a, m.book_b))
   ORDER BY bl.created_at LIMIT 1;
  IF _my_book IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.matches (user_a, user_b, book_a, book_b)
  VALUES (NEW.user_id, _owner, _my_book, NEW.book_id) RETURNING id INTO _match;

  INSERT INTO public.match_pins (match_id, user_id, pin) VALUES
    (_match, NEW.user_id, lpad(floor(random() * 10000)::int::text, 4, '0')),
    (_match, _owner, lpad(floor(random() * 10000)::int::text, 4, '0'));

  PERFORM public.notify_user(NEW.user_id, 'match_direto', 'Deu Match Direto! 💚',
    'Você e outro leitor querem trocar "' || _their_book_title || '".', jsonb_build_object('match_id', _match));
  PERFORM public.notify_user(_owner, 'match_direto', 'Deu Match Direto! 💚',
    'Você e outro leitor querem trocar "' || _my_book_title || '".', jsonb_build_object('match_id', _match));
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_match_on_mutual_like() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_book_like_created AFTER INSERT ON public.book_likes
  FOR EACH ROW EXECUTE FUNCTION public.create_match_on_mutual_like();

-- ============ Trigger: Desapego (a wanted title became available) ============
CREATE OR REPLACE FUNCTION public.notify_wanted_book_available()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, data)
  SELECT DISTINCT bl.user_id, 'desapego', 'Livro desejado disponível! 📚',
         'Alguém acabou de desapegar de "' || NEW.title || '".', jsonb_build_object('book_id', NEW.id)
    FROM public.book_likes bl JOIN public.books b ON b.id = bl.book_id
   WHERE lower(trim(b.title)) = lower(trim(NEW.title)) AND b.id <> NEW.id AND bl.user_id <> NEW.owner_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_wanted_book_available() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_book_created_notify AFTER INSERT ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.notify_wanted_book_available();

-- ============ Trigger: new chat message ============
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _other uuid;
BEGIN
  SELECT CASE WHEN m.user_a = NEW.sender_id THEN m.user_b ELSE m.user_a END INTO _other
    FROM public.matches m WHERE m.id = NEW.match_id;
  IF _other IS NOT NULL THEN
    PERFORM public.notify_user(_other, 'chat', 'Nova mensagem no chat 💬', left(NEW.body, 120),
      jsonb_build_object('match_id', NEW.match_id));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_chat_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_chat_message_created AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_chat_message();

-- ============ Urgent Uber alert to the sender (max 1 per 10 min per match) ============
CREATE OR REPLACE FUNCTION public.request_uber_ready(_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.matches; _other uuid;
BEGIN
  SELECT * INTO _m FROM public.matches WHERE id = _match_id;
  IF _m.id IS NULL OR auth.uid() NOT IN (_m.user_a, _m.user_b) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _m.status IN ('finalizado', 'cancelado') THEN RAISE EXCEPTION 'match_closed'; END IF;
  _other := CASE WHEN _m.user_a = auth.uid() THEN _m.user_b ELSE _m.user_a END;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id = _other AND kind = 'uber_urgente'
              AND data ->> 'match_id' = _match_id::text AND created_at > now() - interval '10 minutes') THEN
    RETURN;
  END IF;
  PERFORM public.notify_user(_other, 'uber_urgente', 'Alerta urgente da Uber 🛵',
    'Você está disponível para embalar e enviar agora?', jsonb_build_object('match_id', _match_id));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_uber_ready(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_uber_ready(uuid) TO authenticated;

-- ============ Trade completed with PIN: +20 XP to both ============
-- The person delivering types the PIN dictated by the receiver.
CREATE OR REPLACE FUNCTION public.confirm_handoff_pin(_match_id uuid, _pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _m public.matches;
  _receiver uuid;
  _p public.match_pins;
BEGIN
  SELECT * INTO _m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF _m.id IS NULL OR _uid NOT IN (_m.user_a, _m.user_b) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _m.status IN ('finalizado', 'cancelado') THEN RAISE EXCEPTION 'match_closed'; END IF;
  IF NOT (_m.fee_paid_a AND _m.fee_paid_b) THEN RAISE EXCEPTION 'fees_pending'; END IF;

  _receiver := CASE WHEN _m.user_a = _uid THEN _m.user_b ELSE _m.user_a END;
  SELECT * INTO _p FROM public.match_pins WHERE match_id = _match_id AND user_id = _receiver FOR UPDATE;
  IF _p.failed_attempts >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pin_locked');
  END IF;
  IF _p.pin IS DISTINCT FROM _pin THEN
    UPDATE public.match_pins SET failed_attempts = failed_attempts + 1 WHERE match_id = _match_id AND user_id = _receiver;
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin', 'attempts_left', 4 - _p.failed_attempts);
  END IF;

  IF _receiver = _m.user_a THEN
    UPDATE public.matches SET received_a = true, status = 'conversando' WHERE id = _match_id RETURNING * INTO _m;
  ELSE
    UPDATE public.matches SET received_b = true, status = 'conversando' WHERE id = _match_id RETURNING * INTO _m;
  END IF;

  IF _m.received_a AND _m.received_b THEN
    UPDATE public.matches SET status = 'finalizado', finished_at = now() WHERE id = _match_id;
    UPDATE public.books SET status = 'trocado' WHERE id IN (_m.book_a, _m.book_b);
    PERFORM public.award_xp(_m.user_a, 20, 'troca_pin', _match_id);
    PERFORM public.award_xp(_m.user_b, 20, 'troca_pin', _match_id);
    RETURN jsonb_build_object('ok', true, 'status', 'finalizado', 'xp_added', 20);
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', 'aguardando_outro_lado');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.confirm_handoff_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_handoff_pin(uuid, text) TO authenticated;

-- ============ Rating a received book: +5 XP (once per trade) ============
CREATE OR REPLACE FUNCTION public.rate_trade(_match_id uuid, _stars integer, _comment text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _m public.matches;
BEGIN
  SELECT * INTO _m FROM public.matches WHERE id = _match_id;
  IF _m.id IS NULL OR _uid NOT IN (_m.user_a, _m.user_b) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _m.status <> 'finalizado' THEN RAISE EXCEPTION 'trade_not_finished'; END IF;
  IF EXISTS (SELECT 1 FROM public.trade_ratings WHERE match_id = _match_id AND rater_id = _uid) THEN
    RAISE EXCEPTION 'already_rated';
  END IF;
  INSERT INTO public.trade_ratings (match_id, rater_id, stars, comment)
  VALUES (_match_id, _uid, _stars, NULLIF(trim(_comment), ''));
  PERFORM public.award_xp(_uid, 5, 'avaliacao', _match_id);
  RETURN jsonb_build_object('ok', true, 'xp_added', 5);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rate_trade(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rate_trade(uuid, integer, text) TO authenticated;