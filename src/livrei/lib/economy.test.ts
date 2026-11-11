import { describe, it, expect } from 'vitest';
import { bookCoins, isChatUnlocked, registrationReward, applyRewardToWallet } from './economy';
import { INITIAL_WALLET } from '@/livrei/data';

describe('book coin values', () => {
  it('common book is 10,0', () => expect(bookCoins('PADRÃO', 'Seminovo')).toBe(10));
  it('premium book is 30,0', () => expect(bookCoins('PREMIUM', 'Bom Estado')).toBe(30));
  it('premium Novo/Lacrado is 35,0 (30 + 5)', () => expect(bookCoins('PREMIUM', 'Novo/Lacrado')).toBe(35));
  it('common Novo/Lacrado is 15,0 (10 + 5)', () => expect(bookCoins('PADRÃO', 'Novo/Lacrado')).toBe(15));
});

describe('welcome bonus', () => {
  it('first registered book unlocks the 10,0 welcome bonus', () => {
    const r = registrationReward(0, 0);
    expect(r.unlocksWelcome).toBe(true);
    expect(r.added).toBe(10);
  });
  it('unlocking removes the locked bonus from the statement', () => {
    const wallet = applyRewardToWallet(INITIAL_WALLET, registrationReward(0, 0), 'x');
    expect(wallet.some((w) => w.locked)).toBe(false);
    expect(wallet.filter((w) => w.type === 'bonus')).toHaveLength(1);
  });
});

describe('acquisition incentive', () => {
  it('each extra book gives +0,5', () => expect(registrationReward(1, 10).added).toBe(0.5));
  it('stops after 10,0 extra coins (20 extra books)', () => {
    expect(registrationReward(20, 19.5).added).toBe(0.5);
    expect(registrationReward(21, 20).added).toBe(0);
  });
  it('promo balance never exceeds 20,0', () => expect(registrationReward(5, 20).added).toBe(0));
});

describe('double chat lock', () => {
  it('stays locked when only I paid', () => expect(isChatUnlocked({ feePaidByMe: true })).toBe(false));
  it('stays locked when only the partner paid', () => expect(isChatUnlocked({ feePaidByPartner: true })).toBe(false));
  it('opens when both paid', () => expect(isChatUnlocked({ feePaidByMe: true, feePaidByPartner: true })).toBe(true));
});
