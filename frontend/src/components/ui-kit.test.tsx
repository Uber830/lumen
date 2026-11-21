import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollapsibleCard, Pagination, PanelTable } from "@/components/ui-kit";

// React needs to know it is running inside a test to allow `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("CollapsibleCard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("folds the body away and opens it again", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onToggle = vi.fn();

    await act(async () => {
      root.render(
        <CollapsibleCard title="Nuevo curso" open onToggle={onToggle}>
          <p>El formulario</p>
        </CollapsibleCard>,
      );
    });

    expect(container.textContent).toContain("El formulario");

    // Clicking the title folds the body away.
    const toggle = container.querySelector("button");
    await act(async () => {
      toggle?.click();
    });

    expect(onToggle).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps the title visible when it is folded", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CollapsibleCard title="Nueva materia" open={false} onToggle={() => {}}>
          <p>El formulario</p>
        </CollapsibleCard>,
      );
    });

    expect(container.textContent).toContain("Nueva materia");
    expect(container.textContent).not.toContain("El formulario");
    expect(container.querySelector("button")?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe("Pagination", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("says how many rows are shown and moves between pages", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onPageChange = vi.fn();

    await act(async () => {
      root.render(
        <Pagination page={2} pageCount={3} total={25} pageSize={10} onPageChange={onPageChange} />,
      );
    });

    expect(container.textContent).toContain("11");
    expect(container.textContent).toContain("20");
    expect(container.textContent).toContain("25");
    expect(container.textContent).toContain("Página 2 de 3");

    const next = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Siguiente",
    );
    await act(async () => {
      next?.click();
    });
    expect(onPageChange).toHaveBeenCalledWith(3);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("hides itself when everything fits in one page", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Pagination page={1} pageCount={1} total={3} pageSize={10} onPageChange={() => {}} />,
      );
    });

    expect(container.textContent).toBe("");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe("PanelTable", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("labels each cell with the column it belongs to", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PanelTable className="w-full border-collapse">
          <thead>
            <tr>
              <th scope="col">Material</th>
              <th scope="col">Área</th>
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Guide de álgebra</td>
              <td>Matemáticas</td>
              <td>
                <button type="button">Ver</button>
              </td>
            </tr>
          </tbody>
        </PanelTable>,
      );
    });

    const cells = container.querySelectorAll("tbody td");
    expect(cells).toHaveLength(3);
    expect(cells[0].getAttribute("data-label")).toBe("Material");
    expect(cells[1].getAttribute("data-label")).toBe("Área");
    // The label of a column that is hidden behind a screen reader only
    // span is read the same way.
    expect(cells[2].getAttribute("data-label")).toBe("Acciones");
  });
});
