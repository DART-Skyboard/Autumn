/* ════════════════════════════════════════════════════════════════
   MOVEMENT CONJECTURE — 3D GRAPHS (Three.js r132, OrbitControls)
   Orbit = drag · Pan = right-drag / two fingers · Dolly = wheel / pinch,
   plus DOLLY ± buttons and a TRACK shot that dollies along the time axis.
════════════════════════════════════════════════════════════════ */
(function(root){
'use strict';
const T = ()=>root.THREE;
const hasGL = (()=>{ try{ const c=document.createElement('canvas'); return !!(c.getContext('webgl2')||c.getContext('webgl')); }catch(e){ return false; } })();

function label(text, color, scale){
  const c=document.createElement('canvas'); c.width=256; c.height=64;
  const g=c.getContext('2d'); g.font="bold 30px 'Share Tech Mono',monospace"; g.fillStyle=color||'#8fdfee';
  g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,128,32);
  const s=new (T().Sprite)(new (T().SpriteMaterial)({map:new (T().CanvasTexture)(c),transparent:true,depthWrite:false}));
  s.scale.set(4*(scale||1),1*(scale||1),1); return s;
}
function col(hex){ return new (T().Color)(hex); }

/* ── Viewer ───────────────────────────────────────────────────── */
class Viewer{
  constructor(host, opt){
    opt = opt||{};
    const THREE=T();
    this.host=host; this.W=opt.width||host.clientWidth||900; this.H=opt.height||host.clientHeight||380;
    this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:!!opt.keep});
    this.renderer.setPixelRatio(opt.pixelRatio||Math.min(devicePixelRatio||1,2));
    this.renderer.setSize(this.W,this.H); this.renderer.setClearColor(0x020c14,1);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none';
    this.scene=new THREE.Scene(); this.scene.fog=new THREE.Fog(0x020c14,60,200);
    this.camera=new THREE.PerspectiveCamera(48,this.W/this.H,0.1,500);
    this.camera.position.set(14,10,22);
    this.controls=new THREE.OrbitControls(this.camera,this.renderer.domElement);
    Object.assign(this.controls,{enableDamping:true,dampingFactor:.08,screenSpacePanning:true,minDistance:2,maxDistance:140});
    this.scene.add(new THREE.AmbientLight(0xffffff,.55));
    const dl=new THREE.DirectionalLight(0xffffff,.8); dl.position.set(10,20,12); this.scene.add(dl);
    this.group=new THREE.Group(); this.scene.add(this.group);
    this.track=null; this.auto=false; this.raf=0; this.live=!opt.static; this.home=null; this.bounds=null;
    if(this.live) this._loop();
  }
  clear(){
    const g=this.group;
    g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material){ (o.material.map)&&o.material.map.dispose(); o.material.dispose(); } });
    while(g.children.length) g.remove(g.children[0]);
  }
  frame(w,h,d){
    this.bounds={w,h,d};
    const T3=T(); const r=Math.max(w,h,d);
    this.controls.target.set(w/2,h*.4,d/2);
    this.camera.position.set(w*.5+r*.38, h*.8+r*.26, d/2+r*.92);
    this.camera.far=Math.max(500,r*10); this.camera.updateProjectionMatrix();
    this.scene.fog.near=r*2.2; this.scene.fog.far=r*7;
    this.home={p:this.camera.position.clone(),t:this.controls.target.clone()};
    this.controls.update();
  }
  resetView(){ if(!this.home) return; this.camera.position.copy(this.home.p); this.controls.target.copy(this.home.t); this.controls.update(); this.track=null; }
  dolly(f){ const t=this.controls.target; this.camera.position.lerp(t,f>0?0.22:-0.28); this.controls.update(); }
  toggleAuto(){ this.auto=!this.auto; this.controls.autoRotate=this.auto; this.controls.autoRotateSpeed=1.4; return this.auto; }
  toggleTrack(){
    if(this.track){ this.track=null; return false; }
    if(!this.bounds) return false;
    this.track={x:0,speed:this.bounds.w/(11*60)}; // ~11 s end to end
    const dx=-this.controls.target.x; this.camera.position.x+=dx; this.controls.target.x+=dx; return true;
  }
  resize(){
    const w=this.host.clientWidth, h=this.host.clientHeight; if(!w||!h) return;
    this.W=w; this.H=h; this.renderer.setSize(w,h); this.camera.aspect=w/h; this.camera.updateProjectionMatrix();
  }
  render(){ this.controls.update(); this.renderer.render(this.scene,this.camera); }
  _loop(){
    const step=()=>{
      this.raf=requestAnimationFrame(step);
      if(!this.host.offsetParent) return;                 // hidden → idle
      if(this.track){
        const b=this.bounds, dx=this.track.speed;
        this.camera.position.x+=dx; this.controls.target.x+=dx;
        if(this.controls.target.x>b.w){ const back=-b.w; this.camera.position.x+=back; this.controls.target.x+=back; }
      }
      this.render();
    };
    step();
  }
  dispose(){ cancelAnimationFrame(this.raf); this.clear(); this.controls.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}

/* ── shared helpers ───────────────────────────────────────────── */
function floor(g, w, d, y){
  const THREE=T(); const grid=new THREE.GridHelper(Math.max(w,d)*1.0, Math.round(Math.max(w,d)), 0x0b4a5c, 0x083140);
  grid.position.set(w/2,y||0,d/2); grid.scale.set(w/Math.max(w,d),1,d/Math.max(w,d)); g.add(grid);
}
function tube(pts, color, r, opacity){
  const THREE=T(); const curve=new THREE.CatmullRomCurve3(pts);
  const geo=new THREE.TubeGeometry(curve,Math.max(8,pts.length*2),r,8,false);
  return new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:col(color),emissive:col(color),emissiveIntensity:.55,roughness:.4,transparent:opacity<1,opacity:opacity||1}));
}
function curtain(pts, color, y0, opacity){
  const THREE=T(); const pos=[]; const idx=[];
  pts.forEach((p,i)=>{ pos.push(p.x,p.y,p.z, p.x,y0,p.z); if(i){ const a=(i-1)*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); } });
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:col(color),transparent:true,opacity:opacity||.12,side:THREE.DoubleSide,depthWrite:false}));
}
function dot(p,color,r){ const THREE=T(); const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),new THREE.MeshStandardMaterial({color:col(color),emissive:col(color),emissiveIntensity:.7})); m.position.copy(p); return m; }
function norm(vals){ const f=vals.filter(isFinite); const lo=Math.min(...f), hi=Math.max(...f); return {lo,hi,rng:(hi-lo)||1}; }
const fmt = v => (root.fmt?root.fmt(v,3):String(v));

/* ── builders ─────────────────────────────────────────────────── */
// Long-range trajectory: lane per stock, grey = original propagation, colour = condition-refined,
// green spheres = qualified bulge years, small red = held years
function buildTrajectory(v, stocks, yrS, yrE){
  const THREE=T(); v.clear(); const W=24, H=9, LANE=5, D=Math.max(LANE*stocks.length,LANE);
  floor(v.group,W,D,0);
  stocks.forEach((sl,i)=>{
    const base=sl.result._base||[], ref=sl.result._ref?sl.result._ref.pts:base, flags=sl.result._ref?sl.result._ref.flags:[];
    if(!base.length) return;
    const z=LANE*(i+.5); const nz=norm(base.map(p=>p.val).concat(ref.map(p=>p.val)));
    const P=arr=>arr.map((p,k)=>new THREE.Vector3(k/(arr.length-1)*W,(p.val-nz.lo)/nz.rng*H,z));
    const pb=P(base), pr=P(ref);
    v.group.add(tube(pb,'#7a8c94',.05,.55));
    v.group.add(tube(pr,sl.color,.11,1));
    v.group.add(curtain(pr,sl.color,0,.13));
    pr.forEach((p,k)=>{ if(k===0) return; const ok=flags[k]?flags[k].ok:true;
      v.group.add(dot(p,ok?'#39ff82':'#ff4060',ok?.16:.09)); });
    const t=label(sl.ticker||('STOCK '+(i+1)),sl.color,1.2); t.position.set(-2.6,H*.5,z); v.group.add(t);
    const lo=label(fmt(nz.lo),'#6fa8b4',.8); lo.position.set(W+2.4,0,z); v.group.add(lo);
    const hi=label(fmt(nz.hi),'#6fa8b4',.8); hi.position.set(W+2.4,H,z); v.group.add(hi);
  });
  const n=Math.min(7,yrE-yrS);
  for(let k=0;k<=n;k++){ const l=label(String(Math.round(yrS+(yrE-yrS)*k/n)),'#8fdfee',.9); l.position.set(k/n*W,-.8,-1.2); v.group.add(l); }
  v.frame(W,H,D);
}
// Geometry bars: x = SMSP/CMSP/RMSP, z = stock
function buildGeo(v, stocks){
  const THREE=T(); v.clear(); const ms=['smsp','cmsp','rmsp'], names=['SMSP²','CMSP³','RMSP∛']; const W=16,H=8,D=Math.max(3*stocks.length,6);
  floor(v.group,W,D,0);
  const mx=Math.max(1,...stocks.flatMap(s=>ms.map(k=>Math.abs(s.result[k])||0)).filter(isFinite));
  ms.forEach((k,mi)=>{
    const l=label(names[mi],'#8fdfee',1.1); l.position.set(2.7+mi*5.3,-.9,-1.3); v.group.add(l);
    stocks.forEach((sl,si)=>{
      const val=Math.abs(sl.result[k])||0, h=Math.max(.05,val/mx*H);
      const m=new THREE.Mesh(new THREE.BoxGeometry(1.5,h,1.5),new THREE.MeshStandardMaterial({color:col(sl.color),emissive:col(sl.color),emissiveIntensity:.35,transparent:true,opacity:.9}));
      m.position.set(2.7+mi*5.3, h/2, 1.5+si*3); v.group.add(m);
      const t=label(fmt(val),'#cce8f0',.7); t.position.set(2.7+mi*5.3,h+.7,1.5+si*3); v.group.add(t);
    });
  });
  stocks.forEach((sl,si)=>{ const t=label(sl.ticker||('S'+(si+1)),sl.color,1); t.position.set(-1.8,.6,1.5+si*3); v.group.add(t); });
  v.frame(W,H,D);
}
// EOD phase curves (uses the 2D chart's current state, handles included)
function buildPhase(v, stocks, yrS, yrE){
  const THREE=T(); v.clear(); if(typeof _phaseDefaultCurves==="undefined"||!_phaseDefaultCurves.length) return;
  const curves = _phaseModified ? _buildModifiedCurves(_phaseStocks, _phaseDefaultCurves) : _phaseDefaultCurves;
  const W=24,H=9,LANE=5,D=LANE*curves.length; floor(v.group,W,D,0);
  const nz=norm(curves.flatMap(c=>c.map(p=>p.v)).concat([0]));
  const y0=(0-nz.lo)/nz.rng*H;
  const zero=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshBasicMaterial({color:0x00e5ff,transparent:true,opacity:.05,side:THREE.DoubleSide,depthWrite:false}));
  zero.rotation.x=-Math.PI/2; zero.position.set(W/2,y0,D/2); v.group.add(zero);
  curves.forEach((c,i)=>{ const z=LANE*(i+.5), sl=_phaseStocks[i];
    const pts=c.map(p=>new THREE.Vector3(p.t*W,(p.v-nz.lo)/nz.rng*H,z));
    v.group.add(tube(pts,sl.color,.1,1)); v.group.add(curtain(pts,sl.color,y0,.14));
    const t=label(sl.ticker||('STOCK '+(i+1)),sl.color,1.2); t.position.set(-2.6,H*.5,z); v.group.add(t);
  });
  const n=Math.min(6,yrE-yrS);
  for(let k=0;k<=n;k++){ const l=label(String(Math.round(yrS+(yrE-yrS)*k/n)),'#8fdfee',.9); l.position.set(k/n*W,-.8,-1.2); v.group.add(l); }
  const zl=label('phase = 0','#00e5ff',.8); zl.position.set(W+2.4,y0,D/2); v.group.add(zl);
  v.frame(W,H,D);
}
// Conditions terrain for one stock: z = day / week / month / year, y = cumulative path of divergences,
// green = bulge qualified period, red = not, (days: gold=even)
function buildLanes(v, cond, color){
  const THREE=T(); v.clear(); if(!cond||!cond.ok) return;
  const W=26,H=6,LANE=5,D=LANE*4; floor(v.group,W,D,0);
  const levels=[
    {n:'DAY',  items:cond.days,  c:d=>d.ride==='high'?'#39ff82':(d.ride==='low'?'#ff4060':'#f0c040')},
    {n:'WEEK', items:cond.weeks, c:w=>w.bulgeOK?'#39ff82':'#ff4060'},
    {n:'MONTH',items:cond.months,c:m=>m.bulgeOK?'#39ff82':'#ff4060'},
    {n:'YEAR', items:cond.years, c:y=>y.bulgeOK?'#39ff82':'#ff4060'}];
  levels.forEach((lv,li)=>{
    const z=LANE*(li+.5); let s=0; const path=lv.items.map(it=>(s+=it.diverge));
    const nz=norm(path.concat([0])); const n=path.length; if(!n) return;
    const pts=path.map((p,k)=>new THREE.Vector3((n>1?k/(n-1):.5)*W,(p-nz.lo)/nz.rng*H,z));
    if(pts.length>1){ const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:col(color||'#00e5ff')})); v.group.add(line); v.group.add(curtain(pts,color||'#00e5ff',0,.10)); }
    const r=n>400?.07:(n>100?.11:.2);
    const geo=new THREE.SphereGeometry(r,8,6), mat=new THREE.MeshBasicMaterial({color:0xffffff});
    const inst=new THREE.InstancedMesh(geo,mat,n); const m4=new THREE.Matrix4();
    pts.forEach((p,k)=>{ m4.setPosition(p); inst.setMatrixAt(k,m4); inst.setColorAt(k,col(lv.c(lv.items[k]))); });
    inst.instanceMatrix.needsUpdate=true; if(inst.instanceColor) inst.instanceColor.needsUpdate=true; v.group.add(inst);
    const t=label(lv.n+' ('+n+')','#8fdfee',1.1); t.position.set(-3,H*.5,z); v.group.add(t);
  });
  v.frame(W,H,D);
}

const BUILD={trajectory:buildTrajectory, geo:buildGeo, phase:buildPhase, lanes:buildLanes};

/* ── UI mount: a 2D | 3D switch + tool buttons for one chart-wrap ── */
const mounts={};
const BTN="font-family:var(--fh);font-size:.36rem;letter-spacing:1.5px;padding:4px 10px;border-radius:4px;cursor:pointer;border:1px solid rgba(0,229,255,.3);background:rgba(0,229,255,.07);color:var(--cyan);transition:all .2s";
function mount(kind, wrapEl, titleEl, getArgs){
  if(!hasGL || !wrapEl || mounts[kind]) return;
  const host=document.createElement('div'); host.className='chart-wrap'; host.style.cssText='display:none;height:'+(kind==='lanes'?'420px':'380px')+';cursor:grab';
  wrapEl.parentNode.insertBefore(host,wrapEl.nextSibling);
  const bar=document.createElement('div'); bar.style.cssText='display:none;gap:6px;flex-wrap:wrap;margin:-10px 0 14px';
  const mk=(txt,fn)=>{ const b=document.createElement('button'); b.style.cssText=BTN; b.textContent=txt; b.onclick=()=>fn(b); bar.appendChild(b); return b; };
  host.parentNode.insertBefore(bar,host.nextSibling);
  const m=mounts[kind]={host,bar,viewer:null,on:false,getArgs,wrap:wrapEl};
  const rebuild=()=>{ if(!m.viewer) return; const a=getArgs(); if(a) BUILD[kind](m.viewer,...a); };
  m.rebuild=rebuild;
  mk('⟲ ORBIT',b=>{ const on=m.viewer.toggleAuto(); b.style.background=on?'rgba(0,229,255,.25)':'rgba(0,229,255,.07)'; });
  mk('⇥ TRACK SHOT',b=>{ const on=m.viewer.toggleTrack(); b.style.background=on?'rgba(0,229,255,.25)':'rgba(0,229,255,.07)'; });
  mk('＋ DOLLY IN',()=>m.viewer.dolly(1)); mk('－ DOLLY OUT',()=>m.viewer.dolly(-1)); mk('⌂ RESET VIEW',()=>m.viewer.resetView());
  const hint=document.createElement('span'); hint.style.cssText='font-family:var(--fc);font-size:.42rem;color:var(--dim);align-self:center'; hint.textContent='drag = orbit · right-drag/2 fingers = pan · wheel/pinch = dolly'; bar.appendChild(hint);
  m.set3D=on=>{
    m.on=on; wrapEl.style.display=on?'none':''; host.style.display=on?'':'none'; bar.style.display=on?'flex':'none';
    if(on){ if(!m.viewer) m.viewer=new Viewer(host); rebuild(); m.viewer.resize(); }
    b2d.style.background=on?'rgba(0,229,255,.07)':'rgba(0,229,255,.25)'; b3d.style.background=on?'rgba(0,229,255,.25)':'rgba(0,229,255,.07)';
  };
  const sw=document.createElement('span'); sw.style.cssText='display:inline-flex;gap:4px;margin-left:auto;flex:none';
  const b2d=document.createElement('button'), b3d=document.createElement('button');
  [[b2d,'2D',false],[b3d,'3D',true]].forEach(([b,t,on])=>{ b.style.cssText=BTN; b.textContent=t; b.onclick=()=>m.set3D(on); sw.appendChild(b); });
  titleEl.appendChild(sw); b2d.style.background='rgba(0,229,255,.25)';
  if(kind==='lanes'){ wrapEl.style.display='none'; m.set3D(true); sw.remove(); }
}
function refresh(){ Object.values(mounts).forEach(m=>{ if(m.on&&m.viewer) m.rebuild(); }); }
window.addEventListener('resize',()=>Object.values(mounts).forEach(m=>m.viewer&&m.viewer.resize()));

/* one-shot offscreen render for the PDF */
function snapshot(kind, args, w, h){
  if(!hasGL) return null;
  const host=document.createElement('div'); host.style.cssText=`position:fixed;left:-9999px;top:0;width:${w}px;height:${h}px`; document.body.appendChild(host);
  let url=null;
  try{
    const v=new Viewer(host,{width:w,height:h,keep:true,static:true,pixelRatio:1});
    BUILD[kind](v,...args); v.render(); url=v.renderer.domElement.toDataURL('image/jpeg',0.86); v.dispose();
  }catch(e){ console.warn('3D snapshot failed',kind,e); }
  host.remove(); return url;
}

root.MC3D={hasGL,Viewer,mount,refresh,snapshot,BUILD,mounts};
})(window);
