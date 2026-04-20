// ═══════════════════════════════════════════════════════════════════════════
//  MIST MODULE — Autumn floating transparent overlay maze
//  Lead Edge Ash Tree Reflex · THREE.js volumetric effects
//  Slots: ★ Star · ♥ Heart · ◈ Mist
//  Design: floating glass overlay, transparent bg, neon wireframe aesthetic
//          right-edge trigger → slide-in panel (not full height)
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
    threeAnimId: null
  };

  var DIFF = {
    1: {w:7,  h:7},
    2: {w:11, h:11},
    3: {w:15, h:15}
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
      // ── Edge trigger button ──
      '#mist-trigger{',
        'position:fixed;right:0;top:50%;transform:translateY(-50%);',
        'z-index:8300;',
        'display:flex;flex-direction:column;align-items:center;gap:5px;',
        'padding:10px 6px;',
        'background:rgba(2,6,14,.55);',
        'border:1px solid rgba(0,229,255,.18);border-right:none;',
        'border-radius:8px 0 0 8px;',
        'cursor:pointer;',
        'backdrop-filter:blur(8px);',
        'transition:all .25s;',
        'box-shadow:-2px 0 18px rgba(0,229,255,.07)',
      '}',
      '#mist-trigger:hover{',
        'background:rgba(0,229,255,.07);',
        'border-color:rgba(0,229,255,.35);',
        'box-shadow:-2px 0 24px rgba(0,229,255,.15)',
      '}',
      '.mt-icon{',
        'width:20px;height:20px;display:flex;align-items:center;justify-content:center;',
        'font-size:13px;transition:all .3s;',
      '}',
      '.mt-icon.mi-active{filter:drop-shadow(0 0 5px var(--cyan));opacity:1}',
      '.mt-icon.mi-locked{opacity:.18}',
      '.mt-icon.mi-ready{opacity:.7}',

      // ── Floating overlay panel ──
      '#mist-overlay{',
        'position:fixed;',
        'right:44px;',           // offset from right edge so trigger stays visible
        'top:50%;',
        'transform:translateY(-50%) translateX(calc(100% + 50px));',
        'z-index:8200;',
        'width:min(320px, calc(100vw - 60px));',
        'display:flex;flex-direction:column;gap:0;',
        'transition:transform .38s cubic-bezier(.23,1,.32,1), opacity .38s;',
        'opacity:0;pointer-events:none;',
      '}',
      '#mist-overlay.mist-open{',
        'transform:translateY(-50%) translateX(0);',
        'opacity:1;pointer-events:all;',
      '}',

      // ── Header/menu rectangle ──
      '#mist-menu{',
        'background:rgba(2,6,14,.22);',
        'border:1px solid rgba(0,229,255,.22);',
        'border-bottom:none;',
        'border-radius:10px 10px 0 0;',
        'padding:10px 12px 8px;',
        'backdrop-filter:blur(18px);',
        '-webkit-backdrop-filter:blur(18px);',
        'display:flex;flex-direction:column;gap:7px;',
      '}',

      // Header row
      '#mist-head-row{display:flex;align-items:center;gap:8px}',
      '.mist-lbl{',
        'font-family:var(--font-d,monospace);font-size:.48rem;letter-spacing:3.5px;',
        'color:rgba(0,229,255,.9);text-shadow:0 0 8px rgba(0,229,255,.4)',
      '}',
      '.mist-sub{',
        'font-family:var(--font-d,monospace);font-size:.3rem;letter-spacing:2px;',
        'color:rgba(0,229,255,.35)',
      '}',
      '#mist-x{',
        'margin-left:auto;background:none;border:none;',
        'color:rgba(0,229,255,.3);font-size:14px;cursor:pointer;padding:2px 4px;',
        'transition:color .2s;line-height:1',
      '}',
      '#mist-x:hover{color:rgba(0,229,255,.8)}',

      // Slot tabs
      '#mist-tabs{display:flex;gap:4px}',
      '.mst-tab{',
        'flex:1;padding:5px 4px;text-align:center;cursor:pointer;',
        'font-family:var(--font-d,monospace);font-size:.32rem;letter-spacing:1.5px;',
        'color:rgba(255,255,255,.25);',
        'border:1px solid rgba(0,229,255,.1);border-radius:4px;',
        'background:transparent;',
        'transition:all .18s',
      '}',
      '.mst-tab .ti{font-size:13px;display:block;margin-bottom:1px}',
      '.mst-tab.mst-active{',
        'color:var(--cyan,#00e5ff);',
        'border-color:rgba(0,229,255,.4);',
        'background:rgba(0,229,255,.06);',
        'box-shadow:0 0 8px rgba(0,229,255,.08)',
      '}',
      '.mst-tab.mst-locked{cursor:not-allowed;opacity:.25}',

      // Difficulty bar
      '#mist-diff{display:flex;align-items:center;gap:6px}',
      '.diff-lbl{font-family:var(--font-d,monospace);font-size:.28rem;letter-spacing:2px;color:rgba(255,255,255,.25)}',
      '.db{',
        'background:transparent;',
        'border:1px solid rgba(0,229,255,.15);',
        'color:rgba(0,229,255,.4);',
        'padding:2px 7px;border-radius:3px;cursor:pointer;',
        'font-family:var(--font-d,monospace);font-size:.28rem;letter-spacing:1px;',
        'transition:all .15s',
      '}',
      '.db.db-active{border-color:rgba(0,229,255,.7);color:var(--cyan,#00e5ff);background:rgba(0,229,255,.08)}',
      '#mist-new{',
        'margin-left:auto;',
        'background:rgba(0,229,255,.06);',
        'border:1px solid rgba(0,229,255,.2);',
        'color:var(--cyan,#00e5ff);',
        'padding:2px 9px;border-radius:3px;cursor:pointer;',
        'font-family:var(--font-d,monospace);font-size:.28rem;letter-spacing:1px;',
        'transition:all .15s',
      '}',
      '#mist-new:hover{background:rgba(0,229,255,.14)}',

      // ── Maze canvas square ──
      '#mist-canvas-wrap{',
        'background:rgba(2,6,14,.18);',
        'border:1px solid rgba(0,229,255,.22);',
        'border-radius:0 0 10px 10px;',
        'backdrop-filter:blur(18px);',
        '-webkit-backdrop-filter:blur(18px);',
        'padding:10px;',
        'display:flex;flex-direction:column;align-items:center;gap:6px;',
      '}',
      '#mist-maze-canvas{',
        'display:block;touch-action:none;cursor:crosshair;',
        'border:1px solid rgba(0,229,255,.12);',
        'border-radius:3px;',
        'box-shadow:0 0 20px rgba(0,229,255,.06),inset 0 0 30px rgba(0,0,0,.3)',
      '}',
      '#mist-status{',
        'font-family:var(--font-d,monospace);font-size:.3rem;letter-spacing:2px;',
        'color:rgba(0,229,255,.4);text-align:center;',
        'min-height:16px;text-shadow:0 0 6px rgba(0,229,255,.2)',
      '}',

      // ── THREE overlay canvas ──
      '#mist-three-cv{',
        'position:fixed;top:0;left:0;width:100%;height:100%;',
        'pointer-events:none;z-index:8199;',
        'opacity:0;transition:opacity .4s',
      '}',
      '#mist-three-cv.m3-on{opacity:1}',

      // ── Neon glow pulse on solved ──
      '@keyframes mist-win{0%{box-shadow:0 0 8px rgba(0,255,136,.3)}',
        '50%{box-shadow:0 0 32px rgba(0,255,136,.8),0 0 60px rgba(0,255,136,.3)}',
        '100%{box-shadow:0 0 8px rgba(0,255,136,.3)}}',
      '.mist-solved{animation:mist-win 1.2s ease-in-out 3}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── HTML ──────────────────────────────────────────────────────────────────
  function injectHTML() {
    // Edge trigger
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

    // Floating overlay
    var ov = document.createElement('div');
    ov.id = 'mist-overlay';
    ov.innerHTML = [
      // Menu rectangle
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
      '    <span class="diff-lbl">DIFFICULTY:</span>',
      '    <button class="db" id="mst-d1" onclick="mistSetDiff(1)">I</button>',
      '    <button class="db db-active" id="mst-d2" onclick="mistSetDiff(2)">II</button>',
      '    <button class="db" id="mst-d3" onclick="mistSetDiff(3)">III</button>',
      '    <button id="mist-new" onclick="mistNewMaze()">NEW</button>',
      '  </div>',
      '</div>',
      // Canvas square
      '<div id="mist-canvas-wrap">',
      '  <canvas id="mist-maze-canvas"></canvas>',
      '  <div id="mist-status">DRAG ● FROM ENTRY TO EXIT</div>',
      '</div>',
    ].join('');
    document.body.appendChild(ov);

    // THREE.js effect canvas
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
    renderMaze(maze, []);
    setStatus('DRAG ● FROM ENTRY TO EXIT');
  };

  // ── Maze renderer ─────────────────────────────────────────────────────────
  function renderMaze(maze, dragPath) {
    var canvas = document.getElementById('mist-maze-canvas');
    var wrap   = document.getElementById('mist-canvas-wrap');
    if (!canvas || !wrap) return;

    // Square canvas — fit inside wrap with padding
    var avail = Math.min(wrap.clientWidth - 20, window.innerHeight * 0.52);
    avail = Math.max(avail, 160);
    var cellSize = Math.max(6, Math.floor(avail / Math.max(maze.w, maze.h)));
    var pw = cellSize * maze.w, ph = cellSize * maze.h;

    canvas.width  = pw;
    canvas.height = ph;
    canvas.style.width  = pw + 'px';
    canvas.style.height = ph + 'px';

    var ctx = canvas.getContext('2d');

    // Transparent background (shows through to 3JS scene)
    ctx.clearRect(0, 0, pw, ph);
    ctx.fillStyle = 'rgba(2,6,14,.08)';
    ctx.fillRect(0, 0, pw, ph);

    // Walls — neon cyan
    var glow = ctx.createLinearGradient(0, 0, pw, ph);
    glow.addColorStop(0, 'rgba(0,229,255,.75)');
    glow.addColorStop(1, 'rgba(0,200,255,.55)');
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(0,229,255,.4)';
    ctx.shadowBlur = 3;

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
      ctx.strokeStyle = 'rgba(0,255,136,.55)';
      ctx.lineWidth = cellSize * 0.28;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,255,136,.4)'; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(dragPath[0].x * cellSize + cellSize/2, dragPath[0].y * cellSize + cellSize/2);
      dragPath.forEach(function(p){ ctx.lineTo(p.x*cellSize+cellSize/2, p.y*cellSize+cellSize/2); });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Exit marker — pulsing red/cyan dot
    var ex = maze.exit.x * cellSize + cellSize/2;
    var ey = maze.exit.y * cellSize + cellSize/2;
    ctx.beginPath();
    ctx.arc(ex, ey, cellSize * 0.28, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,229,255,.6)';
    ctx.shadowColor = 'rgba(0,229,255,.8)'; ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Player circle — at drag position or at entry
    var ballPos = (MIST.dragging && MIST.dragPos) ? MIST.dragPos : maze.entry;
    var bx = ballPos.x * cellSize + cellSize/2;
    var by = ballPos.y * cellSize + cellSize/2;
    ctx.beginPath();
    ctx.arc(bx, by, cellSize * 0.36, 0, Math.PI*2);
    ctx.fillStyle = maze.solved ? 'rgba(0,255,136,1)' : 'rgba(0,255,136,.9)';
    ctx.shadowColor = 'rgba(0,255,136,.9)'; ctx.shadowBlur = maze.solved ? 16 : 8;
    ctx.fill();
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1.2; ctx.stroke();
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

  function onDragStart(e) {
    var maze = MIST.mazes[MIST.activeMaze];
    if (!maze || maze.solved) return;
    e.preventDefault(); e.stopPropagation();
    var pt = e.touches ? e.touches[0] : e;
    var cell = canvasToCell(this, maze, pt.clientX, pt.clientY);
    if (cell.x === maze.entry.x && cell.y === maze.entry.y) {
      MIST.dragging = true; MIST.dragPos = cell; MIST.dragPath = [cell];
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
    if (cell.x===maze.exit.x && cell.y===maze.exit.y) {
      MIST.dragging = false; maze.solved = true;
      onMazeSolved(MIST.activeMaze, maze);
    } else {
      renderMaze(maze, MIST.dragPath);
    }
  }

  function onDragEnd(e) {
    if (!MIST.dragging) return;
    MIST.dragging = false;
    var maze = MIST.mazes[MIST.activeMaze];
    if (maze && !maze.solved) {
      MIST.dragPath = [];
      renderMaze(maze, []);
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

    // Glow wrap
    var wrap = document.getElementById('mist-canvas-wrap');
    if (wrap) { wrap.classList.add('mist-solved'); setTimeout(function(){ wrap.classList.remove('mist-solved'); }, 3700); }

    // Unlock next
    if (slot+1 <= 2) {
      var nextTab = document.getElementById('mst-tab'+(slot+1));
      if (nextTab) nextTab.classList.remove('mst-locked');
      var nextIcon = document.getElementById('mt-'+(slot+1));
      if (nextIcon) { nextIcon.classList.remove('mi-locked'); nextIcon.classList.add('mi-ready'); }
    }
    var curIcon = document.getElementById('mt-'+slot);
    if (curIcon) curIcon.classList.add('mi-active');

    setTimeout(function(){ fireMistEffect(slot); }, 400);
  }

  // ── THREE.js volumetric effects in main 3JS scene ─────────────────────────
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

  function fireMistEffect(slot) {
    initThree();
    if (!MIST.threeScene) return;
    var canvas = document.getElementById('mist-three-cv');
    canvas.classList.add('m3-on');
    while (MIST.threeScene.children.length) MIST.threeScene.remove(MIST.threeScene.children[0]);

    var objects = [];
    var colors  = [0xffdd00, 0xff4488, 0x00e5ff];
    var count   = slot===0 ? 28 : slot===1 ? 22 : 36;

    for (var i = 0; i < count; i++) {
      var geo, mat, mesh;
      if (slot === 0) {
        // ★ Star — octahedron wireframe burst
        geo  = new THREE.OctahedronGeometry(0.25+Math.random()*0.45, 0);
        mat  = new THREE.MeshBasicMaterial({color:colors[slot], wireframe:true, transparent:true, opacity:.85});
        mesh = new THREE.Mesh(geo, mat);
        var a = Math.random()*Math.PI*2;
        var spd = 0.07+Math.random()*0.14;
        mesh.position.set((Math.random()-.5)*5, (Math.random()-.5)*5, (Math.random()-.5)*3);
        mesh._v = {x:Math.cos(a)*spd, y:Math.sin(a)*spd, z:(Math.random()-.5)*.04};
        mesh._r = {x:Math.random()*.05, y:Math.random()*.04};
      } else if (slot === 1) {
        // ♥ Heart — spheres in parametric heart formation
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
        // ◈ Mist — cyan tetrahedra swirling cloud
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

    // Bezier curve pulse lines (buoyancy-style)
    for (var j = 0; j < 6; j++) {
      var pts = [];
      for (var k = 0; k < 5; k++) {
        pts.push(new THREE.Vector3((Math.random()-.5)*12,(Math.random()-.5)*12,(Math.random()-.5)*4));
      }
      var curve  = new THREE.CatmullRomCurve3(pts);
      var points = curve.getPoints(40);
      var bGeo   = new THREE.BufferGeometry().setFromPoints(points);
      var bMat   = new THREE.LineBasicMaterial({color:colors[slot], transparent:true, opacity:.3});
      MIST.threeScene.add(new THREE.Line(bGeo, bMat));
    }

    var t = 0, maxT = 140;
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
