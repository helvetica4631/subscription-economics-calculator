const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../src/calc.js');

function run(price, margin, churn, cac, R = '3', T = '12') {
  return calc.calculate({ price: String(price), margin: String(margin), churn: String(churn), cac: String(cac), ratioThreshold: R, paybackThreshold: T });
}
const r2 = (x) => calc.roundHalfUp(x, 2);
const r1 = (x) => calc.roundHalfUp(x, 1);

test('пример 1: цифры и вердикт "пока нет"', () => {
  const r = run(10, 70, 6, 60);
  assert.equal(r.ok, true);
  assert.equal(r2(r.lifetime), 16.67);
  assert.equal(r2(r.ltv), 116.67);
  assert.equal(r2(r.ltvCac), 1.94);
  assert.equal(r2(r.payback), 8.57);
  assert.equal(r1(r.payback), 8.6);
  assert.equal(r.verdict, 'wait');
  assert.equal(r.ratioPass, false);
  assert.equal(r.paybackPass, true);
  assert.equal(r.noChangesNeeded, false);
  assert.equal(r.lowChurnWarning, false);
});

test('пример 2: "масштабировать", изменения не нужны, changes пусто', () => {
  const r = run(10, 80, 3, 40);
  assert.equal(r2(r.ltv), 266.67);
  assert.equal(r2(r.ltvCac), 6.67);
  assert.equal(r1(r.payback), 5);
  assert.equal(r.verdict, 'scale');
  assert.equal(r.noChangesNeeded, true);
  assert.equal(r.changes, null);
});

test('пример 6: отток 0,5 - предупреждение и цифры', () => {
  const r = run(10, 80, '0,5', 40);
  assert.equal(r.ok, true);
  assert.equal(r.lowChurnWarning, true);
  assert.equal(r2(r.lifetime), 200);
  assert.equal(r2(r.ltv), 1600);
  assert.equal(r.verdict, 'scale');
});

test('предупреждение: ровно 1% нет, 0,99% есть, при "пока нет" тоже', () => {
  assert.equal(run(10, 80, 1, 40).lowChurnWarning, false);
  assert.equal(run(10, 80, '0,99', 40).lowChurnWarning, true);
  const waiting = run(10, 80, '0,5', 100000);
  assert.equal(waiting.verdict, 'wait');
  assert.equal(waiting.lowChurnWarning, true);
});

test('пример 7: LTV/CAC ровно 3 - "масштабировать"', () => {
  const r = run(12, 50, 10, 20);
  assert.equal(r2(r.ltv), 60);
  assert.equal(r2(r.ltvCac), 3);
  assert.equal(r1(r.payback), 3.3);
  assert.equal(r.ratioPass, true);
  assert.equal(r.verdict, 'scale');
});

test('пример 8: окупаемость ровно 12 - "масштабировать"', () => {
  const r = run(10, 50, 2, 60);
  assert.equal(r2(r.ltv), 250);
  assert.equal(r2(r.ltvCac), 4.17);
  assert.equal(r1(r.payback), 12);
  assert.equal(r.paybackPass, true);
  assert.equal(r.verdict, 'scale');
});

test('допуск не прощает заметную разницу у порогов', () => {
  const lowRatio = run(10, 50, 10, '16,7');
  assert.equal(lowRatio.ratioPass, false);
  assert.equal(lowRatio.verdict, 'wait');
  assert.equal(run(10, 50, 10, '16,6').verdict, 'scale');
  const slowPayback = run(10, 50, 2, '60,1');
  assert.equal(slowPayback.ratioPass, true);
  assert.equal(slowPayback.paybackPass, false);
  assert.equal(slowPayback.verdict, 'wait');
  assert.equal(run(10, 50, 2, '59,9').verdict, 'scale');
});

test('пример 4: "пока нет" только из-за окупаемости', () => {
  const r = run(10, 50, 2, 80);
  assert.equal(r2(r.ltvCac), 3.13);
  assert.equal(r1(r.payback), 16);
  assert.equal(r.ratioPass, true);
  assert.equal(r.paybackPass, false);
  assert.equal(r.verdict, 'wait');
});

test('вердикт требует оба порога, пороги берутся из ввода', () => {
  assert.equal(run(10, 70, 6, 60, '1,9', '9').verdict, 'scale');
  assert.equal(run(10, 70, 6, 60, '1,9', '8').verdict, 'wait');
  assert.equal(run(10, 70, 6, 60, '2', '9').verdict, 'wait');
  assert.equal(run(10, 70, 6, 60, '1,9', '8').paybackPass, false);
  assert.equal(run(10, 70, 6, 60, '2', '9').ratioPass, false);
});

test('значения возвращаются в долях', () => {
  const r = run(10, 70, 6, 60);
  assert.deepEqual(r.values, { p: 10, m: 0.7, c: 0.06, k: 60, R: 3, T: 12 });
});

test('пример 5: некорректный ввод даёт ошибки и ни одной цифры', () => {
  for (const r of [run(10, 80, 0, 40), run(10, 101, 3, 40), run('', 80, 3, 40)]) {
    assert.equal(r.ok, false);
    assert.ok(Object.keys(r.errors).length > 0);
    for (const key of ['ltv', 'ltvCac', 'payback', 'lifetime', 'verdict', 'changes', 'values']) {
      assert.equal(r[key], undefined, key);
    }
  }
  assert.ok(run(10, 80, 0, 40).errors.churn);
  assert.ok(run(10, 101, 3, 40).errors.margin);
  assert.ok(run('', 80, 3, 40).errors.price);
});

test('переполнение результата - ошибка, а не Infinity', () => {
  const r = run('1' + '0'.repeat(300), 70, '0.' + '0'.repeat(299) + '1', 60);
  assert.equal(r.ok, false);
  assert.equal(typeof r.errors.general, 'string');
  assert.equal(r.ltv, undefined);
});

test('отток, отличающийся от 1% на ошибку дробных чисел, не даёт предупреждения', () => {
  assert.equal(run(10, 80, '0,99999999999', 40).lowChurnWarning, false);
  assert.equal(run(10, 80, '0,9999', 40).lowChurnWarning, true);
});

test('LTV/CAC 2,995-2,999 ниже порога 3: "пока нет"', () => {
  for (const cac of ['16,6722', '16,6751', '16,68', '16,6849', '16,69']) {
    const r = run(10, 50, 10, cac);
    assert.equal(r.verdict, 'wait', cac);
    assert.equal(r.ratioPass, false, cac);
    assert.ok(r.ltvCac >= 2.995 && r.ltvCac < 3, cac + ' ' + r.ltvCac);
  }
});

test('окупаемость 12,001-12,04 выше порога 12: "пока нет"', () => {
  for (const cac of ['60,0051', '60,01', '60,02', '60,05', '60,2']) {
    const r = run(10, 50, 2, cac);
    assert.equal(r.verdict, 'wait', cac);
    assert.equal(r.paybackPass, false, cac);
    assert.ok(r.payback > 12.0009 && r.payback < 12.05, cac + ' ' + r.payback);
  }
});

test('допуск сравнения относительный: малый порог и большой порог', () => {
  const small = run(1000, 100, 10, '1,0000001', 3, '0,0010');
  assert.equal(small.paybackPass, false);
  assert.equal(small.verdict, 'wait');
  const large = run(1, 100, 100, '0,0000010000000005', '1000000', 12);
  assert.equal(large.ratioPass, true);
  assert.equal(large.verdict, 'scale');
});
