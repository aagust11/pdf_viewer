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
  await fresh.locator('input[type=file][accept*="json"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(initial)),
  });
  await fresh.getByRole("button", { name: "Combinar", exact: true }).click();
  await fresh.getByRole("button", { name: /Comença a explorar/ }).click();
  await expect(fresh.locator("[data-annotation]")).toHaveCount(3);
  expect((await backup(fresh)).documents).toEqual(initial.documents);
  // Re-importing does not duplicate annotation identities.
  await fresh.locator('input[type=file][accept*="json"]').setInputFiles({
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
  await page.locator('input[type=file][accept*="json"]').setInputFiles({
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

test("PDF personal persistent, selector amb moviment i redimensió", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Afegir un PDF", exact: true }),
  ).toBeEnabled();
  const bytes = await readFile("public/pdfs/Benvinguda.pdf");
  await page.locator('input[type=file][accept*="pdf"]').setInputFiles({
    name: "El meu dossier.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
  await expect(page.locator(".page-loading")).toHaveCount(0);
  await expect(page.locator(".textLayer span").first()).toBeVisible();
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  const paper = await page.locator(".annotation-layer").boundingBox();
  await page.mouse.move(
    paper!.x + paper!.width * 0.15,
    paper!.y + paper!.height * 0.2,
  );
  await page.mouse.down();
  await page.mouse.move(
    paper!.x + paper!.width * 0.35,
    paper!.y + paper!.height * 0.35,
    { steps: 5 },
  );
  await page.mouse.up();
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page.locator("[data-annotation] rect").click();
  const before = await backup(page);
  const a = before.documents[0].annotations[0];
  const corner = page.locator('[data-handle="se"]');
  await expect(corner).toBeVisible();
  const handle = await corner.boundingBox();
  await page.mouse.move(
    handle!.x + handle!.width / 2,
    handle!.y + handle!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handle!.x + 60, handle!.y + 55, { steps: 5 });
  await page.mouse.up();
  const after = await backup(page);
  const resized = after.documents[0].annotations[0];
  expect(resized.points[1].x).toBeGreaterThan(a.points[1].x);
  expect(resized.points[1].y).toBeGreaterThan(a.points[1].y);
  expect(resized.points[0].x).toBeCloseTo(a.points[0].x, 6);
  expect(resized.points[0].y).toBeCloseTo(a.points[0].y, 6);
  // Drag the selected shape rather than its handles.
  const shape = await page.locator("[data-annotation] rect").boundingBox();
  await page.mouse.move(
    shape!.x + shape!.width / 2,
    shape!.y + shape!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    shape!.x + shape!.width / 2 + 35,
    shape!.y + shape!.height / 2 + 25,
    { steps: 5 },
  );
  await page.mouse.up();
  const moved = (await backup(page)).documents[0].annotations[0];
  expect(moved.points[0].x).toBeGreaterThan(resized.points[0].x);
  expect(moved.points[1].x - moved.points[0].x).toBeCloseTo(
    resized.points[1].x - resized.points[0].x,
    5,
  );
  await page.getByRole("button", { name: "Desfer", exact: true }).click();
  expect((await backup(page)).documents[0].annotations[0].points).toEqual(
    resized.points,
  );
  await page.getByRole("button", { name: "Refer", exact: true }).click();
  await page.getByRole("button", { name: "Tornar a la biblioteca" }).click();
  await expect(
    page.getByRole("button", { name: /El meu dossier/ }),
  ).toBeVisible();
  await expect(page.locator(".book-cover canvas")).toHaveAttribute(
    "data-loaded",
    "true",
  );
  await page.reload();
  const card = page.getByRole("button", { name: /El meu dossier/ });
  await expect(card).toContainText("1 anotacions");
  await card.click();
  await expect(page.locator(".page-loading")).toHaveCount(0);
  await expect(page.locator("[data-annotation]")).toHaveCount(1);
  expect((await backup(page)).documents[0].annotations[0].points).toEqual(
    moved.points,
  );
  // Duplicate upload is a single entry and preserves annotations.
  await page.getByRole("button", { name: "Tornar a la biblioteca" }).click();
  await page.locator('input[type=file][accept*="pdf"]').setInputFiles({
    name: "El meu dossier.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
  await expect(page.locator("[data-annotation]")).toHaveCount(1);
  await page.getByRole("button", { name: "Tornar a la biblioteca" }).click();
  await expect(page.locator(".book-card")).toHaveCount(1);
});

test("redimensionar notes i fletxes; dades compatibles amb JSON", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Nota", exact: true }).click();
  const b = await page.locator(".annotation-layer").boundingBox();
  await page.mouse.click(b!.x + b!.width * 0.2, b!.y + b!.height * 0.2);
  await page
    .getByRole("textbox", { name: "Contingut de l’anotació" })
    .fill("Una idea");
  await page.getByRole("button", { name: "Desar anotació" }).click();
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page.locator("[data-annotation] text").click();
  const h = await page.locator('[data-handle="se"]').boundingBox();
  await page.mouse.move(h!.x + 7, h!.y + 7);
  await page.mouse.down();
  await page.mouse.move(h!.x + 60, h!.y + 35, { steps: 5 });
  await page.mouse.up();
  const note = (await backup(page)).documents[0].annotations[0];
  expect(note.scaleX).toBeGreaterThan(1);
  expect(note.scaleY).toBeGreaterThan(1);
  await draw(page, "Fletxa");
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page
    .locator("[data-annotation]")
    .last()
    .locator("polyline")
    .first()
    .click();
  const end = await page.locator('[data-handle="end"]').boundingBox();
  await page.mouse.move(end!.x + 7, end!.y + 7);
  await page.mouse.down();
  await page.mouse.move(end!.x + 45, end!.y - 25, { steps: 5 });
  await page.mouse.up();
  const data = await backup(page);
  expect(() => parseBackup(data)).not.toThrow();
  expect(data.documents[0].annotations[1].points[1].x).toBeGreaterThan(0.6);
  await page.screenshot({ path: "test-results/resize-selection.png" });
});

test("la migració conserva les anotacions de la versió anterior", async ({
  page,
}) => {
  await page.goto("/library.json");
  await page.evaluate(async () => {
    const book = (await (await fetch("/library.json")).json())[0];
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("fulla-library", 1);
      req.onupgradeneeded = () =>
        req.result.createObjectStore("work", { keyPath: "id" });
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("work", "readwrite");
        tx.objectStore("work").put({
          id: book.id,
          title: book.title,
          page: 2,
          updatedAt: new Date().toISOString(),
          annotations: [
            {
              id: "existing",
              page: 2,
              kind: "arrow",
              points: [
                { x: 0.2, y: 0.2 },
                { x: 0.3, y: 0.3 },
              ],
              width: 2,
              opacity: 1,
              color: "#123456",
              fontSize: 16,
              updatedAt: new Date().toISOString(),
            },
          ],
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Comença a explorar/ }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Número de pàgina" }),
  ).toHaveValue("2");
  await expect(page.locator('[data-annotation="existing"]')).toHaveCount(1);
});
