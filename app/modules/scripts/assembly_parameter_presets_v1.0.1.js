const SYSTEM_PRESET_ID = 'system-default';
const SYSTEM_PRESET_NAME = 'System Default';

function ensurePresetStyles() {
  if (document.getElementById('assembly-preset-style')) return;

  const style = document.createElement('style');
  style.id = 'assembly-preset-style';
  style.textContent = `
    .assembly-preset-toolbar{
      display:grid;
      grid-template-columns:minmax(280px, 1fr) auto;
      gap:12px;
      align-items:end;
      margin-top:10px;
      margin-bottom:12px;
    }
    .assembly-preset-main{
      min-width:0;
      display:flex;
      flex-direction:column;
      gap:6px;
    }
    .assembly-preset-main select{
      width:100%;
      min-width:0;
      max-width:none;
    }
    .assembly-preset-actions{
      display:flex;
      justify-content:flex-end;
      gap:8px;
      align-items:center;
      width:auto;
      max-width:100%;
      flex-wrap:wrap;
    }
    .assembly-preset-actions .btn{
      width:auto;
      min-width:max-content;
      flex:0 0 auto;
    }
    .assembly-preset-modal{
      position:fixed;
      top:0;
      left:0;
      width:100%;
      height:100%;
      z-index:1000000;
      display:none;
      align-items:center;
      justify-content:center;
    }
    .assembly-preset-modal-overlay{
      position:absolute;
      top:0;
      left:0;
      width:100%;
      height:100%;
      background:rgba(0, 0, 0, 0.5);
      backdrop-filter:blur(4px);
    }
    .assembly-preset-modal-content{
      position:relative;
      background:#fff;
      border-radius:12px;
      box-shadow:0 20px 60px rgba(0, 0, 0, 0.3);
      max-width:500px;
      width:90%;
      overflow:hidden;
      display:flex;
      flex-direction:column;
      animation:assemblyPresetModalIn 0.3s ease-out;
    }
    @keyframes assemblyPresetModalIn{
      from{opacity:0;transform:translateY(-20px) scale(0.95);}
      to{opacity:1;transform:translateY(0) scale(1);}
    }
    .assembly-preset-modal-header{
      display:flex;
      align-items:center;
      gap:12px;
      padding:20px 24px;
      background:#fff7ed;
      border-bottom:1px solid #fde68a;
    }
    .assembly-preset-modal-icon{
      font-size:1.4rem;
      line-height:1;
    }
    .assembly-preset-modal-header h3{
      margin:0;
      font-size:1.15rem;
      color:#92400e;
      font-weight:600;
    }
    .assembly-preset-modal-body{
      padding:24px;
    }
    .assembly-preset-modal-body p{
      margin:0 0 12px 0;
      font-size:0.95rem;
      line-height:1.6;
      color:#374151;
      white-space:pre-line;
    }
    .assembly-preset-modal-input{
      width:100%;
    }
    .assembly-preset-modal-error{
      margin-top:8px;
      min-height:18px;
      color:#b91c1c;
      font-size:0.85rem;
    }
    .assembly-preset-modal-footer{
      padding:16px 24px;
      border-top:1px solid #e5e7eb;
      display:flex;
      justify-content:flex-end;
      gap:12px;
      background:#f9fafb;
    }
    @media (max-width: 1100px){
      .assembly-preset-toolbar{
        grid-template-columns:1fr;
        align-items:stretch;
      }
      .assembly-preset-actions{
        width:100%;
        justify-content:flex-start;
      }
    }
    @media (max-width: 768px){
      .assembly-preset-main,
      .assembly-preset-main select,
      .assembly-preset-actions{
        width:100%;
        max-width:none;
      }
      .assembly-preset-actions{
        justify-content:flex-start;
        flex-wrap:wrap;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensurePresetModal(container) {
  let modal = container.querySelector('.assembly-preset-modal');
  if (modal) return modal;

  ensurePresetStyles();

  modal = document.createElement('div');
  modal.className = 'assembly-preset-modal';
  modal.innerHTML =
    '<div class="assembly-preset-modal-overlay"></div>' +
    '<div class="assembly-preset-modal-content">' +
      '<div class="assembly-preset-modal-header">' +
        '<span class="assembly-preset-modal-icon">⚠️</span>' +
        '<h3 class="assembly-preset-modal-title">Preset</h3>' +
      '</div>' +
      '<div class="assembly-preset-modal-body">' +
        '<p class="assembly-preset-modal-message"></p>' +
        '<input class="assembly-preset-modal-input" type="text" style="display:none">' +
        '<div class="assembly-preset-modal-error"></div>' +
      '</div>' +
      '<div class="assembly-preset-modal-footer">' +
        '<button class="btn ghost assembly-preset-modal-cancel" type="button">Cancel</button>' +
        '<button class="btn assembly-preset-modal-confirm" type="button">OK</button>' +
      '</div>' +
    '</div>';

  (container || document.body).appendChild(modal);
  return modal;
}

function showPresetDialog(container, options) {
  const modal = ensurePresetModal(container);
  const opts = options || {};
  const mode = opts.mode === 'input' ? 'input' : 'confirm';
  const titleEl = modal.querySelector('.assembly-preset-modal-title');
  const messageEl = modal.querySelector('.assembly-preset-modal-message');
  const inputEl = modal.querySelector('.assembly-preset-modal-input');
  const errorEl = modal.querySelector('.assembly-preset-modal-error');
  const iconEl = modal.querySelector('.assembly-preset-modal-icon');
  const overlay = modal.querySelector('.assembly-preset-modal-overlay');
  const confirmBtn = modal.querySelector('.assembly-preset-modal-confirm');
  const cancelBtn = modal.querySelector('.assembly-preset-modal-cancel');

  if (titleEl) titleEl.textContent = String(opts.title || 'Preset');
  if (messageEl) messageEl.textContent = String(opts.message || '');
  if (iconEl) iconEl.textContent = mode === 'input' ? '📝' : '⚠️';
  if (confirmBtn) confirmBtn.textContent = String(opts.confirmText || 'OK');
  if (cancelBtn) cancelBtn.textContent = String(opts.cancelText || 'Cancel');
  if (errorEl) errorEl.textContent = '';

  if (inputEl) {
    if (mode === 'input') {
      inputEl.style.display = 'block';
      inputEl.value = String(opts.defaultValue || '');
      inputEl.placeholder = String(opts.placeholder || '');
    } else {
      inputEl.style.display = 'none';
      inputEl.value = '';
      inputEl.placeholder = '';
    }
  }

  const closeModal = () => {
    modal.style.display = 'none';
    document.removeEventListener('keydown', handleEscape);
  };

  const handleConfirm = () => {
    if (mode === 'input') {
      const value = inputEl ? inputEl.value : '';
      const validationMessage = typeof opts.validate === 'function' ? opts.validate(value) : '';
      if (validationMessage) {
        if (errorEl) errorEl.textContent = validationMessage;
        if (inputEl) inputEl.focus();
        return;
      }
      closeModal();
      if (typeof opts.onConfirm === 'function') opts.onConfirm(value);
      return;
    }
    closeModal();
    if (typeof opts.onConfirm === 'function') opts.onConfirm();
  };

  const handleCancel = () => {
    closeModal();
    if (typeof opts.onCancel === 'function') opts.onCancel();
  };

  const handleEscape = (event) => {
    if (event.key === 'Escape' && modal.style.display !== 'none') {
      handleCancel();
    } else if (event.key === 'Enter' && mode === 'input' && document.activeElement === inputEl) {
      handleConfirm();
    }
  };

  const newConfirmBtn = confirmBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newConfirmBtn.onclick = handleConfirm;
  newCancelBtn.onclick = handleCancel;
  if (overlay) overlay.onclick = handleCancel;
  document.addEventListener('keydown', handleEscape);

  modal.style.display = 'flex';
  if (mode === 'input' && inputEl) {
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 0);
  }
}

function isLocalStorageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probeKey = '__primerweaver_parameter_preset_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return true;
  } catch (_) {
    return false;
  }
}

function dispatchValueEvents(element) {
  if (!element) return;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function getPresetFieldValue(container, field) {
  if (field.type === 'radio') {
    const checked = container.querySelector(`input[name="${field.name}"]:checked`);
    return checked ? checked.value : String(field.defaultValue || '');
  }

  const element = container.querySelector(field.selector);
  return element ? String(element.value ?? '') : String(field.defaultValue || '');
}

function setPresetFieldValue(container, field, value) {
  const normalizedValue = String(value ?? field.defaultValue ?? '');

  if (field.type === 'radio') {
    const radios = Array.from(container.querySelectorAll(`input[name="${field.name}"]`));
    const targetRadio = radios.find((radio) => radio.value === normalizedValue) || radios[0];
    if (!targetRadio) return;
    targetRadio.checked = true;
    dispatchValueEvents(targetRadio);
    return;
  }

  const element = container.querySelector(field.selector);
  if (!element) return;
  element.value = normalizedValue;
  dispatchValueEvents(element);
}

function sanitizePresetValues(fields, values) {
  const source = values || {};
  const result = {};
  fields.forEach((field) => {
    const fallback = field.defaultValue ?? '';
    const rawValue = source[field.key];
    result[field.key] = rawValue === undefined || rawValue === null ? String(fallback) : String(rawValue);
  });
  return result;
}

function createPresetSnapshot(config, preset) {
  const source = preset || {};
  return {
    id: String(source.id || SYSTEM_PRESET_ID),
    name: String(source.name || SYSTEM_PRESET_NAME),
    values: sanitizePresetValues(config.fields, source.values)
  };
}

function readUserPresets(config) {
  if (!isLocalStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(config.storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const id = String(item.id || `${config.scope}-user-preset-${index + 1}`);
        if (id === SYSTEM_PRESET_ID) return null;
        return {
          id,
          name: String(item.name || `Preset ${index + 1}`),
          values: sanitizePresetValues(config.fields, item.values)
        };
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function writeUserPresets(config, presets) {
  if (!isLocalStorageAvailable()) return false;
  try {
    const safePresets = Array.isArray(presets)
      ? presets
          .filter((preset) => preset && preset.id && preset.id !== SYSTEM_PRESET_ID)
          .map((preset) => createPresetSnapshot(config, preset))
      : [];
    window.localStorage.setItem(config.storageKey, JSON.stringify(safePresets));
    return true;
  } catch (_) {
    return false;
  }
}

function readStartupPresetId(config) {
  if (!isLocalStorageAvailable()) return SYSTEM_PRESET_ID;
  try {
    const raw = window.localStorage.getItem(config.defaultKey);
    return raw ? String(raw) : SYSTEM_PRESET_ID;
  } catch (_) {
    return SYSTEM_PRESET_ID;
  }
}

function writeStartupPresetId(config, presetId) {
  if (!isLocalStorageAvailable()) return false;
  try {
    window.localStorage.setItem(config.defaultKey, String(presetId || SYSTEM_PRESET_ID));
    return true;
  } catch (_) {
    return false;
  }
}

function getAllPresets(config) {
  return [createPresetSnapshot(config, config.systemDefaultPreset)].concat(readUserPresets(config));
}

function getPresetById(config, presetId) {
  const targetId = String(presetId || '');
  return getAllPresets(config).find((preset) => preset.id === targetId) || null;
}

function getResolvedStartupPreset(config) {
  const presetId = readStartupPresetId(config);
  const preset = getPresetById(config, presetId);
  if (preset) return preset;
  writeStartupPresetId(config, SYSTEM_PRESET_ID);
  return createPresetSnapshot(config, config.systemDefaultPreset);
}

function collectPresetValues(container, config) {
  const values = {};
  config.fields.forEach((field) => {
    values[field.key] = getPresetFieldValue(container, field);
  });
  return sanitizePresetValues(config.fields, values);
}

function applyPresetValues(container, config, values) {
  const safeValues = sanitizePresetValues(config.fields, values);
  config.fields.forEach((field) => {
    setPresetFieldValue(container, field, safeValues[field.key]);
  });
  if (typeof config.afterApply === 'function') {
    config.afterApply(container, safeValues);
  }
}

function renderPresetOptions(container, config, selectedPresetId) {
  const select = container.querySelector('.assembly-preset-select');
  if (!select) return;

  const presets = getAllPresets(config);
  const availableIds = presets.map((preset) => preset.id);
  const resolvedId = availableIds.includes(selectedPresetId)
    ? selectedPresetId
    : getResolvedStartupPreset(config).id;

  select.innerHTML = presets.map((preset) => `<option value="${preset.id}">${preset.name}</option>`).join('');
  select.value = resolvedId;

  const updateBtn = container.querySelector('.assembly-preset-update');
  const deleteBtn = container.querySelector('.assembly-preset-delete');
  const disableEdit = resolvedId === SYSTEM_PRESET_ID || !isLocalStorageAvailable();
  if (updateBtn) updateBtn.disabled = disableEdit;
  if (deleteBtn) deleteBtn.disabled = disableEdit;

  const saveBtn = container.querySelector('.assembly-preset-save');
  const setDefaultBtn = container.querySelector('.assembly-preset-set-default');
  if (saveBtn) saveBtn.disabled = !isLocalStorageAvailable();
  if (setDefaultBtn) setDefaultBtn.disabled = !isLocalStorageAvailable();
}

function buildUserPreset(config, name, values) {
  return {
    id: `${config.scope}-user-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
    name: String(name || '').trim(),
    values: sanitizePresetValues(config.fields, values)
  };
}

function notifyUnavailable(container, config) {
  if (window.VIZ && typeof window.VIZ.showMWModal === 'function') {
    window.VIZ.showMWModal(container, `Custom presets are unavailable for ${config.label} because browser local storage is not available.`, () => {}, () => {});
  }
}

function setupAssemblyParameterPresets(container, options) {
  ensurePresetStyles();

  const config = {
    scope: String(options.scope || 'assembly'),
    label: String(options.label || 'assembly settings'),
    storageKey: `primerweaver_${options.scope}_presets_v1`,
    defaultKey: `primerweaver_${options.scope}_default_preset_id_v1`,
    fields: Array.isArray(options.fields) ? options.fields : [],
    systemDefaultPreset: createPresetSnapshot({
      fields: Array.isArray(options.fields) ? options.fields : []
    }, {
      id: SYSTEM_PRESET_ID,
      name: SYSTEM_PRESET_NAME,
      values: options.defaultValues || {}
    }),
    afterApply: options.afterApply
  };

  const select = container.querySelector('.assembly-preset-select');
  const saveBtn = container.querySelector('.assembly-preset-save');
  const updateBtn = container.querySelector('.assembly-preset-update');
  const deleteBtn = container.querySelector('.assembly-preset-delete');
  const setDefaultBtn = container.querySelector('.assembly-preset-set-default');
  if (!select) return;

  const applyStartupPreset = () => {
    const startupPreset = getResolvedStartupPreset(config);
    applyPresetValues(container, config, startupPreset.values);
    renderPresetOptions(container, config, startupPreset.id);
  };

  applyStartupPreset();
  setTimeout(applyStartupPreset, 0);

  select.onchange = function () {
    const preset = getPresetById(config, select.value) || getResolvedStartupPreset(config);
    applyPresetValues(container, config, preset.values);
    renderPresetOptions(container, config, preset.id);
  };

  if (saveBtn) {
    saveBtn.onclick = function () {
      if (!isLocalStorageAvailable()) {
        notifyUnavailable(container, config);
        return;
      }

      showPresetDialog(container, {
        mode: 'input',
        title: 'Save Parameter Preset',
        message: `Enter a name for this ${config.label} preset.`,
        placeholder: options.placeholder || 'e.g. Standard assembly settings',
        confirmText: 'Save',
        validate: (value) => {
          if (!String(value || '').trim()) return 'Please enter a preset name.';
          return '';
        },
        onConfirm: (value) => {
          const presets = readUserPresets(config);
          presets.push(buildUserPreset(config, value, collectPresetValues(container, config)));
          writeUserPresets(config, presets);
          renderPresetOptions(container, config, presets[presets.length - 1].id);
        }
      });
    };
  }

  if (updateBtn) {
    updateBtn.onclick = function () {
      const activeId = select.value || SYSTEM_PRESET_ID;
      if (activeId === SYSTEM_PRESET_ID) return;
      const nextPresets = readUserPresets(config).map((preset) => {
        if (preset.id !== activeId) return preset;
        return {
          id: preset.id,
          name: preset.name,
          values: collectPresetValues(container, config)
        };
      });
      writeUserPresets(config, nextPresets);
      renderPresetOptions(container, config, activeId);
    };
  }

  if (deleteBtn) {
    deleteBtn.onclick = function () {
      const activeId = select.value || SYSTEM_PRESET_ID;
      if (activeId === SYSTEM_PRESET_ID) return;
      const activePreset = getPresetById(config, activeId);
      showPresetDialog(container, {
        title: 'Delete Parameter Preset',
        message: `Delete preset "${activePreset ? activePreset.name : activeId}"?`,
        confirmText: 'Delete',
        onConfirm: () => {
          const nextPresets = readUserPresets(config).filter((preset) => preset.id !== activeId);
          writeUserPresets(config, nextPresets);
          if (readStartupPresetId(config) === activeId) {
            writeStartupPresetId(config, SYSTEM_PRESET_ID);
          }
          applyPresetValues(container, config, config.systemDefaultPreset.values);
          renderPresetOptions(container, config, SYSTEM_PRESET_ID);
        }
      });
    };
  }

  if (setDefaultBtn) {
    setDefaultBtn.onclick = function () {
      if (!isLocalStorageAvailable()) {
        notifyUnavailable(container, config);
        return;
      }
      writeStartupPresetId(config, select.value || SYSTEM_PRESET_ID);
      renderPresetOptions(container, config, select.value || SYSTEM_PRESET_ID);
    };
  }
}

export { setupAssemblyParameterPresets };
