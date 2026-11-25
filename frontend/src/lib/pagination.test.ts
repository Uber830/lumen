import { describe, expect, it } from "vitest";

import { paginate } from "@/lib/pagination";

describe("the pages of a list", () => {
  it("shows the rows of the page that is asked for", () => {
    const page = paginate([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 2, 10);
    expect(page.items).toEqual([11, 12]);
    expect(page.page).toBe(2);
    expect(page.pageCount).toBe(2);
    expect(page.total).toBe(12);
  });

  it("has one page when everything fits", () => {
    const page = paginate([1, 2, 3], 1, 10);
    expect(page.items).toEqual([1, 2, 3]);
    expect(page.pageCount).toBe(1);
  });

  it("keeps the page inside the list when it shrinks", () => {
    const page = paginate([1, 2, 3], 5, 10);
    expect(page.page).toBe(1);
    expect(page.items).toEqual([1, 2, 3]);
  });

  it("does not show a page that does not exist", () => {
    const page = paginate([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 0, 10);
    expect(page.page).toBe(1);
  });

  it("is empty when there is nothing to show", () => {
    const page = paginate([], 1, 10);
    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
    expect(page.pageCount).toBe(1);
  });
});
