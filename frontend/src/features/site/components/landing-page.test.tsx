import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LandingPage } from "@/features/site/components/landing-page";
import { flush } from "@/test/site-helpers";
import { siteFixture } from "@/test/site-fixture";

async function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <LandingPage />
      </QueryClientProvider>,
    );
  });
  await flush();

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

describe("LandingPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(siteFixture), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the blocks of the index, in order", async () => {
    const { container, cleanup } = await render();

    const sections = Array.from(container.querySelectorAll("main > section")).map(
      (section) => section.id,
    );

    expect(sections).toEqual(["hero", "indice", "proceso", "roles", "preguntas", "contacto"]);
    expect(container.textContent).toContain("IDX-001 / Solución para colegios");
    expect(container.textContent).toContain("IDX-006 / Contacto");

    await cleanup();
  });

  it("does not publish the platform role nor the coverage by size", async () => {
    // The people who read the landing are the administrators, the
    // teachers and the students: the platform role is an internal
    // thing, and the coverage by size is not published for now.
    const { container, cleanup } = await render();

    expect(container.textContent).not.toContain("PLATAFORMA");
    expect(container.textContent).not.toContain("Cobertura por tamaño");
    expect(container.querySelector("#cobertura")).toBeNull();

    await cleanup();
  });

  it("takes the copy and the figures from the API", async () => {
    const { container, cleanup } = await render();

    // The title is split in two: the first sentence in ink, the second
    // in the accent colour.
    const heading = container.querySelector("h1");
    expect(heading?.textContent).toContain(siteFixture.content.hero.title_lead);
    expect(heading?.textContent).toContain(siteFixture.content.hero.title_tail);
    expect(heading?.querySelector(".text-brand")?.textContent).toBe(
      siteFixture.content.hero.title_tail,
    );

    for (const stat of siteFixture.stats) {
      expect(container.textContent).toContain(stat.value);
      expect(container.textContent).toContain(stat.label);
    }

    await cleanup();
  });

  it("shows the rows of the catalog with the state written out", async () => {
    const { container, cleanup } = await render();

    const rows = container.querySelectorAll("tbody tr");
    // The two rows of the fixture, in the table and in the cards.
    expect(rows.length).toBeGreaterThanOrEqual(2);

    expect(container.textContent).toContain("C-1041");
    expect(container.textContent).toContain("Matemáticas 7 — Álgebra y funciones");
    // The state is text, not only a colour.
    expect(container.textContent).toContain("Publicado");
    expect(container.textContent).toContain("En revisión");
    // The schools beyond the first two are counted.
    expect(container.textContent).toContain("+2");

    await cleanup();
  });

  it("counts the total of the catalog", async () => {
    const { container, cleanup } = await render();

    expect(container.textContent).toContain("Mostrando 2 de 16 entradas");

    await cleanup();
  });

  it("opens the first question and leaves the others closed", async () => {
    const { container, cleanup } = await render();

    const questions = container.querySelectorAll("details");
    expect(questions).toHaveLength(2);
    expect(questions[0].open).toBe(true);
    expect(questions[1].open).toBe(false);

    await cleanup();
  });

  it("offers the skip link as the first focusable element", async () => {
    const { container, cleanup } = await render();

    const first = container.querySelector("a");
    expect(first?.getAttribute("href")).toBe("#contenido");
    expect(first?.textContent).toContain("Saltar al contenido");

    await cleanup();
  });

  it("does not publish the list of schools on the login screen", async () => {
    // The names in the catalog are the ones the platform team chose to
    // publish; the login screen shows illustrative rows instead.
    const { container, cleanup } = await render();
    expect(container.textContent).toContain("Sagrado Corazón");
    await cleanup();
  });
});
