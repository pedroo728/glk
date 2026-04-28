// GET  /api/portfolio  — returns all projects from portfolio-data.json
// POST /api/portfolio  — on Vercel, file writes don't persist; returns 503

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(process.cwd(), 'portfolio-data.json');

function readPortfolio() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { projects: [] };
  }
}

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(status).json(data);
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return json(res, 200, readPortfolio());
  }

  // Writes are not supported on Vercel (no persistent filesystem)
  return json(res, 503, {
    error: 'Admin uploads require the local server. Run: node serve.mjs',
    hint: 'For production file uploads, integrate a storage service (e.g. Cloudinary).',
  });
};
