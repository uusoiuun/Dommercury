// Сад по свету и почве: проверка почвы, подбор композиций под место,
// сценарии отдыха и картинка композиции «в профиль».
import { sketchPlant, sketchDefs } from './sketch.js';
import {
  PLANT_BY_KEY, BUILDING_BY_KEY, rectPoly, housePieces, houseOutline, convexOverlap, inPoly, sunHours, circlePoly, frostOf, forYakutia, bloomLook, DEKADS, seasonLook, dayLabel, SEASON_DAYS,
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
    short: 'Солнечный', title: 'Солнечный миксбордер', want: 'sun', w: 7, d: 2.5,
    about: 'Пышное цветение всё лето: кустарники сзади, многолетники в середине, низкие и почвопокровные спереди.',
    tiersYak: [
      ['Задний ряд — кустарники', ['syringa', 'sorbocot', 'berberis', 'rosaRugosa', 'potentilla', 'caragana', 'sorbaria'], 2, 1],
      ['Средний ряд — акценты', ['paeonia', 'phloxPan', 'hemerocallis', 'delphinium', 'irisSib', 'trollius', 'achillea'], 3, 3],
      ['Передний ряд', ['sedum', 'chrysanthemum', 'pulsatilla', 'adonis', 'orostachys'], 3, 5],
      ['Злаки для лёгкости', ['bromus'], 1, 3],
    ],
    tiers: [
      ['Задний ряд — кустарники', ['spiraea', 'physocarpus', 'philadelphus', 'potentilla', 'syringaMeyer', 'rosaPark', 'caragana', 'spiraeaCham'], 2, 1],
      ['Средний ряд — акценты', ['phloxPan', 'hemerocallis', 'echinacea', 'irisSib', 'paeonia', 'delphinium', 'rudbeckia', 'nepeta'], 3, 3],
      ['Передний ряд', ['sedum', 'phloxSub', 'thymus', 'armeria', 'festuca', 'achillea'], 3, 5],
      ['Злаки для лёгкости', ['stipa', 'deschampsia', 'festuca'], 1, 3],
    ],
  },
  shadeBorder: {
    short: 'Теневой', title: 'Теневой миксбордер', want: 'shade', w: 6, d: 2.5,
    about: 'Для северной стороны и тени деревьев: крупные листья, белые и кремовые соцветия светятся в полумраке. Тень обычно влажнее — растениям это нравится.',
    tiersYak: [
      ['Задний ряд — кустарники', ['cornus', 'sorbaria', 'padus'], 2, 1],
      ['Средний ряд', ['astilbe', 'aquilegia', 'spiraeaCham', 'filipendula', 'trollius'], 2, 3],
      ['Передний ряд', ['hosta', 'ledum'], 2, 3],
    ],
    tiers: [
      ['Задний ряд — кустарники', ['viburnum', 'cornus', 'sorbaria', 'spiraeaCham', 'hydrangeaArb', 'cornusSton'], 2, 1],
      ['Средний ряд', ['aruncus', 'astilbe', 'hosta', 'filipendula', 'trollius'], 3, 3],
      ['Передний ряд', ['bergenia', 'heuchera', 'vinca', 'primula', 'sagina'], 3, 5],
      ['Злаки', ['deschampsia'], 1, 3],
    ],
  },
  rockery: {
    short: 'Рокарий', title: 'Рокарий', want: 'sun', dry: true, w: 4, d: 3,
    about: 'Каменистая горка на самом солнечном и сухом месте: камни, гравий, суккуленты и злаки. Почти без полива.',
    tiersYak: [
      ['Каркас', ['potentilla', 'pinus', 'cotoneaster'], 1, 1],
      ['Средний ярус', ['pulsatilla', 'adonis', 'bromus'], 2, 3],
      ['Между камнями', ['sedum', 'orostachys', 'achillea'], 3, 5],
    ],
    tiers: [
      ['Каркас', ['juniper', 'potentilla', 'pinus'], 1, 1],
      ['Средний ярус', ['stipa', 'pulsatilla', 'irisBarb', 'festuca', 'adonis'], 2, 3],
      ['Между камнями', ['sedum', 'sempervivum', 'orostachys', 'thymus', 'armeria'], 3, 5],
    ],
  },
  entrance: {
    short: 'У входа', title: 'Входная зона', want: 'any', at: 'door', w: 3.5, d: 1.5,
    about: 'Небольшая аккуратная клумба у входа: красива с весны до осени, не мешает проходу, не колется.',
    tiersYak: [
      ['Акцент', ['berberis', 'potentilla', 'cornus', 'sorbaria'], 1, 1],
      ['Середина', ['hemerocallis', 'hosta', 'phloxPan', 'astilbe', 'trollius'], 2, 3],
      ['Край дорожки', ['sedum', 'pulsatilla', 'orostachys', 'alliumSch'], 1, 5],
    ],
    tiers: [
      ['Акцент', ['hydrangeaPan', 'spiraeaJap', 'potentilla', 'cornus', 'hydrangeaArb'], 1, 1],
      ['Середина', ['hemerocallis', 'hosta', 'heuchera', 'phloxPan', 'astilbe'], 2, 3],
      ['Край дорожки', ['phloxSub', 'bergenia', 'thymus', 'sagina', 'vinca'], 1, 5],
    ],
  },
  parade: {
    short: 'Парадная', title: 'Парадная зона у фасада', want: 'any', at: 'facade', w: 6, d: 1.8,
    about: 'Вдоль фасада — строгая и спокойная посадка: вечнозелёный каркас и повторяющиеся группы, чтобы дом выглядел нарядно круглый год.',
    tiersYak: [
      ['Каркас', ['berberis', 'spiraeaCham', 'cornus', 'cotoneaster', 'syringa'], 2, 1],
      ['Цветение', ['hemerocallis', 'irisSib', 'astilbe', 'phloxPan', 'hosta', 'trollius'], 2, 3],
      ['Бордюр', ['sedum', 'orostachys', 'pulsatilla', 'adonis'], 1, 5],
    ],
    tiers: [
      ['Каркас', ['juniper', 'berberis', 'spiraea', 'cornus', 'taxus', 'spiraeaCham'], 2, 1],
      ['Цветение', ['hemerocallis', 'irisSib', 'astilbe', 'phloxPan', 'hosta'], 2, 3],
      ['Бордюр', ['heuchera', 'bergenia', 'sedum', 'festuca', 'phloxSub'], 1, 5],
    ],
  },
  herbs: {
    short: 'Пряные травы', title: 'Грядка пряных трав', want: 'sun', near: 10, w: 3, d: 1.5,
    about: 'Ароматная грядка ближе к кухне или террасе: зелень к столу всё лето.',
    tiersYak: [
      ['Задний ряд', ['leek', 'borago'], 2, 1],
      ['Середина', ['alliumSch'], 1, 3],
      ['Передний край', ['ocimum'], 1, 3],
    ],
    tiers: [
      ['Задний ряд', ['artemisiaDrac', 'borago', 'leek'], 2, 1],
      ['Середина', ['melissa', 'mentha', 'salvia', 'origanum'], 3, 2],
      ['Передний край', ['thymus', 'alliumSch', 'ocimum'], 3, 3],
    ],
  },
  fire: {
    short: 'Костровище', title: 'Костровище', want: 'sun', evening: true, fire: true, w: 6, d: 6,
    about: 'Круг из гравия с очагом посередине, вокруг — низкие негорючие растения. Не ближе 5 м к постройкам и 4 м к деревьям.',
    tiersYak: [
      ['Вокруг гравийного круга', ['sedum', 'orostachys', 'achillea', 'pulsatilla'], 3, 5],
    ],
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
export function pickPlants(tpl, zone, soil, climate, region = 'yak') {
  const used = new Set();
  // Для Якутии — только растения зоны USDA 1
  const tiers = region === 'yak' && tpl.tiersYak ? tpl.tiersYak : tpl.tiers;
  return tiers.map(([tier, keys, take, qty]) => {
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

// ---- Готовые композиции: нажали — и миксбордер встаёт на свою сторону участка ----
// side — где ставить (стороны света), want — свет, rows — ряды от заднего к переднему: [ряд, [[ключ, штук]]]

// region: yak — для Якутии, только зона USDA 1; warm — малоуходные для тёплых регионов
export const PRESETS = {
  // Расстановка — по образцу, собранному вручную: [доля вдоль клумбы, ряд 1–5]
  yakHits: {
    region: 'yak', short: 'Хиты Якутии', title: 'Хиты Якутии: сирень, барбарис, рябинник', side: 'Ю', want: 'sun', w: 8, d: 3.5,
    about: 'Хиты якутских питомников в заднем ряду — три барбариса амурских, рябинник и две сирени венгерские. Перед ними пионы, лилейники, купальница и аквилегия, по переднему краю — ковёр из прострела и очиток.',
    rows: [
      ['Задний ряд — хиты', [
        ['berberis', 3, [[0.16, 5], [0.30, 5], [0.43, 5]]],
        ['sorbaria', 1, [[0.53, 4]]],
        ['syringa', 2, [[0.64, 5], [0.85, 5]]],
      ]],
      ['Подбивка — многолетники', [
        ['paeonia', 5, [[0.17, 3], [0.26, 3], [0.35, 3], [0.43, 3], [0.50, 3]]],
        ['hemerocallis', 7, [[0.47, 3], [0.51, 2], [0.55, 3], [0.59, 2], [0.63, 3], [0.67, 2], [0.71, 3]]],
        ['trollius', 3, [[0.68, 2], [0.74, 2], [0.80, 2]]],
        ['aquilegia', 3, [[0.78, 2], [0.85, 2], [0.92, 2]]],
      ]],
      ['Край', [
        ['pulsatilla', 17, [[0.130, 1], [0.161, 1], [0.192, 1], [0.223, 1], [0.254, 1], [0.285, 1], [0.316, 1], [0.347, 1], [0.378, 1], [0.409, 1], [0.440, 1], [0.471, 1], [0.502, 1], [0.533, 1], [0.564, 1], [0.595, 1], [0.626, 1]]],
        ['sedum', 5, [[0.70, 1], [0.77, 1], [0.84, 1], [0.91, 1], [0.97, 1]]],
      ]],
    ],
  },
  // Расстановка — по образцу, собранному вручную; сосна — за рябинокизильником
  yakClassic: {
    region: 'yak', short: 'Пионы и флоксы', title: 'Якутская классика: пионы, флоксы, лилейники', side: 'Ю', want: 'sun', w: 9, d: 3.5,
    about: 'Фоном — сосна, рябина сибирская, рябинокизильник Позднякова и шиповник морщинистый. Перед ними многолетники, которые годами цветут в якутских садах: дельфиниумы и пионы слева, ирисы, флоксы и лилейники в середине, аквилегия справа; по переднему краю — хризантемы, прострел и очиток. Цветение с мая до сентября.',
    rows: [
      ['Фон — хиты', [
        ['pinus', 1, [[0.35, 5]]],
        ['sorbusSib', 1, [[0.68, 5]]],
        ['sorbocot', 2, [[0.27, 4], [0.42, 4]]],
        ['rosaRugosa', 3, [[0.51, 4], [0.60, 4], [0.75, 4]]],
      ]],
      ['Задний ряд', [
        ['delphinium', 5, [[0.04, 4], [0.08, 4], [0.13, 4], [0.18, 4], [0.22, 4]]],
        ['phloxPan', 3, [[0.46, 3], [0.55, 3], [0.64, 3]]],
      ]],
      ['Средний ряд', [
        ['paeonia', 3, [[0.11, 3], [0.21, 3], [0.31, 3]]],
        ['irisSib', 15, [[0.30, 3], [0.34, 2], [0.39, 3], [0.43, 2], [0.47, 3], [0.51, 2], [0.56, 3], [0.60, 2], [0.64, 3], [0.69, 2], [0.73, 3], [0.77, 2], [0.81, 3], [0.86, 2], [0.90, 3]]],
        ['hemerocallis', 9, [[0.62, 2], [0.66, 3], [0.70, 2], [0.74, 3], [0.78, 2], [0.82, 3], [0.86, 2], [0.90, 3], [0.94, 2]]],
      ]],
      ['Передний ряд', [
        ['chrysanthemum', 5, [[0.05, 2], [0.12, 2], [0.18, 2], [0.25, 2], [0.32, 2]]],
        ['aquilegia', 3, [[0.72, 2], [0.79, 2], [0.86, 2]]],
      ]],
      ['Край', [
        ['pulsatilla', 5, [[0.40, 1], [0.45, 1], [0.49, 1], [0.53, 1], [0.58, 1]]],
        ['sedum', 5, [[0.73, 1], [0.79, 1], [0.85, 1], [0.91, 1], [0.97, 1]]],
      ]],
    ],
  },
  yakBerry: {
    region: 'yak', short: 'Ягодный', title: 'Ягодный уголок', side: 'ЮВ', want: 'sun', w: 7, d: 3,
    about: 'Красиво и съедобно: черёмуха Маака и яблоня ягодная сзади, жимолость, облепиха и шиповник в середине, шнитт-лук и купальница спереди.',
    rows: [
      ['Задний ряд', [['malus', 1], ['padusMaackii', 1]]],
      ['Средний ряд', [['lonicera', 3], ['hippophae', 2], ['rosaAcic', 2]]],
      ['Передний ряд', [['alliumSch', 5], ['trollius', 3], ['potentilla', 3]]],
      ['Край', [['pulsatilla', 5], ['sedum', 5]]],
    ],
  },
  yakShade: {
    region: 'yak', short: 'Северный угол', title: 'Северный тенистый угол', side: 'С', want: 'part', w: 6, d: 2.5,
    about: 'Для северной стороны и тени: черёмуха, дерен и рябинник не боятся тени, хосты, астильбы и аквилегии любят полутень и влагу, багульник — кислую почву.',
    rows: [
      ['Задний ряд', [['padus', 1], ['cornus', 2]]],
      ['Средний ряд', [['sorbaria', 1], ['astilbe', 3], ['aquilegia', 3], ['phloxPan', 3]]],
      ['Передний ряд', [['hosta', 3], ['ledum', 3], ['trollius', 3]]],
    ],
  },
  yakWind: {
    region: 'yak', short: 'Изгородь от ветра', title: 'Живая изгородь от ветра', side: 'С', want: 'part', w: 10, d: 3,
    about: 'Плотная полоса с наветренной стороны: тополь быстро даёт высоту, карагана и боярышник — густоту, шиповник Беггера и кизильник — нижний ярус.',
    rows: [
      ['Задний ряд', [['populusBer', 1], ['caragana', 3]]],
      ['Средний ряд', [['crataegus', 2], ['rosaBegg', 2]]],
      ['Передний ряд', [['cotoneaster', 3]]],
      ['Подбивка', [['potentilla', 3], ['pulsatilla', 5], ['sedum', 5]]],
    ],
  },
  yakMeadow: {
    region: 'yak', short: 'Местные цветы', title: 'Цветник из местных многолетников', side: 'ЮЗ', want: 'sun', w: 5, d: 2.5,
    about: 'Цветы якутских лугов и склонов: прострел и адонис в мае, купальница в июне, тысячелистник и лабазник всё лето, шиповник морщинистый — фоном.',
    rows: [
      ['Задний ряд', [['rosaRugosa', 1], ['filipendula', 3]]],
      ['Средний ряд', [['trollius', 5], ['achillea', 5], ['bromus', 3]]],
      ['Передний ряд', [['adonis', 5], ['pulsatilla', 5]]],
      ['Край', [['orostachys', 5]]],
    ],
  },
  yakEntrance: {
    region: 'yak', short: 'У входа', title: 'Клумба у входа', side: 'Ю', want: 'sun', w: 3.5, d: 1.8,
    about: 'Аккуратно с весны до осени: барбарис амурский и лапчатка, весной — прострел, летом — лилейники, осенью — очиток.',
    rows: [
      ['Задний ряд', [['berberis', 1], ['potentilla', 2]]],
      ['Средний ряд', [['hemerocallis', 3]]],
      ['Передний ряд', [['sedum', 5], ['pulsatilla', 5]]],
    ],
  },
  sunSedum: {
    short: 'Солнечный с очитком', title: 'Солнечный миксбордер с очитком', side: 'Ю', want: 'sun', w: 7, d: 2.5,
    about: 'Для самой солнечной и сухой стороны: очиток, эхинацея, рудбекия и котовник цветут с июля до заморозков, почти без полива.',
    rows: [
      ['Задний ряд', [['potentilla', 1], ['spiraea', 1]]],
      ['Средний ряд', [['echinacea', 3], ['rudbeckia', 3], ['irisSib', 3]]],
      ['Передний ряд', [['sedum', 5], ['nepeta', 3], ['thymus', 5], ['bergenia', 3]]],
      ['Злаки', [['stipa', 3]]],
    ],
  },
  pinkWhite: {
    short: 'Бело-розовый', title: 'Бело-розовый миксбордер', side: 'ЮЗ', want: 'sun', w: 8, d: 3,
    about: 'Нежная гамма: дерен, спирея и можжевельник сзади, флоксы, астильбы и лилейники в середине, ковёр из флокса шиловидного и тимьяна спереди.',
    rows: [
      ['Задний ряд — структура', [['cornus', 1], ['spiraea', 1], ['juniper', 1]]],
      ['Средний ряд', [['hemerocallis', 3], ['phloxPan', 3], ['echinacea', 3]]],
      ['Передний ряд', [['phloxSub', 5], ['sedum', 3], ['thymus', 5], ['festuca', 3], ['bergenia', 3]]],
      ['Акценты', [['stipa', 3]]],
    ],
  },
  perennials: {
    short: 'Многолетники', title: 'Цветник из многолетников', side: 'ЮВ', want: 'sun', w: 6, d: 2.5,
    about: 'Ирисы, флокс, лилейники, очиток и гейхеры под парковой розой — цветение волнами с июня до осени.',
    rows: [
      ['Акцент', [['rosaPark', 1]]],
      ['Середина', [['irisBarb', 3], ['phloxPan', 3], ['hemerocallis', 3]]],
      ['Передний край', [['sedum', 3], ['heuchera', 3], ['bergenia', 3], ['phloxSub', 5]]],
    ],
  },
  philadelphus: {
    short: 'С чубушником', title: 'Клумба с чубушником и местом для отдыха', side: 'З', want: 'sun', w: 6, d: 4,
    about: 'Душистый чубушник за спиной, флоксы и роза по бокам, котовник и армерия у гравийной площадки с двумя стульями.',
    rows: [
      ['Фон', [['philadelphus', 1], ['rosaPark', 1]]],
      ['Середина', [['phloxPan', 3], ['nepeta', 3]]],
      ['Край площадки', [['armeria', 5], ['thymus', 3], ['bergenia', 3], ['phloxSub', 3], ['sedum', 3]]],
    ],
  },
  yellowViolet: {
    short: 'Жёлто-фиолетовая', title: 'Жёлто-фиолетовая клумба: купальница, ирисы, злаки', side: 'В', want: 'part', w: 5, d: 2,
    about: 'Утреннее солнце и влажная почва: купальница светится жёлтым, сибирские ирисы — фиолетовым, злаки добавляют лёгкости.',
    rows: [
      ['Задний план', [['trollius', 3], ['deschampsia', 3]]],
      ['Средний план', [['irisSib', 5], ['stipa', 3]]],
      ['Передний край', [['festuca', 5], ['primula', 5], ['bergenia', 3]]],
    ],
  },
  shadeHosta: {
    short: 'Хоста и астильба', title: 'Тенистый уголок: хоста и астильба', side: 'С', want: 'shade', w: 6, d: 2.5,
    about: 'Для северной стороны: крупные листья хост, пышные метёлки астильб, бадан и гейхеры у края. В тени влажнее — им это нравится.',
    rows: [
      ['Задний ряд', [['viburnum', 1], ['cornus', 1], ['hydrangeaArb', 1]]],
      ['Средний ряд', [['astilbe', 5], ['hosta', 3], ['aruncus', 1]]],
      ['Передний ряд', [['bergenia', 3], ['heuchera', 3], ['sagina', 5]]],
    ],
  },
  shadeWhite: {
    short: 'Белый сад', title: 'Белый сад в тени', side: 'СВ', want: 'shade', w: 5, d: 2.5,
    about: 'Белые и кремовые цветы светятся в полумраке: гортензия древовидная, волжанка, астильба «Bridal Veil», хоста с белой каймой.',
    rows: [
      ['Задний ряд', [['hydrangeaArb', 1], ['spiraeaCham', 1]]],
      ['Средний ряд', [['aruncus', 1], ['astilbe', 3], ['hosta', 3]]],
      ['Передний ряд', [['bergenia', 3], ['vinca', 5]]],
    ],
  },
  shrubGroup: {
    short: 'Кустарники', title: 'Кустарниковая группа', side: 'СЗ', want: 'part', w: 7, d: 3.5,
    about: 'Сирень, гортензия, пёстрый дерен и спирея с можжевельниками спереди — красиво круглый год и прикрывает от ветра.',
    rows: [
      ['Задний ряд', [['syringaVulg', 1], ['cornus', 1]]],
      ['Середина', [['hydrangeaPan', 2], ['spiraeaJap', 3]]],
      ['Передний ряд', [['juniper', 2], ['bergenia', 3]]],
    ],
  },
  rockery: {
    short: 'Рокарий', title: 'Рокарий', side: 'Ю', want: 'sun', w: 4, d: 3,
    about: 'Каменистая горка на самом солнечном и сухом месте: можжевельник, ковыль, прострел, очиток, молодило и тимьян между камнями.',
    rows: [
      ['Каркас', [['juniper', 1]]],
      ['Средний ярус', [['stipa', 3], ['pulsatilla', 3]]],
      ['Между камнями', [['sedum', 5], ['sempervivum', 5], ['thymus', 5]]],
    ],
  },
  herbs: {
    short: 'Травы', title: 'Пряные травы', side: 'Ю', want: 'sun', near: 10, w: 3, d: 1.5,
    about: 'Ближе к кухне: шнитт-лук, орегано, тимьян, мелисса, мята в бортике, эстрагон.',
    rows: [
      ['Задний ряд', [['artemisiaDrac', 1], ['borago', 2]]],
      ['Середина', [['melissa', 2], ['mentha', 2], ['origanum', 2]]],
      ['Передний край', [['thymus', 3], ['alliumSch', 3]]],
    ],
  },
};
for (const pr of Object.values(PRESETS)) pr.region ||= 'warm';
export const PRESET_KEYS = Object.keys(PRESETS);
const SIDE_AZ = { С: 0, СВ: 45, В: 90, ЮВ: 135, Ю: 180, ЮЗ: 225, З: 270, СЗ: 315 };

/** Ряды готовой композиции в общем виде: [{ tier, plants: [{ key, qty }] }]. */
// Если у растения в образце указаны места — [доля вдоль клумбы, ряд 1–5], — композиция открывается сразу так
export const presetRows = (key) => PRESETS[key].rows.map(([tier, list]) => ({
  tier,
  plants: list.map(([k, qty, at]) => ({ key: k, qty, ...(at ? { at: at.map(([u, row]) => ({ u, v: (DEPTH_ROWS - row) / (DEPTH_ROWS - 1), z: 0 })) } : {}) })),
}));

/**
 * Место для готовой композиции: на своей стороне участка и с нужным светом.
 * Длинная сторона клумбы — вдоль ближайшей границы участка.
 */
export function placePreset(key, yard, hours, size = null) {
  const pr = { ...PRESETS[key], ...(size || {}) };
  const W = yard.plot.w;
  const D = yard.plot.d;
  // Направление стороны в осях участка
  const a = rad(SIDE_AZ[pr.side] - yard.plot.rot);
  const dir = [Math.sin(a), Math.cos(a)];
  const rot = Math.abs(dir[0]) > Math.abs(dir[1]) ? 90 : 0;
  const shareAt = makeShareAt({ ...hours.grid, w: W }, hours.grid.maxHours);
  const obs = obstacles(yard);
  const flatObs = yard.items.filter((i) => BUILDING_BY_KEY[i.t].flat).map((i) => rectPoly(i));
  const woody = yard.plants.filter((p) => ['tree', 'shrub', 'fruit'].includes(PLANT_BY_KEY[p.t].group));
  const h = yard.house;
  const hd = h.shape === 'square' ? h.w : h.d;
  const want = { sun: 0.85, part: 0.5, shade: 0.2 }[pr.want];
  let best = null;
  for (let y = 1; y <= D - 1; y += 1) {
    for (let x = 1; x <= W - 1; x += 1) {
      const o = { x, y, w: pr.w, d: pr.d, rot };
      const poly = rectPoly(o);
      if (poly.some(([px, py]) => px < 0.8 || py < 0.8 || px > W - 0.8 || py > D - 0.8)) continue;
      if (obs.some((ob) => convexOverlap(ob, poly))) continue;
      const wide = rectPoly({ ...o, w: o.w + 2, d: o.d + 2 });
      if (flatObs.some((ob) => convexOverlap(ob, wide))) continue;
      if (woody.some((p) => inPoly(rectPoly({ ...o, w: o.w + 2 * PLANT_BY_KEY[p.t].r, d: o.d + 2 * PLANT_BY_KEY[p.t].r }), [p.x, p.y]))) continue;
      // Насколько точка на нужной стороне: от центра участка к стороне
      const toward = ((x - W / 2) * dir[0] + (y - D / 2) * dir[1]) / (Math.hypot(W, D) / 2);
      const pts = [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      const share = pts.reduce((s, [px, py]) => s + shareAt(px, py), 0) / pts.length;
      let score = toward * 6 - Math.abs(share - want) * 8;
      if (pr.near) score -= Math.max(0, Math.hypot(x - h.x, y - h.y) - Math.max(h.w, hd) / 2 - pr.near) * 0.5;
      if (!best || score > best.score) best = { ...o, score, share };
    }
  }
  return best;
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
  const fits = (k) => suits(PLANT_BY_KEY[k], null, soil, climate) && (yard.region === 'warm' || forYakutia(PLANT_BY_KEY[k]));
  const treeKeys = ['larix', 'picea', 'pinus', 'betula', 'populusBer'].filter(fits);
  const shrubKeys = ['caragana', 'amelanchier', 'salix', 'cotoneaster', 'sorbaria', 'spiraeaCham', 'berberis', 'rosaBegg'].filter(fits);
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

// ---- Картинка композиции «в профиль»: рисунок тушью и акварелью ----

/** Картинка композиции: растения в профиль с подписями, как рисунок от руки. */
// Каждое растение композиции стоит в своём месте: u — вдоль клумбы (0 — левый край, 1 — правый),
// v — вглубь (0 — задний край, 1 — передний). Пока растение не двигали, место считается по рядам.
// Копии по умолчанию встают рядом, а не друг за другом.
const ELEV = { W: 720, H: 410, pad: 70 };
export const ELEV_SPAN = ELEV.W - 2 * ELEV.pad;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export function plantSpots(rows) {
  const nRows = rows.length;
  const out = [];
  rows.forEach((r, ti) => {
    const n = r.plants.length;
    r.plants.forEach((p, k) => {
      const u0 = (k + 0.5 + ti * 0.27) / (n + 0.8);
      const step = Math.min(0.06, 0.5 / (n + 0.8) / Math.max(1, p.qty - 1));
      for (let c = 0; c < p.qty; c++) {
        const at = p.at?.[c];
        const u = at ? at.u : u0 + (c - (p.qty - 1) / 2) * step;
        const v = at ? at.v : snapV(nRows > 1 ? ti / (nRows - 1) : 0.5);
        // z — порядок наложения на рисунке: меньше — дальше (рисуется раньше)
        // mx, my — точное место в клумбе, м, после расстановки по нормам
        out.push({ ti, k, c, key: p.key, u: clamp01(u), v: clamp01(v), z: at?.z ?? 0, mx: at?.mx, my: at?.my });
      }
    });
  });
  return out;
}
/** Записать места всех копий растения в p.at, чтобы их можно было двигать по одной. */
export function fixSpots(rows) {
  const spots = plantSpots(rows);
  rows.forEach((r, ti) => r.plants.forEach((p, k) => {
    p.at = spots.filter((sp) => sp.ti === ti && sp.k === k).map(({ u, v, z, mx, my }) => (mx != null ? { u, v, z, mx, my } : { u, v, z }));
  }));
}
// Глубина клумбы — 5 рядов: ряд 1 — передний (v = 1), ряд 5 — самый задний (v = 0)
export const DEPTH_ROWS = 5;
export const rowOfV = (v) => DEPTH_ROWS - Math.round(v * (DEPTH_ROWS - 1));
const vOfRow = (row) => (DEPTH_ROWS - row) / (DEPTH_ROWS - 1);
export const snapV = (v) => vOfRow(rowOfV(Math.max(0, Math.min(1, v))));
// Сначала задние ряды, внутри ряда — по порядку наложения, затем слева направо
const byLayer = (a, b) => a.v - b.v || a.z - b.z || a.u - b.u;
// Масштаб рисунка: невысокие растения крупнее, чем в масштабе, — иначе цветы теряются рядом с кустом
const scaleOf = (rows) => {
  const maxH = Math.max(1, ...rows.flatMap((r) => r.plants.map((p) => PLANT_BY_KEY[p.key].h)));
  const hPx = (pl) => 200 * (pl.h / maxH) ** 0.45;
  return { hPx, sOf: (pl) => hPx(pl) / pl.h };
};
// Полуширина растения на рисунке, px
const halfW = (pl, sc, k = 1) => k * Math.min(95, Math.max(14, pl.r * sc.sOf(pl) * 0.8, Math.max(16, sc.hPx(pl)) * 0.3));

/**
 * Передвинуть растение (копию c растения ref = 'ряд:номер') по слоям рисунка:
 * back — за ближайшее растение, которое его заслоняет сзади; bottom — в самый конец;
 * front — перед ближайшим соседом спереди; top — на передний план.
 * Возвращает false, если двигать дальше некуда.
 */
/**
 * Переставить растение (копию c растения ref = 'ряд:номер') по рядам клумбы:
 * back — на ряд назад, front — на ряд вперёд, bottom — в самый задний (5-й), top — в передний (1-й).
 * Возвращает новый номер ряда или false, если дальше некуда.
 */
export function rowMove(rows, ref, c, dir) {
  fixSpots(rows);
  const [ti, k] = ref.split(':').map(Number);
  const at = rows[ti]?.plants[k]?.at?.[c];
  if (!at) return false;
  const now = rowOfV(at.v);
  const to = { back: now + 1, front: now - 1, bottom: DEPTH_ROWS, top: 1 }[dir];
  if (to < 1 || to > DEPTH_ROWS || to === now) return false;
  at.v = vOfRow(to);
  delete at.mx;
  delete at.my;
  // В новом ряду — поверх тех, кто уже там стоит
  const maxZ = Math.max(0, ...rows.flatMap((r) => r.plants.flatMap((p) => (p.at || []).filter((a) => a !== at && rowOfV(a.v) === to).map((a) => a.z ?? 0))));
  at.z = maxZ + 0.01;
  return to;
}

/** Картинка композиции: растения в профиль с подписями, как рисунок от руки. */
export function elevationSvg(rows, title = '', opt = {}) {
  const { W, H, pad } = ELEV;
  const list = rows.flatMap((r) => r.plants.map((p) => PLANT_BY_KEY[p.key]));
  if (!list.length) return '';
  const sc = scaleOf(rows);
  const { hPx, sOf } = sc;
  const { id, defs } = sketchDefs();
  const ground = H - 58;
  // Основание растения в ряду: задние ряды выше по рисунку и чуть мельче — так видна глубина клумбы
  const depth = 52;
  const baseOf = (v) => ground + 6 - (1 - v) * depth;
  const kOf = (v) => 0.84 + 0.16 * v;
  const parts = [defs, `<rect x="0" y="0" width="${W}" height="${H}" fill="#f7f1e3"/>`, `<rect x="0" y="0" width="${W}" height="${H}" filter="url(#${id}-paper)"/>`];
  // Земля: мазок охры и линия, проведённая от руки
  parts.push(`<g filter="url(#${id}-wc)"><path d="M44 ${ground - depth} Q${W / 2} ${ground - depth - 6} ${W - 44} ${ground - depth + 2} L${W - 30} ${ground + 8} Q${W / 2} ${ground + 4} 30 ${ground + 14} Z" fill="#c8b48a" fill-opacity="0.32"/>`
    + `<path d="M30 ${ground + 14} Q${W * 0.3} ${ground + 4} ${W / 2} ${ground + 10} T${W - 30} ${ground + 8} L${W - 40} ${ground + 30} Q${W / 2} ${ground + 40} 40 ${ground + 30} Z" fill="#c8b48a" fill-opacity="0.45"/></g>`,
    `<g filter="url(#${id}-ink)"><path class="sk-ink" d="M24 ${ground + 12} Q${W * 0.28} ${ground + 3} ${W / 2} ${ground + 9} T${W - 24} ${ground + 7}" stroke-width="1.2"/>`
    + `<path class="sk-hatch" d="${Array.from({ length: 34 }, (_, k) => `M${50 + k * 19} ${ground + 18 + (k % 3) * 4} l9 -3`).join(' ')}"/></g>`);
  // Подсказка рядов в окне «Состав»: тонкие линии и номера слева
  if (opt.guides) {
    for (let r = 1; r <= DEPTH_ROWS; r++) {
      const y = baseOf(vOfRow(r));
      parts.push(`<g class="sk-row"><path d="M46 ${y} L${W - 46} ${y}"/><text x="14" y="${y + 4}">ряд ${r}</text></g>`);
    }
  }
  // Задние растения рисуем первыми, передние — последними; порядок можно менять кнопками
  const isSel = (sp) => !!opt.sel && opt.sel.ref === `${sp.ti}:${sp.k}` && opt.sel.c === sp.c;
  const spots = plantSpots(rows).sort(byLayer);
  let selHit = '';
  const groups = new Map();
  for (const sp of spots) {
    const pl = PLANT_BY_KEY[sp.key];
    const x = pad + sp.u * ELEV_SPAN;
    const base = baseOf(sp.v);
    const kk = kOf(sp.v);
    const sel = isSel(sp) ? ' sel' : '';
    // С ползунком сезона — вид растения в выбранный день: бутоны, цветы, ягоды, осенняя листва
    const look = opt.day != null ? seasonLook(pl, opt.day) : null;
    const pic = sketchPlant(pl, x, base, sOf(pl) * kk, sp.c, look);
    // Невидимая область нажатия по силуэту — чтобы попасть и в тонкие прутья, и в редкий злак
    const hh = Math.max(16, hPx(pl) * kk);
    const hit = `<ellipse class="sk-hit" cx="${x}" cy="${base - hh / 2}" rx="${halfW(pl, sc, kk)}" ry="${hh / 2 + 4}"/>`;
    // Выбранное растение можно взять, даже если оно за другими: его область нажатия — поверх всех
    if (sel) selHit = `<g data-plant="${sp.ti}:${sp.k}" data-c="${sp.c}">${hit}</g>`;
    parts.push(`<g class="sk-plant${sel}" data-plant="${sp.ti}:${sp.k}" data-c="${sp.c}"><title>${pl.name}</title>${hit}<g filter="url(#${id}-wc)">${pic.wash}</g><g filter="url(#${id}-ink)">${pic.ink}</g></g>`);
    const g = groups.get(`${sp.ti}:${sp.k}`) || { xs: [], top: Infinity, pl, qty: 0, look };
    g.xs.push(x);
    g.top = Math.min(g.top, base - hh);
    g.qty++;
    groups.set(`${sp.ti}:${sp.k}`, g);
  }
  if (selHit) parts.push(selHit);
  const labels = [...groups.values()].map((g) => ({ x: g.xs.reduce((a, b) => a + b, 0) / g.xs.length, top: g.top, name: g.pl.name, qty: g.qty, frost: frostOf(g.pl), look: g.look }));
  // Подписи от руки: каждая — в первую строку, где не наезжает на соседнюю
  const ends = [];
  labels.sort((a, b) => a.x - b.x).forEach((l) => {
    const text = `${l.name}${l.qty > 1 ? ` ×${l.qty}` : ''}`;
    const half = (text.length + 2) * 3.6 + 6;
    let line = ends.findIndex((e) => e < l.x - half);
    if (line < 0) line = ends.length;
    ends[line] = l.x + half;
    const ly = 24 + line * 18;
    parts.push(`<path class="sk-lead" d="M${l.x} ${ly + 5} Q${l.x + 6} ${(ly + l.top) / 2} ${l.x} ${l.top - 4}"/>`,
      `<text class="sk-label${!l.look ? '' : l.look.amt >= 0.4 ? ' on' : l.look.famt >= 0.5 ? ' fruit' : ' off'}" x="${l.x}" y="${ly}" text-anchor="middle">${l.look?.amt >= 0.4 ? '✿ ' : ''}${text}${l.frost.cls === 'annual' ? '' : `<tspan class="sk-frost ${l.frost.cls}" dx="3">❄\uFE0E</tspan>`}<title>${l.frost.text}</title></text>`);
  });
  // Миниатюра в карточке — без подписей, обрезана по растениям
  if (opt.thumb) return `<svg class="elev sketch" viewBox="40 110 ${W - 80} ${H - 120}" role="img" aria-label="${title}">${parts.filter((x) => !x.includes('sk-label') && !x.includes('sk-lead') && !x.includes('sk-row')).join('')}</svg>`;
  return `<svg class="elev sketch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">${parts.join('')}</svg>`;
}

/**
 * Календарь цветения композиции: полоса на каждое растение с мая по сентябрь,
 * цветение — цветом цветков, ягоды — штрихом; вертикальная линия — выбранная декада.
 */
export function bloomChartSvg(rows, day) {
  const seen = new Set();
  const list = rows.flatMap((r) => r.plants.map((p) => PLANT_BY_KEY[p.key])).filter((pl) => !seen.has(pl.key) && seen.add(pl.key));
  list.sort((a, b) => (a.bloom ? a.bloom[0] : 99) - (b.bloom ? b.bloom[0] : 99) || (a.fruit ? a.fruit[0] : 99) - (b.fruit ? b.fruit[0] : 99));
  const L = 190;
  const R = 712;
  const cell = (R - L) / DEKADS.length;
  const rowH = 20;
  const top = 34;
  const H = top + list.length * rowH + 30;
  const X = (d) => L + d * cell;
  const parts = [`<defs><pattern id="bc-fruit" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#fff" stroke-width="1.6" stroke-opacity="0.55"/></pattern></defs>`];
  ['Май', 'Июнь', 'Июль', 'Август', 'Сентябрь'].forEach((m, i) => {
    parts.push(`<rect class="bc-month${i % 2 ? ' alt' : ''}" x="${X(i * 3)}" y="${top - 6}" width="${cell * 3}" height="${list.length * rowH + 10}"/>`,
      `<text class="bc-mtext" x="${X(i * 3) + cell * 1.5}" y="${top - 12}" text-anchor="middle">${m}</text>`);
  });
  list.forEach((pl, i) => {
    const y = top + i * rowH;
    const on = seasonLook(pl, day).amt >= 0.4;
    parts.push(`<text class="bc-name${on ? ' on' : ''}" x="${L - 8}" y="${y + 13}" text-anchor="end">${on ? '✿ ' : ''}${pl.name.replace(/\s*\(.*\)/, '')}</text>`);
    if (pl.fruit) parts.push(`<rect x="${X(pl.fruit[0]) + 1}" y="${y + 5}" width="${(pl.fruit[1] - pl.fruit[0] + 1) * cell - 2}" height="9" rx="4" fill="${pl.fruitColor}" fill-opacity="0.75"/><rect x="${X(pl.fruit[0]) + 1}" y="${y + 5}" width="${(pl.fruit[1] - pl.fruit[0] + 1) * cell - 2}" height="9" rx="4" fill="url(#bc-fruit)"/>`);
    if (pl.bloom) parts.push(`<rect class="bc-bar" x="${X(pl.bloom[0]) + 1}" y="${y + 3}" width="${(pl.bloom[1] - pl.bloom[0] + 1) * cell - 2}" height="13" rx="6" fill="${pl.flowerColor}"/>`);
    if (!pl.bloom && !pl.fruit) parts.push(`<text class="bc-none" x="${L + 6}" y="${y + 13}">декоративная листва и хвоя</text>`);
  });
  const nx = L + (day / SEASON_DAYS) * (R - L);
  parts.push(`<line class="bc-now" x1="${nx}" y1="${top - 8}" x2="${nx}" y2="${top + list.length * rowH + 6}"/>`,
    `<text class="bc-nowt" x="${nx}" y="${top + list.length * rowH + 22}" text-anchor="middle">${dayLabel(day)}</text>`);
  return `<svg class="bloom-chart" viewBox="0 0 720 ${H}" role="img" aria-label="Календарь цветения">${parts.join('')}</svg>`;
}

/** Декады без цветения в композиции — подсказка, где «провал». */
export function bloomGaps(rows) {
  const pls = rows.flatMap((r) => r.plants.map((p) => PLANT_BY_KEY[p.key]));
  return DEKADS.map((_, d) => d).filter((d) => !pls.some((pl) => bloomLook(pl, d).flower));
}

// ---- Схема посадки: вид сверху в масштабе ----
// Расстояние между центрами соседних растений — сумма радиусов их взрослых крон:
// так кусты сомкнутся, но не будут глушить друг друга. До края клумбы — радиус кроны.
/** Место растения в клумбе, м: x — вдоль клумбы от левого края, y — от переднего края вглубь. */
const bedXY = (sp, w, d) => (sp.mx != null ? [Math.min(sp.mx, w), Math.min(sp.my, d)] : [(0.06 + sp.u * 0.88) * w, (0.12 + (1 - sp.v) * 0.76) * d]);
const uOfX = (x, w) => Math.max(0, Math.min(1, (x / w - 0.06) / 0.88));
const vOfY = (y, d) => Math.max(0, Math.min(1, 1 - (y / d - 0.12) / 0.76));

/**
 * Расставить растения по нормам: в каждом ряду — по порядку слева направо, соседи на расстоянии
 * суммы радиусов крон, до края — радиус; ряды — один за другим вглубь. Если не помещается,
 * клумба увеличивается. Возвращает новые размеры клумбы { w, d } (м, шаг 0,5).
 */
export function arrangeBed(item, rows) {
  fixSpots(rows);
  const spots = plantSpots(rows);
  const byRow = new Map();
  for (const sp of spots) {
    const k = rowOfV(sp.v);
    if (!byRow.has(k)) byRow.set(k, []);
    byRow.get(k).push({ sp, pl: PLANT_BY_KEY[sp.key], r: edgeR(PLANT_BY_KEY[sp.key]) });
  }
  // Ряды от заднего (5) к переднему (1)
  const rowList = [...byRow.entries()].sort((a, b) => b[0] - a[0]).map(([, l]) => l.sort((a, b) => a.sp.u - b.sp.u));
  // Длина ряда: от края до первого — его радиус, между соседями — нужный промежуток, до края — радиус последнего
  const need = (l) => l[0].r + l.slice(1).reduce((t, e, i) => t + plantGap(l[i].pl, e.pl), 0) + l[l.length - 1].r;
  const half = (x) => Math.ceil(x * 2) / 2;
  const w = half(Math.max(item.w, ...rowList.map(need)));
  const depth = rowList.reduce((t, l) => t + 2 * Math.max(...l.map((e) => e.r)), 0);
  const d = half(Math.max(item.d, depth));
  // Свободное место по глубине — поровну между рядами
  let y = d;
  const spare = (d - depth) / (rowList.length + 1);
  for (const l of rowList) {
    const rmax = Math.max(...l.map((e) => e.r));
    y -= spare + rmax;
    const gap = (w - need(l)) / (l.length + 1);
    let x = gap + l[0].r;
    l.forEach((e, i) => {
      if (i) x += gap + plantGap(l[i - 1].pl, e.pl);
      const at = rows[e.sp.ti].plants[e.sp.k].at[e.sp.c];
      at.u = uOfX(x, w);
      at.v = vOfY(y, d);
      at.mx = Math.round(x * 100) / 100;
      at.my = Math.round(y * 100) / 100;
    });
    y -= rmax;
  }
  return { w, d };
}

// Под кроной дерева можно сажать кусты и цветы: до низких соседей у дерева считаем
// только приствольный круг (до 1,5 м), между двумя деревьями — полные кроны
const TRUNK_ZONE = 1.5;
const isTree = (pl) => pl.group === 'tree' || (pl.size === 'mid' && pl.h >= 4);
export const plantGap = (a, b) => (isTree(a) && isTree(b) ? a.r + b.r : (isTree(a) ? Math.min(a.r, TRUNK_ZONE) : a.r) + (isTree(b) ? Math.min(b.r, TRUNK_ZONE) : b.r));
const edgeR = (pl) => (isTree(pl) ? Math.min(pl.r, TRUNK_ZONE) : pl.r);

/** Таблица расстояний для композиции: по растению — крона, шаг между своими, до края. */
export function spacingRows(rows) {
  const seen = new Map();
  for (const r of rows) for (const p of r.plants) {
    const pl = PLANT_BY_KEY[p.key];
    const e = seen.get(p.key) || { pl, qty: 0 };
    e.qty += p.qty;
    seen.set(p.key, e);
  }
  return [...seen.values()].map(({ pl, qty }) => ({ pl, qty, crown: pl.r * 2, step: pl.r * 2, edge: edgeR(pl) }));
}

/**
 * Схема посадки сверху: клумба w × d м в масштабе, сетка 0,5 м, круги — кроны взрослых растений,
 * номера — по таблице; линии — расстояние до ближайшего соседа (красная — тесно).
 */
export function topSchemeSvg(item, rows) {
  const { w, d } = item;
  const spots = plantSpots(rows);
  const legend = spacingRows(rows);
  const num = new Map(legend.map((e, i) => [e.pl.key, i + 1]));
  const s = Math.min(640 / w, 420 / d, 140);
  const L = 50;
  const T = 30;
  const Wp = w * s;
  const Dp = d * s;
  const X = (m) => L + m * s;
  const Y = (m) => T + Dp - m * s; // y от переднего края — передний край внизу
  const parts = [`<rect class="ts-bed" x="${L}" y="${T}" width="${Wp}" height="${Dp}" rx="6"/>`];
  for (let m = 0.5; m < w; m += 0.5) parts.push(`<line class="ts-grid${Math.abs(m % 1) < 1e-6 ? ' m' : ''}" x1="${X(m)}" y1="${T}" x2="${X(m)}" y2="${T + Dp}"/>`);
  for (let m = 0.5; m < d; m += 0.5) parts.push(`<line class="ts-grid${Math.abs(m % 1) < 1e-6 ? ' m' : ''}" x1="${L}" y1="${Y(m)}" x2="${L + Wp}" y2="${Y(m)}"/>`);
  const pts = spots.map((sp) => {
    const pl = PLANT_BY_KEY[sp.key];
    const [mx, my] = bedXY(sp, w, d);
    return { sp, pl, mx, my };
  });
  // Кроны: большие снизу, мелкие сверху
  for (const p of [...pts].sort((a, b) => b.pl.r - a.pl.r)) {
    parts.push(`<circle class="ts-crown" cx="${X(p.mx)}" cy="${Y(p.my)}" r="${p.pl.r * s}" fill="${p.pl.flowerColor || p.pl.color}"/>`);
  }
  // Ближайший сосед каждого растения: фактическое расстояние и нужное
  const pairs = new Map();
  let tight = 0;
  pts.forEach((a, i) => {
    let best = null;
    pts.forEach((b, j) => {
      if (i === j) return;
      const dist = Math.hypot(a.mx - b.mx, a.my - b.my);
      if (!best || dist < best.dist) best = { j, dist };
    });
    if (!best) return;
    const k = [i, best.j].sort((x, y) => x - y).join('-');
    if (pairs.has(k)) return;
    const b = pts[best.j];
    const need = plantGap(a.pl, b.pl);
    const bad = best.dist < need * 0.85;
    if (bad) tight++;
    pairs.set(k, true);
    const mxp = (X(a.mx) + X(b.mx)) / 2;
    const myp = (Y(a.my) + Y(b.my)) / 2;
    parts.push(`<line class="ts-dist${bad ? ' bad' : ''}" x1="${X(a.mx)}" y1="${Y(a.my)}" x2="${X(b.mx)}" y2="${Y(b.my)}"/>`,
      `<text class="ts-dt${bad ? ' bad' : ''}" x="${mxp}" y="${myp - 3}" text-anchor="middle">${Math.round(best.dist * 100)}${bad ? `/${Math.round(need * 100)}` : ''}</text>`);
  });
  for (const p of pts) {
    parts.push(`<circle class="ts-dot" cx="${X(p.mx)}" cy="${Y(p.my)}" r="7"/><text class="ts-num" x="${X(p.mx)}" y="${Y(p.my) + 3.5}" text-anchor="middle">${num.get(p.pl.key)}</text>`);
  }
  // Размеры клумбы и масштаб
  parts.push(`<text class="ts-dim" x="${L + Wp / 2}" y="${T - 10}" text-anchor="middle">${Math.round(w * 100)} см — задний край</text>`,
    `<text class="ts-dim" x="${L + Wp / 2}" y="${T + Dp + 18}" text-anchor="middle">передний край, к дорожке</text>`,
    `<text class="ts-dim" x="${L - 10}" y="${T + Dp / 2}" text-anchor="middle" transform="rotate(-90 ${L - 10} ${T + Dp / 2})">${Math.round(d * 100)} см</text>`,
    `<line class="ts-scale" x1="${L}" y1="${T + Dp + 34}" x2="${L + s}" y2="${T + Dp + 34}"/><text class="ts-dim" x="${L + s + 6}" y="${T + Dp + 38}">1 м · сетка 50 см</text>`);
  const H = T + Dp + 46;
  return { svg: `<svg class="top-scheme" viewBox="0 0 ${L * 2 + Wp} ${H}" role="img" aria-label="Схема посадки, вид сверху">${parts.join('')}</svg>`, legend, tight };
}

/** Точки посадки внутри клумбы — там же, где растения стоят на рисунке композиции. */
export function bedLayout(item, rows) {
  const t = rad(item.rot || 0);
  return plantSpots(rows).map((sp) => {
    const [bx, by] = bedXY(sp, item.w, item.d);
    const lx = bx - item.w / 2;
    const ly = by - item.d / 2;
    return { key: sp.key, x: item.x + lx * Math.cos(t) + ly * Math.sin(t), y: item.y - lx * Math.sin(t) + ly * Math.cos(t) };
  });
}

