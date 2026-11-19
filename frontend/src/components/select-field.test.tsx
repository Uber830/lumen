import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Select, type SelectOption } from "@/components/select-field";

// React needs to know it is running inside a test to allow `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS: SelectOption[] = [
  { value: "a", label: "Docente Ana", hint: "ana@colegio.edu" },
  { value: "b", label: "Docente Bruno" },
  { value: "c", label: "Docente Carla", disabled: true },
];

async function render(props: Partial<React.ComponentProps<typeof Select>> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <Select value="a" onChange={() => {}} options={OPTIONS} aria-label="Docente" {...props} />,
    );
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

describe("Select", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the selected option", async () => {
    const { container, cleanup } = await render();

    expect(container.textContent).toContain("Docente Ana");

    await cleanup();
  });

  it("opens the list with every option", async () => {
    const { container, cleanup } = await render();

    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      button?.click();
    });

    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();
    expect(listbox?.querySelectorAll('[role="option"]')).toHaveLength(3);

    await cleanup();
  });

  it("picks the option the user clicks", async () => {
    const onChange = vi.fn();
    const { container, cleanup } = await render({ onChange });

    await act(async () => {
      container.querySelector("button")?.click();
    });

    const options = document.querySelectorAll('[role="option"]');
    await act(async () => {
      (options[1] as HTMLElement).click();
    });

    expect(onChange).toHaveBeenCalledWith("b");

    await cleanup();
  });

  it("does not pick a disabled option", async () => {
    const onChange = vi.fn();
    const { container, cleanup } = await render({ onChange });

    await act(async () => {
      container.querySelector("button")?.click();
    });

    const options = document.querySelectorAll('[role="option"]');
    await act(async () => {
      (options[2] as HTMLElement).click();
    });

    expect(onChange).not.toHaveBeenCalled();

    await cleanup();
  });

  it("stays closed when there is nothing to pick", async () => {
    const { container, cleanup } = await render({ options: [], value: "" });

    const button = container.querySelector("button");
    expect(button?.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      button?.click();
    });

    expect(document.querySelector('[role="listbox"]')).toBeNull();

    await cleanup();
  });
});
