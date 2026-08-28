/* Autumn desktop / landscape layout controller
   Toggles html+body.layout-desktop vs .layout-mobile from:
     - viewport width / orientation (live, no reload)
     - existing view-mode toggle (toggleViewMode, localStorage autumn_viewmode)
*/
(function () {
  'use strict';

  var DESKTOP_MIN = 900;
  var LANDSCAPE_MIN = 640;
  var FORCE_KEY = 'autumn_layout_force_mobile';
  var MODE_KEY = 'autumn_viewmode';
  var _forceMobile = false;
  var _lastDesk = null;
  var _hooked = false;

  try { _forceMobile = sessionStorage.getItem(FORCE_KEY) === '1'; } catch (e) {}

  function getViewMode() {
    try {
      var v = localStorage.getItem(MODE_KEY);
      if (v === 'desktop' || v === 'mobile') return v;
    } catch (e) {}
    return 'mobile';
  }

  function matchesBreakpoint() {
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    var landscape = false;
    try {
      landscape = window.matchMedia('(orientation: landscape)').matches;
    } catch (e) {}
    if (!landscape && typeof window.innerHeight === 'number') {
      landscape = w > window.innerHeight;
    }
    return w >= DESKTOP_MIN || (landscape && w >= LANDSCAPE_MIN);
  }

  function setForceMobile(on) {
    _forceMobile = !!on;
    try {
      if (on) sessionStorage.setItem(FORCE_KEY, '1');
      else sessionStorage.removeItem(FORCE_KEY);
    } catch (e) {}
  }

  function shouldUseDesktop() {
    var mode = getViewMode();
    // Explicit desktop view-mode (phone "desktop" toggle / viewport width=1280)
    if (mode === 'desktop') return true;
    // User forced stacked layout while the viewport was still wide
    if (_forceMobile && matchesBreakpoint()) return false;
    // Viewport shrank to a real mobile size — drop the force so landscape can auto-switch again
    if (_forceMobile && !matchesBreakpoint()) setForceMobile(false);
    return matchesBreakpoint();
  }

  function pingResize() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
      });
    });
  }

  function apply(forcePing) {
    var desk = shouldUseDesktop();
    var root = document.documentElement;
    var body = document.body;
    if (_lastDesk === desk && !forcePing) {
      if (root.classList.contains(desk ? 'layout-desktop' : 'layout-mobile')) {
        if (!body || body.classList.contains(desk ? 'layout-desktop' : 'layout-mobile')) return;
      }
    }
    _lastDesk = desk;
    root.classList.toggle('layout-desktop', desk);
    root.classList.toggle('layout-mobile', !desk);
    if (body) {
      body.classList.toggle('layout-desktop', desk);
      body.classList.toggle('layout-mobile', !desk);
    }
    pingResize();
  }

  function afterToggle() {
    var mode = getViewMode();
    if (mode === 'desktop') setForceMobile(false);
    else if (matchesBreakpoint()) setForceMobile(true);
    else setForceMobile(false);
    apply(true);
  }

  function hookToggleViewMode() {
    if (_hooked) return true;
    if (typeof window.toggleViewMode !== 'function') return false;
    if (window.toggleViewMode.__autumnDeskHook) {
      _hooked = true;
      return true;
    }
    var orig = window.toggleViewMode;
    window.toggleViewMode = function () {
      var ret = orig.apply(this, arguments);
      afterToggle();
      return ret;
    };
    window.toggleViewMode.__autumnDeskHook = true;
    _hooked = true;
    return true;
  }

  function onClick(ev) {
    var t = ev.target;
    if (!t) return;
    var btn = t.id === 'view-toggle-btn' ? t : (t.closest ? t.closest('#view-toggle-btn') : null);
    if (!btn) return;
    setTimeout(afterToggle, 0);
  }

  apply();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      hookToggleViewMode();
      apply();
    });
  } else {
    hookToggleViewMode();
    apply();
  }

  window.addEventListener('load', function () {
    hookToggleViewMode();
    apply();
  });

  var tries = 0;
  var hookTimer = setInterval(function () {
    tries += 1;
    if (hookToggleViewMode() || tries > 40) clearInterval(hookTimer);
  }, 250);

  window.addEventListener('resize', function () { apply(); });
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { apply(true); }, 80);
  });

  try {
    var mqWide = window.matchMedia('(min-width: 900px)');
    var mqLand = window.matchMedia('(orientation: landscape)');
    var onMq = function () { apply(); };
    if (mqWide.addEventListener) mqWide.addEventListener('change', onMq);
    else if (mqWide.addListener) mqWide.addListener(onMq);
    if (mqLand.addEventListener) mqLand.addEventListener('change', onMq);
    else if (mqLand.addListener) mqLand.addListener(onMq);
  } catch (e) {}

  try {
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () { apply(); });
    }
  } catch (e) {}

  document.addEventListener('click', onClick, false);

  window.addEventListener('storage', function (ev) {
    if (ev && ev.key === MODE_KEY) apply(true);
  });

  window.applyAutumnDesktopLayout = apply;
})();
