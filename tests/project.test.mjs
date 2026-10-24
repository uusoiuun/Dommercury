import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIMATES, MATERIAL_KEYS, thermalNorms, wallBuildUp, slabBuildUp, pickSection, roofLoad } from '../js/project.js';

test('ГСОП и требуемое R стен для Якутска', () => {
  const n = thermalNorms(CLIMATES.yakutsk);
  assert.ok(n.gsop > 10000 && n.gsop < 10600, String(n.gsop));
  assert.ok(Math.abs(n.wall - (0.00035 * n.gsop + 1.4)) < 1e-9);
});

test('любая стена утепляется до нормы', () => {
  for (const cl of Object.values(CLIMATES)) {
    for (const k of MATERIAL_KEYS) {
      const w = wallBuildUp(k, cl);
      assert.ok(w.ok, `${k} ${cl.name}: ${w.R} < ${w.need}`);
    }
  }
  assert.ok(wallBuildUp('brus', CLIMATES.yakutsk).ins >= 0.15);
  assert.ok(wallBuildUp('brick', CLIMATES.moscow).ins > 0);
});

test('перекрытия и пол до нормы', () => {
  const cl = CLIMATES.yakutsk;
  assert.ok(slabBuildUp('attic', cl).R >= slabBuildUp('attic', cl).need);
  assert.ok(slabBuildUp('floor', cl, 'piles').R >= slabBuildUp('floor', cl, 'piles').need);
  assert.ok(slabBuildUp('floor', cl, 'strip').R >= slabBuildUp('floor', cl, 'strip').need);
});

test('стропила: больше снега — больше сечение', () => {
  const list = [[50, 150], [50, 200], [50, 250], [100, 250]];
  const a = pickSection(list, 4, roofLoad(CLIMATES.yakutsk, 30).q, 0.6);
  const b = pickSection(list, 4, roofLoad(CLIMATES.novosibirsk, 30).q, 0.6);
  assert.ok(a && b);
  assert.ok(b.h * b.b >= a.h * a.b);
  assert.equal(roofLoad(CLIMATES.moscow, 60).mu, 0);
});

test('рекомендация фундамента по изысканиям', async () => {
  const { geoRecommend } = await import('../js/project.js');
  assert.equal(geoRecommend({ soil: null, permafrost: 'yes' }), null);
  assert.deepEqual(geoRecommend({ soil: 'loam', permafrost: 'yes', uniform: true }).rec, ['piles']);
  assert.deepEqual(geoRecommend({ soil: 'peat', permafrost: 'no', uniform: true }).rec, ['piles']);
  assert.equal(geoRecommend({ soil: 'sand', permafrost: 'no', uniform: true }).rec[0], 'slab');
  assert.ok(!geoRecommend({ soil: 'loam', permafrost: 'no', uniform: false }).rec.includes('strip'));
  assert.ok(!geoRecommend({ soil: 'clay', permafrost: 'no', uniform: true, water: '1.2' }).rec.includes('strip'));
});
