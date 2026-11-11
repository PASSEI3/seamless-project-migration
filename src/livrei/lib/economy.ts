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
