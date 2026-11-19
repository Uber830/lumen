import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import { MemberAvatar } from "@/components/member-avatar";

// React needs to know it is running inside a test to allow `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(props: React.ComponentProps<typeof MemberAvatar>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<MemberAvatar {...props} />);
  });

  return {
    container,
    async cleanup() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("MemberAvatar", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the photo when the member has one", async () => {
    const { container, cleanup } = await render({
      name: "Ana Restrepo",
      avatarUrl: "https://example.test/ana.png",
    });

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://example.test/ana.png");
    expect(image?.getAttribute("alt")).toBe("Foto de Ana Restrepo");

    await cleanup();
  });

  it("falls back to the initials", async () => {
    const { container, cleanup } = await render({
      name: "Ana Restrepo",
      avatarUrl: null,
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("AR");

    await cleanup();
  });
});
