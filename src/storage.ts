import type { Work } from "./model";
let dbPromise: Promise<IDBDatabase>;
function db() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const r = indexedDB.open("fulla-library", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("work", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function readWorks(): Promise<Work[]> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction("work").objectStore("work").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
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
