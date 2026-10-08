// autumn-agents-chat.js — Autumn chat front end for the LEATR project agents (Chief / AssistantChiefs / Managers).
// Purely additive: waits for window.AutumnAgents (provided by leatr-ash sentience-journal.js when an admin token exists).
// No outside AI: every reply is a deterministic LEATR cascade over Shell 64 + Ash Canvas.
// Off switch: window.ASH_AGENTS_CHAT = false (set before this script loads).
(function (global) {
  'use strict';
  if (typeof document === 'undefined' || global.ASH_AGENTS_CHAT === false) return;
  var KEY = 'autumn_agents_chat_v1';

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function save(m) { try { localStorage.setItem(KEY, JSON.stringify(m.slice(-60))); } catch (e) {} }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function summarize(r) {
    var p = r.project, lines = [];
    lines.push('Project ' + p.project + ' — Chief feels ' + (p.chief && p.chief.emotion || 'neutral') + '.');
    (p.tasks || []).forEach(function (t) {
      lines.push('• ' + t.id + ' [' + t.tool + '/' + t.shell + '] — ' + (t.result && t.result.hits || 0) + ' Shell 64 hits');
    });
    return lines.join('\n');
  }

  function mount() {
    if (document.getElementById('autumn-agents-chat')) return;
    var host = document.createElement('div'); host.id = 'autumn-agents-chat';
    host.style.cssText = 'position:fixed;right:0;bottom:150px;z-index:9390;font:12px/1.45 ui-monospace,Menlo,monospace;color:#cfe;';
    host.innerHTML =
      '<button id="aac-tab" aria-label="Agents chat" style="background:rgba(10,20,30,.88);color:#00ffcc;border:1px solid #00ffcc55;border-right:none;border-radius:7px 0 0 7px;padding:8px 6px;cursor:pointer;writing-mode:vertical-rl">◈ AGENTS CHAT</button>' +
      '<div id="aac-panel" hidden style="position:absolute;right:34px;bottom:0;width:min(380px,88vw);height:min(460px,70vh);display:flex;flex-direction:column;background:rgba(8,14,22,.97);border:1px solid #00ffcc55;border-radius:10px">' +
      '<div style="padding:8px 10px;color:#00ffcc;border-bottom:1px solid #00ffcc22">Autumn · team lead — give a goal, the team runs it</div>' +
      '<div id="aac-log" style="flex:1;overflow:auto;padding:8px 10px"></div>' +
      '<form id="aac-form" style="display:flex;gap:6px;padding:8px;border-top:1px solid #00ffcc22">' +
      '<input id="aac-in" autocomplete="off" placeholder="e.g. analyze python grammar for the english parser" style="flex:1;min-width:0;background:#0d1117;color:#fff;border:1px solid #30363d;border-radius:6px;padding:6px;font:inherit">' +
      '<button style="background:#00ffcc22;color:#00ffcc;border:1px solid #00ffcc66;border-radius:6px;padding:4px 10px;cursor:pointer">SEND</button></form></div>';
    document.body.appendChild(host);

    var q = function (s) { return host.querySelector(s); };
    var log = q('#aac-log'), msgs = load();

    function bubble(m) {
      var d = document.createElement('div');
      d.style.cssText = 'margin:0 0 8px;padding:6px 8px;border-radius:8px;white-space:pre-wrap;word-break:break-word;' +
        (m.role === 'user' ? 'background:#0d2a2a;margin-left:24px' : 'background:#101826;margin-right:24px;color:#9cdcfe');
      d.innerHTML = esc(m.text) + (m.program ? '<details style="margin-top:4px;color:#8aa"><summary style="cursor:pointer">Ash program</summary><pre style="white-space:pre-wrap;margin:4px 0 0">' + esc(m.program) + '</pre></details>' : '');
      log.appendChild(d); log.scrollTop = log.scrollHeight;
    }
    function add(m) { msgs.push(m); save(msgs); bubble(m); }

    msgs.forEach(bubble);
    if (!msgs.length) bubble({ role: 'agent', text: 'Autumn here, team lead. Give me a goal and my assistant lead and team will split it over Shell 64. Try: "create another team member to triangulate" or "add a team member to study python".' });

    q('#aac-tab').onclick = function () { var p = q('#aac-panel'); p.hidden = !p.hidden; if (!p.hidden) q('#aac-in').focus(); };
    q('#aac-form').onsubmit = function (e) {
      e.preventDefault();
      var inp = q('#aac-in'), text = inp.value.trim(); if (!text) return;
      inp.value = ''; add({ role: 'user', text: text });
      var api = global.AutumnAgents;
      if (!api || !api.run) { add({ role: 'agent', text: 'Agents are not loaded yet.' }); return; }
      if (api.team) { api.team(text).then(function (r) {
        if (!r) add({ role: 'agent', text: 'Shell 64 is not available yet (needs an admin token and a first journal write).' });
        else add({ role: 'agent', text: r.text, program: r.program });
      }).catch(function (err) { add({ role: 'agent', text: 'Error: ' + err }); }); return; }
      api.run(text).then(function (r) {
        if (!r) add({ role: 'agent', text: 'Shell 64 is not available yet (needs an admin token and a first journal write).' });
        else add({ role: 'agent', text: summarize(r), program: r.program });
      }).catch(function (err) { add({ role: 'agent', text: 'Error: ' + err }); });
    };
  }

  // admin-only (same _ghAuth.token gate as the journal listener). Wait (up to ~60s) for the journal script to expose AutumnAgents, then mount; otherwise do nothing.
  var tries = 0, iv = setInterval(function () {
    if (global.AutumnAgents && global.AutumnAgents.run && global._ghAuth && global._ghAuth.token) { clearInterval(iv); try { mount(); } catch (e) {} }
    else if (++tries > 60) clearInterval(iv);
  }, 1000);
})(window);
