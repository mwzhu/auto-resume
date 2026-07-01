# Auto-Resume

Automatically optimize your resume for a specific job description, then download a
formatted PDF. Paste a job link (or the job text), upload your resume, and Auto-Resume
rewrites your bullet points and skills to mirror the job's terminology — maximizing your
chances of passing an automated resume screen (ATS) — while keeping your names, employers,
titles, dates, and original formatting intact.

## Features

- **Upload `.docx` or `.pdf`** — DOCX preserves the most formatting (headings, bold, bullets).
- **Job description by URL or paste** — the server tries to fetch the link; if the site
  blocks scraping (LinkedIn, Workday, etc.), just paste the description.
- **Keyword optimization with Claude (Opus 4.8)** — rewrites only descriptive content
  (bullets, skills) using the job's language. It never fabricates experience.
- **Side-by-side diff viewer** — see the original and optimized resume next to each other,
  with changed lines highlighted and a word-level "before/after" list.
- **One-click PDF download** — the optimized resume is rendered to a clean PDF via headless
  Chromium, matching the on-screen preview.

## How it works

1. The resume is parsed into an HTML skeleton (DOCX via `mammoth`, PDF via `pdf-parse`).
   Every editable block (bullets, skills/summary lines) gets a stable id; names, dates,
   companies, titles and headings are left untouched.
2. Those segments plus the job description are sent to Claude, which returns an optimized
   version of each segment (preserving inline links/formatting).
3. The optimized segments are merged back into the **same** skeleton, so structure and
   formatting are preserved. A word-level diff drives the side-by-side view.
4. The optimized HTML is rendered to PDF with Playwright/Chromium.

## Setup

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...    # required
npm start
```

Then open http://localhost:3000.

### Environment variables

| Variable            | Required | Purpose                                                        |
| ------------------- | -------- | -------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | yes      | Authenticates the resume-rewriting calls to Claude.            |
| `PORT`              | no       | Server port (default `3000`).                                  |
| `CHROMIUM_PATH`     | no       | Override the Chromium binary used for PDF rendering.           |

If Playwright's bundled Chromium isn't present, run `npx playwright install chromium`
(or set `CHROMIUM_PATH` to an existing Chrome/Chromium binary).

## Project layout

```
server.js            Express app: /api/optimize and /api/pdf
lib/parse.js         DOCX/PDF -> HTML skeleton + editable segments; reassembly
lib/jd.js            Fetch + extract job-description text from a URL
lib/optimize.js      Claude call (structured output) to rewrite segments
lib/diff.js          Word-level diff + marked-up original/optimized bodies
lib/pdf.js           Headless-Chromium PDF rendering
lib/template.js      Shared resume stylesheet + printable document wrapper
public/              Frontend (form + side-by-side diff viewer)
```

## Notes

- Your resume is processed in memory and is not stored on disk.
- The optimizer is instructed to stay truthful: it re-frames existing accomplishments in
  the job's language but never invents experience, employers, degrees, or metrics.
  Always review the diff before sending your resume out.
