import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/confirm-dialog";

// React needs to know it is running inside a test to allow `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <ConfirmDialog
        open
        title="Eliminar el curso 4to A"
        description="Se borra el curso y sus materias."
        onConfirm={() => {}}
        onCancel={() => {}}
        {...props}
      />,
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

describe("ConfirmDialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("says what is going to be deleted and what happens", async () => {
    const { container, cleanup } = await render();

    expect(container.textContent).toContain("Eliminar el curso 4to A");
    expect(container.textContent).toContain("Se borra el curso y sus materias.");
    expect(container.textContent).toContain("Cancelar");
    expect(container.textContent).toContain("Eliminar");

    await cleanup();
  });

  it("confirms and cancels", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { container, cleanup } = await render({ onConfirm, onCancel });

    const buttons = Array.from(container.querySelectorAll("button"));
    const confirm = buttons.find((b) => b.textContent === "Eliminar");
    const cancel = buttons.find((b) => b.textContent === "Cancelar");

    await act(async () => {
      confirm?.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => {
      cancel?.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    await cleanup();
  });

  it("closes on Escape", async () => {
    const onCancel = vi.fn();
    const { cleanup } = await render({ onCancel });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    await cleanup();
  });

  it("stays open while the action is running", async () => {
    const onCancel = vi.fn();
    const { container, cleanup } = await render({ onCancel, pending: true });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onCancel).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Eliminando...");

    await cleanup();
  });

  it("is not in the page when it is closed", async () => {
    const { container, cleanup } = await render({ open: false });

    expect(container.textContent).toBe("");

    await cleanup();
  });
});
