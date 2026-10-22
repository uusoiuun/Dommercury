import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreSides, recommend, relabelSide, transformCuts, doorPoint, SIDE_BEARING, autoDoor, doorSector, doorStars,
} from '../js/facade.js';
import { flyingStars, planLayout, starTiming, PALACES } from '../js/fengshui.js';

test('баллы и рекомендация', () => {
  const help = { front: ['road'], left: [], back: ['project', 'view', 'low'], right: ['support'] };
  const scores = scoreSides(help, 'front');
  assert.deepEqual(scores, { front: 3, left: 0, back: 7, right: -2 });
  const r = recommend(scores);
  assert.equal(r.best, 'back');
  assert.equal(r.ambiguous, false);
});

test('спорный выбор и пустой помощник', () => {
  assert.equal(recommend(scoreSides({ front: ['project'], left: ['view', 'road'] }, null)).ambiguous, true);
  assert.equal(recommend(scoreSides({}, null)).filled, false);
});

test('переименование сторон при смене фасада', () => {
  assert.equal(relabelSide('right', 'right'), 'front');
  assert.equal(relabelSide('front', 'right'), 'left');
  assert.equal(relabelSide('back', 'right'), 'right');
  assert.equal(relabelSide('left', 'back'), 'right');
  assert.equal(relabelSide('front', 'front'), 'front');
});

test('направления стен согласованы с переименованием', () => {
  // Стена, ставшая фасадом, смотрит туда же, куда смотрела
  for (const nf of ['left', 'back', 'right']) {
    for (const side of ['front', 'left', 'back', 'right']) {
      const before = SIDE_BEARING[side];
      const after = (SIDE_BEARING[nf] + SIDE_BEARING[relabelSide(side, nf)]) % 360;
      assert.equal(after, before);
    }
  }
});

test('поворот выреза: угол справа у фасада становится углом слева у фасада', () => {
  // Дом 12×9, вырез в правом переднем углу 4×3
  const t = transformCuts([{ x: 8, y: 0, w: 4, h: 3 }], 12, 9, 'right');
  assert.equal(t.W, 9);
  assert.equal(t.D, 12);
  assert.deepEqual(t.cuts, [{ x: 0, y: 0, w: 3, h: 4 }]);
  const b = transformCuts([{ x: 8, y: 0, w: 4, h: 3 }], 12, 9, 'back');
  assert.deepEqual(b.cuts, [{ x: 0, y: 6, w: 4, h: 3 }]);
});

test('точка двери', () => {
  assert.deepEqual(doorPoint({ side: 'front', pos: null }, 12, 9), { x: 6, y: 0, along: 'x' });
  assert.deepEqual(doorPoint({ side: 'back', pos: 2 }, 12, 9), { x: 10, y: 9, along: 'x' });
  assert.deepEqual(doorPoint({ side: 'right', pos: 2 }, 12, 9), { x: 12, y: 2, along: 'y' });
  assert.deepEqual(doorPoint({ side: 'left', pos: 2 }, 12, 9), { x: 0, y: 7, along: 'y' });
});

const palaceIndex = Object.fromEntries(PALACES.map((p, i) => [p.lo, i]));
const full = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];

function auto(fsAz, cov = full) {
  const chart = flyingStars(fsAz, 9);
  const layout = planLayout(chart);
  const water = Object.fromEntries(Object.entries(chart.palaces).map(([lo, p]) => [lo, p.water]));
  return {
    chart, layout, water,
    door: autoDoor({ layout, cov, W: 12, D: 9, fsAz, water, timing: (n) => starTiming(n, 9), palaceIndex, period: 9 }),
  };
}

test('звёзды воды для двери', () => {
  assert.deepEqual(doorStars(9), [9, 1]);
  assert.deepEqual(doorStars(8), [8, 9]);
});

test('авто-дверь: В/ЮВ с 9 или 1, иначе любой сектор с 9 или 1, иначе В/ЮВ', () => {
  for (let az = 0; az < 360; az += 7.5) {
    const { layout, water, door } = auto(az);
    const outer = layout.flat().filter((lo) => lo !== 5);
    const good = (lo) => [9, 1].includes(water[lo]);
    assert.equal(doorSector(door, 12, 9, layout), door.lo);
    if ([3, 4].some(good)) {
      assert.ok([3, 4].includes(door.lo) && good(door.lo), `az ${az}`);
    } else if (outer.some(good)) {
      assert.ok(good(door.lo), `az ${az}`);
      // девятка важнее единицы
      if (outer.some((lo) => water[lo] === 9)) assert.equal(water[door.lo], 9);
    } else {
      assert.ok([3, 4].includes(door.lo), `az ${az}`);
    }
  }
});

test('авто-дверь пропускает отсутствующий сектор', () => {
  const { layout, door } = auto(180);
  const cov = full.map((r) => [...r]);
  layout.forEach((r, i) => r.forEach((lo, j) => { if (lo === door.lo) cov[i][j] = 0; }));
  assert.notEqual(auto(180, cov).door.lo, door.lo);
});

test('двухэтажный дом с двойной 9: дверь в сектор двойной 9', () => {
  const chart = flyingStars(180, 9); // двойная 9 у тыла (С)
  const layout = planLayout(chart);
  const water = Object.fromEntries(Object.entries(chart.palaces).map(([lo, p]) => [lo, p.water]));
  const door = autoDoor({ layout, cov: full, W: 12, D: 9, fsAz: 180, water, timing: (n) => starTiming(n, 9), palaceIndex, period: 9, preferLo: 1 });
  assert.equal(door.lo, 1);
  assert.equal(door.ideal, true);
});

test('варианты двери: можно исключить сектора', () => {
  const chart = flyingStars(180, 9);
  const layout = planLayout(chart);
  const water = Object.fromEntries(Object.entries(chart.palaces).map(([lo, p]) => [lo, p.water]));
  const door = autoDoor({ layout, cov: full, W: 12, D: 9, fsAz: 180, water, timing: (n) => starTiming(n, 9), palaceIndex, period: 9, skip: [1] });
  assert.notEqual(door.lo, 1);
});
