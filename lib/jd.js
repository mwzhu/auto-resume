import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/**
 * Fetch a job posting URL server-side and extract readable text. Many job
 * boards (LinkedIn, Workday, Greenhouse behind JS) block scraping or render
 * client-side, so callers should treat a thrown error as "ask the user to
 * paste the description instead".
 */
export async function fetchJobDescription(url) {
  let dispatcher;
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) {
    try {
      const { ProxyAgent } = await import('undici');
      dispatcher = new ProxyAgent(proxy);
    } catch {
      /* undici proxy optional */
    }
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    ...(dispatcher ? { dispatcher } : {}),
  });

  if (!res.ok) throw new Error(`Fetch failed (HTTP ${res.status}).`);
  const html = await res.text();
  const text = extractMainText(html);
  if (text.length < 200) {
    throw new Error('Could not extract enough text from that URL.');
  }
  return text;
}

function extractMainText(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, header, footer, nav').remove();
  // Prefer the largest text container, else fall back to <body>.
  let best = '';
  $('main, article, [class*="description"], [class*="job"], body').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length > best.length) best = t;
  });
  return best.slice(0, 20000);
}
