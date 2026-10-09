import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfjs, pdfOptions } from "./pdf";
import { blankWork, type Book, type Work } from "./model";
import { Reader } from "./Reader";
import { urlOptions } from "./reading";
// Public embedded readers deliberately do not access IndexedDB or the editor lock.
// Multiple embedded books work even if third-party browser storage is unavailable.
export function LinkedReader() {
  const [loaded, setLoaded] = useState<{
      book: Book;
      pdf: PDFDocumentProxy;
      work: Work;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof pdfjs.getDocument> | undefined;
    (async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}library.json`);
      if (!response.ok) throw new Error("No s’ha pogut carregar el catàleg.");
      const books: Book[] = await response.json();
      const q = new URLSearchParams(location.search);
      const book = books.find((b) => b.id === q.get("book"));
      if (!book)
        throw new Error(
          "Aquest llibre no és al catàleg publicat. Demana un codi d’inserció actualitzat.",
        );
      if (cancelled) return;
      task = pdfjs.getDocument({
        ...pdfOptions,
        url: `${import.meta.env.BASE_URL}${book.url}`,
      });
      const pdf = await task.promise;
      if (cancelled) return;
      const page = Math.max(
        1,
        Math.min(pdf.numPages, Number(q.get("page")) || 1),
      );
      setLoaded({
        book,
        pdf,
        work: { ...blankWork(book), page: Math.floor(page) },
      });
    })().catch((e) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, []);
  if (!loaded)
    return (
      <main className="linked-loading">
        <h1>{error || "Obrint el llibre…"}</h1>
        {error && (
          <a
            href={import.meta.env.BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Obrir la biblioteca
          </a>
        )}
      </main>
    );
  return (
    <>
      <Reader
        pdf={loaded.pdf}
        book={loaded.book}
        work={loaded.work}
        onUpdate={(work) => setLoaded((old) => (old ? { ...old, work } : old))}
        onBack={() => {
          location.href = import.meta.env.BASE_URL;
        }}
        onExport={() => {}}
        onImport={() => {}}
        status=""
        onError={setError}
        embedded
        initialOptions={urlOptions(loaded.book.reading)}
      />
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError("")}>Tancar</button>
        </div>
      )}
    </>
  );
}
