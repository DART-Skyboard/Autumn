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
      if (!artMeta) lsSet('art', null); renderArt();
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
        .then(loadArt).then(function () {
          if (gh()) uploadArt(file, kind).then(tagBlobSha);
          else lsSet('art', { kind: kind, name: file.name, type: file.type, size: file.size, synced: false });
          return 'ART set: ' + file.name + (gh() ? '' : ' (saved on this device — sign in to back it up)');
        });
    }).catch(function (e) { return 'Could not save art: ' + (e && e.message || e); });
  }
  function clearArt() { return clearArtLocal().then(function () { lsSet('art', null); markChanged(); setSync(gh() ? 'Art cleared (profile updated).' : ''); }); }
  // Store the uploaded blob sha with the local copy so a later pull does not re-download the same art.
  function tagBlobSha() { var m = lsGet('art', null); if (!m || !m.blobSha) return; return idb('readwrite', function (st) { var q = st.get(user()); q.onsuccess = function () { if (q.result) { q.result.blobSha = m.blobSha; st.put(q.result, user()); } }; return q; }); }

  // ── PROFILE SYNC (signed-in users) ─────────────────────────────────────────
  // Backs up ART (≤ 20 MB) + the art preference + custom palettes to the user's existing private profile repo
  // ({username}/Autumn-Ash-{username}, the same repo the memory archive and data-prefs.json use). Guests stay local.
  //   theme/theme-prefs.json  {v, updated, palette, palettes[], art:{kind,name,type,size,path,blobSha,ts,synced}}
  //   theme/art/<file>        the art itself, written through the git data API (blob → tree → commit → ref), which takes
  //                           large payloads the contents API rejects, and read back with /git/blobs/<sha> (raw).
  var SYNC_LIMIT = 20 * 1024 * 1024, PREFS_PATH = 'theme/theme-prefs.json';
  var syncState = { status: '', busy: false, retry: null };
  function gh() { var a = global._ghAuth || {}; if (!a.loggedIn || !a.token || !a.username) return null; return { token: a.token, owner: a.username, repo: a.repoName || ('Autumn-Ash-' + a.username) }; }
  function api(g, method, path, body, raw) {
    return fetch('https://api.github.com/repos/' + g.owner + '/' + g.repo + path, {
      method: method, headers: { Authorization: 'token ' + g.token, Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { if (r.status === 404) return null; if (!r.ok) return r.text().then(function (t) { throw new Error('GitHub ' + r.status + ' ' + t.slice(0, 120)); }); return raw ? r.blob() : r.json(); });
  }
  function setSync(msg, retry) {
    syncState.status = msg; syncState.retry = retry || null;
    var el = document.getElementById('aut-ta-sync'); if (!el) return;
    el.innerHTML = esc(msg) + (retry ? ' <button id="aut-ta-retry">↻ RETRY</button>' : '');
    var b = document.getElementById('aut-ta-retry'); if (b) b.onclick = function () { var f = syncState.retry; syncState.retry = null; f && f(); };
  }
  function blobToB64(blob, onProg) {
    return new Promise(function (res, rej) { var fr = new FileReader(); fr.onprogress = function (e) { if (e.lengthComputable && onProg) onProg(e.loaded / e.total); }; fr.onload = function () { res(String(fr.result).split(',')[1] || ''); }; fr.onerror = function () { rej(fr.error); }; fr.readAsDataURL(blob); });
  }
  // POST with upload progress (fetch has none).
  function xhrJSON(g, path, body, onProg) {
    return new Promise(function (res, rej) {
      var x = new XMLHttpRequest(); x.open('POST', 'https://api.github.com/repos/' + g.owner + '/' + g.repo + path);
      x.setRequestHeader('Authorization', 'token ' + g.token); x.setRequestHeader('Accept', 'application/vnd.github.v3+json'); x.setRequestHeader('Content-Type', 'application/json');
      x.upload.onprogress = function (e) { if (e.lengthComputable && onProg) onProg(e.loaded / e.total); };
      x.onload = function () { if (x.status >= 200 && x.status < 300) { try { res(JSON.parse(x.responseText)); } catch (e) { rej(e); } } else rej(new Error('GitHub ' + x.status)); };
      x.onerror = function () { rej(new Error('network error')); }; x.send(JSON.stringify(body));
    });
  }
  function commitFiles(g, files, message) {   // files: [{path, sha}] (blob shas) — one commit on the default branch
    return api(g, 'GET', '').then(function (repo) {
      if (!repo) throw new Error('profile repo not found');
      var br = repo.default_branch || 'main', head;
      return api(g, 'GET', '/git/ref/heads/' + br).then(function (ref) {
        head = ref.object.sha; return api(g, 'GET', '/git/commits/' + head);
      }).then(function (c) {
        return api(g, 'POST', '/git/trees', { base_tree: c.tree.sha, tree: files.map(function (f) { return { path: f.path, mode: '100644', type: 'blob', sha: f.sha }; }) });
      }).then(function (t) { return api(g, 'POST', '/git/commits', { message: message, tree: t.sha, parents: [head] }); })
        .then(function (c) { return api(g, 'PATCH', '/git/refs/heads/' + br, { sha: c.sha }); });
    });
  }
  function textBlob(g, s) { return api(g, 'POST', '/git/blobs', { content: s, encoding: 'utf-8' }); }
  function localPrefs() { return { v: 1, updated: lsGet('sync_ts', 0) || Date.now(), palette: lsGet('palette', null), palettes: palettes(), art: lsGet('art', null) }; }
  var pushTimer = null;
  function markChanged() { if (user() === 'guest') return; lsSet('sync_ts', Date.now()); clearTimeout(pushTimer); pushTimer = setTimeout(function () { pushPrefs(); }, 1500); }
  function pushPrefs(extraFiles) {
    var g = gh(); if (!g) return Promise.resolve();
    return textBlob(g, JSON.stringify(localPrefs(), null, 2)).then(function (b) {
      return commitFiles(g, [{ path: PREFS_PATH, sha: b.sha }].concat(extraFiles || []), 'theme: sync art + palettes');
    }).catch(function (e) { setSync('Profile sync failed (' + e.message + ').', function () { pushPrefs(extraFiles); }); throw e; });
  }
  function uploadArt(file, kind) {
    var g = gh(); if (!g) return Promise.resolve();
    if (file.size > SYNC_LIMIT) {
      var meta = lsGet('art', {}) || {}; meta.synced = false; meta.local = true; lsSet('art', meta);
      setSync('This file exceeds the app\u2019s 20 MB backup limit, so it will only load from this device.');
      notice('This file exceeds the app\u2019s 20 MB backup limit, so it will only load from this device.');
      markChanged(); return Promise.resolve();
    }
    var safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80), path = 'theme/art/' + Date.now() + '-' + safe;
    setSync('Backing up to your profile… reading 0%');
    return blobToB64(file, function (p) { setSync('Backing up to your profile… reading ' + Math.round(p * 100) + '%'); })
      .then(function (b64) { return xhrJSON(g, '/git/blobs', { content: b64, encoding: 'base64' }, function (p) { setSync('Backing up to your profile… uploading ' + Math.round(p * 100) + '%'); }); })
      .then(function (blob) {
        var meta = { kind: kind, name: file.name, type: file.type, size: file.size, path: path, blobSha: blob.sha, ts: Date.now(), synced: true };
        lsSet('art', meta); lsSet('sync_ts', Date.now()); artMeta = { kind: kind, name: file.name, blobSha: blob.sha, synced: true };
        return pushPrefs([{ path: path, sha: blob.sha }]).then(function () { setSync('\u2713 Backed up to your private profile (' + (file.size / 1048576).toFixed(1) + ' MB). It will load on your other devices.'); });
      }).catch(function (e) { setSync('Backup failed (' + e.message + '). The art is still saved on this device.', function () { uploadArt(file, kind); }); });
  }
  function pullPrefs() {
    var g = gh(); if (!g) return Promise.resolve();
    var who = user();
    return api(g, 'GET', '/contents/' + PREFS_PATH, null, true).then(function (b) { return b ? b.text() : null; }).then(function (t) {
      if (!t || user() !== who) return;
      var r = JSON.parse(t), localTs = lsGet('sync_ts', 0);
      if (!(r.updated > localTs)) { if (!localTs) markChanged(); return; }   // local is newer (or first sign-in here): push instead
      lsSet('palettes', r.palettes || []); lsSet('palette', r.palette || null); lsSet('sync_ts', r.updated);
      var p = activePalette(); applyPaletteVars(p);
      var ra = r.art;
      if (!ra) return clearArtLocal();
      lsSet('art', ra);
      if (!ra.synced || !ra.blobSha) return;   // over-limit art lives only on the device that picked it
      return idb('readonly', function (st) { return st.get(who); }).then(function (rec) {
        if (rec && rec.blobSha === ra.blobSha) return;
        setSync('Loading your art from your profile…');
        return api(g, 'GET', '/git/blobs/' + ra.blobSha, null, true).then(function (blob) {
          if (!blob) throw new Error('art file missing');
          var typed = new Blob([blob], { type: ra.type || (ra.kind === 'video' ? 'video/mp4' : 'image/png') });
          return idb('readwrite', function (st) { return st.put({ kind: ra.kind, name: ra.name, type: ra.type, blob: typed, ts: ra.ts, blobSha: ra.blobSha }, who); });
        }).then(loadArt).then(function () { setSync('\u2713 Art synced from your profile.'); });
      });
    }).catch(function (e) { setSync('Could not load profile theme (' + e.message + ').', pullPrefs); });
  }
  function clearArtLocal() { return idb('readwrite', function (st) { return st.delete(user()); }).then(loadArt).catch(loadArt); }
  function notice(msg) {
    var n = document.createElement('div'); n.className = 'aut-ta-notice'; n.setAttribute('role', 'status'); n.textContent = msg;
    document.body.appendChild(n); setTimeout(function () { n.style.opacity = '0'; setTimeout(function () { n.remove(); }, 600); }, 7000);
  }

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
  function applyCustom(p) { lsSet('palette', p ? p.id : null); applyPaletteVars(p); markChanged(); }
  function applyPreset(label) {
    lsSet('palette', null); applyPaletteVars(null); markChanged();
    if (typeof global.cycleTheme !== 'function') return;
    for (var i = 0; i < PRESETS.length + 1; i++) {
      var l = document.getElementById('tt-label'); if (l && l.textContent.trim().toUpperCase() === label) break;
      global.cycleTheme();
    }
  }
  function saveCustom(name, bg1, bg2, accent, id) {
    var list = palettes(), rec = { id: id || uid(), name: (name || 'CUSTOM').slice(0, 24), bg1: bg1, bg2: bg2, accent: accent };
    var i = list.findIndex(function (p) { return p.id === rec.id; }); if (i >= 0) list[i] = rec; else list.push(rec);
    lsSet('palettes', list); markChanged(); return rec;
  }
  function deleteCustom(id) {
    lsSet('palettes', palettes().filter(function (p) { return p.id !== id; })); markChanged();
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
      '#aut-cp-ov{position:fixed;inset:0;z-index:99995;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.4);touch-action:none}',
      '#aut-cp{width:min(340px,94vw);max-height:94vh;overflow:auto;background:rgba(10,18,30,.82);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid color-mix(in srgb,var(--cyan,#00e5ff) 35%,transparent);border-radius:14px;padding:12px;color:var(--text,#c8e6f0);font-family:var(--font-d,monospace);font-size:10px;letter-spacing:1px;box-shadow:0 0 24px color-mix(in srgb,var(--cyan,#00e5ff) 18%,transparent)}',
      '#aut-cp h4{margin:0 0 8px;font-size:11px;letter-spacing:2px;color:var(--cyan,#00e5ff);display:flex;justify-content:space-between;align-items:center}',
      '#aut-cp button{font-family:inherit;font-size:9px;letter-spacing:1px;padding:6px 9px;border-radius:5px;border:1px solid color-mix(in srgb,var(--cyan,#00e5ff) 35%,transparent);background:color-mix(in srgb,var(--cyan,#00e5ff) 8%,transparent);color:var(--cyan,#00e5ff);cursor:pointer;margin:2px}',
      '#aut-cp button.on{background:color-mix(in srgb,var(--cyan,#00e5ff) 26%,transparent)}',
      '#aut-cp button:focus-visible,#aut-cp [tabindex]:focus-visible,#aut-cp input:focus-visible{outline:2px solid var(--cyan,#00e5ff);outline-offset:2px}',
      '#aut-cp .cp-tabs{display:flex;gap:2px;margin-bottom:8px}#aut-cp .cp-tabs button{flex:1}',
      '#aut-cp .cp-sv{position:relative;width:100%;aspect-ratio:16/10;border-radius:8px;overflow:hidden;touch-action:none;cursor:crosshair}',
      '#aut-cp .cp-sv canvas,#aut-cp .cp-hue canvas{width:100%;height:100%;display:block}',
      '#aut-cp .cp-dot{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #000,0 0 8px rgba(0,0,0,.6);pointer-events:none}',
      '#aut-cp .cp-hue{position:relative;height:22px;margin-top:10px;border-radius:11px;overflow:visible;touch-action:none;cursor:ew-resize}#aut-cp .cp-hue canvas{border-radius:11px}',
      '#aut-cp .cp-knob{position:absolute;top:50%;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1px #000,0 0 6px rgba(0,0,0,.6);pointer-events:none}',
      '#aut-cp .cp-grid{display:grid;grid-template-columns:repeat(12,1fr);border-radius:8px;overflow:hidden}#aut-cp .cp-grid button{margin:0;padding:0;border:0;border-radius:0;aspect-ratio:1;min-height:20px}#aut-cp .cp-grid button.on{outline:2px solid #fff;outline-offset:-2px;z-index:1}',
      '#aut-cp .cp-sl{gap:8px}#aut-cp .cp-sl input[type=range]{flex:1;-webkit-appearance:none;appearance:none;height:16px;border-radius:8px}#aut-cp .cp-sl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:#fff;border:2px solid #000}#aut-cp .cp-sl input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#fff}',
      '#aut-cp .cp-sl input[type=number],#aut-cp #cp-hex{width:56px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:4px;padding:5px;font:inherit}#aut-cp #cp-hex{width:90px;text-transform:uppercase}#aut-cp #cp-hex.bad{border-color:#ff4466}',
      '#aut-cp .cp-prev{display:flex;width:56px;height:30px;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,.25)}#aut-cp .cp-prev span{flex:1}',
      '#aut-cp .cp-sw{width:26px;height:26px;padding:0!important;border-radius:50%!important;border:1px solid rgba(255,255,255,.3)!important}',
      '#aut-cp .sec{font-size:8px;letter-spacing:2px;opacity:.55;margin:10px 0 4px}#aut-cp .row{display:flex;align-items:center;gap:6px;margin:4px 0}',
      '#aut-ta-box .cp-fields{flex-wrap:wrap}#aut-ta-box .cp-field{display:inline-flex;align-items:center;gap:4px}#aut-ta-box .cp-field small{opacity:.6;font-size:8px}',
      '@media (orientation:landscape) and (max-height:520px){#aut-cp{width:min(620px,96vw);display:grid;grid-template-columns:1.2fr 1fr;column-gap:12px}#aut-cp h4,#aut-cp .cp-tabs{grid-column:1/-1}#aut-cp #cp-body{grid-row:span 4}#aut-cp .cp-sv{aspect-ratio:16/9}}',
      '.aut-ta-notice{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:99999;max-width:min(460px,92vw);padding:10px 14px;border-radius:10px;background:rgba(40,20,4,.9);border:1px solid #ffb347;color:#ffd9a0;font-family:var(--font-d,monospace);font-size:11px;letter-spacing:.5px;line-height:1.5;backdrop-filter:blur(14px);transition:opacity .6s;box-shadow:0 0 18px rgba(255,179,71,.25)}',
      '#aut-ta-sync button{padding:3px 7px}',
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
      '<div>One background behind the whole app — an image (JPG, PNG, WebP, GIF, HEIC*) or a video (MP4, MOV*, WebM). Remembered for <b>' + esc(user()) + '</b>. The overlay button (FROST…DEEP) still tints it; VOID hides it.</div>' +
      '<div class="sec">CURRENT</div><div id="aut-ta-cur">' + (artMeta ? esc(artMeta.kind.toUpperCase() + ' · ' + artMeta.name) : 'None — theme video') + '</div>' +
      '<div class="sec">CHOOSE</div><input type="file" id="aut-ta-file" accept="image/*,video/*,.heic,.heif,.mov,.m4v,.webm,.mp4" style="display:none">' +
      '<button id="aut-ta-pick">⇪ CHOOSE IMAGE / VIDEO</button>' + (artMeta ? '<button class="danger" id="aut-ta-clear">✕ CLEAR ART</button>' : '') +
      '<div style="opacity:.45;margin-top:6px">* where this browser can decode it</div><div id="aut-ta-msg"></div>' +
      '<div class="sec">PROFILE BACKUP</div><div id="aut-ta-sync">' + (gh() ? (artMeta && lsGet('art', {}) && lsGet('art', {}).synced ? '✓ Backed up to your private profile.' : (lsGet('art', {}) || {}).local ? 'This file exceeds the app’s 20 MB backup limit, so it will only load from this device.' : 'Files up to 20 MB back up to your private Autumn profile and load on your other devices.') : 'Guest: art and palettes stay on this device. Sign in with GitHub to back them up.') + '</div>';
    setTimeout(function () { if (syncState.status) setSync(syncState.status, syncState.retry); }, 0);
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
      '<div class="row cp-fields">' + [['bg1', 'BG 1', d.bg1], ['bg2', 'BG 2', d.bg2], ['acc', 'ACCENT', d.accent]].map(function (f) {
        return '<button type="button" class="cp-field" data-pick="' + f[0] + '" aria-label="Pick ' + f[1] + ' colour"><span class="sw" style="background:' + esc(f[2]) + '"></span>' + f[1] + ' <small>' + esc(String(f[2]).toUpperCase()) + '</small></button>' +
          '<input type="hidden" id="aut-pe-' + f[0] + '" value="' + esc(f[2]) + '">';
      }).join('') + '</div>' +
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
    // Swatch buttons open the in-app picker; dragging previews the whole palette live, CANCEL restores what was showing.
    box.querySelectorAll('[data-pick]').forEach(function (b) {
      b.onclick = function () {
        var f = b.getAttribute('data-pick'), inp = box.querySelector('#aut-pe-' + f), before = activePalette();
        var paint = function (h) { inp.value = h; b.querySelector('.sw').style.background = h; b.querySelector('small').textContent = h.toUpperCase(); };
        openColorPicker(b.textContent.replace(/#.*/, '').trim() + ' COLOUR', inp.value, function (h) { paint(h); applyPaletteVars({ bg1: val('#aut-pe-bg1'), bg2: val('#aut-pe-bg2'), accent: val('#aut-pe-acc') }); },
          function (h) { if (h) { paint(h); box.querySelector('#aut-ta-msg').textContent = 'Previewing — SAVE to keep it.'; } else { applyPaletteVars(before); } });
      };
    });
    var n = box.querySelector('#aut-pe-new'); if (n) n.onclick = function () { openPalette({ name: 'CUSTOM', bg1: d.bg1, bg2: d.bg2, accent: d.accent }); };
    ov.classList.add('open');
  }
  // ── In-app colour picker (replaces <input type=color>; Android's native dialog is a bare swatch grid) ──
  // Mirrors the iOS SwiftUI ColorPicker sheet (UIColorPickerViewController, supportsOpacity:false):
  // GRID / SPECTRUM / SLIDERS tabs, eyedropper, hex field, current-vs-new preview, recent swatches.
  var GRID_HUES = [0, 30, 50, 90, 140, 175, 200, 220, 250, 280, 310, 335];
  function hsv2rgb(h, s, v) { var f = function (n) { var k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); }; return [f(5), f(3), f(1)]; }
  function rgb2hsv(r, g, b) { r /= 255; g /= 255; b /= 255; var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx]; }
  function rgbHex(c) { return '#' + c.map(function (x) { return ('0' + Math.max(0, Math.min(255, x | 0)).toString(16)).slice(-2); }).join(''); }
  function normHex(s) { s = String(s || '').trim().replace(/^#/, ''); if (/^[0-9a-f]{3}$/i.test(s)) s = s.replace(/./g, '$&$&'); return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toLowerCase() : null; }
  function recents() { try { return JSON.parse(localStorage.getItem('autumn_color_recents_v1') || '[]'); } catch (e) { return []; } }
  function pushRecent(h) { var r = recents().filter(function (x) { return x !== h; }); r.unshift(h); try { localStorage.setItem('autumn_color_recents_v1', JSON.stringify(r.slice(0, 12))); } catch (e) {} }
  function openColorPicker(title, start, onLive, onDone) {
    var orig = normHex(start) || '#7ecfff', rgb = hexRGB(orig), hsv = rgb2hsv(rgb[0], rgb[1], rgb[2]), tab = 'spectrum';
    var ov = document.createElement('div'); ov.id = 'aut-cp-ov';
    ov.innerHTML = '<div id="aut-cp" role="dialog" aria-label="Colour picker"><h4><span>' + esc(title) + '</span><button data-x aria-label="Cancel">✕</button></h4>' +
      '<div class="cp-tabs"><button data-t="grid">GRID</button><button data-t="spectrum">SPECTRUM</button><button data-t="sliders">SLIDERS</button></div>' +
      '<div id="cp-body"></div>' +
      '<div class="row" style="margin-top:8px"><div class="cp-prev" title="Original | New"><span id="cp-old"></span><span id="cp-new"></span></div>' +
      '<label style="flex:1">HEX <input type="text" id="cp-hex" maxlength="7" spellcheck="false" autocomplete="off"></label>' +
      ('EyeDropper' in global ? '<button id="cp-eye" title="Pick a colour from the screen" aria-label="Eyedropper">⌖</button>' : '') + '</div>' +
      '<div class="sec">RECENT</div><div id="cp-rec"></div>' +
      '<div style="text-align:right;margin-top:8px"><button data-x>CANCEL</button><button id="cp-ok">DONE</button></div></div>';
    document.body.appendChild(ov);
    var $ = function (s) { return ov.querySelector(s); }, body = $('#cp-body');
    $('#cp-old').style.background = orig;
    function cur() { return rgbHex(rgb); }
    function sync(src) {
      var h = cur(); $('#cp-new').style.background = h; if (src !== 'hex') $('#cp-hex').value = h.toUpperCase();
      if (tab === 'spectrum') drawSpectrumMarks(); if (tab === 'sliders' && src !== 'slider') paintSliders(); if (tab === 'grid') markGrid();
      if (onLive) onLive(h);
    }
    function setRGB(c, src) { rgb = c.map(function (x) { return Math.max(0, Math.min(255, Math.round(x))); }); if (src !== 'hsv') hsv = rgb2hsv(rgb[0], rgb[1], rgb[2]); sync(src); }
    function setHSV(h, s, v, src) { hsv = [h, s, v]; rgb = hsv2rgb(h, s, v); sync(src || 'hsv'); }
    // drag helper: pointer (mouse/touch/pen) with capture
    function drag(el, fn) {
      el.addEventListener('pointerdown', function (e) { e.preventDefault(); el.setPointerCapture(e.pointerId); fn(e); var mv = function (ev) { fn(ev); }, up = function () { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); }; el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); });
    }
    function rel(el, e) { var r = el.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; }
    // SPECTRUM: saturation×brightness square for the current hue + hue strip (keyboard: arrows move, Shift = ×10)
    var sv, hue;
    function renderSpectrum() {
      body.innerHTML = '<div class="cp-sv" tabindex="0" aria-label="Saturation and brightness"><canvas width="256" height="160"></canvas><i class="cp-dot"></i></div>' +
        '<div class="cp-hue" tabindex="0" aria-label="Hue"><canvas width="256" height="14"></canvas><i class="cp-knob"></i></div>';
      sv = body.querySelector('.cp-sv'); hue = body.querySelector('.cp-hue');
      var hc = hue.querySelector('canvas').getContext('2d'), g = hc.createLinearGradient(0, 0, 256, 0);
      for (var i = 0; i <= 12; i++) g.addColorStop(i / 12, 'hsl(' + i * 30 + ',100%,50%)'); hc.fillStyle = g; hc.fillRect(0, 0, 256, 14);
      drag(sv, function (e) { var p = rel(sv, e); setHSV(hsv[0], p[0], 1 - p[1]); });
      drag(hue, function (e) { setHSV(rel(hue, e)[0] * 359.9, hsv[1], hsv[2]); });
      sv.onkeydown = function (e) { var st = e.shiftKey ? .1 : .01, k = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key]; if (k) { e.preventDefault(); setHSV(hsv[0], Math.max(0, Math.min(1, hsv[1] + k[0])), Math.max(0, Math.min(1, hsv[2] + k[1]))); } };
      hue.onkeydown = function (e) { var st = e.shiftKey ? 10 : 1, k = { ArrowLeft: -st, ArrowDown: -st, ArrowRight: st, ArrowUp: st }[e.key]; if (k != null) { e.preventDefault(); setHSV((hsv[0] + k + 360) % 360, hsv[1], hsv[2]); } };
      drawSpectrumMarks();
    }
    function drawSpectrumMarks() {
      if (!sv) return; var c = sv.querySelector('canvas').getContext('2d');
      c.fillStyle = 'hsl(' + hsv[0] + ',100%,50%)'; c.fillRect(0, 0, 256, 160);
      var w = c.createLinearGradient(0, 0, 256, 0); w.addColorStop(0, '#fff'); w.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = w; c.fillRect(0, 0, 256, 160);
      var k = c.createLinearGradient(0, 0, 0, 160); k.addColorStop(0, 'rgba(0,0,0,0)'); k.addColorStop(1, '#000'); c.fillStyle = k; c.fillRect(0, 0, 256, 160);
      var d = sv.querySelector('.cp-dot'); d.style.left = (hsv[1] * 100) + '%'; d.style.top = ((1 - hsv[2]) * 100) + '%'; d.style.background = cur();
      var n = hue.querySelector('.cp-knob'); n.style.left = (hsv[0] / 360 * 100) + '%';
    }
    // GRID: iOS-style 12 hues × 9 tones + grey ramp
    function renderGrid() {
      var h = '<div class="cp-grid">';
      for (var j = 0; j < 12; j++) { var gv = Math.round(255 * j / 11); h += '<button data-c="' + rgbHex([gv, gv, gv]) + '"></button>'; }
      [[.35, .35], [.6, .5], [.85, .65], [1, .85], [1, 1], [.75, 1], [.5, 1], [.3, 1], [.15, 1]].forEach(function (sv2) {
        GRID_HUES.forEach(function (hh) { h += '<button data-c="' + rgbHex(hsv2rgb(hh, sv2[1], sv2[0])) + '"></button>'; });
      });
      body.innerHTML = h + '</div>';
      body.querySelectorAll('[data-c]').forEach(function (b) { b.style.background = b.getAttribute('data-c'); b.setAttribute('aria-label', b.getAttribute('data-c')); b.onclick = function () { setRGB(hexRGB(b.getAttribute('data-c')), 'grid'); }; });
      markGrid();
    }
    function markGrid() { var h = cur(); body.querySelectorAll('[data-c]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-c') === h); }); }
    // SLIDERS: RGB with gradient tracks + number entry
    function renderSliders() {
      body.innerHTML = ['R', 'G', 'B'].map(function (L, i) { return '<div class="row cp-sl"><b>' + L + '</b><input type="range" min="0" max="255" data-i="' + i + '" aria-label="' + L + '"><input type="number" min="0" max="255" data-n="' + i + '" aria-label="' + L + ' value"></div>'; }).join('');
      body.querySelectorAll('[data-i]').forEach(function (r) { r.oninput = function () { var c = rgb.slice(); c[+r.getAttribute('data-i')] = +r.value; setRGB(c, 'slider'); paintSliders(); }; });
      body.querySelectorAll('[data-n]').forEach(function (r) { r.onchange = function () { var c = rgb.slice(); c[+r.getAttribute('data-n')] = +r.value || 0; setRGB(c); }; });
      paintSliders();
    }
    function paintSliders() {
      body.querySelectorAll('[data-i]').forEach(function (r) {
        var i = +r.getAttribute('data-i'), a = rgb.slice(), b = rgb.slice(); a[i] = 0; b[i] = 255; r.value = rgb[i];
        r.style.background = 'linear-gradient(90deg,' + rgbHex(a) + ',' + rgbHex(b) + ')'; body.querySelector('[data-n="' + i + '"]').value = rgb[i];
      });
    }
    function renderTab(t) { tab = t; sv = hue = null; ov.querySelectorAll('[data-t]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); }); ({ grid: renderGrid, spectrum: renderSpectrum, sliders: renderSliders })[t](); sync('tab'); }
    function renderRecents() {
      var r = recents(); $('#cp-rec').innerHTML = r.length ? r.map(function (h) { return '<button class="cp-sw" data-r="' + h + '" aria-label="' + h + '" style="background:' + h + '"></button>'; }).join('') : '<span style="opacity:.5">None yet</span>';
      ov.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () { setRGB(hexRGB(b.getAttribute('data-r'))); }; });
    }
    function finish(ok) { document.removeEventListener('keydown', esc2, true); ov.remove(); if (ok) { pushRecent(cur()); onDone && onDone(cur()); } else { onLive && onLive(orig); onDone && onDone(null); } }
    function esc2(e) { if (e.key === 'Escape') { e.stopPropagation(); finish(false); } else if (e.key === 'Enter' && e.target.id !== 'cp-hex' && e.target.tagName !== 'BUTTON') { finish(true); } }
    document.addEventListener('keydown', esc2, true);
    ov.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { renderTab(b.getAttribute('data-t')); }; });
    ov.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = function () { finish(false); }; });
    ov.addEventListener('pointerdown', function (e) { if (e.target === ov) finish(false); });
    $('#cp-ok').onclick = function () { finish(true); };
    $('#cp-hex').oninput = function () { var h = normHex(this.value); this.classList.toggle('bad', !h); if (h) setRGB(hexRGB(h), 'hex'); };
    $('#cp-hex').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); if (normHex(this.value)) finish(true); } };
    var eye = $('#cp-eye'); if (eye) eye.onclick = function () { try { new global.EyeDropper().open().then(function (r) { var h = normHex(r.sRGBHex); if (h) setRGB(hexRGB(h)); }).catch(function () {}); } catch (e) {} };
    renderRecents(); renderTab(tab);
    setTimeout(function () { var f = ov.querySelector('.cp-sv') || $('#cp-hex'); f && f.focus(); }, 30);
    return ov;
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
    lastUser = user(); loadArt().then(pullPrefs); reapply();
    // The page restores its saved theme after load (and again after session restore); re-assert the custom palette after it.
    [800, 2500, 6000].forEach(function (ms) { setTimeout(reapply, ms); });
    setInterval(function () { if (user() !== lastUser) { lastUser = user(); applyPaletteVars(null); loadArt().then(pullPrefs); reapply(); } }, 3000);
  }
  global.AutumnThemeArt = { pullPrefs: pullPrefs, pushPrefs: pushPrefs, syncState: syncState, openColorPicker: openColorPicker, openArt: openArt, openPalette: openPalette, importArt: importArt, clearArt: clearArt, applyCustom: applyCustom, applyPreset: applyPreset, saveCustom: saveCustom, deleteCustom: deleteCustom, palettes: palettes, active: activePalette };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
