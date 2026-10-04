import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfjs, pdfOptions } from "./pdf";
import { readLocalPdf } from "./storage";
export function Thumbnail({
  url,
  localId,
  pdf,
  number = 1,
}: {
  url?: string;
  localId?: string;
  pdf?: PDFDocumentProxy;
  number?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let localUrl: string | undefined;
    let own: ReturnType<typeof pdfjs.getDocument> | undefined;
    let task: any;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      (async () => {
        if (localId) {
          localUrl = URL.createObjectURL(await readLocalPdf(localId));
          if (cancelled) {
            URL.revokeObjectURL(localUrl);
            return;
          }
        }
        const doc =
          pdf ||
          (await (own = pdfjs.getDocument({
            url: localUrl || url,
            ...pdfOptions,
          })).promise);
        if (cancelled) return;
        const p = await doc.getPage(number);
        if (cancelled) return;
        const v = p.getViewport({ scale: 1 });
        const vp = p.getViewport({ scale: 360 / v.width });
        const c = ref.current!;
        c.width = vp.width;
        c.height = vp.height;
        task = p.render({
          canvas: c,
          canvasContext: c.getContext("2d")!,
          viewport: vp,
        });
        await task.promise;
        if (!cancelled) setLoaded(true);
      })()
        .catch(() => {
          if (!cancelled) setFailed(true);
        })
        .finally(() => own?.destroy());
    });
    if (ref.current) observer.observe(ref.current);
    return () => {
      cancelled = true;
      observer.disconnect();
      task?.cancel();
      own?.destroy();
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [url, localId, pdf, number]);
  return (
    <>
      {failed ? (
        <span className="thumb-fallback">PDF</span>
      ) : (
        <canvas ref={ref} data-loaded={loaded} aria-hidden="true" />
      )}
    </>
  );
}
