import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("landing page renders with Lumen branding", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Lumen/i);
    await expect(page.getByRole("link", { name: /Lumen/i }).first()).toBeVisible();
  });

  test("login page renders the sign-in form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /Ingresar/i })).toBeVisible();
    await expect(page.getByLabel(/Correo institucional/i)).toBeVisible();
    await expect(page.getByLabel(/Contraseña/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Ingresar/i })).toBeVisible();
  });

  test("registration page renders the multi-step wizard", async ({ page }) => {
    await page.goto("/registro");

    await expect(page.getByRole("heading", { name: /Registrá tu colegio/i })).toBeVisible();
    await expect(page.getByText("Datos del colegio")).toBeVisible();
  });
});
