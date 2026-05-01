// ArcLake Studio — Autumn Tools Module
// Three.js r128 molecular physics visualizer with GLB export
// Adapted from ArcLake (DART-Skyboard/Ariel)

(function(){
'use strict';

// ── Periodic table: element data for molecule construction ─────────────────
const ELEMENTS = {
  H:  {z:1,  r:0.31, color:0xffffff, mass:1.008,  name:'Hydrogen'},
  He: {z:2,  r:0.28, color:0xd9ffff, mass:4.003,  name:'Helium'},
  Li: {z:3,  r:1.28, color:0xcc80ff, mass:6.941,  name:'Lithium'},
  B:  {z:5,  r:0.84, color:0xffb5b5, mass:10.81,  name:'Boron'},
  C:  {z:6,  r:0.77, color:0x909090, mass:12.01,  name:'Carbon'},
  N:  {z:7,  r:0.75, color:0x3050f8, mass:14.01,  name:'Nitrogen'},
  O:  {z:8,  r:0.73, color:0xff0d0d, mass:16.00,  name:'Oxygen'},
  F:  {z:9,  r:0.71, color:0x90e050, mass:19.00,  name:'Fluorine'},
  Na: {z:11, r:1.66, color:0xab5cf2, mass:22.99,  name:'Sodium'},
  Mg: {z:12, r:1.41, color:0x8aff00, mass:24.31,  name:'Magnesium'},
  Al: {z:13, r:1.21, color:0xbfa6a6, mass:26.98,  name:'Aluminium'},
  Si: {z:14, r:1.11, color:0xf0c8a0, mass:28.09,  name:'Silicon'},
  P:  {z:15, r:1.07, color:0xff8000, mass:30.97,  name:'Phosphorus'},
  S:  {z:16, r:1.05, color:0xffff30, mass:32.07,  name:'Sulfur'},
  Cl: {z:17, r:1.02, color:0x1ff01f, mass:35.45,  name:'Chlorine'},
  Ca: {z:20, r:1.76, color:0x3dff00, mass:40.08,  name:'Calcium'},
  Fe: {z:26, r:1.26, color:0xe06633, mass:55.85,  name:'Iron'},
  Ni: {z:28, r:1.24, color:0x50d050, mass:58.69,  name:'Nickel'},
  Cu: {z:29, r:1.28, color:0xc88033, mass:63.55,  name:'Copper'},
  Zn: {z:30, r:1.22, color:0x7d80b0, mass:65.39,  name:'Zinc'},
  Ti: {z:22, r:1.45, color:0xbfc2c7, mass:47.87,  name:'Titanium'},
  Cr: {z:24, r:1.66, color:0x8a99c7, mass:52.00,  name:'Chromium'},
  Co: {z:27, r:1.25, color:0xf090a0, mass:58.93,  name:'Cobalt'},
  Mo: {z:42, r:1.54, color:0x54b5b5, mass:95.96,  name:'Molybdenum'},
  Ta: {z:73, r:1.46, color:0x4da6ff, mass:180.9,  name:'Tantalum'},
  W:  {z:74, r:1.39, color:0x2194d6, mass:183.8,  name:'Tungsten'},
};

// ── Preset molecule/alloy compositions ──────────────────────────────────────
const PRESETS = {
  'Water (H₂O)':          [{sym:'O',pos:[0,0,0]},{sym:'H',pos:[-0.96,0.4,0]},{sym:'H',pos:[0.96,0.4,0]}],
  'CO₂':                  [{sym:'C',pos:[0,0,0]},{sym:'O',pos:[-1.16,0,0]},{sym:'O',pos:[1.16,0,0]}],
  'NaCl (Salt)':          [{sym:'Na',pos:[0,0,0]},{sym:'Cl',pos:[2.5,0,0]}],
  'Iron + Copper Alloy':  [{sym:'Fe',pos:[0,0,0]},{sym:'Fe',pos:[2.5,0,0]},{sym:'Cu',pos:[1.25,2,0]},{sym:'Cu',pos:[1.25,-2,0]}],
  'Steel (Fe+C+Cr)':      [{sym:'Fe',pos:[0,0,0]},{sym:'Fe',pos:[2.5,0,0]},{sym:'C',pos:[1.25,1.8,0]},{sym:'Cr',pos:[1.25,-1.8,0]},{sym:'C',pos:[-1.25,0,1.8]}],
  'Titanium Alloy (Ti+Al)':[{sym:'Ti',pos:[0,0,0]},{sym:'Ti',pos:[3,0,0]},{sym:'Al',pos:[1.5,2.5,0]},{sym:'Al',pos:[1.5,-2.5,0]},{sym:'Ti',pos:[1.5,0,2.5]}],
  'Hercules Alloy (6-el)': [{sym:'Ti',pos:[0,0,0]},{sym:'W',pos:[3.2,0,0]},{sym:'Mo',pos:[-3.2,0,0]},{sym:'Ta',pos:[0,3.2,0]},{sym:'Co',pos:[0,-3.2,0]},{sym:'Ni',pos:[0,0,3.2]}],
  'Calcium Carbonate':    [{sym:'Ca',pos:[0,0,0]},{sym:'C',pos:[2.4,0,0]},{sym:'O',pos:[3.6,0,0]},{sym:'O',pos:[1.8,1.2,0]},{sym:'O',pos:[1.8,-1.2,0]}],
  'Copper Oxide (CuO)':   [{sym:'Cu',pos:[0,0,0]},{sym:'O',pos:[1.9,0,0]}],
  'Silicon Dioxide':      [{sym:'Si',pos:[0,0,0]},{sym:'O',pos:[1.6,0,0]},{sym:'O',pos:[-1.6,0,0]}],
};

// ── Module state ─────────────────────────────────────────────────────────────
let _als = null; // singleton state

function _init(canvasId) {
  if (_als && _als.renderer) _als.renderer.dispose();
  const THREE = window.THREE;
  if (!THREE) return null;

  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const W = canvas.clientWidth  || 400;
  const H = canvas.clientHeight || 300;

  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setClearColor(0x060a10, 1);

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(45, W/H, 0.01, 1000);
  camera.position.set(0, 3, 14);

  // Lighting
  scene.add(new THREE.AmbientLight(0x334466, 0.8));
  const dl = new THREE.DirectionalLight(0x00e5ff, 1.2);
  dl.position.set(5, 10, 8);
  scene.add(dl);
  const bl = new THREE.DirectionalLight(0x7c4dff, 0.6);
  bl.position.set(-5, -3, -5);
  scene.add(bl);

  // OrbitControls
  let controls = null;
  if (window.THREE && THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enableZoom = true;
    controls.minDistance = 2;
    controls.maxDistance = 60;
  }

  // Particle system for CFD (wind/pressure visualization)
  const NPART = 600;
  const pGeo  = new THREE.BufferGeometry();
  const pPos  = new Float32Array(NPART * 3);
  for (let i=0; i<NPART; i++) {
    pPos[i*3]   = (Math.random()-0.5)*20;
    pPos[i*3+1] = (Math.random()-0.5)*20;
    pPos[i*3+2] = (Math.random()-0.5)*20;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,3));
  const pMat  = new THREE.PointsMaterial({color:0x00e5ff, size:0.08, transparent:true, opacity:0.35, sizeAttenuation:true});
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);
  const pVel = new Float32Array(NPART * 3);
  for (let i=0; i<NPART; i++) {
    pVel[i*3]   = (Math.random()-0.5)*0.01;
    pVel[i*3+1] = (Math.random()-0.5)*0.01;
    pVel[i*3+2] = (Math.random()-0.5)*0.01;
  }

  return {
    THREE, renderer, scene, camera, controls, canvas,
    particles, pGeo, pPos, pVel,
    atoms: [], bonds: [], envGroup: new THREE.Group(),
    isSimulating: false, recordedFrames: [], animClips: [],
    simTime: 0, frameInterval: null,
    params: { temp:25, pressure:101325, windX:0, windY:0, windZ:0 }
  };
}

function _buildMolecule(state, atomDefs) {
  const T = state.THREE;
  // Clear old atoms/bonds
  state.atoms.forEach(a => state.scene.remove(a.group));
  state.bonds.forEach(b => state.scene.remove(b));
  state.atoms = []; state.bonds = [];

  atomDefs.forEach((def, i) => {
    const el = ELEMENTS[def.sym] || ELEMENTS.C;
    const r  = Math.max(0.3, el.r * 0.55);
    const geo = new T.SphereGeometry(r, 20, 16);
    const mat = new T.MeshPhongMaterial({
      color: el.color,
      emissive: el.color,
      emissiveIntensity: 0.15,
      shininess: 60,
      transparent: false,
    });
    const mesh = new T.Mesh(geo, mat);
    mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
    mesh.name = `atom_${def.sym}_${i}`;

    // Electron ring
    const ringGeo = new T.TorusGeometry(r*1.7, 0.025, 6, 40);
    const ringMat = new T.MeshBasicMaterial({color:0x00e5ff, transparent:true, opacity:0.4});
    const ring = new T.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI/2;
    ring.name = `ring_${i}`;

    const group = new T.Group();
    group.add(mesh); group.add(ring);
    group.position.set(def.pos[0], def.pos[1], def.pos[2]);
    mesh.position.set(0,0,0);
    ring.position.set(0,0,0);

    state.scene.add(group);
    state.atoms.push({group, mesh, ring, el, def,
      vel: new T.Vector3(
        (Math.random()-0.5)*0.0005,
        (Math.random()-0.5)*0.0005,
        (Math.random()-0.5)*0.0005
      )
    });
  });

  // Draw bonds between nearby atoms
  for (let i=0; i<state.atoms.length; i++) {
    for (let j=i+1; j<state.atoms.length; j++) {
      const a = state.atoms[i].group.position;
      const b = state.atoms[j].group.position;
      const dist = a.distanceTo(b);
      const ri = (ELEMENTS[state.atoms[i].def.sym]||ELEMENTS.C).r;
      const rj = (ELEMENTS[state.atoms[j].def.sym]||ELEMENTS.C).r;
      if (dist < (ri + rj) * 3.5) {
        _addBond(state, a, b);
      }
    }
  }
}

function _addBond(state, a, b) {
  const T = state.THREE;
  const dir  = new T.Vector3().subVectors(b, a);
  const len  = dir.length();
  const mid  = new T.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const geo  = new T.CylinderGeometry(0.045, 0.045, len, 8, 1);
  const mat  = new T.MeshPhongMaterial({color:0x446688, transparent:true, opacity:0.7});
  const mesh = new T.Mesh(geo, mat);
  mesh.position.copy(mid);
  const ax = new T.Vector3(0,1,0);
  mesh.quaternion.setFromUnitVectors(ax, dir.normalize());
  state.scene.add(mesh);
  state.bonds.push(mesh);
}

function _applyEnvToParticles(state) {
  const p = state.params;
  const T = state.THREE;
  // Temperature → speed of particles
  const tempFactor = Math.sqrt(Math.max(1, p.temp + 273) / 298) * 0.02;
  // Pressure → density (squeeze bounding box)
  const pressBox = 10 * (101325 / Math.max(1, p.pressure));
  // Wind → directional force
  const wx = p.windX * 0.0003;
  const wy = p.windY * 0.0003;
  const wz = p.windZ * 0.0003;
  const pos = state.pPos;
  const vel = state.pVel;
  for (let i=0; i<pos.length/3; i++) {
    vel[i*3]   += wx + (Math.random()-0.5)*tempFactor*0.1;
    vel[i*3+1] += wy + (Math.random()-0.5)*tempFactor*0.1;
    vel[i*3+2] += wz + (Math.random()-0.5)*tempFactor*0.1;
    pos[i*3]   += vel[i*3];
    pos[i*3+1] += vel[i*3+1];
    pos[i*3+2] += vel[i*3+2];
    // Wrap around bounding box
    for (let ax=0; ax<3; ax++) {
      if (pos[i*3+ax] > pressBox)  pos[i*3+ax] = -pressBox;
      if (pos[i*3+ax] < -pressBox) pos[i*3+ax] =  pressBox;
    }
  }
  state.pGeo.attributes.position.needsUpdate = true;
  // Particle color driven by temperature
  const hot = p.temp > 500;
  const veryhot = p.temp > 1500;
  state.particles.material.color.setHex(veryhot ? 0xff4400 : hot ? 0xffaa00 : 0x00e5ff);
  state.particles.material.opacity = Math.min(0.6, 0.2 + p.pressure/500000);
}

function _simStep(state) {
  if (!state.isSimulating) return;
  const T = state.THREE;
  const p = state.params;
  const tempK = p.temp + 273;
  const kT = tempK / 3000;
  const wind = new T.Vector3(p.windX, p.windY, p.windZ).multiplyScalar(0.0001);

  state.atoms.forEach((atom, i) => {
    if (!atom.vel) atom.vel = new T.Vector3();
    // Thermal motion
    atom.vel.x += (Math.random()-0.5) * kT * 0.001;
    atom.vel.y += (Math.random()-0.5) * kT * 0.001;
    atom.vel.z += (Math.random()-0.5) * kT * 0.001;
    // Wind force
    atom.vel.add(wind);
    // Damping
    atom.vel.multiplyScalar(0.96);
    // Clamp
    const spd = atom.vel.length();
    if (spd > 0.08) atom.vel.multiplyScalar(0.08/spd);
    // Move
    atom.group.position.add(atom.vel);
    // Bounds restore — pull back to origin slowly
    atom.group.position.lerp(new T.Vector3(atom.def.pos[0], atom.def.pos[1], atom.def.pos[2]), 0.001);
    // Spin ring
    atom.ring.rotation.z += 0.015 * (1 + kT * 2);
    atom.ring.rotation.y += 0.008;
  });

  // Update bonds
  state.bonds.forEach(b => state.scene.remove(b));
  state.bonds = [];
  for (let i=0; i<state.atoms.length; i++) {
    for (let j=i+1; j<state.atoms.length; j++) {
      const a = state.atoms[i].group.position;
      const b2= state.atoms[j].group.position;
      const dist = a.distanceTo(b2);
      const ri = (ELEMENTS[state.atoms[i].def.sym]||ELEMENTS.C).r;
      const rj = (ELEMENTS[state.atoms[j].def.sym]||ELEMENTS.C).r;
      if (dist < (ri + rj) * 5) {
        _addBond(state, a, b2);
      }
    }
  }

  _applyEnvToParticles(state);
  state.simTime += 1/60;

  // Record frame
  if (state.recordedFrames.length < 1800) { // max 30s at 60fps
    const frameData = {
      time: state.simTime,
      atoms: state.atoms.map(a => ({
        pos: a.group.position.toArray()
      }))
    };
    state.recordedFrames.push(frameData);
  }
}

function _buildAnimClips(state) {
  const T = state.THREE;
  const frames = state.recordedFrames;
  if (frames.length < 2) return [];
  const clips = [];
  const times = frames.map(f => f.time);
  state.atoms.forEach((atom, ai) => {
    const pos = [];
    frames.forEach(f => {
      const d = f.atoms[ai];
      if (d) { pos.push(d.pos[0], d.pos[1], d.pos[2]); }
    });
    if (pos.length > 0) {
      const name = atom.mesh.name || `atom_${ai}`;
      atom.mesh.name = name;
      clips.push(new T.AnimationClip(
        `Atom_${ai}_Anim`, -1,
        [new T.VectorKeyframeTrack(`${name}.position`, times, pos)]
      ));
    }
  });
  return clips;
}

async function _exportGLB(state) {
  const T = state.THREE;
  // Dynamically load GLTFExporter if not present
  if (!T.GLTFExporter) {
    await new Promise((res,rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const exportScene = new T.Scene();
  // Lights
  exportScene.add(new T.AmbientLight(0x334466, 0.8));
  const dl = new T.DirectionalLight(0x00e5ff, 1.2);
  dl.position.set(5,10,8);
  exportScene.add(dl);

  // Atoms
  state.atoms.forEach((atom, i) => {
    const clone = atom.group.clone();
    clone.name = atom.mesh.name || `atom_${i}`;
    exportScene.add(clone);
  });
  state.bonds.forEach((b, i) => {
    const bc = b.clone();
    bc.name = `bond_${i}`;
    exportScene.add(bc);
  });

  // Build animation clips from recorded frames
  const clips = _buildAnimClips(state);

  exportScene.updateMatrixWorld(true);

  return new Promise((resolve, reject) => {
    const exporter = new T.GLTFExporter();
    exporter.parse(exportScene, (glb) => {
      const blob = new Blob([glb], {type:'model/gltf-binary'});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `arclake_sim_${Date.now()}.glb`;
      a.click();
      URL.revokeObjectURL(url);
      resolve(true);
    }, (err) => reject(err),
    {binary:true, animations: clips.length > 0 ? clips : undefined});
  });
}

// ── Render function — returns HTML for the Tools tab ──────────────────────
window.renderToolsArcLake = function() {
  return `
  <div class="arclake-studio" id="als-root" style="
    display:flex;flex-direction:column;height:100%;
    background:#060a10;color:#e8eaf0;font-family:'Orbitron',monospace;
    gap:0;overflow:hidden;
  ">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:10px 14px 8px;border-bottom:1px solid rgba(0,229,255,0.12);
      background:rgba(6,10,16,0.97);flex-shrink:0">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="color:#00e5ff;font-size:16px">⬡</span>
        <span style="font-size:11px;letter-spacing:2px;color:#00e5ff;font-weight:700">ARCLAKE STUDIO</span>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="window._alsFullscreen&&window._alsFullscreen()" style="
          background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.3);
          color:#00e5ff;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:10px;
          font-family:inherit">⛶ EXPAND</button>
      </div>
    </div>

    <!-- Canvas -->
    <div style="position:relative;flex:1;min-height:200px;overflow:hidden">
      <canvas id="als-canvas" style="width:100%;height:100%;display:block;touch-action:none"></canvas>
      <!-- HUD overlay -->
      <div id="als-hud" style="position:absolute;top:8px;left:10px;font-size:9px;
        color:#00e5ff;opacity:0.7;line-height:1.8;pointer-events:none">
        <div id="als-hud-status">● IDLE</div>
        <div id="als-hud-frames">FRAMES: 0</div>
        <div id="als-hud-time">TIME: 0.00s</div>
      </div>
      <!-- Temp indicator -->
      <div id="als-temp-bar" style="position:absolute;bottom:6px;right:8px;font-size:9px;
        color:#ff6644;opacity:0.8;pointer-events:none">
        <span id="als-temp-label">25°C</span>
      </div>
    </div>

    <!-- Controls -->
    <div style="flex-shrink:0;padding:10px 12px;border-top:1px solid rgba(0,229,255,0.1);
      background:rgba(6,10,16,0.95);display:flex;flex-direction:column;gap:8px">

      <!-- Molecule selector -->
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:9px;color:#8a8fa8;letter-spacing:1px;white-space:nowrap">SCENE</label>
        <select id="als-preset" onchange="window._alsLoadPreset&&window._alsLoadPreset(this.value)" style="
          flex:1;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.25);
          color:#e8eaf0;padding:5px 8px;border-radius:6px;font-size:10px;font-family:inherit;cursor:pointer">
          ${Object.keys(PRESETS).map(k=>`<option value="${k}">${k}</option>`).join('')}
          <option value="__custom">Custom...</option>
        </select>
      </div>

      <!-- Custom input -->
      <div id="als-custom-row" style="display:none;gap:6px;align-items:center">
        <input id="als-custom-input" placeholder="e.g. Fe,Cu,Ni or describe..." style="
          flex:1;background:rgba(124,77,255,0.08);border:1px solid rgba(124,77,255,0.3);
          color:#e8eaf0;padding:5px 8px;border-radius:6px;font-size:10px;font-family:inherit"
          onkeydown="if(event.key==='Enter') window._alsParseCustom&&window._alsParseCustom()">
        <button onclick="window._alsParseCustom&&window._alsParseCustom()" style="
          background:rgba(124,77,255,0.2);border:1px solid rgba(124,77,255,0.4);
          color:#c4a0ff;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-family:inherit">BUILD</button>
      </div>

      <!-- Environment params -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div>
          <label style="font-size:8px;color:#8a8fa8;letter-spacing:1px">TEMP (°C)</label>
          <input id="als-temp" type="range" min="-273" max="3500" value="25" step="1"
            oninput="window._alsUpdateParam&&window._alsUpdateParam('temp',+this.value)"
            style="width:100%;accent-color:#ff6644">
          <span id="als-temp-val" style="font-size:9px;color:#ff6644">25°C</span>
        </div>
        <div>
          <label style="font-size:8px;color:#8a8fa8;letter-spacing:1px">PRESSURE (Pa)</label>
          <input id="als-pressure" type="range" min="0" max="500000" value="101325" step="100"
            oninput="window._alsUpdateParam&&window._alsUpdateParam('pressure',+this.value)"
            style="width:100%;accent-color:#7c4dff">
          <span id="als-pres-val" style="font-size:9px;color:#7c4dff">101325 Pa</span>
        </div>
        <div>
          <label style="font-size:8px;color:#8a8fa8;letter-spacing:1px">WIND X (m/s)</label>
          <input id="als-windx" type="range" min="-100" max="100" value="0" step="1"
            oninput="window._alsUpdateParam&&window._alsUpdateParam('windX',+this.value)"
            style="width:100%;accent-color:#00e5ff">
          <span id="als-wx-val" style="font-size:9px;color:#00e5ff">0 m/s</span>
        </div>
        <div>
          <label style="font-size:8px;color:#8a8fa8;letter-spacing:1px">WIND Y (m/s)</label>
          <input id="als-windy" type="range" min="-100" max="100" value="0" step="1"
            oninput="window._alsUpdateParam&&window._alsUpdateParam('windY',+this.value)"
            style="width:100%;accent-color:#00e5ff">
          <span id="als-wy-val" style="font-size:9px;color:#00e5ff">0 m/s</span>
        </div>
      </div>

      <!-- Simulation controls -->
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button id="als-btn-start" onclick="window._alsStart&&window._alsStart()" style="
          flex:1;background:rgba(0,229,255,0.12);border:1px solid rgba(0,229,255,0.35);
          color:#00e5ff;padding:7px;border-radius:8px;cursor:pointer;font-size:10px;font-family:inherit;font-weight:700">
          ▶ SIMULATE</button>
        <button id="als-btn-stop" onclick="window._alsStop&&window._alsStop()" style="
          flex:1;background:rgba(255,77,77,0.12);border:1px solid rgba(255,77,77,0.3);
          color:#ff4d4d;padding:7px;border-radius:8px;cursor:pointer;font-size:10px;font-family:inherit">
          ■ STOP</button>
        <button id="als-btn-export" onclick="window._alsExport&&window._alsExport()" style="
          flex:1;background:rgba(124,77,255,0.12);border:1px solid rgba(124,77,255,0.3);
          color:#c4a0ff;padding:7px;border-radius:8px;cursor:pointer;font-size:10px;font-family:inherit">
          ⬇ GLB</button>
        <button onclick="window._alsReset&&window._alsReset()" style="
          background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          color:#8a8fa8;padding:7px 10px;border-radius:8px;cursor:pointer;font-size:10px;font-family:inherit">
          ↺</button>
      </div>

      <!-- Status bar -->
      <div id="als-status" style="font-size:9px;color:#8a8fa8;text-align:center;min-height:14px"></div>
    </div>
  </div>`;
};

// ── Mount logic — called after HTML is injected ─────────────────────────────
window._alsMounted = function() {
  // Size canvas properly
  const canvas = document.getElementById('als-canvas');
  if (!canvas) return;
  const container = canvas.parentElement;
  const W = container.offsetWidth  || 360;
  const H = container.offsetHeight || 220;
  canvas.width  = W * (window.devicePixelRatio||1);
  canvas.height = H * (window.devicePixelRatio||1);
  canvas.style.width  = W+'px';
  canvas.style.height = H+'px';

  _als = _init('als-canvas');
  if (!_als) { document.getElementById('als-status').textContent='THREE.js not loaded — refresh'; return; }
  _als.scene.add(_als.envGroup);

  // Load default preset
  const presetKeys = Object.keys(PRESETS);
  _buildMolecule(_als, PRESETS[presetKeys[0]]);

  // Animation loop
  let _rafId = null;
  function _loop() {
    _rafId = requestAnimationFrame(_loop);
    if (_als.isSimulating) _simStep(_als);
    if (_als.controls) _als.controls.update();
    _als.renderer.render(_als.scene, _als.camera);
    // HUD
    const hud = document.getElementById('als-hud-frames');
    const htime = document.getElementById('als-hud-time');
    const htmp  = document.getElementById('als-temp-label');
    if (hud)   hud.textContent   = 'FRAMES: ' + _als.recordedFrames.length;
    if (htime) htime.textContent = 'TIME: '   + _als.simTime.toFixed(2)+'s';
    if (htmp)  htmp.textContent  = _als.params.temp+'°C';
  }
  _loop();

  // Resize observer
  const ro = new ResizeObserver(() => {
    if (!_als || !_als.renderer) return;
    const W2 = container.offsetWidth || 360;
    const H2 = Math.max(150, container.offsetHeight || 220);
    _als.renderer.setSize(W2, H2, false);
    _als.camera.aspect = W2/H2;
    _als.camera.updateProjectionMatrix();
  });
  ro.observe(container);
  _als._ro = ro;
  _als._rafId = _rafId;
};

// ── Exposed API ─────────────────────────────────────────────────────────────
window._alsLoadPreset = function(key) {
  const row = document.getElementById('als-custom-row');
  if (key === '__custom') {
    if (row) row.style.display = 'flex';
    return;
  }
  if (row) row.style.display = 'none';
  if (!_als || !PRESETS[key]) return;
  _als.isSimulating = false;
  _als.recordedFrames = [];
  _als.simTime = 0;
  _buildMolecule(_als, PRESETS[key]);
  document.getElementById('als-status').textContent = 'Scene: '+key;
};

window._alsParseCustom = function() {
  const raw = document.getElementById('als-custom-input').value.trim();
  if (!raw || !_als) return;
  // Parse comma-separated element symbols
  const syms = raw.split(',').map(s=>s.trim().replace(/[^A-Za-z]/g,''));
  const valid = syms.filter(s=>ELEMENTS[s]||ELEMENTS[s.charAt(0).toUpperCase()+s.slice(1).toLowerCase()]);
  if (!valid.length) { document.getElementById('als-status').textContent='Unknown elements — try: Fe,Cu,Ni'; return; }
  const defs = valid.map((sym,i) => {
    const angle = (i / valid.length) * Math.PI * 2;
    const r2 = valid.length > 1 ? 2.5 : 0;
    return {sym: sym.charAt(0).toUpperCase()+sym.slice(1).toLowerCase(), pos:[Math.cos(angle)*r2, 0, Math.sin(angle)*r2]};
  });
  _als.isSimulating = false;
  _als.recordedFrames = [];
  _als.simTime = 0;
  _buildMolecule(_als, defs);
  document.getElementById('als-status').textContent = 'Custom: '+valid.join(', ');
};

window._alsUpdateParam = function(key, val) {
  if (!_als) return;
  _als.params[key] = val;
  if (key==='temp')     { document.getElementById('als-temp-val').textContent  = val+'°C'; }
  if (key==='pressure') { document.getElementById('als-pres-val').textContent  = val+' Pa'; }
  if (key==='windX')    { document.getElementById('als-wx-val').textContent    = val+' m/s'; }
  if (key==='windY')    { document.getElementById('als-wy-val').textContent    = val+' m/s'; }
};

window._alsStart = function() {
  if (!_als) return;
  _als.isSimulating = true;
  const s = document.getElementById('als-hud-status');
  if (s) s.textContent = '● SIMULATING';
  document.getElementById('als-status').textContent = 'Simulation running — recording frames...';
};

window._alsStop = function() {
  if (!_als) return;
  _als.isSimulating = false;
  const s = document.getElementById('als-hud-status');
  if (s) s.textContent = '■ STOPPED';
  document.getElementById('als-status').textContent = 'Stopped. '+_als.recordedFrames.length+' frames recorded. Ready for GLB export.';
};

window._alsReset = function() {
  if (!_als) return;
  _als.isSimulating = false;
  _als.recordedFrames = [];
  _als.simTime = 0;
  const key = document.getElementById('als-preset').value;
  if (PRESETS[key]) _buildMolecule(_als, PRESETS[key]);
  document.getElementById('als-status').textContent = 'Reset.';
  const s = document.getElementById('als-hud-status');
  if (s) s.textContent = '● IDLE';
};

window._alsExport = async function() {
  if (!_als) return;
  const btn = document.getElementById('als-btn-export');
  if (btn) btn.textContent = '⏳ EXPORTING...';
  document.getElementById('als-status').textContent = 'Building GLB with animation data...';
  try {
    await _exportGLB(_als);
    document.getElementById('als-status').textContent = 'GLB downloaded with '+_als.recordedFrames.length+' animation frames.';
  } catch(e) {
    document.getElementById('als-status').textContent = 'Export error: '+e.message;
  }
  if (btn) btn.textContent = '⬇ GLB';
};

window._alsFullscreen = function() {
  // Create fullscreen overlay
  const existing = document.getElementById('als-fullscreen-overlay');
  if (existing) { existing.remove(); return; }
  const overlay = document.createElement('div');
  overlay.id = 'als-fullscreen-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#060a10;display:flex;flex-direction:column';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ CLOSE STUDIO';
  closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;z-index:100000;background:rgba(255,77,77,0.15);border:1px solid rgba(255,77,77,0.35);color:#ff4d4d;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:Orbitron,monospace;font-size:11px';
  closeBtn.onclick = () => overlay.remove();
  overlay.appendChild(closeBtn);
  // Mount a fresh canvas
  const fsCanvas = document.createElement('canvas');
  fsCanvas.id = 'als-fs-canvas';
  fsCanvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  overlay.appendChild(fsCanvas);
  document.body.appendChild(overlay);
  // Init new renderer on fullscreen canvas
  requestAnimationFrame(() => {
    const W = overlay.offsetWidth; const H = overlay.offsetHeight;
    fsCanvas.width = W; fsCanvas.height = H;
    if (_als && window.THREE) {
      _als.renderer.dispose();
      const r2 = new window.THREE.WebGLRenderer({canvas:fsCanvas,antialias:true,alpha:true});
      r2.setSize(W,H,false); r2.setClearColor(0x060a10,1);
      _als.renderer = r2;
      _als.camera.aspect = W/H; _als.camera.updateProjectionMatrix();
      if (_als.controls) { _als.controls.dispose(); _als.controls = new window.THREE.OrbitControls(_als.camera, r2.domElement); }
    }
  });
};

})();
