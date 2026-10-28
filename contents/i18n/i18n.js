(function () {
  'use strict';

  const SUPPORTED = ['en', 'fr', 'ko', 'zh-Hans'];
  const STORAGE_KEY = 'primerweaver_locale';
  const scriptUrl = document.currentScript && document.currentScript.src
    ? new URL(document.currentScript.src, window.location.href)
    : new URL('contents/i18n/i18n.js', window.location.href);
  const localeBase = new URL('./locales/', scriptUrl);
  const dictionaries = Object.create(null);
  const listeners = new Set();

  function normalizeLocale(value) {
    const raw = String(value || '').trim().replace(/_/g, '-');
    const lower = raw.toLowerCase();
    if (lower === 'fr' || lower.startsWith('fr-')) return 'fr';
    if (lower === 'ko' || lower.startsWith('ko-')) return 'ko';
    if (lower === 'zh' || lower.startsWith('zh-')) return 'zh-Hans';
    return 'en';
  }

  function readStoredLocale() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function resolveInitialLocale() {
    const requested = new URL(window.location.href).searchParams.get('lang');
    if (requested) return normalizeLocale(requested);

    const stored = readStoredLocale();
    if (stored) return normalizeLocale(stored);

    const browserLocales = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
    for (const candidate of browserLocales) {
      const normalized = normalizeLocale(candidate);
      if (normalized !== 'en' || String(candidate || '').toLowerCase().startsWith('en')) {
        return normalized;
      }
    }
    return 'en';
  }

  let locale = resolveInitialLocale();
  document.documentElement.lang = locale;

  async function fetchDictionary(localeCode) {
    if (dictionaries[localeCode]) return dictionaries[localeCode];
    const response = await fetch(new URL(`${localeCode}.json`, localeBase), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Unable to load locale ${localeCode}: ${response.status}`);
    const dictionary = await response.json();
    dictionaries[localeCode] = dictionary;
    return dictionary;
  }

  function lookup(dictionary, key) {
    return String(key || '').split('.').reduce((value, part) => {
      if (value && Object.prototype.hasOwnProperty.call(value, part)) return value[part];
      return undefined;
    }, dictionary);
  }

  function interpolate(value, params) {
    if (typeof value !== 'string') return value;
    return value.replace(/\{(\w+)\}/g, (match, key) => (
      params && Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
    ));
  }

  function t(key, params, fallback) {
    const localized = lookup(dictionaries[locale], key);
    const english = lookup(dictionaries.en, key);
    const value = localized !== undefined ? localized : (english !== undefined ? english : fallback);
    return interpolate(value !== undefined ? value : key, params);
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = t(element.dataset.i18n, null, element.textContent);
    });
    scope.querySelectorAll('[data-i18n-html]').forEach((element) => {
      element.innerHTML = t(element.dataset.i18nHtml, null, element.innerHTML);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      element.setAttribute('placeholder', t(
        element.dataset.i18nPlaceholder,
        null,
        element.getAttribute('placeholder') || ''
      ));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((element) => {
      element.setAttribute('title', t(
        element.dataset.i18nTitle,
        null,
        element.getAttribute('title') || ''
      ));
    });
    scope.querySelectorAll('[data-i18n-alt]').forEach((element) => {
      element.setAttribute('alt', t(
        element.dataset.i18nAlt,
        null,
        element.getAttribute('alt') || ''
      ));
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
      element.setAttribute('aria-label', t(
        element.dataset.i18nAriaLabel,
        null,
        element.getAttribute('aria-label') || ''
      ));
    });
    scope.querySelectorAll('[data-i18n-content]').forEach((element) => {
      element.setAttribute('content', t(
        element.dataset.i18nContent,
        null,
        element.getAttribute('content') || ''
      ));
    });
    scope.querySelectorAll('[data-language-select]').forEach((element) => {
      element.value = locale;
    });
  }

  async function load(localeCode) {
    const normalized = normalizeLocale(localeCode);
    await fetchDictionary('en');
    if (normalized !== 'en') {
      try {
        await fetchDictionary(normalized);
      } catch (error) {
        console.error(error);
      }
    }
    locale = normalized;
    document.documentElement.lang = locale;
    return locale;
  }

  function updateUrl(localeCode) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', localeCode);
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // URL synchronization is helpful but must never block language switching.
    }
  }

  async function setLocale(localeCode, options) {
    const normalized = normalizeLocale(localeCode);
    await load(normalized);
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // The app still works when storage is unavailable.
    }
    if (!options || options.updateUrl !== false) updateUrl(normalized);
    apply(document);
    const detail = { locale: normalized };
    window.dispatchEvent(new CustomEvent('primerweaver:localechange', { detail }));
    listeners.forEach((listener) => listener(detail));
    return normalized;
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const ready = load(locale).then(() => {
    apply(document);
    return locale;
  });

  window.PW_I18N = {
    supportedLocales: SUPPORTED.slice(),
    ready,
    t,
    apply,
    setLocale,
    getLocale: () => locale,
    normalizeLocale,
    onChange
  };
})();
