// ═══════════════════════════════════════════════════════════════════════════
//  MIST MODULE — Autumn floating transparent overlay maze
//  Lead Edge Ash Tree Reflex · THREE.js volumetric effects
//  Slots: ★ Star · ♥ Heart · ◈ Mist
//  Design: fully transparent, upper-right overlay on 3JS canvas
//          damped sphere tracking, neon wireframe aesthetic
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  var MIST = {
    open: false,
    difficulty: 2,
    mazes: [null,null,null],
    solvedCount: 0,
    dragging: false,
    dragPos: null,
    dragPath: [],
    activeMaze: 0,
    threeScene: null,
    threeRenderer: null,
    threeCamera: null,
    threeAnimId: null,
    // Damped sphere interpolation
    sphereTarget: null,   // {x,y} in canvas pixel space
    sphereActual: null,   // {x,y} interpolated
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

  // ── BFS solver ────────────────────────────────────────────────────────────
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
      // ── Edge trigger tab — upper right, overlapping 3JS canvas ──
      '#mist-trigger{',
        'position:fixed;right:0;top:80px;',
        'z-index:9500;',
        'display:flex;flex-direction:column;align-items:center;gap:4px;',
        'padding:8px 5px;',
        'background:rgba(0,0,0,0);',
        'border:1px solid rgba(0,229,255,.22);border-right:none;',
        'border-radius:8px 0 0 8px;',
        'cursor:pointer;',
        'backdrop-filter:blur(4px);',
        '-webkit-backdrop-filter:blur(4px);',
        'transition:all .25s;',
      '}',
      '#mist-trigger:hover{',
        'background:rgba(0,229,255,.05);',
        'border-color:rgba(0,229,255,.4);',
        'box-shadow:-2px 0 18px rgba(0,229,255,.12)',
      '}',
      '.mt-icon{',
        'width:18px;height:18px;display:flex;align-items:center;justify-content:center;',
        'font-size:12px;transition:all .3s;',
      '}',
      '.mt-icon.mi-active{filter:drop-shadow(0 0 5px var(--cyan));opacity:1}',
      '.mt-icon.mi-locked{opacity:.15}',
      '.mt-icon.mi-ready{opacity:.65}',

      // ── Floating overlay panel — fully transparent, upper right over 3JS ──
      '#mist-overlay{',
        'position:fixed;',
        'right:42px;',
        'top:72px;',
        'z-index:9400;',
        'width:min(260px, calc(100vw - 56px));',
        'display:flex;flex-direction:column;gap:0;',
        'transform:translateX(calc(100% + 48px));',
        'transition:transform .36s cubic-bezier(.23,1,.32,1), opacity .36s;',
        'opacity:0;pointer-events:none;',
      '}',
      '#mist-overlay.mist-open{',
        'transform:translateX(0);',
        'opacity:1;pointer-events:all;',
      '}',

      // ── Header/menu — fully transparent ──
      '#mist-menu{',
        'background:transparent;',
        'border:1px solid rgba(0,229,255,.18);',
        'border-bottom:none;',
        'border-radius:8px 8px 0 0;',
        'padding:8px 10px 6px;',
        'display:flex;flex-direction:column;gap:5px;',
      '}',

      // Header row
      '#mist-head-row{display:flex;align-items:center;gap:7px}',
      '.mist-lbl{',
        'font-family:var(--font-d,monospace);font-size:.44rem;letter-spacing:3px;',
        'color:rgba(0,229,255,.9);text-shadow:0 0 8px rgba(0,229,255,.5)',
      '}',
      '.mist-sub{',
        'font-family:var(--font-d,monospace);font-size:.28rem;letter-spacing:2px;',
        'color:rgba(0,229,255,.32)',
      '}',
      '#mist-x{',
        'margin-left:auto;background:none;border:none;',
        'color:rgba(0,229,255,.3);font-size:13px;cursor:pointer;padding:2px 4px;',
        'transition:color .2s;line-height:1',
      '}',
      '#mist-x:hover{color:rgba(0,229,255,.8)}',

      // Slot tabs
      '#mist-tabs{display:flex;gap:3px}',
      '.mst-tab{',
        'flex:1;padding:4px 3px;text-align:center;cursor:pointer;',
        'font-family:var(--font-d,monospace);font-size:.28rem;letter-spacing:1.5px;',
        'color:rgba(255,255,255,.22);',
        'border:1px solid rgba(0,229,255,.08);border-radius:3px;',
        'background:transparent;',
        'transition:all .18s',
      '}',
      '.mst-tab .ti{font-size:11px;display:block;margin-bottom:1px}',
      '.mst-tab.mst-active{',
        'color:var(--cyan,#00e5ff);',
        'border-color:rgba(0,229,255,.35);',
        'text-shadow:0 0 6px rgba(0,229,255,.5)',
      '}',
      '.mst-tab.mst-locked{cursor:not-allowed;opacity:.2}',

      // Difficulty bar
      '#mist-diff{display:flex;align-items:center;gap:5px}',
      '.diff-lbl{font-family:var(--font-d,monospace);font-size:.26rem;letter-spacing:2px;color:rgba(255,255,255,.22)}',
      '.db{',
        'background:transparent;',
        'border:1px solid rgba(0,229,255,.12);',
        'color:rgba(0,229,255,.35);',
        'padding:2px 6px;border-radius:3px;cursor:pointer;',
        'font-family:var(--font-d,monospace);font-size:.26rem;letter-spacing:1px;',
        'transition:all .15s',
      '}',
      '.db.db-active{border-color:rgba(0,229,255,.65);color:var(--cyan,#00e5ff);text-shadow:0 0 5px rgba(0,229,255,.5)}',
      '#mist-new{',
        'margin-left:auto;',
        'background:transparent;',
        'border:1px solid rgba(0,229,255,.18);',
        'color:var(--cyan,#00e5ff);',
        'padding:2px 8px;border-radius:3px;cursor:pointer;',
        'font-family:var(--font-d,monospace);font-size:.26rem;letter-spacing:1px;',
        'transition:all .15s',
      '}',
      '#mist-new:hover{border-color:rgba(0,229,255,.5);text-shadow:0 0 6px rgba(0,229,255,.4)}',

      // ── Maze canvas square — fully transparent ──
      '#mist-canvas-wrap{',
        'background:transparent;',
        'border:1px solid rgba(0,229,255,.18);',
        'border-radius:0 0 8px 8px;',
        'padding:8px;',
        'display:flex;flex-direction:column;align-items:center;gap:4px;',
      '}',
      '#mist-maze-canvas{',
        'display:block;touch-action:none;cursor:crosshair;',
        'border:1px solid rgba(0,229,255,.1);',
        'border-radius:2px;',
      '}',
      '#mist-status{',
        'font-family:var(--font-d,monospace);font-size:.26rem;letter-spacing:2px;',
        'color:rgba(0,229,255,.35);text-align:center;',
        'min-height:14px;text-shadow:0 0 5px rgba(0,229,255,.15)',
      '}',

      // ── THREE overlay canvas — sits directly over main 3JS scene ──
      '#mist-three-cv{',
        'position:fixed;top:0;left:0;width:100%;height:100%;',
        'pointer-events:none;z-index:9300;',
        'opacity:0;transition:opacity .4s',
      '}',
      '#mist-three-cv.m3-on{opacity:1}',

      // ── Win pulse ──
      '@keyframes mist-win{0%{box-shadow:0 0 6px rgba(0,255,136,.3)}',
        '50%{box-shadow:0 0 28px rgba(0,255,136,.8),0 0 50px rgba(0,255,136,.25)}',
        '100%{box-shadow:0 0 6px rgba(0,255,136,.3)}}',
      '.mist-solved{animation:mist-win 1.2s ease-in-out 3}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── HTML ──────────────────────────────────────────────────────────────────
  function injectHTML() {
    var trig = document.createElement('div');
    trig.id = 'mist-trigger';
    trig.title = 'MIST — Lead Edge Maze';
    trig.innerHTML = [
      '<div class="mt-icon mi-ready" id="mt-0">★</div>',
      '<div class="mt-icon mi-locked" id="mt-1">♥</div>',
      '<div class="mt-icon mi-locked" id="mt-2">◈</div>',
    ].join('');
    trig.onclick = function(){ mistToggle(); };
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
    document.body.appendChild(ov);

    var tc = document.createElement('canvas');
    tc.id = 'mist-three-cv';
    document.body.appendChild(tc);
  }

  // ── Toggle ────────────────────────────────────────────────────────────────
  window.mistToggle = function() {
    MIST.open = !MIST.open;
    var ov = document.getElementById('mist-overlay');
    if (ov) ov.classList.toggle('mist-open', MIST.open);
    if (MIST.open) {
      setTimeout(function(){
        bindCanvasEvents();
        if (!MIST.mazes[MIST.activeMaze]) mistNewMaze();
        else renderMaze(MIST.mazes[MIST.activeMaze], MIST.dragPath);
      }, 60);
    }
  };

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

  // ── Damped sphere animation ───────────────────────────────────────────────
  function stopSphereAnim() {
    if (MIST.sphereAnimId) { cancelAnimationFrame(MIST.sphereAnimId); MIST.sphereAnimId = null; }
  }

  function startSphereAnim() {
    if (MIST.sphereAnimId) return;
    var DAMP = 0.16;
    function tick() {
      var maze = MIST.mazes[MIST.activeMaze];
      if (!maze) { MIST.sphereAnimId = null; return; }
      if (!MIST.sphereTarget) { MIST.sphereAnimId = null; return; }
      if (!MIST.sphereActual) {
        MIST.sphereActual = { x: MIST.sphereTarget.x, y: MIST.sphereTarget.y };
      }
      var dx = MIST.sphereTarget.x - MIST.sphereActual.x;
      var dy = MIST.sphereTarget.y - MIST.sphereActual.y;
      MIST.sphereActual.x += dx * DAMP;
      MIST.sphereActual.y += dy * DAMP;
      var dist = Math.sqrt(dx*dx + dy*dy);
      renderMaze(maze, MIST.dragPath);
      if (dist > 0.3) {
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

    var avail = Math.min(wrap.clientWidth - 16, 220);
    avail = Math.max(avail, 120);
    var cellSize = Math.max(8, Math.floor(avail / Math.max(maze.w, maze.h)));
    var pw = cellSize * maze.w, ph = cellSize * maze.h;

    canvas.width  = pw;
    canvas.height = ph;
    canvas.style.width  = pw + 'px';
    canvas.style.height = ph + 'px';

    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, pw, ph);

    // Walls — neon cyan wireframe
    ctx.strokeStyle = 'rgba(0,229,255,.7)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = 'rgba(0,229,255,.35)';
    ctx.shadowBlur = 2.5;

    for (var y = 0; y < maze.h; y++) {
      for (var x = 0; x < maze.w; x++) {
        var cell = maze.grid[y][x];
        var px = x * cellSize, py = y * cellSize;
        if (cell.n) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px+cellSize, py); ctx.stroke(); }
        if (cell.s) { ctx.beginPath(); ctx.moveTo(px, py+cellSize); ctx.lineTo(px+cellSize, py+cellSize); ctx.stroke(); }
        if (cell.w) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py+cellSize); ctx.stroke(); }
        if (cell.e) { ctx.beginPath(); ctx.moveTo(px+cellSize, py); ctx.lineTo(px+cellSize, py+cellSize); ctx.stroke(); }
      }
    }
    ctx.shadowBlur = 0;

    // Drag path — green trail
    if (dragPath && dragPath.length > 1) {
      ctx.strokeStyle = 'rgba(0,255,136,.5)';
      ctx.lineWidth = cellSize * 0.25;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,255,136,.35)'; ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(dragPath[0].x * cellSize + cellSize/2, dragPath[0].y * cellSize + cellSize/2);
      dragPath.forEach(function(p){ ctx.lineTo(p.x*cellSize+cellSize/2, p.y*cellSize+cellSize/2); });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Exit marker
    var ex = maze.exit.x * cellSize + cellSize/2;
    var ey = maze.exit.y * cellSize + cellSize/2;
    ctx.beginPath();
    ctx.arc(ex, ey, cellSize * 0.26, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,229,255,.55)';
    ctx.shadowColor = 'rgba(0,229,255,.8)'; ctx.shadowBlur = 7;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Damped player sphere — use sphereActual if animating, else dragPos or entry
    var ballPx, ballPy;
    if (MIST.sphereActual) {
      ballPx = MIST.sphereActual.x;
      ballPy = MIST.sphereActual.y;
    } else {
      var ballCell = (MIST.dragging && MIST.dragPos) ? MIST.dragPos : maze.entry;
      ballPx = ballCell.x * cellSize + cellSize/2;
      ballPy = ballCell.y * cellSize + cellSize/2;
    }
    ctx.beginPath();
    ctx.arc(ballPx, ballPy, cellSize * 0.34, 0, Math.PI*2);
    ctx.fillStyle = maze.solved ? 'rgba(0,255,136,1)' : 'rgba(0,255,136,.9)';
    ctx.shadowColor = 'rgba(0,255,136,.9)'; ctx.shadowBlur = maze.solved ? 14 : 7;
    ctx.fill();
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1.0; ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ── Touch/mouse drag ──────────────────────────────────────────────────────
  function canvasToCell(canvas, maze, cx, cy) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var x = Math.floor(((cx - rect.left) * scaleX) / (canvas.width / maze.w));
    var y = Math.floor(((cy - rect.top)  * scaleY) / (canvas.height / maze.h));
    return { x: Math.max(0, Math.min(maze.w-1, x)), y: Math.max(0, Math.min(maze.h-1, y)) };
  }

  function canvasToPx(canvas, maze, cx, cy) {
    var rect = canvas.getBoundingClientRect();
    var cellW = rect.width  / maze.w;
    var cellH = rect.height / maze.h;
    // raw pixel coords inside canvas logical space
    var lx = (cx - rect.left) * (canvas.width  / rect.width);
    var ly = (cy - rect.top)  * (canvas.height / rect.height);
    return { x: lx, y: ly };
  }

  function onDragStart(e) {
    var maze = MIST.mazes[MIST.activeMaze];
    if (!maze || maze.solved) return;
    e.preventDefault(); e.stopPropagation();
    var pt = e.touches ? e.touches[0] : e;
    var cell = canvasToCell(this, maze, pt.clientX, pt.clientY);
    if (cell.x === maze.entry.x && cell.y === maze.entry.y) {
      MIST.dragging = true; MIST.dragPos = cell; MIST.dragPath = [cell];
      var cs = this.width / maze.w;
      var px = cell.x * cs + cs/2, py = cell.y * cs + cs/2;
      MIST.sphereTarget = {x: px, y: py};
      MIST.sphereActual = {x: px, y: py};
      setStatus('NAVIGATE TO ◉ EXIT');
    }
    renderMaze(maze, MIST.dragPath);
  }

  function onDragMove(e) {
    if (!MIST.dragging) return;
    e.preventDefault(); e.stopPropagation();
    var maze = MIST.mazes[MIST.activeMaze];
    if (!maze) return;
    var pt = e.touches ? e.touches[0] : e;
    var cell = canvasToCell(this, maze, pt.clientX, pt.clientY);
    var prev = MIST.dragPath[MIST.dragPath.length-1];
    if (cell.x === prev.x && cell.y === prev.y) return;
    var dx = cell.x-prev.x, dy = cell.y-prev.y;
    if (Math.abs(dx)+Math.abs(dy) !== 1) return;
    var wallDir = dx===1?'e':dx===-1?'w':dy===1?'s':'n';
    if (maze.grid[prev.y][prev.x][wallDir] !== 0) return;
    if (MIST.dragPath.length >= 2) {
      var pp = MIST.dragPath[MIST.dragPath.length-2];
      if (cell.x===pp.x&&cell.y===pp.y) MIST.dragPath.pop();
      else MIST.dragPath.push(cell);
    } else { MIST.dragPath.push(cell); }
    MIST.dragPos = cell;

    // Update damped sphere target to new cell centre
    var cs = this.width / maze.w;
    MIST.sphereTarget = { x: cell.x * cs + cs/2, y: cell.y * cs + cs/2 };
    startSphereAnim();

    if (cell.x===maze.exit.x && cell.y===maze.exit.y) {
      MIST.dragging = false; maze.solved = true;
      onMazeSolved(MIST.activeMaze, maze);
    }
  }

  function onDragEnd(e) {
    if (!MIST.dragging) return;
    MIST.dragging = false;
    var maze = MIST.mazes[MIST.activeMaze];
    if (maze && !maze.solved) {
      MIST.dragPath = [];
      var cs = document.getElementById('mist-maze-canvas') ? document.getElementById('mist-maze-canvas').width / maze.w : 10;
      MIST.sphereTarget = { x: maze.entry.x * cs + cs/2, y: maze.entry.y * cs + cs/2 };
      startSphereAnim();
      setStatus('DRAG ● FROM ENTRY TO EXIT');
    }
  }

  function bindCanvasEvents() {
    var canvas = document.getElementById('mist-maze-canvas');
    if (!canvas || canvas._mistBound) return;
    canvas._mistBound = true;
    canvas.addEventListener('mousedown',  onDragStart.bind(canvas));
    canvas.addEventListener('mousemove',  onDragMove.bind(canvas));
    canvas.addEventListener('mouseup',    onDragEnd.bind(canvas));
    canvas.addEventListener('mouseleave', onDragEnd.bind(canvas));
    canvas.addEventListener('touchstart', onDragStart.bind(canvas), {passive:false});
    canvas.addEventListener('touchmove',  onDragMove.bind(canvas),  {passive:false});
    canvas.addEventListener('touchend',   onDragEnd.bind(canvas),   {passive:false});
  }

  // ── Win ───────────────────────────────────────────────────────────────────
  function onMazeSolved(slot, maze) {
    var labels = ['★ STAR SOLVED','♥ HEART SOLVED','◈ MIST SOLVED'];
    setStatus('✓ ' + labels[slot] + ' — WELL DONE');
    MIST.solvedCount = Math.max(MIST.solvedCount, slot+1);

    renderMaze(maze, MIST.dragPath);

    var wrap = document.getElementById('mist-canvas-wrap');
    if (wrap) { wrap.classList.add('mist-solved'); setTimeout(function(){ wrap.classList.remove('mist-solved'); }, 3700); }

    if (slot+1 <= 2) {
      var nextTab = document.getElementById('mst-tab'+(slot+1));
      if (nextTab) nextTab.classList.remove('mst-locked');
      var nextIcon = document.getElementById('mt-'+(slot+1));
      if (nextIcon) { nextIcon.classList.remove('mi-locked'); nextIcon.classList.add('mi-ready'); }
    }
    var curIcon = document.getElementById('mt-'+slot);
    if (curIcon) curIcon.classList.add('mi-active');

    setTimeout(function(){ fireMistEffect(slot, maze); }, 400);
  }

  // ── Broadcast mist solve into buoyancy network (multi-user) ──────────────
  function broadcastMistSolve(slot, maze) {
    // 1. CustomEvent on window so any local 3JS listener can react
    var detail = {
      slot:     slot,
      path:     MIST.dragPath ? MIST.dragPath.slice() : [],
      username: (window._ghAuth && window._ghAuth.username) || 'anon',
      ts:       Date.now(),
      colors:   [0xffdd00, 0xff4488, 0x00e5ff][slot]
    };
    try {
      window.dispatchEvent(new CustomEvent('mist-solve', { detail: detail, bubbles: true }));
    } catch(e) {}

    // 2. Push through leatr-ash WebSocket if available
    if (window._leatrAsh && typeof window._leatrAsh.broadcast === 'function') {
      try { window._leatrAsh.broadcast({ type: 'mist-solve', data: detail }); } catch(e) {}
    }

    // 3. BroadcastChannel for same-origin tabs
    try {
      var bc = new BroadcastChannel('autumn_mist');
      bc.postMessage({ type: 'mist-solve', data: detail });
      setTimeout(function(){ bc.close(); }, 200);
    } catch(e) {}

    // 4. Notify S.journal / sentient journal if available
    if (window.S && window.S.journal) {
      var slotNames = ['★ STAR','♥ HEART','◈ MIST'];
      window.S.journal.push({
        ts: new Date().toISOString(),
        _internal: true,
        _thought: 'MIST maze solved — slot: ' + slotNames[slot]
          + '. Path nodes: ' + (MIST.dragPath ? MIST.dragPath.length : 0)
          + '. Buoyancy network pulse dispatched.'
      });
    }
  }

  // Listen for remote mist-solve events from other users to pulse local nodes
  window.addEventListener('mist-solve', function(ev) {
    if (!ev.detail) return;
    // Animate buoyancy nodes if the main network exposes a hook
    if (typeof window._buoyancyMistPulse === 'function') {
      window._buoyancyMistPulse(ev.detail);
    }
    // Also trigger Three.js effect in local overlay so everyone sees mist geometry
    var slot = ev.detail.slot || 0;
    setTimeout(function(){ fireMistEffect(slot, null); }, 0);
  });

  // ── THREE.js volumetric effects fired into main 3JS overlay ──────────────
  function initThree() {
    if (MIST.threeScene || typeof THREE==='undefined') return;
    var canvas = document.getElementById('mist-three-cv');
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    MIST.threeScene    = new THREE.Scene();
    MIST.threeCamera   = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, .1, 1000);
    MIST.threeCamera.position.set(0, 0, 20);
    MIST.threeRenderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true, alpha:true});
    MIST.threeRenderer.setClearColor(0x000000, 0);
    MIST.threeRenderer.setSize(window.innerWidth, window.innerHeight);
  }

  function fireMistEffect(slot, maze) {
    // First broadcast so other users' viewports react
    broadcastMistSolve(slot, maze);

    initThree();
    if (!MIST.threeScene) return;
    var canvas = document.getElementById('mist-three-cv');
    if (!canvas) return;
    canvas.classList.add('m3-on');
    while (MIST.threeScene.children.length) MIST.threeScene.remove(MIST.threeScene.children[0]);

    var objects = [];
    var colors  = [0xffdd00, 0xff4488, 0x00e5ff];
    var count   = slot===0 ? 28 : slot===1 ? 22 : 36;

    for (var i = 0; i < count; i++) {
      var geo, mat, mesh;
      if (slot === 0) {
        geo  = new THREE.OctahedronGeometry(0.25+Math.random()*0.45, 0);
        mat  = new THREE.MeshBasicMaterial({color:colors[slot], wireframe:true, transparent:true, opacity:.85});
        mesh = new THREE.Mesh(geo, mat);
        var a = Math.random()*Math.PI*2;
        var spd = 0.07+Math.random()*0.14;
        mesh.position.set((Math.random()-.5)*5, (Math.random()-.5)*5, (Math.random()-.5)*3);
        mesh._v = {x:Math.cos(a)*spd, y:Math.sin(a)*spd, z:(Math.random()-.5)*.04};
        mesh._r = {x:Math.random()*.05, y:Math.random()*.04};
      } else if (slot === 1) {
        var t = i/count*Math.PI*2;
        var hx = 16*Math.pow(Math.sin(t),3)/7;
        var hy = (13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/7;
        geo  = new THREE.SphereGeometry(.12+Math.random()*.08, 7, 7);
        mat  = new THREE.MeshBasicMaterial({color:colors[slot], wireframe:true, transparent:true, opacity:.75});
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(hx, hy, 0);
        mesh._v = {x:(Math.random()-.5)*.015, y:(Math.random()-.5)*.015, z:0};
        mesh._r = {x:0, y:0, z:Math.random()*.025};
      } else {
        var r = 1.5+Math.random()*4;
        var theta = Math.random()*Math.PI*2;
        var phi   = Math.random()*Math.PI;
        geo  = new THREE.TetrahedronGeometry(.15+Math.random()*.25, 0);
        mat  = new THREE.MeshBasicMaterial({color:colors[slot], wireframe:true, transparent:true, opacity:.55});
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(r*Math.sin(phi)*Math.cos(theta), r*Math.sin(phi)*Math.sin(theta), r*Math.cos(phi));
        var sw = .035;
        mesh._v = {x:-Math.sin(theta)*sw, y:Math.cos(theta)*sw, z:(Math.random()-.5)*.02};
        mesh._r = {x:Math.random()*.035, y:Math.random()*.035};
      }
      objects.push(mesh);
      MIST.threeScene.add(mesh);
    }

    // Bezier curve pulse lines (buoyancy neural network style)
    for (var j = 0; j < 8; j++) {
      var pts = [];
      for (var k = 0; k < 5; k++) {
        pts.push(new THREE.Vector3((Math.random()-.5)*16,(Math.random()-.5)*16,(Math.random()-.5)*5));
      }
      var curve  = new THREE.CatmullRomCurve3(pts);
      var points = curve.getPoints(50);
      var bGeo   = new THREE.BufferGeometry().setFromPoints(points);
      var bMat   = new THREE.LineBasicMaterial({color:colors[slot], transparent:true, opacity:.28});
      MIST.threeScene.add(new THREE.Line(bGeo, bMat));
    }

    var t = 0, maxT = 160;
    if (MIST.threeAnimId) cancelAnimationFrame(MIST.threeAnimId);
    function animate() {
      t++;
      var fade = 1 - t/maxT;
      objects.forEach(function(o) {
        o.position.x += o._v.x; o.position.y += o._v.y; o.position.z += o._v.z;
        o.rotation.x += o._r.x; o.rotation.y += o._r.y;
        o.material.opacity = (slot===0?.85:slot===1?.75:.55) * fade;
        if (slot===2) o.position.x += Math.sin(t*.045 + o.position.z)*.015;
      });
      MIST.threeRenderer.render(MIST.threeScene, MIST.threeCamera);
      if (t < maxT) {
        MIST.threeAnimId = requestAnimationFrame(animate);
      } else {
        canvas.classList.remove('m3-on');
        while (MIST.threeScene.children.length) MIST.threeScene.remove(MIST.threeScene.children[0]);
      }
    }
    animate();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setStatus(msg) {
    var el = document.getElementById('mist-status');
    if (el) el.textContent = msg;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectCSS();
    injectHTML();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

})();
