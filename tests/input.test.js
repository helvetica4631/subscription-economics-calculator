const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../src/calc.js');

const good = { price: '10', margin: '70', churn: '6', cac: '60', ratioThreshold: '3', paybackThreshold: '12' };
const withField = (field, value) => Object.assign({}, good, { [field]: value });

test('parseNumber принимает допустимый формат', () => {
  const cases = [
    ['10', 10], ['10,5', 10.5], ['10.5', 10.5], [' 1 000 ', 1000], ['.5', 0.5], ['5.', 5],
    [7, 7], ['1\u00a0000', 1000], ['0,0', 0]
  ];
  for (const [input, expected] of cases) {
    const r = calc.parseNumber(input);
    assert.equal(r.ok, true, JSON.stringify(input));
    assert.equal(r.value, expected, JSON.stringify(input));
  }
});

test('parseNumber отклоняет пустое, текст и запрещённые форматы с причиной', () => {
  const bad = ['', '   ', null, undefined, 'abc', '5%', '1e3', '1E3', 'Infinity', '1,2,3', '1.2.3', '1,000.5', '+5', '--5', '5-', ',', '.', '1\u2212', '9'.repeat(400)];
  for (const input of bad) {
    const r = calc.parseNumber(input);
    assert.equal(r.ok, false, JSON.stringify(input));
    assert.equal(typeof r.error, 'string');
    assert.ok(r.error.length > 0);
  }
});

test('parseNumber: пустое и текст дают разные причины', () => {
  assert.match(calc.parseNumber('').error, /пуст/i);
  assert.match(calc.parseNumber('abc').error, /число/i);
});

test('parseNumber: отрицательное число разбирается, а не считается текстом', () => {
  const r = calc.parseNumber('-5');
  assert.equal(r.ok, true);
  assert.equal(r.value, -5);
});

test('validateInputs: корректный ввод переводит проценты в доли', () => {
  const r = calc.validateInputs(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.values, { p: 10, m: 0.7, c: 0.06, k: 60, R: 3, T: 12 });
});

test('validateInputs: ноль и минус - ошибка "больше нуля" в каждом поле', () => {
  for (const field of Object.keys(good)) {
    for (const value of ['0', '0,0', '-5', '-0']) {
      const r = calc.validateInputs(withField(field, value));
      assert.equal(r.ok, false, field + ' ' + value);
      assert.match(r.errors[field], /больше нуля/, field + ' ' + value);
      assert.deepEqual(Object.keys(r.errors), [field]);
    }
  }
});

test('validateInputs: пустое поле - ошибка у этого поля', () => {
  for (const field of Object.keys(good)) {
    const r = calc.validateInputs(withField(field, ''));
    assert.equal(r.ok, false);
    assert.deepEqual(Object.keys(r.errors), [field]);
    assert.match(r.errors[field], /пуст/i);
  }
});

test('validateInputs: маржа и отток 100 допустимы, выше 100 - ошибка', () => {
  for (const field of ['margin', 'churn']) {
    assert.equal(calc.validateInputs(withField(field, '100')).ok, true);
    for (const value of ['100,0001', '101', '1000']) {
      const r = calc.validateInputs(withField(field, value));
      assert.equal(r.ok, false, field + ' ' + value);
      assert.match(r.errors[field], /100/);
    }
  }
});

test('validateInputs: цена, CAC и пороги могут быть больше 100', () => {
  const r = calc.validateInputs({ price: '500', margin: '70', churn: '6', cac: '1000', ratioThreshold: '300', paybackThreshold: '120' });
  assert.equal(r.ok, true);
});

test('validateInputs: сразу все ошибки, без цифр в результате', () => {
  const r = calc.validateInputs({ price: '', margin: '101', churn: '0', cac: 'abc', ratioThreshold: '-1', paybackThreshold: '5%' });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['cac', 'churn', 'margin', 'paybackThreshold', 'price', 'ratioThreshold']);
  assert.equal(r.values, undefined);
});

test('validateInputs: отсутствующее поле объекта - ошибка пустого поля', () => {
  const r = calc.validateInputs({ price: '10', margin: '70', churn: '6', cac: '60', ratioThreshold: '3' });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors), ['paybackThreshold']);
});

test('parseNumber отклоняет неоднозначные записи "1-3 цифры, разделитель, ровно три цифры"', () => {
  for (const input of ['1,000', '1.000', '12.500', '123,456', '0,500', ' 1 ,000', '-1,000']) {
    const r = calc.parseNumber(input);
    assert.equal(r.ok, false, input);
    assert.match(r.error, /тысяч/, input);
  }
});

test('parseNumber принимает записи, не подпадающие под неоднозначные', () => {
  const cases = [['1000', 1000], ['1,5', 1.5], ['1,50', 1.5], ['1,5000', 1.5], ['1234,567', 1234.567], ['.500', 0.5], ['1 000', 1000], ['1,0', 1], [0.001, 0.001]];
  for (const [input, expected] of cases) {
    const r = calc.parseNumber(input);
    assert.equal(r.ok, true, JSON.stringify(input));
    assert.equal(r.value, expected, JSON.stringify(input));
  }
});

test('validateInputs: неоднозначная запись CAC даёт ошибку у поля, цифр нет', () => {
  const r = calc.validateInputs(withField('cac', '1,500'));
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors), ['cac']);
  assert.match(r.errors.cac, /тысяч/);
  assert.equal(calc.calculate(withField('cac', '1.000')).ok, false);
});
