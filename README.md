# Fulla · Biblioteca PDF interactiva

Biblioteca pública, gratuïta i sense registre. React + TypeScript + PDF.js; les anotacions no surten del navegador.

## Obrir la biblioteca

https://aagust11.github.io/pdf_viewer/

## Publicar els teus PDFs

1. A GitHub, obre `public/pdfs/` i selecciona **Add file → Upload files**.
2. Puja els PDFs i confirma el commit a `main`.
3. Espera que acabi **Actions → Publicar biblioteca**. El catàleg es regenera automàticament.

Pots crear subcarpetes: el primer nivell es farà servir com a categoria. Les portades es generen al navegador amb la primera pàgina. No cal editar cap llista.

Per personalitzar un document, crea un JSON amb el mateix nom: `Dossier.pdf` → `Dossier.json`:

```json
{
  "title": "Forces i estructures",
  "description": "Dossier de Tecnologia de 3r d’ESO.",
  "category": "Tecnologia",
  "order": 1
}
```

El PDF `Benvinguda.pdf` és una mostra que pots eliminar juntament amb el seu JSON. **Tots els PDFs publicats són públics.** Obrir un PDF local des de la web no el publica ni l’envia.

## Eines

- Biblioteca amb cerca, categories i portades.
- PDF amb capa de text real, navegació, miniatures, zoom, amplada adaptada, pantalla completa i dues pàgines.
- Subratllat de text, marcador lliure, llapis, fletxes, línies, rectangles, cercles, text i notes.
- Selecció, moviment, color, gruix, opacitat, mida del text i eliminació. Doble clic per editar una anotació.
- Desfer / refer (Ctrl/Cmd+Z, Ctrl/Cmd+Maj+Z). Supr elimina la selecció. Fletxes esquerra/dreta canvien de pàgina.
- IndexedDB per a anotacions i última pàgina. Una sola pestanya editora per evitar sobreescriptures, quan el navegador disposa de Web Locks.
- JSON versionat amb validació completa abans d’importar, combinació per identificador sense duplicats o substitució dels documents inclosos. En combinar versions d’una anotació es conserva la més recent.
- PDF anotat per imprimir o compartir: exportació visual a 2x, **rasteritzada**, sense text seleccionable ni anotacions editables. Conserva sempre el JSON.

## Identitat i còpies

Les coordenades es desen normalitzades respecte de la pàgina original. Cada document s’identifica amb SHA-256 del seu contingut: canviar de nom o carpeta no perd les anotacions; modificar el PDF produeix un document diferent i impedeix aplicar-hi marques desplaçades.

El JSON conté anotacions, no el PDF. En un altre ordinador cal obrir el mateix PDF de la biblioteca o triar el mateix arxiu local. Si el document encara no és al catàleg, les anotacions importades es conserven fins que s’obri. Les còpies no inclouen historial de desfer ni sincronització automàtica de supressions: per reflectir supressions d’una còpia, tria Substituir.

El navegador pot esborrar dades locals. Exporta regularment el JSON. L’aplicació mostra la data d’última exportació i els errors de desament. Si IndexedDB no està disponible, es pot treballar en memòria i exportar; no es promet desament local.

Els escanejats sense capa de text admeten dibuix i marcador lliure, però no selecció de text. No s’inclou OCR. Els PDF protegits amb contrasenya mostren un error; desbloqueja’n una còpia autoritzada abans d’obrir-los. La vista de llibre utilitza transicions suaus, sense simulació 3D del gir de full.

## Desenvolupament

Node.js 22 o posterior.

```sh
npm ci
npm run dev
npm run build
npx playwright install chromium
npm test
```

`npm run build` escaneja `public/pdfs/` recursivament, genera `public/library.json` i copia els recursos de PDF.js. La web servida no depèn de CDN ni de serveis de dades externs. Per incorporar PDFs mentre el servidor de desenvolupament està obert, torna a executar `node scripts/library.mjs`.

GitHub Pages: el workflow inclòs compila i publica `dist`. Si Pages encara no està configurat per a Actions, tria **Settings → Pages → Source → GitHub Actions**. La base relativa permet servir el projecte en una subcarpeta.

## Verificació

`tests/library.spec.ts` cobreix selecció real de text, fletxa, nota, desfer/refer, estabilitat de dades amb zoom, recàrrega, exportació/importació entre contextos de navegador, importació repetida sense duplicats, exportació PDF, JSON invàlid, pantalla mòbil i protecció multipestanya.
