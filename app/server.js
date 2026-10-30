const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

const { sanitizeSlug, isReservedSlug, resolveSafePath, sanitizeFileName } = require('./lib/security');
const { listSites, createSite, deleteSite, getSiteDirectory } = require('./lib/sites');
const {
  listDirectory,
  createDirectory,
  deleteEntry,
  saveUploadedFile,
  getDownloadPath,
} = require('./lib/files');

const app = express();

const PORT = Number(process.env.PORT || 4050);
const SITES_ROOT = process.env.SITES_ROOT || path.join(__dirname, '..', 'sites');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'trocar_senha';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 50);
const RSYNC_SSH_HOST = process.env.RSYNC_SSH_HOST || 'yanserver.ddns.net';
const RSYNC_LOCAL_PATH = process.env.RSYNC_LOCAL_PATH || '/Users/yanguimaraesviana/Desktop/website-manager';
const RSYNC_REMOTE_PATH = process.env.RSYNC_REMOTE_PATH || '/pendriver/website-manager';
const RSYNC_REMOTE_SITES = process.env.RSYNC_REMOTE_SITES || `${RSYNC_REMOTE_PATH}/sites`;

app.set('trust proxy', 1);

// Painel /bio/admin e analytics do /bio (bio-admin/, módulo ESM no modelo do painel do Notchly).
// Fica antes do express.json(): o painel lê o corpo das requisições sozinho.
const bioAdmin = import('./bio-admin/index.js').catch((err) => {
  console.error('Painel /bio/admin desligado:', err);
  return null;
});
app.use('/api/bio', async (req, res, next) => {
  const mod = await bioAdmin;
  if (mod && (await mod.adminRoute(req, res, new URL(req.originalUrl, 'http://x')))) return;
  next();
});
// a página do painel só carrega scripts e estilos do próprio site, e não entra em buscadores
app.use('/bio/admin', (_req, res, next) => {
  res.set({
    'Content-Security-Policy':
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  });
  next();
});

app.use(express.json({ limit: '1mb' }));

app.use(
  session({
    name: 'wm_session',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 12,
    },
  })
);

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  return res.status(401).json({ error: 'Não autenticado.' });
}

function buildProjectRsyncMeta() {
  const localPath = `${RSYNC_LOCAL_PATH}/`;
  const remotePath = `root@${RSYNC_SSH_HOST}:${RSYNC_REMOTE_PATH}/`;
  const command = `sshpass -p 'senha' rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" ${localPath} ${remotePath}`;

  return { command, localPath, remotePath };
}

function buildRsyncMeta(slug) {
  const localPath = `${RSYNC_LOCAL_PATH}/sites/${slug}`;
  const remotePath = `root@${RSYNC_SSH_HOST}:${RSYNC_REMOTE_SITES}/`;
  const command = `sshpass -p 'senha' rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" ${localPath} ${remotePath}`;

  return {
    command,
    localPath,
    remotePath,
    slug,
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    try {
      const { validateUploadFile } = require('./lib/files');
      validateUploadFile(file.originalname);
      cb(null, true);
    } catch (err) {
      cb(err);
    }
  },
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'website-manager' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    req.session.username = username;
    return res.json({ ok: true, username });
  }
  return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
});

app.post('/api/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/me', async (req, res) => {
  if (!req.session?.authenticated) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  let detectedSlugs = [];
  try {
    const sites = await listSites(SITES_ROOT, DATA_DIR);
    detectedSlugs = sites.map((s) => s.slug);
  } catch {
    detectedSlugs = [];
  }

  res.json({
    username: req.session.username,
    sitesRoot: SITES_ROOT,
    sitesDisplayPath: RSYNC_REMOTE_SITES,
    projectDisplayPath: RSYNC_REMOTE_PATH,
    projectRsync: buildProjectRsyncMeta(),
    rsyncLocalPath: RSYNC_LOCAL_PATH,
    detectedSlugs,
    sitesRootExists: fs.existsSync(SITES_ROOT),
    maxUploadMb: MAX_UPLOAD_MB,
    domain: process.env.PUBLIC_DOMAIN || '',
  });
});

app.get('/api/sites', requireAuth, async (_req, res) => {
  try {
    const sites = await listSites(SITES_ROOT, DATA_DIR);
    const enriched = sites.map((site) => {
      const rsync = buildRsyncMeta(site.slug);
      return {
        ...site,
        rsync,
        rsyncCommand: rsync.command,
      };
    });
    res.json({ sites: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erro ao listar sites.' });
  }
});

app.post('/api/sites', requireAuth, async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Informe o nome do site.' });
    }
    const site = await createSite(SITES_ROOT, DATA_DIR, name);
    const rsync = buildRsyncMeta(site.slug);
    res.status(201).json({
      ...site,
      rsync,
      rsyncCommand: rsync.command,
      publicUrl: `/${site.slug}`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erro ao criar site.' });
  }
});

app.delete('/api/sites/:slug', requireAuth, async (req, res) => {
  try {
    const result = await deleteSite(SITES_ROOT, DATA_DIR, req.params.slug);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erro ao excluir site.' });
  }
});

app.get('/api/sites/:slug/files', requireAuth, async (req, res) => {
  try {
    const siteDir = getSiteDirectory(SITES_ROOT, req.params.slug);
    if (!siteDir) return res.status(400).json({ error: 'Slug inválido.' });
    if (!fs.existsSync(siteDir)) return res.status(404).json({ error: 'Site não encontrado.' });

    const relativePath = req.query.path || '';
    const listing = await listDirectory(siteDir, relativePath);
    res.json(listing);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erro ao listar arquivos.' });
  }
});

app.post('/api/sites/:slug/files/mkdir', requireAuth, async (req, res) => {
  try {
    const siteDir = getSiteDirectory(SITES_ROOT, req.params.slug);
    if (!siteDir || !fs.existsSync(siteDir)) {
      return res.status(404).json({ error: 'Site não encontrado.' });
    }
    const { path: relativePath = '', name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Informe o nome da pasta.' });
    const result = await createDirectory(siteDir, relativePath, name);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erro ao criar pasta.' });
  }
});

app.post('/api/sites/:slug/files/upload', requireAuth, upload.array('files', 30), async (req, res) => {
  try {
    const siteDir = getSiteDirectory(SITES_ROOT, req.params.slug);
    if (!siteDir || !fs.existsSync(siteDir)) {
      return res.status(404).json({ error: 'Site não encontrado.' });
    }

    const relativePath = req.body.path || '';
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const saved = [];
    for (const file of files) {
      const result = await saveUploadedFile(siteDir, relativePath, file.originalname, file.buffer);
      saved.push(result);
    }

    res.status(201).json({ uploaded: saved });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erro no upload.' });
  }
});

app.delete('/api/sites/:slug/files', requireAuth, async (req, res) => {
  try {
    const siteDir = getSiteDirectory(SITES_ROOT, req.params.slug);
    if (!siteDir || !fs.existsSync(siteDir)) {
      return res.status(404).json({ error: 'Site não encontrado.' });
    }

    const { path: relativePath } = req.body || {};
    if (!relativePath) return res.status(400).json({ error: 'Informe o caminho do arquivo.' });

    const result = await deleteEntry(siteDir, relativePath);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erro ao excluir.' });
  }
});

app.get('/api/sites/:slug/files/download', requireAuth, async (req, res) => {
  try {
    const siteDir = getSiteDirectory(SITES_ROOT, req.params.slug);
    if (!siteDir || !fs.existsSync(siteDir)) {
      return res.status(404).json({ error: 'Site não encontrado.' });
    }

    const relativePath = req.query.path;
    if (!relativePath) return res.status(400).json({ error: 'Informe o caminho do arquivo.' });

    const filePath = getDownloadPath(siteDir, relativePath);
    if (!filePath) return res.status(400).json({ error: 'Caminho inválido.' });

    const stat = await fsp.stat(filePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }

    res.download(filePath, path.basename(filePath));
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erro no download.' });
  }
});

// Contador público de visualizações por site, guardado em DATA_DIR/views.json.
// O mesmo visitante (IP + navegador) só conta de novo depois de 30 minutos.
const VIEWS_FILE = path.join(DATA_DIR, 'views.json');
const VIEW_WINDOW_MS = 30 * 60 * 1000;
let views = null;
const recentViews = new Map();
let saveTimer = null;

function loadViews() {
  if (views) return views;
  try {
    views = JSON.parse(fs.readFileSync(VIEWS_FILE, 'utf8'));
  } catch {
    views = {};
  }
  return views;
}

function scheduleViewsSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = `${VIEWS_FILE}.tmp`;
    fsp.writeFile(tmp, JSON.stringify(views))
      .then(() => fsp.rename(tmp, VIEWS_FILE))
      .catch((err) => console.error('Falha ao salvar visualizações:', err));
  }, 2000);
}

function viewSlug(req) {
  const slug = sanitizeSlug(req.params.slug);
  if (!slug || isReservedSlug(slug)) return null;
  const sitePath = resolveSafePath(SITES_ROOT, slug);
  if (!sitePath || !fs.existsSync(path.join(sitePath, 'index.html'))) return null;
  return slug;
}

app.get('/api/views/:slug', (req, res) => {
  const slug = viewSlug(req);
  if (!slug) return res.status(404).json({ error: 'Site não encontrado.' });
  res.set('Cache-Control', 'no-store');
  res.json({ total: loadViews()[slug] || 0 });
});

app.post('/api/views/:slug', (req, res) => {
  const slug = viewSlug(req);
  if (!slug) return res.status(404).json({ error: 'Site não encontrado.' });
  const counts = loadViews();
  const now = Date.now();
  const ip = req.get('cf-connecting-ip') || req.ip;
  const key = `${slug}|${ip}|${req.get('user-agent') || ''}`;
  if (now - (recentViews.get(key) || 0) > VIEW_WINDOW_MS) {
    counts[slug] = (counts[slug] || 0) + 1;
    scheduleViewsSave();
  }
  recentViews.set(key, now);
  if (recentViews.size > 20000) {
    for (const [k, t] of recentViews) if (now - t > VIEW_WINDOW_MS) recentViews.delete(k);
  }
  res.set('Cache-Control', 'no-store');
  res.json({ total: counts[slug] || 0 });
});

// ============ Releases do Painel do Mercado (/paneltv/release) ============
// Sobe/baixa versões do app (.apk/.aab). Os binários ficam em DATA_DIR/releases/paneltv
// (volume persistente, FORA de sites/, por isso o rsync do Mac não os apaga nem incham o git).
// Teto de RELEASE_MAX_VERSIONS: ao subir uma a mais, a mais antiga (por data) é apagada.
const RELEASES_DIR = path.join(DATA_DIR, 'releases', 'paneltv');
const RELEASE_EXTS = new Set(['.apk', '.aab']);
const RELEASE_MAX_VERSIONS = 5;
const RELEASE_MAX_MB = Number(process.env.RELEASE_MAX_MB || 300);

function sanitizeVersion(input) {
  if (!input || typeof input !== 'string') return null;
  const v = input.trim().replace(/[^A-Za-z0-9._-]/g, '');
  if (!v || v === '.' || v === '..' || v.startsWith('.')) return null;
  return v.slice(0, 40);
}

async function listReleaseVersions() {
  let entries = [];
  try { entries = await fsp.readdir(RELEASES_DIR, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(RELEASES_DIR, entry.name);
    const st = await fsp.stat(dir).catch(() => null);
    if (!st) continue;
    const files = [];
    let names = [];
    try { names = await fsp.readdir(dir); } catch { names = []; }
    for (const name of names) {
      const fst = await fsp.stat(path.join(dir, name)).catch(() => null);
      if (fst && fst.isFile()) files.push({ name, size: fst.size });
    }
    out.push({ version: entry.name, uploadedAt: st.mtimeMs, files });
  }
  out.sort((a, b) => b.uploadedAt - a.uploadedAt); // mais recente primeiro
  return out;
}

async function enforceReleaseCap() {
  const versions = await listReleaseVersions();
  if (versions.length <= RELEASE_MAX_VERSIONS) return [];
  const removed = [];
  for (const v of versions.slice(RELEASE_MAX_VERSIONS)) {
    const dir = resolveSafePath(RELEASES_DIR, v.version);
    if (dir) { await fsp.rm(dir, { recursive: true, force: true }).catch(() => {}); removed.push(v.version); }
  }
  return removed;
}

const releaseUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: RELEASE_MAX_MB * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (RELEASE_EXTS.has(ext)) return cb(null, true);
    cb(new Error('Envie um arquivo .apk ou .aab.'));
  },
});

// A página estática (sites/paneltv/release/) carrega só scripts/estilos do próprio site e não é indexada.
app.use('/paneltv/release', (_req, res, next) => {
  res.set({
    'Content-Security-Policy':
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  });
  next();
});

app.get('/api/paneltv-release/list', async (_req, res) => {
  const versions = await listReleaseVersions();
  res.set('Cache-Control', 'no-store');
  res.json({
    max: RELEASE_MAX_VERSIONS,
    versions: versions.map((v) => ({
      version: v.version,
      uploadedAt: Math.round(v.uploadedAt),
      files: v.files.map((f) => ({
        name: f.name,
        size: f.size,
        url: `/api/paneltv-release/download?v=${encodeURIComponent(v.version)}&name=${encodeURIComponent(f.name)}`,
      })),
    })),
  });
});

app.post('/api/paneltv-release/upload', requireAuth, releaseUpload.single('file'), async (req, res) => {
  try {
    const version = sanitizeVersion(req.body?.version);
    if (!version) return res.status(400).json({ error: 'Versão inválida (use dígitos, ponto ou hífen).' });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    const name = sanitizeFileName(req.file.originalname);
    const ext = path.extname(name || '').toLowerCase();
    if (!name || !RELEASE_EXTS.has(ext)) return res.status(400).json({ error: 'Arquivo deve ser .apk ou .aab.' });
    const dir = resolveSafePath(RELEASES_DIR, version);
    if (!dir) return res.status(400).json({ error: 'Versão inválida.' });
    await fsp.mkdir(dir, { recursive: true });
    const dest = resolveSafePath(dir, name);
    if (!dest) return res.status(400).json({ error: 'Nome de arquivo inválido.' });
    await fsp.writeFile(dest, req.file.buffer);
    const now = new Date();
    await fsp.utimes(dir, now, now).catch(() => {}); // marca como a mais recente p/ a ordenação
    const deleted = await enforceReleaseCap();
    res.status(201).json({ ok: true, version, file: name, deleted });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erro no upload.' });
  }
});

app.get('/api/paneltv-release/download', async (req, res) => {
  const version = sanitizeVersion(req.query.v);
  const name = sanitizeFileName(req.query.name);
  if (!version || !name) return res.status(400).json({ error: 'Parâmetros inválidos.' });
  const dir = resolveSafePath(RELEASES_DIR, version);
  const filePath = dir && resolveSafePath(dir, name);
  if (!filePath) return res.status(400).json({ error: 'Caminho inválido.' });
  const st = await fsp.stat(filePath).catch(() => null);
  if (!st || !st.isFile()) return res.status(404).json({ error: 'Arquivo não encontrado.' });
  res.download(filePath, name);
});

app.delete('/api/paneltv-release/version', requireAuth, async (req, res) => {
  const version = sanitizeVersion(req.query.v);
  if (!version) return res.status(400).json({ error: 'Versão inválida.' });
  const dir = resolveSafePath(RELEASES_DIR, version);
  if (!dir) return res.status(400).json({ error: 'Versão inválida.' });
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  res.json({ ok: true, deleted: version });
});

// O link fixo /paneltv/apk/painel-do-mercado.apk entrega SEMPRE o .apk da versão mais recente do release.
// É o que o QR e o código do Downloader (7243556) apontam: subir uma versão aqui já atualiza o download,
// sem copiar nada. Sem nenhuma versão no release, cai no arquivo estático de sites/paneltv/apk/ (fallback).
app.get('/paneltv/apk/painel-do-mercado.apk', async (req, res, next) => {
  try {
    const versions = await listReleaseVersions(); // mais recente primeiro
    for (const v of versions) {
      const apk = v.files.find((f) => f.name.toLowerCase().endsWith('.apk'));
      if (!apk) continue;
      const dir = resolveSafePath(RELEASES_DIR, v.version);
      const fp = dir && resolveSafePath(dir, apk.name);
      const st = fp && (await fsp.stat(fp).catch(() => null));
      if (st && st.isFile()) return res.download(fp, 'painel-do-mercado.apk');
    }
  } catch { /* cai no fallback estático */ }
  return next();
});

const publicDir = path.join(__dirname, 'public');

app.get('/favicon.ico', (_req, res) => {
  res.type('image/svg+xml').sendFile(path.join(publicDir, 'favicon.svg'));
});

app.use(express.static(publicDir, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

// Lista pública das subpastas de um site que têm index.html próprio (um nível só).
// Serve para páginas-índice montarem os atalhos sozinhas: é só criar a subpasta.
// Rótulos vêm de <meta name="hub-title|hub-desc|hub-emoji"> da sub, com recuo para o <title>.
app.get('/:slug/__subsites.json', (req, res) => {
  const slug = sanitizeSlug(req.params.slug);
  if (!slug || isReservedSlug(slug)) return res.status(404).json({ subsites: [] });

  const sitePath = resolveSafePath(SITES_ROOT, slug);
  if (!sitePath || !fs.existsSync(sitePath)) return res.status(404).json({ subsites: [] });

  const pick = (html, re) => { const m = html.match(re); return m ? m[1].trim() : ''; };
  const subsites = [];
  let entries = [];
  try { entries = fs.readdirSync(sitePath, { withFileTypes: true }); } catch { /* vazio */ }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const indexPath = path.join(sitePath, entry.name, 'index.html');
    if (!fs.existsSync(indexPath)) continue;

    let title = entry.name;
    let description = '';
    let emoji = '';
    try {
      const html = fs.readFileSync(indexPath, 'utf8').slice(0, 6000);
      title =
        pick(html, /<meta\s+name=["']hub-title["']\s+content=["']([^"']*)["']/i) ||
        pick(html, /<title>([^<]*)<\/title>/i).split(/\s[—–-]\s/)[0].trim() ||
        entry.name;
      description = pick(html, /<meta\s+name=["'](?:hub-desc|description)["']\s+content=["']([^"']*)["']/i);
      emoji = pick(html, /<meta\s+name=["']hub-emoji["']\s+content=["']([^"']*)["']/i);
    } catch { /* usa o nome da pasta */ }

    subsites.push({ path: entry.name, title, description, emoji });
  }

  subsites.sort((a, b) => a.path.localeCompare(b.path));
  res.set('Cache-Control', 'no-store');
  res.json({ subsites });
});

app.use('/:slug', (req, res, next) => {
  const slug = sanitizeSlug(req.params.slug);
  if (!slug || isReservedSlug(slug)) return next();

  const sitePath = resolveSafePath(SITES_ROOT, slug);
  if (!sitePath || !fs.existsSync(sitePath)) return next();

  const stat = fs.statSync(sitePath);
  if (!stat.isDirectory()) return next();

  return express.static(sitePath, {
    index: ['index.html'],
    dotfiles: 'deny',
    fallthrough: false,
  })(req, res, (err) => {
    // arquivo que não existe é 404, sem mostrar o caminho interno do servidor
    if (err && err.status !== 404 && err.statusCode !== 404) return next(err);
    return res.status(404).type('text/plain').send('Arquivo não encontrado.');
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `Arquivo excede o limite de ${MAX_UPLOAD_MB} MB.` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
  return res.status(500).json({ error: 'Erro interno.' });
});

async function bootstrap() {
  await fsp.mkdir(SITES_ROOT, { recursive: true });
  await fsp.mkdir(DATA_DIR, { recursive: true });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Website Manager rodando na porta ${PORT}`);
    console.log(`Sites root: ${SITES_ROOT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Falha ao iniciar:', err);
  process.exit(1);
});
