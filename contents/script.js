// Declare the variables here with 'let', but don't assign them yet.
// We will assign them after the page loads.
let view, welcomeScreen, appHeader, appFooter;

// Docs navigation labels (used for sidebar + mobile dropdown label sync)
const docsList = [
    { id: '#d-intro', label: 'Introduction' },
    { id: '#d-qc', label: 'Primer QC' },
    { id: '#d-opcr', label: 'Overlap PCR' },
    { id: '#d-muta', label: 'Mutagenesis' },
    { id: '#d-mp', label: 'Multiplex PCR' },
    { id: '#d-re', label: 'Restriction Cloning' },
    { id: '#d-user', label: 'USER Cloning' },
    { id: '#d-gg', label: 'Golden Gate' },
    { id: '#d-gb', label: 'Gibson Assembly' },
];

function getDocLabel(id) {
    return docsList.find(d => d.id === id)?.label || 'Documents';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Scroll reset helper: ensures navigation always opens at the top.
// We reset both the window/document scroll and known scroll containers (defensive).
function resetScrollToTop() {
    try {
        // Window/document scroll
        window.scrollTo(0, 0);
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;

        // Defensive: if any container becomes scrollable in some layouts
        if (view) view.scrollTop = 0;
        if (welcomeScreen) welcomeScreen.scrollTop = 0;
    } catch (e) {
        // No-op: scroll reset should never break navigation
    }
}

function updateHeaderOffsetVar() {
    // Used by sticky elements that should sit just below the header
    try {
        const header = document.getElementById('app-header');
        const height = header ? Math.round(header.getBoundingClientRect().height) : 56;
        document.documentElement.style.setProperty('--header-offset', `${height}px`);

        // Also expose the fixed footer height so content can pad itself correctly
        const footer = document.getElementById('app-footer');
        const footerHeight = footer ? Math.round(footer.getBoundingClientRect().height) : 48;
        document.documentElement.style.setProperty('--footer-offset', `${footerHeight}px`);
    } catch (e) {
        // no-op
    }
}

// Basic hash router
const routes = {
    '/': welcomeRoute,
    '/tools': appDashboard, // The '/tools' route now points to the appDashboard
    '/docs': docs,
    '/help': help,
    '/about': about,
};

// --- Welcome Screen Logic ---
function initWelcomeScreen() {
    // Remove the local 'const welcomeScreen = ...'
    // This function will now use the global 'welcomeScreen' variable,
    // which will be correctly assigned on page load.
    if (!welcomeScreen) return;

    const proceedButton = welcomeScreen.querySelector('.proceed-button');
    if (proceedButton) {
        proceedButton.addEventListener('click', () => {
            location.hash = '#/tools';
        });
    }
}

function navigate() {
    let hash = location.hash.substring(1) || '/';
    let path = hash;
    let anchor = null;

    if (hash.includes('#')) {
        const parts = hash.split('#');
        path = parts[0] || '/';
        anchor = '#' + parts[1];
    }
    if (path[0] !== '/') {
        path = '/' + path;
    }

    // Prevent the underlying page from scrolling when the welcome overlay is active.
    // This avoids double scrollbars and accidental header movement.
    try {
        if (document && document.body) {
            document.body.classList.toggle('welcome-active', path === '/');
        }
    } catch (e) {}

    // NEW: A flag to check if we are on any "app" page
    const isAppPage = path.startsWith('/app/') || path === '/tools';

    if (path.startsWith('/app/')) {
        // --- This part is for loading a specific module (e.g., /app/gibson) ---
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        if (appHeader) appHeader.classList.add('visible');
        if (view) view.classList.add('visible');
        if (appFooter) appFooter.classList.add('visible');

        const moduleName = path.split('/')[2];
        if (view) {
            view.innerHTML = loadAppModule(moduleName);
            view.classList.add('view-is-app'); // <-- Applies the CSS rule

            // --- Bind Fullscreen Button Logic ---
            const fsBtn = document.getElementById('fullscreen-btn');
            const appShell = document.getElementById('app-shell-container');

            if (fsBtn && appShell) {
                // Function to toggle fullscreen
                fsBtn.addEventListener('click', () => {
                    if (!document.fullscreenElement) {
                        appShell.requestFullscreen().catch(err => {
                            alert(`Error enabling full-screen: ${err.message}`);
                        });
                    } else {
                        document.exitFullscreen();
                    }
                });

                // Function to update button text
                const updateFsBtn = () => {
                    if (document.fullscreenElement === appShell) {
                        fsBtn.innerHTML = `
                            <svg class="btn-icon" aria-hidden="true"><use xlink:href="#icon-fullscreen-exit"></use></svg>
                            <span>Exit Fullscreen</span>
                        `;
                    } else {
                        fsBtn.innerHTML = `
                            <svg class="btn-icon" aria-hidden="true"><use xlink:href="#icon-fullscreen-enter"></use></svg>
                            <span>Fullscreen</span>
                        `;
                    }
                };

                appShell.addEventListener('fullscreenchange', updateFsBtn);
            }
            // --- End of new logic ---
        }
        setActive('/tools'); // Keep the "Launch App" button active
        resetScrollToTop();

    } else {
        // --- This part is for all other pages (/, /tools, /docs, etc.) ---
        if (path === '/') {
            // Welcome Screen
            if (welcomeScreen) welcomeScreen.classList.remove('hidden');
            if (appHeader) appHeader.classList.remove('visible');
            if (view) view.classList.remove('visible');
            if (appFooter) appFooter.classList.add('visible');
        } else {
            // All other main pages
            if (welcomeScreen) welcomeScreen.classList.add('hidden');
            if (appHeader) appHeader.classList.add('visible');
            if (view) view.classList.add('visible');
            if (appFooter) appFooter.classList.add('visible');
        }

        // Render the correct page's HTML
        const renderFunction = routes[path] || notFound;
        if (view) {
            view.innerHTML = renderFunction();
            view.classList.remove('view-is-app');
        }
        setActive(path);
        resetScrollToTop();
    }

    // Call binders for specific pages
    if (path === '/docs') { bindDocs(anchor) }
    if (path === '/about') { bindAbout() }
}

window.addEventListener('hashchange', navigate);

window.addEventListener('load', () => {
    // --- CHANGE 3 ---
    // NOW that the page is loaded, we find the elements
    // and assign them to our global variables.
    view = document.getElementById('view');
    welcomeScreen = document.getElementById('welcome-screen');
    appHeader = document.getElementById('app-header');
    appFooter = document.getElementById('app-footer');
    // --- END OF CHANGE 3 ---

    initWelcomeScreen();
    initMobileMenu();
    initLogoLink();
    initFooterToggle();
    updateHeaderOffsetVar();
    window.addEventListener('resize', updateHeaderOffsetVar);

    // Observe header/footer size changes (zoom, font rendering, footer expand/collapse)
    try {
        const headerEl = document.getElementById('app-header');
        const footerEl = document.getElementById('app-footer');

        if (window.ResizeObserver && (headerEl || footerEl)) {
            let rafId = 0;
            const schedule = () => {
                if (rafId) return;
                rafId = requestAnimationFrame(() => {
                    rafId = 0;
                    updateHeaderOffsetVar();
                });
            };
            const ro = new ResizeObserver(schedule);
            if (headerEl) ro.observe(headerEl);
            if (footerEl) ro.observe(footerEl);
        }
    } catch (e) {
        // no-op: layout offsets still update on window resize
    }
    navigate();
});

function welcomeRoute() {
    return ``;
}

// --- Mobile Drawer Logic ---
function initMobileMenu() {
    const menuBtn = document.getElementById('menuBtn');
    const menu = document.querySelector('.menu');
    const backdrop = document.getElementById('backdrop');

    if (!menuBtn || !menu || !backdrop) return;

    const menuLinks = document.querySelectorAll('.menu a:not(.dropdown-toggle)');
    const dropdown = document.querySelector('.menu .dropdown');
    const dropdownToggle = dropdown ? dropdown.querySelector('.dropdown-toggle') : null;


    function closeMenu() {
        menu.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
        menu.classList.add('is-open');
        backdrop.classList.add('is-open');
        menuBtn.setAttribute('aria-expanded', 'true');
    }

    menuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = menu.classList.contains('is-open');
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    backdrop.addEventListener('click', closeMenu);

    menuLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', (e) => {
            if (window.innerWidth <= 1000) {
                e.preventDefault();
                const isOpen = dropdown.classList.contains('is-open');
                dropdown.classList.toggle('is-open');
                dropdownToggle.setAttribute('aria-expanded', !isOpen);
            }
        });
    }
}

function initLogoLink() {
    const logoLink = document.getElementById('brand-logo');
    if (logoLink) {
        logoLink.addEventListener('click', (e) => {
            e.preventDefault();
            location.hash = '#/';
        });
    }
}

function initFooterToggle() {
    const footer = document.getElementById('app-footer');
    if (!footer) return;

    function updateFooterCollapsible() {
        // Enable ellipsis + toggle ONLY when the footer would naturally wrap to 2+ lines.
        // This is independent of viewport size (works anywhere it becomes multi-line).
        const wasExpanded = footer.classList.contains('footer-expanded');

        // Measure natural wrapping height (without truncation)
        footer.classList.remove('footer-collapsible');
        footer.classList.remove('footer-expanded');

        const cs = window.getComputedStyle(footer);
        const lineHeight = parseFloat(cs.lineHeight) || 18;
        const padTop = parseFloat(cs.paddingTop) || 0;
        const padBottom = parseFloat(cs.paddingBottom) || 0;
        const singleLineHeight = lineHeight + padTop + padBottom;
        const naturalHeight = footer.getBoundingClientRect().height;

        const isMultiLine = naturalHeight > singleLineHeight + 1;

        if (isMultiLine) {
            footer.classList.add('footer-collapsible');
            if (wasExpanded) footer.classList.add('footer-expanded');
        } else {
            footer.classList.remove('footer-collapsible');
            footer.classList.remove('footer-expanded');
        }
    }

    // Toggle only if the footer is currently collapsible
    footer.addEventListener('click', function () {
        if (!footer.classList.contains('footer-collapsible')) return;
        footer.classList.toggle('footer-expanded');
    });

    updateFooterCollapsible();
    window.addEventListener('resize', updateFooterCollapsible);
    // In case fonts load late / layout settles after first paint
    setTimeout(updateFooterCollapsible, 250);
}

function setActive(path) {
    document.querySelectorAll('.menu [data-route]').forEach(el => {
        const route = el.getAttribute('data-route');
        let active = (route === path);

        // --- ADDED ---
        // Make sure "Launch App" button is active even when on a sub-module page
        if (path.startsWith('/app/') && route === '/tools') {
            active = true;
        }
        // --- END ADDED ---

        el.setAttribute('aria-current', active ? 'page' : 'false');
    });
}

// --- Helper Function to load app modules ---
function loadAppModule(moduleName) {
    // --- Pretty Name Lookup (Still needed for iframe title) ---
    const prettyNameMap = {
        'qc': 'Primer QC',
        'restriction': 'Restriction Cloning',
        'golden-gate': 'Golden Gate Assembly',
        'gibson': 'Gibson Assembly',
        'overlap-pcr': 'Overlap PCR',
        'user': 'USER Cloning',
        'mutagenesis': 'Mutagenesis',
        'multiplex-pcr': 'Multiplex PCR'
    };

    const prettyName = prettyNameMap[moduleName] || moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

    // We still point to the app-index.html shell and pass the hash
    const filePath = `app/app-index.html#${moduleName}`;

    // This HTML is injected into the <main> tag
    return `
    
    <svg width="0" height="0" style="position:absolute">
        <defs>
            <symbol id="icon-fullscreen-enter" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
            </symbol>
            <symbol id="icon-fullscreen-exit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
            </symbol>
        </defs>
    </svg>

    <div class="app-shell-stacked" id="app-shell-container">
            
        <nav class="app-shell-header">
            
            <h3 class="app-shell-title" style="display:flex;align-items:center;gap:8px">
              <span>${prettyName}</span>
              ${moduleName==='qc'?`
              <span class="help-icon" style="position: relative; display: inline-block; cursor: help; z-index: 1; flex-shrink: 0;">
                <span style="display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 50%; background: #6b7280; color: white; font-size: 0.8rem; font-weight: bold; transition: background 0.2s; position: relative; z-index: 1;">?</span>
                <span class="help-tooltip" style="position: absolute; top: calc(100% + 10px); left: 0; width: 400px; padding: 14px; background: #1f2937; color: #fff; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; z-index: 99999; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; white-space: normal;">
                  <strong style="display: block; margin-bottom: 8px; font-size: 0.9rem;">Purpose:</strong>
                  <p style="margin: 0;">Quality check for PCR primers. Evaluates primer properties including melting temperature (Tm), self-dimer formation, cross-dimer formation, hairpin structures, GC content, 3'-clamp, and homopolymer runs. Helps identify potential issues before PCR experiments.</p>
                  <span style="position: absolute; top: -6px; left: 20px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #1f2937;"></span>
                </span>
              </span>`:''}
              ${moduleName==='overlap-pcr'?`
              <span class="help-icon" style="position: relative; display: inline-block; cursor: help; z-index: 1; flex-shrink: 0;">
                <span style="display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 50%; background: #6b7280; color: white; font-size: 0.8rem; font-weight: bold; transition: background 0.2s; position: relative; z-index: 1;">?</span>
                <span class="help-tooltip" style="position: absolute; top: calc(100% + 10px); left: 0; width: 420px; padding: 14px; background: #1f2937; color: #fff; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; z-index: 99999; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; white-space: normal;">
                  <strong style="display: block; margin-bottom: 8px; font-size: 0.9rem;">Purpose:</strong>
                  <p style="margin: 0;">Design primers for Overlap Extension PCR (OE-PCR) to join multiple DNA fragments. Primers create overlaps that allow adjacent fragments to anneal and extend, forming seamless junctions. Linker sequences are supported between fragments.</p>
                  <span style="position: absolute; top: -6px; left: 20px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #1f2937;"></span>
                </span>
              </span>`:''}
              ${moduleName==='mutagenesis'?`
              <span class="help-icon" style="position: relative; display: inline-block; cursor: help; z-index: 1; flex-shrink: 0;">
                <span style="display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 50%; background: #6b7280; color: white; font-size: 0.8rem; font-weight: bold; transition: background 0.2s; position: relative; z-index: 1;">?</span>
                <span class="help-tooltip" style="position: absolute; top: calc(100% + 10px); left: 0; width: 420px; padding: 14px; background: #1f2937; color: #fff; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; z-index: 99999; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; white-space: normal;">
                  <strong style="display: block; margin-bottom: 8px; font-size: 0.9rem;">Purpose:</strong>
                  <p style="margin: 0;">Perform site-directed mutagenesis via overlap PCR. Supports single or multiple amino acid or DNA edits (substitutions, insertions, deletions) and designs inner overlap and outer flanking primers with integrated QC (Tm, GC%, hairpin/dimer).</p>
                  <span style="position: absolute; top: -6px; left: 20px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #1f2937;"></span>
                </span>
              </span>`:''}
              ${moduleName==='multiplex-pcr'?`
              <span class="help-icon" style="position: relative; display: inline-block; cursor: help; z-index: 1; flex-shrink: 0;">
                <span style="display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 50%; background: #6b7280; color: white; font-size: 0.8rem; font-weight: bold; transition: background 0.2s; position: relative; z-index: 1;">?</span>
                <span class="help-tooltip" style="position: absolute; top: calc(100% + 10px); left: 0; width: 420px; padding: 14px; background: #1f2937; color: #fff; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; z-index: 99999; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; white-space: normal;">
                  <strong style="display: block; margin-bottom: 8px; font-size: 0.9rem;">Purpose:</strong>
                  <p style="margin: 0;">Design multiplex PCR primer pairs for many targets under a shared PCR condition. Includes cross-dimer screening and automated pooling suggestions to reduce primer–primer conflicts.</p>
                  <span style="position: absolute; top: -6px; left: 20px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #1f2937;"></span>
                </span>
              </span>`:''}
              ${moduleName==='restriction'?`
              <span class="help-icon" style="position: relative; display: inline-block; cursor: help; z-index: 1; flex-shrink: 0;">
                <span style="display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 50%; background: #6b7280; color: white; font-size: 0.8rem; font-weight: bold; transition: background 0.2s; position: relative; z-index: 1;">?</span>
                <span class="help-tooltip" style="position: absolute; top: calc(100% + 10px); left: 0; width: 420px; padding: 14px; background: #1f2937; color: #fff; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; z-index: 99999; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; white-space: normal;">
                  <strong style="display: block; margin-bottom: 8px; font-size: 0.9rem;">Purpose:</strong>
                  <p style="margin: 0;">Design primers for restriction enzyme cloning (RE cloning) using one or two enzymes. Generates directional/non-directional cloning primers with enzyme sites and optional extra bases, and provides an in-silico digest/assembly preview.</p>
                  <span style="position: absolute; top: -6px; left: 20px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #1f2937;"></span>
                </span>
              </span>`:''}
              ${moduleName==='golden-gate'?`
              <span class="help-icon" style="position: relative; display: inline-block; cursor: help; z-index: 1; flex-shrink: 0;">
                <span style="display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 50%; background: #6b7280; color: white; font-size: 0.8rem; font-weight: bold; transition: background 0.2s; position: relative; z-index: 1;">?</span>
                <span class="help-tooltip" style="position: absolute; top: calc(100% + 10px); left: 0; width: 420px; padding: 14px; background: #1f2937; color: #fff; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; z-index: 99999; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; white-space: normal;">
                  <strong style="display: block; margin-bottom: 8px; font-size: 0.9rem;">Purpose:</strong>
                  <p style="margin: 0;">Design Golden Gate assembly primers using Type IIS restriction enzymes. Automatically selects overhangs, checks for internal enzyme sites, and produces assembly-ready primers with optional clamping bases and gel/assembly previews.</p>
                  <span style="position: absolute; top: -6px; left: 20px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #1f2937;"></span>
                </span>
              </span>`:''}
              ${moduleName==='gibson'?`
              <span class="help-icon" style="position: relative; display: inline-block; cursor: help; z-index: 1; flex-shrink: 0;">
                <span style="display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 50%; background: #6b7280; color: white; font-size: 0.8rem; font-weight: bold; transition: background 0.2s; position: relative; z-index: 1;">?</span>
                <span class="help-tooltip" style="position: absolute; top: calc(100% + 10px); left: 0; width: 420px; padding: 14px; background: #1f2937; color: #fff; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; z-index: 99999; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; white-space: normal;">
                  <strong style="display: block; margin-bottom: 8px; font-size: 0.9rem;">Purpose:</strong>
                  <p style="margin: 0;">Design primers for Gibson Assembly. Optimizes overlap regions at each junction and designs core primers for vector and inserts, supporting single or multiple inserts with assembly preview and QC metrics.</p>
                  <span style="position: absolute; top: -6px; left: 20px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #1f2937;"></span>
                </span>
              </span>`:''}
              ${moduleName==='user'?`
              <span class="help-icon" style="position: relative; display: inline-block; cursor: help; z-index: 1; flex-shrink: 0;">
                <span style="display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 50%; background: #6b7280; color: white; font-size: 0.8rem; font-weight: bold; transition: background 0.2s; position: relative; z-index: 1;">?</span>
                <span class="help-tooltip" style="position: absolute; top: calc(100% + 10px); left: 0; width: 420px; padding: 14px; background: #1f2937; color: #fff; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; z-index: 99999; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; white-space: normal;">
                  <strong style="display: block; margin-bottom: 8px; font-size: 0.9rem;">Purpose:</strong>
                  <p style="margin: 0;">Design primers for USER cloning (Uracil-Specific Excision Reagent). Supports dU-containing primers and overlap-based assembly to create seamless junctions, with automated primer core selection and junction validation.</p>
                  <span style="position: absolute; top: -6px; left: 20px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #1f2937;"></span>
                </span>
              </span>`:''}
            </h3>
            <div class="app-header-buttons">
                <button id="fullscreen-btn" class="btn ghost app-btn">
                    <svg class="btn-icon" aria-hidden="true"><use xlink:href="#icon-fullscreen-enter"></use></svg>
                    <span>Fullscreen</span>
                </button>
                <a href="#/tools" class="btn ghost app-btn">&larr; Back to Dashboard</a>
            </div>
        </nav>

        <article class="app-shell-content">
            <iframe 
                src="${filePath}" 
                title="${prettyName} Module" 
                class="app-iframe">
            </iframe>
        </article>
    </div>
    `;
}

// --- Page Content Functions ---
function docs() {
    const sidebarLinks = docsList
        .map(d => `<a href="#" data-doc="${d.id}">${escapeHtml(d.label)}</a>`)
        .join('\n  ');

    const mobileMenuLinks = docsList
        .map(d => `<a href="#" data-doc="${d.id}" role="option">${escapeHtml(d.label)}</a>`)
        .join('\n        ');

    return `
<div class="info-layout">
<div class="docs-mobile-nav" id="docsMobileNav">
  <button class="docs-mobile-toggle" id="docsMobileToggle" type="button" aria-haspopup="listbox" aria-expanded="false">
    <span class="docs-mobile-toggle-label" id="docsMobileLabel">Introduction</span>
    <span class="docs-mobile-toggle-chevron" aria-hidden="true">▾</span>
  </button>
  <div class="docs-mobile-menu" id="docsMobileMenu" role="listbox" aria-label="Documents">
        ${mobileMenuLinks}
  </div>
</div>
<nav class="info-sidebar" id="doc-nav">
  <h3>Documents</h3>
  ${sidebarLinks}
</nav>

<article class="card info-content" id="docBody">
  </article>
</div>`;
}

function help() {
    return `
<section class="card" style="padding:22px 28px">

<svg width="0" height="0" style="position:absolute">
    <defs>
    <symbol id="icon-format" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
    </symbol>
    <symbol id="icon-fail" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
    </symbol>
    <symbol id="icon-pool" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>
    </symbol>
    <symbol id="icon-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </symbol>
    <symbol id="icon-cite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </symbol>
    <symbol id="icon-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
    </symbol>
    <symbol id="icon-scissors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle>
    <line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line>
    <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
    </symbol>
    <symbol id="icon-layers" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
    <polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>
    </symbol>
    <symbol id="icon-list" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>
    </symbol>
    <symbol id="icon-settings" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 .57 1.92v.5a2 2 0 0 1-1.73 1l-.25.43a2 2 0 0 1 0 2l.25.43a2 2 0 0 1 1.73 1v.5a2 2 0 0 1-.57 1.92l-.15.1a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-.57-1.92v-.5a2 2 0 0 1 1.73-1l.25-.43a2 2 0 0 1 0 2l-.25-.43a2 2 0 0 1-1.73-1v-.5a2 2 0 0 1 .57-1.92l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
    <circle cx="12" cy="12" r="3"></circle>
    </symbol>
    <symbol id="icon-play" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </symbol>
    <symbol id="icon-download" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>
    </symbol>
    <symbol id="icon-dna" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 14.899A7 7 0 1 1 15 9.101"></path><path d="M9 9.101A7 7 0 1 1 20 14.899"></path><line x1="4" y1="14.9" x2="9" y2="9.1"></line><line x1="15" y1="14.9" x2="20" y2="9.1"></line><line x1="12" y1="6" x2="12" y2="7"></line><line x1="12" y1="17" x2="12" y2="18"></line><line x1="7" y1="12" x2="8" y2="12"></line><line x1="16" y1="12" x2="17" y2="12"></line>
    </symbol>
    <symbol id="icon-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
    </symbol>
    <symbol id="icon-award" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 17 17 23 15.79 13.88"></polyline>
    </symbol>
    </defs>
</svg>

<h2 style="margin-bottom: 24px;">Help & FAQs</h2>

<h3 style="margin-top: 24px; margin-bottom: 16px; color: #555;">Getting Started</h3>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-user"></use></svg>
    <details class="faq-content" open>
    <summary>Any login or cost?</summary>
    <div>
        <p>No. PrimerWeaver is <strong>free for both academic and commercial use</strong>. Source code is released under the MIT License. No login or cookies are required, respecting the NAR Web Server guidelines.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-lock"></use></svg>
    <details class="faq-content">
    <summary>Is my sequence data uploaded/saved on your server?</summary>
    <div>
        <p><strong>No.</strong> All calculations, from primer design to <i>in-silico</i> QC, are performed <strong>100% in your local browser</strong> (client-side). Your sequences are never uploaded to, transmitted to, or stored on our server. This ensures your data remains completely private and secure.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-format"></use></svg>
    <details class="faq-content">
    <summary>What sequence formats are accepted?</summary>
    <div>
        <p>PrimerWeaver accepts standard DNA sequences in either <strong>FASTA</strong> or <strong>plain text</strong> format. Any numbers, whitespace, or non-IUPAC nucleotide/amino acid characters are automatically removed following the user permission. </p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-cite"></use></svg>
    <details class="faq-content">
    <summary>How do I cite the server?</summary>
    <div>
        <p>If you use PrimerWeaver in your research, please cite the following publication:</p>
        <p><em>PrimerWeaver: an integrated web server for primer design in molecular biology workflows.</em></p>
    </div>
    </details>
</div>

<h3 style="margin-top: 24px; margin-bottom: 16px; color: #555;">Design Parameters & Accuracy</h3>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-settings"></use></svg>
    <details class="faq-content">
    <summary>What do the constraint parameters mean (Tm, GC%, Hairpin, Dimer)?</summary>
    <div>
        <p><strong>Melting Temperature (Tm):</strong> The temperature at which 50% of the primer-target duplex is denatured. PrimerWeaver uses the nearest-neighbor method for accurate Tm calculation. Higher Tm favors specificity; lower Tm reduces non-specific amplification. In practice, primers are typically designed with Tm values around 55–65 °C. For paired primers, a ΔTm of less than 5 °C is generally recommended to ensure consistent annealing.</p>
        <p><strong>GC Content (%):</strong> The percentage of guanine and cytosine bases in the primer. Typical range is 40–60%. Higher GC content increases Tm but also increases the risk of secondary structures.</p>
        <p><strong>Max Hairpin ΔG:</strong> The Gibbs free energy of potential intramolecular secondary structures (hairpins) within the primer. More negative values indicate more stable hairpins and higher probability of self-annealing. Typical threshold: −3 kcal/mol.</p>
        <p><strong>Max Dimer ΔG:</strong> The Gibbs free energy of potential bimolecular secondary structures (dimers) between two primers. More negative values indicate stronger primer–primer binding. Typical threshold: −6 kcal/mol for homodimers, −8 kcal/mol for heterodimers.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-settings"></use></svg>
    <details class="faq-content">
    <summary>How does PrimerWeaver ensure accuracy in thermodynamic calculations?</summary>
    <div>
        <p>PrimerWeaver employs industry-standard nearest-neighbor thermodynamic models for Tm and secondary structure calculations:</p>
        <ul>
        <li><strong>Tm Calculation:</strong> Uses the nearest-neighbor method (SantaLucia, 1998) with empirically derived ΔH° and ΔS° values for DNA dinucleotide steps. Tm is calculated as: Tm = (ΔH° − T°) / ΔS°.</li>
        <li><strong>Secondary Structure:</strong> Uses Gibbs free energy (ΔG) estimates based on Watson–Crick base pairing and stacking interactions. Hairpin and dimer ΔG values predict secondary structure stability (more negative = more stable).</li>
        <li><strong>Validation:</strong> All calculations have been benchmarked against published data and widely used tools (Primer3, SnapGene). Accuracy is typically within ±1–2°C for Tm in standard PCR buffers.</li>
        </ul>
        <p><strong>Caveat:</strong> Actual PCR Tm may vary ±2–3°C depending on polymerase, dNTP concentration, and buffer composition. Always validate experimentally.</p>
    </div>
    </details>
</div>

<h3 style="margin-top: 24px; margin-bottom: 16px; color: #555;">Workflow Methods</h3>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-layers"></use></svg>
    <details class="faq-content">
    <summary>What are the differences between Restriction Cloning and Golden Gate?</summary>
    <div>
        <p><strong>Restriction Cloning:</strong> Uses traditional Type II restriction enzymes (e.g., EcoRI, BamHI) to cut DNA at specific recognition sites. Primers add restriction enzyme sites to your insert so that it can be cut and ligated into a similarly digested vector. Protective bases flanking restriction sites are strongly recommended to ensure efficient direct PCR product digestion. The restriction enzyme recognition site is retained at the vector–insert junction after ligation.</p>
        <p><strong>Golden Gate (Type IIS):</strong> Uses Type IIS enzymes (e.g., BsaI) that cut DNA outside their recognition site, allowing for seamless, directional assembly of multiple fragments in a single reaction. The enzyme recognizes and cleaves flanking "overhangs" so fragments can self-assemble in the correct order without religation.</p>
        <p><strong>Recommendation:</strong> Golden Gate is faster and more flexible for multi-fragment assembly, while Restriction Cloning is more traditional and well-established for single-fragment insertion.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-scissors"></use></svg>
    <details class="faq-content">
    <summary>How does Gibson Assembly differ from other cloning methods?</summary>
    <div>
        <p><strong>Gibson Assembly</strong> is an isothermal in vitro assembly method that combines:</p>
        <ul>
        <li><strong>Exonuclease:</strong> Creates short single-stranded overhangs (typically 15–30 bp) at fragment ends.</li>
        <li><strong>DNA Polymerase:</strong> Fills in any gaps created by exonuclease activity.</li>
        <li><strong>DNA Ligase:</strong> Seals the nicks to form continuous DNA.</li>
        </ul>
        <p>All three reactions occur simultaneously at 50°C in a single tube, making it fast and efficient. PrimerWeaver designs primers that add homologous overhangs (default 25 bp) to each fragment. Fragments then "find" each other via overlap and assemble in order without requiring pre-cut vectors or intermediate ligation steps.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-play"></use></svg>
    <details class="faq-content">
    <summary>What is Overlap PCR (OE-PCR) and how do I use it?</summary>
    <div>
        <p><strong>Overlap PCR (or overlap-extension PCR, OE-PCR)</strong> is a method to assemble multiple DNA fragments or introduce specific mutations without using intermediate vectors. It uses overlapping primers to create compatible overhangs between fragments.</p>
        <p><strong>Basic workflow:</strong></p>
        <ol style="margin: 0;">
        <li>Round 1: Amplify each fragment separately using outer primers and inner primers with overlapping 3' regions (the overlap region).</li>
        <li>Round 2: Mix all PCR products; the overlapping single-stranded regions anneal to each other, and a polymerase extends through the overlap, creating full-length fused products.</li>
        <li>Round 3: Add outer primers and re-amplify the full-length product for increased yield.</li>
        </ol>
        <p>This is ideal for mutagenesis (introducing changes at fragment junctions) or creating custom linkers between domains.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-pool"></use></svg>
    <details class="faq-content">
    <summary>How does the multiplex PCR pooling work?</summary>
    <div>
        <p>The multiplex module first designs optimal primers for all targets. Then, it analyzes potential conflicts between primers and partitions them into pools to minimize interference:</p>
        <p><strong>Three types of conflicts are considered:</strong></p>
        <ul>
        <li><strong>Cross-dimer Conflicts:</strong> Strong thermodynamic interactions between primers (ΔG ≤ −6 kcal/mol) can lead to primer-dimer formation, consuming primers and causing amplification failure. Primers with high dimer scores are separated into different pools.</li>
        <li><strong>Product Size Conflicts:</strong> PCR products with very similar sizes (difference &lt; size tolerance) may not be distinguishable on gel electrophoresis. Primers generating products of similar sizes are placed in separate pools to resolve this on the gel.</li>
        <li><strong>Off-target Amplification Conflicts:</strong> Multiple primer pairs that can amplify the same non-target sequence produce overlapping bands on gel electrophoresis, making it difficult to identify the correct products. Such primers are assigned to different pools.</li>
        </ul>
        <p>PrimerWeaver uses a graph-coloring algorithm to automatically assign primers to the <strong>minimum number of compatible pools</strong>, ensuring efficient multiplexing while avoiding these conflicts.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-settings"></use></svg>
    <details class="faq-content">
    <summary>How do I design primers for site-directed mutagenesis?</summary>
    <div>
        <p>PrimerWeaver's <strong>Mutagenesis</strong> module designs primers for introducing site-specific mutations using an overlap-extension PCR (OE-PCR) strategy.</p>
        <p><strong>Design approach:</strong> Input the wild-type sequence and specify the desired mutation (e.g., V55A: valine at position 55 to alanine). The tool designs two primer pairs that flank your mutation site. Each pair generates a PCR fragment with the desired mutation at the overlap region. The primers are designed so their 3' ends (containing the mutation) are complementary to each other.</p>
        <p><strong>Key experimental steps:</strong></p>
        <ul>
        <li><strong>Round 1:</strong> Amplify two separate fragments from your template using the designed primer pairs. Each fragment contains part of the mutation.</li>
        <li><strong>Round 2 (Overlap Extension):</strong> Mix the two PCR products; the overlapping single-stranded regions (with the mutation) anneal to each other, and a polymerase extends through the overlap, creating the full-length mutant product.</li>
        <li><strong>Round 3:</strong> If needed, re-amplify the full-length product with outer primers for increased yield.</li>
        <li><strong>Verification:</strong> Confirm mutation by sequencing before using the final construct.</li>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-layers"></use></svg>
    <details class="faq-content">
    <summary>How do I design primers for multi-fragment assembly (USER, Golden Gate or Gibson)?</summary>
    <div>
        <p><strong>Input preparation:</strong> Provide all DNA fragments you want to assemble (e.g., promoter, CDS, terminator, backbone). You can upload or paste them in FASTA format.</p>
                </ul>
        <p><strong>For USER Cloning:</strong></p>
        <ul>
        <li>USER (Uracil-Specific Excision Reagent) cloning uses uracil-containing primers to create seamless junctions between DNA fragments.</li>
        <li>Specify the overlap length (typically 7–15 bp).</li>
        <li>PrimerWeaver designs primers with uracil substitutions in the overlap regions at specific positions.</li>
        <li>After PCR, treatment with the USER enzyme mixture cleaves DNA at uracil positions, generating complementary single-stranded overhangs. </li>
        <li>Fragments are mixed, and the complementary overhangs anneal to form seamless assemblies, which are typically repaired after transformation. </li>
        </ul>

	<p><strong>For Golden Gate:</strong></p>
        <ul>
        <li>Select your Type IIS enzyme (e.g., BsaI, BsmBI).</li>
        <li>PrimerWeaver designs primers with compatible overhangs flanking each fragment.</li>
        <li>After PCR, set up the golden gate assembly reaction with your chosen enzyme; fragments will assemble in the correct order in a single reaction.</li>
        </ul>
        <p><strong>For Gibson Assembly:</strong></p>
        <ul>
	<li>Optional: choose the linker between inserts.</li>
        <li>Specify the overlap length (typically 20–30 bp).</li>
        <li>PrimerWeaver adds homologous sequences to fragment ends; fragments overlap and are assembled by Gibson reaction mastermix in a single 50°C reaction.</li>

        <p><strong>Pro tip:</strong> Design primers for all fragments together to ensure compatibility and optimal assembly ratios.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-list"></use></svg>
    <details class="faq-content">
    <summary>How do I export and use the results?</summary>
    <div>
        <p>PrimerWeaver provides export options for your primer designs and assembled sequences:</p>
        <ul>
        <li><strong>Primers File (FASTA format):</strong> Download as <code>primers.txt</code>. Contains all designed primer sequences in standard FASTA format, one primer per entry. Ready for ordering from synthesis companies or for BLAST searches against genomic databases.</li>
        <li><strong>Assembled Sequence:</strong> Download the final assembled DNA sequence (for assembly workflows like Golden Gate, Gibson, USER, or OE-PCR) as FASTA format. Includes all fragments assembled in the correct order with compatible junctions.</li>
        </ul>
        <p><strong>Usage tips:</strong></p>
        <ul>
        <li>Copy primer sequences directly from the FASTA file to your primer order form.</li>
        <li>Verify the assembled sequence by comparing it to your design specification before proceeding with experiments.</li>
        <li>Store both files for record-keeping and reproducibility of your design.</li>
        <li>Use BLAST to verify primer specificity against your target genome or reference sequence.</li>
        </ul>
    </div>
    </details>
</div>

<h3 style="margin-top: 24px; margin-bottom: 16px; color: #555;">Quality Control & Validation</h3>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-list"></use></svg>
    <details class="faq-content">
    <summary>How should I interpret the QC metrics in the Primer QC report?</summary>
    <div>
        <p>The <strong>Primer QC</strong> module performs in-silico analysis on your primer pairs to predict potential issues:</p>
        <ul>
        <li><strong>Specificity (BLAST-like):</strong> PrimerWeaver searches the provided reference sequence (template) to ensure primers bind primarily at the intended target. High specificity reduces off-target amplification.</li>
        <li><strong>Hairpin Formation:</strong> Predicts intramolecular secondary structures. If too stable, primers may not extend properly during PCR.</li>
        <li><strong>Homodimer Formation:</strong> Assesses if identical primers can bind to each other, potentially sequestering primers and reducing PCR efficiency.</li>
        <li><strong>Heterodimer Formation:</strong> Checks cross-reactivity between forward and reverse primers; strong dimers can reduce PCR yield.</li>
        <li><strong>GC Clamp (3' end):</strong> Primers ideally end with G or C at the 3′ end, which can improve primer–template stability and extension efficiency. PrimerWeaver flags primers ending with A or T, as they may be less efficient in some PCR conditions.</li>
        <li><strong>Homopolymer Runs:</strong> Stretches of 4+ identical bases (e.g., 'AAAA') are flagged as they reduce specificity and can promote mispriming or slippage during amplification.</li>
        </ul>
        <p><strong>Interpretation:</strong> Review warnings carefully, especially if designing in repetitive or low-complexity regions.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-pool"></use></svg>
    <details class="faq-content">
    <summary>How do I validate that my designed primers will work experimentally?</summary>
    <div>
        <p>Before ordering, follow these best practices:</p>
        <ul>
        <li><strong>In-silico QC:</strong> Use PrimerWeaver's QC module to check for hairpins, dimers, and off-target binding. Review all warnings.</li>
        <li><strong>BLAST Check:</strong> Copy your forward and reverse primer sequences to NCBI BLAST and verify they match your target with high specificity (e-value &lt; 0.01).</li>
        <li><strong>Tm Difference:</strong> Ensure forward and reverse Tm values are within 3–5°C of each other for balanced PCR amplification.</li>
        <li><strong>Multiplicity Check:</strong> In multiplex designs, run PrimerWeaver's dimer analysis and respect the suggested pool assignments.</li>
        <li><strong>Experimental Optimization:</strong> After ordering, test with gradient PCR (58–62°C annealing) to identify the optimal temperature; adjust as needed.</li>
        </ul>
        <p><strong>Tip:</strong> If primers fail, review the QC report, check template quality, and consider re-designing with relaxed constraints.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-fail"></use></svg>
    <details class="faq-content">
    <summary>My primer design failed. What are the common reasons?</summary>
    <div>
        <p>Design can fail for several reasons, typically related to your constraints:</p>
        <ul>
        <li><strong>No Valid Primers Found:</strong> The tool could not find a primer pair that met all constraints (e.g., Tm, GC%, product size). Try broadening the Tm range.</li>
        <li><strong>Low-Complexity Regions:</strong> Primers cannot be designed in regions of very low complexity (e.g., 'AAAAAAAAAA'). Consider adjusting your target region or removing ambiguous bases.</li>
        <li><strong>High Dimer Score:</strong> In Multiplex mode, if a primer has unavoidable high-affinity dimers with all other primers, it may be excluded. Try reducing the number of targets or increasing the dimer threshold.</li>
        <li><strong>Template Issues:</strong> Verify your template sequence is correct and long enough to flank your target region (typically ±50 bp).</li>
        </ul>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-scissors"></use></svg>
    <details class="faq-content">
    <summary>Can I redesign primers if the first set fails?</summary>
    <div>
        <p>Yes! If your designed primers do not work experimentally:</p>
        <ol>
        <li><strong>Review the QC report:</strong> Check for hairpins, dimers, or off-target binding predictions.</li>
        <li><strong>Relax constraints:</strong> Try widening the Tm range (e.g., 55–65°C instead of 62–65°C).</li>
        <li><strong>Verify template DNA:</strong> Ensure your PCR template is pure and at appropriate concentration (typically 100–1000 ng for genomic, 1–20 ng for plasmid in standard 50ul reaction).</li>
        <li><strong>Check reagents:</strong> Confirm polymerase activity, dNTP freshness, and primer storage conditions.</li>
        <li><strong>Optimize PCR conditions:</strong> Test multiple annealing temperatures (gradient PCR) and extension times.</li>
        <li><strong>Redesign with PrimerWeaver:</strong> Use the same constraints or adjust them based on failure mode. PrimerWeaver typically returns multiple primer pairs; if the first choice fails, the alternatives may succeed.</li>
        </ol>
        <p><strong>Keep notes:</strong> Document which primer set and conditions worked; this helps with future designs.</p>
    </div>
    </details>
</div>

<h3 style="margin-top: 24px; margin-bottom: 16px; color: #555;">Technical Details & Support</h3>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-format"></use></svg>
    <details class="faq-content">
    <summary>What reference sequence formats and sizes does PrimerWeaver support?</summary>
    <div>
        <p>PrimerWeaver is optimized for typical molecular biology workflows and supports:</p>
        <ul>
        <li><strong>Sequence Formats:</strong> FASTA (multi or single), plain DNA text (upper or lower case, whitespace ignored).</li>
        <li><strong>Typical Size Range:</strong> 100 bp to several hundred kilobases (limited mainly by browser performance, current set limit is 1MB file).</li>
        <li><strong>Protein Sequences:</strong> Not directly supported; translate to DNA (codon usage optimization not built-in, but you can manually optimize).</li>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-info"></use></svg>
    <details class="faq-content">
    <summary>What are the computational requirements and browser compatibility?</summary>
    <div>
        <p><strong>Browser Compatibility:</strong> PrimerWeaver runs on any modern browser with JavaScript enabled:</p>
        <ul>
        <li>Chrome 60+ (recommended for best performance)</li>
        <li>Firefox 55+</li>
        <li>Safari 12+</li>
        <li>Edge 79+</li>
        </ul>
        
        <p><strong>Performance Tips:</strong></p>
        <ul>
        <li>Calculations are CPU-bound; older machines or mobile devices may take longer for large designs (&gt;100 fragments).</li>
        <li>Close other tabs or applications to free up CPU resources.</li>
        <li>Use the latest browser version for best optimization.</li>
        </ul>
        <p><strong>Troubleshooting Slow Performance:</strong> If design takes &gt;30 seconds, simplify inputs (fewer fragments, smaller sequences) and retry.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-settings"></use></svg>
    <details class="faq-content">
    <summary>How do I report a bug or request a feature?</summary>
    <div>
        <p>We welcome your feedback! To report issues or suggest improvements:</p>
        <ol>
        <li><strong>Use the Contact Form:</strong> Navigate to <strong>About</strong> and fill out the Contact Us form with details of the issue or feature request.</li>
        <li><strong>GitHub Issues:</strong> Visit the <a href="https://github.com/ZimoJin/PrimerWeaver" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">PrimerWeaver GitHub repository</a> and open an issue (requires a free GitHub account).</li>
        <li><strong>Direct Email:</strong> Contact the corresponding authors listed in the Impressum (About page).</li>
        </ol>
        <p><strong>Helpful information to include:</strong></p>
        <ul>
        <li>Exact steps to reproduce the issue (if applicable).</li>
        <li>Expected vs. observed behavior.</li>
        <li>Browser type and version (check Settings → About in your browser).</li>
        <li>Example sequences or parameters if relevant.</li>
        </ul>
        <p><strong>Response time:</strong> We aim to respond within 2–3 business days for critical issues.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-user"></use></svg>
    <details class="faq-content">
    <summary>Is there a batch processing or API for high-throughput primer design?</summary>
    <div>
        <p>Currently, PrimerWeaver is a single-instance, browser-based tool optimized for immediate, interactive design workflows. There is <strong>no built-in batch processing or REST API</strong> at this time.</p>
        <p><strong>Workaround for multiple designs:</strong></p>
        <ul>
        <li>Open multiple browser tabs and design primers in parallel (browser-side computation scales well).</li>
        <li>Export results as CSV/JSON and collate results into a master spreadsheet.</li>
        <li>For very large-scale projects, contact the authors to discuss custom development options.</li>
        </ul>
        <p><strong>Future Consideration:</strong> The modular JavaScript architecture allows for potential API integration or backend deployment. Contact us if you have specific high-throughput needs.</p>
    </div>
    </details>
</div>

<div class="faq-item">
    <svg class="faq-icon" aria-hidden="true"><use xlink:href="#icon-award"></use></svg>
    <details class="faq-content">
    <summary>How is PrimerWeaver maintained and will it continue to be available?</summary>
    <div>
        <p><strong>Funding & Support:</strong> PrimerWeaver is maintained by the Ignea Lab at McGill University with ongoing research and technical support.</p>
        <p><strong>Updates & Maintenance:</strong></p>
        <ul>
        <li>Bug fixes are deployed promptly.</li>
        <li>Feature enhancements are released periodically (typically every 6 months).</li>
        <li>Browser compatibility is maintained as standards evolve.</li>
        </ul>
        <p><strong>Open Science:</strong> The source code is available on GitHub, allowing community contributions and ensuring that the tool is not dependent on a single institution. If for any reason the hosted service becomes unavailable, the code can be forked and self-hosted.</p>
    </div>
    </details>
</div>
</section>
`;
}

function about() {
    return `
<svg width="0" height="0" style="position:absolute">
<defs>
    <symbol id="icon-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
    </symbol>
    
    <symbol id="icon-status" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>
    </symbol>
    <symbol id="icon-award" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 17 17 23 15.79 13.88"></polyline>
    </symbol>
    <symbol id="icon-file" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline>
    </symbol>
</defs>
</svg>

<section class="grid cols-2">
<div class="card" style="padding:22px 28px">
    
    <div class="about-item">
    <svg class="about-icon" aria-hidden="true"><use xlink:href="#icon-info"></use></svg>
    <div class="about-content">
        <h3>About PrimerWeaver</h3>
        <p class="muted">
            <strong>PrimerWeaver</strong> is a browser-based primer design and <i>in&nbsp;silico</i> QC platform that supports common cloning and PCR workflows from a single, consistent interface:
            Restriction cloning, Golden Gate (Type IIS), Gibson Assembly, USER cloning, overlap PCR (SOE-PCR), mutagenesis, multiplex PCR, and standalone Primer QC.
        </p>
        <p class="muted">
            PrimerWeaver is designed for privacy and convenience: calculations run locally in your web browser using JavaScript, so sequences are processed on-device.
            No login is required and no cookies are needed for core functionality.
        </p>
    </div>
    </div>
    
    <div class="about-item">
    <svg class="about-icon" aria-hidden="true"><use xlink:href="#icon-edit"></use></svg>
    <div class="about-content">
        <h3>Contact Us</h3>
        <p class="small muted">For bug reports, feature requests, or collaboration inquiries, please use the form below or contact the corresponding author via email.</p>
        
        <form id="contactForm">
        <label for="c-email">Your email (for a reply)</label>
        <input type="email" id="c-email" required autocomplete="email" />
        
        <label for="c-msg">Message</label>
        <textarea id="c-msg" required placeholder="Report a bug, suggest a feature..."></textarea>
        
        <div class="btn-group">
            <button class="btn" type="submit">Send Message</button>
            <button class="btn ghost" type="reset">Reset</button>
        </div>
        </form>
    </div>
    </div>

</div>
<div class="card" style="padding:22px 28px">

    <div class="about-item">
    <svg class="about-icon" aria-hidden="true"><use xlink:href="#icon-status"></use></svg>
    <div class="about-content">
        <h3>System Status</h3>
        <ul class="small muted" style="padding-left: 20px; margin-top: 0;">
        <li><strong>Compute model:</strong> Client-side (runs in your browser)</li>
        <li><strong>Queue policy:</strong> None (no server-side jobs)</li>
        <li><strong>Data handling:</strong> No sequence upload required for analysis</li>
        <li><strong>Availability:</strong> Works offline after assets are cached by the browser (when supported)</li>
        <li><strong>Version:</strong> v1.0.1</li>
        </ul>
    </div>
    </div>

    <div class="about-item">
    <svg class="about-icon" aria-hidden="true"><use xlink:href="#icon-award"></use></svg>
    <div class="about-content">
        <h3>Credits & Acknowledgements</h3>
        <p class="small muted">
            PrimerWeaver’s thermodynamic calculations and QC routines are based on widely used nearest-neighbor models and published parameters.
            We gratefully acknowledge the foundational work of:
        </p>
        <ul class="small muted" style="margin-top: 0; padding-left: 20px;">
            <li>SantaLucia, J. (1998). A unified view of DNA nearest-neighbor thermodynamics. <em>Proc. Natl. Acad. Sci. USA</em>.</li>
            <li>Allawi, H. T., &amp; SantaLucia, J. (1997). Thermodynamics of internal mismatches in DNA. <em>Biochemistry</em>.</li>
            <li>SantaLucia, J. (2004). Thermodynamics of DNA structural motifs. <em>Annu. Rev. Biophys. Biomol. Struct.</em>.</li>
        </ul>
        <p class="small muted" style="margin-bottom: 0;">
            Workflow modules are informed by established molecular biology methods, including Golden Gate (Engler <em>et&nbsp;al.</em>), Gibson Assembly (Gibson <em>et&nbsp;al.</em>), and overlap-extension PCR / SOE-PCR (Horton <em>et&nbsp;al.</em>), as summarized in the PrimerWeaver documentation.
            If you use PrimerWeaver in academic work, please cite the PrimerWeaver web server and the relevant primary method/model references.
        </p>
    </div>
    </div>
    
    <div class="about-item">
    <svg class="about-icon" aria-hidden="true"><use xlink:href="#icon-file"></use></svg>
    <div class="about-content">
        <h3 id="impressum">Impressum (Legal Notice)</h3>
        <p class="small muted">
        <strong>Responsible for this service:</strong><br>
        Codruta Ignea<br>
        Ignea Lab, Department of Bioengineering<br>
	Biological and Biomedical Engineering Program<br>
        McGill University<br>
        Montreal, QC, Canada<br>
        <strong>Email:</strong> codruta.ignea@mcgill.ca
        </p>
    </div>
    </div>

</div>
</section>
`;
}


function appDashboard() {
    return `
    <svg width="0" height="0" style="position:absolute">
        <defs>
            <symbol id="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></symbol>
            <symbol id="icon-pool" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>
            </symbol>
            <symbol id="icon-scissors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle>
            <line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line>
            <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
            </symbol>
            <symbol id="icon-layers" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>
            </symbol>
            <symbol id="icon-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </symbol>
            <symbol id="icon-puzzle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
            </symbol>
            <symbol id="icon-beaker" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4.5 3h15"></path>
                <path d="M6 3v16c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3"></path>
                <path d="M6 14h12"></path>
                <path d="M9 9h.01"></path>
                <path d="M15 9h.01"></path>
                <path d="M12 11h.01"></path>
            </symbol>
            <symbol id="icon-merge" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 18c-3.31 0-6-2.69-6-6V4M4 4v8c0 3.31 2.69 6 6 6h4"/><polyline points="15 15 18 18 15 21"/>
            </symbol>
            <symbol id="icon-edit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </symbol>
            <symbol id="icon-loader" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </symbol>
            <symbol id="icon-fullscreen-enter" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
            </symbol>
            <symbol id="icon-fullscreen-exit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
            </symbol>
        </defs>
    </svg>

    <section class="hero">
        <div>
            <h2>PrimerWeaver App Dashboard</h2>
            <p class="muted">Select a cloning or analysis module to begin.</p>
            
            <div class="grid cols-3" style="margin-top:30px;">
                
                <div class="card tool-card">
                    <svg class="tool-card-icon" aria-hidden="true"><use xlink:href="#icon-check"></use></svg>
                    <h3>Primer QC</h3>
                    <p class="small muted">Analyze existing primers for Tm, GC, hairpins, and dimers.</p>
                    <div class="tool-card-buttons">
                        <a href="#/docs#d-qc" class="btn ghost">Read Docs</a>
                        <a href="#/app/qc" class="btn">Open App</a>
                    </div>
                </div>
                <div class="card tool-card">
                    <svg class="tool-card-icon" aria-hidden="true"><use xlink:href="#icon-merge"></use></svg>
                    <h3>Overlap PCR</h3>
                    <p class="small muted">Design primers to stitch two or more DNA fragments together (SOE-PCR).</p>
                    <div class="tool-card-buttons">
                        <a href="#/docs#d-opcr" class="btn ghost">Read Docs</a>
                        <a href="#/app/overlap-pcr" class="btn">Open App</a>
                    </div>
                </div>
                <div class="card tool-card">
                    <svg class="tool-card-icon" aria-hidden="true"><use xlink:href="#icon-edit"></use></svg>
                    <h3>Mutagenesis</h3>
                    <p class="small muted">Generate primers for site-directed mutagenesis.</p>
                    <div class="tool-card-buttons">
                        <a href="#/docs#d-muta" class="btn ghost">Read Docs</a>
                        <a href="#/app/mutagenesis" class="btn">Open App</a>
                    </div>
                </div>
                <div class="card tool-card">
                    <svg class="tool-card-icon" aria-hidden="true"><use xlink:href="#icon-beaker"></use></svg>
                    <h3>Multiplex PCR</h3>
                    <p class="small muted">Design and sort primers into compatible, non-conflicting pools.</p>
                    <div class="tool-card-buttons">
                        <a href="#/docs#d-mp" class="btn ghost">Read Docs</a>
                        <a href="#/app/multiplex-pcr" class="btn">Open App</a>
                    </div>
                </div>
                <div class="card tool-card">
                    <svg class="tool-card-icon" aria-hidden="true"><use xlink:href="#icon-scissors"></use></svg>
                    <h3>Restriction Cloning</h3>
                    <p class="small muted">Design primers for traditional enzyme-based cloning.</p>
                    <div class="tool-card-buttons">
                        <a href="#/docs#d-re" class="btn ghost">Read Docs</a>
                        <a href="#/app/restriction" class="btn">Open App</a>
                    </div>
                </div>
                <div class="card tool-card">
                    <svg class="tool-card-icon" aria-hidden="true"><use xlink:href="#icon-layers"></use></svg>
                    <h3>USER Cloning</h3>
                    <p class="small muted">Designs primers incorporating uracil for seamless cloning.</p>
                    <div class="tool-card-buttons">
                        <a href="#/docs#d-user" class="btn ghost">Read Docs</a>
                        <a href="#/app/user" class="btn">Open App</a>
                    </div>
                </div>
                <div class="card tool-card">
                    <svg class="tool-card-icon" aria-hidden="true"><use xlink:href="#icon-puzzle"></use></svg>
                    <h3>Golden Gate Assembly</h3>
                    <p class="small muted">Designs primers for Type IIS multi-fragment assembly.</p>
                    <div class="tool-card-buttons">
                        <a href="#/docs#d-gg" class="btn ghost">Read Docs</a>
                        <a href="#/app/golden-gate" class="btn">Open App</a>
                    </div>
                </div>
                <div class="card tool-card">
                    <svg class="tool-card-icon" aria-hidden="true"><use xlink:href="#icon-link"></use></svg>
                    <h3>Gibson Assembly</h3>
                    <p class="small muted">Generates optimized homology overlaps with a uniform target Tm.</p>
                    <div class="tool-card-buttons">
                        <a href="#/docs#d-gb" class="btn ghost">Read Docs</a>
                        <a href="#/app/gibson" class="btn">Open App</a>
                    </div>
                </div>
                <div class="card tool-card" style="opacity: 0.6; border-style: dashed;">
                    <svg class="tool-card-icon" aria-hidden="true"><use xlink:href="#icon-loader"></use></svg>
                    <h3>More is coming...</h3>
                    <p class="small muted">
                        New tools and modules are currently in development.
                    </p>
                    <a href="#" onclick="return false;" class="btn" style="margin-top: auto; padding: 6px 12px; font-size: 14px; background-color: var(--muted);">Coming Soon</a>
                </div>
            </div>
        </div>
    </section>
    `;
}


function notFound() {
    return `<section class="card" style="padding:18px"><h2>404</h2><p>Page not found.</p></section>`;
}

// --- Documentation Page Content ---
// Cache for loaded documents
const docCache = {};
let teardownDocsMobileDropdown = null;

function scopeDocCss(cssText, scopeSelector) {
    // Scopes plain CSS rules to a container so they don't leak into the main page.
    // Handles nested @media/@supports blocks; leaves @keyframes/@font-face untouched.
    const len = cssText.length;
    let i = 0;

    const isWhitespace = (ch) => ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '\f';

    const skipWhitespaceAndComments = () => {
        while (i < len) {
            // whitespace
            while (i < len && isWhitespace(cssText[i])) i++;
            // comments /* ... */
            if (cssText[i] === '/' && cssText[i + 1] === '*') {
                i += 2;
                while (i < len && !(cssText[i] === '*' && cssText[i + 1] === '/')) i++;
                if (i < len) i += 2;
                continue;
            }
            break;
        }
    };

    const readUntil = (stopChar) => {
        const start = i;
        while (i < len && cssText[i] !== stopChar) i++;
        return cssText.slice(start, i);
    };

    const readBlock = () => {
        // Assumes current char is '{'. Returns inner content, consumes matching '}'.
        if (cssText[i] !== '{') return '';
        i++; // skip '{'
        const start = i;
        let depth = 1;
        while (i < len && depth > 0) {
            // skip comments inside blocks
            if (cssText[i] === '/' && cssText[i + 1] === '*') {
                i += 2;
                while (i < len && !(cssText[i] === '*' && cssText[i + 1] === '/')) i++;
                if (i < len) i += 2;
                continue;
            }
            if (cssText[i] === '{') depth++;
            else if (cssText[i] === '}') depth--;
            i++;
        }
        const end = i - 1; // position of matching '}'
        return cssText.slice(start, end);
    };

    const sanitizeBodyDecls = (declsText) => {
        // Keep typography but drop layout/background that would conflict with the host page.
        const kept = [];
        declsText
            .split(';')
            .map(s => s.trim())
            .filter(Boolean)
            .forEach(d => {
                const prop = d.split(':')[0]?.trim().toLowerCase();
                if (!prop) return;
                if (prop === 'background' || prop.startsWith('background-')) return;
                if (prop === 'margin' || prop.startsWith('margin-')) return;
                if (prop === 'padding' || prop.startsWith('padding-')) return;
                if (prop === 'max-width' || prop === 'width') return;
                // We keep font-family, line-height, color, etc.
                kept.push(d);
            });
        return kept.length ? kept.join(';\n    ') + ';' : '';
    };

    const scopeSelectorList = (selectorText, declsText) => {
        const selectors = selectorText
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .map(sel => {
                const lower = sel.toLowerCase();
                const isBodyOnly = lower === 'body' || lower === 'html';
                if (isBodyOnly) return scopeSelector;
                if (lower.startsWith('body ')) return scopeSelector + sel.slice(4);
                if (lower.startsWith('html ')) return scopeSelector + sel.slice(4);
                return scopeSelector + ' ' + sel;
            });

        const joined = selectors.join(', ');
        const hasBody = selectorText.split(',').some(s => {
            const t = s.trim().toLowerCase();
            return t === 'body' || t === 'html' || t.startsWith('body ') || t.startsWith('html ');
        });

        if (hasBody) {
            return { selector: joined, decls: sanitizeBodyDecls(declsText) };
        }
        return { selector: joined, decls: declsText.trim() };
    };

    const scopeInner = (innerCss) => scopeDocCss(innerCss, scopeSelector);

    let out = '';
    while (i < len) {
        skipWhitespaceAndComments();
        if (i >= len) break;

        if (cssText[i] === '@') {
            // at-rule
            const atStart = i;
            const prelude = readUntil('{').trim();
            if (i >= len || cssText[i] !== '{') {
                // no block; copy until ';'
                i = atStart;
                const stmt = readUntil(';');
                if (cssText[i] === ';') i++;
                out += stmt + ';';
                continue;
            }

            // block at-rule
            i = atStart;
            const fullPrelude = readUntil('{');
            const lowerPrelude = fullPrelude.trim().toLowerCase();

            // consume '{' and block
            const inner = readBlock();

            if (lowerPrelude.startsWith('@media') || lowerPrelude.startsWith('@supports') || lowerPrelude.startsWith('@layer')) {
                out += fullPrelude + '{' + scopeInner(inner) + '}';
            } else {
                // @keyframes, @font-face, etc. Leave untouched
                out += fullPrelude + '{' + inner + '}';
            }
            continue;
        }

        // normal rule: selector { declarations }
        const selectorText = readUntil('{').trim();
        if (i >= len || cssText[i] !== '{') break;
        const declsText = readBlock();

        const scoped = scopeSelectorList(selectorText, declsText);
        if (!scoped.decls) {
            // If body/html rule sanitized to nothing, skip it entirely
            continue;
        }
        out += `${scoped.selector} {\n    ${scoped.decls}\n}\n`;
    }

    return out;
}

async function loadDocumentHTML(filePath) {
    // Return cached version if available
    if (docCache[filePath]) {
        return docCache[filePath];
    }
    
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load: ${response.status}`);
        }
        const html = await response.text();
        
        // Parse HTML and extract both styles and content, but keep styles scoped to the doc panel
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract style tag contents (do NOT inject them globally)
        const styleTags = doc.querySelectorAll('style');
        let rawCss = '';
        styleTags.forEach(style => {
            rawCss += (style.textContent || '') + '\n';
        });
        const scopedCss = rawCss ? scopeDocCss(rawCss, '#docBody .doc-scope') : '';

        // Host-page override to avoid a "card inside a card" look:
        // the docs HTML uses a `.container` with its own background + shadow.
        // We keep the structure but flatten the inner container visuals (and remove its extra padding)
        // so `#docBody` is the single card.
        const docsHostOverrideCss = `
 #docBody .doc-scope .container {
     background: transparent;
     box-shadow: none;
     border: 0;
     border-radius: 0;
     padding: 0;
     width: 100%;
     max-width: none;
     margin: 0;
 }

 /* Docs: keep media responsive (especially on mobile) */
 #docBody .doc-scope img,
 #docBody .doc-scope svg,
 #docBody .doc-scope video,
 #docBody .doc-scope canvas {
     max-width: 100%;
     height: auto;
 }

 /* Prefer full-width screenshots on small screens, overriding inline max-width styles */
 @media (max-width: 780px) {
     #docBody .doc-scope img {
         width: 100% !important;
         max-width: 100% !important;
         height: auto !important;
     }
 }

 /* Slightly increase the gap between the docs H1 text and its underline */
 #docBody .doc-scope h1 {
     padding-bottom: 30px;
     line-height: 1.15;
}
`.trim();
        
        // Extract the "card" itself when present, otherwise fall back to body
        const container = doc.querySelector('.container');
        let content;
        
        if (container) {
            // Keep the full card wrapper for padding/shadow/etc.
            content = container.outerHTML;
        } else if (doc.body) {
            // Fallback to body content if no container found
            content = doc.body.innerHTML;
        } else {
            // Last resort fallback
            content = html;
        }
        
        // Combine (scoped) styles + content inside a scope wrapper
        const mergedCss = [scopedCss, docsHostOverrideCss].filter(Boolean).join('\n\n');
        const fullContent = `${mergedCss ? `<style>${mergedCss}</style>` : ''}<div class="doc-scope">${content}</div>`;
        
        docCache[filePath] = fullContent;
        return fullContent;
    } catch (error) {
        console.error('Error loading document:', error);
        return `<div class="error"><h3>Error Loading Document</h3><p>Could not load the documentation file. Please try again.</p></div>`;
    }
}

// --- Old inline documentation functions removed - now loading from external HTML files ---

const docRoutes = {
    '#d-intro': 'contents/documents/introduction_doc.html',
    '#d-qc': 'contents/documents/QC_doc.html',
    '#d-opcr': 'contents/documents/oe_pcr_complete_doc.html',
    '#d-muta': 'contents/documents/mutagenesis_doc.html',
    '#d-mp': 'contents/documents/multiplex_pcr_doc.html',
    '#d-re': 'contents/documents/re_cloning_doc.html',
    '#d-user': 'contents/documents/user_cloning_doc.html',
    '#d-gg': 'contents/documents/golden_gate_doc.html',
    '#d-gb': 'contents/documents/gibson_doc.html',
};

function bindDocs(anchor) {
    const docNav = document.getElementById('doc-nav');
    const docBody = document.getElementById('docBody');
    const headerDocNav = document.getElementById('header-doc-nav');

    const docsMobileNav = document.getElementById('docsMobileNav');
    const docsMobileToggle = document.getElementById('docsMobileToggle');
    const docsMobileMenu = document.getElementById('docsMobileMenu');
    const docsMobileLabel = document.getElementById('docsMobileLabel');

    // Tear down prior document-level handlers (avoid stacking listeners across navigations)
    if (typeof teardownDocsMobileDropdown === 'function') {
        teardownDocsMobileDropdown();
        teardownDocsMobileDropdown = null;
    }

    async function renderDocContent(id) {
        if (!id) id = '#d-intro';
        const filePath = docRoutes[id];
        
        if (!filePath) {
            if (docBody) docBody.innerHTML = '<p>Document not found.</p>';
            resetScrollToTop();
            return;
        }

        // Always start at the top on doc switches (immediate feedback)
        resetScrollToTop();
        
        // Sync the mobile dropdown label immediately (before load completes)
        if (docsMobileLabel) docsMobileLabel.textContent = getDocLabel(id);

        // Show loading state
        if (docBody) {
            docBody.innerHTML = '<p style="text-align:center; padding:40px;">Loading...</p>';
        }
        
        // Fetch and display content
        const html = await loadDocumentHTML(filePath);
        if (docBody) {
            docBody.innerHTML = html;
        }

        // Ensure the opened doc starts at the top (ignore anchors for scroll positioning)
        resetScrollToTop();
        
        // Update active link in sidebar
        if (docNav) {
            docNav.querySelectorAll('a').forEach(a => a.classList.remove('is-active'));
            const activeLink = docNav.querySelector(`a[data-doc="${id}"]`);
            if (activeLink) {
                activeLink.classList.add('is-active');
            }
        }

        // Update active link + label in mobile dropdown
        if (docsMobileMenu) {
            docsMobileMenu.querySelectorAll('a').forEach(a => a.classList.remove('is-active'));
            const activeMobile = docsMobileMenu.querySelector(`a[data-doc="${id}"]`);
            if (activeMobile) activeMobile.classList.add('is-active');
        }
        if (docsMobileLabel) {
            docsMobileLabel.textContent = getDocLabel(id);
        }
    }

    if (docNav) {
        docNav.addEventListener('click', e => {
            if (e.target.tagName !== 'A' || !e.target.getAttribute('data-doc')) return;
            e.preventDefault();

            const id = e.target.getAttribute('data-doc');
            renderDocContent(id);
            history.replaceState(null, '', `#/docs${id}`);
        });
    }

    // --- Mobile dropdown behavior ---
    const closeDocsMobileMenu = () => {
        if (!docsMobileNav || !docsMobileToggle) return;
        docsMobileNav.classList.remove('is-open');
        docsMobileToggle.setAttribute('aria-expanded', 'false');
    };

    const openDocsMobileMenu = () => {
        if (!docsMobileNav || !docsMobileToggle) return;
        docsMobileNav.classList.add('is-open');
        docsMobileToggle.setAttribute('aria-expanded', 'true');
    };

    const toggleDocsMobileMenu = () => {
        if (!docsMobileNav) return;
        if (docsMobileNav.classList.contains('is-open')) closeDocsMobileMenu();
        else openDocsMobileMenu();
    };

    if (docsMobileToggle) {
        docsMobileToggle.addEventListener('click', (e) => {
            e.preventDefault();
            toggleDocsMobileMenu();
        });
    }

    if (docsMobileMenu) {
        docsMobileMenu.addEventListener('click', (e) => {
            const a = e.target.closest('a[data-doc]');
            if (!a) return;
            e.preventDefault();
            const id = a.getAttribute('data-doc');
            renderDocContent(id);
            history.replaceState(null, '', `#/docs${id}`);
            closeDocsMobileMenu();
        });
    }

    const onDocClick = (e) => {
        if (!docsMobileNav) return;
        if (!docsMobileNav.classList.contains('is-open')) return;
        if (docsMobileNav.contains(e.target)) return;
        closeDocsMobileMenu();
    };

    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeDocsMobileMenu();
        }
    };

    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', closeDocsMobileMenu);

    teardownDocsMobileDropdown = () => {
        document.removeEventListener('click', onDocClick);
        document.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('resize', closeDocsMobileMenu);
    };

    if (headerDocNav) {
        headerDocNav.addEventListener('click', e => {
            if (e.target.tagName !== 'A' || !e.target.getAttribute('data-doc')) return;

            const menu = document.querySelector('.menu');
            if (menu && menu.classList.contains('is-open')) {
                document.getElementById('menuBtn').click();
            }
        });
    }

    if (docBody) {
        docBody.addEventListener('click', e => {
            if (e.target.tagName === 'A' && e.target.getAttribute('data-doc')) {
                e.preventDefault();
                const id = e.target.getAttribute('data-doc');
                const sidebarLink = docNav.querySelector(`a[data-doc="${id}"]`);
                if (sidebarLink) {
                    sidebarLink.click();
                }
            }
        });
    }

    // Initialize mobile label + active state from current anchor
    if (!anchor) anchor = '#d-intro';
    if (docsMobileLabel) docsMobileLabel.textContent = getDocLabel(anchor);
    if (docsMobileMenu) {
        docsMobileMenu.querySelectorAll('a').forEach(a => a.classList.remove('is-active'));
        const activeMobile = docsMobileMenu.querySelector(`a[data-doc="${anchor}"]`);
        if (activeMobile) activeMobile.classList.add('is-active');
    }

    renderDocContent(anchor);
}

function bindAbout() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    const recipientEmail = 'zimo.jin@mail.mcgill.ca';
    const fromEmail = document.getElementById('c-email');
    const messageEl = document.getElementById('c-msg');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

        const from = (fromEmail?.value || '').trim();
        const message = (messageEl?.value || '').trim();
        const subject = `PrimerWeaver Contact${from ? ` (from ${from})` : ''}`;

        const bodyLines = [
            from ? `From: ${from}` : '',
            from ? '' : '',
            message || '',
            '',
            '---',
            `Page: ${location.href}`,
            `User agent: ${navigator.userAgent}`,
        ].filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''));

        const mailtoUrl = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
        window.location.href = mailtoUrl;
    });
}
