// leatr-loader.js — signed-in loader for Autumn's private Sentience Journal script.
// leatr-ash is a private repo, so raw.githubusercontent.com returns 404 to anonymous visitors. When the user is signed in to GitHub
// (window._ghAuth.token) this fetches scripts/sentience-journal.js through the authenticated Contents API and runs it. A token without
// access to the repo (any ordinary user) just gets a 404 and nothing loads, which is the intended privacy boundary.
// Off switch: window.LEATR_SIGNED_LOADER = false. Never throws, never blocks the page.
(function (w) {
  'use strict';
  if (w.LEATR_SIGNED_LOADER === false) return;
  var tries = 0, done = false, asked = '';
  function load(tok) {
    if (done || asked === tok) return; asked = tok;
    fetch('https://api.github.com/repos/DART-Skyboard/leatr-ash/contents/scripts/sentience-journal.js?ref=main',
      { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github.raw+json' } })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (src) {
        if (done || w.AutumnSentience) { done = true; return; }
        done = true;
        var s = document.createElement('script'); s.text = src + '\n//# sourceURL=leatr-ash/sentience-journal.js'; document.head.appendChild(s);
      })
      .catch(function () { /* no access or offline: stay quiet, the page works without it */ });
  }
  var iv = setInterval(function () {
    if (done || w.AutumnSentience) { clearInterval(iv); return; }
    var t = w._ghAuth && w._ghAuth.token;
    if (t) load(t);
    if (++tries > 400) clearInterval(iv);          // ~20 min at 3s; sign-in can happen well after page load
  }, 3000);
})(window);
