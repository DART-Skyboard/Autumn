/* jots-embed.js — in-game guest edition of Autumn for Journey of the Skyboard (the Bird Temple desk terminal).
 * Active ONLY when the URL has ?embed=jots (or the path is /jots/) AND the page is framed by https://dartmeadow.space
 * (location.ancestorOrigins where supported, otherwise document.referrer). Anything else runs the normal app.
 *  - guest only, no sync: LEATR sync / consent / session-node / heartbeat writes are disabled for this frame
 *    (consent is never granted on the visitor's behalf; the sync entry points become no-ops)
 *  - nothing persistent: localStorage is swapped for sessionStorage and cookie writes are dropped, in this frame only
 *  - a fixed in-game palette, theme controls hidden
 *  - transparent page: the background video is layered at reduced opacity over a transparent body,
 *    so the iframe composites over the game scene behind it.
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

  // ── no persistence: this frame's localStorage is sessionStorage; cookie writes are ignored ──
  try { Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return window.sessionStorage; } }); } catch (e) {}
  try {
    var cd = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (cd && cd.get) Object.defineProperty(document, 'cookie', { configurable: true, get: function () { return cd.get.call(document); }, set: function () {} });
  } catch (e) {}

  // ── guest only, no sync: block LEATR / profile writes from this frame ──
  var NOOP = function () { return Promise.resolve(null); };
  var SYNC = ['initLeatrAshSync', 'checkDataPolicyConsent', 'acceptDataPolicy', 'writeLeatrAshMemory', 'syncToolPattern', '_pollAshNodes', '_fetchAnalytics', '_ashFlushNow'];
  function stubSync() { SYNC.forEach(function (n) { try { window[n] = NOOP; } catch (e) {} }); }
  var blocked = /^https:\/\/(script\.google\.com|script\.googleusercontent\.com|api\.github\.com)\//;
  try {
    var of = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var m = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (blocked.test(url) && (m !== 'GET' || /[?&]action=(writenode|ashwrite)/.test(url))) return Promise.reject(new Error('jots embed: sync disabled'));
      return of.apply(this, arguments);
    };
    var xo = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      if (blocked.test(String(url)) && String(method).toUpperCase() !== 'GET') throw new Error('jots embed: sync disabled');
      return xo.apply(this, arguments);
    };
    if (navigator.sendBeacon) { var sb = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = function (u) { return blocked.test(String(u)) ? false : sb.apply(null, arguments); }; }
  } catch (e) {}

  // ── fixed in-game palette (session-scoped; framed only) ──
  var PAL = { id: 'jots-data-ariel', name: 'Data Ariel', bg1: '#6f00ff', bg2: '#00ff73', accent: '#ff0073' };
  var VIDEO = 'assets/jots-bg.mp4', VIDEO_OPACITY = 0.42;
  try {
    sessionStorage.setItem('aut_theme', 'void');
    sessionStorage.setItem('autumn_palettes_v1:guest', JSON.stringify([PAL]));
    sessionStorage.setItem('autumn_palette_v1:guest', JSON.stringify(PAL.id));
  } catch (e) {}
  var d = document.documentElement;
  d.classList.add('aut-embed-jots');
  var css = document.createElement('style');
  css.id = 'jots-embed-css';
  css.textContent =
    'html.aut-embed-jots,html.aut-embed-jots body{background:transparent!important;background-image:none!important;color-scheme:normal!important}' +
    'html.aut-embed-jots{--cyan:' + PAL.accent + ';--bg:transparent;--bg2:transparent}' +
    'html.aut-embed-jots #backdrop-video{display:none!important}' +
    'html.aut-embed-jots #vid-scrim{background:linear-gradient(165deg,rgba(111,0,255,.10),rgba(0,255,115,.06))!important;backdrop-filter:none!important}' +
    'html.aut-embed-jots #jots-bg-video{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-3;pointer-events:none;opacity:' + VIDEO_OPACITY + '}' +
    'html.aut-embed-jots #gh-login-modal,html.aut-embed-jots #consent-modal,html.aut-embed-jots #data-policy-modal{display:none!important}' +
    'html.aut-embed-jots #theme-toggle,html.aut-embed-jots #aut-palette-btn,html.aut-embed-jots #hdr-gh-login{display:none!important}' +
    'html.aut-embed-jots .ov-grid{opacity:.35}';
  (document.head || d).appendChild(css);
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
  // inline scripts redefine the sync functions as they parse: stub again once they have all run
  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', stubSync);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { try { window.parent.postMessage({ type: 'autumn:jots-close' }, GAME); } catch (er) {} }
  });
})();
