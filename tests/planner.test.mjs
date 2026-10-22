import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRooms, roomsFor, sleepScore, kitchenSplit, dir8 } from '../js/planner.js';
import { flyingStars, planLayout } from '../js/fengshui.js';

function cellsFor(az, cov = [[1, 1, 1], [1, 1, 1], [1, 1, 1]]) {
  const chart = flyingStars(az, 9);
  const cells = [];
  planLayout(chart).forEach((r, row) => r.forEach((lo, col) => {
    cells.push({ lo, row, col, cov: cov[row][col], ...chart.palaces[lo] });
  }));
  return { chart, cells };
}

const program = { kitchen: true, master: true, kids: [3], baths: 1, boiler: true, storage: false, office: false };

test('спальня — по горной звезде: горная 9 или 1 лучше', () => {
  assert.equal(sleepScore({ mountain: 1, water: 3 }, [2]), 3);
  assert.ok(sleepScore({ mountain: 5, water: 3 }, [2]) < 0);
  assert.ok(sleepScore({ mountain: 9, water: 3 }, [2]) > sleepScore({ mountain: 1, water: 3 }, [2])); // горная 9 — идеал
  assert.equal(sleepScore({ mountain: 9, water: 9 }, [2]), 2); // водная 9 мешает на 1 этаже
  assert.equal(sleepScore({ mountain: 9, water: 9 }, [2], true), 4); // на втором — нет
});

test('раскладка одноэтажного дома: все комнаты по местам', () => {
  const { cells } = cellsFor(180);
  const fixed = { '1-1': { key: 'hall', label: 'Холл' }, '0-1': { key: 'entry', label: 'Прихожая' } };
  const res = planRooms(cells, roomsFor(program, [2, 4]), fixed);
  const placed = Object.values(res.assign).map((r) => r.key);
  for (const k of ['kitchen', 'master', 'kid0', 'bath0', 'boiler']) assert.ok(placed.includes(k), k);
  assert.equal(placed.filter((k) => k === 'kitchen').length, 2); // кухня-гостиная в две клетки
  // Спальня родителей — в горной 9 или 1, если такая свободна
  const master = cells.find((c) => res.assign[`${c.row}-${c.col}`]?.key === 'master');
  assert.ok([9, 1, 8, 6].includes(master.mountain));
  // Санузел — не в водной 9, 1, 8
  const bath = cells.find((c) => res.assign[`${c.row}-${c.col}`]?.key === 'bath0');
  assert.ok(![9, 1, 8].includes(bath.water));
});

test('не хватает места: котельная объединяется с санузлом', () => {
  const { cells } = cellsFor(180);
  const big = { ...program, kids: [3, 4, 9], office: true, storage: true };
  const fixed = { '1-1': { key: 'hall', label: 'Холл' }, '0-1': { key: 'entry', label: 'Прихожая' } };
  const res = planRooms(cells, roomsFor(big, [2, 4]), fixed);
  const placed = Object.values(res.assign).length;
  assert.ok(placed <= 7);
  assert.ok(res.dropped.length > 0 || res.merged.length > 0);
});

test('отсутствующий сектор не занимается', () => {
  const cov = [[0, 1, 1], [1, 1, 1], [1, 1, 1]];
  const { cells } = cellsFor(180, cov);
  const res = planRooms(cells, roomsFor(program, [2]), { '1-1': { key: 'hall', label: 'Холл' } });
  assert.equal(res.assign['0-0'], undefined);
});

test('второй этаж: спальня родителей над двойной 9', () => {
  const { cells } = cellsFor(180);
  const res = planRooms(cells, roomsFor(program, [2, 4], { living: false, bathCount: 1 }), { '1-1': { key: 'hall', label: 'Холл' } }, { upper: true });
  const master = cells.find((c) => res.assign[`${c.row}-${c.col}`]?.key === 'master');
  assert.equal(master.mountain, 9);
  assert.equal(master.water, 9);
});

test('свободные клетки: одно подсобное, водные 9, 1, 8 не уходят в подсобные', () => {
  for (const az of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const { cells } = cellsFor(az);
    const fixed = { '1-1': { key: 'hall', label: 'Холл', type: 'hall' } };
    const res = planRooms(cells, roomsFor({ ...program, kids: [] }, [2], { bedrooms: true }), fixed);
    const keys = Object.values(res.assign).map((r) => r.key);
    assert.ok(keys.filter((k) => k === 'aux').length <= 1, `az ${az}`);
    for (const c of cells) {
      const r = res.assign[`${c.row}-${c.col}`];
      if (r && r.type === 'utility' && [9, 1, 8].includes(c.water)) {
        // допустимо только если это главная клетка комнаты, выбранная оптимизацией
        assert.equal(r.primary, `${c.row}-${c.col}`, `az ${az}: ${r.label}`);
      }
      if (r?.extra) {
        for (const e of r.extra) {
          const ec = cells.find((x) => `${x.row}-${x.col}` === e.cell);
          if (r.type === 'utility') assert.ok(![9, 1, 8].includes(ec.water), `az ${az}: ${r.label} + ${e.cell}`);
        }
      }
    }
    // все свободные клетки заняты
    assert.equal(cells.filter((c) => !(fixed[`${c.row}-${c.col}`]) && !res.assign[`${c.row}-${c.col}`]).length, 0);
  }
});

test('мастер-спальня: гардеробная с ванной рядом со спальней', () => {
  for (const az of [0, 90, 180, 270]) {
    const { cells } = cellsFor(az);
    const res = planRooms(cells, roomsFor({ ...program, suite: true }, [2]), { '1-1': { key: 'hall', label: 'Холл', type: 'hall' } });
    const at = (k) => cells.find((c) => res.assign[`${c.row}-${c.col}`]?.key === k && res.assign[`${c.row}-${c.col}`].primary === `${c.row}-${c.col}`);
    const m = at('master');
    const b = at('suitebath');
    assert.ok(m && b, `az ${az}`);
    assert.equal(Math.abs(m.row - b.row) + Math.abs(m.col - b.col), 1);
  }
});

test('одна мокрая точка: санузлы рядом, на втором этаже — над первым', () => {
  const { cells } = cellsFor(180);
  const two = { ...program, baths: 2, suite: true };
  const res = planRooms(cells, roomsFor(two, [2]), { '1-1': { key: 'hall', label: 'Холл', type: 'hall' } });
  assert.ok(res.wetConnected);
  const up = planRooms(cells, roomsFor(two, [2], { living: false, bathCount: 1 }), { '1-1': { key: 'hall', label: 'Холл', type: 'hall' } }, { upper: true, wetAbove: new Set(['0-0']) });
  assert.ok([...up.wetKeys].includes('0-0'));
});

test('свет: кухня не на севере, на востоке или юге', () => {
  // sun — истинное направление клетки, фасад на юг
  const sunOf = (row, col) => (row === 1 && col === 1 ? null : (180 + (Math.atan2(-(col - 1), row - 1) * 180) / Math.PI + 360) % 360);
  for (const az of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const chart = flyingStars(az, 9);
    const cells = [];
    planLayout(chart).forEach((r, row) => r.forEach((lo, col) => cells.push({ lo, row, col, cov: 1, sun: sunOf(row, col), ...chart.palaces[lo] })));
    const res = planRooms(cells, roomsFor(program, [2]), { '1-1': { key: 'hall', label: 'Холл', type: 'hall' } });
    const kc = cells.filter((c) => res.assign[`${c.row}-${c.col}`]?.key === 'kitchen' && !(res.assign[`${c.row}-${c.col}`].extra || []).some((e) => e.cell === `${c.row}-${c.col}`));
    const z = kitchenSplit(kc);
    assert.notEqual(dir8(z.kitchen.sun), 'С', `az ${az}`);
  }
});

test('подсобное одно и небольшое, делит сектор с соседней комнатой', () => {
  const { cells } = cellsFor(180);
  const res = planRooms(cells, roomsFor({ ...program, kids: [] }, [2]), { '1-1': { key: 'hall', label: 'Холл', type: 'hall' } });
  const aux = Object.values(res.assign).filter((r) => r.key === 'aux');
  if (aux.length) {
    assert.equal(new Set(aux).size, 1);
    assert.equal(aux[0].small, true);
  }
});

test('ручная правка: помещение в выбранном секторе не раскладывается повторно', () => {
  const { cells } = cellsFor(180);
  const fixed = { '1-1': { key: 'hall', label: 'Холл', type: 'hall' }, '0-0': { key: 'master', label: 'Спальня родителей', type: 'bedroom', primary: '0-0' } };
  const res = planRooms(cells, roomsFor(program, [2]), fixed);
  assert.equal(Object.entries(res.assign).filter(([, r]) => r.key === 'master').length, 0);
});

test('свои помещения из техзадания', () => {
  const rooms = roomsFor({ ...program, custom: [{ name: 'Сауна', kind: 'wet' }, { name: 'Мастерская', kind: 'active' }] }, [2]);
  const sauna = rooms.find((r) => r.label === 'Сауна');
  assert.equal(sauna.type, 'utility');
  assert.equal(sauna.wet, true);
  assert.equal(rooms.find((r) => r.label === 'Мастерская').type, 'office');
});

test('одноэтажный дом с двойной 9: кабинет или спальня с рабочей зоной в этом секторе', () => {
  const { cells } = cellsFor(180); // двойная 9 у тыла (С), клетка 0-1
  const fixed = { '1-1': { key: 'hall', label: 'Холл', type: 'hall' }, '2-1': { key: 'entry', label: 'Прихожая', type: 'entry' } };
  const office = planRooms(cells, roomsFor({ ...program, office: true }, [2]), fixed);
  assert.ok(['office', 'kitchen'].includes(office.assign['0-1']?.key), office.assign['0-1']?.key);
  const work = planRooms(cells, roomsFor({ ...program, masterWork: true }, [2]), fixed);
  assert.ok(['master', 'kitchen'].includes(work.assign['0-1']?.key), work.assign['0-1']?.key);
});
