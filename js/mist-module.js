// ═══════════════════════════════════════════════════════════════════════════
//  MIST MODULE v4 — Autumn Lead Edge Maze · Multi-User Real-Time
//  DART-Skyboard/Autumn  ·  Radical Deepscale LLC
//
//  SIGNAL FLOW
//  ───────────
//  SEND   → mist flows OUT from your node along your plasma spline connections
//  RECEIVE → mist arrives INWARD at the receiving node along those same splines
//  BYSTANDER → sees BOTH: outgoing at sender's node, incoming at reacting nodes
//  FEEDBACK  → sender sees all reacting nodes light up with incoming geometry
//
//  GEOMETRY
//  ─────────
//  _spawnOutgoing(slot, fromPos)  — particles travel FROM fromPos OUTWARD
//                                   riding each spline curve away from that node
//  _spawnIncoming(slot, toPos)    — particles converge TOWARD toPos
//                                   from spline endpoints or outer shell
//
//  EVENTS (ashtree/mist/{sid}.json — append array)
//  ─────────────────────────────────────────────────
//  { type:'solve',    uid, slot, ts, instanceId }
//  { type:'reaction', uid, slot, ts, replyTo, score, instanceId }
//
//  POLLING
//  ───────
//  SHA-diff cache — directory listed every 3s,
//  file content fetched ONLY when sha changes.
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  var MATCH_THRESHOLD  = 0.08;   // _sessionPatternScore min for reaction
  var POLL_MS          = 12000;  // 12s poll — leader-only, keeps under GitHub 5k/hr rate limit
  var STALE_MS         = 600000; // ignore events > 10min old
  var MAX_FILES        = 40;
  var REACT_COOLDOWN   = 4000;   // ms between reactions from same sender

  // ── Leader election ──────────────────────────────────────────────────────
  // Only ONE tab per browser polls GitHub. Others receive via BroadcastChannel.
  // Leader heartbeat every 8s; any tab that hasn't seen a heartbeat in 16s claims leader.
  var _LEADER_KEY   = 'autumn_mist_leader';
  var _LEADER_TTL   = 16000;
  var _isLeader     = false;
  function _claimLeader(){ try{ localStorage.setItem(_LEADER_KEY,Date.now()); }catch(e){} _isLeader=true; }
  function _checkLeader(){ try{ var t=parseInt(localStorage.getItem(_LEADER_KEY)||'0',10); if(Date.now()-t>_LEADER_TTL) _claimLeader(); }catch(e){ _claimLeader(); } }
  function _heartbeat(){ if(_isLeader){ try{ localStorage.setItem(_LEADER_KEY,Date.now()); }catch(e){} } }
  // ─────────────────────────────────────────────────────────────────────────

  var MIST = {
    open:false, difficulty:1, mazes:[null,null,null], solvedCount:0,
    dragging:false, dragPos:null, dragPath:[], activeMaze:0,
    sphereTarget:null, sphereActual:null, sphereAnimId:null,
    seen:{},       // "uid:ts:type" → true
    lastReact:{}   // senderUid → ts (cooldown)
  };
  var DIFF = {1:{w:5,h:5},2:{w:9,h:9},3:{w:13,h:13}};
  var _iid = 'mi_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
  var _mySolves = [];   // [{uid,ts}] last 20 local solves
  var _shaCache = {};   // filename → sha
  var _pendingObs = []; // events buffered when node not yet in scene — retried each poll

  var SLOT = {
    0:{emotion:'inspired',  pulse:1.4,speed:1.25,boost:[.08,.06,.04],label:'★ STAR SOLVED', color:0xffdd00},
    1:{emotion:'empathetic',pulse:1.6,speed:1.1, boost:[.05,.10,.06],label:'♥ HEART SOLVED',color:0xff4488},
    2:{emotion:'spiritual', pulse:1.0,speed:0.8, boost:[.12,.08,.10],label:'◈ MIST SOLVED', color:0x00e5ff}
  };

  // ── helpers ───────────────────────────────────────────────────────────────
  function _sid(){ return (typeof _aut_sid!=='undefined')?_aut_sid:(typeof _aut_uid!=='undefined')?_aut_uid:'local'; }
  function _pat(){ return (typeof getLeatrAshPAT==='function')?getLeatrAshPAT():''; }
  function _score(a,b){
    if(typeof _sessionPatternScore==='function') return _sessionPatternScore(a,b);
    var h=0;for(var i=0;i<a.length;i++)h=(h*31+a.charCodeAt(i))&0x7fffffff;
    var h2=0;for(var j=0;j<b.length;j++)h2=(h2*31+b.charCodeAt(j))&0x7fffffff;
    return Math.max(0,1-Math.abs(h/0x7fffffff-h2/0x7fffffff)*2.5);
  }
  function _nodePos(uid){
    // First try live animated position from session group
    if(typeof _ashNodes!=='undefined'&&_ashNodes._sessionGroups){
      var g=_ashNodes._sessionGroups[uid];
      if(g&&g.group) return g.group.position.clone();
    }
    // Fallback: deterministic position from uid hash (matches where node WILL appear)
    if(typeof _nodeBasePos==='function' && typeof THREE!=='undefined'){
      var bp=_nodeBasePos(uid);
      return new THREE.Vector3(bp.x,bp.y,bp.z);
    }
    return null;
  }
  // Returns spline curves for a given endpoint uid. Each entry: {curve, fromLocal}
  // fromLocal=true means curve goes local→uid (use t=0..1 for outgoing, t=1..0 for incoming)
  // Returns spline entries for a given sender uid.
  // Each entry includes senderT: the t value (0 or 1) where the sender sits on the curve.
  // Travel direction for outgoing: senderT → (1-senderT)
  // Travel direction for incoming: (1-senderT) → senderT
  function _splinesFor(uid){
    var out=[];
    if(typeof _ashNodes==='undefined'||!_ashNodes._splines) return out;
    var sp=_ashNodes._splines;
    // local:uid — uid is at t=1, local orb at t=0
    if(sp['local:'+uid]) out.push({curve:sp['local:'+uid].curve, senderT:1, sp:sp['local:'+uid]});
    // Remote-to-remote splines
    Object.keys(sp).forEach(function(k){
      if(k==='local:'+uid) return;
      var parts=k.split(':');
      if(parts[0]===uid) out.push({curve:sp[k].curve, senderT:0, sp:sp[k]}); // uid at t=0
      else if(parts[1]===uid) out.push({curve:sp[k].curve, senderT:1, sp:sp[k]}); // uid at t=1
    });
    return out;
  }
  // Returns all local:* splines (for local orb sends)
  function _localSplines(){
    var out=[];
    if(typeof _ashNodes==='undefined'||!_ashNodes._splines) return out;
    Object.keys(_ashNodes._splines).forEach(function(k){
      if(k.indexOf('local:')===0) out.push({curve:_ashNodes._splines[k].curve, senderT:0, sp:_ashNodes._splines[k]});
    });
    return out;
  }
  function _brpn(prof){
    if(typeof pulseShells==='function'){pulseShells(prof.pulse);setTimeout(function(){if(typeof pulseShells==='function')pulseShells(prof.pulse*.5);},230);}
    if(typeof applyOrbEmotion==='function') applyOrbEmotion(prof.emotion);
    window._acShellBoost=window._acShellBoost||[0,0,0];
    window._acShellBoost[0]=Math.min(.22,(window._acShellBoost[0]||0)+prof.boost[0]);
    window._acShellBoost[1]=Math.min(.18,(window._acShellBoost[1]||0)+prof.boost[1]);
    window._acShellBoost[2]=Math.min(.16,(window._acShellBoost[2]||0)+prof.boost[2]);
    window._orbEmoSpeedMult=prof.speed;
    setTimeout(function(){window._orbEmoSpeedMult=Math.max(window._orbEmoSpeedMult*.85,1.0);},1800);
    if(typeof mazeOrbState!=='undefined'){
      mazeOrbState.solveActive=true;mazeOrbState.solveStep=0;
      if(mazeOrbState.pathMeshes)mazeOrbState.pathMeshes.forEach(function(m){if(m&&m.material)m.material.opacity=0;});
    }
  }
  function _log(msg){
    if(window.S&&window.S.journal)
      window.S.journal.push({ts:new Date().toISOString(),_internal:true,_thought:msg});
  }
  // Direct GitHub write — bypasses the batch queue entirely for instant propagation
  // Route mist writes through writeLeatrAshMemory — the same proven cross-browser
  // path that session nodes use. Single shared file = one SHA change wakes all browsers.
  var _MIST_PATH = 'ashtree/mist/events.json';
  function _write(data){
    if(typeof writeLeatrAshMemory==='function'){
      writeLeatrAshMemory(_MIST_PATH, data);
      _setStatus('●');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SIGNAL PHASES
  // ══════════════════════════════════════════════════════════════════════════

  // ── PHASE 1: You solved — send out ────────────────────────────────────────
  function _phaseSend(slot){
    var prof=SLOT[slot];
    _brpn(prof);
    // Mist flows OUT from your orb along your plasma connections
    _spawnOutgoing(slot, new THREE.Vector3(0,0,0), null);
    var uid=_sid(), ts=Date.now();
    _mySolves.push({uid:uid,ts:ts});
    if(_mySolves.length>20)_mySolves.shift();
    _write({type:'solve',uid:uid,slot:slot,ts:ts,instanceId:_iid,label:prof.label,emotion:prof.emotion});
    _bcPost({type:'solve',uid:uid,slot:slot,ts:ts});
    _log('MIST SEND — slot '+slot+' ('+prof.label+'). Signal out over network.');
  }

  // ── PHASE 2A: Incoming solve received — pattern check → react ─────────────
  // Called on any session that receives a solve event from another session.
  // senderUid = the session that sent the mist.
  function _phaseReceive(ev){
    var now=Date.now();
    var myUid=_sid();
    // Same user (other tab): _aut_sid starts with _aut_uid, so sender sid starts with my user uid
    // Always react to any non-own-instance event — pattern matching is visual only
    var sc=1.0;
    if(MIST.lastReact[ev.uid]&&(now-MIST.lastReact[ev.uid])<REACT_COOLDOWN) return;
    MIST.lastReact[ev.uid]=now;

    // Pattern matched — mist arrives INWARD at my orb
    console.log('[MIST] _phaseReceive fired. slot:',ev.slot,'from:',ev.uid.slice(0,20));
    // Ensure the sender's node appears in world scene quickly
    if(typeof _pollAshNodes==='function' && !_nodePos(ev.uid)) _pollAshNodes();
    _brpn(SLOT[ev.slot]);
    _spawnIncoming(ev.slot, new THREE.Vector3(0,0,0), ev.uid);
    _setStatus('←');
    // Write reaction so others (especially sender) see it
    _write({type:'reaction',uid:myUid,slot:ev.slot,ts:now,replyTo:ev.uid,score:sc,instanceId:_iid});
    _bcPost({type:'reaction',uid:myUid,slot:ev.slot,ts:now,replyTo:ev.uid,score:sc});
    _log('MIST RECEIVE — incoming from '+ev.uid.slice(0,14)+'. Mist arriving at node.');
  }

  // ── PHASE 2B: Bystander/Sender sees a remote node's activity ──────────────
  // Shows remote send (outgoing at their node) or remote reaction (incoming at their node).
  function _phaseObserve(ev){
    var pos=_nodePos(ev.uid);
    if(!pos){
      // Node not in scene yet — trigger immediate session refresh then buffer
      if(typeof _pollAshNodes==='function'){
        _pollAshNodes(); // force refresh to add this node to world
      }
      _pendingObs.push(ev);
      return;
    }
    _doObserve(ev,pos);
  }
  function _doObserve(ev,pos){
    // Both sends and reactions show as outgoing bursts from that node's position.
    // The local receiver's own session shows INCOMING to its orb (see _phaseReceive).
    _spawnOutgoing(ev.slot, pos, ev.uid);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  GEOMETRY
  // ══════════════════════════════════════════════════════════════════════════
  var _geom=[];

  // OUTGOING — particles leave fromPos and travel OUTWARD along spline curves
  // nodeUid: if set, find splines connected to that node; if null, use all local:* splines
  // OUTGOING: particles leave fromPos and travel along spline curves away from it.
  // nodeUid=null → local orb firing (senderT=0 on local:* splines, travel 0→1)
  // nodeUid=set  → remote node firing (senderT from _splinesFor, travel senderT→1-senderT)
  function _spawnOutgoing(slot, fromPos, nodeUid){
    if(typeof THREE==='undefined'||typeof scene==='undefined') return;
    var col=new THREE.Color(SLOT[slot].color);
    var splines=nodeUid ? _splinesFor(nodeUid) : _localSplines();
    // Fallback when no splines found — build straight-line curves from fromPos to all other nodes
    if(!splines.length){
      var targets=[];
      if(typeof _ashNodes!=='undefined'&&_ashNodes._sessionGroups){
        Object.keys(_ashNodes._sessionGroups).forEach(function(uid){
          if(uid===nodeUid) return;
          var g=_ashNodes._sessionGroups[uid];
          if(g&&g.group) targets.push(g.group.position.clone());
        });
      }
      // Always include the local orb as a target for remote sends
      if(nodeUid) targets.push(new THREE.Vector3(0,0,0));
      if(!targets.length){targets.push(new THREE.Vector3(2.5,1.2,-1.5));targets.push(new THREE.Vector3(-2,1.8,1.2));}
      targets.forEach(function(tp){
        var mid=fromPos.clone().add(tp).multiplyScalar(.5)
          .add(new THREE.Vector3((Math.random()-.5)*.8,1+Math.random()*.6,(Math.random()-.5)*.8));
        splines.push({curve:new THREE.CatmullRomCurve3([fromPos.clone(),mid,tp.clone()]),senderT:0,sp:null});
      });
    }
    var grp=new THREE.Group();grp._mAge=0;grp._mMax=200;grp._mSlot=slot;grp._mObjs=[];grp._mDir='out';
    var perSpline=slot===0?5:slot===1?4:6;
    splines.forEach(function(entry){
      for(var i=0;i<perSpline;i++){
        var curve=entry.curve;
        var sT=entry.senderT||0;
        var dir=(sT===0)?1:-1; // travel direction: +1 means t increases, -1 means t decreases
        // Stagger start near senderT
        var startT=sT+(dir*i/perSpline*0.12);
        startT=Math.max(0,Math.min(1,startT));
        var geo=_mistGeo(slot,col,0.85);
        var mesh=new THREE.Mesh(geo,_mistMat(col,slot===0?.9:slot===1?.85:.7));
        mesh.position.copy(curve.getPoint(startT));
        mesh._mc=curve;mesh._mt=startT;
        mesh._mspd=(0.005+Math.random()*.004)*(slot===1?1.15:1);
        mesh._mDir=dir; // +1 outward, -1 outward (when senderT=1)
        mesh._mSenderT=sT;
        mesh._mr=new THREE.Vector3(Math.random()*.05,Math.random()*.04,Math.random()*.03);
        grp._mObjs.push(mesh);grp.add(mesh);
      }
    });
    // Faint arc lines showing the routes
    splines.slice(0,6).forEach(function(entry){
      var lGeo=new THREE.BufferGeometry().setFromPoints(entry.curve.getPoints(36));
      var lMat=new THREE.LineBasicMaterial({color:col,transparent:true,opacity:.18});
      grp.add(new THREE.Line(lGeo,lMat));
    });
    scene.add(grp);_geom.push(grp);
  }

  // INCOMING — particles converge TOWARD toPos along splines (reverse travel)
  // senderUid: if set, prefer splines connected to that sender; else use local splines
  function _spawnIncoming(slot, toPos, senderUid){
    if(typeof THREE==='undefined'||typeof scene==='undefined') return;
    var col=new THREE.Color(SLOT[slot].color);
    var splines=senderUid ? _splinesFor(senderUid) : [];
    if(!splines.length){
      // Use all local:* splines in reverse, or fallback outer points
      if(typeof _ashNodes!=='undefined'&&_ashNodes._splines){
        Object.keys(_ashNodes._splines).forEach(function(k){
          if(k.indexOf('local:')===0) splines.push({curve:_ashNodes._splines[k].curve,fromLocal:true,sp:_ashNodes._splines[k]});
        });
      }
    }
    if(!splines.length){
      // Hard fallback: converge from random outer positions
      var pts=[new THREE.Vector3(2.5,1.2,-1.5),new THREE.Vector3(-2,1.8,1.2),new THREE.Vector3(1,-2.5,1)];
      pts.forEach(function(op){
        var mid=op.clone().add(toPos).multiplyScalar(.5).add(new THREE.Vector3((Math.random()-.5)*.6,(Math.random()-.5)*.6,0));
        splines.push({curve:new THREE.CatmullRomCurve3([op.clone(),mid,toPos.clone()]),fromLocal:true,sp:null});
      });
    }
    var grp=new THREE.Group();grp._mAge=0;grp._mMax=200;grp._mSlot=slot;grp._mObjs=[];grp._mDir='in';grp._mTarget=toPos.clone();
    var perSpline=slot===0?5:slot===1?4:6;
    splines.forEach(function(sp){
      for(var i=0;i<perSpline;i++){
        // Travel REVERSE: start near t=1 (remote end), move toward t=0 (local end / toPos)
        // Incoming: start at the FAR end (opposite of target) and travel toward target
        // senderT tells us which end to start from (it's the end away from target)
        var sT=sp.senderT!=null?sp.senderT:1;
        var dir=(sT===1)?-1:1; // travel toward 1-sT (the target end)
        var startT=sT+(dir*i/perSpline*-0.12); // stagger near far end
        startT=Math.max(0,Math.min(1,startT));
        var geo=_mistGeo(slot,col,0.78);
        var mesh=new THREE.Mesh(geo,_mistMat(col,slot===0?.85:slot===1?.8:.65));
        var pt=sp.curve.getPoint(startT);
        mesh.position.copy(pt);
        mesh._mc=sp.curve;mesh._mt=startT;mesh._mspd=(0.005+Math.random()*.004);
        mesh._mDir=dir; // travel direction toward target
        mesh._mSenderT=sT;
        mesh._mr=new THREE.Vector3(Math.random()*.05,Math.random()*.04,Math.random()*.03);
        grp._mObjs.push(mesh);grp.add(mesh);
      }
    });
    // Arrival burst: small ring at toPos
    var ringGeo=new THREE.TorusGeometry(0.12,0.014,4,16);
    var ringMat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.7,wireframe:true});
    var ring=new THREE.Mesh(ringGeo,ringMat);ring.position.copy(toPos);
    ring.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,0);
    ring._expandSpd=0.006;ring._isRing=true;grp.add(ring);
    scene.add(grp);_geom.push(grp);
  }

  function _mistGeo(slot,col,s){
    if(slot===0) return new THREE.OctahedronGeometry((0.07+Math.random()*.08)*s,0);
    if(slot===1) return new THREE.SphereGeometry((0.045+Math.random()*.03)*s,5,5);
    return new THREE.TetrahedronGeometry((0.06+Math.random()*.07)*s,0);
  }
  function _mistMat(col,opacity){
    return new THREE.MeshBasicMaterial({color:col,wireframe:true,transparent:true,opacity:opacity});
  }

  // ── Animation tick ─────────────────────────────────────────────────────────
  (function _tick(){
    requestAnimationFrame(_tick);
    if(!_geom.length) return;
    var rem=[];
    _geom.forEach(function(g){
      g._mAge++;
      var fade=1-g._mAge/g._mMax;
      if(fade<=0){rem.push(g);return;}
      g._mObjs.forEach(function(obj){
        if(obj._isRing){
          // Arrival ring expands at toPos
          obj.scale.multiplyScalar(1+obj._expandSpd);
          obj.material.opacity=.7*fade*Math.min(1,g._mAge/8);
          return;
        }
        if(obj._mc){
          var dir=obj._mDir||1; // +1 or -1
          obj._mt+=dir*obj._mspd;
          // Wrap: when particle exits the far end, loop back to sender end for continuous flow
          if(obj._mt>1) obj._mt=(obj._mSenderT||0)+Math.random()*.08;
          if(obj._mt<0) obj._mt=(obj._mSenderT||1)-Math.random()*.08;
          var t=Math.max(0,Math.min(1,obj._mt));
          var pt=obj._mc.getPoint(t);
          obj.position.copy(pt);
          if(g._mSlot===2) obj.position.x+=Math.sin(g._mAge*.05+t*4)*.06;
        }
        obj.rotation.x+=obj._mr.x;obj.rotation.y+=obj._mr.y;obj.rotation.z+=obj._mr.z;
        // Fade: brightest at the leading edge (far from sender), transparent near sender
        var sT=obj._mSenderT||0;
        var tFade=Math.abs(obj._mt - sT);
        obj.material.opacity=Math.max(0,.9*fade*Math.pow(tFade+.08,0.35));
      });
    });
    rem.forEach(function(g){
      if(typeof scene!=='undefined') scene.remove(g);
      g._mObjs.forEach(function(o){if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
      var idx=_geom.indexOf(g);if(idx>=0)_geom.splice(idx,1);
    });
  })();

  // ══════════════════════════════════════════════════════════════════════════
  //  POLL — leader-only GitHub poll + BroadcastChannel relay to follower tabs
  // ══════════════════════════════════════════════════════════════════════════
  function _poll(){
    // Always retry pending obs regardless of leader status
    if(_pendingObs.length){
      var stillPending=[];
      _pendingObs.forEach(function(ev){
        var pos=_nodePos(ev.uid);
        if(pos){ _doObserve(ev,pos); }
        else { ev._retries=(ev._retries||0)+1; if(ev._retries<20) stillPending.push(ev); }
      });
      _pendingObs=stillPending;
    }
    // Leader election check — only leader polls GitHub
    _checkLeader();
    if(!_isLeader) return;
    _heartbeat();

    var pat=_pat();if(!pat)return;
    // Poll a SINGLE shared events file — one SHA change = all browsers wake up.
    // Same API path as _ashFlushNow uses. Dramatically reduces API call count.
    var eventsUrl='https://api.github.com/repos/DART-Skyboard/leatr-ash/contents/'+_MIST_PATH;
    fetch(eventsUrl,{
      headers:{'Authorization':'token '+pat,'Accept':'application/vnd.github.v3+json','Cache-Control':'no-cache'},
      cache:'no-store', signal:AbortSignal.timeout(6000)
    }).then(function(r){
      if(r.status===403||r.status===429){
        console.warn('[MIST] GitHub rate limited ('+r.status+'). Backing off 30s.');
        _setStatus('⚠ rate'); _isLeader=false; return null;
      }
      return r.ok?r.json():null;
    })
    .then(function(meta){
      if(!meta||!meta.sha)return;
      if(_shaCache['events.json']===meta.sha)return; // unchanged — skip fetch
      _shaCache['events.json']=meta.sha;
      var evts=[];
      try{ evts=JSON.parse(atob(meta.content.replace(/\n/g,'')));  }catch(e){ return; }
      if(!Array.isArray(evts)||!evts.length)return;
      var myUid=_sid();
      evts.forEach(function(ev){
        if(!ev||!ev.ts||!ev.uid)return;
        if(ev.instanceId&&ev.instanceId===_iid)return;
        if(Date.now()-ev.ts>STALE_MS)return;
        var key=ev.uid+':'+ev.ts+':'+(ev.type||'solve');
        if(MIST.seen[key])return;
        MIST.seen[key]=true;
        console.log('[MIST] poll event:',ev.type||'(no type)','uid:',ev.uid.slice(0,16),'slot:',ev.slot);
        _bcPost(ev);
        _processEvent(ev, myUid);
      });
    }).catch(function(e){ console.warn('[MIST] poll error:',e); });
  }

  function _processEvent(ev, myUid){
    var slot=(ev.slot!=null)?ev.slot:0;
    if(ev.type==='reaction'&&ev.replyTo){
      _phaseObserve(ev);
      var isMyFeedback=_mySolves.some(function(s){return s.uid===ev.replyTo&&(ev.ts-s.ts)<STALE_MS;});
      if(isMyFeedback) _log('MIST FEEDBACK ← '+ev.uid.slice(0,14)+' reacted to your slot-'+slot+' solve (score:'+((ev.score||0).toFixed(2))+').');
    } else {
      _phaseObserve(ev);
      if(ev.uid!==myUid) _phaseReceive(ev);
    }
  }

  // ── BroadcastChannel — same-origin tabs + leader relay ────────────────────
  var _bc=null;
  try{
    _bc=new BroadcastChannel('autumn_mist');
    _bc.onmessage=function(e){
      if(!e.data)return;
      var d=e.data;
      // Leader heartbeat relay — follower tabs don't need to process
      if(d._type==='leader_hb') return;
      var key=(d.uid||'?')+':'+(d.ts||0)+':'+(d.type||'solve');
      if(MIST.seen[key])return;
      MIST.seen[key]=true;
      _processEvent(d, _sid());
    };
  }catch(e){_bc=null;}

  function _bcPost(data){if(!_bc)return;try{_bc.postMessage(data);}catch(e){}}

  // External hook
  window._buoyancyMistPulse=function(detail){
    if(detail&&typeof detail.slot==='number')
      _phaseReceive({uid:detail.uid||_sid(),slot:detail.slot,ts:Date.now(),type:'solve'});
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  MAZE ENGINE (Lead Edge)
  // ══════════════════════════════════════════════════════════════════════════
  function generateMaze(w,h){
    var grid=[];
    for(var y=0;y<h;y++){grid[y]=[];for(var x=0;x<w;x++)grid[y][x]={n:1,s:1,e:1,w:1,v:false};}
    function carve(x,y){
      grid[y][x].v=true;
      var d=[['n',0,-1],['s',0,1],['e',1,0],['w',-1,0]];
      d.sort(function(){return Math.random()-.5;});
      d.forEach(function(dd){
        var nx=x+dd[1],ny=y+dd[2];
        if(nx>=0&&nx<w&&ny>=0&&ny<h&&!grid[ny][nx].v){
          grid[y][x][dd[0]]=0;grid[ny][nx][{n:'s',s:'n',e:'w',w:'e'}[dd[0]]]=0;carve(nx,ny);
        }
      });
    }
    carve(0,0);
    function ps(){return['n','s','e','w'][Math.floor(Math.random()*4)];}
    function pp(s){return(s==='n'||s==='s')?Math.floor(Math.random()*w):Math.floor(Math.random()*h);}
    function cs(s,p){if(s==='n')return{x:p,y:0};if(s==='s')return{x:p,y:h-1};if(s==='w')return{x:0,y:p};return{x:w-1,y:p};}
    var es,ep,xs,xp,att=0,ok=false,entry,exit;
    while(!ok&&att<500){
      att++;es=ps();ep=pp(es);xs=ps();xp=pp(xs);
      if(es===xs&&Math.abs(ep-xp)<2)continue;
      entry=cs(es,ep);exit=cs(xs,xp);
      var los=function(a,b){
        if(a.x===b.x){var y1=Math.min(a.y,b.y),y2=Math.max(a.y,b.y);for(var ty=y1;ty<y2;ty++)if(grid[ty][a.x].s)return false;return true;}
        if(a.y===b.y){var x1=Math.min(a.x,b.x),x2=Math.max(a.x,b.x);for(var tx=x1;tx<x2;tx++)if(grid[a.y][tx].e)return false;return true;}
        return false;
      };
      if(los(entry,exit))continue;
      var sol=solveMaze({grid:grid,w:w,h:h,entry:entry,exit:exit});
      if(!sol||sol.length<(w+h)/1.4)continue;
      ok=true;
    }
    grid[entry.y][entry.x][es]=0;grid[exit.y][exit.x][xs]=0;
    return{grid:grid,w:w,h:h,entry:entry,exit:exit,entrySide:es,exitSide:xs,
           solution:solveMaze({grid:grid,w:w,h:h,entry:entry,exit:exit})};
  }
  function solveMaze(maze){
    if(!maze.grid)return null;
    var q=[{x:maze.entry.x,y:maze.entry.y,path:[{x:maze.entry.x,y:maze.entry.y}]}];
    var seen={};seen[maze.entry.x+','+maze.entry.y]=true;
    var dirs={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
    while(q.length){
      var c=q.shift();if(c.x===maze.exit.x&&c.y===maze.exit.y)return c.path;
      var cell=maze.grid[c.y][c.x];
      Object.keys(dirs).forEach(function(d){
        if(cell[d]===0){var nx=c.x+dirs[d][0],ny=c.y+dirs[d][1],k=nx+','+ny;
          if(nx>=0&&nx<maze.w&&ny>=0&&ny<maze.h&&!seen[k]){seen[k]=true;q.push({x:nx,y:ny,path:c.path.concat([{x:nx,y:ny}])});}}
      });
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  UI — CSS, HTML, controls, canvas renderer
  // ══════════════════════════════════════════════════════════════════════════
  function injectCSS(){
    var s=document.createElement('style');
    s.textContent=[
      '#mist-trigger{position:fixed;right:0;top:148px;z-index:9500;display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 5px;',
        'background:rgba(255,255,255,.05);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
        'border:1px solid rgba(0,229,255,.22);border-right:none;border-radius:7px 0 0 7px;cursor:pointer;transition:all .2s}',
      '#mist-trigger:hover{background:rgba(0,229,255,.07);border-color:rgba(0,229,255,.45)}',
      '.mt-icon{width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:11px;transition:all .3s}',
      '.mt-icon.mi-active{filter:drop-shadow(0 0 4px #00e5ff);opacity:1}.mt-icon.mi-locked{opacity:.14}.mt-icon.mi-ready{opacity:.6}',
      '#mist-overlay{position:fixed;right:36px;top:140px;z-index:9400;width:min(250px,calc(100vw - 48px));display:flex;flex-direction:column;',
        'transform:translateX(calc(100% + 44px));transition:transform .32s cubic-bezier(.23,1,.32,1),opacity .32s;opacity:0;pointer-events:none}',
      '#mist-overlay.mist-open{transform:translateX(0);opacity:1;pointer-events:all}',
      '#mist-menu{background:rgba(255,255,255,.05);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'border:1px solid rgba(0,229,255,.2);border-bottom:none;border-radius:7px 7px 0 0;padding:7px 9px 5px;display:flex;flex-direction:column;gap:5px}',
      '#mist-head-row{display:flex;align-items:center;gap:7px}',
      '.mist-lbl{font-family:var(--font-d,monospace);font-size:.42rem;letter-spacing:3px;color:rgba(0,229,255,.9);text-shadow:0 0 7px rgba(0,229,255,.45)}',
      '.mist-sub{font-family:var(--font-d,monospace);font-size:.27rem;letter-spacing:2px;color:rgba(0,229,255,.35)}',
      '#mist-x{margin-left:auto;background:none;border:none;color:rgba(0,229,255,.3);font-size:12px;cursor:pointer;padding:2px 4px;line-height:1}',
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
      '#mist-new{margin-left:auto;background:transparent;border:1px solid rgba(0,229,255,.18);color:#00e5ff;padding:2px 7px;border-radius:3px;cursor:pointer;font-family:var(--font-d,monospace);font-size:.25rem;letter-spacing:1px}',
      '#mist-canvas-wrap{background:rgba(255,255,255,.05);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'border:1px solid rgba(0,229,255,.18);border-radius:0 0 7px 7px;padding:7px;display:flex;flex-direction:column;align-items:center;gap:3px}',
      '#mist-maze-canvas{display:block;touch-action:none;cursor:crosshair;border:1px solid rgba(0,229,255,.1);border-radius:2px}',
      '#mist-status{font-family:var(--font-d,monospace);font-size:.24rem;letter-spacing:2px;color:rgba(0,229,255,.38);text-align:center;min-height:13px}',
      '.mist-solved{animation:mist-win 1.1s ease-in-out 3}',
    ].join('');
    document.head.appendChild(s);
  }

  function injectHTML(){
    var tr=document.createElement('div');tr.id='mist-trigger';tr.title='MIST — Lead Edge Maze';
    tr.innerHTML='<div class="mt-icon mi-ready" id="mt-0">★</div><div class="mt-icon mi-locked" id="mt-1">♥</div><div class="mt-icon mi-locked" id="mt-2">◈</div>';
    tr.onclick=function(e){e.stopPropagation();mistToggle();};document.body.appendChild(tr);
    var ov=document.createElement('div');ov.id='mist-overlay';
    ov.innerHTML=['<div id="mist-menu">',
      '<div id="mist-head-row"><span class="mist-lbl">◈ MIST</span><span class="mist-sub">LEAD EDGE MAZE</span><button id="mist-x" onclick="mistToggle()">✕</button></div>',
      '<div id="mist-tabs"><div class="mst-tab mst-active" id="mst-tab0" onclick="mistSetSlot(0)"><span class="ti">★</span>STAR</div>',
      '<div class="mst-tab mst-locked" id="mst-tab1" onclick="mistSetSlot(1)"><span class="ti">♥</span>HEART</div>',
      '<div class="mst-tab mst-locked" id="mst-tab2" onclick="mistSetSlot(2)"><span class="ti">◈</span>MIST</div></div>',
      '<div id="mist-diff"><span class="diff-lbl">DIFF:</span>',
      '<button class="db db-active" id="mst-d1" onclick="mistSetDiff(1)">I</button>',
      '<button class="db" id="mst-d2" onclick="mistSetDiff(2)">II</button>',
      '<button class="db" id="mst-d3" onclick="mistSetDiff(3)">III</button>',
      '<button id="mist-new" onclick="mistNewMaze()">NEW</button></div></div>',
      '<div id="mist-canvas-wrap"><canvas id="mist-maze-canvas"></canvas>',
      '<div id="mist-status">DRAG ● FROM ENTRY TO EXIT</div></div>'].join('');
    ov.addEventListener('click',function(e){e.stopPropagation();});document.body.appendChild(ov);
  }

  window.mistToggle=function(){
    MIST.open=!MIST.open;var ov=document.getElementById('mist-overlay');
    if(ov)ov.classList.toggle('mist-open',MIST.open);
    if(MIST.open){setTimeout(function(){_bindCanvas();if(!MIST.mazes[MIST.activeMaze])mistNewMaze();else _renderMaze(MIST.mazes[MIST.activeMaze],MIST.dragPath);document.addEventListener('click',_out,true);},60);}
    else document.removeEventListener('click',_out,true);
  };
  function _out(e){var ov=document.getElementById('mist-overlay'),tr=document.getElementById('mist-trigger');
    if(ov&&ov.contains(e.target))return;if(tr&&tr.contains(e.target))return;
    if(MIST.open){MIST.open=false;if(ov)ov.classList.remove('mist-open');document.removeEventListener('click',_out,true);}
  }
  window.mistSetDiff=function(d){
    MIST.difficulty=d;[1,2,3].forEach(function(n){var b=document.getElementById('mst-d'+n);if(b)b.classList.toggle('db-active',n===d);});
    MIST.mazes=[null,null,null];mistNewMaze();
  };
  window.mistSetSlot=function(slot){
    if(slot>0&&MIST.solvedCount<slot)return;
    MIST.activeMaze=slot;
    [0,1,2].forEach(function(i){var t=document.getElementById('mst-tab'+i);if(t)t.classList.toggle('mst-active',i===slot);});
    if(!MIST.mazes[slot])mistNewMaze();else _renderMaze(MIST.mazes[slot],[]);
    _ss('DRAG ● FROM ENTRY TO EXIT');
  };
  window.mistNewMaze=function(){
    var cfg=DIFF[MIST.difficulty];var maze=generateMaze(cfg.w,cfg.h);maze.solved=false;
    MIST.mazes[MIST.activeMaze]=maze;MIST.dragPath=[];MIST.dragging=false;
    MIST.sphereTarget=null;MIST.sphereActual=null;_stopAnim();
    _renderMaze(maze,[]);_ss('DRAG ● FROM ENTRY TO EXIT');
  };
  function _stopAnim(){if(MIST.sphereAnimId){cancelAnimationFrame(MIST.sphereAnimId);MIST.sphereAnimId=null;}}
  function _startAnim(){
    if(MIST.sphereAnimId)return;
    function tick(){var maze=MIST.mazes[MIST.activeMaze];
      if(!maze||!MIST.sphereTarget){MIST.sphereAnimId=null;return;}
      if(!MIST.sphereActual)MIST.sphereActual={x:MIST.sphereTarget.x,y:MIST.sphereTarget.y};
      var dx=MIST.sphereTarget.x-MIST.sphereActual.x,dy=MIST.sphereTarget.y-MIST.sphereActual.y;
      MIST.sphereActual.x+=dx*.16;MIST.sphereActual.y+=dy*.16;_renderMaze(maze,MIST.dragPath);
      if(Math.sqrt(dx*dx+dy*dy)>.3){MIST.sphereAnimId=requestAnimationFrame(tick);}
      else{MIST.sphereActual.x=MIST.sphereTarget.x;MIST.sphereActual.y=MIST.sphereTarget.y;_renderMaze(maze,MIST.dragPath);MIST.sphereAnimId=null;}
    }
    MIST.sphereAnimId=requestAnimationFrame(tick);
  }
  function _renderMaze(maze,dp){
    var cv=document.getElementById('mist-maze-canvas'),wrap=document.getElementById('mist-canvas-wrap');
    if(!cv||!wrap)return;
    var av=Math.min(wrap.clientWidth-14,220);var cs=Math.max(8,Math.floor(av/Math.max(maze.w,maze.h)));
    cv.width=cs*maze.w;cv.height=cs*maze.h;cv.style.width=cv.width+'px';cv.style.height=cv.height+'px';
    var ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
    for(var y=0;y<maze.h;y++){for(var x=0;x<maze.w;x++){
      var cell=maze.grid[y][x],px=x*cs,py=y*cs;
      var dw=function(x1,y1,x2,y2){
        ctx.strokeStyle='rgba(0,229,255,0.45)';ctx.lineWidth=cs*.35;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
        ctx.strokeStyle='rgba(0,229,255,0.9)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
        for(var i=0;i<=4;i++){var rx=x1+(x2-x1)*(i/4),ry=y1+(y2-y1)*(i/4),rxD=(y2-y1)*.12,ryD=-(x2-x1)*.12;ctx.beginPath();ctx.moveTo(rx-rxD,ry-ryD);ctx.lineTo(rx+rxD,ry+ryD);ctx.stroke();}
      };
      if(cell.n)dw(px,py,px+cs,py);if(cell.s)dw(px,py+cs,px+cs,py+cs);
      if(cell.w)dw(px,py,px,py+cs);if(cell.e)dw(px+cs,py,px+cs,py+cs);
      ctx.fillStyle='rgba(0,229,255,.25)';ctx.fillRect(px-1,py-1,2,2);
    }}
    if(dp&&dp.length>1){ctx.strokeStyle='rgba(0,255,136,.6)';ctx.lineWidth=cs*.22;ctx.lineCap='round';ctx.lineJoin='round';
      ctx.beginPath();ctx.moveTo(dp[0].x*cs+cs/2,dp[0].y*cs+cs/2);dp.forEach(function(p){ctx.lineTo(p.x*cs+cs/2,p.y*cs+cs/2);});ctx.stroke();}
    ctx.beginPath();ctx.arc(maze.exit.x*cs+cs/2,maze.exit.y*cs+cs/2,cs*.35,0,Math.PI*2);
    ctx.fillStyle='rgba(0,229,255,.55)';ctx.shadowBlur=10;ctx.shadowColor='#00e5ff';ctx.fill();ctx.shadowBlur=0;
    var bx,by;if(MIST.sphereActual){bx=MIST.sphereActual.x;by=MIST.sphereActual.y;}
    else{var bc=(MIST.dragging&&MIST.dragPos)?MIST.dragPos:maze.entry;bx=bc.x*cs+cs/2;by=bc.y*cs+cs/2;}
    ctx.beginPath();ctx.arc(bx,by,cs*.4,0,Math.PI*2);
    ctx.fillStyle=maze.solved?'rgba(0,255,136,1)':'rgba(0,255,136,.95)';ctx.strokeStyle='#00ff88';ctx.lineWidth=1;ctx.stroke();ctx.fill();
  }
  function _c2c(cv,maze,cx,cy){
    var r=cv.getBoundingClientRect();
    return{x:Math.max(0,Math.min(maze.w-1,Math.floor(((cx-r.left)*(cv.width/r.width))/(cv.width/maze.w)))),
           y:Math.max(0,Math.min(maze.h-1,Math.floor(((cy-r.top)*(cv.height/r.height))/(cv.height/maze.h))))};
  }
  function _onDS(e){var maze=MIST.mazes[MIST.activeMaze];if(!maze||maze.solved)return;e.preventDefault();e.stopPropagation();
    var pt=e.touches?e.touches[0]:e,cell=_c2c(this,maze,pt.clientX,pt.clientY);
    if(cell.x===maze.entry.x&&cell.y===maze.entry.y){MIST.dragging=true;MIST.dragPos=cell;MIST.dragPath=[cell];
      var cs=this.width/maze.w;MIST.sphereTarget={x:cell.x*cs+cs/2,y:cell.y*cs+cs/2};MIST.sphereActual={x:cell.x*cs+cs/2,y:cell.y*cs+cs/2};_ss('NAVIGATE TO ◉ EXIT');}
    _renderMaze(maze,MIST.dragPath);
  }
  function _onDM(e){if(!MIST.dragging)return;e.preventDefault();e.stopPropagation();
    var maze=MIST.mazes[MIST.activeMaze];if(!maze)return;
    var pt=e.touches?e.touches[0]:e,cell=_c2c(this,maze,pt.clientX,pt.clientY);
    var prev=MIST.dragPath[MIST.dragPath.length-1];if(cell.x===prev.x&&cell.y===prev.y)return;
    var dx=cell.x-prev.x,dy=cell.y-prev.y;if(Math.abs(dx)+Math.abs(dy)!==1)return;
    var wd=dx===1?'e':dx===-1?'w':dy===1?'s':'n';if(maze.grid[prev.y][prev.x][wd]!==0)return;
    if(MIST.dragPath.length>=2){var pp=MIST.dragPath[MIST.dragPath.length-2];if(cell.x===pp.x&&cell.y===pp.y)MIST.dragPath.pop();else MIST.dragPath.push(cell);}else MIST.dragPath.push(cell);
    MIST.dragPos=cell;var cs=this.width/maze.w;MIST.sphereTarget={x:cell.x*cs+cs/2,y:cell.y*cs+cs/2};_startAnim();
    if(cell.x===maze.exit.x&&cell.y===maze.exit.y){MIST.dragging=false;maze.solved=true;_solved(MIST.activeMaze,maze);}
  }
  function _onDE(){if(!MIST.dragging)return;MIST.dragging=false;var maze=MIST.mazes[MIST.activeMaze];
    if(maze&&!maze.solved){MIST.dragPath=[];var cv=document.getElementById('mist-maze-canvas'),cs=cv?cv.width/maze.w:10;
      MIST.sphereTarget={x:maze.entry.x*cs+cs/2,y:maze.entry.y*cs+cs/2};_startAnim();_ss('DRAG ● FROM ENTRY TO EXIT');}
  }
  function _bindCanvas(){var cv=document.getElementById('mist-maze-canvas');if(!cv||cv._mb)return;cv._mb=true;
    cv.addEventListener('mousedown',_onDS.bind(cv));cv.addEventListener('mousemove',_onDM.bind(cv));
    cv.addEventListener('mouseup',_onDE.bind(cv));cv.addEventListener('mouseleave',_onDE.bind(cv));
    cv.addEventListener('touchstart',_onDS.bind(cv),{passive:false});cv.addEventListener('touchmove',_onDM.bind(cv),{passive:false});
    cv.addEventListener('touchend',_onDE.bind(cv),{passive:false});
  }
  function _solved(slot,maze){
    var prof=SLOT[slot];_ss('✓ '+prof.label+' — WELL DONE');MIST.solvedCount=Math.max(MIST.solvedCount,slot+1);_renderMaze(maze,MIST.dragPath);
    var wrap=document.getElementById('mist-canvas-wrap');if(wrap){wrap.classList.add('mist-solved');setTimeout(function(){wrap.classList.remove('mist-solved');},3500);}
    if(slot+1<=2){var nt=document.getElementById('mst-tab'+(slot+1));if(nt)nt.classList.remove('mst-locked');var ni=document.getElementById('mt-'+(slot+1));if(ni){ni.classList.remove('mi-locked');ni.classList.add('mi-ready');}}
    var ci=document.getElementById('mt-'+slot);if(ci)ci.classList.add('mi-active');
    setTimeout(function(){MIST.open=false;var ov=document.getElementById('mist-overlay');if(ov)ov.classList.remove('mist-open');document.removeEventListener('click',_out,true);},2500);
    setTimeout(function(){_phaseSend(slot);},260);
  }
  function _ss(m){var el=document.getElementById('mist-status');if(el)el.textContent=m;}

  // Replay recent mist events from the single shared events.json — same path as poll
  function _replayState(){
    var pat=_pat();if(!pat)return;
    fetch('https://api.github.com/repos/DART-Skyboard/leatr-ash/contents/'+_MIST_PATH,{
      headers:{'Authorization':'token '+pat,'Accept':'application/vnd.github.v3+json','Cache-Control':'no-cache'},
      cache:'no-store', signal:AbortSignal.timeout(6000)
    }).then(function(r){return r.ok?r.json():null;})
    .then(function(meta){
      if(!meta||!meta.sha)return;
      _shaCache['events.json']=meta.sha; // seed so poll skips until next write
      var evts=[];
      try{ evts=JSON.parse(atob(meta.content.replace(/\n/g,''))); }catch(e){ return; }
      if(!Array.isArray(evts))return;
      var myUid=_sid();
      evts.forEach(function(ev){
        if(!ev||!ev.ts||!ev.uid)return;
        if(Date.now()-ev.ts>STALE_MS)return;
        if(ev.instanceId&&ev.instanceId===_iid)return;
        var key=ev.uid+':'+ev.ts+':'+(ev.type||'solve');
        if(MIST.seen[key])return;
        MIST.seen[key]=true;
        _bcPost(ev); // relay to follower tabs
        _phaseObserve(ev); // visual only for replay — no BRPN, no write-back
      });
    }).catch(function(){});
  }

  function init(){
    injectCSS();injectHTML();
    // Attempt to claim leadership immediately; if another tab already holds it, we'll follow
    _checkLeader();
    // Start poll loop — _poll() internally gates on leadership
    setTimeout(function(){
      _poll();
      setInterval(_poll, POLL_MS);
    }, 1500 + Math.random()*1000); // stagger start slightly so tabs don't all fire at once
    // Initial session node refresh
    setTimeout(function(){ if(typeof _pollAshNodes==='function') _pollAshNodes(); }, 1000);
    // Replay world state — leader only (followers get events via BC relay)
    setTimeout(function(){ _checkLeader(); if(_isLeader) _replayState(); }, 6000);
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}

})();
