const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../src/calc.js');

test('formatNearThreshold: 2,997 при пороге 3 не превращается в 3,00', () => {
  assert.equal(calc.formatNearThreshold(2.997, 2, 3, false), '2,997');
  assert.equal(calc.formatNearThreshold(2.9999, 2, 3, false), '2,9999');
});

test('formatNearThreshold: 3 проходит порог и показывается обычно', () => {
  assert.equal(calc.formatNearThreshold(3, 2, 3, true), '3,00');
  assert.equal(calc.formatNearThreshold(3.0000000001, 2, 3, true), '3,00');
});

test('formatNearThreshold: окупаемость 12,0004 при пороге 12 отличается от 12,0', () => {
  assert.equal(calc.formatNearThreshold(12.0004, 1, 12, false), '12,0004');
  assert.equal(calc.formatNearThreshold(12.04, 1, 12, false), '12,04');
});

test('formatNearThreshold: процент 0,004 не показывается как 0,00', () => {
  assert.equal(calc.formatNearThreshold(0.004, 2, 0, false), '0,004');
  assert.equal(calc.formatNearThreshold(-0.004, 2, 0, false), '-0,004');
});

test('formatNearThreshold: далёкое от порога значение округляется как обычно', () => {
  assert.equal(calc.formatNearThreshold(1.9444, 2, 3, false), '1,94');
  assert.equal(calc.formatNearThreshold(8.5714, 1, 12, true), '8,6');
  assert.equal(calc.formatNearThreshold(54.3, 2, 0, false), '54,30');
});

test('formatNearThreshold: не больше 6 знаков', () => {
  assert.equal(calc.formatNearThreshold(2.9999999, 2, 3, false), '3,000000');
  assert.equal(calc.formatNearThreshold(0.00000001, 2, 0, false), '0,000000');
});

test('formatNearThreshold: показанное у порога сходится с вердиктом на реальном вводе', () => {
  const r = calc.calculate({ price: '10', margin: '50', churn: '10', cac: '16,69', ratioThreshold: '3', paybackThreshold: '12' });
  assert.equal(r.verdict, 'wait');
  assert.equal(calc.formatNearThreshold(r.ltvCac, 2, r.values.R, r.ratioPass), '2,996');
  const q = calc.calculate({ price: '10', margin: '50', churn: '2', cac: '60,02', ratioThreshold: '3', paybackThreshold: '12' });
  assert.equal(q.verdict, 'wait');
  assert.equal(calc.formatNearThreshold(q.payback, 1, q.values.T, q.paybackPass), '12,004');
});
