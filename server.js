const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT      = process.env.PORT || 3000;
const ROOT      = __dirname;
const DATA_FILE = path.join(ROOT, 'interns.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

// ─── Helpers de datos ───
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
function getBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(new Error('JSON invalido')); }
    });
    req.on('error', reject);
  });
}
function send(res, status, data, type = 'application/json; charset=utf-8') {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ─── Servidor ───
const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url, true);
  const method = req.method.toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // GET /api/interns
    if (pathname === '/api/interns' && method === 'GET') {
      return send(res, 200, readData());
    }

    // POST /api/interns
    if (pathname === '/api/interns' && method === 'POST') {
      const body = await getBody(req);
      const data = readData();
      const nextId = data.interns.reduce((max, i) => Math.max(max, i.id), 0) + 1;
      const intern = { id: nextId, ...body };
      data.interns.push(intern);
      writeData(data);
      return send(res, 201, intern);
    }

    // PUT /api/interns/:id
    const editMatch = pathname.match(/^\/api\/interns\/(\d+)$/);
    if (editMatch && method === 'PUT') {
      const id  = parseInt(editMatch[1]);
      const body = await getBody(req);
      const data = readData();
      const idx  = data.interns.findIndex(i => i.id === id);
      if (idx === -1) return send(res, 404, { error: 'No encontrado' });
      data.interns[idx] = { ...data.interns[idx], ...body, id };
      writeData(data);
      return send(res, 200, data.interns[idx]);
    }

    // DELETE /api/interns/:id
    const delMatch = pathname.match(/^\/api\/interns\/(\d+)$/);
    if (delMatch && method === 'DELETE') {
      const id  = parseInt(delMatch[1]);
      const data = readData();
      const idx  = data.interns.findIndex(i => i.id === id);
      if (idx === -1) return send(res, 404, { error: 'No encontrado' });
      data.interns.splice(idx, 1);
      writeData(data);
      res.writeHead(204); res.end();
      return;
    }

    // ─── Archivos estaticos ───
    let filePath = pathname;
    if (filePath === '/')       filePath = '/index.html';
    if (filePath === '/admin')  filePath = '/admin.html';

    const fullPath = path.normalize(path.join(ROOT, filePath));
    if (!fullPath.startsWith(ROOT + path.sep) && fullPath !== ROOT) {
      return send(res, 403, 'Forbidden', 'text/plain');
    }

    fs.readFile(fullPath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') return send(res, 404, 'No encontrado', 'text/plain');
        return send(res, 500, 'Error del servidor', 'text/plain');
      }
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(content);
    });

  } catch (err) {
    console.error('[ERROR]', err.message);
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log('\n  OTI Practicantes');
  console.log(`  Sitio  →  http://localhost:${PORT}`);
  console.log(`  Admin  →  http://localhost:${PORT}/admin\n`);
});
