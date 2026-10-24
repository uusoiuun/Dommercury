// Смета материалов по эскизному проекту — по образцу сметы одноэтажного дома 12×9 м.
// Цены — ориентировочные для Якутска (2025–2026), их можно поменять на странице.

const rad = (d) => (d * Math.PI) / 180;
const up = (n, step = 1) => Math.ceil(n / step - 1e-9) * step;
const r2 = (n) => Math.round(n * 100) / 100;

// Цены по умолчанию, руб. за единицу
export const PRICES = {
  gravel: 2700, sandBulk: 1390, boardFormwork: 24000, board13: 29000, rebar: 68000, stirrup: 55,
  concreteB22: 12200, concreteB15: 11500, concreteB20: 11900, geotextile: 8500, mesh: 135, xps: 7048, cpr: 11100,
  pileBored: 9500, pileDriven: 32000, pileScrew: 4800, pileBoring: 2500,
  beam150: 31000, larch: 31000, profBrus: 34500, log: 30000, ecoshelter: 32, spring: 190, shrinkScrew: 1650,
  frameStud: 31000, osb: 1450, gkl: 650, minwool: 10250, minwoolFacade: 11500, eps: 7000,
  sip: 9800, aeroblock: 820, blockGlue: 650, brick: 32000, mortar: 9500,
  membraneAQ: 12110, membraneRS: 5040, membraneRF: 10220, membraneB: 3080, ventLath: 29000, cladding: 1250, eurolining: 1550,
  metalTile: 790, ridge: 1300, endPlate: 555, roofScrew: 3.5, valley: 1500, snowGuard: 2200, sawdust: 2500,
  windowBase: 8000, windowM2: 10000, doorInterior: 18000, doorEntry: 70000, sealant: 405, foam: 670,
  laminate: 2000, underlay: 1960, tile: 2500, tileGlue: 720, plinth: 650, threshold: 350, floorPipe: 90,
  gutter: 1450, gutterHolder: 255, gutterJoint: 280, gutterCap: 280, pipe: 1590, pipeHolder: 170, elbow: 580, funnel: 530,
  antiseptic: 2050, fasteners: 30000, other: 30000,
};

/**
 * m — модель из buildModel (project.js). Возвращает разделы со строками:
 * { key, work, name, qty, unit, price (ключ цены), note }.
 */
export function buildEstimate(m) {
  const S = [];
  const sec = (title) => { const s = { title, rows: [] }; S.push(s); return s; };
  const row = (s, work, name, qty, unit, price, note = '') => s.rows.push({ work, name, qty: Math.max(0, r2(qty)) || 0, unit, price, note });
  const W = m.W;
  const D = m.D;
  const perim = 2 * (W + D);
  const inner = 2 * D; // несущие стены по осям 2 и 3
  const winA = m.floors.reduce((s, f) => s + f.geo.windows.reduce((a, w) => a + w.len * w.h, 0), 0);
  const doorsIn = m.floors.reduce((s, f) => s + (f.geo.leafs || 0), 0);
  const wallA = perim * m.wallTop - winA - 2.1;
  const roofArea = 2 * (m.along + 2 * m.overhang) * ((m.span / 2 + m.overhang) / Math.cos(rad(m.pitch)));
  const area = W * D;

  // 1. Фундамент
  const f = sec('Фундамент');
  if (m.foundation === 'strip') {
    const b = m.mat.heavy ? 0.5 : 0.4;
    const len = perim + inner;
    const vol = len * b * 0.7;
    row(f, 'Устройство основания', 'Щебёночно-песчаная смесь (с доставкой)', up(len * (b + 0.4) * 0.3 * 1.2), 'м³', 'gravel');
    row(f, 'Устройство опалубки', 'Доски обрезные 25×150, длина 6 м (4 сорт)', r2(len * 2 * 0.8 * 0.025 * 1.1), 'м³', 'boardFormwork');
    row(f, 'Вязка арматурного каркаса', 'Арматура А500С Ø 12 мм', r2((len * 4 * 0.888 * 1.1) / 1000), 'т', 'rebar');
    row(f, '', 'Хомуты Ø 8 мм, шаг 350 мм', up(len / 0.35), 'шт', 'stirrup', 'шаг 350 мм');
    row(f, 'Укладка бетонной смеси', 'Бетон B22,5 (М300) с доставкой', up(vol + 1), 'м³', 'concreteB22', 'с запасом 1 м³');
    row(f, '', 'Геотекстиль 100 м²', up((len * 1.2) / 100), 'рулон', 'geotextile');
    row(f, 'Утепление ленты и отмостки', 'ЭППС 50 мм', r2((len * 0.7 + (perim + 8) * 1) * 0.1), 'м³', 'xps');
    row(f, 'Устройство отмостки толщиной 100 мм', 'Бетон B15 (М200) с доставкой', up((perim + 4) * 1 * 0.1 + 1), 'м³', 'concreteB15', 'с запасом 1 м³');
    row(f, '', 'Кладочная сетка 100×100×4', up((perim + 4) * 1), 'м²', 'mesh');
  } else if (m.foundation === 'slab') {
    const vol = (W + 0.6) * (D + 0.6) * 0.25 + (perim + inner) * 0.12;
    row(f, 'Устройство основания', 'Песок для подушки 300 мм с уплотнением', up((W + 1.6) * (D + 1.6) * 0.3 * 1.2), 'м³', 'sandBulk');
    row(f, '', 'Щебень фракции 20–40, 150 мм', up((W + 1.6) * (D + 1.6) * 0.15 * 1.1), 'м³', 'gravel');
    row(f, 'Утепление под плитой и «юбка»', 'ЭППС 50 мм (3 слоя под плитой)', r2((W + 0.6) * (D + 0.6) * 0.15 + (perim + 4) * 1.2 * 0.1), 'м³', 'xps');
    row(f, 'Устройство опалубки', 'Доски обрезные 25×150 (4 сорт)', r2((perim + 2.4) * 0.4 * 0.025 * 1.2), 'м³', 'boardFormwork');
    row(f, 'Армирование плиты', 'Арматура А500С Ø 12 мм, сетки 200×200 в два ряда', r2((((W + 0.6) / 0.2 * (D + 0.6) + (D + 0.6) / 0.2 * (W + 0.6)) * 2 * 0.888 * 1.08) / 1000), 'т', 'rebar');
    row(f, 'Бетонирование плиты', 'Бетон B20 (М250) с доставкой', up(vol + 1), 'м³', 'concreteB20', 'с запасом 1 м³');
    row(f, '', 'Геотекстиль 100 м²', up(((W + 2) * (D + 2)) / 100), 'рулон', 'geotextile');
  } else {
    const step = m.mat.heavy ? 1.8 : m.foundation === 'screw' ? 2 : 2.5;
    const n = Math.round((perim + inner) / step) + 4;
    if (m.foundation === 'screw') {
      row(f, 'Монтаж винтовых свай', 'Свая винтовая Ø 108, L = 3 м, с оголовком', n, 'шт', 'pileScrew');
      row(f, 'Обвязка', 'Брус 200×200 лиственница', r2((perim + inner) * 0.2 * 0.2 * 1.1), 'м³', 'larch');
    } else {
      const L = m.cl.permafrost ? 8 : 4;
      if (m.foundation === 'driven') row(f, 'Погружение свай в лидерные скважины', `Свая ж/б 300×300, L = ${L} м`, n, 'шт', 'pileDriven', 'длина — по расчёту');
      else row(f, 'Устройство буронабивных свай', `Арматурный каркас и бетон на сваю Ø 300, L = ${L} м`, n, 'шт', 'pileBored', 'длина — по расчёту');
      row(f, 'Бурение скважин', `Скважина Ø 300–400, глубина ${L} м`, n * L, 'п.м.', 'pileBoring');
      row(f, 'Ростверк', 'Бетон B22,5 (М300) с доставкой', up((perim + inner) * 0.16 + (m.foundation === 'piles' ? n * 0.071 * L : 0) + 1), 'м³', 'concreteB22', 'с запасом 1 м³');
      row(f, '', 'Арматура А500С Ø 12 мм', r2(((perim + inner) * 4 * 0.888 * 1.1 + (m.foundation === 'piles' ? n * L * 4 * 0.888 : 0)) / 1000), 'т', 'rebar');
      row(f, 'Опалубка ростверка', 'Доски обрезные 25×150 (4 сорт)', r2((perim + inner) * 2 * 0.5 * 0.025 * 1.1), 'м³', 'boardFormwork');
    }
    row(f, 'Цокольное перекрытие', `Балки брус 150×200, шаг 600`, r2((Math.floor(D / 0.6) + 1) * W * 0.15 * 0.2 * 1.05), 'м³', 'beam150');
    row(f, '', `Минвата ${Math.round(m.floor.d * 1000)} мм`, r2(area * m.floor.d * 1.05), 'м³', 'minwool');
    row(f, '', 'Подшивка снизу и черновой пол: доска 25 мм', r2(area * 2 * 0.025 * 1.1), 'м³', 'board13');
    row(f, '', 'Ветрозащита Изоспан AQ proff 70 м²', up((area * 1.15) / 70), 'рулон', 'membraneAQ');
    row(f, 'Забирка цоколя с продухами', 'Доска / профлист по каркасу', r2(perim * m.plinth * 0.025 * 1.2), 'м³', 'board13');
  }
  if (onGroundF(m.foundation)) {
    row(f, 'Стяжка с тёплым полом 80 мм', 'Цементно-песчаный раствор М200', up(area * 0.08 + 1), 'м³', 'cpr', 'с запасом 1 м³');
    row(f, '', 'Трубы тёплого пола Ø 16', up(area * 6.5), 'п.м.', 'floorPipe');
    row(f, '', 'Кладочная сетка 100×100×4', up(area * 1.05), 'м²', 'mesh');
  }
  row(f, '', 'Гвозди, вязальная проволока и т. п.', 1, 'компл.', 'other', 'примерные затраты');

  // 2. Короб: стены, перекрытие, кровля
  const k = sec('Короб');
  const rows = Math.round(m.wallTop / 0.15);
  if (m.material === 'brus' || m.material === 'log') {
    const base = m.mat.layers[0][1];
    row(k, 'Первый венец', 'Брус 180×200 лиственница', r2(perim * 0.18 * 0.2 * 1.1), 'м³', 'larch');
    row(k, 'Стены', m.material === 'brus' ? 'Брус профилированный 200×200 (сосна)' : 'Бревно оцилиндрованное Ø 260 мм', r2(wallA * base * 1.08), 'м³', m.material === 'brus' ? 'profBrus' : 'log', 'с запасом 8 %');
    row(k, 'Межвенцовое утепление', 'Экошелтер / джут, ширина 15 см', up(perim * rows * 1.05, 100), 'п.м.', 'ecoshelter');
    row(k, 'Сборка', 'Пружинные узлы «Сила»', up((perim * rows) / 1.7, 100), 'шт', 'spring');
    row(k, 'Устройство стоек', 'Усадочный винт', 8, 'шт', 'shrinkScrew');
  } else if (m.material === 'frame') {
    row(k, 'Нижняя обвязка', 'Брус 150×150 лиственница', r2((perim + inner) * 0.15 * 0.15 * 1.1), 'м³', 'larch');
    row(k, 'Каркас стен', 'Стойки и обвязки 50×200 (сосна)', r2(((perim / 0.6 + 16) * m.wallTop + perim * 3) * 0.05 * 0.2 * 1.1), 'м³', 'frameStud');
    row(k, 'Обшивка', 'ОСП-3 12 мм 2500×1250', up((wallA / 3.125) * 1.1), 'лист', 'osb');
    row(k, 'Утепление каркаса', 'Минвата 200 мм', r2(wallA * 0.2 * 1.05), 'м³', 'minwool');
    row(k, 'Пароизоляция', 'Изоспан B 70 м²', up((wallA * 1.15) / 70), 'рулон', 'membraneB');
    row(k, 'Внутренняя обшивка', 'Гипсокартон 12,5 мм 2500×1200', up((wallA / 3) * 1.1), 'лист', 'gkl');
  } else if (m.material === 'sip') {
    row(k, 'Нижняя обвязка', 'Брус 150×200 лиственница', r2((perim + inner) * 0.15 * 0.2 * 1.1), 'м³', 'larch');
    row(k, 'Монтаж стен', 'СИП-панель 2500×1250×224', up((wallA / 3.125) * 1.1), 'шт', 'sip');
    row(k, '', 'Брус соединительный 50×200', r2((perim / 1.25) * m.wallTop * 0.05 * 0.2 * 1.1), 'м³', 'frameStud');
    row(k, '', 'Монтажная пена', up(wallA / 6), 'баллон', 'foam');
    row(k, 'Внутренняя обшивка', 'Гипсокартон 12,5 мм', up((wallA / 3) * 1.1), 'лист', 'gkl');
  } else if (m.material === 'block') {
    const vol = wallA * 0.4;
    row(k, 'Кладка стен', 'Газобетонный блок D500 600×250×400', up((vol / 0.06) * 1.05), 'шт', 'aeroblock', 'с запасом 5 %');
    row(k, '', 'Клей для газобетона 25 кг', up(vol * 1.2), 'мешок', 'blockGlue');
    row(k, 'Армопояс', 'Бетон B20 с доставкой', up(perim * 0.4 * 0.25 + 0.5), 'м³', 'concreteB20');
    row(k, '', 'Арматура А500С Ø 12 мм', r2((perim * 4 * 0.888 * 1.1) / 1000), 'т', 'rebar');
  } else {
    const vol = wallA * 0.38;
    row(k, 'Кладка стен', 'Кирпич керамический полнотелый', r2((vol * 394 * 1.05) / 1000), 'тыс. шт', 'brick');
    row(k, '', 'Кладочный раствор М150', r2(vol * 0.23), 'м³', 'mortar');
    row(k, '', 'Кладочная сетка 50×50×4', up(wallA * 0.4), 'м²', 'mesh');
  }
  // Перегородки: длина — по плану этажей
  const partL = m.floors.reduce((s, fl) => s + (fl.geo.walls || []).reduce((a, [p, q]) => a + Math.hypot(q[0] - p[0], q[1] - p[1]), 0), 0);
  const partA = partL * m.ceiling;
  if (partL > 0) {
    if (m.material === 'brus' || m.material === 'log') {
      row(k, 'Внутренние стены и перегородки', 'Брус профилированный 140×160 (сосна)', r2(partA * 0.14 * 1.05), 'м³', 'profBrus', `${Math.round(partL)} м перегородок`);
    } else if (m.material === 'block') {
      row(k, 'Перегородки', 'Газобетонный блок D500 600×250×100', up((partA / 0.15) * 1.05), 'шт', 'aeroblock', `${Math.round(partL)} м перегородок`);
      row(k, '', 'Клей для газобетона 25 кг', up(partA * 0.1 * 1.2), 'мешок', 'blockGlue');
    } else if (m.material === 'brick') {
      row(k, 'Перегородки в полкирпича', 'Кирпич керамический полнотелый', r2((partA * 51 * 1.05) / 1000), 'тыс. шт', 'brick', `${Math.round(partL)} м перегородок`);
    } else {
      row(k, 'Каркасные перегородки', 'Стойки и обвязки 50×100 (сосна)', r2(((partL / 0.6 + 4) * m.ceiling + partL * 2) * 0.05 * 0.1 * 1.1), 'м³', 'frameStud', `${Math.round(partL)} м перегородок`);
      row(k, '', 'Минвата 100 мм (звукоизоляция)', r2(partA * 0.1), 'м³', 'minwool');
      row(k, '', 'Гипсокартон 12,5 мм с двух сторон', up(((partA * 2) / 3) * 1.1), 'лист', 'gkl');
    }
  }
  if (m.wall.ins) {
    row(k, 'Утепление фасада', `Минвата фасадная ${Math.round(m.wall.ins * 1000)} мм`, r2(wallA * m.wall.ins * 1.05), 'м³', 'minwoolFacade');
    row(k, '', 'Ветрозащита Изоспан AQ proff 70 м²', up((wallA * 1.15) / 70), 'рулон', 'membraneAQ');
    row(k, 'Вентфасад', 'Брусок 40×50 под облицовку', r2((wallA / 0.6) * 0.04 * 0.05 * 1.1), 'м³', 'ventLath');
    row(k, 'Облицовка', m.mat.finish[m.mat.finish.length - 1][0], up(wallA * 1.1), 'м²', 'cladding');
  }
  const beamN = Math.floor(D / 0.6) + 1;
  row(k, 'Балки чердачного перекрытия', `Брус ${m.beam ? `${m.beam.b}×${m.beam.h}` : '150×200'} (сосна)`, r2(beamN * W * ((m.beam?.b || 150) * (m.beam?.h || 200)) / 1e6 * 1.05), 'м³', 'beam150', 'без запаса');
  row(k, 'Утепление чердачного перекрытия', `Минвата ${Math.round(m.attic.d * 1000)} мм`, r2(area * m.attic.d * 1.05), 'м³', 'minwool');
  row(k, '', 'Пароизоляция Изоспан B 70 м²', up((area * 1.15) / 70), 'рулон', 'membraneB');
  const raftN = (Math.floor(m.along / m.rafterStep) + 1) * 2;
  const raftL = (m.span / 2 + m.overhang) / Math.cos(rad(m.pitch)) + 0.1;
  row(k, 'Стропильная система', `Доска ${m.rafter ? `${m.rafter.b}×${m.rafter.h}` : '50×200'} (1–3 сорт), ${raftN} шт`, r2(raftN * raftL * ((m.rafter?.b || 50) * (m.rafter?.h || 200)) / 1e6 * 1.05), 'м³', 'board13');
  row(k, '', 'Мауэрлат / коньковый прогон 150×150', r2((m.along * 3) * 0.15 * 0.15 * 1.1), 'м³', 'beam150');
  row(k, 'Обрешётка под металлочерепицу', 'Доска 25×100, шаг 350 (4 сорт)', r2(roofArea / 0.35 * 0.025 * 0.1 * 1.1), 'м³', 'boardFormwork');
  row(k, 'Контробрешётка', 'Брусок 50×50', r2((roofArea / m.rafterStep) * 0.05 * 0.05 * 1.1), 'м³', 'ventLath');
  row(k, '', 'Ветрозащита кровли Изоспан AQ proff 70 м²', up((roofArea * 1.15) / 70), 'рулон', 'membraneAQ');
  row(k, 'Кровельное покрытие', 'Металлочерепица 0,5 мм', up(roofArea * 1.12), 'м²', 'metalTile', 'с подрезкой 12 %');
  row(k, '', 'Конёк, длина 2 м', up((m.along + 2 * m.overhang) / 1.9), 'шт', 'ridge');
  row(k, '', 'Торцевая планка, длина 2 м', up((4 * (m.span / 2 + m.overhang)) / Math.cos(rad(m.pitch)) / 1.9), 'шт', 'endPlate');
  row(k, '', 'Кровельные саморезы', up(roofArea * 8, 100), 'шт', 'roofScrew');
  row(k, '', 'Снегозадержатели, 3 м', up((m.along + 2 * m.overhang) / 3) * 2, 'шт', 'snowGuard');
  row(k, 'Карнизы, ветровики, фронтоны', 'Доска обрезная 25×(120–130) (1–3 сорт)', r2(((m.along + 2 * m.overhang) * 2 * 0.6 + m.span * m.span * Math.tan(rad(m.pitch)) / 2) * 0.025 * 1.15), 'м³', 'board13');
  row(k, 'Обработка древесины', 'Антисептик грунтовочный, 10 л', up(area / 15), 'шт', 'antiseptic');
  row(k, '', 'Крепёжные изделия', 1, 'компл.', 'fasteners', 'примерные затраты');

  // 3. Отделка
  const o = sec('Отделка');
  const marks = new Map();
  for (const fl of m.floors) for (const w of fl.geo.windows) {
    const key = `${w.mark}|${Math.round(w.len * 1000)}|${Math.round(w.h * 1000)}`;
    marks.set(key, (marks.get(key) || 0) + 1);
  }
  let first = true;
  for (const [key, n] of [...marks.entries()].sort()) {
    const [mark, wmm, hmm] = key.split('|');
    const a = (Number(wmm) * Number(hmm)) / 1e6;
    o.rows.push({ work: first ? 'Окна' : '', name: `Окно ПВХ ${mark}, 5-камерное, поворотно-откидное, ${wmm}×${hmm} мм`, qty: n, unit: 'шт', price: null, fixed: Math.round(PRICES.windowBase + PRICES.windowM2 * a), priceKey: `win_${wmm}x${hmm}`, note: 'стандартные размеры' });
    first = false;
  }
  row(o, 'Установка дверей', 'Дверь межкомнатная (полотно, короб, добор, наличники, фурнитура) 800×2000', doorsIn, 'шт', 'doorInterior', 'средняя стоимость');
  row(o, '', 'Дверь входная металлическая утеплённая 960×2050', 1, 'шт', 'doorEntry', 'средняя стоимость');
  row(o, 'Монтаж окон', 'Монтажная пена', up((winA + doorsIn * 1.6) / 1.5), 'шт', 'foam');
  row(o, '', 'Герметик силиконовый 300 мл', up(marks.size ? [...marks.values()].reduce((s, x) => s + x, 0) * 1.5 : 2), 'шт', 'sealant');
  const tileA = m.rooms.filter((r) => /tile/.test(floorKindE(r))).reduce((s, r) => s + r.area, 0);
  const lamA = Math.max(0, m.total - tileA);
  row(o, 'Устройство полов', 'Ламинат 33 класс, 8 мм', up(lamA * 1.1), 'м²', 'laminate', 'с запасом 10 %');
  row(o, '', 'Подложка под ламинат, 50 м²', up(lamA / 50), 'рулон', 'underlay');
  row(o, '', 'Плитка керамогранит напольная', up(tileA * 1.1), 'м²', 'tile', 'с запасом 10 %');
  row(o, '', 'Клей плиточный 25 кг', up((tileA * 4.5) / 25), 'шт', 'tileGlue', 'расход 4,5 кг/м²');
  row(o, '', 'Плинтус напольный, 2,5 м', up((m.rooms.reduce((s, r) => s + 2 * ((r.x2 - r.x1) + (r.y2 - r.y1)), 0)) / 2.5), 'шт', 'plinth');
  row(o, '', 'Порожек металлический', doorsIn + 1, 'шт', 'threshold');
  row(o, 'Потолки и обшивка перегородок', 'Евровагонка / ГКЛ под покраску', up((m.total + m.rooms.length * 6) * 1.1), 'м²', 'eurolining', 'с запасом 10 %');
  const gl = m.along + 2 * m.overhang;
  row(o, 'Водосточная система', 'Желоб водосточный, 3 м', up((gl * 2) / 2.9), 'шт', 'gutter');
  row(o, '', 'Держатель желоба', up((gl * 2) / 0.6), 'шт', 'gutterHolder');
  row(o, '', 'Соединитель желоба', up((gl * 2) / 2.9) - 2, 'шт', 'gutterJoint');
  row(o, '', 'Заглушка желоба', 4, 'шт', 'gutterCap');
  row(o, '', 'Труба водосточная, 3 м', 4 * up((m.wallTop + m.plinth) / 3), 'шт', 'pipe');
  row(o, '', 'Держатель трубы', 4 * up(m.wallTop + m.plinth), 'шт', 'pipeHolder');
  row(o, '', 'Колено трубы и сливное', 12, 'шт', 'elbow');
  row(o, '', 'Воронка выпускная', 4, 'шт', 'funnel');
  row(o, '', 'Прочее', 1, 'компл.', 'other', 'примерные затраты');
  return S;
}

function onGroundF(f) { return f === 'strip' || f === 'slab'; }
function floorKindE(r) {
  if (r.wet || /сануз|ванн|туал|постир|котел|котёл|прихож|тамбур|кухн/i.test(r.label) || r.type === 'entry' || r.key === 'kitchen') return 'tile';
  return 'lam';
}

/** Цены и суммы. prices — правки пользователя {ключ: цена}, coef — коэффициент региона. */
export function priceEstimate(sections, prices = {}, coef = 1) {
  let total = 0;
  const out = sections.map((s) => {
    let sum = 0;
    const rows = s.rows.map((r) => {
      const key = r.priceKey || r.price;
      const base = prices[key] ?? (r.fixed ?? PRICES[r.price] ?? 0);
      const unitPrice = Math.round(base * coef * 100) / 100;
      const cost = Math.round(unitPrice * r.qty * 100) / 100;
      sum += cost;
      return { ...r, key, unitPrice, base, cost };
    });
    total += sum;
    return { ...s, rows, sum };
  });
  return { sections: out, total };
}
