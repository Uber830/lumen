import { expect, test, type Page } from "@playwright/test";

import { siteFixture } from "../../src/test/site-fixture";

/** The landing reads the content from the API. */
async function mockSite(page: Page) {
  await page.route("**/v1/public/site", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(siteFixture),
    });
  });
}

test.describe("smoke", () => {
  test("landing page renders with Lumen branding", async ({ page }) => {
    await mockSite(page);
    await page.goto("/");

    await expect(page).toHaveTitle(/Lumen/i);
    await expect(page.getByRole("link", { name: /Lumen/i }).first()).toBeVisible();
  });

  test("login page renders the sign-in form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /Iniciar sesión/i })).toBeVisible();
    await expect(page.getByLabel(/Correo institucional/i)).toBeVisible();
    await expect(page.getByLabel(/^Contraseña$/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Entrar/i })).toBeVisible();
  });

  test("the login does not offer a self-service registration", async ({ page }) => {
    await page.goto("/login");

    // The schools are onboarded by the platform team: the public site
    // only invites to contact them.
    await expect(page.getByRole("link", { name: /Regístrelo/i })).toHaveCount(0);
    await expect(page.getByText(/Solicite su acceso/i)).toBeVisible();
  });
});
