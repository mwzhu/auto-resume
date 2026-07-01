import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import path from 'path';

import { parseResume, applyOptimized } from './lib/parse.js';
import { fetchJobDescription } from './lib/jd.js';
import { optimizeSegments } from './lib/optimize.js';
import { buildDiff } from './lib/diff.js';
import { renderPdf } from './lib/pdf.js';
import { RESUME_CSS } from './lib/template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Expose the shared resume stylesheet so the browser preview matches the PDF.
app.get('/resume.css', (_req, res) => {
  res.type('text/css').send(RESUME_CSS);
});

app.post('/api/optimize', upload.single('resume'), async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY is not set on the server. Set it and restart.',
      });
    }
    if (!req.file) return res.status(400).json({ error: 'No resume file uploaded.' });

    // Resolve the job description: fetch the URL, else use pasted text.
    let jobDescription = (req.body.jdText || '').trim();
    const jdUrl = (req.body.jdUrl || '').trim();
    if (!jobDescription && jdUrl) {
      try {
        jobDescription = await fetchJobDescription(jdUrl);
      } catch (e) {
        return res.status(422).json({
          error:
            `Could not read the job description from that link (${e.message}). ` +
            'Please paste the job description text instead.',
        });
      }
    }
    if (!jobDescription) {
      return res
        .status(400)
        .json({ error: 'Provide a job description URL or paste the description text.' });
    }

    const { skeleton, segments } = await parseResume(req.file.buffer, req.file.originalname);
    if (segments.length === 0) {
      return res
        .status(422)
        .json({ error: 'Could not find editable content in the resume.' });
    }

    const optimizedById = await optimizeSegments(jobDescription, segments);
    const diff = buildDiff(skeleton, segments, optimizedById);
    const optimizedBody = applyOptimized(skeleton, optimizedById);

    res.json({ ...diff, optimizedBody, jdCharCount: jobDescription.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Optimization failed.' });
  }
});

app.post('/api/pdf', async (req, res) => {
  try {
    const body = req.body.body;
    if (!body) return res.status(400).json({ error: 'Missing resume body.' });
    const pdf = await renderPdf(body);
    res.type('application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="optimized-resume.pdf"');
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'PDF generation failed.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Auto-Resume running on http://localhost:${PORT}`);
});
