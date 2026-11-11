/** CEP lookup via ViaCEP (free, public, CORS-enabled) and Uber × Correios decision. */

export interface CepAddress {
  cep: string;
  street: string;
  district: string;
  city: string;
  uf: string;
}

export const onlyDigits = (v: string) => v.replace(/\D/g, '');

export async function lookupCep(cep: string, fetchImpl: typeof fetch = fetch): Promise<CepAddress | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const res = await fetchImpl(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (!data || data['erro']) return null;
    return {
      cep: digits,
      street: String(data['logradouro'] ?? ''),
      district: String(data['bairro'] ?? ''),
      city: String(data['localidade'] ?? ''),
      uf: String(data['uf'] ?? '').toUpperCase(),
    };
  } catch {
    return null;
  }
}

const norm = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Accepts "São Paulo - SP", "São Paulo/SP" or { city, uf }. */
export function parseCityUf(value: string | { city: string; uf: string }): { city: string; uf: string } {
  if (typeof value !== 'string') return { city: norm(value.city), uf: norm(value.uf) };
  const m = value.match(/^(.*?)\s*[-/,]\s*([A-Za-z]{2})\s*$/);
  if (m) return { city: norm(m[1]!), uf: norm(m[2]!) };
  return { city: norm(value), uf: '' };
}

export function isSameCity(a: string | { city: string; uf: string }, b: string | { city: string; uf: string }): boolean {
  const x = parseCityUf(a);
  const y = parseCityUf(b);
  if (!x.city || !y.city) return false;
  if (x.city !== y.city) return false;
  return !x.uf || !y.uf || x.uf === y.uf;
}

/** Same city → Uber Flash; different cities → Correios. */
export function deliveryModeFor(
  me: string | { city: string; uf: string },
  partner: string | { city: string; uf: string },
): 'uber' | 'correios' {
  return isSameCity(me, partner) ? 'uber' : 'correios';
}

export const formatCityUf = (city?: string | null, uf?: string | null) =>
  [city?.trim(), uf?.trim().toUpperCase()].filter(Boolean).join(' - ');
