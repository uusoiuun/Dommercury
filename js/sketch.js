// Рисунок композиции «от руки»: тушь, акварельная заливка и штриховка на бумаге.
// Каждое растение рисуется по своему облику (крона, побеги, колос, метёлка, злак, ковёр),
// поэтому дерен узнаётся по красным прутьям, очиток — по плоским соцветиям и т. д.

const INK = '#3b3328';
const FOLIAGE = ['#6f8f4e', '#7d9a55', '#5f7f48', '#86a35e', '#688a58'];

// Повторяемая «случайность»: одно и то же растение всегда нарисовано одинаково
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (str) => [...str].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

const f1 = (v) => Math.round(v * 10) / 10;
function mix(hex, to, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex);
  const b = p(to);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}
const dark = (c, k = 0.35) => mix(c, '#1e1a12', k);
const light = (c, k = 0.4) => mix(c, '#fbf6ea', k);

// Облик растения
const HABIT = {
  tree: ['betula', 'padus', 'crataegus', 'malus', 'malusDec'],
  spruce: ['picea', 'larix'],
  pine: ['pinus'],
  yew: ['taxus'],
  creeper: ['juniper'],
  stems: ['cornus', 'cornusSton', 'salix', 'salixPurp'],
  panicle: ['syringa', 'syringaVulg', 'syringaMeyer', 'sorbaria', 'hydrangeaPan'],
  bloomShrub: ['spiraea', 'spiraeaCham', 'spiraeaJap', 'spiraeaVan', 'philadelphus', 'potentilla', 'rosaAcic', 'rosaCanina', 'rosaPark', 'caragana', 'rhododendron', 'hydrangeaArb', 'amelanchier', 'ledum'],
  berry: ['lonicera', 'ribes', 'hippophae', 'prunus', 'rubus', 'rubusRem', 'viburnum', 'cotoneaster', 'sorbocot', 'berberis'],
  leafShrub: ['physocarpus'],
  spike: ['delphinium', 'salvia', 'nepeta', 'artemisiaDrac'],
  plume: ['astilbe', 'aruncus', 'filipendula', 'phloxPan'],
  sword: ['irisSib', 'irisBarb', 'hemerocallis', 'leek'],
  daisy: ['echinacea', 'rudbeckia', 'chrysanthemum', 'adonis', 'geranium', 'pulsatilla', 'primula', 'borago', 'trollius', 'aquilegia'],
  umbel: ['sedum', 'achillea'],
  leafy: ['hosta', 'bergenia', 'heuchera'],
  peony: ['paeonia'],
  pompon: ['armeria', 'alliumSch'],
  herb: ['melissa', 'mentha', 'origanum', 'ocimum'],
  tuft: ['festuca'],
  fountain: ['deschampsia', 'stipa', 'bromus'],
  rosette: ['sempervivum', 'orostachys'],
  carpet: ['phloxSub', 'thymus', 'sagina', 'trifolium', 'vinca'],
  lantern: ['lantern'],
};
// Осенний цвет листвы
const AUTUMN = {
  berberis: '#c8402a', sorbusSib: '#d8602a', sorbocot: '#c8502a', cotoneaster: '#d0602a', crataegus: '#c85a2a', rosaRugosa: '#d8a030',
  rosaAcic: '#c8602a', betula: '#e8c040', populusBer: '#e0c040', populusSuav: '#e0c040', larix: '#e0b030', padus: '#c8a040',
  padusMaackii: '#d0a838', malus: '#d0a040', malusPurp: '#a03a3a', syringa: '#a8a050', caragana: '#e0c050', sorbaria: '#c8a040', viburnum: '#b0303a',
  amelanchier: '#d8582a', spiraeaJap: '#d07030', physocarpus: '#a0302a', hippophae: '#c0b070',
};
const HABIT_OF = Object.fromEntries(Object.entries(HABIT).flatMap(([h, keys]) => keys.map((k) => [k, h])));
const habitOf = (pl) => HABIT_OF[pl.key] || (pl.group === 'tree' ? 'tree' : pl.group === 'grass' ? 'fountain' : pl.group === 'ground' ? 'carpet' : pl.group === 'herb' ? 'herb' : ['shrub', 'fruit'].includes(pl.group) ? 'bloomShrub' : 'daisy');

// Крона «облачком»: волнистый контур из полукружий
function cloud(cx, cy, rx, ry, rnd, n = 9, bulge = 0.3) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
    const r = 1 + (rnd() - 0.5) * 0.18;
    pts.push([a, r]);
  }
  const P = ([a, r], m = 1) => [cx + Math.cos(a) * rx * r * m, cy + Math.sin(a) * ry * r * m];
  let d = `M${P(pts[0]).map(f1).join(' ')}`;
  for (let k = 0; k < n; k++) {
    const p = pts[k];
    const q = pts[(k + 1) % n];
    const am = q[0] < p[0] ? (p[0] + q[0] + Math.PI * 2) / 2 : (p[0] + q[0]) / 2;
    const c = P([am, (p[1] + q[1]) / 2], 1 + bulge);
    d += ` Q${f1(c[0])} ${f1(c[1])} ${P(q).map(f1).join(' ')}`;
  }
  return `${d} Z`;
}

// Штриховка тени: короткие косые линии в правой нижней части овала
function hatch(cx, cy, rx, ry, rnd, density = 1, from = -0.1) {
  const out = [];
  const step = Math.max(2.6, Math.min(rx, ry) / (5 * density));
  for (let o = -rx - ry; o < rx + ry; o += step) {
    // Прямая x - cx + (y - cy)·k = o, наклон 45°; пересечение с эллипсом
    const pts = [];
    for (let t = -1; t <= 1; t += 0.04) {
      const x = cx + t * rx;
      const y = cy + (o - t * rx);
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 0.82) pts.push([x, y]);
    }
    if (pts.length < 2) continue;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    if ((mx - cx) / rx + (my - cy) / ry < from) continue;
    const sh = 0.15 + rnd() * 0.2;
    out.push(`M${f1(a[0] + (b[0] - a[0]) * sh)} ${f1(a[1] + (b[1] - a[1]) * sh)} L${f1(b[0] - (b[0] - a[0]) * 0.1)} ${f1(b[1] - (b[1] - a[1]) * 0.1)}`);
  }
  return out.length ? `<path class="sk-hatch" d="${out.join(' ')}"/>` : '';
}

// Листик-миндалина
function leafPath(x, y, len, wid, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const p = (u, v) => `${f1(x + u * c - v * s)} ${f1(y + u * s + v * c)}`;
  return `M${p(0, 0)} Q${p(len / 2, -wid)} ${p(len, 0)} Q${p(len / 2, wid)} ${p(0, 0)} Z`;
}

// Под заливкой — силуэт цвета бумаги: растение спереди закрывает то, что за ним, а не смешивается в грязь
const PAPER = '#f7f1e3';
const wash = (d, col, op = 0.62) => `<path d="${d}" fill="${PAPER}"/><path d="${d}" fill="${col}" fill-opacity="${op}" stroke="${col}" stroke-opacity="0.5" stroke-width="1.2"/>`;
const ink = (d, w = 1, dash = '') => `<path class="sk-ink" d="${d}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const dot = (x, y, r, col, op = 0.9) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${col}" fill-opacity="${op}"/>`;
const sketchDash = (rnd) => `${Math.round(40 + rnd() * 60)} ${Math.round(3 + rnd() * 5)} ${Math.round(20 + rnd() * 40)} ${Math.round(2 + rnd() * 4)}`;

// Цветки поверх листвы: точки-соцветия с тушевым кружком у части из них
function blossoms(cx, cy, rx, ry, n, r, col, rnd, W, I) {
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * 0.85;
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d - ry * 0.1;
    W.push(dot(x, y, Math.min(4, r) * (0.8 + rnd() * 0.5), col));
    if (rnd() < 0.35) I.push(`<circle class="sk-ink" cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 0.9)}" stroke-width="0.6"/>`);
  }
}

// Куст-шар: листва облачком, тень штрихом, контур тушью
function bush(cx, base, wd, h, leaf, rnd, W, I) {
  const cy = base - h / 2;
  const d = cloud(cx, cy, wd / 2, h / 2, rnd, 10);
  W.push(wash(d, leaf), wash(cloud(cx - wd * 0.12, cy - h * 0.12, wd * 0.3, h * 0.28, rnd, 7), light(leaf, 0.35), 0.5),
    wash(cloud(cx + wd * 0.14, cy + h * 0.14, wd * 0.3, h * 0.26, rnd, 7), dark(leaf, 0.25), 0.45));
  I.push(ink(d, 1.1, sketchDash(rnd)), hatch(cx, cy, wd / 2, h / 2, rnd));
  return cy;
}

/**
 * Растение pl в профиль: x — центр, base — земля, s — пикселей в метре.
 * look — вид в определённую декаду { flower, fruit, fcol, rcol }: без него растение нарисовано в цвету.
 * Возвращает { wash, ink } — акварельный слой и слой туши.
 */
export function sketchPlant(pl, x, base, s, salt = 0, look = null) {
  const rnd = rng(seedOf(pl.key) + salt * 101);
  const W = [];
  const I = [];
  // Цветы — только в своё время; ягоды — в сезон плодов
  const fl = !look || look.flower;
  const col = look ? look.fcol || pl.color : pl.color;
  const fruit = look?.fruit ? look.rcol : null;
  // Размер цветков по стадии: бутон → раскрытый → увядающий; ягоды наливаются
  const fs = look ? 0.3 + 0.7 * (look.amt ?? (look.flower ? 1 : 0)) : 1;
  const fr = 0.4 + 0.6 * (look?.famt ?? 1);
  const berries = (cx, cy, rx, ry, n, r) => { if (fruit) blossoms(cx, cy, rx, ry, n, r * fr, fruit, rnd, W, I); };
  let leaf = FOLIAGE[seedOf(pl.key) % FOLIAGE.length];
  // Листва по сезону: в начале мая только распускается (бледная), в сентябре желтеет и краснеет
  const spring = look?.day != null ? Math.max(0, 1 - look.day / 24) : 0;
  const autumn = look?.day != null ? Math.max(0, (look.day - 112) / 41) : 0;
  if (spring) leaf = mix(leaf, '#e4ead0', spring * 0.75);
  if (autumn) leaf = mix(leaf, AUTUMN[pl.key] || '#d4b040', autumn * (['tree', 'shrub', 'fruit'].includes(pl.group) ? 0.85 : 0.45));
  const h = Math.max(16, pl.h * s);
  const habit = habitOf(pl);
  // Ширина — по кроне, но не шире разумного относительно высоты: низкие растения в укрупнённом
  // масштабе иначе расползаются на полкартинки
  const wd = (k, rel = 1.6) => Math.max(18, Math.min(pl.r * 2 * s * k, Math.max(h * rel, 40), 190));

  if (habit === 'lantern') {
    // Японский каменный фонарь (торо): основание, столб, площадка, камера с окошком, крыша с загнутыми углами, навершие
    const H = Math.max(30, h);
    const stone = '#a8a49a';
    const y = (k) => base - H * k;
    const box = (w2, y1, y2) => `M${f1(x - w2)} ${f1(y(y1))} L${f1(x + w2)} ${f1(y(y1))} L${f1(x + w2 * 0.96)} ${f1(y(y2))} L${f1(x - w2 * 0.96)} ${f1(y(y2))} Z`;
    const parts = [box(H * 0.28, 0, 0.08), box(H * 0.075, 0.08, 0.45), box(H * 0.21, 0.45, 0.52), box(H * 0.15, 0.52, 0.72)];
    const roof = `M${f1(x - H * 0.34)} ${f1(y(0.76))} Q${f1(x - H * 0.2)} ${f1(y(0.74))} ${f1(x - H * 0.12)} ${f1(y(0.84))} L${f1(x + H * 0.12)} ${f1(y(0.84))} Q${f1(x + H * 0.2)} ${f1(y(0.74))} ${f1(x + H * 0.34)} ${f1(y(0.76))} L${f1(x + H * 0.3)} ${f1(y(0.72))} L${f1(x - H * 0.3)} ${f1(y(0.72))} Z`;
    const top = `M${f1(x - H * 0.05)} ${f1(y(0.84))} Q${f1(x - H * 0.06)} ${f1(y(0.93))} ${f1(x)} ${f1(y(1))} Q${f1(x + H * 0.06)} ${f1(y(0.93))} ${f1(x + H * 0.05)} ${f1(y(0.84))} Z`;
    for (const d of [...parts, roof, top]) W.push(wash(d, stone, 0.75));
    // Окошко: тёплый свет внутри
    const win = `M${f1(x - H * 0.07)} ${f1(y(0.56))} L${f1(x + H * 0.07)} ${f1(y(0.56))} L${f1(x + H * 0.07)} ${f1(y(0.68))} L${f1(x - H * 0.07)} ${f1(y(0.68))} Z`;
    W.push(`<path d="${win}" fill="#f4d890" fill-opacity="0.9"/>`);
    // Мох у основания
    for (let k = 0; k < 6; k++) W.push(dot(x - H * 0.24 + rnd() * H * 0.48, y(0.02 + rnd() * 0.05), 1.6 + rnd() * 1.4, '#7a9a5a'));
    I.push(ink([...parts, roof, top, win].join(' '), 0.9, sketchDash(rnd)), hatch(x + H * 0.06, y(0.26), H * 0.05, H * 0.17, rnd, 0.6));
  } else if (habit === 'tree') {
    const cw = Math.max(40, Math.min(h * 0.75, pl.r * 2 * s * 0.6));
    const birch = pl.key === 'betula';
    const trunk = birch ? '#f2efe6' : pl.key === 'padusMaackii' ? '#c07a3a' : '#7a5a3e';
    const th = Math.max(4, cw * 0.07);
    W.push(`<path d="M${f1(x - th)} ${base} Q${f1(x - th * 0.6)} ${f1(base - h * 0.3)} ${f1(x - th * 0.4)} ${f1(base - h * 0.55)} L${f1(x + th * 0.4)} ${f1(base - h * 0.55)} Q${f1(x + th * 0.6)} ${f1(base - h * 0.3)} ${f1(x + th)} ${base} Z" fill="${trunk}"/>`);
    I.push(ink(`M${f1(x - th)} ${base} Q${f1(x - th * 0.6)} ${f1(base - h * 0.3)} ${f1(x - th * 0.4)} ${f1(base - h * 0.55)} M${f1(x + th)} ${base} Q${f1(x + th * 0.6)} ${f1(base - h * 0.3)} ${f1(x + th * 0.4)} ${f1(base - h * 0.55)}`, 1.1));
    if (birch) for (let k = 0; k < 6; k++) { const yy = base - h * (0.05 + k * 0.08); I.push(ink(`M${f1(x - th * 0.6)} ${f1(yy)} l${f1(th * (0.4 + rnd() * 0.5))} ${f1(-1 - rnd())}`, 1.6)); }
    // Ветви внутри кроны
    for (let k = 0; k < 4; k++) {
      const yy = base - h * (0.45 + k * 0.08);
      const dir = k % 2 ? 1 : -1;
      I.push(ink(`M${f1(x)} ${f1(yy)} q${f1(dir * cw * 0.15)} ${f1(-h * 0.06)} ${f1(dir * cw * 0.3)} ${f1(-h * 0.14)}`, 0.8));
    }
    const cy = base - h * 0.66;
    const crown = cloud(x, cy, cw / 2, h * 0.34, rnd, 12, 0.25);
    W.push(wash(crown, leaf, 0.55), wash(cloud(x - cw * 0.12, cy - h * 0.08, cw * 0.28, h * 0.17, rnd, 8), light(leaf, 0.35), 0.45),
      wash(cloud(x + cw * 0.15, cy + h * 0.1, cw * 0.3, h * 0.16, rnd, 8), dark(leaf, 0.25), 0.4));
    if (fl && ['malus', 'malusDec', 'malusPurp', 'padus', 'padusMaackii', 'crataegus', 'sorbusSib'].includes(pl.key)) blossoms(x, cy, cw / 2, h * 0.32, 22, Math.max(2, cw / 28) * fs, col, rnd, W, I);
    berries(x, cy + h * 0.04, cw / 2.2, h * 0.28, 20, Math.max(1.8, cw / 34));
    I.push(ink(crown, 1.1, sketchDash(rnd)), hatch(x, cy, cw / 2, h * 0.34, rnd));
  } else if (habit === 'spruce' || habit === 'yew') {
    const cw = habit === 'yew' ? wd(0.75) : Math.max(30, Math.min(h * 0.42, pl.r * 2 * s * 0.5));
    const green = habit === 'yew' ? '#3f5a45' : pl.key === 'larix' ? mix(mix('#7f9a5a', '#c8d8a0', spring * 0.6), '#e0b030', autumn * 0.9) : '#3f5f4a';
    I.push(ink(`M${f1(x)} ${base} L${f1(x)} ${f1(base - h)}`, 1.2));
    const tiers = habit === 'yew' ? 5 : 8;
    const shape = [];
    for (let k = 0; k < tiers; k++) {
      const t = k / tiers;
      const y0 = base - h * (0.08 + t * 0.86);
      const half = (cw / 2) * (habit === 'yew' ? Math.sin(Math.PI * (0.15 + t * 0.8)) : 1 - t * 0.92);
      const d = `M${f1(x - half)} ${f1(y0 + 3)} Q${f1(x - half * 0.4)} ${f1(y0 - h * 0.05)} ${f1(x)} ${f1(y0 - h * 0.11)} Q${f1(x + half * 0.4)} ${f1(y0 - h * 0.05)} ${f1(x + half)} ${f1(y0 + 3)} Q${f1(x)} ${f1(y0 - 2)} ${f1(x - half)} ${f1(y0 + 3)} Z`;
      shape.push(d);
      I.push(ink(`M${f1(x - half)} ${f1(y0 + 3)} Q${f1(x - half * 0.4)} ${f1(y0 - h * 0.05)} ${f1(x)} ${f1(y0 - h * 0.11)} Q${f1(x + half * 0.4)} ${f1(y0 - h * 0.05)} ${f1(x + half)} ${f1(y0 + 3)}`, 0.9));
      // Хвоя: короткие штрихи вниз по ярусу
      const ticks = [];
      for (let j = 0; j < 7; j++) { const u = (j + 0.5) / 7; const xx = x - half + u * half * 2; ticks.push(`M${f1(xx)} ${f1(y0 + 2 - Math.sin(u * Math.PI) * h * 0.05)} l${f1((u - 0.5) * 2)} 4`); }
      I.push(`<path class="sk-hatch" d="${ticks.join(' ')}"/>`);
    }
    W.push(...shape.map((d) => wash(d, green, 0.6)));
  } else if (habit === 'pine') {
    const cw = Math.max(40, Math.min(h * 0.6, pl.r * 2 * s * 0.6));
    I.push(ink(`M${f1(x - 3)} ${base} C${f1(x - 2)} ${f1(base - h * 0.4)} ${f1(x + 4)} ${f1(base - h * 0.6)} ${f1(x + 2)} ${f1(base - h * 0.85)} M${f1(x + 3)} ${base} C${f1(x + 4)} ${f1(base - h * 0.4)} ${f1(x + 8)} ${f1(base - h * 0.6)} ${f1(x + 6)} ${f1(base - h * 0.85)}`, 1.1));
    W.push(`<path d="M${f1(x - 3)} ${base} C${f1(x - 2)} ${f1(base - h * 0.4)} ${f1(x + 4)} ${f1(base - h * 0.6)} ${f1(x + 2)} ${f1(base - h * 0.85)} L${f1(x + 6)} ${f1(base - h * 0.85)} C${f1(x + 8)} ${f1(base - h * 0.6)} ${f1(x + 4)} ${f1(base - h * 0.4)} ${f1(x + 3)} ${base} Z" fill="#b0683e"/>`);
    for (const [dx, dy, k] of [[-0.28, 0.72, 0.36], [0.3, 0.66, 0.34], [0.02, 0.88, 0.42], [-0.05, 0.58, 0.28]]) {
      const cx = x + dx * cw;
      const cy = base - dy * h;
      const d = cloud(cx, cy, cw * k * 0.7, h * k * 0.22, rnd, 9, 0.35);
      I.push(ink(`M${f1(x + 2)} ${f1(base - h * (dy - 0.12))} Q${f1((x + cx) / 2)} ${f1(cy + 6)} ${f1(cx)} ${f1(cy + 3)}`, 0.8));
      W.push(wash(d, '#3f5f4a', 0.6));
      I.push(ink(d, 1, sketchDash(rnd)), hatch(cx, cy, cw * k * 0.7, h * k * 0.22, rnd, 0.8));
    }
  } else if (habit === 'creeper') {
    const w = wd(0.9, 3);
    const hh = Math.max(14, h);
    const d = cloud(x, base - hh * 0.4, w / 2, hh * 0.4, rnd, 11, 0.2);
    W.push(wash(d, '#6f8a7a', 0.6));
    const feathers = [];
    for (let k = 0; k < 14; k++) { const xx = x - w / 2 + (k + 0.5) * (w / 14); feathers.push(`M${f1(xx)} ${f1(base - 2)} q${f1(4 + rnd() * 4)} ${f1(-hh * 0.4)} ${f1(10 + rnd() * 6)} ${f1(-hh * (0.55 + rnd() * 0.25))}`); }
    I.push(`<path class="sk-hatch" d="${feathers.join(' ')}"/>`, ink(d, 1, sketchDash(rnd)));
  } else if (habit === 'stems') {
    // Дерен, ива: веер красных прутьев, листья по ним
    const w = wd(0.75);
    const stem = pl.key.startsWith('salix') ? '#9a6a4a' : pl.color;
    const leaves = [];
    for (let k = 0; k < 11; k++) {
      const u = k / 10 - 0.5;
      const tx = x + u * w * (0.9 + rnd() * 0.3);
      const ty = base - h * (0.75 + rnd() * 0.25) * (1 - Math.abs(u) * 0.35);
      const d = `M${f1(x + u * 8)} ${base} Q${f1(x + u * w * 0.3)} ${f1(base - h * 0.5)} ${f1(tx)} ${f1(ty)}`;
      W.push(`<path d="${d}" stroke="${stem}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
      I.push(ink(d, 0.7));
      for (let j = 0; j < 4; j++) {
        const t = 0.35 + j * 0.18;
        const px = (1 - t) ** 2 * (x + u * 8) + 2 * (1 - t) * t * (x + u * w * 0.3) + t * t * tx;
        const py = (1 - t) ** 2 * base + 2 * (1 - t) * t * (base - h * 0.5) + t * t * ty;
        leaves.push(leafPath(px, py, Math.max(6, h * 0.09), Math.max(2.2, h * 0.03), -Math.PI / 2 + (j % 2 ? 0.9 : -0.9) + u));
      }
    }
    for (const lp of leaves) W.push(wash(lp, pl.key === 'cornus' ? '#8aa86a' : leaf, 0.55));
    I.push(ink(leaves.filter((_, k) => k % 2 === 0).join(' '), 0.6));
    // Щитки цветков и белые ягоды у дерена — на концах побегов
    if (look && look.flower) blossoms(x, base - h * 0.82, w * 0.45, h * 0.14, 12, 2.6 * fs, col, rnd, W, I);
    berries(x, base - h * 0.78, w * 0.45, h * 0.16, 12, 2.2);
  } else if (habit === 'panicle') {
    const w = wd(0.75);
    const cy = bush(x, base, w, h * 0.85, leaf, rnd, W, I);
    // Метёлки разбросаны по верхней половине кроны и чуть выглядывают из листвы
    for (let k = 0; k < (fl ? 6 : 0); k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.45 + (rnd() - 0.5) * 0.3;
      const rr = 0.45 + rnd() * 0.4;
      const px = x + Math.cos(a) * w * 0.42 * rr;
      const py = cy + Math.sin(a) * h * 0.4 * rr + h * 0.05;
      const ph = Math.min(26, Math.max(9, h * 0.18)) * fs;
      const pw = ph * 0.45;
      const d = `M${f1(px - pw / 2)} ${f1(py + 2)} C${f1(px - pw * 0.6)} ${f1(py - ph * 0.5)} ${f1(px - pw * 0.15)} ${f1(py - ph * 0.9)} ${f1(px)} ${f1(py - ph)} C${f1(px + pw * 0.15)} ${f1(py - ph * 0.9)} ${f1(px + pw * 0.6)} ${f1(py - ph * 0.5)} ${f1(px + pw / 2)} ${f1(py + 2)} Z`;
      W.push(wash(d, col, 0.7));
      for (let j = 0; j < 9; j++) {
        const t = rnd();
        W.push(dot(px + (rnd() - 0.5) * pw * (1 - t) * 0.9, py - t * ph * 0.9, Math.max(1.2, pw / 7), light(col, 0.25)));
      }
      I.push(ink(d, 0.6, sketchDash(rnd)));
    }
  } else if (habit === 'bloomShrub' || habit === 'berry' || habit === 'leafShrub') {
    const w = wd(0.8);
    const foliage = habit === 'leafShrub' ? pl.color : leaf;
    const cy = bush(x, base, w, h, foliage, rnd, W, I);
    if (!look) {
      if (habit === 'bloomShrub') blossoms(x, cy, w / 2, h / 2, 26, Math.max(2, w / 22), col, rnd, W, I);
      if (habit === 'berry') blossoms(x, cy + h * 0.1, w / 2, h / 2.4, 18, Math.max(1.6, w / 34), col, rnd, W, I);
    } else {
      if (fl) blossoms(x, cy, w / 2, h / 2, habit === 'berry' ? 18 : 26, Math.max(1.8, w / (habit === 'berry' ? 30 : 22)) * fs, col, rnd, W, I);
      berries(x, cy + h * 0.1, w / 2, h / 2.4, 20, Math.max(1.6, w / 34));
    }
  } else if (habit === 'spike' || habit === 'plume') {
    const w = wd(0.9);
    const cy = base - h * 0.18;
    const d = cloud(x, cy, w / 2, h * 0.18, rnd, 8);
    W.push(wash(d, leaf, 0.6));
    I.push(ink(d, 0.9, sketchDash(rnd)));
    const n = !fl ? 0 : habit === 'plume' ? 3 : 4;
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0 : k / (n - 1) - 0.5;
      const px = x + u * w * 0.6;
      const top = base - h * (0.92 + rnd() * 0.08);
      const ph = h * (habit === 'plume' ? 0.42 : 0.5) * fs;
      I.push(ink(`M${f1(x + u * 4)} ${f1(cy)} Q${f1(px)} ${f1(top + ph)} ${f1(px)} ${f1(top + ph * 0.3)}`, 0.8));
      if (habit === 'plume') {
        const pw = Math.max(6, w * 0.22) * fs;
        const p = `M${f1(px - pw / 2)} ${f1(top + ph)} Q${f1(px - pw * 0.2)} ${f1(top + ph * 0.3)} ${f1(px)} ${f1(top)} Q${f1(px + pw * 0.2)} ${f1(top + ph * 0.3)} ${f1(px + pw / 2)} ${f1(top + ph)} Z`;
        W.push(wash(p, col, 0.75));
        const fe = [];
        for (let j = 0; j < 7; j++) { const yy = top + ph * (0.15 + j * 0.12); fe.push(`M${f1(px)} ${f1(yy)} l${f1(-pw * 0.3)} ${f1(3)} M${f1(px)} ${f1(yy)} l${f1(pw * 0.3)} 3`); }
        I.push(`<path class="sk-hatch" d="${fe.join(' ')}"/>`);
      } else {
        for (let j = 0; j < 8; j++) {
          const yy = top + ph * (j / 8);
          const rr = Math.max(1.6, (w / 16) * (0.5 + j / 10)) * fs;
          W.push(dot(px + (j % 2 ? 1 : -1) * rr * 0.6, yy, rr, col));
          if (j % 3 === 0) I.push(`<circle class="sk-ink" cx="${f1(px + (j % 2 ? 1 : -1) * rr * 0.6)}" cy="${f1(yy)}" r="${f1(rr)}" stroke-width="0.5"/>`);
        }
      }
    }
  } else if (habit === 'sword') {
    const w = wd(1);
    const blades = [];
    for (let k = 0; k < 9; k++) {
      const u = k / 8 - 0.5;
      const top = base - h * (0.6 + rnd() * 0.25);
      blades.push(`M${f1(x + u * 6)} ${base} Q${f1(x + u * w * 0.25)} ${f1(base - h * 0.4)} ${f1(x + u * w * 0.55)} ${f1(top)}`);
    }
    W.push(...blades.map((d) => `<path d="${d}" stroke="${pl.key === 'leek' ? '#9ab07a' : leaf}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>`));
    I.push(ink(blades.join(' '), 0.6));
    if (pl.key !== 'leek' && fl) {
      for (let k = 0; k < 3; k++) {
        const fx = x + (k - 1) * w * 0.28;
        const fy = base - h * (0.85 + rnd() * 0.12);
        I.push(ink(`M${f1(x + (k - 1) * 3)} ${f1(base - h * 0.3)} L${f1(fx)} ${f1(fy)}`, 0.7));
        const r = Math.max(3.5, w * 0.1) * fs;
        const petals = [0, 1, 2].map((j) => leafPath(fx, fy, r * 1.6, r * 0.55, -Math.PI / 2 + (j - 1) * 0.9));
        W.push(...petals.map((p) => wash(p, col, 0.85)));
        I.push(ink(petals.join(' '), 0.6));
      }
    }
  } else if (habit === 'daisy' || habit === 'umbel' || habit === 'peony' || habit === 'pompon' || habit === 'herb') {
    const w = wd(habit === 'herb' ? 0.9 : 0.8);
    const fh = habit === 'herb' ? h : h * 0.55;
    const d = cloud(x, base - fh / 2, w / 2, fh / 2, rnd, 9);
    W.push(wash(d, leaf, 0.6));
    I.push(ink(d, 0.9, sketchDash(rnd)), hatch(x, base - fh / 2, w / 2, fh / 2, rnd, 0.7));
    if (habit === 'herb') {
      if (fl) blossoms(x, base - fh * 0.6, w / 2.2, fh / 3, 10, Math.max(1.5, w / 26) * fs, col, rnd, W, I);
    } else {
      const n = !fl ? 0 : habit === 'peony' ? 4 : habit === 'umbel' ? 5 : 6;
      for (let k = 0; k < n; k++) {
        const u = k / (n - 1) - 0.5;
        const fx = x + u * w * 0.75 + (rnd() - 0.5) * 4;
        const fy = base - h * (habit === 'umbel' ? 0.85 + rnd() * 0.1 : 0.78 + rnd() * 0.22);
        I.push(ink(`M${f1(x + u * w * 0.3)} ${f1(base - fh * 0.4)} Q${f1(fx)} ${f1((fy + base) / 2)} ${f1(fx)} ${f1(fy)}`, 0.6));
        const r = Math.max(3, w * (habit === 'peony' ? 0.14 : 0.09)) * fs;
        if (habit === 'daisy') {
          const pts = [];
          for (let j = 0; j < 8; j++) { const a = (j / 8) * Math.PI * 2; pts.push(leafPath(fx, fy, r * 1.3, r * 0.35, a)); }
          W.push(...pts.map((p) => wash(p, col, 0.85)));
          I.push(ink(pts.filter((_, j) => j % 2 === 0).join(' '), 0.45), dot(fx, fy, r * 0.42, pl.key === 'echinacea' || pl.key === 'rudbeckia' ? '#5a3a24' : '#d8a830'));
        } else if (habit === 'umbel') {
          const p = `M${f1(fx - r * 1.8)} ${f1(fy + r * 0.3)} Q${f1(fx)} ${f1(fy - r * 1.4)} ${f1(fx + r * 1.8)} ${f1(fy + r * 0.3)} Z`;
          W.push(wash(p, col, 0.85));
          const dots = [];
          for (let j = 0; j < 6; j++) dots.push(`M${f1(fx - r * 1.4 + j * r * 0.56)} ${f1(fy - Math.sin(((j + 0.5) / 6) * Math.PI) * r * 0.6)} h0.1`);
          I.push(ink(p, 0.6), `<path class="sk-ink" d="${dots.join(' ')}" stroke-width="1.8" stroke-linecap="round"/>`);
        } else {
          const p = cloud(fx, fy, r, r * 0.9, rnd, habit === 'peony' ? 7 : 9, habit === 'peony' ? 0.4 : 0.2);
          W.push(wash(p, col, 0.85));
          I.push(ink(p, 0.6), ink(`M${f1(fx - r * 0.4)} ${f1(fy)} q${f1(r * 0.4)} ${f1(-r * 0.5)} ${f1(r * 0.8)} 0`, 0.5));
        }
      }
    }
  } else if (habit === 'leafy') {
    const w = wd(1);
    const leaves = [];
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + (k / 8) * Math.PI;
      const len = Math.max(10, w * (0.38 + (k % 2) * 0.08));
      leaves.push(leafPath(x, base - 2, len, len * (pl.key === 'heuchera' ? 0.5 : 0.42), a));
    }
    W.push(...leaves.map((lp, k) => wash(lp, pl.key === 'heuchera' ? pl.color : k % 2 ? leaf : light(leaf, 0.2), 0.7)));
    I.push(ink(leaves.join(' '), 0.7));
    // Жилки и цветонос
    if (fl) I.push(ink(`M${f1(x + 4)} ${base} Q${f1(x + 8)} ${f1(base - h * 0.6)} ${f1(x + 6)} ${f1(base - h)}`, 0.7));
    for (let j = 0; j < (fl ? 5 : 0); j++) W.push(dot(x + 6 + (j % 2 ? 2 : -2), base - h * (0.7 + j * 0.06), 2.2 * fs, pl.key === 'heuchera' ? '#f0d0d8' : pl.key === 'hosta' ? '#c8b8e0' : col));
  } else if (habit === 'tuft' || habit === 'fountain') {
    const w = wd(habit === 'tuft' ? 1.2 : 1);
    const green = habit === 'tuft' ? pl.color : leaf;
    const blades = [];
    for (let k = 0; k < 16; k++) {
      const u = k / 15 - 0.5;
      const top = base - h * (habit === 'tuft' ? 0.8 + rnd() * 0.2 : 0.55 + rnd() * 0.2);
      blades.push(`M${f1(x + u * 5)} ${base} Q${f1(x + u * w * 0.2)} ${f1(base - h * 0.5)} ${f1(x + u * w * 1.05)} ${f1(top + Math.abs(u) * h * 0.5)}`);
    }
    W.push(...blades.map((d) => `<path d="${d}" stroke="${green}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.75"/>`));
    I.push(ink(blades.filter((_, k) => k % 2 === 0).join(' '), 0.55));
    if (habit === 'fountain' && fl) {
      // Метёлки и ости над листвой
      for (let k = 0; k < 7; k++) {
        const u = k / 6 - 0.5;
        const tx = x + u * w * 0.9;
        const ty = base - h * (0.9 + rnd() * 0.1);
        const d = `M${f1(x + u * 4)} ${f1(base - h * 0.3)} Q${f1(x + u * w * 0.3)} ${f1(base - h * 0.8)} ${f1(tx)} ${f1(ty)}`;
        I.push(ink(d, 0.5));
        if (pl.key === 'stipa') W.push(`<path d="M${f1(tx)} ${f1(ty)} q${f1(u * 14 + 6)} ${f1(4)} ${f1(u * 20 + 12)} ${f1(14)}" stroke="${col}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/>`);
        else W.push(`<ellipse cx="${f1(tx)}" cy="${f1(ty + 5)}" rx="${f1(Math.max(3, w * 0.07) * fs)}" ry="${f1(Math.max(5, h * 0.12) * fs)}" fill="${col}" fill-opacity="0.55" transform="rotate(${f1(u * 30)} ${f1(tx)} ${f1(ty + 5)})"/>`);
      }
    }
  } else if (habit === 'rosette') {
    const w = wd(1.6);
    for (let k = 0; k < 3; k++) {
      const cx = x + (k - 1) * w * 0.3;
      const r = Math.max(6, w * 0.16) * (k === 1 ? 1.2 : 0.9);
      const petals = [];
      for (let j = 0; j < 9; j++) petals.push(leafPath(cx, base - r * 0.4, r, r * 0.35, Math.PI + (j / 8) * Math.PI));
      W.push(...petals.map((p, j) => wash(p, j % 2 ? pl.color : '#8aa07a', 0.75)));
      I.push(ink(petals.join(' '), 0.5));
      // Цветонос-свечка, когда цветёт
      if (look && look.flower && k === 1) {
        const sp = `M${f1(cx - r * 0.35)} ${f1(base - r * 0.6)} Q${f1(cx)} ${f1(base - r * (0.8 + 2.4 * fs))} ${f1(cx + r * 0.35)} ${f1(base - r * 0.6)} Z`;
        W.push(wash(sp, col, 0.85));
        I.push(ink(sp, 0.6));
      }
    }
  } else {
    // Почвопокровные: низкий ковёр с россыпью цветков
    const w = wd(1.5, 5);
    const hh = Math.max(9, h);
    const d = `M${f1(x - w / 2)} ${base} Q${f1(x - w / 2)} ${f1(base - hh)} ${f1(x - w / 4)} ${f1(base - hh)} Q${f1(x)} ${f1(base - hh * 1.3)} ${f1(x + w / 4)} ${f1(base - hh)} Q${f1(x + w / 2)} ${f1(base - hh)} ${f1(x + w / 2)} ${base} Z`;
    W.push(wash(d, pl.key === 'sagina' || pl.key === 'trifolium' ? pl.color : leaf, 0.6));
    I.push(ink(d, 0.8, sketchDash(rnd)));
    if (fl && !['sagina'].includes(pl.key)) for (let k = 0; k < 12; k++) W.push(dot(x - w * 0.42 + rnd() * w * 0.84, base - hh * (0.4 + rnd() * 0.6), Math.min(3, Math.max(1.6, w / 30)) * fs, pl.key === 'trifolium' ? '#f4f0e4' : col));
  }
  return { wash: W.join(''), ink: I.join('') };
}

let uid = 0;
/** Общие фильтры и слой бумаги для рисунка; id уникальны на каждую картинку. */
export function sketchDefs() {
  const id = `sk${++uid}`;
  return {
    id,
    defs: `<defs>
      <filter id="${id}-wc" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="0.5"/></filter>
      <filter id="${id}-ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G"/></filter>
      <filter id="${id}-paper"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.28  0 0 0 0.07 0"/></filter>
    </defs>`,
  };
}

export { INK };
