import * as Core from './core_v1.0.1.js';
import * as VIZ from './bio_visuals_v1.0.1.js';

const METHOD_CONFIG = {
  'golden-gate': {
    htmlPath: 'modules/Golden_Gate_v1.0.1.html',
    vectorSelector: '#gg-vector',
    mode: 'multi',
    presentation: 'full-module',
    maxInsertCount: 6,
    demoButtonSelector: '#demo-set-btn',
    resetButtonSelector: '#global-reset',
    listContainerSelector: '#frag-list',
    addButtonSelector: '#frag-add',
    rowSelector: '.frag-row',
    sequenceSelector: '.frag-seq',
    removeButtonSelector: '.del',
    hideSelectors: ['#gg-clear', '#demo-set-btn', '#global-reset'],
    init: async (host) => {
      await import('./golden_gate_v1.0.1.js');
      if (window.initGoldenGate) window.initGoldenGate(host);
    }
  },
  'gibson': {
    htmlPath: 'modules/Gibson_V1.0.1.html',
    vectorSelector: '#vector-seq',
    mode: 'multi',
    presentation: 'full-module',
    maxInsertCount: 6,
    demoButtonSelector: '#demo-set-btn',
    resetButtonSelector: '#global-reset',
    listContainerSelector: '#inserts-container',
    addButtonSelector: '#add-insert-btn',
    rowSelector: '.insert-row',
    sequenceSelector: '.insert-seq',
    removeButtonSelector: '.remove-insert-btn',
    hideSelectors: ['#clear-btn', '#demo-set-btn', '#global-reset'],
    init: async (host) => {
      await import('./gibson_v1.0.1.js');
      if (window.initGibsonModule) window.initGibsonModule(host);
    }
  },
  'restriction': {
    htmlPath: 'modules/RE_cloning_v1.0.1.html',
    vectorSelector: '#gg-vector',
    mode: 'single',
    presentation: 'full-module',
    maxInsertCount: 1,
    demoButtonSelector: '#gg-demo-set',
    resetButtonSelector: '#global-reset',
    insertSelector: '.insert-seq',
    hideSelectors: ['#gg-clear', '#gg-demo-set', '#global-reset'],
    init: async (host) => {
      const mod = await import('./re_cloning_v1.0.1.js');
      if (mod && typeof mod.initRECloning === 'function') {
        mod.initRECloning(host);
      }
    }
  },
  'user': {
    htmlPath: 'modules/USER_V1.0.1.html',
    vectorSelector: '#vector-seq',
    mode: 'multi',
    presentation: 'full-module',
    maxInsertCount: 3,
    demoButtonSelector: '#user-demo-set',
    resetButtonSelector: '#global-reset',
    listContainerSelector: '#inserts-container',
    addButtonSelector: '#add-insert-btn',
    rowSelector: '.insert-row',
    sequenceSelector: '.insert-seq',
    removeButtonSelector: '.remove-insert-btn',
    hideSelectors: ['#clear-btn', '#user-demo-set', '#global-reset'],
    init: async (host) => {
      await import('./user_cloning_v1.0.1.js');
      if (window.initUSERModule) window.initUSERModule(host);
    }
  }
};

const COMMON_FEATURES_SRC = './modules/scripts/common_features_v1.0.1.js';
const WORKSPACE_DRAFT_STORAGE_KEY = 'primerweaver_workspace_shared_sequences_v1';

function getSharedMethodCache() {
  if (!window.__PRIMERWEAVER_WORKSPACE_METHOD_CACHE) {
    window.__PRIMERWEAVER_WORKSPACE_METHOD_CACHE = new Map();
  }
  return window.__PRIMERWEAVER_WORKSPACE_METHOD_CACHE;
}

function getWorkspaceState(container) {
  if (!container.__workspaceState) {
    container.__workspaceState = {
      cache: getSharedMethodCache(),
      renderToken: 0,
      syncingFromWorkspace: false,
      syncingFromMethod: false
    };
  }
  return container.__workspaceState;
}

function readWorkspaceDraft() {
  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_DRAFT_STORAGE_KEY);
    if (!raw) return { vector: '', insert: '' };
    const parsed = JSON.parse(raw);
    return {
      vector: typeof parsed.vector === 'string' ? parsed.vector : '',
      insert: typeof parsed.insert === 'string' ? parsed.insert : ''
    };
  } catch (_) {
    return { vector: '', insert: '' };
  }
}

function writeWorkspaceDraft(vector, insert) {
  try {
    window.sessionStorage.setItem(WORKSPACE_DRAFT_STORAGE_KEY, JSON.stringify({
      vector: typeof vector === 'string' ? vector : '',
      insert: typeof insert === 'string' ? insert : ''
    }));
  } catch (_) {
    // Ignore storage failures; the workspace still functions without persistence.
  }
}

function parseFastaRecords(raw) {
  return Core.parseFASTA(String(raw || '')).map((record) => ({
    header: String(record.header || ''),
    seq: String(record.seq || '')
  }));
}

function stringifyRecord(record, fallbackHeader) {
  const seq = String(record && record.seq ? record.seq : '').trim();
  if (!seq) return '';
  const header = String(record && record.header ? record.header : fallbackHeader || '').trim();
  return header ? ('>' + header + '\n' + seq) : seq;
}

function dispatchValueEvents(element) {
  if (!element) return;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function setFieldValue(element, value) {
  if (!element) return;
  element.value = value;
  dispatchValueEvents(element);
}

function getReverseComplement(seq) {
  const map = {
    A: 'T', T: 'A', C: 'G', G: 'C',
    R: 'Y', Y: 'R', S: 'S', W: 'W',
    K: 'M', M: 'K', B: 'V', V: 'B',
    D: 'H', H: 'D', N: 'N', U: 'A'
  };
  const chars = String(seq || '').toUpperCase().replace(/\s+/g, '').split('');
  const out = [];
  for (let i = chars.length - 1; i >= 0; i--) {
    out.push(map[chars[i]] || chars[i]);
  }
  return out.join('');
}

function reverseComplementFasta(raw) {
  const records = parseFastaRecords(raw);
  if (!records.length) return '';
  return records.map((record, index) => {
    const header = record.header || ('sequence' + (index + 1));
    return '>' + header + '\n' + getReverseComplement(record.seq);
  }).join('\n');
}

function ensureCommonFeaturesLoaded() {
  if (Array.isArray(window.COMMON_FEATURES)) return Promise.resolve(window.COMMON_FEATURES);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${COMMON_FEATURES_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.COMMON_FEATURES || []), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load common features DB')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = COMMON_FEATURES_SRC;
    script.async = true;
    script.onload = () => resolve(window.COMMON_FEATURES || []);
    script.onerror = () => reject(new Error('Failed to load common features DB'));
    document.head.appendChild(script);
  });
}

async function fetchModuleHtml(htmlPath) {
  const response = await fetch(htmlPath);
  if (!response.ok) throw new Error('Failed to load module HTML');
  return response.text();
}

function applyMethodPresentation(host, method) {
  const config = METHOD_CONFIG[method];
  if (!config) return;

  const pane = host.querySelector('.pane');
  if (pane) {
    pane.classList.remove('workspace-mode-hide-vector', 'workspace-mode-restriction');
  }

  if (config.hideSelectors) {
    config.hideSelectors.forEach((selector) => {
      const el = host.querySelector(selector);
      if (el) el.style.display = 'none';
    });
  }
}

function setPlaceholderVisibility(container, visible) {
  const placeholder = container.querySelector('#workspace-placeholder');
  const host = container.querySelector('#workspace-method-host');
  if (placeholder) placeholder.hidden = !visible;
  if (host) host.style.display = visible ? 'none' : '';
}

function truncateToFirstInsert(raw) {
  const records = parseFastaRecords(raw);
  if (!records.length) return '';
  return stringifyRecord(records[0], 'insert1');
}

async function handleMethodChange(container, nextMethod) {
  const methodSelect = container.querySelector('#workspace-method');
  const insertInput = container.querySelector('#workspace-insert');
  const previousMethod = container.dataset.activeMethod || '';

  syncWorkspaceFromMethod(container);

  const config = METHOD_CONFIG[nextMethod];
  const currentInsertValue = insertInput?.value || '';
  const recordCount = parseFastaRecords(currentInsertValue).length;
  const maxInsertCount = config && typeof config.maxInsertCount === 'number'
    ? config.maxInsertCount
    : Number.POSITIVE_INFINITY;

  if (config && recordCount > maxInsertCount) {
    const confirmed = await confirmWorkspaceMW(
      container,
      `The selected cloning method supports up to ${maxInsertCount} insert${maxInsertCount === 1 ? '' : 's'}, but the current input contains ${recordCount} inserts.\n\nClick Cancel to keep the current method, or OK to continue and keep only the first insert sequence.`
    );

    if (!confirmed) {
      if (methodSelect) methodSelect.value = previousMethod;
      return;
    }

    if (insertInput) {
      insertInput.value = truncateToFirstInsert(currentInsertValue);
      dispatchValueEvents(insertInput);
      writeWorkspaceDraft(container.querySelector('#workspace-vector')?.value || '', insertInput.value);
    }
  }

  renderMethod(container, nextMethod);
}

function setVisibleMethodPane(host, method) {
  const panes = host.querySelectorAll('.workspace-method-pane');
  panes.forEach((pane) => {
    pane.classList.toggle('workspace-pane-hidden', pane.dataset.method !== method);
  });
}

function detachMethodPanes(host) {
  if (!host) return;
  host.querySelectorAll('.workspace-method-pane').forEach((pane) => pane.remove());
}

function getLoadingBox(host) {
  let box = host.querySelector('.workspace-loading-box');
  if (!box) {
    box = document.createElement('div');
    box.className = 'box workspace-loading-box workspace-pane-hidden';
    box.innerHTML = '<p class="small muted" style="margin:0;">Loading method workspace...</p>';
    host.appendChild(box);
  }
  return box;
}

function getActiveMethodPane(host, method) {
  return host.querySelector(`.workspace-method-pane[data-method="${method}"]`);
}

function ensureMultiRowCount(host, config, count) {
  const desiredCount = Math.max(count, 1);
  const listContainer = host.querySelector(config.listContainerSelector);
  const addButton = host.querySelector(config.addButtonSelector);
  if (!listContainer || !addButton) return;

  let rows = Array.from(listContainer.querySelectorAll(config.rowSelector));
  while (rows.length < desiredCount) {
    addButton.click();
    rows = Array.from(listContainer.querySelectorAll(config.rowSelector));
  }

  while (rows.length > desiredCount) {
    const lastRow = rows[rows.length - 1];
    const removeButton = lastRow && lastRow.querySelector(config.removeButtonSelector);
    if (!removeButton) break;
    removeButton.click();
    rows = Array.from(listContainer.querySelectorAll(config.rowSelector));
  }
}

function serializeMethodInsertValue(methodPane, config) {
  if (config.mode === 'single') {
    return methodPane.querySelector(config.insertSelector)?.value || '';
  }

  return Array.from(methodPane.querySelectorAll(config.rowSelector))
    .map((row) => row.querySelector(config.sequenceSelector)?.value || '')
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n');
}

function triggerMethodRefresh(methodPane) {
  if (!methodPane || typeof methodPane.__workspaceRefresh !== 'function') return;
  try {
    methodPane.__workspaceRefresh();
  } catch (error) {
    console.warn('Workspace refresh hook failed:', error);
  }
}

function syncMethodInputs(container) {
  const state = getWorkspaceState(container);
  if (state.syncingFromMethod) return;

  const method = container.dataset.activeMethod || '';
  const config = METHOD_CONFIG[method];
  if (!config) return;

  const host = container.querySelector('#workspace-method-host');
  if (!host) return;

  const methodPane = getActiveMethodPane(host, method);
  if (!methodPane) return;

  const vectorValue = container.querySelector('#workspace-vector')?.value || '';
  const insertValue = container.querySelector('#workspace-insert')?.value || '';

  state.syncingFromWorkspace = true;
  try {
    const vectorField = methodPane.querySelector(config.vectorSelector);
    if (vectorField) setFieldValue(vectorField, vectorValue);

    if (config.mode === 'single') {
      const insertField = methodPane.querySelector(config.insertSelector);
      if (insertField) setFieldValue(insertField, insertValue);
      applyMethodPresentation(methodPane, method);
      triggerMethodRefresh(methodPane);
      return;
    }

    const records = parseFastaRecords(insertValue);
    ensureMultiRowCount(methodPane, config, records.length);
    const rows = Array.from(methodPane.querySelectorAll(config.rowSelector));
    for (let i = 0; i < rows.length; i++) {
      const textarea = rows[i].querySelector(config.sequenceSelector);
      const record = records[i];
      setFieldValue(textarea, record ? stringifyRecord(record, 'insert' + (i + 1)) : '');
    }
    applyMethodPresentation(methodPane, method);
    triggerMethodRefresh(methodPane);
  } finally {
    state.syncingFromWorkspace = false;
  }
}

function syncWorkspaceFromMethod(container) {
  const state = getWorkspaceState(container);
  if (state.syncingFromWorkspace) return;

  const method = container.dataset.activeMethod || '';
  const config = METHOD_CONFIG[method];
  if (!config) return;

  const host = container.querySelector('#workspace-method-host');
  if (!host) return;

  const methodPane = getActiveMethodPane(host, method);
  if (!methodPane) return;

  const vectorInput = container.querySelector('#workspace-vector');
  const insertInput = container.querySelector('#workspace-insert');
  const vectorValue = methodPane.querySelector(config.vectorSelector)?.value || '';
  const insertValue = serializeMethodInsertValue(methodPane, config);

  state.syncingFromMethod = true;
  try {
    if (vectorInput && vectorInput.value !== vectorValue) {
      vectorInput.value = vectorValue;
      dispatchValueEvents(vectorInput);
    }
    if (insertInput && insertInput.value !== insertValue) {
      insertInput.value = insertValue;
      dispatchValueEvents(insertInput);
    }
    writeWorkspaceDraft(vectorValue, insertValue);
  } finally {
    state.syncingFromMethod = false;
  }
}

function bindMethodPaneSync(container, method, methodPane) {
  if (!methodPane) return;
  methodPane.__workspaceSyncContainer = container;

  if (methodPane.__workspaceSyncBound) return;
  methodPane.__workspaceSyncBound = true;

  let syncTimer = null;
  const scheduleSyncBack = () => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      syncWorkspaceFromMethod(methodPane.__workspaceSyncContainer);
    }, 0);
  };

  methodPane.addEventListener('input', scheduleSyncBack, true);
  methodPane.addEventListener('change', scheduleSyncBack, true);
  methodPane.addEventListener('click', scheduleSyncBack, true);

  const config = METHOD_CONFIG[method];
  const listContainer = config && config.listContainerSelector
    ? methodPane.querySelector(config.listContainerSelector)
    : null;
  if (listContainer && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(scheduleSyncBack);
    observer.observe(listContainer, { childList: true, subtree: true });
    methodPane.__workspaceSyncObserver = observer;
  }
}

function ensureWorkspaceMWModal(container) {
  let modal = container.querySelector('#mw-modal');
  if (modal) return modal;

  if (!document.getElementById('workspace-mw-fallback-style')) {
    const style = document.createElement('style');
    style.id = 'workspace-mw-fallback-style';
    style.textContent = `
      #mw-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .mw-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }
      .mw-modal-content {
        position: relative;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: mwModalSlideIn 0.3s ease-out;
      }
      @keyframes mwModalSlideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .mw-modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px 24px;
        background: #fff7ed;
        border-bottom: 1px solid #fde68a;
      }
      .mw-warning-icon {
        font-size: 1.5rem;
        line-height: 1;
      }
      .mw-modal-header h3 {
        margin: 0;
        font-size: 1.2rem;
        color: #92400e;
        font-weight: 600;
      }
      .mw-modal-body {
        padding: 24px;
        flex: 1;
        overflow-y: auto;
      }
      .mw-modal-body p {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.6;
        color: #374151;
        white-space: pre-line;
      }
      .mw-modal-footer {
        padding: 16px 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background: #f9fafb;
      }
      .mw-modal-footer .btn {
        min-width: 80px;
      }
      .mw-modal-footer .btn.ghost {
        background: #e5e7eb;
        color: #374151;
      }
      .mw-modal-footer .btn.ghost:hover {
        background: #d1d5db;
      }
      .mw-modal-footer .btn:not(.ghost) {
        background: #3b82f6;
        color: white;
      }
      .mw-modal-footer .btn:not(.ghost):hover {
        background: #2563eb;
      }
    `;
    document.head.appendChild(style);
  }

  modal = document.createElement('div');
  modal.id = 'mw-modal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="mw-modal-overlay"></div>
    <div class="mw-modal-content" role="dialog" aria-modal="true" aria-labelledby="mw-modal-title">
      <div class="mw-modal-header">
        <span class="mw-warning-icon">⚠️</span>
        <h3 id="mw-modal-title">Warning</h3>
      </div>
      <div class="mw-modal-body">
        <p id="mw-message"></p>
      </div>
      <div class="mw-modal-footer">
        <button type="button" class="btn ghost" id="mw-cancel-btn">Cancel</button>
        <button type="button" class="btn" id="mw-confirm-btn">OK</button>
      </div>
    </div>
  `;

  modal.__workspaceClose = () => {
    modal.style.display = 'none';
    modal.__workspaceOnConfirm = null;
    modal.__workspaceOnCancel = null;
  };

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.style.display !== 'none') {
      if (typeof modal.__workspaceOnCancel === 'function') {
        const onCancel = modal.__workspaceOnCancel;
        modal.__workspaceClose();
        onCancel();
      } else {
        modal.__workspaceClose();
      }
    }
  });

  (container || document.body).appendChild(modal);
  return modal;
}

function openWorkspaceMWModal(container, message, options = {}) {
  const modal = ensureWorkspaceMWModal(container);
  const messageEl = modal.querySelector('#mw-message');
  const overlay = modal.querySelector('.mw-modal-overlay');
  const cancelBtn = modal.querySelector('#mw-cancel-btn');
  const confirmBtn = modal.querySelector('#mw-confirm-btn');
  const onConfirm = typeof options.onConfirm === 'function' ? options.onConfirm : () => {};
  const onCancel = typeof options.onCancel === 'function' ? options.onCancel : () => {};
  const showCancel = options.showCancel !== false;

  if (messageEl) messageEl.textContent = message || '';
  if (cancelBtn) cancelBtn.style.display = showCancel ? '' : 'none';

  modal.__workspaceOnConfirm = onConfirm;
  modal.__workspaceOnCancel = onCancel;

  if (overlay) {
    overlay.onclick = () => {
      modal.__workspaceClose();
      onCancel();
    };
  }
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      modal.__workspaceClose();
      onCancel();
    };
  }
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      modal.__workspaceClose();
      onConfirm();
    };
  }

  modal.style.display = 'flex';
  if (confirmBtn) confirmBtn.focus();
}

function showWorkspaceMW(container, message) {
  if (window.VIZ && typeof window.VIZ.showMWModal === 'function') {
    window.VIZ.showMWModal(container, message || '', () => {}, () => {});
    return;
  }
  openWorkspaceMWModal(container, message, { showCancel: false });
}

function confirmWorkspaceMW(container, message) {
  return new Promise((resolve) => {
    if (window.VIZ && typeof window.VIZ.showMWModal === 'function') {
      window.VIZ.showMWModal(container, message || '', () => resolve(true), () => resolve(false));
      return;
    }
    openWorkspaceMWModal(container, message, {
      showCancel: true,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}

function triggerActiveMethodButton(container, buttonKey) {
  const method = container.dataset.activeMethod || '';
  const config = METHOD_CONFIG[method];
  if (!config) {
    showWorkspaceMW(container, 'Please select a cloning method first.');
    return;
  }

  const host = container.querySelector('#workspace-method-host');
  const methodPane = host ? getActiveMethodPane(host, method) : null;
  const selector = config[buttonKey];
  const targetButton = methodPane && selector
    ? methodPane.querySelector(selector)
    : null;

  if (!targetButton) {
    const actionLabel = buttonKey === 'resetButtonSelector' ? 'Reset' : 'Demo Set';
    showWorkspaceMW(container, `${actionLabel} is not available for the selected cloning method.`);
    return;
  }

  targetButton.click();
}

async function renderMethod(container, method) {
  const state = getWorkspaceState(container);
  const host = container.querySelector('#workspace-method-host');
  if (!host) return;

  const loadingBox = getLoadingBox(host);
  host.querySelectorAll('.workspace-method-error').forEach((node) => node.remove());
  const token = ++state.renderToken;

  if (!method || !METHOD_CONFIG[method]) {
    container.dataset.activeMethod = '';
    setPlaceholderVisibility(container, true);
    detachMethodPanes(host);
    setVisibleMethodPane(host, '');
    loadingBox.classList.add('workspace-pane-hidden');
    return;
  }

  const config = METHOD_CONFIG[method];
  container.dataset.activeMethod = method;
  setPlaceholderVisibility(container, false);

  if (state.cache.has(method)) {
    const cachedPane = state.cache.get(method);
    detachMethodPanes(host);
    if (cachedPane && cachedPane.parentNode !== host) {
      host.appendChild(cachedPane);
    }
    bindMethodPaneSync(container, method, cachedPane);
    setVisibleMethodPane(host, method);
    loadingBox.classList.add('workspace-pane-hidden');
    syncMethodInputs(container);
    return;
  }

  detachMethodPanes(host);
  setVisibleMethodPane(host, '');
  loadingBox.classList.remove('workspace-pane-hidden');

  try {
    if (method === 'golden-gate' || method === 'gibson' || method === 'restriction' || method === 'user') {
      await ensureCommonFeaturesLoaded().catch(() => {});
    }

    const html = await fetchModuleHtml(config.htmlPath);
    if (token !== state.renderToken || container.dataset.activeMethod !== method) return;

    const mount = document.createElement('div');
    mount.className = 'workspace-method-pane workspace-pane-hidden';
    mount.dataset.method = method;
    mount.innerHTML = html;
    host.appendChild(mount);

    await config.init(mount);
    if (token !== state.renderToken || container.dataset.activeMethod !== method) {
      mount.remove();
      return;
    }

    state.cache.set(method, mount);
    bindMethodPaneSync(container, method, mount);
    applyMethodPresentation(mount, method);
    loadingBox.classList.add('workspace-pane-hidden');
    setVisibleMethodPane(host, method);
    syncMethodInputs(container);
  } catch (error) {
    console.error('Integrated workspace load error:', error);
    if (token !== state.renderToken) return;
    loadingBox.classList.add('workspace-pane-hidden');
    setVisibleMethodPane(host, '');
    host.insertAdjacentHTML('beforeend', '<div class="box workspace-method-error"><p style="margin:0;color:#b91c1c;">Failed to load the selected cloning method.</p></div>');
  }
}

function wireFileInput(trigger, input, target) {
  if (!trigger || !input || !target) return;
  trigger.addEventListener('click', () => input.click());
  input.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (VIZ && typeof VIZ.guardFileUploadSize === 'function' && VIZ.guardFileUploadSize(document.getElementById('module-content') || document.body, file, event.target)) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const rawText = String(readerEvent.target && readerEvent.target.result ? readerEvent.target.result : '');
      target.value = Core.formatSequenceUploadText(rawText, { genbankMode: 'sequence', fileBaseName: file.name });
      dispatchValueEvents(target);
    };
    reader.readAsText(file, 'UTF-8');
  });
}

function initIntegratedWorkspace(container) {
  const methodSelect = container.querySelector('#workspace-method');
  const vectorInput = container.querySelector('#workspace-vector');
  const insertInput = container.querySelector('#workspace-insert');
  const demoBtn = container.querySelector('#workspace-demo-set');
  const resetBtn = container.querySelector('#workspace-reset-current');
  const vectorRcBtn = container.querySelector('#workspace-vector-rc');
  const insertRcBtn = container.querySelector('#workspace-insert-rc');

  wireFileInput(
    container.querySelector('#workspace-vector-upload'),
    container.querySelector('#workspace-vector-file'),
    vectorInput
  );
  wireFileInput(
    container.querySelector('#workspace-insert-upload'),
    container.querySelector('#workspace-insert-file'),
    insertInput
  );

  if (vectorRcBtn && vectorInput) {
    vectorRcBtn.addEventListener('click', () => {
      vectorInput.value = reverseComplementFasta(vectorInput.value);
      dispatchValueEvents(vectorInput);
    });
  }

  if (insertRcBtn && insertInput) {
    insertRcBtn.addEventListener('click', () => {
      insertInput.value = reverseComplementFasta(insertInput.value);
      dispatchValueEvents(insertInput);
    });
  }

  if (methodSelect) {
    methodSelect.addEventListener('change', () => {
      handleMethodChange(container, methodSelect.value);
    });
  }

  const syncCurrentMethod = () => {
    writeWorkspaceDraft(vectorInput?.value || '', insertInput?.value || '');
    syncMethodInputs(container);
  };
  if (vectorInput) vectorInput.addEventListener('input', syncCurrentMethod);
  if (insertInput) insertInput.addEventListener('input', syncCurrentMethod);

  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      triggerActiveMethodButton(container, 'demoButtonSelector');
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      try {
        window.sessionStorage.removeItem(WORKSPACE_DRAFT_STORAGE_KEY);
      } catch (_) {
        // Ignore storage failures; reload still resets the workspace UI state.
      }
      window.location.reload();
    });
  }

  const draft = readWorkspaceDraft();
  if (vectorInput && draft.vector) vectorInput.value = draft.vector;
  if (insertInput && draft.insert) insertInput.value = draft.insert;

  renderMethod(container, methodSelect ? methodSelect.value : '');
}

if (typeof window !== 'undefined') {
  window.initIntegratedWorkspace = initIntegratedWorkspace;
}

export { initIntegratedWorkspace };
