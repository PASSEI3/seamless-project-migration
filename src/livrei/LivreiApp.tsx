import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { flushPendingPrivate, loadAccount, savePreferences, savePrivateData, signUpWithEmail } from '@/livrei/lib/account';
import { initPush, logoutPush } from '@/livrei/lib/push';
import { Home, Search, ScanLine, Heart, User } from 'lucide-react';
import type { Book, BookListing, MatchEntry, MeetupPoint, TradeHistoryEntry, WishlistEntry, DeliveryMethod, HandoffRole, UserPreferences, LiteraryGenre } from '@/livrei/types';
import { FEED_LISTINGS, INITIAL_MATCHES, MY_SHELF, USER_WISHLIST, TRADE_HISTORY, INITIAL_PAGES, SHELF_LIKERS, DEFAULT_PREFERENCES, INITIAL_WALLET, type ShelfLiker, type WalletEntry } from '@/livrei/data';
import { FeedScreen } from '@/livrei/screens/FeedScreen/FeedScreen';
import { SearchScreen } from '@/livrei/screens/SearchScreen/SearchScreen';
import { ScanScreen } from '@/livrei/screens/ScanScreen';
import { MatchScreen } from '@/livrei/screens/MatchScreen/MatchScreen';
import { ProfileScreen } from '@/livrei/screens/ProfileScreen';
import { PaymentScreen } from '@/livrei/screens/PaymentScreen';
import { DeliveryTrackingScreen } from '@/livrei/screens/DeliveryTrackingScreen/DeliveryTrackingScreen';
import { ChatScreen } from '@/livrei/screens/ChatScreen/ChatScreen';
import { HandoffScreen } from '@/livrei/screens/HandoffScreen/HandoffScreen';
import { saveBookToCloud } from '@/livrei/lib/bookStorage';
import { registrationReward, applyRewardToWallet, isChatUnlocked, formatCoins } from '@/livrei/lib/economy';
import { ShippingInstructions } from '@/livrei/screens/ShippingInstructions/ShippingInstructions';
import { ShelfViewerScreen } from '@/livrei/screens/ShelfViewerScreen/ShelfViewerScreen';
import { SignUpScreen } from '@/livrei/screens/SignUpScreen/SignUpScreen';
import { WelcomeScreen } from '@/livrei/screens/WelcomeScreen/WelcomeScreen';
import { SettingsScreen } from '@/livrei/screens/SettingsScreen/SettingsScreen';
import { TermsScreen } from '@/livrei/screens/TermsScreen';

type Tab = 'feed' | 'search' | 'scan' | 'matches' | 'profile';

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'feed', label: 'Descobrir', icon: Home },
  { id: 'search', label: 'Buscar', icon: Search },
  { id: 'scan', label: 'Cadastrar', icon: ScanLine },
  { id: 'matches', label: 'Matches', icon: Heart },
  { id: 'profile', label: 'Perfil', icon: User },
];

export function LivreiApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [demo, setDemo] = useState(false);
  const [account, setAccount] = useState<{ name: string; city: string; xp: number } | null>(null);
  const [needsCompletion, setNeedsCompletion] = useState(false);
  const [welcomeNotice, setWelcomeNotice] = useState<string | null>(null);
  const [welcomeMode, setWelcomeMode] = useState<'welcome' | 'login'>('welcome');
  const [showSignUp, setShowSignUp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [tab, setTab] = useState<Tab>('feed');
  const [shelf, setShelf] = useState<Book[]>(MY_SHELF);
  const [wishlist, setWishlist] = useState<WishlistEntry[]>(USER_WISHLIST);
  const [matches, setMatches] = useState<MatchEntry[]>(INITIAL_MATCHES);
  const [meetups, setMeetups] = useState<Record<string, MeetupPoint>>({});
  const [history, setHistory] = useState<TradeHistoryEntry[]>(TRADE_HISTORY);
  const [coins, setCoins] = useState<number>(INITIAL_PAGES);
  const [promoCoins, setPromoCoins] = useState<number>(0);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [wallet, setWallet] = useState<WalletEntry[]>(INITIAL_WALLET);
  const [payMatch, setPayMatch] = useState<MatchEntry | null>(null);
  const [chatMatch, setChatMatch] = useState<MatchEntry | null>(null);
  const [deliveryTracking, setDeliveryTracking] = useState<{ match: MatchEntry; pin: string } | null>(null);
  const [handoff, setHandoff] = useState<{ match: MatchEntry; role: HandoffRole } | null>(null);
  const [shipping, setShipping] = useState<{ match: MatchEntry; method: DeliveryMethod; meetup?: MeetupPoint | undefined } | null>(null);
  const [viewedLiker, setViewedLiker] = useState<ShelfLiker | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [toast, setToast] = useState<string | null>(null);
  const [matchSection, setMatchSection] = useState<'likers' | 'ongoing' | 'history'>('likers');

  const userId = session?.user.id ?? null;

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  /** Pulls profile, shelf and wallet from Lovable Cloud; balances are computed by the database. */
  const refreshAccount = useCallback(async (uid: string) => {
    const snap = await loadAccount(uid);
    setAccount({ name: snap.profile.name, city: snap.profile.city, xp: snap.profile.xp });
    setShelf(snap.shelf);
    setWallet(snap.wallet);
    setCoins(snap.balance);
    setPromoCoins(snap.promoActive);
    setRegisteredCount(snap.shelf.length);
    if (snap.profile.genres.length || snap.profile.authors.length) {
      setPreferences({ genres: snap.profile.genres as LiteraryGenre[], authors: snap.profile.authors });
    }
    return snap;
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const flushed = await flushPendingPrivate(userId, session?.user.email);
      const snap = await refreshAccount(userId);
      if (cancelled) return;
      setNeedsCompletion(!flushed && !snap.hasPrivateData);
      void initPush(userId);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSignOut = async () => {
    setShowSettings(false);
    logoutPush();
    await supabase.auth.signOut();
    setAccount(null);
    setNeedsCompletion(false);
    setShelf(MY_SHELF);
    setWallet(INITIAL_WALLET);
    setCoins(INITIAL_PAGES);
    setPromoCoins(0);
    setRegisteredCount(0);
    setDemo(false);
    setWelcomeNotice(null);
    setWelcomeMode('welcome');
    setTab('feed');
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const handleLike = (listing: BookListing) => {
    const already = wishlist.some((w) => w.bookId === listing.book.id);
    if (!already) {
      setWishlist((w) => [
        {
          bookId: listing.book.id,
          title: listing.book.title,
          author: listing.book.author,
          coverClass: listing.book.coverClass,
          coverEmoji: listing.book.coverEmoji,
        },
        ...w,
      ]);
    }
    if (shelf.length > 0 && Math.random() < 0.35) {
      setMatches((m) => [
        {
          id: `mt-${Date.now()}`,
          kind: 'direto',
          bookFrom: listing.book,
          bookTo: shelf[Math.floor(Math.random() * shelf.length)]!,
          partnerName: 'Marina',
          partnerEmoji: '🦊',
          partnerCity: 'São Paulo - SP',
          status: 'novo',
          createdAt: '2026-10-25',
        },
        ...m,
      ]);
      setToast('Deu match! Confira na aba Matches 💚');
    }
  };

  const handleAddBook = async (book: Book, photos: Blob[]) => {
    if (userId) {
      setToast('Enviando as 3 fotos...');
      try {
        const res = await saveBookToCloud(book, photos);
        if (!res) throw new Error('not_signed_in');
        await refreshAccount(userId);
        const added = Number(res.coins_added);
        setToast(`Livro adicionado · ${added > 0 ? `+${formatCoins(added)} Moedas · ` : ''}+5 XP`);
        setTab('profile');
      } catch {
        setToast('Não foi possível cadastrar o livro. Tente novamente.');
      }
      return;
    }
    // Demo mode (Pular): same rules, kept on this device only.
    const reward = registrationReward(registeredCount, promoCoins);
    setShelf((s) => [book, ...s]);
    setRegisteredCount((n) => n + 1);
    setCoins((prev) => prev + reward.added);
    setPromoCoins(reward.promoAfter);
    if (reward.entries.length > 0) {
      const seed = String(Date.now());
      setWallet((w) => applyRewardToWallet(w, reward, seed));
    }
    setToast(reward.added > 0 ? `Livro adicionado · +${formatCoins(reward.added)} Moedas` : 'Livro adicionado');
    setTab('profile');
  };

  /** Opens the chat only when both participants explicitly paid the fee. */
  const openChat = (match: MatchEntry) => {
    const latest = matches.find((m) => m.id === match.id) ?? match;
    if (!isChatUnlocked(latest)) {
      setToast('O chat abre quando os dois pagamentos forem confirmados 🔒');
      return;
    }
    setChatMatch(latest);
  };

  const markFee = (id: string, field: 'feePaidByMe' | 'feePaidByPartner') => {
    setMatches((m) => m.map((x) => (x.id === id ? { ...x, [field]: true } : x)));
  };

  const hasDirectMatchForListing = (listing: BookListing): boolean => {
    return matches.some(
      (m) => m.kind === 'direto' && m.bookFrom.id === listing.book.id && m.status !== 'finalizado'
    );
  };

  const handleGoToCheckout = (data: { bookFrom: Book; bookTo: Book; partnerName: string; partnerEmoji: string }) => {
    const newMatch: MatchEntry = {
      id: `mt-${Date.now()}`,
      kind: 'direto',
      bookFrom: data.bookFrom,
      bookTo: data.bookTo,
      partnerName: data.partnerName,
      partnerEmoji: data.partnerEmoji,
      partnerCity: 'São Paulo - SP',
      partnerDistanceKm: 2.5,
      status: 'novo',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setMatches((m) => [newMatch, ...m]);
    setPayMatch(newMatch);
  };

  const handlePaid = (method: DeliveryMethod, meetup?: MeetupPoint) => {
    if (payMatch) {
      const id = payMatch.id;
      if (meetup) setMeetups((prev) => ({ ...prev, [id]: meetup }));
      setPayMatch(null);
      if (method !== 'courier') {
        setShipping({ match: { ...payMatch, status: 'conversando' }, method, meetup });
      }
    }
  };

  const handleTrack = (pin: string) => {
    if (payMatch) {
      const id = payMatch.id;
      const latest = matches.find((x) => x.id === id) ?? payMatch;
      setMatches((m) => m.map((x) => (x.id === id ? { ...x, status: 'conversando' } : x)));
      setDeliveryTracking({ match: { ...latest, status: 'conversando' }, pin });
      setPayMatch(null);
    }
  };

  const handleShippingDone = () => {
    if (!shipping) return;
    const id = shipping.match.id;
    if (shipping.method === 'local' || shipping.method === 'courier') {
      setMatches((m) => m.map((x) => (x.id === id ? { ...x, status: 'conversando' } : x)));
      const latest = matches.find((x) => x.id === id) ?? shipping.match;
      if (isChatUnlocked(latest)) {
        setChatMatch({ ...latest, status: 'conversando' });
        setToast('Instruções concluídas! Combine os detalhes no chat 🤝');
      } else {
        setToast('Instruções concluídas! O chat abre quando os dois pagamentos forem confirmados 🔒');
      }
    } else {
      const trackingCode = `BR${Math.floor(100000000 + Math.random() * 899999999)}BR`;
      setMatches((m) => m.map((x) => (x.id === id ? { ...x, status: 'conversando', deliveryMethod: 'correios', trackingCode } : x)));
      setToast('Etiqueta liberada! Boa postagem 📦');
    }
    setShipping(null);
  };

  const handleConfirmReceipt = (match: MatchEntry) => {
    const id = match.id;
    setMatches((m) => m.map((x) => (x.id === id ? { ...x, status: 'finalizado' } : x)));
    setHistory((h) => [
      {
        id: `t-${Date.now()}`,
        bookTitle: match.bookFrom.title,
        partnerName: match.partnerName,
        date: new Date().toLocaleDateString('pt-BR'),
        status: 'recebido',
      },
      ...h,
    ]);
    setToast('Recebimento confirmado! Troca finalizada 🎉');
  };

  const handleHandoffConfirmed = () => {
    if (handoff) {
      const id = handoff.match.id;
      setMatches((m) => m.map((x) => (x.id === id ? { ...x, status: 'finalizado' } : x)));
      setHistory((h) => [
        {
          id: `t-${Date.now()}`,
          bookTitle: handoff.match.bookFrom.title,
          partnerName: handoff.match.partnerName,
          date: new Date().toLocaleDateString('pt-BR'),
          status: 'trocado',
        },
        ...h,
      ]);
      setHandoff(null);
      setToast('Troca concluída presencialmente! 🎉');
    }
  };

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-purple-950">
      <header className="flex items-center justify-between px-5 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-400 text-lg font-black text-purple-950">
            L
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-none tracking-wide text-purple-50">LIVREI</h1>
            <p className="text-[10px] font-medium text-purple-400">Troca de livros</p>
          </div>
        </div>
        {tab === 'matches' && matches.some((m) => m.status === 'novo') && (
          <span className="flex h-2 w-2 rounded-full bg-mint-400" />
        )}
      </header>

      <main className="relative flex-1 overflow-hidden">
        <div className={tab === 'feed' ? 'h-full' : 'hidden'}>
          <FeedScreen
            listings={FEED_LISTINGS}
            preferences={preferences}
            likedShelfBooks={shelf.filter((b) => SHELF_LIKERS.some((l) => l.likedBookId === b.id))}
            likerCount={SHELF_LIKERS.length}
            activeMatchCount={matches.filter((m) => m.status === 'novo' || m.status === 'conversando').length}
            newMatchCount={matches.filter((m) => m.status === 'novo').length}
            onLike={handleLike}
            onPass={() => {}}
            hasDirectMatchForListing={hasDirectMatchForListing}
            onViewLikers={() => { setMatchSection('likers'); setTab('matches'); }}
            onGoToLikers={() => { setMatchSection('likers'); setTab('matches'); }}
            onGoToMatches={() => { setMatchSection('ongoing'); setTab('matches'); }}
            onGoToCheckout={handleGoToCheckout}
          />
        </div>
        <div className={tab === 'search' ? 'h-full' : 'hidden'}>
          <SearchScreen listings={FEED_LISTINGS} preferences={preferences} />
        </div>
        <div className={tab === 'scan' ? 'h-full' : 'hidden'}>
          <ScanScreen onAdd={handleAddBook} />
        </div>
        <div className={tab === 'matches' ? 'h-full' : 'hidden'}>
          <MatchScreen
            matches={matches}
            meetups={meetups}
            likers={SHELF_LIKERS}
            initialSection={matchSection}
            onPay={setPayMatch}
            onChat={openChat}
            onSimulatePartnerPayment={(m) => setMatches((prev) => prev.map((x) => (x.id === m.id ? { ...x, feePaidByPartner: true } : x)))}
            onOpenLiker={setViewedLiker}
            onConfirmReceipt={handleConfirmReceipt}
          />
        </div>
        <div className={tab === 'profile' ? 'h-full' : 'hidden'}>
          <ProfileScreen
            shelf={shelf}
            wishlist={wishlist}
            history={history}
            pages={coins}
            wallet={wallet}
            promoCoins={promoCoins}
            onAddBook={() => setTab('scan')}
            onOpenSettings={() => setShowSettings(true)}
            user={account}
          />
        </div>
      </main>

      <nav className="flex items-center justify-around border-t border-purple-800 bg-purple-900/80 px-2 pb-[env(safe-area-inset-bottom)] pt-2 glass">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          const isScan = t.id === 'scan';
          if (isScan) {
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex flex-col items-center gap-0.5"
                aria-label={t.label}
              >
                <div className={`flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full ring-4 ring-purple-950 transition active:scale-90 ${
                  active ? 'bg-mint-400 text-purple-950' : 'bg-purple-700 text-purple-100'
                }`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="-translate-y-2 text-[10px] font-medium text-purple-300">{t.label}</span>
              </button>
            );
          }
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex flex-col items-center gap-0.5 py-1 active:scale-90"
              aria-label={t.label}
            >
              <Icon className={`h-5 w-5 transition ${active ? 'text-mint-400' : 'text-purple-400'}`} />
              <span className={`text-[10px] font-medium ${active ? 'text-mint-400' : 'text-purple-400'}`}>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {payMatch && (
        <PaymentScreen
          match={payMatch}
          onClose={() => setPayMatch(null)}
          onMyPaymentConfirmed={() => markFee(payMatch.id, 'feePaidByMe')}
          onPartnerPaymentConfirmed={() => markFee(payMatch.id, 'feePaidByPartner')}
          onPaid={handlePaid}
          onTrack={handleTrack}
          myCity={account?.city}
        />
      )}

      {deliveryTracking && (
        <DeliveryTrackingScreen
          match={deliveryTracking.match}
          pin={deliveryTracking.pin}
          chatUnlocked={isChatUnlocked(matches.find((m) => m.id === deliveryTracking.match.id) ?? deliveryTracking.match)}
          onChat={() => {
            const latest = matches.find((m) => m.id === deliveryTracking.match.id) ?? deliveryTracking.match;
            if (!isChatUnlocked(latest)) {
              setToast('O chat abre quando os dois pagamentos forem confirmados 🔒');
              return;
            }
            setChatMatch(latest);
            setDeliveryTracking(null);
          }}
          onClose={() => setDeliveryTracking(null)}
        />
      )}

      {chatMatch && (
        <ChatScreen
          match={chatMatch}
          meetup={meetups[chatMatch.id]}
          onClose={() => setChatMatch(null)}
          onStartHandoff={(m) => {
            setChatMatch(null);
            setHandoff({ match: m, role: 'recebendo' });
          }}
        />
      )}

      {handoff && (
        <HandoffScreen
          match={handoff.match}
          role={handoff.role}
          meetup={meetups[handoff.match.id]}
          onClose={() => setHandoff(null)}
          onConfirmed={handleHandoffConfirmed}
        />
      )}

      {viewedLiker && (
        <ShelfViewerScreen liker={viewedLiker} onClose={() => setViewedLiker(null)} />
      )}

      {shipping && (
        <ShippingInstructions
          match={shipping.match}
          method={shipping.method}
          meetup={shipping.meetup}
          onDone={handleShippingDone}
        />
      )}

      {showSettings && (
        <SettingsScreen
          onOpenTerms={() => setShowTerms(true)}
          onClose={() => setShowSettings(false)}
          onSignOut={() => void handleSignOut()}
          userId={userId ?? undefined}
          displayName={account?.name}
          onProfileChanged={(name) => setAccount((a) => (a ? { ...a, name } : a))}
        />
      )}

      {showTerms && (
        <TermsScreen onClose={() => setShowTerms(false)} />
      )}

      {authReady && !userId && !demo && !showSignUp && (
        <WelcomeScreen
          initialMode={welcomeMode}
          notice={welcomeNotice}
          onCreateAccount={() => { setWelcomeNotice(null); setShowSignUp(true); }}
          onSkip={() => setDemo(true)}
        />
      )}

      {!userId && showSignUp && (
        <SignUpScreen
          onComplete={async (prefs, data) => {
            const err = await signUpWithEmail(data, prefs);
            if (err) return err;
            setPreferences(prefs);
            setShowSignUp(false);
            setWelcomeMode('login');
            setWelcomeNotice(`Enviamos um link de confirmação para ${data.email.trim()}. Abra o e-mail, confirme e depois entre aqui com sua senha.`);
            return null;
          }}
          onSkip={() => { setShowSignUp(false); setDemo(true); }}
        />
      )}

      {userId && needsCompletion && (
        <SignUpScreen
          mode="complete"
          initialName={account?.name ?? ''}
          onComplete={async (prefs, data) => {
            const err = await savePrivateData(userId, data);
            if (err) return err;
            await savePreferences(userId, prefs);
            setPreferences(prefs);
            setNeedsCompletion(false);
            await refreshAccount(userId);
            setToast('Cadastro completo! Bem-vindo ao LIVREI 💚');
            return null;
          }}
          onSkip={() => setNeedsCompletion(false)}
        />
      )}

      {toast && (
        <div className="animate-slide-up pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-mint-400 px-5 py-2.5 text-sm font-semibold text-purple-950 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
