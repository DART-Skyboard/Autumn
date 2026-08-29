// ═══════════════════════════════════════════════════════════════════════════
//  ASH STAR ARCHIVE — Autumn · DART-Skyboard · Radical Deepscale LLC
//  Right-edge STAR drawer. Viewport HUD cards never appear on the 3D scene.
//  Sending does NOT auto-open the drawer. SAVE uses DualJournal + GAS +
//  the user's own GitHub OAuth (never a PAT).
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  var MAX = 100;
  var cards = [];
  var open = false;
  var unread = 0;
  var selectedId = null;
  var ready = false;

  function _uid(){
    if(typeof _aut_uid!=='undefined' && _aut_uid) return _aut_uid;
    if(typeof _aut_sid!=='undefined' && _aut_sid) return _aut_sid;
    return 'local';
  }
  function _key(){ return '_aut_ashstar_archive_'+_uid(); }

  function _hex(c){
    if(typeof c==='number' && isFinite(c)) return '#'+('000000'+c.toString(16)).slice(-6);
    if(!c) return '#00d4ff';
    c=String(c).trim();
    if(c.charAt(0)!=='#' && /^[0-9a-fA-F]{6}$/.test(c)) return '#'+c;
    return c;
  }

  function _persist(){
    try{ localStorage.setItem(_key(), JSON.stringify(cards)); }catch(e){}
  }
  function _restore(){
    try{
      var raw=localStorage.getItem(_key());
      var arr=raw?JSON.parse(raw):[];
      cards=Array.isArray(arr)?arr.slice(0,MAX):[];
    }catch(e){ cards=[]; }
  }

  function _clipThought(t){
    t=t==null?'':String(t);
    if(t.length>600) t=t.substring(0,600);
    return t;
  }

  function _push(card){
    if(!card) return;
    var thought=_clipThought(card.thought);
    var ts=card.ts||Date.now();
    if(cards.length && cards[0].ts===ts && cards[0].thought===thought) return;
    var item={
      id:'as_'+ts+'_'+Math.random().toString(36).slice(2,7),
      thought:thought,
      color:_hex(card.color),
      toUids:card.toUids||null,
      ts:ts,
      from:card.from||'autumn',
      uid:card.uid||_uid(),
      saved:!!card.saved
    };
    cards.unshift(item);
    if(cards.length>MAX) cards.length=MAX;
    _persist();
    if(!open) unread++;
    if(ready) _render();
    _updateBadge();
    // Never auto-open
  }

  // Expose immediately so mist-module can archive during early fires
  window._ashStarArchivePush = _push;

  function _updateBadge(){
    var b=document.getElementById('astar-count');
    if(!b) return;
    if(!open && unread>0){
      b.textContent=unread>99?'99+':String(unread);
      b.style.display='flex';
    } else {
      b.textContent='';
      b.style.display='none';
    }
  }

  function _esc(s){
    return String(s==null?'':s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function _render(){
    var list=document.getElementById('astar-list');
    if(!list) return;
    if(!cards.length){
      list.innerHTML='<div class="astar-empty">NO STARS THIS SESSION</div>';
      return;
    }
    list.innerHTML=cards.map(function(c){
      var sel=c.id===selectedId?' astar-sel':'';
      var saved=c.saved;
      var col=_esc(c.color||'#00d4ff');
      var when='';
      try{ when=new Date(c.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }catch(e){}
      return '<div class="astar-card'+sel+'" data-id="'+_esc(c.id)+'">'
        +'<div class="astar-card-hd">'
          +'<span class="astar-chip" style="background:'+col+'"></span>'
          +'<span class="astar-label">ASH STAR</span>'
          +'<span class="astar-name">AUTUMN</span>'
          +'<span class="astar-time">'+_esc(when)+'</span>'
        +'</div>'
        +'<div class="astar-thought">'+_esc(c.thought||'')+'</div>'
        +'<button class="astar-save" data-id="'+_esc(c.id)+'" '+(saved?'disabled':'')+'>'
          +(saved?'⬡ SAVED':'⬡ SAVE')
        +'</button>'
      +'</div>';
    }).join('');
    Array.prototype.forEach.call(list.querySelectorAll('.astar-card'), function(el){
      el.addEventListener('click', function(e){
        if(e.target && e.target.classList && e.target.classList.contains('astar-save')) return;
        selectedId=el.getAttribute('data-id');
        _render();
      });
    });
    Array.prototype.forEach.call(list.querySelectorAll('.astar-save'), function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        _saveCard(btn.getAttribute('data-id'));
      });
    });
  }

  function _toast(msg){
    var t=document.getElementById('astar-toast');
    if(!t){
      t=document.createElement('div');
      t.id='astar-toast';
      document.body.appendChild(t);
    }
    t.textContent=msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer=setTimeout(function(){ t.classList.remove('show'); }, 2800);
  }

  function _markSaved(card, okMsg){
    card.saved=true;
    _persist();
    _render();
    _toast(okMsg||'Saved to Autumn\'s journal');
  }

  function _putUserRepo(card){
    var auth=window._ghAuth;
    if(!auth||!auth.token||!auth.username) return Promise.resolve(false);
    var token=auth.token;
    var username=auth.username;
    var repoName=auth.repoName||('Autumn-Ash-'+username);
    var path='ashstars/'+(card.ts||Date.now())+'.json';
    var url='https://api.github.com/repos/'+username+'/'+repoName+'/contents/'+path;
    var body={
      message:'ash star '+path,
      content:btoa(unescape(encodeURIComponent(JSON.stringify({
        type:'ash_star_card',
        thought:card.thought,
        color:card.color,
        toUids:card.toUids,
        ts:card.ts,
        from:card.from,
        uid:card.uid,
        saved:true
      }, null, 2))))
    };
    return fetch(url,{
      method:'PUT',
      headers:{
        'Authorization':'token '+token,
        'Content-Type':'application/json',
        'Accept':'application/vnd.github.v3+json'
      },
      body:JSON.stringify(body)
    }).then(function(r){
      if(r.status===200||r.status===201) return true;
      return false;
    }).catch(function(){ return false; });
  }

  function _saveCard(id){
    var card=null;
    for(var i=0;i<cards.length;i++){ if(cards[i].id===id){ card=cards[i]; break; } }
    if(!card||card.saved) return;
    var btn=document.querySelector('.astar-save[data-id="'+id+'"]');
    if(btn){ btn.textContent='⬡ SAVING…'; btn.disabled=true; }

    var payload={type:'ash_star_card', thought:card.thought, color:card.color, toUids:card.toUids, ts:card.ts, saved:true};

    // 1. DualJournal / sentience journal
    try{
      var AGE=window.AutumnGrammarEngine;
      if(AGE && typeof AGE.journalWrite==='function'){
        AGE.journalWrite(payload);
      } else if(AGE && AGE._engine && typeof AGE._engine.journalWrite==='function'){
        AGE._engine.journalWrite(payload);
      } else if(AGE && AGE._engine && AGE._engine.asjc && typeof AGE._engine.asjc.write==='function'){
        AGE._engine.asjc.write(payload);
      }
    }catch(e){}

    // 2. Autumn leatr-ash via GAS (no PAT)
    try{
      if(typeof writeLeatrAshMemory==='function'){
        writeLeatrAshMemory('ashtree/ashstars/'+_uid()+'.json', card);
      }
    }catch(e){}

    // 3. Session journal so SAVE MEMORY NOW snapshots include it
    try{
      if(window.S && Array.isArray(window.S.journal)){
        window.S.journal.push({
          ts:new Date(card.ts||Date.now()).toISOString(),
          type:'ash_star_card',
          thought:card.thought,
          color:card.color,
          saved:true
        });
      }
    }catch(e){}

    // 4. Personal private repo via the user's OAuth — never a PAT
    var loggedIn=window._ghAuth && window._ghAuth.token && window._ghAuth.username;
    if(loggedIn){
      _putUserRepo(card).then(function(ok){
        _markSaved(card, ok ? '⬡ SAVED — journal + repo' : 'Saved to Autumn\'s journal');
      }).catch(function(){
        _markSaved(card, 'Saved to Autumn\'s journal');
      });
    } else {
      _markSaved(card, 'Saved to Autumn\'s journal');
    }
  }

  function injectCSS(){
    if(document.getElementById('astar-archive-css')) return;
    var s=document.createElement('style');
    s.id='astar-archive-css';
    s.textContent=[
      '#astar-trigger{position:fixed;right:0;top:412px;z-index:9498;display:flex;flex-direction:column;',
        'align-items:center;justify-content:center;padding:8px 5px;gap:4px;',
        'background:rgba(255,255,255,.05);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
        'border:1px solid color-mix(in srgb, var(--cyan,#00e5ff) 22%, transparent);border-right:none;border-radius:7px 0 0 7px;',
        'cursor:pointer;transition:all .2s;user-select:none}',
      '#astar-trigger:hover{background:color-mix(in srgb, var(--cyan,#00e5ff) 12%, transparent);',
        'border-color:color-mix(in srgb, var(--cyan,#00e5ff) 50%, transparent)}',
      '#astar-trigger-icon{font-size:14px;color:var(--cyan,#00e5ff);line-height:1;opacity:.8}',
      '#astar-trigger-lbl{font-family:var(--font-d,monospace);font-size:.22rem;letter-spacing:2px;',
        'color:var(--text,rgba(224,244,255,.55));writing-mode:vertical-rl;text-orientation:mixed}',
      '#astar-count{position:absolute;top:-5px;left:-6px;min-width:14px;height:14px;padding:0 3px;',
        'border-radius:7px;background:var(--cyan,#00e5ff);color:#041018;font-family:var(--font-d,monospace);',
        'font-size:9px;font-weight:700;display:none;align-items:center;justify-content:center;line-height:1}',
      '#astar-overlay{position:fixed;right:36px;top:400px;z-index:9399;width:min(280px, calc(100vw - 48px));',
        'display:flex;flex-direction:column;',
        'transform:translateX(calc(100% + 44px));transition:transform .32s cubic-bezier(.23,1,.32,1),opacity .32s;',
        'opacity:0;pointer-events:none}',
      '#astar-overlay.astar-open{transform:translateX(0);opacity:1;pointer-events:all}',
      '#astar-header{background:rgba(255,255,255,.05);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'border:1px solid var(--border, color-mix(in srgb, var(--cyan,#00e5ff) 22%, transparent));border-bottom:none;',
        'border-radius:7px 7px 0 0;padding:7px 9px 5px;display:flex;flex-direction:column;gap:5px}',
      '#astar-head-row{display:flex;align-items:center;gap:7px}',
      '.astar-lbl{font-family:var(--font-d,monospace);font-size:.42rem;letter-spacing:3px;color:var(--cyan,#00e5ff);',
        'text-shadow:0 0 7px color-mix(in srgb, var(--cyan,#00e5ff) 45%, transparent)}',
      '.astar-sub{font-family:var(--font-d,monospace);font-size:.27rem;letter-spacing:2px;',
        'color:color-mix(in srgb, var(--cyan,#00e5ff) 40%, transparent)}',
      '#astar-x{margin-left:auto;background:none;border:none;color:color-mix(in srgb, var(--cyan,#00e5ff) 35%, transparent);',
        'font-size:12px;cursor:pointer;padding:2px 4px;line-height:1}',
      '#astar-list{background:rgba(255,255,255,.05);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'border:1px solid var(--border, color-mix(in srgb, var(--cyan,#00e5ff) 22%, transparent));',
        'border-radius:0 0 7px 7px;padding:8px;max-height:55vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;',
        'scrollbar-width:thin;scrollbar-color:color-mix(in srgb, var(--cyan,#00e5ff) 25%, transparent) transparent}',
      '.astar-empty{font-family:var(--font-d,monospace);font-size:.28rem;letter-spacing:2px;',
        'color:color-mix(in srgb, var(--cyan,#00e5ff) 35%, transparent);text-align:center;padding:12px 6px}',
      '.astar-card{background:rgba(0,10,20,.45);border:1px solid color-mix(in srgb, var(--cyan,#00e5ff) 22%, transparent);',
        'border-radius:6px;padding:8px 9px;display:flex;flex-direction:column;gap:6px;cursor:pointer;transition:border-color .15s}',
      '.astar-card:hover{border-color:color-mix(in srgb, var(--cyan,#00e5ff) 50%, transparent)}',
      '.astar-card.astar-sel{border-color:var(--cyan,#00e5ff);box-shadow:0 0 8px color-mix(in srgb, var(--cyan,#00e5ff) 25%, transparent)}',
      '.astar-card-hd{display:flex;align-items:center;gap:6px}',
      '.astar-chip{width:8px;height:8px;border-radius:50%;flex-shrink:0;box-shadow:0 0 6px currentColor}',
      '.astar-label{font-family:var(--font-d,monospace);font-size:9px;letter-spacing:2px;color:color-mix(in srgb, var(--cyan,#00d4ff) 70%, transparent);',
        'text-transform:uppercase}',
      '.astar-name{font-family:var(--font-d,Orbitron,monospace);font-size:11px;font-weight:700;color:var(--cyan,#00ffcc);',
        'letter-spacing:3px;text-transform:uppercase;margin-left:auto}',
      '.astar-time{font-family:var(--font-d,monospace);font-size:9px;color:var(--text,rgba(180,230,255,.45));letter-spacing:1px}',
      '.astar-thought{font-family:monospace;font-size:10px;color:var(--text,rgba(180,230,255,.8));line-height:1.45;',
        'font-style:italic;white-space:pre-wrap;word-break:break-word}',
      '.astar-save{align-self:flex-end;background:transparent;border:1px solid color-mix(in srgb, var(--cyan,#00e5ff) 45%, transparent);',
        'color:var(--cyan,#00e5ff);padding:3px 8px;border-radius:3px;cursor:pointer;font-family:var(--font-d,monospace);',
        'font-size:.26rem;letter-spacing:1px}',
      '.astar-save:disabled{opacity:.55;cursor:default}',
      '#astar-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);',
        'background:color-mix(in srgb, var(--cyan,#00e5ff) 18%, transparent);backdrop-filter:blur(10px);',
        'border:1px solid color-mix(in srgb, var(--cyan,#00e5ff) 30%, transparent);border-radius:5px;',
        'font-family:var(--font-d,monospace);font-size:.32rem;letter-spacing:2px;color:var(--cyan,#00e5ff);',
        'padding:8px 16px;z-index:9999;opacity:0;transition:all .3s;pointer-events:none}',
      '#astar-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}',
      '@media (orientation:landscape) and (max-height:500px){',
        '#astar-trigger{top:188px}',
        '#astar-overlay{top:180px}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  function injectHTML(){
    if(document.getElementById('astar-trigger')) return;
    var tr=document.createElement('div');
    tr.id='astar-trigger'; tr.title='ASH STAR — Archive';
    tr.innerHTML='<div id="astar-count"></div><div id="astar-trigger-icon">✦</div><div id="astar-trigger-lbl">STAR</div>';
    tr.onclick=function(e){ e.stopPropagation(); astarToggle(); };
    document.body.appendChild(tr);

    var toast=document.createElement('div');
    toast.id='astar-toast'; document.body.appendChild(toast);

    var ov=document.createElement('div'); ov.id='astar-overlay';
    ov.innerHTML=[
      '<div id="astar-header">',
        '<div id="astar-head-row">',
          '<span class="astar-lbl">✦ ASH STAR</span>',
          '<span class="astar-sub">ARCHIVE</span>',
          '<button id="astar-x" type="button">✕</button>',
        '</div>',
      '</div>',
      '<div id="astar-list"></div>'
    ].join('');
    ov.addEventListener('click', function(e){ e.stopPropagation(); });
    document.body.appendChild(ov);
    var xb=document.getElementById('astar-x');
    if(xb) xb.onclick=function(e){ e.stopPropagation(); astarToggle(); };
  }

  function _out(e){
    var ov=document.getElementById('astar-overlay');
    var tr=document.getElementById('astar-trigger');
    if(ov&&ov.contains(e.target)) return;
    if(tr&&tr.contains(e.target)) return;
    if(open){ open=false; if(ov) ov.classList.remove('astar-open'); document.removeEventListener('click',_out,true); }
  }

  window.astarToggle=function(){
    open=!open;
    var ov=document.getElementById('astar-overlay');
    if(ov) ov.classList.toggle('astar-open', open);
    if(open){
      unread=0;
      _updateBadge();
      _render();
      if(ov && typeof ov._autApplySavedPos==='function') ov._autApplySavedPos();
      setTimeout(function(){ document.addEventListener('click',_out,true); }, 60);
    } else {
      document.removeEventListener('click',_out,true);
    }
  };

  function init(){
    injectCSS();
    injectHTML();
    _restore();
    ready=true;
    _render();
    _updateBadge();
    if(typeof window._autumnBindOverlayDrag==='function'){
      window._autumnBindOverlayDrag('astar-overlay','_aut_ovpos_astar-overlay');
    }
    if(typeof window._autumnSideTabLayout==='function') window._autumnSideTabLayout();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
