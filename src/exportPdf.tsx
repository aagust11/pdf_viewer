import { renderToStaticMarkup } from "react-dom/server";
import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Shape } from "./Shapes";
import type { Work } from "./model";
import { download } from "./model";
// Flatten at 2x page resolution, preserving rotated/cropped page appearance and Unicode notes.
export async function exportPdf(
  pdf: PDFDocumentProxy,
  work: Work,
  progress: (s: string) => void,
) {
  const output = await PDFDocument.create();
  for (let n = 1; n <= pdf.numPages; n++) {
    progress(`Preparant PDF: ${n} / ${pdf.numPages}`);
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 6000 / Math.max(vp.width, vp.height));
    const big = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = Math.ceil(big.width);
    c.height = Math.ceil(big.height);
    const ctx = c.getContext("2d")!;
    await page.render({ canvas: c, canvasContext: ctx, viewport: big }).promise;
    const markup = renderToStaticMarkup(
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={c.width}
        height={c.height}
        viewBox={`0 0 ${vp.width} ${vp.height}`}
      >
        {work.annotations
          .filter((a) => a.page === n)
          .map((a) => (
            <Shape key={a.id} a={a} w={vp.width} h={vp.height} />
          ))}
      </svg>,
    );
    const url = URL.createObjectURL(
      new Blob([markup], { type: "image/svg+xml" }),
    );
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      ctx.drawImage(img, 0, 0);
    } finally {
      URL.revokeObjectURL(url);
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      c.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(new Error("No s’ha pogut exportar la pàgina.")),
        "image/jpeg",
        0.94,
      ),
    );
    const embedded = await output.embedJpg(await blob.arrayBuffer());
    const out = output.addPage([vp.width, vp.height]);
    out.drawImage(embedded, { x: 0, y: 0, width: vp.width, height: vp.height });
    c.width = 0;
    c.height = 0;
  }
  const bytes = await output.save();
  download(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    work.title + "-anotat.pdf",
  );
}
