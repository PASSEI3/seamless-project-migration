import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  X,
  MapPin,
  ArrowLeftRight,
  BookOpen,
  User as UserIcon,
  StickyNote,
  Tag,
  Heart,
  Ban,
  Flag,
  ChevronDown,
  Camera,
  Trash2,
  Lock,
  AlertTriangle,
  ZoomIn,
} from 'lucide-react';
import type { BookListing } from '@/livrei/types';
import { USERS } from '@/livrei/data';
import { formatDistance, proximityOf, type ReaderPlace } from '@/livrei/lib/listings';
import { coverImageOf } from '@/livrei/lib/cover';
import { formatCoins, removalBlockedMessage, type RemovalPlan } from '@/livrei/lib/economy';

const PhotoZoomViewer = lazy(() => import('@/livrei/components/PhotoZoomViewer/PhotoZoomViewer'));

const PHOTO_LABELS = ['1. Capa Frontal', '2. Contracapa (Sinopse)', '3. Páginas Internas (Livro aberto)'];

export interface BookRemoval {
  check: () => Promise<RemovalPlan>;
  /** Returns an error message, or null when the book was removed. */
  remove: () => Promise<string | null>;
}

interface Props {
  listing: BookListing;
  hasDirectMatch: boolean;
  onLike?: ((listing: BookListing) => void) | undefined;
  onClose: () => void;
  /** 'own' = a book from the reader's own shelf: no like/pass, block or report. */
  mode?: 'browse' | 'own';
  me?: ReaderPlace | undefined;
  /** Own shelf books only: "Remover livro da estante" with negotiation and bonus locks. */
  removal?: BookRemoval | undefined;
}

const conditionColor: Record<string, string> = {
  'Novo/Lacrado': 'bg-mint-400 text-purple-950',
  'Seminovo': 'bg-mint-300 text-purple-950',
  'Bom Estado': 'bg-purple-300 text-purple-900',
  'Marcas de Uso': 'bg-purple-200 text-purple-900',
};

export function BookDetailScreen({ listing, hasDirectMatch, onLike, onClose, mode = 'browse', me, removal }: Props) {
  const isOwn = mode === 'own';
  const owner = listing.source === 'real' || isOwn ? undefined : USERS.find((u) => u.id === listing.ownerId);
  const cover = coverImageOf(listing.book);
  const photos = listing.book.photoUrls ?? [];
  const [viewer, setViewer] = useState<number | null>(null);
  const place = me ? proximityOf(listing, me) : 'fora';
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);
  const [showBlockSheet, setShowBlockSheet] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [plan, setPlan] = useState<RemovalPlan | null>(null);
  const [planError, setPlanError] = useState(false);
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwn || !removal) return;
    let cancelled = false;
    removal.check().then((p) => { if (!cancelled) setPlan(p); }).catch(() => { if (!cancelled) setPlanError(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwn, listing.id]);

  const confirmRemoval = async () => {
    if (!removal) return;
    setRemoving(true);
    setRemoveError(null);
    const err = await removal.remove();
    setRemoving(false);
    if (err) setRemoveError(err);
  };

  useEffect(() => {
    const el = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!el || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setAtBottom(entry.isIntersecting));
      },
      { root: el, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const handlePrimary = () => {
    onLike?.(listing);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-purple-950 animate-fade-in">
      {/* Header: minimal, closes the expanded view */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-900/80 text-purple-200 glass active:scale-90"
          aria-label="Fechar"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-bold text-purple-50">Detalhes do livro</h2>
        <div className="h-9 w-9" />
      </div>

      {/* Scrollable content area — book cover + synopsis + notes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 no-scrollbar">
        <div className={`relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-4xl ${cover ? 'bg-purple-800' : listing.book.coverClass} shadow-2xl`}>
          {cover ? (
            <img src={cover} alt={`Capa de ${listing.book.title}`} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
              <div className="absolute -bottom-8 -left-4 h-28 w-28 rounded-full bg-black/10" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-8xl drop-shadow-lg">{listing.book.coverEmoji}</span>
              </div>
            </>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-5 pb-5 pt-10">
            <h3 className="text-lg font-bold leading-tight text-white drop-shadow-sm line-clamp-2">
              {listing.book.title}
            </h3>
            <p className="mt-1 text-sm text-white/85 line-clamp-1">{listing.book.author}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm text-purple-200">
            <MapPin className="h-4 w-4 text-mint-400" />
            {listing.city}
          </span>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${conditionColor[listing.book.condition]}`}>
            {listing.book.condition}
          </span>
          {!isOwn && place !== 'fora' ? (
            <span className="ml-auto shrink-0 rounded-full bg-mint-400/15 px-2.5 py-1 text-xs font-semibold text-mint-300">
              {place === 'bairro' ? '📍 No seu bairro' : '📍 Na sua cidade'}
            </span>
          ) : formatDistance(listing.distanceKm) ? (
            <span className="ml-auto shrink-0 rounded-full bg-purple-800/80 px-2.5 py-1 text-xs font-medium text-purple-100">
              {formatDistance(listing.distanceKm)}
            </span>
          ) : null}
        </div>

        {photos.length > 0 && (
          <div className="mt-4 rounded-2xl bg-purple-900/60 p-4">
            <div className="mb-3 flex items-center gap-2 text-purple-200">
              <Camera className="h-4 w-4 text-mint-400" />
              <span className="text-sm font-semibold">Fotos reais do exemplar</span>
              <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-purple-400">
                <ZoomIn className="h-3 w-3" /> Toque para ampliar
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, i) => (
                <button key={url} onClick={() => setViewer(i)} className="text-left active:scale-95" aria-label={`Ver foto ${PHOTO_LABELS[i] ?? i + 1}`}>
                  <img src={url} alt={PHOTO_LABELS[i] ?? `Foto ${i + 1}`} loading="lazy" className="aspect-[3/4] w-full rounded-xl object-cover ring-1 ring-purple-700" />
                  <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight text-purple-300">{PHOTO_LABELS[i] ?? `Foto ${i + 1}`}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {!owner && listing.ownerName && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-purple-900/60 p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-700 text-xl">📚</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-purple-50">{isOwn ? 'Na sua estante' : listing.ownerName}</p>
              <p className="flex items-center gap-1 text-xs text-purple-300">
                <UserIcon className="h-3 w-3" /> {[listing.district, listing.city].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        )}

        {owner && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-purple-900/60 p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-700 text-xl">
              {owner.avatarEmoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-purple-50">{owner.name}</p>
              <p className="flex items-center gap-1 text-xs text-purple-300">
                <UserIcon className="h-3 w-3" /> {owner.tradesCount} trocas · nota {owner.rating}
              </p>
            </div>
          </div>
        )}

        {/* Long synopsis section */}
        {listing.book.synopsis && (
          <div className="mt-4 rounded-2xl bg-purple-900/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-purple-200">
              <BookOpen className="h-4 w-4 text-mint-400" />
              <span className="text-sm font-semibold">Sinopse</span>
            </div>
            <p className="text-xs leading-relaxed text-purple-200">{listing.book.synopsis}</p>
          </div>
        )}

        {/* Conservação e observações */}
        <div className="mt-4 rounded-2xl bg-purple-900/60 p-4">
          <div className="flex items-center gap-2 text-purple-200">
            <StickyNote className="h-4 w-4 text-mint-400" />
            <span className="text-sm font-semibold">Conservação e observações</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${conditionColor[listing.book.condition]}`}>
              {listing.book.condition}
            </span>
            {listing.book.category && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-purple-800 px-3 py-1 text-xs font-medium text-purple-200">
                <Tag className="h-3 w-3 text-mint-400" /> {listing.book.category}
              </span>
            )}
          </div>
          {listing.book.notes ? (
            <p className="mt-3 rounded-xl bg-purple-800/50 px-3 py-2.5 text-xs leading-relaxed text-purple-200">
              {listing.book.notes}
            </p>
          ) : (
            <p className="mt-3 text-xs text-purple-400">Sem observações registradas pelo proprietário.</p>
          )}
        </div>

        {isOwn && removal && (
          <div className="mt-4 rounded-2xl bg-purple-900/60 p-4">
            {!plan && !planError ? (
              <p className="text-xs text-purple-400">Verificando se este livro pode ser removido...</p>
            ) : planError ? (
              <p className="text-xs text-purple-400">Não foi possível verificar este livro agora. Tente abrir de novo.</p>
            ) : plan && !plan.allowed ? (
              <div className="flex items-start gap-2.5">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-xs font-semibold leading-relaxed text-amber-200">{removalBlockedMessage(plan)}</p>
              </div>
            ) : (
              <button
                onClick={() => { setRemoveError(null); setConfirmStep(1); }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-purple-800 py-3 text-sm font-bold text-red-300 ring-1 ring-red-400/40 active:scale-95"
              >
                <Trash2 className="h-4 w-4" /> Remover livro da estante
              </button>
            )}
          </div>
        )}

        {/* How the trade works */}
        <div className={`mt-4 rounded-2xl bg-purple-900/60 p-4 ${isOwn ? 'hidden' : ''}`}>
          <div className="flex items-center gap-2 text-purple-200">
            <BookOpen className="h-4 w-4 text-mint-400" />
            <span className="text-sm font-semibold">Como funciona a troca</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-purple-300">
            Curtir um livro não custa moedas. Quando houver Match Direto, ambos pagam apenas a <span className="font-semibold text-mint-400">Taxa de Manutenção Compartilhada (R$ 2,00 cada via Pix)</span>.
          </p>
          {hasDirectMatch && (
            <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-mint-400/15 px-3 py-2">
              <ArrowLeftRight className="h-3.5 w-3.5 text-mint-400" />
              <span className="text-xs font-semibold text-mint-300">Match Direto! 0 Moedas · R$ 2,00 taxa cada lado.</span>
            </div>
          )}
        </div>

        {/* Spacer + safety buttons that appear only when scrolled to the absolute bottom */}
        <div className="mt-8 h-4" />
        <div ref={sentinelRef} className="h-1 w-full" />
        <div
          className={`grid grid-cols-2 gap-3 transition-all duration-300 ${
            atBottom ? 'opacity-100' : 'opacity-0'
          } ${isOwn ? 'hidden' : ''}`}
        >
          <button
            onClick={() => setShowBlockSheet(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-neutral-800 py-3.5 text-sm font-semibold text-neutral-300 active:scale-95"
          >
            <Ban className="h-4 w-4" />
            Bloquear Usuário
          </button>
          <button
            onClick={() => setShowReportSheet(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-neutral-800 py-3.5 text-sm font-semibold text-neutral-300 active:scale-95"
          >
            <Flag className="h-4 w-4" />
            Denunciar Anúncio
          </button>
        </div>
        <div className="h-[120px]" />
      </div>

      {/* Floating action bar: X (Recusar) and Heart (Curtir) — centered, smaller */}
      {!isOwn && (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-center gap-6 px-6 pb-5">
        <button
          onClick={onClose}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-900/70 text-purple-200 shadow-xl ring-2 ring-purple-600 backdrop-blur-md glass active:scale-90"
          aria-label="Recusar"
        >
          <X className="h-6 w-6" />
        </button>
        <button
          onClick={handlePrimary}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint-400/90 text-purple-950 shadow-xl backdrop-blur-md active:scale-90"
          aria-label="Curtir"
        >
          <Heart className="h-6 w-6 fill-current" />
        </button>
      </div>
      )}

      {viewer !== null && photos[viewer] && (
        <Suspense fallback={null}>
          <PhotoZoomViewer photos={photos} labels={PHOTO_LABELS} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
        </Suspense>
      )}

      {confirmStep > 0 && plan?.allowed && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 animate-fade-in" onClick={() => !removing && setConfirmStep(0)}>
          <div className="w-full max-w-md rounded-t-4xl bg-purple-900 p-5 shadow-2xl ring-1 ring-purple-700 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-purple-700" />
            {confirmStep === 1 ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-300" />
                  <h3 className="text-base font-bold text-purple-50">Remover "{listing.book.title}"?</h3>
                </div>
                <p className="text-sm leading-relaxed text-purple-300">O livro sai da sua estante e do feed dos outros leitores.</p>
                <div className="mt-3 rounded-2xl bg-purple-800/60 p-3 text-xs leading-relaxed text-purple-200">
                  {plan.locksWelcome ? (
                    <p>Sua estante ficará vazia: o <b>Bônus de Boas-Vindas de {formatCoins(plan.welcomeAmount)} moedas</b> volta a ficar <b>bloqueado</b> até você cadastrar outro livro.</p>
                  ) : null}
                  {plan.reversal > 0 ? (
                    <p className={plan.locksWelcome ? 'mt-1.5' : ''}>Estorno do Incentivo de Acervo: <b>-{formatCoins(plan.reversal)} moeda</b>.</p>
                  ) : null}
                  {!plan.locksWelcome && plan.reversal === 0 && <p>Nenhuma moeda será estornada.</p>}
                </div>
                <div className="mt-5 flex gap-3">
                  <button onClick={() => setConfirmStep(0)} className="flex-1 rounded-full bg-purple-800 py-3 text-sm font-semibold text-purple-100 active:scale-95">Cancelar</button>
                  <button onClick={() => setConfirmStep(2)} className="flex-1 rounded-full bg-red-400 py-3 text-sm font-bold text-purple-950 active:scale-95">Continuar</button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <h3 className="text-base font-bold text-purple-50">Tem certeza?</h3>
                </div>
                <p className="text-sm leading-relaxed text-purple-300">Esta ação não pode ser desfeita. As 3 fotos do exemplar também serão apagadas.</p>
                {removeError && <p className="mt-3 text-xs font-semibold text-red-300">{removeError}</p>}
                <div className="mt-5 flex gap-3">
                  <button disabled={removing} onClick={() => setConfirmStep(0)} className="flex-1 rounded-full bg-purple-800 py-3 text-sm font-semibold text-purple-100 active:scale-95 disabled:opacity-50">Cancelar</button>
                  <button disabled={removing} onClick={() => void confirmRemoval()} className="flex-1 rounded-full bg-red-400 py-3 text-sm font-bold text-purple-950 active:scale-95 disabled:opacity-50">
                    {removing ? 'Removendo...' : 'Sim, remover definitivamente'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Block user confirmation sheet */}
      {showBlockSheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 animate-fade-in" onClick={() => setShowBlockSheet(false)}>
          <div
            className="w-full max-w-md rounded-t-4xl bg-purple-900 p-5 shadow-2xl ring-1 ring-purple-700 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-purple-700" />
            <div className="mb-2 flex items-center gap-2">
              <Ban className="h-5 w-5 text-rose-400" />
              <h3 className="text-base font-bold text-purple-50">Bloquear {owner?.name ?? listing.ownerName ?? 'usuário'}</h3>
            </div>
            <p className="text-sm leading-relaxed text-purple-300">
              Ao bloquear, este usuário não poderá curtir seus livros nem iniciar novas trocas com você. Trocas em andamento não são afetadas.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowBlockSheet(false)}
                className="flex-1 rounded-full bg-purple-800 py-3 text-sm font-semibold text-purple-100 active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowBlockSheet(false);
                  onClose();
                }}
                className="flex-1 rounded-full bg-rose-500 py-3 text-sm font-bold text-white active:scale-95"
              >
                Bloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report ad confirmation sheet */}
      {showReportSheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 animate-fade-in" onClick={() => setShowReportSheet(false)}>
          <div
            className="w-full max-w-md rounded-t-4xl bg-purple-900 p-5 shadow-2xl ring-1 ring-purple-700 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-purple-700" />
            <div className="mb-2 flex items-center gap-2">
              <Flag className="h-5 w-5 text-amber-400" />
              <h3 className="text-base font-bold text-purple-50">Denunciar anúncio</h3>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-purple-300">Selecione o motivo da denúncia:</p>
            <div className="space-y-2">
              {[
                { label: 'Livro pirata ou cópia não autorizada', emoji: '📕' },
                { label: 'Perfil suspeito ou golpe', emoji: '🚨' },
                { label: 'Informações falsas sobre o livro', emoji: '⚠️' },
                { label: 'Conteúdo inadequado nas observações', emoji: '🚫' },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setShowReportSheet(false);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-purple-800 px-4 py-3 text-left text-sm font-medium text-purple-100 active:scale-[0.98]"
                >
                  <span className="text-lg">{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowReportSheet(false)}
              className="mt-4 w-full rounded-full bg-purple-800 py-3 text-sm font-semibold text-purple-200 active:scale-95"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
