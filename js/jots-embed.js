/* jots-embed.js — in-game guest edition of Autumn for Journey of the Skyboard (dartmeadow.space Bird Temple terminal).
 * Active ONLY when the page is opened with ?embed=jots (or via /jots/). Normal leatr.xyz behaviour is untouched.
 *  - guest mode auto-approved (login modal skipped, guest consent accepted) so the session starts immediately
 *  - theme locked to Justin's account palette "Data Ariel" (theme/theme-prefs.json in his private profile)
 *  - transparent page: the background video is layered at reduced opacity over a transparent body,
 *    so the iframe composites over the game scene behind it.
 */
(function () {
  'use strict';
  var on = false;
  try { on = /(?:^|[?&])embed=jots(?:&|$)/.test(location.search) || /^\/jots\/?$/.test(location.pathname); } catch (e) {}
  if (!on) return;
  window.AUT_EMBED = 'jots';
  var PAL = { id: 'jots-data-ariel', name: 'Data Ariel', bg1: '#6f00ff', bg2: '#00ff73', accent: '#ff0073' };
  var VIDEO = 'assets/jots-bg.mp4', VIDEO_OPACITY = 0.42;
  var d = document.documentElement;
  d.classList.add('aut-embed-jots');
  try {
    localStorage.setItem('_gh_login_skipped', '1');
    localStorage.setItem('autumn_consent', 'true');
    localStorage.setItem('_aut_data_consent', 'true');
    localStorage.setItem('aut_theme', 'void');
    localStorage.setItem('autumn_palettes_v1:guest', JSON.stringify([PAL]));
    localStorage.setItem('autumn_palette_v1:guest', JSON.stringify(PAL.id));
  } catch (e) {}
  var css = document.createElement('style');
  css.id = 'jots-embed-css';
  css.textContent =
    'html.aut-embed-jots,html.aut-embed-jots body{background:transparent!important;background-image:none!important;color-scheme:normal!important}' +
    'html.aut-embed-jots{--cyan:' + PAL.accent + ';--bg:transparent;--bg2:transparent}' +
    'html.aut-embed-jots #backdrop-video{display:none!important}' +
    'html.aut-embed-jots #vid-scrim{background:linear-gradient(165deg,rgba(111,0,255,.10),rgba(0,255,115,.06))!important;backdrop-filter:none!important}' +
    'html.aut-embed-jots #jots-bg-video{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-3;pointer-events:none;opacity:' + VIDEO_OPACITY + '}' +
    'html.aut-embed-jots #gh-login-modal,html.aut-embed-jots #consent-modal,html.aut-embed-jots #data-policy-modal{display:none!important}' +
    'html.aut-embed-jots #theme-toggle,html.aut-embed-jots #aut-palette-btn{display:none!important}' +
    'html.aut-embed-jots .ov-grid{opacity:.35}';
  (document.head || d).appendChild(css);
  function boot() {
    if (!document.getElementById('jots-bg-video')) {
      var v = document.createElement('video');
      v.id = 'jots-bg-video'; v.src = VIDEO; v.autoplay = true; v.loop = true; v.muted = true; v.defaultMuted = true;
      v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(v, document.body.firstChild);
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
    var bv = document.getElementById('backdrop-video'); if (bv) { try { bv.pause(); bv.removeAttribute('autoplay'); } catch (e) {} }
    try { if (typeof window._ghSkipLogin === 'function' && !(window._ghAuth && window._ghAuth.loggedIn)) window._ghSkipLogin(); } catch (e) {}
    try { if (typeof window.checkDataPolicyConsent === 'function') window.checkDataPolicyConsent(); else if (typeof window.initLeatrAshSync === 'function') window.initLeatrAshSync(); } catch (e) {}
    try { window.parent && window.parent !== window && window.parent.postMessage({ type: 'autumn:jots-ready' }, '*'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  // let the game close the overlay with Esc while focus is inside the iframe
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { try { window.parent.postMessage({ type: 'autumn:jots-close' }, '*'); } catch (er) {} }
  });
})();
