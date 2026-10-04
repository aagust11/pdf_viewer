import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  MousePointer2,
  Highlighter,
  Pencil,
  MoveUpRight,
  Minus,
  Square,
  Circle,
  Type,
  StickyNote,
  Eraser,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  Maximize,
  PanelLeft,
  BookOpen,
  Download,
  Trash2,
  Check,
  MousePointer,
  Edit3,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Page, type Tool, type Settings } from "./Page";
import { Thumbnail } from "./Thumbnail";
import type { Annotation, Book, Work } from "./model";
const tools: [Tool, string, typeof Pencil][] = [
  ["read", "Llegir", MousePointer],
  ["select", "Seleccionar", MousePointer2],
  ["highlight", "Subratllar text", Highlighter],
  ["marker", "Marcador lliure", Edit3],
  ["pen", "Llapis", Pencil],
  ["arrow", "Fletxa", MoveUpRight],
  ["line", "Línia", Minus],
  ["rect", "Rectangle", Square],
  ["ellipse", "Cercle", Circle],
  ["text", "Text", Type],
  ["note", "Nota", StickyNote],
  ["erase", "Esborrar", Eraser],
];
const hints: Record<Tool, string> = {
  read: "Selecciona i copia text, o navega pel document.",
  select: "Clica una anotació per seleccionar-la. Arrossega-la per moure-la.",
  highlight: "Arrossega sobre el text per subratllar-lo.",
  marker: "Marca lliurement, també en documents escanejats.",
  pen: "Dibuixa amb el ratolí, el dit o el llapis digital.",
  arrow: "Arrossega des de l’origen fins a la punta de la fletxa.",
  line: "Arrossega per dibuixar una línia.",
  rect: "Arrossega per dibuixar un rectangle.",
  ellipse: "Arrossega per dibuixar un cercle.",
  text: "Clica al lloc on vols escriure.",
  note: "Clica per afegir una nota.",
  erase: "Clica una anotació per eliminar-la.",
};
export function Reader({
  pdf,
  book,
  work,
  onUpdate,
  onBack,
  onExport,
  onImport,
  status,
  onError,
}: {
  pdf: PDFDocumentProxy;
  book: Book;
  work: Work;
  onUpdate: (w: Work) => void;
  onBack: () => void;
  onExport: () => void;
  onImport: () => void;
  status: string;
  onError: (s: string) => void;
}) {
  const [tool, setTool] = useState<Tool>("read");
  const [settings, setSettings] = useState<Settings>({
    color: "#dc9d16",
    width: 2.5,
    opacity: 1,
    fontSize: 16,
  });
  const [zoom, setZoom] = useState(1),
    [spread, setSpread] = useState(false),
    [thumbs, setThumbs] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<Annotation | null>(null),
    [busy, setBusy] = useState("");
  const [undo, setUndo] = useState<Annotation[][]>([]),
    [redo, setRedo] = useState<Annotation[][]>([]);
  const area = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(1000);
  const page = Math.min(pdf.numPages, Math.max(1, work.page));
  useEffect(() => {
    const o = new ResizeObserver((es) => setAvailable(es[0].contentRect.width));
    o.observe(area.current!);
    return () => o.disconnect();
  }, []);
  const width =
    Math.max(
      180,
      Math.min(900, (available - (spread ? 72 : 48)) / (spread ? 2 : 1)),
    ) * zoom;
  function commit(annotations: Annotation[]) {
    setUndo((u) => [...u, work.annotations].slice(-80));
    setRedo([]);
    onUpdate({ ...work, annotations, updatedAt: new Date().toISOString() });
  }
  function undoAction() {
    if (!undo.length) return;
    setRedo((r) => [...r, work.annotations]);
    const prev = undo[undo.length - 1];
    setUndo(undo.slice(0, -1));
    onUpdate({
      ...work,
      annotations: prev,
      updatedAt: new Date().toISOString(),
    });
    setSelected(null);
  }
  function redoAction() {
    if (!redo.length) return;
    setUndo((u) => [...u, work.annotations]);
    const next = redo[redo.length - 1];
    setRedo(redo.slice(0, -1));
    onUpdate({
      ...work,
      annotations: next,
      updatedAt: new Date().toISOString(),
    });
  }
  const change = (a: Annotation) =>
    commit(work.annotations.map((old) => (old.id === a.id ? a : old)));
  const del = (id: string) => {
    commit(work.annotations.filter((a) => a.id !== id));
    setSelected(null);
  };
  function go(n: number) {
    onUpdate({
      ...work,
      page: Math.max(1, Math.min(pdf.numPages, n)),
      updatedAt: new Date().toISOString(),
    });
    setSelected(null);
    area.current?.scrollTo({ top: 0 });
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement).matches("input,textarea,select") || editing)
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redoAction() : undoAction();
      } else if (e.key === "Delete" && selected) del(selected);
      else if (e.key === "ArrowRight") go(page + (spread ? 2 : 1));
      else if (e.key === "ArrowLeft") go(page - (spread ? 2 : 1));
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const selectedA = work.annotations.find((a) => a.id === selected);
  function styleChange(patch: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...patch }));
    if (selectedA)
      change({ ...selectedA, ...patch, updatedAt: new Date().toISOString() });
  }
  async function exportAnnotated() {
    setBusy("Preparant PDF…");
    try {
      const { exportPdf } = await import("./exportPdf");
      await exportPdf(pdf, work, setBusy);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="reader">
      <header className="reader-header">
        <button
          className="icon-button"
          onClick={onBack}
          aria-label="Tornar a la biblioteca"
        >
          <ArrowLeft />
        </button>
        <div className="reader-title">
          <small>FULLA / LECTURA</small>
          <h1>{book.title}</h1>
        </div>
        <span className="save-state">
          <Check size={14} />
          {status}
        </span>
        <button onClick={onImport} className="text-button">
          Importar JSON
        </button>
        <button className="primary small" onClick={onExport}>
          <Download size={16} />
          Exportar JSON
        </button>
      </header>
      <div className="toolbar" aria-label="Eines d’anotació">
        <div className="tool-group">
          {tools.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={label}
              title={label}
              aria-pressed={tool === id}
              className={tool === id ? "tool active" : "tool"}
              onClick={() => {
                setTool(id);
                setSelected(null);
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="tool-group">
          <button
            className="tool"
            onClick={undoAction}
            disabled={!undo.length}
            aria-label="Desfer"
            title="Desfer (Ctrl+Z)"
          >
            <Undo2 size={19} />
          </button>
          <button
            className="tool"
            onClick={redoAction}
            disabled={!redo.length}
            aria-label="Refer"
            title="Refer (Ctrl+Maj+Z)"
          >
            <Redo2 size={19} />
          </button>
        </div>
        <div className="style-controls">
          <label title="Color">
            Color{" "}
            <input
              aria-label="Color"
              type="color"
              value={selectedA?.color || settings.color}
              onChange={(e) => styleChange({ color: e.target.value })}
            />
          </label>
          <label>
            Gruix{" "}
            <select
              aria-label="Gruix"
              value={selectedA?.width || settings.width}
              onChange={(e) => styleChange({ width: Number(e.target.value) })}
            >
              {[1, 2.5, 5, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Opacitat{" "}
            <select
              aria-label="Opacitat"
              value={selectedA?.opacity || settings.opacity}
              onChange={(e) => styleChange({ opacity: Number(e.target.value) })}
            >
              {[0.2, 0.35, 0.4, 0.6, 1].map((n) => (
                <option key={n} value={n}>
                  {Math.round(n * 100)}%
                </option>
              ))}
            </select>
          </label>
          <label>
            Text{" "}
            <select
              aria-label="Mida del text"
              value={selectedA?.fontSize || settings.fontSize}
              onChange={(e) =>
                styleChange({ fontSize: Number(e.target.value) })
              }
            >
              {[12, 16, 20, 28, 36].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="reader-hint">
        <span>{hints[tool]}</span>
        {selectedA && (
          <div>
            <button onClick={() => setEditing({ ...selectedA })}>Editar</button>
            <button onClick={() => del(selectedA.id)}>
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        )}
      </div>
      <div className="reader-body">
        {thumbs && (
          <aside className="thumbnails" aria-label="Pàgines">
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <button
                key={i}
                className={page === i + 1 ? "current" : ""}
                onClick={() => go(i + 1)}
                aria-label={`Anar a la pàgina ${i + 1}`}
              >
                <Thumbnail pdf={pdf} number={i + 1} />
                <span>{i + 1}</span>
              </button>
            ))}
          </aside>
        )}
        <div className="reading-area" ref={area}>
          <div className="pages">
            {[page, ...(spread && page < pdf.numPages ? [page + 1] : [])].map(
              (n) => (
                <Page
                  key={n}
                  pdf={pdf}
                  number={n}
                  width={width}
                  annotations={work.annotations}
                  settings={settings}
                  tool={tool}
                  onAdd={(a) => commit([...work.annotations, a])}
                  onChange={change}
                  onDelete={del}
                  onSelect={setSelected}
                  selected={selected}
                  onError={onError}
                  onEdit={setEditing}
                />
              ),
            )}
          </div>
        </div>
      </div>
      <footer className="reader-footer">
        <div>
          <button
            className="icon-button"
            aria-label="Miniatures"
            title="Miniatures"
            aria-pressed={thumbs}
            onClick={() => setThumbs(!thumbs)}
          >
            <PanelLeft size={19} />
          </button>
          <button
            className="icon-button"
            aria-label="Dues pàgines"
            title="Dues pàgines"
            aria-pressed={spread}
            onClick={() => setSpread(!spread)}
          >
            <BookOpen size={19} />
          </button>
        </div>
        <div className="pagination">
          <button
            className="icon-button"
            aria-label="Pàgina anterior"
            disabled={page === 1}
            onClick={() => go(page - (spread ? 2 : 1))}
          >
            <ChevronLeft size={19} />
          </button>
          <label>
            <input
              key={page}
              aria-label="Número de pàgina"
              type="number"
              min="1"
              max={pdf.numPages}
              defaultValue={page}
              onBlur={(e) => go(Number(e.target.value) || 1)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
            <span> / {pdf.numPages}</span>
          </label>
          <button
            className="icon-button"
            aria-label="Pàgina següent"
            disabled={page + (spread ? 1 : 0) >= pdf.numPages}
            onClick={() => go(page + (spread ? 2 : 1))}
          >
            <ChevronRight size={19} />
          </button>
        </div>
        <div className="view-controls">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            aria-label="Reduir zoom"
          >
            −
          </button>
          <button onClick={() => setZoom(1)} title="Ajustar a l’amplada">
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
            aria-label="Ampliar zoom"
          >
            +
          </button>
          <button
            className="icon-button"
            aria-label="Pantalla completa"
            onClick={() => {
              (document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen()
              ).catch(() =>
                onError("El navegador no permet activar la pantalla completa."),
              );
            }}
          >
            <Maximize size={17} />
          </button>
          <button
            onClick={exportAnnotated}
            disabled={!!busy}
            className="text-button"
          >
            PDF anotat <Download size={15} />
          </button>
        </div>
      </footer>
      {editing && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              const a = { ...editing, updatedAt: new Date().toISOString() };
              if (work.annotations.some((x) => x.id === a.id)) change(a);
              else commit([...work.annotations, a]);
              setEditing(null);
            }}
          >
            <small>ANOTACIÓ · PÀGINA {editing.page}</small>
            <h2>
              {editing.kind === "note"
                ? "La teva nota"
                : editing.kind === "text"
                  ? "Escriu al document"
                  : "Editar anotació"}
            </h2>
            {["text", "note"].includes(editing.kind) && (
              <textarea
                autoFocus
                aria-label="Contingut de l’anotació"
                required
                maxLength={10000}
                rows={5}
                value={editing.text || ""}
                onChange={(e) =>
                  setEditing({ ...editing, text: e.target.value })
                }
                placeholder="Escriu aquí…"
              />
            )}
            <label>
              Color{" "}
              <input
                type="color"
                value={editing.color}
                onChange={(e) =>
                  setEditing({ ...editing, color: e.target.value })
                }
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setEditing(null)}>
                Cancel·lar
              </button>
              <button type="submit" className="primary">
                Desar anotació <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
      {busy && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>{busy}</h2>
            <p>
              El PDF exportat tindrà les anotacions incorporades com a imatge.
              Conserva el JSON per poder-les editar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
