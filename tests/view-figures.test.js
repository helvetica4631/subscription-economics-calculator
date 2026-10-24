const test = require('node:test');
const assert = require('node:assert/strict');
const view = require('../src/view.js');

function raw(price, margin, churn, cac, R = '3', T = '12') {
  return { price, margin, churn, cac, ratioThreshold: R, paybackThreshold: T };
}

function figure(result, key) {
  return result.figures.find((f) => f.key === key);
}

test('пример 1: цифры, формулы с подстановкой, вердикт', () => {
  const r = view.describe(raw('10', '70', '6', '60'), {});
  assert.equal(r.ok, true);
  assert.deepEqual(r.figures.map((f) => f.key), ['ltv', 'ltvCac', 'payback', 'lifetime']);
  assert.equal(figure(r, 'ltv').value, '116,67');
  assert.equal(figure(r, 'ltv').formula, 'цена × маржа ÷ отток = 10 × 0,70 ÷ 0,06 = 116,67');
  assert.equal(figure(r, 'ltvCac').value, '1,94');
  assert.equal(figure(r, 'ltvCac').formula, 'LTV ÷ CAC = 116,67 ÷ 60 = 1,94');
  assert.deepEqual(figure(r, 'ltvCac').tag, { text: 'порог 3 не пройден', pass: false });
  assert.equal(figure(r, 'payback').value, '8,6 месяца');
  assert.equal(figure(r, 'payback').formula, 'CAC ÷ (цена × маржа) = 60 ÷ (10 × 0,70) = 8,57');
  assert.deepEqual(figure(r, 'payback').tag, { text: 'порог 12 пройден', pass: true });
  assert.equal(figure(r, 'lifetime').value, '16,7 месяца');
  assert.equal(figure(r, 'lifetime').formula, '1 ÷ отток = 1 ÷ 0,06 = 16,67');
  assert.equal(r.verdict.kind, 'wait');
  assert.equal(r.verdict.title, 'Пока нет');
  assert.match(r.verdict.text, /LTV\/CAC равен 1,94 при пороге 3: не проходит\./);
  assert.match(r.verdict.text, /Окупаемость 8,6 месяца укладывается в 12\./);
  assert.match(r.verdict.text, /Не проходит один порог из двух\./);
  assert.equal(r.warning, null);
});

test('пример 2: масштабировать, изменения не нужны', () => {
  const r = view.describe(raw('10', '80', '3', '40'), {});
  assert.equal(figure(r, 'ltv').value, '266,67');
  assert.equal(figure(r, 'ltvCac').value, '6,67');
  assert.equal(figure(r, 'payback').value, '5,0 месяца');
  assert.equal(r.verdict.kind, 'scale');
  assert.equal(r.verdict.title, 'Масштабировать');
  assert.match(r.verdict.text, /Оба порога пройдены/);
  assert.match(r.noChanges, /Изменения не нужны/);
  assert.equal(r.changes, null);
});

test('пример 3: цифры', () => {
  const r = view.describe(raw('10', '70', '5', '100'), {});
  assert.equal(figure(r, 'ltv').value, '140,00');
  assert.equal(figure(r, 'ltvCac').value, '1,40');
  assert.equal(figure(r, 'payback').value, '14,3 месяца');
  assert.deepEqual(figure(r, 'payback').tag, { text: 'порог 12 не пройден', pass: false });
  assert.match(r.verdict.text, /Не проходят оба порога\./);
});

test('пример 4: проходит LTV/CAC, не проходит окупаемость', () => {
  const r = view.describe(raw('10', '50', '2', '80'), {});
  assert.equal(figure(r, 'ltv').value, '250,00');
  assert.equal(figure(r, 'ltvCac').value, '3,13');
  assert.equal(figure(r, 'payback').value, '16,0 месяца');
  assert.deepEqual(figure(r, 'ltvCac').tag, { text: 'порог 3 пройден', pass: true });
  assert.deepEqual(figure(r, 'payback').tag, { text: 'порог 12 не пройден', pass: false });
  assert.match(r.verdict.text, /Окупаемость 16,0 месяца дольше порога 12\./);
});

test('пример 6: малый отток даёт предупреждение, цифры показаны', () => {
  const r = view.describe(raw('10', '80', '0,5', '40'), {});
  assert.equal(r.ok, true);
  assert.equal(typeof r.warning, 'string');
  assert.match(r.warning, /1%/);
  assert.equal(figure(r, 'ltv').value, '1600,00');
  assert.equal(figure(r, 'ltv').formula, 'цена × маржа ÷ отток = 10 × 0,80 ÷ 0,005 = 1600,00');
  assert.equal(r.verdict.kind, 'scale');
});

test('отток ровно 1% предупреждения не даёт', () => {
  const r = view.describe(raw('10', '80', '1', '40'), {});
  assert.equal(r.warning, null);
});

test('у каждой цифры есть формула и строка «чем полезна»', () => {
  const r = view.describe(raw('10', '70', '6', '60'), {});
  r.figures.forEach((f) => {
    assert.ok(f.label.length > 0, f.key);
    assert.ok(f.formula.includes('='), f.key);
    assert.ok(f.usefulness.length > 10, f.key);
  });
});

test('пояснение к LTV называет введённый порог без неверных склонений', () => {
  const r = view.describe(raw('10', '70', '6', '60', '5', '12'), {});
  assert.match(figure(r, 'ltv').usefulness, /при пороге 5 .*CAC × 5/);
});

test('ошибки ввода: причина у поля, цифр нет', () => {
  const cases = [
    [raw('10', '70', '0', '60'), 'churn', /больше нуля/],
    [raw('10', '101', '6', '60'), 'margin', /100%/],
    [raw('', '70', '6', '60'), 'price', /пустое/],
    [raw('10', '70', '6', '1,000'), 'cac', /Неоднозначная/],
    [raw('10', '70', '6', '60', '0', '12'), 'ratioThreshold', /больше нуля/],
    [raw('10', '70', '6', '60', '3', 'abc'), 'paybackThreshold', /число/]
  ];
  cases.forEach(([input, field, pattern]) => {
    const r = view.describe(input, {});
    assert.equal(r.ok, false, field);
    assert.match(r.errors[field], pattern, field);
    assert.equal(r.figures, undefined, field);
    assert.equal(r.verdict, undefined, field);
  });
});

test('ошибки нескольких полей возвращаются разом', () => {
  const r = view.describe(raw('', '', '', ''), {});
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['cac', 'churn', 'margin', 'price']);
});

test('переполнение даёт общую ошибку, а не цифры', () => {
  const r = view.describe(raw('1' + '0'.repeat(200), '70', '0,' + '0'.repeat(200) + '1', '1'), {});
  assert.equal(r.ok, false);
  assert.equal(typeof r.errors.general, 'string');
  assert.equal(r.figures, undefined);
});

test('рядом с порогом показывается больше знаков, чем 3,00', () => {
  const r = view.describe(raw('29,97', '100', '10', '100'), {});
  assert.equal(figure(r, 'ltvCac').value, '2,997');
  assert.equal(figure(r, 'ltvCac').formula, 'LTV ÷ CAC = 299,70 ÷ 100 = 2,997');
  assert.equal(r.verdict.kind, 'wait');
  assert.match(r.verdict.text, /LTV\/CAC равен 2,997 при пороге 3: не проходит\./);
});

test('окупаемость чуть дольше порога показывается с добавочными знаками', () => {
  const r = view.describe(raw('10', '50', '2', '60,0020'), {});
  assert.equal(figure(r, 'payback').value, '12,0004 месяца');
  assert.equal(figure(r, 'payback').formula, 'CAC ÷ (цена × маржа) = 60,002 ÷ (10 × 0,50) = 12,0004');
  assert.equal(r.verdict.kind, 'wait');
});

test('границы включительные: ровно 3,00 и 12,0 дают «масштабировать»', () => {
  const ratio = view.describe(raw('12', '50', '10', '20'), {});
  assert.equal(figure(ratio, 'ltvCac').value, '3,00');
  assert.equal(ratio.verdict.kind, 'scale');
  const payback = view.describe(raw('10', '50', '2', '60'), {});
  assert.equal(figure(payback, 'payback').value, '12,0 месяца');
  assert.equal(payback.verdict.kind, 'scale');
});

test('доли в формуле показываются без потери знаков', () => {
  const r = view.describe(raw('10', '65,5', '0,5', '40'), {});
  assert.equal(figure(r, 'ltv').formula, 'цена × маржа ÷ отток = 10 × 0,655 ÷ 0,005 = 1310,00');
});

test('пороги в текстах берутся из ввода', () => {
  const r = view.describe(raw('10', '70', '6', '60', '2,5', '6'), {});
  assert.deepEqual(figure(r, 'ltvCac').tag, { text: 'порог 2,5 не пройден', pass: false });
  assert.deepEqual(figure(r, 'payback').tag, { text: 'порог 6 не пройден', pass: false });
  assert.match(r.verdict.text, /Не проходят оба порога\./);
});

test('смена порога меняет вердикт на тех же цифрах', () => {
  assert.equal(view.describe(raw('10', '70', '6', '60', '3', '12'), {}).verdict.kind, 'wait');
  assert.equal(view.describe(raw('10', '70', '6', '60', '1,9', '12'), {}).verdict.kind, 'scale');
});
