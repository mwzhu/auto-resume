import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const MODEL = 'claude-sonnet-5';

const SYSTEM = `You are an expert resume writer and ATS (applicant-tracking-system) optimization specialist.

You will receive a job description and a list of editable segments from a candidate's resume. Each segment is a bullet point or a descriptive/skills line, given as an HTML fragment.

Your job: rewrite each segment so it maximizes the candidate's chances of passing an automated resume screen for THIS specific job, by naturally incorporating the terminology, keywords, hard skills, and phrasing used in the job description.

Strict rules:
- TRUTHFULNESS: Never invent experience, employers, metrics, degrees, or technologies the candidate did not mention. You may re-frame and re-word existing accomplishments to align with the job's language, but do not fabricate. Keep any real numbers/metrics that appear.
- KEYWORDS: Mirror the exact terminology from the job description where it genuinely applies to the candidate's existing experience (e.g. if the JD says "distributed systems" and the bullet describes that work, use that phrase).
- PRESERVE HTML: Each segment may contain inline tags such as <a>, <strong>, <em>. Preserve those inline tags and any href/URLs. Only change the wording of the visible text.
- LENGTH: Keep each rewritten segment close to its original length (fit on one line where the original did). Bullets stay bullets.
- TONE: Professional, results-oriented, concise. Start bullets with strong action verbs.
- If a segment is already well-optimized or cannot be meaningfully improved for this job, return it unchanged.

Return every segment you were given, keyed by its id.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    segments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          optimized_html: { type: 'string' },
        },
        required: ['id', 'optimized_html'],
      },
    },
  },
  required: ['segments'],
};

/**
 * Ask Claude to optimize the given resume segments against a job description.
 * Returns a map of segment id -> optimized inner HTML.
 */
export async function optimizeSegments(jobDescription, segments) {
  const payload = segments.map((s) => ({ id: s.id, html: s.html }));

  const userMessage = [
    '## JOB DESCRIPTION',
    jobDescription,
    '',
    '## RESUME SEGMENTS (JSON)',
    'Rewrite each segment for the job above, following all rules.',
    JSON.stringify(payload, null, 2),
  ].join('\n');

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (err) {
    throw new Error(friendlyApiError(err));
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Model returned no optimized content.');

  const data = JSON.parse(textBlock.text);
  const byId = {};
  for (const seg of data.segments || []) byId[seg.id] = seg.optimized_html;
  return byId;
}

// Turn raw SDK errors into a message that's useful in the UI.
function friendlyApiError(err) {
  const status = err?.status;
  const apiMsg = err?.error?.error?.message || err?.message || 'Unknown error';
  if (status === 401) return 'Invalid ANTHROPIC_API_KEY. Check the key and restart.';
  if (status === 403) return 'This API key is not permitted to use the requested model.';
  if (status === 429) return 'Rate limited by the Anthropic API. Wait a moment and retry.';
  if (/credit balance/i.test(apiMsg))
    return 'Your Anthropic account is out of API credits. Add credits at console.anthropic.com → Plans & Billing, then retry.';
  return `Anthropic API error: ${apiMsg}`;
}
