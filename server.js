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
    // GET /api/data → todo el JSON
    if (pathname === '/api/data' && method === 'GET') {
      return send(res, 200, readData());
    }

    // PUT /api/director → reemplaza el director
    if (pathname === '/api/director' && method === 'PUT') {
      const body = await getBody(req);
      const data = readData();
      data.director = { ...data.director, ...body, id: 0 };
      writeData(data);
      return send(res, 200, data.director);
    }

    // POST /api/members → agregar miembro
    if (pathname === '/api/members' && method === 'POST') {
      const body = await getBody(req);
      const data = readData();
      const nextId = data.members.reduce((max, m) => Math.max(max, m.id), 0) + 1;
      const member = { id: nextId, ...body };
      data.members.push(member);
      writeData(data);
      return send(res, 201, member);
    }

    // PUT /api/members/:id
    const editMatch = pathname.match(/^\/api\/members\/(\d+)$/);
    if (editMatch && method === 'PUT') {
      const id   = parseInt(editMatch[1]);
      const body = await getBody(req);
      const data = readData();
      const idx  = data.members.findIndex(m => m.id === id);
      if (idx === -1) return send(res, 404, { error: 'No encontrado' });
      data.members[idx] = { ...data.members[idx], ...body, id };
      writeData(data);
      return send(res, 200, data.members[idx]);
    }

    // DELETE /api/members/:id
    const delMatch = pathname.match(/^\/api\/members\/(\d+)$/);
    if (delMatch && method === 'DELETE') {
      const id   = parseInt(delMatch[1]);
      const data = readData();
      const idx  = data.members.findIndex(m => m.id === id);
      if (idx === -1) return send(res, 404, { error: 'No encontrado' });
      data.members.splice(idx, 1);
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
  console.log('\n  OTI Sistema Solar');
  console.log(`  Sitio  →  http://localhost:${PORT}`);
  console.log(`  Admin  →  http://localhost:${PORT}/admin\n`);
});
