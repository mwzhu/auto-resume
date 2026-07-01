// Shared print/screen stylesheet for the rendered resume. Used both for the
// in-browser preview and for the Chromium-generated PDF so what you see matches
// the download.
export const RESUME_CSS = `
  .resume {
    font-family: "Calibri", "Helvetica Neue", Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.35;
    font-size: 10.5pt;
    max-width: 8.5in;
    margin: 0 auto;
    background: #fff;
  }
  .resume h1 {
    font-size: 12pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1.5px solid #333;
    padding-bottom: 2px;
    margin: 14px 0 6px;
    color: #111;
  }
  .resume h2 {
    font-size: 11pt;
    margin: 10px 0 2px;
    color: #111;
  }
  .resume p { margin: 2px 0; }
  .resume ul { margin: 3px 0 8px; padding-left: 18px; }
  .resume li { margin: 2px 0; }
  .resume a { color: #0b5cad; text-decoration: none; }
  .resume img { max-height: 14px; vertical-align: middle; }
  .resume strong { color: #000; }
`;

/** Wrap a resume body fragment into a standalone printable HTML document. */
export function fullDocument(bodyHtml) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @page { size: Letter; margin: 0.5in; }
  body { margin: 0; }
  ${RESUME_CSS}
</style></head>
<body><div class="resume">${bodyHtml}</div></body></html>`;
}
