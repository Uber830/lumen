import { beforeEach, describe, expect, it } from "vitest";

import {
  getCollapsedSidebar,
  setCollapsedSidebar,
  SIDEBAR_STORAGE_KEY,
  subscribeSidebar,
} from "@/lib/sidebar";

describe("the shape of the left rail", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts expanded", () => {
    expect(getCollapsedSidebar()).toBe(false);
  });

  it("remembers the choice in the browser", () => {
    setCollapsedSidebar(true);

    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("1");
    expect(getCollapsedSidebar()).toBe(true);
  });

  it("tells the subscribers that the rail changed", () => {
    let calls = 0;
    const unsubscribe = subscribeSidebar(() => {
      calls += 1;
    });

    setCollapsedSidebar(true);
    setCollapsedSidebar(false);
    unsubscribe();
    setCollapsedSidebar(true);

    expect(calls).toBe(2);
  });
});
