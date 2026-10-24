import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, CLIMATES, MATERIAL_KEYS } from '../js/project.js';
import { buildEstimate, priceEstimate } from '../js/estimate.js';

const geo = {
  W: 12, D: 9, leafs: 5, entry: [[5.5, 0], [6.5, 0]],
  windows: [{ a: [1, 0], b: [2.46, 0], horiz: true, len: 1.46, h: 1.43, mark: 'ОК-1' }, { a: [0, 3], b: [0, 3.6], horiz: false, len: 0.6, h: 0.9, mark: 'ОК-2' }],
  rooms: [
    { label: 'Кухня-гостиная', key: 'kitchen', type: 'kitchen', area: 30, x1: 0, x2: 4, y1: 0, y2: 6 },
    { label: 'Спальня', key: 'master', type: 'bedroom', area: 12, x1: 4, x2: 8, y1: 0, y2: 3 },
    { label: 'Санузел', key: 'bath0', type: 'utility', wet: true, area: 7, x1: 8, x2: 12, y1: 0, y2: 3 },
  ],
};
const model = (material, foundation) => buildModel({ floors: [{ title: '1 этаж', geo }], material, foundation, climate: CLIMATES.yakutsk, ceiling: 2.7, pitch: 30, overhang: 0.5, year: 2026 });

test('смета считается для всех материалов и фундаментов', () => {
  for (const mat of MATERIAL_KEYS) {
    for (const fnd of ['piles', 'driven', 'strip', 'slab', 'screw']) {
      const p = priceEstimate(buildEstimate(model(mat, fnd)));
      assert.equal(p.sections.length, 3);
      assert.ok(p.total > 1e6 && p.total < 3e7, `${mat}/${fnd}: ${p.total}`);
      for (const s of p.sections) for (const r of s.rows) assert.ok(Number.isFinite(r.cost) && r.qty >= 0, `${mat}/${fnd}: ${r.name}`);
    }
  }
});

test('правка цены и коэффициент региона', () => {
  const sec = buildEstimate(model('brus', 'piles'));
  const base = priceEstimate(sec).total;
  assert.ok(Math.abs(priceEstimate(sec, {}, 1.2).total - base * 1.2) < base * 0.001);
  assert.ok(priceEstimate(sec, { metalTile: 2000 }).total > base);
});
