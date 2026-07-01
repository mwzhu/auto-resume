import { diffWords } from 'diff';
import * as cheerio from 'cheerio';

function stripTags(html) {
  return cheerio.load(`<div>${html || ''}</div>`)('div').text().replace(/\s+/g, ' ').trim();
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Word-level diff -> { oldHtml, newHtml } with <del>/<ins> highlighting. */
function wordDiff(oldText, newText) {
  const parts = diffWords(oldText, newText);
  let oldHtml = '';
  let newHtml = '';
  for (const p of parts) {
    const text = escapeHtml(p.value);
    if (p.added) newHtml += `<ins>${text}</ins>`;
    else if (p.removed) oldHtml += `<del>${text}</del>`;
    else {
      oldHtml += text;
      newHtml += text;
    }
  }
  return { oldHtml, newHtml };
}

/**
 * Build the diff view data:
 *  - originalBody / optimizedBody: full resume HTML with changed blocks marked
 *  - changes: per-segment word-level diffs (only segments that actually changed)
 */
export function buildDiff(skeleton, segments, optimizedById) {
  const changedIds = new Set();
  const changes = [];

  for (const seg of segments) {
    const optHtml = optimizedById[seg.id];
    if (optHtml == null) continue;
    const oldText = stripTags(seg.html);
    const newText = stripTags(optHtml);
    if (oldText === newText) continue;
    changedIds.add(seg.id);
    changes.push({ id: seg.id, ...wordDiff(oldText, newText) });
  }

  const $orig = cheerio.load(skeleton, null, false);
  const $opt = cheerio.load(skeleton, null, false);
  for (const id of changedIds) {
    $orig(`[data-seg="${id}"]`).addClass('changed');
    const $optEl = $opt(`[data-seg="${id}"]`).addClass('changed');
    if (optimizedById[id] != null) $optEl.html(optimizedById[id]);
  }

  return {
    originalBody: $orig.html(),
    optimizedBody: $opt.html(),
    changes,
    changedCount: changedIds.size,
    totalSegments: segments.length,
  };
}
