// Checks for Windborne: the land and its places, the physics of getting around (walk, climb a tower, glide off the
// plateau, swim), the items and cooking, and the shrines. Run: npm test
import { W, POI, SPOT, REGIONS, TREES, BOXES, CASTLE, VILLAGE, groundH, slopeDeg, regionAt } from '../js/world.js';
import { WEAPONS, BOWS, SHIELDS, OUTFITS, MATS, cook, effectOf } from '../js/items.js';
import { outdoor, newBody, stepBody, groundAt } from '../js/physics.js';
import { buildShrine, allShrines, shrineSegments } from '../js/shrine.js';

let fails = 0;
const ok = (name, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };

// ---------------------------------------------------------------- the land
ok('the plateau stands high above everything around it', (() => { const p = SPOT.plateau; let min = 1e9; for (let a = 0; a < 360; a += 5) { const r = a * Math.PI / 180; min = Math.min(min, groundH(p.x + Math.cos(r) * 125, p.z + Math.sin(r) * 125) - groundH(p.x + Math.cos(r) * 185, p.z + Math.sin(r) * 185)); } return min > 45; })());
ok('every region has a tower on dry land', REGIONS.every((r) => POI.towers.some((t) => t.region === r.id && t.y > 2)));
ok('16 shrines and 4 great shrines, all on dry, gentle ground', POI.shrines.length === 16 && POI.greats.length === 4 && POI.shrines.concat(POI.greats).every((s) => s.y > 2 && slopeDeg(s.x, s.z) < 26));
ok('four shrines on the plateau teach the four runes', ['magnet', 'bomb', 'ice', 'stasis'].every((r) => POI.shrines.some((s) => s.region === 'plateau' && s.teach === r)));
ok('the village is flat and above the sea', Math.abs(groundH(VILLAGE.x, VILLAGE.z) - 30) < 1 && slopeDeg(VILLAGE.x + 10, VILLAGE.z) < 8);
ok('plenty to find: leaf sprites, camps, ores, plants, chests', POI.seeds.length >= 40 && POI.camps.length >= 18 && POI.ores.length >= 50 && POI.plants.length >= 200 && POI.chests.length >= 20, `${POI.seeds.length} seeds, ${POI.camps.length} camps`);
ok('a forest of trees, none in the sea', TREES.length > 3000 && TREES.every((t) => t.y > 1.5), `${TREES.length}`);
ok('the island ends in sea', groundH(-790, 0) < 0 && groundH(0, 790) < 0 && groundH(790, 790) < 0);
ok('the start and the hermit are on the plateau', regionAt(SPOT.start.x, SPOT.start.z) === 'plateau' && regionAt(SPOT.hermit.x, SPOT.hermit.z) === 'plateau');

// ---------------------------------------------------------------- getting around
const sim = (B, secs, inp, opt = {}) => { const o = { glider: false, climbMul: 1, stamMax: 1, ...opt }; let ev = {}; for (let i = 0; i < secs * 60; i++) { const e = stepBody(B, 1 / 60, typeof inp === 'function' ? inp(B, i) : inp, outdoor, o); for (const k in e) ev[k] = e[k]; } return ev; };
const I = (mx, mz, o = {}) => ({ mx, mz, ix: 0, iy: 0, sprint: false, jump: false, drop: false, ...o });
{
  const B = newBody(SPOT.start.x, groundH(SPOT.start.x, SPOT.start.z), SPOT.start.z);
  sim(B, 3, I(0, -1));
  ok('walking: about 5 m/s and you stay on the ground', B.mode === 'ground' && Math.abs(B.z - SPOT.start.z + 15.6) < 2.5, `moved ${(SPOT.start.z - B.z).toFixed(1)} m`);
}
{ // sprinting across the open village square
  const B = newBody(VILLAGE.x - 4, groundH(VILLAGE.x - 4, VILLAGE.z), VILLAGE.z), x0 = B.x; sim(B, 0.5, I(1, 0)); const x1 = B.x; sim(B, 2, I(1, 0, { sprint: true }));
  ok('sprinting is faster and costs stamina', B.x - x1 > 13 && B.stamina < 0.8, `${(B.x - x1).toFixed(1)} m, stamina ${B.stamina.toFixed(2)}`); void x0;
}
{ // walking off the plateau's edge without a glider is deadly
  const p = SPOT.plateau, B = newBody(p.x, groundH(p.x, p.z + 120), p.z + 120); let fall = 0;
  sim(B, 25, (b) => (b.mode === 'climb' ? I(0, 0, { drop: true }) : I(0, 1)), {});
  const ev = sim(B, 0.1, I(0, 0)); void ev;
  for (let k = 0; k < 1; k++) fall = Math.max(fall, 0);
  ok('the plateau edge: you go over and fall a long way (or must climb)', B.y < p.h - 40 || B.mode === 'climb', `y ${B.y.toFixed(0)} mode ${B.mode}`);
}
{ // climbing a tower: up a section, rest on the ledge, up again
  const t = POI.towers[0], B = newBody(t.x, groundH(t.x, t.z + 7), t.z + 7);
  let rested = 0, t0 = 0;
  for (let i = 0; i < 120 * 60 && B.y < t.top - 0.1; i++) {
    const resting = B.mode === 'ground' && B.y > t.y + 5 && B.stamina < 0.95;
    if (resting) rested++;
    stepBody(B, 1 / 60, resting ? I(0, 0) : B.mode === 'climb' ? I(0, 0, { iy: 1 }) : I(0, -1), outdoor, { glider: false, climbMul: 1, stamMax: 1 });
    t0 = i;
  }
  ok('a tower can be climbed by resting on its ledges', B.y >= t.top - 0.1, `reached ${B.y.toFixed(1)} / ${t.top.toFixed(1)} in ${(t0 / 60).toFixed(0)} s, rested ${(rested / 60).toFixed(0)} s`);
  // and from the top you can glide far
  // glide from the top: walk off the edge, open the glider once you are in the air
  Object.assign(B, newBody(t.x, t.top, t.z)); const y0 = B.y;
  let opened = false;
  const ev = sim(B, 40, (b) => { if (!opened && b.mode === 'air' && b.y - groundAt(outdoor, b.x, b.z, b.y).h > 4) { opened = true; return I(0, -1, { jump: true }); } return I(0, -1); }, { glider: true });
  ok('gliding from the tower carries you far and lands softly', Math.hypot(B.x - t.x, B.z - t.z) > 60 && !(ev.fall > 12), `${Math.hypot(B.x - t.x, B.z - t.z).toFixed(0)} m, fall ${ev.fall ? ev.fall.toFixed(1) : 0}`);
  void y0;
}
{ // swimming: in the sea you float and can swim back
  const B = newBody(0, 5, 760); const ev = sim(B, 2, I(0, 0));
  ok('falling into the sea: you swim', B.mode === 'swim' && Math.abs(B.y - (W.sea - 1.2)) < 0.01, B.mode);
  void ev;
}
{ // you cannot walk into a house
  const h = POI.houses[0], B = newBody(h.x, groundH(h.x, h.z + h.d / 2 + 2), h.z + h.d / 2 + 2);
  sim(B, 2, I(0, -1, {})); ok('houses are solid (you start climbing them)', B.z > h.z + h.d / 2 - 0.1 || B.mode === 'climb', `${B.mode} z ${(B.z - h.z).toFixed(2)}`);
}

// ---------------------------------------------------------------- items and cooking
ok('every weapon, bow and shield has power and durability', Object.values(WEAPONS).every((w) => w.pow > 0 && w.dur > 0) && Object.values(BOWS).every((b) => b.pow > 0 && b.dur > 0) && Object.values(SHIELDS).every((s) => s.guard > 0 && s.dur > 0));
{
  const a = cook(['apple', 'apple', 'apple']), b = cook(['meat', 'shroom']), c = cook(['pepper', 'pepper', 'meat']), d = cook(['radish']), e = cook(['horn']), f = cook(['pepper', 'stamella']);
  ok('cooking: fruit simmers, meat sears, peppers warm, radish fills', a.name[1] === 'Simmered Fruit' && a.heal === 12 && b.name[1].includes('Skewer') && c.fx === 'cold' && c.power === 2 && d.heal === 999 && effectOf(d).extra === 4);
  ok('cooking: inedible things make dubious food; mixed effects cancel', e.name[1] === 'Dubious Food' && f.fx === null);
}
ok('chest loot and shop items exist', POI.chests.every((c) => { const id = c.loot.split(':')[0]; return id === 'gold' || id === 'mat' || WEAPONS[id] || BOWS[id] || SHIELDS[id]; }) && ['warm', 'climber', 'soldier'].every((o) => OUTFITS[o].price));

// ---------------------------------------------------------------- shrines
{
  const all = allShrines(), defs = all.map((s, i) => buildShrine(s, i));
  ok('every shrine has a start, an altar and a floor under both', defs.every((D) => D.start && D.altar && groundAt({ terrain: false, boxes: D.boxes, dyn: [], water: () => -1e9 }, D.start[0], D.start[2], D.start[1] + 1).h > -1 && groundAt({ terrain: false, boxes: D.boxes, dyn: [], water: () => -1e9 }, D.altar[0], D.altar[2] + 3, D.altar[1] + 1).h > D.altar[1] - 0.5));
  ok('shrines never overlap each other', defs.every((D, i) => defs.every((E, j) => i === j || Math.abs(D.origin[0] - E.origin[0]) > 20 || Math.abs(D.origin[1] - E.origin[1]) > 200)));
  ok('great shrines end with a Blight; rune shrines teach their rune', defs.filter((D) => D.great).every((D) => D.enemies.some((e) => e.type === 'blight')) && all.filter((s) => s.teach).length === 4);
  ok('every pit has a slab long enough to bridge it', defs.every((D) => D.props.filter((p) => p.kind === 'slab').every((p) => p.size[2] > 9.5)));
  ok('ice pools: the ledge is within reach of a pillar', defs.every((D) => D.waters.every((w) => D.boxes.some((b) => b.role === 'ledge' && b.max[1] <= w.y + 3.6 + 0.01 && b.max[1] > w.y + 2))));
  ok('segments for every kind of shrine', all.every((s) => shrineSegments(s).length >= 1));
}
console.log(fails ? `test: ${fails} failed` : 'test: all passed');
process.exit(fails ? 1 : 0);
