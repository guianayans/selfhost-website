const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { sanitizeSlug, slugFromName, isReservedSlug, resolveSafePath } = require('./security');

const DEFAULT_INDEX = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>__SITE_NAME__</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #0f172a, #1e293b);
      color: #e2e8f0;
      padding: 2rem;
    }
    main {
      text-align: center;
      max-width: 520px;
    }
    h1 { font-size: 2rem; margin-bottom: 0.75rem; }
    p { color: #94a3b8; line-height: 1.6; }
    code {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.35rem 0.75rem;
      background: rgba(255,255,255,0.08);
      border-radius: 6px;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <main>
    <h1>__SITE_NAME__</h1>
    <p>Site criado com sucesso no Website Manager. Substitua este arquivo pelo seu <code>index.html</code> ou envie arquivos via rsync.</p>
  </main>
</body>
</html>`;

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getDirectorySize(dirPath) {
  let total = 0;
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await getDirectorySize(fullPath);
    } else if (entry.isFile()) {
      const stat = await fsp.stat(fullPath);
      total += stat.size;
    }
  }
  return total;
}

async function getLatestMtime(dirPath) {
  let latest = 0;
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const stat = await fsp.stat(fullPath);
    const candidate = stat.mtimeMs;
    if (candidate > latest) latest = candidate;
    if (entry.isDirectory()) {
      const nested = await getLatestMtime(fullPath);
      if (nested > latest) latest = nested;
    }
  }
  return latest;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function loadMetadata(dataDir) {
  const metaPath = path.join(dataDir, 'sites.json');
  try {
    if (fs.existsSync(metaPath)) {
      const raw = fs.readFileSync(metaPath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
  } catch {
    /* ignore corrupt metadata */
  }
  return {};
}

function saveMetadata(dataDir, metadata) {
  const metaPath = path.join(dataDir, 'sites.json');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
}

async function listSites(sitesRoot, dataDir) {
  await fsp.mkdir(sitesRoot, { recursive: true });
  const metadata = loadMetadata(dataDir);
  const entries = await fsp.readdir(sitesRoot, { withFileTypes: true });
  const sites = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;

    const slug = sanitizeSlug(entry.name);
    if (!slug || isReservedSlug(slug)) continue;

    const sitePath = path.join(sitesRoot, entry.name);
    const [size, mtimeMs] = await Promise.all([
      getDirectorySize(sitePath),
      getLatestMtime(sitePath),
    ]);

    const meta = metadata[slug] || {};
    const hasIndex = await pathExists(path.join(sitePath, 'index.html'));

    sites.push({
      slug,
      name: meta.name || entry.name,
      folder: entry.name,
      modifiedAt: new Date(mtimeMs || Date.now()).toISOString(),
      sizeBytes: size,
      sizeLabel: formatBytes(size),
      hasIndex,
      publicUrl: `/${slug}`,
      createdAt: meta.createdAt || null,
      notes: meta.notes || '',
    });
  }

  sites.sort((a, b) => a.slug.localeCompare(b.slug));
  return sites;
}

async function createSite(sitesRoot, dataDir, name) {
  const slug = slugFromName(name);
  if (!slug) {
    throw new Error('Nome inválido. Use letras, números e hífens.');
  }

  const sitePath = resolveSafePath(sitesRoot, slug);
  if (!sitePath) {
    throw new Error('Slug inválido.');
  }

  if (await pathExists(sitePath)) {
    throw new Error('Já existe um site com este slug.');
  }

  await fsp.mkdir(sitePath, { recursive: true });

  const indexPath = path.join(sitePath, 'index.html');
  if (!(await pathExists(indexPath))) {
    const displayName = String(name).trim() || slug;
    await fsp.writeFile(
      indexPath,
      DEFAULT_INDEX.replace(/__SITE_NAME__/g, displayName),
      'utf8'
    );
  }

  const metadata = loadMetadata(dataDir);
  metadata[slug] = {
    name: String(name).trim() || slug,
    createdAt: new Date().toISOString(),
  };
  saveMetadata(dataDir, metadata);

  return { slug, name: metadata[slug].name };
}

async function deleteSite(sitesRoot, dataDir, slugInput) {
  const slug = sanitizeSlug(slugInput);
  if (!slug) throw new Error('Slug inválido.');

  const sitePath = resolveSafePath(sitesRoot, slug);
  if (!sitePath || sitePath === path.resolve(sitesRoot)) {
    throw new Error('Operação não permitida.');
  }

  if (!(await pathExists(sitePath))) {
    throw new Error('Site não encontrado.');
  }

  await fsp.rm(sitePath, { recursive: true, force: true });

  const metadata = loadMetadata(dataDir);
  delete metadata[slug];
  saveMetadata(dataDir, metadata);

  return { slug };
}

function getSiteDirectory(sitesRoot, slugInput) {
  const slug = sanitizeSlug(slugInput);
  if (!slug) return null;
  return resolveSafePath(sitesRoot, slug);
}

module.exports = {
  listSites,
  createSite,
  deleteSite,
  getSiteDirectory,
  formatBytes,
};
