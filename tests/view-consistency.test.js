const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../src/calc.js');
const view = require('../src/view.js');

function raw(price, margin, churn, cac, R = '3', T = '12') {
  return { price, margin, churn, cac, ratioThreshold: R, paybackThreshold: T };
}

function figure(result, key) {
  return result.figures.find((f) => f.key === key);
}

function num(text) {
  return Number(text.replace(',', '.'));
}

function decimals(text) {
  const i = text.indexOf(',');
  return i === -1 ? 0 : text.length - i - 1;
}

function lastValue(formula) {
  return formula.split(' = ').pop();
}

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function fmt(x, d) {
  return x.toFixed(d).replace('.', ',');
}

test('LTV ÷ CAC: подставленные числа дают показанный результат (9,9999 / 60 / 2 / 100)', () => {
  const r = view.describe(raw('9,9999', '60', '2', '100'), {});
  const f = figure(r, 'ltvCac');
  assert.equal(f.value, '2,99997');
  assert.equal(f.formula, 'LTV ÷ CAC = 299,997 ÷ 100 = 2,99997');
  assert.equal(figure(r, 'ltv').value, '299,997');
});

test('подстановки сходятся с результатом на 20000 случайных вводов', () => {
  const rnd = seeded(12345);
  const bad = [];
  for (let i = 0; i < 20000; i++) {
    const p = (0.5 + rnd() * 200).toFixed(2).replace('.', ',');
    const m = (1 + rnd() * 99).toFixed(2).replace('.', ',');
    const c = (0.5 + rnd() * 20).toFixed(2).replace('.', ',');
    const k = (1 + rnd() * 500).toFixed(2).replace('.', ',');
    const r = view.describe(raw(p, m, c, k), {});
    if (!r.ok) continue;
    const ltvCac = figure(r, 'ltvCac');
    const parts = lastValue(ltvCac.formula);
    const body = ltvCac.formula.replace('LTV ÷ CAC = ', '').split(' = ')[0].split(' ÷ ');
    const ratio = fmt(calc.roundHalfUp(num(body[0]) / num(body[1]), decimals(parts)), decimals(parts));
    if (ratio !== parts || parts !== ltvCac.value) bad.push([p, m, c, k, ltvCac.formula]);
    const pay = figure(r, 'payback');
    const payFormula = lastValue(pay.formula);
    const payValue = pay.value.replace(' месяца', '');
    if (fmt(calc.roundHalfUp(num(payFormula), decimals(payValue)), decimals(payValue)) !== payValue) bad.push([p, m, c, k, pay.value, pay.formula]);
    const life = figure(r, 'lifetime');
    const lifeFormula = lastValue(life.formula);
    const lifeValue = life.value.replace(' месяца', '');
    if (fmt(calc.roundHalfUp(num(lifeFormula), decimals(lifeValue)), decimals(lifeValue)) !== lifeValue) bad.push([p, m, c, k, life.value, life.formula]);
    const ltv = figure(r, 'ltv');
    if (lastValue(ltv.formula) !== ltv.value) bad.push([p, m, c, k, ltv.value, ltv.formula]);
  }
  assert.deepEqual(bad.slice(0, 5), []);
});

test('месяцы: значение и итог формулы согласованы (отток 8,1 / цена 10 / маржа 70 / CAC 60)', () => {
  const r = view.describe(raw('10', '70', '8,1', '60'), {});
  const life = figure(r, 'lifetime');
  assert.equal(life.value, '12,3 месяца');
  assert.equal(num(lastValue(life.formula)) < 12.35, true);
  assert.equal(calc.roundHalfUp(num(lastValue(life.formula)), 1), 12.3);
});

test('маржа недостижима, нужно чуть больше 100%: не показывается как 100%', () => {
  const r = view.describe(raw('10', '50', '5', '66,6687'), {});
  const row = r.changes.rows.find((x) => x.key === 'margin');
  assert.equal(row.reachable, false);
  assert.equal(num(row.target.replace('%', '')) > 100, true);
  assert.doesNotMatch(row.reason, /понадобилось бы 100%/);
  assert.equal(num(lastValue(row.formula).replace('%', '')) > 100, true);
});

test('порог окупаемости 12,24 и окупаемость 12,245: показанное значение по ту же сторону порога', () => {
  const r = view.describe(raw('10', '50', '2', '61,2251', '3', '12,24'), {});
  assert.match(r.verdict.text, /Окупаемость 12,25 месяца дольше порога 12,24\./);
  assert.equal(figure(r, 'payback').value, '12,25 месяца');
});

test('порог LTV/CAC 3,0349 пройден значением 3,03498: показанное значение не ниже порога', () => {
  const r = view.describe(raw('10', '50', '10', '16,4745', '3,0349', '12'), {});
  const f = figure(r, 'ltvCac');
  assert.equal(f.tag.pass, true);
  assert.equal(num(f.value) >= 3.0349, true);
  assert.equal(num(figure(r, 'ltv').value) >= 3.0349 * 16.4745 - 1e-9, true);
});

test('окупаемость и срок жизни с одинаковым округлением не называются «короче» при равных цифрах', () => {
  const r = view.describe(raw('10', '50', '6', '83,3'), {});
  const text = figure(r, 'lifetime').usefulness;
  assert.doesNotMatch(text, /Окупаемость 16,7 месяца короче срока жизни/);
  assert.match(text, /Окупаемость 16,66 месяца короче срока жизни 16,67 месяца/);
});

test('порог окупаемости 12,06 пройден значением 12,0599: показанное значение не выше порога', () => {
  const r = view.describe(raw('10', '50', '2', '60,2995', '3', '12,06'), {});
  assert.equal(figure(r, 'payback').tag.pass, true);
  assert.equal(num(figure(r, 'payback').value.replace(' месяца', '')) <= 12.06, true);
  assert.match(r.verdict.text, /Окупаемость 12,06 месяца укладывается в 12,06\./);
});
