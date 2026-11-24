/* ═══════════════════════════════════════════════════════════════════════════
   Shell 64 activity node — LEATR real-time scene (BRPN), three r128, no build step.
   When anyone uses shell64.dartmeadow.com, every Autumn viewer sees an x-ray group of
   four huddled figures seated on a glowing plasma curve outside the buoyancy shells,
   with the nested Shell 64 sphere rising from the middle of their ring and hovering
   above their heads while calculations run. Fades out ~6–10 s after activity stops.

   Feed (docs/SHELL64_FEED_CONTRACT.md):
     · readnodes.shell64 summary from the shared Apps Script — Shell64Node.feed(summary)
       (one line in _pollAshNodes; no extra request)
     · BroadcastChannel('leatr-shell64') — instant echo (same-origin only, so it covers embeds/tests, not shell64.dartmeadow.com)
   Respects LIVE FEED (window._liveFeedEnabled). Up to MAX_SESSIONS groups, newest first.
   Asset: assets/s64-meshopt-safe.glb (meshopt; needs js/vendor/three-r128-{GLTFLoader,meshopt_decoder}.js)
   ═══════════════════════════════════════════════════════════════════════════ */
(function (W) {
  'use strict';
  var T = null;
  var OUTER_SHELL_R = 1.9;                       // initBRPN shellRadii[0]
  var TARGET = (OUTER_SHELL_R * 2) / 6;          // group's largest dimension = 1/6 of the outer shell (0.633)
  var MAX_SESSIONS = 6;
  var IDLE_FADE_AFTER_MS = 6000, FADE_MS = 3000; // idle 6 s → fade over 3 s → gone by ~9 s
  var ASSET_URL = 'assets/s64-meshopt-safe.glb';
  var CURVE_R = 0.012;                           // plasma tube radius (scene units)
  // Measured from the GLB (Nomad export, Y up, soles at min.y, H = 3.608):
  //  ring centre x/z = bbox centre; lowest thigh underside of the two figures the rail runs
  //  between = 0.291·H above the soles. The curve's top sits just under that.
  var THIGH_UNDERSIDE_FRAC = 0.291, SEAT_GAP = 0.004;

  // ── Curve geometry (isolated: swap this function to change the curve's shape) ─────────
  // A plasma spline from the local core out to the node, with a near-level "rail" run
  // straight through the centre of the ring (the part the figures straddle), trailing off
  // past it like the other buoyancy-node splines. Returns { curve, u } where u is the
  // curve parameter at the seat.
  function buildSeatCurve(anchor) {
    var d = new T.Vector3(anchor.x, 0, anchor.z).normalize();
    d.set(-d.z * 0.35 + d.x * 0.94, 0, d.x * 0.35 + d.z * 0.94).normalize();
    var up = new T.Vector3(0, 1, 0);
    var pts = [new T.Vector3(0, 0, 0),
      anchor.clone().multiplyScalar(0.45).addScaledVector(up, -0.05),
      anchor.clone().addScaledVector(d, -0.55).addScaledVector(up, -0.06),
      anchor.clone().addScaledVector(d, -0.2),
      anchor.clone().addScaledVector(up, -0.012),
      anchor.clone().addScaledVector(d, 0.2),
      anchor.clone().addScaledVector(d, 0.6).addScaledVector(up, 0.08),
      anchor.clone().addScaledVector(d, 1.1).add(new T.Vector3(0.2, 0.35, -0.3))];
    var curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
    var best = 0, bd = 1e9;
    for (var i = 0; i <= 400; i++) { var q = curve.getPointAt(i / 400).distanceToSquared(anchor); if (q < bd) { bd = q; best = i / 400; } }
    return { curve: curve, u: best };
  }

  // Anchor for session slot k: slot 0 is the upper-right spot from the mockup; others spread
  // around the upper hemisphere just outside the outer shell.
  function anchorFor(k) {
    if (k === 0) return new T.Vector3(1.55, 1.3, 0.65);
    var a = [2.45, -0.7, 0.75, -2.3, 1.2][(k - 1) % 5], y = [1.0, 1.55, -1.25, 0.55, 1.75][(k - 1) % 5];
    return new T.Vector3(Math.cos(a) * 1.95, y, Math.sin(a) * 1.0 + 0.4);
  }

  // ── Shaders ────────────────────────────────────────────────────────────
  var XRAY_VS = [
    'varying vec3 vN; varying vec3 vV; varying vec3 vW;',
    'void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz;',
    ' vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz);',
    ' gl_Position = projectionMatrix*viewMatrix*w; }'].join('\n');
  var XRAY_FS = [
    'uniform float uTime; uniform float uAct; uniform float uRate; uniform float uFade; uniform float uGain;',
    'uniform vec3 uColA; uniform vec3 uColB; uniform float uScale;',
    'varying vec3 vN; varying vec3 vV; varying vec3 vW;',
    'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
    'void main(){',
    ' float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));',
    ' float rim = pow(f, 2.2);',
    ' float y = vW.y/uScale;',
    ' float spd = 6.0 + 10.0*uRate;',
    ' float lines = smoothstep(0.86, 1.0, sin(y*420.0 - uTime*spd)*0.5+0.5);',
    ' float grain = step(0.985 - uAct*0.03 - uRate*0.02, h(floor(gl_FragCoord.xy*0.7) + floor(uTime*24.0)));',
    ' float band = smoothstep(0.0, 0.08, abs(fract(y*0.9 - uTime*(0.25+0.6*uRate)) - 0.5) - 0.42);',
    ' vec3 col = mix(uColA, uColB, clamp(f*1.2 + 0.25*sin(uTime*1.7 + y*6.0), 0.0, 1.0));',
    ' float a = 0.05 + rim*0.85 + lines*(0.10 + 0.25*uAct) + grain*0.35*(0.4+uAct) + band*0.35*uAct;',
    ' gl_FragColor = vec4(col*(0.25 + rim*1.1 + lines*0.5)*uGain, clamp(a*0.8*uFade, 0.0, 1.0));',
    '}'].join('\n');
  var SPARK_VS = [
    'attribute float aSeed; uniform float uTime; uniform float uAct; uniform float uRate; uniform float uPx; varying float vA;',
    'void main(){ vec3 p = position;',
    ' float s = aSeed*6.2831; p += 0.035*vec3(sin(uTime*0.7+s), cos(uTime*0.9+s*1.3), sin(uTime*0.5+s*2.1));',
    ' vec4 mv = modelViewMatrix*vec4(p,1.0);',
    ' float tw = pow(0.5+0.5*sin(uTime*(3.0+aSeed*7.0)*(1.0+uRate) + s*11.0), 6.0);',
    ' vA = (0.08 + 0.92*tw) * (0.25 + 0.55*uAct);',
    ' gl_PointSize = uPx*(1.0 + 3.5*tw)*(1.0/-mv.z); gl_Position = projectionMatrix*mv; }'].join('\n');
  var SPARK_FS = [
    'uniform vec3 uCol; uniform float uFade; varying float vA;',
    'void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c);',
    ' float core = exp(-d*d*60.0); float cr = exp(-abs(c.x)*40.0)*exp(-abs(c.y)*6.0) + exp(-abs(c.y)*40.0)*exp(-abs(c.x)*6.0);',
    ' float a = (core + cr*0.6)*vA*uFade; if(a<0.01) discard; gl_FragColor = vec4(uCol*(0.6+core), a); }'].join('\n');

  function xrayMat(colA, colB, gain) {
    return new T.ShaderMaterial({
      vertexShader: XRAY_VS, fragmentShader: XRAY_FS, transparent: true, depthWrite: false,
      side: T.DoubleSide, blending: T.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAct: { value: 0 }, uRate: { value: 0 }, uFade: { value: 1 }, uGain: { value: gain || 1 },
        uScale: { value: 1 }, uColA: { value: new T.Color(colA) }, uColB: { value: new T.Color(colB) } }
    });
  }

  // ── The Shell 64 emblem: nested x-ray sphere (from the Shell 64 app icon) ─────────────
  // dark cracked outer cutaway shell · bronze/gold middle cutaway shell · teal core with an
  // equatorial seam and a curved gold arc · small glowing cyan octahedral gem on its surface.
  // Built in GLB units (the group's own space) so it scales with the figures.
  function buildEmblem(mats) {
    var g = new T.Group(); g.name = 'Shell64Emblem';
    function add(parent, geo, m) { var mesh = new T.Mesh(geo, m); mesh.renderOrder = 6; parent.add(mesh); mats.push(m); return mesh; }
    var R = 0.6;
    // outer shell: cutaway (open window at the front) + jagged crack rim
    var outer = new T.Group(); g.add(outer);
    var og = new T.SphereGeometry(R, 40, 28, Math.PI * 0.32, Math.PI * 1.55, 0.05, Math.PI * 0.95);
    var pos = og.attributes.position, v = new T.Vector3();
    for (var i = 0; i < pos.count; i++) { // roughen like weathered rock
      v.fromBufferAttribute(pos, i); var n = Math.sin(v.x * 37.0) * Math.cos(v.y * 29.0) * Math.sin(v.z * 41.0);
      v.multiplyScalar(1 + n * 0.035); pos.setXYZ(i, v.x, v.y, v.z);
    }
    og.computeVertexNormals();
    add(outer, og, xrayMat(0x7f93a8, 0xdfeeff, 0.9));
    var crack = []; for (var c = 0; c <= 26; c++) { var a = Math.PI * 0.32 + (c / 26) * 0.0; var th = 0.05 + (c / 26) * Math.PI * 0.95;
      var jag = (c % 2 ? 0.06 : -0.04); crack.push(new T.Vector3(Math.cos(a + jag) * Math.sin(th) * -R, Math.cos(th) * R, Math.sin(a + jag) * Math.sin(th) * R)); }
    var crack2 = crack.map(function (p) { var a2 = Math.PI * (0.32 + 1.55); var rr = Math.sqrt(p.x * p.x + p.z * p.z), j = (Math.round(p.y * 97) % 2 ? 0.05 : -0.05);
      return new T.Vector3(-Math.cos(a2 + j) * rr, p.y, Math.sin(a2 + j) * rr); });
    var crackGeo = new T.BufferGeometry().setFromPoints(crack), crackGeo2 = new T.BufferGeometry().setFromPoints(crack2);
    var crackMat = new T.LineBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
    outer.add(new T.Line(crackGeo, crackMat)); outer.add(new T.Line(crackGeo2, crackMat)); g.userData.lineMats = [crackMat];
    // middle bronze shell, cut away on a different side
    var middle = new T.Group(); g.add(middle);
    add(middle, new T.SphereGeometry(R * 0.8, 36, 24, Math.PI * 0.15, Math.PI * 1.6, 0.12, Math.PI * 0.8), xrayMat(0xc8923a, 0xfff0c8, 1.0));
    add(middle, new T.TorusGeometry(R * 0.8, R * 0.025, 6, 64, Math.PI * 1.6), xrayMat(0xe0a948, 0xfff6dc, 1.2)).rotation.x = Math.PI / 2;
    // core: teal sphere, equatorial seam, curved gold arc, cyan gem
    var core = new T.Group(); g.add(core);
    add(core, new T.SphereGeometry(R * 0.58, 32, 22), xrayMat(0x1f9c98, 0xbffff4, 1.1));
    add(core, new T.TorusGeometry(R * 0.585, R * 0.018, 6, 64), xrayMat(0x9fe9e2, 0xffffff, 1.3)).rotation.x = Math.PI / 2;
    var arc = add(core, new T.TorusGeometry(R * 0.6, R * 0.016, 6, 48, Math.PI * 0.85), xrayMat(0xe0b04f, 0xfff3cf, 1.3));
    arc.rotation.set(0.35, 0.2, 1.05);
    var gemPivot = new T.Group(); core.add(gemPivot); gemPivot.rotation.set(-0.55, 0.65, 0);
    var gem = add(gemPivot, new T.OctahedronGeometry(R * 0.11, 0), xrayMat(0x37e8ff, 0xffffff, 2.2));
    gem.position.set(0, R * 0.62, 0);
    var gemGlowMat = new T.SpriteMaterial({ map: glareTexture(), color: 0x5ff6ff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.6 });
    var gemGlow = new T.Sprite(gemGlowMat); gemGlow.scale.setScalar(R * 0.55); gem.add(gemGlow);
    g.userData.parts = { outer: outer, middle: middle, core: core, gem: gem, gemGlowMat: gemGlowMat };
    return g;
  }

  var _glareTex = null;
  function glareTexture() {
    if (_glareTex) return _glareTex;
    var cv = document.createElement('canvas'); cv.width = cv.height = 128; var cx = cv.getContext('2d');
    var gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(200,255,250,0.9)'); gr.addColorStop(0.25, 'rgba(80,230,255,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    _glareTex = new T.CanvasTexture(cv); return _glareTex;
  }

  // ── State ──────────────────────────────────────────────────────────────
  var S = {
    scene: null, template: null, loading: false, nodes: {}, slots: [], rate: 0, rateTarget: 0,
    summary: null, lastFeedAt: 0, t0: 0, raf: 0, bc: null, local: {}
  };

  function loadTemplate() {
    if (S.template || S.loading || !T.GLTFLoader) return;
    S.loading = true;
    var loader = new T.GLTFLoader();
    if (W.MeshoptDecoder && loader.setMeshoptDecoder) loader.setMeshoptDecoder(W.MeshoptDecoder);
    loader.load(ASSET_URL, function (g) {
      var grp = g.scene; grp.updateMatrixWorld(true);
      grp.traverse(function (o) { if (o.isMesh && !o.geometry.attributes.normal) o.geometry.computeVertexNormals(); }); // Nomad ships no normals
      var box = new T.Box3().setFromObject(grp), size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
      var geos = {}; grp.traverse(function (o) { if (o.geometry) geos[o.geometry.uuid] = 1; });
      S.template = { scene: grp, box: box, size: size, center: c, k: TARGET / Math.max(size.x, size.y, size.z), geos: geos };
      S.loading = false;
    }, undefined, function (e) { S.loading = false; S.failed = true; console.warn('[Shell64Node] GLB load failed', e); });
  }

  function makeNode(sid, slot) {
    var tp = S.template, k = tp.k, mats = [];
    var palette = [[0x7cf6ff, 0xffffff], [0x9b7bff, 0xd8f7ff], [0x39ff9c, 0xe8fff6], [0xff6ad5, 0xfff0fb]];
    var grp = tp.scene.clone(true), fig = 0, figOf = {};
    grp.traverse(function (o) {
      if (!o.isMesh) return;
      var top = o; while (top.parent && top.parent !== grp && top.parent.name !== 'Group_3') top = top.parent; // one figure = one child of the root group
      if (figOf[top.uuid] === undefined) figOf[top.uuid] = fig++;
      var pal = palette[figOf[top.uuid] % palette.length];
      o.material = xrayMat(pal[0], pal[1]); o.renderOrder = 5; mats.push(o.material);
    });
    // Seat: put the GLB's ring centre at the origin with the curve's top under the thighs.
    var seatY = tp.box.min.y + tp.size.y * THIGH_UNDERSIDE_FRAC - (CURVE_R + SEAT_GAP) / k;
    grp.position.set(-tp.center.x, -seatY, -tp.center.z);
    var holder = new T.Group(); holder.add(grp); holder.scale.setScalar(k);
    // Emblem lives in GLB units inside the holder, at the ring centre.
    var emblem = buildEmblem(mats);
    var restY = tp.box.min.y - seatY + 0.3;                                        // resting low in the ring, between their feet (campfire)
    var hoverY = tp.box.max.y - seatY + 0.68;                                       // hovering just above their heads
    emblem.position.set(0, restY, 0); emblem.scale.setScalar(0.35); holder.add(emblem);

    var root = new T.Group(); root.name = 'Shell64Node:' + sid; root.add(holder);
    // sparkle cloud (scene units)
    var N = 520, pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var r = TARGET * (0.45 + Math.pow(Math.random(), 0.6) * 0.75), th = Math.random() * 6.2831, ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.cos(ph) * 0.8 + TARGET * 0.18; pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      seed[i] = Math.random();
    }
    var sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3)); sg.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    var sparkMat = new T.ShaderMaterial({ vertexShader: SPARK_VS, fragmentShader: SPARK_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAct: { value: 0 }, uRate: { value: 0 }, uFade: { value: 0 }, uPx: { value: 5.5 * Math.min(W.devicePixelRatio || 1, 2) }, uCol: { value: new T.Color(0xbff8ff) } } });
    root.add(new T.Points(sg, sparkMat));
    var glare = new T.Sprite(new T.SpriteMaterial({ map: glareTexture(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 }));
    glare.scale.setScalar(TARGET * 1.7); glare.position.y = TARGET * 0.15; root.add(glare);

    // curve + travelling pulse
    var anchor = anchorFor(slot), sc = buildSeatCurve(anchor), base = sc.curve.getPoints(96);
    var lineGeo = new T.BufferGeometry().setFromPoints(base);
    var line = new T.Line(lineGeo, new T.LineBasicMaterial({ color: 0x39ffd2, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    var tubeMat = new T.MeshBasicMaterial({ color: 0x22e6ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    var tube = new T.Mesh(new T.TubeGeometry(sc.curve, 120, CURVE_R, 6, false), tubeMat);
    var pulse = new T.Mesh(new T.SphereGeometry(0.02, 8, 8), new T.MeshBasicMaterial({ color: 0xc9fff4, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    var wrap = new T.Group(); wrap.name = 'Shell64Wrap:' + sid; wrap.add(line, tube, pulse, root);
    S.scene.add(wrap);
    mats.forEach(function (m) { m.uniforms.uScale.value = k; });
    return { sid: sid, slot: slot, wrap: wrap, root: root, mats: mats, sparkMat: sparkMat, glare: glare, emblem: emblem,
      restY: restY, hoverY: hoverY, rise: 0, curve: sc.curve, u: sc.u, base: base, lineGeo: lineGeo, line: line, tubeMat: tubeMat, pulse: pulse,
      act: 0, fade: 0, n: -1, lastActiveAt: 0, phase: Math.random(), born: performance.now() };
  }

  function disposeNode(nd) {
    if (nd.wrap.parent) nd.wrap.parent.remove(nd.wrap);
    var shared = S.template ? S.template.geos : {};
    nd.wrap.traverse(function (o) {
      if (o.geometry && !shared[o.geometry.uuid]) o.geometry.dispose();   // GLB geometry is shared with the template: keep it
      if (o.material && o.material.dispose) o.material.dispose();
    });
  }

  // ── Feed ───────────────────────────────────────────────────────────────
  // summary = readnodes.shell64 → { active, sessions:[{sid, ts, n, op}], calcsPerMin, total, recent }
  function feed(summary) {
    if (!summary || typeof summary !== 'object') return;
    S.summary = summary; S.lastFeedAt = Date.now();
    var now = performance.now();
    (summary.sessions || []).forEach(function (s) { touch(s.sid, s.n, now); });
    S.rateTarget = Math.max(rateFromLocal(), Math.min(1, Math.log(1 + (summary.calcsPerMin || 0)) / Math.log(121)));
    ensureLoop();
  }
  function touch(sid, n, now) {
    if (!sid) return;
    var rec = S.local[sid] || (S.local[sid] = { n: -1, lastActiveAt: 0, calcTimes: [] });
    if (n == null || n !== rec.n) { rec.lastActiveAt = now; rec.calcTimes.push(now); if (rec.calcTimes.length > 60) rec.calcTimes.shift(); }
    if (n != null) rec.n = n;
  }
  function rateFromLocal() {
    var now = performance.now(), c = 0;
    Object.keys(S.local).forEach(function (k) { S.local[k].calcTimes.forEach(function (t) { if (now - t < 60000) c++; }); });
    return Math.min(1, Math.log(1 + c) / Math.log(121));
  }
  function onBroadcast(msg) {
    if (!msg || !msg.sid) return;
    var now = performance.now();
    if (msg.type === 'shell64calc') { touch(msg.sid, msg.total, now); S.rateTarget = Math.max(S.rateTarget, rateFromLocal(), 0.25); ensureLoop(); }
    else if (msg.type === 'shell64idle' && S.local[msg.sid]) S.local[msg.sid].lastActiveAt = Math.min(S.local[msg.sid].lastActiveAt, now - IDLE_FADE_AFTER_MS);
  }

  // ── Loop ───────────────────────────────────────────────────────────────
  function ensureLoop() { if (!S.raf && T) S.raf = requestAnimationFrame(tick); }

  function liveFeedOn() { return W._liveFeedEnabled !== false; }

  function tick() {
    S.raf = 0;
    var scene = W._brpnScene;
    if (!scene) { S.raf = requestAnimationFrame(tick); return; }
    if (scene !== S.scene) { // initBRPN re-ran (context restore / resize): move everything to the new scene
      Object.keys(S.nodes).forEach(function (k) { disposeNode(S.nodes[k]); }); S.nodes = {}; S.scene = scene;
    }
    loadTemplate();
    var now = performance.now(), t = (now - S.t0) / 1000;
    var dt = Math.min(0.25, Math.max(0.001, (now - (S.lastTick || now)) / 1000)); S.lastTick = now;
    function k(rate) { return 1 - Math.exp(-dt * rate); }   // frame-rate independent easing
    // which sessions want to be visible (newest first, capped)
    var want = Object.keys(S.local).map(function (sid) { return { sid: sid, at: S.local[sid].lastActiveAt }; })
      .filter(function (s) { return now - s.at < IDLE_FADE_AFTER_MS + FADE_MS; })
      .sort(function (a, b) { return b.at - a.at; }).slice(0, MAX_SESSIONS);
    if (!liveFeedOn()) want = [];
    var wantIds = {}; want.forEach(function (w) { wantIds[w.sid] = w; });
    // drop the long-dead
    Object.keys(S.local).forEach(function (sid) { if (now - S.local[sid].lastActiveAt > 120000) delete S.local[sid]; });

    if (S.template) {
      want.forEach(function (w) {
        if (S.nodes[w.sid]) return;
        var used = {}; Object.keys(S.nodes).forEach(function (k) { used[S.nodes[k].slot] = 1; });
        var slot = 0; while (used[slot]) slot++;
        if (slot < MAX_SESSIONS) S.nodes[w.sid] = makeNode(w.sid, slot);
      });
    }
    S.rateTarget *= Math.exp(-dt * 0.03);
    S.rate += (Math.max(S.rateTarget, rateFromLocal()) - S.rate) * k(2.4);
    var any = false;
    Object.keys(S.nodes).forEach(function (sid) {
      var nd = S.nodes[sid], rec = S.local[sid], w = wantIds[sid];
      var idleMs = rec ? now - rec.lastActiveAt : 1e9;
      var active = !!w && idleMs < IDLE_FADE_AFTER_MS;
      var fadeTarget = !w ? 0 : (idleMs < IDLE_FADE_AFTER_MS ? 1 : Math.max(0, 1 - (idleMs - IDLE_FADE_AFTER_MS) / FADE_MS));
      nd.fade += (fadeTarget - nd.fade) * k(fadeTarget > nd.fade ? 3.5 : 6.0);
      nd.act += ((active ? 1 : 0) - nd.act) * k(3.0);
      // emblem rises as activity starts (~2 s), eases back down as it idles
      nd.rise += ((active ? 1 : 0) - nd.rise) * k(active ? 1.6 : 1.1);
      if (!liveFeedOn()) nd.fade = 0;   // LIVE FEED off: gone at once, like the remote orbs
      if (nd.fade < 0.01 && !w) { disposeNode(nd); delete S.nodes[sid]; return; }
      any = true;
      animateNode(nd, t, S.rate, dt);
    });
    if (any || Object.keys(S.local).length) S.raf = requestAnimationFrame(tick);
  }

  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  function animateNode(nd, t, rate, dt) {
    var fr = dt * 60;   // rotation steps were tuned at 60 fps
    var a = nd.act, f = nd.fade;
    // wave-displace the spline like the other buoyancy splines
    var arr = nd.lineGeo.attributes.position.array, B = nd.base;
    for (var i = 0; i < B.length; i++) {
      var p = B[i], s = i / (B.length - 1), w = Math.sin(s * Math.PI);
      arr[i * 3] = p.x; arr[i * 3 + 1] = p.y + Math.sin(t * 2.1 + s * 9.0) * 0.03 * w; arr[i * 3 + 2] = p.z + Math.cos(t * 1.7 + s * 7.0) * 0.025 * w;
    }
    nd.lineGeo.attributes.position.needsUpdate = true;
    nd.line.material.opacity = (0.45 + 0.5 * a) * f; nd.tubeMat.opacity = (0.08 + 0.22 * a) * f;
    nd.phase = (nd.phase + (0.0025 + 0.008 * rate) * fr) % 1;
    nd.pulse.position.copy(nd.curve.getPointAt(nd.phase)); nd.pulse.material.opacity = 0.95 * f;
    // ride the curve: seat point at u, same wave as the spline so the rail never leaves the thighs
    var u = nd.u, p0 = nd.curve.getPointAt(u), tan = nd.curve.getTangentAt(u), sw = Math.sin(u * Math.PI);
    nd.root.position.set(p0.x, p0.y + Math.sin(t * 2.1 + u * 9.0) * 0.03 * sw, p0.z + Math.cos(t * 1.7 + u * 7.0) * 0.025 * sw);
    nd.root.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(tan.x, 0, tan.z).normalize());
    for (var m = 0; m < nd.mats.length; m++) { var U = nd.mats[m].uniforms; U.uTime.value = t; U.uAct.value = a; U.uRate.value = rate; U.uFade.value = f; }
    nd.sparkMat.uniforms.uTime.value = t; nd.sparkMat.uniforms.uAct.value = a; nd.sparkMat.uniforms.uRate.value = rate; nd.sparkMat.uniforms.uFade.value = f;
    nd.glare.material.opacity = (0.12 + 0.35 * a * (0.7 + 0.3 * Math.sin(t * (4.0 + 6.0 * rate)))) * f;
    // Shell 64 emblem: rise from the ring centre, hover + bob above their heads, counter-rotate the shells
    var e = nd.emblem, P = e.userData.parts, r = ease(Math.max(0, Math.min(1, nd.rise)));
    e.position.y = nd.restY + (nd.hoverY - nd.restY) * r + Math.sin(t * 1.6) * 0.06 * r;
    e.scale.setScalar(0.35 + 0.65 * r);
    var spin = (0.004 + 0.02 * a * (0.4 + rate)) * fr;
    P.outer.rotation.y += spin; P.outer.rotation.x = Math.sin(t * 0.3) * 0.15;
    P.middle.rotation.y -= spin * 1.4; P.middle.rotation.z += spin * 0.6;
    P.core.rotation.x += spin * 0.8; P.core.rotation.y += spin * 0.5;
    var beat = 0.5 + 0.5 * Math.sin(t * (3.0 + 7.0 * rate));
    P.gem.rotation.y += (0.03 + 0.05 * rate) * fr; P.gem.scale.setScalar(1 + 0.25 * beat * a);
    P.gemGlowMat.opacity = (0.35 + 0.5 * beat * a) * f;
    (e.userData.lineMats || []).forEach(function (lm) { lm.opacity = (0.3 + 0.4 * a) * f; });
  }

  function init() {
    if (S.inited) return; if (!W.THREE) { setTimeout(init, 500); return; }
    S.inited = true; T = W.THREE; S.t0 = performance.now();
    try { S.bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('leatr-shell64') : null; if (S.bc) S.bc.onmessage = function (e) { onBroadcast(e.data); }; } catch (e) {}
    ensureLoop();
  }

  W.Shell64Node = { init: init, feed: feed, state: S, TARGET: TARGET, MAX_SESSIONS: MAX_SESSIONS, _onBroadcast: onBroadcast, _buildSeatCurve: function (a) { return buildSeatCurve(a); },
    _buildEmblem: function () { return buildEmblem([]); },
    CONST: { OUTER_SHELL_R: OUTER_SHELL_R, CURVE_R: CURVE_R, THIGH_UNDERSIDE_FRAC: THIGH_UNDERSIDE_FRAC, SEAT_GAP: SEAT_GAP, IDLE_FADE_AFTER_MS: IDLE_FADE_AFTER_MS, FADE_MS: FADE_MS } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
