import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mountainAt, boundaryWarning, flyingStars, fly, guaNumber, bazhaiHouse, periodForYear, starTiming, planLayout,
} from '../js/fengshui.js';

test('24 горы: границы и полярность', () => {
  assert.equal(mountainAt(0).name, 'Цзы');
  assert.equal(mountainAt(352.4).name, 'Жэнь');
  assert.equal(mountainAt(352.5).name, 'Цзы');
  assert.equal(mountainAt(180).name, 'У');
  assert.equal(mountainAt(196.4).name, 'Дин');
  assert.equal(mountainAt(45).name, 'Гэнь');
  assert.equal(mountainAt(-10).name, 'Жэнь');
  assert.equal(mountainAt(0).yang, false);
  assert.equal(mountainAt(345).yang, true);
  assert.equal(mountainAt(45).yang, true);
  assert.equal(mountainAt(30).yang, false);
});

test('предупреждение о границе', () => {
  assert.equal(boundaryWarning(0), null);
  assert.equal(boundaryWarning(23).betweenPalaces, true);
  assert.equal(boundaryWarning(8).betweenPalaces, false);
});

test('базовая карта 9-го периода', () => {
  assert.deepEqual(fly(9, true), { 5: 9, 6: 1, 7: 2, 8: 3, 9: 4, 1: 5, 2: 6, 3: 7, 4: 8 });
});

test('8 период, Вэй→Чоу: ван шань ван сян', () => {
  const c = flyingStars(30, 8);
  assert.equal(c.sitting.name, 'Вэй');
  assert.equal(c.palaces[2].mountain, 8);
  assert.equal(c.palaces[8].water, 8);
  assert.ok(c.patterns.some((p) => p.title.startsWith('Ван шань ван сян')));
});

test('8 период, Кунь→Гэнь: шан шань ся шуй', () => {
  const c = flyingStars(45, 8);
  assert.ok(c.patterns.some((p) => p.title.startsWith('Шан шань ся шуй')));
});

test('9 период, Цзы→У: двойная звезда к горе', () => {
  const c = flyingStars(180, 9);
  assert.deepEqual(c.palaces[1], { base: 5, mountain: 9, water: 9 });
  assert.ok(c.patterns.some((p) => p.title.startsWith('Двойная звезда к горе')));
});

test('период 5 не поддерживается', () => {
  assert.throws(() => flyingStars(0, 5));
});

test('число Гуа', () => {
  assert.equal(guaNumber('1980-06-01', 'm').gua, 2);
  assert.equal(guaNumber('1980-06-01', 'f').gua, 4);
  assert.equal(guaNumber('2000-06-01', 'm').gua, 9);
  assert.equal(guaNumber('2000-06-01', 'f').gua, 6);
  // До Ли Чунь — предыдущий год
  assert.equal(guaNumber('2000-01-10', 'm').gua, 1);
  assert.equal(guaNumber('2000-02-04', 'm').uncertain, true);
  // Пятёрка: мужчинам 2, женщинам 8
  assert.equal(guaNumber('1986-06-01', 'm').gua, 2);
  assert.equal(guaNumber('1990-06-01', 'f').gua, 8);
});

test('дом Ба Чжай по тылу', () => {
  const h = bazhaiHouse(180);
  assert.equal(h.gua, 1);
  assert.equal(h.group, 'Восточная');
  assert.equal(h.directions[0].dir, 'ЮВ');
});

test('периоды и состояние звёзд', () => {
  assert.equal(periodForYear(2023), 8);
  assert.equal(periodForYear(2024), 9);
  assert.equal(periodForYear(2044), 1);
  assert.equal(starTiming(9, 9).key, 'wang');
  assert.equal(starTiming(1, 9).key, 'sheng');
  assert.equal(starTiming(8, 9).key, 'tui');
  assert.equal(starTiming(5, 9).key, 'shuai');
});

test('план дома: фасад в середине нижнего ряда, тыл — верхнего', () => {
  for (let az = 0; az < 360; az += 7.5) {
    const c = flyingStars(az, 9);
    const g = planLayout(c);
    assert.equal(g[2][1], c.facingPalace.lo);
    assert.equal(g[0][1], c.sittingPalace.lo);
    assert.equal(g[1][1], 5);
    const top = planLayout(c, true);
    assert.equal(top[0][1], c.facingPalace.lo);
    assert.equal(top[2][1], c.sittingPalace.lo);
  }
});

test('план дома: правило поворота схемы «юг сверху» для фасада в углу', () => {
  // Схема по сторонам света, юг сверху
  const cur = [[4, 9, 2], [3, 5, 7], [8, 1, 6]];
  // Фасад на СЗ — в правом нижнем углу текущей схемы
  const g = planLayout(flyingStars(315, 9));
  assert.equal(g[2][1], cur[2][2]); // фасад — в центр нижнего ряда
  assert.equal(g[2][2], cur[1][2]); // справа внизу — середина правого столбца
  assert.equal(g[2][0], cur[2][1]); // слева внизу — центр нижнего ряда
  assert.equal(g[1][1], cur[1][1]); // центр остаётся
  assert.equal(g[1][0], cur[2][0]); // слева во втором ряду — левый нижний
  assert.equal(g[1][2], cur[0][2]); // справа во втором ряду — верх третьего столбца
  assert.equal(g[0][1], cur[0][0]); // тыл — в центр верха
  assert.equal(g[0][0], cur[1][0]); // слева от тыла — левый во втором ряду
  assert.equal(g[0][2], cur[0][1]); // справа от тыла — центр первого ряда
});

// Классические таблицы звёзд 8-го и 9-го периода: схема «юг сверху»,
// в клетке — звезда горы и звезда воды.
const SOUTH_TOP = [4, 9, 2, 3, 5, 7, 8, 1, 6];
const BOOK = {
  9: {
    165: [45, 99, 27, 36, 54, 72, 81, 18, 63],
    180: [63, 18, 81, 72, 54, 36, 27, 99, 45],
    120: [99, 54, 72, 81, 18, 36, 45, 63, 27],
    135: [27, 63, 45, 36, 18, 81, 72, 54, 99],
    345: [54, 99, 72, 63, 45, 27, 18, 81, 36],
    0: [36, 81, 18, 27, 45, 63, 72, 99, 54],
    30: [72, 27, 99, 81, 63, 45, 36, 18, 54],
    45: [54, 18, 36, 45, 63, 81, 99, 27, 72],
    75: [36, 72, 54, 45, 27, 99, 81, 63, 18],
    90: [18, 63, 81, 99, 27, 45, 54, 72, 36],
    210: [27, 72, 99, 18, 36, 54, 63, 81, 45],
    255: [63, 27, 45, 54, 72, 99, 18, 36, 81],
    270: [81, 36, 18, 99, 72, 54, 45, 27, 63],
    300: [99, 45, 27, 18, 81, 63, 54, 36, 72],
    315: [72, 36, 54, 63, 81, 18, 27, 45, 99],
  },
  8: {
    165: [52, 97, 79, 61, 43, 25, 16, 88, 34],
    180: [34, 88, 16, 25, 43, 61, 79, 97, 52],
    120: [86, 42, 64, 75, 97, 29, 31, 53, 18],
    345: [25, 79, 97, 16, 34, 52, 61, 88, 43],
    0: [43, 88, 61, 52, 34, 16, 97, 79, 25],
    30: [63, 17, 85, 74, 52, 39, 28, 96, 41],
  },
};

for (const [period, charts] of Object.entries(BOOK)) {
  for (const [az, expected] of Object.entries(charts)) {
    test(`таблица звёзд: ${period} период, фасад ${az}°`, () => {
      const c = flyingStars(Number(az), Number(period));
      assert.deepEqual(SOUTH_TOP.map((lo) => c.palaces[lo].mountain * 10 + c.palaces[lo].water), expected);
    });
  }
}

test('короткие обозначения гор', () => {
  assert.equal(mountainAt(165).code, 'Ю-1');
  assert.equal(mountainAt(180).code, 'Ю-2');
  assert.equal(mountainAt(196.4).code, 'Ю-3');
  assert.equal(mountainAt(345).code, 'С-1');
});
