import { describe, expect, it } from "vitest";

import {
  getServerSidebarCollapsed,
  getStoredSidebarCollapsed,
  setSidebarCollapsed,
  subscribeSidebar,
} from "@/lib/sidebar";

describe("the sidebar's collapsed state", () => {
  it("is expanded by default", () => {
    expect(getStoredSidebarCollapsed()).toBe(false);
    expect(getServerSidebarCollapsed()).toBe(false);
  });

  it("remembers the choice in the browser", () => {
    setSidebarCollapsed(true);
    expect(getStoredSidebarCollapsed()).toBe(true);

    setSidebarCollapsed(false);
    expect(getStoredSidebarCollapsed()).toBe(false);
  });

  it("tells the subscribers when it changes", () => {
    let notified = 0;
    const unsubscribe = subscribeSidebar(() => {
      notified += 1;
    });

    setSidebarCollapsed(true);
    expect(notified).toBe(1);

    unsubscribe();
    setSidebarCollapsed(false);
    expect(notified).toBe(1);
  });
});
