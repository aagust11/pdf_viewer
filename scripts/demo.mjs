import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFile } from "node:fs/promises";
const doc = await PDFDocument.create();
const regular = await doc.embedFont(StandardFonts.Helvetica),
  serif = await doc.embedFont(StandardFonts.TimesRoman),
  italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
const green = rgb(0.14, 0.3, 0.25),
  muted = rgb(0.42, 0.49, 0.4);
const pages = [
  {
    title: "Una lectura.",
    subtitle: "Moltes possibilitats.",
    tag: "GUIA DE BENVINGUDA",
    lines: [
      "Un espai per llegir, pensar i connectar idees.",
      "Selecciona aquest text amb el subratllador.",
      "Les teves anotacions es desen al navegador.",
    ],
    task: "Prova-ho: subratlla una frase i dibuixa una fletxa.",
  },
  {
    title: "Fes teu",
    subtitle: "el document.",
    tag: "EXPLORA LES EINES",
    lines: [
      "Dibuixa una fletxa entre dues idees.",
      "Afegeix una nota amb una pregunta o una reflexió.",
      "Mou les anotacions amb l’eina de selecció.",
    ],
    task: "Canvia el zoom: les marques es queden al seu lloc.",
  },
  {
    title: "Les idees,",
    subtitle: "sempre amb tu.",
    tag: "GUARDA I CONTINUA",
    lines: [
      "Exporta el JSON per conservar el treball editable.",
      "Importa’l en un altre navegador i obre el mateix PDF.",
      "Descarrega el PDF anotat per compartir o imprimir.",
    ],
    task: "Ara exporta el JSON i comprova que el pots importar.",
  },
];
for (let i = 0; i < pages.length; i++) {
  const p = doc.addPage([595, 842]);
  const s = pages[i];
  p.drawRectangle({
    x: 0,
    y: 0,
    width: 595,
    height: 842,
    color: rgb(0.98, 0.98, 0.95),
  });
  p.drawRectangle({
    x: 38,
    y: 38,
    width: 519,
    height: 766,
    borderColor: rgb(0.83, 0.86, 0.79),
    borderWidth: 1,
  });
  p.drawText("FULLA / " + s.tag, {
    x: 65,
    y: 759,
    font: regular,
    size: 9,
    color: muted,
  });
  p.drawText(String(i + 1).padStart(2, "0"), {
    x: 505,
    y: 759,
    font: regular,
    size: 9,
    color: muted,
  });
  p.drawLine({
    start: { x: 65, y: 738 },
    end: { x: 530, y: 738 },
    color: rgb(0.83, 0.86, 0.79),
    thickness: 1,
  });
  p.drawText(s.title, { x: 65, y: 637, font: serif, size: 48, color: green });
  p.drawText(s.subtitle, {
    x: 65,
    y: 581,
    font: italic,
    size: 43,
    color: muted,
  });
  s.lines.forEach((t, j) =>
    p.drawText(t, {
      x: 65,
      y: 470 - j * 40,
      font: regular,
      size: 14,
      color: green,
    }),
  );
  p.drawRectangle({
    x: 65,
    y: 226,
    width: 465,
    height: 91,
    color: rgb(0.91, 0.93, 0.87),
  });
  p.drawText("UN PETIT EXPERIMENT", {
    x: 83,
    y: 290,
    font: regular,
    size: 9,
    color: muted,
  });
  p.drawText(s.task, { x: 83, y: 259, font: regular, size: 12, color: green });
  p.drawText("LLEGIR · CONNECTAR · CREAR", {
    x: 65,
    y: 83,
    font: regular,
    size: 9,
    color: muted,
  });
}
await writeFile("public/pdfs/Benvinguda.pdf", await doc.save());
