import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { parseBackup, mergeWorks } from "../src/model";
async function openDemo(page: any) {
  await page.goto("/");
  await page.getByRole("button", { name: /Comença a explorar/ }).click();
  await expect(page.locator(".page-loading")).toHaveCount(0);
  await expect(page.locator(".textLayer span").first()).toBeVisible();
}
async function draw(page: any, tool: string) {
  await page.getByRole("button", { name: tool, exact: true }).click();
  const box = await page.locator(".annotation-layer").boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55, {
    steps: 8,
  });
  await page.mouse.up();
}
async function backup(page: any) {
  const p = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar JSON", exact: true })
    .click();
  const d = await p;
  return JSON.parse(await readFile((await d.path())!, "utf8"));
}
test("anotacions, persistència, zoom, JSON i PDF", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openDemo(page);
  await page
    .getByRole("button", { name: "Subratllar text", exact: true })
    .click();
  const span = page
    .locator(".textLayer span")
    .filter({ hasText: "Selecciona aquest text amb el subratllador." });
  const r = await span.boundingBox();
  expect(r).toBeTruthy();
  await page.mouse.move(r!.x + 1, r!.y + r!.height / 2);
  await page.mouse.down();
  await page.mouse.move(r!.x + r!.width - 1, r!.y + r!.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(page.locator("[data-annotation]")).toHaveCount(1);
  await draw(page, "Fletxa");
  await expect(page.locator("[data-annotation]")).toHaveCount(2);
  await page.getByRole("button", { name: "Nota", exact: true }).click();
  const b = await page.locator(".annotation-layer").boundingBox();
  await page.mouse.click(b!.x + b!.width * 0.2, b!.y + b!.height * 0.3);
  await page
    .getByRole("textbox", { name: "Contingut de l’anotació" })
    .fill("Això és una nota de prova.");
  await page.getByRole("button", { name: "Desar anotació" }).click();
  await expect(page.locator("[data-annotation]")).toHaveCount(3);
  await page.getByRole("button", { name: "Desfer", exact: true }).click();
  await expect(page.locator("[data-annotation]")).toHaveCount(2);
  await page.getByRole("button", { name: "Refer", exact: true }).click();
  await expect(page.locator("[data-annotation]")).toHaveCount(3);
  const initial = await backup(page);
  expect(initial.documents[0].annotations.map((a: any) => a.kind)).toEqual([
    "highlight",
    "arrow",
    "note",
  ]);
  expect(initial.documents[0].annotations[0].quote).toContain("Selecciona");
  await page.getByRole("button", { name: "Ampliar zoom" }).click();
  await expect(page.locator(".page-loading")).toHaveCount(0);
  expect((await backup(page)).documents).toEqual(initial.documents);
  await page.reload();
  await page.getByRole("button", { name: /Comença a explorar/ }).click();
  await expect(page.locator("[data-annotation]")).toHaveCount(3);
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto("/");
  await fresh
    .locator('input[type=file][accept*="json"]')
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(initial)),
    });
  await fresh.getByRole("button", { name: "Combinar", exact: true }).click();
  await fresh.getByRole("button", { name: /Comença a explorar/ }).click();
  await expect(fresh.locator("[data-annotation]")).toHaveCount(3);
  expect((await backup(fresh)).documents).toEqual(initial.documents);
  // Re-importing does not duplicate annotation identities.
  await fresh
    .locator('input[type=file][accept*="json"]')
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(initial)),
    });
  await fresh.getByRole("button", { name: "Combinar", exact: true }).click();
  await expect(fresh.locator("[data-annotation]")).toHaveCount(3);
  const dp = fresh.waitForEvent("download");
  await fresh.getByRole("button", { name: "PDF anotat", exact: true }).click();
  const file = await dp;
  expect(file.suggestedFilename()).toContain("anotat.pdf");
  expect((await readFile((await file.path())!)).subarray(0, 4).toString()).toBe(
    "%PDF",
  );
  await fresh.screenshot({ path: "test-results/reader.png", fullPage: true });
  await context.close();
  expect(errors).toEqual([]);
});
test("biblioteca, mòbil, bloqueig multipestanya i JSON invàlid", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Comença a explorar/ }),
  ).toBeEnabled();
  await expect(page.locator(".book-cover canvas")).toHaveAttribute(
    "data-loaded",
    "true",
  );
  await page.screenshot({ path: "test-results/library.png", fullPage: true });
  const tab = await context.newPage();
  await tab.goto("/");
  await expect(
    tab.getByRole("heading", {
      name: "Fulla ja està oberta en una altra pestanya",
    }),
  ).toBeVisible();
  await tab.close();
  await page
    .locator('input[type=file][accept*="json"]')
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        '{"format":"fulla-annotations","version":1,"documents":[{"id":"bad"}]}',
      ),
    });
  await expect(page.getByRole("alert")).toContainText(
    "No s’ha modificat cap dada",
  );
  await page.getByRole("button", { name: "Tancar avís" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("button", { name: /Comença a explorar/ }).click();
  await expect(page.locator(".page-loading")).toHaveCount(0);
  await draw(page, "Llapis");
  await expect(page.locator("[data-annotation]")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/mobile-reader.png",
    fullPage: true,
  });
});
test("validation guards and merge semantics", () => {
  expect(() =>
    parseBackup({ format: "fulla-annotations", version: 2, documents: [] }),
  ).toThrow();
  const id = "sha256:" + "a".repeat(64);
  const w = {
    id,
    title: "test",
    page: 1,
    annotations: [],
    updatedAt: new Date().toISOString(),
  };
  expect(
    parseBackup({ format: "fulla-annotations", version: 1, documents: [w] })
      .documents,
  ).toHaveLength(1);
  expect(() =>
    parseBackup({ format: "fulla-annotations", version: 1, documents: [w, w] }),
  ).toThrow();
  expect(mergeWorks([w], [w], false)).toHaveLength(1);
});
