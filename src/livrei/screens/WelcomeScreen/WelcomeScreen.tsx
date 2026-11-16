import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { AppLogo } from '@/livrei/components/AppLogo';
import { sendPasswordReset, signInWithEmail, signInWithGoogle } from '@/livrei/lib/account';

interface Props {
  onCreateAccount: () => void;
  /** Message shown above the login form (e.g. "confirme seu e-mail"). */
  notice?: string | null;
  initialMode?: 'welcome' | 'login';
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function WelcomeScreen({ onCreateAccount, notice, initialMode = 'welcome' }: Props) {
  const [mode, setMode] = useState<'welcome' | 'login'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [busy, setBusy] = useState<null | 'google' | 'login' | 'forgot'>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setBusy('google');
    const err = await signInWithGoogle();
    setBusy(null);
    if (err) setError(err);
  };

  const handleLogin = async () => {
    setError(null);
    if (!isEmail(email)) { setError('Digite um e-mail válido.'); return; }
    if (!password) { setError('Digite sua senha.'); return; }
    setBusy('login');
    const err = await signInWithEmail(email, password);
    setBusy(null);
    if (err) setError(err);
  };

  const handleForgot = async () => {
    setError(null);
    if (!isEmail(email)) { setError('Digite seu e-mail acima para receber o link.'); return; }
    setBusy('forgot');
    const err = await sendPasswordReset(email);
    setBusy(null);
    if (err) setError(err);
    else setForgotSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-purple-950">
      <div className="pt-5" />

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
        {mode === 'welcome' ? (
          <div className="flex w-full max-w-sm flex-col items-center animate-fade-in">
            {/* Logo */}
            <AppLogo className="mb-4 h-20 w-20 shadow-xl shadow-mint-400/20" />
            <h1 className="text-3xl font-extrabold tracking-wide text-purple-50">LIVREI</h1>
            <p className="mt-2 text-sm font-medium text-mint-300">Quem desapega, lê mais.</p>

            {/* Buttons */}
            <div className="mt-10 w-full space-y-3">
              <GoogleButton onClick={handleGoogle} loading={busy === 'google'} />

              {/* Create account */}
              <button
                onClick={onCreateAccount}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-mint-400 py-3.5 text-sm font-bold text-purple-950 shadow-lg shadow-mint-400/20 transition active:scale-95"
              >
                Criar conta com e-mail
              </button>
            </div>

            {error && <p className="mt-4 text-center text-xs font-medium text-red-300">{error}</p>}

            {/* Login link */}
            <button
              onClick={() => { setError(null); setMode('login'); }}
              className="mt-6 text-xs font-medium text-purple-300 active:scale-95"
            >
              Já tem uma conta? <span className="font-bold text-mint-400">Entrar</span>
            </button>
          </div>
        ) : (
          <div className="flex w-full max-w-sm flex-col items-center animate-fade-in">
            {/* Logo small */}
            <AppLogo className="mb-3 h-14 w-14" />
            <h1 className="text-2xl font-extrabold tracking-wide text-purple-50">LIVREI</h1>
            <p className="mt-1 text-sm font-medium text-mint-300">Entrar na sua conta</p>

            {notice && (
              <div className="mt-5 w-full rounded-2xl bg-mint-400/10 p-3.5 ring-1 ring-mint-400/30">
                <p className="text-center text-xs leading-relaxed text-mint-200">{notice}</p>
              </div>
            )}

            {/* Login form */}
            <form
              className="mt-6 w-full space-y-4"
              onSubmit={(e) => { e.preventDefault(); void handleLogin(); }}
            >
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                  <Mail className="h-4 w-4" /> E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="voce@email.com"
                  autoComplete="email"
                  className="w-full rounded-xl bg-purple-900 px-3 py-3.5 text-sm text-purple-50 outline-hidden ring-1 ring-purple-700 placeholder:text-purple-500 focus:ring-mint-400"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                  <Lock className="h-4 w-4" /> Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    placeholder="Sua senha"
                    autoComplete="current-password"
                    className="w-full rounded-xl bg-purple-900 px-3 py-3.5 pr-11 text-sm text-purple-50 outline-hidden ring-1 ring-purple-700 placeholder:text-purple-500 focus:ring-mint-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 active:scale-90"
                    aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setShowForgot(true); setForgotSent(false); setError(null); }}
                className="text-xs font-medium text-purple-400 underline underline-offset-2 active:scale-95"
              >
                Esqueci minha senha
              </button>

              {error && <p className="text-center text-xs font-medium text-red-300">{error}</p>}

              <button
                type="submit"
                disabled={busy === 'login'}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-mint-400 py-3.5 text-sm font-bold text-purple-950 shadow-lg shadow-mint-400/20 transition active:scale-95 disabled:opacity-60"
              >
                {busy === 'login' ? 'Entrando...' : <>Entrar <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>

            {showForgot && (
              <div className="mt-4 w-full rounded-2xl bg-mint-400/10 p-4 ring-1 ring-mint-400/30 animate-fade-in">
                {forgotSent ? (
                  <p className="text-center text-xs leading-relaxed text-mint-200">
                    Pronto! Se existir uma conta com <b>{email.trim()}</b>, você vai receber um link para criar uma nova senha.
                  </p>
                ) : (
                  <>
                    <p className="text-center text-xs leading-relaxed text-mint-200">
                      Enviaremos um link de recuperação para o e-mail digitado acima.
                    </p>
                    <button
                      onClick={handleForgot}
                      disabled={busy === 'forgot'}
                      className="mt-3 w-full rounded-full bg-mint-400 py-2.5 text-xs font-bold text-purple-950 active:scale-95 disabled:opacity-60"
                    >
                      {busy === 'forgot' ? 'Enviando...' : 'Enviar link de recuperação'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowForgot(false)}
                  className="mt-2 w-full text-center text-[11px] font-semibold text-mint-400 underline underline-offset-2"
                >
                  Fechar
                </button>
              </div>
            )}

            <div className="mt-5 w-full">
              <GoogleButton onClick={handleGoogle} loading={busy === 'google'} />
            </div>

            {/* Back to welcome */}
            <button
              onClick={() => { setError(null); setMode('welcome'); }}
              className="mt-6 text-xs font-medium text-purple-300 active:scale-95"
            >
              Voltar
            </button>
          </div>
        )}
      </div>

      <p className="pb-6 text-center text-[10px] text-purple-600">LIVREI v1.0 · Troca de Livros</p>
    </div>
  );
}

function GoogleButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2.5 rounded-full border border-google-border bg-google-surface px-3 py-3.5 text-sm font-medium leading-5 text-google-text shadow-lg transition active:scale-95 disabled:opacity-70"
    >
      <GoogleIcon />
      {loading ? 'Abrindo o Google...' : 'Continuar com o Google'}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
  );
}
