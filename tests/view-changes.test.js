const test = require('node:test');
const assert = require('node:assert/strict');
const view = require('../src/view.js');

function raw(price, margin, churn, cac, R = '3', T = '12') {
  return { price, margin, churn, cac, ratioThreshold: R, paybackThreshold: T };
}

function row(result, key) {
  return result.changes.rows.find((x) => x.key === key);
}

function ranks(result) {
  const out = {};
  result.changes.rows.forEach((x) => {
    out[x.key] = x.rank;
  });
  return out;
}

const EX1_HARD_MARGIN = { price: 'easy', cac: 'medium', churn: 'medium', margin: 'hard' };

test('пример 1: таблица, значения и порядок строк', () => {
  const r = view.describe(raw('10', '70', '6', '60'), EX1_HARD_MARGIN);
  assert.deepEqual(r.changes.rows.map((x) => x.key), ['price', 'cac', 'churn', 'margin']);
  assert.deepEqual(r.changes.rows.map((x) => x.name), ['Цена', 'CAC', 'Отток', 'Маржа']);
  assert.deepEqual(
    ['price', 'cac', 'churn', 'margin'].map((k) => [row(r, k).current, row(r, k).target, row(r, k).change, row(r, k).reachable]),
    [
      ['10', '15,43', '+54,30%', true],
      ['60', '38,88', '−35,20%', true],
      ['6%', '3,88%', '−35,33%', true],
      ['70%', '108%', 'недостижимо', false]
    ]
  );
  assert.deepEqual(ranks(r), { price: 1, cac: 2, churn: 3, margin: null });
  assert.match(r.changes.start, /^Проще всего начать с цены: трудность отмечена как «легко», нужное изменение \+54,30%\./);
  assert.match(r.changes.orderText, /цена, CAC, отток/);
  assert.match(r.changes.orderText, /Одним изменением недостижимо: маржа\./);
});

test('пример 1: формулы с подстановкой и оценка', () => {
  const r = view.describe(raw('10', '70', '6', '60'), EX1_HARD_MARGIN);
  assert.equal(row(r, 'price').formula, 'max(3 × 60 × 0,06 ÷ 0,70 ; 60 ÷ (12 × 0,70)) = 15,43 (округлено вверх)');
  assert.equal(row(r, 'price').changeFormula, '(15,43 − 10) ÷ 10 × 100 = +54,30%');
  assert.equal(row(r, 'price').scoreText, 'Оценка: 54,30 × 1 (легко) = 54,30');
  assert.equal(row(r, 'cac').formula, 'min(10 × 0,70 ÷ (3 × 0,06) ; 12 × 10 × 0,70) = 38,88 (округлено вниз)');
  assert.equal(row(r, 'cac').changeFormula, '(38,88 − 60) ÷ 60 × 100 = −35,20%');
  assert.equal(row(r, 'cac').scoreText, 'Оценка: 35,20 × 2 (средне) = 70,40');
  assert.equal(row(r, 'churn').formula, '10 × 0,70 ÷ (3 × 60) × 100 = 3,88% (округлено вниз)');
  assert.equal(row(r, 'churn').changeFormula, '(3,88 − 6) ÷ 6 × 100 = −35,33%');
  assert.equal(row(r, 'churn').scoreText, 'Оценка: 35,33 × 2 (средне) = 70,66');
  assert.equal(row(r, 'margin').formula, 'max(3 × 60 × 0,06 ÷ 10 ; 60 ÷ (12 × 10)) × 100 = 108%');
  assert.equal(row(r, 'margin').scoreText, null);
  assert.match(row(r, 'margin').reason, /100%/);
});

test('у каждой строки есть строка «чем полезна»', () => {
  const r = view.describe(raw('10', '70', '6', '60'), {});
  r.changes.rows.forEach((x) => assert.ok(x.usefulness.length > 10, x.key));
});

test('пример 1, все «средне»: порядок CAC, отток, цена', () => {
  const r = view.describe(raw('10', '70', '6', '60'), {});
  assert.deepEqual(ranks(r), { price: 3, cac: 1, churn: 2, margin: null });
  assert.match(r.changes.start, /^Проще всего начать с CAC: трудность отмечена как «средне», нужное изменение −35,20%\./);
});

test('пример 3: цели, недостижимость маржи и оттока, порядок', () => {
  const r = view.describe(raw('10', '70', '5', '100'), {});
  assert.deepEqual(
    ['price', 'cac', 'churn', 'margin'].map((k) => [row(r, k).target, row(r, k).change, row(r, k).reachable]),
    [
      ['21,43', '+114,30%', true],
      ['46,66', '−53,34%', true],
      ['—', 'недостижимо', false],
      ['150%', 'недостижимо', false]
    ]
  );
  assert.deepEqual(ranks(r), { price: 2, cac: 1, churn: null, margin: null });
  assert.match(row(r, 'churn').reason, /Окупаемость от оттока не зависит/);
  assert.match(r.changes.start, /^Проще всего начать с CAC/);
  assert.match(r.changes.orderText, /Одним изменением недостижимо: отток, маржа\./);
});

test('смена трудности меняет порядок: цена легко, CAC трудно', () => {
  const r = view.describe(raw('10', '70', '5', '100'), { price: 'easy', cac: 'hard' });
  assert.deepEqual(ranks(r), { price: 1, cac: 2, churn: null, margin: null });
  assert.equal(row(r, 'price').scoreText, 'Оценка: 114,30 × 1 (легко) = 114,30');
  assert.equal(row(r, 'cac').scoreText, 'Оценка: 53,34 × 3 (трудно) = 160,02');
  assert.match(r.changes.start, /^Проще всего начать с цены: трудность отмечена как «легко», нужное изменение \+114,30%\./);
});

test('пример 4: цели и порядок CAC, маржа, цена', () => {
  const r = view.describe(raw('10', '50', '2', '80'), {});
  assert.deepEqual(
    ['price', 'cac', 'churn', 'margin'].map((k) => [row(r, k).current, row(r, k).target, row(r, k).change]),
    [
      ['10', '13,34', '+33,40%'],
      ['80', '60,00', '−25,00%'],
      ['2%', '—', 'недостижимо'],
      ['50%', '66,67%', '+33,34%']
    ]
  );
  assert.deepEqual(ranks(r), { price: 3, cac: 1, churn: null, margin: 2 });
  assert.equal(row(r, 'margin').formula, 'max(3 × 80 × 0,02 ÷ 10 ; 80 ÷ (12 × 10)) × 100 = 66,67% (округлено вверх)');
  assert.equal(row(r, 'margin').changeFormula, '(66,67 − 50) ÷ 50 × 100 = +33,34%');
});

test('пример 2: таблицы нет', () => {
  const r = view.describe(raw('10', '80', '3', '40'), {});
  assert.equal(r.changes, null);
});

test('пользовательский порог попадает в формулы таблицы', () => {
  const r = view.describe(raw('10', '70', '6', '60', '2', '6'), {});
  assert.equal(row(r, 'price').target, '14,29');
  assert.equal(row(r, 'price').change, '+42,90%');
  assert.match(row(r, 'price').formula, /^max\(2 × 60 × 0,06 ÷ 0,70 ; 60 ÷ \(6 × 0,70\)\)/);
});

test('цель меньше 0,01 показана словами, а не нулём', () => {
  const r = view.describe(raw('0,01', '1', '100', '1'), {});
  assert.equal(row(r, 'cac').reachable, false);
  assert.equal(row(r, 'cac').target, '—');
  assert.equal(row(r, 'cac').change, 'недостижимо');
  assert.match(row(r, 'cac').reason, /меньше 0,01/);
  assert.equal(row(r, 'margin').target, '30000%');
  assert.equal(row(r, 'price').target, '300,00');
  assert.deepEqual(ranks(r), { price: 1, cac: null, churn: null, margin: null });
});
