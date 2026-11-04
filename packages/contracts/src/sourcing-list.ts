export interface SourcingListSummary {
  total: number;
  running: number;
  candidates: number;
  ready: number;
}
export interface SourcingListPageMeta {
  page: number;
  page_size: number;
  total: number;
  summary: SourcingListSummary;
}
