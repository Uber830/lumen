// =============================================================================
// The pages of a long list.
// -----------------------------------------------------------------------------
// The lists of the panel are cut in pages so the view keeps its place
// when the school grows: the courses, the assignments, the teachers.
//
// The cut is made here, in one place: the same numbers for every view.
// =============================================================================

/** The rows of one page, with the numbers the footer shows. */
export type PageOf<T> = {
  /** The rows of this page. */
  items: T[];
  /** The page that is being shown, always inside the list. */
  page: number;
  /** How many pages the list has. */
  pageCount: number;
  /** How many rows the list has in all. */
  total: number;
  /** How many rows fit in a page. */
  pageSize: number;
};

/**
 * The rows of one page.
 *
 * The page is kept inside the list: when the list shrinks and the page
 * that was open no longer exists, the last one is shown.
 */
export function paginate<T>(items: T[], page: number, pageSize: number): PageOf<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    pageCount,
    total,
    pageSize,
  };
}
