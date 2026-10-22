import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roomFit, bedroomsFor, entranceNotes, heTuPairs, doubleNine, attacksGua } from '../js/stars9.js';
import { flyingStars, planLayout } from '../js/fengshui.js';

test('помещения по звёздам', () => {
  assert.equal(roomFit('sleep', 1, 3), 'good');
  assert.equal(roomFit('sleep', 5, 3), 'bad');
  assert.equal(roomFit('sleep', 1, 9), 'fix'); // водная 9 — не для спальни
  assert.equal(roomFit('stove', 3, 1), 'good');
  assert.equal(roomFit('entrance', 2, 9), 'good');
  assert.equal(roomFit('utility', 2, 5), 'good');
  assert.equal(roomFit('utility', 2, 9), 'bad');
  assert.equal(roomFit('entrance', 1, 7), 'fix');
  assert.equal(roomFit('utility', 1, 7), 'good');
  assert.equal(roomFit('entrance', 1, 6), 'ok');
  assert.equal(roomFit('sleep', 7, 1), 'bad');
  assert.equal(roomFit('stove', 9, 1), 'good');
  assert.equal(roomFit('utility', 9, 5), 'bad'); // санузел в горной 9 — плохо
  assert.equal(roomFit('active', 1, 4), 'fix');
  // Неблагоприятные водные — в санузел или кладовку
  for (const w of [2, 3, 4, 5, 7]) assert.equal(roomFit('utility', 1, w), 'good');
  assert.equal(roomFit('utility', 9, 3), 'bad'); // но не в горной 9
  assert.equal(roomFit('utility', 1, 6), 'ok');
  // Неблагоприятная горная — тоже в санузел или кладовку, если водная не «денежная»
  assert.equal(roomFit('utility', 5, 6), 'good');
  assert.equal(roomFit('utility', 5, 9), 'bad'); // водную 9 не смываем
});

test('спальни по Гуа', () => {
  const palaces = {
    1: { mountain: 9, water: 9 }, 2: { mountain: 8, water: 1 }, 3: { mountain: 7, water: 2 },
    4: { mountain: 6, water: 3 }, 5: { mountain: 4, water: 5 }, 6: { mountain: 5, water: 4 },
    7: { mountain: 3, water: 6 }, 8: { mountain: 2, water: 7 }, 9: { mountain: 1, water: 8 },
  };
  const g8 = bedroomsFor(8, palaces);
  assert.equal(g8[0].lo, 9); // горная 1 без водной 9 — лучший
  assert.ok(g8.some((b) => b.lo === 2 && b.level === 'ok')); // горная 8 для Гуа 8
  assert.ok(g8.some((b) => b.lo === 1 && b.level === 'fix')); // горная 9, но водная 9
  assert.ok(!bedroomsFor(9, palaces).some((b) => b.lo === 2)); // горная 8 не для Гуа 9
});

test('вход и Гуа жильцов', () => {
  assert.equal(entranceNotes(8, 1, [8])[0].kind, 'bad');
  assert.equal(entranceNotes(8, 1, [3]).length, 0);
  assert.equal(entranceNotes(5, 9, [9])[0].kind, 'good');
  // Водная 6 на входе — для старшего мужчины при любом Гуа
  assert.equal(entranceNotes(5, 6, []).length, 1);
  assert.equal(entranceNotes(5, 6, [6])[0].gua, 6);
  assert.match(entranceNotes(7, 1, [7])[0].text, /горной 8, 1 или 9/);
  assert.equal(entranceNotes(5, 7, [])[0].kind, 'bad');
});

test('хэ-ту в соседних секторах', () => {
  const chart = flyingStars(180, 9);
  const pairs = heTuPairs(planLayout(chart), chart.palaces);
  for (const p of pairs) {
    assert.equal(chart.palaces[p.from][p.kind], p.a);
    assert.equal(chart.palaces[p.to][p.kind], p.b);
  }
});

test('двойная 9: вход внизу, спальня наверху', () => {
  assert.equal(doubleNine(flyingStars(180, 9).palaces), 1); // Цзы→У: двойная звезда у тыла (С)
  assert.equal(doubleNine({ 1: { mountain: 9, water: 1 }, 5: { mountain: 9, water: 9 } }), null);
});

test('горная 9 на входе', () => {
  assert.equal(entranceNotes(9, 1, [9])[0].kind, 'bad');
  assert.equal(entranceNotes(9, 1, [])[0].kind, 'mixed');
});

test('нападение звезды на Гуа по пяти элементам', () => {
  assert.equal(attacksGua(8, 1), true); // земля подавляет воду
  assert.equal(attacksGua(6, 3), true); // металл подавляет дерево
  assert.equal(attacksGua(6, 4), true);
  assert.equal(attacksGua(8, 6), false);
  assert.equal(attacksGua(6, 1), false);
});
