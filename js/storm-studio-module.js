(function(){
  'use strict';
  var _open = false;

  var _css = [
    '#ss-wrap{position:fixed;right:-400px;top:110px;z-index:9350;width:340px;',
      'transition:right .24s cubic-bezier(.22,1,.36,1);pointer-events:none;}',
    '#ss-wrap.ss-open{right:0;}',
    '#ss-panel{background:rgba(255,255,255,.05);',
      'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
      'border:1px solid rgba(0,255,231,.22);border-radius:10px 0 0 10px;',
      'width:100%;height:65vh;max-height:560px;',
      'display:flex;flex-direction:column;pointer-events:all;overflow:hidden;}',
    '#ss-header{display:flex;align-items:center;justify-content:space-between;',
      'padding:7px 10px;border-bottom:1px solid rgba(0,255,231,.15);flex-shrink:0;',
      'font-family:var(--font-d,monospace);font-size:.32rem;letter-spacing:2px;color:rgba(0,255,231,.8);}',
    '#ss-close-btn{font-size:.28rem;cursor:pointer;color:rgba(255,60,60,.7);pointer-events:all;',
      'border:1px solid rgba(255,60,60,.3);padding:2px 7px;border-radius:3px;}',
    '#ss-iframe{flex:1;border:none;width:100%;background:#060810;}',
    '#ss-tab{position:fixed;right:0;top:180px;z-index:9351;',
      'background:rgba(255,255,255,.05);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
      'border:1px solid rgba(0,255,231,.22);border-right:none;border-radius:7px 0 0 7px;',
      'width:20px;min-height:70px;',
      'display:flex;align-items:center;justify-content:center;',
      'cursor:pointer;pointer-events:all;writing-mode:vertical-rl;',
      'font-family:var(--font-d,monospace);font-size:.24rem;letter-spacing:2px;',
      'color:rgba(0,255,231,.65);user-select:none;transition:color .2s,background .2s;}',
    '#ss-tab:hover{color:#00ffe7;background:rgba(0,255,231,.1);}',
  ].join('');

  function _html() {
    return '<div id="ss-wrap">' +
        '<div id="ss-panel">' +
          '<div id="ss-header">' +
            '<span>&#9928; STORM STUDIO</span>' +
            '<span id="ss-close-btn" onclick="window.stormStudioClose()">&#x2715; CLOSE</span>' +
          '</div>' +
          '<iframe id="ss-iframe" src="storm-studio.html" allow="geolocation" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>' +
        '</div>' +
      '</div>' +
      '<div id="ss-tab" onclick="window.stormStudioToggle()">STORM</div>';
  }

  window.stormStudioToggle = function() {
    _open = !_open;
    var w = document.getElementById('ss-wrap');
    if(w) w.classList.toggle('ss-open', _open);
    if(_open) setTimeout(function(){ document.addEventListener('click',_outside,true); },60);
    else document.removeEventListener('click',_outside,true);
  };

  window.stormStudioClose = function() {
    _open = false;
    var w = document.getElementById('ss-wrap');
    if(w) w.classList.remove('ss-open');
    document.removeEventListener('click',_outside,true);
  };

  window.stormStudioOpen = function(city) {
    if(!_open) window.stormStudioToggle();
    var attempts = 0;
    function _try() {
      var fr = document.getElementById('ss-iframe');
      if(!fr) return;
      try {
        var inp = fr.contentDocument && fr.contentDocument.getElementById('loc-input');
        if(inp){ inp.value = city||''; var btn=fr.contentDocument.getElementById('loc-search-btn'); if(btn)btn.click(); return; }
      } catch(e){}
      if(++attempts<20) setTimeout(_try,300);
    }
    setTimeout(_try,500);
  };

  function _outside(e) {
    var w=document.getElementById('ss-wrap'), t=document.getElementById('ss-tab');
    if(w&&!w.contains(e.target)&&(!t||!t.contains(e.target))) window.stormStudioClose();
  }

  function _init() {
    var s=document.createElement('style'); s.textContent=_css; document.head.appendChild(s);
    var tmp=document.createElement('div'); tmp.innerHTML=_html();
    while(tmp.firstChild) document.body.appendChild(tmp.firstChild);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_init);
  else _init();
})();
