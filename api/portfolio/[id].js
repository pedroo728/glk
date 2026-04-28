// PATCH/DELETE /api/portfolio/:id — not supported on Vercel (no persistent filesystem)

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  res.status(503).json({
    error: 'Admin edits require the local server. Run: node serve.mjs',
    hint: 'For production file uploads, integrate a storage service (e.g. Cloudinary).',
  });
};
