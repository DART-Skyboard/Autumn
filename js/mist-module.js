// ═══════════════════════════════════════════════════════════════════════════
//  MIST MODULE — Autumn HUD right-side collapsible panel
//  Lead Edge Ash Tree Reflex maze logic · THREE.js volumetric effects
//  Module: Mist | Slots: ★ Star · ♥ Heart · Mist
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  var MIST = {
    open: false,
    difficulty: 1,        // 1 easy · 2 medium · 3 hard
    mazes: [null,null,null], // generated maze per slot
    solvedCount: 0,       // 0=none 1=star unlocked 2=heart unlocked 3=mist unlocked
    dragging: false,
    dragPos: null,
    dragPath: [],
    activeMaze: 0,        // which slot is being played (0=star,1=heart,2=mist)
    threeScene: null,
    threeRenderer: null,
    threeCamera: null,
    threeAnimId: null
  };

  var DIFF = {
    1: {w:7,  h:7,  label:'I'},
    2: {w:11, h:11, label:'II'},
    3: {w:15, h:15, label:'III'}
  };

  // ── LEMAC maze generator (LEATR rules) ────────────────────────────────────
  // DFS with randomized neighbours. Entry/exit on random sides, ≥1 cell apart.
  function generateMaze(w, h) {
    // grid[y][x] = {n,s,e,w} walls
    var grid = [];
    for (var y=0;y<h;y++) {
      grid[y]=[];
      for (var x=0;x<w;x++) grid[y][x]={n:1,s:1,e:1,w:1,visited:false};
    }
    // DFS
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
    // Pick entry/exit on random sides, at least 1 apart if same side
    function pickSide() { return ['n','s','e','w'][Math.floor(Math.random()*4)]; }
    function posOnSide(side) {
      if(side==='n'||side==='s') return Math.floor(Math.random()*w);
      return Math.floor(Math.random()*h);
    }
    function cellOnSide(side,pos) {
      if(side==='n') return {x:pos,y:0};
      if(side==='s') return {x:pos,y:h-1};
      if(side==='w') return {x:0,y:pos};
      return {x:w-1,y:pos};
    }
    var entrySide=pickSide(), entryPos=posOnSide(entrySide);
    var exitSide, exitPos;
    var attempts=0;
    do {
      exitSide=pickSide();
      exitPos=posOnSide(exitSide);
      attempts++;
    } while(attempts<20&&exitSide===entrySide&&Math.abs(exitPos-entryPos)<2);
    var entry=cellOnSide(entrySide,entryPos);
    var exit=cellOnSide(exitSide,exitPos);
    // Open entry/exit walls
    grid[entry.y][entry.x][entrySide]=0;
    grid[exit.y][exit.x][exitSide]=0;
    return {grid,w,h,entry,exit,entrySide,exitSide};
  }

  // ── BFS pathfinding for validation ────────────────────────────────────────
  function solveMaze(maze) {
    var visited=[], queue=[{x:maze.entry.x,y:maze.entry.y,path:[{x:maze.entry.x,y:maze.entry.y}]}];
    var key=function(x,y){return x+','+y;};
    var seen={}; seen[key(maze.entry.x,maze.entry.y)]=true;
    var dirs={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
    while(queue.length){
      var cur=queue.shift();
      if(cur.x===maze.exit.x&&cur.y===maze.exit.y) return cur.path;
      var cell=maze.grid[cur.y][cur.x];
      Object.keys(dirs).forEach(function(d){
        if(cell[d]===0){
          var nx=cur.x+dirs[d][0], ny=cur.y+dirs[d][1];
          if(nx>=0&&nx<maze.w&&ny>=0&&ny<maze.h&&!seen[key(nx,ny)]){
            seen[key(nx,ny)]=true;
            queue.push({x:nx,y:ny,path:cur.path.concat({x:nx,y:ny})});
          }
        }
      });
    }
    return null;
  }

  // ── CSS injection ─────────────────────────────────────────────────────────
  function injectCSS() {
    var style=document.createElement('style');
    style.textContent=[
    '#mist-toggle{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:8200;',
    'background:rgba(3,9,18,.92);border:1px solid rgba(0,229,255,.2);border-right:none;',
    'border-radius:6px 0 0 6px;padding:8px 5px;cursor:pointer;display:flex;flex-direction:column;',
    'gap:6px;align-items:center;transition:all .2s}',
    '#mist-toggle:hover{border-color:rgba(0,229,255,.4);background:rgba(0,229,255,.06)}',
    '.mist-slot-icon{width:24px;height:24px;display:flex;align-items:center;justify-content:center;',
    'font-size:14px;opacity:.35;transition:all .3s;position:relative}',
    '.mist-slot-icon.unlocked{opacity:1;filter:drop-shadow(0 0 4px var(--cyan))}',
    '.mist-slot-icon.locked{opacity:.2}',
    '.mist-slot-icon .lock-dot{position:absolute;bottom:-2px;right:-2px;width:6px;height:6px;',
    'border-radius:50%;background:#ff4466;border:1px solid #0a0f18}',
    '#mist-panel{position:fixed;right:0;top:0;height:100vh;width:280px;z-index:8100;',
    'background:rgba(3,9,18,.97);border-left:1px solid rgba(0,229,255,.2);',
    'transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);',
    'display:flex;flex-direction:column;backdrop-filter:blur(12px)}',
    '#mist-panel.open{transform:translateX(0)}',
    '#mist-header{padding:12px 14px;border-bottom:1px solid rgba(0,229,255,.12);',
    'display:flex;align-items:center;gap:10px;flex-shrink:0}',
    '.mist-title{font-family:var(--font-d);font-size:.6rem;letter-spacing:4px;color:var(--cyan)}',
    '.mist-close{margin-left:auto;background:transparent;border:none;color:rgba(0,229,255,.4);',
    'font-size:16px;cursor:pointer;padding:2px 6px;transition:color .2s}',
    '.mist-close:hover{color:var(--cyan)}',
    '#mist-slots{display:flex;gap:0;border-bottom:1px solid rgba(0,229,255,.1);flex-shrink:0}',
    '.mist-slot-tab{flex:1;padding:8px;text-align:center;cursor:pointer;',
    'font-family:var(--font-d);font-size:.35rem;letter-spacing:1.5px;',
    'color:rgba(224,244,255,.3);border-bottom:2px solid transparent;transition:all .2s}',
    '.mist-slot-tab.active{color:var(--cyan);border-bottom-color:var(--cyan);',
    'background:rgba(0,229,255,.04)}',
    '.mist-slot-tab.locked-tab{cursor:not-allowed;opacity:.3}',
    '.mist-slot-tab .tab-icon{font-size:16px;display:block;margin-bottom:2px}',
    '#mist-diff-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;',
    'border-bottom:1px solid rgba(0,229,255,.08);flex-shrink:0}',
    '.diff-label{font-family:var(--font-d);font-size:.32rem;letter-spacing:2px;color:rgba(224,244,255,.3)}',
    '.diff-btn{background:transparent;border:1px solid rgba(0,229,255,.15);',
    'color:rgba(0,229,255,.4);padding:3px 8px;border-radius:3px;cursor:pointer;',
    'font-family:var(--font-d);font-size:.32rem;letter-spacing:1px;transition:all .15s}',
    '.diff-btn.active{border-color:var(--cyan);color:var(--cyan);background:rgba(0,229,255,.1)}',
    '#mist-maze-wrap{flex:1;display:flex;align-items:center;justify-content:center;',
    'position:relative;overflow:hidden;padding:10px}',
    '#mist-maze-canvas{touch-action:none;cursor:crosshair;display:block;',
    'border:1px solid rgba(0,229,255,.15);border-radius:4px}',
    '#mist-status{padding:8px 12px;font-family:var(--font-d);font-size:.35rem;',
    'letter-spacing:2px;color:rgba(224,244,255,.3);text-align:center;flex-shrink:0;',
    'border-top:1px solid rgba(0,229,255,.08);min-height:32px}',
    '#mist-three-canvas{position:fixed;top:0;left:0;width:100%;height:100%;',
    'pointer-events:none;z-index:7999;opacity:0;transition:opacity .5s}',
    '#mist-three-canvas.active{opacity:1}',
    '@keyframes mistPulse{0%,100%{opacity:.6}50%{opacity:1}}'
    ].join('');
    document.head.appendChild(style);
  }

  // ── HTML injection ────────────────────────────────────────────────────────
  function injectHTML() {
    // Toggle button on right edge
    var toggle=document.createElement('div');
    toggle.id='mist-toggle';
    toggle.innerHTML=[
      '<div class="mist-slot-icon" id="mst-i0" title="Star">★</div>',
      '<div class="mist-slot-icon locked" id="mst-i1" title="Heart — solve Star maze first">♥<div class="lock-dot"></div></div>',
      '<div class="mist-slot-icon locked" id="mst-i2" title="Mist — solve Heart maze first">◈<div class="lock-dot"></div></div>'
    ].join('');
    toggle.onclick=function(){ mistToggle(); };
    document.body.appendChild(toggle);

    // Side panel
    var panel=document.createElement('div');
    panel.id='mist-panel';
    panel.innerHTML=[
      '<div id="mist-header">',
      '  <span class="mist-title">◈ MIST</span>',
      '  <span style="font-family:var(--font-d);font-size:.32rem;letter-spacing:1.5px;color:rgba(0,229,255,.3)">LEAD EDGE MAZE</span>',
      '  <button class="mist-close" onclick="mistToggle()">✕</button>',
      '</div>',
      '<div id="mist-slots">',
      '  <div class="mist-slot-tab active" id="mst-tab0" onclick="mistSetSlot(0)"><span class="tab-icon">★</span>STAR</div>',
      '  <div class="mist-slot-tab locked-tab" id="mst-tab1" onclick="mistSetSlot(1)"><span class="tab-icon">♥</span>HEART</div>',
      '  <div class="mist-slot-tab locked-tab" id="mst-tab2" onclick="mistSetSlot(2)"><span class="tab-icon">◈</span>MIST</div>',
      '</div>',
      '<div id="mist-diff-bar">',
      '  <span class="diff-label">DIFFICULTY:</span>',
      '  <button class="diff-btn active" id="mst-d1" onclick="mistSetDiff(1)">I</button>',
      '  <button class="diff-btn" id="mst-d2" onclick="mistSetDiff(2)">II</button>',
      '  <button class="diff-btn" id="mst-d3" onclick="mistSetDiff(3)">III</button>',
      '  <button onclick="mistNewMaze()" style="margin-left:auto;background:rgba(0,229,255,.06);',
      '    border:1px solid rgba(0,229,255,.2);color:var(--cyan);padding:3px 10px;border-radius:3px;',
      '    cursor:pointer;font-family:var(--font-d);font-size:.32rem;letter-spacing:1px">NEW</button>',
      '</div>',
      '<div id="mist-maze-wrap"><canvas id="mist-maze-canvas"></canvas></div>',
      '<div id="mist-status">DRAG THE CIRCLE FROM ENTRY ▸ TO EXIT ◂</div>'
    ].join('');
    document.body.appendChild(panel);

    // THREE.js overlay canvas for effects
    var threeCanvas=document.createElement('canvas');
    threeCanvas.id='mist-three-canvas';
    document.body.appendChild(threeCanvas);
  }

  // ── Toggle panel ──────────────────────────────────────────────────────────
  window.mistToggle = function() {
    MIST.open=!MIST.open;
    var panel=document.getElementById('mist-panel');
    if(panel) panel.classList.toggle('open',MIST.open);
    if(MIST.open && !MIST.mazes[MIST.activeMaze]) mistNewMaze();
  };

  window.mistSetDiff = function(d) {
    MIST.difficulty=d;
    [1,2,3].forEach(function(n){
      var b=document.getElementById('mst-d'+n);
      if(b) b.classList.toggle('active',n===d);
    });
    MIST.mazes=[null,null,null];
    mistNewMaze();
  };

  window.mistSetSlot = function(slot) {
    if(slot>0 && MIST.solvedCount<slot) return; // locked
    MIST.activeMaze=slot;
    [0,1,2].forEach(function(i){
      var t=document.getElementById('mst-tab'+i);
      if(t) t.classList.toggle('active',i===slot);
    });
    if(!MIST.mazes[slot]) mistNewMaze();
    else renderMaze(MIST.mazes[slot]);
    setStatus('DRAG THE CIRCLE FROM ENTRY ▸ TO EXIT ◂');
  };

  window.mistNewMaze = function() {
    var cfg=DIFF[MIST.difficulty];
    var maze=generateMaze(cfg.w, cfg.h);
    maze.solved=false;
    maze.solution=solveMaze(maze);
    MIST.mazes[MIST.activeMaze]=maze;
    MIST.dragPath=[];
    MIST.dragging=false;
    renderMaze(maze);
    setStatus('DRAG THE CIRCLE FROM ENTRY ▸ TO EXIT ◂');
  };

  // ── Maze renderer on canvas ───────────────────────────────────────────────
  function renderMaze(maze, dragPath) {
    var canvas=document.getElementById('mist-maze-canvas');
    if(!canvas) return;
    var wrap=document.getElementById('mist-maze-wrap');
    var maxW=wrap.clientWidth-20, maxH=wrap.clientHeight-20;
    var cellSize=Math.max(8,Math.min(Math.floor(maxW/maze.w),Math.floor(maxH/maze.h),32));
    var pw=cellSize*maze.w, ph=cellSize*maze.h;
    canvas.width=pw; canvas.height=ph;
    var ctx=canvas.getContext('2d');
    ctx.fillStyle='#020608'; ctx.fillRect(0,0,pw,ph);

    // Draw walls
    ctx.strokeStyle='rgba(0,229,255,.7)'; ctx.lineWidth=1.5;
    for(var y=0;y<maze.h;y++){
      for(var x=0;x<maze.w;x++){
        var cell=maze.grid[y][x];
        var px=x*cellSize, py=y*cellSize;
        if(cell.n){ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+cellSize,py);ctx.stroke();}
        if(cell.s){ctx.beginPath();ctx.moveTo(px,py+cellSize);ctx.lineTo(px+cellSize,py+cellSize);ctx.stroke();}
        if(cell.w){ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,py+cellSize);ctx.stroke();}
        if(cell.e){ctx.beginPath();ctx.moveTo(px+cellSize,py);ctx.lineTo(px+cellSize,py+cellSize);ctx.stroke();}
      }
    }

    // Draw entry marker
    var ex=maze.entry.x*cellSize+cellSize/2, ey=maze.entry.y*cellSize+cellSize/2;
    ctx.fillStyle='rgba(0,255,136,.8)'; ctx.font='bold 10px monospace'; ctx.textAlign='center';
    ctx.fillText('▸',ex,ey+4);

    // Draw exit marker
    var xx=maze.exit.x*cellSize+cellSize/2, xy=maze.exit.y*cellSize+cellSize/2;
    ctx.fillStyle='rgba(0,229,255,.8)';
    ctx.fillText('◂',xx,xy+4);

    // Draw drag path
    if(dragPath && dragPath.length>1){
      ctx.strokeStyle='rgba(0,255,136,.5)'; ctx.lineWidth=cellSize*0.3;
      ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(dragPath[0].x*cellSize+cellSize/2,dragPath[0].y*cellSize+cellSize/2);
      dragPath.forEach(function(p){ ctx.lineTo(p.x*cellSize+cellSize/2,p.y*cellSize+cellSize/2); });
      ctx.stroke();
    }

    // Draw player circle at current drag position
    if(MIST.dragging && MIST.dragPos){
      ctx.beginPath();
      ctx.arc(MIST.dragPos.x*cellSize+cellSize/2, MIST.dragPos.y*cellSize+cellSize/2,
              cellSize*0.38, 0, Math.PI*2);
      ctx.fillStyle='rgba(0,255,136,.9)'; ctx.fill();
      ctx.strokeStyle='#00ff88'; ctx.lineWidth=1.5; ctx.stroke();
    } else if(!MIST.dragging){
      // Draw circle at entry
      ctx.beginPath();
      ctx.arc(ex, ey, cellSize*0.38, 0, Math.PI*2);
      ctx.fillStyle='rgba(0,255,136,.6)'; ctx.fill();
      ctx.strokeStyle='#00ff88'; ctx.lineWidth=1.5; ctx.stroke();
    }
  }

  // ── Touch/mouse drag handler ──────────────────────────────────────────────
  function canvasToCell(canvas, maze, ex, ey) {
    var rect=canvas.getBoundingClientRect();
    var cellSize=canvas.width/maze.w;
    var cx=Math.floor((ex-rect.left)/rect.width*canvas.width/cellSize);
    var cy=Math.floor((ey-rect.top)/rect.height*canvas.height/cellSize);
    return {x:Math.max(0,Math.min(maze.w-1,cx)), y:Math.max(0,Math.min(maze.h-1,cy))};
  }

  function onDragStart(e) {
    var maze=MIST.mazes[MIST.activeMaze]; if(!maze||maze.solved) return;
    e.preventDefault();
    var pt=e.touches?e.touches[0]:e;
    var cell=canvasToCell(this,maze,pt.clientX,pt.clientY);
    // Must start at entry cell
    if(cell.x===maze.entry.x && cell.y===maze.entry.y){
      MIST.dragging=true; MIST.dragPos=cell; MIST.dragPath=[cell];
      setStatus('NAVIGATE TO THE EXIT ◂');
    }
    renderMaze(maze, MIST.dragPath);
  }

  function onDragMove(e) {
    if(!MIST.dragging) return;
    e.preventDefault();
    var maze=MIST.mazes[MIST.activeMaze]; if(!maze) return;
    var pt=e.touches?e.touches[0]:e;
    var cell=canvasToCell(this,maze,pt.clientX,pt.clientY);
    var prev=MIST.dragPath[MIST.dragPath.length-1];
    if(cell.x===prev.x && cell.y===prev.y) return;
    // Check movement is through an open wall
    var dx=cell.x-prev.x, dy=cell.y-prev.y;
    if(Math.abs(dx)+Math.abs(dy)!==1) return; // only adjacent cells
    var wallDir=dx===1?'e':dx===-1?'w':dy===1?'s':'n';
    if(maze.grid[prev.y][prev.x][wallDir]!==0) return; // wall blocks
    // Check if we're backtracking
    if(MIST.dragPath.length>=2){
      var pp=MIST.dragPath[MIST.dragPath.length-2];
      if(cell.x===pp.x&&cell.y===pp.y){MIST.dragPath.pop();}
      else { MIST.dragPath.push(cell); }
    } else { MIST.dragPath.push(cell); }
    MIST.dragPos=cell;
    // Check win
    if(cell.x===maze.exit.x&&cell.y===maze.exit.y){
      MIST.dragging=false; maze.solved=true;
      onMazeSolved(MIST.activeMaze, maze);
    } else {
      renderMaze(maze, MIST.dragPath);
    }
  }

  function onDragEnd(e) {
    if(!MIST.dragging) return;
    MIST.dragging=false;
    var maze=MIST.mazes[MIST.activeMaze];
    if(maze&&!maze.solved){ MIST.dragPath=[]; renderMaze(maze,[]); setStatus('DRAG THE CIRCLE FROM ENTRY ▸ TO EXIT ◂'); }
  }

  function bindCanvasEvents() {
    var canvas=document.getElementById('mist-maze-canvas');
    if(!canvas) return;
    canvas.addEventListener('mousedown',  onDragStart.bind(canvas));
    canvas.addEventListener('mousemove',  onDragMove.bind(canvas));
    canvas.addEventListener('mouseup',    onDragEnd.bind(canvas));
    canvas.addEventListener('touchstart', onDragStart.bind(canvas), {passive:false});
    canvas.addEventListener('touchmove',  onDragMove.bind(canvas),  {passive:false});
    canvas.addEventListener('touchend',   onDragEnd.bind(canvas),   {passive:false});
  }

  // ── Solve celebration ─────────────────────────────────────────────────────
  function onMazeSolved(slot, maze) {
    var icons=['★','♥','◈'];
    var labels=['STAR UNLOCKED ★','HEART UNLOCKED ♥','MIST UNLOCKED ◈'];
    setStatus('✓ SOLVED! ' + labels[slot]);
    MIST.solvedCount=Math.max(MIST.solvedCount, slot+1);

    // Render solved state
    renderMaze(maze, MIST.dragPath);

    // Unlock next slot
    if(slot+1<=2){
      var nextTab=document.getElementById('mst-tab'+(slot+1));
      if(nextTab) nextTab.classList.remove('locked-tab');
      var nextIcon=document.getElementById('mst-i'+(slot+1));
      if(nextIcon){
        nextIcon.classList.remove('locked');
        var dot=nextIcon.querySelector('.lock-dot');
        if(dot) dot.remove();
      }
      document.getElementById('mst-i'+slot)&&document.getElementById('mst-i'+slot).classList.add('unlocked');
    }

    // Fire THREE.js effect based on slot
    setTimeout(function(){ fireMistEffect(slot); }, 300);
  }

  // ── THREE.js volumetric effects ───────────────────────────────────────────
  function initThree() {
    if(MIST.threeScene || typeof THREE==='undefined') return;
    var canvas=document.getElementById('mist-three-canvas');
    if(!canvas) return;
    canvas.width=window.innerWidth; canvas.height=window.innerHeight;
    MIST.threeScene=new THREE.Scene();
    MIST.threeCamera=new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,.1,1000);
    MIST.threeCamera.position.set(0,0,20);
    MIST.threeRenderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:true});
    MIST.threeRenderer.setClearColor(0x000000,0);
    MIST.threeRenderer.setSize(window.innerWidth,window.innerHeight);
  }

  function fireMistEffect(slot) {
    initThree();
    if(!MIST.threeScene) return;
    var canvas=document.getElementById('mist-three-canvas');
    canvas.classList.add('active');

    // Clear old objects
    while(MIST.threeScene.children.length) MIST.threeScene.remove(MIST.threeScene.children[0]);

    var objects=[];
    var count=slot===0?24:slot===1?18:30;

    if(slot===0) {
      // ★ Star burst — volumetric wireframe stars fly out
      for(var i=0;i<count;i++){
        var geo=new THREE.OctahedronGeometry(0.3+Math.random()*0.4,0);
        var mat=new THREE.MeshBasicMaterial({color:0xffdd00,wireframe:true,opacity:.8,transparent:true});
        var mesh=new THREE.Mesh(geo,mat);
        var angle=Math.random()*Math.PI*2;
        var spd=0.08+Math.random()*0.15;
        mesh.position.set((Math.random()-.5)*4,(Math.random()-.5)*4,Math.random()*2);
        mesh._vel={x:Math.cos(angle)*spd,y:Math.sin(angle)*spd,z:(Math.random()-.5)*.05};
        mesh._rot={x:Math.random()*.05,y:Math.random()*.05};
        objects.push(mesh); MIST.threeScene.add(mesh);
      }
    } else if(slot===1) {
      // ♥ Heart — pink/red spheres in heart formation
      for(var i=0;i<count;i++){
        var t=i/count*Math.PI*2;
        var hx=16*Math.pow(Math.sin(t),3)/8;
        var hy=(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/8;
        var geo=new THREE.SphereGeometry(.15+Math.random()*.1,8,8);
        var mat=new THREE.MeshBasicMaterial({color:0xff4488,wireframe:true,opacity:.7,transparent:true});
        var mesh=new THREE.Mesh(geo,mat);
        mesh.position.set(hx,hy,0);
        mesh._vel={x:(Math.random()-.5)*.02,y:(Math.random()-.5)*.02,z:0};
        mesh._rot={x:0,y:0,z:Math.random()*.03};
        objects.push(mesh); MIST.threeScene.add(mesh);
      }
    } else {
      // ◈ Mist — cyan particle cloud swirling
      for(var i=0;i<count;i++){
        var r=2+Math.random()*4;
        var theta=Math.random()*Math.PI*2;
        var phi=Math.random()*Math.PI;
        var geo=new THREE.TetrahedronGeometry(.2+Math.random()*.3,0);
        var mat=new THREE.MeshBasicMaterial({color:0x00e5ff,wireframe:true,opacity:.5,transparent:true});
        var mesh=new THREE.Mesh(geo,mat);
        mesh.position.set(r*Math.sin(phi)*Math.cos(theta),r*Math.sin(phi)*Math.sin(theta),r*Math.cos(phi));
        var swirl=.04;
        mesh._vel={x:-Math.sin(theta)*swirl,y:Math.cos(theta)*swirl,z:(Math.random()-.5)*.02};
        mesh._rot={x:Math.random()*.04,y:Math.random()*.04};
        objects.push(mesh); MIST.threeScene.add(mesh);
      }
    }

    var t=0, maxT=120;
    if(MIST.threeAnimId) cancelAnimationFrame(MIST.threeAnimId);
    function animate(){
      t++;
      objects.forEach(function(o){
        o.position.x+=o._vel.x; o.position.y+=o._vel.y; o.position.z+=o._vel.z;
        o.rotation.x+=o._rot.x; o.rotation.y+=o._rot.y;
        o.material.opacity=0.8*(1-t/maxT);
        if(slot===2){ o.position.x+=Math.sin(t*.05+o.position.z)*.02; }
      });
      MIST.threeRenderer.render(MIST.threeScene,MIST.threeCamera);
      if(t<maxT){ MIST.threeAnimId=requestAnimationFrame(animate); }
      else{
        canvas.classList.remove('active');
        while(MIST.threeScene.children.length) MIST.threeScene.remove(MIST.threeScene.children[0]);
      }
    }
    animate();
  }

  // ── Status line ───────────────────────────────────────────────────────────
  function setStatus(msg) {
    var el=document.getElementById('mist-status'); if(el) el.textContent=msg;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectCSS();
    injectHTML();
    // Bind canvas events after panel is open (resize needed)
    document.addEventListener('click',function(e){
      if(e.target&&e.target.closest&&e.target.closest('#mist-panel')){
        setTimeout(function(){ bindCanvasEvents(); },50);
      }
    });
    // Also bind on first open
    var _origToggle=window.mistToggle;
    window.mistToggle=function(){
      _origToggle();
      setTimeout(function(){
        bindCanvasEvents();
        if(MIST.open&&!MIST.mazes[MIST.activeMaze]) mistNewMaze();
      },50);
    };
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  } else { init(); }

})();
