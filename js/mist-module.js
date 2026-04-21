// ═══════════════════════════════════════════════════════════════════════════
//  MIST MODULE — Autumn frosted-glass overlay maze
//  Lead Edge Ash Tree Reflex
//  On solve → drives BRPN buoyancy network (pulseShells/applyOrbEmotion/etc)
//  Multi-user → writes to ashtree/mist/{uid}.json via writeLeatrAshMemory
//              → polls every 12s for other users' mist events → reacts
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
    sphereTarget: null,
    sphereActual: null,
    sphereAnimId: null,
    lastRemoteTs: {}   // uid → last seen ts to debounce duplicate fires
  };

  var DIFF = { 1:{w:5,h:5}, 2:{w:9,h:9}, 3:{w:13,h:13} };

  // Slot → BRPN network reaction profile
  var SLOT_PROFILE = {
    0: { emotion:'inspired',   pulse:1.4, speed:1.25, shellBoost:[0.08,0.06,0.04], label:'★ STAR SOLVED' },
    1: { emotion:'empathetic', pulse:1.6, speed:1.1,  shellBoost:[0.05,0.10,0.06], label:'♥ HEART SOLVED' },
    2: { emotion:'spiritual',  pulse:1.0, speed:0.8,  shellBoost:[0.12,0.08,0.10], label:'◈ MIST SOLVED'  }
  };

  // ── Lead Edge pixel-grid maze generator ─────────────────────────────────
  // Produces a W×H pixel grid (1=wall, 0=path).
  // Solid perimeter with exactly 2 openings.
  // Iterative DFS backtracker at 2-cell steps → branching dead-end corridors.
  //
  // ENTRY/EXIT RULES (enforced every iteration):
  //   Rule A — Different sides: openings are always on different perimeter sides.
  //   Rule B — No line-of-sight: openings must never share a straight corridor
  //             that connects them without at least one turn.
  //   Rule C — Same-side guard (fallback): if somehow same side, ≥3 pixel gap
  //             AND an interior sub-branch wall must sit between them on the
  //             inner perimeter path (enforced by construction, same-side is
  //             actually rejected and re-rolled).
  //   Rule D — After carving the DFS interior, the first interior cell inward
  //             from each opening must be a dead-end or require a turn before
  //             the two inner paths can even meet — guaranteed by placing a
  //             mandatory wall segment between them on the shared perimeter
  //             corridor whenever openings are on adjacent sides and their
  //             inner entry cells would form a straight corridor.
  function generateMaze(W, H) {
    // Enforce odd dimensions for correct 2-step backtracker coverage
    if (W % 2 === 0) W++;
    if (H % 2 === 0) H++;

    function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo)); }
    function shuffle(arr) {
      for (var i=arr.length-1;i>0;i--){var j=rnd(0,i+1),t=arr[i];arr[i]=arr[j];arr[j]=t;}
      return arr;
    }

    var inMap = {n:{dx:0,dy:1},s:{dx:0,dy:-1},e:{dx:-1,dy:0},w:{dx:1,dy:0}};
    var oppMap = {n:'s',s:'n',e:'w',w:'e'};
    var adjMap = {n:['e','w'],s:['e','w'],e:['n','s'],w:['n','s']};
    var sideList = ['n','s','e','w'];

    // Opening positions land on odd indices so they align with carved interior cells
    function oddPositions(len) {
      var a=[]; for(var i=1;i<len-1;i+=2) a.push(i); return a;
    }
    function openingCell(s,p){
      if(s==='n')return{x:p,y:0};if(s==='s')return{x:p,y:H-1};
      if(s==='w')return{x:0,y:p};return{x:W-1,y:p};
    }
    // Inner cell one step from opening
    function innerCell(s,p){
      var im=inMap[s];
      var oc=openingCell(s,p);
      return {x:Math.max(1,Math.min(W-2,oc.x+im.dx)), y:Math.max(1,Math.min(H-2,oc.y+im.dy))};
    }

    // Check line-of-sight between two inner cells on the perimeter corridor.
    // Two inner cells are "in sight" if they share the same row or column AND
    // all cells between them along that axis are open (i.e. no wall break).
    // Since the grid isn't carved yet at selection time, we check purely by
    // position: same row/col means they're co-linear going into the maze —
    // we reject this regardless.
    function hasLineOfSight(s1, p1, s2, p2) {
      var ic1 = innerCell(s1, p1);
      var ic2 = innerCell(s2, p2);
      // Same column (both openings pierce the same vertical corridor)
      if (ic1.x === ic2.x) return true;
      // Same row (both openings pierce the same horizontal corridor)
      if (ic1.y === ic2.y) return true;
      return false;
    }

    // Pick valid entry/exit opening pair with retry loop
    var s1, s2, p1, p2;
    var MAX_TRIES = 200;
    for (var attempt = 0; attempt < MAX_TRIES; attempt++) {
      s1 = sideList[rnd(0, 4)];
      // Always different sides (never same side — eliminates same-side edge case entirely)
      var candidates = [oppMap[s1]].concat(adjMap[s1]);
      s2 = candidates[rnd(0, candidates.length)];

      var e1pos = oddPositions((s1==='n'||s1==='s') ? W : H);
      var e2pos = oddPositions((s2==='n'||s2==='s') ? W : H);
      if (!e1pos.length || !e2pos.length) continue;

      p1 = e1pos[rnd(0, e1pos.length)];
      p2 = e2pos[rnd(0, e2pos.length)];

      // Reject if inner cells are co-linear (line of sight)
      if (hasLineOfSight(s1, p1, s2, p2)) continue;

      // For adjacent sides: also ensure the inner cells are NOT adjacent to each
      // other (would allow a single-turn immediate connection on the perimeter)
      var ic1 = innerCell(s1, p1);
      var ic2 = innerCell(s2, p2);
      var manDist = Math.abs(ic1.x - ic2.x) + Math.abs(ic1.y - ic2.y);
      if (manDist < 3) continue;   // too close — player could see the corner

      break; // valid pair found
    }

    // Build grid
    var grid = [];
    for (var y = 0; y < H; y++) {
      grid[y] = [];
      for (var x = 0; x < W; x++) grid[y][x] = 1;
    }
    function carve(x, y) { if (x>=0&&x<W&&y>=0&&y<H) grid[y][x] = 0; }
    function isOpen(x, y) { return x>=0&&x<W&&y>=0&&y<H&&grid[y][x]===0; }

    var entry = openingCell(s1, p1);
    var exit  = openingCell(s2, p2);
    carve(entry.x, entry.y);
    carve(exit.x,  exit.y);

    // Start carving 1 step inward from entry
    var im = inMap[s1];
    var sx = Math.max(1, Math.min(W-2, entry.x + im.dx));
    var sy = Math.max(1, Math.min(H-2, entry.y + im.dy));

    // Iterative DFS backtracker — 2-cell steps through interior
    var visited = [];
    for (var vy=0; vy<H; vy++) { visited[vy]=[]; for (var vx=0; vx<W; vx++) visited[vy][vx]=0; }
    carve(sx, sy); visited[sy][sx] = 1;
    var stack = [{x:sx, y:sy}];
    var DIRS = [{dx:0,dy:-2},{dx:0,dy:2},{dx:-2,dy:0},{dx:2,dy:0}];

    while (stack.length) {
      var cur = stack[stack.length-1];
      var ds = shuffle(DIRS.slice());
      var moved = false;
      for (var di=0; di<ds.length; di++) {
        var nx = cur.x+ds[di].dx, ny = cur.y+ds[di].dy;
        var mxc = cur.x+ds[di].dx/2, myc = cur.y+ds[di].dy/2;
        if (nx<1||nx>W-2||ny<1||ny>H-2||visited[ny][nx]) continue;
        carve(mxc, myc); carve(nx, ny); visited[ny][nx] = 1;
        stack.push({x:nx, y:ny}); moved = true; break;
      }
      if (!moved) stack.pop();
    }

    // Guarantee exit is reachable: BFS from entry; if disconnected carve bridge
    function bfsPath(bx,by,tx,ty){
      var q=[{x:bx,y:by,path:[{x:bx,y:by}]}],seen={};
      seen[bx+','+by]=true;
      var D4=[{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
      while(q.length){
        var c=q.shift();
        if(c.x===tx&&c.y===ty)return c.path;
        for(var i=0;i<4;i++){
          var nnx=c.x+D4[i].dx,nny=c.y+D4[i].dy,k=nnx+','+nny;
          if(!seen[k]&&isOpen(nnx,nny)){seen[k]=true;q.push({x:nnx,y:nny,path:c.path.concat([{x:nnx,y:nny}])});}
        }
      }
      return null;
    }
    var solPath = bfsPath(entry.x, entry.y, exit.x, exit.y);
    if (!solPath) {
      var exIn = inMap[s2];
      var ex2x = Math.max(1, Math.min(W-2, exit.x + exIn.dx));
      var ex2y = Math.max(1, Math.min(H-2, exit.y + exIn.dy));
      carve(ex2x, ex2y);
      solPath = bfsPath(entry.x, entry.y, exit.x, exit.y) || [entry];
    }

    // Final line-of-sight enforcement pass on the carved grid:
    // Walk outward from each opening along its inner corridor. If a straight
    // unbroken open path connects the two inner entry points without turning,
    // plant a wall midway to force at least one turn. This covers the rare
    // case where DFS happened to carve a straight shot between them.
    (function enforceNoStraightShot(){
      var ic1 = innerCell(s1, p1);
      var ic2 = innerCell(s2, p2);
      if (ic1.x === ic2.x) {
        // Same column — plant a wall in the middle of that column between them
        var minY = Math.min(ic1.y, ic2.y) + 1;
        var maxY = Math.max(ic1.y, ic2.y) - 1;
        if (minY <= maxY) {
          var midY = minY + Math.floor((maxY - minY) / 2);
          grid[midY][ic1.x] = 1; // block
        }
      } else if (ic1.y === ic2.y) {
        var minX = Math.min(ic1.x, ic2.x) + 1;
        var maxX = Math.max(ic1.x, ic2.x) - 1;
        if (minX <= maxX) {
          var midX = minX + Math.floor((maxX - minX) / 2);
          grid[ic1.y][midX] = 1; // block
        }
      }
    })();

    // Re-check connectivity after enforcement pass
    solPath = bfsPath(entry.x, entry.y, exit.x, exit.y);
    if (!solPath) {
      var exIn2 = inMap[s2];
      carve(Math.max(1,Math.min(W-2,exit.x+exIn2.dx)), Math.max(1,Math.min(H-2,exit.y+exIn2.dy)));
      solPath = bfsPath(entry.x, entry.y, exit.x, exit.y) || [entry];
    }

    return {
      grid:     grid,
      W:        W,
      H:        H,
      entry:    entry,
      exit:     exit,
      s1:       s1,
      s2:       s2,
      solution: solPath,
      solved:   false
    };
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  function injectCSS(){
    var s=document.createElement('style');
    s.textContent=[
      // Trigger tab — upper right, over 3JS
      '#mist-trigger{position:fixed;right:0;top:148px;z-index:9500;display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 5px;',
        'background:rgba(2,6,14,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
        'border:1px solid rgba(0,229,255,.22);border-right:none;border-radius:7px 0 0 7px;cursor:pointer;transition:all .2s}',
      '#mist-trigger:hover{background:rgba(0,229,255,.07);border-color:rgba(0,229,255,.45)}',
      '.mt-icon{width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:11px;transition:all .3s}',
      '.mt-icon.mi-active{filter:drop-shadow(0 0 4px #00e5ff);opacity:1}',
      '.mt-icon.mi-locked{opacity:.14}',
      '.mt-icon.mi-ready{opacity:.6}',
      // Panel — frosted glass
      '#mist-overlay{position:fixed;right:36px;top:140px;z-index:9400;width:min(250px,calc(100vw - 48px));display:flex;flex-direction:column;',
        'transform:translateX(calc(100% + 44px));transition:transform .32s cubic-bezier(.23,1,.32,1),opacity .32s;opacity:0;pointer-events:none}',
      '#mist-overlay.mist-open{transform:translateX(0);opacity:1;pointer-events:all}',
      // Frosted glass menu
      '#mist-menu{background:rgba(4,10,22,.52);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'border:1px solid rgba(0,229,255,.2);border-bottom:none;border-radius:7px 7px 0 0;padding:7px 9px 5px;display:flex;flex-direction:column;gap:5px}',
      '#mist-head-row{display:flex;align-items:center;gap:7px}',
      '.mist-lbl{font-family:var(--font-d,monospace);font-size:.42rem;letter-spacing:3px;color:rgba(0,229,255,.9);text-shadow:0 0 7px rgba(0,229,255,.45)}',
      '.mist-sub{font-family:var(--font-d,monospace);font-size:.27rem;letter-spacing:2px;color:rgba(0,229,255,.35)}',
      '#mist-x{margin-left:auto;background:none;border:none;color:rgba(0,229,255,.3);font-size:12px;cursor:pointer;padding:2px 4px;transition:color .2s;line-height:1}',
      '#mist-x:hover{color:rgba(0,229,255,.8)}',
      '#mist-tabs{display:flex;gap:3px}',
      '.mst-tab{flex:1;padding:4px 3px;text-align:center;cursor:pointer;font-family:var(--font-d,monospace);font-size:.27rem;letter-spacing:1.5px;',
        'color:rgba(255,255,255,.22);border:1px solid rgba(0,229,255,.08);border-radius:3px;background:transparent;transition:all .18s}',
      '.mst-tab .ti{font-size:10px;display:block;margin-bottom:1px}',
      '.mst-tab.mst-active{color:#00e5ff;border-color:rgba(0,229,255,.35);text-shadow:0 0 5px rgba(0,229,255,.5)}',
      '.mst-tab.mst-locked{cursor:not-allowed;opacity:.18}',
      '#mist-diff{display:flex;align-items:center;gap:4px}',
      '.diff-lbl{font-family:var(--font-d,monospace);font-size:.25rem;letter-spacing:2px;color:rgba(255,255,255,.22)}',
      '.db{background:transparent;border:1px solid rgba(0,229,255,.12);color:rgba(0,229,255,.35);',
        'padding:2px 6px;border-radius:3px;cursor:pointer;font-family:var(--font-d,monospace);font-size:.25rem;letter-spacing:1px;transition:all .15s}',
      '.db.db-active{border-color:rgba(0,229,255,.65);color:#00e5ff;text-shadow:0 0 5px rgba(0,229,255,.5)}',
      '#mist-new{margin-left:auto;background:transparent;border:1px solid rgba(0,229,255,.18);color:#00e5ff;',
        'padding:2px 7px;border-radius:3px;cursor:pointer;font-family:var(--font-d,monospace);font-size:.25rem;letter-spacing:1px;transition:all .15s}',
      '#mist-new:hover{border-color:rgba(0,229,255,.5)}',
      // Frosted glass canvas wrap
      '#mist-canvas-wrap{background:rgba(4,10,22,.48);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'border:1px solid rgba(0,229,255,.18);border-radius:0 0 7px 7px;padding:7px;display:flex;flex-direction:column;align-items:center;gap:3px}',
      '#mist-maze-canvas{display:block;touch-action:none;cursor:crosshair;border:1px solid rgba(0,229,255,.1);border-radius:2px}',
      '#mist-status{font-family:var(--font-d,monospace);font-size:.24rem;letter-spacing:2px;color:rgba(0,229,255,.38);text-align:center;min-height:13px}',
      '@keyframes mist-win{0%{box-shadow:0 0 5px rgba(0,255,136,.3)}50%{box-shadow:0 0 24px rgba(0,255,136,.8)}100%{box-shadow:0 0 5px rgba(0,255,136,.3)}}',
      '.mist-solved{animation:mist-win 1.1s ease-in-out 3}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── HTML ──────────────────────────────────────────────────────────────────
  function injectHTML(){
    var trig=document.createElement('div'); trig.id='mist-trigger'; trig.title='MIST — Lead Edge Maze';
    trig.innerHTML='<div class="mt-icon mi-ready" id="mt-0">★</div><div class="mt-icon mi-locked" id="mt-1">♥</div><div class="mt-icon mi-locked" id="mt-2">◈</div>';
    trig.onclick=function(e){e.stopPropagation();mistToggle();};
    document.body.appendChild(trig);
    var ov=document.createElement('div'); ov.id='mist-overlay';
    ov.innerHTML=[
      '<div id="mist-menu">',
      '<div id="mist-head-row"><span class="mist-lbl">◈ MIST</span><span class="mist-sub">LEAD EDGE MAZE</span><button id="mist-x" onclick="mistToggle()">✕</button></div>',
      '<div id="mist-tabs">',
        '<div class="mst-tab mst-active" id="mst-tab0" onclick="mistSetSlot(0)"><span class="ti">★</span>STAR</div>',
        '<div class="mst-tab mst-locked" id="mst-tab1" onclick="mistSetSlot(1)"><span class="ti">♥</span>HEART</div>',
        '<div class="mst-tab mst-locked" id="mst-tab2" onclick="mistSetSlot(2)"><span class="ti">◈</span>MIST</div>',
      '</div>',
      '<div id="mist-diff"><span class="diff-lbl">DIFF:</span>',
        '<button class="db db-active" id="mst-d1" onclick="mistSetDiff(1)">I</button>',
        '<button class="db" id="mst-d2" onclick="mistSetDiff(2)">II</button>',
        '<button class="db" id="mst-d3" onclick="mistSetDiff(3)">III</button>',
        '<button id="mist-new" onclick="mistNewMaze()">NEW</button>',
      '</div></div>',
      '<div id="mist-canvas-wrap"><canvas id="mist-maze-canvas"></canvas>',
      '<div id="mist-status">DRAG ● FROM ENTRY TO EXIT</div></div>',
    ].join('');
    ov.addEventListener('click',function(e){e.stopPropagation();});
    document.body.appendChild(ov);
  }

  // ── Toggle + click-outside ────────────────────────────────────────────────
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
    setStatus('DRAG ● FROM ENTRY TO EXIT');
  };
  window.mistNewMaze=function(){
    var cfg=DIFF[MIST.difficulty];
    var maze=generateMaze(cfg.w, cfg.h);
    MIST.mazes[MIST.activeMaze]=maze; MIST.dragPath=[]; MIST.dragging=false;
    MIST.sphereTarget=null; MIST.sphereActual=null; stopSphereAnim();
    renderMaze(maze,[]); setStatus('DRAG ● FROM ENTRY TO EXIT');
  };

  // ── Damped sphere ─────────────────────────────────────────────────────────
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

  // ── Maze renderer — Lead Edge spline wireframe style ─────────────────────
  // Matches the 3D planar maze aesthetic: walls rendered as neon cyan spline
  // wireframe segments with cross-brace accents, dark void corridors, glowing
  // entry/exit openings, and the player/exit spheres.
  function renderMaze(maze, dragPath) {
    var canvas = document.getElementById('mist-maze-canvas');
    var wrap   = document.getElementById('mist-canvas-wrap');
    if (!canvas || !wrap) return;
    var W = maze.W, H = maze.H;

    // Canvas sizing — fit snugly in the frosted panel
    var avail = Math.min(wrap.clientWidth - 14, 220); avail = Math.max(avail, 110);
    var ps = Math.max(5, Math.floor(avail / Math.max(W, H)));
    var pw = ps * W, ph = ps * H;
    canvas.width  = pw; canvas.height = ph;
    canvas.style.width = pw + 'px'; canvas.style.height = ph + 'px';

    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, pw, ph);

    // ── Background: deep space void ──
    ctx.fillStyle = 'rgba(2,6,14,0.92)';
    ctx.fillRect(0, 0, pw, ph);

    // ── Helper: cell centre in canvas px ──
    function cc(x, y) { return { x: x * ps + ps / 2, y: y * ps + ps / 2 }; }

    // ── Gather wall segments as horizontal/vertical runs ──
    // We trace each contiguous run of wall cells and draw them as a single
    // rounded rect outline + inner cross-brace lines, giving the girder/truss look.

    var CYAN     = 'rgba(0,229,255,';
    var CYANFULL = '#00e5ff';
    var seg      = ps;  // segment = one cell width

    // Draw each wall cell as a wireframe girder unit
    ctx.save();
    for (var wy = 0; wy < H; wy++) {
      for (var wx = 0; wx < W; wx++) {
        if (maze.grid[wy][wx] !== 1) continue;
        var cx = wx * ps, cy = wy * ps;

        // Outer border of the wall unit — thin neon line
        ctx.strokeStyle = CYAN + '0.82)';
        ctx.lineWidth   = 0.9;
        ctx.shadowColor = CYAN + '0.55)';
        ctx.shadowBlur  = 3;
        ctx.strokeRect(cx + 0.5, cy + 0.5, seg - 1, seg - 1);

        // Inner fill — very dark, just a hint of depth
        ctx.fillStyle = 'rgba(0,20,32,0.55)';
        ctx.fillRect(cx + 1, cy + 1, seg - 2, seg - 2);

        // Cross-brace diagonals — the girder truss detail
        ctx.strokeStyle = CYAN + '0.28)';
        ctx.lineWidth   = 0.6;
        ctx.shadowBlur  = 0;
        ctx.beginPath();
        ctx.moveTo(cx + 1,       cy + 1);
        ctx.lineTo(cx + seg - 1, cy + seg - 1);
        ctx.moveTo(cx + seg - 1, cy + 1);
        ctx.lineTo(cx + 1,       cy + seg - 1);
        ctx.stroke();

        // Corner node dots — the rivet/joint look
        ctx.fillStyle   = CYAN + '0.65)';
        ctx.shadowColor = CYAN + '0.5)';
        ctx.shadowBlur  = 2;
        var r = 1.2;
        [[cx+1, cy+1],[cx+seg-1,cy+1],[cx+1,cy+seg-1],[cx+seg-1,cy+seg-1]].forEach(function(pt){
          ctx.beginPath(); ctx.arc(pt[0], pt[1], r, 0, Math.PI*2); ctx.fill();
        });
      }
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // ── Corridor floor lines — faint grid showing path cells ──
    ctx.save();
    ctx.strokeStyle = CYAN + '0.06)';
    ctx.lineWidth   = 0.5;
    for (var fy = 0; fy < H; fy++) {
      for (var fx = 0; fx < W; fx++) {
        if (maze.grid[fy][fx] !== 0) continue;
        // tiny cross hair in open cells
        var fcx = fx * ps + ps / 2, fcy = fy * ps + ps / 2, ht = ps * 0.2;
        ctx.beginPath();
        ctx.moveTo(fcx - ht, fcy); ctx.lineTo(fcx + ht, fcy);
        ctx.moveTo(fcx, fcy - ht); ctx.lineTo(fcx, fcy + ht);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ── Drag trail — glowing path the player has drawn ──
    if (dragPath && dragPath.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,255,136,0.50)';
      ctx.lineWidth   = Math.max(1.5, ps * 0.38);
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.shadowColor = 'rgba(0,255,136,0.4)';
      ctx.shadowBlur  = 5;
      ctx.beginPath();
      ctx.moveTo(dragPath[0].x * ps + ps/2, dragPath[0].y * ps + ps/2);
      for (var di = 1; di < dragPath.length; di++)
        ctx.lineTo(dragPath[di].x * ps + ps/2, dragPath[di].y * ps + ps/2);
      ctx.stroke();
      ctx.restore();
    }

    // ── Exit marker — cyan pulsing dot ──
    var ex = maze.exit.x * ps + ps/2, ey = maze.exit.y * ps + ps/2;
    ctx.save();
    ctx.beginPath(); ctx.arc(ex, ey, ps * 0.38, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(0,229,255,0.80)';
    ctx.shadowColor = 'rgba(0,229,255,1)';
    ctx.shadowBlur  = 10;
    ctx.fill();
    ctx.strokeStyle = CYANFULL; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // ── Player sphere — green glowing ball ──
    var bx, by;
    if (MIST.sphereActual) { bx = MIST.sphereActual.x; by = MIST.sphereActual.y; }
    else { bx = maze.entry.x * ps + ps/2; by = maze.entry.y * ps + ps/2; }

    ctx.save();
    // Outer glow ring
    ctx.beginPath(); ctx.arc(bx, by, ps * 0.52, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(0,255,136,0.12)';
    ctx.shadowColor = 'rgba(0,255,136,0.6)';
    ctx.shadowBlur  = maze.solved ? 18 : 9;
    ctx.fill();
    // Main sphere
    ctx.beginPath(); ctx.arc(bx, by, ps * 0.40, 0, Math.PI * 2);
    ctx.fillStyle   = maze.solved ? 'rgba(0,255,136,1)' : 'rgba(0,255,136,0.94)';
    ctx.shadowBlur  = maze.solved ? 16 : 7;
    ctx.fill();
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  // ── Drag — pixel grid version ─────────────────────────────────────────────
  // dragPath is now an array of pixel {x,y} coordinates in the maze grid.
  // The sphere snaps to the nearest open pixel under the finger.

  function clientToMazePixel(canvas, maze, cx, cy) {
    var rect=canvas.getBoundingClientRect();
    var ps=canvas.width/maze.W;
    var mx=Math.floor((cx-rect.left)*(canvas.width/rect.width)/ps);
    var my=Math.floor((cy-rect.top)*(canvas.height/rect.height)/ps);
    return {x:Math.max(0,Math.min(maze.W-1,mx)), y:Math.max(0,Math.min(maze.H-1,my))};
  }

  function pixelToCanvasCenter(ps, px, py) {
    return {x:px*ps+ps/2, y:py*ps+ps/2};
  }

  function getPixelSize(canvas, maze) {
    return canvas.width / maze.W;
  }

  function onDragStart(e){
    var maze=MIST.mazes[MIST.activeMaze]; if(!maze||maze.solved)return;
    e.preventDefault(); e.stopPropagation();
    var pt=e.touches?e.touches[0]:e;
    var mp=clientToMazePixel(this,maze,pt.clientX,pt.clientY);
    // Must start on the entry pixel
    if(mp.x===maze.entry.x&&mp.y===maze.entry.y){
      MIST.dragging=true; MIST.dragPos={x:mp.x,y:mp.y}; MIST.dragPath=[{x:mp.x,y:mp.y}];
      var ps=getPixelSize(this,maze);
      var c=pixelToCanvasCenter(ps,mp.x,mp.y);
      MIST.sphereTarget={x:c.x,y:c.y}; MIST.sphereActual={x:c.x,y:c.y};
      setStatus('NAVIGATE TO ◉ EXIT');
    }
    renderMaze(maze,MIST.dragPath);
  }

  function onDragMove(e){
    if(!MIST.dragging)return; e.preventDefault(); e.stopPropagation();
    var maze=MIST.mazes[MIST.activeMaze]; if(!maze)return;
    var pt=e.touches?e.touches[0]:e;
    var mp=clientToMazePixel(this,maze,pt.clientX,pt.clientY);
    var prev=MIST.dragPath[MIST.dragPath.length-1];
    if(mp.x===prev.x&&mp.y===prev.y) return;
    // Only allow moving to adjacent open pixels (no diagonal)
    var dx=mp.x-prev.x, dy=mp.y-prev.y;
    if(Math.abs(dx)+Math.abs(dy)!==1) return;
    // Target must be an open path pixel
    if(maze.grid[mp.y][mp.x]!==0) return;
    // Backtrack support: if this pixel is the one before last, pop
    if(MIST.dragPath.length>=2){
      var pp=MIST.dragPath[MIST.dragPath.length-2];
      if(mp.x===pp.x&&mp.y===pp.y){ MIST.dragPath.pop(); }
      else { MIST.dragPath.push({x:mp.x,y:mp.y}); }
    } else {
      MIST.dragPath.push({x:mp.x,y:mp.y});
    }
    MIST.dragPos={x:mp.x,y:mp.y};
    var ps=getPixelSize(this,maze);
    var c=pixelToCanvasCenter(ps,mp.x,mp.y);
    MIST.sphereTarget={x:c.x,y:c.y}; startSphereAnim();
    // Check for exit
    if(mp.x===maze.exit.x&&mp.y===maze.exit.y){
      MIST.dragging=false; maze.solved=true; onMazeSolved(MIST.activeMaze,maze);
    } else {
      renderMaze(maze,MIST.dragPath);
    }
  }

  function onDragEnd(e){
    if(!MIST.dragging)return; MIST.dragging=false;
    var maze=MIST.mazes[MIST.activeMaze];
    if(maze&&!maze.solved){
      MIST.dragPath=[];
      var cv=document.getElementById('mist-maze-canvas');
      var ps=cv?getPixelSize(cv,maze):8;
      var c=pixelToCanvasCenter(ps,maze.entry.x,maze.entry.y);
      MIST.sphereTarget={x:c.x,y:c.y}; startSphereAnim();
      setStatus('DRAG ● FROM ENTRY TO EXIT');
    }
  }
  function bindCanvasEvents(){
    var canvas=document.getElementById('mist-maze-canvas'); if(!canvas||canvas._mistBound)return; canvas._mistBound=true;
    canvas.addEventListener('mousedown', onDragStart.bind(canvas));
    canvas.addEventListener('mousemove', onDragMove.bind(canvas));
    canvas.addEventListener('mouseup',   onDragEnd.bind(canvas));
    canvas.addEventListener('mouseleave',onDragEnd.bind(canvas));
    canvas.addEventListener('touchstart',onDragStart.bind(canvas),{passive:false});
    canvas.addEventListener('touchmove', onDragMove.bind(canvas), {passive:false});
    canvas.addEventListener('touchend',  onDragEnd.bind(canvas),  {passive:false});
  }

  // ── Win ───────────────────────────────────────────────────────────────────
  function onMazeSolved(slot,maze){
    var prof=SLOT_PROFILE[slot];
    setStatus('✓ '+prof.label+' — WELL DONE');
    MIST.solvedCount=Math.max(MIST.solvedCount,slot+1);
    renderMaze(maze,MIST.dragPath);
    var wrap=document.getElementById('mist-canvas-wrap');
    if(wrap){wrap.classList.add('mist-solved');setTimeout(function(){wrap.classList.remove('mist-solved');},3500);}
    if(slot+1<=2){
      var nt=document.getElementById('mst-tab'+(slot+1));if(nt)nt.classList.remove('mst-locked');
      var ni=document.getElementById('mt-'+(slot+1));if(ni){ni.classList.remove('mi-locked');ni.classList.add('mi-ready');}
    }
    var ci=document.getElementById('mt-'+slot);if(ci)ci.classList.add('mi-active');
    // Close panel so animation in 3JS viewport is immediately visible
    setTimeout(function(){
      MIST.open=false;
      var ov=document.getElementById('mist-overlay');if(ov)ov.classList.remove('mist-open');
      document.removeEventListener('click',_mistOutside,true);
    },300);
    setTimeout(function(){_fireMistNetworkReaction(slot,true);},260);
  }

  // ── Core BRPN network reaction ────────────────────────────────────────────
  // Called for both local solve AND incoming remote events
  function _fireMistNetworkReaction(slot, isLocal){
    var prof=SLOT_PROFILE[slot];
    // 1. Pulse shells
    if(typeof pulseShells==='function'){
      pulseShells(prof.pulse);
      setTimeout(function(){if(typeof pulseShells==='function')pulseShells(prof.pulse*.5);},230);
    }
    // 2. Emotion color state
    if(typeof applyOrbEmotion==='function') applyOrbEmotion(prof.emotion);
    // 3. Shell opacity boost
    window._acShellBoost=window._acShellBoost||[0,0,0];
    window._acShellBoost[0]=Math.min(.22,(window._acShellBoost[0]||0)+prof.shellBoost[0]);
    window._acShellBoost[1]=Math.min(.18,(window._acShellBoost[1]||0)+prof.shellBoost[1]);
    window._acShellBoost[2]=Math.min(.16,(window._acShellBoost[2]||0)+prof.shellBoost[2]);
    // 4. Particle speed burst
    window._orbEmoSpeedMult=prof.speed;
    setTimeout(function(){window._orbEmoSpeedMult=Math.max(window._orbEmoSpeedMult*.85,1.0);},1800);
    // 5. Trigger maze core re-solve
    if(typeof mazeOrbState!=='undefined'){
      mazeOrbState.solveActive=true; mazeOrbState.solveStep=0;
      if(mazeOrbState.pathMeshes) mazeOrbState.pathMeshes.forEach(function(m){if(m&&m.material)m.material.opacity=0;});
    }
    // 6. Tool shape cascade
    if(typeof toolShapeGroups!=='undefined'&&typeof orbFrame!=='undefined'){
      ['knife','stick','hammer','envelope','scissors'].forEach(function(type,ti){
        setTimeout(function(){
          var grp=toolShapeGroups[type];
          if(!grp)return;
          grp.forEach(function(ts,i){setTimeout(function(){if(ts&&ts.mesh){ts.mesh.userData.active=true;ts.mesh.userData.spawnT=orbFrame;}},i*60);});
        },ti*120);
      });
    }
    // 7. Journal entry
    if(window.S&&window.S.journal){
      var who=isLocal?'Local':'Remote';
      window.S.journal.push({ts:new Date().toISOString(),_internal:true,
        _thought:who+' MIST solve — slot '+slot+' ('+prof.label+'). Buoyancy pulse: '+prof.pulse+', emotion: '+prof.emotion+'.'});
    }
    // 8. Volumetric wireframe geometry in BRPN scene
    _spawnMistGeometry(slot);
    // 8. Write to leatr-ash so ALL users' poll cycles pick it up
    if(isLocal && typeof writeLeatrAshMemory==='function'){
      var uid=(typeof _aut_sid!=='undefined')?_aut_sid:(typeof _aut_uid!=='undefined')?_aut_uid:'anon';
      writeLeatrAshMemory('ashtree/mist/'+uid+'.json',{
        uid:uid, slot:slot, ts:Date.now(), label:prof.label, emotion:prof.emotion
      });
    }
  }


  // ── Volumetric wireframe geometry in the main BRPN scene ─────────────────
  var _mistActiveGeom=[];
  function _spawnMistGeometry(slot){
    if(typeof THREE==='undefined'||typeof scene==='undefined') return;
    var COLORS=[0xffdd00,0xff4488,0x00e5ff];
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
          mesh._mr=new THREE.Vector3(Math.random()*.05,Math.random()*.04,0);
        } else if(slot===1){
          geo=new THREE.SphereGeometry(0.055+Math.random()*.04,5,5);
          mat=new THREE.MeshBasicMaterial({color:col,wireframe:true,transparent:true,opacity:.85});
          mesh=new THREE.Mesh(geo,mat);
          var origin=positions[0],target=nodePos;
          var mid=origin.clone().add(target).multiplyScalar(.5).add(new THREE.Vector3((Math.random()-.5)*.8,1.2+Math.random()*.8,(Math.random()-.5)*.8));
          mesh._mc=new THREE.CatmullRomCurve3([origin.clone(),mid,target.clone()]);
          mesh._mt=(i/perNode)*-0.35; mesh._mspd=0.006+Math.random()*.003;
          mesh._mr=new THREE.Vector3(0,0,Math.random()*.04);
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
          mesh._mr=new THREE.Vector3(Math.random()*.035,Math.random()*.03,0);
          var pt=curve.getPoint(mesh._mt);mesh.position.copy(pt);
        }
        group._mObjs.push(mesh); group.add(mesh);
      }
    });
    for(var li=0;li<Math.min(5,positions.length);li++){
      var pa=positions[li%positions.length],pb=positions[(li+1)%positions.length];
      var mid2=pa.clone().add(pb).multiplyScalar(.5).add(new THREE.Vector3((Math.random()-.5)*2,(Math.random()-.5)*2,0));
      var c2=new THREE.CatmullRomCurve3([pa,mid2,pb]);
      var lGeo=new THREE.BufferGeometry().setFromPoints(c2.getPoints(40));
      var lMat=new THREE.LineBasicMaterial({color:col,transparent:true,opacity:.35});
      group.add(new THREE.Line(lGeo,lMat));
    }
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
        if(g._mSlot===0){obj.position.add(obj._mv);obj.rotation.x+=obj._mr.x;obj.rotation.y+=obj._mr.y;obj.material.opacity=.9*fade;}
        else if(g._mSlot===1){obj._mt+=obj._mspd;if(obj._mt>1)obj._mt=0;if(obj._mt>=0&&obj._mc){var pt=obj._mc.getPoint(Math.min(1,obj._mt));obj.position.copy(pt);}obj.rotation.z+=obj._mr.z;obj.material.opacity=.85*fade;}
        else{obj._mt+=obj._mspd;if(obj._mt>1)obj._mt=0;if(obj._mc){var pt2=obj._mc.getPoint(obj._mt);obj.position.copy(pt2);obj.position.x+=Math.sin(g._mAge*.06+obj._mt*5)*.07;}obj.rotation.x+=obj._mr.x;obj.rotation.y+=obj._mr.y;obj.material.opacity=.65*fade;}
      });
    });
    rem.forEach(function(g){
      if(typeof scene!=='undefined')scene.remove(g);
      g._mObjs.forEach(function(o){o.geometry&&o.geometry.dispose();o.material&&o.material.dispose();});
      var idx=_mistActiveGeom.indexOf(g);if(idx>=0)_mistActiveGeom.splice(idx,1);
    });
  })();

  // ── Poll leatr-ash for other users' mist events ───────────────────────────
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
      var STALE_MS=90000; // 90s window
      var remotes=files.filter(function(f){return f.name.endsWith('.json')&&f.name!==localUid+'.json';}).slice(0,20);
      remotes.forEach(function(f){
        fetch(f.download_url,{signal:AbortSignal.timeout(4000)})
          .then(function(r){return r.ok?r.json():null;})
          .then(function(d){
            if(!d||!d.ts||!d.uid)return;
            var age=Date.now()-d.ts;
            if(age>STALE_MS)return;
            var lastSeen=MIST.lastRemoteTs[d.uid]||0;
            if(d.ts<=lastSeen)return; // already reacted
            MIST.lastRemoteTs[d.uid]=d.ts;
            _fireMistNetworkReaction(d.slot||0, false);
          }).catch(function(){});
      });
    }).catch(function(){});
  }

  // BroadcastChannel for same-origin tabs (instant)
  try{
    var _mistBC=new BroadcastChannel('autumn_mist');
    _mistBC.onmessage=function(ev){
      if(!ev.data||ev.data.type!=='mist-solve')return;
      _fireMistNetworkReaction(ev.data.data&&ev.data.data.slot!=null?ev.data.data.slot:0,false);
    };
  }catch(e){}

  // Expose hook for any WebSocket relay
  window._buoyancyMistPulse=function(detail){
    if(detail&&typeof detail.slot==='number') _fireMistNetworkReaction(detail.slot,false);
  };

  // Start polling after 8s (let page fully init) then every 12s
  function _startMistPoller(){
    setTimeout(function(){
      _pollRemoteMist();
      setInterval(_pollRemoteMist,12000);
    },8000);
  }

  function setStatus(msg){var el=document.getElementById('mist-status');if(el)el.textContent=msg;}

  function init(){injectCSS();injectHTML();_startMistPoller();}
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}

})();
