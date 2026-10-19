// Everyone and everything that moves, built from simple shapes with soft cel shading and dark outlines:
// the hero (with poses for walking, climbing, gliding, swimming, fighting), goblins, ogres, ancient sentinels, boars,
// villagers, shrine monks, the final foe, and every weapon, bow and shield.
import * as THREE from 'three';
import { WEAPONS, BOWS, SHIELDS, OUTFITS } from './items.js';

// ---------------------------------------------------------------- materials
const grad = (() => { const d = new Uint8Array([70, 150, 210, 255]); const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const mats = new Map();
export function toon(col, o = {}) {
  const k = col + JSON.stringify(o); let m = mats.get(k);
  if (!m) { m = new THREE.MeshToonMaterial({ color: col, gradientMap: grad, ...o }); mats.set(k, m); }
  return m;
}
export const glowMat = (col, i = 2) => toon(col, { emissive: col, emissiveIntensity: i });
const OUT = new THREE.MeshBasicMaterial({ color: '#141018', side: THREE.BackSide });
// a dark rim around a model: each part again, a little bigger, drawn inside out
export function outline(g, w = 0.045) {
  const add = [];
  g.traverse((o) => { if (o.isMesh && !o.userData.noOutline && o.material !== OUT) { const m = new THREE.Mesh(o.geometry, OUT); m.userData.noOutline = true; m.userData.isOutline = true; const s = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere); const k = 1 + w / Math.max(0.05, s.radius); m.scale.setScalar(k); add.push([o, m]); } });
  for (const [o, m] of add) o.add(m);
  return g;
}
const geoCache = new Map();
const G = (k, f) => { let g = geoCache.get(k); if (!g) { g = f(); geoCache.set(k, g); } return g; };
const box = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const sph = (r, a = 12, b = 10) => G(`s${r},${a}`, () => new THREE.SphereGeometry(r, a, b));
const cyl = (r1, r2, h, n = 10) => G(`c${r1},${r2},${h},${n}`, () => new THREE.CylinderGeometry(r1, r2, h, n));
const cone = (r, h, n = 10) => G(`k${r},${h},${n}`, () => new THREE.ConeGeometry(r, h, n));
const M = (geo, mat, x = 0, y = 0, z = 0, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; if (parent) parent.add(m); return m; };
const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// ---------------------------------------------------------------- weapons, bows, shields, the glider
export function weaponMesh(id) {
  const w = WEAPONS[id], g = new THREE.Group(); if (!w) return g;
  const metal = toon(w.col), wood = toon('#6a4426'), L = w.kind === 'spear' ? 2.3 : w.kind === 'two' ? 1.5 : 1.0;
  if (id === 'w_branch' || id === 'w_torch' || id === 'w_club' || id === 'w_spiked' || id === 'w_dragonbone') {
    M(cyl(0.05, id === 'w_branch' ? 0.04 : 0.09, L, 7), toon(w.col), 0, L / 2, 0, g);
    if (id === 'w_torch') M(sph(0.12, 8, 6), glowMat('#ffb040', 3), 0, L + 0.05, 0, g);
    if (id === 'w_spiked') for (let i = 0; i < 4; i++) M(cone(0.04, 0.14, 5), toon('#c0c0c0'), Math.cos(i * 1.57) * 0.09, L * 0.8, Math.sin(i * 1.57) * 0.09, g).rotation.set(Math.sin(i * 1.57) * 1.57, 0, -Math.cos(i * 1.57) * 1.57);
  } else if (w.kind === 'spear') {
    M(cyl(0.03, 0.03, L, 6), wood, 0, L / 2, 0, g); M(cone(0.07, 0.35, 6), metal, 0, L + 0.15, 0, g);
    if (id === 'w_halberd') M(box(0.32, 0.18, 0.03), metal, 0.12, L - 0.1, 0, g);
  } else if (id === 'w_axe') {
    M(cyl(0.035, 0.035, L, 6), wood, 0, L / 2, 0, g); M(box(0.32, 0.26, 0.05), toon('#9aa0a8'), 0.14, L - 0.15, 0, g);
  } else {
    const bw = w.kind === 'two' ? 0.13 : 0.08;
    M(box(bw, L, 0.025), metal, 0, L / 2 + 0.12, 0, g); M(box(bw * 3, 0.05, 0.06), toon('#c8a040'), 0, 0.12, 0, g); M(cyl(0.025, 0.025, 0.2, 6), wood, 0, 0.0, 0, g);
    if (id === 'w_ancient' || id === 'w_dawn') M(box(bw * 0.4, L * 0.9, 0.03), glowMat(id === 'w_dawn' ? '#a8e8ff' : '#40e0ff', 1.6), 0, L / 2 + 0.12, 0.002, g);
  }
  g.userData.len = L;
  return g;
}
export function bowMesh(id) {
  const b = BOWS[id], g = new THREE.Group(); if (!b) return g;
  const arc = new THREE.Mesh(G('bowarc', () => new THREE.TorusGeometry(0.55, 0.03, 5, 14, Math.PI * 0.9)), toon(b.col)); arc.rotation.z = Math.PI / 2 - Math.PI * 0.45; g.add(arc);
  const str = M(cyl(0.006, 0.006, 1.06, 3), toon('#f0f0f0'), -0.17, 0, 0, g); str.userData.noOutline = true;
  return g;
}
export function shieldMesh(id) {
  const s = SHIELDS[id], g = new THREE.Group(); if (!s) return g;
  if (id === 's_potlid') { const d = M(cyl(0.3, 0.3, 0.05, 14), toon(s.col), 0, 0, 0, g); d.rotation.x = Math.PI / 2; M(sph(0.05, 6, 5), toon('#5a4a3a'), 0, 0, 0.04, g); }
  else { M(box(0.55, 0.7, 0.06), toon(s.col), 0, 0, 0, g); M(box(0.12, 0.5, 0.07), toon('#e8d8a0'), 0, 0, 0.01, g); if (s.laser) M(box(0.4, 0.06, 0.08), glowMat('#40e0ff', 2), 0, 0.1, 0.01, g); }
  return g;
}
export function gliderMesh() {
  const g = new THREE.Group(), shape = new THREE.Shape(); shape.moveTo(-1.1, 0); shape.lineTo(0, 0.5); shape.lineTo(1.1, 0); shape.lineTo(0, -0.12); shape.closePath();
  const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), toon('#e8dcc0', { side: THREE.DoubleSide })); wing.rotation.x = -Math.PI / 2; g.add(wing);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.5), toon('#c83a3a', { side: THREE.DoubleSide })); stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, 0.005, -0.2); g.add(stripe);
  M(cyl(0.02, 0.02, 0.9, 4), toon('#6a4426'), 0.45, -0.4, 0, g).rotation.z = 0.5; M(cyl(0.02, 0.02, 0.9, 4), toon('#6a4426'), -0.45, -0.4, 0, g).rotation.z = -0.5;
  return g;
}

// ---------------------------------------------------------------- the hero
export function makeHero() {
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0);
  const skin = toon('#f2c8a0'), hair = toon('#e0b050'), P = {};
  P.hips = pivot(body, 0, 0.92, 0);
  P.torso = M(box(0.42, 0.5, 0.26), toon('#3a6aa8'), 0, 0.27, 0, P.hips);
  P.belt = M(box(0.44, 0.07, 0.28), toon('#6a4a2a'), 0, 0.05, 0, P.hips);
  P.headP = pivot(P.hips, 0, 0.58, 0);
  P.head = M(sph(0.2, 14, 12), skin, 0, 0.12, 0, P.headP);
  P.hair = M(sph(0.215, 14, 10), hair, 0, 0.17, -0.03, P.headP); P.hair.scale.set(1, 0.85, 1.05);
  M(box(0.1, 0.24, 0.08), hair, 0, 0.0, -0.17, P.headP);                                    // a short tail of hair
  for (const s of [-1, 1]) M(sph(0.028, 6, 5), toon('#2a2a3a'), s * 0.07, 0.12, 0.18, P.headP);
  for (const s of [-1, 1]) { const e = M(cone(0.04, 0.12, 5), skin, s * 0.21, 0.12, 0, P.headP); e.rotation.z = -s * 1.35; }
  for (const [nm, s] of [['armL', 1], ['armR', -1]]) {
    const a = P[nm] = pivot(P.hips, s * 0.27, 0.48, 0);
    P[nm + 'u'] = M(box(0.12, 0.3, 0.12), toon('#3a6aa8'), 0, -0.14, 0, a);
    const fore = P[nm + 'f'] = pivot(a, 0, -0.3, 0); M(box(0.1, 0.28, 0.1), skin, 0, -0.13, 0, fore);
    P[nm + 'h'] = pivot(fore, 0, -0.3, 0);
  }
  for (const [nm, s] of [['legL', 1], ['legR', -1]]) {
    const l = P[nm] = pivot(P.hips, s * 0.11, 0, 0);
    P[nm + 'm'] = M(box(0.15, 0.46, 0.16), toon('#8a6a4a'), 0, -0.23, 0, l);
    M(box(0.16, 0.12, 0.24), toon('#5a3a22'), 0, -0.86 + 0.42, 0.03, l);
  }
  P.back = pivot(P.hips, 0, 0.3, -0.18);
  P.glider = gliderMesh(); P.glider.position.set(0, 2.1, 0); P.glider.visible = false; body.add(P.glider);
  outline(root, 0.04);
  root.userData.P = P; root.userData.body = body;
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return root;
}
export function setOutfit(hero, id) {
  const o = OUTFITS[id] || OUTFITS.traveler, P = hero.userData.P;
  P.torso.material = toon(o.col[0]); P.armLu.material = toon(o.col[0]); P.armRu.material = toon(o.col[0]); P.legLm.material = toon(o.col[1]); P.legRm.material = toon(o.col[1]);
}
// gear in hand / on the back: { weapon, bow, shield } ids; hold: 'weapon' | 'bow' | null
export function setGear(hero, gear, hold) {
  const P = hero.userData.P, key = JSON.stringify([gear, hold]); if (hero.userData.gearKey === key) return; hero.userData.gearKey = key;
  for (const s of [P.armRh, P.armLh, P.back]) for (const c of [...s.children]) s.remove(c);
  const wpn = gear.weapon ? outline(weaponMesh(gear.weapon), 0.02) : null, bow = gear.bow ? outline(bowMesh(gear.bow), 0.02) : null, sh = gear.shield ? outline(shieldMesh(gear.shield), 0.02) : null;
  if (wpn) { if (hold === 'weapon') { wpn.rotation.x = Math.PI / 2; P.armRh.add(wpn); } else { wpn.rotation.set(0, 0, 2.5); wpn.position.set(0.08, -0.25, -0.02); P.back.add(wpn); } }
  if (bow) { if (hold === 'bow') { bow.rotation.set(0, Math.PI / 2, 0); P.armLh.add(bow); } else { bow.rotation.set(0, 0, -0.6); bow.position.set(-0.05, 0.05, -0.04); P.back.add(bow); } }
  if (sh) { if (hold === 'weapon' || hold === 'shield') { sh.position.set(0.08, 0.05, 0.02); sh.rotation.y = Math.PI / 2; P.armLh.add(sh); } else { sh.position.set(0, 0, -0.06); P.back.add(sh); } }
}
// pose the hero: s = { mode, speed, t, attack (0..1 or -1), kind, aim, block, climbMove, swimMove, dead, hop }
export function poseHero(hero, s) {
  const P = hero.userData.P, body = hero.userData.body, t = s.t;
  const set = (o, x = 0, y = 0, z = 0) => o.rotation.set(x, y, z);
  for (const k of ['hips', 'armL', 'armR', 'legL', 'legR', 'armLf', 'armRf', 'headP']) set(P[k]);
  P.hips.position.set(0, 0.92, 0); body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); P.glider.visible = false;
  if (s.dead) { body.rotation.x = -1.5; body.position.y = 0.25; return; }
  const sp = s.speed;
  if (s.mode === 'ground') {
    const f = sp > 6 ? 13 : sp > 3 ? 10 : 7, a = Math.min(1, sp / 5) * (sp > 6 ? 0.95 : 0.7), ph = t * f;
    set(P.legL, Math.sin(ph) * a); set(P.legR, -Math.sin(ph) * a);
    set(P.armL, -Math.sin(ph) * a * 0.8); set(P.armR, Math.sin(ph) * a * 0.8); set(P.armLf, -0.3 * a); set(P.armRf, -0.3 * a);
    P.hips.position.y = 0.92 + Math.abs(Math.sin(ph)) * 0.05 * a + (sp < 0.2 ? Math.sin(t * 2) * 0.008 : 0);
    if (sp > 6) P.hips.rotation.x = 0.25;
    if (s.land > 0) { P.hips.position.y -= s.land * 0.6; set(P.legL, -0.6 * s.land * 3); set(P.legR, -0.6 * s.land * 3); }
  } else if (s.mode === 'air') {
    set(P.legL, -0.6); set(P.legR, 0.3); set(P.armL, -0.4, 0, 0.5); set(P.armR, -0.4, 0, -0.5);
  } else if (s.mode === 'glide') {
    P.glider.visible = true; set(P.armL, Math.PI, 0, -0.25); set(P.armR, Math.PI, 0, 0.25); set(P.legL, 0.15); set(P.legR, -0.1); body.rotation.x = 0.12;
  } else if (s.mode === 'climb') {
    const ph = s.climbMove ? t * 7 : 0;
    set(P.armL, Math.PI * 0.85 + Math.sin(ph) * 0.4); set(P.armR, Math.PI * 0.85 - Math.sin(ph) * 0.4); set(P.legL, -0.5 + Math.sin(ph) * 0.4); set(P.legR, -0.5 - Math.sin(ph) * 0.4);
    set(P.armLf, -0.3); set(P.armRf, -0.3); body.position.z = -0.12;
    if (s.hop > 0) body.position.y = Math.sin(s.hop * 10) * 0.3;
  } else if (s.mode === 'swim') {
    const ph = t * (s.swimMove ? 6 : 2);
    body.rotation.x = s.swimMove ? 1.1 : 0.3; body.position.y = s.swimMove ? 0.9 : 0.2;
    set(P.armL, -2.6 + Math.sin(ph) * 1.2, 0, 0.3); set(P.armR, -2.6 - Math.sin(ph) * 1.2, 0, -0.3); set(P.legL, Math.sin(ph * 1.3) * 0.5); set(P.legR, -Math.sin(ph * 1.3) * 0.5);
  }
  // the fighting arms
  if (s.block) { set(P.armL, -1.4, 0.5, 0); set(P.armLf, -0.5); }
  if (s.aim) { set(P.armL, -1.55, 0.2, 0); set(P.armR, -1.5, -0.5, 0); set(P.armRf, -1.6); set(P.headP, 0, 0.15, 0); }
  if (s.attack >= 0) {
    const a = s.attack, k = s.kind;
    if (k === 'spear') { set(P.armR, -1.5, 0, 0); P.armR.position.z = Math.sin(a * Math.PI) * 0.5; set(P.armRf, 0); P.hips.rotation.y = -0.2; }
    else if (k === 'spin') { set(P.armR, -1.5, 0, 0); body.rotation.y = a * Math.PI * 2; }
    else { const sw = k === 'two' ? 2.6 : 2.2, st = s.combo % 2 ? -1 : 1; set(P.armR, -2.4 + a * sw, st * 0.6 - a * st * 1.2, 0); set(P.armRf, -0.2); P.hips.rotation.y = st * (0.4 - a * 0.8); }
  } else P.armR.position.z = 0;
}

// ---------------------------------------------------------------- enemies and animals
export function makeGoblin(tier = 0) {
  const col = ['#d85a4a', '#4a6ad8', '#3a3040', '#e8e0d0'][tier] || '#d85a4a', root = new THREE.Group(), P = {}, skin = toon(col);
  P.hips = pivot(root, 0, 0.62, 0);
  M(sph(0.36, 12, 10), skin, 0, 0.25, 0, P.hips).scale.set(1, 1.1, 0.9);
  M(box(0.5, 0.18, 0.44), toon('#8a6a3a'), 0, -0.02, 0, P.hips);
  P.headP = pivot(P.hips, 0, 0.62, 0.02);
  M(sph(0.3, 12, 10), skin, 0, 0.05, 0, P.headP);
  M(sph(0.12, 8, 6), toon('#f0e0a0'), 0, 0.05, 0.27, P.headP).scale.set(1.3, 0.8, 0.8);        // snout
  for (const s of [-1, 1]) { M(sph(0.06, 8, 6), toon('#ffffff'), s * 0.11, 0.14, 0.24, P.headP); M(sph(0.03, 6, 5), toon('#1a1010'), s * 0.11, 0.14, 0.29, P.headP); const e = M(cone(0.08, 0.3, 5), skin, s * 0.3, 0.12, 0, P.headP); e.rotation.z = -s * 1.2; }
  M(cone(0.06, 0.22, 6), toon('#f0e0c0'), 0, 0.38, 0, P.headP);
  for (const [nm, s] of [['armL', 1], ['armR', -1]]) { P[nm] = pivot(P.hips, s * 0.38, 0.35, 0); M(cyl(0.07, 0.06, 0.5, 6), skin, 0, -0.25, 0, P[nm]); P[nm + 'h'] = pivot(P[nm], 0, -0.5, 0); }
  for (const [nm, s] of [['legL', 1], ['legR', -1]]) { P[nm] = pivot(P.hips, s * 0.16, -0.05, 0); M(cyl(0.09, 0.08, 0.52, 6), skin, 0, -0.27, 0, P[nm]); }
  outline(root, 0.05); root.userData.P = P; root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return root;
}
export function makeOgre() {
  const root = new THREE.Group(), P = {}, skin = toon('#7a6ab8');
  P.hips = pivot(root, 0, 1.6, 0);
  M(sph(0.9, 14, 12), skin, 0, 0.6, 0, P.hips).scale.set(1, 1.15, 0.85);
  M(box(1.3, 0.4, 1.0), toon('#5a4a3a'), 0, -0.05, 0, P.hips);
  P.headP = pivot(P.hips, 0, 1.6, 0.1); M(sph(0.55, 12, 10), skin, 0, 0, 0, P.headP);
  M(sph(0.22, 8, 6), toon('#e8d0b0'), 0, -0.05, 0.48, P.headP);
  for (const s of [-1, 1]) { M(sph(0.1, 8, 6), toon('#ffe040'), s * 0.2, 0.12, 0.45, P.headP); M(cone(0.1, 0.5, 6), toon('#f0e0c0'), s * 0.32, 0.45, 0, P.headP).rotation.z = -s * 0.5; }
  for (const [nm, s] of [['armL', 1], ['armR', -1]]) { P[nm] = pivot(P.hips, s * 1.0, 1.05, 0); M(cyl(0.22, 0.2, 1.3, 8), skin, 0, -0.65, 0, P[nm]); P[nm + 'h'] = pivot(P[nm], 0, -1.3, 0); }
  for (const [nm, s] of [['legL', 1], ['legR', -1]]) { P[nm] = pivot(P.hips, s * 0.4, -0.1, 0); M(cyl(0.26, 0.24, 1.5, 8), skin, 0, -0.75, 0, P[nm]); }
  const club = new THREE.Group(); M(cyl(0.12, 0.22, 2.0, 8), toon('#6a4426'), 0, 1.0, 0, club); club.rotation.x = Math.PI / 2; P.armRh.add(club);
  outline(root, 0.06); root.userData.P = P; root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return root;
}
export function makeSentinel(small = false) {
  const root = new THREE.Group(), P = {}, k = small ? 0.45 : 1, shell = toon('#8a8478'), dark = toon('#3a3a40');
  P.hips = pivot(root, 0, 2.3 * k, 0);
  const dome = M(G('dome' + k, () => new THREE.SphereGeometry(1.4 * k, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), shell, 0, 0, 0, P.hips);
  M(cyl(1.42 * k, 1.3 * k, 0.5 * k, 18), dark, 0, -0.2 * k, 0, P.hips);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; M(box(0.12 * k, 0.5 * k, 0.04), glowMat('#ff9a3a', 1.2), Math.sin(a) * 1.25 * k, 0.45 * k, Math.cos(a) * 1.25 * k, P.hips).rotation.y = a; }
  P.eyeP = pivot(P.hips, 0, 0.9 * k, 0);
  P.eye = M(sph(0.32 * k, 12, 10), toon('#2a2a30'), 0, 0, 0.95 * k, P.eyeP);
  P.pupil = M(sph(0.18 * k, 10, 8), glowMat('#40c8ff', 3), 0, 0, 1.22 * k, P.eyeP);
  P.legs = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5, L = pivot(P.hips, Math.sin(a) * 1.1 * k, -0.3 * k, Math.cos(a) * 1.1 * k); L.rotation.y = a; const seg = M(cyl(0.1 * k, 0.07 * k, 2.4 * k, 6), dark, 0, -1.0 * k, 0.4 * k, L); seg.rotation.x = 0.4; P.legs.push(L); }
  outline(root, 0.05); root.userData.P = P; root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return root;
}
export function makeBoar() {
  const root = new THREE.Group(), P = {}, fur = toon('#6a4a32');
  P.hips = pivot(root, 0, 0.55, 0);
  M(sph(0.5, 12, 10), fur, 0, 0.05, 0, P.hips).scale.set(0.8, 0.75, 1.3);
  P.headP = pivot(P.hips, 0, 0.05, 0.6); M(sph(0.3, 10, 8), fur, 0, 0, 0.1, P.headP); M(cyl(0.1, 0.12, 0.15, 8), toon('#c88a7a'), 0, -0.02, 0.38, P.headP).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) M(cone(0.03, 0.16, 5), toon('#f0e8d0'), s * 0.12, -0.08, 0.36, P.headP).rotation.x = -1.2;
  P.legs = [];
  for (const [x, z] of [[-0.22, 0.35], [0.22, 0.35], [-0.22, -0.35], [0.22, -0.35]]) { const l = pivot(P.hips, x, -0.2, z); M(cyl(0.07, 0.06, 0.38, 6), fur, 0, -0.18, 0, l); P.legs.push(l); }
  outline(root, 0.04); root.userData.P = P; return root;
}
export function makeNPC(look) {
  const C = { elder: ['#7a5aa8', '#e8e8e8', '#e8c8a8'], merchant: ['#c88a3a', '#3a2a1a', '#f0c8a0'], innkeep: ['#c84a5a', '#5a3a2a', '#f2c8a0'], leaf: ['#5aa04a', '#3a6a2a', '#a8d080'],
    kid: ['#e8c040', '#8a5a2a', '#f6d0a8'], hermit: ['#8a6a4a', '#d8d8d8', '#e8c0a0'], monk: ['#40c8ff', '#e8f8ff', '#a8e8ff'] }[look] || ['#8a8a8a', '#5a5a5a', '#f0c8a0'];
  const root = new THREE.Group(), P = {};
  if (look === 'statue') { M(box(1.4, 0.6, 1.4), toon('#9a9488'), 0, 0.3, 0, root); M(cyl(0.45, 0.65, 2.6, 10), toon('#c8c0b0'), 0, 1.9, 0, root); M(sph(0.4, 12, 10), toon('#d8d0c0'), 0, 3.5, 0, root); for (const s of [-1, 1]) M(box(1.2, 0.1, 0.3), toon('#d8d0c0'), s * 0.7, 2.9, -0.1, root).rotation.z = s * 0.5; outline(root); return root; }
  P.hips = pivot(root, 0, 0.85, 0);
  const robe = look === 'elder' || look === 'hermit' || look === 'monk';
  M(robe ? cyl(0.22, 0.42, 1.0, 10) : box(0.42, 0.55, 0.28), toon(C[0]), 0, robe ? -0.1 : 0.25, 0, P.hips);
  P.headP = pivot(P.hips, 0, 0.6, 0); M(sph(0.2, 12, 10), toon(C[2]), 0, 0.1, 0, P.headP);
  if (look === 'leaf') { for (let i = 0; i < 5; i++) M(cone(0.12, 0.35, 5), toon('#4a9a3a'), Math.cos(i * 1.26) * 0.12, 0.35, Math.sin(i * 1.26) * 0.12, P.headP).rotation.set(Math.sin(i * 1.26) * 0.5, 0, -Math.cos(i * 1.26) * 0.5); }
  else if (look === 'hermit' || look === 'elder') { M(cone(0.26, 0.5, 10), toon(look === 'hermit' ? '#6a5a4a' : '#5a3a8a'), 0, 0.42, 0, P.headP); M(sph(0.14, 8, 6), toon('#f0f0f0'), 0, -0.05, 0.14, P.headP).scale.set(1, 1.4, 0.7); }
  else if (look === 'monk') { M(cone(0.24, 0.3, 10), toon('#e8f8ff'), 0, 0.3, 0, P.headP); }
  else M(sph(0.21, 12, 8), toon(C[1]), 0, 0.17, -0.03, P.headP).scale.set(1, 0.8, 1);
  for (const s of [-1, 1]) M(sph(0.025, 6, 5), toon('#2a2a3a'), s * 0.07, 0.12, 0.18, P.headP);
  for (const [nm, s] of [['armL', 1], ['armR', -1]]) { P[nm] = pivot(P.hips, s * 0.27, 0.45, 0); M(box(0.11, 0.55, 0.11), toon(C[0]), 0, -0.27, 0, P[nm]); }
  if (!robe) for (const [nm, s] of [['legL', 1], ['legR', -1]]) { P[nm] = pivot(P.hips, s * 0.1, 0, 0); M(box(0.14, 0.85, 0.15), toon(C[1]), 0, -0.42, 0, P[nm]); }
  if (look === 'monk') root.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.75; o.material.emissive = new THREE.Color('#40a8ff'); o.material.emissiveIntensity = 0.6; } });
  if (look === 'kid') root.scale.setScalar(0.72);
  outline(root, 0.035); root.userData.P = P; root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return root;
}
// the Gloomshade: a towering shape of dark smoke with one burning eye and two great arms
export function makeBoss() {
  const root = new THREE.Group(), P = {}, dark = toon('#2a1028'), glow = glowMat('#ff2a5a', 2.6);
  P.hips = pivot(root, 0, 3.5, 0);
  P.core = M(sph(2.2, 18, 14), dark, 0, 0, 0, P.hips); P.core.scale.set(1, 1.3, 0.9);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, s = M(sph(0.9, 10, 8), dark, Math.sin(a) * 1.8, -1.6 + (i % 2) * 0.6, Math.cos(a) * 1.2, P.hips); s.userData.wob = i; }
  P.eye = M(sph(0.55, 14, 12), glow, 0, 1.2, 1.85, P.hips);
  for (const s of [-1, 1]) M(cone(0.35, 1.6, 6), toon('#4a1a3a'), s * 1.0, 2.6, 0, P.hips).rotation.z = -s * 0.6;
  for (const [nm, s] of [['armL', 1], ['armR', -1]]) {
    P[nm] = pivot(P.hips, s * 2.2, 0.8, 0); M(cyl(0.45, 0.3, 3.4, 8), dark, 0, -1.7, 0, P[nm]);
    for (let f = 0; f < 3; f++) M(cone(0.14, 0.9, 5), glow, (f - 1) * 0.25, -3.7, 0.1, P[nm]).rotation.x = Math.PI;
  }
  outline(root, 0.08); root.userData.P = P; root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return root;
}
