// autumn-theme-art.js — ART + PALETTE theming, ported from Autumn iOS (ThemeSystem.swift / PaletteEditorOverlay.swift, build 163).
// ART: one user-supplied background (image: jpg/png/webp/gif/avif/bmp/svg/heic* — video: mp4/mov/webm/m4v*) shown behind the UI in
//      place of the theme default background. Remembered per user (IndexedDB, keyed by GitHub username or "guest").
//      The existing overlay engine (FROST/STEAM/CLEAR/HAZE/DUSK/DEEP/VOID) still sits on top; VOID hides the art (iOS showsArt).
//      (* heic / mov only where the browser can decode them — the file is test-loaded before it replaces the current art.)
// PALETTE: built-in presets (cycles the existing theme engine) + saved custom palettes {name,bg1,bg2,accent} with a frosted editor.
//      A custom palette drives --cyan (accent), --bg/--bg2 and the scrim wash tint (bg1 × 0.6, same as iOS AutumnPaletteRuntime.washRGB).
// UI SHADING (optional p.ui, mirrors iOS CustomPalette.ui*): panel/surface colour + 2nd stop, button fill + 2nd stop, hover/active
//      glow, border tint, UI opacity (15–100 %), backdrop blur, SOLID/GRADIENT fill and gradient angle. Drives --aut-ui-* vars and
//      body.aut-ui-custom; palettes saved before this (no p.ui) and the built-in presets keep the theme's own UI look.
// Additive only. Off switch: window.AUTUMN_THEME_ART = false before this script loads.
(function (global) {
  'use strict';
  if (typeof document === 'undefined' || global.AUTUMN_THEME_ART === false) return;

  var PRESETS = ['VOID', 'DAY', 'NIGHT', 'STEALTH', 'DEPARTURE', 'ASH TREE', 'ARIEL', 'SKYBOARD', 'LOUNGE', 'SUMMIT', 'AUTO'];
  // Built-in palettes: full palette records (incl. UI shading) offered next to the theme presets. Same values as
  // Autumn iOS AutumnPalette.builtIns. Selecting one stores its id like a saved palette; it can't be deleted, and EDIT starts a copy.
  var BUILTINS = [
    { id: 'builtin-neon-dusk', name: 'NEON DUSK', builtin: true, bg1: '#05070d', bg2: '#14203a', accent: '#00e5ff',
      ui: { on: true, surface: '#0a1a3a', surface2: '#3a0f4a', button: '#0074ff', button2: '#7a1fd0', glow: '#00e5ff', border: '#7ecfff', opacity: 58, blur: 20, style: 'gradient', angle: 135 } }
  ];
  var LEVEL_ALPHA = { FROST: 0.20, STEAM: 0.55, HAZE: 0.50, DUSK: 0.70, DEEP: 0.85 };
  var IMG_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|svg|heic|heif|tga)$/i, VID_EXT = /\.(mp4|m4v|mov|webm|ogv)$/i;
  var MAX_BYTES = 250 * 1024 * 1024;
  var artURL = null, artMeta = null, lastUser = null;
  // In-game guest edition (js/jots-embed.js): no IndexedDB, no profile sync — palettes live only in that frame's in-memory storage.
  var EMBED = !!global.AUT_EMBED;

  function user() { var a = global._ghAuth || {}; return (a.loggedIn !== false && a.username) ? String(a.username).toLowerCase() : 'guest'; }
  function lsKey(k) { return 'autumn_' + k + '_v1:' + user(); }
  function lsGet(k, d) { try { var v = localStorage.getItem(lsKey(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(lsKey(k)); else localStorage.setItem(lsKey(k), JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hexRGB(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ── UI shading model (p.ui) ────────────────────────────────────────────────
  function hex6(h, d) { h = String(h || '').trim().replace(/^#/, ''); if (/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/./g, '$&$&'); return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toLowerCase() : d; }
  function mixHex(a, b, t) { var x = hexRGB(a), y = hexRGB(b); return '#' + x.map(function (v, i) { return ('0' + Math.round(v + (y[i] - v) * t).toString(16)).slice(-2); }).join(''); }
  function clampN(v, lo, hi, d) { v = +v; return isNaN(v) ? d : Math.max(lo, Math.min(hi, Math.round(v))); }
  function rgba(h, a) { return 'rgba(' + hexRGB(h).join(',') + ',' + (Math.round(a * 1000) / 1000) + ')'; }
  function lum(h) { var c = hexRGB(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  // Defaults derived from the palette's own colours, so a fresh palette's UI already matches its background + accent.
  function uiDefaults(p) {
    p = p || {}; var bg1 = hex6(p.bg1, '#05070d'), bg2 = hex6(p.bg2, '#14203a'), acc = hex6(p.accent, '#7ecfff');
    return { on: true, surface: mixHex(bg1, '#000000', 0.15), surface2: bg2, button: mixHex(bg2, acc, 0.22), button2: mixHex(bg1, acc, 0.08), glow: acc, border: acc, opacity: 72, blur: 16, style: 'gradient', angle: 135 };
  }
  function normUI(u, p) {
    var d = uiDefaults(p); if (!u || typeof u !== 'object') return null;
    return {
      on: u.on !== false,
      surface: hex6(u.surface, d.surface), surface2: hex6(u.surface2, d.surface2),
      button: hex6(u.button, d.button), button2: hex6(u.button2, d.button2),
      glow: hex6(u.glow, d.glow), border: hex6(u.border, d.border),
      opacity: clampN(u.opacity, 15, 100, d.opacity), blur: clampN(u.blur, 0, 40, d.blur),
      style: u.style === 'solid' ? 'solid' : 'gradient', angle: clampN(u.angle, 0, 359, d.angle) % 360
    };
  }

  // ── IndexedDB (art blobs are too large for localStorage) ───────────────────
  function db() {
    return new Promise(function (res, rej) {
      if (EMBED) { rej(new Error('art storage disabled in embed')); return; }
      var r = indexedDB.open('autumn_theme_art', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('art'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function idb(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction('art', mode), st = tx.objectStore('art'), q = fn(st), settled = false;
        var fail = function () { if (settled) return; settled = true; rej(tx.error || new Error('IndexedDB transaction aborted')); };
        tx.oncomplete = function () { if (settled) return; settled = true; res(q && q.result); };
        tx.onerror = fail; tx.onabort = fail;
      });
    });
  }

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
    var key = user();
    return idb('readonly', function (st) { return st.get(key); }).then(function (rec) {
      if (user() !== key) return;   // identity changed while reading: the user-change watcher reloads for the new user
      if (artURL) { try { URL.revokeObjectURL(artURL); } catch (e) {} }
      artURL = null; artMeta = null;
      if (rec && rec.blob) { artURL = URL.createObjectURL(rec.blob); artMeta = { kind: rec.kind, name: rec.name }; }
      if (!artMeta) lsSet('art', null); renderArt();
    }).catch(function () { if (user() === key) renderArt(); });
  }
  function importArt(file) {
    if (!file) return Promise.resolve('No file chosen.');
    var kind = kindOf(file);
    if (!kind) return Promise.resolve('Unsupported file type — choose an image (JPG/PNG/WebP/GIF/HEIC) or a video (MP4/MOV/WebM).');
    if (file.size > MAX_BYTES) return Promise.resolve('File is too large (max 250 MB).');
    if (EMBED) return Promise.resolve('ART is not available in the in-game edition.');
    var owner = user();
    var probe = URL.createObjectURL(file);
    return testDecode(kind, probe).then(function (ok) {
      URL.revokeObjectURL(probe);
      if (!ok) return 'This browser cannot play/decode that file' + (/\.(heic|heif|mov)$/i.test(file.name) ? ' (HEIC/MOV support varies — try JPG/PNG or MP4/WebM).' : '.') + ' Current art kept.';
      if (user() !== owner) return 'User changed before art was saved. Current art kept.';
      return idb('readwrite', function (st) { return st.put({ kind: kind, name: file.name, type: file.type, blob: file, ts: Date.now() }, owner); })
        .then(loadArt).then(function () {
          if (user() !== owner) return 'User changed while art was saving.';
          // fresh metadata first (never reuse the previous art's blobSha); marked local until the profile commit succeeds
          lsSet('art', { kind: kind, name: file.name, type: file.type, size: file.size, synced: false, local: true });
          if (gh()) uploadArt(file, kind, owner);
          return 'ART set: ' + file.name + (gh() ? '' : ' (saved on this device — sign in to back it up)');
        });
    }).catch(function (e) { return 'Could not save art: ' + (e && e.message || e); });
  }
  function clearArt() { return clearArtLocal().then(function () { lsSet('art', null); markChanged(); setSync(gh() ? 'Art cleared (profile updated).' : ''); }); }
  // Store the uploaded blob sha with the local copy so a later pull does not re-download the same art.
  function tagBlobSha(owner) { if (owner && user() !== owner) return Promise.resolve(); var key = user(), m = lsGet('art', null); if (!m || !m.blobSha) return Promise.resolve(); return idb('readwrite', function (st) { var q = st.get(key); q.onsuccess = function () { if (q.result) { q.result.blobSha = m.blobSha; st.put(q.result, key); } }; return q; }); }

  // ── PROFILE SYNC (signed-in users) ─────────────────────────────────────────
  // Backs up ART (≤ 20 MB) + the art preference + custom palettes to the user's existing private profile repo
  // ({username}/Autumn-Ash-{username}, the same repo the memory archive and data-prefs.json use). Guests stay local.
  //   theme/theme-prefs.json  {v, updated, palette, palettes[], art:{kind,name,type,size,path,blobSha,ts,synced}}
  //   theme/art/<file>        the art itself, written through the git data API (blob → tree → commit → ref), which takes
  //                           large payloads the contents API rejects, and read back with /git/blobs/<sha> (raw).
  var SYNC_LIMIT = 20 * 1024 * 1024, PREFS_PATH = 'theme/theme-prefs.json';
  var syncState = { status: '', busy: false, retry: null };
  function gh() { if (EMBED) return null; var a = global._ghAuth || {}; if (!a.loggedIn || !a.token || !a.username) return null; return { token: a.token, owner: a.username, repo: a.repoName || ('Autumn-Ash-' + a.username) }; }
  function api(g, method, path, body, raw) {
    return fetch('https://api.github.com/repos/' + g.owner + '/' + g.repo + path, {
      method: method, cache: 'no-store', headers: { Authorization: 'token ' + g.token, Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
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
  function markChanged() { if (EMBED || user() === 'guest') return; lsSet('sync_ts', Date.now()); clearTimeout(pushTimer); pushTimer = setTimeout(function () { pushPrefs(); }, 1500); }
  // owner (lower-case username) pins the push to the account that made the change: if the signed-in account switched
  // meanwhile, nothing is written, so one account's palettes/art never land in another account's profile repo.
  function pushPrefs(extraFiles, owner) {
    var g = gh(); if (!g) return Promise.resolve();
    var who = owner || user();
    if (user() !== who || String(g.owner).toLowerCase() !== who) return Promise.resolve();
    var prefs = localPrefs();
    return textBlob(g, JSON.stringify(prefs, null, 2)).then(function (b) {
      return commitFiles(g, [{ path: PREFS_PATH, sha: b.sha }].concat(extraFiles || []), 'theme: sync art + palettes');
    }).catch(function (e) { setSync('Profile sync failed (' + e.message + ').', function () { pushPrefs(extraFiles, who); }); throw e; });
  }
  function uploadArt(file, kind, owner) {
    var g = gh(); if (!g) return Promise.resolve();
    var who = owner || user(); if (user() !== who) return Promise.resolve();
    if (file.size > SYNC_LIMIT) {
      lsSet('art', { kind: kind, name: file.name, type: file.type, size: file.size, synced: false, local: true, overLimit: true });
      setSync('This file exceeds the app\u2019s 20 MB backup limit, so it will only load from this device.');
      notice('This file exceeds the app\u2019s 20 MB backup limit, so it will only load from this device.');
      markChanged(); return Promise.resolve();
    }
    var safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80), path = 'theme/art/' + Date.now() + '-' + safe;
    setSync('Backing up to your profile… reading 0%');
    return blobToB64(file, function (p) { setSync('Backing up to your profile… reading ' + Math.round(p * 100) + '%'); })
      .then(function (b64) { return xhrJSON(g, '/git/blobs', { content: b64, encoding: 'base64' }, function (p) { setSync('Backing up to your profile… uploading ' + Math.round(p * 100) + '%'); }); })
      .then(function (blob) {
        if (user() !== who) throw new Error('account changed during backup');
        var meta = { kind: kind, name: file.name, type: file.type, size: file.size, path: path, blobSha: blob.sha, ts: Date.now(), synced: true };
        lsSet('art', meta); lsSet('sync_ts', Date.now()); artMeta = { kind: kind, name: file.name, blobSha: blob.sha, synced: true };
        return pushPrefs([{ path: path, sha: blob.sha }], who).then(function () { return tagBlobSha(who); }).then(function () { setSync('\u2713 Backed up to your private profile (' + (file.size / 1048576).toFixed(1) + ' MB). It will load on your other devices.'); });
      }).catch(function (e) {
        if (user() === who) {
          var failed = lsGet('art', null);
          if (failed && failed.name === file.name) { failed.path = null; failed.blobSha = null; failed.synced = false; failed.local = true; lsSet('art', failed); }
        }
        setSync('Backup failed (' + e.message + '). The art is still saved on this device.', function () { uploadArt(file, kind, who); });
      });
  }
  function pullPrefs() {
    var g = gh(); if (!g) return Promise.resolve();
    var who = user();
    return api(g, 'GET', '/contents/' + PREFS_PATH, null, true).then(function (b) { return b ? b.text() : null; }).then(function (t) {
      if (!t || user() !== who) return;
      var r = JSON.parse(t), localTs = lsGet('sync_ts', 0);
      if (!(r.updated > localTs)) { if (!localTs) markChanged(); return; }   // local is newer (or first sign-in here): push instead
      lsSet('palettes', r.palettes || []); lsSet('palette', r.palette || null);
      // sync_ts only advances once the art step succeeded, so RETRY / a reload re-runs a failed art download
      var done = function () { if (user() === who) lsSet('sync_ts', r.updated); };
      var p = activePalette(); applyPaletteVars(p);
      var ra = r.art;
      if (!ra) {
        // keep art that only exists on this device (not yet / never backed up); clear only art that came from the profile
        return idb('readonly', function (st) { return st.get(who); }).then(function (rec) {
          if (rec && !rec.blobSha) return;
          return clearArtLocal();
        }).then(done);
      }
      lsSet('art', ra);
      if (!ra.synced || !ra.blobSha) { done(); return; }   // over-limit art lives only on the device that picked it
      return idb('readonly', function (st) { return st.get(who); }).then(function (rec) {
        if (rec && rec.blobSha === ra.blobSha) { done(); return; }
        setSync('Loading your art from your profile…');
        return api(g, 'GET', '/git/blobs/' + ra.blobSha, null, true).then(function (blob) {
          if (!blob) throw new Error('art file missing');
          var typed = new Blob([blob], { type: ra.type || (ra.kind === 'video' ? 'video/mp4' : 'image/png') });
          if (user() !== who) throw new Error('account changed');
          return idb('readwrite', function (st) { return st.put({ kind: ra.kind, name: ra.name, type: ra.type, blob: typed, ts: ra.ts, blobSha: ra.blobSha }, who); });
        }).then(loadArt).then(function () { done(); setSync('\u2713 Art synced from your profile.'); });
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
  function activePalette() { var id = lsGet('palette', null); return id ? palettes().concat(BUILTINS).filter(function (p) { return p.id === id; })[0] || null : null; }
  function builtin(label) { return BUILTINS.filter(function (b) { return b.name === label; })[0] || null; }
  var VARS = ['--cyan', '--bg', '--bg2', '--border', '--tt-color'];
  var UI_VARS = ['--aut-ui-surface-fill', '--aut-ui-bubble-fill', '--aut-ui-input', '--aut-ui-btn-fill', '--aut-ui-btn-fill-hi', '--aut-ui-btn-border', '--aut-ui-border-soft',
    '--aut-ui-glow', '--aut-ui-glow-a', '--aut-ui-glow-b', '--aut-ui-blur', '--aut-ui-ink', '--aut-ui-ink-dim', '--aut-ui-btn-ink', '--panel'];
  // p.ui → CSS vars + body.aut-ui-custom (rules in css()). No p / no p.ui / ui.on === false → the theme's own UI look.
  function applyUIVars(p) {
    var r = document.documentElement.style, b = document.body.style, u = p && p.ui ? normUI(p.ui, p) : null;
    if (!u || !u.on) { UI_VARS.forEach(function (v) { r.removeProperty(v); b.removeProperty(v); }); document.body.classList.remove('aut-ui-custom', 'aut-ui-light'); return; }
    var a = u.opacity / 100, ba = Math.min(1, a + 0.08), g = u.style === 'gradient';
    var fill = function (c1, c2, al) { return g ? 'linear-gradient(' + u.angle + 'deg,' + rgba(c1, al) + ' 0%,' + rgba(c2, al) + ' 100%)' : rgba(c1, al); };
    var light = (lum(u.surface) + lum(u.surface2)) / 2 > 0.45 && a >= 0.5;
    var vals = {
      '--aut-ui-surface-fill': fill(u.surface, u.surface2, a),
      '--aut-ui-bubble-fill': fill(u.surface2, u.button, Math.min(1, a + 0.04)),
      '--aut-ui-input': rgba(mixHex(u.surface, light ? '#ffffff' : '#000000', 0.25), Math.max(0.12, a * 0.7)),
      '--aut-ui-btn-fill': fill(u.button, u.button2, ba),
      '--aut-ui-btn-fill-hi': fill(mixHex(u.button, u.glow, 0.25), mixHex(u.button2, u.glow, 0.15), Math.min(1, ba + 0.1)),
      '--aut-ui-btn-border': rgba(u.border, 0.55), '--aut-ui-border-soft': rgba(u.border, 0.22),
      '--aut-ui-glow': u.glow, '--aut-ui-glow-a': rgba(u.glow, 0.55), '--aut-ui-glow-b': rgba(u.glow, 0.22),
      '--aut-ui-blur': u.blur + 'px', '--panel': rgba(u.surface, a),
      '--aut-ui-ink': light ? '#0d1218' : '', '--aut-ui-ink-dim': light ? '#3a4656' : '',
      // Button labels: dark ink on light fills, near-white on dark/vivid fills (theme --dim greys vanish on a strong fill).
      '--aut-ui-btn-ink': (lum(u.button) + lum(u.button2)) / 2 > 0.4 && ba >= 0.5 ? '#0b1018' : '#eef8ff'
    };
    [r, b].forEach(function (s) { Object.keys(vals).forEach(function (k) { if (vals[k]) s.setProperty(k, vals[k]); else s.removeProperty(k); }); });
    document.body.classList.add('aut-ui-custom'); document.body.classList.toggle('aut-ui-light', light);
  }
  function applyPaletteVars(p) {
    var r = document.documentElement.style, b = document.body.style;
    applyUIVars(p);
    if (!p) { VARS.forEach(function (v) { r.removeProperty(v); b.removeProperty(v); }); document.body.classList.remove('aut-palette-custom'); b.removeProperty('background'); restyleScrim(null); return; }
    var a = hexRGB(p.accent);
    // body.theme-* classes redefine the vars on <body>, so set them there too (inline beats class).
    [r, b].forEach(function (s) { s.setProperty('--cyan', p.accent); s.setProperty('--bg', p.bg1); s.setProperty('--bg2', p.bg2); s.setProperty('--border', 'rgba(' + a.join(',') + ',0.14)'); s.setProperty('--tt-color', p.accent); });
    b.setProperty('background', 'linear-gradient(165deg,' + p.bg1 + ' 0%,' + p.bg2 + ' 100%)');
    document.body.classList.add('aut-palette-custom');
    var lbl = document.getElementById('tt-label'), dot = document.getElementById('tt-dot');
    if (lbl) { lbl.textContent = 'CUSTOM'; lbl.style.color = p.accent; } if (dot) dot.textContent = '◐';
    restyleScrim(p);
  }
  // Scrim wash follows the palette's bg1 × 0.6 (iOS AutumnPaletteRuntime.washRGB); VOID uses the palette gradient.
  // p = palette to tint with (the previewed one while editing); null restores the page's default scrim; no argument = saved palette.
  function restyleScrim(p) {
    if (arguments.length === 0) p = activePalette();
    var scrim = document.getElementById('vid-scrim'); if (!scrim) return;
    if (!p) { if (typeof global._reapplyScrim === 'function') { try { global._reapplyScrim(); } catch (e) {} } else scrim.style.removeProperty('background'); return; }
    var L = scrimLabel(), c = hexRGB(p.bg1).map(function (x) { return Math.round(x * 0.6); });
    if (L === 'VOID') scrim.style.background = 'linear-gradient(165deg,' + p.bg1 + ' 0%,' + p.bg2 + ' 100%)';
    else if (LEVEL_ALPHA[L] != null) scrim.style.background = 'rgba(' + c.join(',') + ',' + LEVEL_ALPHA[L] + ')';
  }
  function applyCustom(p) { lsSet('palette', p ? p.id : null); applyPaletteVars(p); markChanged(); }
  function applyPreset(label) {
    var bi = builtin(label); if (bi) { applyCustom(bi); return; }
    lsSet('palette', null); applyPaletteVars(null); markChanged();
    if (typeof global.cycleTheme !== 'function') return;
    for (var i = 0; i < PRESETS.length + 1; i++) {
      var l = document.getElementById('tt-label'); if (l && l.textContent.trim().toUpperCase() === label) break;
      global.cycleTheme();
    }
  }
  function saveCustom(name, bg1, bg2, accent, id, ui) {
    var list = palettes(), rec = { id: id || uid(), name: (name || 'CUSTOM').slice(0, 24), bg1: bg1, bg2: bg2, accent: accent };
    var prev = id ? list.filter(function (p) { return p.id === id; })[0] : null;
    var u = ui !== undefined ? normUI(ui, rec) : (prev && prev.ui ? normUI(prev.ui, rec) : null);   // ui omitted → keep what was saved
    if (u) rec.ui = u;
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
      'body.aut-has-art #backdrop-video,body.aut-has-art #theme-backdrop{opacity:0!important;visibility:hidden!important}',
      // Art replaces the theme default background, so page/theme atmospheres must not paint over it (VOID overlay brings the solid look back).
      'html.aut-art-visible,html.aut-art-visible body{background:transparent!important;background-color:transparent!important}',
      '.aut-ta-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:20px;height:30px;padding:0 10px 0 6px;cursor:pointer;flex-shrink:0;font-family:var(--font-d);font-size:.42rem;letter-spacing:1px;color:var(--cyan,#00ffcc);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);white-space:nowrap}',
      '.aut-ta-pill .d{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);font-size:10px}',
      '#aut-ta-ov{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35)}',
      '#aut-ta-ov.open{display:flex}',
      '#aut-ta-box{width:min(420px,94vw);max-height:86vh;overflow:auto;background:rgba(10,18,30,.72);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);border:1px solid color-mix(in srgb,var(--cyan,#00e5ff) 30%,transparent);border-radius:12px;padding:12px;color:var(--text,#c8e6f0);font-family:var(--font-d,monospace);font-size:10px;letter-spacing:1px}',
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
      // ── UI SHADING editor
      '#aut-ta-box .sub{font-size:7.5px;letter-spacing:1.5px;opacity:.5;margin:8px 0 2px}',
      '#aut-ta-box .ui-sl{gap:8px}#aut-ta-box .ui-sl span{width:58px;font-size:8px;opacity:.75}#aut-ta-box .ui-sl output{width:40px;text-align:right;font-size:9px}',
      '#aut-ta-box .ui-sl input[type=range]{flex:1;accent-color:var(--cyan,#00e5ff);height:16px}',
      '#aut-ta-box #aut-pe-ui.dim{opacity:.45}#aut-ta-box #aut-pe-ui .dirs button{padding:3px 6px;min-width:24px}#aut-ta-box #aut-pe-ui.solid .grad-only{opacity:.35;pointer-events:none}',
      '#aut-ta-box .ui-demo{margin-top:8px;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;gap:8px;font-size:8px}',
      // ── UI SHADING applied (body.aut-ui-custom): panels, sidebar, cards, modals, chat, inputs, buttons. !important beats theme-* rules.
      'body.aut-ui-custom header,body.aut-ui-custom #input-area,body.aut-ui-custom #footer-bar,body.aut-ui-custom .glass,body.aut-ui-custom .modal-box,body.aut-ui-custom #consent-box,body.aut-ui-custom .gh-login-box,' +
        'body.aut-ui-custom #mist-menu,body.aut-ui-custom #mist-canvas-wrap,body.aut-ui-custom #astar-header,body.aut-ui-custom #astar-list,body.aut-ui-custom #as-header,body.aut-ui-custom #as-canvas-wrap,' +
        'body.aut-ui-custom #hud-tm-panel,body.aut-ui-custom #sysbrd-panel,body.aut-ui-custom #multi-user-bar,body.aut-ui-custom .msg.autumn .bubble,body.aut-ui-custom #aut-ta-box,body.aut-ui-custom #aut-cp' +
        '{background:var(--aut-ui-surface-fill)!important;backdrop-filter:blur(var(--aut-ui-blur)) saturate(1.3)!important;-webkit-backdrop-filter:blur(var(--aut-ui-blur)) saturate(1.3)!important;border-color:var(--aut-ui-border-soft)!important}',
      'body.aut-ui-custom .msg.user .bubble{background:var(--aut-ui-bubble-fill)!important;border-color:var(--aut-ui-btn-border)!important;backdrop-filter:blur(var(--aut-ui-blur))!important;-webkit-backdrop-filter:blur(var(--aut-ui-blur))!important}',
      'body.aut-ui-custom #input-pill,body.aut-ui-custom #as-search,body.aut-ui-custom #aut-ta-box input[type=text],body.aut-ui-custom .modal-box textarea,body.aut-ui-custom #aut-cp #cp-hex,body.aut-ui-custom #aut-cp input[type=number]' +
        '{background:var(--aut-ui-input)!important;border-color:var(--aut-ui-border-soft)!important}',
      'body.aut-ui-custom #chat-input{background:transparent!important}',
      'body.aut-ui-custom .hdr-btn,body.aut-ui-custom .aut-ta-pill,body.aut-ui-custom #scrim-toggle,body.aut-ui-custom #theme-toggle,body.aut-ui-custom #live-feed-toggle,body.aut-ui-custom .bmh-btn,' +
        'body.aut-ui-custom .ac-tool-btn,body.aut-ui-custom .ac-btn,body.aut-ui-custom .cb-accept,body.aut-ui-custom .htm-btn,body.aut-ui-custom #as-btn-send,body.aut-ui-custom #scroll-to-top,body.aut-ui-custom #scroll-to-bottom,' +
        'body.aut-ui-custom #aut-ta-box button:not(.danger),body.aut-ui-custom #aut-cp .cp-tabs button,body.aut-ui-custom #aut-cp #cp-ok,body.aut-ui-custom #aut-cp [data-x],body.aut-ui-custom .ui-demo .demo-btn' +
        '{color:var(--aut-ui-btn-ink);background:var(--aut-ui-btn-fill)!important;border-color:var(--aut-ui-btn-border)!important;backdrop-filter:blur(var(--aut-ui-blur))!important;-webkit-backdrop-filter:blur(var(--aut-ui-blur))!important;transition:box-shadow .18s,border-color .18s,background .18s}',
      'body.aut-ui-custom .hdr-btn:hover,body.aut-ui-custom .aut-ta-pill:hover,body.aut-ui-custom #scrim-toggle:hover,body.aut-ui-custom #theme-toggle:hover,body.aut-ui-custom #live-feed-toggle:hover,body.aut-ui-custom .bmh-btn:hover,' +
        'body.aut-ui-custom .ac-tool-btn:hover,body.aut-ui-custom .ac-btn:hover,body.aut-ui-custom .cb-accept:hover,body.aut-ui-custom .htm-btn:hover,body.aut-ui-custom #aut-ta-box button:not(.danger):hover,body.aut-ui-custom #aut-cp .cp-tabs button:hover,body.aut-ui-custom #aut-cp #cp-ok:hover,body.aut-ui-custom .ui-demo .demo-btn:hover' +
        '{border-color:var(--aut-ui-glow)!important;box-shadow:0 0 12px var(--aut-ui-glow-a),inset 0 0 8px var(--aut-ui-glow-b)!important}',
      'body.aut-ui-custom .hdr-btn:active,body.aut-ui-custom .hdr-btn.active,body.aut-ui-custom .hdr-btn.on,body.aut-ui-custom #live-feed-toggle.lf-on,body.aut-ui-custom .ac-tool-btn.active,body.aut-ui-custom .ac-tool-btn.on,' +
        'body.aut-ui-custom #aut-ta-box button.on,body.aut-ui-custom #aut-cp .cp-tabs button.on,body.aut-ui-custom .bmh-btn:active,body.aut-ui-custom .ui-demo .demo-btn.on' +
        '{background:var(--aut-ui-btn-fill-hi)!important;border-color:var(--aut-ui-glow)!important;box-shadow:0 0 16px var(--aut-ui-glow-a),inset 0 0 10px var(--aut-ui-glow-b)!important}',
      // Light surfaces: keep text readable.
      'body.aut-ui-custom.aut-ui-light{--text:var(--aut-ui-ink);--bright:var(--aut-ui-ink);--dim:var(--aut-ui-ink-dim)}',
      'body.aut-ui-custom.aut-ui-light .bubble,body.aut-ui-custom.aut-ui-light #chat-input,body.aut-ui-custom.aut-ui-light #aut-ta-box,body.aut-ui-custom.aut-ui-light #aut-ta-box input[type=text]{color:var(--aut-ui-ink)!important}',
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
      '<div class="sec">CURRENT</div><div id="aut-ta-cur">' + (artMeta ? esc(artMeta.kind.toUpperCase() + ' · ' + artMeta.name) : 'None — theme default') + '</div>' +
      '<div class="sec">CHOOSE</div><input type="file" id="aut-ta-file" accept="image/*,video/*,.heic,.heif,.mov,.m4v,.webm,.mp4" style="display:none">' +
      '<button id="aut-ta-pick">⇪ CHOOSE IMAGE / VIDEO</button>' + (artMeta ? '<button class="danger" id="aut-ta-clear">✕ CLEAR ART</button>' : '') +
      '<div style="opacity:.45;margin-top:6px">* where this browser can decode it</div><div id="aut-ta-msg"></div>' +
      '<div class="sec">PROFILE BACKUP</div><div id="aut-ta-sync">' + (gh() ? (artMeta && lsGet('art', {}) && lsGet('art', {}).synced ? '✓ Backed up to your private profile.' : (lsGet('art', {}) || {}).overLimit ? 'This file exceeds the app’s 20 MB backup limit, so it will only load from this device.' : 'Files up to 20 MB back up to your private Autumn profile and load on your other devices.') : 'Guest: art and palettes stay on this device. Sign in with GitHub to back them up.') + '</div>';
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
    if (d.builtin) d = { name: d.name, bg1: d.bg1, bg2: d.bg2, accent: d.accent, ui: d.ui };   // editing a built-in starts a copy
    var h = '<h4><span>◐ PALETTE</span><button data-x>✕</button></h4><div class="sec">PRESETS</div><div>';
    PRESETS.forEach(function (p) { h += '<button data-preset="' + p + '" class="' + (!act && curLbl.trim().toUpperCase() === p ? 'on' : '') + '">' + p + '</button>'; });
    BUILTINS.forEach(function (b) { h += '<button data-preset="' + esc(b.name) + '" title="Built-in palette with UI shading" class="' + (act && act.id === b.id ? 'on' : '') + '">' + esc(b.name) + '</button>'; });
    h += '</div><div class="sec">SAVED</div>';
    var list = palettes();
    if (!list.length) h += '<div style="opacity:.5">No saved palettes yet.</div>';
    list.forEach(function (p) {
      h += '<div class="row"><span class="sw" style="background:linear-gradient(135deg,' + esc(p.bg1) + ',' + esc(p.bg2) + ')"></span><span class="sw" style="background:' + esc(p.accent) + '"></span>' +
        '<span style="flex:1">' + esc(p.name) + '</span><button data-apply="' + p.id + '" class="' + (act && act.id === p.id ? 'on' : '') + '">USE</button><button data-edit="' + p.id + '">EDIT</button><button class="danger" data-del="' + p.id + '">✕</button></div>';
    });
    // UI shading working copy: saved p.ui, else defaults from the palette colours. Old palettes (no ui) start at THEME DEFAULT.
    var ui = d.ui ? normUI(d.ui, d) : uiDefaults(d); if (!d.ui && d.id) ui.on = false;
    var field = function (attr, key, label, v) {
      return '<button type="button" class="cp-field" ' + attr + '="' + key + '" aria-label="Pick ' + label + ' colour"><span class="sw" style="background:' + esc(v) + '"></span>' + label + ' <small>' + esc(String(v).toUpperCase()) + '</small></button>';
    };
    var DIRS = [['↑', 0], ['↗', 45], ['→', 90], ['↘', 135], ['↓', 180], ['↙', 225], ['←', 270], ['↖', 315]];
    h += '<div class="sec">' + (d.id ? 'EDIT' : 'NEW') + '</div><input type="text" id="aut-pe-name" value="' + esc(d.name) + '" placeholder="name">' +
      '<div class="sub">BACKGROUND + ACCENT</div>' +
      '<div class="row cp-fields">' + [['bg1', 'BG 1', d.bg1], ['bg2', 'BG 2', d.bg2], ['acc', 'ACCENT', d.accent]].map(function (f) {
        return field('data-pick', f[0], f[1], f[2]) + '<input type="hidden" id="aut-pe-' + f[0] + '" value="' + esc(f[2]) + '">';
      }).join('') + '</div>' +
      '<div class="sec">UI SHADING</div><div class="row"><button data-uion="0">THEME DEFAULT</button><button data-uion="1">CUSTOM</button></div>' +
      '<div id="aut-pe-ui">' +
      '<div class="sub">UI SURFACE · PANELS, SIDEBAR, CARDS, MODALS, CHAT</div><div class="row cp-fields">' +
        field('data-uipick', 'surface', 'SURFACE', ui.surface) + '<span class="grad-only">' + field('data-uipick', 'surface2', 'SURFACE 2', ui.surface2) + '</span></div>' +
      '<div class="sub">BUTTON FILL &amp; SHADING</div><div class="row cp-fields">' +
        field('data-uipick', 'button', 'BUTTON', ui.button) + '<span class="grad-only">' + field('data-uipick', 'button2', 'BUTTON 2', ui.button2) + '</span>' +
        field('data-uipick', 'glow', 'GLOW', ui.glow) + field('data-uipick', 'border', 'BORDER', ui.border) + '</div>' +
      '<div class="sub">UI GRADIENT STYLE</div><div class="row"><button data-uistyle="solid">SOLID</button><button data-uistyle="gradient">GRADIENT</button></div>' +
      '<div class="row ui-sl grad-only"><span>ANGLE</span><input type="range" id="aut-pe-angle" min="0" max="359" step="1" aria-label="Gradient angle"><output id="aut-pe-angle-o"></output></div>' +
      '<div class="row dirs grad-only">' + DIRS.map(function (x) { return '<button data-uidir="' + x[1] + '" title="' + x[1] + '°">' + x[0] + '</button>'; }).join('') + '</div>' +
      '<div class="sub">UI TRANSPARENCY</div>' +
      '<div class="row ui-sl"><span>OPACITY</span><input type="range" id="aut-pe-opacity" min="15" max="100" step="1" aria-label="UI opacity"><output id="aut-pe-opacity-o"></output></div>' +
      '<div class="row ui-sl"><span>BLUR</span><input type="range" id="aut-pe-blur" min="0" max="40" step="1" aria-label="Backdrop blur"><output id="aut-pe-blur-o"></output></div>' +
      '<div class="ui-demo" id="aut-pe-demo"><span style="flex:1">PANEL PREVIEW</span><span class="demo-btn" style="padding:5px 9px;border-radius:5px;border:1px solid">BUTTON</span><span class="demo-btn on" style="padding:5px 9px;border-radius:5px;border:1px solid">ACTIVE</span></div>' +
      '<button id="aut-pe-uireset" style="margin-top:6px">↺ RESET UI TO PALETTE</button>' +
      '</div>' +
      '<div style="margin-top:10px"><button id="aut-pe-prev">PREVIEW</button><button id="aut-pe-save">SAVE + USE</button>' + (d.id ? '<button id="aut-pe-new">NEW</button>' : '') + '</div><div id="aut-ta-msg"></div>';
    box.innerHTML = h;
    box.querySelector('[data-x]').onclick = close;
    box.querySelectorAll('[data-preset]').forEach(function (b) { b.onclick = function () { applyPreset(b.getAttribute('data-preset')); openPalette(); }; });
    box.querySelectorAll('[data-apply]').forEach(function (b) { b.onclick = function () { applyCustom(palettes().filter(function (p) { return p.id === b.getAttribute('data-apply'); })[0]); openPalette(); }; });
    box.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { openPalette(palettes().filter(function (p) { return p.id === b.getAttribute('data-edit'); })[0]); }; });
    box.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { deleteCustom(b.getAttribute('data-del')); openPalette(); }; });
    var val = function (id) { return box.querySelector(id).value; };
    var msg = function (t) { box.querySelector('#aut-ta-msg').textContent = t; };
    var form = function () { return { bg1: val('#aut-pe-bg1'), bg2: val('#aut-pe-bg2'), accent: val('#aut-pe-acc'), ui: JSON.parse(JSON.stringify(ui)) }; };
    var live = function () { applyPaletteVars(form()); msg('Previewing — SAVE to keep it.'); };
    var demo = box.querySelector('#aut-pe-demo');
    function paintUI() {
      var wrap = box.querySelector('#aut-pe-ui');
      wrap.classList.toggle('dim', !ui.on); wrap.classList.toggle('solid', ui.style === 'solid');
      box.querySelectorAll('[data-uion]').forEach(function (b) { b.classList.toggle('on', (b.getAttribute('data-uion') === '1') === ui.on); });
      box.querySelectorAll('[data-uistyle]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-uistyle') === ui.style); });
      box.querySelectorAll('[data-uidir]').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-uidir') === ui.angle); });
      box.querySelectorAll('[data-uipick]').forEach(function (b) { var v = ui[b.getAttribute('data-uipick')]; b.querySelector('.sw').style.background = v; b.querySelector('small').textContent = v.toUpperCase(); });
      [['angle', '°'], ['opacity', '%'], ['blur', 'px']].forEach(function (x) { box.querySelector('#aut-pe-' + x[0]).value = ui[x[0]]; box.querySelector('#aut-pe-' + x[0] + '-o').textContent = ui[x[0]] + x[1]; });
      // The little demo panel always shows the custom look, even while THEME DEFAULT is selected.
      var a = ui.opacity / 100, g = ui.style === 'gradient', f = function (c1, c2, al) { return g ? 'linear-gradient(' + ui.angle + 'deg,' + rgba(c1, al) + ',' + rgba(c2, al) + ')' : rgba(c1, al); };
      demo.style.background = f(ui.surface, ui.surface2, a); demo.style.backdropFilter = demo.style.webkitBackdropFilter = 'blur(' + ui.blur + 'px)';
      demo.querySelectorAll('.demo-btn').forEach(function (s, i) { s.style.setProperty('background', f(i ? mixHex(ui.button, ui.glow, 0.25) : ui.button, ui.button2, Math.min(1, a + 0.08)), 'important'); s.style.setProperty('border-color', rgba(ui.border, 0.55), 'important'); s.style.boxShadow = i ? '0 0 14px ' + rgba(ui.glow, 0.55) : 'none'; });
    }
    var touch = function () { ui.on = true; paintUI(); live(); };   // any UI edit switches to CUSTOM
    box.querySelectorAll('[data-uion]').forEach(function (b) { b.onclick = function () { ui.on = b.getAttribute('data-uion') === '1'; paintUI(); live(); }; });
    box.querySelectorAll('[data-uistyle]').forEach(function (b) { b.onclick = function () { ui.style = b.getAttribute('data-uistyle'); touch(); }; });
    box.querySelectorAll('[data-uidir]').forEach(function (b) { b.onclick = function () { ui.angle = +b.getAttribute('data-uidir'); touch(); }; });
    ['angle', 'opacity', 'blur'].forEach(function (k) { box.querySelector('#aut-pe-' + k).oninput = function () { ui[k] = +this.value; touch(); }; });
    box.querySelector('#aut-pe-uireset').onclick = function () { ui = uiDefaults({ bg1: val('#aut-pe-bg1'), bg2: val('#aut-pe-bg2'), accent: val('#aut-pe-acc') }); paintUI(); live(); };
    box.querySelector('#aut-pe-prev').onclick = live;
    box.querySelector('#aut-pe-save').onclick = function () { var p = saveCustom(val('#aut-pe-name'), val('#aut-pe-bg1'), val('#aut-pe-bg2'), val('#aut-pe-acc'), d.id, ui); applyCustom(p); openPalette(p); };
    // Swatch buttons open the in-app picker; dragging previews the whole palette live, CANCEL restores what was showing.
    box.querySelectorAll('[data-pick]').forEach(function (b) {
      b.onclick = function () {
        var f = b.getAttribute('data-pick'), inp = box.querySelector('#aut-pe-' + f), before = activePalette();
        var paint = function (h) { inp.value = h; b.querySelector('.sw').style.background = h; b.querySelector('small').textContent = h.toUpperCase(); };
        openColorPicker(b.textContent.replace(/#.*/, '').trim() + ' COLOUR', inp.value, function (h) { paint(h); applyPaletteVars(form()); },
          function (h) { if (h) { paint(h); msg('Previewing — SAVE to keep it.'); } else { applyPaletteVars(before); } });
      };
    });
    box.querySelectorAll('[data-uipick]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-uipick'), before = activePalette(), was = ui[k], wasOn = ui.on;
        openColorPicker(b.textContent.replace(/#.*/, '').trim() + ' COLOUR', ui[k], function (h) { ui[k] = h; ui.on = true; paintUI(); applyPaletteVars(form()); },
          function (h) { if (h) { ui[k] = h; ui.on = true; paintUI(); live(); } else { ui[k] = was; ui.on = wasOn; paintUI(); applyPaletteVars(before); } });
      };
    });
    paintUI();
    var n = box.querySelector('#aut-pe-new'); if (n) n.onclick = function () { openPalette({ name: 'CUSTOM', bg1: d.bg1, bg2: d.bg2, accent: d.accent, ui: ui }); };
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
