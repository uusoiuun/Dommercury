import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeCuts, shapeGeometry, coverage, area, outline, decompose, sectorStatus } from '../js/shape.js';

test('прямоугольник занимает все клетки', () => {
  const cov = coverage(12, 9, shapeCuts({ type: 'rect' }, 12, 9));
  assert.deepEqual(cov, [[1, 1, 1], [1, 1, 1], [1, 1, 1]]);
  assert.equal(outline(decompose(12, 9, [])).length > 0, true);
});

test('Г-образный: вырез в углу слева у фасада', () => {
  const cuts = shapeCuts({ type: 'L', corner: 'fl', cw: 4, cd: 3 }, 12, 9);
  const cov = coverage(12, 9, cuts);
  assert.equal(cov[2][0], 0); // левая клетка у фасада
  assert.equal(cov[2][1], 1);
  assert.equal(cov[0][0], 1);
  assert.equal(area(12, 9, cuts), 12 * 9 - 12);
});

test('Г-образный: вырез справа у тыла, частичная клетка', () => {
  const cuts = shapeCuts({ type: 'L', corner: 'br', cw: 6, cd: 3 }, 12, 9);
  const cov = coverage(12, 9, cuts);
  assert.equal(cov[0][2], 0);
  assert.equal(cov[0][1], 0.5);
});

test('П-образный и Т-образный', () => {
  const u = coverage(12, 9, shapeCuts({ type: 'U', side: 'front', cw: 4, cd: 3 }, 12, 9));
  assert.equal(u[2][1], 0);
  assert.equal(u[2][0], 1);
  const t = coverage(12, 9, shapeCuts({ type: 'T', side: 'back', cw: 4, cd: 3 }, 12, 9));
  assert.equal(t[0][0], 0);
  assert.equal(t[0][2], 0);
  assert.equal(t[0][1], 1);
});

test('вырезы обрезаются по габариту', () => {
  const cuts = shapeCuts({ type: 'custom', cuts: [{ x: 10, y: -2, w: 5, h: 4 }] }, 12, 9);
  assert.deepEqual(cuts, [{ x: 10, y: 0, w: 2, h: 2 }]);
});

test('правило трети: не хватает до 1/3 — сектор полный, больше — частично нет', () => {
  assert.equal(sectorStatus(1), 'full');
  assert.equal(sectorStatus(0.7), 'full');
  assert.equal(sectorStatus(2 / 3), 'full');
  assert.equal(sectorStatus(0.6), 'partial');
  assert.equal(sectorStatus(0.5), 'partial');
  assert.equal(sectorStatus(0), 'none');
});

test('эркер по центру фасада: соседние сектора полные', () => {
  // Дом 12×9, эркер 4 м шириной с выносом 1,5 м
  const g = shapeGeometry({ type: 'bay', side: 'front', bw: 4, bd: 1.5, bo: 0 }, 12, 9);
  assert.equal(g.W, 12);
  assert.equal(g.D, 10.5);
  const cov = coverage(g.W, g.D, g.cuts);
  // У фасада боковые клетки: не хватает 1,5 из 3,5 м глубины (43%) — больше трети
  assert.equal(sectorStatus(cov[2][0]), 'partial');
  assert.equal(sectorStatus(cov[2][1]), 'full');
  assert.equal(area(g.W, g.D, g.cuts), 12 * 9 + 4 * 1.5);
});

test('небольшой эркер: не хватает меньше трети — сектора полные', () => {
  const g = shapeGeometry({ type: 'bay', side: 'front', bw: 4, bd: 0.9, bo: 0 }, 12, 9);
  const cov = coverage(g.W, g.D, g.cuts);
  assert.deepEqual(cov[2].map(sectorStatus), ['full', 'full', 'full']);
});

test('эркер сбоку и контур: стены фасада помечены', () => {
  const g = shapeGeometry({ type: 'bay', side: 'left', bw: 3, bd: 1, bo: 0 }, 12, 9);
  assert.equal(g.W, 13);
  const front = outline(decompose(g.W, g.D, g.cuts)).filter((sg) => sg.facing === 'front');
  // Основная стена фасада и короткая стена эркера, обращённая к фасаду
  assert.ok(front.some((sg) => sg.y1 === 0 && sg.x1 === 1));
  assert.ok(front.some((sg) => sg.y1 === 3 && sg.x2 === 1));
});
