// Стороны дома, дверь и помощник выбора фасада.
// Стороны считаются по плану: front — фасад, back — тыл, left/right — если смотреть на фасад снаружи.
// Координаты плана те же, что в shape.js: x слева направо, y от фасада к тылу.

export const SIDE_NAMES = {
  front: 'Фасад',
  left: 'Левая стена',
  back: 'Тыл',
  right: 'Правая стена',
};

// Стороны по часовой стрелке (если смотреть сверху) и поворот направления стены от фасада
export const SIDES_CW = ['front', 'left', 'back', 'right'];
export const SIDE_BEARING = { front: 0, left: 90, back: 180, right: 270 };

export const CRITERIA = [
  { key: 'project', label: 'Парадная сторона по проекту, главная архитектура', weight: 3 },
  { key: 'view', label: 'Главный вид, большие окна гостиной', weight: 2 },
  { key: 'open', label: 'Открытое пространство: двор, поле, свободная часть участка', weight: 2 },
  { key: 'low', label: 'Низина, понижение рельефа, вода', weight: 2 },
  { key: 'road', label: 'Улица, въезд на участок', weight: 1 },
  { key: 'address', label: 'Адрес дома — с этой улицы (если стороны равноценны)', weight: 1 },
  { key: 'quiet', label: 'Самая спокойная сторона, меньше всего окон (это тыл)', weight: -1 },
  { key: 'support', label: 'Опора: холм, лес, высокие постройки, соседний дом вплотную', weight: -2 },
];

// Фасад в первую очередь — сторона главного входа, поэтому дверь весит больше прочих признаков
export const DOOR_WEIGHT = 2;

export const emptyHelp = () => ({ front: [], left: [], back: [], right: [] });

/**
 * Баллы сторон: {front: n, …}. Дверь добавляет балл своей стороне,
 * если doorCounts (дверь на востоке в Якутии ставят по традиции — она фасад не определяет).
 */
export function scoreSides(help, doorSide, doorCounts = true) {
  const weights = Object.fromEntries(CRITERIA.map((c) => [c.key, c.weight]));
  const out = {};
  for (const side of SIDES_CW) {
    out[side] = (help?.[side] || []).reduce((s, k) => s + (weights[k] || 0), 0) + (doorCounts && side === doorSide ? DOOR_WEIGHT : 0);
  }
  return out;
}

/**
 * Рекомендация по баллам. ambiguous — если отрыв лучшей стороны не больше 1 балла
 * или ничего не отмечено.
 */
export function recommend(scores) {
  const sorted = [...SIDES_CW].sort((a, b) => scores[b] - scores[a]);
  const [best, second] = sorted;
  const filled = SIDES_CW.some((s) => scores[s] !== 0);
  return {
    best,
    filled,
    ambiguous: !filled || scores[best] - scores[second] <= 1,
    rivals: sorted.filter((s) => scores[best] - scores[s] <= 1),
  };
}

/** Как будет называться сторона, если фасадом станет newFront. */
export function relabelSide(side, newFront) {
  const k = SIDES_CW.indexOf(newFront);
  const i = SIDES_CW.indexOf(side);
  return SIDES_CW[(i - k + 4) % 4];
}

// Точка плана в координатах плана с новым фасадом
function mapPoint(x, y, W, D, newFront) {
  switch (newFront) {
    case 'right': return [y, W - x];
    case 'left': return [D - y, x];
    case 'back': return [W - x, D - y];
    default: return [x, y];
  }
}

/** Габарит и вырезы этажа, если фасадом станет сторона newFront. */
export function transformCuts(cuts, W, D, newFront) {
  const turn = newFront === 'left' || newFront === 'right';
  const out = cuts.map((c) => {
    const [ax, ay] = mapPoint(c.x, c.y, W, D, newFront);
    const [bx, by] = mapPoint(c.x + c.w, c.y + c.h, W, D, newFront);
    return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
  });
  return { W: turn ? D : W, D: turn ? W : D, cuts: out };
}

/** Длина стены по габариту. */
export function wallLength(side, W, D) {
  return side === 'front' || side === 'back' ? W : D;
}

/**
 * Точка двери на плане. pos — от левого края стены, если смотреть на эту стену снаружи;
 * null — середина стены.
 */
export function doorPoint(door, W, D) {
  const len = wallLength(door.side, W, D);
  const pos = Math.min(len, Math.max(0, door.pos ?? len / 2));
  switch (door.side) {
    case 'back': return { x: W - pos, y: D, along: 'x' };
    case 'right': return { x: W, y: pos, along: 'y' };
    case 'left': return { x: 0, y: D - pos, along: 'y' };
    default: return { x: pos, y: 0, along: 'x' };
  }
}

// ---- Дверь в секторе В или ЮВ (традиция Якутии) ----

// Сектора для двери: Восток (Ло Шу 3) и Юго-восток (4)
export const DOOR_SECTORS = [3, 4];

const TIMING_RANK = { wang: 3, sheng: 2, tui: 1, neutral: 1, shuai: 0 };
const angleDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

/** Сектор (номер Ло Шу) под точкой двери. */
export function doorSector(door, W, D, layout) {
  const p = doorPoint(door, W, D);
  const eps = 1e-3;
  const x = Math.min(W - eps, Math.max(eps, p.x));
  const y = Math.min(D - eps, Math.max(eps, p.y));
  const row = 2 - Math.min(2, Math.floor((y / D) * 3));
  const col = Math.min(2, Math.floor((x / W) * 3));
  return layout[row][col];
}

/** Благоприятные звёзды воды для двери: звезда периода и следующая (в 9-м периоде — 9 и 1). */
export function doorStars(period) {
  return [period, (period % 9) + 1];
}

/**
 * Варианты двери, лучший первый:
 * 1) сектор В или ЮВ с благоприятной звездой воды;
 * 2) любой другой сектор с благоприятной звездой воды;
 * 3) сектор В или ЮВ (традиция Якутии).
 * Внутри — звезда периода раньше следующей, затем лучше состояние звезды, затем Восток раньше ЮВ.
 * Стена — та, что смотрит ближе всего к направлению сектора; дверь посередине клетки.
 * @param layout раскладка плана (фасад снизу), cov — заполненность клеток,
 *        water — {номер Ло Шу: звезда воды}, timing — функция состояния звезды
 */
export function doorOptions({ layout, cov, W, D, fsAz, water, timing, palaceIndex, period, preferLo = null, skip = [] }) {
  const good = doorStars(period);
  const options = [];
  layout.forEach((r, row) => r.forEach((lo, col) => {
    if (lo === 5 || cov[row][col] <= 1e-9 || skip.includes(lo)) return;
    const traditional = DOOR_SECTORS.includes(lo);
    const goodStar = good.includes(water[lo]);
    if (!traditional && !goodStar) return;
    const walls = [];
    if (row === 2) walls.push('front');
    if (row === 0) walls.push('back');
    if (col === 0) walls.push('left');
    if (col === 2) walls.push('right');
    const sectorBearing = palaceIndex[lo] * 45;
    const side = walls.sort((a, b) => angleDiff(fsAz + SIDE_BEARING[a], sectorBearing) - angleDiff(fsAz + SIDE_BEARING[b], sectorBearing))[0];
    const x = ((col + 0.5) * W) / 3;
    const y = ((2 - row + 0.5) * D) / 3;
    const pos = { front: x, back: W - x, right: y, left: D - y }[side];
    // preferLo — сектор двойной 9 в двухэтажном доме: вход здесь, спальня над ним — идеальный вариант
    const tier = lo === preferLo ? -1 : traditional && goodStar ? 0 : goodStar ? 1 : 2;
    options.push({ side, pos, lo, traditional, goodStar, ideal: lo === preferLo, tier, star: water[lo], rank: TIMING_RANK[timing(water[lo]).key] });
  }));
  const starOrder = (o) => (o.goodStar ? good.indexOf(o.star) : good.length);
  const sectorOrder = (o) => (o.traditional ? DOOR_SECTORS.indexOf(o.lo) : DOOR_SECTORS.length);
  return options.sort((a, b) => a.tier - b.tier || starOrder(a) - starOrder(b) || b.rank - a.rank || sectorOrder(a) - sectorOrder(b));
}

/** Лучший вариант двери или null. */
export function autoDoor(params) {
  return doorOptions(params)[0] || null;
}
