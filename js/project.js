// Эскизный проект дома по утверждённой планировке: материалы стен, теплотехника по СП 50,
// подбор стропил и балок, проверка по нормам и листы А4 со штампом по ГОСТ 21.101.
// Всё носит подсказочный характер и не заменяет проект лицензированного проектировщика.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const f1 = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
const mm = (m) => String(Math.round(m * 1000));
const rad = (d) => (d * Math.PI) / 180;

// ---- Климат (СП 131.13330, СП 20.13330) — ориентировочно, уточняйте для своего места ----

export const CLIMATES = {
  yakutsk: { name: 'Якутск', zone: 'IА', tOt: -20.9, zOt: 252, t5: -52, Sg: 1.0, snowReg: 'II', w0: 0.23, windReg: 'I', permafrost: true },
  novosibirsk: { name: 'Новосибирск', zone: 'IВ', tOt: -8.1, zOt: 221, t5: -37, Sg: 2.0, snowReg: 'IV', w0: 0.38, windReg: 'III', permafrost: false },
  moscow: { name: 'Москва', zone: 'IIВ', tOt: -2.2, zOt: 205, t5: -25, Sg: 1.5, snowReg: 'III', w0: 0.23, windReg: 'I', permafrost: false },
};
export const climateByLat = (lat) => (lat >= 58 ? 'yakutsk' : lat >= 52 ? 'novosibirsk' : 'moscow');

// ---- Материалы стен ----
// layers — от помещения наружу: [название, толщина, м, λ, Вт/(м·°С)] (условия эксплуатации Б, СП 50.13330).
// ins — где добавляется утеплитель, если стены не хватает до нормы.

export const MATERIALS = {
  brus: {
    title: 'Профилированный брус', short: 'брус', heavy: false, wood: true, fireDeg: 'IV', fireClass: 'С2',
    about: 'Тёплый и быстрый в сборке. В холодном климате брус утепляют снаружи и закрывают вентфасадом. Дом даёт усадку 3–5 % в первые 1–2 года.',
    layers: [['Брус профилированный 200×200 (сосна, ель)', 0.2, 0.18]],
    ins: 'outside', finish: [['Ветрозащитная мембрана', 0, 0], ['Вентзазор 40 мм', 0, 0], ['Имитация бруса / блок-хаус 20 мм', 0, 0]],
    columns: 'венцы', firstRow: 'Первый венец — брус 200×200 из лиственницы на гидроизоляции',
  },
  log: {
    title: 'Оцилиндрованное бревно', short: 'бревно', heavy: false, wood: true, fireDeg: 'IV', fireClass: 'С2',
    about: 'Классический сруб. Расчётная толщина бревна Ø 260 мм — около 200 мм. Для Севера нужно наружное утепление или бревно большего диаметра.',
    layers: [['Бревно оцилиндрованное Ø 260 мм (расчётная толщина)', 0.2, 0.18]],
    ins: 'outside', finish: [['Ветрозащитная мембрана', 0, 0], ['Вентзазор 40 мм', 0, 0], ['Блок-хаус 36 мм', 0, 0]],
    columns: 'венцы', firstRow: 'Первый венец — из лиственницы на гидроизоляции',
  },
  frame: {
    title: 'Каркасный дом', short: 'каркас', heavy: false, wood: true, fireDeg: 'V', fireClass: 'С3',
    about: 'Самый тёплый при той же толщине и самый быстрый. Стойки 50×200 с шагом 600 мм, утеплитель между стойками и дополнительный слой поперёк.',
    layers: [['Гипсокартон 12,5 мм', 0.0125, 0.21], ['Пароизоляция', 0, 0], ['Каркас 50×200 / минвата 200 мм (с учётом стоек)', 0.2, 0.052], ['ОСП-3 12 мм', 0.012, 0.18]],
    ins: 'outside', finish: [['Ветрозащитная мембрана', 0, 0], ['Вентзазор 40 мм', 0, 0], ['Сайдинг / имитация бруса', 0, 0]],
    columns: 'стойки', firstRow: 'Обвязка — брус 150×150 (лиственница), антисептированный',
  },
  sip: {
    title: 'СИП-панели (ОСП + пенополистирол)', short: 'СИП', heavy: false, wood: true, fireDeg: 'V', fireClass: 'С3',
    about: 'Панели заводского изготовления: ОСП 12 мм + пенополистирол + ОСП 12 мм. Быстро, ровно и тепло. Нужна хорошая вентиляция.',
    layers: [['Гипсокартон 12,5 мм', 0.0125, 0.21], ['СИП-панель: ОСП 12 + ПСБ-С25 200 + ОСП 12', 0.224, 0.045]],
    ins: 'outside', finish: [['Ветрозащитная мембрана', 0, 0], ['Вентзазор 40 мм', 0, 0], ['Сайдинг / фиброцементные панели', 0, 0]],
    columns: 'панели', firstRow: 'Обвязка — брус 150×200 (лиственница), антисептированный',
  },
  block: {
    title: 'Газобетонные блоки', short: 'газобетон', heavy: true, wood: false, fireDeg: 'III', fireClass: 'С0',
    about: 'Негорючий и прочный. Кладка D500 на клею, армопояс под перекрытием. Снаружи минвата и вентфасад — газобетон должен «дышать» наружу.',
    layers: [['Штукатурка гипсовая 15 мм', 0.015, 0.35], ['Газобетон D500 400 мм на клею', 0.4, 0.147]],
    ins: 'outside', finish: [['Ветрозащитная мембрана', 0, 0], ['Вентзазор 40 мм', 0, 0], ['Фиброцементные панели / сайдинг', 0, 0]],
    columns: 'кладка', firstRow: 'Первый ряд — на цементно-песчаном растворе по гидроизоляции',
  },
  brick: {
    title: 'Кирпич керамический', short: 'кирпич', heavy: true, wood: false, fireDeg: 'II', fireClass: 'С0',
    about: 'Самый долговечный и тяжёлый. Сплошная кладка 380 мм сама по себе холодная — обязательно наружное утепление.',
    layers: [['Штукатурка 15 мм', 0.015, 0.7], ['Кирпич керамический полнотелый 380 мм', 0.38, 0.81]],
    ins: 'outside', finish: [['Ветрозащитная мембрана', 0, 0], ['Вентзазор 40 мм', 0, 0], ['Облицовка: фасадные панели / клинкер', 0, 0]],
    columns: 'кладка', firstRow: 'Первый ряд — на цементно-песчаном растворе по гидроизоляции',
  },
};
export const MATERIAL_KEYS = Object.keys(MATERIALS);

export const FOUNDATIONS = {
  piles: { title: 'Сваи буронабивные с ростверком и проветриваемым подпольем', short: 'свайный' },
  strip: { title: 'Монолитная лента, мелкозаглублённая, утеплённая', short: 'ленточный' },
  slab: { title: 'Сплошная монолитная плита, утеплённая', short: 'плитный' },
  screw: { title: 'Винтовые сваи с обвязкой', short: 'винтовые сваи' },
};
const onGround = (f) => f === 'strip' || f === 'slab';

// Сравнение фундаментов: [критерий, лента, плита, сваи]
export const FOUNDATION_COMPARE = [
  ['Устойчивость к неравномерным деформациям', 'Зависит от грунта и конструкции', 'Может хорошо распределять нагрузки', 'Зависит от грунта и расчёта свай'],
  ['Риск морозного пучения', 'Существенный без необходимых мероприятий', 'Существенный без расчётных мероприятий', 'Зависит от конструкции и грунтов'],
  ['Теплоизоляция пола', 'Требует отдельного решения', 'Можно выполнить под плитой', 'Выполняется по перекрытию'],
  ['Устройство тёплого пола', 'Возможно', 'Очень удобно', 'Возможно по перекрытию'],
  ['Расход бетона', 'Обычно меньше, но зависит от конструкции', 'Обычно больше', 'Зависит от количества и типа свай'],
  ['Подходит для мерзлоты', 'Иногда, при обосновании', 'Иногда, при обосновании', 'Часто рассматривается как базовый вариант'],
  ['Ремонт инженерных коммуникаций', 'Зависит от доступа', 'Под плитой доступ ограничен', 'В подполье доступ может быть удобнее'],
];

export const FOUNDATION_WHEN = {
  strip: {
    when: ['грунты достаточно прочные и однородные', 'установлены характеристики грунтов и глубина сезонного промерзания', 'рассчитаны морозное пучение и осадка', 'предусмотрены утепление и водоотведение', 'конструкция соответствует нагрузкам от стен и перекрытий'],
    risk: 'Если лента опирается на неоднородный грунт, а участки основания промерзают по-разному, возможны неравномерные перемещения. В Якутске нельзя просто выкопать траншею, залить ленту и считать вопрос решённым.',
  },
  slab: {
    when: ['грунтовые условия позволяют мелкозаглублённое основание', 'можно обеспечить расчётную подготовку под плитой', 'рассчитаны нагрузки и деформации грунта', 'предусмотрены теплоизоляция и защита от влаги', 'заранее продуманы вводы водопровода, канализации и электричества'],
    risk: 'Плита распределяет нагрузку по большой площади, но не устраняет риск просадки или оттаивания мёрзлого грунта; на неподготовленном основании может деформироваться и треснуть. Для водяного тёплого пола удобна, но это не делает её лучшей для Якутска.',
  },
  piles: {
    when: ['грунтовые условия и геокриологические расчёты требуют сохранить мерзлоту', 'грунты неоднородные или слабые у поверхности', 'нужно проветриваемое подполье и удобный доступ к коммуникациям'],
    risk: 'Длина и несущая способность свай назначаются только по изысканиям и расчёту; подполье нельзя закрывать глухо.',
  },
  screw: {
    when: ['лёгкий дом (каркас, СИП, брус)', 'нет вечной мерзлоты, грунт без крупных включений', 'нужен быстрый монтаж без бетона'],
    risk: 'Не подходят для тяжёлых каменных стен; на мерзлоте применяются только при обосновании расчётом.',
  },
};

// Где строят: от ответа зависит рекомендация
export const SITES = {
  normal: { label: 'В самом Якутске, на участке с обычным грунтом', rec: ['slab', 'strip', 'piles'], note: 'Утеплённая плита или лента возможны, если изыскания подтвердят однородный талый грунт и расчёт пучения. Свайный вариант — запасной.' },
  permafrost: { label: 'В Якутске, но на мерзлоте — по имеющимся данным участка', rec: ['piles'], note: 'На мерзлоте базовый вариант — сваи с проветриваемым подпольем: дом не растапливает грунт под собой (СП 25.13330, принцип I).' },
  suburb: { label: 'В пригороде Якутска (Хатассы, Кангалассы, Маган и др.)', rec: ['piles', 'slab'], note: 'Грунты в пригородах неоднородны, часто есть мерзлота и льдистые прослойки. Сначала сваи; плита — только при подтверждении изысканиями.' },
  unknown: { label: 'Грунт пока неизвестен, геологию ещё не делали', rec: ['piles'], note: 'Без изысканий не стоит заранее назначать ни ленту, ни плиту. В проекте условно принят свайный фундамент — после геологии вариант уточняется.' },
};

const MW = 0.045; // минвата, λ
const R_SURF = 1 / 8.7 + 1 / 23;

/** Градусо-сутки и требуемые сопротивления теплопередаче (СП 50.13330, табл. 3). */
export function thermalNorms(cl) {
  const gsop = (20 - cl.tOt) * cl.zOt;
  return {
    gsop,
    wall: 0.00035 * gsop + 1.4,
    attic: 0.00045 * gsop + 1.9,
    floor: 0.00045 * gsop + 1.9,
    window: 0.00005 * gsop + 0.2,
  };
}

const rOf = (layers) => R_SURF + layers.reduce((s, [, d, l]) => s + (l > 0 ? d / l : 0), 0);

/** Конструкция стены с утеплителем, добавленным шагом 50 мм до нормы. */
export function wallBuildUp(matKey, cl) {
  const m = MATERIALS[matKey];
  const need = thermalNorms(cl).wall;
  let ins = 0;
  const layers = () => [...m.layers, ...(ins ? [[`Минераловатный утеплитель ${Math.round(ins * 1000)} мм (λ = 0,045)`, ins, MW]] : []), ...m.finish];
  while (rOf(layers()) < need && ins < 0.4) ins += 0.05;
  const all = layers();
  const R = rOf(all);
  const thick = all.reduce((s, [, d]) => s + d, 0) + 0.06; // + вентзазор и облицовка
  return { layers: all, R, need, ok: R >= need, ins, thick };
}

/** Чердачное перекрытие и пол: утеплитель (минвата / ЭППС) до нормы. */
export function slabBuildUp(kind, cl, foundation) {
  const n = thermalNorms(cl);
  const need = kind === 'attic' ? n.attic : n.floor;
  if (kind === 'attic') {
    let d = 0.1;
    const base = [['Потолок: доска / гипсокартон', 0.025, 0.18], ['Пароизоляция', 0, 0]];
    while (rOf([...base, ['Минвата', d, MW]]) < need && d < 0.6) d += 0.05;
    return { need, R: rOf([...base, ['Минвата', d, MW]]), d, layers: [...base, [`Минераловатный утеплитель ${Math.round(d * 1000)} мм`, d, MW], ['Ветрозащита', 0, 0], ['Ходовой настил по балкам', 0, 0]] };
  }
  if (onGround(foundation)) {
    let d = 0.1;
    const base = [['Ламинат / плитка', 0.01, 0.2], ['Стяжка ЦПР М200 с тёплым полом 80 мм', 0.08, 0.93]];
    while (rOf([...base, ['ЭППС', d, 0.034]]) < need && d < 0.4) d += 0.05;
    return { need, R: rOf([...base, ['ЭППС', d, 0.034]]), d, layers: [...base, ['Гидроизоляция', 0, 0], [`Экструдированный пенополистирол ${Math.round(d * 1000)} мм`, d, 0.034], ['Песок 300 мм, щебень, геотекстиль', 0, 0]] };
  }
  let d = 0.1;
  const base = [['Ламинат / плитка', 0.01, 0.2], ['Черновой пол: ОСП 18 мм', 0.018, 0.18], ['Пароизоляция', 0, 0]];
  while (rOf([...base, ['Минвата', d, MW]]) < need && d < 0.5) d += 0.05;
  return { need, R: rOf([...base, ['Минвата', d, MW]]), d, layers: [...base, [`Минераловатный утеплитель ${Math.round(d * 1000)} мм между балками`, d, MW], ['Ветрозащитная мембрана', 0, 0], ['Подшивка снизу: доска / ЦСП', 0, 0]] };
}

// ---- Подбор сечений (СП 64.13330, СП 20.13330) — упрощённо, как подсказка ----

const R_BEND = 13; // МПа, сосна 2 сорта, изгиб
const E_WOOD = 10000; // МПа
const RAFTERS = [[50, 150], [50, 200], [50, 250], [75, 200], [100, 200], [100, 250]];
const BEAMS = [[100, 150], [100, 200], [150, 180], [150, 200], [150, 250], [200, 250]];

/** Однопролётная балка: q — расчётная нагрузка, кПа; шаг, пролёт — м. */
export function pickSection(list, spanM, qKpa, stepM, limit = 200) {
  const L = spanM * 1000;
  const q = qKpa * stepM; // Н/мм
  for (const [b, h] of list) {
    const M = (q * L * L) / 8;
    const sigma = M / ((b * h * h) / 6);
    const fl = (5 * (q / 1.3) * L ** 4) / (384 * E_WOOD * ((b * h ** 3) / 12));
    if (sigma <= R_BEND && fl <= L / limit) return { b, h, sigma, f: fl };
  }
  return null;
}

export function roofLoad(cl, pitch) {
  const mu = pitch <= 30 ? 1 : pitch >= 60 ? 0 : (60 - pitch) / 30;
  const S0 = cl.Sg * mu;
  return { mu, S0, q: S0 * 1.4 + 0.5 * 1.1 };
}

// ---- Модель здания ----

/**
 * p: { floors: [{title, geo, planSvg, furnSvg}], material, foundation, climate (объект), ceiling, pitch, overhang, place }
 */
export function buildModel(p) {
  const g = p.floors[0].geo;
  const W = g.W;
  const D = g.D;
  const cl = p.climate;
  const wall = wallBuildUp(p.material, cl);
  const attic = slabBuildUp('attic', cl);
  const floor = slabBuildUp('floor', cl, p.foundation);
  const nF = p.floors.length;
  const slab = 0.35;
  const floorBuild = 0.12;
  const storey = p.ceiling + slab + floorBuild;
  const wallTop = nF * storey - floorBuild;
  const ridgeAlongX = W >= D;
  const span = ridgeAlongX ? D : W;
  const along = ridgeAlongX ? W : D;
  const pitch = p.pitch;
  const ovh = p.overhang;
  const ridge = wallTop + (span / 2) * Math.tan(rad(pitch));
  const plinth = p.foundation === 'slab' ? 0.35 : p.foundation === 'strip' ? 0.6 : cl.permafrost ? 1.2 : 0.7;
  const load = roofLoad(cl, pitch);
  const halfSpan = span / 2;
  let rafter = pickSection(RAFTERS, halfSpan, load.q, 0.6);
  let rafterStep = 0.6;
  let strut = false;
  if (!rafter) { rafter = pickSection(RAFTERS, halfSpan, load.q, 0.4); rafterStep = 0.4; }
  if (!rafter) { rafter = pickSection(RAFTERS, halfSpan / 2 + 0.3, load.q, 0.6); rafterStep = 0.6; strut = true; }
  const beamSpan = W / 3;
  const beamQ = 1.2 * 0.7 + 1.1 * (0.3 + attic.d * 0.5);
  const beam = pickSection(BEAMS, beamSpan, beamQ, 0.6, 250);
  const rooms = p.floors.flatMap((f, i) => f.geo.rooms.map((r) => ({ ...r, floor: i + 1 })));
  const living = rooms.filter((r) => r.type === 'bedroom' || ['lounge'].includes(r.type) || /спальн|детск|гостин|кабинет/i.test(r.label));
  const total = rooms.reduce((s, r) => s + r.area, 0);
  const livingA = living.reduce((s, r) => s + r.area, 0);
  return {
    ...p, W, D, cl, wall, attic, floor, nF, storey, wallTop, ridgeAlongX, span, along, ridge, plinth, load, rafter, rafterStep, strut, beam, beamSpan, beamQ,
    norms: thermalNorms(cl), rooms, total, livingA, mat: MATERIALS[p.material],
    footprint: (W + 2 * wall.thick * 0) * D,
  };
}

// ---- Проверка по нормам ----

export function normChecks(m) {
  const out = [];
  const add = (ok, title, text, norm) => out.push({ ok, title, text, norm });
  const highReq = ['IА', 'IБ', 'IГ', 'IД', 'IVА'].includes(m.cl.zone) ? 2.7 : 2.5;
  add(m.ceiling >= highReq, 'Высота помещений', `Принято ${f2(m.ceiling)} м от пола до потолка, нужно не меньше ${f1(highReq)} м${highReq > 2.5 ? ` для климатического района ${m.cl.zone}` : ''}.`, 'СП 55.13330.2016');
  for (const r of m.rooms) {
    const l = r.label.toLowerCase();
    if (r.key === 'kitchen' || /кухн/.test(l)) add(r.area >= 6, `Кухня: ${esc(r.label)}`, `${f2(r.area)} м², нужно не меньше 6 м².`, 'СП 55.13330.2016');
    if ((r.key === 'kitchen' && /гостин/.test(l)) || /гостин|общая/.test(l)) add(r.area >= 12, `Общая комната: ${esc(r.label)}`, `${f2(r.area)} м², нужно не меньше 12 м².`, 'СП 55.13330.2016');
    if (r.type === 'bedroom' || /спальн|детск/.test(l)) add(r.area >= 8, `Спальня: ${esc(r.label)}`, `${f2(r.area)} м², нужно не меньше 8 м² (на двоих — 10 м²).`, 'СП 55.13330.2016');
    if (r.key === 'boiler' || /котельн/.test(l)) {
      const vol = r.area * m.ceiling;
      add(vol >= 7.5, 'Котельная', `Объём ${f1(vol)} м³ (для газового котла до 30 кВт — не меньше 7,5 м³). Окно с форточкой и приток воздуха обязательны, дверь — с решёткой или зазором внизу.`, 'СП 402.1325800.2018');
    }
  }
  // Освещённость: площадь окон к полу жилых комнат и кухни — ориентир 1:8…1:5,5
  for (const f of m.floors) {
    for (const r of f.geo.rooms) {
      if (!(r.type === 'bedroom' || r.key === 'kitchen' || r.type === 'office' || r.type === 'lounge')) continue;
      const wins = f.geo.windows.filter((w) => {
        const mx = (w.a[0] + w.b[0]) / 2;
        const my = (w.a[1] + w.b[1]) / 2;
        return mx >= r.x1 - 0.2 && mx <= r.x2 + 0.2 && my >= r.y1 - 0.2 && my <= r.y2 + 0.2;
      });
      const wa = wins.reduce((s, w) => s + w.len * w.h, 0);
      const ratio = wa / Math.max(1, r.area);
      add(ratio >= 1 / 8, `Свет: ${esc(r.label)}`, wa ? `Окна ${f2(wa)} м² на ${f2(r.area)} м² пола — 1:${f1(1 / ratio)} (ориентир от 1:8 до 1:5,5).` : 'Нет окна — для жилой комнаты и кухни окно обязательно.', 'СП 55.13330, СП 52.13330');
    }
  }
  add(m.wall.ok, 'Теплозащита стен', `R = ${f2(m.wall.R)} м²·°С/Вт при норме ${f2(m.wall.need)}${m.wall.ins ? ` — с утеплителем ${Math.round(m.wall.ins * 1000)} мм` : ''}.`, 'СП 50.13330.2012');
  add(m.attic.R >= m.attic.need, 'Теплозащита чердачного перекрытия', `R = ${f2(m.attic.R)} при норме ${f2(m.attic.need)}: минвата ${Math.round(m.attic.d * 1000)} мм.`, 'СП 50.13330.2012');
  add(m.floor.R >= m.floor.need, 'Теплозащита пола', `R = ${f2(m.floor.R)} при норме ${f2(m.floor.need)}: утеплитель ${Math.round(m.floor.d * 1000)} мм.`, 'СП 50.13330.2012');
  add(!!m.rafter && !m.strut, 'Стропила', m.rafter ? `${m.rafter.b}×${m.rafter.h} мм с шагом ${Math.round(m.rafterStep * 1000)} мм на снеговую нагрузку ${f1(m.cl.Sg)} кПа${m.strut ? '; нужны подкосы или стойки на внутреннюю стену' : ''}.` : 'Сечение не подобрано — нужен расчёт.', 'СП 20.13330, СП 64.13330');
  add(!!m.beam && m.beamSpan <= 6, 'Балки чердачного перекрытия', m.beam ? `${m.beam.b}×${m.beam.h} мм, пролёт ${f1(m.beamSpan)} м между несущими стенами по осям, шаг 600 мм.` : `Пролёт ${f1(m.beamSpan)} м слишком большой — нужны промежуточные опоры.`, 'СП 64.13330.2017');
  const site = SITES[m.site] ? m.site : null;
  if (site) {
    const okF = SITES[site].rec.includes(m.foundation);
    add(okF, 'Фундамент и участок', okF ? `${FOUNDATIONS[m.foundation].title} подходит для варианта «${SITES[site].label}» — при подтверждении изысканиями.` : `Для варианта «${SITES[site].label}» рекомендуются: ${SITES[site].rec.map((k) => FOUNDATIONS[k].short).join(', ')}. ${SITES[site].note}`, 'СП 22.13330, СП 25.13330');
  } else if (m.cl.permafrost) add(m.foundation === 'piles', 'Фундамент на мерзлоте', m.foundation === 'piles' ? 'Сваи с проветриваемым подпольем сохраняют мерзлоту под домом (принцип I).' : 'В районе распространения мерзлоты лента и плита возможны только при обосновании изысканиями и расчётом.', 'СП 25.13330.2020');
  if (onGround(m.foundation)) add(null, 'Изыскания для ленты или плиты', 'Нужны характеристики грунтов, глубина промерзания и расчёт морозного пучения и осадки; утепление и водоотведение обязательны.', 'СП 22.13330, СП 47.13330');
  if (m.mat.heavy && m.foundation === 'screw') add(false, 'Фундамент и стены', 'Винтовые сваи не подходят для тяжёлых каменных стен — выберите буронабивные сваи или ленту.', 'СП 24.13330, СП 22.13330');
  const hasVest = m.rooms.some((r) => /тамбур/i.test(r.label));
  if (m.cl.t5 <= -25) add(hasVest, 'Тамбур у входа', hasVest ? 'Есть тамбур — меньше холода при входе.' : 'При морозах ниже −25 °С у входа нужен тамбур.', 'СП 55.13330, СП 50.13330');
  add(null, 'Пожарные расстояния', `Степень огнестойкости ${m.mat.fireDeg}, класс конструктивной пожарной опасности ${m.mat.fireClass}. Расстояние до соседних домов — от 6 до 15 м в зависимости от материалов.`, 'СП 4.13130.2013');
  return out;
}

// ---- Листы ----

const SHEET = { w: 210, h: 297, fx: 20, fy: 5, fw: 185, fh: 287 };
const AREA = { x: 26, y: 12, w: 174, h: 222 };

function titleBlock(meta, n, total, sheetTitle) {
  const x0 = 20;
  const y0 = 237;
  const L = (x1, y1, x2, y2, w = 0.35) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${w}"/>`;
  const T = (x, y, s, size = 2.5, a = 'start') => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${a}" class="sh-t">${s}</text>`;
  const parts = [`<rect x="${x0}" y="${y0}" width="185" height="55" fill="#fff" stroke="#000" stroke-width="0.7"/>`];
  const cols = [7, 10, 10, 10, 15, 10];
  let cx = x0;
  for (const c of cols) { cx += c; parts.push(L(cx, y0, cx, y0 + 55, cx === x0 + 62 ? 0.7 : 0.25)); }
  for (let r = 1; r < 11; r++) parts.push(L(x0, y0 + r * 5, x0 + 62, y0 + r * 5, r === 5 ? 0.6 : 0.25));
  const head = ['Изм.', 'Кол.уч', 'Лист', '№док.', 'Подпись', 'Дата'];
  cx = x0;
  head.forEach((h, i) => { parts.push(T(cx + cols[i] / 2, y0 + 24, h, 2, 'middle')); cx += cols[i]; });
  const roles = [['Разраб.', 'Дом Меркурий', meta.year], ['Пров.', '', ''], ['', '', ''], ['Н. контр.', '', ''], ['Утв.', '', '']];
  roles.forEach(([r, who, d], i) => {
    parts.push(T(x0 + 1, y0 + 29 + i * 5, r, 2));
    if (who) parts.push(T(x0 + 18, y0 + 29 + i * 5, who, 1.9));
    if (d) parts.push(T(x0 + 57, y0 + 29 + i * 5, d, 2, 'middle'));
  });
  // Правая часть
  const rx = x0 + 62;
  parts.push(L(rx, y0 + 15, x0 + 185, y0 + 15, 0.6), L(rx, y0 + 40, x0 + 185, y0 + 40, 0.6), L(rx + 70, y0 + 15, rx + 70, y0 + 55, 0.6));
  parts.push(L(rx + 70, y0 + 20, x0 + 185, y0 + 20, 0.25), L(rx + 85, y0 + 15, rx + 85, y0 + 25, 0.25), L(rx + 100, y0 + 15, rx + 100, y0 + 25, 0.25), L(rx + 70, y0 + 25, x0 + 185, y0 + 25, 0.25));
  parts.push(T(rx + 61.5, y0 + 6.5, esc(meta.project), 3, 'middle'), T(rx + 61.5, y0 + 11.5, esc(meta.sub), 2.5, 'middle'));
  parts.push(T(rx + 35, y0 + 29, 'Жилой дом', 3.2, 'middle'));
  parts.push(T(rx + 77.5, y0 + 18.8, 'Стадия', 2, 'middle'), T(rx + 92.5, y0 + 18.8, 'Лист', 2, 'middle'), T(rx + 112, y0 + 18.8, 'Листов', 2, 'middle'));
  parts.push(T(rx + 77.5, y0 + 23.8, 'ЭП', 2.8, 'middle'), T(rx + 92.5, y0 + 23.8, String(n), 2.8, 'middle'), T(rx + 112, y0 + 23.8, String(total), 2.8, 'middle'));
  parts.push(T(rx + 96.5, y0 + 33, 'Примерный проект.', 2.2, 'middle'), T(rx + 96.5, y0 + 36.5, 'Носит подсказочный характер', 2, 'middle'));
  const words = sheetTitle.length > 42 ? [sheetTitle.slice(0, sheetTitle.lastIndexOf(' ', 42)), sheetTitle.slice(sheetTitle.lastIndexOf(' ', 42) + 1)] : [sheetTitle];
  words.forEach((w, i) => parts.push(T(rx + 35, y0 + 48 + (i - (words.length - 1) / 2) * 4, esc(w), 2.8, 'middle')));
  parts.push(T(rx + 96.5, y0 + 49, 'Дом Меркурий', 3.2, 'middle'));
  return parts.join('');
}

export function sheetSvg(body, meta, n, total, title, cover = false) {
  return `<svg class="sheet" viewBox="0 0 210 297" xmlns="http://www.w3.org/2000/svg">`
    + '<rect x="0" y="0" width="210" height="297" fill="#fff"/>'
    + `<rect x="${SHEET.fx}" y="${SHEET.fy}" width="${SHEET.fw}" height="${SHEET.fh}" fill="none" stroke="#000" stroke-width="0.7"/>`
    + body + (cover ? '' : titleBlock(meta, n, total, title)) + '</svg>';
}

// Вид в метрах: x вправо, y вверх → мм листа
function view(wm, hm, box = AREA, pad = 18) {
  const scales = [20, 25, 50, 75, 100, 150, 200, 250, 300, 400];
  let sc = scales.find((s) => (wm * 1000) / s <= box.w - 2 * pad && (hm * 1000) / s <= box.h - 2 * pad) || 500;
  const k = 1000 / sc;
  const ox = box.x + (box.w - wm * k) / 2;
  const oy = box.y + (box.h + hm * k) / 2;
  return { k, sc, X: (x) => ox + x * k, Y: (y) => oy - y * k };
}

const ln = (x1, y1, x2, y2, cls = 'sh-l') => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const tx = (x, y, s, size = 3, a = 'start', extra = '') => `<text class="sh-t" x="${x}" y="${y}" font-size="${size}" text-anchor="${a}" ${extra}>${s}</text>`;
const tick = (x, y) => `<line class="sh-tick" x1="${x - 1}" y1="${y + 1}" x2="${x + 1}" y2="${y - 1}"/>`;
const heading = (s) => tx(AREA.x, 19, s, 5);

function chainH(v, xs, yMm, fromMm) {
  const pts = xs.map(v.X);
  const parts = [ln(pts[0] - 2, yMm, pts[pts.length - 1] + 2, yMm, 'sh-dim')];
  pts.forEach((p) => parts.push(ln(p, fromMm, p, yMm + (yMm > fromMm ? 1.5 : -1.5), 'sh-dim'), tick(p, yMm)));
  for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > 0.05) parts.push(tx((pts[i] + pts[i - 1]) / 2, yMm - 1, mm(xs[i] - xs[i - 1]), 2.4, 'middle'));
  return parts.join('');
}
function chainV(v, ys, xMm, fromMm) {
  const pts = ys.map(v.Y);
  const parts = [ln(xMm, pts[0] + 2, xMm, pts[pts.length - 1] - 2, 'sh-dim')];
  pts.forEach((p) => parts.push(ln(fromMm, p, xMm + (xMm > fromMm ? 1.5 : -1.5), p, 'sh-dim'), tick(xMm, p)));
  for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > 0.05) {
    const my = (pts[i] + pts[i - 1]) / 2;
    parts.push(tx(xMm - 1, my, mm(ys[i] - ys[i - 1]), 2.4, 'middle', `transform="rotate(-90 ${xMm - 1} ${my})"`));
  }
  return parts.join('');
}
const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
function axesMarks(v, W, D, { bottom = true, left = true } = {}) {
  const xs = [0, W / 3, (2 * W) / 3, W];
  const ys = [0, D / 3, (2 * D) / 3, D];
  const parts = [];
  if (bottom) xs.forEach((x, i) => parts.push(ln(v.X(x), v.Y(0) + 2, v.X(x), v.Y(0) + 24, 'sh-axis'), `<circle class="sh-bub" cx="${v.X(x)}" cy="${v.Y(0) + 27}" r="3"/>`, tx(v.X(x), v.Y(0) + 28.1, String(i + 1), 3, 'middle')));
  if (left) ys.forEach((y, i) => parts.push(ln(v.X(0) - 2, v.Y(y), v.X(0) - 24, v.Y(y), 'sh-axis'), `<circle class="sh-bub" cx="${v.X(0) - 27}" cy="${v.Y(y)}" r="3"/>`, tx(v.X(0) - 27, v.Y(y) + 1.1, LETTERS[i], 3, 'middle')));
  return parts.join('');
}
function outlineRect(v, W, D, cls = 'sh-thick') {
  return `<rect class="${cls}" x="${v.X(0)}" y="${v.Y(D)}" width="${W * v.k}" height="${D * v.k}"/>`;
}
function level(x, y, text, right = true) {
  const d = right ? 1 : -1;
  return `<path class="sh-l" d="M${x} ${y} l${-1.5} ${-1.8} h3 z" fill="none"/>${ln(x, y, x + d * 14, y, 'sh-dim')}${ln(x, y - 1.8, x + d * 14, y - 1.8, 'sh-dim')}${tx(x + d * 1.5, y - 2.6, text, 2.6, right ? 'start' : 'end')}`;
}
const lv = (m) => (Math.abs(m) < 1e-6 ? '±0,000' : `${m > 0 ? '+' : '−'}${Math.abs(m).toFixed(3).replace('.', ',')}`);
function note(lines, y = 210) {
  return lines.map((l, i) => tx(AREA.x, y + i * 4.2, l, 2.6)).join('');
}
function callout(x, y, lines, w = 70, right = true) {
  const parts = [];
  lines.forEach((l, i) => {
    const yy = y + i * 4;
    parts.push(ln(x, yy, right ? x + w : x - w, yy, 'sh-dim'), tx(right ? x + 1 : x - w + 1, yy - 0.8, esc(l), 2.3));
  });
  return parts.join('');
}
function embed(svg, box) {
  return svg.replace('<svg class="arch"', `<svg class="arch-in" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="xMidYMid meet"`);
}

// --- Отдельные листы ---

function sheetCover(m) {
  return [
    tx(115, 140, 'Проект', 6, 'middle'),
    tx(115, 156, `Индивидуальный жилой дом ${f1(m.W)} м × ${f1(m.D)} м`, 5.2, 'middle'),
    tx(115, 164, `из материала: ${esc(m.mat.title.toLowerCase())}`, 5.2, 'middle'),
    tx(115, 180, 'Эскизный проект: архитектурные и конструктивные решения', 3.6, 'middle'),
    `<rect x="45" y="200" width="140" height="22" fill="none" stroke="#c0392b" stroke-width="0.6"/>`,
    tx(115, 208, 'ПРИМЕРНЫЙ ВАРИАНТ. НОСИТ ПОДСКАЗОЧНЫЙ ХАРАКТЕР.', 3, 'middle', 'fill="#c0392b"'),
    tx(115, 214, 'Не является проектной документацией. Сделан в помощь тем, кто строится сам.', 2.4, 'middle', 'fill="#c0392b"'),
    tx(115, 218.5, 'Перед строительством нужны изыскания и проверка проектировщиком.', 2.4, 'middle', 'fill="#c0392b"'),
    tx(115, 280, `${esc(m.cl.name)} ${m.year}`, 3.6, 'middle'),
  ].join('');
}

function sheetNote(m) {
  const L = [];
  const p = (s, b = false) => L.push([s, b]);
  p('1. Общие указания', true);
  p('1.1 Проект разработан на основании утверждённой Заказчиком планировки (сайт «Дом Меркурий»).');
  p('1.2 За условную отметку ±0,000 принят уровень чистого пола первого этажа.');
  p(`1.3 Климат (${m.cl.name}): район ${m.cl.zone}; t нар. наиболее холодной пятидневки ${m.cl.t5} °С;`);
  p(`     отопительный период ${m.cl.zOt} сут при средней t ${f1(m.cl.tOt)} °С (СП 131.13330); ГСОП ${Math.round(m.norms.gsop)}.`);
  p(`1.4 Снеговой район ${m.cl.snowReg}, Sg = ${f1(m.cl.Sg)} кПа; ветровой район ${m.cl.windReg}, w0 = ${f2(m.cl.w0)} кПа (СП 20.13330).`);
  p('1.5 Уровень ответственности здания — нормальный (ГОСТ 27751). Срок службы — не менее 50 лет.');
  p(`1.6 Степень огнестойкости ${m.mat.fireDeg}, класс конструктивной пожарной опасности ${m.mat.fireClass} (СП 2.13130).`);
  p('2. Архитектурно-планировочные решения', true);
  p(`2.1 Дом ${m.nF === 1 ? 'одноэтажный' : 'двухэтажный'}, размеры в осях ${f1(m.W)} × ${f1(m.D)} м. Высота помещений ${f2(m.ceiling)} м.`);
  const names = [...new Set(m.rooms.map((r) => r.label.toLowerCase()))];
  const chunk = names.join(', ');
  for (let i = 0; i < chunk.length; i += 95) p(`${i ? '     ' : '2.2 Помещения: '}${esc(chunk.slice(i, i + 95))}`);
  p(`2.3 Кровля двускатная, уклон ${m.pitch}°, высота по коньку ${lv(m.ridge)}.`);
  p('3. Технико-экономические показатели', true);
  p(`3.1 Общая площадь — ${f2(m.total)} м²; жилая — ${f2(m.livingA)} м².`);
  p(`3.2 Площадь застройки — ${f2((m.W + 0.2) * (m.D + 0.2))} м²; строительный объём — ${f1((m.W + 0.2) * (m.D + 0.2) * (m.wallTop + m.plinth + (m.ridge - m.wallTop) / 2))} м³.`);
  p('4. Конструктивные решения', true);
  p(`4.1 Фундамент — ${FOUNDATIONS[m.foundation].title.toLowerCase()}.`);
  p(m.foundation === 'slab' ? '     Плита 250 мм с рёбрами по периметру и под стенами, бетон B20 F150, сетки Ø 12 A500C 200×200 в два ряда; под плитой ЭППС, песок и щебень по расчёту.' : m.foundation === 'piles' ? `     Сваи Ø 300 мм, бетон B20, F200, W6; заглубление ${m.cl.permafrost ? 'ниже слоя сезонного оттаивания, ориентировочно 6–8 м' : '— ниже глубины промерзания, 2,5–3 м'} по изысканиям.` : m.foundation === 'strip' ? '     Лента 400 × 700(h) мм, бетон B15, арматура 4 Ø 12 A500C, хомуты Ø 8 шаг 350; подушка — песок и щебень 300 мм.' : '     Винтовые сваи Ø 108 мм, длина 2,5–3 м; обвязка — брус 200×200 (лиственница) или швеллер.');
  p(`4.2 Стены — ${m.mat.title.toLowerCase()}; ${m.wall.ins ? `утепление минватой ${Math.round(m.wall.ins * 1000)} мм, вентфасад.` : 'без дополнительного утепления.'}`);
  p(`     Приведённое сопротивление R = ${f2(m.wall.R)} м²·°С/Вт при норме ${f2(m.wall.need)} (СП 50.13330).`);
  p(`4.3 Пол — ${m.foundation === 'slab' ? 'по утеплённой плите, тёплый пол в стяжке' : m.foundation === 'strip' ? 'утеплённая стяжка по грунту' : 'по деревянным балкам над проветриваемым подпольем'}, утеплитель ${Math.round(m.floor.d * 1000)} мм.`);
  p(`4.4 Чердачное перекрытие — балки ${m.beam ? `${m.beam.b}×${m.beam.h}` : '— по расчёту'} мм шаг 600 мм, минвата ${Math.round(m.attic.d * 1000)} мм.`);
  p(`4.5 Стропила ${m.rafter ? `${m.rafter.b}×${m.rafter.h}` : '— по расчёту'} мм шаг ${Math.round(m.rafterStep * 1000)} мм${m.strut ? ' с подкосами' : ''}; кровля — металлочерепица по обрешётке.`);
  p('4.6 Окна — ПВХ, двухкамерный стеклопакет (для Севера — трёхкамерный), R не ниже нормы.');
  p('4.7 Деревянные элементы — антисептировать и обработать огнезащитой (СП 64.13330).');
  p('4.8 Работы выполнять по СНиП 12-03-2001 и СНиП 12-04-2002 «Безопасность труда в строительстве».');
  p('5. Ограничения', true);
  p('Документ носит примерный, подсказочный характер, сделан в помощь тем, кто строится сам.');
  p('Перед строительством закажите инженерно-геологические изыскания и проверку проектировщиком.');
  return tx(115, 22, 'Пояснительная записка', 5, 'middle') + L.map(([s, b], i) => tx(AREA.x, 32 + i * 4.75, s, b ? 3 : 2.55, 'start', b ? 'font-weight="600"' : '')).join('');
}

function sheetChecks(m, checks) {
  const rows = [];
  let y = 32;
  rows.push(tx(115, 22, 'Проверка решений по нормам', 5, 'middle'));
  rows.push(ln(AREA.x, y - 4, 200, y - 4, 'sh-l'), tx(AREA.x + 1, y - 0.8, '№', 2.6), tx(AREA.x + 8, y - 0.8, 'Проверка', 2.6), tx(AREA.x + 108, y - 0.8, 'Норма', 2.6), tx(198, y - 0.8, 'Итог', 2.6, 'end'));
  y += 1;
  checks.forEach((c, i) => {
    const words = c.text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) { if ((cur + ' ' + w).length > 62) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w; }
    if (cur) lines.push(cur);
    rows.push(ln(AREA.x, y, 200, y, 'sh-dim'));
    rows.push(tx(AREA.x + 1, y + 3.4, String(i + 1), 2.5), tx(AREA.x + 8, y + 3.4, c.title, 2.6, 'start', 'font-weight="600"'));
    lines.forEach((l, k) => rows.push(tx(AREA.x + 8, y + 7.2 + k * 3.4, l, 2.3)));
    rows.push(tx(AREA.x + 108, y + 3.4, c.norm, 2.2));
    rows.push(tx(198, y + 3.4, c.ok === null ? 'учесть' : c.ok ? 'да' : 'нет', 2.6, 'end', c.ok === false ? 'fill="#c0392b"' : ''));
    y += 5 + lines.length * 3.4;
  });
  return rows.join('');
}

function sheetFoundation(m) {
  const { W, D } = m;
  const v = view(W + 1, D + 1);
  const parts = [heading(`План фундамента (${FOUNDATIONS[m.foundation].short})`)];
  const lines = [[[0, 0], [W, 0]], [[W, 0], [W, D]], [[W, D], [0, D]], [[0, D], [0, 0]], [[W / 3, 0], [W / 3, D]], [[(2 * W) / 3, 0], [(2 * W) / 3, D]]];
  if (m.foundation === 'slab') {
    const o = 0.3;
    parts.push(`<rect class="sh-found" x="${v.X(-o)}" y="${v.Y(D + o)}" width="${(W + 2 * o) * v.k}" height="${(D + 2 * o) * v.k}"/>`);
    for (const [[x1, y1], [x2, y2]] of [[[0, 0], [W, 0]], [[W, 0], [W, D]], [[W, D], [0, D]], [[0, D], [0, 0]], [[W / 3, 0], [W / 3, D]], [[(2 * W) / 3, 0], [(2 * W) / 3, D]]]) parts.push(ln(v.X(x1), v.Y(y1), v.X(x2), v.Y(y2), 'sh-dash'));
    parts.push(chainH(v, [-o, 0, W / 3, (2 * W) / 3, W, W + o], v.Y(-o) + 12, v.Y(-o) + 2), chainV(v, [-o, 0, D / 3, (2 * D) / 3, D, D + o], v.X(-o) - 12, v.X(-o) - 2), axesMarks(v, W, D));
    parts.push(note([
      `Плита ${f1(W + 2 * o)} × ${f1(D + 2 * o)} м толщиной 250 мм; рёбра 400 × 300(h) мм по периметру и под несущими стенами (пунктир). Бетон B20 — ≈ ${f1((W + 2 * o) * (D + 2 * o) * 0.25 + (2 * (W + D) + 2 * D) * 0.12)} м³.`,
      'Армирование — сетки Ø 12 A500C 200×200 мм в два ряда; защитный слой 40 мм.',
      'Под плитой: ЭППС 150–200 мм (и «юбка» утеплителя по периметру 1,2 м), песок 300 мм с уплотнением, щебень, геотекстиль.',
      'Вводы воды, канализации и кабелей — гильзы закладываются до бетонирования.',
    ], 210));
    return parts.join('');
  }
  const b = m.foundation === 'strip' ? (m.mat.heavy ? 0.5 : 0.4) : 0.4;
  for (const [[x1, y1], [x2, y2]] of lines) {
    const hz = y1 === y2;
    const x = Math.min(x1, x2) - (hz ? b / 2 : b / 2);
    const y = Math.max(y1, y2) + (hz ? b / 2 : b / 2);
    const w = hz ? Math.abs(x2 - x1) + b : b;
    const h = hz ? b : Math.abs(y2 - y1) + b;
    parts.push(`<rect class="${m.foundation === 'strip' ? 'sh-found' : 'sh-grill'}" x="${v.X(x)}" y="${v.Y(y)}" width="${w * v.k}" height="${h * v.k}"/>`);
  }
  let piles = [];
  if (m.foundation !== 'strip') {
    const step = m.mat.heavy ? 1.8 : m.foundation === 'screw' ? 2.0 : 2.5;
    const addLine = (x1, y1, x2, y2) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const n = Math.max(1, Math.ceil(len / step));
      for (let i = 0; i <= n; i++) piles.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
    };
    for (const [[x1, y1], [x2, y2]] of lines) addLine(x1, y1, x2, y2);
    piles = piles.filter((p, i) => piles.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.3) === i);
    for (const [x, y] of piles) parts.push(`<circle class="sh-pile" cx="${v.X(x)}" cy="${v.Y(y)}" r="${0.15 * v.k + 0.4}"/>`);
  }
  parts.push(chainH(v, [0, W / 3, (2 * W) / 3, W], v.Y(0) + 12, v.Y(0) + 3), chainH(v, [0, W], v.Y(0) + 18, v.Y(0) + 3));
  parts.push(chainV(v, [0, D / 3, (2 * D) / 3, D], v.X(0) - 12, v.X(0) - 3), chainV(v, [0, D], v.X(0) - 18, v.X(0) - 3));
  parts.push(axesMarks(v, W, D));
  const per = 2 * (W + D) + 2 * D;
  const notes = m.foundation === 'strip'
    ? [`Лента ${Math.round(b * 1000)} × 700(h) мм под наружными стенами и по осям 2, 3; бетон B15 — ${f1(per * b * 0.7)} м³.`,
      'Армирование: 4 Ø 12 A500C, хомуты Ø 8 шаг 350 мм; углы и примыкания — Г-образными стержнями 700 мм.',
      'Подушка — щебень 150 + песок 150 мм по геотекстилю; утепление ЭППС 100 мм по внешней грани и отмостке.']
    : [`Свай: ${piles.length} шт., шаг не более ${m.mat.heavy ? '1,8' : m.foundation === 'screw' ? '2,0' : '2,5'} м, в углах и пересечениях стен.`,
      m.foundation === 'piles' ? `Сваи Ø 300 мм, бетон B20 F200 W6; ростверк 400 × 400 мм; заглубление ${m.cl.permafrost ? 'по изысканиям ниже слоя сезонного оттаивания' : '2,5–3 м'}.` : 'Винтовые сваи Ø 108 мм, длина 2,5–3 м, оголовки 250×250; обвязка — брус 200×200 (лиственница).',
      m.cl.permafrost ? `Высота проветриваемого подполья — не менее ${f1(m.plinth)} м; продухи по периметру (СП 25.13330).` : 'Цоколь закрыть утеплённой забиркой с продухами.'];
  parts.push(note(notes, 214));
  return parts.join('');
}

function sheetFoundationNode(m) {
  const parts = [heading('Узел фундамента и конструкция пола')];
  // Разрез у наружной стены, масштаб 1:25 (0,04 мм листа на мм натуры)
  const k = 0.04;
  const gx = 60; // наружная грань стены
  const gy = 160; // уровень земли
  const P = (xmm, ymm) => [gx + xmm * k, gy - ymm * k]; // x — внутрь дома, y — вверх от земли
  const R = (x1, y1, x2, y2, cls) => {
    const [ax, ay] = P(x1, y2);
    return `<rect class="${cls}" x="${ax}" y="${ay}" width="${(x2 - x1) * k}" height="${(y2 - y1) * k}"/>`;
  };
  const plinth = m.plinth * 1000;
  const t = Math.round(m.wall.thick * 1000);
  parts.push(R(-900, -900, 2600, 0, 'sh-ground'));
  let floorTop;
  if (m.foundation === 'slab') {
    parts.push(R(-1200, -500, 2600, -200, 'sh-layer'), R(-1200, -200, 2600, 0, 'sh-ins'));
    parts.push(R(-300, 0, 2600, 250, 'sh-found'), R(-300, -100, 100, 0, 'sh-found'));
    parts.push(R(-1300, -100, -300, 0, 'sh-ins'));
    floorTop = 250 + 100;
    parts.push(R(t, 250, 2600, 350, 'sh-floor'));
    parts.push(tx(...P(1300, -100), 'ЭППС под плитой', 2.4, 'middle'));
  } else if (m.foundation === 'strip') {
    parts.push(R(-300, -500, 1200, -300, 'sh-layer'));
    parts.push(R(0, -300, 400, plinth, 'sh-found'));
    parts.push(R(-110, -250, 0, plinth - 100, 'sh-ins'));
    parts.push(R(-1000, -60, 0, 0, 'sh-floor'));
    floorTop = plinth + 120;
    parts.push(R(400, plinth - 200, 2600, plinth, 'sh-ins'), R(400, plinth, 2600, plinth + 120, 'sh-floor'));
  } else {
    parts.push(R(50, -900, 350, plinth - 400, 'sh-found'));
    parts.push(R(0, plinth - 400, 400, plinth, 'sh-grill'));
    floorTop = plinth + 250;
    parts.push(R(400, plinth, 2600, plinth + 50, 'sh-layer'), R(400, plinth + 50, 2600, plinth + 230, 'sh-ins'), R(400, plinth + 230, 2600, plinth + 250, 'sh-floor'));
    parts.push(tx(...P(1200, plinth / 2), 'проветриваемое подполье', 2.4, 'middle'));
  }
  const wallBase = m.foundation === 'slab' ? 250 : plinth;
  parts.push(R(0, wallBase, t, wallBase + 1500, 'sh-wall'));
  // Отметки
  const [lx] = P(2700, 0);
  parts.push(level(lx, P(0, floorTop)[1], '±0,000'), level(lx, P(0, 0)[1], lv(-(floorTop) / 1000)));
  // Слои пола
  parts.push(tx(130, 52, 'Пол:', 2.7, 'start', 'font-weight="600"'));
  m.floor.layers.forEach((l, i) => parts.push(tx(130, 57 + i * 3.8, `— ${esc(l[0])}`, 2.3)));
  parts.push(tx(AREA.x, 52, 'Стена (изнутри наружу):', 2.7, 'start', 'font-weight="600"'));
  m.wall.layers.forEach((l, i) => parts.push(tx(AREA.x, 57 + i * 3.8, `— ${esc(l[0])}`, 2.3)));
  parts.push(note([
    'Гидроизоляция между фундаментом и стеной — 2 слоя наплавляемого материала.',
    m.foundation === 'slab' ? 'Утеплённая отмостка 1200 мм («юбка» из ЭППС) защищает основание от промерзания; водоотвод от дома обязателен.' : m.foundation === 'strip' ? 'Отмостка шириной 1000 мм: бетон B15 по ЭППС 50 мм и песку 300 мм, уклон от дома 2–3 %.' : `Подполье высотой ${mm(m.plinth)} мм с продухами по периметру${m.cl.permafrost ? '; при мерзлоте продухи на зиму не закрывать' : ''}.`,
    `Требуемое сопротивление пола R = ${f2(m.floor.need)}, по расчёту ${f2(m.floor.R)} м²·°С/Вт (СП 50.13330). М 1:25.`,
  ], 205));
  return parts.join('');
}

function sheetPlan(m, f, kind) {
  const svg = kind === 'furn' ? f.furnSvg : f.planSvg;
  const title = `${kind === 'furn' ? 'План расстановки мебели' : 'План этажа'}${m.nF > 1 ? ` — ${f.title.toLowerCase()}` : ''}`;
  return heading(title) + embed(svg, { x: AREA.x, y: 22, w: AREA.w, h: 190 })
    + note(kind === 'furn' ? ['Мебель показана условно; размеры — по каталогу производителя.'] : ['Размеры окон — по проёму; размеры дверей — по полотну.', `Наружные стены ${Math.round(m.wall.thick * 1000)} мм с утеплением и облицовкой; перегородки 120 мм.`], 218);
}

function sheetWindows(m) {
  const parts = [heading('Схема окон и дверей')];
  const types = new Map();
  for (const f of m.floors) for (const w of f.geo.windows) {
    const t = types.get(w.mark) || { mark: w.mark, w: w.len, h: w.h, n: 0 };
    t.n++;
    types.set(w.mark, t);
  }
  const doors = [{ mark: 'Д-1', w: 1.0, h: 2.1, n: 1, door: true, label: 'входная, утеплённая' }, { mark: 'ДМ-1', w: 0.8, h: 2.0, n: m.floors.reduce((s, f) => s + (f.geo.leafs || 0), 0), door: true, label: 'межкомнатная' }];
  const list = [...[...types.values()].sort((a, b) => a.mark.localeCompare(b.mark)), ...doors];
  const k = 18;
  let x = AREA.x + 6;
  let y = 60;
  for (const t of list) {
    const w = t.w * k;
    const h = t.h * k;
    if (x + w > 196) { x = AREA.x + 6; y += 62; }
    const top = y - h + 20;
    parts.push(tx(x + w / 2, top - 8, t.mark, 3, 'middle'), tx(x + w / 2, top - 4, `шт. — ${t.n}`, 2.4, 'middle'));
    parts.push(`<rect class="sh-thick" x="${x}" y="${top}" width="${w}" height="${h}"/>`);
    if (t.door) parts.push(`<rect class="sh-l" x="${x + 1.5}" y="${top + 1.5}" width="${w - 3}" height="${h - 1.5}"/>`, `<circle class="sh-l" cx="${x + w - 3}" cy="${top + h / 2}" r="0.8"/>`);
    else {
      const n = t.w > 1.2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const sx = x + (i * w) / n;
        parts.push(`<rect class="sh-l" x="${sx + 1}" y="${top + 1}" width="${w / n - 2}" height="${h - 2}"/>`);
        if (i === n - 1) parts.push(`<path class="sh-dash" d="M${sx + 1} ${top + 1} L${sx + w / n - 1} ${top + h / 2} L${sx + 1} ${top + h - 1} M${sx + 1} ${top + h - 1} L${sx + w / n / 2} ${top + 1} L${sx + w / n - 1} ${top + h - 1}"/>`);
      }
    }
    parts.push(ln(x, top + h + 4, x + w, top + h + 4, 'sh-dim'), tick(x, top + h + 4), tick(x + w, top + h + 4), tx(x + w / 2, top + h + 3, mm(t.w), 2.4, 'middle'));
    parts.push(ln(x + w + 4, top, x + w + 4, top + h, 'sh-dim'), tick(x + w + 4, top), tick(x + w + 4, top + h), tx(x + w + 3, top + h / 2, mm(t.h), 2.4, 'middle', `transform="rotate(-90 ${x + w + 3} ${top + h / 2})"`));
    if (t.label) parts.push(tx(x + w / 2, top + h + 8, t.label, 2.2, 'middle'));
    x += w + 22;
  }
  parts.push(note(['Размеры даны по проёму. Открывание окон — поворотно-откидное внутрь.', `Требуемое R окон ${f2(m.norms.window)} м²·°С/Вт (СП 50.13330): ${m.cl.t5 <= -40 ? 'трёхкамерный стеклопакет или двойное остекление' : 'двухкамерный стеклопакет'}.`, 'Монтаж по ГОСТ 30971: пена, пароизоляционная лента изнутри, паропроницаемая снаружи.', m.mat.wood && (m.material === 'brus' || m.material === 'log') ? 'В брусе и бревне — обсада (окосячка) с усадочным зазором 50–70 мм над окном.' : ''].filter(Boolean), 214));
  return parts.join('');
}

function floorKind(r) {
  if (r.wet || r.type === 'utility' && /сануз|ванн|туал|постир|котел|котёл/i.test(r.label)) return 'tile';
  if (r.type === 'entry' || r.key === 'kitchen' || /прихож|тамбур|котельн|кухн/i.test(r.label)) return 'tile';
  return 'lam';
}

function sheetFloors(m, f) {
  const { W, D } = m;
  const v = view(W + 0.6, D + 0.6, { x: AREA.x, y: 22, w: AREA.w, h: 170 });
  const parts = [heading(`План полов${m.nF > 1 ? ` — ${f.title.toLowerCase()}` : ''}`)];
  parts.push('<defs><pattern id="pTile" patternUnits="userSpaceOnUse" width="3" height="3"><path d="M0 0 H3 M0 0 V3" stroke="#555" stroke-width="0.15"/></pattern><pattern id="pLam" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><path d="M0 0 V4 M2 0 V2 M0 2 H4" stroke="#777" stroke-width="0.15"/></pattern></defs>');
  // Остаток сектора, который делит небольшое подсобное с соседней комнатой, — под ламинат
  parts.push(`<rect x="${v.X(0)}" y="${v.Y(D)}" width="${W * v.k}" height="${D * v.k}" fill="url(#pLam)"/>`);
  for (const r of f.geo.rooms) {
    const kind = floorKind(r);
    parts.push(`<rect x="${v.X(r.x1)}" y="${v.Y(r.y2)}" width="${(r.x2 - r.x1) * v.k}" height="${(r.y2 - r.y1) * v.k}" fill="#fff"/>`,
      `<rect x="${v.X(r.x1)}" y="${v.Y(r.y2)}" width="${(r.x2 - r.x1) * v.k}" height="${(r.y2 - r.y1) * v.k}" fill="url(#${kind === 'tile' ? 'pTile' : 'pLam'})" stroke="#000" stroke-width="0.3"/>`);
    const cx = v.X((r.x1 + r.x2) / 2);
    const cy = v.Y((r.y1 + r.y2) / 2);
    parts.push(`<rect x="${cx - 13}" y="${cy - 3.6}" width="26" height="7" fill="#fff"/>`, tx(cx, cy, esc(r.label.length > 18 ? `${r.label.slice(0, 17)}…` : r.label), 2.2, 'middle'), tx(cx, cy + 2.8, f2(r.area), 1.9, 'middle'));
  }
  parts.push(outlineRect(v, W, D));
  parts.push(`<rect x="${AREA.x}" y="198" width="8" height="6" fill="url(#pTile)" stroke="#000" stroke-width="0.3"/>`, tx(AREA.x + 11, 202.5, '— плитка керамогранит на клею (санузлы, кухня, прихожая, котельная)', 2.6));
  parts.push(`<rect x="${AREA.x}" y="208" width="8" height="6" fill="url(#pLam)" stroke="#000" stroke-width="0.3"/>`, tx(AREA.x + 11, 212.5, '— ламинат 33 класса на подложке (жилые комнаты, холл)', 2.6));
  parts.push(note(['В санузлах — обмазочная гидроизоляция пола с заходом на стены 200 мм, в душе — 1800 мм.', 'Тёплый пол — водяной, трубы Ø 16 мм с шагом 150–250 мм в стяжке 80 мм.'], 222));
  return parts.join('');
}

function sheetBeams(m) {
  const { W, D } = m;
  const v = view(W + 1, D + 1);
  const parts = [heading('Схема чердачного перекрытия')];
  parts.push(outlineRect(v, W, D, 'sh-l'));
  for (const x of [W / 3, (2 * W) / 3]) parts.push(ln(v.X(x), v.Y(0), v.X(x), v.Y(D), 'sh-thick'));
  const n = Math.floor(D / 0.6);
  for (let i = 0; i <= n; i++) {
    const y = Math.min(D - 0.1, 0.1 + i * 0.6);
    parts.push(ln(v.X(0.05), v.Y(y), v.X(W - 0.05), v.Y(y), 'sh-beam'));
  }
  parts.push(chainV(v, [0, 0.1, 0.7, 1.3, 1.9], v.X(W) + 8, v.X(W) + 2));
  parts.push(chainH(v, [0, W / 3, (2 * W) / 3, W], v.Y(0) + 12, v.Y(0) + 3), axesMarks(v, W, D));
  parts.push(note([
    `Балки ${m.beam ? `${m.beam.b}×${m.beam.h}` : 'по расчёту'} мм, шаг 600 мм, пролёт ${f1(m.beamSpan)} м — с опиранием на несущие стены по осям 2 и 3.`,
    `Нагрузка: снеговой нет, полезная на чердак 0,7 кПа, собственный вес ${f1(0.3 + m.attic.d * 0.5)} кПа; прогиб не более L/250 (СП 20.13330, СП 64.13330).`,
    `Утеплитель — минвата ${Math.round(m.attic.d * 1000)} мм между балками и поверх, пароизоляция снизу, ветрозащита сверху.`,
    'Опирание балок — не менее 150 мм; в брусе и бревне — в чашку или на опоры скольжения (усадка).',
  ], 210));
  return parts.join('');
}

// Профиль кровли поперёк конька: возвращает точки (м) для разреза и фасадов
function roofProfile(m) {
  const t = Math.tan(rad(m.pitch));
  const half = m.span / 2;
  const eaveY = m.wallTop - m.overhang * t;
  return { t, half, eaveY };
}

function sheetSection(m) {
  const span = m.span;
  const { t, half, eaveY } = roofProfile(m);
  const H = m.ridge + m.plinth + 0.8;
  const v = view(span + 2 * m.overhang + 4, H, { x: AREA.x + 20, y: 18, w: AREA.w - 40, h: 150 }, 8);
  const sx = (x) => v.X(x + m.overhang + 2);
  const Y0 = (y) => v.Y(y + m.plinth + 0.4);
  const parts = [heading('Разрез 1-1')];
  const te = Math.min(0.6, m.wall.thick);
  parts.push(`<rect class="sh-ground" x="${sx(-m.overhang - 1.5)}" y="${Y0(-m.plinth)}" width="${(span + 2 * m.overhang + 3) * v.k}" height="${0.4 * v.k}"/>`);
  // Фундамент
  if (m.foundation === 'slab') parts.push(`<rect class="sh-found" x="${sx(-0.3)}" y="${Y0(-0.12)}" width="${(span + 0.6) * v.k}" height="${(m.plinth + 0.12) * v.k}"/>`);
  else for (const x of [0, span - 0.4]) parts.push(`<rect class="sh-found" x="${sx(x)}" y="${Y0(-0.12)}" width="${0.4 * v.k}" height="${(m.plinth + 0.12 + (m.foundation === 'strip' ? 0.3 : 1.2)) * v.k}"/>`);
  // Стены и перекрытия
  for (let i = 0; i < m.nF; i++) {
    const y0 = i * m.storey;
    parts.push(`<rect class="sh-floor" x="${sx(te)}" y="${Y0(y0)}" width="${(span - 2 * te) * v.k}" height="${0.3 * v.k}"/>`);
  }
  parts.push(`<rect class="sh-wall" x="${sx(0)}" y="${Y0(m.wallTop)}" width="${te * v.k}" height="${(m.wallTop + 0.3) * v.k}"/>`, `<rect class="sh-wall" x="${sx(span - te)}" y="${Y0(m.wallTop)}" width="${te * v.k}" height="${(m.wallTop + 0.3) * v.k}"/>`);
  parts.push(`<rect class="sh-ins" x="${sx(te)}" y="${Y0(m.wallTop)}" width="${(span - 2 * te) * v.k}" height="${(m.wallTop - m.ceiling - (m.nF - 1) * m.storey) * v.k}"/>`);
  // Кровля
  const roof = [[-m.overhang, eaveY], [half, m.ridge], [span + m.overhang, eaveY]];
  parts.push(`<polyline class="sh-roof" points="${roof.map(([x, y]) => `${sx(x)},${Y0(y)}`).join(' ')}"/>`);
  parts.push(`<polyline class="sh-l" points="${roof.map(([x, y]) => `${sx(x)},${Y0(y - 0.22)}`).join(' ')}"/>`);
  parts.push(ln(sx(0), Y0(m.wallTop), sx(span), Y0(m.wallTop), 'sh-l'));
  // Отметки
  const lx = sx(span + m.overhang) + 6;
  const marks = [[m.ridge, lv(m.ridge)], [m.wallTop, lv(m.wallTop)], [0, lv(0)], [-m.plinth, lv(-m.plinth)]];
  for (const [y, s] of marks) parts.push(level(lx, Y0(y), s));
  // Высота помещения
  parts.push(ln(sx(span / 2), Y0(0), sx(span / 2), Y0(m.ceiling), 'sh-dim'), tick(sx(span / 2), Y0(0)), tick(sx(span / 2), Y0(m.ceiling)), tx(sx(span / 2) - 1, (Y0(0) + Y0(m.ceiling)) / 2, mm(m.ceiling), 2.4, 'middle', `transform="rotate(-90 ${sx(span / 2) - 1} ${(Y0(0) + Y0(m.ceiling)) / 2})"`));
  parts.push(chainH(v, [0, span].map((x) => x + m.overhang + 2), Y0(-m.plinth) + 9, Y0(-m.plinth) + 2).replace(/>(\d+)</, `>${mm(span)}<`));
  // Выноски слоёв
  const roofLayers = ['Металлочерепица', 'Обрешётка 25×100, контробрешётка 50×50', 'Ветрозащитная мембрана', `Стропила ${m.rafter ? `${m.rafter.b}×${m.rafter.h}` : ''} шаг ${Math.round(m.rafterStep * 1000)}`];
  parts.push(tx(AREA.x, 176, 'Кровля:', 2.6, 'start', 'font-weight="600"'), ...roofLayers.map((l, i) => tx(AREA.x, 180 + i * 3.6, `— ${l}`, 2.3)));
  parts.push(tx(AREA.x + 62, 176, 'Чердачное перекрытие:', 2.6, 'start', 'font-weight="600"'), ...m.attic.layers.map((l, i) => tx(AREA.x + 62, 180 + i * 3.6, `— ${esc(l[0])}`, 2.3)));
  parts.push(tx(AREA.x + 122, 176, 'Пол:', 2.6, 'start', 'font-weight="600"'), ...m.floor.layers.map((l, i) => tx(AREA.x + 122, 180 + i * 3.6, `— ${esc(l[0].slice(0, 40))}`, 2.3)));
  parts.push(note([`За ±0,000 принят уровень чистого пола. Уклон кровли ${m.pitch}°, свес ${mm(m.overhang)} мм.`, m.mat.firstRow + '.'], 222));
  return parts.join('');
}

/** Фасад: side — front, back, left, right. */
function facadeDraw(m, side, box) {
  const front = side === 'front' || side === 'back';
  const len = front ? m.W : m.D;
  const { t, half, eaveY } = roofProfile(m);
  const gable = (m.ridgeAlongX && !front) || (!m.ridgeAlongX && front);
  const H = m.ridge + m.plinth + 0.6;
  const v = view(len + 2 * m.overhang + 3, H, box, 6);
  const sx = (x) => v.X(x + m.overhang + 1.5);
  const Y0 = (y) => v.Y(y + m.plinth + 0.3);
  const parts = [];
  parts.push(ln(sx(-m.overhang - 1.2), Y0(-m.plinth), sx(len + m.overhang + 1.2), Y0(-m.plinth), 'sh-thick'));
  // Цоколь
  parts.push(`<rect class="sh-plinth" x="${sx(0)}" y="${Y0(0)}" width="${len * v.k}" height="${m.plinth * v.k}"/>`);
  if (!onGround(m.foundation)) for (let x = 0.8; x < len - 0.4; x += 2.5) parts.push(`<rect class="sh-l" x="${sx(x)}" y="${Y0(-m.plinth / 2 + 0.1)}" width="${0.3 * v.k}" height="${0.2 * v.k}"/>`);
  // Стена с облицовкой
  parts.push(`<rect class="sh-facade" x="${sx(0)}" y="${Y0(m.wallTop)}" width="${len * v.k}" height="${m.wallTop * v.k}"/>`);
  for (let y = 0.2; y < m.wallTop; y += 0.2) parts.push(ln(sx(0), Y0(y), sx(len), Y0(y), 'sh-siding'));
  // Кровля
  if (gable) {
    const pts = [[-m.overhang, eaveY], [len / 2, m.ridge], [len + m.overhang, eaveY]];
    parts.push(`<polygon class="sh-roofface" points="${[[0, m.wallTop], [len / 2, m.ridge], [len, m.wallTop]].map(([x, y]) => `${sx(x)},${Y0(y)}`).join(' ')}"/>`);
    parts.push(`<polyline class="sh-roof" points="${pts.map(([x, y]) => `${sx(x)},${Y0(y)}`).join(' ')}"/>`);
  } else {
    parts.push(`<polygon class="sh-roofface tiles" points="${[[-m.overhang, eaveY], [len + m.overhang, eaveY], [len + m.overhang, m.ridge], [-m.overhang, m.ridge]].map(([x, y]) => `${sx(x)},${Y0(y)}`).join(' ')}"/>`);
    for (let y = eaveY + 0.35; y < m.ridge; y += 0.35) parts.push(ln(sx(-m.overhang), Y0(y), sx(len + m.overhang), Y0(y), 'sh-siding'));
  }
  // Окна и двери на этой стороне
  const pos = (p) => (side === 'front' ? p[0] : side === 'back' ? m.W - p[0] : side === 'left' ? m.D - p[1] : p[1]);
  const onSide = (p, q) => (side === 'front' ? p[1] < 1e-6 && q[1] < 1e-6 : side === 'back' ? p[1] > m.D - 1e-6 && q[1] > m.D - 1e-6 : side === 'left' ? p[0] < 1e-6 && q[0] < 1e-6 : p[0] > m.W - 1e-6 && q[0] > m.W - 1e-6);
  m.floors.forEach((f, i) => {
    const base = i * m.storey;
    for (const w of f.geo.windows) {
      if (!onSide(w.a, w.b)) continue;
      const a = Math.min(pos(w.a), pos(w.b));
      const sill = base + (w.h >= 1.5 ? 0.8 : 0.9);
      parts.push(`<rect class="sh-win" x="${sx(a)}" y="${Y0(sill + w.h)}" width="${w.len * v.k}" height="${w.h * v.k}"/>`, ln(sx(a + w.len / 2), Y0(sill), sx(a + w.len / 2), Y0(sill + w.h), 'sh-l'));
      parts.push(`<rect class="sh-l" x="${sx(a) - 0.6}" y="${Y0(sill + w.h) - 0.8}" width="${w.len * v.k + 1.2}" height="${w.h * v.k + 1.6}" fill="none"/>`);
    }
    if (i === 0 && f.geo.entry && onSide(f.geo.entry[0], f.geo.entry[1])) {
      const a = Math.min(pos(f.geo.entry[0]), pos(f.geo.entry[1]));
      parts.push(`<rect class="sh-door" x="${sx(a + 0.1)}" y="${Y0(2.1)}" width="${1.0 * v.k}" height="${2.1 * v.k}"/>`);
      // Крыльцо
      parts.push(`<rect class="sh-l" x="${sx(a - 0.4)}" y="${Y0(0)}" width="${1.8 * v.k}" height="${m.plinth * v.k}" fill="#fff"/>`);
      const steps = Math.max(2, Math.round(m.plinth / 0.17));
      for (let s = 1; s < steps; s++) parts.push(ln(sx(a - 0.4), Y0(-(m.plinth * s) / steps), sx(a + 1.4), Y0(-(m.plinth * s) / steps), 'sh-dim'));
    }
  });
  // Отметки
  const lx = sx(len + m.overhang) + 4;
  for (const y of [m.ridge, m.wallTop, 0, -m.plinth]) parts.push(level(lx, Y0(y), lv(y)));
  // Оси
  const ax = front ? [0, len / 3, (2 * len) / 3, len] : [0, len / 3, (2 * len) / 3, len];
  const names = side === 'front' ? ['1', '2', '3', '4'] : side === 'back' ? ['4', '3', '2', '1'] : side === 'left' ? ['Г', 'В', 'Б', 'А'] : ['А', 'Б', 'В', 'Г'];
  ax.forEach((x, i) => parts.push(ln(sx(x), Y0(-m.plinth) + 1, sx(x), Y0(-m.plinth) + 8, 'sh-axis'), `<circle class="sh-bub" cx="${sx(x)}" cy="${Y0(-m.plinth) + 10.5}" r="2.5"/>`, tx(sx(x), Y0(-m.plinth) + 11.5, names[i], 2.6, 'middle')));
  return { svg: parts.join(''), title: `Фасад ${names[0]}–${names[3]}` };
}

function sheetFacades(m, sides) {
  const a = facadeDraw(m, sides[0], { x: AREA.x, y: 24, w: AREA.w, h: 92 });
  const b = facadeDraw(m, sides[1], { x: AREA.x, y: 128, w: AREA.w, h: 92 });
  return tx(AREA.x, 22, `${a.title}`, 4.2) + a.svg + tx(AREA.x, 126, `${b.title}`, 4.2) + b.svg
    + note([`Облицовка — ${m.mat.finish[m.mat.finish.length - 1][0].toLowerCase()}; кровля — металлочерепица.`], 230);
}

function sheetRoof(m) {
  const { W, D } = m;
  const o = m.overhang;
  const v = view(W + 2 * o + 1, D + 2 * o + 1);
  const parts = [heading('План кровли и водосточной системы')];
  parts.push(`<rect class="sh-roofplan" x="${v.X(-o)}" y="${v.Y(D + o)}" width="${(W + 2 * o) * v.k}" height="${(D + 2 * o) * v.k}"/>`);
  parts.push(`<rect class="sh-dash" x="${v.X(0)}" y="${v.Y(D)}" width="${W * v.k}" height="${D * v.k}" fill="none"/>`);
  if (m.ridgeAlongX) {
    parts.push(ln(v.X(-o), v.Y(D / 2), v.X(W + o), v.Y(D / 2), 'sh-thick'));
    for (const x of [W * 0.25, W * 0.5, W * 0.75]) parts.push(`<path class="sh-arrow" d="M${v.X(x)} ${v.Y(D / 2 + 1)} V${v.Y(D - 0.5)} M${v.X(x) - 1} ${v.Y(D - 0.5) + 2} L${v.X(x)} ${v.Y(D - 0.5)} L${v.X(x) + 1} ${v.Y(D - 0.5) + 2}"/>`, `<path class="sh-arrow" d="M${v.X(x)} ${v.Y(D / 2 - 1)} V${v.Y(0.5)} M${v.X(x) - 1} ${v.Y(0.5) - 2} L${v.X(x)} ${v.Y(0.5)} L${v.X(x) + 1} ${v.Y(0.5) - 2}"/>`);
    for (const y of [-o, D + o]) parts.push(ln(v.X(-o), v.Y(y), v.X(W + o), v.Y(y), 'sh-gutter'));
  } else {
    parts.push(ln(v.X(W / 2), v.Y(-o), v.X(W / 2), v.Y(D + o), 'sh-thick'));
    for (const x of [-o, W + o]) parts.push(ln(v.X(x), v.Y(-o), v.X(x), v.Y(D + o), 'sh-gutter'));
  }
  for (const [x, y] of [[-o, -o], [W + o, -o], [-o, D + o], [W + o, D + o]]) parts.push(`<circle class="sh-l" cx="${v.X(x)}" cy="${v.Y(y)}" r="1.4" fill="#fff"/>`);
  parts.push(chainH(v, [-o, 0, W / 3, (2 * W) / 3, W, W + o], v.Y(-o) + 10, v.Y(-o) + 2));
  parts.push(chainV(v, [-o, 0, D / 2, D, D + o], v.X(-o) - 10, v.X(-o) - 2));
  const area = 2 * (m.along + 2 * o) * ((m.span / 2 + o) / Math.cos(rad(m.pitch)));
  parts.push(note([
    `Кровля двускатная, уклон ${m.pitch}°, площадь скатов ≈ ${f1(area)} м²; покрытие — металлочерепица по обрешётке 25×100.`,
    `Снеговая нагрузка: Sg = ${f1(m.cl.Sg)} кПа, μ = ${f2(m.load.mu)} (СП 20.13330). Снегозадержатели над входом и над дорожками.`,
    `Водосток: желоба ${f1(2 * (m.along + 2 * o))} м, 4 водосточные трубы с отводом воды от фундамента не менее 1 м.`,
    'Утеплённое чердачное перекрытие, холодный проветриваемый чердак: продухи в карнизах и коньке.',
  ], 210));
  return { svg: parts.join(''), area };
}

function sheetRafters(m) {
  const { W, D } = m;
  const o = m.overhang;
  const v = view(W + 2 * o + 1, D + 2 * o + 1);
  const parts = [heading('Схема стропильной системы')];
  parts.push(`<rect class="sh-dash" x="${v.X(0)}" y="${v.Y(D)}" width="${W * v.k}" height="${D * v.k}" fill="none"/>`);
  const step = m.rafterStep;
  let count = 0;
  if (m.ridgeAlongX) {
    for (let x = 0; x <= W + 1e-6; x += step) { parts.push(ln(v.X(Math.min(x, W)), v.Y(-o), v.X(Math.min(x, W)), v.Y(D + o), 'sh-beam')); count += 2; }
    parts.push(ln(v.X(-o), v.Y(D / 2), v.X(W + o), v.Y(D / 2), 'sh-thick'));
    for (const y of [0.1, D - 0.1]) parts.push(ln(v.X(0), v.Y(y), v.X(W), v.Y(y), 'sh-mauer'));
  } else {
    for (let y = 0; y <= D + 1e-6; y += step) { parts.push(ln(v.X(-o), v.Y(Math.min(y, D)), v.X(W + o), v.Y(Math.min(y, D)), 'sh-beam')); count += 2; }
    parts.push(ln(v.X(W / 2), v.Y(-o), v.X(W / 2), v.Y(D + o), 'sh-thick'));
    for (const x of [0.1, W - 0.1]) parts.push(ln(v.X(x), v.Y(0), v.X(x), v.Y(D), 'sh-mauer'));
  }
  parts.push(chainH(v, [0, step, 2 * step, 3 * step], v.Y(-o) + 10, v.Y(-o) + 2), chainH(v, [0, W], v.Y(-o) + 16, v.Y(-o) + 2));
  const rafterLen = m.span / 2 / Math.cos(rad(m.pitch)) + o / Math.cos(rad(m.pitch)) + 0.1;
  parts.push(note([
    `Стропила ${m.rafter ? `${m.rafter.b}×${m.rafter.h}` : 'по расчёту'} мм, шаг ${Math.round(step * 1000)} мм, ${count} шт. длиной ≈ ${f2(rafterLen)} м${m.strut ? '; с подкосами и стойками на внутреннюю стену' : ''}.`,
    `Расчётная нагрузка ${f2(m.load.q)} кПа (снег ${f1(m.load.S0)} × 1,4 + кровля 0,5 × 1,1); прочность и прогиб L/200 — СП 64.13330.`,
    `Опирание на ${m.mat.wood && (m.material === 'brus' || m.material === 'log') ? 'верхний венец через скользящие опоры (усадка сруба)' : 'мауэрлат 150×150 по армопоясу / верхней обвязке'}; крепление — уголки и скобы.`,
    'Пиломатериал — сосна 1–2 сорта, влажность не более 20 %, антисептик и огнезащита.',
  ], 210));
  return { svg: parts.join(''), count, rafterLen };
}

function sheetWallNode(m) {
  const parts = [heading('Конструкция наружной стены')];
  const x = 40;
  const y = 40;
  const k = 0.25; // мм листа на мм натуры
  let cx = x;
  const layers = m.wall.layers.filter((l) => l[1] > 0 || /Вентзазор|облиц|блок-хаус|сайдинг|имитац|панел/i.test(l[0]));
  const shown = layers.map((l) => [l[0], l[1] > 0 ? l[1] : /Вентзазор/.test(l[0]) ? 0.04 : 0.02, l[2]]);
  for (const [name, d] of shown) {
    const w = d * 1000 * k;
    const cls = /утепл|минва|ПСБ|СИП/i.test(name) ? 'sh-ins' : /Вентзазор/.test(name) ? 'sh-air' : /брус|бревн|каркас|газобет|кирпич/i.test(name) ? 'sh-wall' : 'sh-layer';
    parts.push(`<rect class="${cls}" x="${cx}" y="${y}" width="${w}" height="110"/>`);
    cx += w;
  }
  parts.push(tx(x - 2, y + 118, 'помещение', 2.6, 'end'), tx(cx + 2, y + 118, 'улица', 2.6));
  let lx = x;
  shown.forEach(([name, d], i) => {
    const mid = lx + (d * 1000 * k) / 2;
    lx += d * 1000 * k;
    const ty = y + 130 + i * 5;
    parts.push(ln(mid, y + 110, mid, ty - 1, 'sh-dim'), ln(mid, ty - 1, mid + 4, ty - 1, 'sh-dim'), tx(mid + 5, ty, `${i + 1}. ${esc(name)}`, 2.5));
  });
  parts.push(ln(x, y - 6, cx, y - 6, 'sh-dim'), tick(x, y - 6), tick(cx, y - 6), tx((x + cx) / 2, y - 7, `${Math.round((cx - x) / k)}`, 2.6, 'middle'));
  parts.push(note([
    `Сопротивление теплопередаче R = ${f2(m.wall.R)} м²·°С/Вт при требуемом ${f2(m.wall.need)} (ГСОП ${Math.round(m.norms.gsop)}, СП 50.13330).`,
    'Пароизоляция — с тёплой стороны, ветрозащита — с холодной; вентзазор не менее 40 мм, снизу и сверху — продухи.',
    m.mat.about,
  ], 205));
  return parts.join('');
}

function sheetSpec(m, roof, rafters) {
  const perim = 2 * (m.W + m.D);
  const winA = m.floors.reduce((s, f) => s + f.geo.windows.reduce((a, w) => a + w.len * w.h, 0), 0) + 2.1;
  const wallA = perim * m.wallTop - winA;
  const base = m.mat.layers.reduce((s, l) => (/брус|бревн|газобет|кирпич|СИП/i.test(l[0]) ? s + l[1] : s), 0) || m.wall.thick;
  const rows = [];
  const r = (name, unit, q) => rows.push([name, unit, q]);
  if (m.foundation === 'slab') {
    const vol = (m.W + 0.6) * (m.D + 0.6) * 0.25 + (perim + 2 * m.D) * 0.12;
    r('Бетон B20 для плиты и рёбер', 'м³', f1(vol * 1.05));
    r('Арматура Ø 12 A500C', 'т', f2((vol * 100) / 1000));
    r('ЭППС 150 мм под плиту и «юбку» по периметру', 'м³', f1((m.W + 0.6) * (m.D + 0.6) * 0.15 + (perim + 4) * 1.2 * 0.1));
    r('Песок для подушки 300 мм', 'м³', f1((m.W + 1.6) * (m.D + 1.6) * 0.3 * 1.2));
  } else if (m.foundation === 'strip') {
    const b = m.mat.heavy ? 0.5 : 0.4;
    const vol = (perim + 2 * m.D) * b * 0.7;
    r('Бетон B15 для ленты', 'м³', f1(vol * 1.05));
    r('Арматура Ø 12 A500C', 'т', f2((vol * 80) / 1000));
    r('ЭППС 100 мм (утепление ленты и отмостки)', 'м³', f1((perim + 8) * 1.0 * 0.1 + perim * 0.7 * 0.1));
  } else {
    const n = Math.round((perim + 2 * m.D) / (m.mat.heavy ? 1.8 : m.foundation === 'screw' ? 2 : 2.5)) + 4;
    r(m.foundation === 'screw' ? 'Свая винтовая Ø 108, L = 3 м' : 'Свая буронабивная Ø 300 мм', 'шт.', String(n));
    if (m.foundation === 'piles') r('Бетон B20 для свай и ростверка', 'м³', f1(n * 0.071 * (m.cl.permafrost ? 7 : 3) + (perim + 2 * m.D) * 0.16));
  }
  if (/brus|log/.test(m.material)) r(`${m.mat.layers[0][0]}`, 'м³', f1(wallA * base * 1.1));
  else if (m.material === 'block') r('Газобетонный блок D500 600×250×400', 'шт.', String(Math.ceil((wallA * base) / 0.06 * 1.05)));
  else if (m.material === 'brick') r('Кирпич керамический полнотелый', 'тыс. шт.', f1((wallA * base * 394) / 1000));
  else if (m.material === 'sip') r('СИП-панель 2500×1250×224', 'шт.', String(Math.ceil((wallA / 3.125) * 1.1)));
  else {
    r('Стойки каркаса 50×200 (сосна)', 'м³', f1((perim / 0.6 + 12) * m.wallTop * 0.01 * 1.1));
    r('ОСП-3 12 мм 2500×1250', 'лист', String(Math.ceil((wallA / 3.125) * 1.1)));
    r('Минвата 200 мм в каркас', 'м³', f1(wallA * 0.2));
  }
  if (m.wall.ins) r(`Минвата фасадная ${Math.round(m.wall.ins * 1000)} мм`, 'м³', f1(wallA * m.wall.ins * 1.05));
  r('Ветрозащитная мембрана', 'м²', f1(wallA * 1.15));
  r(`Балки перекрытия ${m.beam ? `${m.beam.b}×${m.beam.h}` : ''}`, 'м³', f2((Math.floor(m.D / 0.6) + 1) * m.W * ((m.beam?.b || 150) * (m.beam?.h || 200)) / 1e6 * 1.05));
  r(`Минвата в чердачное перекрытие ${Math.round(m.attic.d * 1000)} мм`, 'м³', f1(m.W * m.D * m.attic.d));
  r(`Стропила ${m.rafter ? `${m.rafter.b}×${m.rafter.h}` : ''}`, 'м³', f2(rafters.count * rafters.rafterLen * ((m.rafter?.b || 50) * (m.rafter?.h || 200)) / 1e6));
  r('Металлочерепица', 'м²', f1(roof.area * 1.12));
  r('Обрешётка 25×100 и контробрешётка 50×50', 'м³', f2(roof.area * 0.035));
  const tiles = m.rooms.filter((x) => floorKind(x) === 'tile').reduce((s, x) => s + x.area, 0);
  r('Керамогранит для пола', 'м²', f1(tiles * 1.1));
  r('Ламинат 33 класс', 'м²', f1((m.total - tiles) * 1.07));
  for (const [mark, n] of Object.entries(m.floors.reduce((acc, f) => { for (const w of f.geo.windows) acc[`${w.mark} ${mm(w.len)}×${mm(w.h)}`] = (acc[`${w.mark} ${mm(w.len)}×${mm(w.h)}`] || 0) + 1; return acc; }, {}))) r(`Окно ПВХ ${mark}`, 'шт.', String(n));
  r('Дверь входная утеплённая 1000×2100', 'шт.', '1');
  r('Дверь межкомнатная 800×2000', 'шт.', String(m.floors.reduce((s, f) => s + (f.geo.leafs || 0), 0)));
  r('Водосточный желоб / труба', 'м', `${f1(2 * (m.along + 2 * m.overhang))} / ${f1(4 * (m.wallTop + m.plinth))}`);
  const parts = [tx(115, 22, 'Ведомость основных материалов (ориентировочно)', 4.6, 'middle')];
  let y = 32;
  parts.push(ln(AREA.x, y - 4, 200, y - 4), tx(AREA.x + 1, y - 0.8, '№', 2.6), tx(AREA.x + 8, y - 0.8, 'Наименование', 2.6), tx(AREA.x + 140, y - 0.8, 'Ед.', 2.6), tx(198, y - 0.8, 'Кол-во', 2.6, 'end'));
  rows.forEach(([n, u, q], i) => {
    parts.push(ln(AREA.x, y, 200, y, 'sh-dim'), tx(AREA.x + 1, y + 3.6, String(i + 1), 2.4), tx(AREA.x + 8, y + 3.6, esc(n.length > 78 ? `${n.slice(0, 77)}…` : n), 2.4), tx(AREA.x + 140, y + 3.6, u, 2.4), tx(198, y + 3.6, q, 2.4, 'end'));
    y += 5.2;
  });
  parts.push(note(['Количества приблизительные, с запасом 5–12 % на подрезку. Уточняйте по рабочему проекту и у поставщика.'], y + 8));
  return parts.join('');
}

/** Все листы проекта: [{ title, svg }]. */
export function buildSheets(m, checks) {
  const list = [];
  const add = (title, body, cover = false) => list.push({ title, body, cover });
  add('Обложка', sheetCover(m), true);
  add('Пояснительная записка', sheetNote(m));
  add('Проверка решений по нормам', sheetChecks(m, checks));
  add('План фундамента', sheetFoundation(m));
  add('Узел фундамента и конструкция пола', sheetFoundationNode(m));
  add('Конструкция наружной стены', sheetWallNode(m));
  for (const f of m.floors) add(`План этажа${m.nF > 1 ? ` (${f.title})` : ''}`, sheetPlan(m, f, 'plan'));
  for (const f of m.floors) add(`План расстановки мебели${m.nF > 1 ? ` (${f.title})` : ''}`, sheetPlan(m, f, 'furn'));
  add('Схема окон и дверей', sheetWindows(m));
  for (const f of m.floors) add(`План полов${m.nF > 1 ? ` (${f.title})` : ''}`, sheetFloors(m, f));
  add('Схема чердачного перекрытия', sheetBeams(m));
  add('Разрез 1-1', sheetSection(m));
  add('Фасады 1–4 и 4–1', sheetFacades(m, ['front', 'back']));
  add('Фасады А–Г и Г–А', sheetFacades(m, ['right', 'left']));
  const roof = sheetRoof(m);
  add('План кровли и водостока', roof.svg);
  const raf = sheetRafters(m);
  add('Схема стропильной системы', raf.svg);
  add('Ведомость основных материалов', sheetSpec(m, roof, raf));
  const meta = { project: `Индивидуальный жилой дом ${f1(m.W)} × ${f1(m.D)} м`, sub: `${m.mat.title}, фундамент ${FOUNDATIONS[m.foundation].short}`, year: String(m.year) };
  return list.map((s, i) => ({ title: s.title, svg: sheetSvg(s.body, meta, i + 1, list.length, s.title, s.cover) }));
}
