// Магнитное склонение по World Magnetic Model.
// Порт классического алгоритма NOAA (geomag.c), только склонение.
import { WMM2025 } from './wmm2025.js';

const MAXORD = 12;

function prepare(model) {
  const size = MAXORD + 1;
  const matrix = () => Array.from({ length: size }, () => new Array(size).fill(0));
  const c = matrix();
  const cd = matrix();
  const k = matrix();
  const snorm = new Array(size * size).fill(0);

  for (const [n, m, g, h, dg, dh] of model.coefficients) {
    c[m][n] = g;
    cd[m][n] = dg;
    if (m !== 0) {
      c[n][m - 1] = h;
      cd[n][m - 1] = dh;
    }
  }

  // Перевод из нормировки Шмидта в ненормированные коэффициенты
  snorm[0] = 1;
  for (let n = 1; n <= MAXORD; n++) {
    snorm[n] = (snorm[n - 1] * (2 * n - 1)) / n;
    let j = 2;
    for (let m = 0; m <= n; m++) {
      k[m][n] = ((n - 1) * (n - 1) - m * m) / ((2 * n - 1) * (2 * n - 3));
      if (m > 0) {
        const flnmj = ((n - m + 1) * j) / (n + m);
        snorm[n + m * size] = snorm[n + (m - 1) * size] * Math.sqrt(flnmj);
        j = 1;
        c[n][m - 1] *= snorm[n + m * size];
        cd[n][m - 1] *= snorm[n + m * size];
      }
      c[m][n] *= snorm[n + m * size];
      cd[m][n] *= snorm[n + m * size];
    }
  }
  k[1][1] = 0;
  return { epoch: model.epoch, model: model.model, c, cd, k, snorm, size };
}

const prepared = prepare(WMM2025);

export const MODEL_NAME = prepared.model;
export const MODEL_VALID = [prepared.epoch, prepared.epoch + 5];

/**
 * Склонение в градусах (восточное — плюс, западное — минус).
 * @param {number} glat широта, °
 * @param {number} glon долгота, °
 * @param {number} year дробный год, например 2026.8
 * @param {number} altKm высота над эллипсоидом, км
 */
export function declination(glat, glon, year, altKm = 0) {
  const { c, cd, k, size } = prepared;
  const p = prepared.snorm.slice();
  const dt = year - prepared.epoch;
  const dp = Array.from({ length: size }, () => new Array(size).fill(0));
  const tc = Array.from({ length: size }, () => new Array(size).fill(0));
  const sp = new Array(size).fill(0);
  const cp = new Array(size).fill(0);
  const pp = new Array(size).fill(0);
  cp[0] = pp[0] = 1;

  const a = 6378.137;
  const b = 6356.7523142;
  const re = 6371.2;
  const a2 = a * a;
  const b2 = b * b;
  const c2 = a2 - b2;
  const a4 = a2 * a2;
  const b4 = b2 * b2;
  const c4 = a4 - b4;

  const rlon = (glon * Math.PI) / 180;
  const rlat = (glat * Math.PI) / 180;
  const srlat = Math.sin(rlat);
  const crlat = Math.cos(rlat);
  const srlat2 = srlat * srlat;
  const crlat2 = crlat * crlat;
  sp[1] = Math.sin(rlon);
  cp[1] = Math.cos(rlon);

  // Геодезические координаты -> сферические
  const q = Math.sqrt(a2 - c2 * srlat2);
  const q1 = altKm * q;
  const q2 = ((q1 + a2) / (q1 + b2)) ** 2;
  const ct = srlat / Math.sqrt(q2 * crlat2 + srlat2);
  const st = Math.sqrt(1 - ct * ct);
  const r = Math.sqrt(altKm * altKm + 2 * q1 + (a4 - c4 * srlat2) / (q * q));
  const d = Math.sqrt(a2 * crlat2 + b2 * srlat2);
  const ca = (altKm + d) / r;
  const sa = (c2 * crlat * srlat) / (r * d);

  for (let m = 2; m <= MAXORD; m++) {
    sp[m] = sp[1] * cp[m - 1] + cp[1] * sp[m - 1];
    cp[m] = cp[1] * cp[m - 1] - sp[1] * sp[m - 1];
  }

  const aor = re / r;
  let ar = aor * aor;
  let br = 0;
  let bt = 0;
  let bp = 0;
  let bpp = 0;
  for (let n = 1; n <= MAXORD; n++) {
    ar *= aor;
    for (let m = 0; m <= n; m++) {
      // Присоединённые функции Лежандра и их производные
      if (n === m) {
        p[n + m * size] = st * p[n - 1 + (m - 1) * size];
        dp[m][n] = st * dp[m - 1][n - 1] + ct * p[n - 1 + (m - 1) * size];
      } else if (n === 1 && m === 0) {
        p[n + m * size] = ct * p[n - 1 + m * size];
        dp[m][n] = ct * dp[m][n - 1] - st * p[n - 1 + m * size];
      } else if (n > 1 && n !== m) {
        if (m > n - 2) {
          p[n - 2 + m * size] = 0;
          dp[m][n - 2] = 0;
        }
        p[n + m * size] = ct * p[n - 1 + m * size] - k[m][n] * p[n - 2 + m * size];
        dp[m][n] = ct * dp[m][n - 1] - st * p[n - 1 + m * size] - k[m][n] * dp[m][n - 2];
      }

      // Коэффициенты на заданную дату
      tc[m][n] = c[m][n] + dt * cd[m][n];
      if (m !== 0) tc[n][m - 1] = c[n][m - 1] + dt * cd[n][m - 1];

      const par = ar * p[n + m * size];
      let temp1;
      let temp2;
      if (m === 0) {
        temp1 = tc[m][n] * cp[m];
        temp2 = tc[m][n] * sp[m];
      } else {
        temp1 = tc[m][n] * cp[m] + tc[n][m - 1] * sp[m];
        temp2 = tc[m][n] * sp[m] - tc[n][m - 1] * cp[m];
      }
      bt -= ar * temp1 * dp[m][n];
      bp += m * temp2 * par;
      br += (n + 1) * temp1 * par;

      // Особый случай: географический полюс
      if (st === 0 && m === 1) {
        pp[n] = n === 1 ? pp[n - 1] : ct * pp[n - 1] - k[m][n] * pp[n - 2];
        bpp += m * temp2 * ar * pp[n];
      }
    }
  }
  bp = st === 0 ? bpp : bp / st;

  const bx = -bt * ca - br * sa;
  const by = bp;
  return (Math.atan2(by, bx) * 180) / Math.PI;
}

/** Дробный год для даты. */
export function decimalYear(date = new Date()) {
  const y = date.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (date.getTime() - start) / (end - start);
}
