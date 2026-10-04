import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfjs } from "./pdf";
import type { Annotation, Kind, Point } from "./model";
import { Shape } from "./Shapes";
export type Tool = Kind | "select" | "erase" | "read";
export type Settings = {
  color: string;
  width: number;
  opacity: number;
  fontSize: number;
};
export function Page({
  pdf,
  number,
  width,
  annotations,
  tool,
  settings,
  onAdd,
  onChange,
  onDelete,
  onSelect,
  selected,
  onError,
  onEdit,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  width: number;
  annotations: Annotation[];
  tool: Tool;
  settings: Settings;
  onAdd: (a: Annotation) => void;
  onChange: (a: Annotation) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  selected: string | null;
  onError: (s: string) => void;
  onEdit: (a: Annotation) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    text = useRef<HTMLDivElement>(null),
    box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 595, h: 842 });
  const [ready, setReady] = useState(false);
  const [hasText, setHasText] = useState(true);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const gesture = useRef<{
    start: Point;
    original?: Annotation;
    draft: Annotation;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let render:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    let layer: InstanceType<typeof pdfjs.TextLayer> | undefined;
    setReady(false);
    (async () => {
      const page = await pdf.getPage(number);
      if (cancelled) return;
      const original = page.getViewport({ scale: 1 });
      setSize({ w: original.width, h: original.height });
      const scale = width / original.width;
      const vp = page.getViewport({ scale });
      const c = canvas.current!,
        dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.ceil(vp.width * dpr);
      c.height = Math.ceil(vp.height * dpr);
      const ctx = c.getContext("2d")!;
      render = page.render({
        canvasContext: ctx,
        canvas: c,
        viewport: vp,
        transform: [dpr, 0, 0, dpr, 0, 0],
      });
      await render.promise;
      if (cancelled) return;
      const content = await page.getTextContent();
      if (cancelled) return;
      setHasText(content.items.length > 0);
      text.current!.replaceChildren();
      text.current!.style.setProperty("--scale-factor", String(scale));
      text.current!.style.setProperty("--total-scale-factor", String(scale));
      layer = new pdfjs.TextLayer({
        textContentSource: content,
        container: text.current!,
        viewport: vp,
      });
      await layer.render();
      if (!cancelled) setReady(true);
    })().catch((e) => {
      if (!cancelled && e.name !== "RenderingCancelledException")
        onError("No s’ha pogut mostrar aquesta pàgina. " + e.message);
    });
    return () => {
      cancelled = true;
      render?.cancel();
      layer?.cancel();
    };
  }, [pdf, number, width]);
  function point(e: { clientX: number; clientY: number }): Point {
    const r = box.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  }
  function make(kind: Kind, p: Point): Annotation {
    return {
      id: crypto.randomUUID(),
      page: number,
      kind,
      ...settings,
      opacity:
        kind === "highlight" || kind === "marker"
          ? Math.min(settings.opacity, 0.4)
          : settings.opacity,
      points: [p],
      updatedAt: new Date().toISOString(),
    };
  }
  function selectText() {
    if (tool !== "highlight" || !ready) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!text.current?.contains(range.commonAncestorContainer)) return;
    const b = box.current!.getBoundingClientRect();
    const rects = [...range.getClientRects()]
      .filter((r) => r.width > 1 && r.height > 1)
      .map((r) => ({
        x: (r.left - b.left) / b.width,
        y: (r.top - b.top) / b.height,
        w: r.width / b.width,
        h: r.height / b.height,
      }));
    if (rects.length) {
      const a = make("highlight", { x: rects[0].x, y: rects[0].y });
      a.rects = rects;
      a.quote = sel.toString();
      onAdd(a);
      sel.removeAllRanges();
    }
  }
  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (!ready || ["read", "highlight"].includes(tool)) return;
    const target = (e.target as Element)
      .closest("[data-annotation]")
      ?.getAttribute("data-annotation");
    if (tool === "erase") {
      if (target) onDelete(target);
      return;
    }
    const p = point(e);
    if (tool === "select") {
      if (target) {
        onSelect(target);
        const a = annotations.find((a) => a.id === target)!;
        gesture.current = { start: p, original: a, draft: a };
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (tool === "text" || tool === "note") {
      onEdit(make(tool, p));
      return;
    }
    const a = make(tool as Kind, p);
    if (["line", "arrow", "rect", "ellipse"].includes(tool)) a.points.push(p);
    gesture.current = { start: p, draft: a };
    setDraft(a);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    if (!g) return;
    const p = point(e);
    let a;
    if (g.original) {
      const dx = p.x - g.start.x,
        dy = p.y - g.start.y;
      a = {
        ...g.original,
        points: g.original.points.map((q) => ({ x: q.x + dx, y: q.y + dy })),
        rects: g.original.rects?.map((r) => ({
          ...r,
          x: r.x + dx,
          y: r.y + dy,
        })),
      };
    } else {
      const points = ["pen", "marker"].includes(g.draft.kind)
        ? [...g.draft.points, p]
        : [g.start, p];
      a = { ...g.draft, points };
    }
    g.draft = a;
    setDraft(a);
  }
  function up() {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    setDraft(null);
    const a = { ...g.draft, updatedAt: new Date().toISOString() };
    if (g.original) {
      if (JSON.stringify(a.points) !== JSON.stringify(g.original.points))
        onChange(a);
    } else if (a.points.length > 1) onAdd(a);
  }
  return (
    <div className="page-wrap">
      <div
        className="paper"
        ref={box}
        style={{ width, height: (width * size.h) / size.w }}
        onPointerUp={() => setTimeout(selectText, 0)}
      >
        <canvas ref={canvas} />
        <div
          ref={text}
          className="textLayer"
          style={{
            pointerEvents:
              tool === "highlight" || tool === "read" ? "auto" : "none",
          }}
        />
        <svg
          className="annotation-layer"
          data-page={number}
          viewBox={`0 0 ${size.w} ${size.h}`}
          style={{
            pointerEvents:
              tool === "highlight" || tool === "read" ? "none" : "auto",
            touchAction: ["read", "highlight"].includes(tool) ? "auto" : "none",
          }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            gesture.current = null;
            setDraft(null);
          }}
          onDoubleClick={(e) => {
            const id = (e.target as Element)
              .closest("[data-annotation]")
              ?.getAttribute("data-annotation");
            const a = annotations.find((a) => a.id === id);
            if (a && tool === "select") onEdit(a);
          }}
        >
          {annotations
            .filter((a) => a.page === number && a.id !== draft?.id)
            .map((a) => (
              <g
                key={a.id}
                data-annotation={a.id}
                style={{
                  pointerEvents: ["select", "erase"].includes(tool)
                    ? "all"
                    : "none",
                  cursor: tool === "erase" ? "not-allowed" : "move",
                }}
              >
                <Shape
                  a={a}
                  w={size.w}
                  h={size.h}
                  selected={a.id === selected}
                />
              </g>
            ))}
          {draft && <Shape a={draft} w={size.w} h={size.h} />}
        </svg>
        {!ready && <div className="page-loading">Carregant pàgina…</div>}
      </div>
      <div className="page-caption">
        {number}
        {tool === "highlight" &&
          !hasText &&
          " · PDF sense text seleccionable. Fes servir el marcador lliure."}
      </div>
    </div>
  );
}
