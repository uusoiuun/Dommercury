import { test } from 'node:test';
import assert from 'node:assert/strict';
import { declination } from '../js/wmm.js';

// Эталонные значения посчитаны официальной реализацией WMM2025 (pygeomag).
const cases = [
  [62.03, 129.73, 2026.8, -16.3709],   // Якутск
  [47.6205, -122.3493, 2025.25, 15.0656], // Сиэтл, пример из документации
  [69.35, 88.2, 2027.3, 16.8844],       // Норильск
  [-33.9, 18.4, 2027.3, -26.8907],      // Кейптаун
];

for (const [lat, lon, year, expected] of cases) {
  test(`склонение ${lat}, ${lon}`, () => {
    assert.ok(Math.abs(declination(lat, lon, year) - expected) < 1e-3);
  });
}
