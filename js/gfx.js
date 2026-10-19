// Drawing the world with three.js: sky and sun through the day, the terrain, water and lava, trees and rocks in chunks,
// grass that sways around you, towers, shrines, the village, the castle, camps, and little things to pick up.
// Also particles, rain, and the map picture.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { W, HGRID, groundH, colorAt, normalAt, TREES, ROCKS, POI, CASTLE, VILLAGE, SPOT, regionAt, snowLine, roadDist, BOXES } from './world.js';
import { toon, glowMat, outline, makeNPC, weaponMesh } from './models.js';
import { hash2 } from './noise.js';

const N1 = W.n + 1;
const col3 = (h) => new THREE.Color(h);
function colored(geo, hex) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; }
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); if (s !== 1) g.scale(s, s, s); g.translate(x, y, z); return g; };

export function createGfx(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 2600);
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.86); composer.addPass(bloom); composer.addPass(new OutputPass());
  const world = new THREE.Group(), inside = new THREE.Group(); scene.add(world); scene.add(inside);

  // ---------------------------------------------------------------- light and sky
  const hemi = new THREE.HemisphereLight('#cfe6ff', '#5a6a3a', 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  const skyU = { top: { value: col3('#4a8ae8') }, hor: { value: col3('#cfe6f8') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: col3('#fff0c0') }, night: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float night; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
      void main(){ float y = max(vD.y, 0.0); vec3 c = mix(hor, top, pow(y, 0.55)); if (vD.y < 0.0) c = hor * 0.9;
        float s = max(dot(vD, sunDir), 0.0); c += sunCol * (pow(s, 600.0) * 2.5 + pow(s, 8.0) * 0.25);
        vec3 m = -sunDir; float mo = max(dot(vD, m), 0.0); c += vec3(0.9, 0.95, 1.0) * pow(mo, 900.0) * 2.0 * night;
        vec3 q = floor(vD * 260.0); float st = step(0.9975, h(q)) * night * smoothstep(0.0, 0.3, vD.y); c += vec3(st);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  scene.fog = new THREE.Fog('#cfe6f8', 160, 1100);
  // clouds: soft puffs drifting high up
  const cloudTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const clouds = new THREE.Group(); world.add(clouds);
  for (let i = 0; i < 46; i++) { const cl = new THREE.Group(); for (let k = 0; k < 5; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false })); s.scale.setScalar(60 + hash2(i, k, 3) * 60); s.position.set((k - 2) * 30, hash2(i, k, 4) * 14, hash2(i, k, 5) * 20); cl.add(s); } cl.position.set((hash2(i, 1, 9) - 0.5) * 2400, 330 + hash2(i, 2, 9) * 120, (hash2(i, 3, 9) - 0.5) * 2400); clouds.add(cl); }

  // ---------------------------------------------------------------- terrain
  {
    const pos = new Float32Array(N1 * N1 * 3), colr = new Float32Array(N1 * N1 * 3), idx = [];
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const k = j * N1 + i, x = -W.half + i * W.cell, z = -W.half + j * W.cell, h = HGRID[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const n = normalAt(x, z), sl = Math.acos(Math.min(1, n[1])) * 57.3, c = colorAt(x, z, h, sl);
      colr[k * 3] = c[0]; colr[k * 3 + 1] = c[1]; colr[k * 3 + 2] = c[2];
    }
    for (let j = 0; j < W.n; j++) for (let i = 0; i < W.n; i++) { const a = j * N1 + i, b = a + 1, c = a + N1, d = c + 1; idx.push(a, c, d, a, d, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setIndex(idx); g.computeVertexNormals();
    const terrain = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); terrain.receiveShadow = true; world.add(terrain);
    // a skirt of sea floor beyond the island
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: '#2a4a5a' })); floor.rotation.x = -Math.PI / 2; floor.position.y = -42; world.add(floor);
  }
  // water: a gently moving sheet with ripples
  const waterTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) { const x = hash2(i, 1) * 128, y = hash2(i, 2) * 128, r = 3 + hash2(i, 3) * 10, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(150,150,255,0.5)'); gr.addColorStop(1, 'rgba(128,128,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(220, 220); return t; })();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3400, 3400), new THREE.MeshPhongMaterial({ color: '#3a8ad8', transparent: true, opacity: 0.8, shininess: 90, specular: '#ffffff', normalMap: waterTex, normalScale: new THREE.Vector2(0.6, 0.6) }));
  water.rotation.x = -Math.PI / 2; water.position.y = W.sea + 0.02; water.receiveShadow = true; world.add(water);
  { const ly = groundH(SPOT.volcano.x, SPOT.volcano.z) + 3, lava = new THREE.Mesh(new THREE.CircleGeometry(48, 32), glowMat('#ff5a1a', 2.2)); lava.rotation.x = -Math.PI / 2; lava.position.set(SPOT.volcano.x, ly, SPOT.volcano.z); world.add(lava); }

  // ---------------------------------------------------------------- trees and rocks, in chunks that hide when far away
  const treeMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon('#fff').gradientMap });
  const TG = {
    oak: mergeGeometries([colored(at(new THREE.CylinderGeometry(0.3, 0.45, 3.2, 7), 0, 1.6, 0), '#6a4a2e'), colored(at(new THREE.IcosahedronGeometry(2.2, 1), 0, 4.4, 0), '#4a8a3a'), colored(at(new THREE.IcosahedronGeometry(1.5, 1), 1.2, 3.8, 0.6), '#5a9a42'), colored(at(new THREE.IcosahedronGeometry(1.4, 1), -1.1, 4.0, -0.5), '#3f7a34')]),
    apple: mergeGeometries([colored(at(new THREE.CylinderGeometry(0.3, 0.45, 3.2, 7), 0, 1.6, 0), '#6a4a2e'), colored(at(new THREE.IcosahedronGeometry(2.2, 1), 0, 4.4, 0), '#4a8a3a'), colored(at(new THREE.IcosahedronGeometry(1.5, 1), 1.2, 3.8, 0.6), '#5a9a42'),
      ...[[1.4, 3.6, 1.4], [-1.6, 4.4, 0.8], [0.4, 5.2, -1.8], [-0.6, 3.4, 1.9]].map(([x, y, z]) => colored(at(new THREE.IcosahedronGeometry(0.22, 0), x, y, z), '#e83a3a'))]),
    pine: mergeGeometries([colored(at(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), 0, 1.2, 0), '#5a3e28'), colored(at(new THREE.ConeGeometry(2.0, 3.2, 7), 0, 3.2, 0), '#2e6a3a'), colored(at(new THREE.ConeGeometry(1.6, 2.8, 7), 0, 4.8, 0), '#3a7a44'), colored(at(new THREE.ConeGeometry(1.0, 2.2, 7), 0, 6.2, 0), '#46884e')]),
    snowpine: mergeGeometries([colored(at(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), 0, 1.2, 0), '#5a3e28'), colored(at(new THREE.ConeGeometry(2.0, 3.2, 7), 0, 3.2, 0), '#2e5a4a'), colored(at(new THREE.ConeGeometry(1.6, 2.8, 7), 0, 4.8, 0), '#e8f0f8'), colored(at(new THREE.ConeGeometry(1.0, 2.2, 7), 0, 6.2, 0), '#f4f8fc')]),
    dead: mergeGeometries([colored(at(new THREE.CylinderGeometry(0.18, 0.35, 4.2, 6), 0, 2.1, 0), '#3a2e2a'), colored(at(new THREE.CylinderGeometry(0.08, 0.14, 1.8, 5), 0.6, 3.2, 0, 0, 0, -0.8), '#3a2e2a'), colored(at(new THREE.CylinderGeometry(0.07, 0.12, 1.5, 5), -0.5, 2.6, 0.2, 0.3, 0, 0.9), '#3a2e2a')]),
    cactus: mergeGeometries([colored(at(new THREE.CylinderGeometry(0.35, 0.4, 3.0, 8), 0, 1.5, 0), '#4a8a4a'), colored(at(new THREE.CylinderGeometry(0.2, 0.22, 1.2, 7), 0.6, 1.9, 0, 0, 0, 0), '#4a8a4a'), colored(at(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 7), 0.4, 1.4, 0, 0, 0, 1.57), '#4a8a4a')]),
  };
  const rockGeo = colored(new THREE.DodecahedronGeometry(1, 0), '#8a867c');
  const CH = 200, chunks = new Map();
  const chunkOf = (x, z) => `${Math.floor((x + W.half) / CH)},${Math.floor((z + W.half) / CH)}`;
  const byChunk = new Map(); const put = (k, type, m) => { let c = byChunk.get(k); if (!c) byChunk.set(k, (c = {})); (c[type] = c[type] || []).push(m); };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
  for (const t of TREES) { const type = t.apple ? 'apple' : t.type === 'pine' && t.y > snowLine(t.x, t.z) - 25 ? 'snowpine' : t.type; q.setFromEuler(e.set(0, t.rot, 0)); m4.compose(v.set(t.x, t.y - 0.2, t.z), q, sc.setScalar(t.s)); put(chunkOf(t.x, t.z), type, m4.clone()); }
  for (const r of ROCKS) { q.setFromEuler(e.set(r.rot, r.rot * 2, 0)); m4.compose(v.set(r.x, r.y + r.r * 0.15, r.z), q, sc.set(r.r, r.r * 0.75, r.r)); put(chunkOf(r.x, r.z), 'rock', m4.clone()); }
  for (const [k, types] of byChunk) {
    const grp = new THREE.Group(); const [ci, cj] = k.split(',').map(Number); grp.userData.c = [-W.half + (ci + 0.5) * CH, -W.half + (cj + 0.5) * CH];
    for (const [type, list] of Object.entries(types)) {
      const im = new THREE.InstancedMesh(type === 'rock' ? rockGeo : TG[type], treeMat, list.length);
      list.forEach((mm, i) => im.setMatrixAt(i, mm)); im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); grp.add(im);
    }
    world.add(grp); chunks.set(k, grp);
  }
  // ---------------------------------------------------------------- grass around the player
  // a blade: two faces (one each way) with normals pointing up, so both sides catch the light like the ground
  const bladeGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.05, 0, 0, 0.05, 0, 0, 0.0, 0.46, 0.02, -0.05, 0, 0, 0.0, 0.46, 0.02, 0.05, 0, 0]), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3)); return g; })();
  const grassU = { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3() } };
  const grassMat = new THREE.MeshLambertMaterial();
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = grassU.uTime; sh.uniforms.uPlayer = grassU.uPlayer;
    sh.vertexShader = 'uniform float uTime; uniform vec3 uPlayer;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float hh = position.y;
      transformed.x += sin(uTime * 2.1 + wp.x * 0.35 + wp.z * 0.2) * 0.14 * hh; transformed.z += cos(uTime * 1.6 + wp.z * 0.4) * 0.07 * hh;
      vec2 away = wp.xz - uPlayer.xz; float dd = length(away); if (dd < 1.2) transformed.xz += normalize(away + 0.001) * (1.2 - dd) * 0.5 * hh;`);
  };
  const GMAX = 9000, grass = new THREE.InstancedMesh(bladeGeo, grassMat, GMAX); grass.count = 0; grass.receiveShadow = true; grass.frustumCulled = false;
  grass.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GMAX * 3), 3); world.add(grass);
  let grassKey = '';
  function updateGrass(px, pz, on) {
    grass.visible = on; if (!on) return;
    const T = 6, ti = Math.floor(px / T), tj = Math.floor(pz / T), key = ti + ',' + tj; if (key === grassKey) return; grassKey = key;
    let n = 0; const RR = 5, cc = new THREE.Color();
    for (let b = -RR; b <= RR; b++) for (let a = -RR; a <= RR; a++) {
      if (a * a + b * b > RR * RR + 1) continue;
      const tx = (ti + a) * T, tz = (tj + b) * T, reg = regionAt(tx, tz);
      if (reg === 'desert' || reg === 'volcano') continue;
      const h0 = groundH(tx + 3, tz + 3); if (h0 < 1.5 || h0 > snowLine(tx, tz) - 12) continue;
      const base = colorAt(tx + 3, tz + 3, h0, 10);
      for (let k = 0; k < 80 && n < GMAX; k++) {
        const x = tx + hash2(ti + a, tj + b, k * 3) * T, z = tz + hash2(ti + a, tj + b, k * 3 + 1) * T, h = groundH(x, z);
        if (h < 1.2 || roadDist(x, z) < 2.6) continue;
        const nn = normalAt(x, z); if (nn[1] < 0.8) continue;
        const s = 0.7 + hash2(x | 0, z | 0, 7) * 0.8;
        q.setFromEuler(e.set(0, hash2(k, a, b) * 6.28, 0)); m4.compose(v.set(x, h - 0.03, z), q, sc.set(s, s, s)); grass.setMatrixAt(n, m4);
        const f = 0.85 + hash2(k, b, a) * 0.3; cc.setRGB(base[0] * f * 1.05, base[1] * f * 1.12, base[2] * f); grass.setColorAt(n, cc); n++;
      }
    }
    grass.count = n; grass.instanceMatrix.needsUpdate = true; grass.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- places
  const places = { towers: {}, shrines: {}, greats: {}, chests: {}, ores: {}, plants: {}, seeds: {}, pots: {}, fires: [] };
  const stone = toon('#7a766c'), dark = toon('#4a4640'), wood = toon('#8a5a32'), roofR = toon('#a84a3a');
  const mesh = (geo, mat, x, y, z, parent = world) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const fireTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 40, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,200,1)'); gr.addColorStop(0.4, 'rgba(255,150,40,0.8)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const glowSprite = (x, y, z, s, color = '#ffffff', parent = world) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(x, y, z); sp.scale.setScalar(s); parent.add(sp); return sp; };
  function fire(x, z, parent) { const y = groundH(x, z); for (let i = 0; i < 4; i++) mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 5), toon('#5a3a22'), x, y + 0.1, z, parent).rotation.set(1.5, i * 0.8, 0); const f = glowSprite(x, y + 0.6, z, 1.6, '#ffffff', parent); places.fires.push(f); return f; }
  // towers: a dark stone spire with glowing seams, orange until you wake it, then blue
  for (const t of POI.towers) {
    const g = new THREE.Group(); world.add(g); const seams = [];
    for (const [hw, y0, y1] of t.segs) {
      mesh(new THREE.BoxGeometry(hw * 2, y1 - y0, hw * 2), dark, t.x, (y0 + y1) / 2, t.z, g);
      mesh(new THREE.BoxGeometry(hw * 2 + 0.1, 0.35, hw * 2 + 0.1), stone, t.x, y1 - 0.17, t.z, g);
      for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2, s = mesh(new THREE.BoxGeometry(0.35, y1 - y0 - 2, 0.1), glowMat('#ff8a2a', 1.5), t.x + Math.sin(a) * (hw + 0.02), (y0 + y1) / 2, t.z + Math.cos(a) * (hw + 0.02), g); s.rotation.y = a; seams.push(s); }
    }
    const term = mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.1, 8), stone, t.x, t.top + 0.55, t.z, g);
    const orb = mesh(new THREE.SphereGeometry(0.32, 12, 10), glowMat('#ff8a2a', 2.5), t.x, t.top + 1.4, t.z, g);
    places.towers[t.id] = { g, seams, orb, term };
  }
  // shrines: a stone platform under an arch with a glowing ring (orange, blue when done)
  for (const s of POI.shrines) {
    const g = new THREE.Group(); world.add(g);
    mesh(new THREE.BoxGeometry(6, 2.35, 6), stone, s.x, s.y - 0.8, s.z, g);
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.8, 4.2, 0.8), dark, s.x + sx * 2.1, s.y + 2.4, s.z - 1.6, g);
    mesh(new THREE.BoxGeometry(5.2, 0.8, 1.0), dark, s.x, s.y + 4.6, s.z - 1.6, g);
    const ring = mesh(new THREE.TorusGeometry(1.5, 0.12, 8, 28), glowMat('#ff8a2a', 2), s.x, s.y + 2.3, s.z - 1.6, g);
    const pad = mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.08, 24), glowMat('#ff8a2a', 1.2), s.x, s.y + 0.4, s.z, g);
    places.shrines[s.id] = { g, ring, pad };
  }
  // great shrines: a tall pedestal under a huge floating crystal in the region's colour
  const GREAT_COL = { north: '#8ad8ff', volcano: '#ff6a3a', east: '#4ae0c8', desert: '#ffd040' };
  for (const s of POI.greats) {
    const g = new THREE.Group(); world.add(g);
    mesh(new THREE.BoxGeometry(6, 2.35, 6), stone, s.x, s.y - 0.8, s.z, g);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; mesh(new THREE.BoxGeometry(0.9, 7, 0.9), dark, s.x + Math.sin(a) * 4.2, s.y + 3, s.z + Math.cos(a) * 4.2, g); }
    const cr = mesh(new THREE.OctahedronGeometry(2.2, 0), glowMat('#b02a5a', 1.6), s.x, s.y + 9, s.z, g); cr.scale.y = 1.7;
    const pad = mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.08, 24), glowMat('#b02a5a', 1.2), s.x, s.y + 0.4, s.z, g);
    places.greats[s.id] = { g, cr, pad, col: GREAT_COL[s.region] };
  }
  // the village: houses with gabled roofs, a goddess statue, lanterns
  for (const h of POI.houses) {
    const wall = toon(h.role === 'shop' ? '#e8d8b0' : h.role === 'inn' ? '#e0c8a8' : '#ece4d0'), roof = h.role === 'elder' ? toon('#5a4a8a') : h.role === 'leaf' ? toon('#4a8a3a') : roofR;
    mesh(new THREE.BoxGeometry(h.w, h.h + 2, h.d), wall, h.x, h.y + h.h / 2 - 1, h.z);
    const r = mesh(new THREE.ConeGeometry(Math.max(h.w, h.d) * 0.78, 3, 4), roof, h.x, h.y + h.h + 1.5, h.z); r.rotation.y = Math.PI / 4; r.scale.set(h.w / Math.max(h.w, h.d), 1, h.d / Math.max(h.w, h.d));
    mesh(new THREE.BoxGeometry(1.2, 2.2, 0.1), toon('#6a4426'), h.x, h.y + 1.1, h.z + h.d / 2 + 0.03);
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.9, 0.9, 0.08), glowMat('#ffd890', 0.6), h.x + sx * h.w * 0.3, h.y + 2.6, h.z + h.d / 2 + 0.04);
  }
  for (const [dx, dz] of [[-10, -6], [10, -6], [-10, 16], [10, 18]]) { const x = VILLAGE.x + dx, z = VILLAGE.z + dz, y = groundH(x, z); mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), toon('#3a3a3a'), x, y + 1.3, z); mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), glowMat('#ffd890', 1.5), x, y + 2.7, z); }
  // the hermit's cabin and the chamber where you wake
  { const x = SPOT.hermit.x, z = SPOT.hermit.z, y = groundH(x, z); mesh(new THREE.BoxGeometry(7, 4, 6), wood, x, y + 1.6, z); const r = mesh(new THREE.ConeGeometry(5.5, 2.6, 4), toon('#6a5a4a'), x, y + 4.8, z); r.rotation.y = Math.PI / 4; mesh(new THREE.BoxGeometry(0.8, 2.4, 0.8), stone, x + 2, y + 5, z - 1); fire(x + 5, z + 5); }
  { const x = SPOT.start.x, z = SPOT.start.z, y = groundH(x, z); mesh(new THREE.BoxGeometry(8, 0.5, 8), stone, x, y, z); for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(1, 5, 1), dark, x + sx * 3.4, y + 2.5, z - 3.4); mesh(new THREE.BoxGeometry(8, 1, 1.2), dark, x, y + 5.2, z - 3.4); mesh(new THREE.BoxGeometry(2.4, 0.6, 1.2), glowMat('#40c8ff', 0.8), x, y + 0.5, z - 1.5); }
  // the grove and its sword
  { const x = SPOT.grove.x, z = SPOT.grove.z, y = groundH(x, z); mesh(new THREE.CylinderGeometry(1.4, 1.8, 0.8, 10), stone, x, y + 0.4, z); const sw = weaponMesh('w_dawn'); sw.position.set(x, y + 0.6, z); sw.rotation.x = Math.PI; sw.position.y += 1.3; world.add(sw); places.dawn = sw; glowSprite(x, y + 1.8, z, 3, '#a8e8ff'); }
  // the castle: dark walls and towers, the keep wrapped in red-violet gloom
  {
    const cstone = toon('#5a5866');
    for (const b of BOXES) if (b.castle && b !== CASTLE.keep) mesh(new THREE.BoxGeometry(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]), cstone, (b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    const k = CASTLE.keep; mesh(new THREE.BoxGeometry(k.max[0] - k.min[0], k.max[1] - k.min[1], k.max[2] - k.min[2]), toon('#4a4858'), (k.min[0] + k.max[0]) / 2, (k.min[1] + k.max[1]) / 2, (k.min[2] + k.max[2]) / 2);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = CASTLE.x + dx * CASTLE.half, z = CASTLE.z + dz * CASTLE.half, y = groundH(x, z); mesh(new THREE.CylinderGeometry(5, 5.5, CASTLE.y + 26 - y, 12), cstone, x, (CASTLE.y + 26 + y) / 2, z); mesh(new THREE.ConeGeometry(6, 9, 12), toon('#3a3448'), x, CASTLE.y + 30.5, z); }
    for (const dx of [-10, 0, 10]) { mesh(new THREE.CylinderGeometry(3, 3.4, 26, 10), toon('#4a4858'), CASTLE.x + dx, k.max[1] + 13, CASTLE.z - 47); mesh(new THREE.ConeGeometry(4, 12, 10), toon('#2a2438'), CASTLE.x + dx, k.max[1] + 32, CASTLE.z - 47); }
    places.gloom = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = 22 + (i % 3) * 6, s = mesh(new THREE.SphereGeometry(4 + (i % 4), 12, 10), glowMat(i % 2 ? '#7a1a4a' : '#4a1a5a', 0.9), CASTLE.x + Math.cos(a) * r, k.max[1] + 4 + (i % 5) * 6, CASTLE.z - 47 + Math.sin(a) * r * 0.6); s.userData.a = a; places.gloom.push(s); }
    const ring = mesh(new THREE.TorusGeometry(CASTLE.arena.r, 0.3, 6, 60), glowMat('#ff2a5a', 1.4), CASTLE.arena.x, CASTLE.arena.y + 0.2, CASTLE.arena.z); ring.rotation.x = Math.PI / 2; places.arenaRing = ring;
  }
  // camps: tents, a campfire, a lookout for archers
  for (const c of POI.camps) {
    fire(c.x, c.z);
    for (let i = 0; i < 2; i++) { const a = i * 2.4 + 0.8, x = c.x + Math.cos(a) * 6, z = c.z + Math.sin(a) * 6, y = groundH(x, z); const t = mesh(new THREE.ConeGeometry(2.2, 2.8, 4), toon(i ? '#8a6a4a' : '#a8885a'), x, y + 1.3, z); t.rotation.y = a; }
    if (c.archer) { const x = c.x - 6, z = c.z + 4, y = groundH(x, z); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 5), wood, x + a, y + 2.5, z + b); mesh(new THREE.BoxGeometry(2.6, 0.3, 2.6), wood, x, y + 5, z); }
  }
  // cooking pots on a fire
  for (const p of POI.pots) { const g = new THREE.Group(); world.add(g); fire(p.x, p.z, g); const pot = mesh(new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#2a2a2a'), p.x, p.y + 1.0, p.z, g); pot.rotation.x = Math.PI; places.pots[p.id] = g; }
  // ore deposits, chests, plants, leaf-sprite hiding places
  for (const o of POI.ores) { const g = new THREE.Group(); world.add(g); mesh(new THREE.DodecahedronGeometry(1.1, 0), toon('#6a6460'), o.x, o.y + 0.6, o.z, g).scale.set(1, 0.8, 1); for (let i = 0; i < 4; i++) mesh(new THREE.OctahedronGeometry(0.22, 0), glowMat(o.rich ? '#ffd040' : '#e06aff', 0.8), o.x + Math.cos(i * 1.6) * 0.8, o.y + 0.7 + (i % 2) * 0.4, o.z + Math.sin(i * 1.6) * 0.8, g); places.ores[o.id] = g; }
  for (const c of POI.chests) { const g = new THREE.Group(); g.position.set(c.x, c.y, c.z); world.add(g); mesh(new THREE.BoxGeometry(1.1, 0.6, 0.75), toon('#8a5a2a'), 0, 0.3, 0, g); const lid = new THREE.Group(); lid.position.set(0, 0.6, -0.37); g.add(lid); mesh(new THREE.BoxGeometry(1.14, 0.3, 0.78), toon('#a06a32'), 0, 0.15, 0.39, lid); mesh(new THREE.BoxGeometry(1.16, 0.12, 0.8), toon('#e0b840'), 0, 0.42, 0, g); places.chests[c.id] = { g, lid }; }
  const PLANT = { apple: () => [new THREE.SphereGeometry(0.16, 8, 6), toon('#e83a3a')], shroom: () => [new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon('#c89a6a')],
    radish: () => [new THREE.SphereGeometry(0.2, 8, 6), toon('#f4f0f0')], stamella: () => [new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon('#d8f04a')], pepper: () => [new THREE.ConeGeometry(0.1, 0.32, 6), toon('#ff4a2a')] };
  for (const p of POI.plants) { const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); world.add(g); const [geo, mat] = PLANT[p.item](); const m = mesh(geo, mat, 0, p.item === 'shroom' || p.item === 'stamella' ? 0.18 : 0.16, 0, g); if (p.item === 'shroom' || p.item === 'stamella') mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6), toon('#f0e8d0'), 0, 0.09, 0, g); if (p.item === 'radish') mesh(new THREE.ConeGeometry(0.12, 0.35, 5), toon('#5aa040'), 0, 0.42, 0, g); void m; glowSprite(p.x, p.y + 0.5, p.z, 0.35, '#fff6c0', g).position.set(0, 0.5, 0); places.plants[p.id] = g; }
  for (const s of POI.seeds) {
    const g = new THREE.Group(); g.position.set(s.x, s.y, s.z); world.add(g);
    if (s.kind === 'rock') { for (let i = 0; i < 7; i++) mesh(new THREE.DodecahedronGeometry(0.18, 0), toon('#bcb8ac'), Math.cos(i * 0.9) * 1.4, 0.1, Math.sin(i * 0.9) * 1.4, g); g.userData.rock = mesh(new THREE.DodecahedronGeometry(0.55, 0), toon('#a8a49a'), 0, 0.35, 0, g); }
    else { g.userData.leaf = mesh(new THREE.OctahedronGeometry(0.35, 0), glowMat('#8aff6a', 1.6), 0, 1.6, 0, g); g.userData.leaf.scale.set(0.6, 1, 0.3); glowSprite(0, 1.6, 0, 1.4, '#aaffaa', g); }
    places.seeds[s.id] = g;
  }

  // ---------------------------------------------------------------- particles and rain
  const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const parts = [];
  function burst(p, { n = 12, color = '#ffffff', speed = 4, life = 0.7, size = 0.4, up = 2, add = true, grav = 6 } = {}) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
      s.position.set(p.x, p.y, p.z); s.scale.setScalar(size); scene.add(s);
      const a = Math.random() * 6.28, b = Math.random() * 2 - 1;
      parts.push({ s, vx: Math.cos(a) * speed * Math.sqrt(1 - b * b), vy: up + b * speed * 0.6, vz: Math.sin(a) * speed * Math.sqrt(1 - b * b), life, max: life, size, grav });
    }
  }
  const rainGeo = new THREE.BufferGeometry(), RN = 1600, rainPos = new Float32Array(RN * 6); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#c8d8f0', transparent: true, opacity: 0.45 })); rain.frustumCulled = false; scene.add(rain); rain.visible = false;
  for (let i = 0; i < RN; i++) { rainPos[i * 6] = (Math.random() - 0.5) * 60; rainPos[i * 6 + 1] = Math.random() * 30; rainPos[i * 6 + 2] = (Math.random() - 0.5) * 60; }

  // ---------------------------------------------------------------- time of day and weather
  const K = [ // hour: sky top, horizon, sun colour, sun power, ambient
    [0, '#060a1e', '#1a2440', '#8aa0ff', 0.25, 0.35], [4.5, '#0a1028', '#2a3050', '#8aa0ff', 0.2, 0.35], [6, '#3a5aa8', '#f0a878', '#ffb070', 1.4, 0.7],
    [8, '#4a8ae8', '#cfe6f8', '#fff4e0', 2.6, 1.1], [16, '#4a8ae8', '#cfe6f8', '#fff4e0', 2.6, 1.1], [18.2, '#3a4a98', '#f08a5a', '#ff9a5a', 1.4, 0.75],
    [19.6, '#0c1430', '#2a2a50', '#8aa0ff', 0.25, 0.38], [24, '#060a1e', '#1a2440', '#8aa0ff', 0.25, 0.35],
  ];
  const ca = new THREE.Color(), cb = new THREE.Color();
  let night = 0;
  function setTime(hour, rainy, pos) {
    let i = 0; while (i < K.length - 2 && hour > K[i + 1][0]) i++;
    const [h0, t0, z0, s0, p0, a0] = K[i], [h1, t1, z1, s1, p1, a1] = K[i + 1], f = Math.min(1, Math.max(0, (hour - h0) / (h1 - h0)));
    skyU.top.value.copy(ca.set(t0).lerp(cb.set(t1), f)); skyU.hor.value.copy(ca.set(z0).lerp(cb.set(z1), f)); skyU.sunCol.value.copy(ca.set(s0).lerp(cb.set(s1), f));
    const ang = ((hour - 6) / 12) * Math.PI, sd = new THREE.Vector3(Math.cos(ang) * 0.8, Math.sin(ang), 0.35).normalize();
    night = Math.max(0, Math.min(1, -sd.y * 4 + 0.2)); skyU.night.value = night;
    const lightDir = sd.y > 0 ? sd : sd.clone().negate();             // the moon lights the night
    skyU.sunDir.value.copy(sd);
    sun.intensity = (p0 + (p1 - p0) * f) * (rainy ? 0.45 : 1); sun.color.copy(skyU.sunCol.value);
    hemi.intensity = (a0 + (a1 - a0) * f) * (rainy ? 0.8 : 1);
    if (rainy) { skyU.top.value.lerp(ca.set('#5a6070'), 0.7); skyU.hor.value.lerp(ca.set('#8a90a0'), 0.7); }
    scene.fog.color.copy(skyU.hor.value); scene.fog.near = rainy ? 60 : 160; scene.fog.far = rainy ? 520 : 1100;
    sun.position.set(pos.x + lightDir.x * 120, pos.y + lightDir.y * 120, pos.z + lightDir.z * 120); sun.target.position.copy(pos); sun.target.updateMatrixWorld();
    rain.visible = rainy && !inside.visible;
  }

  // ---------------------------------------------------------------- the map picture
  let mapCanvas = null;
  function mapPicture() {
    if (mapCanvas) return mapCanvas;
    const c = document.createElement('canvas'); c.width = c.height = N1; const g = c.getContext('2d'), img = g.createImageData(N1, N1);
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const x = -W.half + i * W.cell, z = -W.half + j * W.cell, h = HGRID[j * N1 + i], n = normalAt(x, z), sl = Math.acos(Math.min(1, n[1])) * 57.3;
      let cc = h < 0 ? [0.25, 0.5, 0.75 - Math.min(0.3, -h / 100)] : colorAt(x, z, h, sl);
      const shade = 0.75 + (n[0] * -0.5 + n[2] * -0.5 + n[1]) * 0.3, k = (j * N1 + i) * 4;
      img.data[k] = Math.min(255, cc[0] * shade * 255); img.data[k + 1] = Math.min(255, cc[1] * shade * 255); img.data[k + 2] = Math.min(255, cc[2] * shade * 255); img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0); mapCanvas = c; return c;
  }

  // ---------------------------------------------------------------- each frame
  let t = 0, quality = 1;
  function frame(dt, focus) {
    t += dt; grassU.uTime.value = t; sky.position.copy(camera.position);      // the sky dome travels with you, so it is never cut off grassU.uPlayer.value.set(focus.x, focus.y, focus.z);
    waterTex.offset.set(t * 0.004, t * 0.003);
    for (const f of places.fires) f.scale.setScalar(1.5 + Math.sin(t * 13 + f.position.x) * 0.15);
    for (const s of places.gloom || []) s.position.y += Math.sin(t * 0.8 + s.userData.a * 3) * 0.02;
    clouds.position.x = (t * 2) % 600;
    // hide far chunks
    for (const c of chunks.values()) { const [cx, cz] = c.userData.c; c.visible = Math.hypot(cx - camera.position.x, cz - camera.position.z) < 900; }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { scene.remove(p.s); p.s.material.dispose(); parts.splice(i, 1); continue; } p.vy -= p.grav * dt; p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt; p.s.material.opacity = p.life / p.max; }
    if (rain.visible) { for (let i = 0; i < RN; i++) { let y = rainPos[i * 6 + 1] - dt * 26; if (y < 0) y += 30; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 4] = y + 0.7; rainPos[i * 6 + 3] = rainPos[i * 6]; rainPos[i * 6 + 5] = rainPos[i * 6 + 2]; } rainGeo.attributes.position.needsUpdate = true; rain.position.set(camera.position.x, camera.position.y - 12, camera.position.z); }
    composer.render(dt);
  }
  function resize(w, h, dpr) { const pr = Math.min(dpr, 2) * quality; renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function setInside(on) { world.visible = !on; inside.visible = on; sky.visible = !on; scene.fog.near = on ? 30 : 160; scene.fog.far = on ? 140 : 1100; if (on) { scene.fog.color.set('#0a0e16'); scene.background = new THREE.Color('#0a0e16'); } else scene.background = null; }
  return { renderer, scene, camera, world, inside, places, frame, resize, setTime, updateGrass, burst, glowSprite, fireTex, mapPicture, setInside, mesh, dotTex,
    setQuality(qv) { quality = qv; sun.shadow.mapSize.set(qv < 1 ? 1024 : 2048, qv < 1 ? 1024 : 2048); }, get night() { return night; } };
}
