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
  /** Signed links to the 3 real photos (capa, laterais, miolo) for readers' books. */
  photoUrls?: string[] | undefined;
  /** Official cover from the ISBN databases; when absent the "1. Capa Frontal" photo is the cover. */
  coverUrl?: string | undefined;
}

export interface BookListing {
  id: string;
  book: Book;
  ownerId: string;
  city: string;
  /** null = unknown (real readers have no GPS yet; only the city is known). */
  distanceKm: number | null;
  ownerName?: string | undefined;
  /** Owner's neighbourhood (bairro), for the "Mesmo bairro" filter. */
  district?: string | undefined;
  /** 'real' = registered by a reader; 'sample' = example book shown while the feed is empty. */
  source?: 'real' | 'sample' | undefined;
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
  type: 'Cafeteria' | 'Livraria' | 'Biblioteca' | 'Shopping' | 'Metrô' | 'Centro Cultural' | 'Praça' | 'Local escolhido';
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
  coverUrl?: string | undefined;
  photoUrls?: string[] | undefined;
}
