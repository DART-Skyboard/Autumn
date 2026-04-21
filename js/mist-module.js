// ═══════════════════════════════════════════════════════════════════════════
//  MIST MODULE v3 — Autumn Lead Edge Maze · Multi-User Real-Time
//  DART-Skyboard/Autumn  ·  Radical Deepscale LLC
//
//  TWO-PHASE PROTOCOL
//  ──────────────────
//  PHASE 1 — SEND (your device, you solve):
//    • Local animation: particles burst OUT from your orb center
//    • Write {type:'solve', uid, slot, ts, instanceId} → ashtree/mist/{sid}.json
//
//  PHASE 2A — REACT (other devices, pattern-matched):
//    • Poll finds your solve → compute _sessionPatternScore(theirUid, yourUid)
//    • If score ≥ MATCH_THRESHOLD:
//        – Their node fires local reaction geometry (mist at their orb)
//        – Write {type:'reaction', uid:theirSid, slot, ts, replyTo:yourSid}
//              → ashtree/mist/{theirSid}.json
//
//  PHASE 2B — FEEDBACK (your device, you see reactions):
//    • Poll finds {type:'reaction', replyTo:yourSid}
//    • Render reaction geometry AT that node's position in your scene
//        (shockwave ring expanding from their node — not traveling to yours)
//
//  POLLING — SHA-diff cache: directory listing every 3s,
//            file content fetched ONLY when sha changes. 
//            Minimises GitHub API usage for real-time feel.
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────
  var MATCH_THRESHOLD  = 0.22;  // _sessionPatternScore min to trigger reaction
  var POLL_MS          = 3000;  // poll interval — 3s for real-time feel
  var STALE_MS         = 90000; // ignore events older than 90s
  var MAX_MIST_FILES   = 40;    // max files to scan per poll
  var REACTION_LIMIT   = 8;     // max simultaneous reaction geometries
  var REACTION_COOLDOWN= 4000;  // ms between reactions from same uid

  // ── State ────────────────────────────────────────────────────────────────
  var MIST = {
    open: false, difficulty: 1,
    mazes: [null,null,null], solvedCount: 0,
    dragging: false, dragPos: null, dragPath: [],
    activeMaze: 0, sphereTarget: null, sphereActual: null, sphereAnimId: null,
    seenKeys:  {},   // "uid:ts" → true  (debounce all events)
    lastReact: {}    // uid → ts  (cooldown per remote uid)
  };

  var DIFF = { 1:{w:5,h:5}, 2:{w:9,h:9}, 3:{w:13,h:13} };

  var _instanceId = 'mi_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);

  // Recent local solve uids+ts so we can match incoming reactions
  var _myRecentSolves = []; // [{uid, ts}]  keep last 20

  // SHA diff cache — only fetch file content when sha changes
  var _shaCache = {}; // filename → sha

  // Slot → BRPN reaction profile
  var SLOT_PROFILE = {
    0: { emotion:'inspired',   pulse:1.4, speed:1.25, shellBoost:[0.08,0.06,0.04], label:'★ STAR SOLVED',   color:0xffdd00 },
    1: { emotion:'empathetic', pulse:1.6, speed:1.1,  shellBoost:[0.05,0.10,0.06], label:'♥ HEART SOLVED',  color:0xff4488 },
    2: { emotion:'spiritual',  pulse:1.0, speed:0.8,  shellBoost:[0.12,0.08,0.10], label:'◈ MIST SOLVED',   color:0x00e5ff }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _localSid() {
    return (typeof _aut_sid !== 'undefined') ? _aut_sid
         : (typeof _aut_uid !== 'undefined') ? _aut_uid
         : 'local';
  }
  function _pat() {
    return (typeof getLeatrAshPAT === 'function') ? getLeatrAshPAT() : '';
  }
  function _patScore(a, b) {
    if(typeof _sessionPatternScore === 'function') return _sessionPatternScore(a, b);
    // Fallback hash-based pseudo-score when function not yet loaded
    var h = 0;
    for(var i=0;i<a.length;i++) h=(h*31+a.charCodeAt(i))&0x7fffffff;
    var h2=0;
    for(var j=0;j<b.length;j++) h2=(h2*31+b.charCodeAt(j))&0x7fffffff;
    return Math.max(0, 1 - Math.abs(h/0x7fffffff - h2/0x7fffffff) * 2.5);
  }
  function _nodePos(uid) {
    // Returns THREE.Vector3 for a remote session node, or null if not in scene
    if(typeof _ashNodes === 'undefined' || !_ashNodes._sessionGroups) return null;
    var g = _ashNodes._sessionGroups[uid];
    return (g && g.group) ? g.group.position.clone() : null;
  }
  function _applyBRPN(prof) {
    if(typeof pulseShells === 'function') {
      pulseShells(prof.pulse);
      setTimeout(function(){ if(typeof pulseShells==='function') pulseShells(prof.pulse*.5); }, 230);
    }
    if(typeof applyOrbEmotion === 'function') applyOrbEmotion(prof.emotion);
    window._acShellBoost = window._acShellBoost || [0,0,0];
    window._acShellBoost[0] = Math.min(.22, (window._acShellBoost[0]||0) + prof.shellBoost[0]);
    window._acShellBoost[1] = Math.min(.18, (window._acShellBoost[1]||0) + prof.shellBoost[1]);
    window._acShellBoost[2] = Math.min(.16, (window._acShellBoost[2]||0) + prof.shellBoost[2]);
    window._orbEmoSpeedMult = prof.speed;
    setTimeout(function(){ window._orbEmoSpeedMult = Math.max(window._orbEmoSpeedMult*.85, 1.0); }, 1800);
    if(typeof mazeOrbState !== 'undefined') {
      mazeOrbState.solveActive=true; mazeOrbState.solveStep=0;
      if(mazeOrbState.pathMeshes) mazeOrbState.pathMeshes.forEach(function(m){ if(m&&m.material) m.material.opacity=0; });
    }
  }
  function _journal(msg) {
    if(window.S && window.S.journal)
      window.S.journal.push({ts:new Date().toISOString(),_internal:true,_thought:msg});
  }

  // ── PHASE 1 — LOCAL SOLVE ─────────────────────────────────────────────
  function _onLocalSolve(slot) {
    var prof = SLOT_PROFILE[slot];
    _applyBRPN(prof);
    _spawnOutgoingMist(slot);  // burst OUT from your orb
    _journal('MIST SEND — slot ' + slot + ' (' + prof.label + '). Broadcasting to network.');

    var uid = _localSid(), ts = Date.now();
    _myRecentSolves.push({uid:uid, ts:ts});
    if(_myRecentSolves.length > 20) _myRecentSolves.shift();

    // Write solve event to leatr-ash
    if(typeof writeLeatrAshMemory === 'function') {
      writeLeatrAshMemory('ashtree/mist/' + uid + '.json', {
        type: 'solve', uid: uid, slot: slot, ts: ts,
        instanceId: _instanceId, label: prof.label, emotion: prof.emotion
      });
    }
    // Instant same-origin tab notification
    _bcSend({ type:'solve', uid:uid, slot:slot, ts:ts });
  }

  // ── PHASE 2A — REACT to incoming solve (fires on OTHER sessions) ───────
  function _onIncomingSolve(ev) {
    var prof = SLOT_PROFILE[ev.slot];
    var myUid = _localSid();

    // Pattern match check
    var score = _patScore(myUid, ev.uid);
    if(score < MATCH_THRESHOLD) return;

    // Cooldown — don't react to same sender more than once per REACTION_COOLDOWN
    var now = Date.now();
    if(MIST.lastReact[ev.uid] && (now - MIST.lastReact[ev.uid]) < REACTION_COOLDOWN) return;
    MIST.lastReact[ev.uid] = now;

    // Apply BRPN on this session
    _applyBRPN(prof);
    // Fire reaction geometry from THIS session's orb
    _spawnReactionLocal(slot, score);
    _journal('MIST REACT — incoming from ' + ev.uid.slice(0,14) + ' (score:' + score.toFixed(2) + '). Slot ' + ev.slot + '.');

    // Write reaction back so sender sees it
    if(typeof writeLeatrAshMemory === 'function') {
      writeLeatrAshMemory('ashtree/mist/' + myUid + '.json', {
        type: 'reaction', uid: myUid, slot: ev.slot, ts: now,
        replyTo: ev.uid, score: score, instanceId: _instanceId
      });
    }
    _bcSend({ type:'reaction', uid:myUid, slot:ev.slot, ts:now, replyTo:ev.uid, score:score });
  }

  // ── PHASE 2B — FEEDBACK: see remote reaction in YOUR scene ─────────────
  function _onRemoteReaction(ev) {
    // Show their reaction AT their node in your scene
    var pos = _nodePos(ev.uid);
    _spawnReactionRemote(ev.slot, pos, ev.score || 0.5);
    _journal('MIST FEEDBACK — ' + ev.uid.slice(0,14) + ' reacted to your solve (slot ' + ev.slot + ').');
  }

  // ── GEOMETRY — PHASE 1: outgoing burst from your orb ──────────────────
  // Full STAR/HEART/MIST geometry radiating outward, connecting to all
  // visible session nodes via curves.
  var _activeGeom = [];
  function _spawnOutgoingMist(slot) {
    if(typeof THREE === 'undefined' || typeof scene === 'undefined') return;
    var col = new THREE.Color(SLOT_PROFILE[slot].color);

    // Positions: orb center + all known remote nodes
    var positions = [new THREE.Vector3(0,0,0)];
    if(typeof _ashNodes !== 'undefined' && _ashNodes._sessionGroups) {
      Object.keys(_ashNodes._sessionGroups).forEach(function(sid) {
        var g = _ashNodes._sessionGroups[sid];
        if(g && g.group) positions.push(g.group.position.clone());
      });
    }
    if(positions.length < 2) {
      positions.push(new THREE.Vector3(2.2,1.2,-1.2));
      positions.push(new THREE.Vector3(-1.8,1.8,1));
    }

    _buildMistGroup(slot, col, positions, false, 1.0);
  }

  // ── GEOMETRY — PHASE 2A: your node reacts to incoming (local reaction) ─
  // Smaller contained burst from your orb, scaled by pattern score.
  function _spawnReactionLocal(slot, score) {
    if(typeof THREE === 'undefined' || typeof scene === 'undefined') return;
    var base = SLOT_PROFILE[slot].color;
    // Shift hue slightly for visual distinction from outgoing
    var col = new THREE.Color(base);
    var hsl = {}; col.getHSL(hsl);
    col.setHSL((hsl.h + 0.08) % 1.0, hsl.s, Math.min(0.9, hsl.l * 1.15));
    _buildMistGroup(slot, col, [new THREE.Vector3(0,0,0)], false, Math.min(1.0, 0.5 + score * 0.5));
  }

  // ── GEOMETRY — PHASE 2B: shockwave ring AT the reacting remote node ────
  // A toroidal shockwave that expands and fades at the remote node's position.
  // Does NOT travel anywhere — it's their node "glowing" in your scene.
  function _spawnReactionRemote(slot, pos, score) {
    if(typeof THREE === 'undefined' || typeof scene === 'undefined') return;
    var col = new THREE.Color(SLOT_PROFILE[slot].color);
    var origin = pos || new THREE.Vector3(
      (Math.random()-.5)*4, (Math.random()-.5)*4, (Math.random()-.5)*4
    );
    var group = new THREE.Group();
    group._mAge = 0; group._mMax = 140; group._mSlot = slot; group._mObjs = [];
    group._mMode = 'remote_reaction';

    // 3 expanding rings + scattered small sparks
    for(var r=0; r<3; r++) {
      var ringGeo = new THREE.TorusGeometry(0.08 + r*0.06, 0.012, 4, 18);
      var ringMat = new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0.85-r*0.15, wireframe:true});
      var ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(origin);
      ring.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
      ring._expandSpd = 0.008 + r*0.004 + score*0.006;
      ring._mr = new THREE.Vector3(Math.random()*.04, Math.random()*.03, 0);
      group._mObjs.push(ring); group.add(ring);
    }
    // Score-scaled spark count
    var sparks = Math.round(6 + score * 10);
    for(var s=0; s<sparks; s++) {
      var sg = new THREE.OctahedronGeometry(0.03 + Math.random()*.04, 0);
      var sm = new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0.75, wireframe:true});
      var spark = new THREE.Mesh(sg, sm);
      spark.position.copy(origin);
      var a=Math.random()*Math.PI*2, b=Math.acos(2*Math.random()-1), spd=0.008+Math.random()*.014;
      spark._mv = new THREE.Vector3(Math.sin(b)*Math.cos(a)*spd, Math.sin(b)*Math.sin(a)*spd, Math.cos(b)*spd);
      spark._mr = new THREE.Vector3(Math.random()*.06, Math.random()*.05, 0);
      spark._origin = origin.clone();
      spark._maxDist = 0.5 + score * 0.8;
      group._mObjs.push(spark); group.add(spark);
    }

    scene.add(group);
    _activeGeom.push(group);
  }

  // ── GEOMETRY — shared builder (outgoing + local reaction) ─────────────
  function _buildMistGroup(slot, col, positions, isReaction, scale) {
    var group = new THREE.Group();
    group._mAge = 0; group._mMax = isReaction ? 140 : 180;
    group._mSlot = slot; group._mObjs = [];
    group._mMode = isReaction ? 'local_reaction' : 'outgoing';
    var perNode = Math.round((slot===0?6:slot===1?4:7) * scale);

    positions.forEach(function(nodePos, ni) {
      for(var i=0; i<(ni===0?perNode:Math.max(2,perNode-2)); i++) {
        var geo, mat, mesh;
        if(slot===0) {
          geo = new THREE.OctahedronGeometry((0.09+Math.random()*.13)*scale, 0);
          mat = new THREE.MeshBasicMaterial({color:col, wireframe:true, transparent:true, opacity:.9});
          mesh = new THREE.Mesh(geo, mat);
          mesh.position.copy(nodePos);
          var a=Math.random()*Math.PI*2, b=Math.acos(2*Math.random()-1), spd=(0.022+Math.random()*.038)*scale;
          mesh._mv = new THREE.Vector3(Math.sin(b)*Math.cos(a)*spd, Math.sin(b)*Math.sin(a)*spd, Math.cos(b)*spd);
          mesh._mr = new THREE.Vector3(Math.random()*.05, Math.random()*.04, 0);
        } else if(slot===1) {
          geo = new THREE.SphereGeometry((0.055+Math.random()*.04)*scale, 5, 5);
          mat = new THREE.MeshBasicMaterial({color:col, wireframe:true, transparent:true, opacity:.85});
          mesh = new THREE.Mesh(geo, mat);
          var origin = positions[0], target = nodePos;
          var mid = origin.clone().add(target).multiplyScalar(.5)
            .add(new THREE.Vector3((Math.random()-.5)*.8, 1.2+Math.random()*.8, (Math.random()-.5)*.8));
          mesh._mc = new THREE.CatmullRomCurve3([origin.clone(), mid, target.clone()]);
          mesh._mt = (i/perNode)*-.35; mesh._mspd = (0.006+Math.random()*.003)*scale;
          mesh._mr = new THREE.Vector3(0, 0, Math.random()*.04);
          mesh.position.copy(origin);
        } else {
          geo = new THREE.TetrahedronGeometry((0.07+Math.random()*.1)*scale, 0);
          mat = new THREE.MeshBasicMaterial({color:col, wireframe:true, transparent:true, opacity:.65});
          mesh = new THREE.Mesh(geo, mat);
          var curve = null;
          if(typeof _ashNodes !== 'undefined' && _ashNodes._splines) {
            var ks = Object.keys(_ashNodes._splines);
            if(ks.length) curve = _ashNodes._splines[ks[(ni*perNode+i)%ks.length]].curve;
          }
          if(!curve) {
            var pa=positions[0], pb=positions[Math.max(1,(ni+1)%positions.length)];
            var mpt=pa.clone().add(pb).multiplyScalar(.5)
              .add(new THREE.Vector3((Math.random()-.5)*1.5,(Math.random()-.5)*1.5,0));
            curve=new THREE.CatmullRomCurve3([pa.clone(),mpt,pb.clone()]);
          }
          mesh._mc=curve; mesh._mt=Math.random(); mesh._mspd=(0.004+Math.random()*.005)*scale;
          mesh._mr=new THREE.Vector3(Math.random()*.035,Math.random()*.03,0);
          mesh.position.copy(curve.getPoint(mesh._mt));
        }
        group._mObjs.push(mesh); group.add(mesh);
      }
    });

    // Connecting arc lines from origin to targets
    for(var li=0; li<Math.min(5,positions.length); li++) {
      var lpa=positions[0], lpb=positions[(li+1)%positions.length];
      var lmid=lpa.clone().add(lpb).multiplyScalar(.5)
        .add(new THREE.Vector3((Math.random()-.5)*2,(Math.random()-.5)*2,0));
      var lc=new THREE.CatmullRomCurve3([lpa,lmid,lpb]);
      var lGeo=new THREE.BufferGeometry().setFromPoints(lc.getPoints(40));
      var lMat=new THREE.LineBasicMaterial({color:col,transparent:true,opacity:.35*scale});
      group.add(new THREE.Line(lGeo,lMat));
    }
    scene.add(group);
    _activeGeom.push(group);
  }

  // ── Animation tick ───────────────────────────────────────────────────────
  (function _tick() {
    requestAnimationFrame(_tick);
    if(!_activeGeom.length) return;
    var rem = [];
    _activeGeom.forEach(function(g) {
      g._mAge++;
      var fade = 1 - g._mAge/g._mMax;
      if(fade <= 0) { rem.push(g); return; }
      g._mObjs.forEach(function(obj) {
        if(g._mMode === 'remote_reaction') {
          // Rings expand, sparks fly out then stop
          if(obj._expandSpd !== undefined) {
            // Ring
            var s = obj.scale.x + obj._expandSpd;
            obj.scale.setScalar(s);
            obj.rotation.x += obj._mr.x; obj.rotation.y += obj._mr.y;
            obj.material.opacity = (0.85 - (obj.scale.x-1)*0.6) * fade;
          } else {
            // Spark — moves until max dist then stays
            if(obj._origin) {
              var dist = obj.position.distanceTo(obj._origin);
              if(dist < obj._maxDist) obj.position.add(obj._mv);
              obj.rotation.x += obj._mr.x; obj.rotation.y += obj._mr.y;
              obj.material.opacity = .75 * fade;
            }
          }
        } else if(g._mSlot===0) {
          obj.position.add(obj._mv);
          obj.rotation.x+=obj._mr.x; obj.rotation.y+=obj._mr.y;
          obj.material.opacity=.9*fade;
        } else if(g._mSlot===1) {
          obj._mt+=obj._mspd; if(obj._mt>1) obj._mt=0;
          if(obj._mc){ var pt=obj._mc.getPoint(Math.min(1,obj._mt)); obj.position.copy(pt); }
          obj.rotation.z+=obj._mr.z; obj.material.opacity=.85*fade;
        } else {
          obj._mt+=obj._mspd; if(obj._mt>1) obj._mt=0;
          if(obj._mc){ var pt2=obj._mc.getPoint(obj._mt); obj.position.copy(pt2); obj.position.x+=Math.sin(g._mAge*.06+obj._mt*5)*.07; }
          obj.rotation.x+=obj._mr.x; obj.rotation.y+=obj._mr.y;
          obj.material.opacity=.65*fade;
        }
      });
    });
    rem.forEach(function(g) {
      if(typeof scene !== 'undefined') scene.remove(g);
      g._mObjs.forEach(function(o){ o.geometry&&o.geometry.dispose(); o.material&&o.material.dispose(); });
      var idx = _activeGeom.indexOf(g); if(idx>=0) _activeGeom.splice(idx,1);
    });
  })();

  // ── POLL — SHA-diff cache, 3s interval ──────────────────────────────────
  function _poll() {
    var pat = _pat(); if(!pat) return;
    fetch('https://api.github.com/repos/DART-Skyboard/leatr-ash/contents/ashtree/mist',{
      headers:{'Authorization':'token '+pat,'Accept':'application/vnd.github.v3+json','Cache-Control':'no-cache'},
      signal: AbortSignal.timeout(5000)
    }).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(files) {
      if(!Array.isArray(files)) return;
      var myUid = _localSid();
      files.filter(function(f){ return f.name.endsWith('.json'); })
           .slice(0, MAX_MIST_FILES)
           .forEach(function(f) {
        // Only fetch if SHA changed since last poll
        if(_shaCache[f.name] === f.sha) return;
        _shaCache[f.name] = f.sha;

        fetch(f.download_url + '?_=' + Date.now(), { signal: AbortSignal.timeout(4000) })
          .then(function(r){ return r.ok ? r.json() : null; })
          .then(function(d) {
            var evts = Array.isArray(d) ? d : (d && d.ts && d.uid) ? [d] : null;
            if(!evts || !evts.length) return;

            evts.forEach(function(ev) {
              if(!ev || !ev.ts || !ev.uid) return;
              // Ignore own instance to prevent double-fire
              if(ev.instanceId && ev.instanceId === _instanceId) return;
              // Ignore stale
              if(Date.now() - ev.ts > STALE_MS) return;
              // Global debounce
              var key = ev.uid + ':' + ev.ts + ':' + (ev.type||'solve');
              if(MIST.seenKeys[key]) return;
              MIST.seenKeys[key] = true;

              var slot = (ev.slot != null) ? ev.slot : 0;

              if(ev.type === 'reaction' && ev.replyTo) {
                // Is this a reaction to one of MY solves?
                var isMyFeedback = _myRecentSolves.some(function(s){
                  return s.uid === ev.replyTo && (ev.ts - s.ts) < STALE_MS;
                });
                if(isMyFeedback) {
                  // PHASE 2B: show their reaction at their node in my scene
                  var rpos = _nodePos(ev.uid);
                  _spawnReactionRemote(slot, rpos, ev.score || 0.5);
                  _journal('MIST FEEDBACK ← ' + ev.uid.slice(0,14) + ' reacted to your slot-' + slot + ' solve.');
                }
                // Also: if MY session has recently sent out a solve of the same slot,
                // any reaction from any session can visually reinforce (optional secondary effect)
              } else {
                // It's a solve from another session — run pattern match
                _onIncomingSolve(ev);
              }
            });
          }).catch(function(){});
      });
    }).catch(function(){});
  }

  // ── BroadcastChannel — instant same-origin tab sync ─────────────────────
  var _bc = null;
  try {
    _bc = new BroadcastChannel('autumn_mist');
    _bc.onmessage = function(e) {
      if(!e.data) return;
      var d = e.data, slot = (d.slot != null) ? d.slot : 0;
      var key = (d.uid||'?') + ':' + (d.ts||0) + ':' + (d.type||'solve');
      if(MIST.seenKeys[key]) return;
      MIST.seenKeys[key] = true;
      if(d.type === 'reaction' && d.replyTo) {
        var isMyFeedback = _myRecentSolves.some(function(s){ return s.uid === d.replyTo; });
        if(isMyFeedback) {
          _spawnReactionRemote(slot, _nodePos(d.uid), d.score || 0.5);
        }
      } else if(d.type === 'solve') {
        _onIncomingSolve(d);
      }
    };
  } catch(e) { _bc = null; }

  function _bcSend(data) {
    if(!_bc) return;
    try{ _bc.postMessage(data); } catch(e){}
  }

  // External hook for buoyancy system
  window._buoyancyMistPulse = function(detail) {
    if(detail && typeof detail.slot === 'number')
      _onIncomingSolve({ uid: detail.uid || _localSid(), slot: detail.slot, ts: Date.now(), type:'solve' });
  };

  // ── MAZE ENGINE ──────────────────────────────────────────────────────────
  var DIFF_CFG = { 1:{w:5,h:5}, 2:{w:9,h:9}, 3:{w:13,h:13} };

  function generateMaze(w, h) {
    var grid=[];
    for(var y=0;y<h;y++){ grid[y]=[]; for(var x=0;x<w;x++) grid[y][x]={n:1,s:1,e:1,w:1,v1:false}; }
    function carve(x,y){
      grid[y][x].v1=true;
      var dirs=[['n',0,-1],['s',0,1],['e',1,0],['w',-1,0]];
      dirs.sort(function(){return Math.random()-.5;});
      dirs.forEach(function(d){
        var nx=x+d[1],ny=y+d[2];
        if(nx>=0&&nx<w&&ny>=0&&ny<h&&!grid[ny][nx].v1){
          grid[y][x][d[0]]=0; grid[ny][nx][{n:'s',s:'n',e:'w',w:'e'}[d[0]]]=0; carve(nx,ny);
        }
      });
    }
    carve(0,0);
    function pickSide(){return['n','s','e','w'][Math.floor(Math.random()*4)];}
    function posOnSide(s){return(s==='n'||s==='s')?Math.floor(Math.random()*w):Math.floor(Math.random()*h);}
    function cellOnSide(s,p){if(s==='n')return{x:p,y:0};if(s==='s')return{x:p,y:h-1};if(s==='w')return{x:0,y:p};return{x:w-1,y:p};}
    var es,ep,xs,xp,att=0,valid=false,entry,exit;
    while(!valid&&att<500){
      att++;es=pickSide();ep=posOnSide(es);xs=pickSide();xp=posOnSide(xs);
      if(es===xs&&Math.abs(ep-xp)<2)continue;
      entry=cellOnSide(es,ep);exit=cellOnSide(xs,xp);
      var hasLOS=function(a,b){
        if(a.x===b.x){var y1=Math.min(a.y,b.y),y2=Math.max(a.y,b.y);for(var ty=y1;ty<y2;ty++)if(grid[ty][a.x].s)return false;return true;}
        if(a.y===b.y){var x1=Math.min(a.x,b.x),x2=Math.max(a.x,b.x);for(var tx=x1;tx<x2;tx++)if(grid[a.y][tx].e)return false;return true;}
        return false;
      };
      if(hasLOS(entry,exit))continue;
      var res=solveMaze({grid:grid,w:w,h:h,entry:entry,exit:exit});
      if(!res||res.length<(w+h)/1.4)continue;
      valid=true;
    }
    grid[entry.y][entry.x][es]=0; grid[exit.y][exit.x][xs]=0;
    return{grid:grid,w:w,h:h,entry:entry,exit:exit,entrySide:es,exitSide:xs,solution:solveMaze({grid:grid,w:w,h:h,entry:entry,exit:exit})};
  }

  function solveMaze(maze){
    if(!maze.grid)return null;
    var queue=[{x:maze.entry.x,y:maze.entry.y,path:[{x:maze.entry.x,y:maze.entry.y}]}];
    var seen={};seen[maze.entry.x+','+maze.entry.y]=true;
    var dirs={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
    while(queue.length){
      var cur=queue.shift();
      if(cur.x===maze.exit.x&&cur.y===maze.exit.y)return cur.path;
      var cell=maze.grid[cur.y][cur.x];
      Object.keys(dirs).forEach(function(d){
        if(cell[d]===0){var nx=cur.x+dirs[d][0],ny=cur.y+dirs[d][1],k=nx+','+ny;
          if(nx>=0&&nx<maze.w&&ny>=0&&ny<maze.h&&!seen[k]){seen[k]=true;queue.push({x:nx,y:ny,path:cur.path.concat([{x:nx,y:ny}])});}}
      });
    }
    return null;
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  function injectCSS(){
    var s=document.createElement('style');
    s.textContent=[
      '#mist-trigger{position:fixed;right:0;top:148px;z-index:9500;display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 5px;',
        'background:rgba(255,255,255,.05);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
        'border:1px solid rgba(0,229,255,.22);border-right:none;border-radius:7px 0 0 7px;cursor:pointer;transition:all .2s}',
      '#mist-trigger:hover{background:rgba(0,229,255,.07);border-color:rgba(0,229,255,.45)}',
      '.mt-icon{width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:11px;transition:all .3s}',
      '.mt-icon.mi-active{filter:drop-shadow(0 0 4px #00e5ff);opacity:1}',
      '.mt-icon.mi-locked{opacity:.14}',
      '.mt-icon.mi-ready{opacity:.6}',
      '#mist-overlay{position:fixed;right:36px;top:140px;z-index:9400;width:min(250px,calc(100vw - 48px));display:flex;flex-direction:column;',
        'transform:translateX(calc(100% + 44px));transition:transform .32s cubic-bezier(.23,1,.32,1),opacity .32s;opacity:0;pointer-events:none}',
      '#mist-overlay.mist-open{transform:translateX(0);opacity:1;pointer-events:all}',
      '#mist-menu{background:rgba(255,255,255,.05);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'border:1px solid rgba(0,229,255,.2);border-bottom:none;border-radius:7px 7px 0 0;padding:7px 9px 5px;display:flex;flex-direction:column;gap:5px}',
      '#mist-head-row{display:flex;align-items:center;gap:7px}',
      '.mist-lbl{font-family:var(--font-d,monospace);font-size:.42rem;letter-spacing:3px;color:rgba(0,229,255,.9);text-shadow:0 0 7px rgba(0,229,255,.45)}',
      '.mist-sub{font-family:var(--font-d,monospace);font-size:.27rem;letter-spacing:2px;color:rgba(0,229,255,.35)}',
      '#mist-x{margin-left:auto;background:none;border:none;color:rgba(0,229,255,.3);font-size:12px;cursor:pointer;padding:2px 4px;transition:color .2s;line-height:1}',
      '#mist-tabs{display:flex;gap:3px}',
      '.mst-tab{flex:1;padding:4px 3px;text-align:center;cursor:pointer;font-family:var(--font-d,monospace);font-size:.27rem;letter-spacing:1.5px;',
        'color:rgba(255,255,255,.22);border:1px solid rgba(0,229,255,.08);border-radius:3px;background:transparent;transition:all .18s}',
      '.mst-tab.mst-active{color:#00e5ff;border-color:rgba(0,229,255,.35);text-shadow:0 0 5px rgba(0,229,255,.5)}',
      '.mst-tab.mst-locked{cursor:not-allowed;opacity:.18}',
      '#mist-diff{display:flex;align-items:center;gap:4px}',
      '.diff-lbl{font-family:var(--font-d,monospace);font-size:.25rem;letter-spacing:2px;color:rgba(255,255,255,.22)}',
      '.db{background:transparent;border:1px solid rgba(0,229,255,.12);color:rgba(0,229,255,.35);',
        'padding:2px 6px;border-radius:3px;cursor:pointer;font-family:var(--font-d,monospace);font-size:.25rem;letter-spacing:1px;transition:all .15s}',
      '.db.db-active{border-color:rgba(0,229,255,.65);color:#00e5ff}',
      '#mist-new{margin-left:auto;background:transparent;border:1px solid rgba(0,229,255,.18);color:#00e5ff;',
        'padding:2px 7px;border-radius:3px;cursor:pointer;font-family:var(--font-d,monospace);font-size:.25rem;letter-spacing:1px}',
      '#mist-canvas-wrap{background:rgba(255,255,255,.05);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'border:1px solid rgba(0,229,255,.18);border-radius:0 0 7px 7px;padding:7px;display:flex;flex-direction:column;align-items:center;gap:3px}',
      '#mist-maze-canvas{display:block;touch-action:none;cursor:crosshair;border:1px solid rgba(0,229,255,.1);border-radius:2px}',
      '#mist-status{font-family:var(--font-d,monospace);font-size:.24rem;letter-spacing:2px;color:rgba(0,229,255,.38);text-align:center;min-height:13px}',
      '.mist-solved{animation:mist-win 1.1s ease-in-out 3}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── HTML ──────────────────────────────────────────────────────────────────
  function injectHTML(){
    var trig=document.createElement('div');trig.id='mist-trigger';trig.title='MIST — Lead Edge Maze';
    trig.innerHTML='<div class="mt-icon mi-ready" id="mt-0">★</div><div class="mt-icon mi-locked" id="mt-1">♥</div><div class="mt-icon mi-locked" id="mt-2">◈</div>';
    trig.onclick=function(e){e.stopPropagation();mistToggle();};
    document.body.appendChild(trig);
    var ov=document.createElement('div');ov.id='mist-overlay';
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

  // ── UI controls ───────────────────────────────────────────────────────────
  window.mistToggle=function(){
    MIST.open=!MIST.open;
    var ov=document.getElementById('mist-overlay');
    if(ov)ov.classList.toggle('mist-open',MIST.open);
    if(MIST.open){setTimeout(function(){bindCanvasEvents();if(!MIST.mazes[MIST.activeMaze])mistNewMaze();else renderMaze(MIST.mazes[MIST.activeMaze],MIST.dragPath);document.addEventListener('click',_outside,true);},60);}
    else{document.removeEventListener('click',_outside,true);}
  };
  function _outside(e){
    var ov=document.getElementById('mist-overlay'),tr=document.getElementById('mist-trigger');
    if(ov&&ov.contains(e.target))return;if(tr&&tr.contains(e.target))return;
    if(MIST.open){MIST.open=false;if(ov)ov.classList.remove('mist-open');document.removeEventListener('click',_outside,true);}
  }
  window.mistSetDiff=function(d){
    MIST.difficulty=d;
    [1,2,3].forEach(function(n){var b=document.getElementById('mst-d'+n);if(b)b.classList.toggle('db-active',n===d);});
    MIST.mazes=[null,null,null];mistNewMaze();
  };
  window.mistSetSlot=function(slot){
    if(slot>0&&MIST.solvedCount<slot)return;
    MIST.activeMaze=slot;
    [0,1,2].forEach(function(i){var t=document.getElementById('mst-tab'+i);if(t)t.classList.toggle('mst-active',i===slot);});
    if(!MIST.mazes[slot])mistNewMaze();else renderMaze(MIST.mazes[slot],[]);
    setStatus('DRAG ● FROM ENTRY TO EXIT');
  };
  window.mistNewMaze=function(){
    var cfg=DIFF[MIST.difficulty];
    var maze=generateMaze(cfg.w,cfg.h);maze.solved=false;
    MIST.mazes[MIST.activeMaze]=maze;MIST.dragPath=[];MIST.dragging=false;
    MIST.sphereTarget=null;MIST.sphereActual=null;stopSphereAnim();
    renderMaze(maze,[]);setStatus('DRAG ● FROM ENTRY TO EXIT');
  };

  function stopSphereAnim(){if(MIST.sphereAnimId){cancelAnimationFrame(MIST.sphereAnimId);MIST.sphereAnimId=null;}}
  function startSphereAnim(){
    if(MIST.sphereAnimId)return;
    function tick(){
      var maze=MIST.mazes[MIST.activeMaze];
      if(!maze||!MIST.sphereTarget){MIST.sphereAnimId=null;return;}
      if(!MIST.sphereActual)MIST.sphereActual={x:MIST.sphereTarget.x,y:MIST.sphereTarget.y};
      var dx=MIST.sphereTarget.x-MIST.sphereActual.x,dy=MIST.sphereTarget.y-MIST.sphereActual.y;
      MIST.sphereActual.x+=dx*.16;MIST.sphereActual.y+=dy*.16;
      renderMaze(maze,MIST.dragPath);
      if(Math.sqrt(dx*dx+dy*dy)>.3){MIST.sphereAnimId=requestAnimationFrame(tick);}
      else{MIST.sphereActual.x=MIST.sphereTarget.x;MIST.sphereActual.y=MIST.sphereTarget.y;renderMaze(maze,MIST.dragPath);MIST.sphereAnimId=null;}
    }
    MIST.sphereAnimId=requestAnimationFrame(tick);
  }

  // ── Canvas renderer ───────────────────────────────────────────────────────
  function renderMaze(maze,dragPath){
    var canvas=document.getElementById('mist-maze-canvas'),wrap=document.getElementById('mist-canvas-wrap');
    if(!canvas||!wrap)return;
    var avail=Math.min(wrap.clientWidth-14,220);
    var cs=Math.max(8,Math.floor(avail/Math.max(maze.w,maze.h)));
    var pw=cs*maze.w,ph=cs*maze.h;
    canvas.width=pw;canvas.height=ph;canvas.style.width=pw+'px';canvas.style.height=ph+'px';
    var ctx=canvas.getContext('2d');ctx.clearRect(0,0,pw,ph);
    for(var y=0;y<maze.h;y++){
      for(var x=0;x<maze.w;x++){
        var cell=maze.grid[y][x],px=x*cs,py=y*cs;
        var dw=function(x1,y1,x2,y2){
          ctx.strokeStyle='rgba(0,229,255,0.45)';ctx.lineWidth=cs*.35;
          ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
          ctx.strokeStyle='rgba(0,229,255,0.9)';ctx.lineWidth=1.0;
          ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
          for(var i=0;i<=4;i++){var rx=x1+(x2-x1)*(i/4),ry=y1+(y2-y1)*(i/4),rxD=(y2-y1)*.12,ryD=-(x2-x1)*.12;ctx.beginPath();ctx.moveTo(rx-rxD,ry-ryD);ctx.lineTo(rx+rxD,ry+ryD);ctx.stroke();}
        };
        if(cell.n)dw(px,py,px+cs,py);if(cell.s)dw(px,py+cs,px+cs,py+cs);
        if(cell.w)dw(px,py,px,py+cs);if(cell.e)dw(px+cs,py,px+cs,py+cs);
        ctx.fillStyle='rgba(0,229,255,0.25)';ctx.fillRect(px-1,py-1,2,2);
      }
    }
    if(dragPath&&dragPath.length>1){
      ctx.strokeStyle='rgba(0,255,136,.6)';ctx.lineWidth=cs*.22;ctx.lineCap='round';ctx.lineJoin='round';
      ctx.beginPath();ctx.moveTo(dragPath[0].x*cs+cs/2,dragPath[0].y*cs+cs/2);
      dragPath.forEach(function(p){ctx.lineTo(p.x*cs+cs/2,p.y*cs+cs/2);});ctx.stroke();
    }
    ctx.beginPath();ctx.arc(maze.exit.x*cs+cs/2,maze.exit.y*cs+cs/2,cs*.35,0,Math.PI*2);
    ctx.fillStyle='rgba(0,229,255,.55)';ctx.shadowBlur=10;ctx.shadowColor='#00e5ff';ctx.fill();ctx.shadowBlur=0;
    var bx,by;
    if(MIST.sphereActual){bx=MIST.sphereActual.x;by=MIST.sphereActual.y;}
    else{var bc=(MIST.dragging&&MIST.dragPos)?MIST.dragPos:maze.entry;bx=bc.x*cs+cs/2;by=bc.y*cs+cs/2;}
    ctx.beginPath();ctx.arc(bx,by,cs*.4,0,Math.PI*2);
    ctx.fillStyle=maze.solved?'rgba(0,255,136,1)':'rgba(0,255,136,.95)';
    ctx.strokeStyle='#00ff88';ctx.lineWidth=1.0;ctx.stroke();ctx.fill();
  }

  function canvasToCell(canvas,maze,cx,cy){
    var rect=canvas.getBoundingClientRect();
    return{x:Math.max(0,Math.min(maze.w-1,Math.floor(((cx-rect.left)*(canvas.width/rect.width))/(canvas.width/maze.w)))),
           y:Math.max(0,Math.min(maze.h-1,Math.floor(((cy-rect.top)*(canvas.height/rect.height))/(canvas.height/maze.h))))};
  }
  function onDragStart(e){
    var maze=MIST.mazes[MIST.activeMaze];if(!maze||maze.solved)return;
    e.preventDefault();e.stopPropagation();
    var pt=e.touches?e.touches[0]:e,cell=canvasToCell(this,maze,pt.clientX,pt.clientY);
    if(cell.x===maze.entry.x&&cell.y===maze.entry.y){
      MIST.dragging=true;MIST.dragPos=cell;MIST.dragPath=[cell];
      var cs=this.width/maze.w;MIST.sphereTarget={x:cell.x*cs+cs/2,y:cell.y*cs+cs/2};MIST.sphereActual={x:cell.x*cs+cs/2,y:cell.y*cs+cs/2};
      setStatus('NAVIGATE TO ◉ EXIT');
    }
    renderMaze(maze,MIST.dragPath);
  }
  function onDragMove(e){
    if(!MIST.dragging)return;e.preventDefault();e.stopPropagation();
    var maze=MIST.mazes[MIST.activeMaze];if(!maze)return;
    var pt=e.touches?e.touches[0]:e,cell=canvasToCell(this,maze,pt.clientX,pt.clientY);
    var prev=MIST.dragPath[MIST.dragPath.length-1];
    if(cell.x===prev.x&&cell.y===prev.y)return;
    var dx=cell.x-prev.x,dy=cell.y-prev.y;
    if(Math.abs(dx)+Math.abs(dy)!==1)return;
    var wd=dx===1?'e':dx===-1?'w':dy===1?'s':'n';
    if(maze.grid[prev.y][prev.x][wd]!==0)return;
    if(MIST.dragPath.length>=2){var pp=MIST.dragPath[MIST.dragPath.length-2];if(cell.x===pp.x&&cell.y===pp.y)MIST.dragPath.pop();else MIST.dragPath.push(cell);}
    else MIST.dragPath.push(cell);
    MIST.dragPos=cell;
    var cs=this.width/maze.w;MIST.sphereTarget={x:cell.x*cs+cs/2,y:cell.y*cs+cs/2};startSphereAnim();
    if(cell.x===maze.exit.x&&cell.y===maze.exit.y){MIST.dragging=false;maze.solved=true;_onMazeSolved(MIST.activeMaze,maze);}
  }
  function onDragEnd(){
    if(!MIST.dragging)return;MIST.dragging=false;
    var maze=MIST.mazes[MIST.activeMaze];
    if(maze&&!maze.solved){
      MIST.dragPath=[];var cv=document.getElementById('mist-maze-canvas'),cs=cv?cv.width/maze.w:10;
      MIST.sphereTarget={x:maze.entry.x*cs+cs/2,y:maze.entry.y*cs+cs/2};startSphereAnim();
      setStatus('DRAG ● FROM ENTRY TO EXIT');
    }
  }
  function bindCanvasEvents(){
    var canvas=document.getElementById('mist-maze-canvas');if(!canvas||canvas._mistBound)return;canvas._mistBound=true;
    canvas.addEventListener('mousedown',onDragStart.bind(canvas));canvas.addEventListener('mousemove',onDragMove.bind(canvas));
    canvas.addEventListener('mouseup',onDragEnd.bind(canvas));canvas.addEventListener('mouseleave',onDragEnd.bind(canvas));
    canvas.addEventListener('touchstart',onDragStart.bind(canvas),{passive:false});
    canvas.addEventListener('touchmove',onDragMove.bind(canvas),{passive:false});
    canvas.addEventListener('touchend',onDragEnd.bind(canvas),{passive:false});
  }

  function _onMazeSolved(slot,maze){
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
    setTimeout(function(){MIST.open=false;var ov=document.getElementById('mist-overlay');if(ov)ov.classList.remove('mist-open');document.removeEventListener('click',_outside,true);},2500);
    setTimeout(function(){ _onLocalSolve(slot); },260);
  }

  function setStatus(msg){var el=document.getElementById('mist-status');if(el)el.textContent=msg;}

  // ── Init ─────────────────────────────────────────────────────────────────
  function init(){
    injectCSS();injectHTML();
    // Start polling — 5s initial delay then every 3s
    setTimeout(function(){ _poll(); setInterval(_poll, POLL_MS); }, 5000);
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}

})();
