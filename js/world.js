// The land of Windborne: a 1.6 km island shaped by noise and a few hand-placed landmarks (a plateau you can only leave by
// gliding, a castle in the middle, snowy peaks in the north, a volcano, a lake and an eastern coast, a desert, a forest).
// Everything here is plain math so the physics and the node tests can use it; js/gfx.js turns it into meshes.
import { simplex, rng, hash2, smooth, lerp, clamp } from './noise.js';

export const W = { size: 1600, half: 800, n: 256, sea: 0 };
W.cell = W.size / W.n;
const nA = simplex(11), nB = simplex(23), nC = simplex(37), nD = simplex(51), nE = simplex(77);
const fbm = (f, x, y, o) => { let s = 0, a = 1, fr = 1, t = 0; for (let i = 0; i < o; i++) { s += a * f(x * fr, y * fr); t += a; a *= 0.5; fr *= 2.03; } return s / t; };
const ridged = (f, x, y, o) => { let s = 0, a = 1, fr = 1, t = 0; for (let i = 0; i < o; i++) { const v = 1 - Math.abs(f(x * fr, y * fr)); s += a * v * v; t += a; a *= 0.5; fr *= 2.1; } return s / t; };
const dist = (x, z, a, b) => Math.hypot(x - a, z - b);

// landmarks
export const SPOT = {
  plateau: { x: 0, z: 470, r: 150, h: 108 }, castle: { x: 0, z: -20 }, village: { x: 360, z: 130 }, volcano: { x: 470, z: -430 },
  desert: { x: -460, z: 420 }, lake: { x: 320, z: 400 }, grove: { x: -560, z: -90 }, hermit: { x: 62, z: 528 }, start: { x: -84, z: 532 },
};
export const REGIONS = [
  { id: 'plateau', name: ['黎明台地', 'Dawn Plateau'], x: 0, z: 470 },
  { id: 'central', name: ['中央平原', 'Heartland'], x: 0, z: -20 },
  { id: 'north', name: ['霜嶺', 'Frostspire Peaks'], x: -60, z: -520 },
  { id: 'volcano', name: ['赤炎山', 'Emberpeak'], x: 470, z: -430 },
  { id: 'east', name: ['碧水湖岸', 'Azure Shore'], x: 440, z: 220 },
  { id: 'desert', name: ['金砂沙漠', 'Goldsand Desert'], x: -460, z: 420 },
  { id: 'forest', name: ['迷霧森林', 'Mistwood'], x: -500, z: -60 },
];
export function regionAt(x, z) {
  if (dist(x, z, SPOT.plateau.x, SPOT.plateau.z) < 165) return 'plateau';
  let best = null, bd = 1e9;
  for (const r of REGIONS) { if (r.id === 'plateau') continue; const d = dist(x, z, r.x, r.z) * (r.id === 'central' ? 0.8 : 1); if (d < bd) { bd = d; best = r.id; } }
  return best;
}
// roads (dirt paths that tie the places together)
export const ROADS = [
  [[0, 318], [10, 220], [-10, 120], [0, 50]], [[50, -10], [160, 40], [270, 100], [330, 125]], [[380, 100], [430, 0], [450, -170], [440, -300]],
  [[-50, 20], [-170, 130], [-300, 260], [-390, 360]], [[-60, -30], [-220, -50], [-380, -70], [-500, -70]], [[-20, -90], [-50, -200], [-70, -320]],
];
function roadDist(x, z) {
  let best = 1e9;
  for (const r of ROADS) for (let i = 0; i < r.length - 1; i++) {
    const [ax, az] = r[i], [bx, bz] = r[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

// ---------------------------------------------------------------- the shape of the land
export function rawH(x, z) {
  const e = Math.max(Math.abs(x), Math.abs(z)) + nD(x / 150, z / 150) * 40;
  let h = 22 + fbm(nA, x / 380, z / 380, 5) * 34 + fbm(nB, x / 90, z / 90, 3) * 4;
  const north = smooth(-170, -470, z);                                                          // snowy ridges
  if (north > 0) h += north * (30 + ridged(nC, x / 230, z / 230, 4) * 220);
  const dv = dist(x, z, SPOT.volcano.x, SPOT.volcano.z);                                         // the volcano and its crater
  h += 245 * Math.pow(Math.max(0, 1 - dv / 300), 1.7) - 70 * smooth(55, 0, dv);
  h -= smooth(430, 700, x) * 80;                                                                // the eastern sea
  h -= 55 * smooth(150, 40, dist(x, z, SPOT.lake.x, SPOT.lake.z));                              // the lake
  const wd = smooth(380, 230, dist(x, z, SPOT.desert.x, SPOT.desert.z));                        // low dunes
  if (wd > 0) h = lerp(h, 16 + Math.abs(nB(x / 70, z / 46)) * 10 + fbm(nA, x / 300, z / 300, 2) * 6, wd);
  h += 30 * Math.exp(-(dist(x, z, SPOT.castle.x, SPOT.castle.z) ** 2) / (2 * 110 * 110));      // the castle hill
  const cb = Math.max(Math.abs(x - SPOT.castle.x), Math.abs(z - SPOT.castle.z));               // ... levelled into a terrace inside the walls
  h = lerp(h, 52, smooth(92, 74, cb));
  h = lerp(h, 30, smooth(95, 55, dist(x, z, SPOT.village.x, SPOT.village.z)));                   // the village valley
  const dp = dist(x, z, SPOT.plateau.x, SPOT.plateau.z) + nD(x / 60, z / 60) * 14;              // the plateau and its cliffs
  h = lerp(h, SPOT.plateau.h + fbm(nB, x / 70, z / 70, 3) * 6, smooth(160, 141, dp));
  return lerp(h, -40, smooth(640, 780, e));                                                     // the island's coast
}

// ---------------------------------------------------------------- the height grid (physics uses the same triangles as the mesh)
const N1 = W.n + 1;
export const HGRID = new Float32Array(N1 * N1);
for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) HGRID[j * N1 + i] = rawH(-W.half + i * W.cell, -W.half + j * W.cell);
export function groundH(x, z) {
  const fx = clamp((x + W.half) / W.cell, 0, W.n - 1e-6), fz = clamp((z + W.half) / W.cell, 0, W.n - 1e-6);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const h00 = HGRID[j * N1 + i], h10 = HGRID[j * N1 + i + 1], h01 = HGRID[(j + 1) * N1 + i], h11 = HGRID[(j + 1) * N1 + i + 1];
  return v > u ? h00 + (h11 - h01) * u + (h01 - h00) * v : h00 + (h10 - h00) * u + (h11 - h10) * v;
}
export function normalAt(x, z) {
  const d = 1.2, gx = (groundH(x + d, z) - groundH(x - d, z)) / (2 * d), gz = (groundH(x, z + d) - groundH(x, z - d)) / (2 * d), l = Math.hypot(gx, 1, gz);
  return [-gx / l, 1 / l, -gz / l];
}
export const slopeDeg = (x, z) => Math.acos(clamp(normalAt(x, z)[1], -1, 1)) * 180 / Math.PI;
export const snowLine = (x, z) => 150 + nE(x / 120, z / 120) * 14;
export const isCold = (x, z, y) => y > snowLine(x, z) - 20 && regionAt(x, z) === 'north';

// ---------------------------------------------------------------- colours (vertex colours and the map)
const C = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const COL = { grass: C('#7ab04a'), grass2: C('#5e9a3e'), forest: C('#3f7a34'), sand: C('#e2c88c'), beach: C('#d8c890'), wet: C('#8a8060'), rock: C('#8c8678'),
  snow: C('#f2f4fa'), volc: C('#6a524a'), ash: C('#8a766a'), road: C('#b8a070'), plateau: C('#86b850'), lava: C('#ff6a20') };
export function colorAt(x, z, h, slope) {
  if (h < -0.5) return mixc(COL.wet, [0.2, 0.3, 0.4], clamp(-h / 30, 0, 0.7));
  const reg = regionAt(x, z), n = nE(x / 40, z / 40) * 0.5 + 0.5;
  let c = mixc(COL.grass, COL.grass2, n);
  if (reg === 'forest' || (reg === 'central' && forestNoise(x, z) > 0.62)) c = mixc(COL.forest, COL.grass2, n * 0.5);
  if (reg === 'plateau') c = mixc(COL.plateau, COL.grass2, n * 0.6);
  const wd = smooth(360, 250, dist(x, z, SPOT.desert.x, SPOT.desert.z)); if (wd > 0) c = mixc(c, mixc(COL.sand, COL.beach, n), wd);
  const dv = dist(x, z, SPOT.volcano.x, SPOT.volcano.z); if (dv < 290) c = mixc(c, mixc(COL.volc, COL.ash, n), smooth(290, 200, dv));
  if (dv < 60 && h < 200) c = mixc(c, COL.lava, smooth(60, 30, dv) * 0.8);
  if (h < 2.5) c = mixc(c, COL.beach, smooth(2.5, 0.5, h));
  if (roadDist(x, z) < 3.2 && h > 1) c = mixc(c, COL.road, 0.85);
  if (slope > 38) c = mixc(c, dv < 290 ? COL.volc : COL.rock, smooth(38, 52, slope));
  if (h > snowLine(x, z) && dv > 300) c = mixc(c, slope > 50 ? mixc(COL.rock, COL.snow, 0.4) : COL.snow, smooth(0, 12, h - snowLine(x, z)));
  return c;
}
export const forestNoise = (x, z) => fbm(nC, x / 160 + 9, z / 160 - 4, 3) * 0.5 + 0.5;

// ---------------------------------------------------------------- finding good spots
const R = rng(20261018);
export function landNear(x, z, maxSlope = 22, minH = 3) {
  for (let r = 0; r < 140; r += 3) for (let k = 0; k < Math.max(1, r); k++) {
    const a = (k / Math.max(1, r)) * Math.PI * 2 + r, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    const h = groundH(px, pz); if (h > minH && slopeDeg(px, pz) < maxSlope) return [px, pz];
  }
  return [x, z];
}
const okLand = (x, z, maxSlope = 24) => { const h = groundH(x, z); return h > 3 && slopeDeg(x, z) < maxSlope && Math.abs(x) < 700 && Math.abs(z) < 700; };
const pt = (o, x, z) => ({ ...o, x, z, y: groundH(x, z) });

// ---------------------------------------------------------------- places
export const POI = { towers: [], shrines: [], greats: [], camps: [], ogres: [], sentinels: [], seeds: [], pots: [], ores: [], plants: [], boars: [], chests: [], houses: [], npcs: [] };
const keepOut = [];        // [x, z, r] areas where nothing random is placed
const far = (x, z, list, d) => list.every((p) => dist(x, z, p.x, p.z) > d);
const clear = (x, z) => keepOut.every(([a, b, r]) => dist(x, z, a, b) > r);
// towers: one per region; activating one reveals that region on the map
const TOWER_AT = { plateau: [44, 430], central: [140, 40], north: [-150, -360], volcano: [330, -290], east: [420, 260], desert: [-380, 330], forest: [-420, -150] };
for (const [reg, [x0, z0]] of Object.entries(TOWER_AT)) { const [x, z] = landNear(x0, z0, 18, 4); POI.towers.push(pt({ id: 't_' + reg, region: reg }, x, z)); keepOut.push([x, z, 14]); }
// the start, the hermit, the village, the castle, the grove
keepOut.push([SPOT.start.x, SPOT.start.z, 14], [SPOT.hermit.x, SPOT.hermit.z, 16], [SPOT.village.x, SPOT.village.z, 75], [SPOT.castle.x, SPOT.castle.z, 120], [SPOT.grove.x, SPOT.grove.z, 22]);
// shrines: four on the plateau teach the runes; two in each other region; four great shrines hold the champions' gifts
const PLATEAU_SHRINES = [['magnet', -70, 420], ['bomb', 92, 498], ['ice', -30, 586], ['stasis', 100, 410]];
PLATEAU_SHRINES.forEach(([kind, x0, z0], i) => { const [x, z] = landNear(x0, z0, 16, 60); POI.shrines.push(pt({ id: 's_p' + i, kind, teach: kind, region: 'plateau', name: shrineName(i) }, x, z)); keepOut.push([x, z, 12]); });
const KINDS = ['magnet', 'bomb', 'ice', 'stasis', 'combat', 'combo'];
let sn = 4;
for (const reg of ['central', 'north', 'volcano', 'east', 'desert', 'forest']) {
  const c = REGIONS.find((r) => r.id === reg); let got = 0;
  for (let t = 0; t < 4000 && got < 2; t++) {
    const x = c.x + (R() - 0.5) * 420, z = c.z + (R() - 0.5) * 420;
    if (regionAt(x, z) !== reg || !okLand(x, z, 18) || !clear(x, z) || !far(x, z, POI.shrines, 150) || groundH(x, z) > 175) continue;
    POI.shrines.push(pt({ id: 's_' + sn, kind: KINDS[sn % KINDS.length], region: reg, name: shrineName(sn) }, x, z)); keepOut.push([x, z, 12]); sn++; got++;
  }
}
const GREAT = [['north', 'gale', -40, -560], ['volcano', 'protect', 455, -350], ['east', 'grace', 520, 120], ['desert', 'fury', -540, 480]];
for (const [reg, gift, x0, z0] of GREAT) { const [x, z] = landNear(x0, z0, 20, 5); POI.greats.push(pt({ id: 'g_' + reg, region: reg, gift }, x, z)); keepOut.push([x, z, 18]); }
function shrineName(i) {
  const zh = ['卡奧之祠', '妲奈之祠', '歐雅之祠', '梅歐之祠', '塔羅之祠', '希亞之祠', '凱瑪之祠', '沃拉之祠', '辛達之祠', '莫諾之祠', '賽納之祠', '雷歐之祠', '阿卡之祠', '奧蘭之祠', '菲恩之祠', '伊茲之祠'];
  const en = ['Ka\'o Shrine', 'Dana Shrine', 'Oya Shrine', 'Meo Shrine', 'Taro Shrine', 'Shia Shrine', 'Kema Shrine', 'Vola Shrine', 'Sinda Shrine', 'Mono Shrine', 'Sena Shrine', 'Reo Shrine', 'Aka Shrine', 'Oran Shrine', 'Fien Shrine', 'Izu Shrine'];
  return [zh[i % zh.length], en[i % en.length]];
}
// goblin camps: two small ones on the plateau, more across the land
for (const [x0, z0, n] of [[-20, 470, 2], [70, 590, 2]]) { const [x, z] = landNear(x0, z0, 18, 60); POI.camps.push(pt({ id: 'c_p' + POI.camps.length, size: n, region: 'plateau' }, x, z)); keepOut.push([x, z, 14]); }
for (let t = 0; t < 6000 && POI.camps.length < 22; t++) {
  const x = (R() - 0.5) * 1300, z = (R() - 0.5) * 1300, reg = regionAt(x, z);
  if (reg === 'plateau' || !okLand(x, z, 15) || !clear(x, z) || !far(x, z, POI.camps, 120) || groundH(x, z) > 150) continue;
  POI.camps.push(pt({ id: 'c_' + POI.camps.length, size: 2 + Math.floor(R() * 3), region: reg, archer: R() < 0.5 }, x, z)); keepOut.push([x, z, 14]);
}
// ogres, sentinels (ancient machines, thickest around the castle)
for (let t = 0; t < 4000 && POI.ogres.length < 6; t++) {
  const x = (R() - 0.5) * 1200, z = (R() - 0.5) * 1100;
  if (regionAt(x, z) === 'plateau' || !okLand(x, z, 18) || !clear(x, z) || !far(x, z, POI.ogres, 220)) continue;
  POI.ogres.push(pt({ id: 'o_' + POI.ogres.length }, x, z));
}
for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + 0.3, r = 170 + (k % 3) * 40, [x, z] = landNear(SPOT.castle.x + Math.cos(a) * r, SPOT.castle.z + Math.sin(a) * r, 25, 3); POI.sentinels.push(pt({ id: 'g' + k, walk: k % 3 === 0 }, x, z)); }
for (let t = 0; t < 3000 && POI.sentinels.length < 16; t++) {
  const x = (R() - 0.5) * 1100, z = (R() - 0.5) * 1000;
  if (['plateau', 'north'].includes(regionAt(x, z)) || !okLand(x, z, 20) || !clear(x, z) || !far(x, z, POI.sentinels, 150)) continue;
  POI.sentinels.push(pt({ id: 'g' + POI.sentinels.length, dormant: true }, x, z));
}
// leaf sprites: lift a strange rock, or reach a high, lonely peak
for (let t = 0; t < 8000 && POI.seeds.filter((s) => s.kind === 'rock').length < 26; t++) {
  const x = (R() - 0.5) * 1340, z = (R() - 0.5) * 1340;
  if (!okLand(x, z, 30) || !clear(x, z) || !far(x, z, POI.seeds, 70)) continue;
  POI.seeds.push(pt({ id: 'k' + POI.seeds.length, kind: 'rock' }, x, z));
}
{
  const peaks = [];
  for (let j = 6; j < W.n - 6; j += 2) for (let i = 6; i < W.n - 6; i += 2) {
    const h = HGRID[j * N1 + i]; if (h < 45) continue;
    let top = true; for (let b = -5; b <= 5 && top; b++) for (let a = -5; a <= 5; a++) if (HGRID[(j + b) * N1 + i + a] > h) { top = false; break; }
    if (top) peaks.push({ x: -W.half + i * W.cell, z: -W.half + j * W.cell, h });
  }
  peaks.sort((a, b) => b.h - a.h);
  for (const p of peaks) { if (POI.seeds.filter((s) => s.kind === 'peak').length >= 16) break; if (far(p.x, p.z, POI.seeds, 60) && clear(p.x, p.z)) POI.seeds.push(pt({ id: 'k' + POI.seeds.length, kind: 'peak' }, p.x, p.z)); }
}
// cooking pots at every tower foot, the village, the hermit's cabin and some camps
for (const t of POI.towers) POI.pots.push(pt({ id: 'pot_' + t.id }, t.x + 8, t.z + 3));
POI.pots.push(pt({ id: 'pot_village' }, SPOT.village.x + 8, SPOT.village.z + 14), pt({ id: 'pot_hermit' }, SPOT.hermit.x + 5, SPOT.hermit.z + 5));
POI.camps.forEach((c, i) => { if (i % 2 === 0) POI.pots.push(pt({ id: 'pot_' + c.id }, c.x + 3, c.z - 3)); });
// ore deposits (blow them up or smash them), plants to pick, boars to hunt, chests
for (let t = 0; t < 6000 && POI.ores.length < 60; t++) {
  const x = (R() - 0.5) * 1300, z = (R() - 0.5) * 1300, reg = regionAt(x, z);
  if (!['north', 'volcano', 'central', 'desert'].includes(reg) || !okLand(x, z, 34) || !clear(x, z) || !far(x, z, POI.ores, 40)) continue;
  POI.ores.push(pt({ id: 'ore' + POI.ores.length, rich: R() < 0.25 }, x, z));
}
const PLANT_BY = { forest: ['shroom', 'stamella', 'shroom', 'apple'], central: ['apple', 'radish', 'shroom'], plateau: ['apple', 'shroom', 'radish', 'stamella'],
  north: ['pepper', 'stamella'], volcano: ['pepper', 'pepper', 'shroom'], east: ['apple', 'radish', 'stamella'], desert: ['pepper', 'radish'] };
for (let t = 0; t < 9000 && POI.plants.length < 260; t++) {
  const x = (R() - 0.5) * 1360, z = (R() - 0.5) * 1360, reg = regionAt(x, z);
  if (!okLand(x, z, 30) || !clear(x, z) || groundH(x, z) > 190) continue;
  const list = PLANT_BY[reg]; POI.plants.push(pt({ id: 'pl' + POI.plants.length, item: list[Math.floor(R() * list.length)] }, x, z));
}
for (let t = 0; t < 4000 && POI.boars.length < 26; t++) {
  const x = (R() - 0.5) * 1300, z = (R() - 0.5) * 1300, reg = regionAt(x, z);
  if (!['central', 'forest', 'east', 'plateau'].includes(reg) || !okLand(x, z, 22) || !clear(x, z) || !far(x, z, POI.boars, 60)) continue;
  POI.boars.push(pt({ id: 'b' + POI.boars.length }, x, z));
}
const CHEST_LOOT = ['w_soldier', 'b_soldier', 's_soldier', 'gold:100', 'w_claymore', 'w_spear', 'gold:300', 'mat:amber:3', 'w_knight', 'b_falcon', 's_knight', 'w_ancient'];
for (let t = 0; t < 4000 && POI.chests.length < 24; t++) {
  const x = (R() - 0.5) * 1300, z = (R() - 0.5) * 1300;
  if (!okLand(x, z, 26) || !clear(x, z) || !far(x, z, POI.chests, 90)) continue;
  POI.chests.push(pt({ id: 'ch' + POI.chests.length, loot: CHEST_LOOT[POI.chests.length % CHEST_LOOT.length] }, x, z));
}
// the village of Windhollow: houses round a square
export const VILLAGE = { x: SPOT.village.x, z: SPOT.village.z, y: groundH(SPOT.village.x, SPOT.village.z) };
for (const [dx, dz, w, d, role] of [[-26, -22, 9, 7, 'elder'], [0, -30, 8, 7, 'shop'], [26, -22, 9, 7, 'inn'], [-30, 10, 7, 7, 'house'], [30, 14, 7, 7, 'house'], [-14, 34, 8, 6, 'leaf'], [16, 36, 7, 6, 'house']]) {
  const x = VILLAGE.x + dx, z = VILLAGE.z + dz; POI.houses.push({ x, z, y: groundH(x, z), w, d, h: 4.5, role });
}
POI.npcs.push(
  { id: 'elder', x: VILLAGE.x - 26, z: VILLAGE.z - 15, look: 'elder' }, { id: 'shop', x: VILLAGE.x, z: VILLAGE.z - 23, look: 'merchant' },
  { id: 'inn', x: VILLAGE.x + 26, z: VILLAGE.z - 15, look: 'innkeep' }, { id: 'leafgramps', x: VILLAGE.x - 14, z: VILLAGE.z + 28, look: 'leaf' },
  { id: 'statue', x: VILLAGE.x + 4, z: VILLAGE.z + 4, look: 'statue' }, { id: 'kid', x: VILLAGE.x + 12, z: VILLAGE.z + 22, look: 'kid' },
  { id: 'hermit', x: SPOT.hermit.x, z: SPOT.hermit.z + 6, look: 'hermit' },
);
for (const n of POI.npcs) n.y = groundH(n.x, n.z);

// ---------------------------------------------------------------- trees and rocks
export const TREES = [], ROCKS = [];
{
  const cell = 8, nC2 = W.size / cell;
  for (let j = 0; j < nC2; j++) for (let i = 0; i < nC2; i++) {
    const r1 = hash2(i, j, 1), x = -W.half + (i + hash2(i, j, 2)) * cell, z = -W.half + (j + hash2(i, j, 3)) * cell;
    const h = groundH(x, z); if (h < 2 || Math.abs(x) > 740 || Math.abs(z) > 740) continue;
    const reg = regionAt(x, z), fn = forestNoise(x, z);
    let dens = { forest: 0.78, plateau: 0.26, central: 0.08, east: 0.16, north: 0.3, volcano: 0.04, desert: 0.014 }[reg];
    if (reg !== 'desert' && reg !== 'volcano') dens *= 0.35 + fn * 1.4;
    if (reg === 'central' && fn > 0.62) dens = 0.42;
    if (r1 > dens) continue;
    if (slopeDeg(x, z) > 34 || roadDist(x, z) < 5 || !clear(x, z) || h > snowLine(x, z) + 10) continue;
    const type = reg === 'desert' ? 'cactus' : reg === 'volcano' ? 'dead' : reg === 'north' || h > 120 || (reg === 'forest' && hash2(i, j, 4) < 0.3) ? 'pine' : 'oak';
    TREES.push({ x, z, y: h, type, s: 0.8 + hash2(i, j, 5) * 0.6, rot: hash2(i, j, 6) * 6.28, apple: type === 'oak' && hash2(i, j, 7) < 0.12 });
  }
  for (let t = 0; t < 1000; t++) {
    const x = (R() - 0.5) * 1440, z = (R() - 0.5) * 1440, h = groundH(x, z);
    if (h < 1 || !clear(x, z) || roadDist(x, z) < 4) continue;
    ROCKS.push({ x, z, y: h, r: 0.5 + R() * R() * 2.6, rot: R() * 6.28 });
  }
}

// ---------------------------------------------------------------- solid things: boxes (buildings, towers, walls) and cylinders (trunks, rocks)
// box: { min: [x, y, z], max: [x, y, z], climb } ; cylinder: { x, z, y0, y1, r }
export const BOXES = [], CYLS = [];
const box = (x0, y0, z0, x1, y1, z1, o = {}) => { const b = { min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], climb: true, ...o }; BOXES.push(b); return b; };
// towers: three stacked sections, each narrower, so there is a ledge to rest on every 10 m
for (const t of POI.towers) {
  const lo = Math.min(...[[-5, -5], [5, -5], [-5, 5], [5, 5]].map(([a, b]) => groundH(t.x + a, t.z + b))) - 1;
  t.segs = [[4.6, lo, t.y + 10], [3.3, t.y + 10, t.y + 20], [2.0, t.y + 20, t.y + 30]]; t.top = t.y + 30;
  for (const [hw, y0, y1] of t.segs) box(t.x - hw, y0, t.z - hw, t.x + hw, y1, t.z + hw, { tower: t.id });
}
{ const x = SPOT.hermit.x, z = SPOT.hermit.z, y = groundH(x, z); box(x - 3.5, y - 2, z - 3, x + 3.5, y + 3.6, z + 3, { house: 'hermit' }); }
// archers' lookouts: four legs and a floor
for (const c of POI.camps) if (c.archer) {
  const x = c.x - 6, z = c.z + 4, y = groundH(x, z); c.post = [x, y + 5.15, z];
  box(x - 1.3, y + 4.85, z - 1.3, x + 1.3, y + 5.15, z + 1.3, { climb: false });
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + a - 0.15, y - 1, z + b - 0.15, x + a + 0.15, y + 4.85, z + b + 0.15);
}
for (const h of POI.houses) { const lo = h.y - 2; box(h.x - h.w / 2, lo, h.z - h.d / 2, h.x + h.w / 2, h.y + h.h, h.z + h.d / 2, { house: h.role }); }
// the castle: walls with gates on four sides, a keep in the north, a courtyard where the last battle is fought
export const CASTLE = { x: SPOT.castle.x, z: SPOT.castle.z, y: groundH(SPOT.castle.x, SPOT.castle.z), half: 70, wallH: 16 };
{
  const { x, z, half, wallH } = CASTLE, y0 = CASTLE.y - 12, y1 = CASTLE.y + wallH, th = 3, gate = 9;
  for (const s of [-1, 1]) {
    box(x - half, y0, z + s * half - th / 2, x - gate, y1, z + s * half + th / 2, { castle: 1 }); box(x + gate, y0, z + s * half - th / 2, x + half, y1, z + s * half + th / 2, { castle: 1 });
    box(x + s * half - th / 2, y0, z - half, x + s * half + th / 2, y1, z - gate, { castle: 1 }); box(x + s * half - th / 2, y0, z + gate, x + s * half + th / 2, y1, z + half, { castle: 1 });
  }
  CASTLE.keep = box(x - 16, y0, z - 62, x + 16, CASTLE.y + 44, z - 32, { castle: 1 });
  CASTLE.arena = { x, z: z + 8, y: CASTLE.y, r: 30 };
}
for (const t of TREES) CYLS.push({ x: t.x, z: t.z, y0: t.y - 1, y1: t.y + (t.type === 'cactus' ? 3 : 6) * t.s, r: (t.type === 'cactus' ? 0.45 : 0.55) * t.s, top: t.type === 'cactus' ? 0 : 1.3 * t.s, tree: t });
for (const r of ROCKS) CYLS.push({ x: r.x, z: r.z, y0: r.y - r.r, y1: r.y + r.r * 0.75, r: r.r * 0.9, rock: 1, top: r.r * 0.7 });
for (const s of POI.shrines.concat(POI.greats)) { const lo = s.y - 2; box(s.x - 3, lo, s.z - 3, s.x + 3, s.y + 0.35, s.z + 3, { climb: false, shrine: s.id }); }

// a grid of what is near, for collision
const HC = 16, hashCells = new Map();
const key = (i, j) => i * 4096 + j;
function addHash(o, x0, z0, x1, z1) { for (let j = Math.floor(z0 / HC); j <= Math.floor(z1 / HC); j++) for (let i = Math.floor(x0 / HC); i <= Math.floor(x1 / HC); i++) { const k = key(i, j); let a = hashCells.get(k); if (!a) hashCells.set(k, (a = [])); a.push(o); } }
for (const b of BOXES) addHash(b, b.min[0], b.min[2], b.max[0], b.max[2]);
for (const c of CYLS) addHash(c, c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r);
export function solidsNear(x, z, r = 2) {
  const out = new Set();
  for (let j = Math.floor((z - r) / HC); j <= Math.floor((z + r) / HC); j++) for (let i = Math.floor((x - r) / HC); i <= Math.floor((x + r) / HC); i++) { const a = hashCells.get(key(i, j)); if (a) for (const o of a) out.add(o); }
  return out;
}
export { roadDist, dist };
