const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../src/calc.js');

function changesOf(price, margin, churn, cac) {
  return calc.calculate({ price: String(price), margin: String(margin), churn: String(churn), cac: String(cac), ratioThreshold: '3', paybackThreshold: '12' }).changes;
}
const medium = { price: 'medium', margin: 'medium', cac: 'medium', churn: 'medium' };
const fakeNeeded = (changePct) => ({ status: 'needed', target: 1, changePct });

test('пример 1: цена, CAC, отток, маржа недостижима в конце', () => {
  const rank = calc.rankChanges(changesOf(10, 70, 6, 60), { price: 'easy', cac: 'medium', churn: 'medium', margin: 'hard' });
  assert.deepEqual(rank.order, ['price', 'cac', 'churn']);
  assert.deepEqual(rank.unreachable, ['margin']);
  assert.equal(rank.first, 'price');
  assert.equal(rank.scores.price, 54.3);
  assert.equal(rank.scores.cac, 70.4);
  assert.equal(rank.scores.churn, 70.66);
});

test('пример 3: все "средне" - сначала CAC, недостижимые в порядке отток, маржа', () => {
  const rank = calc.rankChanges(changesOf(10, 70, 5, 100), medium);
  assert.deepEqual(rank.order, ['cac', 'price']);
  assert.deepEqual(rank.unreachable, ['churn', 'margin']);
  assert.equal(rank.first, 'cac');
  assert.equal(rank.scores.cac, 106.68);
  assert.equal(rank.scores.price, 228.6);
});

test('пример 4: все "средне"', () => {
  const rank = calc.rankChanges(changesOf(10, 50, 2, 80), medium);
  assert.deepEqual(rank.order, ['cac', 'margin', 'price']);
  assert.deepEqual(rank.unreachable, ['churn']);
  assert.equal(rank.scores.cac, 50);
  assert.equal(rank.scores.price, 66.8);
  assert.equal(rank.scores.margin, 66.68);
});

test('смена трудности меняет порядок', () => {
  const rank = calc.rankChanges(changesOf(10, 70, 5, 100), { price: 'easy', cac: 'hard', churn: 'medium', margin: 'medium' });
  assert.deepEqual(rank.order, ['price', 'cac']);
  assert.equal(rank.scores.price, 114.3);
  assert.equal(rank.scores.cac, 160.02);
});

test('пример 1, все "средне": CAC, отток, цена', () => {
  const rank = calc.rankChanges(changesOf(10, 70, 6, 60), medium);
  assert.deepEqual(rank.order, ['cac', 'churn', 'price']);
  assert.equal(rank.scores.price, 108.6);
});

test('равные оценки: порядок цена, CAC, отток, маржа', () => {
  const equal = { price: fakeNeeded(10), margin: fakeNeeded(-10), cac: fakeNeeded(-10), churn: fakeNeeded(10) };
  assert.deepEqual(calc.rankChanges(equal, medium).order, ['price', 'cac', 'churn', 'margin']);
});

test('оценки сравниваются после округления до 2 знаков', () => {
  const near = { price: fakeNeeded(10.004), margin: fakeNeeded(50), cac: fakeNeeded(10.0001), churn: fakeNeeded(50) };
  const rank = calc.rankChanges(near, { price: 'easy', cac: 'easy', churn: 'easy', margin: 'easy' });
  assert.deepEqual(rank.order.slice(0, 2), ['price', 'cac']);
  const swapped = { price: fakeNeeded(10.0051), margin: fakeNeeded(50), cac: fakeNeeded(10.004), churn: fakeNeeded(50) };
  assert.deepEqual(calc.rankChanges(swapped, { price: 'easy', cac: 'easy', churn: 'easy', margin: 'easy' }).order.slice(0, 2), ['cac', 'price']);
});

test('знак изменения не влияет на оценку', () => {
  const mixed = { price: fakeNeeded(30), margin: fakeNeeded(-20), cac: fakeNeeded(-25), churn: fakeNeeded(40) };
  const rank = calc.rankChanges(mixed, { price: 'easy', cac: 'easy', churn: 'easy', margin: 'easy' });
  assert.deepEqual(rank.order, ['margin', 'cac', 'price', 'churn']);
});

test('отсутствующая трудность - "средне"', () => {
  const a = calc.rankChanges(changesOf(10, 70, 5, 100), {});
  const b = calc.rankChanges(changesOf(10, 70, 5, 100), medium);
  assert.deepEqual(a, b);
  assert.deepEqual(calc.rankChanges(changesOf(10, 70, 5, 100)), b);
});

test('нет изменений или всё недостижимо - пустой порядок', () => {
  const none = calc.rankChanges(null, medium);
  assert.deepEqual(none.order, []);
  assert.deepEqual(none.unreachable, []);
  assert.equal(none.first, null);
  const allBad = {
    price: { status: 'unreachable', reason: 'x', target: null },
    margin: { status: 'unreachable', reason: 'over100', target: 120 },
    cac: { status: 'unreachable', reason: 'x', target: null },
    churn: { status: 'unreachable', reason: 'payback', target: null }
  };
  const rank = calc.rankChanges(allBad, medium);
  assert.deepEqual(rank.order, []);
  assert.deepEqual(rank.unreachable, ['price', 'cac', 'churn', 'margin']);
  assert.equal(rank.first, null);
});

test('неизвестная трудность - ошибка', () => {
  assert.throws(() => calc.rankChanges(changesOf(10, 70, 5, 100), { price: 'simple' }));
});
