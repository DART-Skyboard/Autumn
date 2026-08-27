// ═══════════════════════════════════════════════════════════════════════════
//  HUD TOOLS MODULE — Autumn · DART-Skyboard
//  Frosted glass side-tab overlay for tool launchers.
//  Whole wrapper slides left/right — tab always peeks out from edge.
//  Original HUD buttons hidden; all onclick functions unchanged.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var _open = false;
  var TAB_W = 20; // px tab width that always peeks out

  var _css = [
    '#hud-tm-wrap{',
      'position:fixed;left:0;top:80px;z-index:9400;',
      'display:flex;flex-direction:row;align-items:flex-start;',
      'transition:transform .24s cubic-bezier(.22,1,.36,1);',
      'transform:translateX(calc(-100% + 20px));',
      'pointer-events:none;',
    '}',
    '#hud-tm-wrap.htm-open{transform:translateX(0);}',
    '#hud-tm-panel{',
      'background:rgba(255,255,255,.05);',
      'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
      'border:1px solid rgba(0,229,255,.18);border-left:none;',
      'border-radius:0 10px 10px 0;',
      'padding:10px 10px 14px 10px;',
      'display:flex;flex-direction:column;gap:6px;',
      'pointer-events:all;min-width:128px;',
    '}',
    '#hud-tm-tab{',
      'background:rgba(255,255,255,.05);',
      'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
      'border:1px solid rgba(0,229,255,.18);border-left:none;',
      'border-radius:0 7px 7px 0;',
      'width:20px;min-height:58px;',
      'display:flex;align-items:center;justify-content:center;',
      'cursor:pointer;pointer-events:all;flex-shrink:0;',
      'writing-mode:vertical-rl;',
      'font-family:var(--font-d,monospace);font-size:.25rem;letter-spacing:2px;',
      'color:rgba(0,229,255,.65);user-select:none;',
      'transition:color .2s,background .2s;margin-top:6px;',
    '}',
    '#hud-tm-tab:hover{color:#00e5ff;background:rgba(0,229,255,.1);}',
    '.htm-label{font-family:var(--font-d,monospace);font-size:.26rem;',
      'letter-spacing:1.8px;color:rgba(0,229,255,.38);',
      'padding:1px 2px 5px 2px;border-bottom:1px solid rgba(0,229,255,.1);margin-bottom:2px;}',
    '.htm-btn{font-family:var(--font-d,monospace);font-size:.37rem;',
      'letter-spacing:1.2px;padding:5px 9px;border-radius:4px;',
      'border:1px solid rgba(0,229,255,.2);background:rgba(0,229,255,.04);',
      'color:rgba(0,229,255,.72);cursor:pointer;user-select:none;',
      'text-align:left;transition:all .15s;white-space:nowrap;}',
    '.htm-btn:hover{background:rgba(0,229,255,.11);color:#00e5ff;',
      'border-color:rgba(0,229,255,.48);text-shadow:0 0 7px rgba(0,229,255,.4);}',
    '.htm-purple{border-color:rgba(139,92,246,.28)!important;background:rgba(139,92,246,.05)!important;color:rgba(139,92,246,.75)!important;}',
    '.htm-purple:hover{background:rgba(139,92,246,.13)!important;color:#a78bfa!important;}',
    '.htm-violet{border-color:rgba(167,139,250,.25)!important;background:rgba(167,139,250,.04)!important;color:rgba(167,139,250,.7)!important;}',
    '.htm-violet:hover{background:rgba(167,139,250,.13)!important;color:#c4b5fd!important;}',
  ].join('');

  function _html() {
    return '<div id="hud-tm-wrap">' +
      '<div id="hud-tm-panel">' +
        '<div class="htm-label">TOOLS</div>' +
        '<div class="htm-btn htm-purple" onclick="fcToggle();hudTMclose()" title="Calculator">&#9672; CALC</div>' +
        '<div class="htm-btn" onclick="arcStudioToggleFromHud();hudTMclose()" title="Arc Edge Studio">&#8961; ARC EDGE</div>' +
        '<div class="htm-btn" onclick="window.arcLakeStudioToggle&&window.arcLakeStudioToggle();hudTMclose()" title="ArcLake Studio" style="background:rgba(0,229,255,.07)">&#11041; ARCLAKE</div>' +
        '<div class="htm-btn htm-violet" onclick="emmToggle();hudTMclose()" title="Emotion Mind Map">&#9678; EMO MAP</div>' +
        '<div class="htm-btn" onclick="forgeOpen();hudTMclose()" title="FORGE">&#9881; FORGE</div>' +
      '</div>' +
      '<div id="hud-tm-tab" onclick="hudTMtoggle()">TOOLS</div>' +
    '</div>';
  }

  window.hudTMtoggle = function () {
    _open = !_open;
    var w = document.getElementById('hud-tm-wrap');
    if (w) w.classList.toggle('htm-open', _open);
    if (_open) {
      setTimeout(function () { document.addEventListener('click', _outside, true); }, 60);
    } else {
      document.removeEventListener('click', _outside, true);
    }
  };

  window.hudTMclose = function () {
    _open = false;
    var w = document.getElementById('hud-tm-wrap');
    if (w) w.classList.remove('htm-open');
    document.removeEventListener('click', _outside, true);
  };

  function _outside(e) {
    var w = document.getElementById('hud-tm-wrap');
    if (w && !w.contains(e.target)) { window.hudTMclose(); }
  }

  function _init() {
    var s = document.createElement('style');
    s.textContent = _css;
    document.head.appendChild(s);

    var tmp = document.createElement('div');
    tmp.innerHTML = _html();
    document.body.appendChild(tmp.firstChild);

    // Hide all original HUD buttons — they keep their IDs so JS refs still work
    var cog = document.getElementById('cognition-state');
    if (cog) {
      ['hud-calc-btn','hud-arc-btn','hud-arclake-btn',
       'hud-emomap-btn','hud-forge-btn','hud-tools-trigger'
      ].forEach(function(id) {
        var el = cog.querySelector('#' + id);
        if (el) { el.style.display = 'none'; el.style.pointerEvents = 'none'; }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
