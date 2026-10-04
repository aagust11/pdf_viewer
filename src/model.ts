export type Point = { x: number; y: number };
export type Kind =
  | "highlight"
  | "pen"
  | "marker"
  | "arrow"
  | "line"
  | "rect"
  | "ellipse"
  | "text"
  | "note";
export type Annotation = {
  id: string;
  page: number;
  kind: Kind;
  color: string;
  width: number;
  opacity: number;
  fontSize: number;
  points: Point[];
  rects?: { x: number; y: number; w: number; h: number }[];
  text?: string;
  quote?: string;
  scaleX?: number;
  scaleY?: number;
  updatedAt: string;
};
export type Work = {
  id: string;
  title: string;
  page: number;
  annotations: Annotation[];
  updatedAt: string;
};
export type Book = {
  local?: boolean;
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  order: number;
  size: number;
};
export type Backup = {
  format: "fulla-annotations";
  version: 1;
  exportedAt: string;
  documents: Work[];
};
export const blankWork = (b: Pick<Book, "id" | "title">): Work => ({
  ...b,
  page: 1,
  annotations: [],
  updatedAt: new Date().toISOString(),
});
export function parseBackup(value: unknown): Backup {
  const fail = () => {
    throw new Error(
      "El JSON no és una còpia vàlida de Fulla. No s’ha modificat cap dada.",
    );
  };
  if (!value || typeof value !== "object") return fail();
  const b = value as Backup;
  if (
    b.format !== "fulla-annotations" ||
    b.version !== 1 ||
    !Array.isArray(b.documents) ||
    b.documents.length > 10000
  )
    return fail();
  const str = (v: unknown, max = 10000): v is string =>
    typeof v === "string" && v.length <= max;
  const num = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  const ids = new Set<string>();
  for (const w of b.documents) {
    if (
      !w ||
      !str(w.id, 150) ||
      !/^sha256:[a-f0-9]{64}$/.test(w.id) ||
      ids.has(w.id) ||
      !str(w.title) ||
      !Number.isInteger(w.page) ||
      w.page < 1 ||
      !str(w.updatedAt, 50) ||
      !Number.isFinite(Date.parse(w.updatedAt)) ||
      !Array.isArray(w.annotations) ||
      w.annotations.length > 50000
    )
      return fail();
    ids.add(w.id);
    const aids = new Set<string>();
    for (const a of w.annotations) {
      if (
        !a ||
        !str(a.id, 150) ||
        aids.has(a.id) ||
        ![
          "highlight",
          "pen",
          "marker",
          "arrow",
          "line",
          "rect",
          "ellipse",
          "text",
          "note",
        ].includes(a.kind) ||
        !Number.isInteger(a.page) ||
        a.page < 1 ||
        !/^#[a-f0-9]{6}$/i.test(a.color) ||
        !num(a.width, 0.1, 100) ||
        !num(a.opacity, 0.01, 1) ||
        !num(a.fontSize, 6, 120) ||
        !str(a.updatedAt, 50) ||
        !Number.isFinite(Date.parse(a.updatedAt)) ||
        !Array.isArray(a.points) ||
        a.points.length < 1 ||
        a.points.length > 50000
      )
        return fail();
      if (
        (a.scaleX !== undefined && !num(a.scaleX, 0.05, 20)) ||
        (a.scaleY !== undefined && !num(a.scaleY, 0.05, 20))
      )
        return fail();
      aids.add(a.id);
      if (a.points.some((p) => !p || !num(p.x, -10, 10) || !num(p.y, -10, 10)))
        return fail();
      if (a.text !== undefined && !str(a.text)) return fail();
      if (a.quote !== undefined && !str(a.quote, 100000)) return fail();
      if (["text", "note"].includes(a.kind) && !str(a.text)) return fail();
      if (
        ["arrow", "line", "rect", "ellipse"].includes(a.kind) &&
        a.points.length !== 2
      )
        return fail();
      if (
        a.kind === "highlight" &&
        (!Array.isArray(a.rects) ||
          a.rects.length === 0 ||
          a.rects.length > 10000)
      )
        return fail();
      if (
        a.rects !== undefined &&
        (!Array.isArray(a.rects) ||
          a.rects.some(
            (r) =>
              !r ||
              !num(r.x, -10, 10) ||
              !num(r.y, -10, 10) ||
              !num(r.w, 0, 10) ||
              !num(r.h, 0, 10),
          ))
      )
        return fail();
    }
  }
  return b;
}
export function mergeWorks(
  local: Work[],
  incoming: Work[],
  replace: boolean,
): Work[] {
  const map = new Map(local.map((w) => [w.id, w]));
  for (const w of incoming) {
    const old = map.get(w.id);
    if (!old || replace) {
      map.set(w.id, w);
      continue;
    }
    const anns = new Map(old.annotations.map((a) => [a.id, a]));
    for (const a of w.annotations) {
      const prior = anns.get(a.id);
      if (!prior || a.updatedAt > prior.updatedAt) anns.set(a.id, a);
    }
    map.set(w.id, {
      ...(w.updatedAt > old.updatedAt ? w : old),
      annotations: [...anns.values()],
    });
  }
  return [...map.values()];
}
export function download(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
}
