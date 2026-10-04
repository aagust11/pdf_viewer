import { readdir, readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = "public/pdfs";
await mkdir(root, { recursive: true });
async function scan(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const lists = await Promise.all(
    entries.map((e) =>
      e.isDirectory()
        ? scan(path.join(dir, e.name))
        : e.name.toLowerCase().endsWith(".pdf")
          ? [path.join(dir, e.name)]
          : [],
    ),
  );
  return lists.flat();
}
const books = [];
for (const file of await scan(root)) {
  const bytes = await readFile(file);
  let meta = {};
  try {
    meta = JSON.parse(await readFile(file.replace(/\.pdf$/i, ".json"), "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const relative = path.relative(root, file).split(path.sep).join("/");
  const id = "sha256:" + createHash("sha256").update(bytes).digest("hex");
  if (books.some((b) => b.id === id)) continue;
  books.push({
    id,
    title:
      meta.title ||
      path
        .basename(file)
        .replace(/\.pdf$/i, "")
        .replace(/[_-]/g, " "),
    description: meta.description || "",
    category:
      meta.category ||
      (relative.includes("/") ? relative.split("/")[0] : "General"),
    order: meta.order ?? 100,
    url: "pdfs/" + relative.split("/").map(encodeURIComponent).join("/"),
    size: bytes.length,
  });
}
books.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ca"));
await writeFile("public/library.json", JSON.stringify(books, null, 2));
for (const dir of ["cmaps", "standard_fonts", "wasm"])
  await cp(`node_modules/pdfjs-dist/${dir}`, `public/pdfjs/${dir}`, {
    recursive: true,
  });
console.log(`Catàleg generat: ${books.length} documents.`);
