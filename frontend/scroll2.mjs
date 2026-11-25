import { chromium } from "@playwright/test";
const BASE = "http://localhost:5174";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`${BASE}/login`);
await page.waitForLoadState("networkidle");
await page.getByLabel(/Correo institucional/i).fill("ana.restrepo@sagcor.edu.co");
await page.getByLabel(/^Contraseña$/i).fill("lumen-dev");
await page.getByRole("button", { name: /Entrar/i }).click();
await page.waitForURL(/\/admin/, { timeout: 20000 });
await page.goto(`${BASE}/admin/asignaciones`);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Editar" }).first().click();
await page.waitForTimeout(800);
await page.getByRole("dialog").getByRole("combobox").nth(1).click();
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const list = document.querySelector('[role="listbox"]');
  const cs = getComputedStyle(list);
  return {
    bodyPointerEvents: getComputedStyle(document.body).pointerEvents,
    bodyOverflow: getComputedStyle(document.body).overflow,
    listPointerEvents: cs.pointerEvents,
    listOverflowY: cs.overflowY,
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
  };
});
console.log(JSON.stringify(info, null, 1));
// ¿Se puede desplazar a mano?
const manual = await page.evaluate(() => {
  const list = document.querySelector('[role="listbox"]');
  list.scrollTop = 120;
  return list.scrollTop;
});
console.log("scrollTop manual:", manual);
// Wheel sobre la lista
const box = await page.locator('[role="listbox"]').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + 100);
await page.mouse.wheel(0, 200);
await page.waitForTimeout(300);
console.log("tras rueda:", await page.evaluate(() => document.querySelector('[role="listbox"]')?.scrollTop));
await browser.close();
