const path = require('path');

const RESERVED_SLUGS = new Set([
  'api',
  'health',
  'login',
  'favicon.ico',
  'robots.txt',
  'sites',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.css',
  '.js',
  '.mjs',
  '.json',
  '.txt',
  '.md',
  '.xml',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.map',
  '.webmanifest',
  '.mp4',
  '.webm',
  '.mp3',
  '.wav',
  '.pdf',
  '.zip',
]);

function sanitizeSlug(input) {
  if (!input || typeof input !== 'string') return null;
  const slug = input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (!slug || slug.startsWith('.') || RESERVED_SLUGS.has(slug)) return null;
  return slug;
}

function slugFromName(name) {
  return sanitizeSlug(name);
}

function sanitizeFileName(input) {
  if (!input || typeof input !== 'string') return null;
  const base = path.basename(input.trim());
  if (!base || base === '.' || base === '..' || base.startsWith('.')) return null;
  if (/[<>:"|?*\x00-\x1f]/.test(base)) return null;
  return base;
}

function sanitizeRelativePath(input) {
  if (input == null) return '';
  const normalized = String(input)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .map(sanitizeFileName)
    .filter(Boolean)
    .join('/');
  return normalized;
}

function resolveSafePath(rootDir, relativePath = '') {
  const cleanRelative = sanitizeRelativePath(relativePath);
  const resolved = path.resolve(rootDir, cleanRelative);
  const normalizedRoot = path.resolve(rootDir);
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    return null;
  }
  return resolved;
}

function isAllowedExtension(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

function isReservedSlug(slug) {
  return RESERVED_SLUGS.has(slug);
}

module.exports = {
  ALLOWED_EXTENSIONS,
  RESERVED_SLUGS,
  sanitizeSlug,
  slugFromName,
  sanitizeFileName,
  sanitizeRelativePath,
  resolveSafePath,
  isAllowedExtension,
  isReservedSlug,
};
