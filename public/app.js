const $ = (id) => document.getElementById(id);

let optimizedBody = null;

// --- File selection ---
const fileInput = $('resumeFile');
const fileDrop = $('fileDrop');
fileDrop.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) {
    $('fileLabel').textContent = fileInput.files[0].name;
    fileDrop.classList.add('has-file');
  }
});

// --- Optimize ---
$('optimizeBtn').addEventListener('click', async () => {
  const file = fileInput.files[0];
  const jdUrl = $('jdUrl').value.trim();
  const jdText = $('jdText').value.trim();

  if (!file) return setStatus('Please choose your resume file first.', 'error');
  if (!jdUrl && !jdText) return setStatus('Add a job link or paste the description.', 'error');

  const form = new FormData();
  form.append('resume', file);
  form.append('jdUrl', jdUrl);
  form.append('jdText', jdText);

  setBusy(true);
  setStatus('Reading resume, fetching job description, and optimizing with Claude…', 'working');

  try {
    const res = await fetch('/api/optimize', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    renderResult(data);
    setStatus('', '');
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    setBusy(false);
  }
});

function renderResult(data) {
  optimizedBody = data.optimizedBody;
  $('origBody').innerHTML = data.originalBody;
  $('optBody').innerHTML = data.optimizedBody;
  $('summary').textContent =
    `${data.changedCount} of ${data.totalSegments} segments rewritten for the job description.`;

  const list = $('changesList');
  if (!data.changes.length) {
    list.innerHTML = '<div class="no-changes">No changes were needed — your resume already matches this job well.</div>';
  } else {
    list.innerHTML = data.changes
      .map(
        (c) => `
      <div class="change-item">
        <div class="change-row"><span class="change-tag tag-old">Before</span>${c.oldHtml}</div>
        <div class="change-row"><span class="change-tag tag-new">After</span>${c.newHtml}</div>
      </div>`
      )
      .join('');
  }

  $('resultPanel').hidden = false;
  $('resultPanel').scrollIntoView({ behavior: 'smooth' });
}

// --- Tabs ---
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const view = tab.dataset.view;
    $('sidebyside').hidden = view !== 'sidebyside';
    $('changes').hidden = view !== 'changes';
  });
});

// --- Download PDF ---
$('downloadBtn').addEventListener('click', async () => {
  if (!optimizedBody) return;
  const btn = $('downloadBtn');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generating PDF…';
  try {
    const res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: optimizedBody }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'PDF generation failed.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'optimized-resume.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

function setStatus(msg, kind) {
  const el = $('status');
  el.textContent = msg;
  el.className = 'status' + (kind ? ' ' + kind : '');
}
function setBusy(busy) {
  $('optimizeBtn').disabled = busy;
  $('optimizeBtn').textContent = busy ? 'Working…' : 'Optimize resume';
}
