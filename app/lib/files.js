const fsp = require('fs/promises');
const path = require('path');
const {
  sanitizeRelativePath,
  sanitizeFileName,
  resolveSafePath,
  isAllowedExtension,
} = require('./security');

async function listDirectory(siteDir, relativePath = '') {
  const targetDir = resolveSafePath(siteDir, relativePath);
  if (!targetDir) throw new Error('Caminho inválido.');

  const stat = await fsp.stat(targetDir).catch(() => null);
  if (!stat || !stat.isDirectory()) throw new Error('Pasta não encontrada.');

  const entries = await fsp.readdir(targetDir, { withFileTypes: true });
  const items = [];

  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);
    const entryStat = await fsp.stat(fullPath);
    items.push({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      size: entry.isFile() ? entryStat.size : null,
      modifiedAt: entryStat.mtime.toISOString(),
      path: sanitizeRelativePath(
        path.posix.join(sanitizeRelativePath(relativePath), entry.name)
      ),
    });
  }

  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    path: sanitizeRelativePath(relativePath),
    items,
  };
}

async function createDirectory(siteDir, relativePath, folderName) {
  const safeName = sanitizeFileName(folderName);
  if (!safeName) throw new Error('Nome de pasta inválido.');

  const parentPath = sanitizeRelativePath(relativePath);
  const newRelative = sanitizeRelativePath(path.posix.join(parentPath, safeName));
  const targetDir = resolveSafePath(siteDir, newRelative);
  if (!targetDir) throw new Error('Caminho inválido.');

  await fsp.mkdir(targetDir, { recursive: false });
  return { path: newRelative };
}

async function deleteEntry(siteDir, relativePath) {
  const targetPath = resolveSafePath(siteDir, relativePath);
  if (!targetPath || targetPath === path.resolve(siteDir)) {
    throw new Error('Operação não permitida.');
  }

  const stat = await fsp.stat(targetPath).catch(() => null);
  if (!stat) throw new Error('Arquivo ou pasta não encontrado.');

  if (stat.isDirectory()) {
    await fsp.rm(targetPath, { recursive: true, force: true });
  } else {
    await fsp.unlink(targetPath);
  }

  return { path: sanitizeRelativePath(relativePath) };
}

function validateUploadFile(originalName) {
  const safeName = sanitizeFileName(originalName);
  if (!safeName) throw new Error('Nome de arquivo inválido.');
  if (!isAllowedExtension(safeName)) {
    throw new Error(`Tipo de arquivo não permitido: ${path.extname(safeName)}`);
  }
  return safeName;
}

async function saveUploadedFile(siteDir, relativePath, originalName, buffer) {
  const safeName = validateUploadFile(originalName);
  const parentPath = sanitizeRelativePath(relativePath);
  const fileRelative = sanitizeRelativePath(path.posix.join(parentPath, safeName));
  const targetFile = resolveSafePath(siteDir, fileRelative);
  if (!targetFile) throw new Error('Caminho inválido.');

  const parentDir = path.dirname(targetFile);
  await fsp.mkdir(parentDir, { recursive: true });
  await fsp.writeFile(targetFile, buffer);

  return { path: fileRelative, name: safeName };
}

function getDownloadPath(siteDir, relativePath) {
  const targetPath = resolveSafePath(siteDir, relativePath);
  if (!targetPath) return null;
  return targetPath;
}

module.exports = {
  listDirectory,
  createDirectory,
  deleteEntry,
  saveUploadedFile,
  getDownloadPath,
  validateUploadFile,
};
