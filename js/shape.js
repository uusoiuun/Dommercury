// Форма этажа: прямоугольник W×D минус прямоугольные вырезы.
// Координаты плана: x — слева направо, если смотреть на фасад снаружи (0…W),
// y — от фасада к тылу (0…D).

export const SHAPES = {
  rect: 'Прямоугольник',
  L: 'Г-образный',
  U: 'П-образный',
  T: 'Т-образный',
  bay: 'С эркером (выступом)',
  custom: 'Свой контур (вырезы)',
};

export const CORNERS = {
  fl: 'слева у фасада',
  fr: 'справа у фасада',
  bl: 'слева у тыла',
  br: 'справа у тыла',
};

export const BAY_SIDES = {
  front: 'фасада',
  back: 'тыла',
  left: 'левой стены',
  right: 'правой стены',
};

export const defaultShape = () => ({ type: 'rect', corner: 'fl', side: 'front', cw: 4, cd: 4, bw: 3, bd: 1.5, bo: 0, cuts: [] });

/**
 * Габарит этажа с выступами и вырезы по нему.
 * W, D — основной объём; эркер выступает наружу и увеличивает габарит.
 */
export function shapeGeometry(shape, W, D) {
  const s = shape || defaultShape();
  if (s.type !== 'bay') return { W, D, cuts: shapeCuts(s, W, D) };
  const side = BAY_SIDES[s.side] ? s.side : 'front';
  const horizontal = side === 'front' || side === 'back';
  const wall = horizontal ? W : D;
  const bw = clamp(Number(s.bw) || 0, 0, wall);
  const bd = Math.max(0, Number(s.bd) || 0);
  // Смещение эркера от середины стены (вправо или к тылу — плюс)
  const start = clamp((wall - bw) / 2 + (Number(s.bo) || 0), 0, wall - bw);
  if (!bw || !bd) return { W, D, cuts: [] };
  if (horizontal) {
    const y = side === 'front' ? 0 : D;
    const cuts = [{ x: 0, y, w: start, h: bd }, { x: start + bw, y, w: W - start - bw, h: bd }];
    return { W, D: D + bd, cuts: cuts.filter((c) => c.w > 0) };
  }
  const x = side === 'left' ? 0 : W;
  const cuts = [{ x, y: 0, w: bd, h: start }, { x, y: start + bw, w: bd, h: D - start - bw }];
  return { W: W + bd, D, cuts: cuts.filter((c) => c.h > 0) };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Вырезы этажа по шаблону, обрезанные по габариту. */
export function shapeCuts(shape, W, D) {
  const s = shape || defaultShape();
  const cw = clamp(Number(s.cw) || 0, 0, W);
  const cd = clamp(Number(s.cd) || 0, 0, D);
  const atBack = s.side === 'back';
  let cuts = [];
  switch (s.type) {
    case 'L': {
      const right = s.corner === 'fr' || s.corner === 'br';
      const back = s.corner === 'bl' || s.corner === 'br';
      cuts = [{ x: right ? W - cw : 0, y: back ? D - cd : 0, w: cw, h: cd }];
      break;
    }
    case 'U':
      cuts = [{ x: (W - cw) / 2, y: atBack ? D - cd : 0, w: cw, h: cd }];
      break;
    case 'T': {
      const shoulder = Math.min(cw, W / 2);
      const y = atBack ? D - cd : 0;
      cuts = [{ x: 0, y, w: shoulder, h: cd }, { x: W - shoulder, y, w: shoulder, h: cd }];
      break;
    }
    case 'custom':
      cuts = (s.cuts || []).map((c) => ({ x: Number(c.x) || 0, y: Number(c.y) || 0, w: Number(c.w) || 0, h: Number(c.h) || 0 }));
      break;
    default:
      cuts = [];
  }
  return cuts
    .map((c) => {
      const x1 = clamp(c.x, 0, W);
      const y1 = clamp(c.y, 0, D);
      const x2 = clamp(c.x + c.w, 0, W);
      const y2 = clamp(c.y + c.h, 0, D);
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    })
    .filter((c) => c.w > 0 && c.h > 0);
}

const uniqSorted = (arr) => [...new Set(arr.map((v) => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b);

/**
 * Разбивка габарита на прямоугольники по краям вырезов (и по линиям сетки 3×3).
 * inside[i][j] — прямоугольник [xs[i], xs[i+1]] × [ys[j], ys[j+1]] принадлежит дому.
 */
export function decompose(W, D, cuts) {
  const xs = uniqSorted([0, W, W / 3, (2 * W) / 3, ...cuts.flatMap((c) => [c.x, c.x + c.w])]);
  const ys = uniqSorted([0, D, D / 3, (2 * D) / 3, ...cuts.flatMap((c) => [c.y, c.y + c.h])]);
  const inside = [];
  for (let i = 0; i < xs.length - 1; i++) {
    inside.push([]);
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      inside[i].push(!cuts.some((c) => cx > c.x && cx < c.x + c.w && cy > c.y && cy < c.y + c.h));
    }
  }
  return { xs, ys, inside };
}

/** Прямоугольники дома и вырезов: [{x1, y1, x2, y2, inside}]. */
export function pieces(dec) {
  const out = [];
  dec.inside.forEach((col, i) => col.forEach((inside, j) => {
    out.push({ x1: dec.xs[i], x2: dec.xs[i + 1], y1: dec.ys[j], y2: dec.ys[j + 1], inside });
  }));
  return out;
}

/** Отрезки контура дома: [{x1, y1, x2, y2, facing}], facing — куда смотрит стена. */
export function outline(dec) {
  const { xs, ys, inside } = dec;
  const at = (i, j) => i >= 0 && j >= 0 && i < xs.length - 1 && j < ys.length - 1 && inside[i][j];
  const segs = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      if (!inside[i][j]) continue;
      if (!at(i - 1, j)) segs.push({ x1: xs[i], y1: ys[j], x2: xs[i], y2: ys[j + 1], facing: 'left' });
      if (!at(i + 1, j)) segs.push({ x1: xs[i + 1], y1: ys[j], x2: xs[i + 1], y2: ys[j + 1], facing: 'right' });
      if (!at(i, j - 1)) segs.push({ x1: xs[i], y1: ys[j], x2: xs[i + 1], y2: ys[j], facing: 'front' });
      if (!at(i, j + 1)) segs.push({ x1: xs[i], y1: ys[j + 1], x2: xs[i + 1], y2: ys[j + 1], facing: 'back' });
    }
  }
  return segs;
}

/**
 * Доля каждой клетки сетки 3×3, занятая домом. Ряды — как на плане с фасадом снизу:
 * [0] — у тыла, [2] — у фасада; столбцы — слева направо, если смотреть на фасад.
 */
export function coverage(W, D, cuts) {
  const dec = decompose(W, D, cuts);
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pieces(dec)) {
    if (!p.inside) continue;
    const [row, col] = cellOf(W, D, (p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2);
    cov[row][col] += ((p.x2 - p.x1) * (p.y2 - p.y1)) / ((W / 3) * (D / 3));
  }
  return cov.map((r) => r.map((v) => Math.min(1, Math.round(v * 1000) / 1000)));
}

export function area(W, D, cuts) {
  return pieces(decompose(W, D, cuts))
    .filter((p) => p.inside)
    .reduce((s, p) => s + (p.x2 - p.x1) * (p.y2 - p.y1), 0);
}

/**
 * Состояние сектора по доле, занятой домом. Если не хватает не больше трети,
 * сектор полный (например, рядом с эркером); если больше трети — часть сектора отсутствует.
 * @returns {'full'|'partial'|'none'}
 */
export function sectorStatus(cov) {
  if (cov <= 1e-9) return 'none';
  return 1 - cov > 1 / 3 + 1e-9 ? 'partial' : 'full';
}

/** Индекс клетки сетки 3×3 (ряд от тыла, столбец слева) для точки плана. */
export function cellOf(W, D, x, y) {
  return [2 - Math.min(2, Math.floor((y / D) * 3)), Math.min(2, Math.floor((x / W) * 3))];
}
