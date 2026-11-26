import { expect, test, type Page } from "@playwright/test";

import { siteFixture } from "../../src/test/site-fixture";

// The password of the seeded accounts: a fixture of the test, not a secret.
const SEED_LOGIN = process.env.LUMEN_SEED_PASSWORD ?? "";

/**
 * The public site is served with the content of the API.
 *
 * The e2e job of the continuous integration does not run the backend,
 * so the answer of the API is intercepted here: the test then checks
 * the page, not the network.
 */
async function mockSite(page: Page) {
  await page.route("**/v1/public/site", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "public, max-age=300" },
      body: JSON.stringify(siteFixture),
    });
  });
}

test.describe("landing", () => {
  test.beforeEach(async ({ page }) => {
    await mockSite(page);
  });

  test("renders the blocks of the index", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "El material de su colegio,",
    );
    await expect(page.getByRole("heading", { name: "El catálogo de material" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cómo el colegio pone en marcha su material" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Quién usa Lumen y hasta dónde" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Preguntas frecuentes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Veamos su colegio/ })).toBeVisible();
  });

  test("does not publish the platform role nor the coverage by size", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("PLATAFORMA")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Cobertura por tamaño de colegio" }),
    ).toHaveCount(0);
  });

  test("shows the catalog with its states written out", async ({ page }) => {
    await page.goto("/");

    const table = page.getByRole("table").first();
    await expect(table.getByRole("columnheader", { name: "Ref." })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Área" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Estado" })).toBeVisible();
    const stateColumn = table.getByRole("cell", { name: "Publicado" }).first();
    await expect(stateColumn).toBeVisible();
    await expect(table.getByText("En revisión").last()).toBeVisible();
  });

  test("opens and closes a question", async ({ page }) => {
    await page.goto("/");

    const questions = page.getByRole("group");
    await expect(questions.first()).toHaveAttribute("open", "");
    await expect(questions.nth(1)).not.toHaveAttribute("open", "");

    await questions.nth(1).getByText("¿Qué pasa cuando un material cambia?").click();
    await expect(questions.nth(1)).toHaveAttribute("open", "");
  });

  test("does not scroll sideways on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("follows the theme of the reader", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", { name: /Tema:/ });
    await expect(toggle).toBeVisible();

    // System → light → dark.
    await toggle.click();
    await toggle.click();

    await expect(page.locator("html")).toHaveClass(/dark/);

    const background = await page.evaluate(() => {
      const site = document.querySelector(".idx-site");
      return site ? getComputedStyle(site).backgroundColor : "";
    });
    expect(background).toBe("rgb(11, 14, 20)");
  });

  test("is reachable with the keyboard from the skip link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  });
});

test.describe("login", () => {
  test("answers wrong credentials with a generic message", async ({ page }) => {
    await page.route("**/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "El correo o la contraseña no coinciden.",
          code: "invalid_credentials",
        }),
      });
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Correo institucional").fill("ana@colegio.edu.co");
    await page.getByLabel("Contraseña", { exact: true }).fill("incorrecta");
    await page.getByRole("button", { name: "Entrar" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toContainText("El correo o la contraseña no coinciden.");
    // The message never says whether the account exists.
    await expect(alert).not.toContainText("ana@colegio.edu.co");
  });

  test("counts down when the attempts run out", async ({ page }) => {
    await page.route("**/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "Retry-After": "120" },
        body: JSON.stringify({
          detail: "Demasiados intentos.",
          code: "rate_limited",
          retry_after: 120,
        }),
      });
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Correo institucional").fill("ana@colegio.edu.co");
    await page.getByLabel("Contraseña", { exact: true }).fill(SEED_LOGIN);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByRole("alert")).toContainText("Demasiados intentos");
    await expect(page.getByRole("alert")).toContainText("2 minutos");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeDisabled();
  });

  test("sends each role to its own panel", async ({ page }) => {
    await page.route("**/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tokens: {
            access_token: "a",
            refresh_token: "r",
            token_type: "Bearer",
            expires_at: new Date().toISOString(),
            expires_in: 900,
          },
          session: {
            user: { id: "1", email: "ana@colegio.edu.co" },
            profile: null,
            memberships: [
              { id: "m", school_id: "s", role: "teacher", is_primary: true, joined_at: "" },
            ],
            platform_role: null,
            primary_school_id: "s",
            school: null,
          },
        }),
      });
    });
    // The panel is not part of this test: the navigation is what
    // matters, so the destination is answered with a stub.
    await page.route("**/docente", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Panel</h1>" });
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Correo institucional").fill("ana@colegio.edu.co");
    await page.getByLabel("Contraseña", { exact: true }).fill(SEED_LOGIN);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/docente$/);
  });

  test("ignores a next parameter that leaves the site", async ({ page }) => {
    await page.route("**/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tokens: {
            access_token: "a",
            refresh_token: "r",
            token_type: "Bearer",
            expires_at: new Date().toISOString(),
            expires_in: 900,
          },
          session: {
            user: { id: "1", email: "ana@colegio.edu.co" },
            profile: null,
            memberships: [
              { id: "m", school_id: "s", role: "teacher", is_primary: true, joined_at: "" },
            ],
            platform_role: null,
            primary_school_id: "s",
            school: null,
          },
        }),
      });
    });
    await page.route("**/docente", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Panel</h1>" });
    });

    await page.goto("/login?next=https://evil.example/steal");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Correo institucional").fill("ana@colegio.edu.co");
    await page.getByLabel("Contraseña", { exact: true }).fill(SEED_LOGIN);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/docente$/);
  });
});
