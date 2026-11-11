import { describe, expect, it, vi } from 'vitest';
import { deliveryModeFor, isSameCity, lookupCep } from './cep';

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe('ViaCEP lookup', () => {
  it('fills street, district, city and UF from ViaCEP', async () => {
    const f = vi.fn(async () => json({ logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' }));
    const addr = await lookupCep('01310-100', f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledWith('https://viacep.com.br/ws/01310100/json/');
    expect(addr).toEqual({ cep: '01310100', street: 'Avenida Paulista', district: 'Bela Vista', city: 'São Paulo', uf: 'SP' });
  });

  it('returns null for unknown CEP', async () => {
    const f = vi.fn(async () => json({ erro: true }));
    expect(await lookupCep('99999-999', f as unknown as typeof fetch)).toBeNull();
  });

  it('does not call ViaCEP for incomplete CEP', async () => {
    const f = vi.fn();
    expect(await lookupCep('0131', f as unknown as typeof fetch)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});

describe('Uber × Correios by city', () => {
  it('same city (ignoring accents/case) uses Uber', () => {
    expect(deliveryModeFor('São Paulo - SP', { city: 'sao paulo', uf: 'sp' })).toBe('uber');
  });
  it('different cities use Correios', () => {
    expect(deliveryModeFor('Fortaleza - CE', 'São Paulo - SP')).toBe('correios');
  });
  it('same city name in another state is not the same city', () => {
    expect(isSameCity('Bom Jesus - PI', 'Bom Jesus - RS')).toBe(false);
  });
});
