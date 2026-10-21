// autumn-admin-agents.js — ⚙ ADMIN ▸ AGENTS tab (admin side of the agents module), ported from Autumn iOS build 163
// (Admin/AdminDrawerView.swift `.agents` → Agents/AshAgents.swift AgentsConsoleView + AshAgentsModel).
// The public AGENTS CHAT panel (js/autumn-agents-chat.js) stays as-is for every user. This tab is the admin view of the same
// "one brain, two windows" team: it shares the same handler (AutumnAgentsChat.handle), the same team state (autumn_agents_team_v1)
// and the same history (autumn_agents_chat_v1), and adds the admin-only pieces iOS has:
//   • Shell 64 status: reads ashtree/shell64/state.ash (fallback Training/shell64/shell64.state.ash) and scripts/ash/agents.ash from the
//     private DART-Skyboard/leatr-ash repo with the admin's own GitHub sign-in token (Contents API) — same paths as iOS.
//   • Mode readout: DIRECT (admin token + LEATR / Sentient Journal agents API) vs RELAY (read-only Shell 64 door in the Apps Script).
//   • Team roster (lead / members / queue / round / chief emotion / project), RESET TEAM, CLEAR LOG, RELOAD SHELL 64, contract viewer.
// Rendered only through window._admTab('agents'), which is already gated by _autAdminEnabled() (dartsolarpunk + admin toggle).
(function (global) {
  'use strict';
  var KEY = 'autumn_agents_chat_v1', TEAM_KEY = 'autumn_agents_team_v1';
  var STATE_PATHS = ['ashtree/shell64/state.ash', 'Training/shell64/shell64.state.ash'], CONTRACT = 'scripts/ash/agents.ash';
  var cache = { recs: null, contract: null, statePath: null, status: 'Shell 64: not loaded' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function jget(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }
  function token() { return (global._ghAuth || {}).token || ''; }
  function b64(s) { try { return decodeURIComponent(escape(atob(String(s).replace(/\s/g, '')))); } catch (e) { return ''; } }
  function readRepo(path) {
    var t = token(); if (!t) return Promise.resolve(null);
    return fetch('https://api.github.com/repos/DART-Skyboard/leatr-ash/contents/' + path + '?ref=main', { headers: { Authorization: 'token ' + t, Accept: 'application/vnd.github.v3+json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return null;
        if (j.content) return b64(j.content);
        if (j.download_url) return fetch(j.download_url, { headers: { Authorization: 'token ' + t } }).then(function (r) { return r.ok ? r.text() : null; });
        return null;
      }).catch(function () { return null; });
  }
  // Same record shape iOS AshShell64State.parse counts: one "k=… bl=… …" record per line.
  function countRecs(text) { return String(text || '').split('\n').filter(function (l) { return /\bk=\S+/.test(l); }).length; }
  function loadShell64(force) {
    if (cache.recs != null && !force) return Promise.resolve();
    if (!token()) { cache.status = 'No admin GitHub token — agents answer through the read-only relay.'; return Promise.resolve(); }
    cache.status = 'Shell 64: loading…';
    var i = 0;
    function next() {
      if (i >= STATE_PATHS.length) { cache.recs = null; cache.status = 'Shell 64 unavailable (token cannot read leatr-ash, or offline)'; return Promise.resolve(); }
      var p = STATE_PATHS[i++];
      return readRepo(p).then(function (t) { if (t) { cache.recs = countRecs(t); cache.statePath = p; cache.status = 'Shell 64: ' + cache.recs + ' records (' + p + ')'; } else return next(); });
    }
    return Promise.all([next(), readRepo(CONTRACT).then(function (c) { cache.contract = c; })]);
  }
  function mode() {
    var api = global.AutumnAgents;
    if (api && (api.team || api.run) && token()) return 'DIRECT · LEATR / Sentient Journal agents over Shell 64 (admin token)';
    if (global.AUTUMN_GAS_URL) return 'RELAY · read-only Shell 64 door (Apps Script shell64team) — LEATR / Sentient Journal not loaded';
    return 'OFFLINE · agents not loaded';
  }
  function roster(team) {
    if (!team) return '<div style="opacity:.5">No team yet — give a goal below.</div>';
    var h = '<div>PROJECT <b>' + esc(team.project || '—') + '</b> · ROUND ' + esc(team.round || 0) + (team.complete ? ' · COMPLETE' : '') + '</div>' +
      '<div>GOAL ' + esc(team.goal || '—') + '</div><div>LEAD ' + esc((team.lead && (team.lead.name || team.lead.id)) || (typeof team.lead === 'string' ? team.lead : 'Autumn')) + ' · CHIEF FEELS ' + esc(team.chiefEmotion || 'neutral') + '</div>';
    var m = team.members || [];
    h += '<div style="margin-top:4px;opacity:.6">MEMBERS (' + m.length + ')</div>';
    m.forEach(function (x) {
      if (typeof x === 'string') { h += '<div>• ' + esc(x) + '</div>'; return; }
      h += '<div>• ' + esc(x.name || x.id || '?') + (x.role ? ' — ' + esc(x.role) : '') + (x.topic || x.focus ? ' · ' + esc(x.topic || x.focus) : '') + (x.status ? ' [' + esc(x.status) + ']' : '') + '</div>';
    });
    var q = team.queue || [];
    if (q.length) h += '<div style="margin-top:4px;opacity:.6">QUEUE (' + q.length + ')</div>' + q.slice(0, 8).map(function (x) { return '<div>· ' + esc(typeof x === 'string' ? x : (x.task || x.goal || x.id || JSON.stringify(x))) + '</div>'; }).join('');
    if (team.updated) h += '<div style="opacity:.45;margin-top:4px">updated ' + esc(team.updated) + '</div>';
    return h;
  }

  global._admRenderAgents = function (host) {
    if (!host || (global._autAdminEnabled && !global._autAdminEnabled())) return;
    host.innerHTML = '';
    var P = document.createElement('div'); P.id = 'adm-agents-panel';
    P.style.cssText = 'display:flex;flex-direction:column;min-height:0;flex:1;font-family:var(--font-d,Orbitron,monospace);color:var(--text,#c8e6f0);font-size:10px;letter-spacing:.5px';
    var box = 'border:1px solid color-mix(in srgb, var(--cyan,#00e5ff) 16%, transparent);border-radius:6px;padding:8px;margin:6px 10px 0';
    var btn = 'font-family:inherit;font-size:9px;letter-spacing:1.2px;padding:4px 8px;border-radius:4px;border:1px solid color-mix(in srgb, var(--cyan,#00e5ff) 35%, transparent);background:transparent;color:var(--cyan,#00e5ff);cursor:pointer;margin:2px';
    P.innerHTML =
      '<div style="padding:8px 10px 0;color:var(--cyan,#00e5ff);font-size:11px;letter-spacing:1.5px">AGENTS · Autumn (Team Lead) / Assistant Lead / Team</div>' +
      '<div style="' + box + '"><div style="font-size:8px;letter-spacing:2px;opacity:.5">MODE</div><div id="adm-ag-mode"></div><div id="adm-ag-status" style="opacity:.7;margin-top:3px"></div>' +
      '<div style="margin-top:4px"><button data-a="reload" style="' + btn + '">↻ RELOAD SHELL 64</button><button data-a="contract" style="' + btn + '">⌘ CONTRACT</button><button data-a="reset" style="' + btn + ';color:#ffb347;border-color:#ffb34766">⟲ RESET TEAM</button><button data-a="clear" style="' + btn + ';color:#ff4466;border-color:#ff446666">✕ CLEAR LOG</button></div>' +
      '<pre id="adm-ag-contract" style="display:none;white-space:pre-wrap;max-height:140px;overflow:auto;margin:6px 0 0;font-size:9px;opacity:.75"></pre></div>' +
      '<div style="' + box + '"><div style="font-size:8px;letter-spacing:2px;opacity:.5">TEAM</div><div id="adm-ag-team"></div></div>' +
      '<div id="adm-ag-log" style="flex:1;min-height:120px;overflow:auto;padding:8px 10px"></div>' +
      '<form id="adm-ag-form" style="display:flex;gap:6px;padding:8px 10px;border-top:1px solid color-mix(in srgb, var(--cyan,#00e5ff) 16%, transparent)">' +
      '<input id="adm-ag-in" autocomplete="off" placeholder="e.g. analyze python grammar" style="flex:1;min-width:0;background:color-mix(in srgb, var(--cyan,#00e5ff) 5%, transparent);border:1px solid color-mix(in srgb, var(--cyan,#00e5ff) 22%, transparent);border-radius:4px;color:var(--text,#fff);padding:6px;font:inherit">' +
      '<button style="' + btn + '">SEND</button></form>';
    host.appendChild(P);
    var $ = function (s) { return P.querySelector(s); }, log = $('#adm-ag-log');
    function paintStatus() { $('#adm-ag-mode').textContent = mode(); $('#adm-ag-status').textContent = cache.status; $('#adm-ag-team').innerHTML = roster(jget(TEAM_KEY, null)); }
    function bubble(m) {
      var d = document.createElement('div');
      d.style.cssText = 'margin:0 0 6px;padding:6px 8px;border-radius:8px;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,Menlo,monospace;font-size:11px;' +
        (m.role === 'user' ? 'background:color-mix(in srgb, var(--cyan,#00e5ff) 12%, transparent)' : 'background:rgba(255,255,255,.06);color:#9cdcfe');
      d.innerHTML = esc(m.text) + (m.program ? '<details style="margin-top:4px;opacity:.75"><summary style="cursor:pointer">Ash program</summary><pre style="white-space:pre-wrap;margin:4px 0 0">' + esc(m.program) + '</pre></details>' : '');
      log.appendChild(d); log.scrollTop = log.scrollHeight;
    }
    function paintLog() { log.innerHTML = ''; var msgs = jget(KEY, []); if (!msgs.length) bubble({ role: 'agent', text: 'Autumn here, team lead. Give me a goal; my assistant lead and team split it over Shell 64. Try "create another team member to triangulate".' }); msgs.forEach(bubble); }
    function save(m) { var a = jget(KEY, []); a.push(m); try { localStorage.setItem(KEY, JSON.stringify(a.slice(-60))); } catch (e) {} }
    P.querySelectorAll('[data-a]').forEach(function (b) {
      b.onclick = function () {
        var a = b.getAttribute('data-a');
        if (a === 'reload') { cache.recs = null; paintStatus(); loadShell64(true).then(paintStatus); }
        else if (a === 'contract') { var c = $('#adm-ag-contract'); var show = c.style.display === 'none'; c.style.display = show ? 'block' : 'none'; c.textContent = cache.contract || (token() ? 'scripts/ash/agents.ash not loaded yet.' : 'Needs the admin GitHub token.'); }
        else if (a === 'reset') { if (confirm('Reset the agents team state on this browser?')) { try { localStorage.removeItem(TEAM_KEY); } catch (e) {} paintStatus(); } }
        else if (a === 'clear') { if (confirm('Clear the shared agents chat log on this browser?')) { try { localStorage.removeItem(KEY); } catch (e) {} paintLog(); } }
      };
    });
    $('#adm-ag-form').onsubmit = function (e) {
      e.preventDefault();
      var inp = $('#adm-ag-in'), t = inp.value.trim(); if (!t) return; inp.value = '';
      var u = { role: 'user', text: t }; save(u); bubble(u);
      var api = global.AutumnAgentsChat;
      if (!api || !api.handle) { var x = { role: 'agent', text: 'Agents are not loaded yet.' }; save(x); bubble(x); return; }
      api.handle(t).then(function (r) { var m = { role: 'agent', text: r.text, program: r.program }; save(m); bubble(m); paintStatus(); });
    };
    paintLog(); paintStatus(); loadShell64(false).then(paintStatus);
  };
})(window);
