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
  { key: 'gazebo', label: 'Беседка', w: 4, d: 4, h: 3, color: '#b89668', open: true },
  { key: 'bbq', label: 'Мангальная зона', w: 4, d: 4, h: 0, color: '#9c8f86', flat: true, fire: true },
  { key: 'firepit', label: 'Костровище', w: 3.5, d: 3.5, h: 0, color: '#8f8077', flat: true, fire: true, round: true },
  { key: 'terrace', label: 'Площадка для кофе', w: 3, d: 3, h: 0, color: '#d9c6a5', flat: true },
  { key: 'comp', label: 'Композиция', w: 6, d: 2, h: 0, color: '#cbd9a8', flat: true, bed: 'C', hidden: true },
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
  P('cotoneaster', 'Кизильник черноплодный', 'shrub', 2, 1, ['sun', 'part'], '#2e2a3a', { top: 4, note: 'Чёрные ягоды и рыжая осенняя листва, хорош в живой изгороди.' }),
  P('potentilla', 'Лапчатка кустарниковая', 'shrub', 1, 0.6, ['sun'], '#e2c23a', { top: 5 }),
  P('bergenia', 'Бадан', 'perennial', 0.4, 0.4, ['part', 'shade', 'sun'], '#c9608a', { top: 6 }),
  P('sedum', 'Очиток видный', 'perennial', 0.5, 0.3, ['sun'], '#d07a9a', { top: 7, note: 'Цветёт август–октябрь: «Frosty Morn» белый, «Neon» ярко-розовый.' }),
  P('irisSib', 'Ирис сибирский', 'perennial', 0.8, 0.3, ['sun', 'part'], '#6a4fa0', { top: 8 }),
  P('larix', 'Лиственница', 'tree', 12, 3, ['sun'], '#3f6a3a', { top: 9 }),
  P('pinus', 'Сосна', 'tree', 12, 3, ['sun'], '#2f5a3f', { top: 10 }),
  // Деревья
  P('betula', 'Берёза', 'tree', 12, 3, ['sun'], '#7a9a4a'),
  P('padus', 'Черёмуха обыкновенная', 'tree', 6, 2.5, ['sun', 'part'], '#5e8a4a', { size: 'mid' }),
  P('crataegus', 'Боярышник даурский', 'tree', 4, 2, ['sun', 'part'], '#c03a2a', { size: 'mid', note: 'Белые щитки в июне, красные ягоды осенью; колючий — для изгороди.' }),
  // Кустарники
  P('juniper', 'Можжевельник казацкий', 'shrub', 1, 1.2, ['sun', 'part'], '#6f8a7a', { note: 'Стелющийся, серо-зелёная хвоя — фон для цветов.' }),
  P('syringa', 'Сирень венгерская', 'shrub', 3, 1.5, ['sun', 'part'], '#9a7ab8'),
  P('caragana', 'Карагана древовидная (акация жёлтая)', 'shrub', 3, 1.5, ['sun'], '#d8c040'),
  P('rosaAcic', 'Шиповник иглистый (роза иглистая)', 'shrub', 1.2, 0.7, ['sun'], '#d06a8a'),
  P('rosaCanina', 'Шиповник', 'shrub', 1.5, 0.8, ['sun'], '#c4504a'),
  P('sorbaria', 'Рябинник рябинолистный', 'shrub', 2, 1.2, ['sun', 'part', 'shade'], '#8aa86a'),
  P('salix', 'Тальник (ива кустарниковая)', 'shrub', 3, 1.5, ['sun', 'part'], '#8ab070'),
  P('ledum', 'Багульник', 'shrub', 0.8, 0.5, ['part', 'shade'], '#b0a0c0'),
  // Плодово-ягодные
  P('lonicera', 'Жимолость', 'fruit', 1.5, 0.8, ['sun', 'part'], '#4a5fa0', { note: 'Одна из самых стойких ягод.' }),
  P('malus', 'Яблоня ягодная', 'fruit', 5, 2, ['sun'], '#c0504a', { size: 'mid', note: 'Очень зимостойкая, без укрытия.' }),
  P('ribes', 'Смородина', 'fruit', 1.5, 0.8, ['sun', 'part'], '#3a3050'),
  P('hippophae', 'Облепиха (женское растение)', 'fruit', 3, 1.5, ['sun'], '#e08a2a', { size: 'mid', note: 'Для ягод нужно мужское растение рядом — одно на 5–8 женских. Корни у поверхности — не перекапывайте рядом.' }),
  P('prunus', 'Вишня песчаная', 'fruit', 1.2, 0.7, ['sun'], '#7a2a3a', { note: 'Иногда подмерзает — место потеплее.' }),
  // Многолетники
  P('trollius', 'Купальница азиатская', 'perennial', 0.6, 0.3, ['sun', 'part'], '#f0a020'),
  P('hemerocallis', 'Лилейник', 'perennial', 0.8, 0.4, ['sun', 'part'], '#f0c0a0', { note: 'Бело-розовые сорта, например «Stella de Oro». Цветёт в середине лета.' }),
  P('astilbe', 'Астильба', 'perennial', 0.8, 0.4, ['part', 'shade'], '#f0b8c8', { note: '«Bridal Veil» — белая, «Pink Lightning» — нежно-розовая. Июль–август.' }),
  P('phloxPan', 'Флокс метельчатый', 'perennial', 1, 0.4, ['sun', 'part'], '#f4d0dc', { note: '«David» — белый, «Omega» — светло-розовый с белым центром. Июль–сентябрь.' }),
  P('echinacea', 'Эхинацея пурпурная', 'perennial', 0.9, 0.35, ['sun'], '#d890b0', { note: '«White Swan» — почти белая, «PowWow Wild Berry» — розовая. Июль–сентябрь.' }),
  P('rudbeckia', 'Рудбекия блестящая', 'perennial', 0.7, 0.35, ['sun'], '#e8b020', { note: '«Goldsturm» — золотисто-жёлтая, смягчает переход к розово-белой гамме.' }),
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
  P('chrysanthemum', 'Хризантема (златоцвет)', 'perennial', 0.5, 0.3, ['sun'], '#f4e04a'),
  // Почвопокровные
  P('phloxSub', 'Флокс шиловидный', 'ground', 0.15, 0.3, ['sun'], '#f2c4d4', { note: '«White Delight» — белый, «Candy Stripe» — бело-розовый. Ковёр цветов в мае–июне.' }),
  P('thymus', 'Тимьян ползучий', 'ground', 0.1, 0.3, ['sun'], '#e8e0f0', { note: '«Albiflorus» — белые цветы, ароматный ковёр. Июнь–июль.' }),
  P('sempervivum', 'Молодило', 'ground', 0.1, 0.15, ['sun'], '#8a6a5a', { note: 'Зелёные и красноватые розетки — фон для цветов.' }),
  P('sagina', 'Мшанка шиловидная', 'ground', 0.05, 0.3, ['sun', 'part'], '#7ab060', { note: 'Густой зелёный ковёр, подчёркивает белые тона.' }),
  P('orostachys', 'Горноколосник колючий', 'ground', 0.1, 0.15, ['sun'], '#a0b090'),
  P('trifolium', 'Клевер ползучий', 'ground', 0.1, 0.3, ['sun', 'part'], '#90b080'),
  // Злаки
  P('festuca', 'Овсяница сизая', 'grass', 0.3, 0.2, ['sun'], '#9ab4c0', { note: 'Серебристо-голубая листва рядом с розово-белыми цветами.' }),
  P('deschampsia', 'Щучка дернистая', 'grass', 0.8, 0.3, ['sun', 'part', 'shade'], '#c8b880', { note: 'Воздушные метёлки, красивы под инеем.' }),
  P('stipa', 'Ковыль перистый', 'grass', 0.7, 0.3, ['sun'], '#d8d0b0', { note: 'Тонкие ости — вертикальный акцент.' }),
  P('bromus', 'Кострец', 'grass', 0.8, 0.3, ['sun'], '#b8b080'),
  // Кустарники «без раздумий» и растения со схемы участка
  P('cornusSton', 'Дерен отпрысковый', 'shrub', 2, 1.2, ['sun', 'part', 'shade'], '#b84a3a'),
  P('spiraeaCham', 'Спирея дубравколистная', 'shrub', 1.5, 0.8, ['sun', 'part', 'shade'], '#ece8da', { note: 'Местный вид, растёт и в тени.' }),
  P('spiraeaJap', 'Спирея японская', 'shrub', 0.8, 0.6, ['sun', 'part'], '#e48ab0', { note: 'Розовые щитки всё лето — для входной зоны.' }),
  P('spiraeaVan', 'Спирея Вангутта', 'shrub', 2, 1.2, ['sun'], '#f2f0e8'),
  P('philadelphus', 'Чубушник', 'shrub', 2.5, 1.2, ['sun', 'part'], '#f6f3e6', { note: 'Белые душистые цветы в начале лета — «садовый жасмин».' }),
  P('syringaVulg', 'Сирень обыкновенная', 'shrub', 4, 2, ['sun'], '#b48ad0', { size: 'mid' }),
  P('syringaMeyer', 'Сирень Мейера', 'shrub', 1.5, 0.8, ['sun'], '#c49ad8'),
  P('amelanchier', 'Ирга', 'shrub', 4, 2, ['sun', 'part'], '#4a5a8a', { size: 'mid', note: 'Белые цветы весной, ягоды летом, рыжая листва осенью.' }),
  P('berberis', 'Барбарис амурский', 'shrub', 2, 1, ['sun', 'part'], '#c8302a', { note: 'Жёлтые кисти весной, ярко-красные ягоды и багряная листва осенью.' }),
  P('viburnum', 'Калина обыкновенная', 'shrub', 3, 1.5, ['sun', 'part', 'shade'], '#d03a2a'),
  P('salixPurp', 'Ива пурпурная', 'shrub', 2.5, 1.2, ['sun', 'part'], '#9ab08a'),
  P('hydrangeaPan', 'Гортензия метельчатая', 'shrub', 2, 1, ['sun', 'part'], '#f4f1e6', { note: 'Белые метёлки с конца лета.' }),
  P('hydrangeaArb', 'Гортензия древовидная', 'shrub', 1.5, 0.8, ['part', 'shade'], '#f0f4e4'),
  P('rosaPark', 'Роза парковая', 'shrub', 1.5, 0.8, ['sun'], '#c060a8'),
  P('taxus', 'Тис', 'shrub', 2, 1, ['part', 'shade'], '#2f4a3a'),
  P('rhododendron', 'Рододендрон (азалия)', 'shrub', 1.2, 0.7, ['part'], '#e070a0', { note: 'Только кислая почва.' }),
  P('picea', 'Ель сибирская', 'tree', 15, 3, ['sun', 'part'], '#2a4a3a'),
  P('malusDec', 'Яблоня декоративная', 'tree', 5, 2, ['sun'], '#d0607a', { size: 'mid' }),
  P('rubus', 'Малина', 'fruit', 1.5, 0.6, ['sun', 'part'], '#b02a4a'),
  P('nepeta', 'Котовник', 'perennial', 0.5, 0.4, ['sun'], '#8a90d0'),
  P('armeria', 'Армерия', 'perennial', 0.25, 0.2, ['sun'], '#e890b0'),
  P('aruncus', 'Волжанка', 'perennial', 1.5, 0.6, ['part', 'shade'], '#f2eedc', { note: 'Крупные кремовые метёлки — «астильба-великан» для тени.' }),
  P('irisBarb', 'Ирис бородатый', 'perennial', 0.8, 0.3, ['sun'], '#8a70c0'),
  P('vinca', 'Барвинок', 'ground', 0.15, 0.4, ['part', 'shade'], '#6a7ad0'),
  // Пряные травы
  P('alliumSch', 'Шнитт-лук', 'herb', 0.4, 0.2, ['sun', 'part'], '#b080c0'),
  P('melissa', 'Мелисса (мята лимонная)', 'herb', 0.6, 0.35, ['sun', 'part'], '#a8c860'),
  P('mentha', 'Мята', 'herb', 0.6, 0.35, ['part', 'sun'], '#70a860', { note: 'Разрастается — сажайте в бортик.' }),
  P('origanum', 'Орегано (душица)', 'herb', 0.5, 0.3, ['sun'], '#c890b8'),
  P('salvia', 'Шалфей', 'herb', 0.6, 0.3, ['sun'], '#9aa890'),
  P('artemisiaDrac', 'Эстрагон (тархун)', 'herb', 0.9, 0.35, ['sun', 'part'], '#7a9a60'),
  P('leek', 'Лук-порей', 'herb', 0.6, 0.15, ['sun'], '#c0d0a0', { annual: true }),
  P('ocimum', 'Базилик', 'herb', 0.4, 0.2, ['sun'], '#7a3a5a', { annual: true }),
  P('borago', 'Бораго (огуречная трава)', 'herb', 0.6, 0.3, ['sun'], '#6a8ad8', { annual: true }),
  // Хиты якутских питомников
  P('sorbusSib', 'Рябина сибирская', 'tree', 6, 2, ['sun', 'part'], '#d8402a', { size: 'mid', note: 'Белые щитки в июне, гроздья оранжево-красных ягод до зимы.' }),
  P('sorbocot', 'Рябинокизильник Позднякова', 'shrub', 2.5, 1.2, ['sun', 'part'], '#a02a3a', { note: 'Якутский природный гибрид рябины и кизильника: съедобные тёмно-красные ягоды.' }),
  P('populusBer', 'Тополь берлинский', 'tree', 18, 4, ['sun'], '#6a8a4a', { note: 'Быстро растёт — ветрозащита и тень за 5–7 лет. Мужские растения не пылят пухом.' }),
  P('populusSuav', 'Тополь душистый', 'tree', 15, 4, ['sun', 'part'], '#5f8a52', { note: 'Весной смолистые душистые почки; быстро даёт тень.' }),
  P('padusMaackii', 'Черёмуха Маака', 'tree', 8, 2.5, ['sun', 'part'], '#f2efe6', { size: 'mid', note: 'Золотисто-медная блестящая кора — украшение зимнего сада.' }),
  P('rosaBegg', 'Шиповник Беггера', 'shrub', 2, 1, ['sun'], '#f4f0e6', { note: 'Белые душистые цветы, мелкие красные плоды.' }),
  P('rosaRugosa', 'Шиповник морщинистый', 'shrub', 1.5, 0.8, ['sun'], '#c8407a', { note: 'Крупные малиновые цветы всё лето и крупные плоды.' }),
  P('malusPurp', 'Яблоня пурпурная', 'tree', 5, 2, ['sun'], '#a03060', { size: 'mid', note: 'Пурпурные цветы и листва, мелкие тёмные яблочки.' }),
  P('aquilegia', 'Аквилегия (водосбор)', 'perennial', 0.6, 0.3, ['sun', 'part', 'shade'], '#7a6ac8', { note: 'Изящные поникающие цветки в июне; сама подсевается.' }),
];

// Почва, влага и морозостойкость.
// ph: A — кислая, N — нейтральная, K — щелочная (что растение выносит).
// water: dry — сухо, normal — обычная влажность, wet — сыро.
// hardy: very — переносит самые суровые зимы (Якутия), good — зимует в защищённом месте,
// risky — в суровом климате может вымерзнуть, нужно укрытие.
const SOIL = {
  cornus: ['ANK', 'normal wet', 'very'], spiraea: ['NK', 'dry normal', 'good'], physocarpus: ['ANK', 'dry normal', 'very'],
  cotoneaster: ['ANK', 'dry normal', 'very'], potentilla: ['NK', 'dry normal', 'very'], bergenia: ['ANK', 'normal wet', 'very'],
  sedum: ['NK', 'dry', 'very'], irisSib: ['AN', 'normal wet', 'very'], larix: ['ANK', 'normal', 'very'], pinus: ['AN', 'dry normal', 'very'],
  betula: ['AN', 'normal wet', 'very'], padus: ['ANK', 'normal wet', 'very'], crataegus: ['NK', 'normal', 'very'],
  juniper: ['NK', 'dry normal', 'good'], syringa: ['NK', 'normal', 'very'], caragana: ['NK', 'dry normal', 'very'],
  rosaAcic: ['AN', 'dry normal', 'very'], rosaCanina: ['NK', 'dry normal', 'very'], sorbaria: ['ANK', 'normal wet', 'very'],
  salix: ['ANK', 'normal wet', 'very'], ledum: ['A', 'wet', 'very'], lonicera: ['AN', 'normal', 'very'], malus: ['NK', 'normal', 'very'],
  ribes: ['AN', 'normal wet', 'very'], hippophae: ['NK', 'dry normal', 'very'], prunus: ['NK', 'dry normal', 'good'],
  trollius: ['AN', 'normal wet', 'very'], hemerocallis: ['ANK', 'normal', 'very'], astilbe: ['AN', 'normal wet', 'good'],
  phloxPan: ['AN', 'normal', 'good'], echinacea: ['NK', 'dry normal', 'good'], rudbeckia: ['NK', 'normal', 'good'],
  paeonia: ['NK', 'normal', 'very'], delphinium: ['NK', 'normal', 'good'], adonis: ['NK', 'dry', 'very'], pulsatilla: ['NK', 'dry', 'very'],
  hosta: ['AN', 'normal wet', 'good'], achillea: ['NK', 'dry normal', 'very'], geranium: ['ANK', 'normal', 'very'],
  filipendula: ['NK', 'wet normal', 'very'], primula: ['AN', 'normal wet', 'good'], heuchera: ['AN', 'normal', 'good'],
  chrysanthemum: ['NK', 'normal', 'good'], phloxSub: ['NK', 'dry', 'good'], thymus: ['NK', 'dry', 'very'], sempervivum: ['NK', 'dry', 'very'],
  sagina: ['AN', 'normal wet', 'good'], orostachys: ['NK', 'dry', 'very'], trifolium: ['NK', 'normal', 'very'], festuca: ['NK', 'dry', 'good'],
  deschampsia: ['AN', 'normal wet', 'very'], stipa: ['NK', 'dry', 'very'], bromus: ['NK', 'dry normal', 'very'],
  cornusSton: ['ANK', 'normal wet', 'very'], spiraeaCham: ['ANK', 'dry normal', 'very'], spiraeaJap: ['NK', 'normal', 'good'],
  spiraeaVan: ['NK', 'normal', 'good'], philadelphus: ['NK', 'normal', 'good'], syringaVulg: ['NK', 'normal', 'good'],
  syringaMeyer: ['NK', 'normal', 'good'], amelanchier: ['ANK', 'normal', 'very'], berberis: ['NK', 'dry normal', 'good'],
  viburnum: ['ANK', 'normal wet', 'very'], salixPurp: ['ANK', 'normal wet', 'good'], hydrangeaPan: ['A N', 'normal wet', 'risky'],
  hydrangeaArb: ['AN', 'normal wet', 'risky'], rosaPark: ['NK', 'normal', 'good'], taxus: ['NK', 'normal', 'risky'],
  rhododendron: ['A', 'normal wet', 'risky'], picea: ['AN', 'normal wet', 'very'], malusDec: ['NK', 'normal', 'good'],
  rubus: ['AN', 'normal', 'very'], nepeta: ['NK', 'dry', 'good'], armeria: ['AN', 'dry', 'good'], aruncus: ['AN', 'normal wet', 'very'],
  irisBarb: ['NK', 'dry', 'good'], vinca: ['NK', 'normal', 'risky'],
  alliumSch: ['NK', 'normal', 'very'], melissa: ['N', 'normal', 'good'], mentha: ['ANK', 'normal wet', 'very'], origanum: ['NK', 'dry', 'very'],
  salvia: ['NK', 'dry', 'risky'], artemisiaDrac: ['NK', 'dry normal', 'very'], leek: ['NK', 'normal', 'very'], ocimum: ['N', 'normal', 'very'],
  borago: ['NK', 'normal', 'very'],
};
for (const p of PLANTS) {
  const [ph, water, hardy] = SOIL[p.key] || ['ANK', 'normal', 'good'];
  p.ph = [...ph.replace(/\s/g, '')];
  p.water = water.split(' ');
  p.hardy = hardy;
}
// Хиты и цены якутского питомника, ₽ за саженец по высоте
const NURSERY = {
  berberis: { hit: true, price: [['до 50 см', 1000], ['50–100 см', 1500]] },
  crataegus: { price: [['до 50 см', 800], ['50–120 см', 950], ['выше 120 см', 1100]] },
  caragana: { price: [['до 50 см', 650], ['50–100 см', 800]] },
  cotoneaster: { price: [['до 50 см', 650], ['50–100 см', 1200]] },
  hippophae: { price: [['до 50 см', 700], ['50–100 см', 900]] },
  sorbusSib: { hit: true, price: [['до 50 см', 1000], ['50–100 см', 1500]] },
  sorbaria: { hit: true, price: [['до 50 см', 600], ['50–100 см', 850], ['выше 100 см', 1200]] },
  sorbocot: { hit: true, price: [['до 50 см', 1500]] },
  syringa: { hit: true, price: [['до 50 см', 1000]] },
  populusBer: { price: [['до 50 см', 750], ['100–150 см', 950], ['выше 150 см', 1100]] },
  populusSuav: { price: [['до 50 см', 750], ['100–150 см', 950], ['выше 150 см', 1100]] },
  padusMaackii: { hit: true, price: [['до 50 см', 1000], ['50–100 см', 1500], ['выше 100 см', 2000]] },
  padus: { price: [['до 50 см', 900], ['50–100 см', 1100], ['выше 100 см', 1500]] },
  rosaBegg: { price: [['до 50 см', 700], ['50–100 см', 850], ['выше 100 см', 1100]] },
  rosaRugosa: { price: [['до 50 см', 700], ['50–100 см', 850], ['выше 100 см', 1100]] },
  rosaAcic: { price: [['до 50 см', 650], ['50–100 см', 800], ['выше 100 см', 1000]] },
  malusPurp: { price: [['до 50 см', 1200], ['50–100 см', 1350], ['выше 100 см', 1800]] },
  malus: { price: [['до 50 см', 900], ['50–100 см', 1100], ['выше 100 см', 1500]] },
};

// Зона морозостойкости USDA (самая холодная, где растение зимует без укрытия).
// Якутск — зона 1 (зимой до −50 °C). Растениям, которые растут в Якутии в природе,
// ставим 1, даже если в западных справочниках у вида зона выше.
// 0 — однолетник: зимовать ему не нужно.
const USDA = {
  cornus: 1, spiraea: 4, physocarpus: 2, cotoneaster: 2, potentilla: 1, bergenia: 2, sedum: 3, irisSib: 3,
  larix: 1, pinus: 1, betula: 1, padus: 1, crataegus: 2, juniper: 4, syringa: 2, caragana: 2,
  rosaAcic: 1, rosaCanina: 3, sorbaria: 1, salix: 1, ledum: 1, lonicera: 1, malus: 1, ribes: 2,
  hippophae: 2, prunus: 3, trollius: 1, hemerocallis: 3, astilbe: 4, phloxPan: 3, echinacea: 3, rudbeckia: 3,
  paeonia: 2, delphinium: 3, adonis: 1, pulsatilla: 1, hosta: 3, achillea: 1, geranium: 2, filipendula: 1,
  primula: 3, heuchera: 4, chrysanthemum: 3, phloxSub: 3, thymus: 3, sempervivum: 4, sagina: 4, orostachys: 1,
  trifolium: 2, festuca: 4, deschampsia: 2, stipa: 3, bromus: 1,
  cornusSton: 2, spiraeaCham: 1, spiraeaJap: 4, spiraeaVan: 3, philadelphus: 3, syringaVulg: 3, syringaMeyer: 3,
  amelanchier: 2, berberis: 3, viburnum: 2, salixPurp: 4, hydrangeaPan: 3, hydrangeaArb: 3, rosaPark: 3, taxus: 4,
  rhododendron: 4, picea: 1, malusDec: 3, rubus: 2, nepeta: 3, armeria: 4, aruncus: 3, irisBarb: 3, vinca: 4,
  alliumSch: 1, melissa: 4, mentha: 3, origanum: 4, salvia: 5, artemisiaDrac: 2, leek: 0, ocimum: 0, borago: 0,
  // Проверены в Якутии питомником: зона 1
  berberis: 1, crataegus: 1, caragana: 1, cotoneaster: 1, hippophae: 1, syringa: 1,
  sorbusSib: 1, sorbocot: 1, populusBer: 1, populusSuav: 1, padusMaackii: 1, rosaBegg: 1, rosaRugosa: 1, malusPurp: 1,
};
// Многолетники, которые по опыту якутских садоводов хорошо растут в Якутске:
// снег укрывает их корни, поэтому они зимуют, хотя по справочникам зона у вида выше
const YAKUTSK_PROVEN = ['paeonia', 'sedum', 'hosta', 'irisSib', 'irisBarb', 'phloxPan', 'chrysanthemum', 'astilbe', 'hemerocallis', 'delphinium', 'aquilegia'];
for (const k of YAKUTSK_PROVEN) USDA[k] = 1;
for (const p of PLANTS) {
  p.usda = USDA[p.key] ?? 3;
  if (YAKUTSK_PROVEN.includes(p.key)) p.proven = true;
  Object.assign(p, NURSERY[p.key] || {});
  // Зимостойкость в советах по почве и климату — по той же зоне
  if (p.usda === 1) p.hardy = 'very';
  else if (p.usda === 2) p.hardy = 'good';
  else if (p.usda >= 3) p.hardy = 'risky';
}
/** Каталог для Якутии — только зона 1 (и однолетники); остальное — малоуходные для тёплых регионов. */
export const forYakutia = (pl) => pl.usda <= 1;
export const priceFrom = (pl) => (pl.price ? Math.min(...pl.price.map(([, v]) => v)) : null);
/** Метка морозостойкости: снежинка синяя — зона 1, для Якутии; красная — зона 2 и выше. */
export function frostOf(pl) {
  if (pl.usda === 0) return { cls: 'annual', text: 'однолетник — зимовать не нужно' };
  if (pl.proven) return { cls: 'ok', text: 'Зимует в Якутске под снегом — проверено садоводами' };
  if (pl.usda <= 1) return { cls: 'ok', text: 'USDA 1 — выдерживает зимы Якутии' };
  return { cls: 'bad', text: `USDA ${pl.usda} — не рассчитано на зимы Якутии (зона 1)${pl.usda === 2 ? ': на грани, только в защищённом месте' : ''}` };
}
export const frostHtml = (pl) => {
  const f = frostOf(pl);
  return `<span class="frost ${f.cls}" title="${f.text}">${f.cls === 'annual' ? '◌' : '❄\uFE0E'}${pl.usda ? `<small>${pl.usda}</small>` : ''}</span>`;
};

export const PLANT_BY_KEY = Object.fromEntries(PLANTS.map((p) => [p.key, p]));

export const PLANT_GROUPS = [
  ['top', 'Топ-10 «посадил и забыл»'],
  ['tree', 'Деревья'],
  ['shrub', 'Кустарники'],
  ['fruit', 'Плодово-ягодные'],
  ['perennial', 'Многолетники'],
  ['ground', 'Почвопокровные'],
  ['grass', 'Злаки'],
  ['herb', 'Пряные травы'],
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
  const { year, lat, lng, tz, step = 0.25, minAlt = 10, from = 0, to = 24, noPlants = false } = opts;
  // noPlants: деревьям и кустарникам свет считаем без тени соседних растений —
  // в ряду и в группе они растут вместе и тянутся к свету
  const cs = casters(yard).filter((c) => !c.glass && !(noPlants && c.crown));
  const samples = [];
  for (let t = from + step / 2; t < to; t += step) {
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

// ---- Золотое сечение и числа Фибоначчи ----

export const PHI = (1 + Math.sqrt(5)) / 2;
export const FIB = [1, 2, 3, 5, 8, 13, 21];
const GOLD = 1 / PHI; // ≈ 0,618

/** Линии золотого сечения участка (≈ 38 % и 62 % ширины и глубины) и их пересечения. */
export function goldenGrid(plot) {
  const xs = [plot.w * (1 - GOLD), plot.w * GOLD];
  const ys = [plot.d * (1 - GOLD), plot.d * GOLD];
  return { xs, ys, points: xs.flatMap((x) => ys.map((y) => [x, y])) };
}

/** Ближайшая точка золотого сечения и расстояние до неё. */
export function nearestGolden(plot, [x, y]) {
  return goldenGrid(plot).points
    .map((p) => ({ p, dist: Math.hypot(p[0] - x, p[1] - y) }))
    .sort((a, b) => a.dist - b.dist)[0];
}

/** Насколько отношение a : b близко к 1,618 (0 — точно). */
export function goldenError(a, b) {
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  return small > 0 ? Math.abs(big / small - PHI) / PHI : Infinity;
}

/** Ближайшее число Фибоначчи не меньше n (для групп растений). */
export const fibAtLeast = (n) => FIB.find((f) => f >= n) ?? n;
export const isFib = (n) => FIB.includes(n);

/**
 * Точки посадки группы из n растений по «золотому углу» 137,5° — так
 * располагаются семена в корзинке подсолнуха; группа выглядит естественно.
 */
export function phyllotaxis(n, spacing, cx = 0, cy = 0) {
  const angle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const r = spacing * Math.sqrt(i + 0.5) * 0.9;
    return [cx + r * Math.cos(i * angle), cy + r * Math.sin(i * angle)];
  });
}

/** Группы одинаковых растений: соседи одного вида ближе link метров. */
export function plantGroups(plants, link = 2.5) {
  const seen = new Set();
  const groups = [];
  for (const p of plants) {
    if (seen.has(p.id)) continue;
    const g = [];
    const stack = [p];
    seen.add(p.id);
    while (stack.length) {
      const a = stack.pop();
      g.push(a);
      for (const b of plants) {
        if (!seen.has(b.id) && b.t === a.t && Math.hypot(a.x - b.x, a.y - b.y) <= link) {
          seen.add(b.id);
          stack.push(b);
        }
      }
    }
    groups.push({ t: p.t, ids: g.map((x) => x.id), size: g.length });
  }
  return groups;
}

/** Золотая спираль в золотом прямоугольнике участка: путь для отрисовки (оси участка). */
export function goldenSpiral(plot, turns = 6) {
  // Самый большой золотой прямоугольник внутри участка
  let w = plot.w;
  let h = plot.w / PHI;
  if (h > plot.d) { h = plot.d; w = h * PHI; }
  let x = (plot.w - w) / 2;
  let y = (plot.d - h) / 2;
  const arcs = [];
  let dir = 0; // 0 — квадрат слева, 1 — сверху, 2 — справа, 3 — снизу
  for (let i = 0; i < turns; i++) {
    const horizontal = w >= h;
    const s = horizontal ? h : w;
    let sq;
    if (dir === 0) { sq = [x, y, s]; x += s; w -= s; }
    else if (dir === 1) { sq = [x, y + h - s, s]; h -= s; }
    else if (dir === 2) { sq = [x + w - s, y, s]; w -= s; }
    else { sq = [x, y, s]; y += s; h -= s; }
    arcs.push({ sq, dir });
    dir = (dir + 1) % 4;
  }
  return arcs;
}

/** Новый участок по умолчанию: дом 12 × 9 м. */
export function defaultYard() {
  return {
    plot: { w: 30, d: 40, rot: 0 },
    house: { shape: 'rect', w: 12, d: 9, cw: 5, cd: 4, h: 7, x: 15, y: 24, rot: 0, door: 'front' },
    soil: { known: null, ph: null, texture: null, water: null },
    climate: null,
    winds: ['С', 'СЗ'],
    comps: ['sunBorder', 'shadeBorder', 'rockery', 'entrance', 'parade', 'herbs', 'fire', 'windbreak'],
    scenario: null,
    items: [],
    plants: [],
    date: '06-21',
    time: 12,
    tz: null,
    view: 'shadow',
    golden: true,
    group: 1,
    seq: 1,
  };
}
