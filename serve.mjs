import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
};

const PORTFOLIO_FILE = path.join(__dirname, 'portfolio-data.json');

function readPortfolio() {
  try {
    return JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf8'));
  } catch {
    return { projects: [] };
  }
}

function writePortfolio(data) {
  fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(data, null, 2));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // ── API: GET /api/portfolio ──────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/portfolio') {
    return json(res, 200, readPortfolio());
  }

  // ── API: POST /api/portfolio (add project) ──────────────────────
  if (req.method === 'POST' && pathname === '/api/portfolio') {
    try {
      const body = await parseJsonBody(req);
      const { section, subsection, title, description, location, filename, dataUrl } = body;

      if (!section || !subsection || !title) return json(res, 400, { error: 'section, subsection, and title required' });

      let imagePath = '';

      if (dataUrl && filename) {
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
        if (!matches) return json(res, 400, { error: 'invalid dataUrl' });
        const buffer = Buffer.from(matches[2], 'base64');
        const safeFile = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const savePath = path.join(__dirname, 'public', 'images', 'portfolio', section, subsection, safeFile);
        fs.mkdirSync(path.dirname(savePath), { recursive: true });
        fs.writeFileSync(savePath, buffer);
        imagePath = `/images/portfolio/${section}/${subsection}/${safeFile}`;
      }

      const data = readPortfolio();
      const project = {
        id: `proj-${Date.now()}`,
        section,
        subsection,
        tags: Array.isArray(body.tags) ? body.tags : [],
        title,
        description: description || '',
        location: location || '',
        image: imagePath,
      };
      data.projects.push(project);
      writePortfolio(data);
      return json(res, 201, project);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  // ── API: PATCH /api/portfolio/:id ───────────────────────────────
  if (req.method === 'PATCH' && pathname.startsWith('/api/portfolio/')) {
    try {
      const id = pathname.split('/').pop();
      const body = await parseJsonBody(req);
      const { filename, dataUrl, title, description, location } = body;

      const data = readPortfolio();
      const project = data.projects.find(p => p.id === id);
      if (!project) return json(res, 404, { error: 'not found' });

      if (dataUrl && filename) {
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
        if (matches) {
          const buffer = Buffer.from(matches[2], 'base64');
          const safeFile = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
          const savePath = path.join(__dirname, 'public', 'images', 'portfolio', project.section, project.subsection, safeFile);
          fs.mkdirSync(path.dirname(savePath), { recursive: true });
          fs.writeFileSync(savePath, buffer);
          project.image = `/images/portfolio/${project.section}/${project.subsection}/${safeFile}`;
        }
      }

      if (title !== undefined) project.title = title;
      if (description !== undefined) project.description = description;
      if (location !== undefined) project.location = location;
      if (body.subsection !== undefined) project.subsection = body.subsection;
      if (body.section !== undefined) project.section = body.section;
      if (Array.isArray(body.tags)) project.tags = body.tags;

      writePortfolio(data);
      return json(res, 200, project);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  // ── API: PUT /api/portfolio/reorder ─────────────────────────────
  if (req.method === 'PUT' && pathname === '/api/portfolio/reorder') {
    try {
      const body = await parseJsonBody(req);
      const { order } = body;
      if (!Array.isArray(order)) return json(res, 400, { error: 'order must be an array of ids' });
      const data = readPortfolio();
      const map = Object.fromEntries(data.projects.map(p => [p.id, p]));
      const inOrder = new Set(order);
      data.projects = [
        ...order.map(id => map[id]).filter(Boolean),
        ...data.projects.filter(p => !inOrder.has(p.id)),
      ];
      writePortfolio(data);
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  // ── API: DELETE /api/portfolio/:id ──────────────────────────────
  if (req.method === 'DELETE' && pathname.startsWith('/api/portfolio/')) {
    const id = pathname.split('/').pop();
    const data = readPortfolio();
    const idx = data.projects.findIndex(p => p.id === id);
    if (idx === -1) return json(res, 404, { error: 'not found' });
    data.projects.splice(idx, 1);
    writePortfolio(data);
    return json(res, 200, { ok: true });
  }

  // ── Static files ──────────────────────────────────────────────────
  let filePath;
  if (pathname === '/') {
    filePath = path.join(__dirname, 'index.html');
  } else if (pathname === '/admin' || pathname === '/admin.html') {
    filePath = path.join(__dirname, 'admin.html');
  } else {
    // Try root first (index.html, admin.html, etc.), then public/
    const rootTry = path.join(__dirname, pathname);
    const publicTry = path.join(__dirname, 'public', pathname);
    if (fs.existsSync(rootTry) && fs.statSync(rootTry).isFile()) {
      filePath = rootTry;
    } else {
      filePath = publicTry;
    }
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, fileData) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fileData);
  });
}).listen(PORT, () => {
  console.log(`GLK server running at http://localhost:${PORT}`);
  console.log(`Admin panel:         http://localhost:${PORT}/admin`);
});
