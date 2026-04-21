// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  MIST MODULE â€” Autumn frosted-glass overlay maze
//  Lead Edge Ash Tree Reflex
//  On solve â†’ drives BRPN buoyancy network (pulseShells/applyOrbEmotion/etc)
//  Multi-user â†’ writes to ashtree/mist/{uid}.json via writeLeatrAshMemory
//              â†’ polls every 12s for other users' mist events â†’ reacts
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
(function() {
  'use strict';

  var MIST = {
    open: false,
    difficulty: 1,
    mazes: [null,null,null],
    solvedCount: 0,
    dragging: false,
    dragPos: null,
    dragPath: [],
    activeMaze: 0,
    sphereTarget: null,
    sphereActual: null,
    sphereAnimId: null,
    lastRemoteTs: {}   // uid â†’ last seen ts to debounce duplicate fires
  };

  var DIFF = { 1:{w:5,h:5}, 2:{w:9,h:9}, 3:{w:13,h:13} };

  // Slot â†’ BRPN network profile
  var SLOT_PROFILE = [
    { label: 'STAR',  icon: 'â—ˆ', icon2: 'â˜…', pulse: 3.2, emotion: 'ELEVATED', shellBoost: [0.08, 0, 0.02], speed: 1.4 },
    { label: 'HEART', icon: 'â—ˆ', icon2: 'â™¥', pulse: 2.8, emotion: 'WARM',     shellBoost: [0, 0.06, 0.04], speed: 1.2 },
    { label: 'MIST',  icon: 'â—ˆ', icon2: 'â—†', pulse: 4.5, emotion: 'NEUTRAL',  shellBoost: [0.05, 0.05, 0.05], speed: 1.8 }
  ];

  // â”€â”€ LEAD EDGE maze generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function generateMaze(w, h) {
    var grid = [];
    for(var y=0; y<h; y++) {
      grid[y] = [];
      for(var x=0; x<w; x++) {
        grid[y][x] = { n: 1, s: 1, e: 1, w: 1, v1: false };
      }
    }

    // Recursive Backtracker for structure
    function carve(x, y) {
      grid[y][x].v1 = true;
      var dirs = [['n',0,-1],['s',0,1],['e',1,0],['w',-1,0]];
      dirs.sort(function(){ return Math.random() - .5; });
      dirs.forEach(function(d) {
        var nx = x + d[1], ny = y + d[2];
        if(nx >= 0 && nx < w && ny >= 0 && ny < h && !grid[ny][nx].v1) {
          grid[y][x][d[0]] = 0;
          grid[ny][nx][{n:'s',s:'n',e:'w',w:'e'}[d[0]]] = 0;
          carve(nx, ny);
        }
      });
    }
    carve(0, 0);

    // Opening and Exit Rules enforcement
    var pickSide = function() { return ['n','s','e','w'][Math.floor(Math.random()*4)]; };
    var posOnSide = function(s) { return (s==='n'||s==='s') ? Math.floor(Math.random()*w) : Math.floor(Math.random()*h); };
    var cellOnSide = function(s,p) {
      if(s==='n') return {x:p, y:0};
      if(s==='s') return {x:p, y:h-1};
      if(s==='w') return {x:0, y:p};
      return {x:w-1, y:p};
    };

    var es, ep, xs, xp, att = 0, valid = false, entry, exit;
    while(!valid && att < 500) {
      att++;
      es = pickSide(); ep = posOnSide(es);
      xs = pickSide(); xp = posOnSide(xs);
      if(es === xs && Math.abs(ep - xp) < 2) continue; // Min 1 unit separation on same side
      entry = cellOnSide(es, ep); exit = cellOnSide(xs, xp);
      
      // Line of Sight (LOS) blocking check
      var hasLOS = function(a, b) {
        if(a.x === b.x) {
          var y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
          for(var ty=y1; ty<y2; ty++) { if(grid[ty][a.x].s) return false; }
          return true;
        }
        if(a.y === b.y) {
          var x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
          for(var tx=x1; tx<x2; tx++) { if(grid[a.y][tx].e) return false; }
          return true;
        }
        return false;
      };
      if(hasLOS(entry, exit)) continue;

      // Solution path complexity check (Trial & Error opportunity)
      var res = solveMaze({grid, w, h, entry, exit});
      if(!res || res.length < (w+h)/1.4) continue;
      valid = true;
    }
    
    // Punch openings in perimeter
    grid[entry.y][entry.x][es] = 0;
    grid[exit.y][exit.x][xs] = 0;

    return { grid, w, h, entry, exit, entrySide: es, exitSide: xs, solution: res };
  }

  function solveMaze(maze) {
    if(!maze.grid) return null;
    var queue = [{x:maze.entry.x, y:maze.entry.y, path:[{x:maze.entry.x, y:maze.entry.y}]}];
    var seen = {}; seen[maze.entry.x+','+maze.entry.y] = true;
    var dirs = {n:[0,-1], s:[0,1], e:[1,0], w:[-1,0]};
    while(queue.length) {
      var cur = queue.shift();
      if(cur.x === maze.exit.x && cur.y === maze.exit.y) return cur.path;
      var cell = maze.grid[cur.y][cur.x];
      Object.keys(dirs).forEach(function(d) {
        if(cell[d] === 0) {
          var nx = cur.x + dirs[d][0], ny = cur.y + dirs[d][1], k = nx+','+ny;
          if(nx >= 0 && nx < maze.w && ny >= 0 && ny < maze.h && !seen[k]) {
            seen[k] = true;
            queue.push({x:nx, y:ny, path:cur.path.concat([{x:nx, y:ny}])});
          }
        }
      });
    }
    return null;
  }

  // â”€â”€ CSS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function injectCSS() {
    if(document.getElementById('mist-styles')) return;
    var s = document.createElement('style');
    s.id = 'mist-styles';
    s.textContent = `
      #mist-overlay { position: fixed; inset: 0; background: rgba(0,8,12,0.6); backdrop-filter: blur(10px); z-index: 12000; opacity: 0; pointer-events: none; transition: opacity 0.4s; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; color: #00e5ff; }
      #mist-overlay.mist-open { opacity: 1; pointer-events: auto; }
      #mist-panel { width: 320px; background: rgba(2,12,18,0.92); border: 1px solid rgba(0,229,255,0.22); border-radius: 4px; box-shadow: 0 0 40px rgba(0,0,0,0.6); overflow: hidden; position: relative; }
      #mist-header { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(0,229,255,0.1); }
      #mist-title { font-size: 11px; font-weight: 500; letter-spacing: 0.15em; display: flex; align-items: baseline; gap: 8px; }
      #mist-subtitle { font-size: 8px; opacity: 0.4; font-weight: 400; }
      #mist-close { cursor: pointer; opacity: 0.6; transition: opacity 0.2s; font-size: 16px; margin-top: -2px; }
      #mist-close:hover { opacity: 1; color: #ff0055; }
      
      #mist-tabs { display: flex; gap: 1px; background: rgba(0,229,255,0.05); padding: 4px; border-bottom: 1px solid rgba(0,229,255,0.08); }
      .mst-tab { flex: 1; padding: 10px 4px; text-align: center; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; border-radius: 2px; height: 42px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
      .mst-tab:hover { background: rgba(0,229,255,0.08); }
      .mst-tab.mst-active { background: rgba(0,229,255,0.12); border: 1px solid rgba(0,229,255,0.3); }
      .mst-tab.mst-locked { opacity: 0.2; cursor: not-allowed; filter: grayscale(1); }
      .mt-icon-tab { font-size: 11px; margin-bottom: 2px; }
      .mst-label { font-size: 8px; letter-spacing: 0.1em; opacity: 0.6; }
      .mst-tab.mst-active .mst-label { opacity: 1; }
      
      #mist-controls { padding: 10px 14px; background: rgba(0,229,255,0.02); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(0,229,255,0.08); }
      #mist-diff-wrap { display: flex; align-items: center; gap: 6px; font-size: 8px; letter-spacing: 0.1em; opacity: 0.8; }
      .db { padding: 2px 8px; border: 1px solid rgba(0,229,255,0.22); cursor: pointer; border-radius: 2px; transition: all 0.2s; min-width: 24px; text-align: center; font-size: 9px; background: transparent; color: inherit; }
      .db:hover { border-color: rgba(0,229,255,0.6); background: rgba(0,229,255,0.05); }
      .db.db-active { border-color: #00e5ff; background: rgba(0,229,255,0.15); font-weight: 700; color: #fff; }
      #mist-new { font-size: 9px; letter-spacing: 0.1em; border: 1px solid rgba(0,229,255,0.25); padding: 2px 10px; border-radius: 2px; cursor: pointer; transition: all 0.2s; background: transparent; color: inherit; }
      #mist-new:hover { color: #fff; background: rgba(0,229,255,0.3); border-color: #00e5ff; }

      #mist-canvas-wrap { padding: 12px; display: flex; flex-direction: column; align-items: center; position: relative; background: rgba(0,0,0,0.2); }
      #mist-maze-canvas { background: rgba(0,5,10,0.4); border: 1px solid rgba(0,229,255,0.1); cursor: crosshair; }
      #mist-status { margin-top: 10px; font-size: 8px; letter-spacing: 0.12em; text-align: center; color: rgba(0,229,255,0.6); min-height: 12px; }
      
      #mist-trigger { position: fixed; right: 20px; top: 120px; width: 34px; background: rgba(0,10,15,0.85); border: 1px solid rgba(0,229,255,0.22); border-radius: 4px; display: flex; flex-direction: column; align-items: center; padding: 8px 0; gap: 10px; z-index: 11000; cursor: pointer; transition: all 0.3s; }
      #mist-trigger:hover { border-color: rgba(0,229,255,0.6); box-shadow: 0 0 15px rgba(0,229,255,0.2); }
      .mt-icon { font-size: 14px; opacity: 0.2; transition: all 0.4s; color: #fff; }
      .mt-icon.mi-ready { opacity: 0.7; color: #00e5ff; }
      .mt-icon.mi-active { opacity: 1; color: #00ff88; text-shadow: 0 0 8px #00ff88; }
      .mt-icon.mi-locked { opacity: 0.1; }

      .mist-solved { animation: mist-success 1.0s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
      @keyframes mist-success { 0%, 100% { box-shadow: inset 0 0 0px #00ff88; } 50% { box-shadow: inset 0 0 30px rgba(0,255,136,0.25); } }
    `;
    document.head.appendChild(s);
  }

  // â”€â”€ HTML â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function injectHTML() {
    if(document.getElementById('mist-overlay')) return;
    var trig = document.createElement('div');
    trig.id = 'mist-trigger';
    trig.innerHTML = SLOT_PROFILE.map((p, i) => `<div class="mt-icon ${MIST.solvedCount>=i?'mi-ready':'mi-locked'}" id="mt-${i}">${p.icon2}</div>`).join('');
    trig.onclick = function(e){ e.stopPropagation(); mistToggle(); };
    document.body.appendChild(trig);

    var ov = document.createElement('div');
    ov.id = 'mist-overlay';
    ov.innerHTML = `
      <div id="mist-panel">
        <div id="mist-header">
          <div id="mist-title">â—ˆ MIST <span id="mist-subtitle">LEAD EDGE MAZE</span></div>
          <div id="mist-close" onclick="mistToggle()">Ã—</div>
        </div>
        <div id="mist-tabs">
          ${SLOT_PROFILE.map((p, i) => `
            <div id="mst-tab${i}" class="mst-tab ${i===MIST.activeMaze?'mst-active':''} ${MIST.solvedCount<i?'mst-locked':''}" onclick="mistSetSlot(${i})">
              <div class="mt-icon-tab">${p.icon2}</div>
              <div class="mst-label">${p.label}</div>
            </div>
          `).join('')}
        </div>
        <div id="mist-controls">
          <div id="mist-diff-wrap">
            DIFF: 
            <button class="db ${MIST.difficulty===1?'db-active':''}" id="mst-d1" onclick="mistSetDiff(1)">I</button>
            <button class="db ${MIST.difficulty===2?'db-active':''}" id="mst-d2" onclick="mistSetDiff(2)">II</button>
            <button class="db ${MIST.difficulty===3?'db-active':''}" id="mst-d3" onclick="mistSetDiff(3)">III</button>
          </div>
          <button id="mist-new" onclick="mistNewMaze()">NEW</button>
        </div>
        <div id="mist-canvas-wrap">
          <canvas id="mist-maze-canvas"></canvas>
          <div id="mist-status">DRAG â— FROM ENTRY TO EXIT</div>
        </div>
      </div>
    `;
    ov.addEventListener('click', function(e){ e.stopPropagation(); });
    document.body.appendChild(ov);
  }

  window.mistToggle=function(){
    MIST.open=!MIST.open;
    var ov=document.getElementById('mist-overlay');
    if(ov) ov.classList.toggle('mist-open',MIST.open);
    if(MIST.open){
      setTimeout(function(){
        bindCanvasEvents();
        if(!MIST.mazes[MIST.activeMaze]) mistNewMaze();
        else renderMaze(MIST.mazes[MIST.activeMaze],MIST.dragPath);
        document.addEventListener('click',_mistOutside,true);
      },60);
    } else {
      document.removeEventListener('click',_mistOutside,true);
    }
  };

  function _mistOutside(e){
    var ov=document.getElementById('mist-overlay'),tr=document.getElementById('mist-trigger');
    if(ov&&ov.contains(e.target))return;
    if(tr&&tr.contains(e.target))return;
    if(MIST.open){MIST.open=false;if(ov)ov.classList.remove('mist-open');document.removeEventListener('click',_mistOutside,true);}
  }

  window.mistSetDiff=function(d){
    MIST.difficulty=d;
    [1,2,3].forEach(function(n){var b=document.getElementById('mst-d'+n);if(b)b.classList.toggle('db-active',n===d);});
    MIST.mazes=[null,null,null]; mistNewMaze();
  };

  window.mistSetSlot=function(slot){
    if(slot>0&&MIST.solvedCount<slot)return;
    MIST.activeMaze=slot;
    [0,1,2].forEach(function(i){var t=document.getElementById('mst-tab'+i);if(t)t.classList.toggle('mst-active',i===slot);});
    if(!MIST.mazes[slot]) mistNewMaze(); else renderMaze(MIST.mazes[slot],[]);
    setStatus('DRAG â— FROM ENTRY TO EXIT');
  };

  window.mistNewMaze=function(){
    var cfg=DIFF[MIST.difficulty];
    var maze=generateMaze(cfg.w,cfg.h); maze.solved=false;
    MIST.mazes[MIST.activeMaze]=maze; MIST.dragPath=[]; MIST.dragging=false;
    MIST.sphereTarget=null; MIST.sphereActual=null; stopSphereAnim();
    renderMaze(maze,[]); setStatus('DRAG â— FROM ENTRY TO EXIT');
  };

  function stopSphereAnim(){if(MIST.sphereAnimId){cancelAnimationFrame(MIST.sphereAnimId);MIST.sphereAnimId=null;}}
  function startSphereAnim(){
    if(MIST.sphereAnimId)return;
    function tick(){
      var maze=MIST.mazes[MIST.activeMaze];
      if(!maze||!MIST.sphereTarget){MIST.sphereAnimId=null;return;}
      if(!MIST.sphereActual)MIST.sphereActual={x:MIST.sphereTarget.x,y:MIST.sphereTarget.y};
      var dx=MIST.sphereTarget.x-MIST.sphereActual.x,dy=MIST.sphereTarget.y-MIST.sphereActual.y;
      MIST.sphereActual.x+=dx*.16; MIST.sphereActual.y+=dy*.16;
      renderMaze(maze,MIST.dragPath);
      if(Math.sqrt(dx*dx+dy*dy)>.3){MIST.sphereAnimId=requestAnimationFrame(tick);}
      else{MIST.sphereActual.x=MIST.sphereTarget.x;MIST.sphereActual.y=MIST.sphereTarget.y;renderMaze(maze,MIST.dragPath);MIST.sphereAnimId=null;}
    }
    MIST.sphereAnimId=requestAnimationFrame(tick);
  }

  // â”€â”€ WIREFRAME SPLINE Renderer (Narrow Spline Restore) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderMaze(maze, dragPath) {
    var canvas = document.getElementById('mist-maze-canvas'), wrap = document.getElementById('mist-canvas-wrap');
    if(!canvas || !wrap) return;

    // Fixed sizing to maintain core unit consistency
    var avail = Math.min(wrap.clientWidth - 28, 260); 
    var cs = Math.max(8, Math.floor(avail / Math.max(maze.w, maze.h)));
    var pw = cs * maze.w, ph = cs * maze.h;

    canvas.width = pw; canvas.height = ph;
    canvas.style.width = pw + 'px'; canvas.style.height = ph + 'px';
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, pw, ph);

    // 1. Draw Maze Walls (Narrow single splines as per Lead Edge screenshot)
    ctx.strokeStyle = 'rgba(0,229,255,0.7)'; 
    ctx.lineWidth = 1.0; 
    ctx.lineCap = 'butt'; 
    ctx.lineJoin = 'miter';
    
    ctx.beginPath();
    for(var y=0; y<maze.h; y++) {
      for(var x=0; x<maze.w; x++) {
        var cell = maze.grid[y][x], px = x * cs, py = y * cs;
        if(cell.n) { ctx.moveTo(px, py); ctx.lineTo(px+cs, py); }
        if(cell.s) { ctx.moveTo(px, py+cs); ctx.lineTo(px+cs, py+cs); }
        if(cell.w) { ctx.moveTo(px, py); ctx.lineTo(px, py+cs); }
        if(cell.e) { ctx.moveTo(px+cs, py); ctx.lineTo(px+cs, py+cs); }
      }
    }
    ctx.stroke();

    // 2. Draw Player Path
    if(dragPath && dragPath.length > 1) {
      ctx.strokeStyle = 'rgba(0,229,255,0.3)'; ctx.lineWidth = cs * 0.1;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(dragPath[0].x*cs+cs/2, dragPath[0].y*cs+cs/2);
      dragPath.forEach(function(p){ctx.lineTo(p.x*cs+cs/2, p.y*cs+cs/2);});
      ctx.stroke();
    }

    // 3. Draw Exit Terminal
    ctx.beginPath(); ctx.arc(maze.exit.x*cs+cs/2, maze.exit.y*cs+cs/2, cs*0.35, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,229,255,0.25)'; ctx.shadowBlur = 12; ctx.shadowColor = '#00e5ff';
    ctx.fill(); ctx.shadowBlur = 0;

    // 4. Draw Player Sphere (Ensures exact centroid alignment)
    var bx, by;
    if(MIST.sphereActual) { bx = MIST.sphereActual.x; by = MIST.sphereActual.y; }
    else { 
      var bc = (MIST.dragging && MIST.dragPos) ? MIST.dragPos : maze.entry; 
      bx = bc.x*cs+cs/2; by = bc.y*cs+cs/2; 
    }
    
    ctx.beginPath(); ctx.arc(bx, by, cs*0.35, 0, Math.PI*2);
    ctx.fillStyle = maze.solved ? 'rgba(0,255,136,1)' : 'rgba(0,255,136,0.9)';
    ctx.shadowBlur = 14; ctx.shadowColor = '#00ff88';
    ctx.fill(); ctx.shadowBlur = 0;
  }

  function canvasToCell(canvas, maze, cx, cy) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(maze.w-1, Math.floor(((cx-rect.left)*(canvas.width/rect.width))/(canvas.width/maze.w)))),
      y: Math.max(0, Math.min(maze.h-1, Math.floor(((cy-rect.top)*(canvas.height/rect.height))/(canvas.height/maze.h))))
    };
  }
  function onDragStart(e) {
    var maze = MIST.mazes[MIST.activeMaze]; if(!maze || maze.solved) return;
    e.preventDefault(); e.stopPropagation();
    var pt = e.touches ? e.touches[0] : e, cell = canvasToCell(this, maze, pt.clientX, pt.clientY);
    if(cell.x === maze.entry.x && cell.y === maze.entry.y) {
      MIST.dragging = true; MIST.dragPos = cell; MIST.dragPath = [cell];
      var cs = this.width / maze.w; MIST.sphereTarget = { x: cell.x*cs+cs/2, y: cell.y*cs+cs/2 }; MIST.sphereActual = { x: cell.x*cs+cs/2, y: cell.y*cs+cs/2 };
      setStatus('NAVIGATE TO â—‰ EXIT');
    }
    renderMaze(maze, MIST.dragPath);
  }
  function onDragMove(e) {
    if(!MIST.dragging) return; e.preventDefault(); e.stopPropagation();
    var maze = MIST.mazes[MIST.activeMaze]; if(!maze) return;
    var pt = e.touches ? e.touches[0] : e, cell = canvasToCell(this, maze, pt.clientX, pt.clientY);
    var prev = MIST.dragPath[MIST.dragPath.length-1];
    if(cell.x === prev.x && cell.y === prev.y) return;
    var dx = cell.x-prev.x, dy = cell.y-prev.y;
    if(Math.abs(dx) + Math.abs(dy) !== 1) return;
    var wd = dx===1 ? 'e' : dx===-1 ? 'w' : dy===1 ? 's' : 'n';
    if(maze.grid[prev.y][prev.x][wd] !== 0) return;
    if(MIST.dragPath.length >= 2) { var pp = MIST.dragPath[MIST.dragPath.length-2]; if(cell.x===pp.x && cell.y===pp.y) MIST.dragPath.pop(); else MIST.dragPath.push(cell); }
    else MIST.dragPath.push(cell);
    MIST.dragPos = cell;
    var cs = this.width / maze.w; MIST.sphereTarget = { x: cell.x*cs+cs/2, y: cell.y*cs+cs/2 }; startSphereAnim();
    if(cell.x === maze.exit.x && cell.y === maze.exit.y) { MIST.dragging = false; maze.solved = true; onMazeSolved(MIST.activeMaze, maze); }
  }
  function onDragEnd() {
    if(!MIST.dragging) return; MIST.dragging = false;
    var maze = MIST.mazes[MIST.activeMaze];
    if(maze && !maze.solved) {
      MIST.dragPath = []; var cv = document.getElementById('mist-maze-canvas'), cs = cv ? cv.width/maze.w : 10;
      MIST.sphereTarget = { x: maze.entry.x*cs+cs/2, y: maze.entry.y*cs+cs/2 }; startSphereAnim();
      setStatus('DRAG â— FROM ENTRY TO EXIT');
    }
  }
  function bindCanvasEvents() {
    var canvas = document.getElementById('mist-maze-canvas'); if(!canvas || canvas._mistBound) return; canvas._mistBound = true;
    canvas.addEventListener('mousedown', onDragStart.bind(canvas));
    canvas.addEventListener('mousemove', onDragMove.bind(canvas));
    canvas.addEventListener('mouseup',   onDragEnd.bind(canvas));
    canvas.addEventListener('mouseleave',onDragEnd.bind(canvas));
    canvas.addEventListener('touchstart',onDragStart.bind(canvas),{passive:false});
    canvas.addEventListener('touchmove', onDragMove.bind(canvas), {passive:false});
    canvas.addEventListener('touchend',  onDragEnd.bind(canvas),  {passive:false});
  }

  function onMazeSolved(slot, maze) {
    var prof = SLOT_PROFILE[slot];
    setStatus('âœ“ ' + prof.label + ' â€” WELL DONE');
    MIST.solvedCount = Math.max(MIST.solvedCount, slot + 1);
    renderMaze(maze, MIST.dragPath);
    var wrap = document.getElementById('mist-canvas-wrap');
    if(wrap) { wrap.classList.add('mist-solved'); setTimeout(function(){ wrap.classList.remove('mist-solved'); }, 3500); }
    if(slot + 1 <= 2) {
      var nt = document.getElementById('mst-tab' + (slot+1)); if(nt) nt.classList.remove('mst-locked');
      var ni = document.getElementById('mt-' + (slot+1)); if(ni) { ni.classList.remove('mi-locked'); ni.classList.add('mi-ready'); }
    }
    var ci = document.getElementById('mt-' + slot); if(ci) ci.classList.add('mi-active');
    setTimeout(function(){ MIST.open = false; var ov = document.getElementById('mist-overlay'); if(ov) ov.classList.remove('mist-open'); document.removeEventListener('click', _mistOutside, true); }, 2500);
    setTimeout(function(){ _fireMistNetworkReaction(slot, true); }, 260);
  }

  function _fireMistNetworkReaction(slot, isLocal) {
    var prof = SLOT_PROFILE[slot];
    if(typeof pulseShells === 'function') {
      pulseShells(prof.pulse);
      setTimeout(function(){ if(typeof pulseShells === 'function') pulseShells(prof.pulse * .5); }, 230);
    }
    if(typeof applyOrbEmotion === 'function') applyOrbEmotion(prof.emotion);
    window._acShellBoost = window._acShellBoost || [0,0,0];
    window._acShellBoost[0] = Math.min(.22, (window._acShellBoost[0]||0) + prof.shellBoost[0]);
    window._acShellBoost[1] = Math.min(.18, (window._acShellBoost[1]||0) + prof.shellBoost[1]);
    window._acShellBoost[2] = Math.min(.16, (window._acShellBoost[2]||0) + prof.shellBoost[2]);
    window._orbEmoSpeedMult = prof.speed;
    setTimeout(function(){ window._orbEmoSpeedMult = Math.max(window._orbEmoSpeedMult * .85, 1.0); }, 1800);
    if(typeof mazeOrbState !== 'undefined') {
      mazeOrbState.solveActive = true; mazeOrbState.solveStep = 0;
      if(mazeOrbState.pathMeshes) mazeOrbState.pathMeshes.forEach(function(m){ if(m && m.material) m.material.opacity = 0; });
    }
    if(window.S && window.S.journal) {
      var who = isLocal ? 'Local' : 'Remote';
      window.S.journal.push({ts:new Date().toISOString(), _internal:true,
        _thought:who + ' MIST solve â€” slot ' + slot + ' (' + prof.label + '). Buoyancy pulse: ' + prof.pulse + ', emotion: ' + prof.emotion + '.'});
    }
    _spawnMistGeometry(slot);
    if(isLocal && typeof writeLeatrAshMemory === 'function') {
      var uid = (typeof _aut_sid !== 'undefined') ? _aut_sid : (typeof _aut_uid !== 'undefined') ? _aut_uid : 'anon';
      writeLeatrAshMemory('ashtree/mist/' + uid + '.json', { uid:uid, slot:slot, ts:Date.now(), label:prof.label, emotion:prof.emotion });
    }
  }

  var _mistActiveGeom=[];
  function _spawnMistGeometry(slot){
    if(typeof THREE==='undefined'||typeof scene==='undefined') return;
    var COLORS=[0xffdd00,0x00ff88,0x00e5ff];
    var col=new THREE.Color(COLORS[slot]);
    var positions=[new THREE.Vector3(0,0,0)];
    if(typeof _ashNodes!=='undefined'&&_ashNodes._sessionGroups){
      Object.keys(_ashNodes._sessionGroups).forEach(function(uid){
        var g=_ashNodes._sessionGroups[uid];
        if(g&&g.group)positions.push(g.group.position.clone());
      });
    }
    if(positions.length<2){
      positions.push(new THREE.Vector3(2.2,1.2,-1.2));
      positions.push(new THREE.Vector3(-1.8,1.8,1));
      positions.push(new THREE.Vector3(0.8,-2.2,1.8));
    }
    var group=new THREE.Group();
    group._mAge=0; group._mMax=180; group._mSlot=slot; group._mObjs=[];
    var perNode=slot===0?6:slot===1?4:7;
    positions.forEach(function(nodePos,ni){
      for(var i=0;i<perNode;i++){
        var geo,mat,mesh;
        if(slot===0){
          geo=new THREE.OctahedronGeometry(0.09+Math.random()*.13,0);
          mat=new THREE.MeshBasicMaterial({color:col,wireframe:true,transparent:true,opacity:.9});
          mesh=new THREE.Mesh(geo,mat);
          mesh.position.copy(nodePos);
          var a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1),spd=0.022+Math.random()*.038;
          mesh._mv=new THREE.Vector3(Math.sin(b)*Math.cos(a)*spd,Math.sin(b)*Math.sin(a)*spd,Math.cos(b)*spd);
        } else if(slot===1){
          geo=new THREE.SphereGeometry(0.055+Math.random()*.04,5,5);
          mat=new THREE.MeshBasicMaterial({color:col,wireframe:true,transparent:true,opacity:.85});
          mesh=new THREE.Mesh(geo,mat);
          var origin=positions[0],target=nodePos;
          var mid=origin.clone().add(target).multiplyScalar(.5).add(new THREE.Vector3((Math.random()-.5)*.8,1.2+Math.random()*.8,(Math.random()-.5)*.8));
          mesh._mc=new THREE.CatmullRomCurve3([origin.clone(),mid,target.clone()]);
          mesh._mt=(i/perNode)*-0.35; mesh._mspd=0.006+Math.random()*.003;
          mesh.position.copy(origin);
        } else {
          geo=new THREE.TetrahedronGeometry(0.07+Math.random()*.1,0);
          mat=new THREE.MeshBasicMaterial({color:col,wireframe:true,transparent:true,opacity:.65});
          mesh=new THREE.Mesh(geo,mat);
          var curve=null;
          if(typeof _ashNodes!=='undefined'&&_ashNodes._splines){
            var ks=Object.keys(_ashNodes._splines);
            if(ks.length)curve=_ashNodes._splines[ks[(ni*perNode+i)%ks.length]].curve;
          }
          if(!curve){var pa=positions[ni%positions.length],pb=positions[(ni+1)%positions.length];var mpt=pa.clone().add(pb).multiplyScalar(.5).add(new THREE.Vector3((Math.random()-.5)*1.5,(Math.random()-.5)*1.5,0));curve=new THREE.CatmullRomCurve3([pa.clone(),mpt,pb.clone()]);}
          mesh._mc=curve; mesh._mt=Math.random(); mesh._mspd=0.004+Math.random()*.005;
          var pt=curve.getPoint(mesh._mt);mesh.position.copy(pt);
        }
        mesh._mr=new THREE.Vector3(Math.random()*.05,Math.random()*.04,Math.random()*.03);
        group._mObjs.push(mesh); group.add(mesh);
      }
    });
    scene.add(group);
    _mistActiveGeom.push(group);
  }

  (function _mistTick(){
    requestAnimationFrame(_mistTick);
    if(!_mistActiveGeom.length)return;
    var rem=[];
    _mistActiveGeom.forEach(function(g){
      g._mAge++;
      var fade=1-g._mAge/g._mMax;
      if(fade<=0){rem.push(g);return;}
      g._mObjs.forEach(function(obj){
        obj.rotation.x+=obj._mr.x; obj.rotation.y+=obj._mr.y; obj.rotation.z+=obj._mr.z;
        if(g._mSlot===0){obj.position.add(obj._mv); obj.material.opacity=.9*fade;}
        else if(g._mSlot===1){obj._mt+=obj._mspd;if(obj._mt>1)obj._mt=0;if(obj._mt>=0&&obj._mc){obj.position.copy(obj._mc.getPoint(Math.min(1,obj._mt)));}obj.material.opacity=.85*fade;}
        else{obj._mt+=obj._mspd;if(obj._mt>1)obj._mt=0;if(obj._mc){obj.position.copy(obj._mc.getPoint(obj._mt));obj.position.x+=Math.sin(g._mAge*.06+obj._mt*5)*.07;}obj.material.opacity=.65*fade;}
      });
    });
    rem.forEach(function(g){
      if(typeof scene!=='undefined')scene.remove(g);
      g._mObjs.forEach(function(o){o.geometry&&o.geometry.dispose();o.material&&o.material.dispose();});
      var idx=_mistActiveGeom.indexOf(g);if(idx>=0)_mistActiveGeom.splice(idx,1);
    });
  })();

  function _pollRemoteMist(){
    var pat=(typeof getLeatrAshPAT==='function')?getLeatrAshPAT():'';
    if(!pat)return;
    var localUid=(typeof _aut_sid!=='undefined')?_aut_sid:(typeof _aut_uid!=='undefined')?_aut_uid:'local';
    fetch('https://api.github.com/repos/DART-Skyboard/leatr-ash/contents/ashtree/mist',{
      headers:{'Authorization':'token '+pat,'Accept':'application/vnd.github.v3+json'},
      signal:AbortSignal.timeout(6000)
    }).then(function(r){return r.ok?r.json():null;})
    .then(function(files){
      if(!Array.isArray(files))return;
      var STALE_MS=90000;
      var remotes=files.filter(function(f){return f.name.endsWith('.json')&&f.name!==localUid+'.json';}).slice(0,20);
      remotes.forEach(function(f){
        fetch(f.download_url,{signal:AbortSignal.timeout(4000)})
          .then(function(r){return r.ok?r.json():null;})
          .then(function(d){
            if(!d||!d.ts||!d.uid)return;
            if(Date.now()-d.ts > STALE_MS) return;
            if(d.ts <= (MIST.lastRemoteTs[d.uid]||0)) return;
            MIST.lastRemoteTs[d.uid]=d.ts;
            _fireMistNetworkReaction(d.slot||0, false);
          }).catch(function(){});
      });
    }).catch(function(){});
  }

  try{
    var _mistBC=new BroadcastChannel('autumn_mist');
    _mistBC.onmessage=function(ev){
      if(!ev.data||ev.data.type!=='mist-solve')return;
      _fireMistNetworkReaction(ev.data.data&&ev.data.data.slot!=null?ev.data.data.slot:0,false);
    };
  }catch(e){}

  window._buoyancyMistPulse=function(detail){
    if(detail&&typeof detail.slot==='number') _fireMistNetworkReaction(detail.slot,false);
  };

  function _startMistPoller(){
    setTimeout(function(){
      _pollRemoteMist();
      setInterval(_pollRemoteMist,12000);
    },10000);
  }

  function setStatus(msg) { var el = document.getElementById('mist-status'); if(el) el.textContent = msg; }

  function init() { injectCSS(); injectHTML(); _startMistPoller(); }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}

})();