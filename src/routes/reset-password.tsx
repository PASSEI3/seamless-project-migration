import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { authErrorMessage } from '@/livrei/lib/account';

export const Route = createFileRoute('/reset-password')({
  head: () => ({
    meta: [
      { title: 'Criar nova senha — LIVREI' },
      { name: 'description', content: 'Defina uma nova senha para entrar na sua conta LIVREI.' },
      { property: 'og:title', content: 'Criar nova senha — LIVREI' },
      { property: 'og:description', content: 'Defina uma nova senha para entrar na sua conta LIVREI.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data: s }) => { if (s.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  const save = async () => {
    setError(null);
    if (password.length < 6) { setError('A senha deve ter ao menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não são iguais.'); return; }
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) { setError(authErrorMessage(err)); return; }
    setDone(true);
    setTimeout(() => void navigate({ to: '/', replace: true }), 1500);
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center bg-purple-950 px-6">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-400 text-2xl font-black text-purple-950">L</div>
      <h1 className="text-2xl font-extrabold tracking-wide text-purple-50">Nova senha</h1>
      {!ready ? (
        <p className="mt-4 text-center text-sm text-purple-300">
          Abra esta página pelo link de recuperação que enviamos para o seu e-mail.
        </p>
      ) : done ? (
        <p className="mt-4 text-center text-sm font-semibold text-mint-400">Senha alterada! Entrando no LIVREI...</p>
      ) : (
        <form className="mt-6 w-full space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          {[['Nova senha', password, setPassword], ['Repita a nova senha', confirm, setConfirm]].map(([label, value, setter]) => (
            <div key={label as string}>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                <Lock className="h-4 w-4" /> {label as string}
              </label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={value as string}
                  onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                  autoComplete="new-password"
                  className="field-input pr-10"
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400" aria-label="Mostrar senha">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          {error && <p className="text-center text-xs font-medium text-red-300">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-full bg-mint-400 py-3.5 text-sm font-bold text-purple-950 active:scale-95 disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </div>
  );
}
