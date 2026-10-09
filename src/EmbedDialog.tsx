import { useState } from "react";
import type { Book } from "./model";
import { bookUrl } from "./reading";
export function EmbedDialog({
  book,
  onClose,
}: {
  book: Book;
  onClose: () => void;
}) {
  const [spread, setSpread] = useState(book.reading?.spread ?? true),
    [cover, setCover] = useState(book.reading?.cover ?? true),
    [height, setHeight] = useState(650),
    [copied, setCopied] = useState(false);
  const url = bookUrl(book.id, { spread, cover });
  const escape = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const code = `<iframe src="${escape(url)}" title="${escape(book.title)}" width="100%" height="${height}" style="border:0;" loading="lazy" allow="fullscreen" allowfullscreen></iframe>`;
  return (
    <div className="modal-backdrop">
      <section
        className="modal embed-dialog"
        role="dialog"
        aria-label="Inserir el llibre"
      >
        <h2>Inserir el llibre</h2>
        <p>{book.title}</p>
        <div className="embed-options">
          <label>
            Vista inicial{" "}
            <select
              aria-label="Vista inicial"
              value={spread ? "double" : "single"}
              onChange={(e) => {
                setSpread(e.target.value === "double");
                setCopied(false);
              }}
            >
              <option value="single">Una pàgina</option>
              <option value="double">Doble pàgina</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={cover}
              onChange={(e) => {
                setCover(e.target.checked);
                setCopied(false);
              }}
            />{" "}
            Primera pàgina com a portada sola
          </label>
          <label>
            Alçada del visor{" "}
            <input
              aria-label="Alçada del visor"
              type="number"
              min={300}
              max={1600}
              value={height}
              onChange={(e) => {
                setHeight(
                  Math.max(300, Math.min(1600, Number(e.target.value) || 650)),
                );
                setCopied(false);
              }}
            />{" "}
            px
          </label>
        </div>
        <p>
          {spread
            ? cover
              ? "Portada: 1 · Després: 2–3, 4–5…"
              : "Pàgines: 1–2, 3–4, 5–6…"
            : "Es mostrarà una pàgina cada vegada."}
        </p>
        <label>
          Codi d’inserció
          <textarea
            aria-label="Codi d’inserció"
            readOnly
            rows={5}
            value={code}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <p>
          A Google Sites: <b>Insereix → Insereix → Insereix codi</b>. Enganxa
          aquest codi i ajusta l’alçada del bloc.
        </p>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Previsualitzar el visor ↗
        </a>
        <div className="modal-actions">
          <button onClick={onClose}>Tancar</button>
          <button
            className="primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setCopied(true);
              } catch {
                const area = document.querySelector<HTMLTextAreaElement>(
                  'textarea[aria-label="Codi d’inserció"]',
                );
                area?.focus();
                area?.select();
              }
            }}
          >
            {copied ? "Copiat!" : "Copiar codi"}
          </button>
        </div>
        <small>
          La configuració viatja amb el codi. Només els PDFs publicats es poden
          inserir. Si Google Sites limita la pantalla completa, «Ampliar visor»
          l’obre en una pestanya nova.
        </small>
      </section>
    </div>
  );
}
