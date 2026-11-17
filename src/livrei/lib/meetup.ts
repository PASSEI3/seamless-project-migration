import type { MeetupPoint } from '@/livrei/types';

/** "Fortaleza - CE" → "Fortaleza"; empty → "". */
export function cityNameOf(cityUf?: string | null): string {
  const value = (cityUf ?? '').trim();
  const m = value.match(/^(.*?)\s*[-/,]\s*([A-Za-z]{2})\s*$/);
  return (m ? m[1]! : value).trim();
}

/** Minimum length for the reader's own public meeting point. */
export const CUSTOM_MEETUP_MIN_LENGTH = 3;

/** Generic, safe public-place suggestions adapted to the reader's city (no fixed addresses). */
export function suggestMeetupPoints(cityUf?: string | null): MeetupPoint[] {
  const name = cityNameOf(cityUf);
  const city = cityUf?.trim() || '';
  const where = name || 'da sua cidade';
  return [
    {
      id: 'sug-shopping',
      name: name ? `Shopping principal de ${name}` : 'Shopping principal da sua cidade',
      type: 'Shopping',
      address: `Praça de alimentação ou entrada principal · ${where}`,
      emoji: '🛍️',
      city,
      hours: 'Horário de funcionamento do shopping',
    },
    {
      id: 'sug-praca',
      name: 'Praça central movimentada',
      type: 'Praça',
      address: `Centro ${name ? `de ${name}` : 'da sua cidade'} · local aberto e com movimento`,
      emoji: '🌳',
      city,
      hours: 'Prefira o período diurno',
    },
    {
      id: 'sug-livraria',
      name: 'Livraria ou cafeteria local',
      type: 'Livraria',
      address: `Escolha juntos uma livraria ou café conhecido em ${where}`,
      emoji: '☕',
      city,
      hours: 'Horário comercial',
    },
  ];
}

/** Turns the reader's free-text place into a meetup point; null when too short. */
export function customMeetupPoint(text: string, cityUf?: string | null): MeetupPoint | null {
  const place = text.trim().replace(/\s+/g, ' ');
  if (place.length < CUSTOM_MEETUP_MIN_LENGTH) return null;
  return {
    id: 'custom',
    name: place.slice(0, 120),
    type: 'Local escolhido',
    address: cityUf?.trim() || 'Ponto público escolhido por você',
    emoji: '📍',
    city: cityUf?.trim() || '',
    hours: 'Combine o horário pelo chat',
  };
}
