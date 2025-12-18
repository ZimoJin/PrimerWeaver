// app-module-loader.js
// Heavy module initialization logic is placed here so app-main.js can stay small and render UI first.

const COMMON_FEATURES_SRC = './modules/scripts/common_features_v1.0.1.js';
const COMMON_FEATURE_MODULES = new Set(['golden-gate', 'restriction', 'gibson', 'user']);

let commonFeaturesPromise = null;
function ensureCommonFeaturesLoaded() {
  if (Array.isArray(window.COMMON_FEATURES)) return Promise.resolve(window.COMMON_FEATURES);
  if (commonFeaturesPromise) return commonFeaturesPromise;

  commonFeaturesPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${COMMON_FEATURES_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => {
        try { window.dispatchEvent(new CustomEvent('common-features-ready')); } catch {}
        resolve(window.COMMON_FEATURES || []);
      }, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load common features DB')), { once: true });
      return;
    }

    const s = document.createElement('script');
    s.src = COMMON_FEATURES_SRC;
    s.async = true;
    s.onload = () => {
      try { window.dispatchEvent(new CustomEvent('common-features-ready')); } catch {}
      resolve(window.COMMON_FEATURES || []);
    };
    s.onerror = () => reject(new Error('Failed to load common features DB'));
    document.head.appendChild(s);
  });

  return commonFeaturesPromise;
}

function deferAfterFirstPaint(fn) {
  window.requestAnimationFrame(() => window.setTimeout(fn, 0));
}

function deferUntilIdle(fn) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => fn(), { timeout: 2000 });
    return;
  }
  deferAfterFirstPaint(fn);
}

function kickoffCommonFeaturesLoadIfNeeded(moduleName) {
  if (!COMMON_FEATURE_MODULES.has(moduleName)) return;
  if (Array.isArray(window.COMMON_FEATURES) || commonFeaturesPromise) return;
  deferUntilIdle(() => ensureCommonFeaturesLoaded().catch(() => {}));
}

const moduleScriptCache = new Map();
function loadModuleScriptOnce(src) {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return Promise.resolve();
  if (moduleScriptCache.has(src)) return moduleScriptCache.get(src);

  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.type = 'module';
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

  moduleScriptCache.set(src, p);
  return p;
}

export async function initModule(moduleName, moduleContentEl) {
  kickoffCommonFeaturesLoadIfNeeded(moduleName);

  switch (moduleName) {
    case 'golden-gate': {
      await loadModuleScriptOnce('./modules/scripts/golden_gate_v1.0.1.js').catch(() => {});
      if (window.initGoldenGate) window.initGoldenGate(moduleContentEl);
      return;
    }
    case 'gibson': {
      await loadModuleScriptOnce('./modules/scripts/gibson_v1.0.1.js').catch(() => {});
      if (window.initGibsonModule) window.initGibsonModule(moduleContentEl);
      return;
    }
    case 'user': {
      await loadModuleScriptOnce('./modules/scripts/user_cloning_v1.0.1.js').catch(() => {});
      if (window.initUSERModule) window.initUSERModule();
      return;
    }
    case 'overlap-pcr': {
      await loadModuleScriptOnce('./modules/scripts/oe_pcr_v1.0.1.js').catch(() => {});
      if (window.initOEPCRModule) window.initOEPCRModule();
      return;
    }
    case 'multiplex-pcr': {
      await loadModuleScriptOnce('./modules/scripts/multiplex_pcr_v1.0.1.js').catch(() => {});
      if (window.initMultiplexPCRModule) window.initMultiplexPCRModule(moduleContentEl);
      return;
    }
    case 'mutagenesis': {
      await loadModuleScriptOnce('./modules/scripts/mutagenesis_v1.0.1.js').catch(() => {});
      if (window.initMutagenesisModule) window.initMutagenesisModule(moduleContentEl);
      return;
    }
    case 'restriction': {
      const mod = await import('./modules/scripts/re_cloning_v1.0.1.js').catch(() => null);
      if (mod && typeof mod.initRECloning === 'function') {
        mod.initRECloning(moduleContentEl);
      }
      return;
    }
    case 'qc': {
      const mod = await import('./modules/scripts/qc_v1.0.1.js').catch(() => null);
      if (mod && typeof mod.initQC_V4 === 'function') {
        mod.initQC_V4(moduleContentEl);
      } else if (window.initQC_V4) {
        window.initQC_V4(moduleContentEl);
      }
      return;
    }
    default:
      return;
  }
}
