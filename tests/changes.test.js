const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../src/calc.js');

function run(price, margin, churn, cac, R = '3', T = '12') {
  return calc.calculate({ price: String(price), margin: String(margin), churn: String(churn), cac: String(cac), ratioThreshold: String(R), paybackThreshold: String(T) });
}
const r2 = (x) => calc.roundHalfUp(x, 2);

function needed(change, target, pct) {
  assert.equal(change.status, 'needed');
  assert.equal(r2(change.target), target);
  assert.equal(change.changePct, pct);
}

test('пример 1: цена, CAC, отток нужны, маржа недостижима (108%)', () => {
  const c = run(10, 70, 6, 60).changes;
  needed(c.price, 15.43, 54.3);
  needed(c.cac, 38.88, -35.2);
  needed(c.churn, 3.88, -35.33);
  assert.equal(c.margin.status, 'unreachable');
  assert.equal(c.margin.reason, 'over100');
  assert.equal(r2(c.margin.target), 108);
});

test('пример 3: маржа недостижима (150%), отток недостижим из-за окупаемости', () => {
  const c = run(10, 70, 5, 100).changes;
  needed(c.price, 21.43, 114.3);
  needed(c.cac, 46.66, -53.34);
  assert.equal(c.margin.status, 'unreachable');
  assert.equal(c.margin.reason, 'over100');
  assert.equal(r2(c.margin.target), 150);
  assert.equal(c.churn.status, 'unreachable');
  assert.equal(c.churn.reason, 'payback');
  assert.equal(c.churn.target, null);
});

test('пример 4: только окупаемость - цена, маржа, CAC нужны, отток недостижим', () => {
  const c = run(10, 50, 2, 80).changes;
  needed(c.price, 13.34, 33.4);
  needed(c.margin, 66.67, 33.34);
  needed(c.cac, 60, -25);
  assert.equal(c.churn.status, 'unreachable');
  assert.equal(c.churn.reason, 'payback');
});

test('пример 2: при "масштабировать" блок изменений не считается', () => {
  assert.equal(run(10, 80, 3, 40).changes, null);
});

test('пороги из ввода влияют на цели (R=2, T=6 на примере 1)', () => {
  const c = run(10, 70, 6, 60, 2, 6).changes;
  needed(c.price, 14.29, 42.9);
  needed(c.margin, 100, 42.86);
  needed(c.cac, 42, -30);
  assert.equal(c.churn.status, 'unreachable');
  assert.equal(c.churn.reason, 'payback');
});

test('маржа ровно 100% достижима, чуть больше - нет', () => {
  const exact = run(15, 50, 50, 10).changes;
  needed(exact.margin, 100, 100);
  needed(exact.price, 30, 100);
  needed(exact.cac, 5, -50);
  needed(exact.churn, 25, -50);
  const over = run(15, 50, 50, '10,0001').changes;
  assert.equal(over.margin.status, 'unreachable');
  assert.equal(over.margin.reason, 'over100');
});

test('отток достижим, пока окупаемость в пределах порога', () => {
  const c = run(10, 70, 6, 60).changes;
  assert.equal(c.churn.status, 'needed');
  const c2 = run(10, 70, 6, 84.5).changes;
  assert.equal(c2.churn.status, 'unreachable');
});

const scenarios = [
  [10, 70, 6, 60, 3, 12],
  [10, 70, 5, 100, 3, 12],
  [10, 50, 2, 80, 3, 12],
  [10, 70, 6, 60, 2, 6],
  [15, 50, 50, 10, 3, 12],
  [25, 35, 8, 90, 4, 9]
];

test('подстановка целевого значения даёт "масштабировать"', () => {
  for (const [p, m, c, k, R, T] of scenarios) {
    const base = run(p, m, c, k, R, T);
    assert.equal(base.verdict, 'wait');
    const ch = base.changes;
    const variants = {
      price: (t) => run(t, m, c, k, R, T),
      margin: (t) => run(p, t, c, k, R, T),
      cac: (t) => run(p, m, c, t, R, T),
      churn: (t) => run(p, m, t, k, R, T)
    };
    for (const key of Object.keys(variants)) {
      if (ch[key].status !== 'needed') continue;
      assert.equal(variants[key](ch[key].target).verdict, 'scale', JSON.stringify([p, m, c, k, R, T]) + ' ' + key);
    }
  }
});

test('цель минимальна: чуть слабее изменение не даёт "масштабировать"', () => {
  for (const [p, m, c, k, R, T] of scenarios) {
    const ch = run(p, m, c, k, R, T).changes;
    if (ch.price.status === 'needed') assert.equal(run(ch.price.target * 0.99, m, c, k, R, T).verdict, 'wait');
    if (ch.margin.status === 'needed') assert.equal(run(p, ch.margin.target * 0.99, c, k, R, T).verdict, 'wait');
    if (ch.cac.status === 'needed') assert.equal(run(p, m, c, ch.cac.target * 1.01, R, T).verdict, 'wait');
    if (ch.churn.status === 'needed') assert.equal(run(p, m, ch.churn.target * 1.01, k, R, T).verdict, 'wait');
  }
});

test('недостижимое помечено только тогда, когда подстановка действительно не помогает', () => {
  const unreachableChurn = run(10, 70, 5, 100);
  for (const c of ['0,01', '0,1', '1', '5']) {
    assert.equal(run(10, 70, c, 100).verdict, 'wait');
  }
  assert.equal(unreachableChurn.changes.churn.status, 'unreachable');
  assert.equal(run(10, 50, 5, 50).changes.margin.status, 'needed');
});

test('маржа 100%, получившаяся с ошибкой дробных чисел (1,0000000000000002), достижима', () => {
  const c = run('5,01', 50, 5, '50,1', 2, 12).changes;
  needed(c.margin, 100, 100);
});

test('отток использует введённый порог R, а не 3', () => {
  const r2c = run(10, 70, 6, 60, 2, 12).changes;
  needed(r2c.churn, 5.83, -2.83);
  const r4c = run(10, 70, 6, 60, 4, 12).changes;
  needed(r4c.churn, 2.91, -51.5);
  needed(run(10, 70, 6, 60, 5, 12).changes.churn, 2.33, -61.17);
});

test('цели округляются в сторону выполнения порога: цена и маржа вверх, CAC и отток вниз', () => {
  const c = run(10, 70, 6, 60).changes;
  assert.ok(c.price.target >= 15.4285715);
  assert.ok(c.cac.target <= 38.8888889);
  assert.ok(c.churn.target <= 3.8888889);
  assert.equal(run(10, 50, 2, 80).changes.margin.target, 66.67);
});

test('цель, точно равная сотым, не теряет сотую из-за дробной ошибки', () => {
  needed(run(1, 69, 50, 5).changes.churn, 4.6, -90.8);
  needed(run(1, 84, 50, 8).changes.churn, 3.5, -93);
  needed(run(2, 42, 50, 8).changes.churn, 3.5, -93);
});
