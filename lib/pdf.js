import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { fullDocument } from './template.js';

let browserPromise = null;

// The container ships a preinstalled Chromium that may not match the exact
// build the npm playwright version expects, so resolve a usable binary:
// explicit env override -> playwright's own -> scan PLAYWRIGHT_BROWSERS_PATH.
function resolveExecutablePath() {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (root && existsSync(root)) {
    const dirs = readdirSync(root).filter((d) => d.startsWith('chromium-'));
    for (const d of dirs) {
      const candidate = path.join(root, d, 'chrome-linux', 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined; // let playwright use its default
}

async function launch() {
  const executablePath = resolveExecutablePath();
  const opts = { args: ['--no-sandbox'] };
  try {
    return await chromium.launch(opts);
  } catch (err) {
    if (!executablePath) throw err;
    return chromium.launch({ ...opts, executablePath });
  }
}

function getBrowser() {
  if (!browserPromise) {
    browserPromise = launch().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

/** Render an optimized resume body HTML fragment to a PDF buffer. */
export async function renderPdf(bodyHtml) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(fullDocument(bodyHtml), { waitUntil: 'networkidle' });
    return await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
    });
  } finally {
    await page.close();
  }
}
