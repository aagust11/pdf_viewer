export type ReadingOptions = { spread: boolean; cover: boolean };
export function spreadStart(page: number, spread: boolean, cover: boolean) {
  if (!spread || (cover && page === 1)) return page;
  return cover ? page - (page % 2) : page - ((page - 1) % 2);
}
export function visiblePages(
  page: number,
  total: number,
  options: ReadingOptions,
) {
  const start = spreadStart(
    Math.max(1, Math.min(total, page)),
    options.spread,
    options.cover,
  );
  return options.spread && !(options.cover && start === 1) && start < total
    ? [start, start + 1]
    : [start];
}
export function bookUrl(
  id: string,
  options: ReadingOptions,
  embed = true,
  page = 1,
) {
  const url = new URL(window.location.pathname, window.location.origin);
  url.search = new URLSearchParams({
    book: id,
    view: options.spread ? "double" : "single",
    cover: options.cover ? "1" : "0",
    page: String(page),
    ...(embed ? { embed: "1" } : {}),
  }).toString();
  return url.href;
}
export function urlOptions(defaults?: Partial<ReadingOptions>): ReadingOptions {
  const q = new URLSearchParams(location.search);
  return {
    spread: q.has("view")
      ? q.get("view") === "double"
      : (defaults?.spread ?? false),
    cover: q.has("cover") ? q.get("cover") === "1" : (defaults?.cover ?? true),
  };
}
