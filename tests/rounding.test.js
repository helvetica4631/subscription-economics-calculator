const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../src/calc.js');

test('roundHalfUp: половина вверх', () => {
  assert.equal(calc.roundHalfUp(3.125, 2), 3.13);
  assert.equal(calc.roundHalfUp(1.005, 2), 1.01);
  assert.equal(calc.roundHalfUp(2.5, 0), 3);
  assert.equal(calc.roundHalfUp(8.5714, 1), 8.6);
  assert.equal(calc.roundHalfUp(0, 2), 0);
});

test('roundHalfUp: отрицательные симметрично', () => {
  assert.equal(calc.roundHalfUp(-35.185, 2), -35.19);
  assert.equal(calc.roundHalfUp(-2.5, 0), -3);
});

test('formatRu: запятая и ровно заданное число знаков', () => {
  assert.equal(calc.formatRu(5, 1), '5,0');
  assert.equal(calc.formatRu(116.6667, 2), '116,67');
  assert.equal(calc.formatRu(-35.19, 2), '-35,19');
  assert.equal(calc.formatRu(12, 1), '12,0');
  assert.equal(calc.formatRu(3.125, 2), '3,13');
});

test('roundHalfUp: поправка на дробные ошибки не сдвигает значения чуть ниже половины', () => {
  assert.equal(calc.roundHalfUp(1000.004, 2), 1000);
  assert.equal(calc.roundHalfUp(100000.00499, 2), 100000);
  assert.equal(calc.roundHalfUp(12.0004, 3), 12);
  assert.equal(calc.roundHalfUp(2.9949, 2), 2.99);
});
