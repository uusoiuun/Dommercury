// Цветовой круг Иттена: 12 оттенков, кольца от тёмного к пастели, схемы сочетаний
export const HUES = [
  ['Жёлтый', 52], ['Жёлто-оранжевый', 40], ['Оранжевый', 28], ['Красно-оранжевый', 14],
  ['Красный', 356], ['Красно-фиолетовый', 328], ['Фиолетовый', 280], ['Сине-фиолетовый', 248],
  ['Синий', 215], ['Сине-зелёный', 182], ['Зелёный', 140], ['Жёлто-зелёный', 82],
];
// Кольца снаружи внутрь: [название, насыщенность, светлота]
export const RINGS = [
  ['тёмный', 42, 24], ['глубокий', 58, 37], ['чистый', 74, 50],
  ['природный', 30, 56], ['светлый', 52, 73], ['пастель', 45, 87],
];
// Тёплая половина круга — от жёлтого до красно-фиолетового
export const isWarm = (i) => i <= 5;
export const SCHEMES = {
  analog: { name: 'Аналоговая', steps: [-1, 0, 1], about: 'Соседние цвета на круге — спокойно и мягко. Самая безопасная схема для дома.' },
  complement: { name: 'Комплементарная', steps: [0, 6], about: 'Цвет и его противоположность. Основной — природный, напротив — небольшой акцент.' },
  split: { name: 'Раздельно-комплементарная', steps: [0, 5, 7], about: 'Вместо противоположного — два его соседа. Контрастно, но не так резко.' },
  triad: { name: 'Триада', steps: [0, 4, 8], about: 'Три цвета через равные промежутки. Живо — берите приглушённые и светлые кольца.' },
  rect: { name: 'Тетрада', steps: [0, 2, 6, 8], about: 'Две пары противоположных цветов: один основной, два дополняющих, один акцент.' },
  square: { name: 'Квадрат', steps: [0, 3, 6, 9], about: 'Четыре цвета на равном расстоянии. Для дома — только в приглушённых тонах.' },
};
export const color = (hi, ri) => `hsl(${HUES[hi][1]} ${RINGS[ri][1]}% ${RINGS[ri][2]}%)`;
export const schemeHues = (base, key) => SCHEMES[key].steps.map((s) => ((base + s) % 12 + 12) % 12);

const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
function sector(r0, r1, a0, a1) {
  const [x0, y0] = polar(r1, a0); const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1); const [x3, y3] = polar(r0, a0);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r1} ${r1} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r0} ${r0} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
}

// SVG круга; base — выбранный оттенок, ring — выбранное кольцо, scheme — ключ схемы
export function wheelSvg(base, ring, scheme) {
  const R = 150; const hole = 34; const band = (R - hole) / RINGS.length;
  const step = (Math.PI * 2) / 12; const start = -Math.PI / 2 - step / 2;
  const parts = [];
  HUES.forEach((h, i) => {
    RINGS.forEach((rg, j) => {
      const r1 = R - j * band; const r0 = r1 - band;
      parts.push(`<path d="${sector(r0, r1, start + i * step, start + (i + 1) * step)}" fill="${color(i, j)}" data-hue="${i}" data-ring="${j}" class="cw-cell"><title>${h[0]}, ${rg[0]}</title></path>`);
    });
  });
  const hues = schemeHues(base, scheme);
  const rMid = R - ring * band - band / 2;
  const pts = hues.map((i) => polar(rMid, start + (i + 0.5) * step));
  const line = pts.length > 2 ? `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" class="cw-line"/>` : `<polyline points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" class="cw-line"/>`;
  const dots = pts.map(([x, y], k) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${k === 0 ? 7 : 5}" class="cw-dot${k === 0 ? ' base' : ''}"/>`).join('');
  // Граница тёплых и холодных: между красно-фиолетовым и фиолетовым и между жёлто-зелёным и жёлтым
  const cut = [start + 6 * step, start].map((a) => polar(R + 14, a));
  const split = `<line x1="${cut[0][0].toFixed(1)}" y1="${cut[0][1].toFixed(1)}" x2="${cut[1][0].toFixed(1)}" y2="${cut[1][1].toFixed(1)}" class="cw-split"/>`;
  const lbl = `<text x="${R + 10}" y="${-R + 4}" class="cw-lbl" text-anchor="end">тёплые</text><text x="${-R - 10}" y="${R + 4}" class="cw-lbl">холодные</text>`;
  return `<svg viewBox="${-R - 20} ${-R - 20} ${2 * R + 40} ${2 * R + 40}" class="cw-svg" role="img" aria-label="Цветовой круг Иттена">${parts.join('')}<circle r="${hole}" fill="#fbf9f3"/>${split}${line}${dots}${lbl}</svg>`;
}

// Веер оттенков одного цвета: от пастели к тёмному
export function fanSvg(hi) {
  const n = 9; const w = 300; const h = 170; const cx = w / 2; const cy = h - 8; const L = 150;
  const blades = [];
  for (let k = 0; k < n; k++) {
    const a = Math.PI + (Math.PI * (k + 0.5)) / n;
    const light = 90 - k * 8.5; const sat = 30 + Math.sin((k / (n - 1)) * Math.PI) * 40;
    const rot = (a * 180) / Math.PI + 90;
    blades.push(`<g transform="translate(${cx} ${cy}) rotate(${rot.toFixed(1)})"><rect x="-13" y="${-L}" width="26" height="${L - 14}" rx="7" fill="hsl(${HUES[hi][1]} ${sat.toFixed(0)}% ${light.toFixed(0)}%)" stroke="rgba(0,0,0,.12)"/></g>`);
  }
  return `<svg viewBox="0 0 ${w} ${h}" class="cw-fan" role="img" aria-label="Веер оттенков: ${HUES[hi][0]}">${blades.join('')}<circle cx="${cx}" cy="${cy}" r="9" fill="#6b6e3a"/></svg>`;
}
