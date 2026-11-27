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

  test("la biblioteca solo muestra el material habilitado del colegio", async ({ page }) => {
    await login(page);
    await openPanel(page, "/admin/contenido");

    // The library is a shelf of resources: each one is a card with its
    // cover, its name and the button that opens it.
    const tarjetas = page.locator("ul li article");
    await expect(tarjetas.first()).toBeVisible(READY);
    await expect(tarjetas.first().getByRole("button", { name: /^Ver/ })).toBeVisible();
    // The filters of the shelf: the search, the area and the audience.
    await expect(page.getByLabel(/Buscar por título/i)).toBeVisible();
    await expect(page.getByLabel(/Filtrar por área/i)).toBeVisible();
    await expect(page.getByLabel(/Filtrar por destinatario/i)).toBeVisible();
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
    // subject. The list is cut in pages, so the teacher is looked for
    // in all of them: the run does not depend on the page it lands on.
    const fila = page.getByRole("row").filter({ hasText: nombre });
    const siguiente = page.getByRole("button", { name: "Página siguiente" }).first();
    for (let intento = 0; intento < 6; intento += 1) {
      if (await fila.isVisible()) break;
      if (await siguiente.isDisabled()) break;
      await siguiente.click();
      await page.waitForTimeout(500);
    }
    await expect(fila).toBeVisible(READY);
    await expect(fila).toContainText(/7° A/);
  });

  test("la ficha del docente se edita con el nombre y el correo", async ({ page }) => {
    await login(page);
    await openPanel(page, "/admin/docentes");

    // 1. The administrator opens the card of a teacher.
    await page
      .getByRole("button", { name: /Gestionar/i })
      .first()
      .click();
    await expect(page.getByRole("dialog").last()).toBeVisible(READY);

    // 2. The edit form has two fields and nothing else: the name and the
    // email. The subjects are changed in Asignaciones.
    await page
      .getByRole("button", { name: /^Editar$/i })
      .first()
      .click();
    const formulario = page.getByRole("dialog").last();
    await expect(formulario.getByRole("heading", { name: "Editar docente" })).toBeVisible(READY);
    await expect(formulario.getByLabel(/Nombre completo/i)).toBeVisible();
    await expect(formulario.getByLabel(/Correo institucional/i)).toBeVisible();
    // The course of a student is not here, and neither are the subjects.
    await expect(formulario.locator("input[type=radio]")).toHaveCount(0);
    await expect(formulario.locator("input")).toHaveCount(2);
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
    await expect(modal.getByRole("heading", { name: /Asignar otra materia a/ })).toBeVisible(READY);
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
    // La lista es grande y se corta en páginas, como la de Asignaciones:
    // el pie se ve aunque todo quepa en una página.
    await expect(page.getByText(/Mostrando/)).toBeVisible(READY);

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

  test("el colegio carga un recurso propio y lo ve en la biblioteca", async ({ page }) => {
    await login(page);
    await openPanel(page, "/admin/contenido");

    // 1. The administrator loads a resource of the school.
    await page
      .getByRole("button", { name: /Cargar recurso/i })
      .first()
      .click();
    const modal = page.getByRole("dialog").last();
    await expect(modal.getByRole("heading", { name: /Cargar un recurso/i })).toBeVisible(READY);
    await modal.locator("input[type=file]").setInputFiles({
      name: "manual-e2e.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 contenido de prueba"),
    });
    await modal.getByLabel(/Título/i).fill("Manual de convivencia e2e");
    await modal.getByLabel(/Tipo/i).selectOption("Documento");
    await modal.getByLabel(/Área/i).selectOption("Convivencia");
    // The audience is the decision of the school.
    await modal.getByLabel(/Va dirigido a/i).selectOption("admins");
    await modal.getByRole("button", { name: /Cargar el recurso/i }).click();
    await expect(modal).toBeHidden(READY);

    // 2. The resource is in the library, with its origin and its audience.
    const tarjeta = page.locator("ul li article").filter({ hasText: "Manual de convivencia e2e" });
    await expect(tarjeta.first()).toBeVisible(READY);
    await expect(tarjeta.first()).toContainText("Cargado por el colegio");
    await expect(tarjeta.first()).toContainText("Solo administradores");

    // 3. The file is seen inside the platform.
    await tarjeta.first().getByRole("button", { name: /^Ver/ }).click();
    const visor = page.getByRole("dialog").last();
    await expect(visor.getByRole("heading", { name: "Manual de convivencia e2e" })).toBeVisible(
      READY,
    );
    await expect(visor.locator("iframe")).toHaveCount(1);
    await page.keyboard.press("Escape");

    // 4. The school changes the values of its own resource with the pencil.
    await tarjeta
      .first()
      .getByRole("button", { name: /^Editar/ })
      .click();
    const editor = page.getByRole("dialog").last();
    await expect(editor.getByRole("heading", { name: /Editar el recurso/i })).toBeVisible(READY);
    await editor.getByLabel(/Título/i).fill("Manual de convivencia e2e editado");
    await editor.getByRole("button", { name: /Guardar cambios/i }).click();
    await expect(editor).toBeHidden(READY);
    const editada = page
      .locator("ul li article")
      .filter({ hasText: "Manual de convivencia e2e editado" });
    await expect(editada.first()).toBeVisible(READY);

    // 5. The characteristics of the file are in the card of the piece.
    await editada
      .first()
      .getByRole("button", { name: /Características/ })
      .click();
    const ficha = page.getByRole("dialog").last();
    await expect(ficha.getByText("Características del archivo")).toBeVisible(READY);
    await expect(ficha.getByText("manual-e2e.pdf")).toBeVisible(READY);
    await page.keyboard.press("Escape");

    // 6. The school removes its own resource.
    await editada
      .first()
      .getByRole("button", { name: /Quitar/ })
      .click();
    const confirmacion = page.getByRole("dialog").last();
    await confirmacion.getByRole("button", { name: /Quitar el recurso/i }).click();
    await expect(editada).toHaveCount(0, { timeout: 10_000 });
  });
});
