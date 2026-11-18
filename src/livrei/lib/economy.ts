import type { BookTier, ConservationState, MatchEntry } from '@/livrei/types';
import { ACQUISITION_BONUS, ACQUISITION_CAP, PROMO_CAP, WELCOME_BONUS, type WalletEntry } from '@/livrei/data';

/** Base coin value of a book by tier (decimal, never rounded). */
export const BASE_COINS: Record<BookTier, number> = { PADRÃO: 10.0, PREMIUM: 30.0 };
/** Extra coins for a book marked Novo/Lacrado. */
export const NEW_CONDITION_BONUS = 5.0;

export function bookCoins(tier: BookTier, condition: ConservationState): number {
  return BASE_COINS[tier] + (condition === 'Novo/Lacrado' ? NEW_CONDITION_BONUS : 0);
}

/** Chat opens only when BOTH sides explicitly paid the R$ 2,00 fee. */
export function isChatUnlocked(m: Pick<MatchEntry, 'feePaidByMe' | 'feePaidByPartner'>): boolean {
  return m.feePaidByMe === true && m.feePaidByPartner === true;
}

export interface RegistrationReward {
  added: number;
  promoAfter: number;
  unlocksWelcome: boolean;
  entries: Omit<WalletEntry, 'id'>[];
}

/**
 * Coins earned when the user registers a book through "Cadastrar".
 * @param registeredBefore books the user registered before this one
 * @param promoCoins promotional coins currently active
 */
export function registrationReward(registeredBefore: number, promoCoins: number): RegistrationReward {
  if (registeredBefore === 0) {
    const promoAfter = Math.min(PROMO_CAP, promoCoins + WELCOME_BONUS);
    const added = promoAfter - promoCoins;
    return {
      added,
      promoAfter,
      unlocksWelcome: true,
      entries: [{ amount: added, label: 'Bônus de Boas-Vindas - Ativado pelo 1º livro', type: 'bonus', locked: false }],
    };
  }
  const soFar = Math.min(ACQUISITION_CAP, (registeredBefore - 1) * ACQUISITION_BONUS);
  const after = Math.min(ACQUISITION_CAP, registeredBefore * ACQUISITION_BONUS);
  const promoAfter = Math.min(PROMO_CAP, promoCoins + (after - soFar));
  const added = promoAfter - promoCoins;
  if (added <= 0) return { added: 0, promoAfter: promoCoins, unlocksWelcome: false, entries: [] };
  const entries: Omit<WalletEntry, 'id'>[] = [
    { amount: added, label: `Incentivo de Acervo - ${registeredBefore + 1}º Livro Cadastrado`, type: 'acquisition' },
  ];
  if (after >= ACQUISITION_CAP) {
    entries.push({ amount: 0, label: 'Limite promocional de acervo: Máximo 10,0 moedas extras.', type: 'info' });
  }
  return { added, promoAfter, unlocksWelcome: false, entries };
}

/** Applies a reward to the statement: an unlocked welcome bonus replaces the locked one. */
export function applyRewardToWallet(wallet: WalletEntry[], reward: RegistrationReward, idSeed: string): WalletEntry[] {
  const base = reward.unlocksWelcome ? wallet.filter((w) => !(w.type === 'bonus' && w.locked)) : wallet;
  const fresh = reward.entries.map((e, i) => ({ ...e, id: `w-${idSeed}-${i}` }));
  return [...fresh, ...base];
}

export function formatCoins(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export type RemovalReason = 'negociacao_ativa' | 'bonus_gasto' | 'saldo_insuficiente';

export interface RemovalPlan {
  allowed: boolean;
  reason: RemovalReason | null;
  /** Promo coins (Incentivo de Acervo) reversed when the book is removed. */
  reversal: number;
  /** The shelf becomes empty: the welcome bonus goes back to locked. */
  locksWelcome: boolean;
  welcomeAmount: number;
}

export interface RemovalInput {
  /** Active match, pending like/request or shipment in progress. */
  inNegotiation: boolean;
  /** Books the reader keeps after this removal. */
  remainingAfter: number;
  /** Net Incentivo de Acervo coins earned so far (earned minus reversed). */
  netAcquisition: number;
  /** Unlocked, not expired welcome bonus. */
  activeWelcome: number;
  /** Spendable balance. */
  balance: number;
}

/** Mirrors the database function book_removal_check: who may remove a book and what is reversed. */
export function bookRemovalPlan(i: RemovalInput): RemovalPlan {
  if (i.inNegotiation) return { allowed: false, reason: 'negociacao_ativa', reversal: 0, locksWelcome: false, welcomeAmount: 0 };
  const target = i.remainingAfter === 0 ? 0 : Math.min(ACQUISITION_CAP, (i.remainingAfter - 1) * ACQUISITION_BONUS);
  const reversal = Math.max(0, i.netAcquisition - target);
  const welcomeAmount = i.remainingAfter === 0 ? i.activeWelcome : 0;
  const locksWelcome = i.remainingAfter === 0 && i.activeWelcome > 0;
  if (i.balance < reversal + welcomeAmount) {
    return { allowed: false, reason: i.remainingAfter === 0 ? 'bonus_gasto' : 'saldo_insuficiente', reversal, locksWelcome, welcomeAmount };
  }
  return { allowed: true, reason: null, reversal, locksWelcome, welcomeAmount };
}

export const NEGOTIATION_LOCK_MESSAGE = 'Livro em negociação ativa não pode ser removido';

export function removalBlockedMessage(plan: RemovalPlan): string | null {
  if (plan.allowed) return null;
  if (plan.reason === 'negociacao_ativa') return NEGOTIATION_LOCK_MESSAGE;
  const needed = formatCoins(plan.reversal + plan.welcomeAmount);
  if (plan.reason === 'bonus_gasto') {
    return `Este é o último livro da estante e o bônus de boas-vindas já foi usado. Para removê-lo, você precisa de ${needed} moedas de saldo para o estorno.`;
  }
  return `Seu saldo não cobre o estorno de ${needed} moeda(s) de incentivo deste livro.`;
}
