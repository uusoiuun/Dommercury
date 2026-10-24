// Раскладка помещений по секторам плана (сетка 3×3) по звёздам 9-го периода.
// Кухня-гостиная, кабинет — по водной звезде (там проводят время, но не спят),
// спальни — по горной звезде и Гуа тех, кто в них спит, плита — по горной,
// санузел, котельная, кладовка — туда, где неблагоприятные звёзды.
import { MOUNTAIN, WATER, roomFit, heTuMatch, attacksGua } from './stars9.js';
import { sectorStatus } from './shape.js';

const FIT_SCORE = { good: 3, ok: 2, fix: 1, na: 1, bad: -3 };
const fitScore = (fit) => (fit ? FIT_SCORE[fit] : 0);

/** Подходит ли сектор для сна людям с этими Гуа (для верхнего этажа водная 9 не мешает). */
export function sleepScore(cell, guas, upper = false) {
  const m = cell.mountain;
  let score;
  // Горная 9 — идеальная спальня, горная 1 — хорошая для всех Гуа
  if (m === 9) score = 4;
  else if (m === 1) score = 3;
  else {
    const d = MOUNTAIN[m];
    const per = (g) => {
      // Нейтральная звезда, которая нападает на Гуа, для сна не годится
      if ((m === 6 || m === 8) && attacksGua(m, g)) return -3;
      if (d?.sleepGua?.includes(g)) return 2;
      if (d?.leastHarm?.includes(g)) return 0;
      return fitScore(d?.rooms.sleep);
    };
    score = guas.length ? guas.reduce((s, g) => s + per(g), 0) / guas.length : fitScore(d?.rooms.sleep);
  }
  if (!upper && WATER[cell.water]?.noSleep) score -= 2;
  return score;
}

// Водная 9 — лучшая для активной зоны в 9-м периоде, водная 1 — будущая
const ACTIVE_BONUS = { 9: 2, 1: 1 };
const activeScore = (c) => fitScore(roomFit('active', c.mountain, c.water)) + (ACTIVE_BONUS[c.water] || 0);

// ---- Свет в Якутии: стороны света по карте (sun — истинное направление клетки от центра дома) ----

export const dir8 = (b) => ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'][Math.round((((b % 360) + 360) % 360) / 45) % 8];
const sunDir = (c) => (c.sun == null ? null : dir8(c.sun));
// Кухня — на востоке или юге (светло зимой), на севере нельзя
const KITCHEN_SUN = { В: 3, ЮВ: 3, Ю: 3, ЮЗ: 1, З: 0, СВ: -3, СЗ: -3, С: -50 };
// Гостиная — на юге или юго-западе
const LIVING_SUN = { Ю: 3, ЮЗ: 3, ЮВ: 1, З: 1, В: 0, СВ: 0, СЗ: 0, С: -2 };
// Санузел, котельная, подсобное — лучше на севере
const UTILITY_SUN = { С: 2, СВ: 2, СЗ: 2 };
const sunScore = (table, c) => table[sunDir(c)] ?? 0;

/**
 * Зоны кухни-гостиной: в какой клетке кухня с плитой, в какой — гостиная.
 * Плита — по горной звезде, кухня — на востоке или юге, гостиная — на юге или юго-западе.
 */
export function kitchenSplit(cells) {
  const pairs = cells.length === 1 ? [[cells[0], cells[0]]] : [[cells[0], cells[1]], [cells[1], cells[0]]];
  return pairs
    .map(([kitchen, living]) => ({
      kitchen,
      living,
      score: fitScore(roomFit('stove', kitchen.mountain, kitchen.water)) + sunScore(KITCHEN_SUN, kitchen)
        + (living !== kitchen ? sunScore(LIVING_SUN, living) : 0),
    }))
    .sort((a, b) => b.score - a.score)[0];
}

const partialPenalty = (cell) => (sectorStatus(cell.cov) === 'partial' ? 1 : 0);

// Сектор двойной 9 (горная и водная 9)
export const isDoubleNine = (c) => c.mountain === 9 && c.water === 9;

// В одноэтажном доме двойную 9 лучше всего используют кабинет и гостиная с камином:
// горная 9 — для кабинета, камина и плиты, водная 9 — для активной зоны
const DOUBLE_NINE_BONUS = { office: 6, kitchen: 3, workBedroom: 4 };

const SCORERS = {
  kitchen: (cells, room, upper) => {
    // Активная зона — по водным звёздам, плита — в лучшую по горной звезде клетку
    const active = cells.reduce((s, c) => s + activeScore(c), 0);
    // Пара хэ-ту в одной кухне-гостиной — оба сектора становятся благоприятными
    const hetu = cells.length === 2 && heTuMatch(cells[0], cells[1]) ? 2 : 0;
    const nine = !upper && cells.some(isDoubleNine) ? DOUBLE_NINE_BONUS.kitchen : 0;
    return active + kitchenSplit(cells).score + hetu + nine;
  },
  bedroom: (cells, room, upper) => {
    // Спальня с рабочей зоной: работа днём активирует водную 9, поэтому она не мешает сну
    if (room.work) {
      return sleepScore(cells[0], room.guas, true) * 2 + (!upper && isDoubleNine(cells[0]) ? DOUBLE_NINE_BONUS.workBedroom : 0);
    }
    return sleepScore(cells[0], room.guas, upper) * 2;
  },
  office: (cells, room, upper) => Math.max(activeScore(cells[0]), [8, 1, 9].includes(cells[0].mountain) ? 3 : -9)
    + (!upper && isDoubleNine(cells[0]) ? DOUBLE_NINE_BONUS.office : 0),
  utility: (cells) => fitScore(roomFit('utility', cells[0].mountain, cells[0].water)) + sunScore(UTILITY_SUN, cells[0]),
  // Отдельная гостиная — по водной звезде и свету (юг, юго-запад)
  lounge: (cells) => cells.reduce((s, c) => s + activeScore(c) + sunScore(LIVING_SUN, c), 0),
};

// Общие помещения: из них заходят в спальни, санузлы и другие комнаты
export const COMMON = ['hall', 'entry', 'kitchen', 'lounge'];

/** Соседние клетки (общая сторона). */
const adjacent = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

/**
 * Комнаты этажа по техзаданию.
 * program: { kitchen, master, kids: [гуа…], baths, boiler, storage, office }, parents: [гуа…]
 */
export function roomsFor(program, parents, { bedrooms = true, living = true, bathCount = program.baths } = {}) {
  const rooms = [];
  if (living && program.kitchen) rooms.push({ key: 'kitchen', label: 'Кухня-гостиная', type: 'kitchen', size: 2, priority: 10 });
  else {
    if (living && program.kitchenSep) rooms.push({ key: 'kitchen', label: 'Кухня', type: 'kitchen', size: 1, priority: 10 });
    if (living && program.livingSep) rooms.push({ key: 'living', label: 'Гостиная', type: 'lounge', size: 1, priority: 9.5 });
  }
  if (bedrooms && (program.master || program.suite)) {
    rooms.push({
      key: 'master',
      label: `${program.suite ? 'Мастер-спальня' : 'Спальня родителей'}${program.masterWork ? ' + рабочая зона' : ''}`,
      type: 'bedroom', guas: parents, priority: 9,
      suite: !!program.suite, work: !!program.masterWork,
    });
    // Мастер-спальня: из спальни через проходную гардеробную — в свою ванную
    if (program.suite) rooms.push({ key: 'suitebath', label: 'Гардеробная, ванная', type: 'utility', wet: true, suiteOf: 'master', priority: 8.5 });
  }
  if (bedrooms) {
    program.kids.forEach((gua, i) => rooms.push({
      key: `kid${i}`, label: program.kids.length > 1 ? `Детская ${i + 1}` : 'Детская', type: 'bedroom', guas: gua ? [gua] : [], priority: 8,
    }));
  }
  if (bedrooms && program.guest) rooms.push({ key: 'guest', label: 'Гостевая спальня', type: 'bedroom', guas: [], priority: 5 });
  if (bedrooms && program.wardrobe) rooms.push({ key: 'wardrobe', label: 'Гардеробная', type: 'utility', priority: 2 });
  if (living && program.office) rooms.push({ key: 'office', label: 'Кабинет', type: 'office', priority: 4 });
  // Постирочная — мокрое помещение, в мокрой точке вместе с санузлами
  if (living && program.laundry) rooms.push({ key: 'laundry', label: 'Постирочная', type: 'utility', wet: true, priority: 3.5 });
  for (let i = 0; i < bathCount; i++) rooms.push({ key: `bath${i}`, label: bathCount > 1 ? `Санузел ${i + 1}` : 'Санузел', type: 'utility', wet: true, priority: 7 - i });
  // Свои помещения из техзадания: тип определяет, по какой звезде их ставить
  (program.custom || []).forEach((c, i) => {
    const sleep = c.kind === 'sleep';
    if (sleep ? !bedrooms : !living) return;
    rooms.push({
      key: `custom${i}`, label: c.name || 'Помещение', custom: true, priority: 4,
      type: { active: 'office', sleep: 'bedroom', utility: 'utility', wet: 'utility' }[c.kind] || 'office',
      wet: c.kind === 'wet', guas: sleep ? [] : undefined,
    });
  });
  if (living && program.boiler) rooms.push({ key: 'boiler', label: 'Котельная', type: 'utility', priority: 6 });
  if (living && program.storage) rooms.push({ key: 'storage', label: 'Кладовка', type: 'utility', priority: 3 });
  // Санузлы и подсобные помещения могут занимать половину сектора
  return rooms.map((r) => ({ size: 1, ...r, half: r.type === 'utility' && !r.suiteOf }));
}

const HALF_PARTNERS = ['kitchen', 'lounge', 'entry'];

/**
 * Раскладка комнат по свободным клеткам.
 * cells: [{lo, row, col, cov, mountain, water}] — все 9 клеток плана (фасад снизу);
 * fixed: {'row-col': {key, label}} — клетки, занятые заранее (центр, прихожая).
 * Возвращает { assign: {'row-col': room}, dropped: [room], merged: [строки], score }.
 */
export function planRooms(cells, rooms, fixed = {}, { upper = false, wetAbove = null } = {}) {
  const free = cells.filter((c) => !fixed[`${c.row}-${c.col}`] && sectorStatus(c.cov) !== 'none');
  // Помещения, поставленные вручную, повторно не раскладываем
  const fixedKeys = new Set(Object.values(fixed).map((r) => r.key));
  let list = rooms.filter((r) => !fixedKeys.has(r.key)).sort((a, b) => b.priority - a.priority);
  const dropped = [];
  const merged = [];
  const need = () => list.reduce((s, r) => s + r.size, 0);
  // Мастер-спальне нужна соседняя клетка под гардеробную и ванную; без неё — обычная спальня
  // (проверяется в поиске)
  // Не хватает клеток: кухня-гостиная в одну клетку, затем убираем наименее важное
  // Не хватает клеток: два небольших помещения делят один сектор пополам
  while (need() > free.length) {
    const halves = list.filter((r) => r.half && !r.pair).sort((a, b) => a.priority - b.priority);
    if (halves.length < 2) break;
    const a = halves[0];
    // Пара: оба мокрых или оба сухих, иначе любые два
    const b = halves.slice(1).find((x) => !!x.wet === !!a.wet) || halves[1];
    list = list.filter((x) => x !== a && x !== b);
    const pair = { key: `pair-${a.key}-${b.key}`, label: `${a.label} | ${b.label}`, type: 'utility', size: 1, wet: !!(a.wet || b.wet), priority: Math.max(a.priority, b.priority), pair: [a, b] };
    list.push(pair);
    list.sort((x, y) => y.priority - x.priority);
    merged.push(`${a.label} и ${b.label} — в одном секторе, по половине`);
  }
  // Всё ещё не хватает: кухня-гостиная в одну клетку
  if (need() > free.length) {
    const k = list.find((r) => r.type === 'kitchen');
    if (k) k.size = 1;
  }
  while (need() > free.length && list.length) {
    const r = list.pop();
    // Котельную объединяем с санузлом, а не выбрасываем
    const bath = list.find((x) => x.key.startsWith('bath'));
    if (r.key === 'boiler' && bath) {
      bath.label = `${bath.label} + котельная`;
      merged.push('Котельная объединена с санузлом');
    } else dropped.push(r);
  }

  let best = { score: -Infinity, assign: null };
  const assign = {};
  const used = new Set();
  const key = (c) => `${c.row}-${c.col}`;
  const placed = {};
  const wet = [];
  // Помещения, поставленные заранее, тоже учитываем: ванная мастер-спальни, мокрая точка
  for (const [k, r] of Object.entries(fixed)) {
    const c = cells.find((x) => key(x) === k);
    if (!c) continue;
    placed[r.key] = [c];
    if (r.wet) wet.push(c);
  }
  // Одна мокрая точка: санузлы рядом друг с другом, на втором этаже — над санузлами первого
  const wetScore = (room, cell) => {
    let s = 0;
    if (room.wet) {
      if (wet.length && !wet.some((w) => adjacent(w, cell))) s -= 20;
      if (wetAbove) s += wetAbove.has(key(cell)) ? 6 : wetAbove.size ? -6 : 0;
    }
    // Котельная — у мокрой точки: общая инженерия
    if (room.key === 'boiler' && wet.some((w) => adjacent(w, cell))) s += 2;
    return s;
  };

  // Доступ: прихожая и каждая спальня — рядом с общим помещением (холл, кухня, гостиная),
  // мастер-спальня — либо сама, либо через свою гардеробную
  const fixedCells = Object.entries(fixed).map(([k, r]) => ({ c: cells.find((x) => key(x) === k), r })).filter((x) => x.c);
  const access = () => {
    const roomAt = (c) => assign[key(c)] || fixed[key(c)];
    const isCommon = (c, except) => { const r = roomAt(c); return r && r.key !== except && COMMON.includes(r.type) && !(except === 'entry-check' && r.type === 'entry'); };
    let pen = 0;
    const nearCommon = (c, except) => cells.some((n) => adjacent(c, n) && isCommon(n, except));
    for (const { c, r } of fixedCells) if (r.type === 'entry' && !cells.some((n) => adjacent(c, n) && (roomAt(n)?.type === 'hall' || roomAt(n)?.type === 'kitchen' || roomAt(n)?.type === 'lounge'))) pen += 30;
    for (const [k, r] of Object.entries(assign)) {
      if (k !== key(placed[r.key]?.[0] || { row: -1, col: -1 })) continue;
      const c = placed[r.key][0];
      if (r.type === 'bedroom') {
        if (nearCommon(c, r.key)) continue;
        const suite = r.key === 'master' && placed.suitebath && adjacent(placed.suitebath[0], c) && nearCommon(placed.suitebath[0], 'suitebath');
        if (!suite) pen += 30;
      } else if (r.type === 'kitchen' || r.type === 'lounge' || r.type === 'office') {
        // Кухня, гостиная, кабинет — тоже с выходом в общее помещение
        if (!placed[r.key].some((x) => nearCommon(x, r.key))) pen += 30;
      } else if (r.type === 'utility' && !r.suiteOf && !nearCommon(c, r.key)) {
        // Санузел — тоже из общего помещения; котельная и кладовая допустимы через соседнее подсобное
        pen += r.wet ? 20 : 6;
      }
    }
    return pen;
  };

  const rec = (i, total) => {
    if (i === list.length) {
      const t = total - access();
      if (t > best.score) best = { score: t, assign: { ...assign } };
      return;
    }
    const room = list[i];
    const options = [];
    for (const a of free) {
      if (used.has(key(a))) continue;
      if (room.suiteOf && !(placed[room.suiteOf] && adjacent(placed[room.suiteOf][0], a))) continue;
      if (room.size === 1) options.push([a]);
      else for (const b of free) if (!used.has(key(b)) && key(a) < key(b) && adjacent(a, b)) options.push([a, b]);
    }
    for (const opt of options) {
      const s = SCORERS[room.type](opt, room, upper) * (1 + room.priority / 10) - opt.reduce((p, c) => p + partialPenalty(c), 0)
        + wetScore(room, opt[0]);
      opt.forEach((c) => { used.add(key(c)); assign[key(c)] = room; });
      placed[room.key] = opt;
      if (room.wet) wet.push(opt[0]);
      rec(i + 1, total + s);
      if (room.wet) wet.pop();
      delete placed[room.key];
      opt.forEach((c) => { used.delete(key(c)); delete assign[key(c)]; });
    }
    // Для гардеробной с ванной нет соседней клетки — мастер-спальня без неё
    if (!options.length && room.suiteOf) rec(i + 1, total - 20);
    // Кухне не нашлось двух соседних клеток — ставим в одну
    if (!options.length && room.size === 2) {
      room.size = 1;
      rec(i, total);
      room.size = 2;
    }
  };
  rec(0, 0);

  const result = best.assign || {};
  // Главная клетка каждой комнаты — для кровати, стола, сантехники
  for (const [k, r] of Object.entries(result)) if (!r.primary) r.primary = k;

  // Санузел или подсобное — половина сектора у наружной стены; вторая половина отходит
  // соседнему общему помещению (кухне, гостиной, прихожей), откуда в него и вход
  {
    const allNow = { ...fixed, ...result };
    for (const [k, r] of Object.entries(result)) {
      if (!r.half || r.pair || r.small || r.primary !== k) continue;
      const c = cells.find((x) => key(x) === k);
      const partner = cells
        .filter((n) => adjacent(c, n) && allNow[key(n)] && HALF_PARTNERS.includes(allNow[key(n)].type))
        .map((n) => allNow[key(n)])
        .sort((a, b) => HALF_PARTNERS.indexOf(a.type) - HALF_PARTNERS.indexOf(b.type))[0];
      // Только у наружной стены: половина — полоса вдоль неё
      const outer = c.row !== 1 || c.col !== 1;
      if (!partner || !outer) continue;
      // Полоса — у наружной стены напротив соседа, чтобы его половина была цельной
      const pc = cells.find((n) => adjacent(c, n) && allNow[key(n)] === partner);
      const toward = pc.row < c.row ? 'top' : pc.row > c.row ? 'bottom' : pc.col < c.col ? 'left' : 'right';
      const opp = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[toward];
      const isOuter = (sd) => (sd === 'top' && c.row === 0) || (sd === 'bottom' && c.row === 2) || (sd === 'left' && c.col === 0) || (sd === 'right' && c.col === 2);
      r.stripSide = isOuter(opp) ? opp : ['top', 'bottom', 'left', 'right'].find((sd) => isOuter(sd) && sd !== toward);
      if (!r.stripSide) continue;
      r.small = true;
      r.frac = 0.5;
      r.sharedWith = partner.key;
    }
  }

  // Оставшиеся клетки: одно подсобное помещение на этаж, остальное присоединяем к соседним комнатам
  const all = { ...fixed, ...result };
  const hasUtilityRoom = Object.values(result).some((r) => ['storage', 'laundry', 'wardrobe'].includes(r.key));
  let left = free.filter((c) => !result[key(c)]);
  if (!hasUtilityRoom) {
    const auxScore = (c) => fitScore(roomFit('utility', c.mountain, c.water)) + sunScore(UTILITY_SUN, c);
    const aux = left
      .filter((c) => ['good', 'ok'].includes(roomFit('utility', c.mountain, c.water)))
      .sort((a, b) => auxScore(b) - auxScore(a))[0];
    if (aux) {
      // Подсобное — небольшое: полоса у наружной стены, остальная часть сектора — соседней комнате
      result[key(aux)] = { key: 'aux', label: 'Подсобное', type: 'utility', size: 1, primary: key(aux), small: true, frac: 0.4 };
      all[key(aux)] = result[key(aux)];
      left = left.filter((c) => c !== aux);
    }
  }
  const joinScore = (c, n, room) => {
    let s = 0;
    if (heTuMatch(c, n)) s += 3;
    const active = roomFit('active', c.mountain, c.water);
    if (['kitchen', 'office', 'hall', 'entry'].includes(room.type) && ['good', 'ok', 'fix'].includes(active)) s += 2;
    if (room.type === 'bedroom' && (MOUNTAIN[c.mountain]?.rooms.sleep === 'good' || MOUNTAIN[c.mountain]?.rooms.sleep === 'ok')) s += 2;
    if (room.type === 'utility' && roomFit('utility', c.mountain, c.water) === 'good') s += 1;
    // Водные 9, 1, 8 не «смываем»: к санузлу, котельной, подсобному их не присоединяем
    if (room.type === 'utility' && [9, 1, 8].includes(c.water)) s -= 10;
    if (room.type === 'hall') s += 1;
    return s;
  };
  // Повторяем, пока все клетки не присоединены (угловая может ждать соседа)
  for (let guard = 0; left.length && guard < 9; guard++) {
    left = left.filter((c) => {
      const options = cells
        .filter((n) => adjacent(c, n) && all[key(n)])
        .map((n) => ({ n, room: all[key(n)], s: joinScore(c, n, all[key(n)]) }))
        .sort((a, b) => b.s - a.s);
      if (!options.length) return true;
      // Рядом только подсобные, а звёзды хорошие — отдельная комната, а не «смыть»
      if (options[0].s < 0) {
        const id = key(c);
        const sleepGood = [9, 1, 8].includes(c.mountain) && (upper || !WATER[c.water]?.noSleep);
        result[id] = roomFit('active', c.mountain, c.water) === 'good'
          ? { key: `lounge-${id}`, label: 'Зона отдыха', type: 'lounge', size: 1, primary: id }
          : sleepGood
            ? { key: `guest-${id}`, label: 'Гостевая спальня', type: 'guest', size: 1, primary: id }
            : { key: `extra-${id}`, label: 'Доп. комната', type: 'extra', size: 1, primary: id };
        all[id] = result[id];
        return false;
      }
      const { n, room } = options[0];
      const hetu = heTuMatch(c, n);
      room.extra = [...(room.extra || []), { cell: key(c), lo: c.lo, hetu }];
      result[key(c)] = room;
      all[key(c)] = room;
      return false;
    });
  }
  // Соседняя комната, которой отходит остальная часть сектора подсобного
  const auxRoom = Object.values(result).find((r) => r.key === 'aux' && !r.sharedWith);
  if (auxRoom) {
    const c = cells.find((x) => key(x) === auxRoom.primary);
    const partner = cells
      .filter((n) => adjacent(c, n) && all[key(n)] && all[key(n)] !== auxRoom && all[key(n)].type !== 'utility')
      .map((n) => ({ room: all[key(n)], s: joinScore(c, n, all[key(n)]) }))
      .sort((a, b) => b.s - a.s)[0];
    auxRoom.sharedWith = partner?.room.key ?? null;
  }

  // Мокрые клетки этажа — для стояка следующего этажа
  const wetKeys = new Set(Object.entries(best.assign || {}).filter(([, r]) => r.wet).map(([k]) => k));
  const wetCells = cells.filter((c) => wetKeys.has(key(c)));
  const wetConnected = wetCells.every((c) => wetCells.length < 2 || wetCells.some((o) => o !== c && adjacent(o, c)));
  return { assign: result, dropped, merged, score: best.score, wetKeys, wetConnected };
}
