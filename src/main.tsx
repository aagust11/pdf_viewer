import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  ArrowUpRight,
  Search,
  Download,
  Upload,
  Plus,
  Check,
  Library,
  FileText,
  X,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfjs, pdfOptions } from "./pdf";
import {
  type Book,
  type Work,
  type Backup,
  blankWork,
  parseBackup,
  mergeWorks,
  download,
} from "./model";
import { readWorks, putWorks } from "./storage";
import { Thumbnail } from "./Thumbnail";
import { Reader } from "./Reader";
import "pdfjs-dist/web/pdf_viewer.css";
import "./style.css";
function App() {
  const [books, setBooks] = useState<Book[]>([]),
    [works, setWorks] = useState<Work[]>([]),
    [active, setActive] = useState<{
      book: Book;
      pdf: PDFDocumentProxy;
    } | null>(null);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Tots"),
    [status, setStatus] = useState("Desat al navegador"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(""),
    [ready, setReady] = useState(false),
    [locked, setLocked] = useState(false),
    [pending, setPending] = useState<Backup | null>(null),
    [help, setHelp] = useState(false),
    [lastExport, setLastExport] = useState(""),
    [catalogError, setCatalogError] = useState(false);
  const jsonInput = useRef<HTMLInputElement>(null),
    pdfInput = useRef<HTMLInputElement>(null);
  const current = useRef<Work[]>([]),
    queue = useRef(Promise.resolve()),
    saveCount = useRef(0),
    loadToken = useRef(0);
  useEffect(() => {
    let release: () => void = () => {};
    let stopped = false;
    const initialize = async () => {
      try {
        const w = await readWorks();
        if (stopped) return;
        current.current = w;
        setWorks(w);
        setReady(true);
      } catch {
        setError(
          "No es pot accedir al desament del navegador. Pots treballar i exportar el JSON, però no es desarà automàticament.",
        );
        setReady(true);
        setStatus("Desament no disponible");
      }
    };
    if (navigator.locks)
      navigator.locks.request(
        "fulla-single-writer",
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            setLocked(true);
            return;
          }
          await initialize();
          await new Promise<void>((r) => {
            release = r;
            if (stopped) r();
          });
        },
      );
    else initialize();
    fetch(`${import.meta.env.BASE_URL}library.json`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setBooks)
      .catch(() => {
        setCatalogError(true);
        setError(
          "No s’ha pogut carregar el catàleg. Recarrega la pàgina o obre un PDF del teu ordinador.",
        );
      });
    try {
      setLastExport(localStorage.getItem("fulla-last-export") || "");
    } catch {}
    function before(e: BeforeUnloadEvent) {
      if (saveCount.current > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", before);
    return () => {
      stopped = true;
      release();
      window.removeEventListener("beforeunload", before);
    };
  }, []);
  function persist(all: Work[], changed: Work[]) {
    current.current = all;
    setWorks(all);
    setStatus("Desant…");
    saveCount.current++;
    queue.current = queue.current
      .then(() => putWorks(changed))
      .then(() => {
        saveCount.current--;
        if (!saveCount.current) setStatus("Desat al navegador");
      })
      .catch(() => {
        saveCount.current--;
        setStatus("Error de desament");
        setError(
          "No s’han pogut desar les últimes modificacions. Exporta el JSON ara per conservar-les.",
        );
      });
  }
  function update(w: Work) {
    const all = [...current.current.filter((x) => x.id !== w.id), w];
    persist(all, [w]);
  }
  async function open(book: Book, data?: Uint8Array) {
    const token = ++loadToken.current;
    setLoading("Obrint document…");
    let task: ReturnType<typeof pdfjs.getDocument> | undefined;
    try {
      task = pdfjs.getDocument({
        ...pdfOptions,
        ...(data
          ? { data }
          : { url: `${import.meta.env.BASE_URL}${book.url}` }),
      });
      const pdf = await task.promise;
      if (token !== loadToken.current) {
        await pdf.destroy();
        return;
      }
      if (!current.current.some((w) => w.id === book.id))
        update(blankWork(book));
      setActive({ book, pdf });
    } catch (e) {
      await task?.destroy();
      setError(
        "No s’ha pogut obrir el PDF. " +
          (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      if (token === loadToken.current) setLoading("");
    }
  }
  async function localPdf(file: File) {
    setLoading("Llegint PDF…");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const id =
        "sha256:" +
        Array.from(new Uint8Array(hash), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
      await open(
        {
          id,
          title: file.name.replace(/\.pdf$/i, ""),
          description: "",
          category: "Local",
          url: "",
          order: 0,
          size: file.size,
        },
        bytes,
      );
    } catch {
      setLoading("");
      setError("No s’ha pogut llegir aquest fitxer PDF.");
    }
  }
  function exportJson() {
    const backup: Backup = {
      format: "fulla-annotations",
      version: 1,
      exportedAt: new Date().toISOString(),
      documents: current.current,
    };
    download(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
      "fulla-anotacions.json",
    );
    setLastExport(backup.exportedAt);
    try {
      localStorage.setItem("fulla-last-export", backup.exportedAt);
    } catch {}
  }
  async function readImport(file: File) {
    try {
      if (file.size > 50 * 1024 * 1024)
        throw new Error("El JSON supera el límit de 50 MB.");
      setPending(parseBackup(JSON.parse(await file.text())));
    } catch (e) {
      setError(e instanceof Error ? e.message : "El JSON no és vàlid.");
    }
  }
  function importJson(replace: boolean) {
    if (!pending) return;
    const all = mergeWorks(current.current, pending.documents, replace);
    persist(all, all);
    setPending(null);
  }
  const shown = books.filter(
    (b) =>
      (category === "Tots" || b.category === category) &&
      `${b.title} ${b.description}`
        .toLocaleLowerCase("ca")
        .includes(query.toLocaleLowerCase("ca")),
  );
  const count = works.reduce((n, w) => n + w.annotations.length, 0);
  const activeWork = active && works.find((w) => w.id === active.book.id);
  return (
    <>
      {locked ? (
        <main className="locked">
          <BookOpen size={40} />
          <h1>Fulla ja està oberta en una altra pestanya</h1>
          <p>
            Continua allà per evitar que dues pestanyes sobreescriguin les
            anotacions. Si l’has tancat, recarrega aquesta pàgina.
          </p>
          <button className="primary" onClick={() => location.reload()}>
            Tornar-ho a provar
          </button>
        </main>
      ) : (
        <>
          {active && activeWork ? (
            <Reader
              key={active.book.id}
              pdf={active.pdf}
              book={active.book}
              work={activeWork}
              onUpdate={update}
              onBack={() => {
                const pdf = active.pdf;
                setActive(null);
                setTimeout(() => pdf.destroy(), 0);
              }}
              onExport={exportJson}
              onImport={() => jsonInput.current?.click()}
              status={status}
              onError={setError}
            />
          ) : (
            <div className="library-shell">
              <header className="site-header">
                <a className="brand" href="./" aria-label="Fulla · inici">
                  <span className="brand-icon">
                    <BookOpen size={24} />
                  </span>
                  fulla<span className="brand-dot">.</span>
                </a>
                <span className="header-label">LA TEVA BIBLIOTECA DIGITAL</span>
                <nav>
                  <button className="text-button" onClick={() => setHelp(true)}>
                    Com funciona <ArrowUpRight size={15} />
                  </button>
                  <span className="local-badge">
                    <span />
                    Sense registre
                  </span>
                </nav>
              </header>
              <main className="library-main">
                <section className="hero">
                  <div className="hero-copy">
                    <span className="eyebrow">
                      <span />
                      UN ESPAI PER LLEGIR I PENSAR
                    </span>
                    <h1>
                      Les pàgines, obertes.
                      <br />
                      <em>Les idees, teves.</em>
                    </h1>
                    <p>
                      Llegeix, subratlla i connecta idees. Fes teu cada
                      document, al teu ritme i sense crear cap compte.
                    </p>
                    <button
                      className="primary"
                      disabled={!ready}
                      onClick={() => pdfInput.current?.click()}
                    >
                      <Plus size={19} />
                      Obrir un PDF local <ArrowUpRight size={17} />
                    </button>
                    <span className="local-caption">
                      Només el veuràs tu. No es publica ni s’envia.
                    </span>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="art-orbit" />
                    <div className="art-page back" />
                    <div className="art-page front">
                      <div className="art-kicker">
                        QUADERN D’IDEES <span>01</span>
                      </div>
                      <h2>
                        Una lectura.
                        <br />
                        Moltes mirades.
                      </h2>
                      <div className="art-lines">
                        <i />
                        <i />
                        <i className="marked" />
                        <i />
                        <i />
                      </div>
                      <svg viewBox="0 0 200 90">
                        <path
                          d="M20 25 C80 80 125 0 174 50 M152 46 L176 53 L175 29"
                          fill="none"
                          stroke="#bc623e"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="art-footer">
                        LLEGIR · CONNECTAR · CREAR
                      </div>
                    </div>
                    <div className="art-note">
                      Aquí comença
                      <br />
                      una bona idea.
                    </div>
                    <span className="art-star">✳</span>
                  </div>
                </section>
                <section className="collection">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">ELS DOCUMENTS</span>
                      <h2>
                        La biblioteca{" "}
                        <span>{books.length.toString().padStart(2, "0")}</span>
                      </h2>
                    </div>
                    <label className="search">
                      <Search size={18} />
                      <input
                        aria-label="Cercar documents"
                        placeholder="Cerca un títol o una idea…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="collection-controls">
                    <div className="categories">
                      {["Tots", ...new Set(books.map((b) => b.category))].map(
                        (c) => (
                          <button
                            key={c}
                            className={category === c ? "chosen" : ""}
                            onClick={() => setCategory(c)}
                          >
                            {c === "Tots" && <Library size={14} />} {c}
                          </button>
                        ),
                      )}
                    </div>
                    <span>
                      {shown.length}{" "}
                      {shown.length === 1 ? "document" : "documents"}
                    </span>
                  </div>
                  <div className="book-grid">
                    {shown.map((b, i) => {
                      const work = works.find((w) => w.id === b.id);
                      return (
                        <button
                          className={`book-card tone-${i % 3}`}
                          key={b.id}
                          disabled={!ready}
                          onClick={() => open(b)}
                        >
                          <div className="book-cover">
                            <Thumbnail
                              url={`${import.meta.env.BASE_URL}${b.url}`}
                            />
                            <span className="pdf-tag">
                              PDF · {(b.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                            <span className="open-book">
                              <ArrowUpRight size={22} />
                            </span>
                          </div>
                          <div className="book-meta">
                            <span>{b.category}</span>
                            {!!work?.annotations.length && (
                              <span className="annotation-count">
                                {work.annotations.length} anotacions
                              </span>
                            )}
                          </div>
                          <h3>{b.title}</h3>
                          <p>
                            {b.description ||
                              "Un document per explorar i fer teu."}
                          </p>
                          <div className="book-bottom">
                            <span>
                              {work
                                ? `Continuar · pàgina ${work.page}`
                                : "Començar a llegir"}
                            </span>
                            <ArrowRight size={17} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!shown.length && (
                    <div className="empty">
                      <FileText size={34} />
                      <h3>
                        {catalogError
                          ? "Catàleg no disponible"
                          : books.length
                            ? "No hi ha coincidències"
                            : "La biblioteca està preparada"}
                      </h3>
                      <p>
                        {books.length
                          ? "Prova un altre títol o categoria."
                          : "Afegeix PDFs a public/pdfs/ del repositori o obre un PDF local per començar."}
                      </p>
                    </div>
                  )}
                </section>
                <section className="backup-panel">
                  <div className="backup-icon">
                    <ShieldCheck size={27} />
                  </div>
                  <div className="backup-copy">
                    <h3>Les teves idees es queden amb tu.</h3>
                    <p>
                      {count} anotacions desades en aquest navegador.
                      Exporta-les per continuar en un altre dispositiu.
                    </p>
                    <small>
                      {lastExport
                        ? `Última exportació: ${new Date(lastExport).toLocaleString("ca-ES")}`
                        : "Encara no has exportat cap còpia."}{" "}
                      Si esborres les dades del navegador, pots perdre el
                      treball.
                    </small>
                  </div>
                  <div className="backup-actions">
                    <button
                      disabled={!ready}
                      onClick={() => jsonInput.current?.click()}
                    >
                      <Upload size={16} />
                      Importar JSON
                    </button>
                    <button
                      className="primary"
                      disabled={!ready}
                      onClick={exportJson}
                    >
                      <Download size={16} />
                      Exportar JSON
                    </button>
                  </div>
                </section>
              </main>
              <footer className="site-footer">
                <span className="footer-brand">fulla.</span>
                <span>Una biblioteca oberta. Un espai ben teu.</span>
                <span>
                  <Check size={14} />
                  {status}
                </span>
              </footer>
            </div>
          )}
          <input
            ref={jsonInput}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readImport(f);
              e.target.value = "";
            }}
          />
          <input
            ref={pdfInput}
            hidden
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) localPdf(f);
              e.target.value = "";
            }}
          />
          {pending && (
            <div className="modal-backdrop">
              <div className="modal">
                <span className="eyebrow">RECUPERAR EL TREBALL</span>
                <h2>Importar anotacions</h2>
                <p>
                  {pending.documents.length} documents i{" "}
                  {pending.documents.reduce(
                    (n, w) => n + w.annotations.length,
                    0,
                  )}{" "}
                  anotacions.
                </p>
                <p>
                  <b>Combinar</b> conserva les anotacions locals i evita
                  duplicats. <b>Substituir</b> reemplaça només el treball dels
                  documents inclosos al JSON.
                </p>
                {pending.documents.some(
                  (w) => !books.some((b) => b.id === w.id),
                ) && (
                  <p className="notice">
                    Hi ha documents fora del catàleg. Les anotacions quedaran
                    guardades: obre el mateix PDF local per recuperar-les.
                  </p>
                )}
                <div className="modal-actions">
                  <button onClick={() => setPending(null)}>Cancel·lar</button>
                  <button onClick={() => importJson(true)}>Substituir</button>
                  <button className="primary" onClick={() => importJson(false)}>
                    Combinar
                  </button>
                </div>
              </div>
            </div>
          )}
          {help && (
            <div className="modal-backdrop">
              <div className="modal">
                <button
                  className="close-modal"
                  onClick={() => setHelp(false)}
                  aria-label="Tancar ajuda"
                >
                  <X />
                </button>
                <span className="eyebrow">BENVINGUT A FULLA</span>
                <h2>El teu espai de lectura.</h2>
                <ol>
                  <li>
                    Tria un document de la biblioteca o obre un PDF del teu
                    ordinador.
                  </li>
                  <li>
                    Selecciona una eina: subratllat de text, llapis, fletxes,
                    formes o notes.
                  </li>
                  <li>
                    Les anotacions es desen al navegador. Exporta el JSON com a
                    còpia o per canviar de dispositiu.
                  </li>
                  <li>
                    Importa el JSON i obre el mateix PDF per continuar
                    treballant.
                  </li>
                </ol>
                <p>
                  Els PDF locals no es publiquen. Per afegir documents per a
                  tothom, puja’ls a <code>public/pdfs/</code> del repositori: es
                  publicaran quan acabi el desplegament.
                </p>
                <p>
                  El PDF anotat és una còpia visual per compartir o imprimir; el
                  JSON conserva les anotacions editables.
                </p>
                <button className="primary" onClick={() => setHelp(false)}>
                  Entesos <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
          {loading && (
            <div className="modal-backdrop">
              <div className="modal">
                <h2>{loading}</h2>
              </div>
            </div>
          )}
        </>
      )}
      {error && (
        <div role="alert" className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Tancar avís">
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
