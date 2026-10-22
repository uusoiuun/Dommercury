// Конструктор ландшафтного озеленения: элементы участка и их оценка
// по летящим звёздам сектора и по климату Якутска.
import { PALACES, starTiming } from './fengshui.js';

// Категории: mountain — высокое и тяжёлое («гора»), water — вода, open — открытое место,
// neutral — без влияния, gate — ворота и калитка, flush — то, что «смывает» (септик).
export const ELEMENTS = [
  { key: 'conifer', label: 'Хвойное дерево', short: 'Хв', cat: 'mountain', tall: true, plant: true, r: 2.5, color: '#2f6b4f' },
  { key: 'tree', label: 'Лиственное дерево', short: 'Дер', cat: 'mountain', tall: true, plant: true, r: 2.5, color: '#6a9a3a' },
  { key: 'shrub', label: 'Кустарник', short: 'Куст', cat: 'mountain', plant: true, r: 1.2, color: '#8bb35a' },
  { key: 'hedge', label: 'Живая изгородь', short: 'Изг', cat: 'mountain', plant: true, r: 1.5, color: '#4f8a4a' },
  { key: 'rock', label: 'Камни, горка', short: 'Кам', cat: 'mountain', r: 1.5, color: '#8a8478' },
  { key: 'bath', label: 'Баня', short: 'Баня', cat: 'mountain', tall: true, building: true, r: 3, color: '#9a6b45' },
  { key: 'shed', label: 'Сарай, дровник', short: 'Сар', cat: 'mountain', building: true, r: 2.5, color: '#86705a' },
  { key: 'garage', label: 'Гараж', short: 'Гар', cat: 'mountain', tall: true, building: true, r: 3.5, color: '#6f6a64' },
  { key: 'pond', label: 'Пруд', short: 'Пруд', cat: 'water', r: 2.5, color: '#3a8ad6' },
  { key: 'fountain', label: 'Фонтан, ручей', short: 'Фон', cat: 'water', r: 1.2, color: '#4aa3e0' },
  { key: 'lawn', label: 'Газон, площадка', short: 'Газ', cat: 'open', r: 3, color: '#a7c96b' },
  { key: 'gazebo', label: 'Беседка', short: 'Бес', cat: 'open', r: 2, color: '#c79a5b' },
  { key: 'flowers', label: 'Цветник', short: 'Цв', cat: 'neutral', plant: true, r: 1.5, color: '#d9708f' },
  { key: 'greenhouse', label: 'Теплица', short: 'Тепл', cat: 'neutral', r: 2.5, color: '#9fd3c7' },
  { key: 'gate', label: 'Ворота, калитка', short: 'Вор', cat: 'gate', r: 1.2, color: '#b23a2b' },
  { key: 'septic', label: 'Септик', short: 'Сеп', cat: 'flush', r: 1.2, color: '#7b6f9e' },
];

export const ELEMENT_BY_KEY = Object.fromEntries(ELEMENTS.map((e) => [e.key, e]));

const norm360 = (a) => ((a % 360) + 360) % 360;
const angleDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

/** Сектор компаса (из 8) по азимуту от центра дома. */
export function sectorOf(bearing) {
  return PALACES[Math.round(norm360(bearing) / 45) % 8];
}

/** Сторона света по истинному азимуту: С, СВ, … */
export function trueDir(bearing) {
  return PALACES[Math.round(norm360(bearing) / 45) % 8].dir;
}

// Благоприятность звезды: good — 9 и 1 в 9-м периоде (своя и растущая),
// ok — нейтральные (8 и 6), mid — 2 (растущая, но спорная), bad — 3, 4, 5, 7.
export function starRank(n, period = 9) {
  if (period === 9) {
    if (n === 9 || n === 1) return 'good';
    if (n === 8 || n === 6) return 'ok';
    if (n === 2) return 'mid';
    return 'bad';
  }
  const t = starTiming(n, period).key;
  if (t === 'wang') return 'good';
  if (t === 'sheng') return n === 2 || n === 5 ? 'mid' : 'good';
  if (t === 'tui') return 'ok';
  return 'bad';
}

const GOOD = (r) => r === 'good';
const POOR = (r) => r === 'bad' || r === 'mid';

/**
 * Оценка элемента участка.
 * ctx: { mountain, water, period, bearing (истинный азимут от центра дома),
 *        dist (м от центра дома), houseR (полудиагональ дома, м), doorBearing }
 * Возвращает { level: good|ok|mixed|bad, notes: [строки] }.
 */
export function evaluate(el, ctx) {
  const e = typeof el === 'string' ? ELEMENT_BY_KEY[el] : el;
  const m = starRank(ctx.mountain, ctx.period);
  const w = starRank(ctx.water, ctx.period);
  const notes = [];
  let score = 0;

  switch (e.cat) {
    case 'water':
      if (GOOD(w)) { score += 2; notes.push(`Вода активирует благоприятную водную ${ctx.water}.`); }
      else if (w === 'ok') { notes.push(`Водная ${ctx.water} нейтральна: вода здесь допустима, но мало что даёт.`); }
      else { score -= 2; notes.push(`Водная ${ctx.water} неблагоприятна: вода её усилит.`); }
      if (GOOD(m) && !GOOD(w)) { score -= 2; notes.push(`Горная ${ctx.mountain} «уходит под воду»: здесь нужна возвышенность, а не водоём.`); }
      else if (GOOD(m)) notes.push(`Горная ${ctx.mountain} тоже хорошая — поставьте за водой камни или деревья.`);
      break;
    case 'mountain':
      if (GOOD(m)) { score += 2; notes.push(`Высокое и тяжёлое поддерживает горную ${ctx.mountain}.`); }
      else if (m === 'ok') notes.push(`Горная ${ctx.mountain} нейтральна.`);
      else if (e.tall || e.building) { score -= 1; notes.push(`Горная ${ctx.mountain} неблагоприятна: крупный объём её усиливает.`); }
      if (GOOD(w) && (e.tall || e.building || e.key === 'hedge')) {
        score -= GOOD(m) ? 1 : 2;
        notes.push(`Перекрывает благоприятную водную ${ctx.water}: здесь лучше открытое пространство${GOOD(m) ? '; ставьте подальше от дома' : ''}.`);
      }
      break;
    case 'open':
      if (GOOD(w)) { score += 2; notes.push(`Открытое место собирает благоприятную водную ${ctx.water}.`); }
      else if (POOR(w)) notes.push(`Водная ${ctx.water} неблагоприятна — место для отдыха лучше перенести.`);
      if (e.key === 'gazebo' && POOR(w)) score -= 1;
      break;
    case 'gate':
      if (GOOD(w)) { score += 2; notes.push(`Вход на участок через благоприятную водную ${ctx.water}.`); }
      else if (w === 'ok') notes.push(`Водная ${ctx.water} нейтральна.`);
      else { score -= 2; notes.push(`Вход через неблагоприятную водную ${ctx.water}: лучше в сектор водной 9 или 1.`); }
      break;
    case 'flush':
      if (POOR(w)) { score += 1; notes.push(`Септик «смывает» неблагоприятную водную ${ctx.water}.`); }
      else if (GOOD(w)) { score -= 2; notes.push(`Септик «смывает» благоприятную водную ${ctx.water} — перенесите.`); }
      if (GOOD(m)) { score -= 1; notes.push(`Не ставьте септик в сектор горной ${ctx.mountain}.`); }
      break;
    default:
      notes.push('На звёзды почти не влияет.');
  }

  // Климат и мерзлота Якутска
  const dir = trueDir(ctx.bearing);
  const gap = ctx.dist - (ctx.houseR || 0);
  if (e.tall && ['Ю', 'ЮВ', 'ЮЗ'].includes(dir) && gap < 15) {
    score -= 1;
    notes.push('С юга близко к дому: зимой солнце низкое, тень закроет окна. Отнесите дальше 15 м или выберите низкое растение.');
  }
  if ((e.tall || e.key === 'hedge') && ['С', 'СЗ', 'З', 'СВ'].includes(dir)) {
    score += 1;
    notes.push('Защищает от холодного ветра с севера и запада.');
  }
  if (e.key === 'greenhouse') {
    if (['Ю', 'ЮВ', 'ЮЗ'].includes(dir)) { score += 1; notes.push('Теплица на юге — больше солнца.'); }
    else if (['С', 'СВ', 'СЗ'].includes(dir)) { score -= 1; notes.push('На севере теплице не хватит солнца, переставьте на юг.'); }
  }
  if (e.cat === 'water' && gap < 10) {
    score -= 1;
    notes.push('Ближе 10 м к дому: вода отепляет мерзлоту под фундаментом. Отнесите дальше.');
  }
  if (e.cat === 'flush' && gap < 8) {
    score -= 1;
    notes.push('Септик ближе 8 м к дому: на мерзлоте держите его дальше.');
  }
  if (e.tall && ctx.doorBearing != null && angleDiff(ctx.bearing, ctx.doorBearing) < 15 && gap < 12) {
    score -= 1;
    notes.push('Стоит прямо перед входной дверью и закрывает её.');
  }

  const level = score >= 2 ? 'good' : score >= 0 ? 'ok' : score === -1 ? 'mixed' : 'bad';
  return { level, notes };
}

/**
 * Что посадить и поставить в каждом секторе.
 * palaces: { ло шу: { mountain, water } }; shift — поправка «азимут расчёта → истинный».
 */
export function sectorAdvice(palaces, period = 9, shift = 0) {
  return PALACES.map((p, k) => {
    const s = palaces[p.lo];
    const m = starRank(s.mountain, period);
    const w = starRank(s.water, period);
    const dir = trueDir(45 * k + shift);
    const put = [];
    const avoid = [];
    if (GOOD(w)) { put.push('пруд или фонтан, ворота, газон, беседка'); avoid.push('высокие деревья и постройки близко к дому'); }
    if (GOOD(m)) { put.push('хвойные, камни, баня или гараж'); if (!GOOD(w)) avoid.push('водоёмы'); }
    if (POOR(w) && !GOOD(m)) { put.push('септик, дровник, плотные посадки'); avoid.push('ворота и вода'); }
    if (m === 'ok' && w === 'ok') put.push('цветник, кустарник');
    if (['С', 'СЗ', 'З', 'СВ'].includes(dir)) put.push('ветрозащита: ряд лиственниц или елей');
    if (['Ю', 'ЮВ', 'ЮЗ'].includes(dir)) { put.push('теплица, грядки'); avoid.push('высокие деревья ближе 15 м'); }
    return { palace: p, dir, mountain: s.mountain, water: s.water, put: [...new Set(put)], avoid: [...new Set(avoid)] };
  });
}

// Растения, которые растут в Якутске (зона 1–2 морозостойкости)
export const PLANTS = [
  { group: 'Деревья', items: ['лиственница даурская', 'сосна обыкновенная', 'ель сибирская', 'берёза плосколистная', 'черёмуха', 'рябина сибирская', 'тополь душистый'] },
  { group: 'Кустарники', items: ['шиповник иглистый', 'жимолость', 'смородина', 'облепиха', 'спирея', 'кизильник черноплодный', 'ива'] },
  { group: 'Цветы и травы', items: ['иван-чай', 'лилия даурская', 'ирис', 'мак голостебельный', 'пион', 'бадан'] },
];
