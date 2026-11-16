import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import type { Book, UserPreferences } from '@/livrei/types';
import type { WalletEntry } from '@/livrei/data';
import { BOOK_COLUMNS, rowToBook, signedUrlMap, type BookRow } from '@/livrei/lib/listings';

/** Translates auth errors into Portuguese for the entry screens. */
export function authErrorMessage(error: { message?: string } | null | undefined): string {
  const msg = (error?.message ?? '').toLowerCase();
  if (msg.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (msg.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'Este e-mail já tem conta. Entre com sua senha.';
  if (msg.includes('password') && (msg.includes('weak') || msg.includes('pwned') || msg.includes('leaked')))
    return 'Senha muito fraca ou já vazada na internet. Escolha outra.';
  if (msg.includes('email address is not allowed') || msg.includes('invalid') && msg.includes('email'))
    return 'Este e-mail não pode receber mensagens. Use um e-mail real.';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos.';
  return 'Não foi possível concluir agora. Tente novamente.';
}

export async function signInWithEmail(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? authErrorMessage(error) : null;
}

export async function signInWithGoogle(): Promise<string | null> {
  const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
  if (result.error) return 'Não foi possível entrar com o Google. Tente novamente.';
  return null;
}

export async function sendPasswordReset(email: string): Promise<string | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return error ? authErrorMessage(error) : null;
}

export interface SignUpData {
  name: string;
  email: string;
  password: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  portariaOk: boolean;
  reference: string;
  acceptedTerms: boolean;
}

export type PrivateData = Omit<SignUpData, 'name' | 'email' | 'password' | 'acceptedTerms'>;

const PENDING_KEY = 'livrei:pending-private';

/**
 * Creates the account. Name, city and tastes go to the public profile; CPF, phone and
 * address stay on this device until the e-mail is confirmed, then go to the private table.
 */
export async function signUpWithEmail(data: SignUpData, prefs: UserPreferences): Promise<string | null> {
  const { error } = await supabase.auth.signUp({
    email: data.email.trim(),
    password: data.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        full_name: data.name.trim(),
        city: data.city.trim(),
        uf: data.state.trim().toUpperCase(),
        genres: prefs.genres,
        authors: prefs.authors,
      },
    },
  });
  if (error) return authErrorMessage(error);
  const { name: _n, email: _e, password: _p, acceptedTerms: _t, ...priv } = data;
  localStorage.setItem(PENDING_KEY, JSON.stringify({ email: data.email.trim().toLowerCase(), data: priv }));
  return null;
}

export async function savePrivateData(userId: string, d: PrivateData): Promise<string | null> {
  const { error } = await supabase.from('user_private').upsert({
    user_id: userId,
    cpf: d.cpf,
    phone: d.phone,
    cep: d.cep,
    street: d.street,
    number: d.number,
    district: d.district,
    city: d.city,
    uf: d.state.toUpperCase(),
    portaria_ok: d.portariaOk,
    reference: d.reference || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return 'Não foi possível salvar seus dados. Tente novamente.';
  await supabase.from('profiles').update({ city: d.city, uf: d.state.toUpperCase(), district: d.district.trim() || null }).eq('id', userId);
  return null;
}

/** Sends the signup data kept on this device once the user is signed in. */
export async function flushPendingPrivate(userId: string, email: string | undefined): Promise<boolean> {
  const raw = localStorage.getItem(PENDING_KEY);
  if (!raw) return false;
  try {
    const pending = JSON.parse(raw) as { email: string; data: PrivateData };
    if (email && pending.email !== email.toLowerCase()) return false;
    const err = await savePrivateData(userId, pending.data);
    if (!err) localStorage.removeItem(PENDING_KEY);
    return !err;
  } catch {
    localStorage.removeItem(PENDING_KEY);
    return false;
  }
}

export async function loadPrivateData(userId: string) {
  const { data } = await supabase.from('user_private').select('*').eq('user_id', userId).maybeSingle();
  return data;
}

export async function updateDisplayName(userId: string, name: string): Promise<string | null> {
  const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', userId);
  return error ? 'Não foi possível salvar o nome.' : null;
}

export interface AccountSnapshot {
  profile: { name: string; city: string; district: string; xp: number; genres: string[]; authors: string[] };
  shelf: Book[];
  wallet: WalletEntry[];
  balance: number;
  promoActive: number;
  hasPrivateData: boolean;
}


const walletType = (kind: string): WalletEntry['type'] =>
  kind === 'welcome' ? 'bonus' : kind === 'info' ? 'info' : kind === 'expiry' ? 'expiry' : 'acquisition';

export async function loadAccount(userId: string): Promise<AccountSnapshot> {
  const [profileRes, booksRes, walletRes, summaryRes, privRes] = await Promise.all([
    supabase.from('profiles').select('display_name, city, uf, district, xp, favorite_genres, favorite_authors').eq('id', userId).maybeSingle(),
    supabase.from('books').select(BOOK_COLUMNS).eq('owner_id', userId).neq('status', 'trocado').order('created_at', { ascending: false }),
    supabase.from('wallet_entries').select('id, amount, kind, label, locked').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.rpc('wallet_summary'),
    supabase.from('user_private').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  const p = profileRes.data;
  const bookRows = (booksRes.data ?? []) as BookRow[];
  const urlByPath = await signedUrlMap(bookRows.flatMap((b) => b.photo_paths ?? []));
  const summary = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data;
  return {
    profile: {
      name: p?.display_name || 'Leitor',
      city: [p?.city, p?.uf].filter(Boolean).join(' - '),
      district: p?.district ?? '',
      xp: p?.xp ?? 0,
      genres: p?.favorite_genres ?? [],
      authors: p?.favorite_authors ?? [],
    },
    shelf: (booksRes.data ?? []).map((b) => rowToBook(b as BookRow, p?.display_name || undefined, urlByPath)),
    wallet: (walletRes.data ?? []).map((w) => ({
      id: w.id,
      amount: Number(w.amount),
      label: w.label,
      type: walletType(w.kind),
      locked: w.locked,
    })),
    balance: Number(summary?.balance ?? 0),
    promoActive: Number(summary?.promo_active ?? 0),
    hasPrivateData: !!privRes.data,
  };
}

export async function savePreferences(userId: string, prefs: UserPreferences): Promise<void> {
  await supabase.from('profiles').update({ favorite_genres: prefs.genres, favorite_authors: prefs.authors }).eq('id', userId);
}

/** Books the reader liked (Desejos), newest first. */
export async function loadLikedBooks(userId: string) {
  const { data } = await supabase
    .from('book_likes')
    .select(`created_at, book:books!book_likes_book_id_fkey(${BOOK_COLUMNS})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (data ?? []).map((r) => (r as unknown as { book: BookRow | null }).book).filter((b): b is BookRow => !!b);
  const urlByPath = await signedUrlMap(rows.map((b) => b.photo_paths?.[0]).filter((x): x is string => !!x));
  return rows.map((b) => rowToBook(b, undefined, urlByPath));
}
