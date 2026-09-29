
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
    RM_NODES.forEach(function(n){
      var id=n[0], depth=n[1], label=n[3], text=n[4];
      var pos = positions[id];
      if (!pos) return;
      var size = depth === 0 ? 0.055 : Math.max(0.014, 0.032 - depth*0.003);
      var mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 0),
        new THREE.MeshBasicMaterial({ color: depthColor(depth), wireframe:true })
      );
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData = { label:label, text:text, depth:depth };
      group.add(mesh);
      meshList.push(mesh);
    });
    group.userData.meshList = meshList;
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
    attachedToScene = window._brpnScene;
    wireHover();
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
    document.querySelectorAll('#hud-reflexmap-btn, #bmh-reflexmap-btn').forEach(function(btn){
      btn.classList.toggle('rm-active', active);
      if (btn.tagName === 'BUTTON') btn.classList.toggle('bmh-active', active);
    });
  };

  // Per-frame slow rotation while active, hooked from the main animate()
  // loop rather than running its own rAF (one render loop for the shared
  // scene, matching how everything else already animates here).
  window._reflexMapTick = function(){
    if (active && mindMapGroup) mindMapGroup.rotation.y += 0.0018;
  };
})();
