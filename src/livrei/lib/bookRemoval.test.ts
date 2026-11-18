import { describe, expect, it } from 'vitest';
import { bookRemovalPlan, removalBlockedMessage } from './economy';

const base = { inNegotiation: false, remainingAfter: 2, netAcquisition: 1.5, activeWelcome: 10, balance: 11.5 };

describe('remover livro da estante', () => {
  it('bloqueia livro em negociação ativa com o aviso oficial', () => {
    const plan = bookRemovalPlan({ ...base, inNegotiation: true });
    expect(plan.allowed).toBe(false);
    expect(removalBlockedMessage(plan)).toBe('Livro em negociação ativa não pode ser removido');
  });

  it('estorna 0,5 moeda ao remover um livro extra', () => {
    const plan = bookRemovalPlan({ ...base, remainingAfter: 2, netAcquisition: 1.0 });
    expect(plan).toMatchObject({ allowed: true, reversal: 0.5, locksWelcome: false });
  });

  it('não estorna nada quando o limite de 10,0 moedas extras segue cheio', () => {
    const plan = bookRemovalPlan({ ...base, remainingAfter: 30, netAcquisition: 10 });
    expect(plan.reversal).toBe(0);
  });

  it('volta o bônus de 10,0 para bloqueado quando a estante fica vazia', () => {
    const plan = bookRemovalPlan({ ...base, remainingAfter: 0, netAcquisition: 0, activeWelcome: 10, balance: 10 });
    expect(plan).toMatchObject({ allowed: true, locksWelcome: true, welcomeAmount: 10 });
  });

  it('impede remover o último livro quando o bônus já foi gasto', () => {
    const plan = bookRemovalPlan({ ...base, remainingAfter: 0, netAcquisition: 0, activeWelcome: 10, balance: 3 });
    expect(plan).toMatchObject({ allowed: false, reason: 'bonus_gasto' });
  });
});
