REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_summary() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.book_coin_value(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_coin_value(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_deadline_penalty(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ban_user_for_fraud(uuid, text) TO authenticated;