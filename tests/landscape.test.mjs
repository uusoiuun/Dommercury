import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, sectorOf, starRank, sectorAdvice, ELEMENTS } from '../js/landscape.js';
import { flyingStars } from '../js/fengshui.js';

const far = { period: 9, bearing: 0, dist: 40, houseR: 8 };

test('сектор по азимуту', () => {
  assert.equal(sectorOf(0).dir, 'С');
  assert.equal(sectorOf(100).dir, 'В');
  assert.equal(sectorOf(350).dir, 'С');
  assert.equal(sectorOf(200).dir, 'Ю');
});

test('ранги звёзд 9-го периода', () => {
  assert.equal(starRank(9), 'good');
  assert.equal(starRank(1), 'good');
  assert.equal(starRank(8), 'ok');
  assert.equal(starRank(6), 'ok');
  assert.equal(starRank(5), 'bad');
});

test('пруд: хорош у водной 9, плох у водной 5 и при горной 9', () => {
  assert.equal(evaluate('pond', { ...far, mountain: 3, water: 9 }).level, 'good');
  assert.equal(evaluate('pond', { ...far, mountain: 3, water: 5 }).level, 'bad');
  assert.equal(evaluate('pond', { ...far, mountain: 9, water: 4 }).level, 'bad');
});

test('пруд у дома — предупреждение о мерзлоте', () => {
  const r = evaluate('pond', { ...far, dist: 12, mountain: 3, water: 9 });
  assert.ok(r.notes.some((n) => n.includes('мерзлоту')));
});

test('хвойные: хороши у горной 9, перекрывают водную 9', () => {
  assert.equal(evaluate('conifer', { ...far, mountain: 9, water: 3 }).level, 'good');
  assert.notEqual(evaluate('conifer', { ...far, bearing: 90, mountain: 4, water: 9 }).level, 'good');
});

test('высокое дерево близко с юга затеняет дом', () => {
  const r = evaluate('tree', { ...far, bearing: 180, dist: 15, mountain: 8, water: 3 });
  assert.ok(r.notes.some((n) => n.includes('тень')));
});

test('теплица на юге лучше, чем на севере', () => {
  assert.equal(evaluate('greenhouse', { ...far, bearing: 180, mountain: 3, water: 3 }).level, 'ok');
  assert.equal(evaluate('greenhouse', { ...far, bearing: 0, mountain: 3, water: 3 }).level, 'mixed');
});

test('септик — в неблагоприятную водную', () => {
  assert.equal(evaluate('septic', { ...far, mountain: 3, water: 5 }).level, 'ok');
  assert.equal(evaluate('septic', { ...far, mountain: 3, water: 9 }).level, 'bad');
});

test('советы по всем 8 секторам и уникальные ключи элементов', () => {
  const chart = flyingStars(180, 9);
  const adv = sectorAdvice(chart.palaces, 9, 0);
  assert.equal(adv.length, 8);
  assert.ok(adv.every((a) => a.put.length > 0));
  assert.equal(new Set(ELEMENTS.map((e) => e.key)).size, ELEMENTS.length);
});
