import type { Book, Work } from "./model";
let dbPromise: Promise<IDBDatabase>;
function db() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const r = indexedDB.open("fulla-library", 2);
    r.onupgradeneeded = () => {
      for (const name of ["work", "books", "pdfs"])
        if (!r.result.objectStoreNames.contains(name))
          r.result.createObjectStore(name, { keyPath: "id" });
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () =>
      reject(
        new Error("Tanca les altres pestanyes de Fulla i torna-ho a provar."),
      );
  }));
}
async function all<T>(store: string): Promise<T[]> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export const readWorks = () => all<Work>("work");
export const readLocalBooks = () => all<Book>("books");
export async function readLocalPdf(id: string): Promise<Blob> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction("pdfs").objectStore("pdfs").get(id);
    r.onsuccess = () =>
      r.result?.blob
        ? resolve(r.result.blob)
        : reject(
            new Error(
              "No es troba el PDF local. Torna a afegir el mateix fitxer per recuperar les anotacions.",
            ),
          );
    r.onerror = () => reject(r.error);
  });
}
export async function putLocalBook(book: Book, blob: Blob) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    // Metadata and bytes must be committed together: no broken library entries.
    const tx = d.transaction(["books", "pdfs"], "readwrite");
    tx.objectStore("books").put(book);
    tx.objectStore("pdfs").put({ id: book.id, blob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function putWorks(works: Work[]) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction("work", "readwrite");
    for (const w of works) tx.objectStore("work").put(w);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
