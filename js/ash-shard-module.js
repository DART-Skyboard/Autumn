// ═══════════════════════════════════════════════════════════════════════════
//  ASH SHARD MODULE v1 — Autumn · DART-Skyboard · Radical Deepscale LLC
//
//  SIGNAL FLOW
//  ───────────
//  DESIGN  → user builds textile (colors + shapes) on 2D canvas
//  SELECT  → user picks contacts from their GitHub following list
//  SEND    → tap textile → spawns frosted crystal shard in 3D scene
//             travels to selected contacts' nodes along plasma splines
//  RECEIVE → shard materializes at recipient's node, pulses BRPN shells
//  OFFLINE → missed shard written to ashtree/shards/pending/{uid}.json
//             replayed as volumetric animation on next login
//
//  CONTACTS
//  ────────
//  Fetched from GitHub API: /user/following (uses user's own OAuth token)
//  Stored in: ashtree/contacts/index.json (per-user, private leatr-ash)
//
//  EVENTS (ashtree/shards/events.json — shared append file, same as mist)
//  ────────────────────────────────────────────────────────────────────────
//  { type:'shard', fromUid, toUids[], textile:{colors[], shapes[], seed},
//    ts, instanceId }
//  { type:'shard_ack', fromUid, replyTo, ts, instanceId }
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  var POLL_MS       = 12000;   // match mist leader interval
  var STALE_MS      = 600000;  // 10 min
  var SHARD_PATH    = 'ashtree/shards/events.json';
  var CONTACTS_PATH = 'ashtree/contacts/index.json';
  var _iid = 'as_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);

  // ── Leader election — share with mist module ─────────────────────────────
  var _LEADER_KEY = 'autumn_mist_leader';
  function _isLeader(){
    try{ return (Date.now()-parseInt(localStorage.getItem(_LEADER_KEY)||'0',10))<16000; }
    catch(e){ return true; }
  }

  // ── State ─────────────────────────────────────────────────────────────────
  var AS = {
    open: false,
    // Textile design state
    textile: {
      shapes: [],       // [{type, x, y, w, h, color}]
      bgColor: '#0a0e1a',
      seed: 0
    },
    // Contact state
    contacts: [],       // [{login, avatar_url, starred}] — from GitHub following
    selectedUids: [],   // session UIDs of selected contacts (matched by gh login)
    contactsLoaded: false,
    searchQuery: '',
    // Tool state
    activeTool: 'rect', // rect | tri | pent | slash | cross
    activeColor: '#00e5ff',
    // Animation
    geom: [],
    seen: {}
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _sid(){ return (typeof _aut_sid!=='undefined')?_aut_sid:(typeof _aut_uid!=='undefined')?_aut_uid:'local'; }
  function _ghToken(){ return (window._ghAuth&&window._ghAuth.token)?window._ghAuth.token:''; }
  function _pat(){ return (typeof getLeatrAshPAT==='function')?getLeatrAshPAT():''; }
  function _ghUser(){ return (window._ghAuth&&window._ghAuth.username)?window._ghAuth.username:''; }

  function _nodePos(uid){
    if(typeof _ashNodes!=='undefined'&&_ashNodes._sessionGroups){
      var g=_ashNodes._sessionGroups[uid];
      if(g&&g.group) return g.group.position.clone();
    }
    if(typeof _nodeBasePos==='function'&&typeof THREE!=='undefined'){
      var bp=_nodeBasePos(uid); return new THREE.Vector3(bp.x,bp.y,bp.z);
    }
    return null;
  }

  function _splinesFor(uid){
    var out=[];
    if(typeof _ashNodes==='undefined'||!_ashNodes._splines) return out;
    var sp=_ashNodes._splines;
    if(sp['local:'+uid]) out.push({curve:sp['local:'+uid].curve,senderT:1});
    Object.keys(sp).forEach(function(k){
      if(k==='local:'+uid) return;
      var p=k.split(':');
      if(p[0]===uid) out.push({curve:sp[k].curve,senderT:0});
      else if(p[1]===uid) out.push({curve:sp[k].curve,senderT:1});
    });
    return out;
  }

  function _write(data){
    if(typeof writeLeatrAshMemory==='function'){
      writeLeatrAshMemory(SHARD_PATH, data);
    }
  }

  function _log(msg){
    if(window.S&&window.S.journal)
      window.S.journal.push({ts:new Date().toISOString(),_internal:true,_thought:msg});
  }

  // ── Contacts — GitHub following list ─────────────────────────────────────
  function _loadContacts(){
    var token=_ghToken();
    if(!token){ _renderContacts(); return; }
    if(AS.contactsLoaded){ _renderContacts(); return; }

    // Try loading saved contacts from leatr-ash first
    var pat=_pat();
    if(pat){
      fetch('https://api.github.com/repos/DART-Skyboard/leatr-ash/contents/'+CONTACTS_PATH,{
        headers:{'Authorization':'token '+pat,'Accept':'application/vnd.github.v3+json','Cache-Control':'no-cache'},
        cache:'no-store', signal:AbortSignal.timeout(6000)
      }).then(function(r){ return r.ok?r.json():null; })
        .then(function(meta){
          if(meta&&meta.content){
            try{
              var saved=JSON.parse(atob(meta.content.replace(/\n/g,'')));
              if(Array.isArray(saved)&&saved.length){
                AS.contacts=saved; AS.contactsLoaded=true;
                _renderContacts(); return;
              }
            }catch(e){}
          }
          _fetchGitHubFollowing(token);
        }).catch(function(){ _fetchGitHubFollowing(token); });
    } else {
      _fetchGitHubFollowing(token);
    }
  }

  function _fetchGitHubFollowing(token){
    _setContactStatus('FETCHING GITHUB CONTACTS...');
    fetch('https://api.github.com/user/following?per_page=100',{
      headers:{'Authorization':'token '+token,'Accept':'application/vnd.github.v3+json'},
      signal:AbortSignal.timeout(8000)
    }).then(function(r){ return r.ok?r.json():null; })
      .then(function(list){
        if(!Array.isArray(list)){ _setContactStatus('NOT SIGNED IN — LOGIN WITH GITHUB'); return; }
        AS.contacts=list.map(function(u){ return {login:u.login,avatar_url:u.avatar_url,starred:false}; });
        AS.contactsLoaded=true;
        // Restore starred state from saved list
        _mergeSavedStars();
        _saveContacts();
        _renderContacts();
      }).catch(function(){ _setContactStatus('COULD NOT LOAD CONTACTS'); });
  }

  function _mergeSavedStars(){
    // Restore which contacts were previously starred (from localStorage cache)
    try{
      var saved=JSON.parse(localStorage.getItem('_as_starred')||'[]');
      AS.contacts.forEach(function(c){ if(saved.indexOf(c.login)>=0) c.starred=true; });
    }catch(e){}
  }

  function _saveContacts(){
    // Save starred state to localStorage for quick restore
    var starred=AS.contacts.filter(function(c){ return c.starred; }).map(function(c){ return c.login; });
    try{ localStorage.setItem('_as_starred',JSON.stringify(starred)); }catch(e){}
    // Save full list to leatr-ash
    if(typeof writeLeatrAshMemory==='function'){
      // Use a direct PUT since contacts are not append-mode
      var pat=_pat(); if(!pat) return;
      var apiUrl='https://api.github.com/repos/DART-Skyboard/leatr-ash/contents/'+CONTACTS_PATH;
      var hdrs={'Authorization':'token '+pat,'Content-Type':'application/json','Accept':'application/vnd.github.v3+json'};
      fetch(apiUrl,{headers:hdrs,signal:AbortSignal.timeout(5000)})
        .then(function(r){ return r.ok?r.json():{sha:''}; })
        .then(function(ex){
          var body={message:'ash-contacts:'+_ghUser(),content:btoa(unescape(encodeURIComponent(JSON.stringify(AS.contacts,null,2))))};
          if(ex.sha) body.sha=ex.sha;
          return fetch(apiUrl,{method:'PUT',headers:hdrs,body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
        }).catch(function(){});
    }
  }

  function _toggleStar(login){
    var c=AS.contacts.find(function(x){ return x.login===login; });
    if(!c) return;
    c.starred=!c.starred;
    _saveContacts();
    _renderContacts();
    _updateSendButton();
  }

  function _getStarredContacts(){
    return AS.contacts.filter(function(c){ return c.starred; });
  }

  // Match GitHub usernames to live session UIDs
  // Sessions write their GitHub username into presence data when logged in
  function _resolveSessionUids(logins){
    var uids=[];
    if(typeof _ashNodes==='undefined'||!_ashNodes._sessionGroups) return uids;
    Object.keys(_ashNodes._sessionGroups).forEach(function(uid){
      var node=_ashNodes._sessionGroups[uid].node;
      if(node&&node.ghLogin&&logins.indexOf(node.ghLogin)>=0) uids.push(uid);
    });
    return uids;
  }

  // ── Textile Canvas ────────────────────────────────────────────────────────
  var _canvas=null, _ctx=null;

  function _initCanvas(){
    _canvas=document.getElementById('as-textile-canvas');
    if(!_canvas) return;
    _ctx=_canvas.getContext('2d');
    _canvas.addEventListener('click',_onCanvasClick);
    _canvas.addEventListener('touchend',function(e){
      e.preventDefault();
      var t=e.changedTouches[0];
      _onCanvasClick({clientX:t.clientX,clientY:t.clientY});
    },{passive:false});
    _renderTextile();
  }

  function _onCanvasClick(e){
    if(!_canvas||!_ctx) return;
    var r=_canvas.getBoundingClientRect();
    var x=(e.clientX-r.left)*((_canvas.width)/r.width);
    var y=(e.clientY-r.top)*((_canvas.height)/r.height);
    var w=40+Math.random()*40, h=40+Math.random()*40;
    AS.textile.shapes.push({
      type:AS.activeTool,
      x:x-w/2, y:y-h/2, w:w, h:h,
      color:AS.activeColor,
      opacity:0.55+Math.random()*0.35
    });
    if(AS.textile.shapes.length>80) AS.textile.shapes=AS.textile.shapes.slice(-80);
    _renderTextile();
  }

  function _renderTextile(){
    if(!_canvas||!_ctx) return;
    var w=_canvas.width, h=_canvas.height;
    _ctx.clearRect(0,0,w,h);

    // Background
    var bg=_ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,'#080c18'); bg.addColorStop(1,'#0d1428');
    _ctx.fillStyle=bg; _ctx.fillRect(0,0,w,h);

    // Grid lines (subtle)
    _ctx.strokeStyle='rgba(0,229,255,0.06)'; _ctx.lineWidth=1;
    for(var gx=0;gx<w;gx+=24){ _ctx.beginPath();_ctx.moveTo(gx,0);_ctx.lineTo(gx,h);_ctx.stroke(); }
    for(var gy=0;gy<h;gy+=24){ _ctx.beginPath();_ctx.moveTo(0,gy);_ctx.lineTo(w,gy);_ctx.stroke(); }

    // Shapes
    AS.textile.shapes.forEach(function(s){
      _ctx.save();
      _ctx.globalAlpha=s.opacity||0.7;
      // Frosted glass effect — fill then lighter stroke
      var grad=_ctx.createRadialGradient(s.x+s.w*.5,s.y+s.h*.5,0,s.x+s.w*.5,s.y+s.h*.5,Math.max(s.w,s.h)*.7);
      grad.addColorStop(0,s.color+'cc');
      grad.addColorStop(1,s.color+'22');
      _ctx.fillStyle=grad;
      _ctx.strokeStyle=s.color+'99';
      _ctx.lineWidth=1.5;
      _drawShape(_ctx,s);
      _ctx.restore();
    });

    // Center shard preview marker
    if(AS.textile.shapes.length===0){
      _ctx.fillStyle='rgba(0,229,255,0.12)';
      _ctx.font='11px monospace';
      _ctx.textAlign='center';
      _ctx.fillText('TAP TO PLACE SHAPES',w/2,h/2-8);
      _ctx.fillText('TAP SHARD TO SEND',w/2,h/2+8);
    }
  }

  function _drawShape(ctx,s){
    ctx.beginPath();
    if(s.type==='rect'||s.type==='cross'){
      ctx.rect(s.x,s.y,s.w,s.h);
      if(s.type==='cross'){
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.rect(s.x+s.w*.1,s.y-s.h*.3,s.w*.8,s.h*1.6);
      }
    } else if(s.type==='tri'){
      ctx.moveTo(s.x+s.w/2,s.y);
      ctx.lineTo(s.x+s.w,s.y+s.h);
      ctx.lineTo(s.x,s.y+s.h);
      ctx.closePath();
    } else if(s.type==='pent'){
      var cx=s.x+s.w/2, cy=s.y+s.h/2, rx=s.w/2, ry=s.h/2;
      for(var i=0;i<5;i++){
        var a=(i*2*Math.PI/5)-Math.PI/2;
        if(i===0) ctx.moveTo(cx+rx*Math.cos(a),cy+ry*Math.sin(a));
        else ctx.lineTo(cx+rx*Math.cos(a),cy+ry*Math.sin(a));
      }
      ctx.closePath();
    } else if(s.type==='slash'){
      ctx.lineWidth=4;
      ctx.moveTo(s.x,s.y+s.h); ctx.lineTo(s.x+s.w,s.y);
      ctx.stroke(); ctx.moveTo(s.x+s.w*.3,s.y+s.h);ctx.lineTo(s.x+s.w,s.y+s.h*.2);
      ctx.stroke(); return;
    }
    ctx.fill(); ctx.stroke();
  }

  function _randomizeTextile(){
    AS.textile.shapes=[];
    AS.textile.seed=Date.now();
    var colors=['#00e5ff','#bf5fff','#ff6b35','#00ff88','#ffd700','#ff4488','#4af'];
    var tools=['rect','tri','pent','slash','cross'];
    var count=8+Math.floor(Math.random()*14);
    var cw=_canvas?_canvas.width:200, ch=_canvas?_canvas.height:200;
    for(var i=0;i<count;i++){
      var w=24+Math.random()*60, h=24+Math.random()*60;
      AS.textile.shapes.push({
        type:tools[Math.floor(Math.random()*tools.length)],
        x:Math.random()*(cw-w), y:Math.random()*(ch-h), w:w, h:h,
        color:colors[Math.floor(Math.random()*colors.length)],
        opacity:0.4+Math.random()*0.5
      });
    }
    _renderTextile();
  }

  function _clearTextile(){
    AS.textile.shapes=[];
    _renderTextile();
  }

  // ── 3D Shard Geometry ─────────────────────────────────────────────────────
  function _spawnShardAt(fromPos, toPos, textile, direction){
    if(typeof THREE==='undefined'||typeof scene==='undefined') return;

    // Extract dominant colors from textile
    var colors=textile.shapes.length>0
      ? textile.shapes.slice(-6).map(function(s){ return new THREE.Color(s.color); })
      : [new THREE.Color(0x00e5ff),new THREE.Color(0xbf5fff)];
    var mainCol=colors[0]||new THREE.Color(0x00e5ff);
    var accentCol=colors[Math.min(1,colors.length-1)]||new THREE.Color(0xbf5fff);

    var grp=new THREE.Group();
    grp._asAge=0; grp._asMax=280; grp._asObjs=[];

    // Primary crystal shard — tapered spire, NOT wireframe, frosted translucent
    var shardGeo=new THREE.ConeGeometry(0.13,0.55,6,1);
    var shardMat=new THREE.MeshPhongMaterial({
      color:mainCol, emissive:mainCol, emissiveIntensity:0.35,
      transparent:true, opacity:0.52,
      shininess:120, specular:new THREE.Color(0xffffff),
      side:THREE.DoubleSide
    });
    var shard=new THREE.Mesh(shardGeo,shardMat);
    shard.rotation.z=Math.PI/2; // point forward along travel
    grp.add(shard); grp._asObjs.push(shard);

    // Inner crystal core — smaller, brighter
    var innerGeo=new THREE.OctahedronGeometry(0.065,0);
    var innerMat=new THREE.MeshBasicMaterial({
      color:accentCol, transparent:true, opacity:0.8
    });
    var inner=new THREE.Mesh(innerGeo,innerMat);
    grp.add(inner); grp._asObjs.push(inner);

    // Frosted shell — slightly larger, very transparent
    var shellGeo=new THREE.IcosahedronGeometry(0.18,1);
    var shellMat=new THREE.MeshPhongMaterial({
      color:mainCol, transparent:true, opacity:0.12,
      side:THREE.DoubleSide, wireframe:false,
      shininess:200
    });
    var shell=new THREE.Mesh(shellGeo,shellMat);
    grp.add(shell); grp._asObjs.push(shell);

    // Trailing particles
    var particleCount=direction==='send'?10:8;
    for(var i=0;i<particleCount;i++){
      var pgeo=new THREE.TetrahedronGeometry(0.025+Math.random()*0.025,0);
      var pcol=colors[i%colors.length]||mainCol;
      var pmat=new THREE.MeshBasicMaterial({color:pcol,transparent:true,opacity:0.6});
      var pm=new THREE.Mesh(pgeo,pmat);
      pm._trailOffset=i*0.08;
      pm._trailRot=new THREE.Vector3(Math.random()*.1,Math.random()*.1,Math.random()*.08);
      grp._asObjs.push(pm); grp.add(pm);
    }

    // Travel path — spline from fromPos to toPos
    var mid=fromPos.clone().add(toPos).multiplyScalar(0.5)
      .add(new THREE.Vector3(
        (Math.random()-.5)*1.2,
        0.8+Math.random()*0.6,
        (Math.random()-.5)*1.2
      ));
    var curve=new THREE.CatmullRomCurve3([fromPos.clone(),mid,toPos.clone()]);

    // Arc line
    var lGeo=new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
    var lMat=new THREE.LineBasicMaterial({color:mainCol,transparent:true,opacity:0.22});
    var arc=new THREE.Line(lGeo,lMat);
    grp.add(arc); grp._asArc=arc;

    grp._asCurve=curve;
    grp._asT=0;
    grp._asDir=direction;
    grp._asToPos=toPos.clone();
    grp._asFromPos=fromPos.clone();

    grp.position.copy(fromPos);
    scene.add(grp);
    AS.geom.push(grp);

    // BRPN pulse on arrival
    if(direction==='receive'){
      setTimeout(function(){
        if(typeof pulseShells==='function') pulseShells(1.5);
        if(typeof applyOrbEmotion==='function') applyOrbEmotion('inspired');
      }, 1200);
    }
  }

  // Burst ring at destination
  function _spawnArrivalBurst(pos, col){
    if(typeof THREE==='undefined'||typeof scene==='undefined') return;
    var grp=new THREE.Group();
    grp._asAge=0; grp._asMax=80; grp._asObjs=[];
    for(var i=0;i<3;i++){
      var rGeo=new THREE.TorusGeometry(0.08+i*0.07,0.01,4,18);
      var rMat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.7-i*0.15,wireframe:true});
      var ring=new THREE.Mesh(rGeo,rMat);
      ring.position.copy(pos);
      ring.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,0);
      ring._expandSpd=0.008+i*0.003; ring._isRing=true;
      grp._asObjs.push(ring); grp.add(ring);
    }
    scene.add(grp); AS.geom.push(grp);
  }

  // ── Animation tick ─────────────────────────────────────────────────────────
  (function _tick(){
    requestAnimationFrame(_tick);
    if(!AS.geom.length) return;
    var rem=[];
    AS.geom.forEach(function(g){
      g._asAge++;
      var fade=1-g._asAge/g._asMax;
      if(fade<=0){ rem.push(g); return; }

      if(g._asCurve){
        // Travel along spline
        g._asT=Math.min(1,g._asT+0.006);
        var pt=g._asCurve.getPoint(g._asT);
        g.position.copy(pt);
        // Arrival burst at t≈0.95
        if(g._asT>=0.95&&!g._asArrived){
          g._asArrived=true;
          var col=g._asObjs[0]&&g._asObjs[0].material?g._asObjs[0].material.color:new THREE.Color(0x00e5ff);
          _spawnArrivalBurst(g._asToPos.clone(),col);
        }
        // Rotate shard
        g._asObjs.forEach(function(obj,i){
          if(obj._trailOffset!==undefined){
            // Trail particle — lag behind on curve
            var tOff=Math.max(0,g._asT-obj._trailOffset);
            var tp=g._asCurve.getPoint(tOff);
            obj.position.copy(tp).sub(g.position);
            obj.rotation.x+=obj._trailRot.x;
            obj.rotation.y+=obj._trailRot.y;
            obj.material.opacity=0.5*fade;
          } else {
            if(i===0) obj.rotation.y+=0.04; // shard spin
            if(i===1){ obj.rotation.x+=0.06; obj.rotation.z+=0.04; } // inner core
            if(i===2){ obj.rotation.y-=0.02; obj.rotation.x+=0.015; } // shell
          }
          if(obj.material) obj.material.opacity=Math.min(obj.material.opacity,
            i===2?0.12*fade:(i===0?0.52*fade:0.8*fade));
        });
        // Fade arc
        if(g._asArc&&g._asArc.material) g._asArc.material.opacity=0.22*fade;
      } else if(g._asObjs.length){
        // Burst ring animation
        g._asObjs.forEach(function(obj){
          if(obj._isRing){
            obj.scale.multiplyScalar(1+obj._expandSpd);
            if(obj.material) obj.material.opacity=0.65*fade;
          }
        });
      }
    });
    rem.forEach(function(g){
      if(typeof scene!=='undefined') scene.remove(g);
      g._asObjs.forEach(function(o){ if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose(); });
      var idx=AS.geom.indexOf(g);if(idx>=0)AS.geom.splice(idx,1);
    });
  })();

  // ── Send shard ─────────────────────────────────────────────────────────────
  function _sendShard(){
    var starred=_getStarredContacts();
    if(starred.length===0){ _asToast('SELECT CONTACTS FIRST'); return; }
    if(AS.textile.shapes.length===0){ _asToast('DESIGN YOUR SHARD FIRST'); return; }

    var myUid=_sid();
    var myPos=new THREE.Vector3(0,0,0);
    var starred_logins=starred.map(function(c){ return c.login; });
    var liveUids=_resolveSessionUids(starred_logins);
    var offlineLogins=starred_logins.filter(function(login){
      return liveUids.length===0||!liveUids.some(function(u){
        var node=_ashNodes&&_ashNodes._sessionGroups&&_ashNodes._sessionGroups[u]&&_ashNodes._sessionGroups[u].node;
        return node&&node.ghLogin===login;
      });
    });

    // Build textile snapshot
    var textileData={
      shapes:AS.textile.shapes.slice(-40),
      seed:AS.textile.seed,
      colors:AS.textile.shapes.map(function(s){ return s.color; }).filter(function(v,i,a){ return a.indexOf(v)===i; }).slice(0,8)
    };

    var ts=Date.now();
    var ev={type:'shard',fromUid:myUid,toUids:liveUids,offlineLogins:offlineLogins,
            textile:textileData,ts:ts,instanceId:_iid};

    // Visual: spawn shard toward each live target node
    if(liveUids.length>0){
      liveUids.forEach(function(uid){
        var toPos=_nodePos(uid)||new THREE.Vector3(2,1,-1.5);
        _spawnShardAt(myPos.clone(),toPos,textileData,'send');
      });
    } else {
      // No live targets — show offline send animation (shard dissolves outward)
      var outPos=new THREE.Vector3(3,1.5,-2);
      _spawnShardAt(myPos.clone(),outPos,textileData,'send');
    }

    // Write to shared events file
    _write(ev);

    // Offline: write pending notifications to each offline user's path
    offlineLogins.forEach(function(login){
      if(typeof writeLeatrAshMemory==='function'){
        writeLeatrAshMemory('ashtree/shards/pending/'+login+'.json',{
          type:'missed_shard', fromUid:myUid, fromLogin:_ghUser(),
          textile:textileData, ts:ts, instanceId:_iid
        });
      }
    });

    _asToast(liveUids.length>0?'◈ SHARD SENT':'◈ SHARD SENT — OFFLINE USERS NOTIFIED');
    _log('ASH SHARD SENT → '+starred_logins.join(', ')+' ('+liveUids.length+' live, '+offlineLogins.length+' offline)');

    // BroadcastChannel relay
    if(_bc) try{ _bc.postMessage(ev); }catch(e){}
  }

  // ── Receive / Poll ─────────────────────────────────────────────────────────
  var _shaCache={};

  function _poll(){
    if(!_isLeader()) return;
    var pat=_pat(); if(!pat) return;
    fetch('https://api.github.com/repos/DART-Skyboard/leatr-ash/contents/'+SHARD_PATH,{
      headers:{'Authorization':'token '+pat,'Accept':'application/vnd.github.v3+json','Cache-Control':'no-cache'},
      cache:'no-store', signal:AbortSignal.timeout(6000)
    }).then(function(r){
      if(r.status===403||r.status===429){ console.warn('[SHARD] rate limited'); return null; }
      return r.ok?r.json():null;
    }).then(function(meta){
      if(!meta||!meta.sha) return;
      if(_shaCache['events']===meta.sha) return;
      _shaCache['events']=meta.sha;
      var evts=[];
      try{ evts=JSON.parse(atob(meta.content.replace(/\n/g,''))); }catch(e){ return; }
      if(!Array.isArray(evts)) return;
      var myUid=_sid();
      evts.forEach(function(ev){
        if(!ev||!ev.ts||!ev.fromUid) return;
        if(ev.instanceId===_iid) return;
        if(Date.now()-ev.ts>STALE_MS) return;
        var key=ev.fromUid+':'+ev.ts+':'+(ev.type||'shard');
        if(AS.seen[key]) return;
        AS.seen[key]=true;
        if(_bc) try{ _bc.postMessage(ev); }catch(e){}
        _processEvent(ev, myUid);
      });
    }).catch(function(e){ console.warn('[SHARD] poll error:',e); });

    // Check missed shards for this user
    _checkPending();
  }

  function _checkPending(){
    var login=_ghUser(); if(!login) return;
    var pat=_pat(); if(!pat) return;
    fetch('https://api.github.com/repos/DART-Skyboard/leatr-ash/contents/ashtree/shards/pending/'+login+'.json',{
      headers:{'Authorization':'token '+pat,'Accept':'application/vnd.github.v3+json','Cache-Control':'no-cache'},
      cache:'no-store', signal:AbortSignal.timeout(5000)
    }).then(function(r){ return r.ok?r.json():null; })
      .then(function(meta){
        if(!meta||!meta.content) return;
        var data; try{ data=JSON.parse(atob(meta.content.replace(/\n/g,''))); }catch(e){ return; }
        var items=Array.isArray(data)?data:[data];
        var newItems=items.filter(function(d){ return d&&!d._replayed; });
        if(!newItems.length) return;
        // Replay missed shards
        newItems.forEach(function(d){
          if(!d.textile) return;
          var fromPos=_nodePos(d.fromUid)||new THREE.Vector3(2,1,-1.5);
          _spawnShardAt(fromPos,new THREE.Vector3(0,0,0),d.textile,'receive');
          d._replayed=true;
          _asToast('◈ MISSED SHARD FROM '+(d.fromLogin||'?').toUpperCase());
          _log('ASH SHARD REPLAY — missed from '+(d.fromLogin||d.fromUid||'?'));
        });
        // Mark all as replayed
        _clearPending(login, meta.sha);
      }).catch(function(){});
  }

  function _clearPending(login, sha){
    var pat=_pat(); if(!pat) return;
    var apiUrl='https://api.github.com/repos/DART-Skyboard/leatr-ash/contents/ashtree/shards/pending/'+login+'.json';
    fetch(apiUrl,{
      method:'PUT',
      headers:{'Authorization':'token '+pat,'Content-Type':'application/json','Accept':'application/vnd.github.v3+json'},
      body:JSON.stringify({message:'shard-ack:'+login,content:btoa('[]'),sha:sha}),
      signal:AbortSignal.timeout(8000)
    }).catch(function(){});
  }

  function _processEvent(ev, myUid){
    if(ev.type!=='shard') return;
    // Am I a target?
    var iTarget=ev.toUids&&ev.toUids.indexOf(myUid)>=0;
    if(!iTarget) return;
    // Spawn incoming shard from sender's node
    var fromPos=_nodePos(ev.fromUid)||new THREE.Vector3(2,1,-1.5);
    var toPos=new THREE.Vector3(0,0,0);
    _spawnShardAt(fromPos,toPos,ev.textile||{shapes:[],colors:[]}, 'receive');
    _log('ASH SHARD RECEIVED from '+ev.fromUid.slice(0,16));
  }

  // ── BroadcastChannel ───────────────────────────────────────────────────────
  var _bc=null;
  try{
    _bc=new BroadcastChannel('autumn_shard');
    _bc.onmessage=function(e){
      if(!e.data) return;
      var d=e.data;
      var key=(d.fromUid||'?')+':'+(d.ts||0)+':'+(d.type||'shard');
      if(AS.seen[key]) return;
      AS.seen[key]=true;
      _processEvent(d,_sid());
    };
  }catch(e){ _bc=null; }

  // ── UI ─────────────────────────────────────────────────────────────────────
  function injectCSS(){
    var s=document.createElement('style');
    s.textContent=[
      // Trigger tab — below mist at top:280px
      '#as-trigger{position:fixed;right:0;top:280px;z-index:9499;display:flex;flex-direction:column;',
        'align-items:center;justify-content:center;padding:8px 5px;',
        'background:rgba(255,255,255,.05);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
        'border:1px solid rgba(191,95,255,.22);border-right:none;border-radius:7px 0 0 7px;',
        'cursor:pointer;transition:all .2s;gap:4px}',
      '#as-trigger:hover{background:rgba(191,95,255,.09);border-color:rgba(191,95,255,.5)}',
      '#as-trigger-icon{font-size:14px;color:rgba(191,95,255,.7);transition:all .3s;line-height:1}',
      '#as-trigger-lbl{font-family:var(--font-d,monospace);font-size:.22rem;letter-spacing:2px;',
        'color:rgba(191,95,255,.45);writing-mode:vertical-rl;text-orientation:mixed}',
      // Main overlay
      '#as-overlay{position:fixed;right:36px;top:272px;z-index:9398;width:min(270px,calc(100vw - 48px));',
        'display:flex;flex-direction:column;',
        'transform:translateX(calc(100% + 44px));transition:transform .32s cubic-bezier(.23,1,.32,1),opacity .32s;',
        'opacity:0;pointer-events:none}',
      '#as-overlay.as-open{transform:translateX(0);opacity:1;pointer-events:all}',
      // Header panel
      '#as-header{background:rgba(255,255,255,.05);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'border:1px solid rgba(191,95,255,.2);border-bottom:none;border-radius:7px 7px 0 0;',
        'padding:7px 9px 5px;display:flex;flex-direction:column;gap:5px}',
      '#as-head-row{display:flex;align-items:center;gap:7px}',
      '.as-lbl{font-family:var(--font-d,monospace);font-size:.42rem;letter-spacing:3px;color:rgba(191,95,255,.9);',
        'text-shadow:0 0 7px rgba(191,95,255,.45)}',
      '.as-sub{font-family:var(--font-d,monospace);font-size:.27rem;letter-spacing:2px;color:rgba(191,95,255,.35)}',
      '#as-x{margin-left:auto;background:none;border:none;color:rgba(191,95,255,.3);font-size:12px;cursor:pointer;padding:2px 4px;line-height:1}',
      // Contact search row
      '#as-contacts-row{display:flex;align-items:center;gap:5px}',
      '#as-search{flex:1;background:rgba(191,95,255,.07);border:1px solid rgba(191,95,255,.45);',
        'color:rgba(224,200,255,.8);font-family:var(--font-d,monospace);font-size:.3rem;letter-spacing:1px;',
        'padding:4px 7px;border-radius:3px;outline:none}',
      '#as-search::placeholder{color:rgba(191,95,255,.3)}',
      '#as-star-send{background:transparent;border:1px solid rgba(191,95,255,.5);color:rgba(191,95,255,.85);',
        'padding:3px 8px;border-radius:3px;cursor:pointer;font-family:var(--font-d,monospace);',
        'font-size:.28rem;letter-spacing:1px;white-space:nowrap;transition:all .15s}',
      '#as-star-send.as-active{border-color:#bf5fff;color:#bf5fff;box-shadow:0 0 8px rgba(191,95,255,.3)}',
      // Contact list
      '#as-contacts-list{max-height:110px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;',
        'scrollbar-width:thin;scrollbar-color:rgba(191,95,255,.2) transparent}',
      '.as-contact{display:flex;align-items:center;gap:6px;padding:3px 5px;border-radius:3px;',
        'cursor:pointer;transition:background .15s}',
      '.as-contact:hover{background:rgba(191,95,255,.08)}',
      '.as-contact.as-starred{background:rgba(191,95,255,.12)}',
      '.as-contact-av{width:18px;height:18px;border-radius:50%;border:1px solid rgba(191,95,255,.55)}',
      '.as-contact-name{flex:1;font-family:var(--font-d,monospace);font-size:.28rem;letter-spacing:1px;color:rgba(224,200,255,.9)}',
      '.as-contact-star{font-size:11px;color:rgba(191,95,255,.55);transition:all .15s}',
      '.as-contact.as-starred .as-contact-star{color:#bf5fff;text-shadow:0 0 5px rgba(191,95,255,.6)}',
      '#as-contact-status{font-family:var(--font-d,monospace);font-size:.25rem;letter-spacing:2px;',
        'color:rgba(191,95,255,.4);text-align:center;padding:4px 0}',
      // Canvas area
      '#as-canvas-wrap{background:rgba(255,255,255,.05);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'border:1px solid rgba(191,95,255,.38);border-radius:0 0 7px 7px;padding:6px;',
        'display:flex;flex-direction:column;align-items:center;gap:4px}',
      // Tool bar
      '#as-tools{display:flex;gap:3px;align-items:center;width:100%;justify-content:center}',
      '.as-tool{background:transparent;border:1px solid rgba(191,95,255,.45);color:rgba(191,95,255,.75);',
        'padding:3px 7px;border-radius:3px;cursor:pointer;font-size:12px;transition:all .15s;min-width:28px;text-align:center}',
      '.as-tool.as-sel{border-color:rgba(191,95,255,.95);color:#df8fff;box-shadow:0 0 8px rgba(191,95,255,.45)}',
      '#as-color-pick{width:22px;height:22px;padding:0;border:none;border-radius:50%;cursor:pointer;',
        'background:transparent;overflow:hidden;flex-shrink:0}',
      // Textile canvas
      '#as-textile-canvas{display:block;touch-action:none;cursor:crosshair;',
        'border:1px solid rgba(191,95,255,.4);border-radius:3px;width:100%}',
      // Bottom row
      '#as-bottom-row{display:flex;gap:4px;width:100%;justify-content:space-between}',
      '#as-btn-rand{flex:1;background:transparent;border:1px solid rgba(191,95,255,.5);color:rgba(191,95,255,.8);',
        'padding:4px;border-radius:3px;cursor:pointer;font-family:var(--font-d,monospace);font-size:.26rem;letter-spacing:1px}',
      '#as-btn-clear{background:transparent;border:1px solid rgba(255,80,80,.45);color:rgba(255,80,80,.7);',
        'padding:4px 7px;border-radius:3px;cursor:pointer;font-family:var(--font-d,monospace);font-size:.26rem;letter-spacing:1px}',
      '#as-btn-send{flex:2;background:rgba(191,95,255,.12);border:1px solid rgba(191,95,255,.6);',
        'color:#bf5fff;padding:5px;border-radius:3px;cursor:pointer;font-family:var(--font-d,monospace);',
        'font-size:.3rem;letter-spacing:2px;transition:all .2s}',
      '#as-btn-send:hover{background:rgba(191,95,255,.22);box-shadow:0 0 10px rgba(191,95,255,.3)}',
      '#as-status{font-family:var(--font-d,monospace);font-size:.24rem;letter-spacing:2px;',
        'color:rgba(191,95,255,.4);text-align:center;min-height:12px}',
      // Toast
      '#as-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);',
        'background:rgba(191,95,255,.18);backdrop-filter:blur(10px);',
        'border:1px solid rgba(191,95,255,.3);border-radius:5px;',
        'font-family:var(--font-d,monospace);font-size:.32rem;letter-spacing:2px;color:#bf5fff;',
        'padding:8px 16px;z-index:9999;opacity:0;transition:all .3s;pointer-events:none}',
      '#as-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}',
      '@media (orientation:landscape) and (max-height:500px){#as-trigger{top:188px}#as-overlay{top:180px}}',
    ].join('');
    document.head.appendChild(s);
  }

  function injectHTML(){
    // Side trigger tab
    var tr=document.createElement('div');
    tr.id='as-trigger'; tr.title='ASH SHARD — Direct Crystal Message';
    tr.innerHTML='<div id="as-trigger-icon">◈</div><div id="as-trigger-lbl">SHARD</div>';
    tr.onclick=function(e){ e.stopPropagation(); asToggle(); };
    document.body.appendChild(tr);

    // Toast
    var toast=document.createElement('div');
    toast.id='as-toast'; document.body.appendChild(toast);

    // Main overlay
    var ov=document.createElement('div'); ov.id='as-overlay';
    ov.innerHTML=[
      '<div id="as-header">',
        '<div id="as-head-row">',
          '<span class="as-lbl">◈ ASH SHARD</span>',
          '<span class="as-sub">CRYSTAL MESSAGE</span>',
          '<button id="as-x" onclick="asToggle()">✕</button>',
        '</div>',
        '<div id="as-contacts-row">',
          '<input id="as-search" placeholder="SEARCH CONTACTS..." oninput="asSearchContacts(this.value)">',
          '<button id="as-star-send" id="as-confirm-contacts" onclick="asConfirmContacts()">★ SELECT</button>',
        '</div>',
        '<div id="as-contacts-list"><div id="as-contact-status">LOADING...</div></div>',
      '</div>',
      '<div id="as-canvas-wrap">',
        '<div id="as-tools">',
          '<button class="as-tool as-sel" data-tool="rect" onclick="asSetTool(\'rect\')">□</button>',
          '<button class="as-tool" data-tool="tri" onclick="asSetTool(\'tri\')">△</button>',
          '<button class="as-tool" data-tool="pent" onclick="asSetTool(\'pent\')">⬠</button>',
          '<button class="as-tool" data-tool="slash" onclick="asSetTool(\'slash\')">//</button>',
          '<button class="as-tool" data-tool="cross" onclick="asSetTool(\'cross\')">+</button>',
          '<input type="color" id="as-color-pick" value="#00e5ff" oninput="asSetColor(this.value)" title="Color">',
        '</div>',
        '<canvas id="as-textile-canvas" width="240" height="180"></canvas>',
        '<div id="as-bottom-row">',
          '<button id="as-btn-rand" onclick="asRandomize()">⟳ RAND</button>',
          '<button id="as-btn-clear" onclick="asClear()">✕</button>',
          '<button id="as-btn-send" onclick="asSendShard()">◈ SEND SHARD</button>',
        '</div>',
        '<div id="as-status"></div>',
      '</div>',
    ].join('');
    ov.addEventListener('click',function(e){ e.stopPropagation(); });
    document.body.appendChild(ov);
    if(typeof window._autumnBindOverlayDrag==='function') window._autumnBindOverlayDrag('as-overlay','_aut_ovpos_as-overlay');
    if(typeof window._autumnSideTabLayout==='function') window._autumnSideTabLayout();
  }

  // ── Public API (window globals) ────────────────────────────────────────────
  window.asToggle=function(){
    AS.open=!AS.open;
    var ov=document.getElementById('as-overlay');
    if(ov) ov.classList.toggle('as-open',AS.open);
    if(AS.open && ov && typeof ov._autApplySavedPos==='function') ov._autApplySavedPos();
    if(AS.open){
      setTimeout(function(){
        _initCanvas();
        _loadContacts();
        document.addEventListener('click',_asOut,true);
      },60);
    } else {
      document.removeEventListener('click',_asOut,true);
    }
  };

  function _asOut(e){
    var ov=document.getElementById('as-overlay');
    var tr=document.getElementById('as-trigger');
    if(ov&&ov.contains(e.target)) return;
    if(tr&&tr.contains(e.target)) return;
    if(AS.open){ AS.open=false; if(ov) ov.classList.remove('as-open'); document.removeEventListener('click',_asOut,true); }
  }

  window.asSearchContacts=function(q){
    AS.searchQuery=q.trim().toLowerCase();
    _renderContacts();
  };

  window.asSetTool=function(tool){
    AS.activeTool=tool;
    document.querySelectorAll('.as-tool').forEach(function(b){
      b.classList.toggle('as-sel', b.dataset.tool===tool);
    });
  };

  window.asSetColor=function(col){
    AS.activeColor=col;
  };

  window.asRandomize=_randomizeTextile;
  window.asClear=_clearTextile;
  window.asSendShard=_sendShard;

  window.asConfirmContacts=function(){
    var btn=document.getElementById('as-star-send');
    var starred=_getStarredContacts();
    if(!btn) return;
    if(starred.length>0){
      btn.classList.add('as-active');
      btn.textContent='★ '+starred.length+' READY';
      _asToast(starred.length+' CONTACT'+(starred.length>1?'S':'')+' SELECTED');
    } else {
      btn.classList.remove('as-active');
      btn.textContent='★ SELECT';
    }
  };

  function _updateSendButton(){
    var starred=_getStarredContacts();
    var btn=document.getElementById('as-star-send');
    if(!btn) return;
    if(starred.length>0){ btn.classList.add('as-active'); btn.textContent='★ '+starred.length+' READY'; }
    else { btn.classList.remove('as-active'); btn.textContent='★ SELECT'; }
  }

  function _renderContacts(){
    var list=document.getElementById('as-contacts-list');
    if(!list) return;
    if(!AS.contactsLoaded){
      list.innerHTML='<div id="as-contact-status">LOADING GITHUB CONTACTS...</div>';
      return;
    }
    var filtered=AS.contacts.filter(function(c){
      if(!AS.searchQuery) return true;
      return c.login.toLowerCase().indexOf(AS.searchQuery)>=0;
    });
    if(filtered.length===0){
      list.innerHTML='<div id="as-contact-status">'+(AS.contacts.length===0?'NOT FOLLOWING ANYONE ON GITHUB':'NO MATCH')+'</div>';
      return;
    }
    // Sort starred first
    filtered.sort(function(a,b){ return (b.starred?1:0)-(a.starred?1:0); });
    list.innerHTML=filtered.map(function(c){
      return '<div class="as-contact'+(c.starred?' as-starred':'')+'" onclick="asToggleContact(\''+c.login+'\')">'
        +'<img class="as-contact-av" src="'+c.avatar_url+'" onerror="this.style.display=\'none\'">'
        +'<span class="as-contact-name">'+c.login.toUpperCase()+'</span>'
        +'<span class="as-contact-star">'+(c.starred?'★':'☆')+'</span>'
        +'</div>';
    }).join('');
  }

  window.asToggleContact=function(login){
    _toggleStar(login);
    _updateSendButton();
  };

  function _setContactStatus(msg){
    var el=document.getElementById('as-contact-status');
    if(el) el.textContent=msg;
  }

  function _asToast(msg){
    var t=document.getElementById('as-toast');
    if(!t) return;
    t.textContent=msg; t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); },2800);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init(){
    injectCSS();
    injectHTML();
    if(typeof window._autumnSideTabLayout==='function') window._autumnSideTabLayout();
    // Start poll loop
    setTimeout(function(){
      _poll();
      setInterval(_poll, POLL_MS);
    }, 3000+Math.random()*1000);
    // Check missed shards on load (after session settles)
    setTimeout(_checkPending, 8000);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  } else {
    init();
  }

})();

