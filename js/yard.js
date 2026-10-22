// Конструктор участка: дом и хозпостройки, солнце и тени в течение дня,
// карта солнечных часов и подбор растений по свету.

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const norm360 = (a) => ((a % 360) + 360) % 360;

// ---- Солнце ----

/**
 * Положение солнца (упрощённые формулы NOAA, точность около 0,5°).
 * ms — время UTC в миллисекундах. Возвращает высоту и азимут (от севера по часовой), °.
 */
export function sunPosition(ms, lat, lng) {
  const n = ms / 86400000 + 2440587.5 - 2451545.0;
  const L = norm360(280.46 + 0.9856474 * n);
  const g = rad(norm360(357.528 + 0.9856003 * n));
  const lambda = rad(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const eps = rad(23.439 - 0.0000004 * n);
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = norm360((18.697374558 + 24.06570982441908 * n) * 15);
  const h = rad(gmst + lng) - ra;
  const phi = rad(lat);
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h));
  const az = Math.atan2(-Math.sin(h), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(h));
  return { alt: deg(alt), az: norm360(deg(az)) };
}

/** Время UTC (мс) для местного времени: дата 'ММ-ДД', часы (дробные), часовой пояс UTC+tz. */
export function localToUtc(year, mmdd, hours, tz) {
  const [m, d] = mmdd.split('-').map(Number);
  return Date.UTC(year, m - 1, d) + (hours - tz) * 3600000;
}

/** Восход, закат и длина дня по местному времени (часы). */
export function sunDay(year, mmdd, lat, lng, tz, step = 1 / 12) {
  let rise = null;
  let set = null;
  let prev = sunPosition(localToUtc(year, mmdd, 0, tz), lat, lng).alt;
  for (let t = step; t <= 24 + 1e-9; t += step) {
    const a = sunPosition(localToUtc(year, mmdd, t, tz), lat, lng).alt;
    if (prev <= -0.83 && a > -0.83 && rise === null) rise = t;
    if (prev > -0.83 && a <= -0.83) set = t;
    prev = a;
  }
  const noonAlt = Math.max(...Array.from({ length: 49 }, (_, i) => sunPosition(localToUtc(year, mmdd, i / 2, tz), lat, lng).alt));
  const polar = rise === null && set === null ? (noonAlt > 0 ? 'day' : 'night') : null;
  return { rise, set, length: polar === 'day' ? 24 : polar === 'night' ? 0 : (set ?? 24) - (rise ?? 0), polar, noonAlt };
}

/** Часовой пояс по долготе, если не задан вручную. */
export const tzGuess = (lng) => Math.round(lng / 15);

// ---- Геометрия участка ----
// Координаты участка в метрах: x — вправо вдоль ширины, y — вверх вдоль глубины.
// Поворот объекта rot — по часовой стрелке, °. Поворот участка — азимут его верхней стороны.

function rotate([x, y], a) {
  const t = rad(a);
  return [x * Math.cos(t) + y * Math.sin(t), -x * Math.sin(t) + y * Math.cos(t)];
}

/** Прямоугольник объекта: центр (x, y), размеры w × d, поворот rot. */
export function rectPoly(o, w = o.w, d = o.d, dx = 0, dy = 0) {
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
    .map(([px, py]) => rotate([px + dx, py + dy], o.rot || 0))
    .map(([px, py]) => [o.x + px, o.y + py]);
}

export const HOUSE_SHAPES = { square: 'Квадрат', rect: 'Прямоугольник', L: 'Г-образный' };

/**
 * Части дома — выпуклые многоугольники (для теней).
 * Г-образный: из прямоугольника вырезан правый верхний угол cw × cd (в осях дома).
 */
export function housePieces(h) {
  const w = h.w;
  const d = h.shape === 'square' ? h.w : h.d;
  if (h.shape !== 'L') return [rectPoly(h, w, d)];
  const cw = Math.min(h.cw, w - 1);
  const cd = Math.min(h.cd, d - 1);
  // Нижняя полоса во всю ширину и левая часть над ней
  return [
    rectPoly(h, w, d - cd, 0, -cd / 2),
    rectPoly(h, w - cw, cd, -cw / 2, (d - cd) / 2),
  ];
}

/** Контур дома для отрисовки (обход по часовой). */
export function houseOutline(h) {
  const w = h.w;
  const d = h.shape === 'square' ? h.w : h.d;
  let pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  if (h.shape === 'L') {
    const cw = Math.min(h.cw, w - 1);
    const cd = Math.min(h.cd, d - 1);
    pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2 - cd], [w / 2 - cw, d / 2 - cd], [w / 2 - cw, d / 2], [-w / 2, d / 2]];
  }
  return pts.map((p) => rotate(p, h.rot || 0)).map(([px, py]) => [h.x + px, h.y + py]);
}

/** Сторона фасада дома (нижняя в осях дома). */
export function houseFacade(h) {
  const w = h.w;
  const d = h.shape === 'square' ? h.w : h.d;
  return [[-w / 2, -d / 2], [w / 2, -d / 2]].map((p) => rotate(p, h.rot || 0)).map(([px, py]) => [h.x + px, h.y + py]);
}

export function circlePoly(x, y, r, n = 14) {
  return Array.from({ length: n }, (_, i) => [x + r * Math.cos((2 * Math.PI * i) / n), y + r * Math.sin((2 * Math.PI * i) / n)]);
}

/** Выпуклая оболочка (монотонная цепь). */
export function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Точка внутри выпуклого многоугольника (обход против часовой — как у hull). */
export function inConvex(poly, [x, y]) {
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false;
  }
  return true;
}

/** Точка внутри произвольного многоугольника. */
export function inPoly(poly, [x, y]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Вектор к солнцу в осях участка (единичный, горизонтальный). */
export function sunVector(az, plotRot = 0) {
  const t = rad(az - plotRot);
  return [Math.sin(t), Math.cos(t)];
}

const MAX_SHADOW = 150;

/**
 * Тень призмы высотой h с основанием poly (выпуклое) при высоте солнца alt.
 * Возвращает выпуклый многоугольник или null, если солнце под горизонтом.
 */
export function shadowPoly(poly, h, alt, az, plotRot = 0) {
  if (alt <= 0 || h <= 0) return null;
  const len = Math.min(MAX_SHADOW, h / Math.tan(rad(alt)));
  const [sx, sy] = sunVector(az, plotRot);
  return hull([...poly, ...poly.map(([x, y]) => [x - sx * len, y - sy * len])]);
}

// ---- Постройки ----

export const BUILDINGS = [
  { key: 'bath', label: 'Баня', w: 5, d: 4, h: 4, color: '#9a6b45' },
  { key: 'shed', label: 'Сарай', w: 4, d: 3, h: 3, color: '#86705a' },
  { key: 'greenhouse', label: 'Теплица', w: 3, d: 6, h: 2.5, color: '#a9d6c8', glass: true },
  { key: 'path', label: 'Дорожка', w: 1, d: 8, h: 0, color: '#cdbfa4', flat: true },
  { key: 'garage', label: 'Гараж', w: 8, d: 8, h: 4, color: '#6f6a64' },
  { key: 'workshop', label: 'Мастерская', w: 6, d: 4, h: 3.5, color: '#7d6b58' },
  { key: 'balagan', label: 'Балаган', w: 6, d: 6, h: 3.5, color: '#a08463' },
  { key: 'bedA', label: 'Клумба: зона А', w: 5, d: 2, h: 0, color: '#c9b44a', flat: true, bed: 'A' },
  { key: 'bedB', label: 'Миксбордер: зона Б', w: 8, d: 3, h: 0, color: '#e2b8c4', flat: true, bed: 'B' },
];
export const BUILDING_BY_KEY = Object.fromEntries(BUILDINGS.map((b) => [b.key, b]));

// ---- Растения ----
// light: sun — солнце, part — полутень, shade — тень (см. lightZone).
// size: tall — высокое дерево, mid — среднее дерево, shrub — кустарник, low — травы и цветы.

const P = (key, name, group, h, r, light, color, extra = {}) => ({ key, name, group, h, r, light, color, size: extra.size || (group === 'tree' ? 'tall' : group === 'shrub' || group === 'fruit' ? 'shrub' : 'low'), ...extra });

export const PLANTS = [
  // Топ-10 «посадил и забыл»
  P('cornus', 'Дерен белый', 'shrub', 2.5, 1.2, ['sun', 'part', 'shade'], '#a8392c', { top: 1, note: 'Зимой красные побеги на белом снегу, летом зелёная листва.' }),
  P('spiraea', 'Спирея ниппонская', 'shrub', 1.5, 0.8, ['sun', 'part'], '#e8e4d6', { top: 2, note: 'Плотный шар, белые соцветия в начале лета.' }),
  P('physocarpus', 'Пузыреплодник', 'shrub', 2.5, 1.2, ['sun', 'part'], '#7a3b4a', { top: 3 }),
  P('cotoneaster', 'Кизильник', 'shrub', 2, 1, ['sun', 'part'], '#4f6b3a', { top: 4 }),
  P('potentilla', 'Лапчатка кустарниковая', 'shrub', 1, 0.6, ['sun'], '#e2c23a', { top: 5 }),
  P('bergenia', 'Бадан', 'perennial', 0.4, 0.4, ['part', 'shade', 'sun'], '#c9608a', { top: 6 }),
  P('sedum', 'Очиток видный', 'perennial', 0.5, 0.3, ['sun'], '#d07a9a', { top: 7, note: 'Цветёт август–октябрь: «Frosty Morn» белый, «Neon» ярко-розовый.' }),
  P('irisSib', 'Ирис сибирский', 'perennial', 0.8, 0.3, ['sun', 'part'], '#6a4fa0', { top: 8 }),
  P('larix', 'Лиственница', 'tree', 12, 3, ['sun'], '#3f6a3a', { top: 9 }),
  P('pinus', 'Сосна', 'tree', 12, 3, ['sun'], '#2f5a3f', { top: 10 }),
  // Деревья
  P('betula', 'Берёза', 'tree', 12, 3, ['sun'], '#7a9a4a'),
  P('padus', 'Черёмуха', 'tree', 6, 2.5, ['sun', 'part'], '#5e8a4a', { size: 'mid' }),
  P('crataegus', 'Боярышник', 'tree', 4, 2, ['sun', 'part'], '#6a7a3a', { size: 'mid' }),
  // Кустарники
  P('juniper', 'Можжевельник казацкий', 'shrub', 1, 1.2, ['sun', 'part'], '#6f8a7a', { note: 'Стелющийся, серо-зелёная хвоя — фон для цветов.' }),
  P('syringa', 'Сирень венгерская', 'shrub', 3, 1.5, ['sun', 'part'], '#9a7ab8'),
  P('caragana', 'Акация жёлтая (карагана)', 'shrub', 3, 1.5, ['sun'], '#d8c040'),
  P('rosaAcic', 'Роза иглистая', 'shrub', 1.2, 0.7, ['sun'], '#d06a8a'),
  P('rosaCanina', 'Шиповник', 'shrub', 1.5, 0.8, ['sun'], '#c4504a'),
  P('sorbaria', 'Рябинник рябинолистный', 'shrub', 2, 1.2, ['sun', 'part', 'shade'], '#8aa86a'),
  P('salix', 'Тальник (ива кустарниковая)', 'shrub', 3, 1.5, ['sun', 'part'], '#8ab070'),
  P('ledum', 'Багульник', 'shrub', 0.8, 0.5, ['part', 'shade'], '#b0a0c0'),
  // Плодово-ягодные
  P('lonicera', 'Жимолость', 'fruit', 1.5, 0.8, ['sun', 'part'], '#4a5fa0', { note: 'Одна из самых стойких ягод.' }),
  P('malus', 'Яблоня ягодная', 'fruit', 5, 2, ['sun'], '#c0504a', { size: 'mid', note: 'Очень зимостойкая, без укрытия.' }),
  P('ribes', 'Смородина', 'fruit', 1.5, 0.8, ['sun', 'part'], '#3a3050'),
  P('hippophae', 'Облепиха', 'fruit', 3, 1.5, ['sun'], '#e08a2a', { size: 'mid', note: 'Корни у поверхности — не перекапывайте рядом.' }),
  P('prunus', 'Вишня песчаная', 'fruit', 1.2, 0.7, ['sun'], '#7a2a3a', { note: 'Иногда подмерзает — место потеплее.' }),
  // Многолетники
  P('trollius', 'Купальница азиатская', 'perennial', 0.6, 0.3, ['sun', 'part'], '#f0a020'),
  P('hemerocallis', 'Лилейник', 'perennial', 0.8, 0.4, ['sun', 'part'], '#f0c0a0'),
  P('astilbe', 'Астильба', 'perennial', 0.8, 0.4, ['part', 'shade'], '#f0b8c8'),
  P('phloxPan', 'Флокс метельчатый', 'perennial', 1, 0.4, ['sun', 'part'], '#f4d0dc'),
  P('echinacea', 'Эхинацея пурпурная', 'perennial', 0.9, 0.35, ['sun'], '#d890b0'),
  P('rudbeckia', 'Рудбекия блестящая', 'perennial', 0.7, 0.35, ['sun'], '#e8b020'),
  P('paeonia', 'Пион', 'perennial', 0.8, 0.5, ['sun'], '#e07090'),
  P('delphinium', 'Дельфиниум', 'perennial', 1.5, 0.4, ['sun'], '#4a6ad0'),
  P('adonis', 'Адонис сибирский', 'perennial', 0.4, 0.3, ['sun'], '#f0d020'),
  P('pulsatilla', 'Прострел (сон-трава)', 'perennial', 0.2, 0.2, ['sun'], '#8a70c0'),
  P('hosta', 'Хоста', 'perennial', 0.5, 0.5, ['part', 'shade'], '#6a9a6a'),
  P('achillea', 'Тысячелистник', 'perennial', 0.6, 0.3, ['sun'], '#f0e0c0'),
  P('geranium', 'Герань луговая', 'perennial', 0.6, 0.35, ['sun', 'part'], '#7a80d0'),
  P('filipendula', 'Лабазник', 'perennial', 1.2, 0.5, ['sun', 'part'], '#f0ece0'),
  P('primula', 'Примула', 'perennial', 0.2, 0.2, ['part'], '#e0d040'),
  P('heuchera', 'Гейхера', 'perennial', 0.4, 0.3, ['part', 'shade'], '#8a3a5a'),
  P('chrysanthemum', 'Златоцвет', 'perennial', 0.5, 0.3, ['sun'], '#f4e04a'),
  // Почвопокровные
  P('phloxSub', 'Флокс шиловидный', 'ground', 0.15, 0.3, ['sun'], '#f2c4d4', { note: 'Ковёр цветов в мае–июне.' }),
  P('thymus', 'Тимьян ползучий', 'ground', 0.1, 0.3, ['sun'], '#e8e0f0'),
  P('sempervivum', 'Молодило', 'ground', 0.1, 0.15, ['sun'], '#8a6a5a'),
  P('sagina', 'Мшанка шиловидная', 'ground', 0.05, 0.3, ['sun', 'part'], '#7ab060'),
  P('orostachys', 'Горноколосник колючий', 'ground', 0.1, 0.15, ['sun'], '#a0b090'),
  P('trifolium', 'Клевер ползучий', 'ground', 0.1, 0.3, ['sun', 'part'], '#90b080'),
  // Злаки
  P('festuca', 'Овсяница сизая', 'grass', 0.3, 0.2, ['sun'], '#9ab4c0'),
  P('deschampsia', 'Щучка дернистая', 'grass', 0.8, 0.3, ['sun', 'part', 'shade'], '#c8b880', { note: 'Воздушные метёлки, красивы под инеем.' }),
  P('stipa', 'Ковыль перистый', 'grass', 0.7, 0.3, ['sun'], '#d8d0b0'),
  P('bromus', 'Кострец', 'grass', 0.8, 0.3, ['sun'], '#b8b080'),
];
export const PLANT_BY_KEY = Object.fromEntries(PLANTS.map((p) => [p.key, p]));

export const PLANT_GROUPS = [
  ['top', 'Топ-10 «посадил и забыл»'],
  ['tree', 'Деревья'],
  ['shrub', 'Кустарники'],
  ['fruit', 'Плодово-ягодные'],
  ['perennial', 'Многолетники'],
  ['ground', 'Почвопокровные'],
  ['grass', 'Злаки'],
];

export const LIGHT_TEXT = { sun: 'солнце', part: 'полутень', shade: 'тень' };

/**
 * Свет места: доля прямого солнца от того, что за этот день получает открытое место.
 * Так правило работает и при длинном северном лете, и в средней полосе:
 * солнце — 65 % и больше, полутень — 35–65 %, тень — меньше 35 %.
 */
export const LIGHT_SHARE = { sun: 0.65, part: 0.35 };
export function lightZone(hours, maxHours) {
  const share = maxHours > 0 ? hours / maxHours : 0;
  if (share >= LIGHT_SHARE.sun) return 'sun';
  if (share >= LIGHT_SHARE.part) return 'part';
  return 'shade';
}

/** Выпуклые многоугольники пересекаются (теорема о разделяющей оси). */
export function convexOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      const nx = y2 - y1;
      const ny = x1 - x2;
      const pa = a.map(([x, y]) => x * nx + y * ny);
      const pb = b.map(([x, y]) => x * nx + y * ny);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

// Композиции: ряды от заднего плана к переднему
export const BEDS = {
  A: {
    title: 'Зона А: купальница, ирисы и злаки',
    palette: 'жёлто-фиолетовая',
    rows: [
      ['Задний план', ['trollius', 'deschampsia']],
      ['Средний план', ['irisSib', 'stipa']],
      ['Передний край', ['festuca']],
    ],
  },
  B: {
    title: 'Зона Б: миксбордер бело-розовый',
    palette: 'бело-розовая',
    rows: [
      ['Задний ряд — структура', ['cornus', 'spiraea', 'juniper']],
      ['Средний ряд — высокие акценты', ['hemerocallis', 'astilbe', 'phloxPan', 'echinacea']],
      ['Передний ряд', ['phloxSub', 'sedum', 'thymus', 'festuca']],
      ['Акценты по всей композиции', ['stipa', 'deschampsia']],
    ],
  },
};

// ---- Сцена: кто отбрасывает тень ----

export function casters(yard) {
  const out = [];
  for (const poly of housePieces(yard.house)) out.push({ id: 'house', poly, h: yard.house.h });
  for (const it of yard.items) {
    const b = BUILDING_BY_KEY[it.t];
    if (!b || b.flat || !(it.h > 0)) continue;
    out.push({ id: it.id, poly: rectPoly(it), h: it.h, glass: !!b.glass });
  }
  for (const p of yard.plants) {
    const pl = PLANT_BY_KEY[p.t];
    if (!pl || pl.h < 1.2) continue;
    out.push({ id: p.id, poly: circlePoly(p.x, p.y, pl.r, 10), h: pl.h, crown: true });
  }
  return out;
}

/** Тени всех объектов на момент времени. */
export function shadowsAt(yard, sun) {
  return casters(yard)
    .map((c) => ({ ...c, shadow: shadowPoly(c.poly, c.h, sun.alt, sun.az, yard.plot.rot) }))
    .filter((c) => c.shadow);
}

const bbox = (poly) => poly.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);

/**
 * Часы прямого солнца за день в точках сетки.
 * opts: { year, lat, lng, tz, step (ч), minAlt (°), cell (м) }.
 * Солнце ниже minAlt не считается: у горизонта оно почти не греет.
 */
export function sunHours(yard, opts, points = null) {
  const { year, lat, lng, tz, step = 0.25, minAlt = 10 } = opts;
  const cs = casters(yard).filter((c) => !c.glass);
  const samples = [];
  for (let t = step / 2; t < 24; t += step) {
    const s = sunPosition(localToUtc(year, yard.date, t, tz), lat, lng);
    if (s.alt < minAlt) continue;
    samples.push(cs.map((c) => {
      const sh = shadowPoly(c.poly, c.h, s.alt, s.az, yard.plot.rot);
      return { id: c.id, sh, bb: bbox(sh) };
    }));
  }
  const at = (pt, skip) => {
    let lit = 0;
    for (const sm of samples) {
      let dark = false;
      for (const c of sm) {
        if (c.id === skip) continue;
        if (pt[0] < c.bb[0] || pt[0] > c.bb[2] || pt[1] < c.bb[1] || pt[1] > c.bb[3]) continue;
        if (inConvex(c.sh, pt)) { dark = true; break; }
      }
      if (!dark) lit++;
    }
    return lit * step;
  };
  if (points) return { hours: points.map((p) => at(p.pt, p.skip)), maxHours: samples.length * step };
  const cell = opts.cell || 1;
  const grid = [];
  for (let y = cell / 2; y < yard.plot.d; y += cell) {
    for (let x = cell / 2; x < yard.plot.w; x += cell) grid.push({ x, y, hours: at([x, y]) });
  }
  return { cell, grid, maxHours: samples.length * step };
}

// ---- Правила размещения ----

// Расстояния до границы участка (СП 53.13330): дом — 3 м, постройки — 1 м,
// высокие деревья — 4 м, средние — 2 м, кустарники — 1 м.
const EDGE = { house: 3, building: 1, tall: 4, mid: 2, shrub: 1 };

function edgeDist(poly, plot) {
  let min = Infinity;
  for (const [x, y] of poly) {
    min = Math.min(min, x, y, plot.w - x, plot.d - y);
  }
  return min;
}

function polyDist(a, b) {
  // Расстояние между многоугольниками по вершинам и рёбрам (для проверки «не ближе»)
  const segDist = ([px, py], [ax, ay], [bx, by]) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  };
  let min = Infinity;
  for (const [P1, P2] of [[a, b], [b, a]]) {
    for (const p of P1) {
      if (inPoly(P2, p)) return 0;
      for (let i = 0; i < P2.length; i++) min = Math.min(min, segDist(p, P2[i], P2[(i + 1) % P2.length]));
    }
  }
  return min;
}

const fmt = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

/** Проверка дома и построек: отступы от границ участка. */
export function checkBuildings(yard) {
  const out = [];
  const hd = edgeDist(houseOutline(yard.house), yard.plot);
  if (hd < 0) out.push({ id: 'house', level: 'bad', text: 'Дом выходит за границу участка.' });
  else if (hd < EDGE.house) out.push({ id: 'house', level: 'bad', text: `Дом в ${fmt(hd)} м от границы участка — нужно не меньше ${EDGE.house} м.` });
  for (const it of yard.items) {
    const b = BUILDING_BY_KEY[it.t];
    if (!b || b.flat) continue;
    const d = edgeDist(rectPoly(it), yard.plot);
    if (d < 0) out.push({ id: it.id, level: 'bad', text: `${b.label} выходит за границу участка.` });
    else if (d < EDGE.building) out.push({ id: it.id, level: 'bad', text: `${b.label} в ${fmt(d)} м от границы — нужно не меньше ${EDGE.building} м.` });
  }
  return out;
}

/**
 * Проверка растения: свет на месте посадки, отступ от границы и от дома.
 * hours — часы солнца в точке посадки.
 */
export function checkPlant(p, yard, hours, maxHours) {
  const pl = PLANT_BY_KEY[p.t];
  const zone = lightZone(hours, maxHours);
  const notes = [];
  let level = 'good';
  if (pl.light.includes(zone)) notes.push(`Свет подходит: ${fmt(hours)} ч солнца из ${fmt(maxHours)} — ${LIGHT_TEXT[zone]}.`);
  else {
    level = 'bad';
    notes.push(`Здесь ${fmt(hours)} ч солнца из ${fmt(maxHours)} — ${LIGHT_TEXT[zone]}, а нужно: ${pl.light.map((l) => LIGHT_TEXT[l]).join(' или ')}.`);
  }
  const edge = EDGE[pl.size];
  if (edge) {
    const d = Math.min(p.x, p.y, yard.plot.w - p.x, yard.plot.d - p.y);
    if (d < edge) {
      level = 'bad';
      notes.push(`До границы участка ${fmt(Math.max(0, d))} м — для ${pl.size === 'tall' ? 'высокого дерева' : pl.size === 'mid' ? 'среднего дерева' : 'кустарника'} нужно не меньше ${edge} м.`);
    }
  }
  if (pl.size === 'tall' || pl.size === 'mid') {
    const d = polyDist(circlePoly(p.x, p.y, 0.01, 4), houseOutline(yard.house));
    const need = pl.size === 'tall' ? 5 : 3;
    if (d < need) {
      if (level === 'good') level = 'mixed';
      notes.push(`До дома ${fmt(d)} м: корни и крона рядом с фундаментом — лучше не ближе ${need} м.`);
    }
  }
  return { level, zone, notes };
}

/** Новый участок по умолчанию: дом 12 × 9 м. */
export function defaultYard() {
  return {
    plot: { w: 30, d: 40, rot: 0 },
    house: { shape: 'rect', w: 12, d: 9, cw: 5, cd: 4, h: 7, x: 15, y: 24, rot: 0 },
    items: [],
    plants: [],
    date: '06-21',
    time: 12,
    tz: null,
    view: 'shadow',
    seq: 1,
  };
}
