// app-main.js
// Minimal router: render module HTML first, then defer heavy module init to app-module-loader.js.

const moduleContent = document.getElementById('module-content');

const moduleMap = {
  'qc': 'modules/QC_V1.0.1.html',
  'restriction': 'modules/RE_cloning_v1.0.1.html',
  'golden-gate': 'modules/Golden_Gate_v1.0.1.html',
  'gibson': 'modules/Gibson_V1.0.1.html',
  'overlap-pcr': 'modules/oe_pcr_v1.0.1.html',
  'user': 'modules/USER_V1.0.1.html',
  'mutagenesis': 'modules/mutagenesis_v1.0.1.html',
  'multiplex-pcr': 'modules/multiplex_pcr_v1.0.1.html'
};

function registerServiceWorkerAfterFirstPaint() {
  if (!('serviceWorker' in navigator)) return;
  // SW requires https or localhost; ignore failures quietly.
  window.requestAnimationFrame(() => window.setTimeout(async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      // After the SW takes control, ask it to precache heavy assets in the background.
      navigator.serviceWorker.ready.then(() => {
        const sw = reg.active || reg.waiting;
        if (sw) sw.postMessage({ type: 'PRECACHE_ALL' });
      }).catch(() => {});
    } catch {
      // no-op
    }
  }, 0));
}

let loaderPromise = null;
function loadLoader() {
  if (!loaderPromise) loaderPromise = import('./app-module-loader.js');
  return loaderPromise;
}

function modulePreload(href) {
  if (!href) return;
  const url = new URL(href, window.location.href).toString();
  const existing = document.querySelector(`link[rel="modulepreload"][href="${href}"],link[rel="modulepreload"][href="${url}"]`);
  if (existing) return;
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = href;
  document.head.appendChild(link);
}

function prefetch(href) {
  if (!href) return;
  const url = new URL(href, window.location.href).toString();
  const existing = document.querySelector(`link[rel="prefetch"][href="${href}"],link[rel="prefetch"][href="${url}"]`);
  if (existing) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

function deferAfterFirstPaint(fn) {
  window.requestAnimationFrame(() => window.setTimeout(fn, 0));
}

const moduleScriptMap = {
  'golden-gate': './modules/scripts/golden_gate_v1.0.1.js',
  'gibson': './modules/scripts/gibson_v1.0.1.js',
  'user': './modules/scripts/user_cloning_v1.0.1.js',
  'overlap-pcr': './modules/scripts/oe_pcr_v1.0.1.js',
  'mutagenesis': './modules/scripts/mutagenesis_v1.0.1.js',
  'multiplex-pcr': './modules/scripts/multiplex_pcr_v1.0.1.js',
  'qc': './modules/scripts/qc_v1.0.1.js',
  'restriction': './modules/scripts/re_cloning_v1.0.1.js'
};

function warmupModuleNetwork(moduleName) {
  // Start fetching the loader immediately (small, but reduces TTI on slow networks)
  loadLoader().catch(() => {});
  // Preload module script for faster init after first paint
  const scriptHref = moduleScriptMap[moduleName];
  if (scriptHref) modulePreload(scriptHref);
  // Prefetch the heavy feature DB only for modules that may use it
  if (moduleName === 'golden-gate' || moduleName === 'gibson' || moduleName === 'user' || moduleName === 'restriction') {
    prefetch('./modules/scripts/common_features_v1.0.1.js');
  }
}

async function loadModule(moduleName) {
  const path = moduleMap[moduleName];
  if (!path) {
    moduleContent.innerHTML = '<p>Error: Module not found.</p>';
    return;
  }

  warmupModuleNetwork(moduleName);
  moduleContent.innerHTML = '<p>Loading...</p>';

  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Network response was not ok');
    const html = await response.text();
    moduleContent.innerHTML = html;

    // UI is now in the DOM; defer heavy JS init until after first paint.
    deferAfterFirstPaint(async () => {
      try {
        const loader = await loadLoader();
        await loader.initModule(moduleName, moduleContent);
      } catch (e) {
        console.error('Module init error:', e);
      }
    });
  } catch (e) {
    console.error('Error loading module:', e);
    moduleContent.innerHTML = '<p>Error loading module.</p>';
  }
}

function handleHashChange() {
  let hash = window.location.hash.substring(1);
  if (!hash || !moduleMap[hash]) hash = 'golden-gate';
  loadModule(hash);
}

window.addEventListener('hashchange', handleHashChange);
handleHashChange();
registerServiceWorkerAfterFirstPaint();
