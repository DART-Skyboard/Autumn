// autumn-theme-art.js — ART + PALETTE theming, ported from Autumn iOS (ThemeSystem.swift / PaletteEditorOverlay.swift, build 163).
// ART: one user-supplied background (image: jpg/png/webp/gif/avif/bmp/svg/heic* — video: mp4/mov/webm/m4v*) shown behind the UI in
//      place of the bundled theme video. Remembered per user (IndexedDB, keyed by GitHub username or "guest").
//      The existing overlay engine (FROST/STEAM/CLEAR/HAZE/DUSK/DEEP/VOID) still sits on top; VOID hides the art (iOS showsArt).
//      (* heic / mov only where the browser can decode them — the file is test-loaded before it replaces the current art.)
// PALETTE: built-in presets (cycles the existing theme engine) + saved custom palettes {name,bg1,bg2,accent} with a frosted editor.
//      A custom palette drives --cyan (accent), --bg/--bg2 and the scrim wash tint (bg1 × 0.6, same as iOS AutumnPaletteRuntime.washRGB).
// Additive only. Off switch: window.AUTUMN_THEME_ART = false before this script loads.
(function (global) {
  'use strict';
  if (typeof document === 'undefined' || global.AUTUMN_THEME_ART === false) return;

  var PRESETS = ['VOID', 'DAY', 'NIGHT', 'STEALTH', 'DEPARTURE', 'ASH TREE', 'ARIEL', 'SKYBOARD', 'LOUNGE', 'SUMMIT', 'AUTO'];
  var LEVEL_ALPHA = { FROST: 0.20, STEAM: 0.55, HAZE: 0.50, DUSK: 0.70, DEEP: 0.85 };
  var IMG_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|svg|heic|heif|tga)$/i, VID_EXT = /\.(mp4|m4v|mov|webm|ogv)$/i;
  var MAX_BYTES = 250 * 1024 * 1024;
  var artURL = null, artMeta = null, lastUser = null;

  function user() { var a = global._ghAuth || {}; return (a.loggedIn !== false && a.username) ? String(a.username).toLowerCase() : 'guest'; }
  function lsKey(k) { return 'autumn_' + k + '_v1:' + user(); }
  function lsGet(k, d) { try { var v = localStorage.getItem(lsKey(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(lsKey(k)); else localStorage.setItem(lsKey(k), JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hexRGB(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ── IndexedDB (art blobs are too large for localStorage) ───────────────────
  function db() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('autumn_theme_art', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('art'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function idb(mode, fn) { return db().then(function (d) { return new Promise(function (res, rej) { var tx = d.transaction('art', mode), st = tx.objectStore('art'); var q = fn(st); tx.oncomplete = function () { res(q && q.result); }; tx.onerror = function () { rej(tx.error); }; }); }); }

  // ── ART ────────────────────────────────────────────────────────────────────
  function scrimLabel() { var l = document.getElementById('st-label'); return l ? l.textContent.trim().toUpperCase() : ''; }
  function kindOf(file) {
    var t = file.type || '';
    if (/^video\//.test(t) || VID_EXT.test(file.name)) return 'video';
    if (/^image\//.test(t) || IMG_EXT.test(file.name)) return 'image';
    return null;
  }
  function testDecode(kind, url) {
    return new Promise(function (res) {
      var done = function (ok) { clearTimeout(to); res(ok); }, to = setTimeout(function () { res(false); }, 15000);
      if (kind === 'image') { var i = new Image(); i.onload = function () { done(i.naturalWidth > 0); }; i.onerror = function () { done(false); }; i.src = url; }
      else { var v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.onloadeddata = function () { done(v.videoWidth > 0 || v.duration > 0); }; v.onerror = function () { done(false); }; v.src = url; }
    });
  }
  function artLayer() {
    var el = document.getElementById('aut-art-layer');
    if (!el) {
      el = document.createElement('div'); el.id = 'aut-art-layer';
      el.style.cssText = 'position:fixed;inset:0;z-index:-2;pointer-events:none;transition:opacity .45s ease';
      var bv = document.getElementById('backdrop-video');
      if (bv && bv.parentNode) bv.parentNode.insertBefore(el, bv.nextSibling); else document.body.insertBefore(el, document.body.firstChild);
    }
    return el;
  }
  function renderArt() {
    var layer = artLayer();
    var show = !!(artURL && artMeta) && scrimLabel() !== 'VOID';
    document.body.classList.toggle('aut-has-art', !!(artURL && artMeta));
    if (!artURL || !artMeta) { document.documentElement.classList.remove('aut-art-visible'); layer.innerHTML = ''; layer.style.opacity = '0'; return; }
    var cur = layer.firstChild;
    if (!cur || cur.getAttribute('data-src') !== artURL) {
      layer.innerHTML = '';
      cur = document.createElement(artMeta.kind === 'video' ? 'video' : 'img');
      cur.setAttribute('data-src', artURL); cur.id = artMeta.kind === 'video' ? 'aut-art-video' : 'aut-art-image';
      cur.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
      if (artMeta.kind === 'video') { cur.muted = true; cur.loop = true; cur.autoplay = true; cur.playsInline = true; cur.setAttribute('playsinline', ''); }
      cur.src = artURL; layer.appendChild(cur);
    }
    layer.style.opacity = show ? '1' : '0'; layer.style.visibility = show ? 'visible' : 'hidden';
    document.documentElement.classList.toggle('aut-art-visible', show);
    if (artMeta.kind === 'video') { try { show ? cur.play().catch(function () {}) : cur.pause(); } catch (e) {} }
  }
  function loadArt() {
    return idb('readonly', function (st) { return st.get(user()); }).then(function (rec) {
      if (artURL) { try { URL.revokeObjectURL(artURL); } catch (e) {} }
      artURL = null; artMeta = null;
      if (rec && rec.blob) { artURL = URL.createObjectURL(rec.blob); artMeta = { kind: rec.kind, name: rec.name }; }
      lsSet('art', artMeta); renderArt();
    }).catch(function () { renderArt(); });
  }
  function importArt(file) {
    if (!file) return Promise.resolve('No file chosen.');
    var kind = kindOf(file);
    if (!kind) return Promise.resolve('Unsupported file type — choose an image (JPG/PNG/WebP/GIF/HEIC) or a video (MP4/MOV/WebM).');
    if (file.size > MAX_BYTES) return Promise.resolve('File is too large (max 250 MB).');
    var probe = URL.createObjectURL(file);
    return testDecode(kind, probe).then(function (ok) {
      URL.revokeObjectURL(probe);
      if (!ok) return 'This browser cannot play/decode that file' + (/\.(heic|heif|mov)$/i.test(file.name) ? ' (HEIC/MOV support varies — try JPG/PNG or MP4/WebM).' : '.') + ' Current art kept.';
      return idb('readwrite', function (st) { return st.put({ kind: kind, name: file.name, type: file.type, blob: file, ts: Date.now() }, user()); })
        .then(loadArt).then(function () { return 'ART set: ' + file.name; });
    }).catch(function (e) { return 'Could not save art: ' + (e && e.message || e); });
  }
  function clearArt() { return idb('readwrite', function (st) { return st.delete(user()); }).then(loadArt).catch(loadArt); }

  // ── PALETTE ────────────────────────────────────────────────────────────────
  function palettes() { return lsGet('palettes', []); }
  function activePalette() { var id = lsGet('palette', null); return id ? palettes().filter(function (p) { return p.id === id; })[0] || null : null; }
  var VARS = ['--cyan', '--bg', '--bg2', '--border', '--tt-color'];
  function applyPaletteVars(p) {
    var r = document.documentElement.style, b = document.body.style;
    if (!p) { VARS.forEach(function (v) { r.removeProperty(v); b.removeProperty(v); }); document.body.classList.remove('aut-palette-custom'); b.removeProperty('background'); restyleScrim(); return; }
    var a = hexRGB(p.accent);
    // body.theme-* classes redefine the vars on <body>, so set them there too (inline beats class).
    [r, b].forEach(function (s) { s.setProperty('--cyan', p.accent); s.setProperty('--bg', p.bg1); s.setProperty('--bg2', p.bg2); s.setProperty('--border', 'rgba(' + a.join(',') + ',0.14)'); s.setProperty('--tt-color', p.accent); });
    b.setProperty('background', 'linear-gradient(165deg,' + p.bg1 + ' 0%,' + p.bg2 + ' 100%)');
    document.body.classList.add('aut-palette-custom');
    var lbl = document.getElementById('tt-label'), dot = document.getElementById('tt-dot');
    if (lbl) { lbl.textContent = 'CUSTOM'; lbl.style.color = p.accent; } if (dot) dot.textContent = '◐';
    restyleScrim();
  }
  // Scrim wash follows the palette's bg1 × 0.6 (iOS AutumnPaletteRuntime.washRGB); VOID uses the palette gradient.
  function restyleScrim() {
    var p = activePalette(), scrim = document.getElementById('vid-scrim'); if (!scrim || !p) return;
    var L = scrimLabel(), c = hexRGB(p.bg1).map(function (x) { return Math.round(x * 0.6); });
    if (L === 'VOID') scrim.style.background = 'linear-gradient(165deg,' + p.bg1 + ' 0%,' + p.bg2 + ' 100%)';
    else if (LEVEL_ALPHA[L] != null) scrim.style.background = 'rgba(' + c.join(',') + ',' + LEVEL_ALPHA[L] + ')';
  }
  function applyCustom(p) { lsSet('palette', p ? p.id : null); applyPaletteVars(p); }
  function applyPreset(label) {
    lsSet('palette', null); applyPaletteVars(null);
    if (typeof global.cycleTheme !== 'function') return;
    for (var i = 0; i < PRESETS.length + 1; i++) {
      var l = document.getElementById('tt-label'); if (l && l.textContent.trim().toUpperCase() === label) break;
      global.cycleTheme();
    }
  }
  function saveCustom(name, bg1, bg2, accent, id) {
    var list = palettes(), rec = { id: id || uid(), name: (name || 'CUSTOM').slice(0, 24), bg1: bg1, bg2: bg2, accent: accent };
    var i = list.findIndex(function (p) { return p.id === rec.id; }); if (i >= 0) list[i] = rec; else list.push(rec);
    lsSet('palettes', list); return rec;
  }
  function deleteCustom(id) {
    lsSet('palettes', palettes().filter(function (p) { return p.id !== id; }));
    if (lsGet('palette', null) === id) applyCustom(null);
  }

  // ── UI (frosted overlays; reuse page CSS vars) ─────────────────────────────
  function css() {
    if (document.getElementById('aut-ta-css')) return;
    var s = document.createElement('style'); s.id = 'aut-ta-css';
    s.textContent = [
      'body.aut-has-art #backdrop-video{opacity:0!important;visibility:hidden!important}',
      // Art replaces the theme video, so page/theme backgrounds must not paint over it (VOID overlay brings the solid look back).
      'html.aut-art-visible,html.aut-art-visible body{background:transparent!important;background-color:transparent!important}',
      '.aut-ta-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:20px;height:30px;padding:0 10px 0 6px;cursor:pointer;flex-shrink:0;font-family:var(--font-d);font-size:.42rem;letter-spacing:1px;color:var(--cyan,#00ffcc);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);white-space:nowrap}',
      '.aut-ta-pill .d{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);font-size:10px}',
      '#aut-ta-ov{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35)}',
      '#aut-ta-ov.open{display:flex}',
      '#aut-ta-box{width:min(380px,92vw);max-height:80vh;overflow:auto;background:rgba(10,18,30,.72);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);border:1px solid color-mix(in srgb,var(--cyan,#00e5ff) 30%,transparent);border-radius:12px;padding:12px;color:var(--text,#c8e6f0);font-family:var(--font-d,monospace);font-size:10px;letter-spacing:1px}',
      '#aut-ta-box h4{margin:0 0 8px;font-size:11px;letter-spacing:2px;color:var(--cyan,#00e5ff);display:flex;justify-content:space-between}',
      '#aut-ta-box .sec{font-size:8px;letter-spacing:2px;opacity:.55;margin:10px 0 4px}',
      '#aut-ta-box button{font-family:inherit;font-size:9px;letter-spacing:1px;padding:5px 8px;border-radius:4px;border:1px solid color-mix(in srgb,var(--cyan,#00e5ff) 35%,transparent);background:color-mix(in srgb,var(--cyan,#00e5ff) 8%,transparent);color:var(--cyan,#00e5ff);cursor:pointer;margin:2px}',
      '#aut-ta-box button.on{background:color-mix(in srgb,var(--cyan,#00e5ff) 25%,transparent)}',
      '#aut-ta-box button.danger{border-color:rgba(255,68,102,.5);color:#ff4466;background:transparent}',
      '#aut-ta-box input[type=text]{width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);color:#fff;border-radius:4px;padding:5px;font:inherit}',
      '#aut-ta-box .sw{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:middle;margin-right:4px;border:1px solid rgba(255,255,255,.2)}',
      '#aut-ta-box .row{display:flex;align-items:center;gap:6px;margin:3px 0}',
      '#aut-ta-msg{margin-top:8px;opacity:.75;min-height:12px;white-space:pre-wrap}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function overlay() {
    var ov = document.getElementById('aut-ta-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'aut-ta-ov';
      ov.innerHTML = '<div id="aut-ta-box"></div>';
      ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('open'); });
      document.body.appendChild(ov);
    }
    return ov;
  }
  function close() { overlay().classList.remove('open'); }
  function openArt() {
    var ov = overlay(), box = ov.querySelector('#aut-ta-box');
    box.innerHTML = '<h4><span>▣ ART</span><button data-x>✕</button></h4>' +
      '<div>One background behind the whole app — an image (JPG, PNG, WebP, GIF, HEIC*) or a video (MP4, MOV*, WebM). Remembered for <b>' + esc(user()) + '</b> on this browser. The overlay button (FROST…DEEP) still tints it; VOID hides it.</div>' +
      '<div class="sec">CURRENT</div><div id="aut-ta-cur">' + (artMeta ? esc(artMeta.kind.toUpperCase() + ' · ' + artMeta.name) : 'None — theme video') + '</div>' +
      '<div class="sec">CHOOSE</div><input type="file" id="aut-ta-file" accept="image/*,video/*,.heic,.heif,.mov,.m4v,.webm,.mp4" style="display:none">' +
      '<button id="aut-ta-pick">⇪ CHOOSE IMAGE / VIDEO</button>' + (artMeta ? '<button class="danger" id="aut-ta-clear">✕ CLEAR ART</button>' : '') +
      '<div style="opacity:.45;margin-top:6px">* where this browser can decode it</div><div id="aut-ta-msg"></div>';
    box.querySelector('[data-x]').onclick = close;
    var f = box.querySelector('#aut-ta-file'), msg = box.querySelector('#aut-ta-msg');
    box.querySelector('#aut-ta-pick').onclick = function () { f.click(); };
    f.onchange = function () { msg.textContent = 'Checking…'; importArt(f.files[0]).then(function (m) { openArt(); overlay().querySelector('#aut-ta-msg').textContent = m; }); };
    var c = box.querySelector('#aut-ta-clear'); if (c) c.onclick = function () { clearArt().then(openArt); };
    ov.classList.add('open');
  }
  function openPalette(edit) {
    var ov = overlay(), box = ov.querySelector('#aut-ta-box'), act = activePalette();
    var curLbl = (document.getElementById('tt-label') || {}).textContent || '';
    var d = edit || act || { name: 'CUSTOM', bg1: '#05070d', bg2: '#14203a', accent: '#7ecfff' };
    var h = '<h4><span>◐ PALETTE</span><button data-x>✕</button></h4><div class="sec">PRESETS</div><div>';
    PRESETS.forEach(function (p) { h += '<button data-preset="' + p + '" class="' + (!act && curLbl.trim().toUpperCase() === p ? 'on' : '') + '">' + p + '</button>'; });
    h += '</div><div class="sec">SAVED</div>';
    var list = palettes();
    if (!list.length) h += '<div style="opacity:.5">No saved palettes yet.</div>';
    list.forEach(function (p) {
      h += '<div class="row"><span class="sw" style="background:linear-gradient(135deg,' + esc(p.bg1) + ',' + esc(p.bg2) + ')"></span><span class="sw" style="background:' + esc(p.accent) + '"></span>' +
        '<span style="flex:1">' + esc(p.name) + '</span><button data-apply="' + p.id + '" class="' + (act && act.id === p.id ? 'on' : '') + '">USE</button><button data-edit="' + p.id + '">EDIT</button><button class="danger" data-del="' + p.id + '">✕</button></div>';
    });
    h += '<div class="sec">' + (d.id ? 'EDIT' : 'NEW') + '</div><input type="text" id="aut-pe-name" value="' + esc(d.name) + '" placeholder="name">' +
      '<div class="row">BG 1 <input type="color" id="aut-pe-bg1" value="' + esc(d.bg1) + '"> BG 2 <input type="color" id="aut-pe-bg2" value="' + esc(d.bg2) + '"> ACCENT <input type="color" id="aut-pe-acc" value="' + esc(d.accent) + '"></div>' +
      '<button id="aut-pe-prev">PREVIEW</button><button id="aut-pe-save">SAVE + USE</button>' + (d.id ? '<button id="aut-pe-new">NEW</button>' : '') + '<div id="aut-ta-msg"></div>';
    box.innerHTML = h;
    box.querySelector('[data-x]').onclick = close;
    box.querySelectorAll('[data-preset]').forEach(function (b) { b.onclick = function () { applyPreset(b.getAttribute('data-preset')); openPalette(); }; });
    box.querySelectorAll('[data-apply]').forEach(function (b) { b.onclick = function () { applyCustom(palettes().filter(function (p) { return p.id === b.getAttribute('data-apply'); })[0]); openPalette(); }; });
    box.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { openPalette(palettes().filter(function (p) { return p.id === b.getAttribute('data-edit'); })[0]); }; });
    box.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { deleteCustom(b.getAttribute('data-del')); openPalette(); }; });
    var val = function (id) { return box.querySelector(id).value; };
    box.querySelector('#aut-pe-prev').onclick = function () { applyPaletteVars({ bg1: val('#aut-pe-bg1'), bg2: val('#aut-pe-bg2'), accent: val('#aut-pe-acc') }); box.querySelector('#aut-ta-msg').textContent = 'Previewing — SAVE to keep it.'; };
    box.querySelector('#aut-pe-save').onclick = function () { var p = saveCustom(val('#aut-pe-name'), val('#aut-pe-bg1'), val('#aut-pe-bg2'), val('#aut-pe-acc'), d.id); applyCustom(p); openPalette(p); };
    var n = box.querySelector('#aut-pe-new'); if (n) n.onclick = function () { openPalette({ name: 'CUSTOM', bg1: d.bg1, bg2: d.bg2, accent: d.accent }); };
    ov.classList.add('open');
  }
  function mountButtons() {
    if (document.getElementById('aut-art-btn')) return;
    var tt = document.getElementById('theme-toggle'); if (!tt || !tt.parentNode) return;
    var mk = function (id, dot, label, fn, title) { var b = document.createElement('button'); b.id = id; b.className = 'aut-ta-pill hdr-btn'; b.title = title; b.innerHTML = '<span class="d">' + dot + '</span><span>' + label + '</span>'; b.onclick = function (e) { e.stopPropagation(); fn(); }; return b; };
    var pal = mk('aut-palette-btn', '◐', 'PALETTE', function () { openPalette(); }, 'Theme presets and custom palettes');
    var art = mk('aut-art-btn', '▣', 'ART', openArt, 'Use your own image or video as the background');
    tt.parentNode.insertBefore(pal, tt.nextSibling); tt.parentNode.insertBefore(art, tt.nextSibling);
  }

  // Re-apply after the existing theme / overlay engines run.
  function wrap(name, after) {
    var orig = global[name]; if (typeof orig !== 'function' || orig._autTA) return;
    var w = function () { var r = orig.apply(this, arguments); try { after(); } catch (e) {} return r; }; w._autTA = true; global[name] = w;
  }
  function reapply() { var p = activePalette(); if (p) applyPaletteVars(p); renderArt(); }
  function init() {
    css(); mountButtons(); artLayer();
    wrap('cycleScrim', function () { renderArt(); restyleScrim(); });
    // Picking a built-in theme from the toggle leaves custom-palette mode (same as iOS cyclePalette landing on a preset).
    wrap('cycleTheme', function () { if (activePalette()) { lsSet('palette', null); applyPaletteVars(null); } renderArt(); });
    lastUser = user(); loadArt(); reapply();
    // The page restores its saved theme after load (and again after session restore); re-assert the custom palette after it.
    [800, 2500, 6000].forEach(function (ms) { setTimeout(reapply, ms); });
    setInterval(function () { if (user() !== lastUser) { lastUser = user(); applyPaletteVars(null); loadArt(); reapply(); } }, 3000);
  }
  global.AutumnThemeArt = { openArt: openArt, openPalette: openPalette, importArt: importArt, clearArt: clearArt, applyCustom: applyCustom, applyPreset: applyPreset, saveCustom: saveCustom, deleteCustom: deleteCustom, palettes: palettes, active: activePalette };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
