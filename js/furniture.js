// Мебель, которую клиент сам добавляет на план: каталог по комнатам и отрисовка.
// Размеры — в метрах: w — ширина (вдоль стены), d — глубина.

export const FURNITURE = [
  // Кухня — минимальный набор
  { key: 'kCabinets', cat: 'kitchen', label: 'Кухонные шкафы', short: 'Шкафы', w: 2.4, d: 0.6, draw: 'counter' },
  { key: 'fridge', cat: 'kitchen', label: 'Холодильник', short: 'Хол.', w: 0.6, d: 0.65, draw: 'fridge' },
  { key: 'stove', cat: 'kitchen', label: 'Плита', short: 'Плита', w: 0.6, d: 0.6, draw: 'stove' },
  { key: 'diningTable', cat: 'kitchen', label: 'Обеденный стол', short: 'Стол', w: 1.2, d: 0.8, draw: 'table' },
  { key: 'chair', cat: 'kitchen', label: 'Стул', short: '', w: 0.45, d: 0.45, draw: 'chair' },
  // Гостиная
  { key: 'sofa2', cat: 'living', label: 'Диван 2-местный', short: 'Диван', w: 1.6, d: 0.9, draw: 'sofa' },
  { key: 'sofa3', cat: 'living', label: 'Диван 3-местный', short: 'Диван', w: 2.2, d: 0.95, draw: 'sofa' },
  { key: 'tv', cat: 'living', label: 'Телевизор', short: 'ТВ', w: 1.2, d: 0.12, draw: 'tv' },
  { key: 'tvStand', cat: 'living', label: 'Тумба под ТВ', short: 'Тумба', w: 1.6, d: 0.45, draw: 'box' },
  { key: 'armchair', cat: 'living', label: 'Кресло', short: '', w: 0.85, d: 0.85, draw: 'armchair' },
  // Спальня
  { key: 'bed160', cat: 'bedroom', label: 'Кровать 160 см', short: '160', w: 1.6, d: 2.0, draw: 'bed' },
  { key: 'bed180', cat: 'bedroom', label: 'Кровать 180 см', short: '180', w: 1.8, d: 2.0, draw: 'bed' },
  { key: 'nightstand', cat: 'bedroom', label: 'Тумбочка', short: '', w: 0.45, d: 0.4, draw: 'box' },
  { key: 'rug', cat: 'bedroom', label: 'Ковёр', short: 'Ковёр', w: 2.0, d: 1.4, draw: 'rug' },
  { key: 'wardrobe', cat: 'bedroom', label: 'Шкаф', short: 'Шкаф', w: 1.8, d: 0.6, draw: 'wardrobe' },
  // Детская
  { key: 'desk', cat: 'kids', label: 'Письменный стол', short: 'Стол', w: 1.2, d: 0.6, draw: 'table' },
  { key: 'kidChair', cat: 'kids', label: 'Стул', short: '', w: 0.45, d: 0.45, draw: 'chair' },
  { key: 'kidWardrobe', cat: 'kids', label: 'Шкаф', short: 'Шкаф', w: 1.2, d: 0.6, draw: 'wardrobe' },
  { key: 'bed90', cat: 'kids', label: 'Кровать 90 см', short: '90', w: 0.9, d: 2.0, draw: 'bed' },
  // Санузел
  { key: 'bath', cat: 'bathroom', label: 'Ванна', short: 'Ванна', w: 1.7, d: 0.75, draw: 'bath' },
  { key: 'sink', cat: 'bathroom', label: 'Раковина', short: '', w: 0.6, d: 0.45, draw: 'sink' },
  { key: 'toilet', cat: 'bathroom', label: 'Унитаз', short: '', w: 0.4, d: 0.65, draw: 'toilet' },
  // Отдельный туалет
  { key: 'wcToilet', cat: 'wc', label: 'Унитаз', short: '', w: 0.4, d: 0.65, draw: 'toilet' },
  { key: 'miniSink', cat: 'wc', label: 'Мини-раковина', short: '', w: 0.4, d: 0.3, draw: 'sink' },
];
export const FURN_BY_KEY = Object.fromEntries(FURNITURE.map((f) => [f.key, f]));

export const FURN_CATS = [
  ['kitchen', 'Кухня'],
  ['living', 'Гостиная'],
  ['bedroom', 'Спальня'],
  ['kids', 'Детская'],
  ['bathroom', 'Санузел'],
  ['wc', 'Отдельный туалет'],
];

/**
 * Предмет мебели на плане. c — центр в пикселях, s — пикселей в метре,
 * rot — поворот по часовой. Задняя сторона предмета (у стены) — верхняя.
 */
export function furnSvg(def, c, s, rot = 0, attrs = '') {
  const w = def.w * s;
  const d = def.d * s;
  const x = -w / 2;
  const y = -d / 2;
  const p = [];
  const R = (xx, yy, ww, hh, cls = 'uf', rx = 0) => `<rect class="${cls}" x="${xx}" y="${yy}" width="${ww}" height="${hh}" rx="${rx}"/>`;
  switch (def.draw) {
    case 'bed': {
      p.push(R(x, y, w, d, 'uf', 2));
      const pw = Math.min(w / 2 - 2, s * 0.6);
      if (def.w > 1.2) p.push(R(x + w / 2 - pw - 1, y + 2, pw, s * 0.3, 'uf-soft', 3), R(x + w / 2 + 1, y + 2, pw, s * 0.3, 'uf-soft', 3));
      else p.push(R(x + 2, y + 2, w - 4, s * 0.3, 'uf-soft', 3));
      p.push(`<line class="uf-line" x1="${x}" y1="${y + d * 0.35}" x2="${x + w}" y2="${y + d * 0.35}"/>`);
      break;
    }
    case 'sofa':
      p.push(R(x, y, w, d, 'uf', 3), R(x, y, w, d * 0.28, 'uf-soft', 2), R(x, y, s * 0.18, d, 'uf-soft', 2), R(x + w - s * 0.18, y, s * 0.18, d, 'uf-soft', 2));
      break;
    case 'armchair':
      p.push(R(x, y, w, d, 'uf', 3), R(x, y, w, d * 0.3, 'uf-soft', 2), R(x, y, w * 0.2, d, 'uf-soft', 2), R(x + w * 0.8, y, w * 0.2, d, 'uf-soft', 2));
      break;
    case 'bath':
      p.push(R(x, y, w, d, 'uf', 3), R(x + 3, y + 3, w - 6, d - 6, 'uf-soft', Math.min(w, d) / 2.5));
      break;
    case 'sink':
      p.push(R(x, y, w, d, 'uf', 2), `<ellipse class="uf-soft" cx="0" cy="${d * 0.08}" rx="${w * 0.32}" ry="${d * 0.3}"/>`);
      break;
    case 'toilet':
      p.push(R(x, y, w, d * 0.32, 'uf', 2), `<ellipse class="uf" cx="0" cy="${y + d * 0.62}" rx="${w * 0.45}" ry="${d * 0.36}"/>`);
      break;
    case 'stove':
      p.push(R(x, y, w, d, 'uf', 1));
      for (const [ix, iy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.push(`<circle class="uf-line" cx="${ix * w * 0.22}" cy="${iy * d * 0.22}" r="${Math.min(w, d) * 0.14}" fill="none"/>`);
      break;
    case 'fridge':
      p.push(R(x, y, w, d, 'uf', 1), `<line class="uf-line" x1="${x}" y1="${y}" x2="${x + w}" y2="${y + d}"/><line class="uf-line" x1="${x + w}" y1="${y}" x2="${x}" y2="${y + d}"/>`);
      break;
    case 'counter':
      p.push(R(x, y, w, d, 'uf', 1));
      for (let k = 1; k < Math.round(def.w / 0.6); k++) p.push(`<line class="uf-line" x1="${x + (k * w) / Math.round(def.w / 0.6)}" y1="${y}" x2="${x + (k * w) / Math.round(def.w / 0.6)}" y2="${y + d}"/>`);
      break;
    case 'wardrobe':
      p.push(R(x, y, w, d, 'uf', 1), `<line class="uf-line" x1="${x}" y1="${y + d / 2}" x2="${x + w}" y2="${y + d / 2}"/>`);
      break;
    case 'tv':
      p.push(R(x, y, w, Math.max(2, d), 'uf-dark', 1));
      break;
    case 'rug':
      p.push(R(x, y, w, d, 'uf-rug', 4));
      break;
    case 'table':
      p.push(R(x, y, w, d, 'uf', 2));
      break;
    case 'chair':
      p.push(R(x, y, w, d, 'uf', 2), R(x, y, w, d * 0.22, 'uf-soft', 1));
      break;
    default:
      p.push(R(x, y, w, d, 'uf', 1));
  }
  const fs = Math.max(6, Math.min(10, s * 0.28));
  if (def.short && Math.max(w, d) > fs * def.short.length * 0.55) {
    // Подпись всегда горизонтальная
    p.push(`<text class="uf-label" x="0" y="${fs * 0.35}" font-size="${fs}" text-anchor="middle" transform="rotate(${-rot})">${def.short}</text>`);
  }
  return `<g class="ufurn" transform="translate(${c[0]} ${c[1]}) rotate(${rot})" ${attrs}><title>${def.label}</title>${p.join('')}</g>`;
}
