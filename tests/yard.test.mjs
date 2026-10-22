import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  convexOverlap, sunPosition, localToUtc, sunDay, housePieces, houseOutline, shadowPoly, hull, inConvex, sunHours,
  defaultYard, checkPlant, checkBuildings, lightZone, PLANTS, PLANT_BY_KEY, tzGuess,
} from '../js/yard.js';

const YAK = [62.0355, 129.6755];

test('высота солнца в Якутске в полдень', () => {
  const near = (mmdd, expect) => {
    const day = sunDay(2026, mmdd, ...YAK, 9);
    assert.ok(Math.abs(day.noonAlt - expect) < 1.5, `${mmdd}: ${day.noonAlt}`);
  };
  near('06-21', 51.4);
  near('03-20', 28);
  near('12-21', 4.5);
});

test('солнце в полдень на юге, утром на востоке', () => {
  const noon = sunPosition(localToUtc(2026, '06-21', 12.4, 9), ...YAK);
  assert.ok(Math.abs(noon.az - 180) < 15, String(noon.az));
  const morning = sunPosition(localToUtc(2026, '06-21', 7, 9), ...YAK);
  assert.ok(morning.az > 60 && morning.az < 120, String(morning.az));
});

test('длина дня в Якутске: летом больше 18 часов, зимой меньше 6', () => {
  assert.ok(sunDay(2026, '06-21', ...YAK, 9).length > 18);
  assert.ok(sunDay(2026, '12-21', ...YAK, 9).length < 6);
});

test('часовой пояс по долготе', () => {
  assert.equal(tzGuess(129.7), 9);
  assert.equal(tzGuess(37.6), 3);
});

test('Г-образный дом: две части, площадь меньше прямоугольника', () => {
  const h = { shape: 'L', w: 12, d: 9, cw: 5, cd: 4, x: 0, y: 0, rot: 0 };
  assert.equal(housePieces(h).length, 2);
  assert.equal(houseOutline(h).length, 6);
  assert.equal(housePieces({ ...h, shape: 'square' }).length, 1);
});

test('тень падает от солнца и длиннее при низком солнце', () => {
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const sh = shadowPoly(sq, 3, 45, 180); // солнце на юге — тень на север
  assert.ok(sh.some(([, y]) => y > 3.9));
  const low = shadowPoly(sq, 3, 10, 180);
  assert.ok(Math.max(...low.map(([, y]) => y)) > Math.max(...sh.map(([, y]) => y)));
  assert.equal(shadowPoly(sq, 3, -1, 180), null);
});

test('выпуклая оболочка и точка внутри', () => {
  const h = hull([[0, 0], [2, 0], [2, 2], [0, 2], [1, 1]]);
  assert.equal(h.length, 4);
  assert.ok(inConvex(h, [1, 1]));
  assert.ok(!inConvex(h, [3, 1]));
});

test('к северу от дома меньше солнца, чем к югу', () => {
  const y = defaultYard();
  const opts = { year: 2026, lat: YAK[0], lng: YAK[1], tz: 9 };
  const { hours: [north, south] } = sunHours(y, opts, [{ pt: [15, 30] }, { pt: [15, 17] }]);
  assert.ok(north < south, `${north} < ${south}`);
});

test('растение: свет и отступы', () => {
  const y = defaultYard();
  assert.equal(checkPlant({ t: 'astilbe', x: 15, y: 30 }, y, 2, 14).level, 'good');
  assert.equal(checkPlant({ t: 'echinacea', x: 15, y: 30 }, y, 2, 14).level, 'bad');
  assert.equal(checkPlant({ t: 'larix', x: 2, y: 10 }, y, 12, 14).level, 'bad'); // близко к границе
  assert.equal(checkPlant({ t: 'larix', x: 15, y: 32 }, y, 12, 14).level, 'mixed'); // близко к дому
  assert.equal(lightZone(10, 14), 'sun');
  assert.equal(lightZone(6, 14), 'part');
  assert.equal(lightZone(3, 14), 'shade');
});

test('постройки: отступ от границы', () => {
  const y = defaultYard();
  y.items.push({ id: 'i1', t: 'bath', x: 1, y: 5, w: 5, d: 4, h: 4, rot: 0 });
  assert.ok(checkBuildings(y).some((c) => c.id === 'i1'));
  assert.equal(checkBuildings(defaultYard()).length, 0);
});

test('каталог растений и композиции согласованы', () => {
  assert.equal(new Set(PLANTS.map((p) => p.key)).size, PLANTS.length);
  assert.equal(PLANTS.filter((p) => p.top).length, 10);
});

test('пересечение прямоугольников крест-накрест', () => {
  const a = [[0, 2], [6, 2], [6, 4], [0, 4]];
  const b = [[2, 0], [4, 0], [4, 6], [2, 6]];
  assert.ok(convexOverlap(a, b));
  assert.ok(!convexOverlap(a, [[10, 10], [11, 10], [11, 11], [10, 11]]));
});

test('золотое сечение участка и групп', async () => {
  const { goldenGrid, nearestGolden, goldenError, fibAtLeast, phyllotaxis, plantGroups, goldenSpiral, PHI } = await import('../js/yard.js');
  const g = goldenGrid({ w: 30, d: 40 });
  assert.ok(Math.abs(g.xs[1] - 18.54) < 0.01);
  assert.equal(g.points.length, 4);
  assert.ok(nearestGolden({ w: 30, d: 40 }, [18, 24]).dist < 1.5);
  assert.ok(goldenError(16.18, 10) < 0.001);
  assert.equal(fibAtLeast(4), 5);
  assert.equal(phyllotaxis(5, 1).length, 5);
  const groups = plantGroups([{ id: 'a', t: 'x', x: 0, y: 0 }, { id: 'b', t: 'x', x: 1, y: 0 }, { id: 'c', t: 'x', x: 9, y: 0 }, { id: 'd', t: 'y', x: 0.5, y: 0 }]);
  assert.deepEqual(groups.map((x) => x.size).sort(), [1, 1, 2]);
  const arcs = goldenSpiral({ w: 30, d: 40 });
  assert.ok(Math.abs(arcs[0].sq[2] * PHI - 30) < 0.01);
});
