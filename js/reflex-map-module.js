
/* ══════════════════════════════════════════════════════════════════════
   TF-web-131: REFLEX MAP rebuilt as an in-place toggle on the SAME main
   real-time scene (window._brpnScene/_brpnCamera/_brpnRenderer), matching
   how iOS actually does it (BRPNSceneViewModel.showMindMapView — hides the
   existing scene content, shows the mind-map group, same camera/renderer
   the whole time) rather than the earlier standalone-overlay version. The
   layout math (shellRadius, fibonacci sphere, depth colors, wireframe
   icosahedra) is unchanged and still a faithful port of
   LeatrMindMapScene.swift; only how it's presented changed.
   Data: real leatr-mindmap.json content, 246 nodes, embedded compact as
   [id,depth,parent,label,text] tuples (edges reconstructed from parent,
   confirmed 1:1 with the source file's own edge list previously).
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var RM_NODES = [[0,0,null,"ROOT","LEAD EDGE ASH TREE REFLEX"],[1,1,0,"SJ","Sentience Journal"],[2,1,0,"CR","Connected Resources"],[3,2,2,"VER","Verification"],[4,2,2,"ALL","Allocation"],[5,1,0,"MBRP","Master Buoyancy Reflex Pendulum Logic Sentience Journal Node"],[6,2,5,"VER","Verification"],[7,2,5,"INB","Inbound"],[8,3,7,"ALL","Allocation"],[9,2,5,"OUT","Outbound"],[10,1,0,"BRPL","Buoyancy Reflex Pendulum Logic Nodes (BRPN Chain)"],[11,2,10,"BRPL","Buoyancy Reflex Pendulum Logic Node"],[12,3,11,"INB","Inbound"],[13,3,11,"OUT","Outbound"],[14,3,11,"MAZ","Maze"],[15,4,14,"VER","Verification"],[16,4,14,"ALL","Allocation"],[17,4,14,"INB","Inbound"],[18,4,14,"OUT","Outbound"],[19,4,14,"BRPE","Buoyancy Reflex Pendulum Execution Logic Outbound"],[20,4,14,"NTBR","Nature Tool Buoyancy Reflex Execution Logic Outbound"],[21,4,14,"PAR","Parentheses"],[22,5,21,"EXP","Exponents"],[23,6,22,"MUL","Multiplication"],[24,6,22,"DIV","Division"],[25,6,22,"ADD","Addition"],[26,6,22,"SUB","Subtraction"],[27,6,22,"MAS","Mass"],[28,6,22,"VOL","Volume"],[29,6,22,"WEI","Weight"],[30,6,22,"DEN","Density"],[31,6,22,"TEM","Temperature"],[32,6,22,"VEL","Velocity"],[33,6,22,"PHO","Photosynthesis"],[34,6,22,"TOU","Touch"],[35,6,22,"TAS","Taste"],[36,6,22,"VIS","Vision"],[37,6,22,"SME","Smell"],[38,6,22,"SOU","Sound"],[39,2,10,"BRPL","Buoyancy Reflex Pendulum Logic Node"],[40,3,39,"INB","Inbound"],[41,3,39,"OUT","Outbound"],[42,3,39,"PUZ","Puzzle"],[43,4,42,"VER","Verification"],[44,4,42,"ALL","Allocation"],[45,4,42,"INB","Inbound"],[46,4,42,"OUT","Outbound"],[47,4,42,"PAR","Parentheses"],[48,5,47,"EXP","Exponents"],[49,6,48,"MUL","Multiplication"],[50,6,48,"DIV","Division"],[51,6,48,"ADD","Addition"],[52,6,48,"SUB","Subtraction"],[53,6,48,"MAS","Mass"],[54,6,48,"VOL","Volume"],[55,6,48,"WEI","Weight"],[56,6,48,"DEN","Density"],[57,6,48,"TEM","Temperature"],[58,6,48,"VEL","Velocity"],[59,6,48,"PHO","Photosynthesis"],[60,6,48,"TOU","Touch"],[61,6,48,"TAS","Taste"],[62,6,48,"VIS","Vision"],[63,6,48,"SME","Smell"],[64,6,48,"SOU","Sound"],[65,2,10,"BRPL","Buoyancy Reflex Pendulum Logic Node"],[66,3,65,"INB","Inbound"],[67,3,65,"OUT","Outbound"],[68,3,65,"ENV","Envelope"],[69,4,68,"VER","Verification"],[70,4,68,"ALL","Allocation"],[71,4,68,"INB","Inbound"],[72,4,68,"OUT","Outbound"],[73,4,68,"PAR","Parentheses"],[74,5,73,"EXP","Exponents"],[75,6,74,"MUL","Multiplication"],[76,6,74,"DIV","Division"],[77,6,74,"ADD","Addition"],[78,6,74,"SUB","Subtraction"],[79,6,74,"MAS","Mass"],[80,6,74,"VOL","Volume"],[81,6,74,"WEI","Weight"],[82,6,74,"DEN","Density"],[83,6,74,"TEM","Temperature"],[84,6,74,"VEL","Velocity"],[85,6,74,"PHO","Photosynthesis"],[86,6,74,"TOU","Touch"],[87,6,74,"TAS","Taste"],[88,6,74,"VIS","Vision"],[89,6,74,"SME","Smell"],[90,6,74,"SOU","Sound"],[91,2,10,"BRPL","Buoyancy Reflex Pendulum Logic Node"],[92,3,91,"INB","Inbound"],[93,3,91,"OUT","Outbound"],[94,3,91,"HAM","Hammer"],[95,4,94,"VER","Verification"],[96,4,94,"ALL","Allocation"],[97,4,94,"INB","Inbound"],[98,4,94,"OUT","Outbound"],[99,4,94,"PAR","Parentheses"],[100,5,99,"EXP","Exponents"],[101,6,100,"MUL","Multiplication"],[102,6,100,"DIV","Division"],[103,6,100,"ADD","Addition"],[104,6,100,"SUB","Subtraction"],[105,6,100,"MAS","Mass"],[106,6,100,"VOL","Volume"],[107,6,100,"WEI","Weight"],[108,6,100,"DEN","Density"],[109,6,100,"TEM","Temperature"],[110,6,100,"VEL","Velocity"],[111,6,100,"PHO","Photosynthesis"],[112,6,100,"TOU","Touch"],[113,6,100,"TAS","Taste"],[114,6,100,"VIS","Vision"],[115,6,100,"SME","Smell"],[116,6,100,"SOU","Sound"],[117,2,10,"BRPL","Buoyancy Reflex Pendulum Logic Node"],[118,3,117,"INB","Inbound"],[119,3,117,"OUT","Outbound"],[120,3,117,"STA","Stack"],[121,4,120,"VER","Verification"],[122,4,120,"ALL","Allocation"],[123,4,120,"INB","Inbound"],[124,4,120,"OUT","Outbound"],[125,4,120,"PAR","Parentheses"],[126,5,125,"EXP","Exponents"],[127,6,126,"MUL","Multiplication"],[128,6,126,"DIV","Division"],[129,6,126,"ADD","Addition"],[130,6,126,"SUB","Subtraction"],[131,6,126,"MAS","Mass"],[132,6,126,"VOL","Volume"],[133,6,126,"WEI","Weight"],[134,6,126,"DEN","Density"],[135,6,126,"TEM","Temperature"],[136,6,126,"VEL","Velocity"],[137,6,126,"PHO","Photosynthesis"],[138,6,126,"TOU","Touch"],[139,6,126,"TAS","Taste"],[140,6,126,"VIS","Vision"],[141,6,126,"SME","Smell"],[142,6,126,"SOU","Sound"],[143,2,10,"BRPL","Buoyancy Reflex Pendulum Logic Node"],[144,3,143,"INB","Inbound"],[145,3,143,"OUT","Outbound"],[146,3,143,"KNI","knife"],[147,4,146,"VER","Verification"],[148,4,146,"ALL","Allocation"],[149,4,146,"INB","Inbound"],[150,4,146,"OUT","Outbound"],[151,4,146,"PAR","Parentheses"],[152,5,151,"EXP","Exponents"],[153,6,152,"MUL","Multiplication"],[154,6,152,"DIV","Division"],[155,6,152,"ADD","Addition"],[156,6,152,"SUB","Subtraction"],[157,6,152,"MAS","Mass"],[158,6,152,"VOL","Volume"],[159,6,152,"WEI","Weight"],[160,6,152,"DEN","Density"],[161,6,152,"TEM","Temperature"],[162,6,152,"VEL","Velocity"],[163,6,152,"PHO","Photosynthesis"],[164,6,152,"TOU","Touch"],[165,6,152,"TAS","Taste"],[166,6,152,"VIS","Vision"],[167,6,152,"SME","Smell"],[168,6,152,"SOU","Sound"],[169,2,10,"BRPL","Buoyancy Reflex Pendulum Logic Node"],[170,3,169,"INB","Inbound"],[171,3,169,"OUT","Outbound"],[172,3,169,"SCI","Scissors"],[173,4,172,"VER","Verification"],[174,4,172,"ALL","Allocation"],[175,4,172,"INB","Inbound"],[176,4,172,"OUT","Outbound"],[177,4,172,"PAR","Parentheses"],[178,5,177,"EXP","Exponents"],[179,6,178,"MUL","Multiplication"],[180,6,178,"DIV","Division"],[181,6,178,"ADD","Addition"],[182,6,178,"SUB","Subtraction"],[183,6,178,"MAS","Mass"],[184,6,178,"VOL","Volume"],[185,6,178,"WEI","Weight"],[186,6,178,"DEN","Density"],[187,6,178,"TEM","Temperature"],[188,6,178,"VEL","Velocity"],[189,6,178,"PHO","Photosynthesis"],[190,6,178,"TOU","Touch"],[191,6,178,"TAS","Taste"],[192,6,178,"VIS","Vision"],[193,6,178,"SME","Smell"],[194,6,178,"SOU","Sound"],[195,1,0,"LAAP","Logic Allocation and Post Branch Inbound/Outbound"],[196,2,195,"PAR","Parentheses"],[197,3,196,"EXP","Exponents"],[198,4,197,"MUL","Multiplication"],[199,4,197,"DIV","Division"],[200,4,197,"ADD","Addition"],[201,4,197,"SUB","Subtraction"],[202,4,197,"MAS","Mass"],[203,4,197,"VOL","Volume"],[204,4,197,"WEI","Weight"],[205,4,197,"DEN","Density"],[206,4,197,"TEM","Temperature"],[207,4,197,"VEL","Velocity"],[208,4,197,"PHO","Photosynthesis"],[209,4,197,"TOU","Touch"],[210,4,197,"TAS","Taste"],[211,4,197,"VIS","Vision"],[212,4,197,"SME","Smell"],[213,4,197,"SOU","Sound"],[214,5,213,"OISO","Outbound Integer, String or Both"],[215,5,213,"IISO","Inbound Integer, String or Both"],[216,1,0,"PT","Prompt Terminals"],[217,2,216,"AOP","AI Output Prompt"],[218,2,216,"UIP","User Input Prompt"],[219,1,0,"NOOO","Natural Order of Operations (shared ladder)"],[220,2,219,"1P","1 Parentheses"],[221,2,219,"2E","2 Exponents"],[222,2,219,"3M","3 Multiplication"],[223,2,219,"4D","4 Division"],[224,2,219,"5A","5 Addition"],[225,2,219,"6S","6 Subtraction"],[226,2,219,"7M","7 Mass"],[227,2,219,"8V","8 Volume"],[228,2,219,"9W","9 Weight"],[229,2,219,"1D","10 Density"],[230,2,219,"1T","11 Temperature"],[231,2,219,"1V","12 Velocity"],[232,2,219,"1P","13 Photosynthesis"],[233,2,219,"1T","14 Touch"],[234,2,219,"1T","15 Taste"],[235,2,219,"1V","16 Vision"],[236,2,219,"1S","17 Smell"],[237,2,219,"1S","18 Sound"],[238,1,0,"NT","Nature Tools"],[239,2,238,"MAZ","Maze"],[240,2,238,"PUZ","Puzzle"],[241,2,238,"ENV","Envelope"],[242,2,238,"HAM","Hammer"],[243,2,238,"STA","Stack"],[244,2,238,"KNI","knife"],[245,2,238,"SCI","Scissors"]];

  var DEPTH_COLORS = { 0:0xffffff, 1:0x73d9ff, 2:0x8cffbf, 3:0xd9ff73, 4:0xffd959, 5:0xff9959 };
  function depthColor(d){ return DEPTH_COLORS[d] !== undefined ? DEPTH_COLORS[d] : 0xff6688; }
  function shellRadius(depth){ return depth <= 0 ? 0 : 0.45 + depth*0.32; }
  function fibonacciSpherePoint(index, total, radius){
    if (total <= 1) return { x:0, y:radius, z:0 };
    var goldenAngle = Math.PI * (3 - Math.sqrt(5));
    var y = 1 - (index/(total-1))*2;
    var r = Math.sqrt(Math.max(0, 1 - y*y));
    var theta = goldenAngle * index;
    return { x: Math.cos(theta)*r*radius, y: y*radius, z: Math.sin(theta)*r*radius };
  }

  var mindMapGroup = null;
  var attachedToScene = null;
  var labelEl = null;
  var active = false;

  function buildGroup(){
    var group = new THREE.Group();
    var byDepth = {};
    RM_NODES.forEach(function(n){ (byDepth[n[1]] = byDepth[n[1]] || []).push(n); });
    var positions = {};
    Object.keys(byDepth).forEach(function(depthStr){
      var depth = parseInt(depthStr, 10);
      var g = byDepth[depth];
      var radius = shellRadius(depth);
      g.forEach(function(n, i){
        positions[n[0]] = radius === 0 ? { x:0, y:0, z:0 } : fibonacciSpherePoint(i, g.length, radius);
      });
    });
    var edgeVerts = [];
    RM_NODES.forEach(function(n){
      var id = n[0], parent = n[2];
      if (parent === null || parent === undefined) return;
      var a = positions[parent], b = positions[id];
      if (!a || !b) return;
      edgeVerts.push(a.x,a.y,a.z, b.x,b.y,b.z);
    });
    var edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVerts, 3));
    group.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color:0xbfbfbf, transparent:true, opacity:0.35 })));

    var meshList = [];
    var meshById = {};
    RM_NODES.forEach(function(n){
      var id=n[0], depth=n[1], parent=n[2], label=n[3], text=n[4];
      var pos = positions[id];
      if (!pos) return;
      var size = depth === 0 ? 0.055 : Math.max(0.014, 0.032 - depth*0.003);
      var mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 0),
        new THREE.MeshBasicMaterial({ color: depthColor(depth), wireframe:true })
      );
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData = { id:id, parent:parent, label:label, text:text, depth:depth, baseColor:depthColor(depth), baseScale:1 };
      group.add(mesh);
      meshList.push(mesh);
      meshById[id] = mesh;
    });
    group.userData.meshList = meshList;
    group.userData.meshById = meshById;
    // Scale + reposition to roughly fill the same visual footprint the
    // buoyancy shells occupy in this scene (shell radii top out ~1.9) --
    // the mind map's own shells go out to depth 6 (~2.4), so normalize.
    group.scale.setScalar(0.8);
    group.visible = false;
    return group;
  }

  function ensureAttached(){
    if (typeof THREE === 'undefined' || !window._brpnScene) return false;
    if (attachedToScene === window._brpnScene && mindMapGroup) return true;
    // scene was (re)created (e.g. WebGL context restore) -- rebuild fresh
    mindMapGroup = buildGroup();
    window._brpnScene.add(mindMapGroup);
    window._brpnMindMapGroup = mindMapGroup;
    attachedToScene = window._brpnScene;
    wireHover();
    ensurePolling();
    return true;
  }

  function wireHover(){
    if (!window._brpnRenderer) return;
    var canvas = window._brpnRenderer.domElement;
    if (canvas._rmHoverWired) return;
    canvas._rmHoverWired = true;
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    canvas.addEventListener('mousemove', function(ev){
      if (!active || !mindMapGroup || !window._brpnCamera) return;
      var rect = canvas.getBoundingClientRect();
      mouse.x = ((ev.clientX-rect.left)/rect.width)*2 - 1;
      mouse.y = -((ev.clientY-rect.top)/rect.height)*2 + 1;
      raycaster.setFromCamera(mouse, window._brpnCamera);
      var hit = raycaster.intersectObjects(mindMapGroup.userData.meshList || [])[0];
      if (labelEl) labelEl.textContent = hit ? (hit.object.userData.label + ' \u2014 ' + hit.object.userData.text) : '';
    });
    wireZoom(canvas);
  }

  // TF-web-135: direct ask -- pinch-to-zoom on the mind map, which had none.
  // The existing drag-rotate here is per-object rotation driven by shared
  // rotX/rotY state (not a true camera orbit), so "zoom" is implemented the
  // same way: scaling this group specifically, only while it's the active
  // view, leaving the shared camera and the buoyancy-shell view's own
  // interactions completely alone. Two-finger pinch on touch, wheel on
  // desktop. Base scale is 0.8 (set in buildGroup); bounds keep it from
  // collapsing to a point or blowing past the scene bounds.
  var zoomScale = 0.8;
  var ZOOM_MIN = 0.25, ZOOM_MAX = 2.4;
  function applyZoom(factor){
    if (!mindMapGroup) return;
    zoomScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomScale * factor));
    mindMapGroup.scale.setScalar(zoomScale);
  }
  function wireZoom(canvas){
    if (canvas._rmZoomWired) return;
    canvas._rmZoomWired = true;
    var pinchStartDist = null;
    function touchDist(touches){
      var dx = touches[0].clientX - touches[1].clientX;
      var dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx*dx + dy*dy);
    }
    canvas.addEventListener('touchstart', function(ev){
      if (!active) return;
      if (ev.touches.length === 2) pinchStartDist = touchDist(ev.touches);
    }, { passive:true });
    canvas.addEventListener('touchmove', function(ev){
      if (!active || ev.touches.length !== 2 || pinchStartDist === null) return;
      var d = touchDist(ev.touches);
      applyZoom(d / pinchStartDist);
      pinchStartDist = d;
    }, { passive:true });
    canvas.addEventListener('touchend', function(ev){
      if (ev.touches.length < 2) pinchStartDist = null;
    }, { passive:true });
    canvas.addEventListener('wheel', function(ev){
      if (!active) return;
      ev.preventDefault();
      applyZoom(ev.deltaY < 0 ? 1.08 : 0.93);
    }, { passive:false });
  }

  function ensureLabel(){
    if (labelEl) return;
    labelEl = document.createElement('div');
    labelEl.id = 'rm-inline-label';
    labelEl.style.cssText = 'position:absolute;left:8px;right:8px;bottom:52px;z-index:16;pointer-events:none;'
      + 'font-family:sans-serif;font-size:10px;line-height:1.4;color:rgba(224,244,255,.85);'
      + 'background:rgba(4,9,16,.6);border:1px solid rgba(115,217,255,.2);border-radius:5px;'
      + 'padding:4px 8px;min-height:13px;text-align:center';
    var region = document.getElementById('brpn-region');
    if (region) region.appendChild(labelEl);
  }

  // TF-web-131: checked BRPNSceneViewModel.applyMindMapVisibility() on iOS
  // before adding anything here -- it does NOT post any analytics event on
  // toggle, just swaps visibility. So this doesn't either; adding one here
  // that iOS lacks would make the two sides inconsistent, the opposite of
  // the point.
  // TF-web-132: port of LeatrMindMapScene.pulsePath/reflexPulse -- real,
  // prompt-driven feedback, not just idle ambient rotation. Checked what
  // iOS actually matches against before writing this: ReflexStage text
  // ("User Input Prompt", "AI Output Prompt", "Sentience Journal", etc.),
  // which does exist verbatim in this same node data (confirmed before
  // wiring anything). Finds the best text match (longest wins, same tie-
  // break iOS uses), walks its ancestor chain to root, and pulses each
  // node in sequence with a short stagger -- so it reads as a signal
  // traveling down the tree, same as iOS. No SceneKit emission slot here,
  // so this pulses via MeshBasicMaterial.color (bright pulse color) and
  // scale, decaying back to the node's normal depth color -- the visual
  // equivalent adapted to what Three.js's wireframe material actually has.
  var activePulses = []; // {mesh, startAt, color, intensity}
  var recentFires = {};

  function findBestMatch(query){
    var q = query.toLowerCase();
    var best = null, bestLen = -1;
    RM_NODES.forEach(function(n){
      var text = n[4].toLowerCase();
      if (text.indexOf(q) !== -1 || q.indexOf(text) !== -1) {
        if (n[4].length > bestLen) { best = n; bestLen = n[4].length; }
      }
    });
    return best;
  }

  window._reflexMapPulse = function(query, colorHex){
    if (!mindMapGroup || !query) return;
    var best = findBestMatch(query);
    if (!best) return;
    var now = performance.now();
    var isRepeat = recentFires[query] !== undefined && (now - recentFires[query]) < 4000;
    recentFires[query] = now;

    var chain = [best];
    var cursor = best;
    while (cursor[2] !== null && cursor[2] !== undefined) {
      var parentNode = null;
      for (var i = 0; i < RM_NODES.length; i++) { if (RM_NODES[i][0] === cursor[2]) { parentNode = RM_NODES[i]; break; } }
      if (!parentNode) break;
      chain.push(parentNode);
      cursor = parentNode;
    }
    chain.reverse();
    var color = colorHex !== undefined ? colorHex : depthColor(best[1]);
    var intensity = isRepeat ? 1.6 : 1.0;
    chain.forEach(function(node, i){
      var mesh = mindMapGroup.userData.meshById[node[0]];
      if (!mesh) return;
      activePulses = activePulses.filter(function(p){ return p.mesh !== mesh; }); // cancel any in-flight pulse on this node
      activePulses.push({ mesh:mesh, startAt: now + i*60, color:color, intensity:intensity, attackMs:120, decayMs:900 });
    });
    appendToSequence(best[0], color);
    var q = query.toLowerCase();
    if (q === 'ai output prompt' || q === 'connected resources') scheduleSequenceReset();
  };

  function updatePulses(){
    if (!activePulses.length) return;
    var now = performance.now();
    var stillActive = [];
    activePulses.forEach(function(p){
      var t = now - p.startAt;
      if (t < 0) { stillActive.push(p); return; } // not started yet
      var mesh = p.mesh;
      var s = 4.0 * p.intensity;
      if (t < p.attackMs) {
        var a = t / p.attackMs;
        mesh.scale.setScalar(1 + (s-1)*a);
        mesh.material.color.set(p.color);
        stillActive.push(p);
      } else if (t < p.attackMs + p.decayMs) {
        var d = (t - p.attackMs) / p.decayMs;
        mesh.scale.setScalar(s + (1-s)*d);
        mesh.material.color.copy(new THREE.Color(p.color)).lerp(new THREE.Color(mesh.userData.baseColor), d);
        stillActive.push(p);
      } else {
        mesh.scale.setScalar(1);
        mesh.material.color.set(mesh.userData.baseColor);
      }
    });
    activePulses = stillActive;
  }

  // TF-web-133: the "circuit schematic" sequence-flow layer -- the piece
  // explicitly flagged as skipped earlier and asked for properly now.
  // Port of appendToSequence/scheduleSequenceReset/resetSequence: while a
  // prompt is actively processing, each node it actually touches (in the
  // real order it touched them) gets a bright temporary direct line to the
  // one before it -- even when they aren't tree-adjacent, since the real
  // order of operations for a prompt jumps between branches. The static
  // tree never moves; this is a fully additive overlay that fades out and
  // clears ~2.5s after the prompt finishes (AI Output Prompt / Connected
  // Resources, the same two stages iOS resets on), cancelable/reschedulable
  // if another event arrives first so a still-processing prompt is never
  // cut off mid-sequence.
  var sequenceNodeIDs = [];
  var flowGroup = null;
  var sequenceResetTimer = null;

  function appendToSequence(id, color){
    var last = sequenceNodeIDs.length ? sequenceNodeIDs[sequenceNodeIDs.length-1] : null;
    sequenceNodeIDs.push(id);
    if (last === null || last === id || !mindMapGroup) return;
    var meshA = mindMapGroup.userData.meshById[last];
    var meshB = mindMapGroup.userData.meshById[id];
    if (!meshA || !meshB) return;
    if (!flowGroup) {
      flowGroup = new THREE.Group();
      flowGroup.name = 'mindmap_flow';
      mindMapGroup.add(flowGroup);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      meshA.position.x, meshA.position.y, meshA.position.z,
      meshB.position.x, meshB.position.y, meshB.position.z
    ], 3));
    // Noticeably thicker/brighter than the tree's own resting edges
    // (opacity .35) -- this is meant to be the most visually prominent
    // thing while a prompt is processing.
    var mat = new THREE.LineBasicMaterial({ color:color, transparent:true, opacity:0, linewidth:2 });
    var line = new THREE.Line(geo, mat);
    flowGroup.add(line);
    // fade the new segment in
    var start = performance.now();
    (function fadeIn(){
      var t = Math.min(1, (performance.now()-start)/180);
      mat.opacity = 0.95*t;
      if (t < 1) requestAnimationFrame(fadeIn);
    })();
  }

  function resetSequence(){
    sequenceNodeIDs = [];
    if (!flowGroup) return;
    var group = flowGroup;
    flowGroup = null;
    var start = performance.now();
    var mats = group.children.map(function(l){ return l.material; });
    var startOpacities = mats.map(function(m){ return m.opacity; });
    (function fadeOut(){
      var t = Math.min(1, (performance.now()-start)/600);
      mats.forEach(function(m,i){ m.opacity = startOpacities[i]*(1-t); });
      if (t < 1) { requestAnimationFrame(fadeOut); return; }
      if (mindMapGroup) mindMapGroup.remove(group);
      group.children.forEach(function(l){ l.geometry.dispose(); l.material.dispose(); });
    })();
  }

  function scheduleSequenceReset(){
    if (sequenceResetTimer) clearTimeout(sequenceResetTimer);
    sequenceResetTimer = setTimeout(resetSequence, 2500);
  }

  // TF-web-134: direct correction -- this was only ever reacting to THIS
  // browser tab's own evolveOrb calls, so another user's activity never
  // showed up here even though it's the same shared real-time scene. The
  // data already exists (same ashtree/analytics-live/ chunk every device
  // writes to, already fixed earlier this session to be a complete,
  // independent read on both iOS and web) -- this was just never actually
  // watching it for pulse purposes. Polls the current chunk, diffs against
  // the last-seen length for the current (mazeId, chunkIndex) pair, and
  // pulses every genuinely new entry -- from ANY contributor, this tab's
  // own included, so a local prompt and a remote one animate identically.
  var pollTimer = null;
  var pollState = { mazeId:null, chunkIndex:null, seenCount:0 };
  var POLL_MS = 5000;

  function pollSharedActivity(){
    var GAS_URL = (typeof AUTUMN_GAS_URL !== 'undefined' && AUTUMN_GAS_URL && !AUTUMN_GAS_URL.includes('YOUR_DEPLOYED')) ? AUTUMN_GAS_URL : null;
    if (!GAS_URL) return;
    function ashread(path){
      return fetch(GAS_URL+'?action=ashread&path='+encodeURIComponent(path), { signal: AbortSignal.timeout(20000) })
        .then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
    }
    ashread('ashtree/analytics-live/config.json').then(function(cfg){
      if (!cfg || !cfg.enabled || !cfg.mazeId) return;
      var chunkIdx = cfg.currentChunkIndex || 0;
      if (pollState.mazeId !== cfg.mazeId || pollState.chunkIndex !== chunkIdx) {
        // new session or chunk rollover -- resync to "everything from here
        // is new" rather than replaying a whole session's history at once
        pollState.mazeId = cfg.mazeId; pollState.chunkIndex = chunkIdx; pollState.seenCount = -1;
      }
      var path = 'ashtree/analytics-live/'+cfg.mazeId+'/chunk-'+chunkIdx+'.json';
      return ashread(path).then(function(chunk){
        var events = Array.isArray(chunk) ? chunk : [];
        if (pollState.seenCount === -1) { pollState.seenCount = events.length; return; } // first sight of this chunk: baseline only, don't replay history
        if (events.length <= pollState.seenCount) return;
        var fresh = events.slice(pollState.seenCount);
        pollState.seenCount = events.length;
        fresh.forEach(function(ev, i){
          if (!ev || !ev.label) return;
          setTimeout(function(){ window._reflexMapPulse(ev.label); }, i*150);
        });
      });
    }).catch(function(){});
  }

  function ensurePolling(){
    if (pollTimer) return;
    pollTimer = setInterval(pollSharedActivity, POLL_MS);
    pollSharedActivity();
  }

  window.reflexMapToggle = function(){
    if (!ensureAttached()) return;
    active = !active;
    ensureLabel();
    mindMapGroup.visible = active;
    // Hide every other top-level scene child while active, restore on exit.
    window._brpnScene.children.forEach(function(child){
      if (child === mindMapGroup) return;
      if (active) { if (child.userData.__rmPrevVisible === undefined) child.userData.__rmPrevVisible = child.visible; child.visible = false; }
      else if (child.userData.__rmPrevVisible !== undefined) { child.visible = child.userData.__rmPrevVisible; delete child.userData.__rmPrevVisible; }
    });
    if (labelEl) labelEl.style.display = active ? '' : 'none';
    document.querySelectorAll('#bmh-reflexmap-btn').forEach(function(btn){
      btn.classList.toggle('rm-active', active);
      if (btn.tagName === 'BUTTON') btn.classList.toggle('bmh-active', active);
    });
  };

  // Per-frame slow rotation while active, hooked from the main animate()
  // loop rather than running its own rAF (one render loop for the shared
  // scene, matching how everything else already animates here).
  window._reflexMapTick = function(){
    updatePulses(); // pulses animate even while the map isn't the active view, so a node that already caught up is ready the instant you switch to it
  };
})();
