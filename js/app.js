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
import { planRooms, roomsFor, kitchenSplit, dir8, isDoubleNine, COMMON } from './planner.js';
import { FURNITURE, FURN_BY_KEY, FURN_CATS, furnSvg } from './furniture.js';
import {
  CLIMATES, climateByLat, MATERIALS, MATERIAL_KEYS, FOUNDATIONS, FOUNDATION_COMPARE, FOUNDATION_WHEN, SITES, GEO_SOILS, GEO_PERMAFROST, geoRecommend, FOUNDATION_TYPES, QUIZ, quizResult, LENS_INFO, wallBuildUp, buildModel, normChecks, buildSheets,
} from './project.js';
import { buildEstimate, priceEstimate } from './estimate.js';
import {
  sunPosition, localToUtc, sunDay, tzGuess, HOUSE_SHAPES, rectPoly, houseOutline, houseFacade, inPoly, sunVector, shadowsAt, sunHours,
  BUILDINGS, BUILDING_BY_KEY, PLANTS, PLANT_BY_KEY, PLANT_GROUPS, LIGHT_TEXT, lightZone, checkPlant, checkBuildings, defaultYard, convexOverlap, housePieces, LIGHT_SHARE,
  PHI, FIB, goldenGrid, nearestGolden, goldenError, fibAtLeast, isFib, phyllotaxis, plantGroups, goldenSpiral,
} from './yard.js';
import {
  SOIL_PH, SOIL_TEXTURE, SOIL_WATER, CLIMATE, climateGuess, HARDY_TEXT, soilFit, SOIL_TESTS, TEMPLATES, TEMPLATE_KEYS,
  pickPlants, placeTemplate, doorPlace, WIND_DIRS, windbreak, SCENARIOS, scenarioSpot, elevationSvg, bedLayout,
  PRESETS, PRESET_KEYS, presetRows, placePreset,
} from './garden.js';

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
  // Мебель, расставленная клиентом: {id, f: этаж, t: ключ, x, y (м от левого края и от фасада), rot}
  furniture: [],
  furnSeq: 1,
  // Мебель сайта, взятая в правку (скрыта в авторасстановке): ['этаж:комната:номер']
  autoHidden: [],
  // Проёмы в стенах, добавленные вручную: {id, f, a: {row, col}, b: {row, col}, pos (0–1 вдоль стены), w (м)}
  openings: [],
  autoFurn: true,
  // Утверждённая планировка для вкладки «Проектирование дома»
  approved: null,
  // Смета: правки цен, коэффициент региона, работы в % от материалов
  estimate: { prices: {}, coef: 1, labor: 0 },
  // Параметры проекта дома
  project: { agree: [false, false, false], material: 'brus', site: null, geo: { soil: null, permafrost: null, ice: false, uniform: true, lens: false, frost: '', water: '' }, noGeo: false, quiz: {}, foundation: null, ceiling: null, pitch: 30, overhang: 0.5, climate: null, custom: null },
  site: [],
  // Конструктор участка: дом, постройки, растения, день и время
  yard: defaultYard(),
  people: [],
  zoom: 20,
};

const saved = load();
// Сохранения до появления плана дома открываем сразу на плане
if (!('floor2' in saved)) delete saved.orient;
const state = { ...defaults, ...saved, program: { ...defaults.program, ...(saved.program || {}) }, project: { ...defaults.project, ...(saved.project || {}) }, estimate: { ...defaults.estimate, ...(saved.estimate || {}) } };
{
  const y = defaultYard();
  const sy = saved.yard || {};
  state.yard = { ...y, ...sy, plot: { ...y.plot, ...(sy.plot || {}) }, house: { ...y.house, ...(sy.house || {}) } };
  // Постройки и зоны прежних версий, которых больше нет, убираем
  state.yard.items = state.yard.items.filter((i) => BUILDING_BY_KEY[i.t]);
}
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
  renderFurnPalette();
  renderOpenings();
  renderApprove();
  renderDesign();
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
  // Кухня-гостиная или отдельные кухня и гостиная
  if (room === 'kitchen' && state.program.kitchen) { state.program.kitchenSep = false; state.program.livingSep = false; }
  if ((room === 'kitchenSep' || room === 'livingSep') && state.program[room]) state.program.kitchen = false;
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
const lastBedChoice = new Map();
const lastAccessIssues = new Map();
const lastAutoItems = new Map();

function bedOptions(chart, fsAz, gua) {
  return ['top', 'bottom', 'left', 'right']
    .map((feet) => {
      const head = OPPOSITE[feet];
      const t = towardWater(chart, fsAz, feet);
      return { head, feet, toward: t, headDir: dir8(norm360(sideBearing(fsAz)[head])), score: t.score * 10 + guaDirScore(gua, norm360(sideBearing(fsAz)[head])) };
    })
    .sort((a, b) => b.score - a.score);
}

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
      // Центральный холл тоже можно заменить другим помещением
      if (Number(floor) !== n || (fixed[cell] && !(fixed[cell].type === 'hall' && !fixed[cell].manual))) continue;
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
  const scale = 480 / Math.max(...floors.flatMap((f) => [f.g.W, f.g.D]));
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
    for (const t of lastAccessIssues.get(f.n) || []) notes.push(`<li class="bad-note"><strong>Проход${where}:</strong> ${escapeHtml(t)}</li>`);
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

// ---- Мебель клиента ----

let furnTool = null; // ключ предмета, который ставим нажатием на план
let furnSel = null; // выбранный предмет
let furnDrag = null;
let furnJustDragged = false;

const dim = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

function renderFurnPalette() {
  $('furn-palette').innerHTML = FURN_CATS.map(([cat, title]) => `<div class="furn-cat"><p class="chip-group">${title}</p><div class="chips">${FURNITURE.filter((f) => f.cat === cat).map((f) => `<button type="button" class="chip" data-furn="${f.key}" aria-pressed="${furnTool === f.key}">${f.label} <small>${dim(f.w)}×${dim(f.d)}</small></button>`).join('')}</div></div>`).join('');
  $('furn-auto').checked = state.autoFurn;
  $('layout-plans').classList.toggle('placing', !!furnTool || opTool);
  const u = furnSel && state.furniture.find((x) => x.id === furnSel);
  $('furn-edit').innerHTML = furnTool
    ? `<p class="msg mixed">Ставим: <strong>${FURN_BY_KEY[furnTool].label}</strong> Нажмите на план. <button type="button" class="link" data-fact="done">Готово</button></p>`
    : u ? `<div class="editor"><strong>${FURN_BY_KEY[u.t].label}</strong><label class="rot-row">Поворот: <output id="furn-rot-out">${Math.round(u.rot || 0)}°</output><input type="range" id="furn-rot" min="0" max="359" step="5" value="${Math.round(u.rot || 0)}"></label><div class="row wrap"><button type="button" class="secondary" data-fact="rotm">↺ 15°</button><button type="button" class="secondary" data-fact="rotp">↻ 15°</button><button type="button" class="secondary" data-fact="rot">↻ 90°</button><button type="button" class="secondary" data-fact="del">Убрать</button><button type="button" class="link" data-fact="done">Готово</button></div></div>` : '';
}

function planPointFrom(e, svg) {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const { x0, y0, scale, d } = svg.dataset;
  return [(p.x - Number(x0)) / Number(scale), Number(d) - (p.y - Number(y0)) / Number(scale)];
}

const snap10 = (v) => Math.round(v * 20) / 20;
function furnChanged() {
  renderLayout(currentChart, lastFsAz);
  renderFurnPalette();
  save();
}

$('furn-palette').addEventListener('click', (e) => {
  const b = e.target.closest('[data-furn]');
  if (!b) return;
  furnTool = furnTool === b.dataset.furn ? null : b.dataset.furn;
  furnSel = null;
  renderFurnPalette();
  if (furnTool) $('layout-plans').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('furn-auto').addEventListener('change', (e) => {
  state.autoFurn = e.target.checked;
  furnChanged();
});
$('furn-clear').addEventListener('click', () => {
  if ((state.furniture.length || state.autoHidden.length) && !window.confirm('Вернуть расстановку сайта и убрать всю мебель, которую вы поставили или передвинули?')) return;
  state.furniture = [];
  state.autoHidden = [];
  furnSel = null;
  furnChanged();
});
$('furn-edit').addEventListener('click', (e) => {
  const a = e.target.closest('[data-fact]')?.dataset.fact;
  if (!a) return;
  const u = state.furniture.find((x) => x.id === furnSel);
  if (a === 'done') { furnTool = null; furnSel = null; }
  if (a === 'rot' && u) u.rot = ((u.rot || 0) + 90) % 360;
  if (a === 'rotp' && u) u.rot = ((u.rot || 0) + 15) % 360;
  if (a === 'rotm' && u) u.rot = ((u.rot || 0) + 345) % 360;
  if (a === 'del' && u) { state.furniture = state.furniture.filter((x) => x.id !== u.id); furnSel = null; }
  furnChanged();
});

$('furn-edit').addEventListener('input', (e) => {
  if (e.target.id !== 'furn-rot') return;
  const u = state.furniture.find((x) => x.id === furnSel);
  if (!u) return;
  u.rot = Number(e.target.value);
  $('furn-rot-out').textContent = `${u.rot}°`;
  renderLayout(currentChart, lastFsAz);
});
$('furn-edit').addEventListener('change', (e) => {
  if (e.target.id === 'furn-rot') save();
});

// ---- Проёмы в стенах ----

let opTool = false;
const lastWallPairs = new Map();
let opMsg = '';
const OP_WIDTHS = [0.8, 0.9, 1.0, 1.2, 1.5, 2.0, 2.4];
const opSpan = (op, f) => (op.a.row === op.b.row ? f.g.D / 3 : f.g.W / 3);
// Простенки по краям не меньше 0,3 м
const clampPos = (pos, w, span) => Math.min(1 - (w / 2 + 0.3) / span, Math.max((w / 2 + 0.3) / span, pos));

function renderOpenings() {
  $('op-tool').textContent = opTool ? 'Готово' : 'Добавить проём';
  $('op-tool').classList.toggle('active', opTool);
  $('layout-plans').classList.toggle('placing', !!furnTool || opTool);
  const list = state.openings;
  $('op-list').innerHTML = (opTool ? `<p class="msg mixed">${opMsg || 'Нажмите на план рядом со стеной между двумя комнатами — там появится проём.'}</p>` : '')
    + (list.length ? `<ul class="op-list">${list.map((o, i) => `<li><span>Проём ${i + 1}${state.floor2 ? ` (${o.f} этаж)` : ''}</span>
      <select data-op="${o.id}">${OP_WIDTHS.map((w) => `<option value="${w}"${Math.abs(w - o.w) < 1e-6 ? ' selected' : ''}>${Math.round(w * 1000)} мм</option>`).join('')}</select>
      <button type="button" class="link" data-op-del="${o.id}">Убрать</button>${lastWallPairs.get(o.f) && !lastWallPairs.get(o.f).has(`${o.a.row}-${o.a.col}|${o.b.row}-${o.b.col}`) ? '<span class="note">стены здесь сейчас нет</span>' : ''}</li>`).join('')}</ul>` : '');
}

$('op-tool').addEventListener('click', () => {
  opTool = !opTool;
  furnTool = null;
  renderFurnPalette();
  renderOpenings();
  if (opTool) $('layout-plans').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('op-list').addEventListener('change', (e) => {
  const o = state.openings.find((x) => x.id === e.target.dataset.op);
  if (!o) return;
  o.w = Number(e.target.value);
  furnChanged();
  renderOpenings();
});
$('op-list').addEventListener('click', (e) => {
  const id = e.target.dataset.opDel;
  if (!id) return;
  state.openings = state.openings.filter((x) => x.id !== id);
  furnChanged();
  renderOpenings();
});

// Ближайшая внутренняя стена сетки к точке (м): между какими секторами и где вдоль неё
function wallAt(x, y, W, D) {
  const cw = W / 3;
  const ch = D / 3;
  const fromTop = D - y;
  let best = null;
  for (const k of [1, 2]) {
    const dv = Math.abs(x - k * cw);
    const row = Math.floor(fromTop / ch);
    if (row >= 0 && row <= 2 && (!best || dv < best.d)) best = { d: dv, a: { row, col: k - 1 }, b: { row, col: k }, pos: (fromTop - row * ch) / ch };
    const dh = Math.abs(fromTop - k * ch);
    const col = Math.floor(x / cw);
    if (col >= 0 && col <= 2 && (!best || dh < best.d)) best = { d: dh, a: { row: k - 1, col }, b: { row: k, col }, pos: (x - col * cw) / cw };
  }
  return best && best.d < 0.8 ? best : null;
}

// Взять мебель сайта в правку: она становится «моей» на том же месте
function adoptAuto(n, it) {
  const u = { id: `f${state.furnSeq++}`, f: n, t: it.k, x: Math.round(it.x * 100) / 100, y: Math.round(it.y * 100) / 100, rot: it.rot, from: it.aid };
  state.furniture.push(u);
  state.autoHidden = [...state.autoHidden, it.aid];
  return u;
}

$('layout-plans').addEventListener('pointerdown', (e) => {
  const svg = e.target.closest('svg.plan');
  if (!svg || furnTool || opTool) return;
  const n = Number(svg.dataset.floor);
  const [x, y] = planPointFrom(e, svg);
  let g = e.target.closest('.ufurn');
  let u = g && state.furniture.find((q) => q.id === g.dataset.fid);
  if (!u && state.autoFurn) {
    // Нажали на мебель сайта (её перекрывает слой секторов — ищем по координатам)
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const it = (lastAutoItems.get(n) || []).find((a) => !state.autoHidden.includes(a.aid)
      && p.x >= a.box[0] && p.x <= a.box[0] + a.box[2] && p.y >= a.box[1] && p.y <= a.box[1] + a.box[3]);
    if (it) {
      u = adoptAuto(n, it);
      furnSel = u.id;
      renderLayout(currentChart, lastFsAz);
    }
  }
  if (!u) return;
  furnDrag = { id: u.id, floor: n, dx: u.x - x, dy: u.y - y, sx: e.clientX, sy: e.clientY, moved: false, adopted: !g };
  $('layout-plans').setPointerCapture(e.pointerId);
});
$('layout-plans').addEventListener('pointermove', (e) => {
  if (!furnDrag) return;
  if (!furnDrag.moved && Math.hypot(e.clientX - furnDrag.sx, e.clientY - furnDrag.sy) < 4) return;
  furnDrag.moved = true;
  const u = state.furniture.find((x) => x.id === furnDrag.id);
  const svgNow = $('layout-plans').querySelector(`svg.plan[data-floor="${furnDrag.floor}"]`);
  if (!svgNow) return;
  const [x, y] = planPointFrom(e, svgNow);
  u.x = snap10(x + furnDrag.dx);
  u.y = snap10(y + furnDrag.dy);
  furnSel = u.id;
  renderLayout(currentChart, lastFsAz);
});
$('layout-plans').addEventListener('pointerup', (e) => {
  if (furnDrag) {
    if (!furnDrag.moved) furnSel = furnSel === furnDrag.id && !furnDrag.adopted ? null : furnDrag.id;
    furnJustDragged = true;
    setTimeout(() => { furnJustDragged = false; }, 0);
    furnDrag = null;
    furnChanged();
    return;
  }
  if (opTool) {
    const svg = e.target.closest('svg.plan');
    if (!svg) return;
    const [x, y] = planPointFrom(e, svg);
    const W = Number(svg.dataset.w);
    const D = Number(svg.dataset.d);
    const wl = wallAt(x, y, W, D);
    const f = Number(svg.dataset.floor);
    if (!wl || !lastWallPairs.get(f)?.has(`${wl.a.row}-${wl.a.col}|${wl.b.row}-${wl.b.col}`)) {
      opMsg = 'Здесь нет перегородки — нажмите ближе к стене между двумя разными помещениями.';
      renderOpenings();
      return;
    }
    opMsg = '';
    const span = wl.a.row === wl.b.row ? D / 3 : W / 3;
    const w = 1.2;
    state.openings.push({ id: `op${Date.now().toString(36)}`, f, a: wl.a, b: wl.b, w, pos: clampPos(wl.pos, w, span) });
    furnChanged();
    renderOpenings();
    return;
  }
  if (!furnTool) return;
  const svg = e.target.closest('svg.plan');
  if (!svg) return;
  const [x, y] = planPointFrom(e, svg);
  if (x < 0 || y < 0 || x > Number(svg.dataset.w) || y > Number(svg.dataset.d)) return;
  const u = { id: `f${state.furnSeq++}`, f: Number(svg.dataset.floor), t: furnTool, x: snap10(x), y: snap10(y), rot: 0 };
  state.furniture.push(u);
  furnSel = u.id;
  furnChanged();
});

// ---- Чертёж «План расстановки мебели» по образцу рабочего проекта ----

const ARCH_S = 60; // пикселей в метре
const T_EXT = 0.3; // наружная стена, м
const T_INT = 0.12; // перегородка, м
const AXIS_LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
const mm = (m) => String(Math.round(m * 1000));

function archSvg(chart, fsAz, f, adults, children, opt = {}) {
  const S = ARCH_S;
  const T_EXT = opt.tExt ?? 0.3;
  const showFurn = opt.furniture !== false;
  const { W, D } = f.g;
  const L = 190; const R = 150; const T = 200; const B = 250;
  const vw = W * S + L + R;
  const vh = D * S + T + B;
  const x0 = L;
  const y0 = T;
  const P = (x, y) => [x0 + x * S, y0 + (D - y) * S];
  const cells = floorCells(chart, f.g);
  const all = { ...f.res.assign, ...f.fixed };
  const rooms = roomsOfFloor(f, cells);
  const byKey = Object.fromEntries(Object.values(all).map((r) => [r.key, r]));
  const auxPart = (r) => (r?.small && r.sharedWith ? byKey[r.sharedWith] : null);
  const wallKey = (r) => auxPart(r)?.key ?? r?.key;
  const out = [];

  // Мебель, двери и окна — из той же планировки, что во вкладке «Планировочное решение»
  const base = layoutSvg(chart, fsAz, f, S, adults, children);
  const bx0 = 34;
  const by0 = f.title ? 40 : 26;
  const dx = x0 - bx0;
  const dy = y0 - by0;
  const toM = (px, py) => [(px - bx0) / S, D - (py - by0) / S];
  const pick = (cls) => [...base.matchAll(new RegExp(`<(?:rect|circle|ellipse|line|path|text)[^>]*class="${cls}"[^>]*?(?:/>|>[^<]*</text>)`, 'g'))].map((m) => m[0]);
  const num = (s, n) => Number((s.match(new RegExp(`\\b${n}="([-\\d.]+)"`)) || [])[1]);
  const afm = base.match(/<!--af-->([\s\S]*?)<!--\/af-->/);
  const furn = showFurn && state.autoFurn && afm ? [afm[1]] : [];
  const ufurn = !showFurn ? [] : [...base.matchAll(/<g class="ufurn[^"]*"[\s\S]*?<\/g>/g)].map((m) => m[0].replace(/ sel"/, '"'));
  const doorGaps = pick('door-gap').map((s) => [toM(num(s, 'x1'), num(s, 'y1')), toM(num(s, 'x2'), num(s, 'y2'))]);
  const leaves = pick('door-leaf');
  const windows = pick('window-gap').map((s) => {
    const a = toM(num(s, 'x1'), num(s, 'y1'));
    const b = toM(num(s, 'x2'), num(s, 'y2'));
    return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]), horiz: Math.abs(a[1] - b[1]) < 1e-6 };
  });
  const entry = pick('plan-door').map((s) => [toM(num(s, 'x1'), num(s, 'y1')), toM(num(s, 'x2'), num(s, 'y2'))])[0];

  // Заливка помещений и отсутствующих частей
  for (const p of pieces(f.g.dec)) {
    if (!p.inside) continue;
    const [ax, ay] = P(p.x1, p.y2);
    out.push(`<rect class="a-floor" x="${ax}" y="${ay}" width="${(p.x2 - p.x1) * S}" height="${(p.y2 - p.y1) * S}"/>`);
  }

  // Мебель — тонкими линиями
  out.push(`<g class="a-furn" transform="translate(${dx} ${dy})">${furn.join('')}${ufurn.join('')}</g>`);

  // Перегородки между разными помещениями
  const cx = (col) => (col * W) / 3;
  const cy = (row) => ((3 - row) * D) / 3;
  const walls = [];
  for (const c of cells) {
    const r = all[`${c.row}-${c.col}`];
    const right = cells.find((o) => o.row === c.row && o.col === c.col + 1);
    const below = cells.find((o) => o.row === c.row + 1 && o.col === c.col);
    if (right && wallKey(all[`${right.row}-${right.col}`]) !== wallKey(r)) walls.push([[cx(c.col + 1), cy(c.row)], [cx(c.col + 1), cy(c.row + 1)]]);
    if (below && wallKey(all[`${below.row}-${below.col}`]) !== wallKey(r)) walls.push([[cx(c.col), cy(c.row + 1)], [cx(c.col + 1), cy(c.row + 1)]]);
    if (r?.pair && r.primary === `${c.row}-${c.col}`) {
      const { vertical } = pairSplit(c, cells, all);
      const xA = cx(c.col); const xB = cx(c.col + 1); const yA = cy(c.row + 1); const yB = cy(c.row);
      walls.push(vertical ? [[(xA + xB) / 2, yA], [(xA + xB) / 2, yB]] : [[xA, (yA + yB) / 2], [xB, (yA + yB) / 2]]);
    }
    // Стенка небольшого подсобного (полоса у наружной стены)
    if (auxPart(r)) {
      const side = r.stripSide || outerSide(c.row, c.col);
      const xA = cx(c.col); const xB = cx(c.col + 1); const yA = cy(c.row + 1); const yB = cy(c.row);
      const k = r.frac ?? 0.4;
      if (side === 'top') walls.push([[xA, yB - (yB - yA) * k], [xB, yB - (yB - yA) * k]]);
      if (side === 'bottom') walls.push([[xA, yA + (yB - yA) * k], [xB, yA + (yB - yA) * k]]);
      if (side === 'left') walls.push([[xA + (xB - xA) * k, yA], [xA + (xB - xA) * k, yB]]);
      if (side === 'right') walls.push([[xB - (xB - xA) * k, yA], [xB - (xB - xA) * k, yB]]);
    }
  }
  for (const [a, b] of walls) {
    const [ax, ay] = P(...a);
    const [bx, by] = P(...b);
    out.push(`<line class="a-wall-int" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke-width="${T_INT * S}"/>`);
  }
  // Наружные стены: двойная линия и красная линия утеплителя
  const segs = outline(f.g.dec);
  for (const sg of segs) {
    const [ax, ay] = P(sg.x1, sg.y1);
    const [bx, by] = P(sg.x2, sg.y2);
    out.push(`<line class="a-wall-ext" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke-width="${T_EXT * S}"/>`,
      `<line class="a-wall-core" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke-width="${T_EXT * S - 3}"/>`,
      `<line class="a-wall-ins" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`);
  }

  // Проёмы дверей, окна
  for (const [a, b] of doorGaps) {
    const [ax, ay] = P(...a);
    const [bx, by] = P(...b);
    out.push(`<line class="a-gap" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke-width="${T_INT * S + 2}"/>`);
  }
  out.push(`<g class="a-leaf" transform="translate(${dx} ${dy})">${leaves.join('')}</g>`);
  if (entry) {
    // Входная дверь: проём в наружной стене и полотно, открывающееся внутрь
    const [ax, ay] = P(...entry[0]);
    const [bx, by] = P(...entry[1]);
    out.push(`<line class="a-gap" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke-width="${T_EXT * S + 2}"/>`);
    const w = Math.hypot(bx - ax, by - ay);
    const [ccx, ccy] = P(W / 2, D / 2);
    const mxp = (ax + bx) / 2;
    const myp = (ay + by) / 2;
    const horiz = Math.abs(ay - by) < 1e-6;
    const n = horiz ? [0, Math.sign(ccy - myp) || 1] : [Math.sign(ccx - mxp) || 1, 0];
    const e = [(bx - ax) / w, (by - ay) / w];
    const sweep = n[0] * e[1] - n[1] * e[0] > 0 ? 1 : 0;
    out.push(`<path class="a-entry" d="M${ax} ${ay} L${ax + n[0] * w} ${ay + n[1] * w} A${w} ${w} 0 0 ${sweep} ${bx} ${by}"/>`);
    out.push(`<text class="a-mark" x="${mxp - n[0] * 40}" y="${myp - n[1] * 34 + 5}" text-anchor="middle">Вход</text>`);
  }
  const sizes = [...new Set(windows.map((w) => Math.round(w.len * 100) / 100))].sort((a, b) => b - a);
  const mark = (len) => `ОК-${sizes.indexOf(Math.round(len * 100) / 100) + 1}`;
  const centerX = W / 2;
  const centerY = D / 2;
  for (const w of windows) {
    const [ax, ay] = P(...w.a);
    const [bx, by] = P(...w.b);
    const t = T_EXT * S;
    const rx = Math.min(ax, bx) - (w.horiz ? 0 : t / 2);
    const ry = Math.min(ay, by) - (w.horiz ? t / 2 : 0);
    const rw = w.horiz ? Math.abs(bx - ax) : t;
    const rh = w.horiz ? t : Math.abs(by - ay);
    out.push(`<rect class="a-gap-fill" x="${rx}" y="${ry}" width="${rw}" height="${rh}"/>`,
      w.horiz ? `<rect class="a-window" x="${rx}" y="${ry + t * 0.3}" width="${rw}" height="${t * 0.4}"/>` : `<rect class="a-window" x="${rx + t * 0.3}" y="${ry}" width="${t * 0.4}" height="${rh}"/>`);
    // Марка окна — снаружи
    const mxm = (w.a[0] + w.b[0]) / 2;
    const mym = (w.a[1] + w.b[1]) / 2;
    const nx = w.horiz ? 0 : Math.sign(mxm - centerX) || 1;
    const ny = w.horiz ? Math.sign(mym - centerY) || 1 : 0;
    const [lx, ly] = P(mxm + nx * 0.5, mym + ny * 0.42);
    out.push(`<text class="a-mark" x="${lx}" y="${ly + 5}" text-anchor="middle"${w.horiz ? '' : ` transform="rotate(-90 ${lx} ${ly})"`}>${mark(w.len)}</text>`);
  }

  // Помещения: название, площадь, внутренние размеры
  const sched = [];
  let ri = 0;
  for (const { room, cells: rc } of rooms.values()) {
    const aux = auxPart(room);
    const cols = rc.map((c) => c.col);
    const rows = rc.map((c) => c.row);
    const c0 = Math.min(...cols); const c1 = Math.max(...cols); const r0 = Math.min(...rows); const r1 = Math.max(...rows);
    const rect = rc.length === (c1 - c0 + 1) * (r1 - r0 + 1);
    let xA = cx(c0); let xB = cx(c1 + 1); let yA = cy(r1 + 1); let yB = cy(r0);
    if (aux) {
      const side = room.stripSide || outerSide(rc[0].row, rc[0].col);
      const k = room.frac ?? 0.4;
      if (side === 'top') yA = yB - (yB - yA) * k;
      if (side === 'bottom') yB = yA + (yB - yA) * k;
      if (side === 'left') xB = xA + (xB - xA) * k;
      if (side === 'right') xA = xB - (xB - xA) * k;
    }
    const half = (edge) => (edge ? T_EXT / 2 : T_INT / 2);
    const iw = xB - xA - half(xA < 1e-6) - half(xB > W - 1e-6);
    const id = yB - yA - half(yA < 1e-6) - half(yB > D - 1e-6);
    let area = rect || aux ? iw * id : rc.reduce((s2, c) => s2 + Math.min(1, f.g.cov[c.row][c.col]) * (W / 3) * (D / 3), 0) * 0.9;
    // Комнате, которая делит сектор с небольшим подсобным, достаётся остальная часть этого сектора
    const shared = [...rooms.values()].filter((o) => auxPart(o.room)?.key === room.key);
    for (const o of shared) area += (W / 3) * (D / 3) * (1 - (o.room.frac ?? 0.4)) * 0.9;
    if (room.pair) {
      const { vertical } = pairSplit(rc[0], cells, all);
      room.pair.forEach((sub, i) => {
        const hx1 = vertical ? (i ? (xA + xB) / 2 : xA) : xA;
        const hx2 = vertical ? (i ? xB : (xA + xB) / 2) : xB;
        // В плане y вверх; первая половина (верхняя на экране) — с большими y
        const hy1 = vertical ? yA : (i ? yA : (yA + yB) / 2);
        const hy2 = vertical ? yB : (i ? (yA + yB) / 2 : yB);
        const a2 = (hx2 - hx1 - half(hx1 < 1e-6) - half(hx2 > W - 1e-6)) * (hy2 - hy1 - half(hy1 < 1e-6) - half(hy2 > D - 1e-6));
        ri++;
        sched.push({ n: ri, label: sub.label, area: a2, type: 'utility', key: sub.key, wet: !!sub.wet, x1: hx1, x2: hx2, y1: hy1, y2: hy2, rect: true });
        const [tx, ty] = P((hx1 + hx2) / 2, (hy1 + hy2) / 2);
        out.push(`<text class="a-room" x="${tx}" y="${ty - 4}" text-anchor="middle">${escapeHtml(sub.label)}</text>`, `<text class="a-area" x="${tx}" y="${ty + 12}" text-anchor="middle">${fmt(a2, 2)}</text>`);
      });
      continue;
    }
    ri++;
    sched.push({ n: ri, label: room.label, area, type: room.type, key: room.key, wet: !!room.wet, x1: xA, x2: xB, y1: yA, y2: yB, rect: rect || !!aux });
    const [tx, ty] = P((xA + xB) / 2, (yA + yB) / 2);
    const words = room.label.length > 14 ? room.label.split(/,\s*|\s+/) : [room.label];
    words.forEach((wd, i) => out.push(`<text class="a-room" x="${tx}" y="${ty - 6 + (i - (words.length - 1) / 2) * 15}" text-anchor="middle">${escapeHtml(wd)}</text>`));
    out.push(`<text class="a-area" x="${tx}" y="${ty + 12 + ((words.length - 1) / 2) * 15}" text-anchor="middle">${fmt(area, 2)}</text>`);
    // Внутренние размеры прямоугольных помещений
    if ((rect || aux) && iw > 1.4 && id > 1.4) {
      const [ix1, iy1] = P(xA + half(xA < 1e-6), yB - half(yB > D - 1e-6) - 0.35);
      const [ix2] = P(xB - half(xB > W - 1e-6), 0);
      out.push(dimLine([ix1, iy1], [ix2, iy1], mm(iw), 'h'));
      const [jx, jy1] = P(xA + half(xA < 1e-6) + 0.35, yB - half(yB > D - 1e-6));
      const [, jy2] = P(0, yA + half(yA < 1e-6));
      out.push(dimLine([jx, jy1], [jx, jy2], mm(id), 'v'));
    }
  }

  // Оси и размерные цепочки
  const axX = [0, W / 3, (2 * W) / 3, W];
  const axY = [0, D / 3, (2 * D) / 3, D];
  const openings = (side) => {
    const list = [...windows.map((w) => [w.a, w.b])];
    if (entry) list.push(entry);
    const onSide = list.filter(([a, b]) => (side === 'bottom' ? a[1] < 1e-6 && b[1] < 1e-6 : side === 'top' ? a[1] > D - 1e-6 && b[1] > D - 1e-6 : side === 'right' ? a[0] > W - 1e-6 && b[0] > W - 1e-6 : a[0] < 1e-6 && b[0] < 1e-6));
    const pts = [0, ...onSide.flatMap(([a, b]) => (side === 'top' || side === 'bottom' ? [a[0], b[0]] : [a[1], b[1]])), side === 'top' || side === 'bottom' ? W : D];
    return [...new Set(pts.map((v) => Math.round(v * 1000) / 1000))].sort((p, q) => p - q);
  };
  const [, yBot] = P(0, 0);
  const [, yTop] = P(0, D);
  const [xLeft] = P(0, 0);
  const [xRight] = P(W, 0);
  const chainH = (xs, y, from) => {
    const pts = xs.map((x) => P(x, 0)[0]);
    const parts = [`<line class="a-dim" x1="${pts[0] - 8}" y1="${y}" x2="${pts[pts.length - 1] + 8}" y2="${y}"/>`];
    pts.forEach((px) => parts.push(`<line class="a-ext" x1="${px}" y1="${from}" x2="${px}" y2="${y + (y > from ? 6 : -6)}"/>`, tick(px, y)));
    for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > 0.05) parts.push(`<text class="a-dimt" x="${(pts[i] + pts[i - 1]) / 2}" y="${y - 5}" text-anchor="middle">${mm(xs[i] - xs[i - 1])}</text>`);
    return parts.join('');
  };
  const chainV = (ys, x, from) => {
    const pts = ys.map((y) => P(0, y)[1]);
    const parts = [`<line class="a-dim" x1="${x}" y1="${pts[0] + 8}" x2="${x}" y2="${pts[pts.length - 1] - 8}"/>`];
    pts.forEach((py) => parts.push(`<line class="a-ext" x1="${from}" y1="${py}" x2="${x + (x > from ? 6 : -6)}" y2="${py}"/>`, tick(x, py)));
    for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > 0.05) {
      const my = (pts[i] + pts[i - 1]) / 2;
      parts.push(`<text class="a-dimt" x="${x - 5}" y="${my}" text-anchor="middle" transform="rotate(-90 ${x - 5} ${my})">${mm(ys[i] - ys[i - 1])}</text>`);
    }
    return parts.join('');
  };
  out.push(chainH(openings('top'), yTop - 72, yTop - 12), chainH(axX, yTop - 115, yTop - 12));
  out.push(chainH(openings('bottom'), yBot + 75, yBot + 12), chainH(axX, yBot + 115, yBot + 12), chainH([0, W], yBot + 152, yBot + 12));
  out.push(chainV(axY, xLeft - 60, xLeft - 12), chainV([0, D], xLeft - 105, xLeft - 12));
  out.push(chainV(openings('right'), xRight + 78, xRight + 12));
  axX.forEach((x, i) => {
    const [px] = P(x, 0);
    out.push(`<line class="a-axis" x1="${px}" y1="${yBot + 8}" x2="${px}" y2="${yBot + 180}"/><circle class="a-bubble" cx="${px}" cy="${yBot + 196}" r="15"/><text class="a-axt" x="${px}" y="${yBot + 202}" text-anchor="middle">${i + 1}</text>`);
  });
  axY.forEach((y, i) => {
    const [, py] = P(0, y);
    out.push(`<line class="a-axis" x1="${xLeft - 8}" y1="${py}" x2="${xLeft - 130}" y2="${py}"/><circle class="a-bubble" cx="${xLeft - 146}" cy="${py}" r="15"/><text class="a-axt" x="${xLeft - 146}" y="${py + 6}" text-anchor="middle">${AXIS_LETTERS[i]}</text>`);
  });
  const title = `${opt.title || 'План расстановки мебели'}${f.title ? ` — ${f.title.toLowerCase()}` : ''}`;
  out.unshift(`<rect class="a-sheet" x="0" y="0" width="${vw}" height="${vh}"/>${opt.bare ? '' : `<text class="a-title" x="24" y="40">${title}</text>`}`);
  // Фасад и север
  out.push(`<text class="a-note" x="${(xLeft + xRight) / 2}" y="${vh - 6}" text-anchor="middle">Фасад → ${chart.facingPalace.dirName}</text>`);
  out.push(`<g transform="translate(${vw - 40} 50) rotate(${180 - fsAz})"><path class="a-north" d="M0 -18 L7 6 L0 2 L-7 6 Z"/><text class="a-axt" x="0" y="-22" text-anchor="middle" font-size="12">С</text></g>`);

  const winH = (len) => (len >= 1.5 ? 1.5 : len >= 1 ? 1.2 : 0.9);
  const winList = sizes.map((len, i) => ({ mark: `ОК-${i + 1}`, w: len, h: winH(len), n: windows.filter((w) => Math.round(w.len * 100) / 100 === len).length }));
  const geo = {
    W, D,
    windows: windows.map((w) => ({ a: w.a, b: w.b, horiz: w.horiz, len: w.len, h: winH(w.len), mark: mark(w.len) })),
    entry: entry || null,
    walls,
    outline: segs.map((sg) => ({ x1: sg.x1, y1: sg.y1, x2: sg.x2, y2: sg.y2, facing: sg.facing })),
    rooms: sched,
  };
  return { geo, svg: `<svg class="arch" viewBox="0 0 ${vw} ${vh}" role="img" aria-label="${title}">${out.join('')}</svg>`, rooms: sched, windows: winList };
}

function tick(x, y) {
  return `<line class="a-tick" x1="${x - 5}" y1="${y + 5}" x2="${x + 5}" y2="${y - 5}"/>`;
}

function dimLine(a, b, text, dir) {
  const parts = [`<line class="a-dim" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`, tick(a[0], a[1]), tick(b[0], b[1])];
  if (dir === 'h') parts.push(`<text class="a-dimt" x="${(a[0] + b[0]) / 2}" y="${a[1] - 4}" text-anchor="middle">${text}</text>`);
  else {
    const my = (a[1] + b[1]) / 2;
    parts.push(`<text class="a-dimt" x="${a[0] - 4}" y="${my}" text-anchor="middle" transform="rotate(-90 ${a[0] - 4} ${my})">${text}</text>`);
  }
  return parts.join('');
}

// ---- Утверждение планировки ----


// Снимок данных, из которых строится планировка: проект не меняется, пока планировку не утвердят заново
const SNAP_KEYS = ['autoHidden', 'openings', 'center', 'width', 'depth', 'az', 'mode', 'period', 'floor2', 'width2', 'depth2', 'shape1', 'shape2', 'door', 'doorNine', 'program', 'overrides', 'people', 'furniture', 'autoFurn'];

function withSnapshot(snap, fn) {
  const keep = {};
  for (const k of SNAP_KEYS) keep[k] = state[k];
  const keepDoor = doorNow;
  const keepSel = furnSel;
  Object.assign(state, JSON.parse(JSON.stringify(snap)));
  furnSel = null;
  try {
    const decl = declination(state.center[0], state.center[1], decimalYear());
    const fsAz = state.mode === 'magnetic' ? norm360(state.az - decl) : state.az;
    const chart = flyingStars(fsAz, state.period);
    const door = effectiveDoor(chart, fsAz);
    doorNow = door;
    return fn(chart, fsAz, door);
  } finally {
    Object.assign(state, keep);
    doorNow = keepDoor;
    furnSel = keepSel;
  }
}

function approveLayout() {
  if (!currentChart || currentChart.period !== 9) return;
  const snap = {};
  for (const k of SNAP_KEYS) snap[k] = JSON.parse(JSON.stringify(state[k]));
  state.approved = {
    at: new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    snap,
  };
  designCache = { key: '', html: '' };
  save();
  renderApprove();
  location.hash = '#design';
}

function renderApprove() {
  $('approve-status').innerHTML = state.approved
    ? `<p class="msg good"><strong>Планировка утверждена ${state.approved.at}</strong>Если что-то поменяли — утвердите ещё раз, и проект обновится.</p>`
    : '';
}

const projClimate = () => {
  const pj = state.project;
  const key = pj.climate || climateByLat(state.approved?.snap?.center?.[0] ?? state.center[0]);
  return key === 'custom' && pj.custom ? { ...CLIMATES.yakutsk, ...pj.custom, name: pj.custom.name || 'Своё место' } : CLIMATES[key === 'custom' ? 'yakutsk' : key];
};
const projClimateKey = () => state.project.climate || climateByLat(state.approved?.snap?.center?.[0] ?? state.center[0]);
const geoDone = () => state.project.noGeo || !!geoRecommend(state.project.geo);
const projRec = () => {
  const pj = state.project;
  const g = !pj.noGeo && geoRecommend(pj.geo);
  let r = g ? { ...g, from: 'geo' } : pj.site ? { ...SITES[pj.site], from: 'site' } : null;
  // Признаки линз по мини-тесту: сваи вперёд, лента и плита — в конец
  const q = quizResult(pj.quiz);
  if (q.level === 'high' || (q.lens && r?.from !== 'geo')) {
    const base = r ? r.rec : ['driven', 'piles'];
    const rec = [...base.filter((k) => !['slab', 'strip'].includes(k)), ...(q.level === 'high' ? [] : base.filter((k) => ['slab', 'strip'].includes(k)))];
    r = { rec: rec.length ? rec : ['driven', 'piles'], note: `${r?.from === 'geo' ? `${r.note} ` : ''}По мини-тесту есть признаки линз или сложных грунтов — в первую очередь сваи, прорезающие линзу.`, from: r?.from || 'quiz' };
  }
  return r;
};
const projFoundation = () => state.project.foundation || projRec()?.rec[0] || (projClimate().permafrost ? 'piles' : 'strip');
const projCeiling = () => state.project.ceiling || (['IА', 'IБ', 'IГ', 'IД', 'IVА'].includes(projClimate().zone) ? 2.7 : 2.5);

let designCache = { key: '', html: '' };
let modelCache = { key: '', m: null };
const modelKey = () => JSON.stringify([state.approved?.at, state.project, state.center]);
function currentModel() {
  const key = modelKey();
  if (modelCache.key !== key) modelCache = { key, m: designModel() };
  return modelCache.m;
}

function designModel() {
  const pj = state.project;
  const cl = projClimate();
  const wall = wallBuildUp(pj.material, cl);
  return withSnapshot(state.approved.snap, (chart, fsAz) => {
    const { floors, adults, children } = buildLayout(chart, doorNow);
    const fl = floors.map((f) => {
      const plain = archSvg(chart, fsAz, f, adults, children, { tExt: wall.thick, furniture: false, bare: true, title: 'План этажа' });
      const furn = archSvg(chart, fsAz, f, adults, children, { tExt: wall.thick, bare: true });
      // Число дверных полотен — по дугам открывания
      plain.geo.leafs = (plain.svg.match(/class="door-leaf"/g) || []).length;
      return { title: f.title || '1 этаж', geo: plain.geo, planSvg: plain.svg, furnSvg: furn.svg, preview: furn.svg };
    });
    return buildModel({
      floors: fl, material: pj.material, site: pj.site, geo: pj.geo, noGeo: pj.noGeo, quiz: pj.quiz, foundation: projFoundation(), climate: cl, ceiling: projCeiling(),
      pitch: pj.pitch, overhang: pj.overhang, year: new Date().getFullYear(),
    });
  });
}

function foundationCard() {
  const pj = state.project;
  const g = pj.geo;
  const cur = projFoundation();
  const rec = projRec();
  const done = geoDone();
  const cols = ['strip', 'slab', 'piles'];
  const head = { strip: 'Ленточный', slab: 'Сплошная плита', piles: 'Свайный' };
  const w = FOUNDATION_WHEN[cur];
  const opt = (dict, val) => Object.entries(dict).map(([k, t]) => `<option value="${k}"${val === k ? ' selected' : ''}>${t}</option>`).join('');
  return `<section class="card found-card"><h2><span class="num">1</span>Фундамент и грунты участка</h2>
    <p class="chip-group">Где планируется строительство?</p>
    <div class="sites">${Object.entries(SITES).map(([k, v]) => `<label class="check"><input type="radio" name="pj-site" value="${k}"${pj.site === k ? ' checked' : ''}> ${v.label}</label>`).join('')}</div>
    <p class="chip-group">Итоги инженерно-геологических изысканий</p>
    <fieldset class="geo"${pj.noGeo ? ' disabled' : ''}><div class="grid3 params">
      <label>Грунт основания <select data-geo="soil"><option value="">— выберите —</option>${opt(GEO_SOILS, g.soil)}</select></label>
      <label>Вечная мерзлота <select data-geo="permafrost"><option value="">— выберите —</option>${opt(GEO_PERMAFROST, g.permafrost)}</select></label>
      <label>Глубина промерзания / оттаивания, м <input data-geo="frost" inputmode="decimal" value="${escapeHtml(String(g.frost ?? ''))}" placeholder="например, 3,0"></label>
      <label>Уровень грунтовых вод, м <input data-geo="water" inputmode="decimal" value="${escapeHtml(String(g.water ?? ''))}" placeholder="не встречены — пусто"></label>
    </div>
    <label class="check"><input type="checkbox" data-geo="uniform"${g.uniform ? ' checked' : ''}> Грунт однородный по площади дома</label>
    <label class="check"><input type="checkbox" data-geo="ice"${g.ice ? ' checked' : ''}> Льдистый или просадочный при оттаивании</label>
    <label class="check"><input type="checkbox" data-geo="lens"${g.lens ? ' checked' : ''}> Изыскания выявили линзу: подземный лёд, талик, торф или плывун</label></fieldset>
    <label class="check nogeo"><input type="checkbox" id="pj-nogeo"${pj.noGeo ? ' checked' : ''}> Геологических изысканий нет. Выбор фундамента делаю сам, на свой риск.</label>
    ${!done ? '<p class="msg bad"><strong>Укажите итоги изысканий</strong>Грунт и наличие мерзлоты — или отметьте, что изысканий нет. Без этого проект не собирается.</p>' : ''}
    ${quizBlock()}
    ${rec ? `<p class="msg ${pj.noGeo ? 'bad' : 'mixed'}"><strong>${rec.from === 'geo' ? 'По изысканиям' : rec.from === 'quiz' ? 'По мини-тесту' : 'По месту строительства'} рекомендуем: ${rec.rec.map((k) => FOUNDATIONS[k].short).join(' → ')}</strong>${rec.note}${pj.noGeo ? ' Без изысканий это только предположение — решение и риск на вас.' : ''}</p>` : ''}
    <div class="variants-abc"><p><b>Варианты для дома</b></p><ul>
      <li><b>А — свайный:</b> если грунтовые условия и геокриологические расчёты требуют сохранения мерзлоты.</li>
      <li><b>Б — утеплённая железобетонная плита:</b> если изыскания подтверждают возможность надёжного мелкозаглублённого основания.</li>
      <li><b>В — ленточный:</b> если он обоснован характеристиками грунта, нагрузками и расчётом морозного пучения.</li>
    </ul><p class="note">Ни ленту, ни плиту не стоит назначать заранее без информации об участке.</p></div>
    <div class="found-pick">${Object.entries(FOUNDATIONS).map(([k, f]) => `<button type="button" class="chip" data-found="${k}" aria-pressed="${cur === k}"${done ? '' : ' disabled'}>${f.title}${rec?.rec[0] === k ? ' ★' : ''}</button>`).join('')}</div>
    ${w ? `<div class="found-when"><p><b>Когда выбирать «${FOUNDATIONS[cur].short}»:</b></p><ul>${w.when.map((x) => `<li>${x}</li>`).join('')}</ul><p class="note">${w.risk}</p></div>` : ''}
    <details><summary>Какие бывают фундаменты и что распространено в Якутии</summary><div class="table-wrap"><table class="cmp"><thead><tr><th>Фундамент</th><th>В Якутии</th><th>Для каких грунтов</th><th>Замечание</th></tr></thead><tbody>${FOUNDATION_TYPES.map(([n, y, soil, note, key]) => `<tr${key && cur === key ? ' class="on-row"' : ''}><td><b>${n}</b>${key ? `<br><button type="button" class="link" data-found="${key}"${done ? '' : ' disabled'}>выбрать</button>` : ''}</td><td>${y}</td><td>${soil}</td><td>${note}</td></tr>`).join('')}</tbody></table></div></details>
    <details${quizResult(pj.quiz).lens || g.lens ? ' open' : ''}><summary>Что такое линза в грунте и что делать, если она есть</summary><div class="lens">
      ${LENS_INFO.what.map(([t, d]) => `<p><b>${t}.</b> ${d}</p>`).join('')}
      <p><b>Когда стоит ждать линзу:</b></p><ul>${LENS_INFO.where.map((x) => `<li>${x}</li>`).join('')}</ul>
      <p><b>Если линза попалась:</b></p><ol>${LENS_INFO.todo.map((x) => `<li>${x}</li>`).join('')}</ol>
    </div></details>
    <details><summary>Сравнение фундаментов</summary><div class="table-wrap"><table class="cmp"><thead><tr><th>Критерий</th>${cols.map((c) => `<th${cur === c ? ' class="on"' : ''}>${head[c]}</th>`).join('')}</tr></thead><tbody>${FOUNDATION_COMPARE.map(([c, ...v]) => `<tr><td>${c}</td>${v.map((x, i) => `<td${cur === cols[i] ? ' class="on"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>
  </section>`;
}

function quizBlock() {
  const pj = state.project;
  const q = quizResult(pj.quiz);
  const lv = { low: ['good', 'Риск низкий'], mid: ['mixed', 'Риск средний'], high: ['bad', 'Риск высокий'] };
  return `<details class="quiz"${Object.keys(pj.quiz).length ? ' open' : ''}><summary>Мини-тест: что может быть под участком</summary>
    <p class="note">Ответьте по тому, что видно на участке и вокруг. Тест не заменяет изыскания, но подскажет, где искать линзы и сложные грунты.</p>
    ${QUIZ.map(([k, t]) => `<div class="quiz-q"><span>${t}</span><span class="quiz-a">${[['yes', 'да'], ['no', 'нет'], ['unknown', 'не знаю']].map(([v, l]) => `<label><input type="radio" name="qz-${k}" data-quiz="${k}" value="${v}"${pj.quiz[k] === v ? ' checked' : ''}> ${l}</label>`).join('')}</span></div>`).join('')}
    ${q.level ? `<div class="msg ${lv[q.level][0]}"><strong>${lv[q.level][1]}${q.lens ? ': возможна линза' : ''}</strong>${q.risks.length ? `<ul>${q.risks.map(([t, d]) => `<li><b>${t}.</b> ${d}</li>`).join('')}</ul>` : 'Явных признаков нет, но изыскания всё равно нужны.'}</div>` : ''}
  </details>`;
}

const AGREE = [
  'Понимаю, что проект — примерный вариант и носит подсказочный характер. Это не проектная документация.',
  'Перед строительством закажу инженерно-геологические изыскания и покажу проект проектировщику или строителю.',
  'Проект сделан в помощь тем, кто строится сам; решения по нему принимаю я и отвечаю за них.',
];

function renderDesign() {
  if ($('tab-design').hidden) return;
  const a = state.approved;
  if (!a || !a.snap) {
    $('design').innerHTML = `<section class="card"><h2>Планировка ${a ? 'нужно утвердить заново' : 'ещё не утверждена'}</h2><p class="note">Перейдите во вкладку «Планировочное решение», выберите вариант, расставьте мебель и нажмите «Утвердить планировку» внизу страницы.</p><p><a class="btn" href="#plan">К планировке</a></p></section>`;
    return;
  }
  const pj = state.project;
  const agreed = pj.agree.every(Boolean);
  const agreeCard = `<section class="card agree-card"><h2>Прежде чем начать</h2><p class="note">Сайт доработает утверждённую планировку по строительным нормам (СП и СНиП) и соберёт эскизный проект в PDF. Отметьте все пункты:</p>${AGREE.map((t, i) => `<label class="check agree"><input type="checkbox" data-agree="${i}"${pj.agree[i] ? ' checked' : ''}> ${t}</label>`).join('')}</section>`;
  if (!agreed) {
    $('design').innerHTML = `${agreeCard}<section class="card"><h2>Утверждённая планировка</h2><p class="note">Утверждена ${a.at}. <a href="#plan">Изменить</a></p></section>`;
    return;
  }
  if (!geoDone()) {
    $('design').innerHTML = `${agreeCard.replace('<section class="card agree-card">', '<details class="card agree-card"><summary>Условия приняты</summary>').replace(/<\/section>$/, '</details>')}${foundationCard()}`;
    return;
  }
  const key = modelKey();
  if (designCache.key !== key) {
    const m = currentModel();
    const checks = normChecks(m);
    const sheets = buildSheets(m, checks);
    const cl = m.cl;
    const matCards = MATERIAL_KEYS.map((k) => {
      const mt = MATERIALS[k];
      const wb = wallBuildUp(k, cl);
      return `<button type="button" class="mat${pj.material === k ? ' on' : ''}" data-mat="${k}"><b>${mt.title}</b><span>${wb.ins ? `+ утеплитель ${Math.round(wb.ins * 1000)} мм` : 'без утепления'} · стена ${Math.round(wb.thick * 1000)} мм</span><span class="note">${mt.about}</span></button>`;
    }).join('');
    const sel = (id, opts, val) => `<select id="${id}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(val) ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
    const ck = projClimateKey();
    const custom = ck === 'custom' ? `<div class="grid2 climate-custom">${[['name', 'Место', cl.name], ['tOt', 't отопит. периода, °С', cl.tOt], ['zOt', 'Отопит. период, сут', cl.zOt], ['t5', 't пятидневки, °С', cl.t5], ['Sg', 'Снег Sg, кПа', cl.Sg], ['zone', 'Климатич. район', cl.zone]].map(([k, l, v]) => `<label>${l}<input data-cl="${k}" value="${v}"></label>`).join('')}</div>` : '';
    const okN = checks.filter((c) => c.ok === true).length;
    const badN = checks.filter((c) => c.ok === false).length;
    designCache = {
      key,
      html: `${agreeCard.replace('<section class="card agree-card">', '<details class="card agree-card"><summary>Условия приняты</summary>').replace(/<\/section>$/, '</details>')}
      ${foundationCard()}
      <section class="card"><h2><span class="num">2</span>Материал стен</h2><div class="mats">${matCards}</div></section>
      <section class="card"><h2>Параметры</h2><div class="grid3 params">
        <label>Климат ${sel('pj-climate', [...Object.entries(CLIMATES).map(([k, c]) => [k, `${c.name} (район ${c.zone})`]), ['custom', 'Своё место…']], ck)}</label>
        <label>Высота потолков ${sel('pj-ceil', [[2.5, '2,5 м'], [2.7, '2,7 м'], [3.0, '3,0 м']], projCeiling())}</label>
        <label>Уклон кровли ${sel('pj-pitch', [[25, '25°'], [30, '30°'], [35, '35°'], [40, '40°'], [45, '45°']], pj.pitch)}</label>
        <label>Свес кровли ${sel('pj-ovh', [[0.4, '400 мм'], [0.5, '500 мм'], [0.6, '600 мм']], pj.overhang)}</label>
      </div>${custom}<p class="note">Климат по СП 131.13330 и СП 20.13330 — ориентировочно, проверьте значения для своего населённого пункта.</p></section>
      <section class="card"><h2>Проверка по нормам</h2><p class="note">Выполнено ${okN} из ${checks.filter((c) => c.ok !== null).length}${badN ? `, требуют внимания — ${badN}` : ''}.</p><ul class="checks">${checks.map((c) => `<li class="${c.ok === null ? 'mixed' : c.ok ? 'good' : 'bad'}"><b>${c.title}</b> ${c.text} <span class="note">${c.norm}</span></li>`).join('')}</ul></section>
      <section class="card sheets-card"><div class="sheets-head"><h2>Эскизный проект — ${sheets.length} листов А4</h2><button type="button" id="pj-pdf">Скачать проект в PDF</button></div><p class="note">В окне печати выберите «Сохранить как PDF». Формат А4, книжная ориентация, поля — нет.</p><div class="sheets">${sheets.map((sh) => `<div class="sheet-wrap">${sh.svg}</div>`).join('')}</div></section>`,
    };
  }
  $('design').innerHTML = designCache.html;
}

// ---- Смета ----

const rub = (n) => Math.round(n).toLocaleString('ru-RU');
const qtyF = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));

function renderEstimate() {
  if ($('tab-estimate').hidden) return;
  const pj = state.project;
  if (!state.approved?.snap || !pj.agree.every(Boolean) || !geoDone()) {
    $('estimate').innerHTML = '<section class="card"><h2>Сначала — проект</h2><p class="note">Смета считается по эскизному проекту. Утвердите планировку, отметьте условия и укажите грунты во вкладке «Проектирование дома».</p><p><a class="btn" href="#design">К проектированию</a></p></section>';
    return;
  }
  const m = currentModel();
  const est = state.estimate;
  const priced = priceEstimate(buildEstimate(m), est.prices, est.coef);
  const labor = (priced.total * (est.labor || 0)) / 100;
  const body = priced.sections.map((s, si) => `<tr class="est-sec"><td>${si + 1}.</td><td colspan="5">${s.title}</td><td class="num">${rub(s.sum)}</td><td></td></tr>`
    + s.rows.map((r, ri) => `<tr><td>${si + 1}.${ri + 1}.</td><td>${escapeHtml(r.work || '')}</td><td>${escapeHtml(r.name)}</td><td class="num">${qtyF(r.qty)}</td><td>${r.unit}</td><td class="num"><input class="est-price" data-pkey="${r.key}" value="${r.base}" inputmode="decimal"${est.prices[r.key] != null ? ' data-edited' : ''}></td><td class="num">${rub(r.cost)}</td><td class="note">${r.note || ''}</td></tr>`).join('')).join('');
  const total = priced.total + labor;
  $('estimate').innerHTML = `<section class="card est-head"><h2>Смета дома ${fmt(m.W, 1)} × ${fmt(m.D, 1)} м — ${m.mat.title.toLowerCase()}, фундамент ${FOUNDATIONS[m.foundation].short}</h2>
      <div class="grid3 params">
        <label>Коэффициент цен региона <input id="est-coef" inputmode="decimal" value="${est.coef}"></label>
        <label>Работы, % от материалов <input id="est-labor" inputmode="decimal" value="${est.labor || 0}"></label>
        <div class="row wrap est-btns"><button type="button" id="est-pdf">Скачать смету в PDF</button><button type="button" class="secondary" id="est-csv">Скачать для Excel</button><button type="button" class="link" id="est-reset">Вернуть цены по умолчанию</button></div>
      </div>
      <p class="note">Работы обычно стоят 60–100 % от материалов; 0 — только материалы. Количества — по проекту с запасом на подрезку; цены можно менять прямо в таблице.</p>
      <div class="est-total"><span>Материалы: <b>${rub(priced.total)} ₽</b></span>${labor ? `<span>Работы: <b>${rub(labor)} ₽</b></span>` : ''}<span>Итого: <b>${rub(total)} ₽</b></span><span>За м² общей площади: <b>${rub(total / Math.max(1, m.total))} ₽</b></span></div>
    </section>
    <section class="card est-card"><div class="table-wrap"><table class="est"><thead><tr><th>№</th><th>Наименование работ</th><th>Наименование материала</th><th>Кол-во</th><th>Ед. изм.</th><th>Расценка, ₽</th><th>Стоимость, ₽</th><th>Примечание</th></tr></thead><tbody>${body}</tbody>
    <tfoot><tr><td></td><td colspan="5">Стоимость материалов</td><td class="num">${rub(priced.total)}</td><td></td></tr>${labor ? `<tr><td></td><td colspan="5">Работы (${est.labor} %)</td><td class="num">${rub(labor)}</td><td></td></tr><tr><td></td><td colspan="5">Итого</td><td class="num">${rub(total)}</td><td></td></tr>` : ''}</tfoot></table></div>
    <p class="note">Смета ориентировочная, по эскизному проекту; не является сметной документацией. Цены — средние по Якутску на 2025–2026 годы, уточняйте у поставщиков.</p></section>`;
}

$('estimate').addEventListener('change', (e) => {
  const t = e.target;
  const est = state.estimate;
  const num = (v) => Number(String(v).replace(/\s/g, '').replace(',', '.'));
  if (t.dataset.pkey) {
    const v = num(t.value);
    if (Number.isFinite(v) && v >= 0) est.prices = { ...est.prices, [t.dataset.pkey]: v };
  } else if (t.id === 'est-coef') {
    const v = num(t.value);
    if (Number.isFinite(v) && v > 0) est.coef = v;
  } else if (t.id === 'est-labor') {
    const v = num(t.value);
    if (Number.isFinite(v) && v >= 0) est.labor = v;
  } else return;
  save();
  renderEstimate();
});
$('estimate').addEventListener('click', (e) => {
  if (e.target.closest('#est-reset')) {
    if (!window.confirm('Вернуть все цены по умолчанию?')) return;
    state.estimate.prices = {};
    save();
    renderEstimate();
  }
  if (e.target.closest('#est-pdf')) {
    document.body.classList.add('print-estimate');
    window.print();
  }
  if (e.target.closest('#est-csv')) {
    const m = currentModel();
    const est = state.estimate;
    const priced = priceEstimate(buildEstimate(m), est.prices, est.coef);
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['№', 'Наименование работ', 'Наименование материала', 'Кол-во', 'Ед. изм.', 'Расценка', 'Стоимость', 'Примечание'].map(q).join(';')];
    priced.sections.forEach((s, si) => {
      lines.push([`${si + 1}.`, s.title, '', '', '', '', Math.round(s.sum), ''].map(q).join(';'));
      s.rows.forEach((r, ri) => lines.push([`${si + 1}.${ri + 1}.`, r.work || '', r.name, String(r.qty).replace('.', ','), r.unit, String(r.unitPrice).replace('.', ','), String(r.cost).replace('.', ','), r.note || ''].map(q).join(';')));
    });
    lines.push(['', 'Стоимость материалов', '', '', '', '', Math.round(priced.total), ''].map(q).join(';'));
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Смета-дом-${fmt(m.W, 0)}x${fmt(m.D, 0)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
});
window.addEventListener('afterprint', () => document.body.classList.remove('print-estimate'));

$('btn-approve').addEventListener('click', approveLayout);
$('design').addEventListener('change', (e) => {
  const t = e.target;
  const pj = state.project;
  if (t.dataset.agree !== undefined) pj.agree[Number(t.dataset.agree)] = t.checked;
  else if (t.id === 'pj-climate') { pj.climate = t.value; if (t.value === 'custom' && !pj.custom) pj.custom = { ...CLIMATES.yakutsk, name: 'Своё место' }; }
  else if (t.name === 'pj-site') { pj.site = t.value; pj.foundation = null; }
  else if (t.id === 'pj-nogeo') { pj.noGeo = t.checked; pj.foundation = null; }
  else if (t.dataset.quiz) { pj.quiz = { ...pj.quiz, [t.dataset.quiz]: t.value }; pj.foundation = null; }
  else if (t.dataset.geo) {
    const k = t.dataset.geo;
    pj.geo = { ...pj.geo, [k]: t.type === 'checkbox' ? t.checked : k === 'frost' || k === 'water' ? t.value.replace(',', '.') : t.value || null };
    pj.foundation = null;
  }
  else if (t.id === 'pj-ceil') pj.ceiling = Number(t.value);
  else if (t.id === 'pj-pitch') pj.pitch = Number(t.value);
  else if (t.id === 'pj-ovh') pj.overhang = Number(t.value);
  else if (t.dataset.cl) {
    const k = t.dataset.cl;
    pj.custom = { ...(pj.custom || {}), [k]: ['name', 'zone'].includes(k) ? t.value : Number(t.value.replace(',', '.')) };
  } else return;
  save();
  renderDesign();
});
$('design').addEventListener('click', (e) => {
  const fb = e.target.closest('[data-found]');
  if (fb) {
    state.project.foundation = fb.dataset.found;
    save();
    renderDesign();
    return;
  }
  const b = e.target.closest('[data-mat]');
  if (b) {
    state.project.material = b.dataset.mat;
    save();
    renderDesign();
  }
  if (e.target.closest('#pj-pdf')) {
    document.body.classList.add('print-project');
    window.print();
  }
});
window.addEventListener('afterprint', () => document.body.classList.remove('print-project'));

// ---- Ручная правка планировки ----

let editCell = null; // {floor, cell}

const GENERIC_ROOMS = [
  { label: 'Холл', type: 'hall' },
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
  // Расположение кухни — выбором из списка (удобно на телефоне)
  const f1 = floors[0];
  const kitchenCur = Object.entries(state.overrides).find(([, r]) => r.key === 'kitchen')?.[0]?.split(':')[1] || '';
  const kRoom = Object.values({ ...f1.res.assign, ...f1.fixed }).find((r) => r.key === 'kitchen');
  const kSelect = kRoom ? `<label>Где ${kRoom.label.toLowerCase()}
      <select id="kitchen-place"><option value="">Авто (как предлагает сайт)</option>${floorCells(chart, f1.g)
        .filter((c) => f1.fixed[`${c.row}-${c.col}`]?.type !== 'entry')
        .map((c) => {
          const k = `${c.row}-${c.col}`;
          const fit = roomFit('active', c.mountain, c.water);
          return `<option value="${k}"${kitchenCur === k ? ' selected' : ''}>${dirOf(c.lo)} — водная ${c.water}, горная ${c.mountain}${dir8(c.sun) ? `, свет ${dir8(c.sun)}` : ''}${fit && FIT_WORD[fit] ? ` — ${FIT_WORD[fit]}` : ''}</option>`;
        }).join('')}</select></label>` : '';
  $('layout-editor').innerHTML = `<h3 class="sub">Изменить планировку</h3>${kSelect}${panel}${resetAll}
    <h3 class="sub">Добавить помещение</h3>
    <p class="note">Сайт сам найдёт ему сектор по звёздам: жилое — по водной звезде, спальню — по горной, мокрое — в мокрую точку.</p>
    <div class="custom-rooms">${customList}</div>
    <button type="button" class="secondary" id="custom-add">Добавить помещение</button>`;
}

$('layout-plans').addEventListener('click', (e) => {
  const hit = e.target.closest('[data-cell]');
  if (!hit || furnTool || opTool || e.target.closest('.ufurn') || furnJustDragged) return;
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
  if (e.target.id === 'kitchen-place') {
    for (const [k, r] of Object.entries(state.overrides)) if (r.key === 'kitchen') delete state.overrides[k];
    const v = e.target.value;
    if (v) {
      const lbl = state.program.kitchen ? 'Кухня-гостиная' : 'Кухня';
      state.overrides[`1:${v}`] = { key: 'kitchen', label: lbl, type: 'kitchen' };
    }
    render();
    save();
    return;
  }
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
      const bed = lastBedChoice.get(`${f.n}:${room.key}`) || bedPlacement(chart, fsAz, owner?.gua);
      text += ` Кровать изголовьем к глухой стене — не под окном и не ногами в дверь. Ногами на ${bed.toward.dir} — там водная ${bed.toward.w}${bed.toward.score ? '' : ' (благоприятной водной рядом нет)'}, изголовье на ${bed.headDir}.`;
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

const FACING_SIDE = { front: 'bottom', back: 'top', left: 'left', right: 'right' };
const isWetRoom = (r) => !!r && (r.wet || /^bath|^suitebath|^laundry/.test(r.key));
const sideToward = (a, b) => (b.row < a.row ? 'top' : b.row > a.row ? 'bottom' : b.col < a.col ? 'left' : 'right');

/**
 * Двери, проходы и окна этажа — до расстановки мебели, чтобы мебель знала, где они.
 * Каждая комната получает проход; каждая комната с наружной стеной — окно.
 */
// Сектор, поделённый между двумя помещениями: перегородка — перпендикулярно стене к общему помещению,
// чтобы у обеих половин была дверь в него
const PAIR_PREF = ['hall', 'entry', 'kitchen', 'lounge'];
function pairSplit(c, cells, all) {
  const n = cells
    .filter((o) => Math.abs(o.row - c.row) + Math.abs(o.col - c.col) === 1 && PAIR_PREF.includes(all[`${o.row}-${o.col}`]?.type))
    .sort((a, b) => PAIR_PREF.indexOf(all[`${a.row}-${a.col}`].type) - PAIR_PREF.indexOf(all[`${b.row}-${b.col}`].type))[0];
  // vertical — перегородка вертикальная (половины слева и справа)
  return { n, vertical: n ? n.col === c.col : true };
}
// Половины сектора [x, y, w, h] → [первая, вторая]
const halvesOf = ([x, y, w, h], vertical) => (vertical ? [[x, y, w / 2, h], [x + w / 2, y, w / 2, h]] : [[x, y, w, h / 2], [x, y + h / 2, w, h / 2]]);

function openingPlan(f, cells, all, rooms, auxPart) {
  const { W, D } = f.g;
  const key = (c) => `${c.row}-${c.col}`;
  const roomOf = (c) => all[key(c)];
  const adj = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  const links = [];
  const list = [...rooms.values()];
  const issues = [];
  const common = (r) => r && COMMON.includes(r.type);
  const connected = new Set(list.filter((x) => x.room.type === 'hall').map((x) => x.room.key));
  if (!connected.size && list.length) connected.add((list.find((x) => x.room.type === 'entry') || list[0]).room.key);
  /**
   * Куда можно открыть дверь из комнаты room в соседнюю target.
   * pass 0 — по правилам; pass 1 — запасной вариант; pass 2 — крайний случай.
   * Прихожая — только в общее помещение; спальни — одна дверь из общего помещения, через них не ходят;
   * мастер-спальня — из общего помещения или через свою гардеробную.
   */
  const allowed = (room, target, pass) => {
    if (target.type === 'bedroom' && !(room.key === 'suitebath' && target.key === 'master')) return false;
    // В гардеробную мастер-спальни заходят только из спальни родителей (и сама она — из общего помещения)
    if (target.key === 'suitebath' && room.key !== 'master') return false;
    if (room.type === 'entry') return ['hall', 'kitchen', 'lounge'].includes(target.type) || (pass === 2 && !isWetRoom(target));
    if (room.key === 'suitebath') return target.key === 'master' || common(target);
    if (room.key === 'master') return common(target) || (target.key === 'suitebath' && pass >= 0);
    if (room.type === 'bedroom') return common(target) || (pass === 2 && !isWetRoom(target) && target.type !== 'utility');
    if (pass === 0) return common(target) || target.type === 'office';
    if (pass === 1) return !isWetRoom(target);
    return true;
  };
  // Поделённый сектор: две двери из общего помещения, по одной в каждую половину
  for (const { room, cells: rc } of list) {
    if (!room.pair) continue;
    const c = rc[0];
    const { n, vertical } = pairSplit(c, cells, all);
    if (!n) continue;
    const doorWallVertical = n.row === c.row;
    // Вдоль стены двери: для горизонтальной стены — по x (половины слева/справа)
    if (doorWallVertical === vertical) continue;
    links.push({ a: n, b: c, kind: 'door', prefer: -1 }, { a: n, b: c, kind: 'door', prefer: 1 });
    connected.add(room.key);
  }
  for (const pass of [0, 1, 2]) {
    for (let guard = 0; guard < 12; guard++) {
      let progress = false;
      for (const { room, cells: rc } of list) {
        if (connected.has(room.key) || auxPart(room)) continue;
        // Мастер-спальню сначала пробуем открыть прямо в общее помещение
        let best = null;
        for (const c of rc) {
          for (const o of cells) {
            const r = roomOf(o);
            if (!r || r.key === room.key || auxPart(r) || !adj(c, o) || !connected.has(r.key)) continue;
            if (!allowed(room, r, pass)) continue;
            const rank = (r.type === 'hall' ? 0 : r.type === 'entry' ? 1 : common(r) ? 2 : r.key === 'suitebath' ? 2.5 : 3) + (c === rc[0] ? 0 : 0.1);
            if (!best || rank < best.rank) best = { from: o, to: c, rank, target: r };
          }
        }
        if (!best) continue;
        const open = PUBLIC.includes(room.type) && PUBLIC.includes(best.target.type) && !(room.type === 'entry' || best.target.type === 'entry');
        // Дверь из общего помещения в гардеробную мастер-спальни — в половину с гардеробной (к спальне)
        let prefer = 0;
        const sbCell = room.key === 'suitebath' ? best.to : null;
        const mCell = sbCell && list.find((x) => x.room.key === 'master')?.cells.find((o) => adj(o, sbCell));
        if (mCell) {
          const vertical = best.from.row === best.to.row;
          prefer = vertical ? Math.sign(mCell.row - sbCell.row) : Math.sign(mCell.col - sbCell.col);
        }
        links.push({ a: best.from, b: best.to, kind: open ? 'open' : 'door', prefer });
        if (pass > 0 && (room.type === 'bedroom' || room.type === 'entry')) issues.push(`${room.label}: нет выхода прямо в общее помещение — дверь через «${best.target.label}». Поменяйте помещения местами вручную.`);
        connected.add(room.key);
        progress = true;
      }
      if (!progress) break;
    }
  }
  // Ванная мастер-спальни: проходная гардеробная всегда открыта и в спальню
  const sb = list.find((x) => x.room.key === 'suitebath');
  const ms = list.find((x) => x.room.key === 'master');
  if (sb && ms && !links.some((l) => [roomOf(l.a)?.key, roomOf(l.b)?.key].sort().join() === 'master,suitebath')) {
    const pair = sb.cells.flatMap((c) => ms.cells.filter((o) => adj(c, o)).map((o) => [o, c]))[0];
    if (pair) links.push({ a: pair[0], b: pair[1], kind: 'door' });
  }
  for (const { room } of list) if (!connected.has(room.key) && !auxPart(room)) issues.push(`${room.label}: нет прохода — поменяйте помещения местами вручную.`);
  const aux = list.filter(({ room }) => auxPart(room)).map(({ room, cells: rc }) => ({ room, cell: rc[0] }));

  // Окна
  const segs = outline(f.g.dec);
  const eps = 1e-6;
  const segsOf = (c) => {
    const xA = (c.col * W) / 3;
    const xB = ((c.col + 1) * W) / 3;
    const yA = ((2 - c.row) * D) / 3;
    const yB = ((3 - c.row) * D) / 3;
    return segs
      .map((sg) => {
        const x1 = Math.max(Math.min(sg.x1, sg.x2), xA);
        const x2 = Math.min(Math.max(sg.x1, sg.x2), xB);
        const y1 = Math.max(Math.min(sg.y1, sg.y2), yA);
        const y2 = Math.min(Math.max(sg.y1, sg.y2), yB);
        if (x2 < x1 - eps || y2 < y1 - eps) return null;
        return { c, x1, x2, y1, y2, facing: sg.facing, len: Math.hypot(x2 - x1, y2 - y1) };
      })
      .filter((sg) => sg && sg.len > 1.2)
      // Стена с входной дверью — без окна
      .filter((sg) => !(f.door && f.doorPos === key(c) && sg.facing === f.door.side))
      .sort((a, b) => b.len - a.len);
  };
  const windows = [];
  const add = (sg, room, small) => {
    const dir = dir8(norm360(state.az + SIDE_BEARING[sg.facing]));
    const len = Math.min(small ? 0.6 : SUN_WINDOW[dir] || 1.2, sg.len - 0.6);
    windows.push({ ...sg, room: room.key, side: FACING_SIDE[sg.facing], len, mx: (sg.x1 + sg.x2) / 2, my: (sg.y1 + sg.y2) / 2, horiz: sg.facing === 'front' || sg.facing === 'back' });
  };
  for (const { room, cells: rc } of list) {
    if (['hall', 'entry'].includes(room.type)) continue;
    const cand = rc.flatMap(segsOf);
    if (!cand.length) continue;
    // Санузлы, котельная, гардеробные и кладовые — одно небольшое окно
    if (room.stripSide && !cand.some((sg) => FACING_SIDE[sg.facing] === room.stripSide)) continue;
    if (room.type === 'utility' && !room.key.startsWith('custom')) {
      add((room.stripSide && cand.find((sg) => FACING_SIDE[sg.facing] === room.stripSide)) || cand[0], room, true);
    } else if (room.type === 'kitchen') {
      // Кухня с выходом на две стороны — два окна
      const byFacing = new Map();
      for (const sg of cand) if (!byFacing.has(sg.facing) || byFacing.get(sg.facing).len < sg.len) byFacing.set(sg.facing, sg);
      const best = [...byFacing.values()].sort((a, b) => b.len - a.len).slice(0, 2);
      const perCell = new Map();
      for (const sg of cand) if (!perCell.has(key(sg.c))) perCell.set(key(sg.c), sg);
      const chosen = new Set(best);
      for (const sg of perCell.values()) if (![...chosen].some((x) => x.c === sg.c)) chosen.add(sg);
      for (const sg of chosen) add(sg, room, false);
    } else {
      const seen = new Set();
      for (const sg of cand) {
        if (seen.has(key(sg.c))) continue;
        seen.add(key(sg.c));
        add(sg, room, false);
      }
    }
  }
  return { links, aux, windows, issues };
}

function openingsSvg(f, plan, geo) {
  const { x0, y0, cw, ch, scale, pt, stripOf, furniture = [] } = geo;
  const out = [];
  const opening = (a, b, kind, prefer = 0) => {
    const vertical = a.row === b.row;
    const span = vertical ? ch : cw;
    const w = Math.min((kind === 'open' ? 1.4 : 0.8) * scale, span * 0.6);
    const clear = 0.6 * scale;
    const n = vertical ? [b.col > a.col ? 1 : -1, 0] : [0, b.row > a.row ? 1 : -1];
    const edge = vertical ? x0 + Math.max(a.col, b.col) * cw : y0 + Math.max(a.row, b.row) * ch;
    const start0 = vertical ? y0 + a.row * ch : x0 + a.col * cw;
    let best = null;
    let offsets = [0];
    for (let d = 2; d < span / 2; d += 2) offsets.push(d, -d);
    if (prefer) offsets = offsets.filter((o) => o * prefer >= w / 2 + 2).sort((p1, p2) => Math.abs(p1 - prefer * span / 4) - Math.abs(p2 - prefer * span / 4));
    for (const off of offsets) {
      const c = start0 + span / 2 + off;
      if (c - w / 2 < start0 + 2 || c + w / 2 > start0 + span - 2) continue;
      const swing = vertical ? [edge, c - w / 2, n[0] * Math.max(w, clear), w] : [c - w / 2, edge, w, n[1] * Math.max(w, clear)];
      const approach = vertical ? [edge, c - w / 2, -n[0] * clear, w] : [c - w / 2, edge, w, -n[1] * clear];
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
      const ww = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const leaf = [p1[0] + n[0] * ww, p1[1] + n[1] * ww];
      const e = [(p2[0] - p1[0]) / ww, (p2[1] - p1[1]) / ww];
      const sweep = n[0] * e[1] - n[1] * e[0] > 0 ? 1 : 0;
      out.push(`<path class="door-leaf" d="M${p1[0]} ${p1[1]} L${leaf[0]} ${leaf[1]} A${ww} ${ww} 0 0 ${sweep} ${p2[0]} ${p2[1]}"/>`);
    }
  };
  for (const l of plan.links) opening(l.a, l.b, l.kind, l.prefer);
  // Проёмы, добавленные вручную: проход в стене, простенки по краям сохраняются
  for (const op of geo.userOpenings || []) {
    const { a, b } = op;
    const vertical = a.row === b.row;
    const span = vertical ? ch : cw;
    const edge = vertical ? x0 + Math.max(a.col, b.col) * cw : y0 + Math.max(a.row, b.row) * ch;
    const start0 = vertical ? y0 + a.row * ch : x0 + a.col * cw;
    const w = Math.min(op.w * scale, span - 0.6 * scale);
    const c = start0 + Math.min(1 - (w / 2 + 0.3 * scale) / span, Math.max((w / 2 + 0.3 * scale) / span, op.pos)) * span;
    const p1 = vertical ? [edge, c - w / 2] : [c - w / 2, edge];
    const p2 = vertical ? [edge, c + w / 2] : [c + w / 2, edge];
    out.push(`<line class="door-gap" x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}"/>`);
    // Торцы простенков
    for (const p of [p1, p2]) out.push(vertical ? `<line class="op-jamb" x1="${p[0] - 3}" y1="${p[1]}" x2="${p[0] + 3}" y2="${p[1]}"/>` : `<line class="op-jamb" x1="${p[0]}" y1="${p[1] - 3}" x2="${p[0]}" y2="${p[1] + 3}"/>`);
  }
  // Небольшое подсобное — дверь из соседней комнаты в полосу у стены
  for (const { room, cell: c } of plan.aux) {
    const [sx, sy, sw, sh] = stripOf(c);
    const side = room.stripSide || outerSide(c.row, c.col);
    const w = Math.min(0.8 * scale, (side === 'top' || side === 'bottom' ? sw : sh) * 0.5);
    // Дверь у края полосы, чтобы не мешать мебели; полотно открывается в помещение
    let p1;
    let p2;
    let nrm;
    if (side === 'top' || side === 'bottom') {
      const y = side === 'top' ? sy + sh : sy;
      const x1 = sx + sw - w - 4;
      p1 = [x1, y]; p2 = [x1 + w, y]; nrm = [0, side === 'top' ? -1 : 1];
    } else {
      const x = side === 'left' ? sx + sw : sx;
      const y1 = sy + sh - w - 4;
      p1 = [x, y1]; p2 = [x, y1 + w]; nrm = [side === 'left' ? -1 : 1, 0];
    }
    out.push(`<line class="door-gap" x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}"/>`);
    if (room.frac >= 0.5 && Math.min(sw, sh) > w + 2) {
      const leaf = [p1[0] + nrm[0] * w, p1[1] + nrm[1] * w];
      const e = [(p2[0] - p1[0]) / w, (p2[1] - p1[1]) / w];
      const sweep = nrm[0] * e[1] - nrm[1] * e[0] > 0 ? 1 : 0;
      out.push(`<path class="door-leaf" d="M${p1[0]} ${p1[1]} L${leaf[0]} ${leaf[1]} A${w} ${w} 0 0 ${sweep} ${p2[0]} ${p2[1]}"/>`);
    }
  }
  for (const wdw of plan.windows) {
    const [ax, ay] = pt(wdw.horiz ? wdw.mx - wdw.len / 2 : wdw.mx, wdw.horiz ? wdw.my : wdw.my - wdw.len / 2);
    const [bx, by] = pt(wdw.horiz ? wdw.mx + wdw.len / 2 : wdw.mx, wdw.horiz ? wdw.my : wdw.my + wdw.len / 2);
    out.push(`<line class="window-gap" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`);
    for (const d of [-2, 0, 2]) {
      out.push(wdw.horiz
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
    const ar = all[`${c.row}-${c.col}`];
    const side = ar?.stripSide || outerSide(c.row, c.col);
    const d = (side === 'top' || side === 'bottom' ? h : w) * (ar?.frac ?? 0.4);
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
  const wallPairs = new Set();
  for (const c of cells) {
    const r = all[`${c.row}-${c.col}`];
    const rr = cells.find((o) => o.row === c.row && o.col === c.col + 1);
    const bb = cells.find((o) => o.row === c.row + 1 && o.col === c.col);
    if (rr && wallKey(all[`${rr.row}-${rr.col}`]) !== wallKey(r)) wallPairs.add(`${c.row}-${c.col}|${rr.row}-${rr.col}`);
    if (bb && wallKey(all[`${bb.row}-${bb.col}`]) !== wallKey(r)) wallPairs.add(`${c.row}-${c.col}|${bb.row}-${bb.col}`);
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

  // Двери и окна известны заранее — мебель ставим с их учётом
  const plan = openingPlan(f, cells, all, rooms, auxPart);
  if (!mini) lastAccessIssues.set(n, plan.issues);
  const keyOf = (c) => `${c.row}-${c.col}`;
  const doorSides = new Map();
  const winSides = new Map();
  const mark = (map, c, side) => {
    if (!map.has(keyOf(c))) map.set(keyOf(c), new Set());
    map.get(keyOf(c)).add(side);
  };
  for (const l of plan.links) { mark(doorSides, l.a, sideToward(l.a, l.b)); mark(doorSides, l.b, sideToward(l.b, l.a)); }
  if (f.door && f.doorPos) {
    const dc = cells.find((c) => keyOf(c) === f.doorPos);
    if (dc) mark(doorSides, dc, FACING_SIDE[f.door.side]);
  }
  for (const w of plan.windows) mark(winSides, w.c, w.side);
  const hasDoor = (c, side) => !!doorSides.get(keyOf(c))?.has(side);
  const hasWin = (c, side) => !!winSides.get(keyOf(c))?.has(side);
  const SIDES = ['top', 'right', 'bottom', 'left'];
  const ROT = { top: 0, right: 90, bottom: 180, left: 270 };

  // Автоматическая мебель: предметы из каталога, у стены или свободно, без наложений
  const af = [];
  const boxes = [];
  const cellRect = (c) => [x0 + c.col * cw, y0 + c.row * ch, cw, ch];
  const overlaps = (b) => boxes.some(([x, y, w, h]) => Math.min(b[0] + b[2], x + w) - Math.max(b[0], x) > 1 && Math.min(b[1] + b[3], y + h) - Math.max(b[1], y) > 1);
  const putAt = (k, cx, cy, rot, force = false) => {
    const def = FURN_BY_KEY[k];
    const vert = rot % 180 !== 0;
    const bw = (vert ? def.d : def.w) * scale;
    const bh = (vert ? def.w : def.d) * scale;
    const box = [cx - bw / 2, cy - bh / 2, bw, bh];
    if (!force && overlaps(box)) return null;
    boxes.push(box);
    // Мебель сайта с устойчивым номером: её можно взять в правку (сдвинуть, повернуть, убрать)
    const aid = `${n}:${curRoomKey}:${autoIdx++}`;
    if (!mini) autoItems.push({ aid, k, x: (cx - x0) / scale, y: D - (cy - y0) / scale, rot, box });
    if (!state.autoHidden.includes(aid)) af.push(furnSvg(def, [cx, cy], scale, rot).replace('class="ufurn"', 'class="afurn"'));
    return box;
  };
  let curRoomKey = '';
  let autoIdx = 0;
  const autoItems = [];
  // У стены side прямоугольника rect, в доле frac вдоль стены
  const wallPos = (k, rect, side, frac) => {
    const def = FURN_BY_KEY[k];
    const [rx, ry, rw, rh] = rect;
    const inset = 3;
    const w = def.w * scale;
    const d = def.d * scale;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (side === 'top' || side === 'bottom') {
      if (w > rw - 2 * inset || d > rh - 2 * inset) return null;
      return [clamp(rx + frac * rw, rx + inset + w / 2, rx + rw - inset - w / 2), side === 'top' ? ry + inset + d / 2 : ry + rh - inset - d / 2];
    }
    if (w > rh - 2 * inset || d > rw - 2 * inset) return null;
    return [side === 'left' ? rx + inset + d / 2 : rx + rw - inset - d / 2, clamp(ry + frac * rh, ry + inset + w / 2, ry + rh - inset - w / 2)];
  };
  const put = (k, rect, sides, fracs = [0.5, 0.25, 0.75]) => {
    for (const side of sides) {
      for (const fr of fracs) {
        const p = wallPos(k, rect, side, fr);
        if (!p) continue;
        const b = putAt(k, p[0], p[1], ROT[side]);
        if (b) return { box: b, side, at: p };
      }
    }
    return null;
  };
  // Свободные стены клетки: без дверей и окон, внешние — в конце
  const freeSides = (c, avoid = []) => SIDES.filter((s2) => !hasDoor(c, s2) && !hasWin(c, s2) && !avoid.includes(s2));
  const quietSides = (c, avoid = []) => SIDES.filter((s2) => !hasDoor(c, s2) && !avoid.includes(s2));
  const inward = (side, px) => ({ top: [0, px], bottom: [0, -px], left: [px, 0], right: [-px, 0] })[side];

  for (const { room, cells: rc } of rooms.values()) {
    if (mini) break;
    curRoomKey = room.key;
    autoIdx = 0;
    const c = primaryCell(room, rc);
    const rect = cellRect(c);
    if (room.key === 'suitebath') {
      // Проходная гардеробная со стороны спальни, дальше — ванная
      const mc = cells.find((o) => `${o.row}-${o.col}` === all[`${o.row}-${o.col}`]?.primary && all[`${o.row}-${o.col}`]?.key === 'master');
      const toward = mc ? sideToward(c, mc) : 'top';
      const [x, y, w, h] = rect;
      const vertical = toward === 'top' || toward === 'bottom';
      const half = vertical ? h / 2 : w / 2;
      const gRect = vertical ? [x, toward === 'top' ? y : y + h - half, w, half] : [toward === 'left' ? x : x + w - half, y, half, h];
      const bRect = vertical ? [x, toward === 'top' ? y + half : y, w, half] : [toward === 'left' ? x + half : x, y, half, h];
      const sideWalls = vertical ? ['left', 'right'] : ['top', 'bottom'];
      for (const sw of sideWalls) put('wardrobe', gRect, [sw], [0.5]) || put('shelf', gRect, [sw], [0.5]);
      // Перегородка между гардеробной и ванной — с дверным проёмом 0,8 м по середине
      const gap = Math.min(0.8 * scale, (vertical ? w : h) * 0.4);
      if (vertical) {
        const yy = toward === 'top' ? y + half : y + h - half;
        parts.push(`<line class="plan-wall" stroke-width="1" x1="${x}" y1="${yy}" x2="${x + w / 2 - gap / 2}" y2="${yy}"/>`, `<line class="plan-wall" stroke-width="1" x1="${x + w / 2 + gap / 2}" y1="${yy}" x2="${x + w}" y2="${yy}"/>`);
      } else {
        const xx = toward === 'left' ? x + half : x + w - half;
        parts.push(`<line class="plan-wall" stroke-width="1" x1="${xx}" y1="${y}" x2="${xx}" y2="${y + h / 2 - gap / 2}"/>`, `<line class="plan-wall" stroke-width="1" x1="${xx}" y1="${y + h / 2 + gap / 2}" x2="${xx}" y2="${y + h}"/>`);
      }
      boxes.push(vertical ? [x + w / 2 - gap / 2, (toward === 'top' ? y + half : y + h - half) - 0.5 * scale, gap, scale] : [(toward === 'left' ? x + half : x + w - half) - 0.5 * scale, y + h / 2 - gap / 2, scale, gap]);
      const far = OPPOSITE[toward];
      put('bath', bRect, [far, ...sideWalls]);
      put('toilet', bRect, sideWalls, [0.8, 0.2]);
      put('sink', bRect, sideWalls, [0.3, 0.7]);
    } else if (room.type === 'bedroom') {
      const owner = bedroomOwner(room, adults, children);
      const kid = room.key.startsWith('kid');
      const opts = bedOptions(chart, fsAz, owner?.gua);
      // Кровать: не под окном, не ногами в дверь; изголовье — к глухой стене
      const penalty = (o) => (hasWin(c, o.head) ? 100 : 0) + (hasDoor(c, o.feet) ? 100 : 0) + (hasDoor(c, o.head) ? 30 : 0) + (hasWin(c, o.feet) ? 5 : 0);
      const choice = [...opts].sort((a, b) => penalty(a) - penalty(b) || b.score - a.score)[0];
      lastBedChoice.set(`${n}:${room.key}`, choice);
      const minSide = Math.min(cw, ch) / scale;
      const bedKey = kid ? 'bed90' : minSide >= 3.6 ? 'bed180' : 'bed160';
      const bed = put(bedKey, rect, [choice.head], kid ? [0.25, 0.75, 0.5] : [0.5, 0.4, 0.6]);
      if (bed && !kid) {
        // Тумбочки по обе стороны кровати
        const bw = FURN_BY_KEY[bedKey].w * scale;
        const [bx, by] = bed.at;
        const horiz = choice.head === 'top' || choice.head === 'bottom';
        const nd = FURN_BY_KEY.nightstand;
        const off = bw / 2 + (nd.w * scale) / 2 + 3;
        const ny = horiz ? (choice.head === 'top' ? rect[1] + 3 + (nd.d * scale) / 2 : rect[1] + rect[3] - 3 - (nd.d * scale) / 2) : null;
        const nx = !horiz ? (choice.head === 'left' ? rect[0] + 3 + (nd.d * scale) / 2 : rect[0] + rect[2] - 3 - (nd.d * scale) / 2) : null;
        for (const sgn of [-1, 1]) putAt('nightstand', horiz ? bx + sgn * off : nx, horiz ? ny : by + sgn * off, ROT[choice.head]);
      }
      // Шкаф — к глухой стене; стол — у окна (днём свет слева или спереди)
      put(kid ? 'kidWardrobe' : 'wardrobe', rect, [...freeSides(c, [choice.head]), ...quietSides(c, [choice.head])], [0.8, 0.2, 0.5]);
      if (kid || room.work) {
        const winWalls = SIDES.filter((s2) => hasWin(c, s2) && s2 !== choice.head);
        const desk = put('desk', rect, [...winWalls, ...quietSides(c, [choice.head])], [0.5, 0.3, 0.7]);
        if (desk) { const [ix, iy] = inward(desk.side, (FURN_BY_KEY.desk.d / 2 + 0.3) * scale); putAt('kidChair', desk.at[0] + ix, desk.at[1] + iy, ROT[OPPOSITE[desk.side]]); }
      }
      if (room.suite) put('vanity', rect, quietSides(c, [choice.head]), [0.5, 0.2, 0.8]);
    } else if (room.type === 'entry') {
      // Прихожая: большой шкаф для верхней одежды у глухой стены, банкетка рядом
      // Только к настоящей стене: не туда, где прихожая продолжается в соседний сектор
      const DIRS = { top: [-1, 0], bottom: [1, 0], left: [0, -1], right: [0, 1] };
      const solid = (sd) => {
        const n = cells.find((o) => o.row === c.row + DIRS[sd][0] && o.col === c.col + DIRS[sd][1]);
        const nr = n && all[`${n.row}-${n.col}`];
        return !nr || (nr.key !== room.key && nr.sharedWith !== room.key);
      };
      const ok = (list) => list.filter(solid);
      // Части соседних секторов, которые отошли прихожей (рядом с половинным санузлом или подсобным)
      const remainders = [...rooms.values()].filter((o) => o.room.sharedWith === room.key && o.room.stripSide).map((o) => {
        const oc = o.cells[0];
        const [rx, ry, rw, rh] = cellRect(oc);
        const [sx, sy, sw, sh] = stripOf(oc);
        const side = o.room.stripSide;
        const rr = side === 'left' ? [sx + sw, ry, rw - sw, rh] : side === 'right' ? [rx, ry, rw - sw, rh] : side === 'top' ? [rx, sy + sh, rw, rh - sh] : [rx, ry, rw, rh - sh];
        const outer = SIDES.filter((sd) => sd !== side && sd !== OPPOSITE[side] && ((sd === 'top' && oc.row === 0) || (sd === 'bottom' && oc.row === 2) || (sd === 'left' && oc.col === 0) || (sd === 'right' && oc.col === 2)));
        return { rr, sides: outer.filter((sd) => !hasDoor(oc, sd)) };
      });
      let wr = put('entryWardrobe', rect, [...ok(freeSides(c)), ...ok(quietSides(c))], [0.5, 0.25, 0.75]);
      for (const rm of remainders) if (!wr) wr = put('entryWardrobe', rm.rr, rm.sides, [0.5]) || put('wardrobe', rm.rr, rm.sides, [0.5]);
      if (!wr) wr = put('wardrobe', rect, [...ok(quietSides(c)), ...quietSides(c)], [0.5, 0.25, 0.75]);
      put('bench', rect, ok(quietSides(c, wr ? [wr.side] : [])), [0.5, 0.3, 0.7]);
    } else if (room.type === 'kitchen') {
      const z = kitchenZones(room, rc);
      const st = z.kitchen;
      const sRect = cellRect(st);
      const wall = stovePlacement(chart, fsAz, st).wall;
      const walls = [wall, ...quietSides(st, [wall])];
      const counter = put('kCabinets', sRect, walls, [0.5, 0.35, 0.65]);
      if (counter) {
        // Плита — в середине столешницы, холодильник — с краю
        putAt('stove', counter.at[0], counter.at[1], ROT[counter.side], true);
        put('fridge', sRect, [counter.side], [0.04, 0.96]) || put('fridge', sRect, quietSides(st, [counter.side]), [0.1, 0.9]);
      }
      const liv = z.living;
      const lRect = cellRect(liv);
      // Обеденная группа — в центре кухонной зоны (или ближе к гостиной)
      const [tx, ty] = liv !== st ? [(sRect[0] + sRect[2] / 2 + lRect[0] + lRect[2] / 2) / 2, (sRect[1] + sRect[3] / 2 + lRect[1] + lRect[3] / 2) / 2] : [sRect[0] + sRect[2] / 2, sRect[1] + sRect[3] / 2 + (counter && counter.side === 'top' ? 0.4 * scale : counter && counter.side === 'bottom' ? -0.4 * scale : 0)];
      const tableKey = liv !== st ? 'bigTable' : 'diningTable';
      if (putAt(tableKey, tx, ty, 0)) {
        const td = FURN_BY_KEY[tableKey];
        const cdx = (td.w / 4) * scale;
        for (const sgn of [-1, 1]) for (const k2 of liv !== st ? [-1, 1] : [0]) {
          putAt('chair', tx + k2 * cdx, ty + sgn * ((td.d / 2 + 0.3) * scale), sgn < 0 ? 0 : 180);
        }
      }
      if (liv !== st) {
        // Гостиная: диван у глухой стены, напротив — телевизор
        const sofa = put('sofa3', lRect, [...freeSides(liv), ...quietSides(liv)], [0.5, 0.4, 0.6]);
        if (sofa) {
          const opp = OPPOSITE[sofa.side];
          put('tvStand', lRect, [opp], [0.5, 0.4, 0.6]) && put('tv', lRect, [opp], [0.5, 0.4, 0.6]);
          const [ix, iy] = inward(sofa.side, (FURN_BY_KEY.sofa3.d + 0.6) * scale);
          putAt('coffee', sofa.at[0] + ix, sofa.at[1] + iy, ROT[sofa.side]);
          put('armchair', lRect, quietSides(liv, [sofa.side, opp]), [0.3, 0.7]);
        }
      }
    } else if (room.type === 'lounge' || room.type === 'extra') {
      const sofa = put('sofa3', rect, [...freeSides(c), ...quietSides(c)], [0.5, 0.4, 0.6]);
      if (sofa) {
        put('tvStand', rect, [OPPOSITE[sofa.side]], [0.5]) && put('tv', rect, [OPPOSITE[sofa.side]], [0.5]);
        const [ix, iy] = inward(sofa.side, (FURN_BY_KEY.sofa3.d + 0.6) * scale);
        putAt('coffee', sofa.at[0] + ix, sofa.at[1] + iy, ROT[sofa.side]);
      }
    } else if (room.type === 'office') {
      const face = deskPlacement(chart, fsAz, adults[0]?.gua).face;
      const desk = put('desk', rect, [face, ...quietSides(c, [face])], [0.5, 0.3, 0.7]);
      if (desk) { const [ix, iy] = inward(desk.side, (FURN_BY_KEY.desk.d / 2 + 0.3) * scale); putAt('kidChair', desk.at[0] + ix, desk.at[1] + iy, ROT[OPPOSITE[desk.side]]); }
      put('shelf', rect, [...freeSides(c, desk ? [desk.side] : []), ...quietSides(c)], [0.5, 0.2, 0.8]);
    } else if (room.pair) {
      const { vertical } = pairSplit(c, cells, all);
      const [x, y, w, h] = rect;
      parts.push(vertical
        ? `<line class="plan-wall" stroke-width="1.5" x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}"/>`
        : `<line class="plan-wall" stroke-width="1.5" x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}"/>`);
      halvesOf(rect, vertical).forEach((hr, i) => {
        const sub = room.pair[i];
        const walls = SIDES.filter((sd) => !hasDoor(c, sd));
        if (sub.wet && /laundry/.test(sub.key)) { put('washer', hr, walls, [0.3, 0.7]); put('washer', hr, walls, [0.7, 0.3]); }
        else if (sub.wet) {
          put('bath', hr, walls, [0.5, 0.3, 0.7]) || put('shelf', hr, [], []);
          put('toilet', hr, walls, [0.8, 0.2, 0.5]);
          put('sink', hr, walls, [0.3, 0.7, 0.5]);
        } else if (sub.key === 'boiler') put('boiler', hr, walls, [0.5, 0.3]);
        else put('shelf', hr, walls, [0.5, 0.3, 0.7]);
      });
    } else if (room.type === 'utility') {
      const aux = auxPart(room);
      const uRect = aux ? stripOf(c) : rect;
      if (room.key.startsWith('bath') || isWetRoom(room) && !/laundry/.test(room.key)) {
        put('bath', uRect, [...quietSides(c), ...SIDES], [0.5, 0.3, 0.7]);
        put('toilet', uRect, quietSides(c), [0.8, 0.2, 0.5]);
        put('sink', uRect, quietSides(c), [0.3, 0.7, 0.5]);
        if (room.key === 'bath0' || /laundry/.test(room.key)) put('washer', uRect, quietSides(c), [0.15, 0.85]);
      } else if (/laundry/.test(room.key)) {
        put('washer', uRect, quietSides(c), [0.2, 0.5]);
        put('washer', uRect, quietSides(c), [0.5, 0.8]);
        put('sink', uRect, quietSides(c), [0.8, 0.5]);
      } else if (room.key === 'boiler') {
        put('boiler', uRect, [...freeSides(c), ...quietSides(c)], [0.5, 0.3]);
      } else if (aux) {
        put('shelf', uRect, [outerSide(c.row, c.col)], [0.5, 0.25, 0.75]);
      } else {
        // Гардеробная, кладовая — стеллажи и шкафы вдоль глухих стен
        const first = put('wardrobe', uRect, [...freeSides(c), ...quietSides(c)], [0.5]);
        put('shelf', uRect, [...freeSides(c, first ? [first.side] : []), ...quietSides(c, first ? [first.side] : [])], [0.5]);
      }
    }
  }
  if (!mini) lastAutoItems.set(n, autoItems);
  if (af.length) parts.push(`<!--af--><g class="auto-furn">${af.join('')}</g><!--/af-->`);

  // Где стоит мебель — чтобы двери не попадали на неё
  const furniture = boxes;
  if (!mini) parts.push(openingsSvg(f, plan, { x0, y0, cw, ch, scale, pt, stripOf, furniture, userOpenings: state.openings.filter((o) => o.f === n && wallPairs.has(`${o.a.row}-${o.a.col}|${o.b.row}-${o.b.col}`)) }));
  if (!mini) lastWallPairs.set(n, wallPairs);

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
    if (room.pair) {
      const { vertical } = pairSplit(rc[0], cells, all);
      halvesOf([x0 + rc[0].col * cw, y0 + rc[0].row * ch, cw, ch], vertical).forEach(([hx, hy, hw, hh], i) => {
        const ws = room.pair[i].label.split(/\s+/);
        ws.forEach((w, k) => parts.push(`<text class="room-name" x="${hx + hw / 2}" y="${hy + hh / 2 + 8 - ((ws.length - 1) * fs) / 2 + k * fs}" font-size="${fs * 0.9}" text-anchor="middle">${w}</text>`));
      });
      continue;
    }
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
      if (!r || r.type === 'entry' || f.fixed[k]?.type === 'entry') continue;
      const sel = editCell && editCell.floor === n && editCell.cell === k ? ' selected' : '';
      const tip = `${dirOf(c.lo)}: горная ${c.mountain} — ${starMeaning(c.mountain, chart.period)}; водная ${c.water} — ${starMeaning(c.water, chart.period)}. Нажмите, чтобы изменить помещение.`;
      parts.push(`<rect class="cell-hit${sel}" data-floor="${n}" data-cell="${k}" x="${x0 + c.col * cw}" y="${y0 + c.row * ch}" width="${cw}" height="${ch}"><title>${tip}</title></rect>`);
    }
  }
  // Мебель клиента — поверх всего, чтобы её можно было перетаскивать
  if (!mini) {
    for (const u of state.furniture.filter((x) => x.f === n)) {
      const def = FURN_BY_KEY[u.t];
      if (def) parts.push(furnSvg(def, pt(u.x, u.y), scale, u.rot, `data-fid="${u.id}"`).replace('class="ufurn"', `class="ufurn${furnSel === u.id ? ' sel' : ''}"`));
    }
  }
  return `<svg class="plan${state.autoFurn ? '' : ' no-auto'}" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}" role="img" aria-label="Планировка ${title || 'дома'}" data-floor="${n}" data-x0="${x0}" data-y0="${y0}" data-scale="${scale}" data-w="${W}" data-d="${D}">${parts.join('')}</svg>`;
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


// ---- Конструктор участка: дом, постройки, солнце, тени и растения ----

const yard = state.yard;
let yardTool = null; // растение, которое сажаем нажатием на план
let yardSel = null; // выбранный объект: 'house' или id
let lightFilter = 'all';
let hoursCache = { key: '', grid: null, plants: null };
let playTimer = null;

const DATES = [['03-21', 'Весна, 21 марта'], ['06-21', 'Лето, 21 июня'], ['08-15', 'Август'], ['09-23', 'Осень, 23 сентября'], ['12-21', 'Зима, 21 декабря']];
const YEAR = new Date().getFullYear();
const yardTz = () => yard.tz ?? tzGuess(state.center[1]);
const hhmm = (t) => {
  const m = Math.round(t * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const nextId = () => `o${yard.seq++}`;
const yFmt = (n) => fmt(n, Number.isInteger(n) ? 0 : 1);
const objById = (id) => (id === 'house' ? yard.house : yard.items.find((i) => i.id === id) || yard.plants.find((p) => p.id === id));

function sunNow() {
  return sunPosition(localToUtc(YEAR, yard.date, yard.time, yardTz()), state.center[0], state.center[1]);
}

function yardHours() {
  const opts = { year: YEAR, lat: state.center[0], lng: state.center[1], tz: yardTz(), cell: Math.max(1, Math.ceil(Math.max(yard.plot.w, yard.plot.d) / 60)) };
  const key = JSON.stringify([yard.plot, yard.house, yard.items, yard.plants, yard.date, opts]);
  if (hoursCache.key !== key) {
    hoursCache = {
      key,
      grid: sunHours(yard, opts),
      plants: sunHours(yard, opts, yard.plants.map((p) => ({ pt: [p.x, p.y], skip: p.id }))),
      woody: sunHours(yard, { ...opts, noPlants: true }, yard.plants.map((p) => ({ pt: [p.x, p.y], skip: p.id }))),
    };
  }
  return hoursCache;
}

function renderYardControls() {
  const h = yard.house;
  $('y-shape').innerHTML = Object.entries(HOUSE_SHAPES).map(([k, v]) => `<button type="button" class="chip" data-shape="${k}" aria-pressed="${h.shape === k}">${v}</button>`).join('');
  $('y-hd-wrap').hidden = h.shape === 'square';
  $('y-cut').hidden = h.shape !== 'L';
  for (const [id, v] of [['y-hw', h.w], ['y-hd', h.d], ['y-hcw', h.cw], ['y-hcd', h.cd], ['y-hh', h.h], ['y-hrot', h.rot], ['y-pw', yard.plot.w], ['y-pd', yard.plot.d], ['y-prot', yard.plot.rot]]) {
    if (document.activeElement !== $(id)) $(id).value = v;
  }
  const PLOTS = [[20, 30], [25, 40], [30, 50], [40, 50]];
  $('y-plot-presets').innerHTML = PLOTS.map(([w, d]) => `<button type="button" class="chip" data-plot="${w}x${d}" aria-pressed="${yard.plot.w === w && yard.plot.d === d}">${w * d / 100} соток <small>${w}×${d}</small></button>`).join('');
  const area = yard.plot.w * yard.plot.d;
  $('y-area').textContent = `Площадь: ${yFmt(Math.round(area / 10) / 10)} соток (${Math.round(area)} м²).`;
  $('y-buildings').innerHTML = BUILDINGS.filter((b) => !b.hidden).map((b) => `<button type="button" class="chip" data-add="${b.key}"><span class="dot" style="background:${b.color}"></span>${b.label}${b.flat ? '' : ` <small>${yFmt(b.w)}×${yFmt(b.d)}</small>`}</button>`).join('');
  const tz = yardTz();
  $('y-tz').innerHTML = Array.from({ length: 15 }, (_, i) => i - 1).map((v) => `<option value="${v}"${v === tz ? ' selected' : ''}>UTC${v >= 0 ? '+' : '−'}${Math.abs(v)}</option>`).join('');
  $('y-place').textContent = `Место: ${fmt(state.center[0], 2)}° с. ш., ${fmt(state.center[1], 2)}° в. д. — берётся с карты на вкладке расчёта.`;
  $('y-dates').innerHTML = DATES.map(([d, l]) => `<button type="button" class="chip" data-date="${d}" aria-pressed="${yard.date === d}">${l}</button>`).join('');
  for (const b of document.querySelectorAll('#y-view [data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === yard.view));
  $('y-golden').setAttribute('aria-pressed', String(!!yard.golden));
  $('y-group').innerHTML = [1, 3, 5, 8].map((n) => `<button type="button" class="chip" data-group="${n}" aria-pressed="${yard.group === n}">${n === 1 ? 'по одному' : n}</button>`).join('');
  for (const b of document.querySelectorAll('#y-light-filter [data-light]')) b.setAttribute('aria-pressed', String(b.dataset.light === lightFilter));
  const soil = yard.soil;
  const chipRow = (id, dict, key) => {
    $(id).innerHTML = Object.entries(dict).map(([k, v]) => `<button type="button" class="chip" data-soil="${key}" data-v="${k}" aria-pressed="${soil.known !== false && soil[key] === k}">${v}</button>`).join('');
  };
  chipRow('y-soil-ph', SOIL_PH, 'ph');
  chipRow('y-soil-texture', SOIL_TEXTURE, 'texture');
  chipRow('y-soil-water', SOIL_WATER, 'water');
  $('y-soil-unknown').checked = soil.known === false;
  $('y-soil-help').innerHTML = soil.known === false
    ? `<div class="soil-help msg mixed"><strong>Подбираем растения только по солнцу и тени.</strong> Как узнать почву:<ol>${SOIL_TESTS.map(([t, d]) => `<li><b>${t}.</b> ${d}</li>`).join('')}</ol></div>`
    : soil.known === null
      ? '<p class="msg mixed">Начните с почвы: отметьте кислотность, состав и влажность или поставьте галочку «не знаю».</p>'
      : `<details class="soil-help"><summary>Как проверить почву</summary><ol>${SOIL_TESTS.map(([t, d]) => `<li><b>${t}.</b> ${d}</li>`).join('')}</ol></details>`;
  const clim = yardClimate();
  $('y-climate').innerHTML = Object.entries(CLIMATE).map(([k, v]) => `<option value="${k}"${k === clim ? ' selected' : ''}>${v}</option>`).join('');
  $('y-door').value = yard.house.door || 'front';
  $('y-winds').innerHTML = WIND_DIRS.map((w) => `<button type="button" class="chip" data-wind="${w}" aria-pressed="${yard.winds.includes(w)}">${w}</button>`).join('');
  $('y-comp-kinds').innerHTML = [...TEMPLATE_KEYS, 'windbreak'].map((k) => `<button type="button" class="chip" data-comp="${k}" aria-pressed="${yard.comps.includes(k)}">${k === 'windbreak' ? 'Ветрозащита' : TEMPLATES[k].title}</button>`).join('');
  if (!$('y-presets').childElementCount) {
    $('y-presets').innerHTML = PRESET_KEYS.map((k) => {
      const pr = PRESETS[k];
      return `<button type="button" class="preset" data-preset="${k}"><span class="preset-pic">${elevationSvg(presetRows(k), pr.title)}</span>`
        + `<span class="preset-side">${pr.side} · ${LIGHT_TEXT[pr.want]}</span><b>${pr.title}</b><span class="preset-add">＋ Вставить</span></button>`;
    }).join('');
  }
  $('y-scenarios').innerHTML = Object.entries(SCENARIOS).map(([k, v]) => `<button type="button" class="chip" data-scn="${k}" aria-pressed="${yard.scenario === k}">${v.title}</button>`).join('');
  renderPlantPalette();
}

const yardClimate = () => yard.climate || climateGuess(state.center[0]);
const soilNow = () => (yard.soil.known ? yard.soil : { known: false });

// Ряды клумбы: предложенная композиция или зоны А и Б
function bedRows(it) {
  return it.rows || [];
}

// Название и описание композиции: готовая или подобранная автоматически
function compInfo(it) {
  if (it.preset) return PRESETS[it.preset];
  if (it.kind) return TEMPLATES[it.kind];
  return { title: BUILDING_BY_KEY[it.t].label, about: '' };
}

function renderPlantPalette() {
  const ok = (p) => lightFilter === 'all' || p.light.includes(lightFilter);
  $('y-plants').innerHTML = PLANT_GROUPS.map(([g, title]) => {
    const list = PLANTS.filter((p) => (g === 'top' ? p.top : !p.top && p.group === g) && ok(p)).sort((a, b) => (a.top || 0) - (b.top || 0));
    if (!list.length) return '';
    return `<p class="chip-group">${title}</p><div class="chips">${list.map((p) => `<button type="button" class="chip plant-chip" data-plant="${p.key}" aria-pressed="${yardTool === p.key}" title="${p.light.map((l) => LIGHT_TEXT[l]).join(', ')}"><span class="dot" style="background:${p.color}"></span>${p.top ? `<b>${p.top}</b> ` : ''}${p.name}<small>${p.light.map((l) => LIGHT_ICON[l]).join('')}</small></button>`).join('')}</div>`;
  }).join('');
}

const LIGHT_ICON = { sun: '☀', part: '◐', shade: '●' };
const HOURS_COLOR = { sun: '#f2c94c', part: '#9fb87a', shade: '#3f5a5a' };

function drawClock(t) {
  const m = (t % 12) * 30;
  const mm = ((t * 60) % 60) * 6;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = rad(i * 30);
    return `<line x1="${50 + 40 * Math.sin(a)}" y1="${50 - 40 * Math.cos(a)}" x2="${50 + (i % 3 ? 36 : 32) * Math.sin(a)}" y2="${50 - (i % 3 ? 36 : 32) * Math.cos(a)}"/>`;
  }).join('');
  const day = t >= 6 && t < 18;
  return `<svg viewBox="0 0 100 100"><circle class="clock-face" cx="50" cy="50" r="46"/><g class="clock-ticks">${ticks}</g>`
    + `<text class="clock-sym" x="50" y="70" text-anchor="middle">${day ? '☀' : '☾'}</text>`
    + `<line class="clock-h" x1="50" y1="50" x2="${50 + 22 * Math.sin(rad(m))}" y2="${50 - 22 * Math.cos(rad(m))}"/>`
    + `<line class="clock-m" x1="50" y1="50" x2="${50 + 33 * Math.sin(rad(mm))}" y2="${50 - 33 * Math.cos(rad(mm))}"/><circle cx="50" cy="50" r="3" class="clock-pin"/></svg>`;
}

function renderYardPlan() {
  const { w: W, d: D, rot: prot } = yard.plot;
  const M = Math.max(4, Math.max(W, D) * 0.08);
  const Y = (y) => D - y;
  const pts = (poly) => poly.map(([x, y]) => `${x.toFixed(2)},${Y(y).toFixed(2)}`).join(' ');
  const fs = Math.max(W, D) / 40;
  const sun = sunNow();
  const day = sunDay(YEAR, yard.date, state.center[0], state.center[1], yardTz());
  const hours = yardHours();
  const parts = [];

  // Участок и сетка через 5 м
  parts.push(`<rect class="y-plot" x="0" y="0" width="${W}" height="${D}"/>`);
  for (let x = 5; x < W; x += 5) parts.push(`<line class="y-grid" x1="${x}" y1="0" x2="${x}" y2="${D}"/>`);
  for (let y = 5; y < D; y += 5) parts.push(`<line class="y-grid" x1="0" y1="${Y(y)}" x2="${W}" y2="${Y(y)}"/>`);

  // Карта солнечных часов или тени в выбранное время
  if (yard.view === 'hours') {
    const c = hours.grid.cell;
    const max = hours.grid.maxHours;
    const solid = [houseOutline(yard.house), ...yard.items.filter((i) => !BUILDING_BY_KEY[i.t].flat).map((i) => rectPoly(i))];
    const open = hours.grid.grid.filter((g) => !solid.some((poly) => inPoly(poly, [g.x, g.y])));
    parts.push(`<g class="y-hours">${open.map((g) => `<rect x="${g.x - c / 2}" y="${Y(g.y) - c / 2}" width="${c + 0.02}" height="${c + 0.02}" fill="${HOURS_COLOR[lightZone(g.hours, max)]}" opacity="${0.35 + 0.45 * Math.min(1, g.hours / Math.max(1, max))}"/>`).join('')}</g>`);
  } else if (sun.alt > 0) {
    const sh = shadowsAt(yard, sun);
    parts.push(`<g class="y-shadows">${sh.filter((c) => !c.glass).map((c) => `<polygon points="${pts(c.shadow)}"/>`).join('')}</g>`);
    parts.push(`<g class="y-shadows glass">${sh.filter((c) => c.glass).map((c) => `<polygon points="${pts(c.shadow)}"/>`).join('')}</g>`);
  } else {
    parts.push(`<rect class="y-night" x="0" y="0" width="${W}" height="${D}"/>`);
  }

  // Золотое сечение: линии, точки пересечения и спираль
  if (yard.golden) {
    const gg = goldenGrid(yard.plot);
    const arcs = goldenSpiral(yard.plot);
    const corner = ([x, y, sz], k) => [[x + sz, y], [x, y], [x, y + sz], [x + sz, y + sz]][k];
    // Центр дуги: 0 — правый нижний угол, 1 — левый нижний, 2 — левый верхний, 3 — правый верхний
    const from = { 0: 1, 1: 2, 2: 3, 3: 0 };
    const to = { 0: 3, 1: 0, 2: 1, 3: 2 };
    const pt = (sq, k) => { const [x, y] = corner(sq, k); return `${x.toFixed(2)} ${Y(y).toFixed(2)}`; };
    const pathD = arcs.map(({ sq, dir }, i) => `${i ? '' : `M${pt(sq, from[dir])} `}A${sq[2].toFixed(2)} ${sq[2].toFixed(2)} 0 0 1 ${pt(sq, to[dir])}`).join(' ');
    parts.push(`<g class="y-gold">${gg.xs.map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="${D}"/>`).join('')}${gg.ys.map((y) => `<line x1="0" y1="${Y(y)}" x2="${W}" y2="${Y(y)}"/>`).join('')}`
      + `${arcs.map(({ sq }) => `<rect x="${sq[0]}" y="${Y(sq[1] + sq[2])}" width="${sq[2]}" height="${sq[2]}"/>`).join('')}<path d="${pathD}"/>`
      + '</g>');
  }

  // Плоские объекты, постройки, дом
  const flat = yard.items.filter((i) => BUILDING_BY_KEY[i.t].flat);
  const solid = yard.items.filter((i) => !BUILDING_BY_KEY[i.t].flat);
  const itemSvg = (it) => {
    const b = BUILDING_BY_KEY[it.t];
    const poly = rectPoly(it);
    const short = b.bed ? (compInfo(it).short || compInfo(it).title) : b.label;
    const dots = b.bed ? bedLayout(it, bedRows(it)).map((d) => `<circle class="y-comp-dot" cx="${d.x}" cy="${Y(d.y)}" r="${Math.min(0.35, Math.min(it.w, it.d) / 8)}" fill="${PLANT_BY_KEY[d.key].color}"/>`).join('') : '';
    const fireRing = b.fire ? `<circle cx="${it.x}" cy="${Y(it.y)}" r="${Math.min(it.w, it.d) * 0.18}" fill="#c0633a" opacity="0.8"/>` : '';
    return `<g class="y-obj${yardSel === it.id ? ' sel' : ''}${b.flat ? ' flat' : ''}${b.glass ? ' glass' : ''}" data-id="${it.id}"><polygon points="${pts(poly)}" fill="${b.color}"/>${dots}${fireRing}`
      + (Math.min(it.w, it.d) < 1.5 ? '' : `<text x="${it.x}" y="${Y(it.y) + fs * 0.35}" font-size="${Math.min(fs * (b.bed ? 0.75 : 1.1), Math.min(it.w, it.d) * 0.45, (Math.max(it.w, it.d) * 1.7) / short.length)}" text-anchor="middle"${b.bed && ((Math.abs(it.rot || 0) % 180 === 90) !== (it.d > it.w)) ? ` transform="rotate(-90 ${it.x} ${Y(it.y)})"` : ''}>${short}</text>`)
      + `<title>${b.label}: ${yFmt(it.w)} × ${yFmt(it.d)} м</title></g>`;
  };
  parts.push(flat.map(itemSvg).join(''));
  const h = yard.house;
  parts.push(`<g class="y-obj y-house${yardSel === 'house' ? ' sel' : ''}" data-id="house"><polygon points="${pts(houseOutline(h))}"/>`
    + `<polyline class="y-facade" points="${pts(houseFacade(h))}"/>`
    + `<text x="${h.x}" y="${Y(h.y) + fs * 0.4}" font-size="${fs * 1.3}" text-anchor="middle">Дом</text>`
    + (() => { const dp = doorPlace(h); return `<circle class="y-door" cx="${dp.p[0]}" cy="${Y(dp.p[1])}" r="${fs * 0.45}"><title>Входная дверь</title></circle>`; })() + '</g>');
  parts.push(solid.map(itemSvg).join(''));

  // Растения
  const checks = new Map();
  yard.plants.forEach((p, i) => {
    const pl = PLANT_BY_KEY[p.t];
    const woody = pl.group === 'tree' || pl.group === 'shrub' || pl.group === 'fruit';
    const ph = woody ? hours.woody : hours.plants;
    const res = checkPlant(p, yard, ph.hours[i], ph.maxHours);
    const sf = soilFit(pl, soilNow(), yardClimate());
    if (sf.level === 'bad' || (sf.level === 'mixed' && res.level === 'good')) res.level = sf.level;
    res.notes.push(...sf.notes);
    res.fixes = sf.fixes;
    checks.set(p.id, { ...res, hours: ph.hours[i] });
    const r = Math.max(pl.r, fs * 0.45);
    parts.push(`<g class="y-obj y-plant lvl-${res.level}${yardSel === p.id ? ' sel' : ''}" data-id="${p.id}"><circle cx="${p.x}" cy="${Y(p.y)}" r="${r}" fill="${pl.color}"/>`
      + `<circle class="ring" cx="${p.x}" cy="${Y(p.y)}" r="${r + fs * 0.18}"/>`
      + `<text x="${p.x}" y="${Y(p.y) + fs * 0.3}" font-size="${fs * 0.8}" text-anchor="middle">${i + 1}</text></g>`);
  });

  // Точки золотого сечения — поверх построек
  if (yard.golden) parts.push(`<g class="y-gold">${goldenGrid(yard.plot).points.map(([x, y]) => `<circle cx="${x}" cy="${Y(y)}" r="${fs * 0.4}"/>`).join('')}</g>`);

  // Место для сценария отдыха
  const scn = yard.scenario && currentScenario();
  if (scn) parts.push(`<g class="y-scn"><circle cx="${scn.x}" cy="${Y(scn.y)}" r="2"/><text x="${scn.x}" y="${Y(scn.y) - 2.4}" font-size="${fs * 0.9}" text-anchor="middle">${SCENARIOS[yard.scenario].title}</text></g>`);

  // Север, солнце, масштаб
  parts.push(`<g class="y-north" transform="translate(${W + M / 2} ${M * 0.2 + fs * 2})"><g transform="rotate(${-prot})"><path d="M0 ${-fs * 1.6} L${fs * 0.6} ${fs * 0.6} L0 0 L${-fs * 0.6} ${fs * 0.6} Z"/></g><text y="${fs * 2.2}" font-size="${fs}" text-anchor="middle">С</text></g>`);
  if (sun.alt > 0) {
    // Солнце — на краю рамки плана в своём направлении
    const [sx, sy] = sunVector(sun.az, prot);
    const edge = M + fs * 0.2;
    const R = Math.min((W / 2 + edge) / Math.max(Math.abs(sx), 1e-6), (D / 2 + edge) / Math.max(Math.abs(sy), 1e-6));
    const cx = W / 2 + sx * R;
    const cy = D / 2 + sy * R;
    parts.push(`<line class="y-sunray" x1="${cx}" y1="${Y(cy)}" x2="${W / 2}" y2="${Y(D / 2)}"/>`);
    parts.push(`<circle class="y-sun" cx="${cx}" cy="${Y(cy)}" r="${fs * 0.9}"/>`);
  }
  parts.push(`<line class="y-scale" x1="0" y1="${D + M * 0.55}" x2="10" y2="${D + M * 0.55}"/><text class="y-scale-t" x="5" y="${D + M * 0.55 - fs * 0.4}" font-size="${fs * 0.8}" text-anchor="middle">10 м</text>`);
  parts.push(`<text class="y-dim" x="${W / 2}" y="${-M * 0.3}" font-size="${fs * 0.85}" text-anchor="middle">${yFmt(W)} м</text>`);

  // Солнце может выйти за участок — берём рамку с запасом
  const pad = M + fs * 1.2;
  $('y-plan').innerHTML = `<svg viewBox="${-pad} ${-pad} ${W + 2 * pad} ${D + 2 * pad}" role="img" aria-label="План участка">${parts.join('')}</svg>`;

  // Часы и солнце
  $('y-clock').innerHTML = drawClock(yard.time);
  $('y-time-out').textContent = hhmm(yard.time);
  if (document.activeElement !== $('y-time')) $('y-time').value = Math.round(yard.time * 60);
  const dayText = day.polar === 'day' ? 'полярный день' : day.polar === 'night' ? 'полярная ночь' : `восход ${hhmm(day.rise ?? 0)} · закат ${hhmm(day.set ?? 24)} · день ${yFmt(Math.round(day.length * 10) / 10)} ч`;
  $('y-sun-out').textContent = sun.alt > 0
    ? `солнце ${Math.round(sun.alt)}° над горизонтом · азимут ${Math.round(sun.az)}° · ${dayText}`
    : `солнце за горизонтом · ${dayText}`;

  const mx = hours.grid.maxHours;
  const hr = (k) => yFmt(Math.round(mx * k * 2) / 2);
  $('y-legend').innerHTML = yard.view === 'hours'
    ? `<span><i style="background:${HOURS_COLOR.sun}"></i>солнце — от ${hr(LIGHT_SHARE.sun)} ч</span><span><i style="background:${HOURS_COLOR.part}"></i>полутень — ${hr(LIGHT_SHARE.part)}–${hr(LIGHT_SHARE.sun)} ч</span><span><i style="background:${HOURS_COLOR.shade}"></i>тень — меньше ${hr(LIGHT_SHARE.part)} ч</span><span class="note">Открытое место в этот день получает ${hr(1)} ч солнца выше 10° над горизонтом. Солнце — от 65 % этого, полутень — 35–65 %, тень — меньше 35 %.</span>`
    : '<span><i class="lg-shadow"></i>тень</span><span><i class="lg-sun"></i>солнце</span><span class="note">Двигайте время или нажмите ▶.</span>';

  renderYardEditor(checks);
  renderYardWarnings(checks);
  renderHarmony();
  renderComps();
  renderScenario();
  renderMemo(checks);
}

// ---- Композиции, сценарии, памятка ----

let compMsgs = [];
let scnCache = { key: '', spot: null };

function currentScenario() {
  const opts = { year: YEAR, lat: state.center[0], lng: state.center[1], tz: yardTz(), date: yard.date };
  const key = JSON.stringify([yard.scenario, yard.plot, yard.house, yard.items, yard.plants.length, yard.date, opts]);
  if (scnCache.key !== key) scnCache = { key, spot: scenarioSpot(yard.scenario, yard, opts) };
  return scnCache.spot;
}

function compZone(it) {
  return lightZone(bedHours(it), yardHours().grid.maxHours);
}

function renderComps() {
  const comps = yard.items.filter((i) => i.t === 'comp');
  const wind = yard.plants.filter((p) => p.gen === 'wind');
  const li = comps.map((c) => {
    const tpl = compInfo(c);
    const zone = compZone(c);
    const names = c.rows.flatMap((r) => r.plants.map((p) => PLANT_BY_KEY[p.key].name));
    return `<li data-open="${c.id}"><b>${tpl.title}</b><span>${LIGHT_TEXT[zone]} · ${yFmt(c.w)}×${yFmt(c.d)} м</span><br><span>${names.slice(0, 5).join(', ')}${names.length > 5 ? '…' : ''}</span></li>`;
  });
  if (wind.length) li.push(`<li><b>Ветрозащита</b><span>${wind.length} растений вдоль наветренных сторон: ${[...new Set(wind.map((p) => PLANT_BY_KEY[p.t].name))].join(', ')}</span></li>`);
  $('y-comps').innerHTML = (compMsgs.length ? `<p class="msg mixed">${compMsgs.join('<br>')}</p>` : '')
    + (li.length ? `<ul class="comp-list">${li.join('')}</ul>` : '');
}

function renderScenario() {
  if (!yard.scenario) {
    $('y-scenario').innerHTML = '';
    return;
  }
  const sc = SCENARIOS[yard.scenario];
  const spot = currentScenario();
  $('y-scenario').innerHTML = spot
    ? `<div class="msg good"><strong>${sc.title}: место отмечено на плане</strong>${sc.about} С ${sc.from}:00 до ${sc.to}:00 здесь ${sc.want === 'sun' ? 'солнце' : 'тень'} ${Math.round((sc.want === 'sun' ? spot.share : 1 - spot.share) * 100)} % времени, до дома ${yFmt(Math.round(spot.dist))} м.<br><button type="button" class="secondary" data-act="scn-place">Поставить сюда: ${BUILDING_BY_KEY[sc.item].label.toLowerCase()}</button></div>`
    : `<p class="msg bad">Свободного места для «${sc.title}» не нашлось — освободите часть участка.</p>`;
}

function renderMemo(checks) {
  const soil = yard.soil;
  const items = [];
  if (soil.known === null) items.push('<li><b>Начните с почвы</b> — карточка «Почва» вверху.</li>');
  else if (soil.known === false) items.push('<li><b>Почва неизвестна</b> — растения подобраны по солнцу и тени. Проверьте почву до покупки растений: тест из магазина или горсть земли с уксусом и содой.</li>');
  items.push('<li><b>Перед посадкой</b> проверьте почву в каждой посадочной яме: у дома и у забора она часто разная (строительный мусор, известь, торф).</li>');
  items.push(`<li><b>Климат:</b> ${CLIMATE[yardClimate()].toLowerCase()}. Нежные растения сажайте у южной стены и укрывайте на зиму.</li>`);
  const fixes = new Set();
  for (const c of checks.values()) for (const f of c.fixes || []) fixes.add(f);
  for (const comp of yard.items.filter((i) => i.rows)) {
    for (const r of comp.rows) for (const p of r.plants) for (const f of soilFit(PLANT_BY_KEY[p.key], soilNow(), yardClimate()).fixes) fixes.add(f);
  }
  if (fixes.size) items.push(`<li><b>Если почва не подходит:</b><ul>${[...fixes].map((f) => `<li>${f}</li>`).join('')}</ul></li>`);
  items.push('<li><b>Кислая почва</b> — раскислить доломитовой мукой или золой. <b>Щелочная</b> — подкислить верховым торфом и хвойным опадом. <b>Глина</b> — дренаж и песок. <b>Песок</b> — торф, компост и мульча.</li>');
  $('y-memo').innerHTML = `<ul>${items.join('')}</ul>`;
}

function openComp(id) {
  const it = yard.items.find((i) => i.id === id);
  if (!it) return;
  const rows = bedRows(it);
  const tpl = compInfo(it);
  const title = tpl.title;
  const zone = compZone(it);
  $('y-dlg-title').textContent = title;
  $('y-dlg-about').textContent = `${tpl.about} Место: ${LIGHT_TEXT[zone]}, ${yFmt(it.w)} × ${yFmt(it.d)} м.`.trim();
  $('y-dlg-pic').innerHTML = elevationSvg(rows, title);
  const list = rows.flatMap((r) => r.plants.map((p) => {
    const pl = PLANT_BY_KEY[p.key];
    const sf = soilFit(pl, soilNow(), yardClimate());
    const lightOk = pl.light.includes(zone);
    const level = !lightOk ? 'bad' : sf.level;
    const notes = [...(!lightOk ? [`Нужно: ${pl.light.map((l) => LIGHT_TEXT[l]).join(' или ')}.`] : []), ...sf.notes];
    return `<li class="${level}"><b>${pl.name}</b>${p.qty > 1 ? ` — ${p.qty} шт.` : ''}<br><span class="note">${r.tier} · ${yFmt(pl.h)} м · ${pl.light.map((l) => LIGHT_TEXT[l]).join(', ')} · ${HARDY_TEXT[pl.hardy]}</span>${pl.note ? `<br>${pl.note}` : ''}${notes.length ? `<br>${notes.join(' ')}` : ''}${sf.fixes.length ? `<br><span class="fix">${sf.fixes.join(' ')}</span>` : ''}</li>`;
  }));
  $('y-dlg-list').innerHTML = `<ul class="dlg-list">${list.join('')}</ul>`;
  const dlg = $('y-dialog');
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}

function suggestComps() {
  compMsgs = [];
  yard.items = yard.items.filter((i) => !(i.t === 'comp' && i.auto));
  yard.plants = yard.plants.filter((p) => p.gen !== 'wind');
  const soil = soilNow();
  const climate = yardClimate();
  const opts = { year: YEAR, lat: state.center[0], lng: state.center[1], tz: yardTz(), cell: Math.max(1, Math.ceil(Math.max(yard.plot.w, yard.plot.d) / 60)) };
  if (yard.comps.includes('windbreak')) {
    const wb = windbreak(yard, yard.winds, soil, climate);
    for (const p of wb.plants) yard.plants.push({ id: nextId(), t: p.t, x: p.x, y: p.y, gen: 'wind' });
    if (!wb.plants.length) compMsgs.push('Ветрозащита: выберите, откуда дуют ветра (карточка «Участок»).');
  }
  const hours = yardHours();
  const evening = yard.comps.includes('fire') ? { grid: sunHours(yard, { ...opts, from: 17, to: 21, minAlt: 3 }) } : null;
  for (const kind of TEMPLATE_KEYS.filter((k) => yard.comps.includes(k))) {
    const tpl = TEMPLATES[kind];
    const spot = placeTemplate(kind, yard, hours, { evening });
    if (!spot) {
      compMsgs.push(`${tpl.title}: не нашлось свободного места.`);
      continue;
    }
    const it = { id: nextId(), t: 'comp', kind, auto: true, x: spot.x, y: spot.y, w: spot.w, d: spot.d, h: 0, rot: spot.rot || 0 };
    const zone = lightZone(bedHours(it), hours.grid.maxHours);
    if (tpl.want === 'shade' && zone === 'sun') {
      compMsgs.push(`${tpl.title}: на участке нет тенистого места в этот день — попробуйте весну или осень либо посадите дерево.`);
      continue;
    }
    if (tpl.want === 'sun' && zone === 'shade') {
      compMsgs.push(`${tpl.title}: солнечного места не нашлось.`);
      continue;
    }
    it.rows = pickPlants(tpl, zone, soil, climate);
    yard.items.push(it);
  }
  if (yard.soil.known === false) compMsgs.push('Почва не указана — подбор только по солнцу и тени. Проверьте почву перед посадкой.');
  yardChanged(true);
}

const pct = (v) => `${Math.round(v * 100)} %`;
const ratio = (a, b) => yFmt(Math.round((Math.max(a, b) / Math.max(1e-6, Math.min(a, b))) * 100) / 100);
const polyArea = (poly) => Math.abs(poly.reduce((sum, [x1, y1], i) => {
  const [x2, y2] = poly[(i + 1) % poly.length];
  return sum + x1 * y2 - x2 * y1;
}, 0)) / 2;

function renderHarmony() {
  const out = [];
  const h = yard.house;
  const hd = h.shape === 'square' ? h.w : h.d;

  // 1. Дом в точке золотого сечения
  const ng = nearestGolden(yard.plot, [h.x, h.y]);
  out.push(ng.dist <= 2
    ? `<li class="good"><b>Дом стоит в точке золотого сечения</b><span>Главный объект не в центре, а на пересечении линий 38 % / 62 % — композиция живая и естественная.</span></li>`
    : `<li class="mixed"><b>Дом в ${yFmt(Math.round(ng.dist * 10) / 10)} м от точки золотого сечения</b><span>Главный объект смотрится естественнее не в центре, а на пересечении золотых линий (золотые точки на плане).</span><br><button type="button" class="secondary" data-act="house-gold">Поставить дом в ближайшую точку</button></li>`);

  // 2. Зонирование: газон и цветники
  const plotA = yard.plot.w * yard.plot.d;
  const built = polyArea(houseOutline(h)) + yard.items.filter((i) => !BUILDING_BY_KEY[i.t].flat).reduce((s2, i) => s2 + i.w * i.d, 0);
  const paths = yard.items.filter((i) => i.t === 'path').reduce((s2, i) => s2 + i.w * i.d, 0);
  const beds = yard.items.filter((i) => BUILDING_BY_KEY[i.t].bed).reduce((s2, i) => s2 + i.w * i.d, 0);
  const lawn = Math.max(0, plotA - built - paths - beds);
  const green = lawn + beds;
  const share = green ? beds / green : 0;
  const near = Math.abs(share - 0.382) < 0.06 || Math.abs(share - 0.618) < 0.06;
  out.push(`<li class="${near ? 'good' : 'mixed'}"><b>Газон и цветники: ${pct(1 - share)} : ${pct(share)}</b><span>Застройка ${pct(built / plotA)}, дорожки ${pct(paths / plotA)}. По золотому сечению зелёную часть делят примерно 62 : 38 — газон и цветники (или наоборот, если сад цветочный).${near ? '' : ` Сейчас цветников ${yFmt(Math.round(beds))} м² — для 62 : 38 нужно около ${yFmt(Math.round(green * 0.382))} м².`}</span></li>`);

  // 3. Пропорции дома
  const errFacade = goldenError(h.w, h.h);
  const errPlan = goldenError(h.w, hd);
  out.push(`<li class="${Math.min(errFacade, errPlan) < 0.08 ? 'good' : 'mixed'}"><b>Пропорции дома</b><span>Фасад: ширина ${yFmt(h.w)} м к высоте ${yFmt(h.h)} м = ${ratio(h.w, h.h)} (золотое — 1,618; для этой ширины высота около ${yFmt(Math.round((h.w / PHI) * 10) / 10)} м). План: ${yFmt(h.w)} × ${yFmt(hd)} м = ${ratio(h.w, hd)} (золотой план — ${yFmt(h.w)} × ${yFmt(Math.round((h.w / PHI) * 2) / 2)} м).</span></li>`);

  // 4. Дорожки
  const pathLens = yard.items.filter((i) => i.t === 'path').map((i) => Math.max(i.w, i.d)).sort((a, b) => b - a);
  if (pathLens.length >= 2) {
    const e = goldenError(pathLens[0], pathLens[1]);
    out.push(`<li class="${e < 0.1 ? 'good' : 'mixed'}"><b>Дорожки: главная ${yFmt(pathLens[0])} м, второстепенная ${yFmt(pathLens[1])} м = ${ratio(pathLens[0], pathLens[1])}</b><span>Ритм приятнее, когда главная длиннее второстепенной примерно в 1,6 раза: для главной ${yFmt(pathLens[0])} м — около ${yFmt(Math.round((pathLens[0] / PHI) * 2) / 2)} м.</span></li>`);
  } else {
    out.push('<li><b>Дорожки</b><span>Добавьте главную и второстепенную дорожки: главная длиннее примерно в 1,6 раза — так получается плавный ритм движения по саду.</span></li>');
  }

  // 5. Ярусы миксбордера
  const tier = PRESETS.pinkWhite.rows.slice(0, 3).map(([, list]) => Math.max(...list.map(([k]) => PLANT_BY_KEY[k].h)));
  out.push(`<li><b>Ярусы миксбордера: ${tier.map((t) => `${yFmt(t)} м`).join(' → ')}</b><span>Каждый следующий ярус ниже предыдущего примерно в 1,6 раза — например, 2 м, 1,2 м и 0,7 м. Сейчас: ${ratio(tier[0], tier[1])} и ${ratio(tier[1], tier[2])}.</span></li>`);

  // 6. Группы растений по числам Фибоначчи
  const groups = plantGroups(yard.plants).filter((g) => PLANT_BY_KEY[g.t].size === 'low' || PLANT_BY_KEY[g.t].group === 'shrub');
  const odd = groups.filter((g) => !isFib(g.size) || g.size === 2);
  out.push(groups.length
    ? `<li class="${odd.length ? 'mixed' : 'good'}"><b>Группы растений</b><span>${odd.length
      ? odd.map((g) => `${PLANT_BY_KEY[g.t].name}: ${g.size} шт. — добавьте до ${fibAtLeast(Math.max(3, g.size))}`).join('; ')
      : 'Все группы — 1, 3, 5 или 8 растений: так посадки выглядят естественно.'}</span></li>`
    : '<li><b>Группы растений</b><span>Многолетники и кустарники сажайте группами по 3, 5 или 8 — выберите «Сажать группой», и растения встанут по «золотому углу», как семена подсолнуха.</span></li>');

  $('y-harmony').innerHTML = `<ul class="harmony">${out.join('')}</ul>`;
}

function renderYardEditor(checks) {
  const o = yardSel && objById(yardSel);
  if (!o) {
    $('y-edit').innerHTML = yardTool
      ? `<p class="msg mixed">Сажаем: <strong>${PLANT_BY_KEY[yardTool].name}</strong> Нажмите на план. <button type="button" class="link" data-act="tool-off">Готово</button></p>`
      : '';
    return;
  }
  if (yardSel === 'house') {
    $('y-edit').innerHTML = '<p class="note">Выбран дом — размеры и поворот в карточке «Дом».</p>';
    return;
  }
  if (o.t && PLANT_BY_KEY[o.t]) {
    const pl = PLANT_BY_KEY[o.t];
    const c = checks.get(o.id);
    $('y-edit').innerHTML = `<div class="editor"><strong>${yard.plants.indexOf(o) + 1}. ${pl.name}</strong>`
      + `<span class="note">Высота ${yFmt(pl.h)} м · свет: ${pl.light.map((l) => LIGHT_TEXT[l]).join(', ')}${pl.note ? ` · ${pl.note}` : ''}</span>`
      + `<div class="msg ${c.level === 'good' ? 'good' : c.level === 'bad' ? 'bad' : 'mixed'}">${c.notes.join('<br>')}</div>`
      + '<div class="row"><button type="button" class="secondary" data-act="del">Убрать</button></div></div>';
    return;
  }
  const b = BUILDING_BY_KEY[o.t];
  $('y-edit').innerHTML = `<div class="editor"><strong>${b.label}</strong><div class="grid3">`
    + `<label>Ширина, м <input type="number" data-f="w" value="${o.w}" min="0.5" max="60" step="0.5"></label>`
    + `<label>Длина, м <input type="number" data-f="d" value="${o.d}" min="0.5" max="60" step="0.5"></label>`
    + (b.flat ? '' : `<label>Высота, м <input type="number" data-f="h" value="${o.h}" min="0" max="20" step="0.5"></label>`)
    + `<label>Поворот, ° <input type="number" data-f="rot" value="${o.rot}" step="15"></label></div>`
    + '<div class="row"><button type="button" class="secondary" data-act="rot90">Повернуть на 90°</button><button type="button" class="secondary" data-act="del">Убрать</button></div></div>';
}

function renderYardWarnings(checks) {
  const msgs = checkBuildings(yard).map((c) => `<li class="bad">${c.text}</li>`);
  $('y-warn').innerHTML = msgs.length ? `<ul class="y-warn">${msgs.join('')}</ul>` : '';
  const list = yard.plants.map((p, i) => {
    const c = checks.get(p.id);
    return `<li class="${c.level}" data-pick="${p.id}"><b>${i + 1}. ${PLANT_BY_KEY[p.t].name}</b> — ${yFmt(c.hours)} ч солнца, ${LIGHT_TEXT[c.zone]}${c.level === 'good' ? ' ✓' : `<br><span>${c.notes.filter((n) => !n.startsWith('Свет подходит')).join(' ')}${c.fixes?.length ? ` ${c.fixes.join(' ')}` : ''}</span>`}</li>`;
  });
  $('y-plant-list').innerHTML = list.length
    ? `<h3 class="sub">Посажено</h3><ul class="y-plant-list">${list.join('')}</ul><button type="button" class="link" data-act="clear-plants">Убрать все растения</button>`
    : '';
}

function bedHours(it) {
  // Средние часы солнца внутри клумбы — по сетке карты солнца
  const poly = rectPoly(it);
  const cells = yardHours().grid.grid.filter((g) => inPoly(poly, [g.x, g.y]));
  if (!cells.length) return sunHours(yard, { year: YEAR, lat: state.center[0], lng: state.center[1], tz: yardTz() }, [{ pt: [it.x, it.y] }]).hours[0];
  return cells.reduce((s, g) => s + g.hours, 0) / cells.length;
}

function renderYard() {
  renderYardControls();
  renderYardPlan();
}

function yardChanged(full = false) {
  if (full) renderYardControls();
  renderYardPlan();
  save();
}

// ---- События конструктора ----

$('y-shape').addEventListener('click', (e) => {
  const b = e.target.closest('[data-shape]');
  if (!b) return;
  yard.house.shape = b.dataset.shape;
  yardChanged(true);
});

for (const [id, key, min, max] of [['y-hw', 'w', 4, 40], ['y-hd', 'd', 4, 40], ['y-hcw', 'cw', 1, 30], ['y-hcd', 'cd', 1, 30], ['y-hh', 'h', 2.5, 20], ['y-hrot', 'rot', -360, 360]]) {
  $(id).addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (!Number.isFinite(v) || v < min || v > max) return;
    yard.house[key] = v;
    yardChanged();
  });
}
// Дом остаётся внутри участка, если участок уменьшили
function keepHouseInside() {
  const h = yard.house;
  const r = Math.max(h.w, h.shape === 'square' ? h.w : h.d) / 2;
  h.x = Math.min(Math.max(h.x, Math.min(r + 3, yard.plot.w / 2)), Math.max(yard.plot.w - r - 3, yard.plot.w / 2));
  h.y = Math.min(Math.max(h.y, Math.min(r + 3, yard.plot.d / 2)), Math.max(yard.plot.d - r - 3, yard.plot.d / 2));
}

for (const [id, key, min, max] of [['y-pw', 'w', 10, 200], ['y-pd', 'd', 10, 200], ['y-prot', 'rot', -360, 360]]) {
  $(id).addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (!Number.isFinite(v) || v < min || v > max) return;
    yard.plot[key] = v;
    keepHouseInside();
    yardChanged(key !== 'rot');
  });
}
$('y-plot-presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-plot]');
  if (!b) return;
  const [w, d] = b.dataset.plot.split('x').map(Number);
  yard.plot.w = w;
  yard.plot.d = d;
  keepHouseInside();
  yardChanged(true);
});
$('y-tz').addEventListener('change', (e) => {
  yard.tz = Number(e.target.value);
  yardChanged();
});

$('y-buildings').addEventListener('click', (e) => {
  const b = e.target.closest('[data-add]');
  if (!b) return;
  const def = BUILDING_BY_KEY[b.dataset.add];
  // Ставим в свободный угол участка: ищем точку подальше от дома и других построек
  const { w: W, d: D } = yard.plot;
  let best = null;
  for (let y = def.d / 2 + 1.5; y <= D - def.d / 2 - 1.5; y += 1) {
    for (let x = def.w / 2 + 1.5; x <= W - def.w / 2 - 1.5; x += 1) {
      // Кандидат с запасом 1 м вокруг, чтобы постройки не слипались
      const poly = rectPoly({ x, y, w: def.w + 2, d: def.d + 2, rot: 0 });
      const others = [...housePieces(yard.house), ...yard.items.map((i) => rectPoly(i))];
      const clash = others.some((o) => convexOverlap(o, poly));
      if (clash) continue;
      const score = -Math.hypot(x - yard.house.x, y - yard.house.y);
      if (!best || score < best.score) best = { x, y, score };
    }
  }
  const it = { id: nextId(), t: def.key, x: best ? best.x : W / 2, y: best ? best.y : def.d, w: def.w, d: def.d, h: def.h, rot: 0 };
  yard.items.push(it);
  yardSel = it.id;
  yardChanged();
});

$('y-time').addEventListener('input', (e) => {
  yard.time = Number(e.target.value) / 60;
  // Двигаем солнце — показываем тени, а не карту солнца за день
  if (yard.view !== 'shadow') {
    yard.view = 'shadow';
    for (const b of document.querySelectorAll('#y-view [data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === 'shadow'));
  }
  renderYardPlan();
  save();
});

$('y-play').addEventListener('click', () => {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
    $('y-play').textContent = '▶';
    return;
  }
  if (yard.view !== 'shadow') {
    yard.view = 'shadow';
    renderYardControls();
  }
  $('y-play').textContent = '❚❚';
  playTimer = setInterval(() => {
    yard.time = (yard.time + 1 / 6) % 24;
    renderYardPlan();
  }, 90);
});

$('y-dates').addEventListener('click', (e) => {
  const b = e.target.closest('[data-date]');
  if (!b) return;
  yard.date = b.dataset.date;
  yardChanged(true);
});

$('y-view').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (!b) return;
  yard.view = b.dataset.view;
  yardChanged(true);
});

$('y-door').addEventListener('change', (e) => {
  yard.house.door = e.target.value;
  yardChanged();
});

for (const id of ['y-soil-ph', 'y-soil-texture', 'y-soil-water']) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('[data-soil]');
    if (!b) return;
    const k = b.dataset.soil;
    if (yard.soil.known === false) yard.soil = { known: true, ph: null, texture: null, water: null };
    yard.soil.known = true;
    yard.soil[k] = yard.soil[k] === b.dataset.v ? null : b.dataset.v;
    yardChanged(true);
  });
}
$('y-soil-unknown').addEventListener('change', (e) => {
  yard.soil = e.target.checked ? { known: false, ph: null, texture: null, water: null } : { known: null, ph: null, texture: null, water: null };
  yardChanged(true);
});
$('y-climate').addEventListener('change', (e) => {
  yard.climate = e.target.value;
  yardChanged(true);
});
$('y-winds').addEventListener('click', (e) => {
  const b = e.target.closest('[data-wind]');
  if (!b) return;
  const w = b.dataset.wind;
  yard.winds = yard.winds.includes(w) ? yard.winds.filter((x) => x !== w) : [...yard.winds, w];
  yardChanged(true);
});
$('y-comp-kinds').addEventListener('click', (e) => {
  const b = e.target.closest('[data-comp]');
  if (!b) return;
  const k = b.dataset.comp;
  yard.comps = yard.comps.includes(k) ? yard.comps.filter((x) => x !== k) : [...yard.comps, k];
  renderYardControls();
  save();
});
$('y-suggest').addEventListener('click', suggestComps);
$('y-presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]');
  if (!b) return;
  const key = b.dataset.preset;
  const pr = PRESETS[key];
  const spot = placePreset(key, yard, yardHours());
  compMsgs = [];
  if (!spot) {
    compMsgs.push(`${pr.title}: не нашлось свободного места на стороне ${pr.side} — освободите часть участка или уменьшите постройки.`);
    renderComps();
    return;
  }
  const it = { id: nextId(), t: 'comp', preset: key, x: spot.x, y: spot.y, w: spot.w, d: spot.d, h: 0, rot: spot.rot, rows: presetRows(key) };
  yard.items.push(it);
  yardSel = it.id;
  const zone = lightZone(bedHours(it), yardHours().grid.maxHours);
  if (pr.want !== zone) compMsgs.push(`${pr.title}: на стороне ${pr.side} получилось место «${LIGHT_TEXT[zone]}», а композиция рассчитана на «${LIGHT_TEXT[pr.want]}». Передвиньте её или выберите другую.`);
  yardChanged();
  $('y-plan').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('y-comp-clear').addEventListener('click', () => {
  yard.items = yard.items.filter((i) => !(i.t === 'comp' && i.auto));
  yard.plants = yard.plants.filter((p) => p.gen !== 'wind');
  compMsgs = [];
  yardChanged();
});
$('y-comps').addEventListener('click', (e) => {
  const li = e.target.closest('[data-open]');
  if (li) openComp(li.dataset.open);
});
$('y-scenarios').addEventListener('click', (e) => {
  const b = e.target.closest('[data-scn]');
  if (!b) return;
  yard.scenario = yard.scenario === b.dataset.scn ? null : b.dataset.scn;
  yardChanged(true);
});
$('y-scenario').addEventListener('click', (e) => {
  if (!e.target.closest('[data-act="scn-place"]')) return;
  const sc = SCENARIOS[yard.scenario];
  const spot = currentScenario();
  if (!spot) return;
  const def = BUILDING_BY_KEY[sc.item];
  const it = { id: nextId(), t: def.key, x: spot.x, y: spot.y, w: def.w, d: def.d, h: def.h, rot: 0 };
  yard.items.push(it);
  yardSel = it.id;
  yard.scenario = null;
  yardChanged(true);
});
$('y-dlg-close').addEventListener('click', () => $('y-dialog').close());
$('y-dialog').addEventListener('click', (e) => {
  if (e.target === $('y-dialog')) $('y-dialog').close();
});

$('y-golden').addEventListener('click', () => {
  yard.golden = !yard.golden;
  yardChanged(true);
});

$('y-group').addEventListener('click', (e) => {
  const b = e.target.closest('[data-group]');
  if (!b) return;
  yard.group = Number(b.dataset.group);
  renderYardControls();
  save();
});

$('y-harmony').addEventListener('click', (e) => {
  if (!e.target.closest('[data-act="house-gold"]')) return;
  const ng = nearestGolden(yard.plot, [yard.house.x, yard.house.y]);
  [yard.house.x, yard.house.y] = ng.p.map((v) => Math.round(v * 2) / 2);
  yardChanged();
});

$('y-light-filter').addEventListener('click', (e) => {
  const b = e.target.closest('[data-light]');
  if (!b) return;
  lightFilter = b.dataset.light;
  renderYardControls();
});

$('y-plants').addEventListener('click', (e) => {
  const b = e.target.closest('[data-plant]');
  if (!b) return;
  yardTool = yardTool === b.dataset.plant ? null : b.dataset.plant;
  yardSel = null;
  renderPlantPalette();
  renderYardPlan();
  if (yardTool) $('y-plan').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

function yardAct(e) {
  const a = e.target.closest('[data-act]');
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    yardSel = pick.dataset.pick;
    renderYardPlan();
    return;
  }
  if (!a) return;
  const act = a.dataset.act;
  if (act === 'tool-off') {
    yardTool = null;
    renderPlantPalette();
  } else if (act === 'del') {
    yard.items = yard.items.filter((i) => i.id !== yardSel);
    yard.plants = yard.plants.filter((p) => p.id !== yardSel);
    yardSel = null;
  } else if (act === 'rot90') {
    const o = objById(yardSel);
    o.rot = ((o.rot || 0) + 90) % 360;
  } else if (act === 'clear-plants') {
    if (!window.confirm('Убрать все растения с участка?')) return;
    yard.plants = [];
    yardSel = null;
  }
  yardChanged();
}
$('y-edit').addEventListener('click', yardAct);
$('y-plant-list').addEventListener('click', yardAct);

$('y-edit').addEventListener('input', (e) => {
  const f = e.target.dataset.f;
  const o = objById(yardSel);
  if (!f || !o) return;
  const v = Number(e.target.value);
  if (!Number.isFinite(v) || v < 0) return;
  o[f] = v;
  renderYardPlan();
  save();
});

// Перетаскивание и посадка на плане
let drag = null;
function planPoint(e) {
  const svg = $('y-plan').querySelector('svg');
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  return [p.x, yard.plot.d - p.y];
}
const snap = (v) => Math.round(v * 2) / 2;

$('y-plan').addEventListener('pointerdown', (e) => {
  const g = e.target.closest('[data-id]');
  if (!g || yardTool) return;
  const o = objById(g.dataset.id);
  const [x, y] = planPoint(e);
  drag = { id: g.dataset.id, dx: o.x - x, dy: o.y - y, sx: e.clientX, sy: e.clientY, moved: false };
  $('y-plan').setPointerCapture(e.pointerId);
});

$('y-plan').addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
  drag.moved = true;
  const [x, y] = planPoint(e);
  const o = objById(drag.id);
  o.x = snap(x + drag.dx);
  o.y = snap(y + drag.dy);
  yardSel = drag.id;
  renderYardPlan();
});

$('y-plan').addEventListener('pointerup', (e) => {
  if (drag) {
    if (!drag.moved) {
      yardSel = yardSel === drag.id ? null : drag.id;
      const it = yard.items.find((i) => i.id === drag.id);
      if (it && BUILDING_BY_KEY[it.t].bed) {
        yardSel = drag.id;
        openComp(drag.id);
      }
    }
    drag = null;
    yardChanged();
    return;
  }
  if (!e.target.closest('svg')) return;
  const [x, y] = planPoint(e);
  if (yardTool) {
    if (x < 0 || y < 0 || x > yard.plot.w || y > yard.plot.d) return;
    // На дом и постройки не сажаем
    const solid = [houseOutline(yard.house), ...yard.items.filter((i) => !BUILDING_BY_KEY[i.t].flat).map((i) => rectPoly(i))];
    if (solid.some((poly) => inPoly(poly, [x, y]))) return;
    const pl = PLANT_BY_KEY[yardTool];
    const n = yard.group || 1;
    for (const [px, py] of phyllotaxis(n, Math.max(0.4, pl.r * 1.7), x, y)) {
      if (px < 0 || py < 0 || px > yard.plot.w || py > yard.plot.d) continue;
      yard.plants.push({ id: nextId(), t: yardTool, x: Math.round(px * 10) / 10, y: Math.round(py * 10) / 10 });
    }
    yardChanged();
  } else if (yardSel) {
    yardSel = null;
    renderYardPlan();
  }
});

// ---- Вкладки ----

const TABS = ['home', 'calc', 'plan', 'design', 'estimate', 'garden'];

function showTab() {
  const id = location.hash.slice(1);
  const tab = TABS.includes(id) ? id : 'home';
  for (const page of document.querySelectorAll('.tab-page')) page.hidden = page.dataset.page !== tab;
  for (const a of document.querySelectorAll('.tabs a')) a.setAttribute('aria-selected', String(a.dataset.tab === tab));
  // Карта, созданная в скрытой вкладке, не знает своего размера
  if (tab === 'calc') map.invalidateSize();
  if (tab === 'garden') renderYard();
  if (tab === 'design') renderDesign();
  if (tab === 'estimate') renderEstimate();
  else if (playTimer) $('y-play').click();
  window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', showTab);

renderShapeControls(1);
renderShapeControls(2);
renderYard();
showTab();
render();
