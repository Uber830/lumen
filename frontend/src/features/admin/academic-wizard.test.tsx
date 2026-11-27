import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AcademicStructureWizard } from "@/features/admin/academic-wizard";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api/client", () => ({
  api: {
    get: (path: string) => get(path),
    post: (path: string, body: unknown) => post(path, body),
  },
  apiBaseUrl: "http://api.test",
}));

// React needs to know it is running inside a test to allow `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SCHOOL_ID = "11111111-1111-1111-1111-111111111111";

async function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <AcademicStructureWizard schoolId={SCHOOL_ID} open onClose={() => {}} />
      </QueryClientProvider>,
    );
  });

  return {
    // The dialog is drawn in a portal: it lives in the document, not in
    // the container of the render.
    get panel(): HTMLElement {
      return document.body;
    },
    async cleanup() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Click the button whose text is the one given. */
async function click(panel: HTMLElement, label: string) {
  const button = Array.from(panel.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!button) throw new Error(`No se encontró el botón "${label}"`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("el formulario de cursos y materias", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    get.mockReset();
    post.mockReset();
    get.mockImplementation(async (path: string) => {
      if (path === "/v1/academics/courses") return [];
      if (path === "/v1/academics/subjects") return [];
      return [];
    });
    post.mockImplementation(async () => ({ id: "nuevo" }));
  });

  it("empieza en el paso del curso y avanza al de la materia", async () => {
    const { panel, cleanup } = await render();

    expect(panel.textContent).toContain("Crear curso");
    expect(panel.textContent).toContain("Paso 1 de 3");
    expect(panel.textContent).not.toContain("Crear materia");

    await click(panel, "Siguiente");

    expect(panel.textContent).toContain("Crear materia");
    expect(panel.textContent).toContain("Paso 2 de 3");

    await cleanup();
  });

  it("salta un paso en blanco", async () => {
    const { panel, cleanup } = await render();

    await click(panel, "Siguiente");
    await click(panel, "Siguiente");

    // Ni el curso ni la materia se crearon: el paso en blanco se salta.
    expect(post).not.toHaveBeenCalled();
    expect(panel.textContent).toContain("Ofrecer la materia en un curso");

    await cleanup();
  });

  it("crea el curso y ofrece la materia al final", async () => {
    const { panel, cleanup } = await render();

    const name = panel.querySelector<HTMLInputElement>('input[placeholder="4to A"]');
    const grade = panel.querySelector<HTMLInputElement>('input[placeholder="Cuarto"]');
    expect(name).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(name, "4to A");
      name?.dispatchEvent(new Event("input", { bubbles: true }));
      setter?.call(grade, "Cuarto");
      grade?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await click(panel, "Siguiente");

    expect(post).toHaveBeenCalledWith("/v1/academics/courses", {
      name: "4to A",
      grade_label: "Cuarto",
    });
    expect(panel.textContent).toContain("Crear materia");

    await cleanup();
  });

  it("vuelve atrás con el botón Atrás", async () => {
    const { panel, cleanup } = await render();

    await click(panel, "Siguiente");
    expect(panel.textContent).toContain("Crear materia");

    await click(panel, "Atrás");

    expect(panel.textContent).toContain("Crear curso");
    expect(panel.textContent).toContain("Paso 1 de 3");

    await cleanup();
  });
});
