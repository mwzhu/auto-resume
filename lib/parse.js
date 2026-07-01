import mammoth from 'mammoth';
import { createRequire } from 'module';
import * as cheerio from 'cheerio';

const require = createRequire(import.meta.url);

// A block is "editable" (safe to rewrite for keyword optimization) when it is a
// bullet point, or a longer descriptive/skills paragraph. We deliberately avoid
// touching names, job titles, company+date lines and section headings so the
// factual structure of the resume is preserved.
const YEAR_RE = /\b(19|20)\d{2}\b/;

function isEditable(tag, text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (tag === 'li') return words >= 3;
  if (tag === 'p') return !YEAR_RE.test(text) && words >= 8;
  return false;
}

/**
 * Convert an uploaded resume buffer into an HTML "body" skeleton where every
 * editable block carries a stable data-seg id. Returns the skeleton plus the
 * list of segments to send to the model.
 */
export async function parseResume(buffer, filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  let bodyHtml;

  if (ext === 'docx') {
    const result = await mammoth.convertToHtml({ buffer });
    bodyHtml = result.value;
  } else if (ext === 'pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    bodyHtml = pdfTextToHtml(data.text);
  } else {
    throw new Error(`Unsupported file type: .${ext}. Please upload a .docx or .pdf.`);
  }

  const $ = cheerio.load(bodyHtml, null, false);
  const segments = [];
  let counter = 0;

  $('p, li, h1, h2, h3').each((_, el) => {
    const $el = $(el);
    const tag = el.tagName.toLowerCase();
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (!isEditable(tag, text)) return;
    const id = `seg-${counter++}`;
    $el.attr('data-seg', id);
    segments.push({ id, tag, html: $el.html(), text });
  });

  return { skeleton: $.html(), segments, format: ext };
}

// Best-effort reconstruction of a PDF's plain text into semantic HTML: short
// ALL-CAPS lines become section headings, everything else becomes paragraphs.
// (DOCX preserves far more; PDFs lose most styling by nature.)
function pdfTextToHtml(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const out = [];
  for (const line of lines) {
    if (!line) continue;
    const isHeading =
      line.length <= 40 && line === line.toUpperCase() && /[A-Z]/.test(line);
    if (isHeading) out.push(`<h1>${escapeHtml(line)}</h1>`);
    else if (/^[•\-•]\s+/.test(line))
      out.push(`<ul><li>${escapeHtml(line.replace(/^[•\-•]\s+/, ''))}</li></ul>`);
    else out.push(`<p>${escapeHtml(line)}</p>`);
  }
  return out.join('');
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Rebuild an HTML body from the skeleton, replacing each editable segment's
 * inner HTML with the model's optimized version (keyed by data-seg id).
 */
export function applyOptimized(skeleton, optimizedById) {
  const $ = cheerio.load(skeleton, null, false);
  $('[data-seg]').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('data-seg');
    if (optimizedById[id] != null) $el.html(optimizedById[id]);
  });
  return $.html();
}
