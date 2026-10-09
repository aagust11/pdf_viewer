import { test, expect } from "@playwright/test";
import { visiblePages } from "../src/reading";
test("agrupació de pàgines amb portada i sense", () => {
  expect(visiblePages(1, 5, { spread: true, cover: true })).toEqual([1]);
  expect(visiblePages(3, 5, { spread: true, cover: true })).toEqual([2, 3]);
  expect(visiblePages(4, 5, { spread: true, cover: true })).toEqual([4, 5]);
  expect(visiblePages(5, 5, { spread: true, cover: false })).toEqual([5]);
  expect(visiblePages(2, 5, { spread: true, cover: false })).toEqual([1, 2]);
});
test("generador de codi i visor en iframe amb navegació de llibre", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Comença a explorar/ }).click();
  await page
    .getByRole("button", { name: "Inserir llibre", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Inserir el llibre" });
  await dialog
    .getByRole("combobox", { name: "Vista inicial" })
    .selectOption("double");
  await dialog.getByRole("checkbox").check();
  const code = await dialog
    .getByRole("textbox", { name: "Codi d’inserció" })
    .inputValue();
  expect(code).toContain("allowfullscreen");
  expect(code).toContain("view=double");
  expect(code).toContain("cover=1");
  const url = await dialog
    .getByRole("link", { name: /Previsualitzar/ })
    .getAttribute("href");
  // Two simultaneous iframes, while the regular editor still owns its storage lock.
  await page.evaluate((url) => {
    const host = document.createElement("div");
    host.id = "embed-test";
    host.style.cssText = "position:fixed;inset:0;z-index:1000;background:white";
    host.innerHTML = `<iframe title="visor1" src="${url}" width="850" height="650" allow="fullscreen"></iframe><iframe title="visor2" src="${url}" width="400" height="500"></iframe>`;
    document.body.append(host);
  }, url!);
  const viewer = page.frameLocator("iframe[title=visor1]");
  await expect(viewer.locator(".annotation-layer")).toHaveCount(1);
  await expect(viewer.locator(".annotation-layer")).toHaveAttribute(
    "data-page",
    "1",
  );
  await expect(viewer.locator(".page-loading")).toHaveCount(0);
  await expect(
    viewer.getByRole("button", { name: "Subratllar text" }),
  ).toHaveCount(0);
  await viewer
    .getByRole("button", { name: "Pàgina següent", exact: true })
    .click();
  await expect(viewer.locator(".annotation-layer")).toHaveCount(2);
  await expect(viewer.locator(".annotation-layer").first()).toHaveAttribute(
    "data-page",
    "2",
  );
  await expect(viewer.locator(".annotation-layer").last()).toHaveAttribute(
    "data-page",
    "3",
  );
  await expect(
    viewer.getByRole("button", { name: "Pàgina següent", exact: true }),
  ).toBeDisabled();
  await viewer
    .getByRole("button", { name: "Pàgina anterior", exact: true })
    .click();
  await expect(viewer.locator(".annotation-layer")).toHaveCount(1);
  await viewer.getByRole("checkbox", { name: "Portada sola" }).uncheck();
  await expect(viewer.locator(".annotation-layer")).toHaveCount(2);
  await expect(viewer.locator(".annotation-layer").last()).toHaveAttribute(
    "data-page",
    "2",
  );
  const expanded = await viewer
    .getByRole("link", { name: /Ampliar visor/ })
    .getAttribute("href");
  expect(expanded).toContain("cover=0");
  expect(expanded).not.toContain("embed=1");
  await expect(
    page.frameLocator("iframe[title=visor2]").locator(".annotation-layer"),
  ).toHaveCount(1);
  await viewer
    .getByRole("button", { name: "Pantalla completa", exact: true })
    .click();
  await expect(
    viewer.getByRole("button", {
      name: "Sortir de pantalla completa",
      exact: true,
    }),
  ).toBeVisible();
  await viewer
    .getByRole("button", { name: "Sortir de pantalla completa", exact: true })
    .click();
  await expect
    .poll(() =>
      viewer
        .locator(".reading-area")
        .evaluate(
          (el) =>
            el.scrollWidth <= el.clientWidth + 2 &&
            el.scrollHeight <= el.clientHeight + 2,
        ),
    )
    .toBe(true);
  await expect(viewer.locator(".page-loading")).toHaveCount(0);
  await page.screenshot({ path: "test-results/embed.png" });
});
test("enllaç directe sense portada i error de llibre inexistent", async ({
  page,
  request,
}) => {
  const books = await (await request.get("/library.json")).json();
  await page.goto(
    "/?" +
      new URLSearchParams({
        book: books[0].id,
        view: "double",
        cover: "0",
        embed: "1",
      }),
  );
  await expect(page.locator(".annotation-layer")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Pàgina següent", exact: true })
    .click();
  await expect(page.locator(".annotation-layer")).toHaveCount(1);
  await expect(page.locator(".annotation-layer")).toHaveAttribute(
    "data-page",
    "3",
  );
  await page.goto("/?book=missing&embed=1");
  await expect(page.getByRole("heading")).toContainText("no és al catàleg");
});
