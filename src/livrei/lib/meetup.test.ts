import { describe, expect, it } from 'vitest';
import { cityNameOf, customMeetupPoint, suggestMeetupPoints } from './meetup';

describe('meetup suggestions', () => {
  it('adapts the shopping suggestion to the reader city, never São Paulo', () => {
    const points = suggestMeetupPoints('Fortaleza - CE');
    expect(points.map((p) => p.name)).toEqual([
      'Shopping principal de Fortaleza',
      'Praça central movimentada',
      'Livraria ou cafeteria local',
    ]);
    expect(points.every((p) => p.city === 'Fortaleza - CE')).toBe(true);
  });

  it('falls back to "sua cidade" when the profile has no city', () => {
    expect(suggestMeetupPoints(undefined)[0]!.name).toBe('Shopping principal da sua cidade');
  });

  it('extracts the city name from "Cidade - UF"', () => {
    expect(cityNameOf('São Luís - MA')).toBe('São Luís');
    expect(cityNameOf('Natal/RN')).toBe('Natal');
  });

  it('accepts a typed public place and rejects blank or too-short text', () => {
    expect(customMeetupPoint('  Biblioteca   Pública  ', 'Recife - PE')?.name).toBe('Biblioteca Pública');
    expect(customMeetupPoint('  ', 'Recife - PE')).toBeNull();
    expect(customMeetupPoint('ab', 'Recife - PE')).toBeNull();
  });
});
