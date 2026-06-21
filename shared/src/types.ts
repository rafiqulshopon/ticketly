export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Citation back-reference from an AI draft to the KB chunk that grounded it. */
export interface DraftCitation {
  chunkId: string;
  articleId: string;
  articleTitle: string;
  snippet: string;
}
