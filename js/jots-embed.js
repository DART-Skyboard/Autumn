/* jots-embed.js — in-game guest edition of Autumn for Journey of the Skyboard (the Bird Temple holo terminal).
 * Active ONLY when the URL has ?embed=jots (or the path is /jots/) AND the page is framed by https://dartmeadow.space
 * (location.ancestorOrigins where supported, otherwise document.referrer). Anything else runs the normal app, untouched.
 *
 * Isolation guarantees (each open of the terminal is its own throw-away guest instance):
 *  - guest only: _ghAuth is pinned to a signed-out guest (no stored-session restore, no OAuth, no cross-tab login),
 *    the sign-in / consent prompts are hidden and consent is never granted on the visitor's behalf.
 *  - nothing persistent, nothing shared: localStorage AND sessionStorage are fresh in-memory stores for this frame
 *    (so the real app's keys — palettes, art, session, consent — are never read or written, and storage being blocked
 *    by the browser cannot break the guest flow), cookies are an in-memory jar, IndexedDB / service workers /
 *    BroadcastChannel are inert.
 *  - nothing synced: every request to the sync backends (Apps Script, GitHub API/uploads) is refused, any method,
 *    sendBeacon is dropped, and the LEATR sync / consent / heartbeat entry points are no-ops.
 *  - a fixed in-game palette; ART / PALETTE / theme controls, the Ash Shard module and other account / sync modules hidden;
 *    a small dock surfaces Arc Lake, Mantis navigation, Mantis radar and a few tools.
 */
(function () {
  'use strict';
  var GAME = 'https://dartmeadow.space';
  var on = false;
  try {
    var want = /(?:^|[?&])embed=jots(?:&|$)/.test(location.search) || /^\/jots\/?$/.test(location.pathname);
    var framed = window.top !== window;
    var parentOrigin = '';
    if (location.ancestorOrigins && location.ancestorOrigins.length) parentOrigin = location.ancestorOrigins[0];
    else if (document.referrer) parentOrigin = new URL(document.referrer).origin;
    on = want && framed && parentOrigin === GAME;
  } catch (e) { on = false; }
  if (!on) return;
  window.AUT_EMBED = 'jots';
  function def(obj, name, val) { try { Object.defineProperty(obj, name, { configurable: true, enumerable: true, get: function () { return val; }, set: function () {} }); return true; } catch (e) { return false; } }

  // ── in-memory Storage (per frame, per open) ─────────────────────────────────
  function memStorage(seed) {
    var m = Object.create(null);
    Object.keys(seed || {}).forEach(function (k) { m[k] = String(seed[k]); });
    var api = {
      getItem: function (k) { k = String(k); return k in m ? m[k] : null; },
      setItem: function (k, v) { m[String(k)] = String(v); },
      removeItem: function (k) { delete m[String(k)]; },
      clear: function () { Object.keys(m).forEach(function (k) { delete m[k]; }); },
      key: function (i) { var ks = Object.keys(m); return i >= 0 && i < ks.length ? ks[i] : null; }
    };
    Object.defineProperty(api, 'length', { configurable: true, get: function () { return Object.keys(m).length; } });
    if (typeof Proxy !== 'function') return api;
    return new Proxy(api, {
      get: function (t, k) { if (k in t) return typeof t[k] === 'function' ? t[k] : t[k]; return typeof k === 'string' && k in m ? m[k] : undefined; },
      set: function (t, k, v) { if (k in t) return true; m[String(k)] = String(v); return true; },
      has: function (t, k) { return k in t || k in m; },
      deleteProperty: function (t, k) { delete m[String(k)]; return true; },
      ownKeys: function () { return Object.keys(m); },
      getOwnPropertyDescriptor: function (t, k) { return typeof k === 'string' && k in m ? { value: m[k], writable: true, enumerable: true, configurable: true } : undefined; }
    });
  }
  // fixed in-game palette + guest flags live only in this frame's memory
  var PAL = { id: 'jots-data-ariel', name: 'Data Ariel', bg1: '#6f00ff', bg2: '#00ff73', accent: '#ff0073' };
  var LS = memStorage({
    aut_theme: 'void',
    _gh_login_skipped: '1',
    'autumn_palettes_v1:guest': JSON.stringify([PAL]),
    'autumn_palette_v1:guest': JSON.stringify(PAL.id)
  });
  var SS = memStorage({});
  def(window, 'localStorage', LS);
  def(window, 'sessionStorage', SS);
  // cookies: in-memory jar (never reads or writes the site's real cookies)
  var jar = Object.create(null);
  try {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: function () { return Object.keys(jar).map(function (k) { return k + '=' + jar[k]; }).join('; '); },
      set: function (v) { var kv = String(v).split(';')[0], i = kv.indexOf('='); if (i > 0) { var k = kv.slice(0, i).trim(); if (/max-age=0|expires=Thu, 01 Jan 1970/i.test(v)) delete jar[k]; else jar[k] = kv.slice(i + 1).trim(); } }
    });
  } catch (e) {}
  // IndexedDB / service worker / cross-tab channels: inert
  var idbStub = {
    open: function () {
      var req = { result: null, error: new DOMException('IndexedDB disabled in the JOTS embed', 'InvalidStateError'), onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null, addEventListener: function () {}, removeEventListener: function () {} };
      setTimeout(function () { if (typeof req.onerror === 'function') req.onerror({ target: req }); }, 0);
      return req;
    },
    deleteDatabase: function () { return idbStub.open(); },
    databases: function () { return Promise.resolve([]); },
    cmp: function () { return 0; }
  };
  def(window, 'indexedDB', idbStub);
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = function () { return Promise.reject(new Error('jots embed: no service worker')); }; } catch (e) {}
  function InertChannel(name) { this.name = name; this.onmessage = null; }
  InertChannel.prototype.postMessage = function () {}; InertChannel.prototype.close = function () {};
  InertChannel.prototype.addEventListener = function () {}; InertChannel.prototype.removeEventListener = function () {};
  def(window, 'BroadcastChannel', InertChannel);

  // ── guest only: pin _ghAuth to a signed-out guest ───────────────────────────
  var AUTH_KEYS = { loggedIn: false, token: null, username: null, avatar_url: null, name: null, repoName: null, role: null, isAdmin: false };
  var authBase = {};
  var guestAuth = typeof Proxy === 'function' ? new Proxy(authBase, {
    get: function (t, k) { return Object.prototype.hasOwnProperty.call(AUTH_KEYS, k) ? AUTH_KEYS[k] : t[k]; },
    set: function (t, k, v) { if (!Object.prototype.hasOwnProperty.call(AUTH_KEYS, k)) t[k] = v; return true; }
  }) : authBase;
  try {
    Object.defineProperty(window, '_ghAuth', {
      configurable: false, enumerable: true,
      get: function () { return guestAuth; },
      set: function (v) { if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(AUTH_KEYS, k)) authBase[k] = v[k]; }); }
    });
  } catch (e) {}

  // ── nothing synced: refuse every request to the sync / profile backends ──────
  var blocked = /^https?:\/\/([a-z0-9-]+\.)*(script\.google\.com|script\.googleusercontent\.com|api\.github\.com|uploads\.github\.com)(:\d+)?\//i;
  function urlOf(x) { try { return new URL(typeof x === 'string' ? x : (x && x.url) || String(x), location.href).href; } catch (e) { return String(x); } }
  window.__jotsBlocked = [];
  function refuse(u) { try { window.__jotsBlocked.push(u.slice(0, 120)); } catch (e) {} }
  try {
    var of = window.fetch;
    window.fetch = function (input) {
      var u = urlOf(input);
      if (blocked.test(u)) { refuse(u); return Promise.reject(new TypeError('jots embed: sync disabled')); }
      return of.apply(this, arguments);
    };
    var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) { this.__jotsBlock = blocked.test(urlOf(url)); if (this.__jotsBlock) refuse(urlOf(url)); return xo.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () { if (this.__jotsBlock) { var x = this; setTimeout(function () { try { x.dispatchEvent(new Event('error')); } catch (e) {} }, 0); return; } return xs.apply(this, arguments); };
    if (navigator.sendBeacon) navigator.sendBeacon = function () { return false; };
    var WS = window.WebSocket;
    if (WS) { var W2 = function (u) { if (blocked.test(urlOf(u))) throw new Error('jots embed: sync disabled'); return new (Function.prototype.bind.apply(WS, [null].concat([].slice.call(arguments))))(); }; W2.prototype = WS.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) { W2[k] = WS[k]; }); window.WebSocket = W2; }
  } catch (e) {}
  // inline scripts define these as they parse: stub them now and again once everything has run
  var NOOP = function () { return Promise.resolve(null); };
  var SYNC = ['initLeatrAshSync', 'checkDataPolicyConsent', 'acceptDataPolicy', 'writeLeatrAshMemory', 'syncToolPattern', '_pollAshNodes', '_fetchAnalytics', '_ashFlushNow',
    '_ghStartOAuth', '_ghReLogin', '_ghSwitchAccount', '_doWebFlowRedirect', 'acSaveToAsh'];
  function stubSync() { SYNC.forEach(function (n) { try { window[n] = NOOP; } catch (e) {} }); }

  // ── look: transparent page over the game, in-game palette, only the useful modules ──
  var VIDEO = 'assets/jots-bg.mp4', VIDEO_OPACITY = 0.42;
  var d = document.documentElement;
  d.classList.add('aut-embed-jots');
  var H = 'html.aut-embed-jots ';
  var HIDE = [
    // account / consent / theming
    '#gh-login-modal', '#consent-modal', '#data-policy-modal', '#theme-toggle', '#aut-palette-btn', '#aut-art-btn', '#hdr-gh-login', '#hdr-gh-user', '#gh-user-menu',
    // Ash Shard + the other GitHub-backed / shared modules
    '#as-trigger', '#as-overlay', '#as-toast', '#mist-trigger', '#mist-panel', '#mist-overlay', '#astar-trigger', '#astar-panel', '#astar-overlay', '#sysbrd-trigger', '#sysbrd-panel', '#aac-tab', '#aac-panel',
    '#ash-canvas-trigger', '#ash-canvas', '#ash-canvas-panel',
    // sidebar entries that are account, export, or full-app only
    '#scrim-toggle', '#live-feed-toggle', '#hdr-key-btn', '#view-toggle-btn', '.draft-drip-btn', '.world-studio-btn',
    'button[onclick^="openLiveMode"]', 'button[onclick^="openVoiceSettings"]', 'button[onclick^="exportData"]', 'button[onclick^="importData"]',
    'button[onclick*="autumn-privacy"]', 'button[onclick^="openIDE"]', 'button[onclick^="openNate"]', '.htm-btn[onclick^="forgeOpen"]'
  ];
  var css = document.createElement('style');
  css.id = 'jots-embed-css';
  css.textContent =
    'html.aut-embed-jots,html.aut-embed-jots body{background:transparent!important;background-image:none!important;color-scheme:normal!important}' +
    H + '{--cyan:' + PAL.accent + ';--bg:transparent;--bg2:transparent}' +
    H + '#backdrop-video{display:none!important}' +
    H + '#vid-scrim{background:linear-gradient(165deg,rgba(111,0,255,.10),rgba(0,255,115,.06))!important;backdrop-filter:none!important}' +
    H + '#jots-bg-video{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-3;pointer-events:none;opacity:' + VIDEO_OPACITY + '}' +
    HIDE.map(function (s) { return H + s; }).join(',') + '{display:none!important}' +
    H + '.ov-grid{opacity:.35}' +
    H + '#jots-dock{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:9000;display:flex;gap:6px;padding:6px 8px;border-radius:14px;background:rgba(20,6,40,.45);border:1px solid rgba(255,0,115,.35);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 0 18px rgba(111,0,255,.25)}' +
    H + '#jots-dock button{font-family:var(--font-d,monospace);font-size:10px;letter-spacing:1.5px;color:#fff;background:linear-gradient(165deg,rgba(111,0,255,.35),rgba(0,255,115,.18));border:1px solid rgba(0,255,115,.45);border-radius:9px;padding:7px 11px;cursor:pointer;white-space:nowrap}' +
    H + '#jots-dock button:hover,' + H + '#jots-dock button:focus-visible{border-color:#ff0073;box-shadow:0 0 10px rgba(255,0,115,.5);outline:none}' +
    H + '#jots-dock .tag{align-self:center;white-space:nowrap;font-family:var(--font-d,monospace);font-size:8px;letter-spacing:2px;color:#00ff73;opacity:.8;padding:0 4px}';
  (document.head || d).appendChild(css);

  function call(path) { return function () { try { var o = window, p = path.split('.'); for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; var f = o && o[p[p.length - 1]]; if (typeof f === 'function') f.call(o); } catch (e) {} }; }
  var DOCK = [
    ['⬡ ARC LAKE', 'arcLakeStudioToggle', 'Arc Lake studio'],
    ['🛸 MANTIS NAV', 'mantisNav.open', 'Mantis navigation'],
    ['📡 RADAR', 'mantisRadar.open', 'Mantis radar'],
    ['◈ CALC', 'fcToggle', 'Calculator'],
    ['⌁ ARC EDGE', 'arcStudioToggleFromHud', 'Arc Edge studio'],
    ['◎ EMO MAP', 'emmToggle', 'Emotion map']
  ];
  function mountDock() {
    if (document.getElementById('jots-dock') || !document.body) return;
    var dock = document.createElement('div'); dock.id = 'jots-dock'; dock.setAttribute('role', 'toolbar'); dock.setAttribute('aria-label', 'JOTS terminal tools');
    var tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = 'GUEST · JOTS'; dock.appendChild(tag);
    DOCK.forEach(function (t) {
      var path = t[1].split('.'), o = window; for (var i = 0; i < path.length && o; i++) o = o[path[i]];
      if (typeof o !== 'function') return;   // only tools this build actually has
      var b = document.createElement('button'); b.type = 'button'; b.textContent = t[0]; b.title = t[2]; b.onclick = call(t[1]); dock.appendChild(b);
    });
    document.body.appendChild(dock);
  }
  function boot() {
    stubSync();
    if (!document.getElementById('jots-bg-video')) {
      var v = document.createElement('video');
      v.id = 'jots-bg-video'; v.src = VIDEO; v.autoplay = true; v.loop = true; v.muted = true; v.defaultMuted = true;
      v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(v, document.body.firstChild);
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
    var bv = document.getElementById('backdrop-video'); if (bv) { try { bv.pause(); bv.removeAttribute('autoplay'); } catch (e) {} }
    try { window.parent.postMessage({ type: 'autumn:jots-ready' }, GAME); } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', function () { stubSync(); mountDock(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { try { window.parent.postMessage({ type: 'autumn:jots-close' }, GAME); } catch (er) {} }
  });
})();
