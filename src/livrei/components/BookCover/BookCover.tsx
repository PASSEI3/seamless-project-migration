import type { Book } from '@/livrei/types';
import { coverImageOf } from '@/livrei/lib/cover';

interface Props {
  book: Pick<Book, 'title' | 'author' | 'coverClass' | 'coverEmoji'> & Partial<Pick<Book, 'coverUrl' | 'photoUrls'>>;
  className?: string;
  emojiSize?: string;
}

/** Official cover → "1. Capa Frontal" photo → colored placeholder (sample books only). */
export function BookCover({ book, className = '', emojiSize = 'text-6xl' }: Props) {
  const image = coverImageOf(book);
  if (image) {
    return (
      <div className={`${className} relative overflow-hidden rounded-2xl bg-purple-800 shadow-lg`}>
        <img src={image} alt={`Capa de ${book.title}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${book.coverClass} ${className} relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 shadow-lg`}>
      <div className="flex items-start justify-between">
        <span className={`${emojiSize} drop-shadow-lg`}>{book.coverEmoji}</span>
        <div className="h-2 w-2 rounded-full bg-white/40" />
      </div>
      <div>
        <p className="text-sm font-bold leading-tight text-white drop-shadow-sm line-clamp-2">{book.title}</p>
        <p className="mt-1 text-xs text-white/80 line-clamp-1">{book.author}</p>
      </div>
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-black/10" />
    </div>
  );
}
