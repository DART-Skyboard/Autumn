// ═══════════════════════════════════════════════════════════════════════════
//  MIST MODULE — LEATR Maze Interaction System
//  Collapsible right-side HUD overlay with 3 progressive maze challenges
//  Lead Edge Ash Tree Reflex maze logic (randomized, LEATR rules)
// ═══════════════════════════════════════════════════════════════════════════

(function() {
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
var MIST = {
  open: false,
  difficulty: 1,
  solved: [false, false, false], // star, heart, mist
  activeMaze: 0,  // 0=star, 1=heart, 2=mist
  mazes: [null, null, null],
  currentPos: null,
  path: [],
  dragging: false,
  animating: false
};

var DIFF_SIZES = { 1: 7, 2: 11, 3: 15 };

// ── CSS Injection ──────────────────────────────────────────────────────────
var style = document.createElement('style');
style.textContent = [
  '#mist-tab{position:fixed;right:0;top:50%;transform:translateY(-50%);',
  'z-index:8200;display:flex;flex-direction:column;align-items:center;',
  'justify-content:center;width:28px;background:rgba(3,8,18,.92);',
  'border:1px solid rgba(167,139,250,.3);border-right:none;border-radius:6px 0 0 6px;',
  'padding:10px 0;gap:8px;cursor:pointer;transition:all .2s;',
  'box-shadow:-4px 0 18px rgba(167,139,250,.12)}',
  '#mist-tab:hover{border-color:rgba(167,139,250,.6);box-shadow:-4px 0 24px rgba(167,139,250,.25)}',
  '.mist-tab-dot{width:8px;height:8px;border:1.5px solid rgba(167,139,250,.6);',
  'border-radius:50%;transition:all .2s}',
  '#mist-tab:hover .mist-tab-dot{border-color:#a78bfa;box-shadow:0 0 6px #a78bfa}',
  '.mist-tab-line{width:2px;height:14px;background:linear-gradient(rgba(167,139,250,.0),rgba(167,139,250,.3),rgba(167,139,250,.0))}',
  '#mist-panel{position:fixed;right:0;top:0;height:100%;width:0;overflow:hidden;',
  'z-index:8199;transition:width .3s cubic-bezier(.4,0,.2,1);',
  'background:rgba(3,8,18,.97);border-left:1px solid rgba(167,139,250,.2);',
  'display:flex;flex-direction:column}',
  '#mist-panel.open{width:min(320px,90vw)}',
  '#mist-header{flex-shrink:0;display:flex;align-items:center;',
  'border-bottom:1px solid rgba(167,139,250,.15);padding:10px 12px;gap:6px;',
  'background:rgba(167,139,250,.04)}',
  '#mist-title{font-family:var(--font-d,Orbitron,sans-serif);font-size:.55rem;',
  'letter-spacing:3px;color:#a78bfa;flex:1}',
  '#mist-close{background:transparent;border:1px solid rgba(167,139,250,.2);',
  'color:rgba(167,139,250,.5);width:22px;height:22px;border-radius:3px;',
  'cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center}',
  '#mist-close:hover{border-color:#a78bfa;color:#a78bfa}',
  '.mist-icon-row{display:flex;gap:6px;padding:10px 12px;flex-shrink:0;',
  'border-bottom:1px solid rgba(167,139,250,.1)}',
  '.mist-icon-btn{flex:1;display:flex;flex-direction:column;align-items:center;',
  'gap:4px;padding:8px 4px;border:1px solid rgba(167,139,250,.15);border-radius:6px;',
  'background:rgba(167,139,250,.04);cursor:pointer;transition:all .2s;',
  'font-family:var(--font-d,Orbitron,sans-serif);font-size:.3rem;letter-spacing:1px;',
  'color:rgba(167,139,250,.4)}',
  '.mist-icon-btn.unlocked{border-color:rgba(167,139,250,.4);color:#a78bfa}',
  '.mist-icon-btn.active{border-color:#a78bfa;color:#a78bfa;box-shadow:0 0 10px rgba(167,139,250,.2);',
  'background:rgba(167,139,250,.12)}',
  '.mist-icon-btn:hover{border-color:rgba(167,139,250,.5);background:rgba(167,139,250,.08)}',
  '.mist-icon-svg{width:22px;height:22px}',
  '#mist-maze-wrap{flex:1;display:flex;align-items:center;justify-content:center;',
  'padding:10px;overflow:hidden;position:relative}',
  '#mist-maze-canvas{border:1px solid rgba(167,139,250,.2);border-radius:4px;',
  'touch-action:none;cursor:crosshair}',
  '#mist-status{flex-shrink:0;padding:6px 12px;font-family:var(--font-d,Orbitron,sans-serif);',
  'font-size:.35rem;letter-spacing:2px;color:rgba(167,139,250,.5);text-align:center;',
  'min-height:22px;border-top:1px solid rgba(167,139,250,.08)}',
  '.mist-diff-row{flex-shrink:0;display:flex;align-items:center;gap:8px;',
  'padding:8px 12px;border-top:1px solid rgba(167,139,250,.1)}',
  '.mist-diff-label{font-family:var(--font-d,Orbitron,sans-serif);font-size:.32rem;',
  'letter-spacing:1.5px;color:rgba(167,139,250,.35)}',
  '.mist-diff-btns{display:flex;gap:4px;flex:1}',
  '.mist-diff-btn{flex:1;padding:4px 0;border:1px solid rgba(167,139,250,.15);',
  'border-radius:3px;background:transparent;color:rgba(167,139,250,.4);',
  'font-family:var(--font-d,Orbitron,sans-serif);font-size:.32rem;letter-spacing:1px;cursor:pointer;transition:all .15s}',
  '.mist-diff-btn.active{border-color:#a78bfa;color:#a78bfa;background:rgba(167,139,250,.1)}',
  '.mist-diff-btn:hover{border-color:rgba(167,139,250,.4);color:rgba(167,139,250,.7)}',
  '.mist-solved-badge{position:absolute;top:6px;right:6px;',
  'font-family:var(--font-d,Orbitron,sans-serif);font-size:.32rem;letter-spacing:1px;',
  'color:#00ff88;padding:2px 6px;border:1px solid rgba(0,255,136,.3);border-radius:3px;',
  'background:rgba(0,255,136,.08)}',
  '@keyframes mist-star-fly{0%{opacity:1;transform:translate(-50%,-50%) scale(0) rotate(0deg)}',
  '60%{opacity:1;transform:translate(-50%,-50%) scale(1.5) rotate(180deg)}',
  '100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0.2) rotate(360deg)}}',
  '@keyframes mist-pulse{0%,100%{opacity:.6}50%{opacity:1}}',
].join('');
document.head.appendChild(style);

// ── LEATR Maze Generator ───────────────────────────────────────────────────
function generateMaze(size) {
  var grid = [];
  for (var r=0; r<size; r++) {
    grid[r] = [];
    for (var c=0; c<size; c++) {
      grid[r][c] = { n:true, s:true, e:true, w:true, visited:false };
    }
  }

  function neighbors(r,c) {
    var ns=[];
    if(r>0&&!grid[r-1][c].visited) ns.push([r-1,c,'n','s']);
    if(r<size-1&&!grid[r+1][c].visited) ns.push([r+1,c,'s','n']);
    if(c>0&&!grid[r][c-1].visited) ns.push([r,c-1,'w','e']);
    if(c<size-1&&!grid[r][c+1].visited) ns.push([r,c+1,'e','w']);
    return ns;
  }
  function shuffle(a) { for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;} return a; }

  var stack=[[0,0]]; grid[0][0].visited=true;
  while(stack.length) {
    var cur=stack[stack.length-1];
    var r=cur[0],c=cur[1];
    var ns=shuffle(neighbors(r,c));
    if(ns.length) {
      var n=ns[0]; grid[r][c][n[2]]=false; grid[n[0]][n[1]][n[3]]=false;
      grid[n[0]][n[1]].visited=true; stack.push([n[0],n[1]]);
    } else { stack.pop(); }
  }

  // Place entrance and exit following LEATR rules:
  // Random sides; if same side, at least 1 unit apart
  var sides=['n','s','e','w'];
  var es=sides[Math.floor(Math.random()*4)];
  var xs=sides[Math.floor(Math.random()*4)];
  var ep, xp;

  function randPos(side) {
    return side==='n'||side==='s' ? Math.floor(Math.random()*size) : Math.floor(Math.random()*size);
  }
  ep=randPos(es);
  if(xs===es) {
    do { xp=randPos(xs); } while(Math.abs(xp-ep)<2);
  } else { xp=randPos(xs); }

  // Open walls for entrance/exit
  function openGate(side, pos) {
    var r,c,wall;
    if(side==='n'){r=0;c=pos;wall='n';}
    else if(side==='s'){r=size-1;c=pos;wall='s';}
    else if(side==='w'){r=pos;c=0;wall='w';}
    else{r=pos;c=size-1;wall='e';}
    grid[r][c][wall]=false;
    return {r,c,side};
  }

  return { grid, size,
    entrance: openGate(es,ep),
    exit: openGate(xs,xp) };
}

// ── Canvas Renderer ────────────────────────────────────────────────────────
function renderMaze(canvas, maze, playerPos, path) {
  var ctx = canvas.getContext('2d');
  var size = maze.size;
  var cw = canvas.width, ch = canvas.height;
  var cell = Math.floor(Math.min(cw,ch)/size);
  var ox = Math.floor((cw - cell*size)/2);
  var oy = Math.floor((ch - cell*size)/2);

  ctx.clearRect(0,0,cw,ch);
  ctx.fillStyle='rgba(3,5,12,1)';
  ctx.fillRect(0,0,cw,ch);

  // Grid fill
  for(var r=0;r<size;r++) for(var c=0;c<size;c++) {
    ctx.fillStyle='rgba(167,139,250,.03)';
    ctx.fillRect(ox+c*cell+1,oy+r*cell+1,cell-2,cell-2);
  }

  // Path glow
  if(path&&path.length>1) {
    ctx.strokeStyle='rgba(167,139,250,.3)';
    ctx.lineWidth=Math.max(2,cell*0.25);
    ctx.lineCap='round';
    ctx.lineJoin='round';
    ctx.beginPath();
    for(var i=0;i<path.length;i++) {
      var pr=path[i][0],pc=path[i][1];
      var px=ox+pc*cell+cell/2,py=oy+pr*cell+cell/2;
      if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.stroke();
  }

  // Walls
  ctx.strokeStyle='rgba(167,139,250,.7)';
  ctx.lineWidth=1.5;
  for(var r=0;r<size;r++) for(var c=0;c<size;c++) {
    var cell_x=ox+c*cell, cell_y=oy+r*cell;
    var walls=maze.grid[r][c];
    ctx.beginPath();
    if(walls.n){ctx.moveTo(cell_x,cell_y);ctx.lineTo(cell_x+cell,cell_y);}
    ctx.stroke(); ctx.beginPath();
    if(walls.s){ctx.moveTo(cell_x,cell_y+cell);ctx.lineTo(cell_x+cell,cell_y+cell);}
    ctx.stroke(); ctx.beginPath();
    if(walls.w){ctx.moveTo(cell_x,cell_y);ctx.lineTo(cell_x,cell_y+cell);}
    ctx.stroke(); ctx.beginPath();
    if(walls.e){ctx.moveTo(cell_x+cell,cell_y);ctx.lineTo(cell_x+cell,cell_y+cell);}
    ctx.stroke();
  }

  // Entrance glow (green)
  var en=maze.entrance, ex=maze.exit;
  drawGate(ctx,en,cell,ox,oy,size,'rgba(0,255,136,.8)');
  drawGate(ctx,ex,cell,ox,oy,size,'rgba(255,68,102,.8)');

  // Player circle (wireframe)
  if(playerPos) {
    var px=ox+playerPos[1]*cell+cell/2, py=oy+playerPos[0]*cell+cell/2;
    var pr=Math.max(4,cell*0.28);
    ctx.strokeStyle='#a78bfa'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(167,139,250,.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(px,py,pr*1.5,0,Math.PI*2); ctx.stroke();
    // Cross hairs
    ctx.strokeStyle='rgba(167,139,250,.5)'; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(px-pr*1.3,py); ctx.lineTo(px+pr*1.3,py);
    ctx.moveTo(px,py-pr*1.3); ctx.lineTo(px,py+pr*1.3);
    ctx.stroke();
  }

  return {cell,ox,oy};
}

function drawGate(ctx,gate,cell,ox,oy,size,color) {
  ctx.strokeStyle=color; ctx.lineWidth=3;
  ctx.shadowColor=color; ctx.shadowBlur=8;
  ctx.beginPath();
  var gx=ox+gate.c*cell, gy=oy+gate.r*cell;
  if(gate.side==='n'){ctx.moveTo(gx+2,gy);ctx.lineTo(gx+cell-2,gy);}
  else if(gate.side==='s'){ctx.moveTo(gx+2,gy+cell);ctx.lineTo(gx+cell-2,gy+cell);}
  else if(gate.side==='w'){ctx.moveTo(gx,gy+2);ctx.lineTo(gx,gy+cell-2);}
  else{ctx.moveTo(gx+cell,gy+2);ctx.lineTo(gx+cell,gy+cell-2);}
  ctx.stroke(); ctx.shadowBlur=0;
}

// ── Build Panel HTML ───────────────────────────────────────────────────────
function buildPanel() {
  var tab = document.createElement('div'); tab.id='mist-tab';
  tab.innerHTML='<div class="mist-tab-dot"></div><div class="mist-tab-line"></div>'
    +'<div class="mist-tab-dot"></div><div class="mist-tab-line"></div>'
    +'<div class="mist-tab-dot"></div>';
  tab.onclick = toggleMist;
  document.body.appendChild(tab);

  var panel = document.createElement('div'); panel.id='mist-panel';
  panel.innerHTML = [
    '<div id="mist-header">',
    '<div id="mist-title">◈ MIST</div>',
    '<button id="mist-close" onclick="window._mistToggle()">✕</button>',
    '</div>',
    '<div class="mist-icon-row">',
    '<div class="mist-icon-btn active" id="mist-btn-0" onclick="window._mistSelectMaze(0)" title="STAR — Solve maze 1">',
    '<svg class="mist-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">',
    '<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>',
    '</svg><span>STAR</span></div>',
    '<div class="mist-icon-btn" id="mist-btn-1" onclick="window._mistSelectMaze(1)" title="HEART — Solve mazes 1+2">',
    '<svg class="mist-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">',
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    '</svg><span>HEART</span></div>',
    '<div class="mist-icon-btn" id="mist-btn-2" onclick="window._mistSelectMaze(2)" title="MIST — Solve all 3 mazes">',
    '<svg class="mist-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">',
    '<path d="M3 8h18M5 12h14M7 16h10"/>',
    '</svg><span>MIST</span></div>',
    '</div>',
    '<div id="mist-maze-wrap">',
    '<canvas id="mist-maze-canvas"></canvas>',
    '</div>',
    '<div id="mist-status">DRAG ◯ FROM GREEN TO RED</div>',
    '<div class="mist-diff-row">',
    '<span class="mist-diff-label">DIFFICULTY</span>',
    '<div class="mist-diff-btns">',
    '<button class="mist-diff-btn active" onclick="window._mistSetDiff(1)">1</button>',
    '<button class="mist-diff-btn" onclick="window._mistSetDiff(2)">2</button>',
    '<button class="mist-diff-btn" onclick="window._mistSetDiff(3)">3</button>',
    '</div></div>'
  ].join('');
  document.body.appendChild(panel);

  initMazeCanvas();
}

function initMazeCanvas() {
  var canvas = document.getElementById('mist-maze-canvas');
  var wrap = document.getElementById('mist-maze-wrap');
  if (!canvas||!wrap) return;

  function resize() {
    var w=wrap.clientWidth-20, h=wrap.clientHeight-20;
    var sz=Math.min(w,h);
    canvas.width=sz; canvas.height=sz;
    if(MIST.mazes[MIST.activeMaze]) renderMaze(canvas,MIST.mazes[MIST.activeMaze],MIST.currentPos,MIST.path);
  }
  new ResizeObserver(resize).observe(wrap);
  setTimeout(resize,100);

  // Touch/pointer drag handling
  function getCell(ex,ey) {
    var rect=canvas.getBoundingClientRect();
    var maze=MIST.mazes[MIST.activeMaze]; if(!maze) return null;
    var size=maze.size;
    var cell=Math.floor(Math.min(canvas.width,canvas.height)/size);
    var ox=Math.floor((canvas.width-cell*size)/2);
    var oy=Math.floor((canvas.height-cell*size)/2);
    var cx=ex-rect.left, cy=ey-rect.top;
    var col=Math.floor((cx-ox)/cell), row=Math.floor((cy-oy)/cell);
    if(row<0||row>=size||col<0||col>=size) return null;
    return [row,col];
  }

  function startDrag(ex,ey) {
    if(MIST.solved[MIST.activeMaze]) return;
    var maze=MIST.mazes[MIST.activeMaze]; if(!maze) return;
    var cell=getCell(ex,ey); if(!cell) return;
    // Must start on entrance cell
    if(cell[0]===maze.entrance.r&&cell[1]===maze.entrance.c) {
      MIST.dragging=true;
      MIST.currentPos=cell;
      MIST.path=[[cell[0],cell[1]]];
      renderMaze(canvas,maze,MIST.currentPos,MIST.path);
    }
  }

  function moveDrag(ex,ey) {
    if(!MIST.dragging) return;
    var maze=MIST.mazes[MIST.activeMaze]; if(!maze) return;
    var cell=getCell(ex,ey); if(!cell) return;
    var cur=MIST.currentPos; if(!cur) return;
    if(cell[0]===cur[0]&&cell[1]===cur[1]) return;

    // Check adjacency and no wall between
    var dr=cell[0]-cur[0], dc=cell[1]-cur[1];
    if(Math.abs(dr)+Math.abs(dc)!==1) return; // must be adjacent
    var dir, wallA, wallB;
    if(dr===-1){dir='n';wallA='n';wallB='s';}
    else if(dr===1){dir='s';wallA='s';wallB='n';}
    else if(dc===-1){dir='w';wallA='w';wallB='e';}
    else{dir='e';wallA='e';wallB='w';}

    if(maze.grid[cur[0]][cur[1]][wallA]) { // wall exists = invalid
      endDrag(true); return;
    }

    // Check if backtracking
    var pathLen=MIST.path.length;
    if(pathLen>=2&&MIST.path[pathLen-2][0]===cell[0]&&MIST.path[pathLen-2][1]===cell[1]) {
      MIST.path.pop(); MIST.currentPos=cell;
    } else {
      MIST.path.push([cell[0],cell[1]]);
      MIST.currentPos=cell;
    }

    renderMaze(canvas,maze,MIST.currentPos,MIST.path);

    // Check win
    if(cell[0]===maze.exit.r&&cell[1]===maze.exit.c) {
      MIST.dragging=false; onMazeSolved();
    }
  }

  function endDrag(fail) {
    if(!MIST.dragging) return;
    MIST.dragging=false;
    if(fail) {
      setStatus('HIT A WALL — START AGAIN');
      var maze=MIST.mazes[MIST.activeMaze];
      MIST.currentPos=[maze.entrance.r,maze.entrance.c];
      MIST.path=[[maze.entrance.r,maze.entrance.c]];
      setTimeout(function(){ renderMaze(canvas,maze,MIST.currentPos,MIST.path); },200);
    }
  }

  canvas.addEventListener('pointerdown', function(e){e.preventDefault(); var t=e.touches?e.touches[0]:e; startDrag(t.clientX,t.clientY);},{passive:false});
  canvas.addEventListener('pointermove', function(e){e.preventDefault(); var t=e.touches?e.touches[0]:e; moveDrag(t.clientX,t.clientY);},{passive:false});
  canvas.addEventListener('pointerup',   function(e){endDrag(false);},{passive:false});
  canvas.addEventListener('pointerleave',function(e){if(MIST.dragging)endDrag(false);},{passive:false});
}

function onMazeSolved() {
  var idx=MIST.activeMaze;
  MIST.solved[idx]=true;
  updateIconStates();
  var names=['STAR','HEART','MIST'];
  setStatus('✓ ' + names[idx] + ' UNLOCKED!');

  // If heart or mist now available, move to next
  if(idx<2 && !MIST.solved[idx+1]) {
    setTimeout(function(){
      MIST.activeMaze=idx+1; loadMaze(idx+1);
    },1200);
  }

  // Fire the reward animation
  fireReward(idx);
}

function fireReward(idx) {
  if(idx===0) fireStarReward();
  else if(idx===1) fireHeartReward();
  else fireMistReward();
}

// ── STAR reward: volumetric wireframe stars over 3JS scene ────────────────
function fireStarReward() {
  var count=12;
  for(var i=0;i<count;i++) {
    (function(i){
      setTimeout(function(){
        var star=document.createElement('div');
        star.style.cssText='position:fixed;z-index:9999;pointer-events:none;width:30px;height:30px;opacity:0';
        var tx=(Math.random()-0.5)*200, ty=(Math.random()-0.5)*200;
        var sx=20+Math.random()*(window.innerWidth-40);
        var sy=20+Math.random()*(window.innerHeight*0.6-40);
        star.style.left=sx+'px'; star.style.top=sy+'px';
        star.style.setProperty('--tx',tx+'px'); star.style.setProperty('--ty',ty+'px');
        star.innerHTML='<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.5" style="filter:drop-shadow(0 0 6px #a78bfa)"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>';
        star.style.animation='mist-star-fly 1.2s ease-out forwards';
        document.body.appendChild(star);
        setTimeout(function(){star.remove();},1300);
      }, i*80);
    })(i);
  }
  // Pulse the 3JS scene GEO shell if available
  if(window.S&&typeof pulseShells==='function') pulseShells(2.0);
}

// ── HEART reward: hearts with pink glow ──────────────────────────────────
function fireHeartReward() {
  var count=10;
  for(var i=0;i<count;i++) {
    (function(i){
      setTimeout(function(){
        var heart=document.createElement('div');
        heart.style.cssText='position:fixed;z-index:9999;pointer-events:none;width:28px;height:28px;opacity:0;animation:mist-star-fly 1.4s ease-out forwards';
        var tx=(Math.random()-0.5)*180, ty=(Math.random()-0.5)*180;
        heart.style.left=(30+Math.random()*(window.innerWidth-60))+'px';
        heart.style.top=(30+Math.random()*(window.innerHeight*0.7))+'px';
        heart.style.setProperty('--tx',tx+'px'); heart.style.setProperty('--ty',ty+'px');
        heart.innerHTML='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff6b9d" stroke-width="1.5" style="filter:drop-shadow(0 0 8px #ff6b9d)"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
        document.body.appendChild(heart);
        setTimeout(function(){heart.remove();},1500);
      },i*100);
    })(i);
  }
  if(typeof pulseShells==='function') pulseShells(2.5);
}

// ── MIST reward: misty particle cascade ──────────────────────────────────
function fireMistReward() {
  // Overlay mist effect on the main viewport
  var mist=document.createElement('div');
  mist.style.cssText='position:fixed;inset:0;z-index:9998;pointer-events:none;'
    +'background:radial-gradient(ellipse at center,rgba(167,139,250,.15),rgba(0,0,0,0));'
    +'animation:mist-star-fly 3s ease-out forwards;opacity:1';
  mist.style.setProperty('--tx','0px'); mist.style.setProperty('--ty','0px');
  document.body.appendChild(mist);
  setTimeout(function(){mist.remove();},3200);
  // Also fire stars + hearts together
  fireStarReward();
  setTimeout(fireHeartReward,400);
  // Toast
  if(typeof window._toast==='function') window._toast('⬡ MIST UNLOCKED — ALL PATHS CLEARED');
}

// ── Maze management ────────────────────────────────────────────────────────
function loadMaze(idx) {
  var size=DIFF_SIZES[MIST.difficulty];
  MIST.mazes[idx]=generateMaze(size);
  MIST.currentPos=[MIST.mazes[idx].entrance.r,MIST.mazes[idx].entrance.c];
  MIST.path=[[MIST.mazes[idx].entrance.r,MIST.mazes[idx].entrance.c]];
  MIST.dragging=false;
  var canvas=document.getElementById('mist-maze-canvas');
  if(canvas) renderMaze(canvas,MIST.mazes[idx],MIST.currentPos,MIST.path);
  setStatus('DRAG ◯ FROM GREEN TO RED');
  updateIconStates();
}

function setStatus(msg) {
  var el=document.getElementById('mist-status');
  if(el) el.textContent=msg;
}

function updateIconStates() {
  for(var i=0;i<3;i++) {
    var btn=document.getElementById('mist-btn-'+i);
    if(!btn) continue;
    btn.className='mist-icon-btn';
    if(MIST.solved[i]) btn.classList.add('unlocked');
    if(i===MIST.activeMaze) btn.classList.add('active');
  }
}

// ── Toggle / control ───────────────────────────────────────────────────────
function toggleMist() {
  MIST.open=!MIST.open;
  var panel=document.getElementById('mist-panel');
  if(panel) panel.classList.toggle('open',MIST.open);
  if(MIST.open&&!MIST.mazes[MIST.activeMaze]) {
    setTimeout(function(){loadMaze(MIST.activeMaze);},350);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────
window._mistToggle=toggleMist;
window._mistSelectMaze=function(idx) {
  // Can only select if previous mazes are solved (or it's maze 0)
  if(idx>0&&!MIST.solved[idx-1]) {
    setStatus('SOLVE MAZE '+(idx)+' FIRST');
    return;
  }
  MIST.activeMaze=idx;
  if(!MIST.mazes[idx]) loadMaze(idx);
  else {
    // Reload if already solved to let them replay
    if(MIST.solved[idx]) {
      setStatus('ALREADY UNLOCKED — REPLAYING');
      loadMaze(idx);
    } else {
      MIST.currentPos=[MIST.mazes[idx].entrance.r,MIST.mazes[idx].entrance.c];
      MIST.path=[[MIST.mazes[idx].entrance.r,MIST.mazes[idx].entrance.c]];
      var canvas=document.getElementById('mist-maze-canvas');
      if(canvas) renderMaze(canvas,MIST.mazes[idx],MIST.currentPos,MIST.path);
    }
  }
  updateIconStates();
};
window._mistSetDiff=function(d) {
  MIST.difficulty=d;
  document.querySelectorAll('.mist-diff-btn').forEach(function(b,i){
    b.classList.toggle('active',i+1===d);
  });
  // Regenerate all mazes at new difficulty
  MIST.mazes=[null,null,null];
  MIST.solved=[false,false,false];
  MIST.activeMaze=0;
  updateIconStates();
  loadMaze(0);
  setStatus('DIFFICULTY '+d+' — NEW MAZES GENERATED');
};

window._mistGetState=function() { return MIST; };

// ── Init ───────────────────────────────────────────────────────────────────
if(document.readyState==='loading') {
  document.addEventListener('DOMContentLoaded',buildPanel);
} else {
  buildPanel();
}

})();
