export type ConservationState = 'Novo/Lacrado' | 'Seminovo' | 'Bom Estado' | 'Marcas de Uso';

export type BookTier = 'PADRÃO' | 'PREMIUM';

export interface Book {
  id: string;
  title: string;
  author: string;
  coverClass: string;
  coverEmoji: string;
  condition: ConservationState;
  category?: string | undefined;
  notes?: string | undefined;
  isbn?: string | undefined;
  synopsis?: string | undefined;
  tier?: BookTier | undefined;
}

export interface BookListing {
  id: string;
  book: Book;
  ownerId: string;
  city: string;
  distanceKm: number;
}

export interface User {
  id: string;
  name: string;
  avatarEmoji: string;
  city: string;
  rating: number;
  tradesCount: number;
}

export type LiteraryGenre = 'Ficção/Fantasia' | 'Desenvolvimento Pessoal' | 'Romance' | 'Suspense/Terror' | 'Biografias' | 'Acadêmicos';

export interface UserPreferences {
  genres: LiteraryGenre[];
  authors: string[];
}

export type MatchKind = 'direto';
export type DeliveryMethod = 'correios' | 'local' | 'courier';
export type HandoffRole = 'entregando' | 'recebendo';

export interface MatchEntry {
  id: string;
  kind: MatchKind;
  bookFrom: Book;
  bookTo: Book;
  partnerName: string;
  partnerEmoji: string;
  partnerCity: string;
  partnerDistanceKm?: number | undefined;
  status: 'novo' | 'conversando' | 'finalizado';
  feePaidByMe?: boolean | undefined;
  feePaidByPartner?: boolean | undefined;
  deliveryMethod?: DeliveryMethod | undefined;
  trackingCode?: string | undefined;
  createdAt: string;
}

export interface MeetupPoint {
  id: string;
  name: string;
  type: 'Cafeteria' | 'Livraria' | 'Biblioteca' | 'Shopping' | 'Metrô' | 'Centro Cultural';
  address: string;
  emoji: string;
  city: string;
  hours: string;
}

export interface TradeHistoryEntry {
  id: string;
  bookTitle: string;
  partnerName: string;
  date: string;
  status: 'enviado' | 'recebido' | 'trocado';
}

export interface WishlistEntry {
  bookId: string;
  title: string;
  author: string;
  coverClass: string;
  coverEmoji: string;
}
