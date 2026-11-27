import { expect, test, type Page } from "@playwright/test";

/**
 * The panel of the platform:
 *
 *   - the support desk has the same shape as the one of the school and
 *     the team answers from the case itself;
 *   - the library says what can be done with a piece: it is seen with
 *     the eye and managed from a centered modal;
 *   - the upload assistant asks who is going to see the piece.
 */

const TEAM = {
  email: "super@lumen.co",
  password: process.env.LUMEN_SEED_PASSWORD ?? "",
};

/** The wait of the panel: the pages are hydrated and the data arrives. */
const READY = { timeout: 20_000 };

async function login(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const email = page.getByLabel(/Correo institucional/i);
  await email.click();
  await email.fill(TEAM.email);
  await page.getByLabel(/^Contraseña$/i).fill(TEAM.password);
  await page.getByRole("button", { name: /Entrar/i }).click();
  await page.waitForURL(/\/super/);
}

/** Open a view of the panel and wait for it to be ready. */
async function openPanel(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/**
 * A piece of the platform with a file of its own.
 *
 * The catalog of the seed carries the rows of the files, but not the
 * files themselves: the preview of a seeded piece has nothing to show.
 * The piece is created through the API of the session and is removed at
 * the end, so the test does not leave anything behind.
 */
async function crearPiezaConArchivo(page: Page, titulo: string): Promise<string> {
  const api = process.env.VITE_API_URL ?? "http://localhost:8010";
  const id = await page.evaluate(
    async ({ api, titulo }) => {
      const cuerpo = new FormData();
      cuerpo.append(
        "file",
        new File([new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])], "guia-plataforma.pdf", {
          type: "application/pdf",
        }),
      );
      const subido = await fetch(`${api}/v1/platform/uploads`, {
        method: "POST",
        body: cuerpo,
        credentials: "include",
      });
      const archivo = await subido.json();

      const creado = await fetch(`${api}/v1/platform/catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: titulo,
          type: "Guía",
          area: "Convivencia",
          grades: [],
          origin: "upload",
          file_id: archivo.file_id,
          all_schools: true,
        }),
      });
      return (await creado.json()).id as string;
    },
    { api, titulo },
  );
  return id;
}

test.describe("el panel de la plataforma", () => {
  test("la mesa de soporte responde desde el caso y abre conversaciones", async ({ page }) => {
    await login(page);
    await openPanel(page, "/super/soporte");

    await expect(page.getByRole("heading", { name: "Soporte y auditoría" })).toBeVisible(READY);

    // La lista se corta en páginas, como la del colegio.
    await expect(page.getByText(/Mostrando/)).toBeVisible(READY);

    // La tabla no responde: la respuesta se escribe en el caso, que
    // se abre desde la fila.
    const filas = page.locator("table tbody tr");
    await expect(filas.first()).toBeVisible(READY);
    await expect(filas.first().getByRole("button", { name: /^Responder/i })).toHaveCount(0);

    await filas.first().getByRole("button").first().click();
    const caso = page.getByRole("dialog").last();
    await expect(caso.getByRole("button", { name: /^Responder/i })).toBeVisible(READY);
    await page.keyboard.press("Escape");

    // Y el equipo puede empezar la conversación con un colegio.
    await page
      .getByRole("button", { name: /Enviar solicitud/i })
      .first()
      .click();
    const modal = page.getByRole("dialog").last();
    await expect(modal.getByRole("heading", { name: /Enviar solicitud/i })).toBeVisible(READY);
    await expect(modal.getByLabel(/Colegio/i)).toBeVisible();
    await expect(modal.getByLabel(/Asunto/i)).toBeVisible();
    await expect(modal.getByLabel(/Mensaje/i)).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("la biblioteca muestra el recurso, lo edita y lo resume", async ({ page }) => {
    await login(page);

    // La pieza del test tiene un archivo de verdad: la de la semilla
    // no lo tiene, y su vista previa no podría mostrarlo.
    const titulo = `Pieza de la biblioteca e2e ${Date.now()}`;
    const id = await crearPiezaConArchivo(page, titulo);

    await openPanel(page, "/super/catalogo");

    const tarjeta = page.locator("ul li article").filter({ hasText: titulo }).first();
    await expect(tarjeta).toBeVisible(READY);

    // Los tres controles son solo el icono: la tarjeta no pierde el
    // espacio con los nombres.
    await expect(tarjeta.getByRole("button")).toHaveCount(3);

    // El ojito: la pieza se ve antes de decidir nada sobre ella.
    await tarjeta.getByRole("button", { name: /^Ver/ }).click();
    const vista = page.getByRole("dialog").last();
    await expect(vista.getByRole("heading", { level: 2 })).toBeVisible(READY);
    // El archivo se muestra: una imagen, un marco o un video.
    await expect(vista.locator("img, iframe, video")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // El lápiz: los valores se cambian ahí.
    await tarjeta.getByRole("button", { name: /^Editar/ }).click();
    const editor = page.getByRole("dialog").last();
    await expect(editor.getByLabel(/Título/i)).toBeVisible();
    await expect(editor.getByLabel(/Tipo/i)).toBeVisible();
    await expect(editor.getByLabel(/Área/i)).toBeVisible();
    await expect(editor.getByLabel(/Visible para/i)).toBeVisible();
    await expect(editor.getByRole("button", { name: /Guardar cambios/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // Gestionar: el resumen de la pieza, sin campos que cambiar.
    await tarjeta.getByRole("button", { name: /^Gestionar/ }).click();
    const panel = page.getByRole("dialog").last();
    // El título del panel es el único encabezado de nivel dos: los
    // demás son las secciones de dentro.
    await expect(panel.getByRole("heading", { level: 2 })).toBeVisible(READY);
    await expect(panel.locator("input, select, textarea")).toHaveCount(0);
    await expect(panel.getByText(/Estado del material/i)).toBeVisible();
    await expect(panel.getByText(/Colegios con acceso/i)).toBeVisible();
    await page.keyboard.press("Escape");

    // La pieza del test es un borrador: se puede borrar.
    const borrada = await page.evaluate(
      async ({ api, id }) => {
        const respuesta = await fetch(`${api}/v1/platform/catalog/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        return respuesta.status;
      },
      { api: process.env.VITE_API_URL ?? "http://localhost:8010", id },
    );
    expect(borrada).toBe(204);
  });

  test("el asistente pregunta a qué colegios va el recurso", async ({ page }) => {
    await login(page);
    await openPanel(page, "/super/catalogo");

    await page
      .getByRole("button", { name: /Cargar recurso/i })
      .first()
      .click();
    const asistente = page.getByRole("dialog").last();
    await expect(asistente.getByRole("heading", { name: /Cargar contenido/i })).toBeVisible(READY);

    // Un enlace externo no necesita archivo.
    await asistente.getByRole("button", { name: /Enlazar contenido externo/i }).click();
    await asistente.getByLabel(/URL del recurso/i).fill("https://example.com/recursos/convivencia");
    await asistente.getByRole("button", { name: /Continuar/i }).click();

    // La decisión va antes de la lista de colegios.
    await expect(asistente.getByRole("button", { name: /Todos los colegios/i })).toBeVisible(READY);
    await expect(asistente.getByRole("button", { name: /Ciertos colegios/i })).toBeVisible(READY);

    // Con «todos» la lista de colegios no se muestra.
    await expect(asistente.getByRole("button", { name: /Colegio Sagrado Corazón/i })).toHaveCount(
      0,
    );

    // Con «ciertos» aparece.
    await asistente.getByRole("button", { name: /Ciertos colegios/i }).click();
    await expect(asistente.getByRole("button", { name: /Colegio Sagrado Corazón/i })).toBeVisible(
      READY,
    );
    await page.keyboard.press("Escape");
  });
});
