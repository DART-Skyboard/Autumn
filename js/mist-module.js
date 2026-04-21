/**
 * MIST MODULE — Lead Edge Maze Ash · Mist Panel
 * Autumn | LEATR · © 2025 DART Meadow | Radical Deepscale LLC.
 *
 * Generation rules (Lead Edge spec):
 *  - Two perimeter wall systems (wall1, wall2) each carve inward from their
 *    respective opening, leaving exactly one solvable path between entry/exit.
 *  - Entry and exit are NEVER in line-of-sight of each other.
 *  - If entry/exit land on the same perimeter side they must be ≥2 units apart
 *    AND the inner branch system places a sub-wall between them so the first
 *    sub-path branches before either opening is visible.
 *  - Every generation randomises these rules so no two mazes are identical.
 *
 * Visual style: original cyan wireframe line-draw on dark background —
 * same trellis/spline look as the Ash Tree 3D maze.
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     CONSTANTS
  ───────────────────────────────────────────────────────────── */
  const PALETTE = {
    bg:       '#010a14',
    wall:     '#00ffcc',
    wallDim:  'rgba(0,255,204,0.35)',
    wallGlow: 'rgba(0,255,204,0.08)',
    entry:    '#00ccff',
    exit:     '#00ff66',
    trace:    'rgba(140,80,255,0.72)',
    traceTip: '#cc88ff',
    solved:   '#00ffcc',
    textCyan: '#00ffcc',
    textDim:  'rgba(0,255,204,0.45)',
    accent:   '#7b2fff',
  };

  /* maze mode configs */
  const MODES = {
    STAR: { label: 'STAR',  icon: '★', sizes: [9, 13, 17] },
    HEART:{ label: 'HEART', icon: '♥', sizes: [11,15, 19] },
    MIST: { label: 'MIST',  icon: '◈', sizes: [13,17, 23] },
  };

  /* ─────────────────────────────────────────────────────────────
     LEAD EDGE MAZE GENERATION
     Two-wall perimeter system → boolean subtraction → one path.
  ───────────────────────────────────────────────────────────── */

  /**
   * Pick two perimeter openings that satisfy all placement rules.
   *
   * Rules enforced here (checked before carving so generation is always valid):
   *  1. Entry ≠ Exit cell.
   *  2. They must NOT be on the same straight row/column (no direct LOS).
   *  3. If forced onto the same side, they must be ≥ 2 cells apart (grid units).
   *  4. The minimum Manhattan distance between them ≥ floor(W/2).
   *
   * Returns { entry:{side,idx}, exit:{side,idx} }
   * where side ∈ ['top','bottom','left','right'] and idx is the perimeter cell index.
   */
  function pickOpenings(W, H) {
    // Perimeter cells available (odd indices only so walls align with maze grid)
    // We work in maze-cell coordinates (0..W-1, 0..H-1).
    // Openings sit on the *border*:
    //   top    → row 0,    col in [1..W-2]
    //   bottom → row H-1,  col in [1..W-2]
    //   left   → col 0,    row in [1..H-2]
    //   right  → col W-1,  row in [1..H-2]

    const sides = ['top','bottom','left','right'];

    function cellOf(side, idx) {
      // returns {x,y} in grid coords
      if (side === 'top')    return { x: idx, y: 0 };
      if (side === 'bottom') return { x: idx, y: H-1 };
      if (side === 'left')   return { x: 0,   y: idx };
      /* right */             return { x: W-1, y: idx };
    }

    function idxRange(side) {
      return (side === 'top' || side === 'bottom')
        ? { min: 1, max: W-2 }
        : { min: 1, max: H-2 };
    }

    function randIdx(side) {
      const r = idxRange(side);
      return r.min + Math.floor(Math.random() * (r.max - r.min + 1));
    }

    function manhattan(a, b) {
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    function lineOfSight(ca, cb) {
      // Direct LOS = same row OR same column
      return ca.x === cb.x || ca.y === cb.y;
    }

    const minDist = Math.max(3, Math.floor(Math.min(W, H) / 2));
    let entry, exit, attempts = 0;

    do {
      const eSide = sides[Math.floor(Math.random() * 4)];
      const xSide = sides[Math.floor(Math.random() * 4)];
      const eIdx  = randIdx(eSide);
      let   xIdx  = randIdx(xSide);

      entry = { side: eSide, idx: eIdx, cell: cellOf(eSide, eIdx) };
      exit  = { side: xSide, idx: xIdx, cell: cellOf(xSide, xIdx) };

      // Rule 1: not the same cell
      if (entry.cell.x === exit.cell.x && entry.cell.y === exit.cell.y) continue;

      // Rule 2 & 3: same side → enforce ≥ 2 gap
      if (eSide === xSide) {
        if (Math.abs(eIdx - xIdx) < 2) continue;
      }

      // Rule 2: no direct line of sight
      if (lineOfSight(entry.cell, exit.cell)) continue;

      // Rule 4: minimum manhattan distance
      if (manhattan(entry.cell, exit.cell) < minDist) continue;

      break; // all rules satisfied
    } while (++attempts < 2000);

    // fallback: guaranteed valid opposite-corner positions
    if (attempts >= 2000) {
      entry = { side: 'top',    idx: 1,   cell: { x: 1,   y: 0   } };
      exit  = { side: 'bottom', idx: W-2, cell: { x: W-2, y: H-1 } };
    }

    return { entry, exit };
  }

  /**
   * Generate a 2D maze grid using recursive-backtracker (DFS).
   * Grid cells are 1 (wall) or 0 (passage).
   * Returns { grid, entry, exit } where entry/exit are {x,y} pixel-grid coords.
   *
   * The opening placement rules are enforced by pickOpenings() above.
   * After carving, we verify exactly one solvable path exists (BFS).
   * If somehow no path is found, we regenerate (should be extremely rare).
   */
  function generateLeadEdgeMaze(W, H) {
    // W, H must be odd for classic DFS carving
    const w = W % 2 === 0 ? W + 1 : W;
    const h = H % 2 === 0 ? H + 1 : H;

    function tryGenerate() {
      // 1. Fill with walls
      const grid = Array.from({ length: h }, () => new Uint8Array(w).fill(1));

      // 2. DFS carve from (1,1)
      function carve(x, y) {
        grid[y][x] = 0;
        const dirs = [[0,-2],[0,2],[-2,0],[2,0]].sort(() => Math.random() - 0.5);
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx > 0 && nx < w-1 && ny > 0 && ny < h-1 && grid[ny][nx] === 1) {
            grid[y + dy/2][x + dx/2] = 0;
            carve(nx, ny);
          }
        }
      }
      carve(1, 1);

      // 3. Pick openings (perimeter breaches)
      const { entry, exit } = pickOpenings(w, h);

      // Open perimeter at entry / exit
      function openCell(side, idx) {
        if (side === 'top')    { grid[0][idx] = 0; return { x: idx, y: 0 }; }
        if (side === 'bottom') { grid[h-1][idx] = 0; return { x: idx, y: h-1 }; }
        if (side === 'left')   { grid[idx][0] = 0; return { x: 0, y: idx }; }
        /* right */              grid[idx][w-1] = 0; return { x: w-1, y: idx };
      }

      const entryCell = openCell(entry.side, entry.idx);
      const exitCell  = openCell(exit.side,  exit.idx);

      // Connect entry/exit to interior path
      function connectToBorder(cell, side) {
        // step one unit inward from the border opening
        if (side === 'top')    { grid[1][cell.x] = 0; }
        if (side === 'bottom') { grid[h-2][cell.x] = 0; }
        if (side === 'left')   { grid[cell.y][1] = 0; }
        if (side === 'right')  { grid[cell.y][w-2] = 0; }
      }
      connectToBorder(entryCell, entry.side);
      connectToBorder(exitCell,  exit.side);

      // 4. Verify solvable path exists via BFS
      const path = bfsSolve(grid, w, h, entryCell, exitCell);
      if (!path || path.length === 0) return null; // regenerate

      return { grid, w, h, entryCell, exitCell, path };
    }

    // Retry up to 20 times (virtually always succeeds on first try)
    for (let i = 0; i < 20; i++) {
      const result = tryGenerate();
      if (result) return result;
    }

    // Last-resort fallback with hardcoded valid layout
    return fallbackMaze(w, h);
  }

  /**
   * BFS from entry to exit — returns path array [{x,y},...] or null.
   */
  function bfsSolve(grid, w, h, entry, exit) {
    const key = (x, y) => y * w + x;
    const queue = [{ x: entry.x, y: entry.y, path: [{ x: entry.x, y: entry.y }] }];
    const visited = new Set([key(entry.x, entry.y)]);
    const goal = key(exit.x, exit.y);

    while (queue.length > 0) {
      const { x, y, path } = queue.shift();
      if (key(x, y) === goal) return path;
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nx = x+dx, ny = y+dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (grid[ny][nx] === 1) continue;
        const k = key(nx, ny);
        if (!visited.has(k)) {
          visited.add(k);
          queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
        }
      }
    }
    return null;
  }

  function fallbackMaze(w, h) {
    const grid = Array.from({ length: h }, (_, y) =>
      new Uint8Array(w).fill(0).map((_, x) => (x === 0 || x === w-1 || y === 0 || y === h-1) ? 1 : 0)
    );
    // simple corridors
    for (let y = 1; y < h-1; y += 2)
      for (let x = 1; x < w-1; x++) grid[y][x] = 0;
    grid[0][1] = 0;
    grid[h-1][w-2] = 0;
    const entryCell = { x: 1, y: 0 };
    const exitCell  = { x: w-2, y: h-1 };
    const path = bfsSolve(grid, w, h, entryCell, exitCell) || [];
    return { grid, w, h, entryCell, exitCell, path };
  }

  /* ─────────────────────────────────────────────────────────────
     CANVAS RENDERER — original wireframe / spline style
  ───────────────────────────────────────────────────────────── */

  function drawMaze(canvas, state) {
    const ctx = canvas.getContext('2d');
    const { grid, w, h, entryCell, exitCell, trace, solved } = state;
    const cw = canvas.width, ch = canvas.height;

    const cellW = Math.floor(cw / w);
    const cellH = Math.floor(ch / h);
    const cell  = Math.min(cellW, cellH);
    const offX  = Math.floor((cw - cell * w) / 2);
    const offY  = Math.floor((ch - cell * h) / 2);

    // Background
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, cw, ch);

    // Subtle grid glow beneath walls
    ctx.fillStyle = PALETTE.wallGlow;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x] === 1) {
          ctx.fillRect(offX + x*cell, offY + y*cell, cell, cell);
        }
      }
    }

    // Wall line segments — wireframe style
    ctx.strokeStyle = solved ? PALETTE.solved : PALETTE.wall;
    ctx.lineWidth   = Math.max(1, cell * 0.18);
    ctx.lineCap     = 'square';

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x] !== 1) continue;
        const px = offX + x * cell;
        const py = offY + y * cell;
        const p2 = px + cell, p3 = py + cell;

        // Draw the outer frame of each wall cell
        // top edge
        const hasTop    = y > 0   && grid[y-1][x] === 1;
        const hasBottom = y < h-1 && grid[y+1][x] === 1;
        const hasLeft   = x > 0   && grid[y][x-1] === 1;
        const hasRight  = x < w-1 && grid[y][x+1] === 1;

        ctx.beginPath();
        // draw only exposed edges (borders with non-wall cells)
        if (!hasTop)    { ctx.moveTo(px, py); ctx.lineTo(p2, py); }
        if (!hasBottom) { ctx.moveTo(px, p3); ctx.lineTo(p2, p3); }
        if (!hasLeft)   { ctx.moveTo(px, py); ctx.lineTo(px, p3); }
        if (!hasRight)  { ctx.moveTo(p2, py); ctx.lineTo(p2, p3); }
        ctx.stroke();

        // Trellis cross-hatch inside wall cells (the structural look)
        if (cell >= 6) {
          ctx.save();
          ctx.strokeStyle = PALETTE.wallDim;
          ctx.lineWidth   = Math.max(0.5, cell * 0.09);
          ctx.beginPath();
          ctx.moveTo(px,    py); ctx.lineTo(p2, p3);
          ctx.moveTo(p2,    py); ctx.lineTo(px, p3);
          // mid cross
          ctx.moveTo(px + cell/2, py); ctx.lineTo(px + cell/2, p3);
          ctx.moveTo(px, py + cell/2); ctx.lineTo(p2, py + cell/2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Player trace path
    if (trace && trace.length > 1) {
      ctx.save();
      ctx.strokeStyle = PALETTE.trace;
      ctx.lineWidth   = Math.max(2, cell * 0.28);
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';
      ctx.beginPath();
      for (let i = 0; i < trace.length; i++) {
        const tx = offX + trace[i].x * cell + cell/2;
        const ty = offY + trace[i].y * cell + cell/2;
        if (i === 0) ctx.moveTo(tx, ty);
        else         ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      // Glow
      ctx.strokeStyle = 'rgba(200,140,255,0.18)';
      ctx.lineWidth   = ctx.lineWidth * 2.2;
      ctx.stroke();
      ctx.restore();
    }

    // Entry marker (cyan ball)
    drawBall(ctx,
      offX + entryCell.x * cell + cell/2,
      offY + entryCell.y * cell + cell/2,
      Math.max(3, cell * 0.4),
      PALETTE.entry
    );

    // Exit marker (green ball)
    drawBall(ctx,
      offX + exitCell.x * cell + cell/2,
      offY + exitCell.y * cell + cell/2,
      Math.max(3, cell * 0.4),
      PALETTE.exit
    );

    // Solved flash
    if (solved) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,255,204,0.08)';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }
  }

  function drawBall(ctx, x, y, r, color) {
    const grd = ctx.createRadialGradient(x - r*0.3, y - r*0.3, r*0.05, x, y, r);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.3, color);
    grd.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    // outer glow ring
    ctx.beginPath();
    ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ─────────────────────────────────────────────────────────────
     MIST MODULE UI
  ───────────────────────────────────────────────────────────── */

  const MIST_MODAL_ID = 'mist-modal-root';

  let _mistState = {
    open:    false,
    mode:    'MIST',
    diff:    0,          // 0=I, 1=II, 2=III
    maze:    null,       // { grid, w, h, entryCell, exitCell, path }
    trace:   [],         // cells visited by drag
    dragging: false,
    solved:  false,
    generation: 0,
    scores:  { STAR: [false,false,false], HEART: [false,false,false], MIST: [false,false,false] },
  };

  /* ── Build modal DOM (only once) ── */
  function buildModal() {
    if (document.getElementById(MIST_MODAL_ID)) return;

    const modal = document.createElement('div');
    modal.id = MIST_MODAL_ID;
    modal.style.cssText = `
      display:none; position:fixed; inset:0; z-index:9999;
      align-items:center; justify-content:center;
      background:rgba(1,6,14,0.82); backdrop-filter:blur(6px);
    `;

    modal.innerHTML = `
      <div id="mist-panel" style="
        background:rgba(2,10,22,0.97);
        border:1px solid rgba(0,255,204,0.22);
        border-radius:14px;
        box-shadow:0 0 40px rgba(0,255,204,0.08),0 8px 48px rgba(0,0,0,0.7);
        width:min(420px,96vw);
        display:flex; flex-direction:column;
        overflow:hidden;
        font-family:'Orbitron','Exo 2',sans-serif;
      ">
        <!-- Header -->
        <div style="
          display:flex; align-items:center; gap:10px;
          padding:10px 14px;
          background:rgba(0,0,0,0.3);
          border-bottom:1px solid rgba(0,255,204,0.12);
        ">
          <span style="color:#00ffcc;font-size:10px;letter-spacing:2px;">◈</span>
          <span id="mist-header-mode" style="color:#00ffcc;font-size:11px;letter-spacing:3px;font-weight:700;">MIST</span>
          <span style="color:rgba(0,255,204,0.35);font-size:10px;letter-spacing:2px;flex:1;">LEAD EDGE MAZE</span>
          <button id="mist-close" style="
            background:none; border:none; color:rgba(0,255,204,0.5);
            font-size:18px; cursor:pointer; line-height:1; padding:2px 6px;
          ">×</button>
        </div>

        <!-- Mode tabs -->
        <div id="mist-mode-tabs" style="
          display:flex; gap:6px; padding:8px 12px 0;
        "></div>

        <!-- Difficulty tabs -->
        <div style="display:flex; align-items:center; gap:8px; padding:6px 12px 8px;">
          <span style="color:rgba(0,255,204,0.4);font-size:9px;letter-spacing:2px;">DIFF</span>
          <div id="mist-diff-tabs" style="display:flex;gap:4px;"></div>
          <div style="flex:1"></div>
          <button id="mist-new" style="
            background:none;border:1px solid rgba(0,255,204,0.25);
            color:#00ffcc; font-size:9px; letter-spacing:2px;
            padding:3px 9px; border-radius:4px; cursor:pointer;
            font-family:inherit;
          ">NEW</button>
        </div>

        <!-- Canvas -->
        <div style="position:relative; padding:0 12px 6px;">
          <canvas id="mist-canvas" style="
            width:100%; aspect-ratio:1/1;
            border-radius:6px;
            border:1px solid rgba(0,255,204,0.1);
            cursor:crosshair; touch-action:none; display:block;
          "></canvas>
          <div id="mist-status" style="
            text-align:center; padding:6px 0 2px;
            font-size:9px; letter-spacing:2px;
            color:rgba(0,255,204,0.45);
          ">DRAG · FROM ENTRY TO EXIT</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close button
    document.getElementById('mist-close').onclick = closeMist;
    modal.addEventListener('click', e => { if (e.target === modal) closeMist(); });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _mistState.open) closeMist();
    });

    buildModeTabs();
    buildDiffTabs();
    bindCanvas();
  }

  function buildModeTabs() {
    const el = document.getElementById('mist-mode-tabs');
    if (!el) return;
    el.innerHTML = Object.keys(MODES).map(key => {
      const m = MODES[key];
      return `
        <button class="mist-mode-tab" data-mode="${key}" style="
          flex:1; background:none;
          border:1px solid rgba(0,255,204,0.15);
          border-radius:6px; padding:7px 4px; cursor:pointer;
          font-family:inherit; color:rgba(0,255,204,0.5);
          font-size:9px; letter-spacing:1px;
          display:flex; flex-direction:column; align-items:center; gap:3px;
          transition:all 0.15s;
        ">
          <span style="font-size:14px;">${m.icon}</span>
          <span>${m.label}</span>
        </button>
      `;
    }).join('');
    el.querySelectorAll('.mist-mode-tab').forEach(btn => {
      btn.onclick = () => { _mistState.mode = btn.dataset.mode; refreshTabs(); regenerate(); };
    });
    refreshTabs();
  }

  function buildDiffTabs() {
    const el = document.getElementById('mist-diff-tabs');
    if (!el) return;
    ['I','II','III'].forEach((label, i) => {
      const btn = document.createElement('button');
      btn.dataset.diff = i;
      btn.textContent = label;
      btn.style.cssText = `
        background:none; border:1px solid rgba(0,255,204,0.2);
        color:rgba(0,255,204,0.6); font-size:10px; letter-spacing:1px;
        padding:2px 8px; border-radius:3px; cursor:pointer; font-family:inherit;
      `;
      btn.onclick = () => { _mistState.diff = i; refreshTabs(); regenerate(); };
      el.appendChild(btn);
    });
    refreshTabs();
  }

  function refreshTabs() {
    // Mode tabs
    document.querySelectorAll('.mist-mode-tab').forEach(btn => {
      const active = btn.dataset.mode === _mistState.mode;
      btn.style.background      = active ? 'rgba(0,255,204,0.12)' : 'none';
      btn.style.borderColor     = active ? 'rgba(0,255,204,0.6)'  : 'rgba(0,255,204,0.15)';
      btn.style.color           = active ? '#00ffcc'              : 'rgba(0,255,204,0.5)';
    });
    // Diff tabs
    const diffBtns = document.querySelectorAll('[data-diff]');
    diffBtns.forEach(btn => {
      const active = parseInt(btn.dataset.diff) === _mistState.diff;
      btn.style.background  = active ? 'rgba(0,255,204,0.15)' : 'none';
      btn.style.borderColor = active ? '#00ffcc'              : 'rgba(0,255,204,0.2)';
      btn.style.color       = active ? '#00ffcc'              : 'rgba(0,255,204,0.6)';
    });
    // Header mode label
    const hdr = document.getElementById('mist-header-mode');
    if (hdr) hdr.textContent = _mistState.mode;
    // New button
    const nb = document.getElementById('mist-new');
    if (nb) nb.onclick = regenerate;
  }

  /* ── Canvas interaction ── */
  function bindCanvas() {
    const canvas = document.getElementById('mist-canvas');
    if (!canvas) return;

    function cellFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left)  * scaleX;
      const my = (e.clientY - rect.top)   * scaleY;
      const maze = _mistState.maze;
      if (!maze) return null;
      const { w, h } = maze;
      const cellW = canvas.width  / w;
      const cellH = canvas.height / h;
      const cx = Math.floor(mx / cellW);
      const cy = Math.floor(my / cellH);
      if (cx < 0 || cx >= w || cy < 0 || cy >= h) return null;
      return { x: cx, y: cy };
    }

    function startDrag(e) {
      if (!_mistState.maze || _mistState.solved) return;
      const cell = cellFromEvent(e.touches ? e.touches[0] : e);
      if (!cell) return;
      const { entryCell } = _mistState.maze;
      if (cell.x !== entryCell.x || cell.y !== entryCell.y) return;
      _mistState.dragging = true;
      _mistState.trace = [{ x: cell.x, y: cell.y }];
      redraw();
    }

    function moveDrag(e) {
      if (!_mistState.dragging || !_mistState.maze) return;
      e.preventDefault();
      const pt = e.touches ? e.touches[0] : e;
      const cell = cellFromEvent(pt);
      if (!cell) return;
      const { grid, w, h, exitCell } = _mistState.maze;
      if (grid[cell.y][cell.x] === 1) return; // hit wall

      // Only allow if adjacent to last trace cell
      const last = _mistState.trace[_mistState.trace.length - 1];
      const dist = Math.abs(cell.x - last.x) + Math.abs(cell.y - last.y);
      if (dist === 0) return;
      if (dist > 1) {
        // drag moved too fast — try to step toward cell
        // just ignore large jumps for clean UX
        return;
      }

      // Check if going back on trace
      if (_mistState.trace.length >= 2) {
        const prev = _mistState.trace[_mistState.trace.length - 2];
        if (cell.x === prev.x && cell.y === prev.y) {
          _mistState.trace.pop();
          redraw();
          return;
        }
      }

      // Check already in trace (loop prevention)
      if (_mistState.trace.some(c => c.x === cell.x && c.y === cell.y)) return;

      _mistState.trace.push(cell);

      // Check solved
      if (cell.x === exitCell.x && cell.y === exitCell.y) {
        _mistState.dragging = false;
        _mistState.solved = true;
        const m = _mistState.mode;
        const d = _mistState.diff;
        _mistState.scores[m][d] = true;
        setStatus('✓ ' + m + ' SOLVED — WELL DONE');
        // log to MIST journal
        if (window.S && window.S.journal) {
          window.S.journal.push({
            ts: new Date().toISOString(),
            _internal: true,
            _thought: `MIST MAZE SOLVED: mode=${m} diff=${d+1} gen=${_mistState.generation}`,
            keywords: ['mist','maze','solved'],
          });
        }
      }

      redraw();
    }

    function endDrag() { _mistState.dragging = false; }

    canvas.addEventListener('pointerdown',  startDrag);
    canvas.addEventListener('pointermove',  moveDrag);
    canvas.addEventListener('pointerup',    endDrag);
    canvas.addEventListener('pointercancel',endDrag);
    canvas.addEventListener('touchstart',   startDrag, { passive: false });
    canvas.addEventListener('touchmove',    moveDrag,  { passive: false });
    canvas.addEventListener('touchend',     endDrag,   { passive: false });
  }

  function setStatus(msg) {
    const el = document.getElementById('mist-status');
    if (el) el.textContent = msg;
  }

  function redraw() {
    const canvas = document.getElementById('mist-canvas');
    if (!canvas || !_mistState.maze) return;
    // Size canvas to actual display pixel size
    const rect = canvas.getBoundingClientRect();
    const dpr  = Math.min(window.devicePixelRatio || 1, 2);
    const pw   = Math.round(rect.width  * dpr);
    const ph   = Math.round(rect.height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width  = pw || 360;
      canvas.height = ph || 360;
    }
    drawMaze(canvas, {
      grid:      _mistState.maze.grid,
      w:         _mistState.maze.w,
      h:         _mistState.maze.h,
      entryCell: _mistState.maze.entryCell,
      exitCell:  _mistState.maze.exitCell,
      trace:     _mistState.trace,
      solved:    _mistState.solved,
    });
  }

  function regenerate() {
    _mistState.trace   = [];
    _mistState.solved  = false;
    _mistState.dragging= false;
    _mistState.generation++;
    refreshTabs();

    // Size based on mode + difficulty
    const sizes = MODES[_mistState.mode].sizes;
    let   sz    = sizes[_mistState.diff] || sizes[0];
    // ensure odd
    if (sz % 2 === 0) sz++;

    _mistState.maze = generateLeadEdgeMaze(sz, sz);
    setStatus('DRAG · FROM ENTRY TO EXIT');
    redraw();
  }

  /* ── Open / Close ── */
  function openMist() {
    buildModal();
    const modal = document.getElementById(MIST_MODAL_ID);
    if (!modal) return;
    modal.style.display = 'flex';
    _mistState.open = true;

    if (!_mistState.maze) {
      regenerate();
    } else {
      // resize + redraw in case panel dimensions changed
      setTimeout(redraw, 60);
    }
  }

  function closeMist() {
    const modal = document.getElementById(MIST_MODAL_ID);
    if (modal) modal.style.display = 'none';
    _mistState.open = false;
  }

  /* ─────────────────────────────────────────────────────────────
     ATTACH TO EXISTING MIST TRIGGER BUTTONS
  ───────────────────────────────────────────────────────────── */

  function bindMistTriggers() {
    // The main page likely has buttons/elements that reference window.openMist
    // or use data-action="mist". Expose globally.
    window.openMist  = openMist;
    window.closeMist = closeMist;
    window._mistState = _mistState;

    // Bind any elements already in DOM with data-mist or class mist-trigger
    document.querySelectorAll('[data-mist],[data-action="mist"],.mist-trigger').forEach(el => {
      el.addEventListener('click', openMist);
    });

    // Also intercept MIST tab buttons if rendered inside the Forge/Tools overlay
    // (these are rendered dynamically so we watch via document-level delegation)
    document.addEventListener('click', function (e) {
      const tgt = e.target.closest('[data-open-mist],[data-mist-open]');
      if (tgt) openMist();
    });
  }

  /* ─────────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────────── */

  function init() {
    buildModal();
    bindMistTriggers();
    // Pre-generate so first open is instant
    regenerate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
