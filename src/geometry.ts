import type { Annotation, Point } from "./model";
export type Bounds = { x: number; y: number; w: number; h: number };
export type Handle = "nw" | "ne" | "sw" | "se" | "start" | "end";
export function resized(
  a: Annotation,
  b: Bounds,
  handle: Handle,
  p: Point,
): Annotation {
  if (handle === "start" || handle === "end") {
    const points = a.points.map((q) => ({ ...q }));
    points[handle === "start" ? 0 : points.length - 1] = p;
    return { ...a, points };
  }
  const anchor = {
    x: handle.includes("w") ? b.x + b.w : b.x,
    y: handle.includes("n") ? b.y + b.h : b.y,
  };
  const sx = Math.max(
    0.02,
    (handle.includes("w") ? anchor.x - p.x : p.x - anchor.x) / b.w,
  );
  const sy = Math.max(
    0.02,
    (handle.includes("n") ? anchor.y - p.y : p.y - anchor.y) / b.h,
  );
  const isText = a.kind === "text" || a.kind === "note";
  // Keep text scale within the portable JSON schema, including repeated resizing.
  const x = isText
    ? Math.max(0.05, Math.min(20, (a.scaleX ?? 1) * sx)) / (a.scaleX ?? 1)
    : sx;
  const y = isText
    ? Math.max(0.05, Math.min(20, (a.scaleY ?? 1) * sy)) / (a.scaleY ?? 1)
    : sy;
  const map = (q: Point) => ({
    x: anchor.x + (q.x - anchor.x) * x,
    y: anchor.y + (q.y - anchor.y) * y,
  });
  return {
    ...a,
    points: a.points.map(map),
    rects: a.rects?.map((r) => ({ ...map(r), w: r.w * x, h: r.h * y })),
    ...(isText
      ? { scaleX: (a.scaleX ?? 1) * x, scaleY: (a.scaleY ?? 1) * y }
      : {}),
  };
}
