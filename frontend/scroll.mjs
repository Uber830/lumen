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
const editar = page.getByRole("button", { name: "Editar" });
console.log("filas:", await editar.count());
await editar.first().click();
await page.waitForTimeout(800);
const modal = page.getByRole("dialog");
console.log("modal:", await modal.count());
const combo = modal.getByRole("combobox").nth(1);
await combo.click();
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const list = document.querySelector('[role="listbox"]');
  if (!list) return { error: "no listbox" };
  const cs = getComputedStyle(list);
  const r = list.getBoundingClientRect();
  return {
    scrollHeight: list.scrollHeight,
    clientHeight: list.clientHeight,
    overflowY: cs.overflowY,
    maxHeight: cs.maxHeight,
    position: cs.position,
    rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) },
    parent: list.parentElement?.className?.toString().slice(0, 80),
    parentOverflow: list.parentElement ? getComputedStyle(list.parentElement).overflow : null,
    options: list.querySelectorAll('[role="option"]').length,
  };
});
console.log("lista:", JSON.stringify(info, null, 1));
// Rueda del mouse sobre la lista
const box = await page.locator('[role="listbox"]').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.wheel(0, 300);
await page.waitForTimeout(400);
const despues = await page.evaluate(() => document.querySelector('[role="listbox"]')?.scrollTop);
console.log("scrollTop tras la rueda:", despues);
await browser.close();
