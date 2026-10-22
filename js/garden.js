// Сад по свету и почве: проверка почвы, подбор композиций под место,
// сценарии отдыха и картинка композиции «в профиль».
import {
  PLANT_BY_KEY, BUILDING_BY_KEY, rectPoly, housePieces, houseOutline, convexOverlap, inPoly, sunHours, circlePoly,
} from './yard.js';

const rad = (d) => (d * Math.PI) / 180;

// ---- Почва ----

export const SOIL_PH = { acid: 'Кислая', neutral: 'Нейтральная', alkaline: 'Щелочная' };
export const SOIL_TEXTURE = { sand: 'Песчаная, рыхлая', loam: 'Суглинок', clay: 'Глина', peat: 'Торфяная' };
export const SOIL_WATER = { dry: 'Сухое место', normal: 'Обычная влажность', wet: 'Сырое, близко вода' };
const PH_CODE = { acid: 'A', neutral: 'N', alkaline: 'K' };

export const CLIMATE = {
  extreme: 'Очень суровые зимы (Якутия, зона 1–2)',
  cold: 'Холодные зимы (Сибирь, Урал, зона 3–4)',
  mild: 'Умеренные зимы (средняя полоса и южнее, зона 5+)',
};
export const climateGuess = (lat) => (lat >= 58 ? 'extreme' : lat >= 50 ? 'cold' : 'mild');

export const HARDY_TEXT = { very: 'очень зимостойкое', good: 'зимостойкое', risky: 'нежное' };

/** Влажность места с поправкой на состав почвы: песок сохнет, глина и торф держат воду. */
export function effectiveWater(soil) {
  if (soil.water) return soil.water;
  if (soil.texture === 'sand') return 'dry';
  if (soil.texture === 'clay' || soil.texture === 'peat') return 'wet';
  return 'normal';
}

/**
 * Подходит ли растение почве и климату.
 * Возвращает { level: good|mixed|bad, notes, fixes } — что не так и как исправить.
 */
export function soilFit(pl, soil, climate) {
  const notes = [];
  const fixes = [];
  let level = 'good';
  const worse = (l) => { if (l === 'bad' || level === 'good') level = l; };

  if (pl.hardy === 'risky' && climate === 'extreme') {
    worse('bad');
    notes.push('Нежное растение: в очень суровую зиму может вымерзнуть.');
    fixes.push('Сажайте в защищённое место у южной стены, укрывайте лапником и снегом или замените более стойким видом.');
  } else if (pl.hardy === 'risky' && climate === 'cold') {
    worse('mixed');
    notes.push('На зиму нужно укрытие.');
  } else if (pl.hardy === 'good' && climate === 'extreme') {
    worse('mixed');
    notes.push('Зимует в защищённом от ветра месте; молодые растения укройте лапником.');
  }
  if (pl.annual) notes.push('Однолетник: сеять или сажать каждый год.');

  if (!soil.known) return { level, notes, fixes };

  if (soil.ph && !pl.ph.includes(PH_CODE[soil.ph])) {
    worse('bad');
    if (soil.ph === 'acid') {
      notes.push('Почва кислая, а растению нужна нейтральная.');
      fixes.push('Раскислите: доломитовая мука (300–500 г на м²) или древесная зола осенью перед посадкой; либо посадочная яма с нейтральным грунтом.');
    } else if (soil.ph === 'alkaline') {
      notes.push(pl.ph.length === 1 ? 'Растению нужна только кислая почва, а здесь щелочная.' : 'Почва щелочная, а растение любит кислую или нейтральную.');
      fixes.push('Подкислите: верховой (рыжий) торф, хвойный опад, коллоидная сера; мульча из хвои или коры сосны.');
    } else {
      notes.push('Растению нужна кислая почва.');
      fixes.push('Посадочная яма с кислым грунтом: верховой торф, хвойный опад, мульча из коры сосны.');
    }
  }
  const water = effectiveWater(soil);
  if (!pl.water.includes(water)) {
    worse('mixed');
    if (water === 'wet') {
      notes.push('Место сырое, а растение не любит застоя воды.');
      fixes.push('Дренаж: гравий и песок на дно ямы, приподнятая клумба или рокарий.');
    } else if (water === 'dry') {
      notes.push('Место сухое, а растению нужна влага.');
      fixes.push('Добавьте торф и компост, мульчируйте и поливайте в жару.');
    } else if (pl.water.includes('wet')) {
      notes.push('Растение любит влагу — поливайте чаще или посадите ниже по рельефу.');
    } else {
      notes.push('Растение любит сухость — нужен хороший дренаж.');
    }
  }
  if (soil.texture === 'clay' && pl.water.includes('dry') && !pl.water.includes('wet')) {
    fixes.push('Глина: добавьте в яму песок и мелкий гравий, чтобы корни не мокли.');
  }
  return { level, notes, fixes: [...new Set(fixes)] };
}

// Как узнать свою почву
export const SOIL_TESTS = [
  ['Лаборатория', 'Отнесите 300–500 г земли с глубины 10–20 см в агрохимическую лабораторию: скажут кислотность, питание и состав.'],
  ['Тест из магазина', 'Тест-полоски или pH-метр для почвы: смешайте землю с дистиллированной водой и опустите полоску.'],
  ['Уксус и сода', 'Капните уксус на горсть сухой земли: зашипела — почва щелочная. Смочите другую горсть и посыпьте содой: зашипела — кислая. Ни то ни другое — нейтральная.'],
  ['Жгут из земли', 'Скатайте влажную землю в шнур: рассыпается — песок, ломается — суглинок, гнётся в кольцо — глина.'],
  ['По растениям на участке', 'Хвощ, щавель, лютик, мох, багульник — почва кислая. Клевер, крапива, пырей — близкая к нейтральной. Полынь, цикорий — щелочная и сухая.'],
];

// ---- Композиции под место ----
// tiers: [название ряда, ключи растений по предпочтению, сколько видов взять, сколько штук каждого]

export const TEMPLATES = {
  sunBorder: {
    title: 'Солнечный миксбордер', want: 'sun', w: 7, d: 2.5,
    about: 'Пышное цветение всё лето: кустарники сзади, многолетники в середине, низкие и почвопокровные спереди.',
    tiers: [
      ['Задний ряд — кустарники', ['spiraea', 'physocarpus', 'philadelphus', 'potentilla', 'syringaMeyer', 'rosaPark', 'caragana', 'spiraeaCham'], 2, 1],
      ['Средний ряд — акценты', ['phloxPan', 'hemerocallis', 'echinacea', 'irisSib', 'paeonia', 'delphinium', 'rudbeckia', 'nepeta'], 3, 3],
      ['Передний ряд', ['sedum', 'phloxSub', 'thymus', 'armeria', 'festuca', 'achillea'], 3, 5],
      ['Злаки для лёгкости', ['stipa', 'deschampsia', 'festuca'], 1, 3],
    ],
  },
  shadeBorder: {
    title: 'Теневой миксбордер', want: 'shade', w: 6, d: 2.5,
    about: 'Для северной стороны и тени деревьев: крупные листья, белые и кремовые соцветия светятся в полумраке. Тень обычно влажнее — растениям это нравится.',
    tiers: [
      ['Задний ряд — кустарники', ['viburnum', 'cornus', 'sorbaria', 'spiraeaCham', 'hydrangeaArb', 'cornusSton'], 2, 1],
      ['Средний ряд', ['aruncus', 'astilbe', 'hosta', 'filipendula', 'trollius'], 3, 3],
      ['Передний ряд', ['bergenia', 'heuchera', 'vinca', 'primula', 'sagina'], 3, 5],
      ['Злаки', ['deschampsia'], 1, 3],
    ],
  },
  rockery: {
    title: 'Рокарий', want: 'sun', dry: true, w: 4, d: 3,
    about: 'Каменистая горка на самом солнечном и сухом месте: камни, гравий, суккуленты и злаки. Почти без полива.',
    tiers: [
      ['Каркас', ['juniper', 'potentilla', 'pinus'], 1, 1],
      ['Средний ярус', ['stipa', 'pulsatilla', 'irisBarb', 'festuca', 'adonis'], 2, 3],
      ['Между камнями', ['sedum', 'sempervivum', 'orostachys', 'thymus', 'armeria'], 3, 5],
    ],
  },
  entrance: {
    title: 'Входная зона', want: 'any', at: 'door', w: 3.5, d: 1.5,
    about: 'Небольшая аккуратная клумба у входа: красива с весны до осени, не мешает проходу, не колется.',
    tiers: [
      ['Акцент', ['hydrangeaPan', 'spiraeaJap', 'potentilla', 'cornus', 'hydrangeaArb'], 1, 1],
      ['Середина', ['hemerocallis', 'hosta', 'heuchera', 'phloxPan', 'astilbe'], 2, 3],
      ['Край дорожки', ['phloxSub', 'bergenia', 'thymus', 'sagina', 'vinca'], 1, 5],
    ],
  },
  parade: {
    title: 'Парадная зона у фасада', want: 'any', at: 'facade', w: 6, d: 1.8,
    about: 'Вдоль фасада — строгая и спокойная посадка: вечнозелёный каркас и повторяющиеся группы, чтобы дом выглядел нарядно круглый год.',
    tiers: [
      ['Каркас', ['juniper', 'berberis', 'spiraea', 'cornus', 'taxus', 'spiraeaCham'], 2, 1],
      ['Цветение', ['hemerocallis', 'irisSib', 'astilbe', 'phloxPan', 'hosta'], 2, 3],
      ['Бордюр', ['heuchera', 'bergenia', 'sedum', 'festuca', 'phloxSub'], 1, 5],
    ],
  },
  herbs: {
    title: 'Грядка пряных трав', want: 'sun', near: 10, w: 3, d: 1.5,
    about: 'Ароматная грядка ближе к кухне или террасе: зелень к столу всё лето.',
    tiers: [
      ['Задний ряд', ['artemisiaDrac', 'borago', 'leek'], 2, 1],
      ['Середина', ['melissa', 'mentha', 'salvia', 'origanum'], 3, 2],
      ['Передний край', ['thymus', 'alliumSch', 'ocimum'], 3, 3],
    ],
  },
  fire: {
    title: 'Костровище', want: 'sun', evening: true, fire: true, w: 6, d: 6,
    about: 'Круг из гравия с очагом посередине, вокруг — низкие негорючие растения. Не ближе 5 м к постройкам и 4 м к деревьям.',
    tiers: [
      ['Вокруг гравийного круга', ['thymus', 'sedum', 'sempervivum', 'festuca', 'orostachys'], 3, 5],
    ],
  },
};
export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

/** Подходит ли растение месту: свет, почва (если известна) и климат. */
function suits(pl, zone, soil, climate, strict = true) {
  if (zone && !pl.light.includes(zone)) return false;
  if (!strict) return true;
  const fit = soilFit(pl, soil, climate);
  return fit.level !== 'bad';
}

/** Растения композиции под свет места. */
export function pickPlants(tpl, zone, soil, climate) {
  const used = new Set();
  return tpl.tiers.map(([tier, keys, take, qty]) => {
    let list = keys.filter((k) => !used.has(k) && suits(PLANT_BY_KEY[k], zone, soil, climate));
    // Если по почве и зимостойкости ничего не нашлось — берём хотя бы по свету
    if (!list.length) list = keys.filter((k) => !used.has(k) && suits(PLANT_BY_KEY[k], zone, soil, climate, false));
    if (!list.length) list = keys.filter((k) => !used.has(k)).slice(0, 1);
    const chosen = list.slice(0, take);
    chosen.forEach((k) => used.add(k));
    return { tier, plants: chosen.map((k) => ({ key: k, qty: PLANT_BY_KEY[k].group === 'tree' ? 1 : qty })) };
  });
}

// ---- Поиск места ----

function obstacles(yard, skipIds = new Set()) {
  return [
    ...housePieces(yard.house),
    ...yard.items.filter((i) => !skipIds.has(i.id)).map((i) => rectPoly(i)),
  ];
}

function makeShareAt(grid, max) {
  const c = grid.cell;
  const cols = Math.ceil(grid.w / c);
  return (x, y) => {
    const i = Math.min(cols - 1, Math.max(0, Math.floor(x / c)));
    const j = Math.max(0, Math.floor(y / c));
    const cell = grid.grid[j * cols + i];
    return cell && max > 0 ? cell.hours / max : 0;
  };
}

/** Точка двери и наружу направленная нормаль (оси участка). */
export function doorPlace(h) {
  const w = h.w;
  const d = h.shape === 'square' ? h.w : h.d;
  const cw = h.shape === 'L' ? Math.min(h.cw, w - 1) : 0;
  const cd = h.shape === 'L' ? Math.min(h.cd, d - 1) : 0;
  const local = {
    front: [[0, -d / 2], [0, -1]],
    back: [[-cw / 2, d / 2], [0, 1]],
    left: [[-w / 2, 0], [-1, 0]],
    right: [[w / 2, -cd / 2], [1, 0]],
  }[h.door || 'front'];
  const t = rad(h.rot || 0);
  const rot = ([x, y]) => [x * Math.cos(t) + y * Math.sin(t), -x * Math.sin(t) + y * Math.cos(t)];
  const [px, py] = rot(local[0]);
  return { p: [h.x + px, h.y + py], n: rot(local[1]), side: h.door || 'front' };
}

/**
 * Место для композиции. Возвращает { x, y, rot, w, d } или null.
 * hours — карта солнца { grid, maxHours }, evening — карта солнца с 17 до 21 ч.
 */
export function placeTemplate(key, yard, hours, extra = {}) {
  const tpl = TEMPLATES[key];
  const { w, d } = tpl;
  const obs = obstacles(yard);
  const shareAt = makeShareAt({ ...hours.grid, w: yard.plot.w }, hours.grid.maxHours);
  const h = yard.house;
  const hd = h.shape === 'square' ? h.w : h.d;
  // Клумбы не слипаются: зазор 1,5 м до других клумб и зон, 1 м до построек; не наезжают на деревья
  const flatObs = yard.items.filter((i) => BUILDING_BY_KEY[i.t].flat).map((i) => rectPoly(i));
  const woody = yard.plants.filter((p) => ['tree', 'shrub', 'fruit'].includes(PLANT_BY_KEY[p.t].group));
  const free = (o) => {
    const poly = rectPoly(o);
    if (poly.some(([x, y]) => x < 0.5 || y < 0.5 || x > yard.plot.w - 0.5 || y > yard.plot.d - 0.5)) return false;
    const wide = rectPoly({ ...o, w: o.w + 3, d: o.d + 3 });
    if (flatObs.some((ob) => convexOverlap(ob, wide))) return false;
    if (woody.some((p) => inPoly(rectPoly({ ...o, w: o.w + 2 * PLANT_BY_KEY[p.t].r, d: o.d + 2 * PLANT_BY_KEY[p.t].r }), [p.x, p.y]))) return false;
    return !obs.some((ob) => convexOverlap(ob, poly));
  };

  if (tpl.at === 'door' || tpl.at === 'facade') {
    const door = doorPlace(h);
    const along = [door.n[1], -door.n[0]]; // вдоль стены
    const wallRot = h.rot + ({ front: 0, back: 0, left: 90, right: 90 }[door.side]);
    const tries = [];
    if (tpl.at === 'door') {
      for (const side of [1, -1]) tries.push([door.p[0] + door.n[0] * (d / 2 + 1) + along[0] * side * (w / 2 + 1), door.p[1] + door.n[1] * (d / 2 + 1) + along[1] * side * (w / 2 + 1)]);
    } else {
      const f = doorPlace({ ...h, door: 'front' });
      const fAlong = [f.n[1], -f.n[0]];
      const shift = h.door === 'front' || !h.door ? h.w / 4 + 0.5 : 0;
      for (const side of [-1, 1]) tries.push([f.p[0] + f.n[0] * (d / 2 + 1.2) + fAlong[0] * side * shift, f.p[1] + f.n[1] * (d / 2 + 1.2) + fAlong[1] * side * shift]);
      const o = { x: tries[0][0], y: tries[0][1], w: Math.min(w, h.w * 0.4), d, rot: h.rot };
      return free(o) ? o : (free({ ...o, x: tries[1][0], y: tries[1][1] }) ? { ...o, x: tries[1][0], y: tries[1][1] } : null);
    }
    for (const [x, y] of tries) {
      const o = { x, y, w, d, rot: wallRot };
      if (free(o)) return o;
    }
    return null;
  }

  let best = null;
  const eveAt = extra.evening ? makeShareAt({ ...extra.evening.grid, w: yard.plot.w }, extra.evening.grid.maxHours) : null;
  const solid = [houseOutline(h), ...yard.items.filter((i) => !BUILDING_BY_KEY[i.t].flat).map((i) => rectPoly(i))];
  const trees = yard.plants.filter((p) => PLANT_BY_KEY[p.t].group === 'tree');
  for (let y = d / 2 + 0.5; y <= yard.plot.d - d / 2 - 0.5; y += 1) {
    for (let x = w / 2 + 0.5; x <= yard.plot.w - w / 2 - 0.5; x += 1) {
      const o = { x, y, w, d, rot: 0 };
      if (!free(o)) continue;
      const pts = [[x, y], [x - w / 3, y], [x + w / 3, y], [x, y - d / 3], [x, y + d / 3]];
      const share = pts.reduce((s, [px, py]) => s + shareAt(px, py), 0) / pts.length;
      const distHouse = Math.hypot(x - h.x, y - h.y) - Math.max(h.w, hd) / 2;
      let score;
      if (tpl.want === 'shade') score = (1 - share) * 10 - Math.max(0, distHouse - 6) * 0.2;
      else score = share * 10;
      if (tpl.dry) score += share > 0.85 ? 1 : 0;
      if (tpl.near) score -= Math.max(0, distHouse - tpl.near) * 0.5;
      if (tpl.fire) {
        const poly = rectPoly(o);
        const nearSolid = Math.min(...solid.map((sp) => polyGap(poly, sp)));
        const nearTree = trees.length ? Math.min(...trees.map((t) => Math.hypot(t.x - x, t.y - y) - w / 2)) : 99;
        if (nearSolid < 5 || nearTree < 4) continue;
        score = (eveAt ? eveAt(x, y) : share) * 10 - Math.abs(distHouse - 12) * 0.15;
      }
      // Не лепим новые композиции вплотную к стенам
      if (!tpl.fire && distHouse < 1.5) score -= 2;
      if (!best || score > best.score) best = { ...o, score, share };
    }
  }
  return best;
}

function polyGap(a, b) {
  if (convexOverlap(a, b)) return 0;
  let min = Infinity;
  const seg = ([px, py], [ax, ay], [bx, by]) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  };
  for (const [P1, P2] of [[a, b], [b, a]]) {
    for (const p of P1) for (let i = 0; i < P2.length; i++) min = Math.min(min, seg(p, P2[i], P2[(i + 1) % P2.length]));
  }
  return min;
}

// ---- Ветрозащита ----

export const WIND_DIRS = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];

/** Стороны участка (top, right, bottom, left), обращённые к ветрам. */
export function windSides(plotRot, winds) {
  const normals = { top: 0, right: 90, bottom: 180, left: 270 };
  const out = new Set();
  for (const w of winds) {
    const az = WIND_DIRS.indexOf(w) * 45;
    for (const [side, n] of Object.entries(normals)) {
      const diff = Math.abs((((az - (plotRot + n)) % 360) + 540) % 360 - 180);
      if (diff <= 50) out.add(side);
    }
  }
  return [...out];
}

/**
 * Посадки ветрозащиты вдоль наветренных сторон: ряд кустарников в 2 м от границы
 * и ряд деревьев в 5 м за ним (деревьям по нормам нужно не меньше 4 м).
 */
export function windbreak(yard, winds, soil, climate) {
  const sides = windSides(yard.plot.rot, winds);
  const treeKeys = ['larix', 'picea', 'pinus', 'betula'].filter((k) => suits(PLANT_BY_KEY[k], null, soil, climate));
  const shrubKeys = ['caragana', 'amelanchier', 'salix', 'cotoneaster', 'sorbaria', 'spiraeaCham'].filter((k) => suits(PLANT_BY_KEY[k], null, soil, climate));
  const W = yard.plot.w;
  const D = yard.plot.d;
  const blocked = [...housePieces(yard.house), ...yard.items.map((i) => rectPoly(i))];
  const houseZone = circlePoly(yard.house.x, yard.house.y, Math.hypot(yard.house.w, yard.house.d) / 2 + 5, 16);
  const out = [];
  // Крона не должна наезжать на дом и постройки
  const ok = (x, y, tree) => !blocked.some((b) => convexOverlap(b, circlePoly(x, y, tree ? 3 : 1.2, 10))) && (!tree || !inPoly(houseZone, [x, y]))
    && !out.some((p) => Math.hypot(p.x - x, p.y - y) < (tree ? 3.5 : 1.8));
  const line = (side, inset, step, keys, tree) => {
    const len = side === 'top' || side === 'bottom' ? W : D;
    let k = 0;
    for (let s = inset + 1; s <= len - inset - 1 + 1e-9; s += step) {
      const [x, y] = { top: [s, D - inset], bottom: [s, inset], left: [inset, s], right: [W - inset, s] }[side];
      if (!ok(x, y, tree)) continue;
      out.push({ t: keys[k % keys.length], x, y });
      k++;
    }
  };
  for (const side of sides) {
    if (treeKeys.length) line(side, 5, 6, treeKeys, true);
    if (shrubKeys.length) line(side, 2, 3, shrubKeys, false);
  }
  return { sides, plants: out };
}

// ---- Сценарии отдыха ----

export const SCENARIOS = {
  coffee: { title: 'Утренний кофе', from: 7, to: 10, want: 'sun', near: [2, 12], item: 'terrace', about: 'Солнечное место утром, недалеко от дома.' },
  work: { title: 'Рабочая зона днём', from: 12, to: 16, want: 'shade', near: [2, 15], item: 'gazebo', about: 'Тень в самые жаркие часы — экран ноутбука не бликует, не печёт.' },
  bbq: { title: 'Шашлыки с друзьями', from: 17, to: 21, want: 'sun', near: [8, 40], item: 'bbq', fire: true, about: 'Вечернее солнце, подальше от дома и построек — дым не идёт в окна.' },
};

/** Лучшее место для сценария: доля солнца в заданные часы и удобное расстояние до дома. */
export function scenarioSpot(key, yard, opts) {
  const sc = SCENARIOS[key];
  const h = yard.house;
  const hd = h.shape === 'square' ? h.w : h.d;
  const solid = [houseOutline(h), ...yard.items.map((i) => rectPoly(i))];
  const cand = [];
  for (let y = 2; y <= yard.plot.d - 2; y += 1) {
    for (let x = 2; x <= yard.plot.w - 2; x += 1) {
      const sq = rectPoly({ x, y, w: 3, d: 3, rot: 0 });
      if (solid.some((s) => convexOverlap(s, sq))) continue;
      const dist = Math.hypot(x - h.x, y - h.y) - Math.max(h.w, hd) / 2;
      if (dist < sc.near[0] || dist > sc.near[1]) continue;
      if (sc.fire && solid.some((s) => polyGap(s, sq) < 5)) continue;
      cand.push({ x, y, dist });
    }
  }
  if (!cand.length) return null;
  const res = sunHours(yard, { ...opts, from: sc.from, to: sc.to, minAlt: 3 }, cand.map((c) => ({ pt: [c.x, c.y] })));
  const max = res.maxHours || 1;
  let best = null;
  cand.forEach((c, i) => {
    const share = res.hours[i] / max;
    const score = (sc.want === 'sun' ? share : 1 - share) * 10 - c.dist * 0.05;
    if (!best || score > best.score) best = { ...c, share, score, max };
  });
  return best;
}

// ---- Картинка композиции «в профиль» ----

const CONIFER = new Set(['larix', 'pinus', 'picea', 'taxus']);
const SPIKE = new Set(['delphinium', 'irisSib', 'irisBarb', 'leek', 'alliumSch', 'aruncus', 'filipendula', 'artemisiaDrac', 'salvia']);
const LEAF = ['#4f7a3a', '#5e8a44', '#3f6a3a', '#6a9a4a', '#4a7050'];

function hashN(str, n) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h % n;
}

function drawPlant(pl, x, base, s) {
  const h = Math.max(14, pl.h * s);
  const leaf = LEAF[hashN(pl.key, LEAF.length)];
  const col = pl.color;
  const out = [];
  if (pl.group === 'tree' || CONIFER.has(pl.key)) {
    const wd = Math.max(26, pl.r * 2 * s * 0.55);
    if (CONIFER.has(pl.key)) {
      out.push(`<rect x="${x - 3}" y="${base - h * 0.15}" width="6" height="${h * 0.15}" fill="#6a4a30"/>`);
      for (let k = 0; k < 3; k++) {
        const y0 = base - h * (0.12 + k * 0.28);
        const ww = wd * (1 - k * 0.25);
        out.push(`<path d="M${x - ww / 2} ${y0} L${x} ${y0 - h * 0.45} L${x + ww / 2} ${y0} Z" fill="${col}"/>`);
      }
    } else {
      out.push(`<rect x="${x - 3}" y="${base - h * 0.4}" width="6" height="${h * 0.4}" fill="#6a4a30"/>`,
        `<ellipse cx="${x}" cy="${base - h * 0.65}" rx="${wd / 2}" ry="${h * 0.35}" fill="${leaf}"/>`,
        `<ellipse cx="${x - wd * 0.15}" cy="${base - h * 0.72}" rx="${wd / 3}" ry="${h * 0.22}" fill="${col}" opacity="0.55"/>`);
    }
    return out.join('');
  }
  if (pl.group === 'shrub' || pl.group === 'fruit') {
    const wd = Math.max(30, Math.min(110, pl.r * 2 * s * 0.8));
    out.push(`<ellipse cx="${x}" cy="${base - h / 2}" rx="${wd / 2}" ry="${h / 2}" fill="${leaf}"/>`);
    for (let k = 0; k < 9; k++) {
      const a = (k * 137.5 * Math.PI) / 180;
      const r = Math.sqrt(k / 9) * 0.8;
      out.push(`<circle cx="${x + Math.cos(a) * r * wd / 2}" cy="${base - h / 2 + Math.sin(a) * r * h / 2}" r="${Math.max(2.5, wd / 14)}" fill="${col}"/>`);
    }
    return out.join('');
  }
  if (pl.group === 'grass') {
    for (let k = -4; k <= 4; k++) out.push(`<path d="M${x} ${base} Q${x + k * 3} ${base - h * 0.6} ${x + k * 6} ${base - h}" stroke="${col}" stroke-width="1.6" fill="none"/>`);
    return out.join('');
  }
  if (pl.group === 'ground') {
    const wd = Math.max(34, pl.r * 2 * s);
    out.push(`<ellipse cx="${x}" cy="${base - 4}" rx="${wd / 2}" ry="7" fill="${leaf}"/>`);
    for (let k = 0; k < 7; k++) out.push(`<circle cx="${x - wd / 2 + 6 + ((wd - 12) * k) / 6}" cy="${base - 6 - (k % 2) * 3}" r="3" fill="${col}"/>`);
    return out.join('');
  }
  // Многолетники и травы
  const wd = Math.max(22, pl.r * 2 * s * 0.9);
  out.push(`<ellipse cx="${x}" cy="${base - h * 0.25}" rx="${wd / 2}" ry="${h * 0.25}" fill="${leaf}"/>`);
  if (SPIKE.has(pl.key)) {
    for (let k = -1; k <= 1; k++) out.push(`<rect x="${x + k * wd * 0.25 - 2.5}" y="${base - h}" width="5" height="${h * 0.55}" rx="2.5" fill="${col}"/>`);
  } else {
    for (let k = 0; k < 6; k++) {
      const a = (k * 137.5 * Math.PI) / 180;
      out.push(`<circle cx="${x + Math.cos(a) * wd * 0.32}" cy="${base - h * 0.75 + Math.sin(a) * h * 0.15}" r="${Math.max(3, wd / 8)}" fill="${col}"/>`);
    }
  }
  return out.join('');
}

/** Картинка композиции: растения в профиль с подписями. */
export function elevationSvg(rows, title = '') {
  const W = 720;
  const H = 360;
  const list = rows.flatMap((r, ti) => r.plants.map((p) => ({ ...p, ti, pl: PLANT_BY_KEY[p.key] })));
  if (!list.length) return '';
  const maxH = Math.max(...list.map((p) => p.pl.h));
  const s = 190 / Math.max(1, maxH);
  const nRows = rows.length;
  const parts = [`<rect x="0" y="0" width="${W}" height="${H}" fill="var(--snow)"/>`,
    `<ellipse cx="${W / 2}" cy="${H - 34}" rx="${W * 0.46}" ry="26" fill="#b8a888" opacity="0.35"/>`];
  const labels = [];
  // Задний ряд рисуем первым и выше, передний — последним и ниже
  rows.forEach((r, ti) => {
    const base = H - 70 + (ti / Math.max(1, nRows - 1)) * 34;
    const n = r.plants.length;
    r.plants.forEach((p, k) => {
      const pl = PLANT_BY_KEY[p.key];
      // Соседние ряды сдвинуты на полшага, чтобы растения не заслоняли друг друга
      const x = 70 + ((k + 0.5 + ti * 0.27) / (n + 0.8)) * (W - 140);
      const copies = Math.min(3, p.qty);
      for (let c = copies - 1; c >= 0; c--) parts.push(drawPlant(pl, x + (c - (copies - 1) / 2) * 18, base - c * 2, s * (1 - c * 0.08)));
      labels.push({ x, top: base - Math.max(14, pl.h * s), name: pl.name, qty: p.qty });
    });
  });
  // Подписи над растениями в две строки, чтобы не наезжали
  labels.sort((a, b) => a.x - b.x).forEach((l, i) => {
    const ly = 22 + (i % 3) * 16;
    parts.push(`<line x1="${l.x}" y1="${ly + 4}" x2="${l.x}" y2="${l.top - 4}" stroke="var(--muted)" stroke-width="0.8" stroke-dasharray="2 2"/>`,
      `<text x="${l.x}" y="${ly}" font-size="12" text-anchor="middle" fill="var(--text)" font-family="var(--font)">${l.name}${l.qty > 1 ? ` ×${l.qty}` : ''}</text>`);
  });
  return `<svg class="elev" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">${parts.join('')}</svg>`;
}

/** Точки посадки внутри клумбы по рядам: задний — у дальнего края. */
export function bedLayout(item, rows) {
  const out = [];
  const n = rows.length;
  rows.forEach((r, ti) => {
    const ly = item.d / 2 - ((ti + 0.5) / n) * item.d;
    const all = r.plants.flatMap((p) => Array.from({ length: Math.min(p.qty, 5) }, () => p.key));
    all.forEach((key, k) => {
      const lx = -item.w / 2 + ((k + 0.5) / all.length) * item.w;
      const t = rad(item.rot || 0);
      out.push({ key, x: item.x + lx * Math.cos(t) + ly * Math.sin(t), y: item.y - lx * Math.sin(t) + ly * Math.cos(t) });
    });
  });
  return out;
}

