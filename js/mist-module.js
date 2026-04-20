// ═══════════════════════════════════════════════════════════════════════════
//  MIST MODULE — Autumn transparent overlay maze
//  Lead Edge Ash Tree Reflex · injects wireframe geometry into BRPN scene
//  Trigger: upper-right, over 3JS canvas · click-outside to close
// ═══════════════════════════════════════════════════════════════════════════
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
    // Damped sphere
    sphereTarget: null,
    sphereActual: null,
    sphereAnimId: null
  };

  var DIFF = {
    1: {w:5,  h:5},
    2: {w:9,  h:9},
    3: {w:13, h:13}
  };

  // ── LEMAC maze generator ──────────────────────────────────────────────────
  function generateMaze(w, h) {
    var grid = [];
    for (var y=0;y<h;y++) {
      grid[y]=[];
      for (var x=0;x<w;x++) grid[y][x]={n:1,s:1,e:1,w:1,visited:false};
    }
    function carve(x,y) {
      grid[y][x].visited=true;
      var dirs=[['n',0,-1],['s',0,1],['e',1,0],['w',-1,0]];
      dirs.sort(function(){return Math.random()-.5;});
      dirs.forEach(function(d){
        var nx=x+d[1], ny=y+d[2];
        if(nx>=0&&nx<w&&ny>=0&&ny<h&&!grid[ny][nx].visited){
          grid[y][x][d[0]]=0;
          grid[ny][nx][{n:'s',s:'n',e:'w',w:'e'}[d[0]]]=0;
          carve(nx,ny);
        }
      });
    }
    carve(0,0);
    function pickSide(){ return ['n','s','e','w'][Math.floor(Math.random()*4)]; }
    function posOnSide(side){ return side==='n'||side==='s'?Math.floor(Math.random()*w):Math.floor(Math.random()*h); }
    function cellOnSide(side,pos){
      if(side==='n') return {x:pos,y:0};
      if(side==='s') return {x:pos,y:h-1};
      if(side==='w') return {x:0,y:pos};
      return {x:w-1,y:pos};
    }
    var entrySide=pickSide(), entryPos=posOnSide(entrySide);
    var exitSide, exitPos, att=0;
    do{ exitSide=pickSide(); exitPos=posOnSide(exitSide); att++; }
    while(att<20&&exitSide===entrySide&&Math.abs(exitPos-entryPos)<2);
    var entry=cellOnSide(entrySide,entryPos);
    var exit=cellOnSide(exitSide,exitPos);
    grid[entry.y][entry.x][entrySide]=0;
    grid[exit.y][exit.x][exitSide]=0;
    return {grid,w,h,entry,exit,entrySide,exitSide};
  }

  function solveMaze(maze) {
    var queue=[{x:maze.entry.x,y:maze.entry.y,path:[{x:maze.entry.x,y:maze.entry.y}]}];
    var seen={}; seen[maze.entry.x+','+maze.entry.y]=true;
    var dirs={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
    while(queue.length){
      var cur=queue.shift();
      if(cur.x===maze.exit.x&&cur.y===maze.exit.y) return cur.path;
      var cell=maze.grid[cur.y][cur.x];
      Object.keys(dirs).forEach(function(d){
        if(cell[d]===0){
          var nx=cur.x+dirs[d][0], ny=cur.y+dirs[d][1];
          var k=nx+','+ny;
          if(nx>=0&&nx<maze.w&&ny>=0&&ny<maze.h&&!seen[k]){
            seen[k]=true;
            queue.push({x:nx,y:ny,path:cur.path.concat({x:nx,y:ny})});
          }
        }
      });
    }
    return null;
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  function injectCSS() {
    var s = document.createElement('style');
    s.textContent = [
      // Trigger tab — upper right, overlapping the 3JS viewport
      '#mist-trigger{',
        'position:fixed;',
        'right:0;',
        'top:148px;',   // below header + just below IDLE/CALC labels
        'z-index:9500;',
        'display:flex;flex-direction:column;align-items:center;gap:4px;',
        'padding:7px 5px;',
        'background:transparent;',
        'border:1px solid rgba(0,229,255,.2);border-right:none;',
        'border-radius:7px 0 0 7px;',
        'cursor:pointer;',
        'transition:border-color .2s;',
      '}',
      '#mist-trigger:hover{border-color:rgba(0,229,255,.45);}',
      '.mt-icon{width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:11px;transition:all .3s}',
      '.mt-icon.mi-active{filter:drop-shadow(0 0 4px #00e5ff);opacity:1}',
      '.mt-icon.mi-locked{opacity:.14}',
      '.mt-icon.mi-ready{opacity:.6}',

      // Overlay panel — upper right, fully transparent
      '#mist-overlay{',
        'position:fixed;',
        'right:36px;',
        'top:140px;',
        'z-index:9400;',
        'width:min(250px,calc(100vw - 48px));',
        'display:flex;flex-direction:column;',
        'transform:translateX(calc(100% + 44px));',
        'transition:transform .32s cubic-bezier(.23,1,.32,1),opacity .32s;',
        'opacity:0;pointer-events:none;',
      '}',
      '#mist-overlay.mist-open{transform:translateX(0);opacity:1;pointer-events:all;}',

      // Menu bar — transparent
      '#mist-menu{',
        'background:transparent;',
        'border:1px solid rgba(0,229,255,.16);border-bottom:none;',
        'border-radius:7px 7px 0 0;',
        'padding:7px 9px 5px;',
        'display:flex;flex-direction:column;gap:5px;',
      '}',
      '#mist-head-row{display:flex;align-items:center;gap:7px}',
      '.mist-lbl{font-family:var(--font-d,monospace);font-size:.42rem;letter-spacing:3px;color:rgba(0,229,255,.9);text-shadow:0 0 7px rgba(0,229,255,.45)}',
      '.mist-sub{font-family:var(--font-d,monospace);font-size:.27rem;letter-spacing:2px;color:rgba(0,229,255,.3)}',
      '#mist-x{margin-left:auto;background:none;border:none;color:rgba(0,229,255,.28);font-size:12px;cursor:pointer;padding:2px 4px;transition:color .2s;line-height:1}',
      '#mist-x:hover{color:rgba(0,229,255,.8)}',

      '#mist-tabs{display:flex;gap:3px}',
      '.mst-tab{flex:1;padding:4px 3px;text-align:center;cursor:pointer;font-family:var(--font-d,monospace);font-size:.27rem;letter-spacing:1.5px;color:rgba(255,255,255,.2);border:1px solid rgba(0,229,255,.07);border-radius:3px;background:transparent;transition:all .18s}',
      '.mst-tab .ti{font-size:10px;display:block;margin-bottom:1px}',
      '.mst-tab.mst-active{color:#00e5ff;border-color:rgba(0,229,255,.32);text-shadow:0 0 5px rgba(0,229,255,.45)}',
      '.mst-tab.mst-locked{cursor:not-allowed;opacity:.18}',

      '#mist-diff{display:flex;align-items:center;gap:4px}',
      '.diff-lbl{font-family:var(--font-d,monospace);font-size:.25rem;letter-spacing:2px;color:rgba(255,255,255,.2)}',
      '.db{background:transparent;border:1px solid rgba(0,229,255,.1);color:rgba(0,229,255,.32);padding:2px 6px;border-radius:3px;cursor:pointer;font-family:var(--font-d,monospace);font-size:.25rem;letter-spacing:1px;transition:all .15s}',
      '.db.db-active{border-color:rgba(0,229,255,.6);color:#00e5ff;text-shadow:0 0 5px rgba(0,229,255,.45)}',
      '#mist-new{margin-left:auto;background:transparent;border:1px solid rgba(0,229,255,.15);color:#00e5ff;padding:2px 7px;border-radius:3px;cursor:pointer;font-family:var(--font-d,monospace);font-size:.25rem;letter-spacing:1px;transition:all .15s}',
      '#mist-new:hover{border-color:rgba(0,229,255,.45)}',

      // Canvas wrap — transparent
      '#mist-canvas-wrap{background:transparent;border:1px solid rgba(0,229,255,.15);border-radius:0 0 7px 7px;padding:7px;display:flex;flex-direction:column;align-items:center;gap:3px}',
      '#mist-maze-canvas{display:block;touch-action:none;cursor:crosshair;border:1px solid rgba(0,229,255,.09);border-radius:2px}',
      '#mist-status{font-family:var(--font-d,monospace);font-size:.24rem;letter-spacing:2px;color:rgba(0,229,255,.32);text-align:center;min-height:13px}',

      '@keyframes mist-win{0%{box-shadow:0 0 5px rgba(0,255,136,.3)}50%{box-shadow:0 0 24px rgba(0,255,136,.8)}100%{box-shadow:0 0 5px rgba(0,255,136,.3)}}',
      '.mist-solved{animation:mist-win 1.1s ease-in-out 3}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── HTML ──────────────────────────────────────────────────────────────────
  function injectHTML() {
    var trig = document.createElement('div');
    trig.id = 'mist-trigger';
    trig.title = 'MIST — Lead Edge Maze';
    trig.innerHTML = '<div class="mt-icon mi-ready" id="mt-0">★</div>'
      + '<div class="mt-icon mi-locked" id="mt-1">♥</div>'
      + '<div class="mt-icon mi-locked" id="mt-2">◈</div>';
    trig.onclick = function(e){ e.stopPropagation(); mistToggle(); };
    document.body.appendChild(trig);

    var ov = document.createElement('div');
    ov.id = 'mist-overlay';
    ov.innerHTML = [
      '<div id="mist-menu">',
      '  <div id="mist-head-row">',
      '    <span class="mist-lbl">◈ MIST</span>',
      '    <span class="mist-sub">LEAD EDGE MAZE</span>',
      '    <button id="mist-x" onclick="mistToggle()">✕</button>',
      '  </div>',
      '  <div id="mist-tabs">',
      '    <div class="mst-tab mst-active" id="mst-tab0" onclick="mistSetSlot(0)"><span class="ti">★</span>STAR</div>',
      '    <div class="mst-tab mst-locked" id="mst-tab1" onclick="mistSetSlot(1)"><span class="ti">♥</span>HEART</div>',
      '    <div class="mst-tab mst-locked" id="mst-tab2" onclick="mistSetSlot(2)"><span class="ti">◈</span>MIST</div>',
      '  </div>',
      '  <div id="mist-diff">',
      '    <span class="diff-lbl">DIFF:</span>',
      '    <button class="db db-active" id="mst-d1" onclick="mistSetDiff(1)">I</button>',
      '    <button class="db" id="mst-d2" onclick="mistSetDiff(2)">II</button>',
      '    <button class="db" id="mst-d3" onclick="mistSetDiff(3)">III</button>',
      '    <button id="mist-new" onclick="mistNewMaze()">NEW</button>',
      '  </div>',
      '</div>',
      '<div id="mist-canvas-wrap">',
      '  <canvas id="mist-maze-canvas"></canvas>',
      '  <div id="mist-status">DRAG ● FROM ENTRY TO EXIT</div>',
      '</div>',
    ].join('');
    // Stop clicks inside panel from propagating to the outside-click handler
    ov.addEventListener('click', function(e){ e.stopPropagation(); });
    document.body.appendChild(ov);
  }

  // ── Toggle + click-outside to close ──────────────────────────────────────
  window.mistToggle = function() {
    MIST.open = !MIST.open;
    var ov = document.getElementById('mist-overlay');
    if (ov) ov.classList.toggle('mist-open', MIST.open);
    if (MIST.open) {
      setTimeout(function(){
        bindCanvasEvents();
        if (!MIST.mazes[MIST.activeMaze]) mistNewMaze();
        else renderMaze(MIST.mazes[MIST.activeMaze], MIST.dragPath);
        // Attach outside-click listener
        document.addEventListener('click', _mistOutsideClick, true);
      }, 60);
    } else {
      document.removeEventListener('click', _mistOutsideClick, true);
    }
  };

  function _mistOutsideClick(e) {
    var ov   = document.getElementById('mist-overlay');
    var trig = document.getElementById('mist-trigger');
    if (ov && ov.contains(e.target)) return;
    if (trig && trig.contains(e.target)) return;
    if (MIST.open) {
      MIST.open = false;
      if (ov) ov.classList.remove('mist-open');
      document.removeEventListener('click', _mistOutsideClick, true);
    }
  }

  window.mistSetDiff = function(d) {
    MIST.difficulty = d;
    [1,2,3].forEach(function(n){
      var b = document.getElementById('mst-d'+n);
      if (b) b.classList.toggle('db-active', n===d);
    });
    MIST.mazes = [null,null,null];
    mistNewMaze();
  };

  window.mistSetSlot = function(slot) {
    if (slot > 0 && MIST.solvedCount < slot) return;
    MIST.activeMaze = slot;
    [0,1,2].forEach(function(i){
      var t = document.getElementById('mst-tab'+i);
      if (t) t.classList.toggle('mst-active', i===slot);
    });
    if (!MIST.mazes[slot]) mistNewMaze();
    else renderMaze(MIST.mazes[slot], []);
    setStatus('DRAG ● FROM ENTRY TO EXIT');
  };

  window.mistNewMaze = function() {
    var cfg = DIFF[MIST.difficulty];
    var maze = generateMaze(cfg.w, cfg.h);
    maze.solved = false;
    maze.solution = solveMaze(maze);
    MIST.mazes[MIST.activeMaze] = maze;
    MIST.dragPath = []; MIST.dragging = false;
    MIST.sphereTarget = null; MIST.sphereActual = null;
    stopSphereAnim();
    renderMaze(maze, []);
    setStatus('DRAG ● FROM ENTRY TO EXIT');
  };

  // ── Damped sphere ─────────────────────────────────────────────────────────
  function stopSphereAnim() {
    if (MIST.sphereAnimId) { cancelAnimationFrame(MIST.sphereAnimId); MIST.sphereAnimId = null; }
  }
  function startSphereAnim() {
    if (MIST.sphereAnimId) return;
    var DAMP = 0.16;
    function tick() {
      var maze = MIST.mazes[MIST.activeMaze];
      if (!maze || !MIST.sphereTarget) { MIST.sphereAnimId = null; return; }
      if (!MIST.sphereActual) MIST.sphereActual = { x: MIST.sphereTarget.x, y: MIST.sphereTarget.y };
      var dx = MIST.sphereTarget.x - MIST.sphereActual.x;
      var dy = MIST.sphereTarget.y - MIST.sphereActual.y;
      MIST.sphereActual.x += dx * DAMP;
      MIST.sphereActual.y += dy * DAMP;
      renderMaze(maze, MIST.dragPath);
      if (Math.sqrt(dx*dx+dy*dy) > 0.3) {
        MIST.sphereAnimId = requestAnimationFrame(tick);
      } else {
        MIST.sphereActual.x = MIST.sphereTarget.x;
        MIST.sphereActual.y = MIST.sphereTarget.y;
        renderMaze(maze, MIST.dragPath);
        MIST.sphereAnimId = null;
      }
    }
    MIST.sphereAnimId = requestAnimationFrame(tick);
  }

  // ── Maze renderer ─────────────────────────────────────────────────────────
  function renderMaze(maze, dragPath) {
    var canvas = document.getElementById('mist-maze-canvas');
    var wrap   = document.getElementById('mist-canvas-wrap');
    if (!canvas || !wrap) return;
    var avail = Math.min(wrap.clientWidth - 14, 220);
    avail = Math.max(avail, 110);
    var cellSize = Math.max(8, Math.floor(avail / Math.max(maze.w, maze.h)));
    var pw = cellSize * maze.w, ph = cellSize * maze.h;
    canvas.width = pw; canvas.height = ph;
    canvas.style.width = pw+'px'; canvas.style.height = ph+'px';
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, pw, ph);
    // Walls
    ctx.strokeStyle = 'rgba(0,229,255,.68)'; ctx.lineWidth = 1.1;
    ctx.shadowColor = 'rgba(0,229,255,.3)'; ctx.shadowBlur = 2;
    for (var y=0;y<maze.h;y++) for (var x=0;x<maze.w;x++) {
      var cell=maze.grid[y][x], px=x*cellSize, py=y*cellSize;
      if(cell.n){ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+cellSize,py);ctx.stroke();}
      if(cell.s){ctx.beginPath();ctx.moveTo(px,py+cellSize);ctx.lineTo(px+cellSize,py+cellSize);ctx.stroke();}
      if(cell.w){ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,py+cellSize);ctx.stroke();}
      if(cell.e){ctx.beginPath();ctx.moveTo(px+cellSize,py);ctx.lineTo(px+cellSize,py+cellSize);ctx.stroke();}
    }
    ctx.shadowBlur = 0;
    // Trail
    if (dragPath && dragPath.length > 1) {
      ctx.strokeStyle='rgba(0,255,136,.48)'; ctx.lineWidth=cellSize*.24;
      ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.shadowColor='rgba(0,255,136,.3)'; ctx.shadowBlur=4;
      ctx.beginPath();
      ctx.moveTo(dragPath[0].x*cellSize+cellSize/2, dragPath[0].y*cellSize+cellSize/2);
      dragPath.forEach(function(p){ ctx.lineTo(p.x*cellSize+cellSize/2, p.y*cellSize+cellSize/2); });
      ctx.stroke(); ctx.shadowBlur=0;
    }
    // Exit dot
    ctx.beginPath(); ctx.arc(maze.exit.x*cellSize+cellSize/2, maze.exit.y*cellSize+cellSize/2, cellSize*.25,0,Math.PI*2);
    ctx.fillStyle='rgba(0,229,255,.55)'; ctx.shadowColor='rgba(0,229,255,.8)'; ctx.shadowBlur=6;
    ctx.fill(); ctx.shadowBlur=0;
    // Damped sphere
    var bx, by;
    if (MIST.sphereActual) { bx=MIST.sphereActual.x; by=MIST.sphereActual.y; }
    else { var bc=(MIST.dragging&&MIST.dragPos)?MIST.dragPos:maze.entry; bx=bc.x*cellSize+cellSize/2; by=bc.y*cellSize+cellSize/2; }
    ctx.beginPath(); ctx.arc(bx, by, cellSize*.33,0,Math.PI*2);
    ctx.fillStyle=maze.solved?'rgba(0,255,136,1)':'rgba(0,255,136,.9)';
    ctx.shadowColor='rgba(0,255,136,.9)'; ctx.shadowBlur=maze.solved?13:6;
    ctx.fill(); ctx.strokeStyle='#00ff88'; ctx.lineWidth=.9; ctx.stroke();
    ctx.shadowBlur=0;
  }

  // ── Drag ──────────────────────────────────────────────────────────────────
  function canvasToCell(canvas, maze, cx, cy) {
    var rect=canvas.getBoundingClientRect();
    var x=Math.floor(((cx-rect.left)*(canvas.width/rect.width))/(canvas.width/maze.w));
    var y=Math.floor(((cy-rect.top)*(canvas.height/rect.height))/(canvas.height/maze.h));
    return {x:Math.max(0,Math.min(maze.w-1,x)), y:Math.max(0,Math.min(maze.h-1,y))};
  }
  function onDragStart(e) {
    var maze=MIST.mazes[MIST.activeMaze]; if(!maze||maze.solved) return;
    e.preventDefault(); e.stopPropagation();
    var pt=e.touches?e.touches[0]:e;
    var cell=canvasToCell(this,maze,pt.clientX,pt.clientY);
    if(cell.x===maze.entry.x&&cell.y===maze.entry.y){
      MIST.dragging=true; MIST.dragPos=cell; MIST.dragPath=[cell];
      var cs=this.width/maze.w;
      MIST.sphereTarget={x:cell.x*cs+cs/2,y:cell.y*cs+cs/2};
      MIST.sphereActual={x:cell.x*cs+cs/2,y:cell.y*cs+cs/2};
      setStatus('NAVIGATE TO ◉ EXIT');
    }
    renderMaze(maze,MIST.dragPath);
  }
  function onDragMove(e) {
    if(!MIST.dragging) return;
    e.preventDefault(); e.stopPropagation();
    var maze=MIST.mazes[MIST.activeMaze]; if(!maze) return;
    var pt=e.touches?e.touches[0]:e;
    var cell=canvasToCell(this,maze,pt.clientX,pt.clientY);
    var prev=MIST.dragPath[MIST.dragPath.length-1];
    if(cell.x===prev.x&&cell.y===prev.y) return;
    var dx=cell.x-prev.x, dy=cell.y-prev.y;
    if(Math.abs(dx)+Math.abs(dy)!==1) return;
    var wallDir=dx===1?'e':dx===-1?'w':dy===1?'s':'n';
    if(maze.grid[prev.y][prev.x][wallDir]!==0) return;
    if(MIST.dragPath.length>=2){
      var pp=MIST.dragPath[MIST.dragPath.length-2];
      if(cell.x===pp.x&&cell.y===pp.y) MIST.dragPath.pop();
      else MIST.dragPath.push(cell);
    } else { MIST.dragPath.push(cell); }
    MIST.dragPos=cell;
    var cs=this.width/maze.w;
    MIST.sphereTarget={x:cell.x*cs+cs/2,y:cell.y*cs+cs/2};
    startSphereAnim();
    if(cell.x===maze.exit.x&&cell.y===maze.exit.y){
      MIST.dragging=false; maze.solved=true; onMazeSolved(MIST.activeMaze,maze);
    }
  }
  function onDragEnd(e) {
    if(!MIST.dragging) return;
    MIST.dragging=false;
    var maze=MIST.mazes[MIST.activeMaze];
    if(maze&&!maze.solved){
      MIST.dragPath=[];
      var cv=document.getElementById('mist-maze-canvas');
      var cs=cv?(cv.width/maze.w):10;
      MIST.sphereTarget={x:maze.entry.x*cs+cs/2,y:maze.entry.y*cs+cs/2};
      startSphereAnim();
      setStatus('DRAG ● FROM ENTRY TO EXIT');
    }
  }
  function bindCanvasEvents() {
    var canvas=document.getElementById('mist-maze-canvas');
    if(!canvas||canvas._mistBound) return; canvas._mistBound=true;
    canvas.addEventListener('mousedown',  onDragStart.bind(canvas));
    canvas.addEventListener('mousemove',  onDragMove.bind(canvas));
    canvas.addEventListener('mouseup',    onDragEnd.bind(canvas));
    canvas.addEventListener('mouseleave', onDragEnd.bind(canvas));
    canvas.addEventListener('touchstart', onDragStart.bind(canvas),{passive:false});
    canvas.addEventListener('touchmove',  onDragMove.bind(canvas), {passive:false});
    canvas.addEventListener('touchend',   onDragEnd.bind(canvas),  {passive:false});
  }

  // ── Win ───────────────────────────────────────────────────────────────────
  function onMazeSolved(slot, maze) {
    setStatus('✓ '+['★ STAR SOLVED','♥ HEART SOLVED','◈ MIST SOLVED'][slot]+' — WELL DONE');
    MIST.solvedCount=Math.max(MIST.solvedCount,slot+1);
    renderMaze(maze,MIST.dragPath);
    var wrap=document.getElementById('mist-canvas-wrap');
    if(wrap){wrap.classList.add('mist-solved');setTimeout(function(){wrap.classList.remove('mist-solved');},3500);}
    if(slot+1<=2){
      var nt=document.getElementById('mst-tab'+(slot+1)); if(nt) nt.classList.remove('mst-locked');
      var ni=document.getElementById('mt-'+(slot+1)); if(ni){ni.classList.remove('mi-locked');ni.classList.add('mi-ready');}
    }
    var ci=document.getElementById('mt-'+slot); if(ci) ci.classList.add('mi-active');

    // Close panel so user immediately sees the animation fire into the 3JS viewport
    setTimeout(function(){
      MIST.open=false;
      var ov=document.getElementById('mist-overlay');
      if(ov) ov.classList.remove('mist-open');
      document.removeEventListener('click',_mistOutsideClick,true);
    }, 320);

    setTimeout(function(){ fireMistEffect(slot); }, 280);
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────
  function broadcastMistSolve(slot) {
    var detail={slot:slot, path:(MIST.dragPath||[]).slice(), username:(window._ghAuth&&window._ghAuth.username)||'anon', ts:Date.now()};
    try { window.dispatchEvent(new CustomEvent('mist-solve',{detail:detail,bubbles:true})); } catch(e){}
    try { var bc=new BroadcastChannel('autumn_mist'); bc.postMessage({type:'mist-solve',data:detail}); setTimeout(function(){bc.close();},200); } catch(e){}
    if(window._leatrAsh&&typeof window._leatrAsh.broadcast==='function'){try{window._leatrAsh.broadcast({type:'mist-solve',data:detail});}catch(e){}}
    if(window.S&&window.S.journal){
      window.S.journal.push({ts:new Date().toISOString(),_internal:true,
        _thought:'MIST solved — slot '+slot+'. Path: '+((MIST.dragPath||[]).length)+' nodes. Wireframe geometry pulsed into BRPN network.'});
    }
  }

  // Listen for remote user mist-solve events
  window.addEventListener('mist-solve',function(ev){
    if(!ev.detail) return;
    // Hook for buoyancy node pulse response
    if(typeof window._buoyancyMistPulse==='function') window._buoyancyMistPulse(ev.detail);
    setTimeout(function(){ fireMistEffect(ev.detail.slot||0); },0);
  });

  // ── Inject wireframe geometry INTO the main BRPN Three.js scene ──────────
  // Uses the global `scene`, `camera`, `renderer` from initBRPN()
  function fireMistEffect(slot) {
    broadcastMistSolve(slot);

    // Wait for global scene to be ready (it initialises on DOMContentLoaded)
    var attempts = 0;
    function tryInject() {
      // Access the global BRPN scene/camera/renderer
      var sc  = window.scene;
      var cam = window.camera;
      var rdr = window.renderer;
      if (!sc || !cam || !rdr || typeof THREE === 'undefined') {
        if (++attempts < 20) setTimeout(tryInject, 100);
        return;
      }
      _injectIntoScene(sc, slot);
    }
    tryInject();
  }

  function _injectIntoScene(sc, slot) {
    var colors  = [0xffdd00, 0xff4488, 0x00e5ff];
    var color   = colors[slot];
    var count   = slot===0 ? 22 : slot===1 ? 18 : 30;
    var objects = [];

    for (var i = 0; i < count; i++) {
      var geo, mat, mesh;
      if (slot === 0) {
        // ★ Star — golden octahedra burst
        geo  = new THREE.OctahedronGeometry(0.18+Math.random()*0.32, 0);
        mat  = new THREE.MeshBasicMaterial({color:color,wireframe:true,transparent:true,opacity:.8});
        mesh = new THREE.Mesh(geo, mat);
        var a=Math.random()*Math.PI*2, spd=0.04+Math.random()*0.08;
        mesh.position.set((Math.random()-.5)*3.5,(Math.random()-.5)*3.5,(Math.random()-.5)*2);
        mesh._mv={x:Math.cos(a)*spd,y:Math.sin(a)*spd,z:(Math.random()-.5)*.025};
        mesh._mr={x:Math.random()*.04,y:Math.random()*.03};
      } else if (slot === 1) {
        // ♥ Heart — magenta spheres in heart formation
        var t=i/count*Math.PI*2;
        var hx=16*Math.pow(Math.sin(t),3)/9;
        var hy=(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/9;
        geo  = new THREE.SphereGeometry(.1+Math.random()*.07,7,7);
        mat  = new THREE.MeshBasicMaterial({color:color,wireframe:true,transparent:true,opacity:.7});
        mesh = new THREE.Mesh(geo,mat);
        mesh.position.set(hx,hy,0);
        mesh._mv={x:(Math.random()-.5)*.012,y:(Math.random()-.5)*.012,z:0};
        mesh._mr={x:0,y:0,z:Math.random()*.02};
      } else {
        // ◈ Mist — cyan tetrahedra swirling cloud
        var r=1.2+Math.random()*3, theta=Math.random()*Math.PI*2, phi=Math.random()*Math.PI;
        geo  = new THREE.TetrahedronGeometry(.12+Math.random()*.2, 0);
        mat  = new THREE.MeshBasicMaterial({color:color,wireframe:true,transparent:true,opacity:.5});
        mesh = new THREE.Mesh(geo,mat);
        mesh.position.set(r*Math.sin(phi)*Math.cos(theta),r*Math.sin(phi)*Math.sin(theta),r*Math.cos(phi));
        mesh._mv={x:-Math.sin(theta)*.028,y:Math.cos(theta)*.028,z:(Math.random()-.5)*.015};
        mesh._mr={x:Math.random()*.03,y:Math.random()*.03};
      }
      objects.push(mesh);
      sc.add(mesh);
    }

    // Neural bezier curves — follow same buoyancy curve aesthetic
    var curves = [];
    for (var j = 0; j < 6; j++) {
      var pts=[];
      for (var k=0;k<5;k++) pts.push(new THREE.Vector3((Math.random()-.5)*10,(Math.random()-.5)*10,(Math.random()-.5)*3));
      var curve  = new THREE.CatmullRomCurve3(pts);
      var cGeo   = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
      var cMat   = new THREE.LineBasicMaterial({color:color,transparent:true,opacity:.25});
      var cLine  = new THREE.Line(cGeo, cMat);
      curves.push(cLine);
      sc.add(cLine);
    }

    // Animate then remove — all inside the global BRPN scene
    var t=0, maxT=150;
    (function animateMist() {
      t++;
      var fade = 1 - t/maxT;
      objects.forEach(function(o){
        o.position.x+=o._mv.x; o.position.y+=o._mv.y; o.position.z+=o._mv.z;
        o.rotation.x+=o._mr.x; o.rotation.y+=o._mr.y;
        o.material.opacity=(slot===0?.8:slot===1?.7:.5)*fade;
        if(slot===2) o.position.x+=Math.sin(t*.04+o.position.z)*.012;
      });
      curves.forEach(function(c){ c.material.opacity=.25*fade; });
      if(t<maxT){
        requestAnimationFrame(animateMist);
      } else {
        objects.forEach(function(o){ sc.remove(o); o.geometry.dispose(); o.material.dispose(); });
        curves.forEach(function(c){ sc.remove(c); c.geometry.dispose(); c.material.dispose(); });
      }
    })();
  }

  function setStatus(msg){ var el=document.getElementById('mist-status'); if(el) el.textContent=msg; }

  function init(){ injectCSS(); injectHTML(); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',init); }
  else { init(); }

})();
