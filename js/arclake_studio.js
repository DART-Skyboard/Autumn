// arclake_studio_v2.js — ArcLake Studio for Autumn
// Waveform particle simulation — 30 particles/electron, full CFD, compound physics
// Adapted from ArcLake (DART-Skyboard/Ariel) © DART Meadow / Radical Deepscale LLC

(function(global){
'use strict';

// ── Bohr radius and quantum math (simplified CDF sampling) ──────────────────
const A0 = 0.529177;

function _gamma(n){
  if(n<=1)return 1; let r=1;
  for(let i=2;i<n;i++) r*=i; return r;
}
function _assocLaguerre(k,alpha,rho){
  if(k<=0)return 1; if(k===1)return 1+alpha-rho;
  let a=1,b=1+alpha-rho,c=b;
  for(let j=2;j<=k;j++){c=((2*j-1+alpha-rho)*b-(j-1+alpha)*a)/j;a=b;b=c;} return b;
}

// Sample a radius from hydrogen-like radial wavefunction P(r)∝r²|R_nl|²
function _sampleOrbitalRadius(n,l,rng){
  const rMax=12*n*n*A0;
  // Rejection sampling — fast enough for 30 pts
  for(let attempt=0;attempt<200;attempt++){
    const r=rng()*rMax;
    const rho=2*r/(n*A0),k=n-l-1,alpha=2*l+1;
    const L=_assocLaguerre(k,alpha,rho);
    const norm=Math.pow(2/(n*A0),3)*_gamma(n-l)/(2*n*Math.max(_gamma(n+l+1),1e-10));
    const R=Math.sqrt(Math.max(0,norm))*Math.exp(-rho/2)*Math.pow(rho||1e-9,l)*L;
    const prob=r*r*R*R;
    // Approximate max (use first shell peak at a0)
    const peak=Math.exp(-2/(n))*Math.pow(2/n,2*l+2)*4;
    if(rng()*peak*1.5<prob) return r;
  }
  return n*n*A0*(0.5+rng()*0.5);
}

// ── Electron orbital shell config (quantum numbers n,l per shell) ──────────
// Shells by period: K(n=1,l=0), L(n=2,l=0,1), M(n=3,l=0,1,2)...
const SHELL_QN = [
  {n:1,l:0,cap:2},  // K
  {n:2,l:0,cap:2},  // L-s
  {n:2,l:1,cap:6},  // L-p
  {n:3,l:0,cap:2},  // M-s
  {n:3,l:1,cap:6},  // M-p
  {n:3,l:2,cap:10}, // M-d
  {n:4,l:0,cap:2},  // N-s
  {n:4,l:1,cap:6},  // N-p
];

function _buildShells(electrons){
  const shells=[]; let rem=electrons;
  for(const q of SHELL_QN){
    if(rem<=0) break;
    const n=Math.min(rem,q.cap);
    shells.push({...q, count:n});
    rem-=n;
  }
  return shells;
}

// ── Element data ─────────────────────────────────────────────────────────────
const EL = {
  H:  {z:1,  e:1,  r:0.53, color:[1,1,1],       name:'Hydrogen'},
  He: {z:2,  e:2,  r:0.31, color:[0.85,1,1],     name:'Helium'},
  Li: {z:3,  e:3,  r:1.52, color:[0.8,0.5,1],    name:'Lithium'},
  B:  {z:5,  e:5,  r:0.87, color:[1,0.71,0.71],  name:'Boron'},
  C:  {z:6,  e:6,  r:0.77, color:[0.56,0.56,0.56],name:'Carbon'},
  N:  {z:7,  e:7,  r:0.75, color:[0.19,0.31,0.97],name:'Nitrogen'},
  O:  {z:8,  e:8,  r:0.73, color:[1,0.05,0.05],   name:'Oxygen'},
  F:  {z:9,  e:9,  r:0.71, color:[0.56,0.88,0.31],name:'Fluorine'},
  Na: {z:11, e:11, r:1.86, color:[0.67,0.36,0.95],name:'Sodium'},
  Mg: {z:12, e:12, r:1.60, color:[0.54,1,0],      name:'Magnesium'},
  Al: {z:13, e:13, r:1.43, color:[0.75,0.65,0.65],name:'Aluminium'},
  Si: {z:14, e:14, r:1.17, color:[0.94,0.78,0.63],name:'Silicon'},
  P:  {z:15, e:15, r:1.10, color:[1,0.50,0],      name:'Phosphorus'},
  S:  {z:16, e:16, r:1.04, color:[1,1,0.19],      name:'Sulfur'},
  Cl: {z:17, e:17, r:0.99, color:[0.12,0.94,0.12],name:'Chlorine'},
  Ca: {z:20, e:20, r:1.97, color:[0.24,1,0],      name:'Calcium'},
  Fe: {z:26, e:26, r:1.26, color:[0.88,0.40,0.20],name:'Iron'},
  Ni: {z:28, e:28, r:1.25, color:[0.31,0.82,0.31],name:'Nickel'},
  Cu: {z:29, e:29, r:1.28, color:[0.78,0.50,0.20],name:'Copper'},
  Zn: {z:30, e:30, r:1.22, color:[0.49,0.50,0.69],name:'Zinc'},
  Ti: {z:22, e:22, r:1.47, color:[0.75,0.76,0.78],name:'Titanium'},
  Cr: {z:24, e:24, r:1.66, color:[0.54,0.60,0.78],name:'Chromium'},
  Co: {z:27, e:27, r:1.25, color:[0.94,0.56,0.63],name:'Cobalt'},
  Mo: {z:42, e:42, r:1.54, color:[0.33,0.71,0.71],name:'Molybdenum'},
  Ta: {z:73, e:73, r:1.46, color:[0.30,0.65,1],   name:'Tantalum'},
  W:  {z:74, e:74, r:1.39, color:[0.13,0.58,0.84],name:'Tungsten'},
};

// ── Compound presets ──────────────────────────────────────────────────────────
const PRESETS = {
  'Water (H₂O)':           [{s:'O',p:[0,0,0]},{s:'H',p:[-0.96,0.77,0]},{s:'H',p:[0.96,0.77,0]}],
  'CO₂':                   [{s:'C',p:[0,0,0]},{s:'O',p:[-1.16,0,0]},{s:'O',p:[1.16,0,0]}],
  'NaCl (Salt)':           [{s:'Na',p:[0,0,0]},{s:'Cl',p:[2.81,0,0]}],
  'Iron + Copper Alloy':   [{s:'Fe',p:[0,0,0]},{s:'Fe',p:[2.5,0,0]},{s:'Cu',p:[1.25,2.5,0]},{s:'Cu',p:[1.25,-2.5,0]}],
  'Steel (Fe+C+Cr)':       [{s:'Fe',p:[0,0,0]},{s:'Fe',p:[2.87,0,0]},{s:'C',p:[1.43,2.0,0]},{s:'Cr',p:[1.43,-2.0,0]},{s:'C',p:[-1.43,0,2.0]}],
  'Titanium Alloy (Ti+Al)':[{s:'Ti',p:[0,0,0]},{s:'Ti',p:[3.2,0,0]},{s:'Al',p:[1.6,2.8,0]},{s:'Al',p:[1.6,-2.8,0]},{s:'Ti',p:[1.6,0,2.8]}],
  'Hercules Alloy (6-el)': [{s:'Ti',p:[0,0,0]},{s:'W',p:[3.5,0,0]},{s:'Mo',p:[-3.5,0,0]},{s:'Ta',p:[0,3.5,0]},{s:'Co',p:[0,-3.5,0]},{s:'Ni',p:[0,0,3.5]}],
  'Calcium Carbonate':     [{s:'Ca',p:[0,0,0]},{s:'C',p:[2.4,0,0]},{s:'O',p:[3.6,0,0]},{s:'O',p:[1.8,1.2,0]},{s:'O',p:[1.8,-1.2,0]}],
  'Copper Oxide (CuO)':    [{s:'Cu',p:[0,0,0]},{s:'O',p:[1.85,0,0]}],
  'Silicon Dioxide':       [{s:'Si',p:[0,0,0]},{s:'O',p:[1.63,0,0]},{s:'O',p:[-1.63,0,0]}],
};

const PRESET_KEYS = Object.keys(PRESETS);

// ── Global state ──────────────────────────────────────────────────────────────
let S = null;

function _dispose(){
  if(!S) return;
  if(S.raf) cancelAnimationFrame(S.raf);
  if(S.ro) S.ro.disconnect();
  if(S.renderer){ S.renderer.dispose(); }
  S = null;
}

function _rng(){ return Math.random(); }

// ── Init Three.js scene ───────────────────────────────────────────────────────
function _initScene(canvas){
  const T = window.THREE;
  if(!T || !canvas) return null;

  const W = canvas.clientWidth  || canvas.offsetWidth  || 380;
  const H = canvas.clientHeight || canvas.offsetHeight || 280;

  const renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x04070e, 1);
  renderer.shadowMap.enabled = false;

  const scene  = new T.Scene();
  const camera = new T.PerspectiveCamera(50, W/H, 0.01, 500);
  camera.position.set(0, 4, 18);
  camera.lookAt(0,0,0);

  // Lights
  scene.add(new T.AmbientLight(0x223355, 1.0));
  const sun = new T.DirectionalLight(0x00e5ff, 1.8);
  sun.position.set(8, 12, 10); scene.add(sun);
  const fill = new T.DirectionalLight(0x7c4dff, 0.6);
  fill.position.set(-8, -4, -8); scene.add(fill);

  // OrbitControls — proper mobile touch support
  let controls = null;
  if(T.OrbitControls){
    controls = new T.OrbitControls(camera, canvas);
    controls.enableDamping    = true;
    controls.dampingFactor    = 0.08;
    controls.enableZoom       = true;
    controls.enablePan        = true;
    controls.enableRotate     = true;
    controls.touches = {
      ONE: T.TOUCH ? T.TOUCH.ROTATE : 0,
      TWO: T.TOUCH ? T.TOUCH.DOLLY_PAN : 1
    };
    controls.minDistance = 2;
    controls.maxDistance = 80;
    // Mobile: prevent canvas from eating scroll events
    canvas.addEventListener('touchstart', e => { if(e.touches.length > 1) e.preventDefault(); }, {passive:false});
  }

  // CFD particle field (atmospheric simulation)
  const NCFD = 1200;
  const cfdGeo = new T.BufferGeometry();
  const cfdPos = new Float32Array(NCFD*3);
  const cfdCol = new Float32Array(NCFD*3);
  for(let i=0;i<NCFD;i++){
    cfdPos[i*3]   = (_rng()-0.5)*24;
    cfdPos[i*3+1] = (_rng()-0.5)*24;
    cfdPos[i*3+2] = (_rng()-0.5)*24;
    cfdCol[i*3]=0; cfdCol[i*3+1]=0.9; cfdCol[i*3+2]=1;
  }
  cfdGeo.setAttribute('position',new T.BufferAttribute(cfdPos,3));
  cfdGeo.setAttribute('color',   new T.BufferAttribute(cfdCol,3));
  const cfdMat = new T.PointsMaterial({size:0.06,vertexColors:true,transparent:true,opacity:0.3,sizeAttenuation:true,depthWrite:false});
  const cfdPoints = new T.Points(cfdGeo, cfdMat);
  scene.add(cfdPoints);
  const cfdVel = new Float32Array(NCFD*3);
  for(let i=0;i<NCFD;i++){
    cfdVel[i*3]   = (_rng()-0.5)*0.005;
    cfdVel[i*3+1] = (_rng()-0.5)*0.005;
    cfdVel[i*3+2] = (_rng()-0.5)*0.005;
  }

  return {
    T, renderer, scene, camera, controls, canvas,
    cfdPoints, cfdGeo, cfdPos, cfdVel, cfdCol, NCFD,
    atomGroups: [],    // array of {mesh, electronClouds, vel, def, el}
    bondMeshes: [],
    isSimulating: false,
    recordedFrames: [], simTime: 0,
    params: {temp:25, pressure:101325, windX:0, windY:0, windZ:0, ptsPerE:30}
  };
}

// ── Build electron point cloud for one atom ───────────────────────────────────
function _buildElectronCloud(T, el, center, ptsPerE){
  const shells = _buildShells(el.e);
  const allPos = [];
  const allCol = [];

  // Base electron color: complement of nucleus color + luminance
  const [nr,ng,nb] = el.color;
  const er = Math.min(1, ng*0.6 + nb*0.4 + 0.3);
  const eg = Math.min(1, nr*0.3 + nb*0.6 + 0.3);
  const eb = Math.min(1, nr*0.4 + ng*0.3 + 0.7);

  for(const shell of shells){
    const scale = 1.2 + shell.n * 0.8; // scale orbital radii to visible range
    for(let ei=0; ei<shell.count; ei++){
      for(let p=0; p<ptsPerE; p++){
        // Sample orbital radius
        const r = _sampleOrbitalRadius(shell.n, shell.l, _rng) * scale;
        // Random direction on sphere
        const theta = Math.acos(2*_rng()-1);
        const phi   = _rng()*Math.PI*2;
        allPos.push(
          center[0] + r*Math.sin(theta)*Math.cos(phi),
          center[1] + r*Math.sin(theta)*Math.sin(phi),
          center[2] + r*Math.cos(theta)
        );
        // Vary brightness by shell distance
        const bright = 0.6 + 0.4*_rng();
        allCol.push(er*bright, eg*bright, eb*bright);
      }
    }
  }

  if(!allPos.length) return null;
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(new Float32Array(allPos),3));
  geo.setAttribute('color',    new T.BufferAttribute(new Float32Array(allCol),3));
  const mat = new T.PointsMaterial({
    size:0.045, vertexColors:true, transparent:true, opacity:0.75,
    sizeAttenuation:true, depthWrite:false
  });
  return new T.Points(geo, mat);
}

// ── Build nucleus mesh ────────────────────────────────────────────────────────
function _buildNucleus(T, el, center){
  const r = Math.max(0.18, el.r * 0.28);
  const geo = new T.SphereGeometry(r, 20, 16);
  const [cr,cg,cb] = el.color;
  const mat = new T.MeshPhongMaterial({
    color: new T.Color(cr,cg,cb),
    emissive: new T.Color(cr*0.2, cg*0.2, cb*0.2),
    shininess: 80, transparent:false
  });
  const mesh = new T.Mesh(geo, mat);
  mesh.position.set(...center);
  return mesh;
}

// ── Bond cylinder ─────────────────────────────────────────────────────────────
function _addBond(T, scene, a, b, list){
  const av = new T.Vector3(...a), bv = new T.Vector3(...b);
  const dir = new T.Vector3().subVectors(bv, av);
  const len = dir.length();
  const mid = new T.Vector3().addVectors(av, bv).multiplyScalar(0.5);
  const geo = new T.CylinderGeometry(0.04, 0.04, len, 8, 1);
  const mat = new T.MeshPhongMaterial({color:0x334466, transparent:true, opacity:0.5});
  const mesh = new T.Mesh(geo, mat);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), dir.normalize());
  scene.add(mesh); list.push(mesh);
}

// ── Build full molecule ───────────────────────────────────────────────────────
function _buildMolecule(state, atomDefs, ptsPerE){
  const T = state.T;
  // Clear previous
  state.atomGroups.forEach(ag => {
    state.scene.remove(ag.nucleus);
    if(ag.eCloud) state.scene.remove(ag.eCloud);
  });
  state.bondMeshes.forEach(m => state.scene.remove(m));
  state.atomGroups = []; state.bondMeshes = [];

  atomDefs.forEach((def, i) => {
    const sym = def.s || def.sym || 'C';
    const el  = EL[sym] || EL.C;
    const pos = def.p || def.pos || [0,0,0];

    const nucleus = _buildNucleus(T, el, pos);
    state.scene.add(nucleus);

    const eCloud = _buildElectronCloud(T, el, pos, ptsPerE||30);
    if(eCloud) state.scene.add(eCloud);

    state.atomGroups.push({
      nucleus, eCloud, el, def:{s:sym,p:[...pos]},
      origPos:[...pos],
      vel: new T.Vector3((_rng()-0.5)*0.0002,(_rng()-0.5)*0.0002,(_rng()-0.5)*0.0002),
      ePhase: _rng()*Math.PI*2,
      ePhaseDrift: 0.008+_rng()*0.004
    });
  });

  // Bonds
  for(let i=0;i<state.atomGroups.length;i++){
    for(let j=i+1;j<state.atomGroups.length;j++){
      const a=state.atomGroups[i], b=state.atomGroups[j];
      const dist=Math.hypot(
        a.def.p[0]-b.def.p[0], a.def.p[1]-b.def.p[1], a.def.p[2]-b.def.p[2]
      );
      const bondLen=(a.el.r+b.el.r)*3.2;
      if(dist<bondLen) _addBond(T,state.scene,a.def.p,b.def.p,state.bondMeshes);
    }
  }
  state.simTime = 0;
  state.recordedFrames = [];
}

// ── Simulation step ───────────────────────────────────────────────────────────
function _simStep(state){
  if(!state.isSimulating) return;
  const T    = state.T;
  const p    = state.params;
  const tempK= p.temp + 273;
  const kT   = tempK/6000;
  const wind = new T.Vector3(p.windX, p.windY, p.windZ).multiplyScalar(0.00008);

  // Atom nucleus physics
  state.atomGroups.forEach(ag => {
    // Thermal random motion
    ag.vel.x += (_rng()-0.5)*kT*0.001;
    ag.vel.y += (_rng()-0.5)*kT*0.001;
    ag.vel.z += (_rng()-0.5)*kT*0.001;
    ag.vel.add(wind);
    ag.vel.multiplyScalar(0.97);
    // Clamp
    const spd = ag.vel.length();
    if(spd>0.12) ag.vel.multiplyScalar(0.12/spd);
    // Move
    ag.nucleus.position.add(ag.vel);
    // Soft restore to original position
    const orig = new T.Vector3(...ag.origPos);
    ag.nucleus.position.lerp(orig, 0.0015);
    // Update def.p for bond rebuilding
    ag.def.p[0]=ag.nucleus.position.x;
    ag.def.p[1]=ag.nucleus.position.y;
    ag.def.p[2]=ag.nucleus.position.z;

    // Rotate electron cloud + drift phase
    ag.ePhase += ag.ePhaseDrift * (1 + kT*4);
    if(ag.eCloud){
      ag.eCloud.position.copy(ag.nucleus.position);
      ag.eCloud.rotation.y = ag.ePhase;
      ag.eCloud.rotation.x = ag.ePhase*0.43;
      // Scale cloud by temperature (thermal expansion)
      const tempScale = 1 + kT * 0.8;
      ag.eCloud.scale.setScalar(tempScale);
    }
  });

  // Rebuild bonds each frame (atoms move)
  state.bondMeshes.forEach(m => state.scene.remove(m));
  state.bondMeshes = [];
  for(let i=0;i<state.atomGroups.length;i++){
    for(let j=i+1;j<state.atomGroups.length;j++){
      const a=state.atomGroups[i], b=state.atomGroups[j];
      const dist=Math.hypot(
        a.def.p[0]-b.def.p[0], a.def.p[1]-b.def.p[1], a.def.p[2]-b.def.p[2]
      );
      const bondLen=(a.el.r+b.el.r)*4.5;
      if(dist<bondLen) _addBond(T,state.scene,a.def.p,b.def.p,state.bondMeshes);
    }
  }

  // CFD particle field physics
  const pressBox = 12 * (101325/Math.max(1,p.pressure));
  const tempFactor = Math.sqrt(tempK/298)*0.015;
  const pos=state.cfdPos, vel=state.cfdVel, col=state.cfdCol;
  for(let i=0;i<state.NCFD;i++){
    vel[i*3]   += (p.windX*0.00015) + (_rng()-0.5)*tempFactor;
    vel[i*3+1] += (p.windY*0.00015) + (_rng()-0.5)*tempFactor;
    vel[i*3+2] += (p.windZ*0.00015) + (_rng()-0.5)*tempFactor;
    // Damping
    vel[i*3]*=0.98; vel[i*3+1]*=0.98; vel[i*3+2]*=0.98;
    pos[i*3]  +=vel[i*3];
    pos[i*3+1]+=vel[i*3+1];
    pos[i*3+2]+=vel[i*3+2];
    // Wrap
    for(let ax=0;ax<3;ax++){
      if(pos[i*3+ax]>pressBox)  pos[i*3+ax]=-pressBox;
      if(pos[i*3+ax]<-pressBox) pos[i*3+ax]= pressBox;
    }
    // Color by temperature
    const hot=p.temp>800, vhot=p.temp>2000;
    col[i*3]   = vhot?1:hot?1:0;
    col[i*3+1] = vhot?0.3:hot?0.6:0.9;
    col[i*3+2] = vhot?0:hot?0:1;
  }
  state.cfdGeo.attributes.position.needsUpdate=true;
  state.cfdGeo.attributes.color.needsUpdate=true;
  state.cfdPoints.material.opacity = Math.min(0.5, 0.15 + p.pressure/600000);
  state.cfdPoints.material.size    = Math.max(0.04, 0.12 - p.pressure/2000000);

  // Record frame
  state.simTime += 1/60;
  if(state.recordedFrames.length < 1800){
    state.recordedFrames.push({
      time: state.simTime,
      atoms: state.atomGroups.map(ag=>({pos:[...ag.def.p]}))
    });
  }
}

// ── GLB Export ────────────────────────────────────────────────────────────────
async function _exportGLB(state){
  const T = state.T;
  if(!T.GLTFExporter){
    await new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js';
      s.onload=res; s.onerror=rej;
      document.head.appendChild(s);
    });
  }
  const exp = new T.Scene();
  exp.add(new T.AmbientLight(0x334466,0.8));

  // Atoms
  state.atomGroups.forEach((ag,i)=>{
    const g=new T.Group(); g.name=`Atom_${ag.el.name}_${i}`;
    g.add(ag.nucleus.clone());
    if(ag.eCloud){ const ec=ag.eCloud.clone(); ec.name=`eCloud_${i}`; g.add(ec); }
    exp.add(g);
  });

  // Build animation clips
  const clips = [];
  const frames = state.recordedFrames;
  if(frames.length > 2){
    const times = frames.map(f=>f.time);
    state.atomGroups.forEach((ag,ai)=>{
      const positions=[];
      frames.forEach(f=>{ const d=f.atoms[ai]; if(d) positions.push(d.pos[0],d.pos[1],d.pos[2]); });
      if(positions.length){
        const name=`Atom_${ag.el.name}_${ai}`;
        clips.push(new T.AnimationClip(name+'_Anim',-1,[
          new T.VectorKeyframeTrack(name+'.position',times,positions)
        ]));
      }
    });
  }

  exp.updateMatrixWorld(true);
  return new Promise((res,rej)=>{
    new T.GLTFExporter().parse(exp,glb=>{
      const blob=new Blob([glb],{type:'model/gltf-binary'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url; a.download=`arclake_${Date.now()}.glb`; a.click();
      URL.revokeObjectURL(url); res(true);
    },err=>rej(err),{binary:true, animations:clips.length?clips:undefined});
  });
}

// ── Render HTML ───────────────────────────────────────────────────────────────
global.renderToolsArcLake = function(){
  return `<div id="als-root" style="display:flex;flex-direction:column;height:100%;background:#04070e;color:#e8eaf0;font-family:Orbitron,monospace;overflow:hidden">
  <div style="position:relative;flex:1;min-height:180px;overflow:hidden">
    <canvas id="als-canvas" style="width:100%;height:100%;display:block;touch-action:none;outline:none" tabindex="0"></canvas>
    <div style="position:absolute;top:8px;left:10px;font-size:8.5px;color:#00e5ff;opacity:0.85;line-height:1.9;pointer-events:none">
      <div id="als-hud-s" style="font-weight:700;letter-spacing:1px">&#9679; IDLE</div>
      <div id="als-hud-f">FRAMES: 0</div>
      <div id="als-hud-t">TIME: 0.00s</div>
      <div id="als-hud-e" style="color:#c4a0ff"></div>
    </div>
    <div style="position:absolute;top:8px;right:8px;display:flex;flex-direction:column;gap:5px;pointer-events:all">
      <button onclick="window._alsStart&&window._alsStart()" title="Start" style="width:30px;height:30px;background:rgba(0,229,255,0.15);border:1px solid rgba(0,229,255,0.45);color:#00e5ff;border-radius:6px;cursor:pointer;font-size:13px">&#9654;</button>
      <button onclick="window._alsStop&&window._alsStop()"  title="Stop"  style="width:30px;height:30px;background:rgba(255,77,77,0.12);border:1px solid rgba(255,77,77,0.35);color:#ff4d4d;border-radius:6px;cursor:pointer;font-size:13px">&#9632;</button>
      <button onclick="window._alsExport&&window._alsExport()" title="Export GLB" style="width:30px;height:30px;background:rgba(124,77,255,0.15);border:1px solid rgba(124,77,255,0.4);color:#c4a0ff;border-radius:6px;cursor:pointer;font-size:12px">&#x2B07;</button>
      <button onclick="window._alsFullscreen&&window._alsFullscreen()" title="Expand" style="width:30px;height:30px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#8a8fa8;border-radius:6px;cursor:pointer;font-size:11px">&#x26F6;</button>
      <button onclick="window._alsReset&&window._alsReset()" title="Reset" style="width:30px;height:30px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#555;border-radius:6px;cursor:pointer;font-size:13px">&#x21BA;</button>
    </div>
    <div style="position:absolute;bottom:6px;right:8px;font-size:8.5px;text-align:right;line-height:1.7;pointer-events:none">
      <span id="als-hud-tmp" style="color:#ff6644"></span><br>
      <span id="als-hud-prs" style="color:#7c4dff"></span>
    </div>
  </div>
  <div style="flex-shrink:0;padding:8px 10px 10px;background:rgba(4,7,14,0.98);border-top:1px solid rgba(0,229,255,0.1);display:flex;flex-direction:column;gap:7px">
    <div style="display:flex;gap:8px;align-items:center">
      <label style="font-size:8.5px;color:#8a8fa8;letter-spacing:1px;white-space:nowrap">SCENE</label>
      <select id="als-preset" onchange="window._alsLoadPreset&&window._alsLoadPreset(this.value)" style="flex:1;background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.22);color:#e8eaf0;padding:5px 8px;border-radius:6px;font-size:9.5px;font-family:inherit;cursor:pointer">
        ${PRESET_KEYS.map(k=>`<option value="${k}">${k}</option>`).join('')}
        <option value="__custom">Custom elements...</option>
      </select>
      <label style="font-size:8px;color:#8a8fa8;white-space:nowrap">pts/e&#x207B;</label>
      <input id="als-pte" type="number" min="5" max="100" value="30" onchange="window._alsSetPtsPerE&&window._alsSetPtsPerE(+this.value)" style="width:42px;background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.2);color:#e8eaf0;padding:4px;border-radius:5px;font-size:9px;font-family:inherit">
    </div>
    <div id="als-custom-row" style="display:none;gap:6px;align-items:center">
      <input id="als-custom-in" placeholder="Fe,Cu,Ni or describe compound..." style="flex:1;background:rgba(124,77,255,0.07);border:1px solid rgba(124,77,255,0.28);color:#e8eaf0;padding:5px 8px;border-radius:6px;font-size:9.5px;font-family:inherit" onkeydown="if(event.key==='Enter')window._alsParseCustom&&window._alsParseCustom()">
      <button onclick="window._alsParseCustom&&window._alsParseCustom()" style="background:rgba(124,77,255,0.18);border:1px solid rgba(124,77,255,0.38);color:#c4a0ff;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:9px;font-family:inherit">BUILD</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <div><label style="font-size:8px;color:#8a8fa8;letter-spacing:1px">TEMP (°C)</label>
        <input id="als-temp" type="range" min="-273" max="3500" value="25" step="1" oninput="window._alsUpdateParam&&window._alsUpdateParam('temp',+this.value)" style="width:100%;accent-color:#ff6644;margin-top:2px">
        <span id="als-temp-v" style="font-size:8.5px;color:#ff6644">25°C</span></div>
      <div><label style="font-size:8px;color:#8a8fa8;letter-spacing:1px">PRESSURE (Pa)</label>
        <input id="als-pres" type="range" min="0" max="500000" value="101325" step="100" oninput="window._alsUpdateParam&&window._alsUpdateParam('pressure',+this.value)" style="width:100%;accent-color:#7c4dff;margin-top:2px">
        <span id="als-pres-v" style="font-size:8.5px;color:#7c4dff">101325 Pa</span></div>
      <div><label style="font-size:8px;color:#8a8fa8;letter-spacing:1px">WIND X (m/s)</label>
        <input id="als-wx" type="range" min="-200" max="200" value="0" step="1" oninput="window._alsUpdateParam&&window._alsUpdateParam('windX',+this.value)" style="width:100%;accent-color:#00e5ff;margin-top:2px">
        <span id="als-wx-v" style="font-size:8.5px;color:#00e5ff">0 m/s</span></div>
      <div><label style="font-size:8px;color:#8a8fa8;letter-spacing:1px">WIND Y (m/s)</label>
        <input id="als-wy" type="range" min="-200" max="200" value="0" step="1" oninput="window._alsUpdateParam&&window._alsUpdateParam('windY',+this.value)" style="width:100%;accent-color:#00e5ff;margin-top:2px">
        <span id="als-wy-v" style="font-size:8.5px;color:#00e5ff">0 m/s</span></div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button id="als-btn-s" onclick="window._alsStart&&window._alsStart()" style="flex:1;background:rgba(0,229,255,0.12);border:1px solid rgba(0,229,255,0.35);color:#00e5ff;padding:7px;border-radius:8px;cursor:pointer;font-size:9.5px;font-family:inherit;font-weight:700">&#9654; SIMULATE</button>
      <button onclick="window._alsStop&&window._alsStop()" style="flex:1;background:rgba(255,77,77,0.1);border:1px solid rgba(255,77,77,0.3);color:#ff4d4d;padding:7px;border-radius:8px;cursor:pointer;font-size:9.5px;font-family:inherit">&#9632; STOP</button>
      <button id="als-btn-glb" onclick="window._alsExport&&window._alsExport()" style="flex:1;background:rgba(124,77,255,0.12);border:1px solid rgba(124,77,255,0.3);color:#c4a0ff;padding:7px;border-radius:8px;cursor:pointer;font-size:9.5px;font-family:inherit">&#x2B07; GLB</button>
      <button onclick="window._alsReset&&window._alsReset()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#555;padding:7px 10px;border-radius:8px;cursor:pointer;font-size:11px;font-family:inherit">&#x21BA;</button>
    </div>
    <div id="als-status" style="font-size:8.5px;color:#8a8fa8;text-align:center;min-height:13px"></div>
  </div>
</div>`;
};

// ── Mount ─────────────────────────────────────────────────────────────────────
global._alsMounted = function(){
  _dispose();
  const canvas = document.getElementById('als-canvas');
  if(!canvas){ console.warn('[ArcLake] canvas not found'); return; }
  const container = canvas.parentElement;

  // Set canvas size explicitly
  const setSize = () => {
    const W = container.offsetWidth  || 380;
    const H = Math.max(160, container.offsetHeight || 240);
    canvas.width  = W * (window.devicePixelRatio||1);
    canvas.height = H * (window.devicePixelRatio||1);
    canvas.style.width  = W+'px';
    canvas.style.height = H+'px';
    if(S && S.renderer){
      S.renderer.setSize(W, H, false);
      S.camera.aspect = W/H;
      S.camera.updateProjectionMatrix();
      if(S.controls) S.controls.update();
    }
  };
  setSize();

  S = _initScene(canvas);
  if(!S){ document.getElementById('als-status').textContent='THREE.js not ready'; return; }
  S.params.ptsPerE = 30;

  // Load default preset
  _buildMolecule(S, PRESETS[PRESET_KEYS[0]], 30);

  // Animation loop
  function _loop(){
    S.raf = requestAnimationFrame(_loop);
    if(S.isSimulating) _simStep(S);
    if(S.controls) S.controls.update();
    S.renderer.render(S.scene, S.camera);
    // HUD
    const hs=document.getElementById('als-hud-s');
    const hf=document.getElementById('als-hud-f');
    const ht=document.getElementById('als-hud-t');
    const he=document.getElementById('als-hud-e');
    const htmp=document.getElementById('als-hud-tmp');
    const hprs=document.getElementById('als-hud-prs');
    if(hs) hs.textContent = S.isSimulating ? '&#9679; SIMULATING' : '&#9679; IDLE';
    if(hf) hf.textContent = 'FRAMES: '+S.recordedFrames.length;
    if(ht) ht.textContent = 'TIME: '+S.simTime.toFixed(2)+'s';
    if(he && S.atomGroups.length){
      const totalE=S.atomGroups.reduce((a,ag)=>a+ag.el.e,0);
      he.textContent='e&#x207B;: '+(totalE*S.params.ptsPerE).toLocaleString()+' pts';
    }
    if(htmp) htmp.textContent = S.params.temp+'°C';
    if(hprs) hprs.textContent = S.params.pressure+' Pa';
  }
  _loop();

  // Resize observer
  S.ro = new ResizeObserver(setSize);
  S.ro.observe(container);
};

// ── API ───────────────────────────────────────────────────────────────────────
global._alsLoadPreset = function(key){
  const row=document.getElementById('als-custom-row');
  if(key==='__custom'){ if(row) row.style.display='flex'; return; }
  if(row) row.style.display='none';
  if(!S) return;
  S.isSimulating=false;
  const pte=S.params.ptsPerE||30;
  const defs=PRESETS[key];
  if(!defs){ document.getElementById('als-status').textContent='Preset not found: '+key; return; }
  _buildMolecule(S, defs, pte);
  const el=document.getElementById('als-preset');
  if(el) el.value=key;
  const totalE=S.atomGroups.reduce((a,ag)=>a+(ag.el.e||0),0);
  document.getElementById('als-status').textContent=key+' — '+S.atomGroups.length+' atoms, '+totalE+' electrons, '+(totalE*pte).toLocaleString()+' waveform particles';
};

global._alsParseCustom = function(){
  const raw=(document.getElementById('als-custom-in')||{}).value||'';
  if(!S||!raw.trim()) return;
  const syms=raw.split(',').map(s=>s.trim()).map(s=>s.charAt(0).toUpperCase()+s.slice(1).toLowerCase()).filter(s=>EL[s]);
  if(!syms.length){ document.getElementById('als-status').textContent='Unknown elements. Try: Fe,Cu,Ni'; return; }
  const defs=syms.map((s,i)=>{
    const angle=(i/syms.length)*Math.PI*2;
    const r2=syms.length>1?2.8:0;
    return {s,p:[Math.cos(angle)*r2,0,Math.sin(angle)*r2]};
  });
  S.isSimulating=false;
  _buildMolecule(S, defs, S.params.ptsPerE||30);
  document.getElementById('als-status').textContent='Custom: '+syms.join(', ');
};

global._alsSetPtsPerE = function(n){
  if(!S) return;
  S.params.ptsPerE=Math.max(5,Math.min(100,n||30));
  const key=(document.getElementById('als-preset')||{}).value||PRESET_KEYS[0];
  if(PRESETS[key]) _buildMolecule(S,PRESETS[key],S.params.ptsPerE);
};

global._alsUpdateParam = function(key,val){
  if(!S) return;
  S.params[key]=val;
  const map={temp:['als-temp-v','°C','#ff6644'],pressure:['als-pres-v',' Pa','#7c4dff'],windX:['als-wx-v',' m/s','#00e5ff'],windY:['als-wy-v',' m/s','#00e5ff']};
  if(map[key]){ const el=document.getElementById(map[key][0]); if(el){el.textContent=val+map[key][1]; el.style.color=map[key][2];} }
};

global._alsStart = function(){
  if(!S) return;
  S.isSimulating=true;
  document.getElementById('als-status').textContent='Simulation running — recording waveform frames...';
};

global._alsStop = function(){
  if(!S) return;
  S.isSimulating=false;
  document.getElementById('als-status').textContent='Stopped. '+S.recordedFrames.length+' frames. Ready for GLB export.';
};

global._alsReset = function(){
  if(!S) return;
  S.isSimulating=false;
  const key=(document.getElementById('als-preset')||{}).value||PRESET_KEYS[0];
  if(PRESETS[key]) _buildMolecule(S,PRESETS[key],S.params.ptsPerE||30);
  document.getElementById('als-status').textContent='Scene reset.';
};

global._alsExport = async function(){
  if(!S) return;
  const btn=document.getElementById('als-btn-glb');
  if(btn) btn.textContent='&#x23F3; BUILDING...';
  document.getElementById('als-status').textContent='Building GLB with waveform animation data...';
  try{
    await _exportGLB(S);
    document.getElementById('als-status').textContent='GLB downloaded — '+S.recordedFrames.length+' animation frames.';
  }catch(e){
    document.getElementById('als-status').textContent='Export error: '+e.message;
  }
  if(btn) btn.textContent='&#x2B07; GLB';
};

global._alsFullscreen = function(){
  const ex=document.getElementById('als-fs-overlay');
  if(ex){ ex.remove(); if(S) _alsMounted_target('als-canvas'); return; }

  const ov=document.createElement('div');
  ov.id='als-fs-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:99998;background:#04070e;display:flex;align-items:stretch;justify-content:stretch';

  const closeBtn=document.createElement('button');
  closeBtn.innerHTML='&#x2715; CLOSE';
  closeBtn.style.cssText='position:absolute;top:12px;right:12px;z-index:99999;background:rgba(255,77,77,0.15);border:1px solid rgba(255,77,77,0.35);color:#ff4d4d;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:Orbitron,monospace;font-size:11px';
  closeBtn.onclick=()=>{ ov.remove(); };
  ov.appendChild(closeBtn);

  const fsCanvas=document.createElement('canvas');
  fsCanvas.id='als-fs-canvas';
  fsCanvas.style.cssText='width:100%;height:100%;display:block;touch-action:none';
  ov.appendChild(fsCanvas);
  document.body.appendChild(ov);

  requestAnimationFrame(()=>{
    const W=ov.offsetWidth, H=ov.offsetHeight;
    fsCanvas.width=W*(window.devicePixelRatio||1);
    fsCanvas.height=H*(window.devicePixelRatio||1);
    fsCanvas.style.width=W+'px'; fsCanvas.style.height=H+'px';
    if(S && window.THREE){
      if(S.raf) cancelAnimationFrame(S.raf);
      if(S.controls) S.controls.dispose();
      S.renderer.dispose();
      const T=window.THREE;
      const r2=new T.WebGLRenderer({canvas:fsCanvas,antialias:true,alpha:false});
      r2.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
      r2.setSize(W,H,false); r2.setClearColor(0x04070e,1);
      S.renderer=r2;
      S.camera.aspect=W/H; S.camera.updateProjectionMatrix();
      if(T.OrbitControls){
        S.controls=new T.OrbitControls(S.camera,fsCanvas);
        S.controls.enableDamping=true; S.controls.dampingFactor=0.08;
      }
      function _fsLoop(){
        if(!document.getElementById('als-fs-overlay')){ return; }
        S.raf=requestAnimationFrame(_fsLoop);
        if(S.isSimulating) _simStep(S);
        if(S.controls) S.controls.update();
        S.renderer.render(S.scene,S.camera);
      }
      _fsLoop();
    }
  });
};

})(typeof window!=='undefined'?window:global);
