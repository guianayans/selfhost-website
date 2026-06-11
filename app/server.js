const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

const { sanitizeSlug, isReservedSlug, resolveSafePath } = require('./lib/security');
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

const publicDir = path.join(__dirname, 'public');

app.get('/favicon.ico', (_req, res) => {
  res.type('image/png').sendFile(path.join(publicDir, 'favicon.png'));
});

app.use(express.static(publicDir, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

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
    if (err) return next(err);
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
