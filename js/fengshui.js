// Классические расчёты фэн-шуй: 24 горы, летящие звёзды (Сюань Кун),
// восемь дворцов (Ба Чжай) и число Гуа. Без зависимостей от браузера.

// Восемь дворцов по часовой стрелке от севера.
// lo — номер в квадрате Ло Шу, dir — сторона света.
export const PALACES = [
  { key: 'kan', name: 'Кань', dir: 'С', dirName: 'Север', lo: 1, element: 'Вода' },
  { key: 'gen', name: 'Гэнь', dir: 'СВ', dirName: 'Северо-восток', lo: 8, element: 'Земля' },
  { key: 'zhen', name: 'Чжэнь', dir: 'В', dirName: 'Восток', lo: 3, element: 'Дерево' },
  { key: 'xun', name: 'Сюнь', dir: 'ЮВ', dirName: 'Юго-восток', lo: 4, element: 'Дерево' },
  { key: 'li', name: 'Ли', dir: 'Ю', dirName: 'Юг', lo: 9, element: 'Огонь' },
  { key: 'kun', name: 'Кунь', dir: 'ЮЗ', dirName: 'Юго-запад', lo: 2, element: 'Земля' },
  { key: 'dui', name: 'Дуй', dir: 'З', dirName: 'Запад', lo: 7, element: 'Металл' },
  { key: 'qian', name: 'Цянь', dir: 'СЗ', dirName: 'Северо-запад', lo: 6, element: 'Металл' },
];

const PALACE_BY_LO = Object.fromEntries(PALACES.map((p, i) => [p.lo, i]));

// 24 горы, начиная с Жэнь (337,5°). Внутри дворца: земной, небесный, человеческий.
export const MOUNTAINS = [
  ['壬', 'Жэнь'], ['子', 'Цзы'], ['癸', 'Гуй'],
  ['丑', 'Чоу'], ['艮', 'Гэнь'], ['寅', 'Инь'],
  ['甲', 'Цзя'], ['卯', 'Мао'], ['乙', 'И'],
  ['辰', 'Чэнь'], ['巽', 'Сюнь'], ['巳', 'Сы'],
  ['丙', 'Бин'], ['午', 'У'], ['丁', 'Дин'],
  ['未', 'Вэй'], ['坤', 'Кунь'], ['申', 'Шэнь'],
  ['庚', 'Гэн'], ['酉', 'Ю'], ['辛', 'Синь'],
  ['戌', 'Сюй'], ['乾', 'Цянь'], ['亥', 'Хай'],
].map(([hanzi, name], i) => {
  const palace = Math.floor(i / 3);
  const sub = i % 3;
  // Сторонние дворцы (С, В, Ю, З): + − −; угловые: − + +
  const yang = palace % 2 === 0 ? sub === 0 : sub !== 0;
  const start = (337.5 + i * 15) % 360;
  return {
    index: i,
    hanzi,
    name,
    palace,
    sub,
    subName: ['земной', 'небесный', 'человеческий'][sub],
    // Короткое обозначение горы: Ю-1, Ю-2, Ю-3 (сектор и номер горы в нём)
    code: `${['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'][palace]}-${sub + 1}`,
    yang,
    start,
    end: (start + 15) % 360,
    center: (start + 7.5) % 360,
  };
});

export const norm360 = (a) => ((a % 360) + 360) % 360;

export function mountainAt(azimuth) {
  return MOUNTAINS[Math.floor(norm360(azimuth - 337.5) / 15)];
}

/**
 * Насколько азимут близок к границе горы или дворца.
 * Возвращает null, если до границы больше `threshold` градусов.
 */
export function boundaryWarning(azimuth, threshold = 3) {
  const offset = norm360(azimuth - 337.5) % 15;
  const dist = Math.min(offset, 15 - offset);
  if (dist > threshold) return null;
  const idx = Math.floor(norm360(azimuth - 337.5) / 15);
  const neighbour = offset < 7.5 ? (idx + 23) % 24 : (idx + 1) % 24;
  const betweenPalaces = MOUNTAINS[idx].palace !== MOUNTAINS[neighbour].palace;
  return {
    distance: dist,
    neighbour: MOUNTAINS[neighbour],
    betweenPalaces,
    text: betweenPalaces
      ? `Граница дворцов (до соседней горы ${MOUNTAINS[neighbour].name} — ${dist.toFixed(1)}°): «большая пустота», фасад неустойчив. Нужен точный замер и, при необходимости, звёзды замены.`
      : `Граница гор (до соседней горы ${MOUNTAINS[neighbour].name} — ${dist.toFixed(1)}°): «малая пустота». Рекомендуется точный замер.`,
  };
}

// Порядок полёта звёзд по квадрату Ло Шу: центр, СЗ, З, СВ, Ю, С, ЮЗ, В, ЮВ.
const FLIGHT = [5, 6, 7, 8, 9, 1, 2, 3, 4];

/** Летит звезда `start` из центра. Возвращает {номер Ло Шу: звезда}. */
export function fly(start, forward = true) {
  const chart = {};
  FLIGHT.forEach((lo, k) => {
    const step = forward ? k : -k;
    chart[lo] = norm9(start + step);
  });
  return chart;
}

const norm9 = (n) => ((((n - 1) % 9) + 9) % 9) + 1;

function flightDirection(star, sub, period) {
  // Пятёрка не имеет своего дворца и берёт дворец звезды периода.
  const lo = star === 5 ? period : star;
  const palace = PALACE_BY_LO[lo];
  return MOUNTAINS[palace * 3 + sub].yang;
}

/**
 * Карта летящих звёзд.
 * @param {number} facingAzimuth азимут фасада (направление, куда смотрит дом)
 * @param {number} period период (1–9, кроме 5)
 */
export function flyingStars(facingAzimuth, period = 9) {
  if (!Number.isInteger(period) || period < 1 || period > 9 || period === 5) {
    throw new Error('Период должен быть от 1 до 9, кроме 5');
  }
  const facing = mountainAt(facingAzimuth);
  const sitting = mountainAt(facingAzimuth + 180);
  const base = fly(period, true);

  const facingCenter = base[PALACES[facing.palace].lo];
  const sittingCenter = base[PALACES[sitting.palace].lo];
  const facingForward = flightDirection(facingCenter, facing.sub, period);
  const sittingForward = flightDirection(sittingCenter, sitting.sub, period);
  const water = fly(facingCenter, facingForward);
  const mountain = fly(sittingCenter, sittingForward);

  const palaces = {};
  for (const lo of FLIGHT) {
    palaces[lo] = { base: base[lo], mountain: mountain[lo], water: water[lo] };
  }

  const chart = {
    period,
    facing,
    sitting,
    facingPalace: PALACES[facing.palace],
    sittingPalace: PALACES[sitting.palace],
    palaces,
    flight: {
      mountain: { center: sittingCenter, forward: sittingForward },
      water: { center: facingCenter, forward: facingForward },
    },
  };
  chart.patterns = detectPatterns(chart);
  return chart;
}

function detectPatterns(chart) {
  const { period, palaces } = chart;
  const f = palaces[chart.facingPalace.lo];
  const s = palaces[chart.sittingPalace.lo];
  const out = [];

  if (s.mountain === period && f.water === period) {
    out.push({ kind: 'good', title: 'Ван шань ван сян (旺山旺向)', text: 'Звезда горы периода у тыла, звезда воды периода у фасада. Лучшая схема: здоровье и благополучие поддержаны.' });
  } else if (f.mountain === period && s.water === period) {
    out.push({ kind: 'bad', title: 'Шан шань ся шуй (上山下水)', text: 'Звёзды периода поменялись местами: звезда горы у фасада, звезда воды у тыла. Нужна коррекция ландшафтом и планировкой.' });
  } else if (f.mountain === period && f.water === period) {
    out.push({ kind: 'mixed', title: 'Двойная звезда к фасаду (双星到向)', text: 'Обе звезды периода у фасада. Перед фасадом желательны и открытое пространство (вода), и дальняя опора (гора/постройка).' });
  } else if (s.mountain === period && s.water === period) {
    out.push({ kind: 'mixed', title: 'Двойная звезда к горе (双星到坐)', text: 'Обе звезды периода у тыла. За домом желательны и опора, и открытое пространство или вода.' });
  }

  const los = Object.keys(palaces);
  if (los.every((lo) => palaces[lo].base + palaces[lo].mountain === 10)) {
    out.push({ kind: 'good', title: 'Он-ши звезды горы (合十)', text: 'Во всех дворцах звезда горы с базовой дают 10.' });
  }
  if (los.every((lo) => palaces[lo].base + palaces[lo].water === 10)) {
    out.push({ kind: 'good', title: 'Он-ши звезды воды (合十)', text: 'Во всех дворцах звезда воды с базовой дают 10.' });
  }
  if (los.every((lo) => isPearlString(palaces[lo]))) {
    out.push({ kind: 'good', title: 'Жемчужная нить (连珠三般卦)', text: 'Во всех дворцах три звезды идут подряд.' });
  }
  if (los.every((lo) => isParentString(palaces[lo]))) {
    out.push({ kind: 'good', title: 'Родительская нить (父母三般卦)', text: 'Во всех дворцах звёзды из одной тройки 1-4-7, 2-5-8 или 3-6-9.' });
  }

  for (const [key, label] of [['mountain', 'горы'], ['water', 'воды']]) {
    const fl = chart.flight[key];
    if (fl.center === 5) {
      out.push(
        fl.forward
          ? { kind: 'mixed', title: `Фу инь звезды ${label} (伏吟)`, text: 'Пятёрка в центре летит прямо, звёзды возвращаются в свои дворцы. Во многих школах считается неблагоприятным — уточните у консультанта.' }
          : { kind: 'mixed', title: `Фань инь звезды ${label} (反吟)`, text: 'Пятёрка в центре летит обратно, звёзды встают в противоположные дворцы. Во многих школах считается неблагоприятным — уточните у консультанта.' },
      );
    }
  }
  return out;
}

function isPearlString({ base, mountain, water }) {
  const set = new Set([base, mountain, water]);
  if (set.size !== 3) return false;
  return [...set].some((n) => set.has(norm9(n + 1)) && set.has(norm9(n + 2)));
}

function isParentString({ base, mountain, water }) {
  return (base - 1) % 3 === (mountain - 1) % 3 && (base - 1) % 3 === (water - 1) % 3;
}

// Значения звёзд Сюань Кун (общие для 9-го периода и вне его) и типовые коррекции пяти элементов.
// meaning — общее значение, meaning9 — значение в 9-м периоде, remedy — коррекция (null — не нужна).
export const STARS = {
  1: {
    name: 'Тань-лан', color: 'Белая', element: 'Вода',
    meaning: 'рост, учёба, карьерное продвижение',
    meaning9: 'растущая звезда: доход и карьера ближайшего будущего, учёба, новые возможности',
    remedy: null,
    note: 'Коррекция не нужна; землю (керамику, камни) рядом лучше не добавлять — она гасит воду.',
  },
  2: {
    name: 'Цзюй-мэнь', color: 'Чёрная', element: 'Земля',
    meaning: 'здоровье: болезни и всё, что связано с медициной',
    meaning9: 'перспектива на дальний срок, медицина; для сна и активности пока рано',
    remedy: 'Ослабить землю металлом: шесть монет, тыква-горлянка, «соль, вода и монеты». Дерево не добавлять.',
  },
  3: {
    name: 'Лу-цунь', color: 'Нефритовая', element: 'Дерево',
    meaning: 'споры, ссоры, судебные разбирательства',
    meaning9: 'споры и конфликты',
    remedy: 'Ослабить дерево огнём: красный цвет, свечи, тёплый свет.',
  },
  4: {
    name: 'Вэнь-цюй', color: 'Зелёная', element: 'Дерево',
    meaning: 'учёба, творчество, романтические отношения',
    meaning9: 'учёба и творчество, но в 9-м периоде с оттенком неустойчивости в отношениях',
    remedy: 'Смягчить огнём: красные и тёплые оттенки.',
  },
  5: {
    name: 'Лянь-чжэнь', color: 'Жёлтая', element: 'Земля',
    meaning: 'препятствия, неудачи, тяжёлая атмосфера',
    meaning9: 'препятствия и неудачи — самая тяжёлая звезда',
    remedy: 'Ослабить землю металлом: металлическая музыка ветра (шесть трубочек), «соль, вода и монеты».',
  },
  6: {
    name: 'У-цюй', color: 'Белая', element: 'Металл',
    meaning: 'власть, авторитет; при плохом сочетании — проблемы с законом',
    meaning9: 'нейтральная: может дать и доход, и сложности с законом',
    remedy: 'Ослабить металл водой и деревом: несколько стеблей бамбука в вазе с водой.',
  },
  7: {
    name: 'По-цзюнь', color: 'Красная', element: 'Металл',
    meaning: 'потери, кражи, лишние траты',
    meaning9: 'потери и траты',
    remedy: 'Ослабить металл водой и деревом: несколько стеблей бамбука в вазе с водой.',
  },
  8: {
    name: 'Цзо-фу', color: 'Белая', element: 'Земля',
    meaning: 'богатство и стабильность',
    meaning9: 'уходящая звезда: доход ещё есть, но и расходы растут',
    remedy: null,
    note: 'Пока коррекция не нужна.',
  },
  9: {
    name: 'Ю-би', color: 'Фиолетовая', element: 'Огонь',
    meaning: 'радость, известность, будущее процветание',
    meaning9: 'правящая звезда: процветание, удача, доход сейчас',
    remedy: null,
    note: 'Коррекция не нужна.',
  },
};

/** Значение звезды в периоде (для 9-го — отдельное описание). */
export function starMeaning(n, period) {
  return period === 9 ? STARS[n].meaning9 : STARS[n].meaning;
}


/** Состояние звезды в периоде: правящая, растущая, уходящая или неблагоприятная. */
export function starTiming(star, period) {
  const diff = norm9(star - period + 1) - 1; // 0 — сама звезда периода
  if (diff === 0) return { key: 'wang', label: 'правящая' };
  if (diff === 1 || diff === 2) return { key: 'sheng', label: 'растущая' };
  if (diff === 8) return { key: 'tui', label: 'уходящая' };
  return { key: 'shuai', label: 'неблагоприятная' };
}

/** Период по году завершения строительства (смена в 2024 — 9-й). */
export function periodForYear(year) {
  return norm9(Math.floor((year - 1864) / 20) + 1);
}

// ---- План дома ----

// Внешние клетки сетки 3×3 по часовой стрелке, начиная с середины нижнего ряда.
const RING_FROM_BOTTOM = [[2, 1], [2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [1, 2], [2, 2]];

/**
 * Раскладка дворцов по плану дома: фасад всегда в середине нижнего ряда
 * (или верхнего при facadeTop), тыл — напротив. Остальные дворцы идут по часовой
 * стрелке в том же порядке, что и на компасе. Возвращает 3 ряда номеров Ло Шу.
 */
export function planLayout(chart, facadeTop = false) {
  const grid = [[0, 0, 0], [0, 5, 0], [0, 0, 0]];
  RING_FROM_BOTTOM.forEach(([r, c], k) => {
    const [row, col] = facadeTop ? [2 - r, 2 - c] : [r, c];
    grid[row][col] = PALACES[(chart.facing.palace + k) % 8].lo;
  });
  return grid;
}

// ---- Восемь дворцов (Ба Чжай) ----

export const EAST_GROUP = [1, 3, 4, 9];

export const BAZHAI_NAMES = [
  { key: 'shengqi', name: 'Шэн Ци', ru: 'процветание, успех', good: true },
  { key: 'tianyi', name: 'Тянь И', ru: 'здоровье', good: true },
  { key: 'yannian', name: 'Янь Нянь', ru: 'отношения, долголетие', good: true },
  { key: 'fuwei', name: 'Фу Вэй', ru: 'стабильность, развитие', good: true },
  { key: 'huohai', name: 'Хо Хай', ru: 'неудачи, мелкие потери', good: false },
  { key: 'wugui', name: 'У Гуй', ru: 'пять духов: ссоры, пожары', good: false },
  { key: 'liusha', name: 'Лю Ша', ru: 'шесть убийств: судебные дела, потери', good: false },
  { key: 'jueming', name: 'Цзюэ Мин', ru: 'полное бедствие', good: false },
];

// Направления в порядке BAZHAI_NAMES для каждого Гуа.
const BAZHAI_TABLE = {
  1: ['ЮВ', 'В', 'Ю', 'С', 'З', 'СВ', 'СЗ', 'ЮЗ'],
  2: ['СВ', 'З', 'СЗ', 'ЮЗ', 'В', 'ЮВ', 'Ю', 'С'],
  3: ['Ю', 'С', 'ЮВ', 'В', 'ЮЗ', 'СЗ', 'СВ', 'З'],
  4: ['С', 'Ю', 'В', 'ЮВ', 'СЗ', 'ЮЗ', 'З', 'СВ'],
  6: ['З', 'СВ', 'ЮЗ', 'СЗ', 'ЮВ', 'В', 'С', 'Ю'],
  7: ['СЗ', 'ЮЗ', 'СВ', 'З', 'С', 'Ю', 'ЮВ', 'В'],
  8: ['ЮЗ', 'СЗ', 'З', 'СВ', 'Ю', 'С', 'В', 'ЮВ'],
  9: ['В', 'ЮВ', 'С', 'Ю', 'СВ', 'З', 'ЮЗ', 'СЗ'],
};

export function groupOf(gua) {
  return EAST_GROUP.includes(gua) ? 'Восточная' : 'Западная';
}

/** Восемь направлений для Гуа: [{dir, name, ru, good}]. */
export function bazhaiDirections(gua) {
  return BAZHAI_TABLE[gua].map((dir, i) => ({ dir, ...BAZHAI_NAMES[i] }));
}

/** Дом Ба Чжай определяется по сидению (тылу). */
export function bazhaiHouse(facingAzimuth) {
  const sitting = mountainAt(facingAzimuth + 180);
  const palace = PALACES[sitting.palace];
  return {
    gua: palace.lo,
    palace,
    group: groupOf(palace.lo),
    directions: bazhaiDirections(palace.lo),
  };
}

/**
 * Число Гуа человека. Год считается по солнечному календарю (с Ли Чунь, ~4 февраля).
 * @param {string} birthDate 'ГГГГ-ММ-ДД'
 * @param {'m'|'f'} sex
 */
export function guaNumber(birthDate, sex) {
  const [y, m, d] = birthDate.split('-').map(Number);
  const beforeSpring = m === 1 || (m === 2 && d < 4);
  const year = beforeSpring ? y - 1 : y;
  const r = year % 9;
  let gua = sex === 'm' ? (11 - r) % 9 : (4 + r) % 9;
  if (gua === 0) gua = 9;
  if (gua === 5) gua = sex === 'm' ? 2 : 8;
  return {
    gua,
    solarYear: year,
    group: groupOf(gua),
    // Ли Чунь выпадает на 3–5 февраля, точный день зависит от года
    uncertain: m === 2 && d >= 3 && d <= 5,
  };
}
