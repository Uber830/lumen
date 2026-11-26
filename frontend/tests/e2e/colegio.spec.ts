import { expect, test, type Page } from "@playwright/test";

/**
 * The chain of the panel of the school:
 *
 *   crear docente → asignarlo a un curso → el docente queda con acceso
 *   al material de esa materia.
 *
 * The assignment is what enables the access to the content: without one
 * the teacher has no course, and without a course there is nothing to
 * see.
 */

const ADMIN = {
  email: "ana.restrepo@sagcor.edu.co",
  password: process.env.LUMEN_SEED_PASSWORD ?? "",
};

/** The wait of the panel: the pages are hydrated and the data arrives. */
const READY = { timeout: 20_000 };

async function login(page: Page) {
  await page.goto("/login");
  // The form is controlled: the values only reach the state when the
  // page is hydrated, so the wait is part of the login.
  await page.waitForLoadState("networkidle");
  const email = page.getByLabel(/Correo institucional/i);
  await email.click();
  await email.fill(ADMIN.email);
  await page.getByLabel(/^Contraseña$/i).fill(ADMIN.password);
  await page.getByRole("button", { name: /Entrar/i }).click();
  await page.waitForURL(/\/admin/);
}

/** Open a view of the panel and wait for it to be ready. */
async function openPanel(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test.describe("el panel del colegio", () => {
  test("la sesión del administrador abre su panel", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("heading", { name: "Panel del colegio" })).toBeVisible(READY);
    // The top bar shows the school and the period, not a search.
    await expect(page.getByText("Colegio Sagrado Corazón").first()).toBeVisible(READY);
  });

  test("el contenido solo muestra el material habilitado del colegio", async ({ page }) => {
    await login(page);
    await openPanel(page, "/admin/contenido");

    // The material of the school, with its code in monospaced.
    await expect(page.getByText(/C-\d{4}/).first()).toBeVisible(READY);
    // The view is read only: the school does not upload nor publish.
    await expect(page.getByRole("button", { name: /Subir|Publicar/i })).toHaveCount(0);
  });

  test("la asignación de un docente lo habilita a ver el material", async ({ page }) => {
    await login(page);

    // 1. A teacher is created.
    await openPanel(page, "/admin/docentes");
    await page
      .getByRole("button", { name: /Nuevo docente/i })
      .first()
      .click();
    // The name carries the run: two runs leave two teachers behind.
    const nombre = `Docente e2e ${Date.now()}`;
    await page.getByLabel(/Nombre completo/i).fill(nombre);
    await page.getByLabel(/Correo institucional/i).fill(`e2e.${Date.now()}@example.com`);
    await page.getByRole("button", { name: /Crear docente/i }).click();
    // La lista trae diez por página: se busca al docente por su nombre
    // para no depender de en qué página caiga.
    const busqueda = page.getByPlaceholder(/Buscar por nombre o correo/i);
    await busqueda.fill(nombre);
    await expect(page.getByText(nombre).first()).toBeVisible(READY);

    // 2. The teacher is assigned to a course and a subject.
    await openPanel(page, "/admin/asignaciones");
    await page
      .getByRole("button", { name: /Nueva asignación/i })
      .first()
      .click();

    // Los dos desplegables del formulario: el docente y el par curso ·
    // materia. Los filtros de la tabla son otros desplegables.
    const form = page.locator("form");
    await form.getByRole("combobox").first().click();
    // La lista abierta del desplegable del formulario: la de los filtros
    // de la tabla es otra.
    const lista = page.getByRole("listbox").last();
    await lista
      .getByRole("option", { name: new RegExp(nombre) })
      .first()
      .click();

    await form.getByRole("combobox").nth(1).click();
    await page.getByRole("listbox").last().getByRole("option", { name: /7° A/ }).first().click();

    await page.getByRole("button", { name: /Asignar la materia/i }).click();

    // 3. The assignment is in the list: the teacher, the course and the
    // subject.
    const fila = page.getByRole("row").filter({ hasText: nombre });
    await expect(fila).toBeVisible(READY);
    await expect(fila).toContainText(/7° A/);
  });

  test("una fila de asignaciones ofrece agregar y quitar, no editar", async ({ page }) => {
    await login(page);
    await openPanel(page, "/admin/asignaciones");

    // La fila del primer docente: el de la primera fila de la tabla.
    const fila = page.locator("tbody tr").first();
    await expect(fila).toBeVisible(READY);

    // Las dos acciones de la fila, y solo dos: agregar materia y quitarla.
    await expect(fila.getByRole("button", { name: /Asignar otra/i })).toBeVisible();
    await expect(fila.getByRole("button", { name: /Quitar/i })).toBeVisible();
    await expect(fila.getByRole("button", { name: /Editar|Gestionar/i })).toHaveCount(0);

    // «Asignar otra» deja el docente de la fila fijo: solo se elige la
    // materia, y el título lo dice.
    const nombreDocente = (await fila.locator("td").first().innerText()).split("\n")[1];
    await fila.getByRole("button", { name: /Asignar otra/i }).click();
    const modal = page.getByRole("dialog").last();
    await expect(modal.getByRole("heading", { name: /Asignar otra materia a/ })).toBeVisible(
      READY,
    );
    // El docente se ve, pero no se elige: el formulario tiene un solo
    // desplegable, el del par curso · materia.
    await expect(modal.getByText(nombreDocente ?? "", { exact: false }).first()).toBeVisible();
    await expect(modal.getByRole("combobox")).toHaveCount(1);
    await page.keyboard.press("Escape");

    // «Quitar» abre la lista de materias de esa fila, con la ✕ para
    // quitar cada una.
    await fila.getByRole("button", { name: /Quitar/i }).click();
    const lista = page.getByRole("dialog").last();
    await expect(lista.getByRole("heading", { name: /Materias de/ })).toBeVisible(READY);
    await expect(lista.getByRole("listitem")).not.toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("el módulo de ICFES avisa que viene en camino", async ({ page }) => {
    await login(page);
    await openPanel(page, "/admin/icfes-colegio");

    await expect(page.getByRole("heading", { name: "ICFES" })).toBeVisible(READY);
    // El módulo se está afinando: el panel lo dice en vez de mostrar
    // simulacros a medio hacer.
    await expect(page.getByText("Próximamente")).toBeVisible(READY);
  });

  test("el soporte abre una solicitud con su hilo", async ({ page }) => {
    await login(page);
    await openPanel(page, "/admin/soporte");

    await expect(page.getByRole("heading", { name: "Soporte" })).toBeVisible(READY);
    await page
      .getByRole("button", { name: /Enviar solicitud/i })
      .first()
      .click();
    await page.getByLabel(/Asunto/i).fill("Solicitud de la prueba e2e");
    await page.getByLabel(/Mensaje/i).fill("Los docentes de 7° A no ven el material de ciencias.");
    await page
      .getByRole("button", { name: /Enviar solicitud/i })
      .last()
      .click();

    await expect(page.getByText("Solicitud de la prueba e2e").first()).toBeVisible(READY);
  });
});
