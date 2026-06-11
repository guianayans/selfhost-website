const state = {
  user: null,
  sites: [],
  sitesDisplayPath: '/pendriver/website-manager/sites',
  currentView: 'sites',
  openRsyncSlug: null,
  openFilesSlug: null,
  filePaths: {},
  modalConfirmHandler: null,
};

const els = {
  loginScreen: document.getElementById('login-screen'),
  dashboard: document.getElementById('dashboard'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  logoutBtn: document.getElementById('logout-btn'),
  userLabel: document.getElementById('user-label'),
  pageTitle: document.getElementById('page-title'),
  pageSubtitle: document.getElementById('page-subtitle'),
  refreshBtn: document.getElementById('refresh-btn'),
  sitesList: document.getElementById('sites-list'),
  sitesEmpty: document.getElementById('sites-empty'),
  sitesTableWrap: document.querySelector('.sites-table-wrap'),
  statsRow: document.getElementById('stats-row'),
  settingsRoot: document.getElementById('settings-root'),
  settingsRootInternal: document.getElementById('settings-root-internal'),
  settingsDetected: document.getElementById('settings-detected'),
  settingsProject: document.getElementById('settings-project'),
  settingsUpload: document.getElementById('settings-upload'),
  settingsDomain: document.getElementById('settings-domain'),
  deployCommand: document.getElementById('deploy-command'),
  sitesEmptyHint: document.getElementById('sites-empty-hint'),
  toastContainer: document.getElementById('toast-container'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),
  modalConfirm: document.getElementById('modal-confirm'),
};

const views = {
  sites: document.getElementById('view-sites'),
  settings: document.getElementById('view-settings'),
};

function initBackground() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let cols = 0;
  let drops = [];
  const fontSize = 14;
  const chars = '01アイウエオカキクケコサシスセソタチツテト';

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.floor(canvas.width / fontSize);
    drops = Array.from({ length: cols }, () => Math.random() * -100);
  }

  function draw() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${fontSize}px JetBrains Mono, monospace`;

    for (let i = 0; i < cols; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;
      const brightness = Math.random();
      ctx.fillStyle = brightness > 0.95
        ? 'rgba(0, 255, 65, 0.8)'
        : `rgba(0, 255, 65, ${0.08 + brightness * 0.12})`;
      ctx.fillText(char, x, y);
      if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }

  resize();
  window.addEventListener('resize', resize);

  let running = true;
  function loop() {
    if (!running) return;
    draw();
    requestAnimationFrame(loop);
  }
  loop();

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) loop();
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

function formatSize(bytes) {
  if (bytes == null) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Erro na requisição.');
  }
  return data;
}

function setAuthUI(authenticated) {
  els.loginScreen.classList.toggle('hidden', authenticated);
  els.dashboard.classList.toggle('hidden', !authenticated);
}

function setView(view) {
  state.currentView = view;
  Object.entries(views).forEach(([key, element]) => {
    element.classList.toggle('hidden', key !== view);
  });
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  const titles = {
    sites: ['Sites', `Detectados automaticamente em ${state.sitesDisplayPath}`],
    settings: ['Configurações', 'Deploy, backup e ambiente'],
  };
  const [title, subtitle] = titles[view] || titles.sites;
  els.pageTitle.textContent = title;
  els.pageSubtitle.textContent = subtitle;
  els.statsRow.classList.toggle('hidden', view !== 'sites');
}

function openModal({ title, bodyHtml, confirmText = 'Confirmar', onConfirm }) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = bodyHtml;
  els.modalConfirm.textContent = `[ ${confirmText.toLowerCase()} ]`;
  state.modalConfirmHandler = onConfirm;
  els.modal.classList.remove('hidden');
}

function closeModal() {
  els.modal.classList.add('hidden');
  state.modalConfirmHandler = null;
}

function renderRsyncBox(site) {
  const rsync = site.rsync || {
    command: site.rsyncCommand,
    localPath: '',
    remotePath: '',
    slug: site.slug,
  };

  return `
    <div class="rsync-box">
      <div class="rsync-head">
        <div>
          <label>Publicar via rsync</label>
          <p>Ou envie o projeto inteiro — pastas em <code>sites/</code> sobem junto.</p>
        </div>
        <button class="btn btn-secondary btn-sm rsync-copy-btn" data-copy-text="${escapeAttr(rsync.command)}" type="button">
          [ copiar ]
        </button>
      </div>
      <div class="rsync-paths">
        <div class="rsync-path-item">
          <span class="rsync-path-label">Local (Mac)</span>
          <code>${escapeHtml(rsync.localPath)}</code>
        </div>
        <div class="rsync-path-item">
          <span class="rsync-path-label">Remoto (servidor)</span>
          <code>${escapeHtml(rsync.remotePath)}</code>
        </div>
      </div>
      <div class="rsync-terminal" tabindex="0" aria-label="Comando rsync">
        <div class="rsync-terminal-bar">
          <span></span><span></span><span></span>
          <em>rsync · zsh</em>
        </div>
        <pre class="rsync-command"><code><span class="cmd-prefix">$</span> <span class="cmd-tool">sshpass</span> <span class="cmd-flag">-p</span> <span class="cmd-string">'senha'</span> <span class="cmd-tool">rsync</span> <span class="cmd-flag">-avz --delete</span> \\
<span class="cmd-indent">  </span><span class="cmd-flag">-e</span> <span class="cmd-string">"ssh -o StrictHostKeyChecking=no"</span> \\
<span class="cmd-indent">  </span><span class="cmd-path-local">${escapeHtml(rsync.localPath)}</span> \\
<span class="cmd-indent">  </span><span class="cmd-path-remote">${escapeHtml(rsync.remotePath)}</span></code></pre>
      </div>
      <p class="rsync-hint">Substitua <strong>'senha'</strong> pela sua senha SSH real.</p>
    </div>
  `;
}

function renderFilesPanel(site) {
  return `
    <div class="files-inline">
      <div class="files-inline-toolbar">
        <div>
          <strong class="files-inline-title">Arquivos — ${escapeHtml(site.name)}</strong>
          <p class="files-inline-path">${escapeHtml(state.sitesDisplayPath)}/${escapeHtml(site.slug)}</p>
        </div>
        <div class="files-inline-actions">
          <button class="btn btn-secondary btn-sm" data-mkdir="${escapeAttr(site.slug)}" type="button">[ nova pasta ]</button>
          <label class="btn btn-primary btn-sm upload-label">
            [ upload ]
            <input type="file" data-upload="${escapeAttr(site.slug)}" multiple hidden>
          </label>
        </div>
      </div>
      <div class="panel-card files-panel-inner">
        <div class="breadcrumb" id="files-breadcrumb-${escapeAttr(site.slug)}"></div>
        <div class="files-table-head">
          <span>Nome</span>
          <span>Tipo</span>
          <span>Modificado</span>
          <span>Ações</span>
        </div>
        <div class="files-list" id="files-list-${escapeAttr(site.slug)}"></div>
        <div class="files-empty hidden" id="files-empty-${escapeAttr(site.slug)}">
          <p>Esta pasta está vazia. Faça upload de arquivos ou crie subpastas.</p>
        </div>
      </div>
    </div>
  `;
}

function renderStats() {
  const online = state.sites.filter((s) => s.hasIndex).length;
  const offline = state.sites.length - online;
  const total = state.sites.length;

  els.statsRow.innerHTML = `
    <span class="stat-item online">${online} ONLINE</span>
    ${offline > 0 ? `<span class="stat-item warning">${offline} SEM INDEX</span>` : ''}
    <span class="stat-item total">${total} TOTAL</span>
  `;
}

function updateEmptyStateHint() {
  const path = state.sitesDisplayPath;
  els.sitesEmptyHint.innerHTML = `Crie <code>${path}/meu-site/index.html</code> no servidor (via rsync do Mac) e clique em <strong>[ atualizar ]</strong>.`;
}

function togglePanel(type, slug) {
  const isRsync = type === 'rsync';
  const panelId = isRsync ? `detail-rsync-${slug}` : `detail-files-${slug}`;
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const stateKey = isRsync ? 'openRsyncSlug' : 'openFilesSlug';
  const btnSelector = isRsync ? `[data-toggle-rsync="${slug}"]` : `[data-toggle-files="${slug}"]`;
  const btn = document.querySelector(btnSelector);

  if (state[stateKey] === slug) {
    state[stateKey] = null;
    panel.classList.add('hidden-detail');
    btn?.classList.remove('open');
    return;
  }

  if (state[stateKey]) {
    const prevPanel = document.getElementById(
      isRsync ? `detail-rsync-${state[stateKey]}` : `detail-files-${state[stateKey]}`
    );
    const prevBtn = document.querySelector(
      isRsync ? `[data-toggle-rsync="${state[stateKey]}"]` : `[data-toggle-files="${state[stateKey]}"]`
    );
    prevPanel?.classList.add('hidden-detail');
    prevBtn?.classList.remove('open');
  }

  state[stateKey] = slug;
  panel.classList.remove('hidden-detail');
  btn?.classList.add('open');

  if (!isRsync) {
    if (!state.filePaths[slug]) state.filePaths[slug] = '';
    loadFiles(slug);
  }
}

function restoreOpenPanels() {
  if (state.openRsyncSlug) {
    const panel = document.getElementById(`detail-rsync-${state.openRsyncSlug}`);
    const btn = document.querySelector(`[data-toggle-rsync="${state.openRsyncSlug}"]`);
    if (panel) {
      panel.classList.remove('hidden-detail');
      btn?.classList.add('open');
    } else {
      state.openRsyncSlug = null;
    }
  }

  if (state.openFilesSlug) {
    const panel = document.getElementById(`detail-files-${state.openFilesSlug}`);
    const btn = document.querySelector(`[data-toggle-files="${state.openFilesSlug}"]`);
    if (panel) {
      panel.classList.remove('hidden-detail');
      btn?.classList.add('open');
      loadFiles(state.openFilesSlug);
    } else {
      state.openFilesSlug = null;
    }
  }
}

function renderSites() {
  const prevRsync = state.openRsyncSlug;
  const prevFiles = state.openFilesSlug;

  els.sitesList.innerHTML = '';
  const hasSites = state.sites.length > 0;
  els.sitesEmpty.classList.toggle('hidden', hasSites);
  if (els.sitesTableWrap) els.sitesTableWrap.classList.toggle('hidden', !hasSites);
  updateEmptyStateHint();
  renderStats();

  state.sites.forEach((site, index) => {
    const row = document.createElement('article');
    row.className = 'site-row';
    row.style.animationDelay = `${index * 0.05}s`;
    row.innerHTML = `
      <div class="site-row-main">
        <div class="site-name">
          <strong>${escapeHtml(site.name)}</strong>
          <span>slug: ${escapeHtml(site.slug)}</span>
        </div>
        <div class="site-col">${formatDate(site.modifiedAt)}</div>
        <div class="site-col">${escapeHtml(site.sizeLabel)}</div>
        <div class="site-col">
          <span class="badge ${site.hasIndex ? '' : 'warning'}">${site.hasIndex ? 'ONLINE' : 'SEM INDEX'}</span>
        </div>
        <div class="site-actions">
          <a class="btn btn-primary btn-sm" href="${escapeHtml(site.publicUrl)}" target="_blank" rel="noopener">[ abrir ]</a>
          <button class="btn btn-secondary btn-sm toggle-detail" data-toggle-files="${escapeAttr(site.slug)}" type="button">[ arquivos ]</button>
          <button class="btn btn-secondary btn-sm toggle-detail" data-toggle-rsync="${escapeAttr(site.slug)}" type="button">[ rsync ]</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-slug="${escapeAttr(site.slug)}" data-name="${escapeAttr(site.name)}">[ excluir ]</button>
        </div>
      </div>
      <div class="site-row-detail hidden-detail" id="detail-files-${escapeAttr(site.slug)}">
        ${renderFilesPanel(site)}
      </div>
      <div class="site-row-detail hidden-detail" id="detail-rsync-${escapeAttr(site.slug)}">
        <div class="site-col" style="margin-bottom:0.5rem">
          URL: <a href="${escapeHtml(site.publicUrl)}" target="_blank" rel="noopener">${escapeHtml(window.location.origin + site.publicUrl)}</a>
        </div>
        ${renderRsyncBox(site)}
      </div>
    `;
    els.sitesList.appendChild(row);
  });

  state.openRsyncSlug = prevRsync;
  state.openFilesSlug = prevFiles;
  restoreOpenPanels();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

async function loadSites() {
  const data = await api('/api/sites');
  state.sites = data.sites || [];
  renderSites();
}

async function loadMe() {
  try {
    const me = await api('/api/me');
    state.user = me;
    state.sitesDisplayPath = me.sitesDisplayPath || '/pendriver/website-manager/sites';
    els.userLabel.textContent = me.username;
    els.settingsRoot.textContent = me.sitesDisplayPath;
    els.settingsRootInternal.textContent = me.sitesRoot || '—';
    els.settingsDetected.textContent = me.detectedSlugs?.length
      ? me.detectedSlugs.join(', ')
      : `(nenhum — pasta ${me.sitesRootExists ? 'existe' : 'NÃO existe'})`;
    els.settingsProject.textContent = me.projectDisplayPath || '/pendriver/website-manager';
    els.settingsUpload.textContent = `${me.maxUploadMb} MB`;
    els.settingsDomain.textContent = me.domain || window.location.origin;
    if (me.projectRsync?.command) {
      els.deployCommand.textContent = me.projectRsync.command;
    }
    setAuthUI(true);
    setView('sites');
    await loadSites();
  } catch {
    setAuthUI(false);
  }
}

async function deleteSite(slug, name) {
  await api(`/api/sites/${encodeURIComponent(slug)}`, { method: 'DELETE' });
  showToast(`Site "${name}" excluído.`);
  if (state.openFilesSlug === slug) state.openFilesSlug = null;
  if (state.openRsyncSlug === slug) state.openRsyncSlug = null;
  delete state.filePaths[slug];
  await loadSites();
}

async function loadFiles(slug) {
  const currentPath = state.filePaths[slug] || '';
  const query = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
  const data = await api(`/api/sites/${encodeURIComponent(slug)}/files${query}`);
  renderFiles(data, slug);
}

function renderFiles(data, slug) {
  const currentPath = data.path || '';
  state.filePaths[slug] = currentPath;

  const breadcrumb = document.getElementById(`files-breadcrumb-${slug}`);
  const filesList = document.getElementById(`files-list-${slug}`);
  const filesEmpty = document.getElementById(`files-empty-${slug}`);
  if (!breadcrumb || !filesList || !filesEmpty) return;

  breadcrumb.innerHTML = '';
  const parts = currentPath ? currentPath.split('/') : [];
  const rootBtn = document.createElement('button');
  rootBtn.textContent = '/';
  rootBtn.addEventListener('click', () => {
    state.filePaths[slug] = '';
    loadFiles(slug);
  });
  breadcrumb.appendChild(rootBtn);

  let cumulative = '';
  parts.forEach((part) => {
    const sep = document.createElement('span');
    sep.textContent = ' / ';
    breadcrumb.appendChild(sep);
    cumulative = cumulative ? `${cumulative}/${part}` : part;
    const btn = document.createElement('button');
    btn.textContent = part;
    btn.addEventListener('click', () => {
      state.filePaths[slug] = cumulative;
      loadFiles(slug);
    });
    breadcrumb.appendChild(btn);
  });

  filesList.innerHTML = '';
  const items = data.items || [];
  filesEmpty.classList.toggle('hidden', items.length > 0);

  items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.style.animationDelay = `${index * 0.03}s`;
    row.innerHTML = `
      <div><strong>${escapeHtml(item.name)}</strong></div>
      <span class="file-type">${item.type === 'directory' ? '📁 DIR' : '📄 FILE'}</span>
      <span class="file-date">${formatDate(item.modifiedAt)}</span>
      <div class="site-actions"></div>
    `;

    const actions = row.querySelector('.site-actions');
    if (item.type === 'directory') {
      const openBtn = document.createElement('button');
      openBtn.className = 'btn btn-secondary btn-sm';
      openBtn.textContent = '[ abrir ]';
      openBtn.addEventListener('click', () => {
        state.filePaths[slug] = item.path;
        loadFiles(slug);
      });
      actions.appendChild(openBtn);
    } else {
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn btn-secondary btn-sm';
      downloadBtn.textContent = '[ download ]';
      downloadBtn.addEventListener('click', () => {
        const url = `/api/sites/${encodeURIComponent(slug)}/files/download?path=${encodeURIComponent(item.path)}`;
        window.open(url, '_blank');
      });
      actions.appendChild(downloadBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-sm';
    deleteBtn.textContent = '[ excluir ]';
    deleteBtn.addEventListener('click', () => {
      openModal({
        title: 'excluir item',
        bodyHtml: `<p>Deseja excluir <strong>${escapeHtml(item.name)}</strong>?</p>`,
        confirmText: 'Excluir',
        onConfirm: async () => {
          await api(`/api/sites/${encodeURIComponent(slug)}/files`, {
            method: 'DELETE',
            body: { path: item.path },
          });
          closeModal();
          showToast('Item excluído.');
          loadFiles(slug);
        },
      });
    });
    actions.appendChild(deleteBtn);

    filesList.appendChild(row);
  });
}

async function uploadFiles(slug, fileList) {
  if (!fileList.length) return;
  const formData = new FormData();
  Array.from(fileList).forEach((file) => formData.append('files', file));
  formData.append('path', state.filePaths[slug] || '');

  await api(`/api/sites/${encodeURIComponent(slug)}/files/upload`, {
    method: 'POST',
    body: formData,
  });
  showToast('Upload concluído.');
  loadFiles(slug);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(
    () => showToast('Copiado para a área de transferência.'),
    () => showToast('Não foi possível copiar.', 'error')
  );
}

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.loginError.classList.add('hidden');
  try {
    await api('/api/login', {
      method: 'POST',
      body: {
        username: document.getElementById('login-user').value.trim(),
        password: document.getElementById('login-password').value,
      },
    });
    await loadMe();
  } catch (err) {
    els.loginError.textContent = `✗ ${err.message}`;
    els.loginError.classList.remove('hidden');
  }
});

els.logoutBtn.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  state.user = null;
  setAuthUI(false);
});

els.refreshBtn.addEventListener('click', async () => {
  try {
    await loadSites();
    showToast('Lista atualizada.');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    setView(btn.dataset.view);
    if (btn.dataset.view === 'sites') loadSites();
  });
});

els.sitesList.addEventListener('click', (event) => {
  const rsyncBtn = event.target.closest('[data-toggle-rsync]');
  if (rsyncBtn) {
    togglePanel('rsync', rsyncBtn.dataset.toggleRsync);
    return;
  }

  const filesBtn = event.target.closest('[data-toggle-files]');
  if (filesBtn) {
    togglePanel('files', filesBtn.dataset.toggleFiles);
    return;
  }

  const mkdirBtn = event.target.closest('[data-mkdir]');
  if (mkdirBtn) {
    const slug = mkdirBtn.dataset.mkdir;
    openModal({
      title: 'nova pasta',
      bodyHtml: `
        <label>
          <span class="label-prefix">&gt; nome</span>
          <input type="text" id="mkdir-name" placeholder="assets">
        </label>
      `,
      confirmText: 'Criar pasta',
      onConfirm: async () => {
        const name = document.getElementById('mkdir-name').value.trim();
        if (!name) return;
        try {
          await api(`/api/sites/${encodeURIComponent(slug)}/files/mkdir`, {
            method: 'POST',
            body: { path: state.filePaths[slug] || '', name },
          });
          closeModal();
          showToast('Pasta criada.');
          loadFiles(slug);
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
    });
    return;
  }

  const target = event.target.closest('[data-action], [data-copy-text]');
  if (!target) return;

  if (target.dataset.copyText) {
    copyText(target.dataset.copyText);
    return;
  }

  const slug = target.dataset.slug;
  if (target.dataset.action === 'delete') {
    openModal({
      title: 'excluir site',
      bodyHtml: `<p>Deseja excluir o site <strong>${escapeHtml(target.dataset.name)}</strong> e todos os arquivos em sites/${escapeHtml(slug)}?</p>`,
      confirmText: 'Excluir site',
      onConfirm: async () => {
        try {
          await deleteSite(slug, target.dataset.name);
          closeModal();
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
    });
  }
});

els.sitesList.addEventListener('change', async (event) => {
  const input = event.target.closest('[data-upload]');
  if (!input?.files?.length) return;
  const slug = input.dataset.upload;
  try {
    await uploadFiles(slug, input.files);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    input.value = '';
  }
});

document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const selector = btn.dataset.copy;
    const el = document.querySelector(selector);
    if (el) copyText(el.textContent.trim());
  });
});

document.querySelectorAll('[data-close-modal]').forEach((el) => {
  el.addEventListener('click', closeModal);
});

els.modalConfirm.addEventListener('click', async () => {
  if (typeof state.modalConfirmHandler === 'function') {
    await state.modalConfirmHandler();
  }
});

initBackground();
loadMe();
