DROP POLICY IF EXISTS "Owners delete own available books" ON public.books;
REVOKE DELETE ON public.books FROM authenticated;

-- Can this reader remove this book, and which promo coins would be reversed?
CREATE OR REPLACE FUNCTION public.book_removal_check(_book_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _status text;
  _remaining integer;
  _net_acq numeric(10,1);
  _target numeric(10,1);
  _acq_reversal numeric(10,1) := 0;
  _welcome numeric(10,1) := 0;
  _locks_welcome boolean := false;
  _balance numeric(10,1);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT status INTO _status FROM public.books WHERE id = _book_id AND owner_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'book_not_found'; END IF;

  IF _status <> 'disponivel'
     OR EXISTS (SELECT 1 FROM public.matches m WHERE _book_id IN (m.book_a, m.book_b) AND m.status IN ('novo', 'conversando'))
     OR EXISTS (SELECT 1 FROM public.book_likes bl WHERE bl.book_id = _book_id) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'negociacao_ativa', 'reversal', 0, 'locks_welcome', false, 'welcome_amount', 0);
  END IF;

  SELECT count(*) INTO _remaining FROM public.books WHERE owner_id = _uid AND id <> _book_id;
  SELECT COALESCE(SUM(amount), 0) INTO _net_acq FROM public.wallet_entries WHERE user_id = _uid AND kind = 'acquisition';
  _target := CASE WHEN _remaining = 0 THEN 0 ELSE LEAST(10.0, (_remaining - 1) * 0.5) END;
  _acq_reversal := GREATEST(0, _net_acq - _target);

  IF _remaining = 0 THEN
    SELECT COALESCE(SUM(amount), 0), COUNT(*) > 0 INTO _welcome, _locks_welcome FROM public.wallet_entries
     WHERE user_id = _uid AND kind = 'welcome' AND NOT locked AND (expires_at IS NULL OR expires_at > now());
  END IF;

  SELECT COALESCE(SUM(amount) FILTER (WHERE NOT locked AND (expires_at IS NULL OR expires_at > now())), 0)
    INTO _balance FROM public.wallet_entries WHERE user_id = _uid;

  IF _balance < _acq_reversal + _welcome THEN
    RETURN jsonb_build_object('allowed', false,
      'reason', CASE WHEN _remaining = 0 THEN 'bonus_gasto' ELSE 'saldo_insuficiente' END,
      'reversal', _acq_reversal, 'locks_welcome', _locks_welcome, 'welcome_amount', _welcome);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', NULL, 'reversal', _acq_reversal,
    'locks_welcome', _locks_welcome, 'welcome_amount', _welcome);
END;
$$;

-- Removes a free book, reversing its promo coins in the same transaction.
CREATE OR REPLACE FUNCTION public.remove_book(_book_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _check jsonb;
  _paths text[];
  _reversal numeric(10,1);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = _uid FOR UPDATE;
  SELECT photo_paths INTO _paths FROM public.books WHERE id = _book_id AND owner_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'book_not_found'; END IF;

  _check := public.book_removal_check(_book_id);
  IF NOT (_check->>'allowed')::boolean THEN RAISE EXCEPTION '%', _check->>'reason'; END IF;

  _reversal := (_check->>'reversal')::numeric;
  IF _reversal > 0 THEN
    INSERT INTO public.wallet_entries (user_id, amount, kind, label, reference_id)
    VALUES (_uid, -_reversal, 'acquisition', 'Estorno de Incentivo de Acervo - Livro removido da estante', _book_id);
  END IF;

  IF (_check->>'locks_welcome')::boolean THEN
    UPDATE public.wallet_entries
       SET locked = true,
           label = 'Bônus de Boas-Vindas - Bloqueado (estante vazia)',
           expires_at = NULL,
           reference_id = NULL
     WHERE user_id = _uid AND kind = 'welcome' AND NOT locked AND (expires_at IS NULL OR expires_at > now());
  END IF;

  DELETE FROM public.books WHERE id = _book_id;

  RETURN jsonb_build_object('removed', true, 'reversal', _reversal,
    'locked_welcome', (_check->>'locks_welcome')::boolean, 'photo_paths', to_jsonb(_paths));
END;
$$;

REVOKE ALL ON FUNCTION public.book_removal_check(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_book(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_removal_check(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_book(uuid) TO authenticated;