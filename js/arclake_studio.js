// arclake_studio_v3.js — ArcLake Studio for Autumn
// Exact visual match to live ArcLake:
//   Nucleus = proton(orange) + neutron(gray) particle clouds
//   Electrons = per-shell colored quantum orbital clouds (30 pts/e default)
//   CFD = atmospheric particle field driven by temp/pressure/wind
// © DART Meadow / Radical Deepscale LLC

(function(global){
'use strict';

// ── Shell colors matching live ArcLake ───────────────────────────────────────
const SHELL_COLORS = [
  [0.0, 0.9, 1.0],   // K  — cyan
  [0.27,0.53,1.0],   // L  — blue
  [0.27,1.0, 0.53],  // M  — green
  [0.0, 1.0, 0.8],   // N  — teal
  [0.0, 0.53,1.0],   // O  — deep blue
  [0.67,0.27,1.0],   // P  — purple
  [0.67,1.0, 0.27],  // Q  — yellow-green
  [1.0, 0.27,0.67],  // R  — pink
];
const PROTON_COLOR  = [1.0, 0.45, 0.1];   // orange
const NEUTRON_COLOR = [0.55,0.55,0.6];     // gray

// ── Shell config: electron shell quantum numbers ─────────────────────────────
const SHELLS = [
  {n:1,l:0,cap:2 }, // K
  {n:2,l:0,cap:2 }, // L
  {n:2,l:1,cap:6 }, // L
  {n:3,l:0,cap:2 }, // M
  {n:3,l:1,cap:6 }, // M
  {n:3,l:2,cap:10}, // M
  {n:4,l:0,cap:2 }, // N
  {n:4,l:1,cap:6 }, // N
];
const SHELL_INDEX = [0,1,1,2,2,2,3,3]; // maps shell entry → color index

// ── Element data ─────────────────────────────────────────────────────────────
const EL = {
  H:{z:1,  e:1,  r:0.25,name:'Hydrogen'},   He:{z:2, e:2, r:0.28,name:'Helium'},
  Li:{z:3, e:3,  r:0.9, name:'Lithium'},    B:{z:5,  e:5, r:0.5, name:'Boron'},
  C:{z:6,  e:6,  r:0.44,name:'Carbon'},     N:{z:7,  e:7, r:0.42,name:'Nitrogen'},
  O:{z:8,  e:8,  r:0.40,name:'Oxygen'},     F:{z:9,  e:9, r:0.38,name:'Fluorine'},
  Na:{z:11,e:11, r:1.0, name:'Sodium'},     Mg:{z:12,e:12,r:0.86,name:'Magnesium'},
  Al:{z:13,e:13, r:0.76,name:'Aluminium'},  Si:{z:14,e:14,r:0.70,name:'Silicon'},
  P:{z:15, e:15, r:0.66,name:'Phosphorus'}, S:{z:16, e:16,r:0.64,name:'Sulfur'},
  Cl:{z:17,e:17, r:0.62,name:'Chlorine'},   Ca:{z:20,e:20,r:1.14,name:'Calcium'},
  Fe:{z:26,e:26, r:0.78,name:'Iron'},       Ni:{z:28,e:28,r:0.76,name:'Nickel'},
  Cu:{z:29,e:29, r:0.78,name:'Copper'},     Zn:{z:30,e:30,r:0.74,name:'Zinc'},
  Ti:{z:22,e:22, r:0.88,name:'Titanium'},   Cr:{z:24,e:24,r:1.0, name:'Chromium'},
  Co:{z:27,e:27, r:0.76,name:'Cobalt'},     Mo:{z:42,e:42,r:0.94,name:'Molybdenum'},
  Ta:{z:73,e:73, r:0.88,name:'Tantalum'},   W:{z:74, e:74,r:0.84,name:'Tungsten'},
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

// ── Wavefunction radial sampling (simplified rejection) ───────────────────────
function _gamma(n){let r=1;for(let i=2;i<n;i++)r*=i;return Math.max(r,1e-30);}
function _laguerre(k,a,x){if(k<=0)return 1;if(k===1)return 1+a-x;let a0=1,a1=1+a-x,v=a1;for(let j=2;j<=k;j++){v=((2*j-1+a-x)*a1-(j-1+a)*a0)/j;a0=a1;a1=v;}return a1;}
const A0=0.529177;

function _sampleR(n,l){
  const rMax=14*n*n*A0;
  for(let i=0;i<300;i++){
    const r=Math.random()*rMax;
    const rho=2*r/(n*A0),k=n-l-1,al=2*l+1;
    const L=_laguerre(k,al,rho);
    const nm=Math.pow(2/(n*A0),3)*_gamma(n-l)/(2*n*Math.max(_gamma(n+l+1),1e-30));
    const R=Math.sqrt(Math.max(0,nm))*Math.exp(-rho/2)*Math.pow(Math.max(rho,1e-9),l)*L;
    const prob=r*r*R*R;
    const peak=Math.exp(-2/n)*4*Math.pow(2/n,2);
    if(Math.random()*peak*2<prob) return r;
  }
  return n*n*A0*(0.5+Math.random()*0.5);
}

// ── Build nucleus particle cloud ──────────────────────────────────────────────
// Protons = orange, neutrons = gray, packed in tight Fibonacci sphere
function _nucleusCloud(T, el, cx, cy, cz){
  const protons  = el.z;
  const neutrons = Math.round(el.z * 1.25); // approx
  const total    = protons + neutrons;
  const pos=new Float32Array(total*3);
  const col=new Float32Array(total*3);
  const nucR = Math.max(0.08, el.r * 0.12); // nucleus much smaller than atom

  // Fibonacci sphere packing for nucleus
  const phi = Math.PI*(3-Math.sqrt(5));
  for(let i=0;i<total;i++){
    const y  = 1-(i/(total-1||1))*2;
    const r2 = Math.sqrt(Math.max(0,1-y*y));
    const th = phi*i;
    const nr = nucR*(0.7+Math.random()*0.3);
    pos[i*3]  =cx+Math.cos(th)*r2*nr;
    pos[i*3+1]=cy+y*nr;
    pos[i*3+2]=cz+Math.sin(th)*r2*nr;
    const c = i<protons ? PROTON_COLOR : NEUTRON_COLOR;
    const bright=0.8+Math.random()*0.2;
    col[i*3]=c[0]*bright; col[i*3+1]=c[1]*bright; col[i*3+2]=c[2]*bright;
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.BufferAttribute(pos,3));
  geo.setAttribute('color',   new T.BufferAttribute(col,3));
  const mat=new T.PointsMaterial({size:0.025,vertexColors:true,transparent:true,opacity:1.0,sizeAttenuation:true,depthWrite:false});
  return new T.Points(geo,mat);
}

// ── Build electron shell clouds ───────────────────────────────────────────────
function _electronClouds(T, el, cx, cy, cz, ptsPerE){
  const meshes=[];
  let rem=el.e;
  for(let si=0;si<SHELLS.length&&rem>0;si++){
    const shell=SHELLS[si];
    const n=Math.min(rem,shell.cap);
    rem-=n;
    const total=n*ptsPerE;
    if(total<=0) continue;

    const pos=new Float32Array(total*3);
    const col=new Float32Array(total*3);
    const sc = SHELL_COLORS[Math.min(SHELL_INDEX[si],SHELL_COLORS.length-1)];
    const scale=1.0+shell.n*0.9; // shell radius scaling

    for(let p=0;p<total;p++){
      const r=_sampleR(shell.n,shell.l)*scale;
      const theta=Math.acos(2*Math.random()-1);
      const phi=Math.random()*Math.PI*2;
      pos[p*3]  =cx+r*Math.sin(theta)*Math.cos(phi);
      pos[p*3+1]=cy+r*Math.sin(theta)*Math.sin(phi);
      pos[p*3+2]=cz+r*Math.cos(theta);
      const bright=0.55+Math.random()*0.45;
      col[p*3]=sc[0]*bright; col[p*3+1]=sc[1]*bright; col[p*3+2]=sc[2]*bright;
    }

    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.BufferAttribute(pos,3));
    geo.setAttribute('color',   new T.BufferAttribute(col,3));
    const mat=new T.PointsMaterial({size:0.028,vertexColors:true,transparent:true,opacity:0.75,sizeAttenuation:true,depthWrite:false});
    const points=new T.Points(geo,mat);
    // Store original positions for physics
    points.userData.origPos=Float32Array.from(pos);
    points.userData.cx=cx; points.userData.cy=cy; points.userData.cz=cz;
    meshes.push(points);
  }
  return meshes;
}

// ── State ─────────────────────────────────────────────────────────────────────
let S=null;
function _dispose(){if(!S)return;if(S.raf)cancelAnimationFrame(S.raf);if(S.ro)S.ro.disconnect();if(S.renderer)S.renderer.dispose();S=null;}

// ── Init ──────────────────────────────────────────────────────────────────────
function _initScene(canvas){
  const T=window.THREE;
  if(!T||!canvas)return null;
  const W=canvas.clientWidth||380, H=canvas.clientHeight||260;
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(W,H,false);
  renderer.setClearColor(0x04070e,1);

  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(50,W/H,0.01,100000);
  camera.position.set(0,3,14);
  scene.add(new T.AmbientLight(0x334466,1.2));
  const d1=new T.DirectionalLight(0x00e5ff,1.5); d1.position.set(8,12,10); scene.add(d1);
  const d2=new T.DirectionalLight(0x7c4dff,0.5); d2.position.set(-8,-4,-8); scene.add(d2);

  let controls=null;
  if(T.OrbitControls){
    controls=new T.OrbitControls(camera,canvas);
    controls.enableDamping=true; controls.dampingFactor=0.08;
    controls.minDistance=1; controls.maxDistance=80;
    controls.enableZoom=true; controls.enablePan=true; controls.enableRotate=true;
    canvas.addEventListener('touchstart',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
  }

  // CFD atmospheric particles
  const NCFD=1000;
  const cfdGeo=new T.BufferGeometry();
  const cfdPos=new Float32Array(NCFD*3);
  const cfdCol=new Float32Array(NCFD*3);
  for(let i=0;i<NCFD;i++){cfdPos[i*3]=(_r()-0.5)*22;cfdPos[i*3+1]=(_r()-0.5)*22;cfdPos[i*3+2]=(_r()-0.5)*22;cfdCol[i*3]=0;cfdCol[i*3+1]=0.9;cfdCol[i*3+2]=1;}
  cfdGeo.setAttribute('position',new T.BufferAttribute(cfdPos,3));
  cfdGeo.setAttribute('color',   new T.BufferAttribute(cfdCol,3));
  const cfdMat=new T.PointsMaterial({size:0.055,vertexColors:true,transparent:true,opacity:0.25,sizeAttenuation:true,depthWrite:false});
  const cfdPts=new T.Points(cfdGeo,cfdMat);
  scene.add(cfdPts);
  const cfdVel=new Float32Array(NCFD*3);

  return {T,renderer,scene,camera,controls,canvas,cfdPts,cfdGeo,cfdPos,cfdVel,cfdCol,NCFD,
    atoms:[],isSimulating:false,recordedFrames:[],simTime:0,
    params:{temp:25,pressure:101325,windX:0,windY:0,windZ:0,ptsPerE:150}};
}

function _r(){return Math.random();}

// ── Build molecule ─────────────────────────────────────────────────────────────
function _build(state,atomDefs,ptsPerE){
  const T=state.T;
  // Remove old
  state.atoms.forEach(a=>{
    state.scene.remove(a.nucleus);
    a.eClouds.forEach(m=>state.scene.remove(m));
    a.bonds&&a.bonds.forEach(m=>state.scene.remove(m));
  });
  state.atoms=[];

  atomDefs.forEach((def,i)=>{
    const sym=def.s||def.sym||'C';
    const el=EL[sym]||EL.C;
    const [cx,cy,cz]=def.p||[0,0,0];

    const nucleus=_nucleusCloud(T,el,cx,cy,cz);
    state.scene.add(nucleus);

    const eClouds=_electronClouds(T,el,cx,cy,cz,ptsPerE);
    eClouds.forEach(m=>state.scene.add(m));

    state.atoms.push({
      nucleus,eClouds,el,
      defP:[cx,cy,cz], origP:[cx,cy,cz],
      vel:new T.Vector3((_r()-.5)*2e-4,(_r()-.5)*2e-4,(_r()-.5)*2e-4),
      phase:_r()*Math.PI*2, phaseDrift:0.005+_r()*0.005
    });
  });

  // Bonds
  for(let i=0;i<state.atoms.length;i++){
    for(let j=i+1;j<state.atoms.length;j++){
      const a=state.atoms[i],b=state.atoms[j];
      const dist=Math.hypot(a.defP[0]-b.defP[0],a.defP[1]-b.defP[1],a.defP[2]-b.defP[2]);
      if(dist<(a.el.r+b.el.r)*3.5){
        const av=new T.Vector3(...a.defP), bv=new T.Vector3(...b.defP);
        const dir=new T.Vector3().subVectors(bv,av);
        const len=dir.length();
        const geo=new T.CylinderGeometry(0.03,0.03,len,8,1);
        const mat=new T.MeshBasicMaterial({color:0x334466,transparent:true,opacity:0.4});
        const mesh=new T.Mesh(geo,mat);
        mesh.position.copy(new T.Vector3().addVectors(av,bv).multiplyScalar(0.5));
        mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());
        state.scene.add(mesh);
        if(!a.bonds)a.bonds=[];
        a.bonds.push(mesh);
      }
    }
  }
  state.simTime=0; state.recordedFrames=[];
}

// ── Simulation step ───────────────────────────────────────────────────────────
function _step(state){
  if(!state.isSimulating)return;
  const T=state.T, p=state.params;
  const tempK=p.temp+273, kT=tempK/6000;
  const wind=new T.Vector3(p.windX,p.windY,p.windZ).multiplyScalar(8e-5);

  state.atoms.forEach(a=>{
    a.vel.x+=(_r()-.5)*kT*0.001; a.vel.y+=(_r()-.5)*kT*0.001; a.vel.z+=(_r()-.5)*kT*0.001;
    a.vel.add(wind); a.vel.multiplyScalar(0.97);
    const spd=a.vel.length(); if(spd>0.1)a.vel.multiplyScalar(0.1/spd);
    a.defP[0]+=a.vel.x; a.defP[1]+=a.vel.y; a.defP[2]+=a.vel.z;
    // Soft restore
    a.defP[0]+=(a.origP[0]-a.defP[0])*0.002;
    a.defP[1]+=(a.origP[1]-a.defP[1])*0.002;
    a.defP[2]+=(a.origP[2]-a.defP[2])*0.002;

    // Move nucleus
    a.nucleus.position.set(a.defP[0],a.defP[1],a.defP[2]);

    // Move+rotate electron clouds
    a.phase+=a.phaseDrift*(1+kT*5);
    const scale=1+kT*0.6;
    a.eClouds.forEach((m,si)=>{
      m.position.set(a.defP[0],a.defP[1],a.defP[2]);
      m.rotation.y=a.phase*(1+si*0.3);
      m.rotation.x=a.phase*(0.4+si*0.2);
      m.scale.setScalar(scale);
    });
  });

  // CFD
  const box=11*(101325/Math.max(1,p.pressure));
  const tf=Math.sqrt(tempK/298)*0.013;
  const pos=state.cfdPos,vel=state.cfdVel,col=state.cfdCol;
  for(let i=0;i<state.NCFD;i++){
    vel[i*3  ]+=(p.windX*1.5e-4)+(_r()-.5)*tf;
    vel[i*3+1]+=(p.windY*1.5e-4)+(_r()-.5)*tf;
    vel[i*3+2]+=(p.windZ*1.5e-4)+(_r()-.5)*tf;
    vel[i*3  ]*=0.98;vel[i*3+1]*=0.98;vel[i*3+2]*=0.98;
    pos[i*3  ]+=vel[i*3];pos[i*3+1]+=vel[i*3+1];pos[i*3+2]+=vel[i*3+2];
    for(let ax=0;ax<3;ax++){if(pos[i*3+ax]>box)pos[i*3+ax]=-box;if(pos[i*3+ax]<-box)pos[i*3+ax]=box;}
    col[i*3]  =p.temp>2000?1:p.temp>800?1:0;
    col[i*3+1]=p.temp>2000?.25:p.temp>800?.55:.9;
    col[i*3+2]=p.temp>2000?0:p.temp>800?0:1;
  }
  state.cfdGeo.attributes.position.needsUpdate=true;
  state.cfdGeo.attributes.color.needsUpdate=true;
  state.cfdPts.material.opacity=Math.min(0.45,0.1+p.pressure/500000);

  state.simTime+=1/60;
  if(state.recordedFrames.length<1800)
    state.recordedFrames.push({time:state.simTime,atoms:state.atoms.map(a=>({p:[...a.defP]}))});
}

// ── GLB export ────────────────────────────────────────────────────────────────
async function _exportGLB(state){
  const T=state.T;

  // Load GLTFExporter
  if(!T.GLTFExporter){
    await new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js';
      s.onload=res; s.onerror=rej; document.head.appendChild(s);
    });
  }

  // ── Why InstancedMesh: THREE.Points are NOT valid glTF geometry. ─────────
  // Every particle becomes a tiny sphere instance so Blender/Nomad can read it.
  // Hierarchy per atom:
  //   Atom_Iron_0_Z26  (Group — animates over time)
  //     Nucleus        (Group)
  //       Protons      (InstancedMesh — orange spheres)
  //       Neutrons     (InstancedMesh — gray spheres)
  //     Electrons      (Group)
  //       Shell_K      (Group)
  //         Shell_K_Cloud  (InstancedMesh — cyan)
  //       Shell_L-s    (Group)  ...etc

  const SHELL_COLORS_HEX=[0x00e5ff,0x4488ff,0x44ff88,0x00ffcc,0x0088ff,0xaa44ff,0xaaff44,0xff44aa];
  const SHELL_NAMES=['K','L-s','L-p','M-s','M-p','M-d','N-s','N-p'];

  // Shared sphere geometries (reused across all atoms — reduces file size)
  const sgP = new T.SphereGeometry(0.022, 6, 4); // proton
  const sgN = new T.SphereGeometry(0.019, 6, 4); // neutron
  const sgE = new T.SphereGeometry(0.013, 5, 3); // electron

  const dummy = new T.Object3D();

  // Build InstancedMesh from a BufferAttribute slice
  // Positions in geo are WORLD absolute. groupOrigin is subtracted to make them local.
  function makeIM(posAttr, fromIdx, count, geo, colorHex, name, groupOrigin){
    if(!count) return null;
    const mat = new T.MeshPhongMaterial({color:colorHex, shininess:70, emissive:new T.Color(colorHex).multiplyScalar(0.08)});
    const im = new T.InstancedMesh(geo, mat, count);
    im.name = name;
    const ox=groupOrigin.x, oy=groupOrigin.y, oz=groupOrigin.z;
    for(let i=0;i<count;i++){
      dummy.position.set(
        posAttr.getX(fromIdx+i) - ox,
        posAttr.getY(fromIdx+i) - oy,
        posAttr.getZ(fromIdx+i) - oz
      );
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    return im;
  }

  // ── Build export scene ───────────────────────────────────────────────────
  const exp = new T.Scene();
  exp.add(new T.AmbientLight(0x334466, 0.9));
  const dl1=new T.DirectionalLight(0x00e5ff,1.2); dl1.position.set(5,10,8); exp.add(dl1);
  const dl2=new T.DirectionalLight(0x7c4dff,0.5); dl2.position.set(-5,-4,-8); exp.add(dl2);
  const dl3=new T.DirectionalLight(0xffffff,0.4); dl3.position.set(0,0,15); exp.add(dl3);

  const clips = [];
  const frames = state.recordedFrames;
  const hasAnim = frames.length > 2;

  state.atoms.forEach((atom,ai)=>{
    // ── Atom group — placed at original position, animated to simulated pos ─
    const origP = new T.Vector3(...atom.origP); // original preset position
    const atomGroup = new T.Group();
    atomGroup.name = `Atom_${atom.el.name}_${ai}_Z${atom.el.z}`;
    atomGroup.position.copy(origP);
    exp.add(atomGroup);

    // ── Nucleus group ────────────────────────────────────────────────────
    const nucleusGrp = new T.Group();
    nucleusGrp.name = `Nucleus`;
    atomGroup.add(nucleusGrp);

    const nucPA = atom.nucleus.geometry.attributes.position;
    const nucTotal = nucPA.count;
    const protonCount  = Math.min(atom.el.z, nucTotal);
    const neutronCount = Math.max(0, nucTotal - protonCount);

    // Protons group
    const protGrp = new T.Group(); protGrp.name = 'Protons';
    const pm = makeIM(nucPA, 0, protonCount, sgP, 0xff7022, 'ProtonCloud', origP);
    if(pm) protGrp.add(pm);
    nucleusGrp.add(protGrp);

    // Neutrons group
    const neutGrp = new T.Group(); neutGrp.name = 'Neutrons';
    const nm = makeIM(nucPA, protonCount, neutronCount, sgN, 0x8a8a99, 'NeutronCloud', origP);
    if(nm) neutGrp.add(nm);
    nucleusGrp.add(neutGrp);

    // ── Electrons group ──────────────────────────────────────────────────
    const eGrp = new T.Group();
    eGrp.name = `Electrons`;
    atomGroup.add(eGrp);

    atom.eClouds.forEach((cloud,si)=>{
      const shellGrp = new T.Group();
      shellGrp.name = `Shell_${SHELL_NAMES[si]||si}`;
      eGrp.add(shellGrp);

      const ePA = cloud.geometry.attributes.position;
      const eCount = ePA.count;
      if(!eCount) return;

      const shellColor = SHELL_COLORS_HEX[si % SHELL_COLORS_HEX.length];
      // electron cloud positions include origP + orbital — subtract origP to localise
      const em = makeIM(ePA, 0, eCount, sgE, shellColor,
        `Shell_${SHELL_NAMES[si]||si}_Cloud`, origP);
      if(em) shellGrp.add(em);
    });

    // ── Animation — atom group position keyframes from recorded frames ────
    // Each atom group moves from origP toward defP. Keyframes give Blender
    // the full motion arc so the whole grouped hierarchy animates together.
    if(hasAnim){
      const times = [];
      const positions = [];
      frames.forEach(f=>{
        const d = f.atoms[ai];
        if(d){
          times.push(f.time);
          // Keyframe is the DELTA from origP (since group is placed at origP)
          positions.push(
            d.p[0] - origP.x,
            d.p[1] - origP.y,
            d.p[2] - origP.z
          );
        }
      });
      if(times.length > 1){
        const track = new T.VectorKeyframeTrack(
          atomGroup.name+'.position', times, positions
        );
        clips.push(new T.AnimationClip(`Atom_${atom.el.name}_${ai}_Anim`, -1, [track]));
      }
    }
  });

  exp.updateMatrixWorld(true);

  // Validate scene has real geometry before exporting
  let meshCount=0;
  exp.traverse(o=>{ if(o.isInstancedMesh) meshCount++; });
  if(meshCount===0){
    throw new Error('No geometry found in scene — add atoms first');
  }

  // r128 GLTFExporter.parse() = (scene, onDone, options) — no separate onError arg.
  // Passing 4 args makes arg3 (a function) treated as options → binary:true ignored
  // → callback gets JSON object → Blob = "[object Object]" = 15 bytes. Fixed below.
  return new Promise((resolve,reject)=>{
    try{
      new T.GLTFExporter().parse(
        exp,
        (glb)=>{
          try{
            // Validate — should be ArrayBuffer when binary:true works
            if(!(glb instanceof ArrayBuffer)){
              reject(new Error('GLTFExporter returned non-binary output — Three.js r128 parse() signature mismatch'));
              return;
            }
            if(glb.byteLength<100){
              reject(new Error('GLB near-empty ('+glb.byteLength+' bytes). Add atoms and run simulation first.'));
              return;
            }
            const blob=new Blob([glb],{type:'model/gltf-binary'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;
            a.download='arclake_'+Date.now()+'.glb';
            document.body.appendChild(a); a.click();
            setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},300);
            resolve((glb.byteLength/1024).toFixed(1));
          }catch(e){ reject(e); }
        },
        // OPTIONS as 3rd arg — no 4th arg in r128
        {
          binary:true,
          animations: hasAnim && clips.length ? clips : undefined,
          embedImages: false,
          forceIndices: true,
          truncateDrawRange: false
        }
      );
    }catch(e){ reject(e); }
  });
}

// ── HTML ──────────────────────────────────────────────────────────────────────
global.renderToolsArcLake=function(){
  return`<div id="als-root" style="display:flex;flex-direction:column;height:100%;background:#04070e;color:#e8eaf0;font-family:Orbitron,monospace;overflow:hidden">
  <div style="position:relative;flex:1;min-height:180px;overflow:hidden;background:#04070e">
    <canvas id="als-canvas" style="width:100%;height:100%;display:block;touch-action:none;outline:none" tabindex="0"></canvas>
    <div style="position:absolute;top:8px;left:10px;font-size:8.5px;color:#00e5ff;opacity:.85;line-height:1.9;pointer-events:none">
      <div id="als-hud-s" style="font-weight:700;letter-spacing:1px">&#9679; IDLE</div>
      <div id="als-hud-f">FRAMES: 0</div>
      <div id="als-hud-t">TIME: 0.00s</div>
      <div id="als-hud-e" style="color:#c4a0ff;font-size:8px"></div>
    </div>
    <div style="position:absolute;top:8px;right:8px;display:flex;flex-direction:column;gap:5px;pointer-events:all">
      <button onclick="window._alsStart&&window._alsStart()" title="Start" style="width:30px;height:30px;background:rgba(0,229,255,.15);border:1px solid rgba(0,229,255,.45);color:#00e5ff;border-radius:6px;cursor:pointer;font-size:13px">&#9654;</button>
      <button onclick="window._alsStop&&window._alsStop()"  title="Stop"  style="width:30px;height:30px;background:rgba(255,77,77,.12);border:1px solid rgba(255,77,77,.35);color:#ff4d4d;border-radius:6px;cursor:pointer;font-size:13px">&#9632;</button>
      <button onclick="window._alsExport&&window._alsExport()" title="GLB" style="width:30px;height:30px;background:rgba(124,77,255,.15);border:1px solid rgba(124,77,255,.4);color:#c4a0ff;border-radius:6px;cursor:pointer;font-size:12px">↓</button>
      <button onclick="window._alsFullscreen&&window._alsFullscreen()" title="Expand" style="width:30px;height:30px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#8a8fa8;border-radius:6px;cursor:pointer;font-size:11px">&#x26F6;</button>
      <button onclick="window._alsReset&&window._alsReset()" title="Reset" style="width:30px;height:30px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#555;border-radius:6px;cursor:pointer;font-size:13px">&#x21BA;</button>
    </div>
    <div style="position:absolute;bottom:6px;right:8px;font-size:8.5px;text-align:right;line-height:1.7;pointer-events:none">
      <span id="als-hud-tmp" style="color:#ff6644"></span><br>
      <span id="als-hud-prs" style="color:#7c4dff"></span>
    </div>
  </div>
  <div style="flex-shrink:0;padding:8px 10px 10px;background:rgba(4,7,14,.98);border-top:1px solid rgba(0,229,255,.1);display:flex;flex-direction:column;gap:7px">
    <div style="display:flex;gap:8px;align-items:center">
      <label style="font-size:8.5px;color:#8a8fa8;letter-spacing:1px;white-space:nowrap">SCENE</label>
      <select id="als-preset" onchange="window._alsLoadPreset&&window._alsLoadPreset(this.value)" style="flex:1;background:rgba(0,229,255,.07);border:1px solid rgba(0,229,255,.22);color:#e8eaf0;padding:5px 8px;border-radius:6px;font-size:9.5px;font-family:inherit;cursor:pointer">
        ${PRESET_KEYS.map(k=>`<option value="${k}">${k}</option>`).join('')}
        <option value="__custom">Custom elements...</option>
      </select>
      <label style="font-size:8px;color:#8a8fa8;white-space:nowrap">pts/e&#x207B;</label>
      <input id="als-pte" type="number" min="5" max="200" value="30" onchange="window._alsSetPtsPerE&&window._alsSetPtsPerE(+this.value)" style="width:44px;background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);color:#e8eaf0;padding:4px;border-radius:5px;font-size:9px;font-family:inherit">
    </div>
    <div id="als-custom-row" style="display:none;gap:6px;align-items:center">
      <input id="als-custom-in" placeholder="Fe,Cu,Ni or elements..." style="flex:1;background:rgba(124,77,255,.07);border:1px solid rgba(124,77,255,.28);color:#e8eaf0;padding:5px 8px;border-radius:6px;font-size:9.5px;font-family:inherit" onkeydown="if(event.key==='Enter')window._alsParseCustom&&window._alsParseCustom()">
      <button onclick="window._alsParseCustom&&window._alsParseCustom()" style="background:rgba(124,77,255,.18);border:1px solid rgba(124,77,255,.38);color:#c4a0ff;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:9px;font-family:inherit">BUILD</button>
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
      <button onclick="window._alsStart&&window._alsStart()" style="flex:1;background:rgba(0,229,255,.12);border:1px solid rgba(0,229,255,.35);color:#00e5ff;padding:7px;border-radius:8px;cursor:pointer;font-size:9.5px;font-family:inherit;font-weight:700">&#9654; SIMULATE</button>
      <button onclick="window._alsStop&&window._alsStop()"   style="flex:1;background:rgba(255,77,77,.1);border:1px solid rgba(255,77,77,.3);color:#ff4d4d;padding:7px;border-radius:8px;cursor:pointer;font-size:9.5px;font-family:inherit">&#9632; STOP</button>
      <button id="als-btn-glb" onclick="window._alsExport&&window._alsExport()" style="flex:1;background:rgba(124,77,255,.12);border:1px solid rgba(124,77,255,.3);color:#c4a0ff;padding:7px;border-radius:8px;cursor:pointer;font-size:9.5px;font-family:inherit">↓ GLB</button>
      <button onclick="window._alsReset&&window._alsReset()" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#555;padding:7px 10px;border-radius:8px;cursor:pointer;font-size:11px;font-family:inherit">&#x21BA;</button>
    </div>
    <div id="als-status" style="font-size:8.5px;color:#8a8fa8;text-align:center;min-height:13px"></div>
  </div>
</div>`;
};

// ── Mount ─────────────────────────────────────────────────────────────────────
global._alsMounted=function(){
  _dispose();
  const canvas=document.getElementById('als-canvas');
  if(!canvas)return;
  const cont=canvas.parentElement;

  const resize=()=>{
    const W=cont.offsetWidth||380, H=Math.max(160,cont.offsetHeight||240);
    canvas.width=W*(window.devicePixelRatio||1); canvas.height=H*(window.devicePixelRatio||1);
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    if(S&&S.renderer){S.renderer.setSize(W,H,false);S.camera.aspect=W/H;S.camera.updateProjectionMatrix();}
  };
  resize();
  S=_initScene(canvas);
  if(!S)return;
  _build(S,PRESETS[PRESET_KEYS[0]],150);

  function _loop(){
    S.raf=requestAnimationFrame(_loop);
    _step(S);
    if(S.controls)S.controls.update();
    S.renderer.render(S.scene,S.camera);
    const totalE=S.atoms.reduce((a,ag)=>a+(ag.el.e||0),0);
    const hs=document.getElementById('als-hud-s');
    const hf=document.getElementById('als-hud-f');
    const ht=document.getElementById('als-hud-t');
    const he=document.getElementById('als-hud-e');
    const htmp=document.getElementById('als-hud-tmp');
    const hprs=document.getElementById('als-hud-prs');
    if(hs)hs.innerHTML=S.isSimulating?'&#9679; SIMULATING':'&#9679; IDLE';
    if(hf)hf.textContent='FRAMES: '+S.recordedFrames.length;
    if(ht)ht.textContent='TIME: '+S.simTime.toFixed(2)+'s';
    if(he)he.textContent='e\u207B: '+(totalE*S.params.ptsPerE).toLocaleString()+' pts';
    if(htmp)htmp.textContent=S.params.temp+'°C';
    if(hprs)hprs.textContent=S.params.pressure+' Pa';
  }
  _loop();
  S.ro=new ResizeObserver(resize);
  S.ro.observe(cont);
};

// ── API ───────────────────────────────────────────────────────────────────────
global._alsLoadPreset=function(key){
  const row=document.getElementById('als-custom-row');
  if(key==='__custom'){if(row)row.style.display='flex';return;}
  if(row)row.style.display='none';
  if(!S||!PRESETS[key])return;
  S.isSimulating=false;
  const pte=S.params.ptsPerE||150;
  _build(S,PRESETS[key],pte);
  const el=document.getElementById('als-preset');
  if(el)el.value=key;
  const totalE=S.atoms.reduce((a,ag)=>a+(ag.el.e||0),0);
  document.getElementById('als-status').textContent=key+' — '+S.atoms.length+' atoms, '+totalE+' e\u207B, '+(totalE*pte).toLocaleString()+' waveform particles';
};

global._alsParseCustom=function(){
  const raw=(document.getElementById('als-custom-in')||{}).value||'';
  if(!S||!raw.trim())return;
  const syms=raw.split(',').map(s=>s.trim()).map(s=>s.charAt(0).toUpperCase()+s.slice(1).toLowerCase()).filter(s=>EL[s]);
  if(!syms.length){document.getElementById('als-status').textContent='Unknown elements. Try: Fe,Cu,Ni';return;}
  const defs=syms.map((s,i)=>{const a=(i/syms.length)*Math.PI*2,r2=syms.length>1?2.8:0;return{s,p:[Math.cos(a)*r2,0,Math.sin(a)*r2]};});
  S.isSimulating=false;
  _build(S,defs,S.params.ptsPerE||150);
  document.getElementById('als-status').textContent='Custom: '+syms.join(', ');
};

global._alsSetPtsPerE=function(n){
  if(!S)return;
  S.params.ptsPerE=Math.max(5,Math.min(500,n||150));
  const key=(document.getElementById('als-preset')||{}).value||PRESET_KEYS[0];
  if(PRESETS[key])_build(S,PRESETS[key],S.params.ptsPerE);
};

global._alsUpdateParam=function(key,val){
  if(!S)return;
  S.params[key]=val;
  const map={temp:['als-temp-v','°C','#ff6644'],pressure:['als-pres-v',' Pa','#7c4dff'],windX:['als-wx-v',' m/s','#00e5ff'],windY:['als-wy-v',' m/s','#00e5ff']};
  if(map[key]){const el=document.getElementById(map[key][0]);if(el){el.textContent=val+map[key][1];el.style.color=map[key][2];}}
};

global._alsStart=function(){if(!S)return;S.isSimulating=true;document.getElementById('als-status').textContent='Simulation running — recording waveform frames...';};
global._alsStop =function(){if(!S)return;S.isSimulating=false;document.getElementById('als-status').textContent='Stopped. '+S.recordedFrames.length+' frames. Ready for GLB export.';};
global._alsReset=function(){
  if(!S)return;S.isSimulating=false;
  const key=(document.getElementById('als-preset')||{}).value||PRESET_KEYS[0];
  if(PRESETS[key])_build(S,PRESETS[key],S.params.ptsPerE||150);
  document.getElementById('als-status').textContent='Scene reset.';
};

global._alsExport=async function(){
  if(!S)return;
  const btn=document.getElementById('als-btn-glb');
  if(btn)btn.textContent='&#x23F3; BUILDING...';
  document.getElementById('als-status').textContent='Building GLB with animation data...';
  try{await _exportGLB(S);document.getElementById('als-status').textContent='GLB downloaded.';}
  catch(e){document.getElementById('als-status').textContent='Export error: '+e.message;}
  if(btn)btn.textContent='↓ GLB';
};

global._alsFullscreen=function(){
  const ex=document.getElementById('als-fs-ov');
  if(ex){ex.remove();return;}
  const ov=document.createElement('div');
  ov.id='als-fs-ov';
  ov.style.cssText='position:fixed;inset:0;z-index:99998;background:#04070e;display:flex;';
  const cb=document.createElement('button');
  cb.innerHTML='&#x2715; CLOSE';
  cb.style.cssText='position:absolute;top:12px;right:12px;z-index:99999;background:rgba(255,77,77,.15);border:1px solid rgba(255,77,77,.35);color:#ff4d4d;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:Orbitron,monospace;font-size:11px';
  cb.onclick=()=>ov.remove();
  ov.appendChild(cb);
  const fc=document.createElement('canvas');fc.id='als-fs-c';fc.style.cssText='width:100%;height:100%;display:block;touch-action:none';
  ov.appendChild(fc);document.body.appendChild(ov);
  requestAnimationFrame(()=>{
    const W=ov.offsetWidth,H=ov.offsetHeight;
    fc.width=W*(window.devicePixelRatio||1);fc.height=H*(window.devicePixelRatio||1);
    fc.style.width=W+'px';fc.style.height=H+'px';
    if(S&&window.THREE){
      if(S.raf)cancelAnimationFrame(S.raf);
      if(S.controls)S.controls.dispose();
      S.renderer.dispose();
      const T=window.THREE;
      const r2=new T.WebGLRenderer({canvas:fc,antialias:true,alpha:false});
      r2.setPixelRatio(Math.min(window.devicePixelRatio||1,2));r2.setSize(W,H,false);r2.setClearColor(0x04070e,1);
      S.renderer=r2;S.camera.aspect=W/H;S.camera.updateProjectionMatrix();
      if(T.OrbitControls){S.controls=new T.OrbitControls(S.camera,fc);S.controls.enableDamping=true;S.controls.dampingFactor=0.08;}
      function _fl(){if(!document.getElementById('als-fs-ov'))return;S.raf=requestAnimationFrame(_fl);_step(S);if(S.controls)S.controls.update();S.renderer.render(S.scene,S.camera);}
      _fl();
    }
  });
};

})(typeof window!=='undefined'?window:global);
