import { declination, decimalYear, MODEL_NAME } from './wmm.js';
import {
  PALACES, STARS, starMeaning, norm360, mountainAt, boundaryWarning, flyingStars, starTiming,
  bazhaiHouse, bazhaiDirections, guaNumber, planLayout,
} from './fengshui.js';
import {
  SHAPES, CORNERS, BAY_SIDES, defaultShape, shapeGeometry, decompose, pieces, outline, coverage, area,
  sectorStatus, cellOf,
} from './shape.js';
import {
  SIDE_NAMES, SIDES_CW, SIDE_BEARING, CRITERIA, emptyHelp, scoreSides, recommend, relabelSide, transformCuts,
  wallLength, doorPoint, doorOptions, doorSector, doorStars, DOOR_SECTORS,
} from './facade.js';
import {
  ROOMS, MOUNTAIN, WATER, UNFAVORABLE_MOUNTAIN, WATER_FACE, attacksGua, elementOf, roomFit, bedroomsFor, entranceNotes, heTuPairs, doubleNine,
} from './stars9.js';
import { planRooms, roomsFor, kitchenSplit, dir8, isDoubleNine } from './planner.js';
import { ELEMENTS, ELEMENT_BY_KEY, evaluate, sectorOf, sectorAdvice, PLANTS } from './landscape.js';

const L = window.L;
const STORAGE_KEY = 'psy-house-v1';
const YAKUTSK = [62.0355, 129.6755];

const defaults = {
  center: YAKUTSK,
  width: 12,
  depth: 10,
  az: 180,
  mode: 'magnetic',
  period: 9,
  orient: 'plan-bottom',
  floor2: false,
  // Размеры второго этажа; при первом включении копируются с первого
  width2: null,
  depth2: null,
  shape1: defaultShape(),
  shape2: defaultShape(),
  // auto — дверь сама встаёт в сектор В или ЮВ (традиция Якутии)
  door: { auto: true, side: 'front', pos: null },
  facadeHelp: emptyHelp(),
  bazhaiBy: 'facade',
  // Техзадание: какие помещения нужны (kids: null — по числу детей среди жильцов)
  program: {
    masterWork: false,
    kitchen: true, master: true, suite: false, guest: false, office: false, boiler: true, laundry: false, storage: false, wardrobe: false,
    kids: null, baths: 1,
    custom: [],
  },
  // Разрешать авто-двери сектор девятки (горной или водной 9)
  doorNine: true,
  // Помещения, поставленные вручную: {'этаж:ряд-столбец': {key, label, type, wet}}
  overrides: {},
  site: [],
  // Элементы озеленения: {t: ключ элемента, ll: [широта, долгота]}
  garden: [],
  gardenTool: 'conifer',
  people: [],
  zoom: 20,
};

const saved = load();
// Сохранения до появления плана дома открываем сразу на плане
if (!('floor2' in saved)) delete saved.orient;
const state = { ...defaults, ...saved, program: { ...defaults.program, ...(saved.program || {}) } };
// Двери из прежних версий (без режима «авто») ставим автоматически в сектор В или ЮВ
if (saved.door && !('auto' in saved.door)) state.door = { ...defaults.door };

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Хранилище недоступно — работаем без сохранения
  }
}

// ---- Геометрия в локальных метрах ----

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function metersPerDeg(lat) {
  const p = rad(lat);
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p),
    lng: 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p),
  };
}

function offset(center, east, north) {
  const m = metersPerDeg(center[0]);
  return [center[0] + north / m.lat, center[1] + east / m.lng];
}

function toLocal(center, ll) {
  const m = metersPerDeg(center[0]);
  return [(ll[1] - center[1]) * m.lng, (ll[0] - center[0]) * m.lat];
}

// Единичные векторы: вперёд (куда смотрит фасад) и вправо (по часовой стрелке)
function axes(az) {
  const t = rad(az);
  return { f: [Math.sin(t), Math.cos(t)], r: [Math.cos(t), -Math.sin(t)] };
}

function housePoint(a, b) {
  // a — вдоль глубины (+ к фасаду), b — вдоль фасада (+ вправо), в метрах
  const { f, r } = axes(state.az);
  return offset(state.center, f[0] * a + r[0] * b, f[1] * a + r[1] * b);
}

function houseCorners() {
  const g = floorGeom(1);
  const d = g.D / 2;
  const w = g.W / 2;
  return [housePoint(d, -w), housePoint(d, w), housePoint(-d, w), housePoint(-d, -w)];
}

const fmt = (n, digits = 1) => n.toFixed(digits).replace('.', ',').replace('-', '−');

// ---- Карта ----

const map = L.map('map', { zoomControl: true }).setView(state.center, state.zoom);
const satellite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 20, maxNativeZoom: 19, attribution: 'Снимки &copy; Esri' },
).addTo(map);
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 20,
  maxNativeZoom: 19,
  attribution: '&copy; участники OpenStreetMap',
});
L.control.layers({ Спутник: satellite, Схема: osm }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

const sectorLayer = L.layerGroup().addTo(map);
const gridLayer = L.layerGroup().addTo(map);
const houseLayer = L.layerGroup().addTo(map);
const arrowLine = L.polyline([], { color: '#b23a2b', weight: 2, dashArray: '4 4' }).addTo(map);
const floor2Layer = L.layerGroup().addTo(map);
const sitePoly = L.polygon([], { color: '#ffd84d', weight: 3, fillOpacity: 0.05, dashArray: '6 4' }).addTo(map);

const mover = L.marker(state.center, {
  draggable: true,
  icon: L.divIcon({ className: '', html: '<div class="mover"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
  title: 'Переместить дом',
  zIndexOffset: 1000,
}).addTo(map);

const handle = L.marker(state.center, {
  draggable: true,
  icon: L.divIcon({ className: '', html: '<div class="handle"></div>', iconSize: [24, 24], iconAnchor: [12, 12] }),
  title: 'Повернуть дом',
  zIndexOffset: 1000,
}).addTo(map);

let draggingHandle = false;

mover.on('drag', (e) => {
  const ll = e.target.getLatLng();
  state.center = [ll.lat, ll.lng];
  render();
});
mover.on('dragend', save);

handle.on('dragstart', () => { draggingHandle = true; });
handle.on('drag', (e) => {
  const ll = e.target.getLatLng();
  const [x, y] = toLocal(state.center, [ll.lat, ll.lng]);
  state.az = Math.round(norm360(deg(Math.atan2(x, y))) * 10) / 10;
  render();
});
handle.on('dragend', () => {
  draggingHandle = false;
  render();
  save();
});

map.on('moveend', () => {
  state.zoom = map.getZoom();
  save();
});

// ---- Участок ----

let drawingSite = false;
const btnSite = document.getElementById('btn-site');

function setDrawing(on) {
  drawingSite = on;
  btnSite.textContent = on ? 'Готово' : 'Нарисовать участок';
  btnSite.classList.toggle('active', on);
  document.getElementById('map-hint').textContent = on
    ? 'Щёлкайте по углам участка по порядку. Двойной щелчок или «Готово» — завершить.'
    : 'Перетащите дом за середину. Поверните за круглую ручку перед фасадом.';
  if (on) map.doubleClickZoom.disable();
  else map.doubleClickZoom.enable();
}

btnSite.addEventListener('click', () => {
  if (!drawingSite) state.site = [];
  setDrawing(!drawingSite);
  render();
  save();
});

map.on('click', (e) => {
  if (!drawingSite) return;
  state.site.push([e.latlng.lat, e.latlng.lng]);
  render();
  save();
});

map.on('dblclick', () => {
  if (drawingSite) setDrawing(false);
});

document.getElementById('btn-site-clear').addEventListener('click', () => {
  state.site = [];
  setDrawing(false);
  render();
  save();
});

document.getElementById('btn-house').addEventListener('click', () => {
  const c = map.getCenter();
  state.center = [c.lat, c.lng];
  render();
  save();
});

document.getElementById('btn-locate').addEventListener('click', () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 20),
    () => alert('Не удалось определить местоположение'),
  );
});

function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

function minDistance(polyA, polyB) {
  let best = Infinity;
  for (const [ps, edges] of [[polyA, polyB], [polyB, polyA]]) {
    for (const p of ps) {
      for (let i = 0; i < edges.length; i++) {
        best = Math.min(best, distToSegment(p, edges[i], edges[(i + 1) % edges.length]));
      }
    }
  }
  return best;
}

function siteInfo(corners) {
  if (state.site.length < 3) {
    return 'Нарисуйте границы участка, чтобы проверить отступы (до дома — не меньше 3 м).';
  }
  const site = state.site.map((ll) => toLocal(state.center, ll));
  const house = corners.map((ll) => toLocal(state.center, ll));
  let area = 0;
  for (let i = 0; i < site.length; i++) {
    const [x1, y1] = site[i];
    const [x2, y2] = site[(i + 1) % site.length];
    area += x1 * y2 - x2 * y1;
  }
  area = Math.abs(area) / 2;
  const inside = house.every((p) => pointInPolygon(p, site));
  const dist = minDistance(house, site);
  const areaText = `Площадь участка ≈ ${fmt(area, 0)} м² (${fmt(area / 100, 1)} сотки).`;
  if (!inside) return `${areaText} <strong style="color:var(--bad)">Дом выходит за границы участка.</strong>`;
  const ok = dist >= 3;
  return `${areaText} До границы: <strong style="color:var(${ok ? '--good' : '--bad'})">${fmt(dist)} м</strong>${ok ? '' : ' — меньше 3 м'}.`;
}

// ---- Отрисовка ----

// Дворец клетки сетки 3×3 дома: a — к фасаду (+1) или к тылу (−1), b — вправо (+1) или влево (−1).
// На плане с фасадом снизу правая по ходу взгляда фасада сторона дома — слева.
function cellLo(chart, a, b) {
  return planLayout(chart)[a + 1][1 - b];
}

// Габарит, вырезы и заполненность клеток этажа (1 или 2)
function floorGeom(n) {
  const bodyW = n === 2 ? (state.width2 ?? state.width) : state.width;
  const bodyD = n === 2 ? (state.depth2 ?? state.depth) : state.depth;
  const { W, D, cuts } = shapeGeometry({ ...defaultShape(), ...state[`shape${n}`] }, bodyW, bodyD);
  return { W, D, cuts, dec: decompose(W, D, cuts), cov: coverage(W, D, cuts) };
}

// Точка плана (x — слева направо, если смотреть на фасад; y — от фасада) на карте
function planToMap(g, x, y) {
  return housePoint(g.D / 2 - y, g.W / 2 - x);
}

// Заполненность дворцов этажа: {номер Ло Шу: доля}
function palaceCoverage(chart, g) {
  const layout = planLayout(chart);
  const out = {};
  layout.forEach((row, i) => row.forEach((lo, j) => { out[lo] = g.cov[i][j]; }));
  return out;
}

const isMissing = (cov) => sectorStatus(cov) !== 'full';
const missingLabel = (cov) => (sectorStatus(cov) === 'none' ? 'нет' : 'частично нет');

// Дверь, которая действует сейчас: ручная или поставленная автоматически
let doorNow = state.door;
let lastFsAz = state.az;
let currentChart = null;

function effectiveDoor(chart, fsAz) {
  if (!state.door.auto) return state.door;
  const [best] = currentDoorOptions(chart, fsAz);
  return best ? { ...state.door, side: best.side, pos: best.pos } : { ...state.door, side: 'front', pos: null };
}

// Варианты двери: В/ЮВ и сектора с благоприятной звездой воды (9 и 1 в 9-м периоде)
function currentDoorOptions(chart, fsAz) {
  const g = floorGeom(1);
  const water = Object.fromEntries(Object.entries(chart.palaces).map(([lo, p]) => [lo, p.water]));
  const palaceIndex = Object.fromEntries(PALACES.map((p, i) => [p.lo, i]));
  return doorOptions({
    layout: planLayout(chart), cov: g.cov, W: g.W, D: g.D, fsAz, water,
    timing: (n) => starState(n, chart.period), palaceIndex, period: chart.period,
    // Двухэтажный дом с двойной 9: вход внизу, спальня наверху — идеальный вариант
    preferLo: state.doorNine && state.floor2 && chart.period === 9 ? doubleNine(chart.palaces) : null,
    // Вход у девятки выключен — сектора с горной или водной 9 не предлагаем
    skip: state.doorNine ? [] : Object.entries(chart.palaces).filter(([, p]) => p.mountain === 9 || p.water === 9).map(([lo]) => Number(lo)),
  });
}

function render() {
  const decl = declination(state.center[0], state.center[1], decimalYear());
  const magAz = norm360(state.az - decl);
  const fsAz = state.mode === 'magnetic' ? magAz : state.az;
  // Поправка: истинный азимут = азимут для расчёта + shift
  const shift = state.mode === 'magnetic' ? decl : 0;
  const chart = flyingStars(fsAz, state.period);
  doorNow = effectiveDoor(chart, fsAz);
  lastFsAz = fsAz;
  currentChart = chart;

  renderMap(chart, shift);
  renderInputs();
  renderAzimuth(decl, magAz, fsAz, chart);
  renderStars(chart, fsAz);
  renderDoor(chart);
  renderFacadeHelper(fsAz);
  renderBazhai(houseAz(fsAz));
  renderPeople(houseAz(fsAz));
  renderProgramInputs();
  renderLayout(chart, fsAz);
  renderGarden(chart, shift);
}

function renderMap(chart, shift) {
  const g1 = floorGeom(1);
  houseLayer.clearLayers();
  for (const p of pieces(g1.dec)) {
    if (!p.inside) continue;
    L.polygon([planToMap(g1, p.x1, p.y1), planToMap(g1, p.x2, p.y1), planToMap(g1, p.x2, p.y2), planToMap(g1, p.x1, p.y2)], {
      stroke: false, fillColor: '#b23a2b', fillOpacity: 0.3, interactive: false,
    }).addTo(houseLayer);
  }
  for (const sg of outline(g1.dec)) {
    const front = sg.facing === 'front';
    L.polyline([planToMap(g1, sg.x1, sg.y1), planToMap(g1, sg.x2, sg.y2)], {
      color: front ? '#b23a2b' : '#ffffff', weight: front ? 6 : 2, interactive: false,
    }).addTo(houseLayer);
  }
  const door = doorPoint(doorNow, g1.W, g1.D);
  const dx = door.along === 'x' ? 0.6 : 0;
  const dy = door.along === 'y' ? 0.6 : 0;
  L.polyline([planToMap(g1, door.x - dx, door.y - dy), planToMap(g1, door.x + dx, door.y + dy)], {
    color: '#1d5fd1', weight: 7, interactive: false,
  }).addTo(houseLayer);
  const tip = housePoint(g1.D / 2 + Math.max(4, g1.D * 0.4), 0);
  arrowLine.setLatLngs([state.center, tip]);
  mover.setLatLng(state.center);
  if (!draggingHandle) handle.setLatLng(tip);
  sitePoly.setLatLngs(state.site);
  floor2Layer.clearLayers();
  if (state.floor2) {
    const g2 = floorGeom(2);
    for (const sg of outline(g2.dec)) {
      L.polyline([planToMap(g2, sg.x1, sg.y1), planToMap(g2, sg.x2, sg.y2)], {
        color: '#ffd84d', weight: 2, dashArray: '2 6', interactive: false,
      }).addTo(floor2Layer);
    }
  }

  // Лучи границ дворцов (по магнитному или истинному северу)
  sectorLayer.clearLayers();
  const radius = Math.max(g1.W, g1.D) * 1.6;
  for (let k = 0; k < 8; k++) {
    const b = rad(22.5 + 45 * k + shift);
    const inner = offset(state.center, Math.sin(b) * radius * 0.45, Math.cos(b) * radius * 0.45);
    const outer = offset(state.center, Math.sin(b) * radius, Math.cos(b) * radius);
    L.polyline([inner, outer], { color: '#ffffff', weight: 1.5, opacity: 0.85, dashArray: '3 5', interactive: false }).addTo(sectorLayer);
    const lb = rad(45 * k + shift);
    L.marker(offset(state.center, Math.sin(lb) * radius * 0.85, Math.cos(lb) * radius * 0.85), {
      interactive: false,
      icon: L.divIcon({ className: 'sector-label', html: PALACES[k].dir, iconSize: [30, 16], iconAnchor: [15, 8] }),
    }).addTo(sectorLayer);
  }

  // Сетка 3×3 на доме со звёздами
  gridLayer.clearLayers();
  const d3 = g1.D / 3;
  const w3 = g1.W / 3;
  for (const a of [-0.5, 0.5]) {
    L.polyline([housePoint(a * d3, -g1.W / 2), housePoint(a * d3, g1.W / 2)], { color: '#fff', weight: 1, interactive: false }).addTo(gridLayer);
  }
  for (const b of [-0.5, 0.5]) {
    L.polyline([housePoint(-g1.D / 2, b * w3), housePoint(g1.D / 2, b * w3)], { color: '#fff', weight: 1, interactive: false }).addTo(gridLayer);
  }
  if (map.getZoom() < 19) return;
  const cov1 = palaceCoverage(chart, g1);
  for (const a of [1, 0, -1]) {
    for (const b of [-1, 0, 1]) {
      const lo = cellLo(chart, a, b);
      const p = chart.palaces[lo];
      const label = lo === 5 ? 'центр' : PALACES.find((x) => x.lo === lo).dir;
      L.marker(housePoint(a * d3, b * w3), {
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: `<div class="house-label${isMissing(cov1[lo]) ? ' missing' : ''}">${p.mountain} ${p.water}<br><small>${p.base} · ${label}</small></div>`,
          iconSize: [44, 30],
          // Подпись центра сдвинута вниз, чтобы не закрывать маркер перемещения
          iconAnchor: lo === 5 ? [22, -8] : [22, 15],
        }),
      }).addTo(gridLayer);
    }
  }
}

map.on('zoomend', render);

const $ = (id) => document.getElementById(id);

function renderInputs() {
  for (const [id, key] of [['in-width', 'width'], ['in-depth', 'depth'], ['in-width2', 'width2'], ['in-depth2', 'depth2'], ['in-az', 'az'], ['in-az-range', 'az']]) {
    const el = $(id);
    if (document.activeElement !== el) el.value = state[key] ?? '';
  }
  $('in-period').value = String(state.period);
  $('in-orient').value = state.orient;
  $('in-floor2').checked = state.floor2;
  $('floor2-size').hidden = !state.floor2;
  for (const r of document.querySelectorAll('input[name="az-mode"]')) r.checked = r.value === state.mode;
  for (const r of document.querySelectorAll('input[name="bazhai-by"]')) r.checked = r.value === state.bazhaiBy;
  $('door-side').value = state.door.auto ? 'auto' : state.door.side;
  const g1 = floorGeom(1);
  $('door-pos').max = wallLength(doorNow.side, g1.W, g1.D);
  $('door-pos').disabled = !!state.door.auto;
  $('door-nine').checked = state.doorNine;
  if (document.activeElement !== $('door-pos')) $('door-pos').value = state.door.auto ? '' : state.door.pos ?? '';
  $('site-info').innerHTML = siteInfo(houseCorners());
  for (const n of [1, 2]) {
    const g = floorGeom(n);
    $(`shape${n}-area`).textContent = `Площадь этажа ≈ ${fmt(area(g.W, g.D, g.cuts), 1)} м²`;
  }
}

// ---- Фасад и дверь ----

// Азимут, по которому определяется дом в Ба Чжай
function houseAz(fsAz) {
  return state.bazhaiBy === 'door' ? norm360(fsAz + SIDE_BEARING[doorNow.side]) : fsAz;
}

// Дверь стоит по правилам: в секторе В или ЮВ (традиция Якутии) или со звездой воды 9 или 1
function doorPlacedByRule(chart) {
  const g = floorGeom(1);
  const lo = doorSector(doorNow, g.W, g.D, planLayout(chart));
  return DOOR_SECTORS.includes(lo) || doorStars(chart.period).includes(chart.palaces[lo].water);
}

const sideDir = (fsAz, side) => PALACES[mountainAt(fsAz + SIDE_BEARING[side]).palace].dir;

// Раскрыть описание при появлении разногласия (но не мешать, если его закрыли)
let lastConflict = '';
function flagConflict(key) {
  if (key && key !== lastConflict) $('facade-guide').open = true;
  lastConflict = key;
}

function renderDoor(chart) {
  const g = floorGeom(1);
  const lo = doorSector(doorNow, g.W, g.D, planLayout(chart));
  const palace = PALACES.find((q) => q.lo === lo);
  const p = chart.palaces[lo];
  const t = starState(p.water, chart.period);
  const kind = t.key === 'wang' || t.key === 'sheng' ? 'good' : t.key === 'tui' || t.key === 'neutral' ? 'mixed' : 'bad';
  const where = palace ? `сектор ${palace.dirName}` : 'центр дома';
  const msgs = [`<div class="msg ${kind}"><strong>Входная дверь: ${where}</strong>Звезда воды ${p.water} — ${t.label}${
    p.water === chart.period ? ' (лучшая для двери)' : ''}; звезда горы ${p.mountain}. Для двери важна звезда воды.</div>`];
  if (chart.period === 9) {
    // Двухэтажный дом с двойной 9: горная 9 используется спальней над входом
    const ideal = state.floor2 && doubleNine(chart.palaces) === lo;
    for (const n of entranceNotes(p.mountain, p.water, peopleGuas()).filter((x) => !(ideal && x.mountainNine))) {
      msgs.push(`<div class="msg ${n.kind}"><strong>${n.gua ? `Вход и Гуа ${n.gua}` : 'Вход'}</strong>${n.text}</div>`);
    }
  }
  const good = doorStars(chart.period);
  const traditional = DOOR_SECTORS.includes(lo);
  const goodStar = good.includes(p.water);
  const goodText = good.join(' или ');
  if (state.doorNine && state.floor2 && chart.period === 9 && doubleNine(chart.palaces) === lo) {
    msgs.push(`<div class="msg good"><strong>Идеальный вариант</strong>Вход в секторе ${palace.dirName} использует водную 9, а спальня над ним на втором этаже — горную 9.</div>`);
  } else if (traditional && goodStar) {
    msgs.push(`<div class="msg good"><strong>Лучшее место для двери</strong>Сектор ${palace.dirName} — традиция Якутии, и звезда воды ${p.water} благоприятная.</div>`);
  } else if (goodStar) {
    msgs.push(`<div class="msg good"><strong>Дверь по звезде воды ${p.water}</strong>Сектор ${palace.dirName} не В и не ЮВ, но звезда воды благоприятная. В секторах В и ЮВ звёзд ${goodText} нет.</div>`);
  } else if (traditional) {
    msgs.push(`<div class="msg mixed"><strong>Дверь в секторе ${palace.dirName} по традиции</strong>Звёзд воды ${goodText} нет ни в одном доступном секторе, поэтому дверь оставлена в В/ЮВ. Звезду воды ${p.water} у двери нужно корректировать.</div>`);
  } else {
    msgs.push(`<div class="msg mixed"><strong>Дверь не в В/ЮВ и не со звездой воды ${goodText}</strong>Выберите «авто» или один из вариантов ниже.${
      doorNow.side !== 'front' ? ' Дверь не на фасаде — если не уверены, какую сторону считать фасадом, заполните помощника и прочитайте описание ниже.' : ''}</div>`);
  }

  const options = currentDoorOptions(chart, lastFsAz);
  if (options.length) {
    const same = (o) => o.side === doorNow.side && Math.abs((o.pos ?? 0) - (doorNow.pos ?? 0)) < 1e-6;
    const rows = options.map((o) => {
      const pal = PALACES.find((q) => q.lo === o.lo);
      const why = [o.ideal ? 'двойная 9: идеальный вариант' : '', o.traditional ? 'В/ЮВ' : '', o.goodStar ? `вода ${o.star}` : `вода ${o.star} — ${starState(o.star, chart.period).label}`].filter(Boolean).join(', ');
      const btn = same(o)
        ? '<span class="note">сейчас здесь</span>'
        : `<button type="button" class="link" data-door-side="${o.side}" data-door-pos="${o.pos}">Поставить сюда</button>`;
      return `<tr><td>${pal.dirName}</td><td>${SIDE_NAMES[o.side].toLowerCase()}</td><td>${why}</td><td>${btn}</td></tr>`;
    }).join('');
    msgs.push(`<details class="door-options"${state.door.auto ? '' : ' open'}><summary>Варианты для двери (лучший первый)</summary>
      <table><tr><th>Сектор</th><th>Стена</th><th>Почему</th><th></th></tr>${rows}</table></details>`);
  }
  $('door-info').innerHTML = msgs.join('');
}

function renderFacadeHelper(fsAz) {
  const help = { ...emptyHelp(), ...state.facadeHelp };
  const doorCounts = !doorPlacedByRule(flyingStars(fsAz, state.period));
  const scores = scoreSides(help, doorNow.side, doorCounts);
  const rec = recommend(scores);
  const head = SIDES_CW.map((side) => `<th>${SIDE_NAMES[side]}<br><span class="note">${sideDir(fsAz, side)}</span></th>`).join('');
  const rows = CRITERIA.map((c) => `<tr><td>${c.label} <span class="note">(${c.weight > 0 ? '+' : ''}${c.weight})</span></td>${SIDES_CW.map((side) => {
    const id = `fh-${c.key}-${side}`;
    return `<td><input type="checkbox" id="${id}" data-crit="${c.key}" data-side="${side}" aria-label="${c.label}: ${SIDE_NAMES[side]}"${help[side].includes(c.key) ? ' checked' : ''}></td>`;
  }).join('')}</tr>`).join('');
  const doorNote = doorCounts ? '+2, из поля выше' : 'поставлена по традиции или по звезде воды — баллов не даёт';
  const doorRow = `<tr><td>Входная дверь <span class="note">(${doorNote})</span></td>${SIDES_CW.map((side) => `<td>${side === doorNow.side ? '●' : ''}</td>`).join('')}</tr>`;
  const scoreRow = `<tr class="score"><td>Баллы</td>${SIDES_CW.map((side) => `<td class="${rec.filled && side === rec.best ? 'best' : ''}">${scores[side]}</td>`).join('')}</tr>`;
  $('facade-table').innerHTML = `<table class="facade-table"><tr><th>Признак</th>${head}</tr>${rows}${doorRow}${scoreRow}</table>`;

  const button = (side) => `<button type="button" class="secondary" data-make-front="${side}">Сделать фасадом: ${SIDE_NAMES[side].toLowerCase()} (${sideDir(fsAz, side)})</button>`;
  let result;
  if (!rec.filled) {
    result = '<p class="note">Отметьте признаки, и помощник подскажет сторону.</p>';
  } else if (rec.ambiguous) {
    const names = rec.rivals.map((s) => `${SIDE_NAMES[s].toLowerCase()} (${sideDir(fsAz, s)}, ${scores[s]})`).join(', ');
    result = `<div class="msg mixed"><strong>Выбор спорный</strong>Почти равны: ${names}. Посчитайте обе карты и сверьте с описанием «Как определить фасад».</div>
      <div class="row wrap">${rec.rivals.filter((s) => s !== 'front').map(button).join('')}</div>`;
  } else if (rec.best === 'front') {
    result = `<div class="msg good"><strong>Фасад выбран верно</strong>Текущий фасад (${sideDir(fsAz, 'front')}) набрал больше всего баллов: ${scores.front}.</div>`;
  } else {
    result = `<div class="msg mixed"><strong>Помощник советует другую сторону</strong>${SIDE_NAMES[rec.best]} (${sideDir(fsAz, rec.best)}) — ${scores[rec.best]} баллов, текущий фасад — ${scores.front}.</div>
      <div class="row wrap">${button(rec.best)}</div>`;
  }
  $('facade-result').innerHTML = result;

  const conflict = [doorNow.side !== 'front' && doorCounts ? `door-${doorNow.side}` : '', rec.filled && (rec.ambiguous || rec.best !== 'front') ? `help-${rec.best}` : '']
    .filter(Boolean).join('|');
  flagConflict(conflict);
}

// Сделать фасадом другую сторону того же дома: дом не двигается, меняются азимут и разметка
function makeFront(newFront) {
  const geoms = [floorGeom(1), floorGeom(2)];
  state.az = norm360(state.az + SIDE_BEARING[newFront]);
  geoms.forEach((g, i) => {
    const n = i + 1;
    const t = transformCuts(g.cuts, g.W, g.D, newFront);
    if (n === 1) {
      state.width = t.W;
      state.depth = t.D;
    } else if (state.width2 !== null) {
      state.width2 = t.W;
      state.depth2 = t.D;
    }
    state[`shape${n}`] = { ...defaultShape(), ...state[`shape${n}`], type: t.cuts.length ? 'custom' : 'rect', cuts: t.cuts };
  });
  if (!state.door.auto) state.door = { ...state.door, side: relabelSide(state.door.side, newFront) };
  const help = { ...emptyHelp(), ...state.facadeHelp };
  state.facadeHelp = emptyHelp();
  for (const side of SIDES_CW) state.facadeHelp[relabelSide(side, newFront)] = help[side];
  renderShapeControls(1);
  renderShapeControls(2);
  render();
  save();
}

$('door-side').addEventListener('change', (e) => {
  state.door = e.target.value === 'auto'
    ? { auto: true, side: 'front', pos: null }
    : { auto: false, side: e.target.value, pos: null };
  render();
  save();
});
$('door-info').addEventListener('click', (e) => {
  const { doorSide, doorPos } = e.target.dataset;
  if (!doorSide) return;
  state.door = { auto: false, side: doorSide, pos: Number(doorPos) };
  render();
  save();
});
$('door-pos').addEventListener('input', (e) => {
  const v = parseFloat(String(e.target.value).replace(',', '.'));
  state.door = { ...state.door, auto: false, pos: Number.isNaN(v) ? null : v };
  render();
  save();
});
$('facade-table').addEventListener('change', (e) => {
  const { crit, side } = e.target.dataset;
  if (!crit) return;
  const help = { ...emptyHelp(), ...state.facadeHelp };
  help[side] = e.target.checked ? [...new Set([...help[side], crit])] : help[side].filter((k) => k !== crit);
  state.facadeHelp = help;
  render();
  save();
});
$('facade-result').addEventListener('click', (e) => {
  const side = e.target.dataset.makeFront;
  if (side) makeFront(side);
});
for (const r of document.querySelectorAll('input[name="bazhai-by"]')) {
  r.addEventListener('change', (e) => {
    state.bazhaiBy = e.target.value;
    render();
    save();
  });
}

// ---- Форма дома ----

function numField(n, key, label, value, cut) {
  const attrs = cut === undefined ? `data-k="${key}"` : `data-k="${key}" data-cut="${cut}"`;
  const id = cut === undefined ? `shape${n}-${key}` : `shape${n}-cut${cut}-${key}`;
  return `<label>${label} <input type="number" id="${id}" min="0" max="60" step="0.5" data-shape="${n}" ${attrs} value="${value ?? ''}"></label>`;
}

function selectField(n, key, label, options, value) {
  return `<label>${label} <select id="shape${n}-${key}" data-shape="${n}" data-k="${key}">${Object.entries(options)
    .map(([v, t]) => `<option value="${v}"${v === value ? ' selected' : ''}>${t}</option>`)
    .join('')}</select></label>`;
}

function renderShapeControls(n) {
  const s = state[`shape${n}`];
  const sides = { front: 'фасада', back: 'тыла' };
  let fields = '';
  if (s.type === 'L') {
    fields = `${selectField(n, 'corner', 'Вырезанный угол', CORNERS, s.corner)}
      <div class="grid2">${numField(n, 'cw', 'Ширина выреза (вдоль фасада), м', s.cw)}${numField(n, 'cd', 'Глубина выреза, м', s.cd)}</div>`;
  } else if (s.type === 'U') {
    fields = `${selectField(n, 'side', 'Вырез посередине со стороны', sides, s.side)}
      <div class="grid2">${numField(n, 'cw', 'Ширина выреза, м', s.cw)}${numField(n, 'cd', 'Глубина выреза, м', s.cd)}</div>`;
  } else if (s.type === 'T') {
    fields = `${selectField(n, 'side', 'Вырезы по углам со стороны', sides, s.side)}
      <div class="grid2">${numField(n, 'cw', 'Ширина каждого выреза, м', s.cw)}${numField(n, 'cd', 'Глубина выреза, м', s.cd)}</div>`;
  } else if (s.type === 'bay') {
    fields = `${selectField(n, 'side', 'Эркер со стороны', BAY_SIDES, s.side in BAY_SIDES ? s.side : 'front')}
      <div class="grid2">${numField(n, 'bw', 'Ширина эркера, м', s.bw ?? 3)}${numField(n, 'bd', 'Вынос эркера, м', s.bd ?? 1.5)}</div>
      <label>Смещение от середины стены, м <input type="number" id="shape${n}-bo" step="0.5" data-shape="${n}" data-k="bo" value="${s.bo ?? 0}"></label>`;
  } else if (s.type === 'custom') {
    fields = `${(s.cuts || []).map((c, i) => `<div class="cut">
        <div class="cut-head">Вырез ${i + 1} <button type="button" class="link" data-shape="${n}" data-remove-cut="${i}" title="Удалить вырез">✕</button></div>
        <div class="grid2">${numField(n, 'x', 'От левого края, м', c.x, i)}${numField(n, 'y', 'От фасада, м', c.y, i)}
        ${numField(n, 'w', 'Ширина, м', c.w, i)}${numField(n, 'h', 'Глубина, м', c.h, i)}</div>
      </div>`).join('')}
      <button type="button" class="secondary" data-shape="${n}" data-add-cut="1">Добавить вырез</button>`;
  }
  $(`shape${n}`).innerHTML = `${selectField(n, 'type', 'Форма', SHAPES, s.type)}${fields}
    ${s.type === 'rect' ? '' : `<p class="note">Слева и справа — если смотреть на фасад снаружи. ${s.type === 'bay'
    ? 'Длина и глубина дома — без эркера; сетка 3×3 строится по габариту вместе с ним.'
    : 'Вырез считается от габарита этажа.'}</p>`}
    <p class="note" id="shape${n}-area"></p>`;
}

for (const n of [1, 2]) {
  const box = $(`shape${n}`);
  box.addEventListener('input', (e) => {
    const { k, cut } = e.target.dataset;
    if (!k || e.target.tagName !== 'INPUT') return;
    const v = parseFloat(String(e.target.value).replace(',', '.'));
    if (Number.isNaN(v)) return;
    const s = state[`shape${n}`];
    if (cut !== undefined) s.cuts[Number(cut)][k] = v;
    else s[k] = v;
    render();
    save();
  });
  box.addEventListener('change', (e) => {
    const { k } = e.target.dataset;
    if (!k || e.target.tagName !== 'SELECT') return;
    const s = state[`shape${n}`];
    s[k] = e.target.value;
    if (k === 'type' && s.type === 'custom' && !s.cuts.length) {
      s.cuts.push({ x: 0, y: 0, w: s.cw, h: s.cd });
    }
    renderShapeControls(n);
    render();
    save();
  });
  box.addEventListener('click', (e) => {
    const s = state[`shape${n}`];
    if (e.target.dataset.addCut) s.cuts.push({ x: 0, y: 0, w: 3, h: 3 });
    else if (e.target.dataset.removeCut !== undefined) s.cuts.splice(Number(e.target.dataset.removeCut), 1);
    else return;
    renderShapeControls(n);
    render();
    save();
  });
}

function mountainLabel(m) {
  const p = PALACES[m.palace];
  return `${m.hanzi} ${m.name}, ${m.code} <span class="note">(${p.dirName}, ${m.subName}, ${m.yang ? 'ян' : 'инь'})</span>`;
}

function renderAzimuth(decl, magAz, fsAz, chart) {
  $('azimuth-out').innerHTML = `
    <dt>Истинный азимут фасада</dt><dd>${fmt(state.az)}°</dd>
    <dt>Склонение (${MODEL_NAME})</dt><dd>${fmt(decl)}° ${decl < 0 ? 'западное' : 'восточное'}</dd>
    <dt>Магнитный азимут фасада</dt><dd class="big">${fmt(magAz)}°</dd>
    <dt>Азимут тыла (${state.mode === 'magnetic' ? 'магн.' : 'ист.'})</dt><dd>${fmt(norm360(fsAz + 180))}°</dd>
    <dt>Гора фасада</dt><dd>${mountainLabel(chart.facing)}</dd>
    <dt>Гора тыла</dt><dd>${mountainLabel(chart.sitting)}</dd>
    <dt>Дом</dt><dd>сидит на ${chart.sittingPalace.dirName.toLowerCase()}е, смотрит на ${chart.facingPalace.dirName.toLowerCase()}</dd>`;
  const warn = boundaryWarning(fsAz);
  $('boundary-warn').innerHTML = warn
    ? `<div class="msg ${warn.betweenPalaces ? 'bad' : 'mixed'}"><strong>Азимут у границы</strong>${warn.text}</div>`
    : '';
}

const LAYOUTS = {
  south: [4, 9, 2, 3, 5, 7, 8, 1, 6],
  north: [6, 1, 8, 7, 5, 3, 2, 9, 4],
};

function renderStars(chart, fsAz) {
  const period = chart.period;
  const star = (n) => (n === period ? `<span class="star-wang">${n}</span>` : String(n));
  const plan = state.orient.startsWith('plan');
  $('stars-grid').hidden = plan;
  $('stars-plans').hidden = !plan;
  const floors = [{ n: 1, title: state.floor2 ? '1 этаж' : '', g: floorGeom(1) }];
  if (state.floor2) floors.push({ n: 2, title: '2 этаж', g: floorGeom(2) });
  if (plan) {
    const facadeTop = state.orient === 'plan-top';
    // Общий масштаб, чтобы этажи было видно в настоящих пропорциях
    const scale = 300 / Math.max(...floors.flatMap((f) => [f.g.W, f.g.D]));
    $('stars-plans').innerHTML = floors.map((f) => planSvg(chart, fsAz, f.g, f.title, facadeTop, scale, f.n)).join('')
      + '<p class="note">Красная линия — фасад, синяя — входная дверь.</p>'
      + (state.floor2 ? '<p class="note">Карта звёзд одна на всё здание и строится по фасаду дома. Сетка 3×3 накладывается на контур каждого этажа отдельно.</p>' : '');
  }
  const cov1 = palaceCoverage(chart, floors[0].g);
  $('stars-grid').innerHTML = (LAYOUTS[state.orient] || [])
    .map((lo) => {
      const p = chart.palaces[lo];
      const palace = PALACES.find((x) => x.lo === lo);
      const cls = lo === chart.facingPalace.lo ? 'facing' : lo === chart.sittingPalace.lo ? 'sitting' : '';
      const tag = cls === 'facing' ? 'фасад' : cls === 'sitting' ? 'тыл' : '';
      const missing = isMissing(cov1[lo]);
      const mark = (n) => (missing ? `<span class="missing-star">${n}${n === period ? '<span class="alarm">❗</span>' : ''}</span>` : star(n));
      return `<div class="cell ${cls}${missing ? ' missing' : ''}">
        <div class="dir">${palace ? palace.dirName : 'Центр'}</div>
        ${tag ? `<div class="tag">${tag}</div>` : ''}
        <div class="pair"><span title="звезда горы">${mark(p.mountain)}</span><span title="звезда воды">${mark(p.water)}</span></div>
        <div class="base">${p.base}</div>
      </div>`;
    })
    .join('');

  const patterns = chart.patterns.length
    ? chart.patterns
    : [{ kind: 'mixed', title: 'Особых схем нет', text: 'Оценка идёт по сочетаниям звёзд в каждом секторе.' }];
  const hetu = chart.period === 9
    ? heTuPairs(planLayout(chart), chart.palaces).filter((h, i, all) => all.findIndex((x) => x.from === h.from && x.to === h.to) === i)
      .map((h) => `<div class="msg good"><strong>Хэ-ту: ${PALACES.find((q) => q.lo === h.from).dir} и ${PALACES.find((q) => q.lo === h.to).dir}</strong>${h.text[0].toUpperCase()}${h.text.slice(1)}.</div>`)
    : [];
  const nine = chart.period === 9 ? doubleNine(chart.palaces) : null;
  if (nine) {
    const dir = PALACES.find((q) => q.lo === nine).dirName;
    hetu.push(`<div class="msg good"><strong>Двойная 9 в секторе ${dir}: идеальный вариант — двухэтажный дом</strong>Вход на первом этаже в секторе ${dir} использует водную 9, а спальня над ним на втором этаже — горную 9.${
      state.floor2 ? (state.door.auto ? ' Дверь поставлена сюда автоматически.' : '') : ' Отметьте второй этаж в разделе «Дом», чтобы так и сделать.'}</div>`);
    if (!state.floor2) {
      hetu.push(`<div class="msg good"><strong>Двойная 9 в одноэтажном доме</strong>Обе девятки в одной комнате лучше всего используют кабинет (горная и водная 9 хороши для кабинета) или гостиная с камином (водная 9 — для гостиной, горная 9 — для камина и плиты). Компромисс — спальня с рабочей зоной: горная 9 даёт сон, а работа днём активирует водную 9. Включите в техзадании кабинет или «Рабочую зону в спальне родителей».</div>`);
    }
  }
  $('patterns').innerHTML = missingMessages(chart, floors).join('') + hetu.join('')
    + patterns.map((p) => `<div class="msg ${p.kind}"><strong>${p.title}</strong>${p.text}</div>`).join('');

  $('stars-legend').innerHTML = `<div class="table-wrap"><table><tr><th>№</th><th>Звезда</th><th>В ${period}-м периоде</th><th>Значение</th><th>Коррекция</th></tr>${
    Object.entries(STARS)
      .map(([n, s]) => {
        const t = starState(Number(n), period);
        const good = t.key === 'wang' || t.key === 'sheng';
        return `<tr><td>${n}</td><td>${s.color} ${s.name}<br><span class="note">${s.element}</span></td><td class="${good ? 'good' : t.key === 'shuai' ? 'bad' : ''}">${t.label}</td><td>${starMeaning(Number(n), period)}</td><td>${s.remedy || s.note || '—'}</td></tr>`;
      })
      .join('')
  }</table></div>`;

  renderRemedies(chart, floors);
}

const FIT = {
  good: ['✓', 'хорошо'],
  ok: ['○', 'можно'],
  fix: ['!', 'с коррекцией'],
  bad: ['✗', 'нельзя'],
  na: ['–', 'в описании не сказано'],
};

// Жильцы с заполненной датой рождения: их числа Гуа
function peopleGuas() {
  return state.people.filter((p) => p.birth).map((p) => guaNumber(p.birth, p.sex).gua);
}

// Что где разместить: помещения по звёздам секторов и описания звёзд (9-й период)
function renderRemedies(chart, floors) {
  const box = $('remedies');
  if (chart.period !== 9) {
    box.innerHTML = '<p class="note">Описания размещения помещений даны для 9-го периода.</p>';
    return;
  }
  const cov = palaceCoverage(chart, floors[0].g);
  // Сектора в порядке плана: от фасада по часовой стрелке
  const order = [];
  planLayout(chart).forEach((r) => r.forEach((lo) => { if (lo !== 5) order.push(lo); }));
  order.sort((a, b) => ((PALACES.findIndex((q) => q.lo === a) - chart.facing.palace + 8) % 8) - ((PALACES.findIndex((q) => q.lo === b) - chart.facing.palace + 8) % 8));

  const cell = (fit) => (fit ? `<td class="fit fit-${fit}" title="${FIT[fit][1]}">${FIT[fit][0]}</td>` : '<td class="fit fit-none" title="описание звезды ещё не добавлено">?</td>');
  const rows = order.map((lo) => {
    const palace = PALACES.find((q) => q.lo === lo);
    const p = chart.palaces[lo];
    const tag = lo === chart.facingPalace.lo ? ' <span class="note">фасад</span>' : lo === chart.sittingPalace.lo ? ' <span class="note">тыл</span>' : '';
    const missing = isMissing(cov[lo]) ? ' <span class="note">(неполный)</span>' : '';
    return `<tr><td>${palace.dir}${tag}${missing}</td><td class="stars-pair">${p.mountain} ${p.water}</td>${ROOMS.map((r) => cell(roomFit(r.key, p.mountain, p.water))).join('')}</tr>`;
  }).join('');

  const describe = (kind, n) => {
    const d = (kind === 'mountain' ? MOUNTAIN : WATER)[n];
    const label = `${kind === 'mountain' ? 'Горная' : 'Водная'} ${n}`;
    if (!d || !d.text) return `<p><strong>${label}.</strong> <span class="note">Описание ещё не добавлено.</span> ${STARS[n].remedy ? `Коррекция: ${STARS[n].remedy}` : ''}</p>`;
    const free = kind === 'mountain' && UNFAVORABLE_MOUNTAIN.includes(n)
      ? ' Сектор можно отдать кладовке, санузлу или активной зоне — там никто не спит.'
      : '';
    return `<p><strong>${label}.</strong> ${d.text}${free}${d.bedroom ? ` ${d.bedroom}` : ''}${d.support ? ` <em>${d.support}</em>` : ''}${d.partial ? ' <span class="note">(описание неполное)</span>' : ''}</p>`;
  };
  const details = order.map((lo) => {
    const palace = PALACES.find((q) => q.lo === lo);
    const p = chart.palaces[lo];
    return `<details class="sector-desc"><summary>${palace.dirName}: горная ${p.mountain}, водная ${p.water}</summary>${describe('mountain', p.mountain)}${describe('water', p.water)}</details>`;
  }).join('');

  box.innerHTML = `<h3 class="sub">Что где разместить</h3>
    <div class="table-wrap"><table class="fit-table"><tr><th>Сектор</th><th>Гора, вода</th>${ROOMS.map((r) => `<th>${r.label}</th>`).join('')}</tr>${rows}</table></div>
    <p class="note">✓ хорошо · ○ можно · ! с коррекцией · ✗ нельзя · – в описании не сказано · ? описание звезды ещё не добавлено. Спальня и плита — по горной звезде, остальное — по водной. Неблагоприятные звёзды (2, 3, 4, 5, 7) лучше отдать санузлу или кладовке: водные — «смыть», горные — там никто не спит; горные можно и под активную зону. Исключения: сектор горной 9 и водные 9, 1, 8 — их не «смываем».</p>
    <h3 class="sub">Звёзды по секторам</h3>${details}`;
}

// Сообщения об отсутствующих секторах
function missingMessages(chart, floors) {
  const out = [];
  for (const f of floors) {
    const cov = palaceCoverage(chart, f.g);
    for (const palace of PALACES) {
      if (!isMissing(cov[palace.lo])) continue;
      const p = chart.palaces[palace.lo];
      const where = f.title ? ` (${f.title})` : '';
      const lost = [];
      if (p.mountain === chart.period) lost.push('звезда горы — здоровье, люди, отношения');
      if (p.water === chart.period) lost.push('звезда воды — деньги, доход');
      const share = `Дом занимает ${fmt(cov[palace.lo] * 100, 0)}% сектора.`;
      const text = lost.length
        ? `Нет звезды периода ${chart.period}: ${lost.join('; ')}. ${share} Сектор нужно восполнить коррекцией.`
        : `Звезда горы ${p.mountain}, звезда воды ${p.water}. ${share}`;
      const what = sectorStatus(cov[palace.lo]) === 'none' ? 'Отсутствует сектор' : 'Отсутствует часть сектора';
      out.push(`<div class="msg ${lost.length ? 'bad' : 'mixed'}"><strong>${lost.length ? '❗ ' : ''}${what} ${palace.dirName}${where}</strong>${text}</div>`);
    }
  }
  return out;
}

// План этажа с сеткой 3×3 по стенам дома. Фасад снизу (или сверху).
// Вырезанные части заштрихованы, в отсутствующих секторах цифры красные.
function planSvg(chart, fsAz, g, title, facadeTop, scale, n) {
  const { W, D } = g;
  const pw = W * scale;
  const ph = D * scale;
  const padX = 34;
  const padTop = title ? 40 : 26;
  const padBottom = 46;
  const vw = pw + padX * 2;
  const vh = ph + padTop + padBottom;
  const cw = pw / 3;
  const ch = ph / 3;
  const fs = Math.max(13, Math.min(26, Math.min(cw, ch) * 0.3));
  const small = Math.max(10, fs * 0.5);
  const x0 = padX;
  const y0 = padTop;
  const period = chart.period;
  const layout = planLayout(chart, facadeTop);
  const hatch = `hatch-${n}`;
  // Точка плана в координатах рисунка
  const pt = (x, y) => (facadeTop ? [x0 + (W - x) * scale, y0 + y * scale] : [x0 + x * scale, y0 + (D - y) * scale]);
  const rectOf = (x1, y1, x2, y2) => {
    const [ax, ay] = pt(x1, y1);
    const [bx, by] = pt(x2, y2);
    return `x="${Math.min(ax, bx)}" y="${Math.min(ay, by)}" width="${Math.abs(bx - ax)}" height="${Math.abs(by - ay)}"`;
  };
  const parts = [
    `<defs><pattern id="${hatch}" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)"><line class="hatch-line" x1="0" y1="0" x2="0" y2="8"/></pattern></defs>`,
  ];

  if (title) parts.push(`<text class="plan-title" x="${x0}" y="16">${title}</text>`);

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const lo = layout[i][j];
      const cls = lo === chart.facingPalace.lo ? 'facing' : lo === chart.sittingPalace.lo ? 'sitting' : '';
      parts.push(`<rect class="plan-cell ${cls}" x="${x0 + j * cw}" y="${y0 + i * ch}" width="${cw}" height="${ch}"/>`);
    }
  }
  for (const p of pieces(g.dec)) {
    // Штрихуем вырез, только если сектор считается неполным (не хватает больше трети)
    const [r, c] = cellOf(W, D, (p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2);
    if (!p.inside && isMissing(g.cov[r][c])) parts.push(`<rect class="plan-cut" fill="url(#${hatch})" ${rectOf(p.x1, p.y1, p.x2, p.y2)}/>`);
  }
  for (const sg of outline(g.dec)) {
    const [ax, ay] = pt(sg.x1, sg.y1);
    const [bx, by] = pt(sg.x2, sg.y2);
    const front = sg.facing === 'front';
    parts.push(`<line class="${front ? 'plan-facade' : 'plan-wall'}" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`);
  }

  if (n === 1) {
    const door = doorPoint(doorNow, W, D);
    const half = Math.max(0.6, 6 / scale);
    const [ax, ay] = pt(door.x - (door.along === 'x' ? half : 0), door.y - (door.along === 'y' ? half : 0));
    const [bx, by] = pt(door.x + (door.along === 'x' ? half : 0), door.y + (door.along === 'y' ? half : 0));
    parts.push(`<line class="plan-door" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"><title>Входная дверь</title></line>`);
  }

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const lo = layout[i][j];
      const p = chart.palaces[lo];
      const cov = facadeTop ? g.cov[2 - i][2 - j] : g.cov[i][j];
      const missing = isMissing(cov);
      const x = x0 + j * cw;
      const y = y0 + i * ch;
      const dir = lo === 5 ? 'центр' : PALACES.find((q) => q.lo === lo).dir;
      const sy = y + ch / 2 + fs * 0.3;
      const star = (num, dx) => {
        const sx = x + cw / 2 + dx;
        const cls = missing ? ' missing' : num === period ? ' wang' : '';
        // Пропавшая звезда периода — красный знак у правого верхнего края цифры
        const alarm = missing && num === period
          ? `<text class="alarm" x="${sx + fs * 0.32}" y="${sy - fs * 0.45}" font-size="${fs * 0.55}">❗</text>`
          : '';
        return `<text class="plan-star${cls}" x="${sx}" y="${sy}" font-size="${fs}" text-anchor="middle">${num}</text>${alarm}`;
      };
      const gap = missing ? fs * 0.7 : fs * 0.5;
      parts.push(
        `<text class="plan-dir${missing ? ' missing' : ''}" x="${x + 4}" y="${y + small + 2}" font-size="${small}">${dir}${missing ? ` · ${missingLabel(cov)}` : ''}</text>`,
        star(p.mountain, -gap),
        star(p.water, gap),
        `<text class="plan-base${missing ? ' missing' : ''}" x="${x + cw / 2}" y="${y + ch / 2 + fs * 0.3 + small + 4}" font-size="${small}" text-anchor="middle">${p.base}</text>`,
      );
    }
  }

  const labelY = facadeTop ? y0 - 8 : y0 + ph + 18;
  const facadeText = `Фасад ${fmt(W, W % 1 ? 1 : 0)} м → ${chart.facingPalace.dirName} ${fmt(fsAz)}°`;
  parts.push(`<text class="plan-label" x="${x0 + pw / 2}" y="${labelY}" text-anchor="middle">${facadeText}</text>`);
  const backY = facadeTop ? y0 + ph + 18 : y0 - 8;
  parts.push(`<text class="plan-label muted" x="${x0 + pw / 2}" y="${backY}" text-anchor="middle">тыл → ${chart.sittingPalace.dirName}</text>`);
  parts.push(`<text class="plan-label muted" x="${x0 + pw + 14}" y="${y0 + ph / 2}" text-anchor="middle" transform="rotate(90 ${x0 + pw + 14} ${y0 + ph / 2})">${fmt(D, D % 1 ? 1 : 0)} м</text>`);

  // Стрелка на север (по тому же азимуту, что и расчёт)
  const northAngle = (facadeTop ? 0 : 180) - fsAz;
  const cx = x0 + pw + 14;
  const cy = vh - 22;
  parts.push(`<g transform="translate(${cx} ${cy}) rotate(${northAngle})"><path class="plan-north" d="M0 -12 L5 4 L0 1 L-5 4 Z"/><text class="plan-label" x="0" y="-15" text-anchor="middle" font-size="10">С</text></g>`);

  return `<svg class="plan" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}" role="img" aria-label="План ${title || 'дома'} со звёздами">${parts.join('')}</svg>`;
}

function directionsTable(dirs) {
  return `<table><tr><th>Сектор</th><th>Звезда</th><th>Значение</th></tr>${dirs
    .map((d) => `<tr><td>${d.dir}</td><td class="${d.good ? 'good' : 'bad'}">${d.name}</td><td>${d.ru}</td></tr>`)
    .join('')}</table>`;
}

function renderBazhai(fsAz) {
  const h = bazhaiHouse(fsAz);
  $('bazhai').innerHTML = `
    <dl class="kv">
      <dt>Дом</dt><dd>${h.palace.name} (Гуа ${h.gua}) — ${state.bazhaiBy === 'door' ? 'по двери, ' : ''}сидит на ${h.palace.dirName.toLowerCase()}е</dd>
      <dt>Группа</dt><dd>${h.group}</dd>
    </dl>
    ${directionsTable(h.directions)}`;
}

function renderPeople(fsAz) {
  const house = bazhaiHouse(fsAz);
  const box = $('people');
  if (!state.people.length) {
    box.innerHTML = '<p class="note">Добавьте жильцов: число Гуа покажет их благоприятные направления и совместимость с домом.</p>';
    return;
  }
  box.innerHTML = state.people
    .map((p, i) => {
      let result = '';
      if (p.birth) {
        const g = guaNumber(p.birth, p.sex);
        const age = ageOf(p.birth);
        const match = g.group === house.group;
        const best = bazhaiDirections(g.gua).filter((d) => d.good);
        result = `
          <div class="msg ${match ? 'good' : 'mixed'}">
            <strong>${age} ${yearsWord(age)} · Гуа ${g.gua} — ${g.group} группа</strong>
            ${match ? 'Совпадает с группой дома.' : 'Не совпадает с группой дома: важны направление кровати, рабочего места и двери спальни.'}
            ${g.uncertain ? '<br>Дата около Ли Чунь (3–5 февраля): проверьте точный день начала года.' : ''}
          </div>
          <p class="note">Благоприятные направления: ${best.map((d) => `${d.dir} — ${d.name} (${d.ru})`).join('; ')}.</p>
          ${bedroomNote(g.gua)}`;
      }
      return `<div class="person" data-i="${i}">
        <div class="grid3">
          <label>Имя <input data-f="name" value="${escapeHtml(p.name || '')}"></label>
          <label>Дата рождения <input type="date" data-f="birth" value="${p.birth || ''}"></label>
          <label>Пол <select data-f="sex"><option value="m"${p.sex === 'm' ? ' selected' : ''}>муж.</option><option value="f"${p.sex === 'f' ? ' selected' : ''}>жен.</option></select></label>
          <label>Кто <select data-f="role"><option value="adult"${personRole(p) === 'adult' ? ' selected' : ''}>взрослый</option><option value="child"${personRole(p) === 'child' ? ' selected' : ''}>ребёнок</option></select></label>
          <button type="button" class="link" data-remove="${i}" title="Удалить">✕</button>
        </div>
        ${result}
      </div>`;
    })
    .join('');
}

// Где спать человеку по горным звёздам (9-й период)
function bedroomNote(gua) {
  const chart = currentChart;
  if (!chart || chart.period !== 9) return '';
  const label = { ideal: 'идеально', good: 'хорошо', ok: 'можно для этого Гуа', fix: 'на первом этаже мешает водная 9, на втором этаже — хорошо' };
  const list = bedroomsFor(gua, chart.palaces)
    .map((b) => `${PALACES.find((q) => q.lo === b.lo).dirName} (горная ${b.mountain} — ${label[b.level === 'good' && b.mountain === 9 ? 'ideal' : b.level]})`);
  return list.length
    ? `<p class="note"><strong>Спальня:</strong> ${list.join('; ')}.</p>`
    : '<p class="note"><strong>Спальня:</strong> подходящих секторов нет — нужна коррекция.</p>';
}

function ageOf(birth) {
  const [y, m, d] = birth.split('-').map(Number);
  const now = new Date();
  return now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
}

function yearsWord(n) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return 'год';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'года';
  return 'лет';
}

// Роль жильца: выбранная или по возрасту (младше 18 — ребёнок)
function personRole(p) {
  if (p.role) return p.role;
  return p.birth && ageOf(p.birth) < 18 ? 'child' : 'adult';
}

// ---- Техзадание ----

const ROOM_KEYS = ['kitchen', 'master', 'suite', 'masterWork', 'guest', 'office', 'boiler', 'laundry', 'storage', 'wardrobe'];

function renderProgramInputs() {
  for (const btn of document.querySelectorAll('#room-chips .chip')) {
    btn.setAttribute('aria-pressed', state.program[btn.dataset.room] ? 'true' : 'false');
  }
  const { children } = layoutPeople();
  const kids = state.program.kids ?? children.length;
  $('pg-kids-val').textContent = state.program.kids === null ? `${kids} (по числу детей)` : String(kids);
  $('pg-kids-auto').hidden = state.program.kids === null;
  $('pg-baths-val').textContent = String(state.program.baths);
}

$('room-chips').addEventListener('click', (e) => {
  const room = e.target.dataset.room;
  if (!room) return;
  state.program[room] = !state.program[room];
  // Спальня родителей и мастер-спальня — одна из двух
  if (room === 'suite' && state.program.suite) state.program.master = false;
  if (room === 'master' && state.program.master) state.program.suite = false;
  render();
  save();
});

$('steppers').addEventListener('click', (e) => {
  const { step, d } = e.target.dataset;
  if (!step) return;
  if (step === 'kids') {
    const { children } = layoutPeople();
    const cur = state.program.kids ?? children.length;
    state.program.kids = d === 'auto' ? null : Math.max(0, Math.min(5, cur + Number(d)));
  } else {
    state.program.baths = Math.max(0, Math.min(4, state.program.baths + Number(d)));
  }
  render();
  save();
});

$('door-nine').addEventListener('change', (e) => {
  state.doorNine = e.target.checked;
  render();
  save();
});

// ---- Планировочное решение ----

const DIR_BEARING = { С: 0, СВ: 45, В: 90, ЮВ: 135, Ю: 180, ЮЗ: 225, З: 270, СЗ: 315 };
const bearingDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const FIT_WORD = { good: 'хорошо', ok: 'можно', fix: 'с коррекцией', bad: 'не подходит', na: 'в описании не сказано' };

// Стена комнаты на плане (фасад снизу) и её направление по азимуту расчёта
const sideBearing = (fsAz) => ({ bottom: fsAz, left: fsAz + 90, top: fsAz + 180, right: fsAz + 270 });

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

// Что лежит в направлении стены: сектор этого направления и его водная звезда
function towardWater(chart, fsAz, side, extra = {}) {
  const b = norm360(sideBearing(fsAz)[side]);
  const lo = PALACES[mountainAt(b).palace].lo;
  const w = chart.palaces[lo].water;
  return { lo, w, dir: dir8(b), score: WATER_FACE[w] ?? extra[w] ?? 0 };
}

// Насколько направление благоприятно по Гуа (Ба Чжай): 4 — Шэн Ци … 1 — Фу Вэй, −1 — неблагоприятное
function guaDirScore(gua, bearing) {
  if (!gua) return 0;
  const d = dir8(bearing);
  const i = bazhaiDirections(gua).findIndex((x) => x.dir === d);
  return i < 0 ? 0 : i < 4 ? 4 - i : -1;
}

/**
 * Кровать: ногами — в направлении благоприятной водной звезды,
 * изголовье — напротив; при равенстве — по благоприятному направлению Гуа для изголовья.
 */
function bedPlacement(chart, fsAz, gua) {
  const sides = ['top', 'bottom', 'left', 'right'];
  return sides
    .map((feet) => {
      const head = OPPOSITE[feet];
      const t = towardWater(chart, fsAz, feet);
      return { head, feet, toward: t, headDir: dir8(norm360(sideBearing(fsAz)[head])), score: t.score * 10 + guaDirScore(gua, norm360(sideBearing(fsAz)[head])) };
    })
    .sort((a, b) => b.score - a.score)[0];
}

// Плита у стены, ручки и духовка смотрят от стены — на благоприятную водную звезду или водные 3, 4
function stovePlacement(chart, fsAz, cell) {
  return ['top', 'bottom', 'left', 'right']
    .map((wall) => {
      const t = towardWater(chart, fsAz, OPPOSITE[wall], { 3: 2, 4: 2 });
      return { wall, toward: t, score: t.score * 10 + (wall === outerSide(cell.row, cell.col) ? 1 : 0) };
    })
    .sort((a, b) => b.score - a.score)[0];
}

// Письменный стол: сидеть лицом на благоприятную водную звезду; стол — у стены в эту сторону
function deskPlacement(chart, fsAz, gua) {
  return ['top', 'bottom', 'left', 'right']
    .map((face) => {
      const t = towardWater(chart, fsAz, face);
      return { face, toward: t, score: t.score * 10 + guaDirScore(gua, norm360(sideBearing(fsAz)[face])) };
    })
    .sort((a, b) => b.score - a.score)[0];
}

// Стол в спальне: лицом на благоприятную водную звезду, но не у стены изголовья
function bedroomDesk(chart, fsAz, gua, headSideName) {
  return ['top', 'bottom', 'left', 'right']
    .filter((face) => face !== headSideName)
    .map((face) => {
      const t = towardWater(chart, fsAz, face);
      return { face, toward: t, score: t.score * 10 + guaDirScore(gua, norm360(sideBearing(fsAz)[face])) };
    })
    .sort((a, b) => b.score - a.score)[0];
}

// Наружная стена клетки для мебели у стены
const outerSide = (row, col) => (row === 0 ? 'top' : row === 2 ? 'bottom' : col === 0 ? 'left' : col === 2 ? 'right' : 'top');

function layoutPeople() {
  const people = state.people.filter((p) => p.birth).map((p) => ({ ...p, gua: guaNumber(p.birth, p.sex).gua, role: personRole(p) }));
  const adults = people.filter((p) => p.role === 'adult');
  const children = people.filter((p) => p.role === 'child');
  return { adults, children };
}

// Планировка дома при заданной входной двери: этажи с комнатами и общие замечания
function buildLayout(chart, door) {
  const { adults, children } = layoutPeople();
  const kidsCount = state.program.kids ?? children.length;
  const kids = Array.from({ length: kidsCount }, (_, i) => children[i]?.gua ?? null);
  const program = { ...state.program, kids };
  const parents = adults.map((p) => p.gua);
  const layout = planLayout(chart);
  const cellsOf = (g) => floorCells(chart, g);
  const posOf = (lo) => {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (layout[r][c] === lo) return `${r}-${c}`;
    return null;
  };

  const g1 = floorGeom(1);
  const fixed1 = { '1-1': { key: 'hall', label: state.floor2 ? 'Холл, лестница' : 'Холл', type: 'hall' } };
  const doorPos = posOf(doorSector(door, g1.W, g1.D, layout));
  if (doorPos && doorPos !== '1-1') fixed1[doorPos] = { key: 'entry', label: 'Прихожая, тамбур', type: 'entry' };
  // Ручные правки: помещение в выбранном секторе (кроме холла и прихожей)
  const withOverrides = (n, fixed) => {
    for (const [k, r] of Object.entries(state.overrides)) {
      const [floor, cell] = k.split(':');
      if (Number(floor) !== n || fixed[cell]) continue;
      fixed[cell] = { ...r, primary: cell, manual: true };
    }
    return fixed;
  };
  withOverrides(1, fixed1);

  const floors = [];
  const notes = [];
  if (!state.floor2) {
    const res = planRooms(cellsOf(g1), roomsFor(program, parents), fixed1);
    floors.push({ n: 1, title: '', g: g1, fixed: fixed1, res, door });
  } else {
    const g2 = floorGeom(2);
    // Сначала второй этаж со спальнями, затем санузлы первого этажа — под мокрой точкой второго
    const fixed2 = withOverrides(2, { '1-1': { key: 'hall', label: 'Холл, лестница', type: 'hall' } });
    const res2 = planRooms(cellsOf(g2), roomsFor(program, parents, { living: false, bathCount: Math.max(0, program.baths - 1) }), fixed2, { upper: true });
    const res1 = planRooms(cellsOf(g1), roomsFor(program, parents, { bedrooms: false, bathCount: Math.min(1, program.baths) }), fixed1, { wetAbove: res2.wetKeys });
    floors.push({ n: 1, title: '1 этаж', g: g1, fixed: fixed1, res: res1, door }, { n: 2, title: '2 этаж', g: g2, fixed: fixed2, res: res2 });
    if (program.baths < 2 && !program.suite) notes.push('<li>Спальни на втором этаже, а санузел один — на первом. Добавьте второй санузел или мастер-спальню в техзадании, чтобы санузел был и наверху.</li>');
    const stacked = [...res2.wetKeys].filter((k) => res1.wetKeys.has(k));
    if (res2.wetKeys.size) {
      notes.push(stacked.length
        ? `<li><strong>Мокрая точка:</strong> санузлы второго этажа (${stacked.map((k) => dirOf(layout[k[0]][k[2]])).join(', ')}) стоят над санузлами первого — один стояк.</li>`
        : '<li><strong>Мокрая точка:</strong> поставить санузлы второго этажа над первым не удалось по звёздам — проверьте вручную.</li>');
    }
  }

  // Холл занял много свободных секторов — это зона отдыха; подсказываем пересмотреть размеры
  for (const f of floors) {
    const hall = f.fixed['1-1'];
    if (hall?.extra?.length >= 2) {
      hall.label = `${hall.label}, зона отдыха`;
      notes.push(`<li><strong>Много свободного места${f.title ? ` (${f.title})` : ''}:</strong> к холлу отошли ${hall.extra.length} сектора. Можно уменьшить ${f.n === 2 ? 'второй этаж' : 'дом'} или добавить комнаты в техзадании.</li>`);
    }
  }
  for (const f of floors) f.doorPos = f.n === 1 ? doorPos : null;
  const score = floors.reduce((s, f) => s + f.res.score, 0);
  const dropped = floors.reduce((s, f) => s + f.res.dropped.length, 0);
  return { floors, notes, adults, children, layout, score, dropped };
}

function renderLayout(chart, fsAz) {
  if (chart.period !== 9) {
    $('layout-plans').innerHTML = '';
    $('layout-notes').innerHTML = '<p class="note">Планировочное решение строится для 9-го периода.</p>';
    $('layout-variants').innerHTML = '';
    return;
  }
  const { floors, notes, adults, children, layout } = buildLayout(chart, doorNow);
  const scale = 300 / Math.max(...floors.flatMap((f) => [f.g.W, f.g.D]));
  $('layout-plans').innerHTML = floors.map((f) => layoutSvg(chart, fsAz, f, scale, adults, children)).join('')
    + `<p class="note star-legend">В каждой клетке: <span class="pill-inline pill-mid">Г</span> горная звезда — сон, здоровье, отношения;
      <span class="pill-inline pill-mid">В</span> водная — деньги, активность. Цвет:
      <span class="pill-inline pill-wang">9</span> звезда периода,
      <span class="pill-inline pill-good">1 2</span> растущие,
      <span class="pill-inline pill-mid">6 8</span> нейтральные (8 — уходящая),
      <span class="pill-inline pill-bad">3 4 5 7</span> неблагоприятные. Наведите на клетку, чтобы увидеть значение звёзд.</p>`;

  for (const f of floors) {
    const where = f.title ? ` (${f.title})` : '';
    if (f.res.wetKeys.size > 1) {
      notes.push(f.res.wetConnected
        ? `<li><strong>Мокрая точка${where}:</strong> санузлы рядом друг с другом — ${[...f.res.wetKeys].map((k) => dirOf(layout[k[0]][k[2]])).join(', ')}.</li>`
        : `<li><strong>Мокрая точка${where}:</strong> собрать все санузлы рядом не получилось — уменьшите их число или проверьте вручную.</li>`);
    }
    for (const r of f.res.dropped) notes.push(`<li><strong>${r.label}${where}</strong> не поместилась. Увеличьте дом или добавьте второй этаж.</li>`);
    for (const m of f.res.merged) notes.push(`<li>${m}${where}.</li>`);
    notes.push(...roomNotes(chart, fsAz, f, adults, children));
  }
  if (!adults.length && !children.length) notes.unshift('<li class="note">Добавьте жильцов с датами рождения: спальни подбираются под Гуа тех, кто в них спит.</li>');
  notes.push('<li><strong>Окна:</strong> на юг — большие (1,8 м), на восток и запад — средние (1,2 м), на север — небольшие (0,9 м), чтобы дом меньше остывал. В котельной — окно с форточкой: по нормам для газового котла оно обязательно.</li>');
  $('layout-notes').innerHTML = `<h3 class="sub">Почему так</h3><ul class="layout-notes">${notes.join('')}</ul>`;
  renderEditor(chart, floors);
  renderVariants(chart, fsAz);
}

// ---- Ручная правка планировки ----

let editCell = null; // {floor, cell}

const GENERIC_ROOMS = [
  { label: 'Гостиная', type: 'office' },
  { label: 'Кабинет', type: 'office' },
  { label: 'Спальня', type: 'bedroom' },
  { label: 'Детская', type: 'bedroom' },
  { label: 'Гардеробная', type: 'utility' },
  { label: 'Кладовка', type: 'utility' },
  { label: 'Санузел', type: 'utility', wet: true },
  { label: 'Постирочная', type: 'utility', wet: true },
  { label: 'Сауна', type: 'utility', wet: true },
];
const KIND_TYPE = { active: { type: 'office' }, sleep: { type: 'bedroom' }, utility: { type: 'utility' }, wet: { type: 'utility', wet: true } };
const KIND_LABEL = { active: 'жилое (по водной звезде)', sleep: 'спальня (по горной звезде)', utility: 'подсобное', wet: 'мокрое (в мокрую точку)' };

function renderEditor(chart, floors) {
  const custom = state.program.custom || [];
  const customList = custom.map((c, i) => `<div class="custom-row">
      <label>Название <input id="custom-name-${i}" data-custom="${i}" data-f="name" value="${escapeHtml(c.name || '')}"></label>
      <label>Тип <select id="custom-kind-${i}" data-custom="${i}" data-f="kind">${Object.entries(KIND_LABEL).map(([k, t]) => `<option value="${k}"${c.kind === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <button type="button" class="link" data-custom-remove="${i}" title="Удалить">✕</button>
    </div>`).join('');
  let panel = '<p class="note">Нажмите на сектор плана, чтобы поставить туда другое помещение. Остальные комнаты разложатся заново.</p>';
  if (editCell) {
    const f = floors.find((x) => x.n === editCell.floor);
    const c = f && floorCells(chart, f.g).find((x) => `${x.row}-${x.col}` === editCell.cell);
    if (c) {
      const ovKey = `${editCell.floor}:${editCell.cell}`;
      const current = { ...f.res.assign, ...f.fixed }[editCell.cell];
      const programRooms = [...new Map(Object.values({ ...f.res.assign, ...f.fixed })
        .filter((r) => !['hall', 'entry'].includes(r.type) && !r.key.startsWith('ovr-'))
        .map((r) => [r.key, r])).values()];
      const fits = ROOMS.map((r) => {
        const fit = roomFit(r.key, c.mountain, c.water);
        return `<span>${r.label}: <strong class="fit-${fit || 'none'}">${fit ? FIT[fit][0] : '?'}</strong></span>`;
      }).join('');
      panel = `<div class="editor">
        <strong>Сектор ${dirOf(c.lo)}${f.title ? `, ${f.title}` : ''}: горная ${c.mountain}, водная ${c.water}${dir8(c.sun) ? ` · по свету ${dir8(c.sun)}` : ''}</strong>
        <span class="note">Сейчас: ${current?.label || '—'}</span>
        <div class="fits">${fits}</div>
        <label>Поставить сюда
          <select id="edit-room">
            <option value="">Авто (как предлагает сайт)</option>
            <optgroup label="Из техзадания">${programRooms.map((r) => `<option value="key:${r.key}"${state.overrides[ovKey]?.key === r.key ? ' selected' : ''}>${r.label}</option>`).join('')}</optgroup>
            <optgroup label="Другое помещение">${GENERIC_ROOMS.map((r, i) => `<option value="gen:${i}"${state.overrides[ovKey]?.label === r.label && state.overrides[ovKey]?.key.startsWith('ovr-') ? ' selected' : ''}>${r.label}</option>`).join('')}</optgroup>
          </select>
        </label>
        <div class="row wrap">
          <button type="button" id="edit-apply">Применить</button>
          <button type="button" class="secondary" id="edit-close">Закрыть</button>
        </div>
      </div>`;
    }
  }
  const resetAll = Object.keys(state.overrides).length
    ? '<button type="button" class="link" id="edit-reset">Сбросить все ручные правки</button>' : '';
  $('layout-editor').innerHTML = `<h3 class="sub">Изменить планировку</h3>${panel}${resetAll}
    <h3 class="sub">Добавить помещение</h3>
    <p class="note">Сайт сам найдёт ему сектор по звёздам: жилое — по водной звезде, спальню — по горной, мокрое — в мокрую точку.</p>
    <div class="custom-rooms">${customList}</div>
    <button type="button" class="secondary" id="custom-add">Добавить помещение</button>`;
}

$('layout-plans').addEventListener('click', (e) => {
  const hit = e.target.closest('[data-cell]');
  if (!hit) return;
  editCell = { floor: Number(hit.dataset.floor), cell: hit.dataset.cell };
  render();
  $('layout-editor').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

$('layout-editor').addEventListener('click', (e) => {
  const t = e.target;
  if (t.id === 'edit-close') {
    editCell = null;
  } else if (t.id === 'edit-apply' && editCell) {
    const v = $('edit-room').value;
    const ovKey = `${editCell.floor}:${editCell.cell}`;
    if (!v) delete state.overrides[ovKey];
    else if (v.startsWith('key:')) {
      const key = v.slice(4);
      // Комната из техзадания может стоять только в одном секторе
      for (const [k, r] of Object.entries(state.overrides)) if (r.key === key) delete state.overrides[k];
      const room = [...document.querySelectorAll('#edit-room option')].find((o) => o.value === v);
      const wet = key.startsWith('bath') || key === 'suitebath' || key === 'laundry'
        || (key.startsWith('custom') && state.program.custom[Number(key.slice(6))]?.kind === 'wet');
      state.overrides[ovKey] = { key, label: room.textContent, type: currentRoomType(key), wet };
    } else {
      const g = GENERIC_ROOMS[Number(v.slice(4))];
      state.overrides[ovKey] = { key: `ovr-${editCell.floor}-${editCell.cell}`, ...g };
    }
    editCell = null;
  } else if (t.id === 'edit-reset') {
    state.overrides = {};
  } else if (t.id === 'custom-add') {
    state.program.custom = [...(state.program.custom || []), { name: '', kind: 'active' }];
  } else if (t.dataset.customRemove !== undefined) {
    state.program.custom.splice(Number(t.dataset.customRemove), 1);
  } else return;
  render();
  save();
});

$('layout-editor').addEventListener('change', (e) => {
  const i = e.target.dataset.custom;
  if (i === undefined) return;
  state.program.custom[Number(i)][e.target.dataset.f] = e.target.value;
  render();
  save();
});

// Тип комнаты из техзадания по ключу
function currentRoomType(key) {
  if (key === 'master' || key.startsWith('kid') || key === 'guest') return 'bedroom';
  if (key === 'kitchen') return 'kitchen';
  if (key === 'office') return 'office';
  if (key.startsWith('custom')) {
    const c = state.program.custom[Number(key.slice(6))];
    return KIND_TYPE[c?.kind]?.type || 'office';
  }
  return 'utility';
}

// Варианты планировки с другим расположением входа
function renderVariants(chart, fsAz) {
  const g1 = floorGeom(1);
  const layout = planLayout(chart);
  const current = doorSector(doorNow, g1.W, g1.D, layout);
  const seen = new Set([current]);
  const options = currentDoorOptions(chart, fsAz).filter((o) => !seen.has(o.lo) && seen.add(o.lo)).slice(0, 3);
  if (!options.length) {
    $('layout-variants').innerHTML = '';
    return;
  }
  const base = buildLayout(chart, doorNow);
  const cards = options.map((o) => {
    const door = { auto: false, side: o.side, pos: o.pos };
    const v = buildLayout(chart, door);
    const scale = 150 / Math.max(...v.floors.flatMap((f) => [f.g.W, f.g.D]));
    const palace = PALACES.find((q) => q.lo === o.lo);
    const p = chart.palaces[o.lo];
    const why = [o.ideal ? 'двойная 9' : '', o.traditional ? 'В/ЮВ' : '', `водная ${p.water}`].filter(Boolean).join(', ');
    const diff = Math.round(v.score - base.score);
    const pts = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'балл' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'балла' : 'баллов'}`;
    const diffText = diff === 0 ? 'По звёздам так же, как текущий вариант' : diff > 0 ? `Лучше текущего на ${pts(diff)}` : `Хуже текущего на ${pts(-diff)}`;
    return `<div class="variant">
      <div class="variant-head"><strong>Вход: ${palace.dirName}</strong> <span class="note">(${SIDE_NAMES[o.side].toLowerCase()}; ${why})</span></div>
      <div class="variant-plans">${v.floors.map((f) => layoutSvg(chart, fsAz, f, scale, v.adults, v.children, true)).join('')}</div>
      <p class="note">${diffText}${v.dropped ? `; не поместилось комнат: ${v.dropped}` : ''}.</p>
      <button type="button" class="secondary" data-variant-side="${o.side}" data-variant-pos="${o.pos}">Выбрать этот вариант</button>
    </div>`;
  });
  $('layout-variants').innerHTML = `<h3 class="sub">Варианты с другим входом</h3>
    <p class="note">Та же раскладка правил при другом расположении двери. Баллы — суммарная оценка по звёздам, свету и мокрой точке.</p>
    <div class="variants">${cards.join('')}</div>`;
}

$('layout-variants').addEventListener('click', (e) => {
  const { variantSide, variantPos } = e.target.dataset;
  if (!variantSide) return;
  state.door = { auto: false, side: variantSide, pos: Number(variantPos) };
  render();
  save();
  $('layout-plans').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Комнаты этажа: ключ комнаты → клетки
function roomsOfFloor(f, cells) {
  const all = { ...f.res.assign, ...f.fixed };
  const out = new Map();
  for (const c of cells) {
    const r = all[`${c.row}-${c.col}`];
    if (!r) continue;
    if (!out.has(r.key)) out.set(r.key, { room: r, cells: [] });
    out.get(r.key).cells.push(c);
  }
  return out;
}

function floorCells(chart, g) {
  const cells = [];
  planLayout(chart).forEach((r, row) => r.forEach((lo, col) => cells.push({ lo, row, col, cov: g.cov[row][col], sun: cellSun(row, col), ...chart.palaces[lo] })));
  return cells;
}

// Главная клетка комнаты (где кровать, стол, сантехника)
const primaryCell = (room, cells) => cells.find((c) => `${c.row}-${c.col}` === room.primary) || cells[0];

const dirOf = (lo) => (lo === 5 ? 'центр' : PALACES.find((q) => q.lo === lo).dir);
// Истинное направление клетки от центра дома (для солнца): на плане фасад снизу
function cellSun(row, col) {
  if (row === 1 && col === 1) return null;
  return norm360(state.az + deg(Math.atan2(-(col - 1), row - 1)));
}

// Состояние звезды для показа. В 9-м периоде шестёрка нейтральная:
// нежелательна для сна, но возможна для Гуа 1, 6, 7, 8, 2; приемлема для активной зоны.
function starState(n, period) {
  if (period === 9 && n === 6) return { key: 'neutral', label: 'нейтральная' };
  return starTiming(n, period);
}

// Зоны кухни-гостиной по основным клеткам комнаты (без присоединённых)
function kitchenZones(room, cells) {
  const extra = new Set((room.extra || []).map((e) => e.cell));
  const main = cells.filter((c) => !extra.has(`${c.row}-${c.col}`));
  return kitchenSplit(main.length ? main : cells);
}

function bedroomOwner(room, adults, children) {
  if (room.key === 'master') return adults[0] || null;
  const i = Number(room.key.replace('kid', ''));
  return children[i] || null;
}

function roomNotes(chart, fsAz, f, adults, children) {
  const notes = [];
  const where = f.title ? ` (${f.title})` : '';
  const order = { kitchen: 0, bedroom: 1, office: 2, entry: 3, utility: 4, lounge: 5, guest: 6, extra: 7, hall: 8 };
  const list = [...roomsOfFloor(f, floorCells(chart, f.g)).values()].sort((a, b) => order[a.room.type] - order[b.room.type]);
  for (const { room, cells } of list) {
    const sectors = cells.map((c) => dirOf(c.lo)).join(' + ');
    let text = '';
    if (room.type === 'kitchen') {
      const parts = cells.map((c) => {
        const fit = roomFit('active', c.mountain, c.water);
        return `${dirOf(c.lo)} — водная ${c.water} (${FIT_WORD[fit] || '—'})${fit === 'fix' && WATER[c.water]?.support ? `: ${WATER[c.water].support.replace(/\.$/, '')}` : ''}`;
      });
      const z = kitchenZones(room, cells);
      text = `${parts.join('; ')}. Кухня с плитой — в секторе ${dirOf(z.kitchen.lo)} (по свету — ${dir8(z.kitchen.sun)}): горная ${z.kitchen.mountain}, ${FIT_WORD[roomFit('stove', z.kitchen.mountain, z.kitchen.water)] || '—'} для плиты.`;
      if (cells.some(isDoubleNine)) text += ' В комнате сектор двойной 9: водная 9 — для гостиной, горная 9 — для камина или плиты.';
      const stove = stovePlacement(chart, fsAz, z.kitchen);
      text += ` Ручки плиты и духовка смотрят на ${stove.toward.dir} — там водная ${stove.toward.w}.`;
      if (z.living !== z.kitchen) text += ` Гостиная — в секторе ${dirOf(z.living.lo)} (по свету — ${dir8(z.living.sun)}).`;
      if (dir8(z.kitchen.sun) === 'С') text += ' Кухня на севере — нет другого места, пересмотрите техзадание.';
    } else if (room.type === 'bedroom') {
      const c = primaryCell(room, cells);
      const d = MOUNTAIN[c.mountain];
      const owner = bedroomOwner(room, adults, children);
      let q = c.mountain === 9 ? 'идеальный вариант для спальни' : c.mountain === 1 ? 'хорошо для сна всем Гуа' : d?.rooms.sleep === 'bad' ? 'для сна не подходит' : 'для сна можно не всем';
      if (room.guas?.length && d?.sleepGua) q = d.sleepGua.some((g) => room.guas.includes(g)) ? `подходит для Гуа ${room.guas.join(', ')}` : q;
      text = `${dirOf(c.lo)} — горная ${c.mountain}: ${q}.`;
      if (d?.bedroom && !(c.mountain === 9 || c.mountain === 1)) text += ` ${d.bedroom}`;
      if ((!f.title || f.n === 1) && WATER[c.water]?.noSleep && !room.work) text += ' Водная 9 в спальне на первом этаже нежелательна.';
      if (room.suite) text += ' Туалетный столик — в спальне, рядом с проходом в гардеробную.';
      if (room.work) {
        const desk = bedroomDesk(chart, fsAz, owner?.gua, bedPlacement(chart, fsAz, owner?.gua).head);
        text += ` Рабочая зона: стол, сидеть лицом на ${desk.toward.dir} — там водная ${desk.toward.w}. Пользуйтесь ею каждый день: водную звезду лучше всего «будит» присутствие людей. Активаторы для спальни: принтер, свечи, аромадиффузор, кондиционер, мобиль, живые растения в меру. Фонтан и аквариум в спальне лучше не ставить.`;
      }
      if (isDoubleNine(c) && (!f.title || f.n === 1)) text += room.work ? ' Сектор двойной 9: горная 9 — для сна, водная 9 — для работы.' : '';
      const bed = bedPlacement(chart, fsAz, owner?.gua);
      text += ` Кровать ногами на ${bed.toward.dir} — там водная ${bed.toward.w}${bed.toward.score ? '' : ' (благоприятной водной рядом нет)'}, изголовье на ${bed.headDir}.`;
      if (owner) {
        const g = guaDirScore(owner.gua, DIR_BEARING[bed.headDir]);
        if (g > 0) text += ` Изголовье на благоприятное направление Гуа ${owner.gua}${owner.name ? ` (${escapeHtml(owner.name)})` : ''}.`;
        if ((c.mountain === 6 || c.mountain === 8) && attacksGua(c.mountain, owner.gua)) {
          text += ` Горная ${c.mountain} (${elementOf(c.mountain)}) подавляет элемент Гуа ${owner.gua} (${elementOf(owner.gua)}) — спать здесь не стоит.`;
        }
      }
    } else if (room.key === 'suitebath') {
      const c = primaryCell(room, cells);
      text = `${dirOf(c.lo)} — водная ${c.water}, горная ${c.mountain}: вход из мастер-спальни через проходную гардеробную в ванную.`;
    } else if (room.type === 'office') {
      const c = primaryCell(room, cells);
      text = `${dirOf(c.lo)} — водная ${c.water}, горная ${c.mountain}.`;
      const desk = deskPlacement(chart, fsAz, adults[0]?.gua);
      text += ` Сидеть за столом лицом на ${desk.toward.dir} — там водная ${desk.toward.w}.`;
      if (isDoubleNine(c)) text += ' Сектор двойной 9: обе девятки работают на кабинет.';
    } else if (room.type === 'utility') {
      const c = primaryCell(room, cells);
      const why = [];
      if ([2, 3, 4, 5, 7].includes(c.water)) why.push(`«смыть» водную ${c.water}`);
      if ([2, 3, 4, 5, 7].includes(c.mountain)) why.push(`горная ${c.mountain} — там никто не спит`);
      text = `${dirOf(c.lo)} — водная ${c.water}, горная ${c.mountain}${why.length ? `: ${why.join(', ')}` : ` (${FIT_WORD[roomFit('utility', c.mountain, c.water)] || '—'})`}.`;
      if (room.key.startsWith('aux')) {
        text += ' Подойдёт под гардероб, постирочную или кладовую.';
        if (room.small && room.sharedWith) {
          const partner = Object.values({ ...f.res.assign, ...f.fixed }).find((r) => r.key === room.sharedWith);
          if (partner) text += ` Небольшое — полоса у наружной стены, остальная часть сектора отходит к комнате «${partner.label}».`;
        }
      }
    } else if (room.type === 'entry') {
      const c = primaryCell(room, cells);
      text = `${dirOf(c.lo)} — у входной двери: водная ${c.water}, горная ${c.mountain}.`;
    } else if (room.type === 'lounge') {
      text = `${sectors} — водная ${cells[0].water}: хорошая водная звезда, используйте активно (зона отдыха, кабинет).`;
    } else if (room.type === 'guest') {
      text = `${sectors} — горная ${cells[0].mountain}: хорошая для сна.`;
    } else if (room.type === 'hall') {
      continue;
    } else {
      text = `${sectors} — водная ${cells[0].water}, горная ${cells[0].mountain}.`;
    }
    if (room.extra?.length) {
      const ext = room.extra.map((e) => `${dirOf(e.lo)}${e.hetu ? ` (${e.hetu.text.split(' — ')[1] || 'хэ-ту'})` : ''}`);
      text += ` Комната расширена за счёт сектора ${ext.join(', ')}.`;
    }
    notes.push(`<li><strong>${room.label}${where}:</strong> ${text}</li>`);
  }
  return notes;
}

// ---- Двери, проёмы и окна ----

const PUBLIC = ['hall', 'entry', 'kitchen', 'lounge'];

// Прямоугольники мебели [x, y, w, h] из нарисованных фигур
function furnitureBoxes(svgParts) {
  const num = (str, name) => Number((str.match(new RegExp(`\\b${name}="([-\\d.]+)"`)) || [])[1]);
  const boxes = [];
  for (const p of svgParts) {
    if (!/class="furn(-fill)?"/.test(p)) continue;
    if (p.startsWith('<rect')) boxes.push([num(p, 'x'), num(p, 'y'), num(p, 'width'), num(p, 'height')]);
    else if (p.startsWith('<circle')) {
      const r = num(p, 'r');
      boxes.push([num(p, 'cx') - r, num(p, 'cy') - r, 2 * r, 2 * r]);
    } else if (p.startsWith('<ellipse')) {
      const rx = num(p, 'rx');
      const ry = num(p, 'ry');
      boxes.push([num(p, 'cx') - rx, num(p, 'cy') - ry, 2 * rx, 2 * ry]);
    }
  }
  return boxes.filter((b) => b.every(Number.isFinite));
}

// Площадь пересечения прямоугольника с мебелью
function furnitureOverlap(rect, boxes) {
  const [x, y, w, h] = rect;
  const x1 = Math.min(x, x + w);
  const x2 = Math.max(x, x + w);
  const y1 = Math.min(y, y + h);
  const y2 = Math.max(y, y + h);
  return boxes.reduce((s, [bx, by, bw, bh]) => {
    const ox = Math.max(0, Math.min(x2, bx + bw) - Math.max(x1, bx));
    const oy = Math.max(0, Math.min(y2, by + bh) - Math.max(y1, by));
    return s + ox * oy;
  }, 0);
}
const SUN_WINDOW = { Ю: 1.8, ЮВ: 1.8, ЮЗ: 1.8, В: 1.2, З: 1.2, С: 0.9, СВ: 0.9, СЗ: 0.9 };

function openingsSvg(f, cells, all, rooms, geo) {
  const { x0, y0, cw, ch, scale, W, D, pt, auxPart, stripOf, furniture = [] } = geo;
  const out = [];
  const key = (c) => `${c.row}-${c.col}`;
  const roomOf = (c) => all[key(c)];
  const adj = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

  // Дверь (с дугой открывания в комнату to) или проём на общей стене клеток a и b
  const opening = (a, b, kind) => {
    // Вдоль общей стены ищем место, где ни проём, ни открывание двери не задевают мебель
    const vertical = a.row === b.row;
    const span = vertical ? ch : cw;
    const w = Math.min((kind === 'open' ? 1.4 : 0.8) * scale, span * 0.6);
    const clear = 0.6 * scale; // свободная полоса перед проёмом
    const n = vertical ? [b.col > a.col ? 1 : -1, 0] : [0, b.row > a.row ? 1 : -1];
    const edge = vertical ? x0 + Math.max(a.col, b.col) * cw : y0 + Math.max(a.row, b.row) * ch;
    const start0 = vertical ? y0 + a.row * ch : x0 + a.col * cw;
    let best = null;
    // Кандидаты — от середины стены к краям, с шагом 2 px
    const offsets = [0];
    for (let d = 2; d < span / 2; d += 2) offsets.push(d, -d);
    for (const off of offsets) {
      const c = start0 + span / 2 + off;
      if (c - w / 2 < start0 + 2 || c + w / 2 > start0 + span - 2) continue;
      // Зона открывания (в комнату «b») и полоса подхода (со стороны «a»)
      const swing = vertical ? [edge, c - w / 2, n[0] * Math.max(w, clear), w] : [c - w / 2, edge, w, n[1] * Math.max(w, clear)];
      const approach = vertical ? [edge, c - w / 2, -n[0] * clear, w] : [c - w / 2, edge, w, -n[1] * clear];
      // Мебель в самом проёме недопустима, в зоне открывания и подхода — нежелательна
      const gapRect = vertical ? [edge - 3, c - w / 2, 6, w] : [c - w / 2, edge - 3, w, 6];
      const hit = furnitureOverlap(gapRect, furniture) * 100 + furnitureOverlap(swing, furniture) + furnitureOverlap(approach, furniture);
      if (!best || hit < best.hit - 0.5) best = { c, hit };
      if (hit === 0) break;
    }
    const cpos = best ? best.c : start0 + span / 2;
    const p1 = vertical ? [edge, cpos - w / 2] : [cpos - w / 2, edge];
    const p2 = vertical ? [edge, cpos + w / 2] : [cpos + w / 2, edge];
    out.push(`<line class="door-gap" x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}"/>`);
    if (kind === 'door') {
      const w = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const leaf = [p1[0] + n[0] * w, p1[1] + n[1] * w];
      const e = [(p2[0] - p1[0]) / w, (p2[1] - p1[1]) / w];
      const sweep = n[0] * e[1] - n[1] * e[0] > 0 ? 1 : 0;
      out.push(`<path class="door-leaf" d="M${p1[0]} ${p1[1]} L${leaf[0]} ${leaf[1]} A${w} ${w} 0 0 ${sweep} ${p2[0]} ${p2[1]}"/>`);
    }
  };

  // Связи: каждая комната — через холл, прихожую или общую зону; ванная мастер-спальни — только из спальни
  const list = [...rooms.values()];
  const connected = new Set(list.filter((x) => x.room.type === 'hall').map((x) => x.room.key));
  for (let guard = 0; guard < 10; guard++) {
    let progress = false;
    for (const { room, cells: rc } of list) {
      if (connected.has(room.key) || auxPart(room)) continue;
      const targets = room.key === 'suitebath' ? ['master'] : null;
      let best = null;
      for (const c of rc) {
        for (const o of cells) {
          const r = roomOf(o);
          if (!r || r.key === room.key || !adj(c, o) || !connected.has(r.key)) continue;
          if (targets && !targets.includes(r.key)) continue;
          // Через спальни и санузлы не проходим
          if (!targets && !PUBLIC.includes(r.type) && r.type !== 'office') continue;
          const rank = (r.type === 'hall' ? 0 : r.type === 'entry' ? 1 : 2) + (c === rc[0] ? 0 : 0.1);
          if (!best || rank < best.rank) best = { from: o, to: c, rank, target: r };
        }
      }
      if (!best) continue;
      const open = PUBLIC.includes(room.type) && PUBLIC.includes(best.target.type) && !(room.type === 'entry' || best.target.type === 'entry');
      opening(best.from, best.to, open ? 'open' : 'door');
      connected.add(room.key);
      progress = true;
    }
    if (!progress) break;
  }

  // Небольшое подсобное — дверь из соседней комнаты в полосу у стены
  for (const { room, cells: rc } of list) {
    if (!auxPart(room)) continue;
    const [sx, sy, sw, sh] = stripOf(rc[0]);
    const c = rc[0];
    const side = c.row === 0 ? 'top' : c.row === 2 ? 'bottom' : c.col === 0 ? 'left' : 'right';
    const w = Math.min(0.8 * scale, (side === 'top' || side === 'bottom' ? sw : sh) * 0.5);
    if (side === 'top' || side === 'bottom') {
      const y = side === 'top' ? sy + sh : sy;
      out.push(`<line class="door-gap" x1="${sx + sw / 2 - w / 2}" y1="${y}" x2="${sx + sw / 2 + w / 2}" y2="${y}"/>`);
    } else {
      const x = side === 'left' ? sx + sw : sx;
      out.push(`<line class="door-gap" x1="${x}" y1="${sy + sh / 2 - w / 2}" x2="${x}" y2="${sy + sh / 2 + w / 2}"/>`);
    }
  }

  // Окна на наружных стенах: размер по стороне света (в Якутии на север — небольшие)
  const segs = outline(f.g.dec);
  for (const c of cells) {
    const r = roomOf(c);
    if (!r || ['hall', 'entry'].includes(r.type)) continue;
    const boiler = r.key === 'boiler';
    if (r.type === 'utility' && !boiler && !r.key.startsWith('custom')) continue;
    const xA = (c.col * W) / 3;
    const xB = ((c.col + 1) * W) / 3;
    const yA = ((2 - c.row) * D) / 3;
    const yB = ((3 - c.row) * D) / 3;
    const eps = 1e-6;
    const inCell = segs
      .map((sg) => {
        // Часть наружной стены, проходящая по клетке
        const x1 = Math.max(Math.min(sg.x1, sg.x2), xA);
        const x2 = Math.min(Math.max(sg.x1, sg.x2), xB);
        const y1 = Math.max(Math.min(sg.y1, sg.y2), yA);
        const y2 = Math.min(Math.max(sg.y1, sg.y2), yB);
        if (x2 < x1 - eps || y2 < y1 - eps) return null;
        return { x1, x2, y1, y2, facing: sg.facing, len: Math.hypot(x2 - x1, y2 - y1) };
      })
      .filter((sg) => sg && sg.len > 1.2)
      .sort((a, b) => b.len - a.len);
    const sg = inCell[0];
    if (!sg) continue;
    // Дверь входа на этой стене — окно не ставим
    if (f.door && f.doorPos === key(c) && sg.facing === f.door.side) continue;
    const dir = dir8(norm360(state.az + SIDE_BEARING[sg.facing]));
    const len = Math.min(boiler ? 0.6 : SUN_WINDOW[dir] || 1.2, sg.len - 0.6);
    const mx = (sg.x1 + sg.x2) / 2;
    const my = (sg.y1 + sg.y2) / 2;
    const horiz = sg.facing === 'front' || sg.facing === 'back';
    const [ax, ay] = pt(horiz ? mx - len / 2 : mx, horiz ? my : my - len / 2);
    const [bx, by] = pt(horiz ? mx + len / 2 : mx, horiz ? my : my + len / 2);
    out.push(`<line class="window-gap" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`);
    const o = 2;
    for (const d of [-o, 0, o]) {
      out.push(horiz
        ? `<line class="window-line" x1="${ax}" y1="${ay + d}" x2="${bx}" y2="${by + d}"/>`
        : `<line class="window-line" x1="${ax + d}" y1="${ay}" x2="${bx + d}" y2="${by}"/>`);
    }
  }
  return out.join('');
}

// Чертёж этажа: комнаты, мебель, звёзды в углу клетки
function layoutSvg(chart, fsAz, f, scale, adults, children, mini = false) {
  const { g, title, n } = f;
  const { W, D } = g;
  const pw = W * scale;
  const ph = D * scale;
  const padX = 34;
  const padTop = title ? 40 : 26;
  const vw = pw + padX * 2;
  const vh = ph + padTop + 46;
  const cw = pw / 3;
  const ch = ph / 3;
  const x0 = padX;
  const y0 = padTop;
  const m = (meters) => meters * scale;
  const pt = (x, y) => [x0 + x * scale, y0 + (D - y) * scale];
  const cells = floorCells(chart, g);
  const rooms = roomsOfFloor(f, cells);
  const all = { ...f.res.assign, ...f.fixed };
  const hatch = `lhatch-${n}`;
  const parts = [`<defs><pattern id="${hatch}" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)"><line class="hatch-line" x1="0" y1="0" x2="0" y2="8"/></pattern></defs>`];
  if (title) parts.push(`<text class="plan-title" x="${x0}" y="16">${title}</text>`);

  // Небольшое подсобное: полоса у наружной стены, остальная часть клетки — соседней комнате
  const byKey = Object.fromEntries(Object.values(all).map((r) => [r.key, r]));
  const auxPart = (r) => (r?.small && r.sharedWith ? byKey[r.sharedWith] : null);
  const wallKey = (r) => auxPart(r)?.key ?? r?.key;
  const stripOf = (c) => {
    const [x, y, w, h] = [x0 + c.col * cw, y0 + c.row * ch, cw, ch];
    const side = outerSide(c.row, c.col);
    const d = (side === 'top' || side === 'bottom' ? h : w) * 0.4;
    return {
      top: [x, y, w, d], bottom: [x, y + h - d, w, d], left: [x, y, d, h], right: [x + w - d, y, d, h],
    }[side];
  };

  // Заливка комнат
  for (const c of cells) {
    const r = all[`${c.row}-${c.col}`];
    const partner = auxPart(r);
    parts.push(`<rect class="room-${(partner || r)?.type || 'extra'}" x="${x0 + c.col * cw}" y="${y0 + c.row * ch}" width="${cw}" height="${ch}"/>`);
    if (partner) {
      const [sx, sy, sw, sh] = stripOf(c);
      parts.push(`<rect class="room-utility" x="${sx}" y="${sy}" width="${sw}" height="${sh}"/>`);
      parts.push(`<rect class="plan-wall" fill="none" stroke-width="1.5" x="${sx}" y="${sy}" width="${sw}" height="${sh}"/>`);
    }
  }
  for (const p of pieces(g.dec)) {
    if (p.inside) continue;
    const [ax, ay] = pt(p.x1, p.y1);
    const [bx, by] = pt(p.x2, p.y2);
    parts.push(`<rect class="plan-cut" fill="url(#${hatch})" x="${Math.min(ax, bx)}" y="${Math.min(ay, by)}" width="${Math.abs(bx - ax)}" height="${Math.abs(by - ay)}"/>`);
  }
  // Перегородки между разными комнатами
  for (const c of cells) {
    const r = all[`${c.row}-${c.col}`];
    const right = cells.find((o) => o.row === c.row && o.col === c.col + 1);
    const below = cells.find((o) => o.row === c.row + 1 && o.col === c.col);
    if (right && wallKey(all[`${right.row}-${right.col}`]) !== wallKey(r)) parts.push(`<line class="plan-wall" stroke-width="1.5" x1="${x0 + (c.col + 1) * cw}" y1="${y0 + c.row * ch}" x2="${x0 + (c.col + 1) * cw}" y2="${y0 + (c.row + 1) * ch}"/>`);
    if (below && wallKey(all[`${below.row}-${below.col}`]) !== wallKey(r)) parts.push(`<line class="plan-wall" stroke-width="1.5" x1="${x0 + c.col * cw}" y1="${y0 + (c.row + 1) * ch}" x2="${x0 + (c.col + 1) * cw}" y2="${y0 + (c.row + 1) * ch}"/>`);
  }
  for (const sg of outline(g.dec)) {
    const [ax, ay] = pt(sg.x1, sg.y1);
    const [bx, by] = pt(sg.x2, sg.y2);
    parts.push(`<line class="${sg.facing === 'front' ? 'plan-facade' : 'plan-wall'}" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`);
  }
  if (f.door) {
    const door = doorPoint(f.door, W, D);
    const half = Math.max(0.6, 6 / scale);
    const [ax, ay] = pt(door.x - (door.along === 'x' ? half : 0), door.y - (door.along === 'y' ? half : 0));
    const [bx, by] = pt(door.x + (door.along === 'x' ? half : 0), door.y + (door.along === 'y' ? half : 0));
    parts.push(`<line class="plan-door" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`);
  }

  // Мебель: прямоугольник у стены side в клетке
  const along = (rect, side, w, d, cls = 'furn') => {
    const [x, y, cwid, chei] = rect;
    const inset = 3;
    let fx;
    let fy;
    let fw;
    let fh;
    if (side === 'top' || side === 'bottom') {
      fw = Math.min(w, cwid - 2 * inset);
      fh = Math.min(d, chei - 2 * inset);
      fx = x + (cwid - fw) / 2;
      fy = side === 'top' ? y + inset : y + chei - inset - fh;
    } else {
      fw = Math.min(d, cwid - 2 * inset);
      fh = Math.min(w, chei - 2 * inset);
      fy = y + (chei - fh) / 2;
      fx = side === 'left' ? x + inset : x + cwid - inset - fw;
    }
    parts.push(`<rect class="${cls}" x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="2"/>`);
    return [fx, fy, fw, fh];
  };
  const cellRect = (c) => [x0 + c.col * cw, y0 + c.row * ch, cw, ch];

  const furnStart = parts.length;
  for (const { room, cells: rc } of rooms.values()) {
    // В мини-плане вариантов мебель не рисуем
    if (mini) break;
    if (room.key === 'suitebath') {
      const c = primaryCell(room, rc);
      // Сторона к спальне: там проходная гардеробная, дальше — ванная
      const mc = cells.find((o) => `${o.row}-${o.col}` === all[`${o.row}-${o.col}`]?.primary && all[`${o.row}-${o.col}`]?.key === 'master');
      const toward = !mc ? 'top' : mc.row < c.row ? 'top' : mc.row > c.row ? 'bottom' : mc.col < c.col ? 'left' : 'right';
      const [x, y, w, h] = cellRect(c);
      const vertical = toward === 'top' || toward === 'bottom';
      // Проходная гардеробная — первая половина клетки со шкафами по двум сторонам
      const half = vertical ? h / 2 : w / 2;
      const gx = toward === 'right' ? x + w - half : x;
      const gy = toward === 'bottom' ? y + h - half : y;
      const gw = vertical ? w : half;
      const gh = vertical ? half : h;
      const d = m(0.55);
      if (vertical) {
        parts.push(`<rect class="furn" x="${gx + 3}" y="${gy + 3}" width="${Math.min(d, gw / 3)}" height="${gh - 6}"/>`);
        parts.push(`<rect class="furn" x="${gx + gw - 3 - Math.min(d, gw / 3)}" y="${gy + 3}" width="${Math.min(d, gw / 3)}" height="${gh - 6}"/>`);
        parts.push(`<line class="plan-wall" stroke-width="1" x1="${x}" y1="${toward === 'top' ? y + half : y + h - half}" x2="${x + w}" y2="${toward === 'top' ? y + half : y + h - half}"/>`);
      } else {
        parts.push(`<rect class="furn" x="${gx + 3}" y="${gy + 3}" width="${gw - 6}" height="${Math.min(d, gh / 3)}"/>`);
        parts.push(`<rect class="furn" x="${gx + 3}" y="${gy + gh - 3 - Math.min(d, gh / 3)}" width="${gw - 6}" height="${Math.min(d, gh / 3)}"/>`);
        parts.push(`<line class="plan-wall" stroke-width="1" x1="${toward === 'left' ? x + half : x + w - half}" y1="${y}" x2="${toward === 'left' ? x + half : x + w - half}" y2="${y + h}"/>`);
      }
      // Ванная — вторая половина: ванна у дальней стены и унитаз
      const far = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[toward];
      const bathRect = vertical ? [x, toward === 'top' ? y + half : y, w, half] : [toward === 'left' ? x + half : x, y, half, h];
      along(bathRect, far, m(1.7), m(0.75));
      parts.push(`<ellipse class="furn" cx="${bathRect[0] + bathRect[2] / 2}" cy="${bathRect[1] + bathRect[3] / 2}" rx="${m(0.18)}" ry="${m(0.28)}"/>`);
    } else if (room.type === 'bedroom') {
      const c = primaryCell(room, rc);
      const owner = bedroomOwner(room, adults, children);
      const side = bedPlacement(chart, fsAz, owner?.gua).head;
      if (room.work) {
        const desk = bedroomDesk(chart, fsAz, owner?.gua, side);
        along(cellRect(c), desk.face, m(1.2), m(0.6));
      }
      if (room.suite) {
        // Туалетный столик — у стены, противоположной изголовью
        const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side];
        along(cellRect(c), opposite, m(1.0), m(0.45));
      }
      const wide = room.key === 'master' ? 1.6 : 0.9;
      const [fx, fy, fw, fh] = along(cellRect(c), side, m(wide), m(2.0));
      // Подушка у изголовья
      const pillow = 0.35 * scale;
      if (side === 'top') parts.push(`<rect class="furn-fill" x="${fx}" y="${fy}" width="${fw}" height="${Math.min(pillow, fh)}"/>`);
      if (side === 'bottom') parts.push(`<rect class="furn-fill" x="${fx}" y="${fy + fh - Math.min(pillow, fh)}" width="${fw}" height="${Math.min(pillow, fh)}"/>`);
      if (side === 'left') parts.push(`<rect class="furn-fill" x="${fx}" y="${fy}" width="${Math.min(pillow, fw)}" height="${fh}"/>`);
      if (side === 'right') parts.push(`<rect class="furn-fill" x="${fx + fw - Math.min(pillow, fw)}" y="${fy}" width="${Math.min(pillow, fw)}" height="${fh}"/>`);
    } else if (room.type === 'kitchen') {
      const z = kitchenZones(room, rc);
      const st = z.kitchen;
      const [sx, sy, sw, sh] = along(cellRect(st), stovePlacement(chart, fsAz, st).wall, m(2.0), m(0.6));
      parts.push(`<rect class="furn-fill" x="${sx + sw / 2 - m(0.3)}" y="${sy + sh / 2 - m(0.3)}" width="${m(0.6)}" height="${m(0.6)}"/>`);
      parts.push(`<text class="furn-label" x="${sx + sw / 2}" y="${sy + sh / 2 + 3}" text-anchor="middle">плита</text>`);
      const other = z.living;
      const [cx, cy] = [x0 + (other.col + 0.5) * cw, y0 + (other.row + 0.5) * ch];
      if (other !== st) {
        const [dx, dy, dw, dh] = along(cellRect(other), outerSide(other.row, other.col), m(2.0), m(0.9));
        parts.push(`<text class="furn-label" x="${dx + dw / 2}" y="${dy + dh / 2 + 3}" text-anchor="middle">диван</text>`);
      }
      parts.push(`<circle class="furn" cx="${cx}" cy="${cy + (other === st ? ch * 0.15 : 0)}" r="${Math.min(m(0.6), cw / 5)}"/>`);
    } else if (room.type === 'utility') {
      const c = primaryCell(room, rc);
      const side = outerSide(c.row, c.col);
      if (room.key.startsWith('bath')) {
        along(cellRect(c), side, m(1.7), m(0.75));
        parts.push(`<ellipse class="furn" cx="${x0 + (c.col + 0.5) * cw}" cy="${y0 + (c.row + 0.5) * ch}" rx="${m(0.2)}" ry="${m(0.32)}"/>`);
      } else if (room.key === 'boiler') {
        parts.push(`<circle class="furn" cx="${x0 + (c.col + 0.5) * cw}" cy="${y0 + (c.row + 0.5) * ch}" r="${m(0.35)}"/>`);
        parts.push(`<text class="furn-label" x="${x0 + (c.col + 0.5) * cw}" y="${y0 + (c.row + 0.5) * ch + m(0.35) + 10}" text-anchor="middle">котёл</text>`);
      } else if (auxPart(room)) {
        const [sx, sy, sw, sh] = stripOf(c);
        along([sx, sy, sw, sh], side, Math.max(sw, sh) * 0.8, m(0.45));
      } else {
        along(cellRect(c), side, cw * 0.8, m(0.6));
      }
    } else if (room.type === 'office') {
      const c = primaryCell(room, rc);
      along(cellRect(c), deskPlacement(chart, fsAz, adults[0]?.gua).face, m(1.4), m(0.7));
    }
  }

  // Где стоит мебель — чтобы двери не попадали на неё
  const furniture = furnitureBoxes(parts.slice(furnStart));
  if (!mini) parts.push(openingsSvg(f, cells, all, rooms, { x0, y0, cw, ch, scale, W, D, pt, auxPart, stripOf, furniture }));

  // Подписи комнат и звёзды
  for (const { room, cells: all2 } of rooms.values()) {
    // Подпись — по основным клеткам комнаты (без присоединённых)
    const extra = new Set((room.extra || []).map((e) => e.cell));
    const rc = all2.filter((c) => !extra.has(`${c.row}-${c.col}`));
    let cx = rc.reduce((s, c) => s + x0 + (c.col + 0.5) * cw, 0) / rc.length;
    let cy = rc.reduce((s, c) => s + y0 + (c.row + 0.5) * ch, 0) / rc.length;
    if (auxPart(room)) {
      const [sx, sy, sw, sh] = stripOf(rc[0]);
      cx = sx + sw / 2;
      cy = sy + sh / 2 + 4;
    }
    const fs = mini ? 8 : Math.max(10, Math.min(13, cw / 9));
    const words = room.label.split(/,\s*|\s+\+\s+/);
    words.forEach((w, i) => parts.push(`<text class="room-name" x="${cx}" y="${cy - ((words.length - 1) * fs) / 2 + i * fs}" font-size="${fs}" text-anchor="middle">${w}${i < words.length - 1 && room.label.includes(',') ? ',' : ''}</text>`));
  }
  // Звёзды в каждой клетке: сектор, горная (Г) и водная (В), цвет — по состоянию звезды в периоде
  const starClass = (num) => {
    if (num === chart.period) return 'pill-wang';
    const t = starState(num, chart.period).key;
    return t === 'sheng' ? 'pill-good' : t === 'tui' || t === 'neutral' ? 'pill-mid' : 'pill-bad';
  };
  for (const c of cells) {
    if (mini) break;
    const bx = x0 + c.col * cw + 4;
    const by = y0 + c.row * ch + 4;
    const pw2 = 24;
    const ph2 = 14;
    parts.push(`<text class="room-stars" x="${bx}" y="${by + 11}" font-size="10">${dirOf(c.lo)}</text>`);
    const sx = bx + dirOf(c.lo).length * 6.5 + 5;
    [['Г', c.mountain], ['В', c.water]].forEach(([letter, num], i) => {
      const px = sx + i * (pw2 + 3);
      parts.push(`<rect class="pill ${starClass(num)}" x="${px}" y="${by + 1}" width="${pw2}" height="${ph2}" rx="7"/>`,
        `<text class="pill-text ${starClass(num)}" x="${px + pw2 / 2}" y="${by + 11.5}" font-size="10" text-anchor="middle">${letter}${num}</text>`);
    });
  }

  const labelY = y0 + ph + 18;
  if (!mini) parts.push(`<text class="plan-label" x="${x0 + pw / 2}" y="${labelY}" text-anchor="middle">Фасад → ${chart.facingPalace.dirName} ${fmt(fsAz)}°</text>`);
  parts.push(`<g transform="translate(${x0 + pw + 14} ${vh - 22}) rotate(${180 - fsAz})"><path class="plan-north" d="M0 -12 L5 4 L0 1 L-5 4 Z"/><text class="plan-label" x="0" y="-15" text-anchor="middle" font-size="10">С</text></g>`);
  // Нажатие на сектор — ручная правка (кроме холла и прихожей)
  if (!mini) {
    for (const c of cells) {
      const k = `${c.row}-${c.col}`;
      const r = all[k];
      if (!r || r.type === 'hall' || r.type === 'entry' || f.fixed[k]?.type === 'entry') continue;
      const sel = editCell && editCell.floor === n && editCell.cell === k ? ' selected' : '';
      const tip = `${dirOf(c.lo)}: горная ${c.mountain} — ${starMeaning(c.mountain, chart.period)}; водная ${c.water} — ${starMeaning(c.water, chart.period)}. Нажмите, чтобы изменить помещение.`;
      parts.push(`<rect class="cell-hit${sel}" data-floor="${n}" data-cell="${k}" x="${x0 + c.col * cw}" y="${y0 + c.row * ch}" width="${cw}" height="${ch}"><title>${tip}</title></rect>`);
    }
  }
  return `<svg class="plan" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}" role="img" aria-label="Планировка ${title || 'дома'}">${parts.join('')}</svg>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---- Поля ввода ----

function onNumber(id, key, min, max) {
  $(id).addEventListener('input', (e) => {
    const v = parseFloat(String(e.target.value).replace(',', '.'));
    if (Number.isNaN(v)) return;
    state[key] = key === 'az' ? norm360(v) : Math.min(max, Math.max(min, v));
    render();
    save();
  });
}
onNumber('in-width', 'width', 3, 60);
onNumber('in-depth', 'depth', 3, 60);
onNumber('in-width2', 'width2', 3, 60);
onNumber('in-depth2', 'depth2', 3, 60);

$('in-floor2').addEventListener('change', (e) => {
  state.floor2 = e.target.checked;
  if (state.floor2 && state.width2 === null) {
    state.width2 = state.width;
    state.depth2 = state.depth;
  }
  render();
  save();
});
onNumber('in-az', 'az', 0, 360);
onNumber('in-az-range', 'az', 0, 360);

$('in-period').addEventListener('change', (e) => {
  state.period = Number(e.target.value);
  render();
  save();
});
$('in-orient').addEventListener('change', (e) => {
  state.orient = e.target.value;
  render();
  save();
});
for (const r of document.querySelectorAll('input[name="az-mode"]')) {
  r.addEventListener('change', (e) => {
    state.mode = e.target.value;
    render();
    save();
  });
}

$('btn-person').addEventListener('click', () => {
  state.people.push({ name: '', birth: '', sex: 'm' });
  render();
  save();
});

$('people').addEventListener('change', (e) => {
  const row = e.target.closest('.person');
  if (!row || !e.target.dataset.f) return;
  state.people[Number(row.dataset.i)][e.target.dataset.f] = e.target.value;
  render();
  save();
});

$('people').addEventListener('click', (e) => {
  const i = e.target.dataset.remove;
  if (i === undefined) return;
  state.people.splice(Number(i), 1);
  render();
  save();
});

$('btn-print').addEventListener('click', () => window.print());


// ---- Конструктор ландшафтного озеленения ----

const GARDEN_GROUPS = [
  ['Горы: высокое и тяжёлое', (e) => e.cat === 'mountain'],
  ['Вода и открытое место', (e) => e.cat === 'water' || e.cat === 'open'],
  ['Прочее', (e) => !['mountain', 'water', 'open'].includes(e.cat)],
];
const LEVEL_TEXT = { good: 'хорошо', ok: 'допустимо', mixed: 'есть замечания', bad: 'лучше перенести' };
let gardenView = null;

function renderGardenPalette() {
  $('garden-palette').innerHTML = GARDEN_GROUPS.map(([title, f]) => `<p class="chip-group">${title}</p>`
    + ELEMENTS.filter(f).map((e) => `<button type="button" class="chip" data-garden="${e.key}" aria-pressed="${state.gardenTool === e.key}"><span class="dot" style="background:${e.color}"></span>${e.label}</button>`).join('')).join('');
  $('garden-plants').innerHTML = `<div class="plants">${PLANTS.map((g) => `<h3>${g.group}</h3><ul>${g.items.map((i) => `<li>${i}</li>`).join('')}</ul>`).join('')}</div>`;
}

function gardenStarClass(num, period) {
  if (num === period) return 'pill-wang';
  const t = starState(num, period).key;
  return t === 'sheng' ? 'pill-good' : t === 'tui' || t === 'neutral' ? 'pill-mid' : 'pill-bad';
}

function renderGarden(chart, shift) {
  const g1 = floorGeom(1);
  const loc = (ll) => toLocal(state.center, ll);
  const houseR = Math.hypot(g1.W, g1.D) / 2;
  const site = state.site.map(loc);
  const items = state.garden.map((it) => ({ ...it, p: loc(it.ll) }));
  const far = Math.max(houseR * 3, 25, ...site.map(([x, y]) => Math.hypot(x, y) * 1.08), ...items.map((it) => Math.hypot(...it.p) + 4));
  const R = Math.ceil(far / 5) * 5;
  // На телефоне подписи крупнее, иначе их не прочитать
  const fs = R / (window.innerWidth < 700 ? 15 : 24);
  const P = ([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`;
  const parts = [];

  // Сетка через 5 м
  for (let v = -R + 5; v < R; v += 5) {
    parts.push(`<line class="g-grid" x1="${v}" y1="${-R}" x2="${v}" y2="${R}"/><line class="g-grid" x1="${-R}" y1="${v}" x2="${R}" y2="${v}"/>`);
  }
  if (site.length > 2) parts.push(`<polygon class="g-site" points="${site.map(P).join(' ')}"/>`);
  parts.push(`<circle class="g-ring" r="${(houseR + 10).toFixed(2)}"/>`);

  // Секторы: лучи границ и подписи со звёздами
  for (let k = 0; k < 8; k++) {
    const b = rad(22.5 + 45 * k + shift);
    parts.push(`<line class="g-ray" x1="${Math.sin(b) * houseR}" y1="${-Math.cos(b) * houseR}" x2="${Math.sin(b) * R * 1.5}" y2="${-Math.cos(b) * R * 1.5}"/>`);
    const lb = rad(45 * k + shift);
    const pal = PALACES[k];
    const st = chart.palaces[pal.lo];
    const x = Math.sin(lb) * R * 0.86;
    const y = -Math.cos(lb) * R * 0.86;
    parts.push(`<text class="g-sector" x="${x}" y="${y - fs * 0.2}" font-size="${fs * 1.15}" stroke-width="${fs * 0.25}" text-anchor="middle">${pal.dir}</text>`,
      `<text class="g-sector-stars" x="${x}" y="${y + fs * 1.05}" font-size="${fs * 0.85}" stroke-width="${fs * 0.22}" text-anchor="middle">Г${st.mountain} · В${st.water}</text>`);
  }

  // Дом
  for (const pc of pieces(g1.dec)) {
    if (!pc.inside) continue;
    const pts = [[pc.x1, pc.y1], [pc.x2, pc.y1], [pc.x2, pc.y2], [pc.x1, pc.y2]].map(([x, y]) => loc(planToMap(g1, x, y)));
    parts.push(`<polygon class="g-house" stroke="none" points="${pts.map(P).join(' ')}"/>`);
  }
  for (const sg of outline(g1.dec)) {
    const a = loc(planToMap(g1, sg.x1, sg.y1));
    const b = loc(planToMap(g1, sg.x2, sg.y2));
    parts.push(`<line class="${sg.facing === 'front' ? 'g-facade' : 'g-house'}" x1="${a[0]}" y1="${-a[1]}" x2="${b[0]}" y2="${-b[1]}"/>`);
  }
  const dp = doorPoint(doorNow, g1.W, g1.D);
  const door = loc(planToMap(g1, dp.x, dp.y));
  parts.push(`<circle class="g-door" cx="${door[0]}" cy="${-door[1]}" r="${Math.max(0.6, fs * 0.45)}"/>`);
  const doorBearing = norm360(deg(Math.atan2(door[0], door[1])));

  // Элементы
  const evals = items.map((it, i) => {
    const el = ELEMENT_BY_KEY[it.t];
    const bearing = norm360(deg(Math.atan2(it.p[0], it.p[1])));
    const pal = sectorOf(bearing - shift);
    const st = chart.palaces[pal.lo];
    const res = evaluate(el, { mountain: st.mountain, water: st.water, period: chart.period, bearing, dist: Math.hypot(...it.p), houseR, doorBearing });
    const r = Math.max(el.r, fs * 0.9);
    parts.push(`<g class="g-el lvl-${res.level}" data-i="${i}"><title>${el.label}: ${LEVEL_TEXT[res.level]}</title>`
      + `<circle class="ring" cx="${it.p[0]}" cy="${-it.p[1]}" r="${r + fs * 0.25}" stroke-width="${fs * 0.22}"/>`
      + `<circle class="body" cx="${it.p[0]}" cy="${-it.p[1]}" r="${r}" fill="${el.color}" stroke-width="${fs * 0.1}"/>`
      + `<text x="${it.p[0]}" y="${-it.p[1] + fs * 0.32}" font-size="${fs * 0.8}" text-anchor="middle">${i + 1}</text></g>`);
    return { i, el, pal, st, res };
  });

  // Север и масштаб
  parts.push(`<text class="g-north" x="${-R + fs}" y="${-R + fs * 1.6}" font-size="${fs * 1.2}">С ↑</text>`,
    `<line class="g-scale" x1="${R - fs - 10}" y1="${R - fs}" x2="${R - fs}" y2="${R - fs}"/>`,
    `<text class="g-scale-t" x="${R - fs - 5}" y="${R - fs * 1.4}" font-size="${fs * 0.8}" text-anchor="middle">10 м</text>`);

  $('garden-svg').innerHTML = `<svg viewBox="${-R} ${-R} ${2 * R} ${2 * R}" role="img" aria-label="Схема участка">${parts.join('')}</svg>`;
  gardenView = { R };

  $('garden-eval').innerHTML = evals.length
    ? `<div class="garden-eval">${evals.map(({ i, el, pal, st, res }) => `<div class="g-item ${res.level}"><header><span>${i + 1}. ${el.label}</span><span>${pal.dir} <span class="pill-inline ${gardenStarClass(st.mountain, chart.period)}">Г${st.mountain}</span> <span class="pill-inline ${gardenStarClass(st.water, chart.period)}">В${st.water}</span></span></header>`
      + `<ul><li><strong>${LEVEL_TEXT[res.level]}</strong></li>${res.notes.map((n) => `<li>${n}</li>`).join('')}</ul></div>`).join('')}</div>`
    : '<p class="note">Пока ничего не поставлено. Выберите элемент слева и нажмите на схему.</p>';

  const adv = sectorAdvice(chart.palaces, chart.period, shift);
  $('garden-advice').innerHTML = `<table class="advice-table"><thead><tr><th>Сектор</th><th>Звёзды</th><th>Что поставить</th><th>Чего избегать</th></tr></thead><tbody>${adv.map((a) => `<tr><td>${a.palace.dir}</td>`
    + `<td><span class="pill-inline ${gardenStarClass(a.mountain, chart.period)}">Г${a.mountain}</span> <span class="pill-inline ${gardenStarClass(a.water, chart.period)}">В${a.water}</span></td>`
    + `<td>${a.put.join('; ')}</td><td class="avoid">${a.avoid.join('; ') || '—'}</td></tr>`).join('')}</tbody></table>`;
}

$('garden-palette').addEventListener('click', (e) => {
  const b = e.target.closest('[data-garden]');
  if (!b) return;
  state.gardenTool = b.dataset.garden;
  renderGardenPalette();
  save();
});

$('garden-svg').addEventListener('click', (e) => {
  const svg = $('garden-svg').querySelector('svg');
  if (!svg || !gardenView) return;
  const hit = e.target.closest('.g-el');
  if (hit) {
    state.garden.splice(Number(hit.dataset.i), 1);
  } else {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    state.garden.push({ t: state.gardenTool, ll: offset(state.center, pt.x, -pt.y) });
  }
  render();
  save();
});

$('garden-undo').addEventListener('click', () => {
  state.garden.pop();
  render();
  save();
});

$('garden-clear').addEventListener('click', () => {
  if (state.garden.length && !window.confirm('Убрать все элементы с участка?')) return;
  state.garden = [];
  render();
  save();
});

// ---- Вкладки ----

const TABS = ['home', 'calc', 'plan', 'garden'];

function showTab() {
  const id = location.hash.slice(1);
  const tab = TABS.includes(id) ? id : 'home';
  for (const page of document.querySelectorAll('.tab-page')) page.hidden = page.dataset.page !== tab;
  for (const a of document.querySelectorAll('.tabs a')) a.setAttribute('aria-selected', String(a.dataset.tab === tab));
  // Карта, созданная в скрытой вкладке, не знает своего размера
  if (tab === 'calc') map.invalidateSize();
  window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', showTab);

renderShapeControls(1);
renderShapeControls(2);
renderGardenPalette();
showTab();
render();
