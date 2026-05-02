// ═══════════════════════════════════════════════════════════════════════════
//  HUD TOOLS MODULE — Autumn · DART-Skyboard
//  Replaces the stacked HUD buttons (CALC, ARC EDGE, ARCLAKE, EMO MAP, FORGE)
//  with a collapsible frosted-glass side-tab overlay, matching the MIST /
//  Ash-Shard overlay style. Injects its own CSS + HTML. No changes to any
//  existing function — all original onclick handlers are preserved exactly.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  var _open = false;

  // ── CSS ──────────────────────────────────────────────────────────────────
  var _css = [
    '#hud-tm-overlay{',
      'position:fixed;left:0;top:72px;z-index:9400;',
      'display:flex;flex-direction:row;align-items:flex-start;',
      'pointer-events:none;',
    '}',
    '#hud-tm-panel{',
      'background:rgba(255,255,255,.05);',
      'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
      'border:1px solid rgba(0,229,255,.18);border-left:none;',
      'border-radius:0 10px 10px 0;',
      'padding:10px 10px 12px 10px;',
      'display:flex;flex-direction:column;gap:5px;',
      'transform:translateX(-100%);opacity:0;',
      'transition:transform .22s cubic-bezier(.22,1,.36,1),opacity .18s;',
      'pointer-events:none;',
      'min-width:130px;',
    '}',
    '#hud-tm-overlay.htm-open #hud-tm-panel{',
      'transform:translateX(0);opacity:1;pointer-events:all;',
    '}',
    '#hud-tm-tab{',
      'background:rgba(255,255,255,.05);',
      'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
      'border:1px solid rgba(0,229,255,.18);border-left:none;',
      'border-radius:0 7px 7px 0;',
      'width:20px;min-height:60px;',
      'display:flex;align-items:center;justify-content:center;',
      'cursor:pointer;pointer-events:all;',
      'writing-mode:vertical-rl;',
      'font-family:var(--font-d,monospace);font-size:.26rem;letter-spacing:2px;',
      'color:rgba(0,229,255,.65);',
      'user-select:none;',
      'transition:color .2s,background .2s;',
      'margin-top:8px;',
    '}',
    '#hud-tm-tab:hover{color:#00e5ff;background:rgba(0,229,255,.1);}',
    '.htm-label{',
      'font-family:var(--font-d,monospace);font-size:.27rem;letter-spacing:1.8px;',
      'color:rgba(0,229,255,.38);',
      'padding:1px 2px 5px 2px;',
      'border-bottom:1px solid rgba(0,229,255,.1);margin-bottom:2px;',
    '}',
    '.htm-btn{',
      'font-family:var(--font-d,monospace);font-size:.37rem;letter-spacing:1.3px;',
      'padding:5px 9px;border-radius:4px;',
      'border:1px solid rgba(0,229,255,.2);background:rgba(0,229,255,.04);',
      'color:rgba(0,229,255,.72);',
      'cursor:pointer;user-select:none;text-align:left;',
      'transition:all .15s;white-space:nowrap;',
    '}',
    '.htm-btn:hover{background:rgba(0,229,255,.11);color:#00e5ff;',
      'border-color:rgba(0,229,255,.48);text-shadow:0 0 7px rgba(0,229,255,.45);}',
    '.htm-btn.htm-purple{border-color:rgba(139,92,246,.28);',
      'background:rgba(139,92,246,.05);color:rgba(139,92,246,.75);}',
    '.htm-btn.htm-purple:hover{background:rgba(139,92,246,.13);color:#a78bfa;',
      'border-color:rgba(139,92,246,.55);}',
    '.htm-btn.htm-violet{border-color:rgba(167,139,250,.25);',
      'background:rgba(167,139,250,.04);color:rgba(167,139,250,.7);}',
    '.htm-btn.htm-violet:hover{background:rgba(167,139,250,.13);color:#c4b5fd;',
      'border-color:rgba(167,139,250,.52);}',
  ].join('');

  // ── HTML ─────────────────────────────────────────────────────────────────
  function _buildHTML() {
    return [
      '<div id="hud-tm-overlay">',
        '<div id="hud-tm-panel">',
          '<div class="htm-label">TOOLS</div>',
          '<div class="htm-btn htm-purple" id="hud-calc-btn"',
            ' onclick="fcToggle();hudTMclose()"',
            ' title="Floating Calculator">&#9672; CALC</div>',
          '<div class="htm-btn" id="hud-arc-btn"',
            ' onclick="arcStudioToggleFromHud();hudTMclose()"',
            ' title="Arc Edge Studio">&#8859; ARC EDGE</div>',
          '<div class="htm-btn" id="hud-arclake-btn"',
            ' onclick="window.arcLakeStudioToggle&&window.arcLakeStudioToggle();hudTMclose()"',
            ' title="ArcLake Studio"',
            ' style="background:rgba(0,229,255,.07)">&#11041; ARCLAKE</div>',
          '<div class="htm-btn htm-violet" id="hud-emomap-btn"',
            ' onclick="emmToggle();hudTMclose()"',
            ' title="Emotion Mind Map">&#9678; EMO MAP</div>',
          '<div class="htm-btn" id="hud-forge-btn"',
            ' onclick="forgeOpen();hudTMclose()"',
            ' title="FORGE Code Studio">&#9881; FORGE</div>',
        '</div>',
        '<div id="hud-tm-tab" onclick="hudTMtoggle()">TOOLS</div>',
      '</div>',
    ].join('');
  }

  // ── Toggle / Close ───────────────────────────────────────────────────────
  window.hudTMtoggle = function () {
    _open = !_open;
    var ov = document.getElementById('hud-tm-overlay');
    if (ov) ov.classList.toggle('htm-open', _open);
    if (_open) {
      setTimeout(function () {
        document.addEventListener('click', _outside, true);
      }, 60);
    } else {
      document.removeEventListener('click', _outside, true);
    }
  };

  window.hudTMclose = function () {
    _open = false;
    var ov = document.getElementById('hud-tm-overlay');
    if (ov) ov.classList.remove('htm-open');
    document.removeEventListener('click', _outside, true);
  };

  function _outside(e) {
    var ov = document.getElementById('hud-tm-overlay');
    var tr = document.getElementById('hud-tools-trigger');
    if (ov && !ov.contains(e.target) && (!tr || !tr.contains(e.target))) {
      window.hudTMclose();
    }
  }

  // ── Init — runs after DOM ready ──────────────────────────────────────────
  function _init() {
    // Inject CSS
    var style = document.createElement('style');
    style.textContent = _css;
    document.head.appendChild(style);

    // Inject overlay HTML into body
    var wrap = document.createElement('div');
    wrap.innerHTML = _buildHTML();
    document.body.appendChild(wrap.firstChild);

    // Hide the original stacked HUD buttons, replace with single trigger
    var btns = ['hud-calc-btn','hud-arc-btn','hud-arclake-btn','hud-emomap-btn','hud-forge-btn'];
    btns.forEach(function(id) {
      // The originals in cognition-state — the module's copies are the real ones now
      // Find any duplicates inside cognition-state and hide them
      var cogState = document.getElementById('cognition-state');
      if (cogState) {
        var el = cogState.querySelector('#' + id);
        if (el) el.style.display = 'none';
      }
    });

    // Replace the TOOLS trigger button text/onclick to use new toggle
    var tr = document.getElementById('hud-tools-trigger');
    if (tr) {
      tr.onclick = function() { window.hudTMtoggle(); };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
