/** Cover shown on cards: the official cover from the ISBN databases, else the reader's "1. Capa Frontal" photo. */
export function coverImageOf(book: { coverUrl?: string | undefined; photoUrls?: string[] | undefined }): string | undefined {
  return book.coverUrl || book.photoUrls?.[0] || undefined;
}
