// Serverless function for Vercel: passes a question-box request to Google Gemini.
// The key lives in the GEMINI_API_KEY environment variable on the server and never reaches the browser.
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
// 'null' is the origin of a page opened straight from a file, as on the demo laptop.
const ALLOWED = [/^null$/, /^https:\/\/netchuu\.github\.io$/, /^https:\/\/[a-z0-9-]+\.vercel\.app$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED.some((re) => re.test(origin))) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'The server has no AI key configured.' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!body || !Array.isArray(body.contents) || !body.contents.length) return res.status(400).json({ error: 'Missing contents.' });
  const payload = {
    systemInstruction: body.systemInstruction,
    contents: body.contents.slice(-20),
    generationConfig: { maxOutputTokens: 1500, temperature: 0.4 },
  };
  if (JSON.stringify(payload).length > 60000) return res.status(413).json({ error: 'The request is too long.' });

  let last = 'no answer';
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) { last = (data.error && data.error.message) || `status ${r.status}`; continue; }
      const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
      const text = parts.map((p) => p.text || '').join('').trim();
      if (text) return res.status(200).json({ text });
      last = 'the answer came back empty';
    } catch (err) {
      last = 'the AI service could not be reached';
    }
  }
  return res.status(502).json({ error: String(last).slice(0, 200) });
}

function safeParse(text) { try { return JSON.parse(text); } catch (e) { return null; } }
