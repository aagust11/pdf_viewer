import type { Annotation } from "./model";
export function Shape({
  a,
  w,
  h,
  selected = false,
}: {
  a: Annotation;
  w: number;
  h: number;
  selected?: boolean;
}) {
  const p = a.points.map((p) => ({ x: p.x * w, y: p.y * h }));
  const first = p[0];
  const last = p[p.length - 1];
  const stroke = a.color;
  const sw = a.width;
  let shape;
  if (a.kind === "highlight")
    shape = (
      <g fill={a.color}>
        {a.rects?.map((r, i) => (
          <rect
            key={i}
            x={r.x * w}
            y={r.y * h}
            width={r.w * w}
            height={r.h * h}
          />
        ))}
      </g>
    );
  else if (a.kind === "text" || a.kind === "note") {
    const lines = (a.text || "")
      .split("\n")
      .flatMap((s) => s.match(/.{1,34}(?:\s|$)|.{1,34}/g) || [""]);
    const tw = Math.max(60, ...lines.map((l) => l.length * a.fontSize * 0.62));
    shape = (
      <g
        transform={`translate(${first.x} ${first.y}) scale(${a.scaleX ?? 1} ${a.scaleY ?? 1}) translate(${-first.x} ${-first.y})`}
      >
        {a.kind === "note" && (
          <rect
            x={first.x - 7}
            y={first.y - 5}
            width={tw + 14}
            height={lines.length * a.fontSize * 1.35 + 10}
            rx={5}
            fill="#fff3b0"
            stroke={a.color}
            strokeWidth={1}
          />
        )}
        <text
          x={first.x}
          y={first.y}
          fill={a.color}
          fontSize={a.fontSize}
          fontFamily="Arial, sans-serif"
          dominantBaseline="hanging"
        >
          {lines.map((l, i) => (
            <tspan key={i} x={first.x} dy={i ? a.fontSize * 1.35 : 0}>
              {l}
            </tspan>
          ))}
        </text>
      </g>
    );
  } else if (a.kind === "rect" || a.kind === "ellipse") {
    const x = Math.min(first.x, last.x),
      y = Math.min(first.y, last.y),
      width = Math.abs(last.x - first.x),
      height = Math.abs(last.y - first.y);
    shape =
      a.kind === "rect" ? (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
        />
      ) : (
        <ellipse
          cx={x + width / 2}
          cy={y + height / 2}
          rx={width / 2}
          ry={height / 2}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
        />
      );
  } else {
    const angle = Math.atan2(last.y - first.y, last.x - first.x),
      len = Math.max(12, sw * 4);
    shape = (
      <g
        fill="none"
        stroke={stroke}
        strokeWidth={a.kind === "marker" ? sw * 6 : sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points={p.map((p) => `${p.x},${p.y}`).join(" ")} />
        {a.kind === "arrow" && (
          <polyline
            points={`${last.x - len * Math.cos(angle - 0.5)},${last.y - len * Math.sin(angle - 0.5)} ${last.x},${last.y} ${last.x - len * Math.cos(angle + 0.5)},${last.y - len * Math.sin(angle + 0.5)}`}
          />
        )}
      </g>
    );
  }
  return (
    <g
      opacity={a.opacity}
      style={selected ? { filter: "drop-shadow(0 0 3px #087aff)" } : undefined}
    >
      {shape}
    </g>
  );
}
