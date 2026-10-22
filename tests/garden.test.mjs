import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultYard, PLANT_BY_KEY, PLANTS, sunHours } from '../js/yard.js';
import {
  soilFit, climateGuess, pickPlants, TEMPLATES, placeTemplate, windSides, windbreak, scenarioSpot, elevationSvg, doorPlace, effectiveWater,
} from '../js/garden.js';

const YAK = { year: 2026, lat: 62.0355, lng: 129.6755, tz: 9 };

test('у всех растений есть почва, влага и зимостойкость', () => {
  for (const p of PLANTS) {
    assert.ok(p.ph.length && p.ph.every((c) => 'ANK'.includes(c)), p.key);
    assert.ok(p.water.length, p.key);
    assert.ok(['very', 'good', 'risky'].includes(p.hardy), p.key);
  }
});

test('почва: рододендрон только на кислой, очиток не любит сырость', () => {
  const rh = PLANT_BY_KEY.rhododendron;
  assert.equal(soilFit(rh, { known: true, ph: 'alkaline' }, 'cold').level, 'bad');
  assert.ok(soilFit(rh, { known: true, ph: 'alkaline' }, 'cold').fixes.length);
  assert.notEqual(soilFit(PLANT_BY_KEY.sedum, { known: true, water: 'wet' }, 'mild').level, 'good');
  assert.equal(soilFit(PLANT_BY_KEY.hosta, { known: true, ph: 'acid', water: 'wet' }, 'mild').level, 'good');
  assert.equal(effectiveWater({ texture: 'sand' }), 'dry');
});

test('климат: нежные растения в Якутии — плохо, неизвестная почва не мешает', () => {
  assert.equal(climateGuess(62), 'extreme');
  assert.equal(climateGuess(55.7), 'cold');
  assert.equal(soilFit(PLANT_BY_KEY.hydrangeaPan, { known: false }, 'extreme').level, 'bad');
  assert.equal(soilFit(PLANT_BY_KEY.larix, { known: false }, 'extreme').level, 'good');
});

test('подбор растений: теневой миксбордер в тени — теневыносливые', () => {
  const rows = pickPlants(TEMPLATES.shadeBorder, 'shade', { known: false }, 'extreme');
  for (const r of rows) for (const p of r.plants) assert.ok(PLANT_BY_KEY[p.key].light.includes('shade'), p.key);
  const sun = pickPlants(TEMPLATES.sunBorder, 'sun', { known: true, ph: 'acid' }, 'extreme');
  assert.ok(sun.every((r) => r.plants.length));
});

test('размещение: солнечный миксбордер и костровище на свободном месте', () => {
  const y = defaultYard();
  const opts = { ...YAK, cell: 1 };
  const hours = { grid: sunHours(y, opts) };
  const sb = placeTemplate('sunBorder', y, hours);
  assert.ok(sb && sb.share > 0.6);
  const fire = placeTemplate('fire', y, hours, { evening: { grid: sunHours(y, { ...opts, from: 17, to: 21 }) } });
  assert.ok(fire);
  assert.ok(Math.hypot(fire.x - y.house.x, fire.y - y.house.y) > 8);
  const entr = placeTemplate('entrance', y, hours);
  assert.ok(entr);
});

test('дверь и ветрозащита', () => {
  const y = defaultYard();
  const d = doorPlace(y.house);
  assert.deepEqual(d.n, [0, -1]);
  assert.deepEqual(windSides(0, ['С']), ['top']);
  assert.deepEqual(windSides(0, ['З']).sort(), ['left']);
  const wb = windbreak(y, ['С', 'З'], { known: false }, 'extreme');
  assert.ok(wb.plants.length > 5);
  assert.ok(wb.plants.every((p) => p.x >= 0 && p.y >= 0 && p.x <= 30 && p.y <= 40));
});

test('сценарии и картинка композиции', () => {
  const y = defaultYard();
  const coffee = scenarioSpot('coffee', y, YAK);
  assert.ok(coffee && coffee.share > 0.5);
  const bbq = scenarioSpot('bbq', y, YAK);
  assert.ok(bbq && bbq.dist >= 8);
  const svg = elevationSvg(pickPlants(TEMPLATES.sunBorder, 'sun', { known: false }, 'cold'));
  assert.ok(svg.startsWith('<svg') && svg.includes('<text'));
});

test('готовые композиции: солнечная — на юге, теневая — на севере в тени', async () => {
  const { placePreset, PRESETS, presetRows } = await import('../js/garden.js');
  const y = defaultYard();
  const hours = { grid: sunHours(y, { ...YAK, cell: 1 }) };
  const sun = placePreset('sunSedum', y, hours);
  assert.ok(sun.y < y.plot.d / 2, `y=${sun.y}`);
  assert.ok(sun.share > 0.7);
  const shade = placePreset('shadeHosta', y, hours);
  assert.ok(shade.y > y.plot.d / 2, `y=${shade.y}`);
  assert.ok(shade.share < sun.share);
  const east = placePreset('yellowViolet', y, hours);
  assert.ok(east.x > y.plot.w / 2 && east.rot === 90);
  for (const k of Object.keys(PRESETS)) for (const r of presetRows(k)) for (const p of r.plants) assert.ok(PLANT_BY_KEY[p.key], `${k}: ${p.key}`);
});
