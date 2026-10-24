const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../src/calc.js');

function mulberry32(seed) {
  let a = seed;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shown = (x) => calc.formatRu(x, 2);
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];

function inputs(p, m, c, k, R, T) {
  return { price: String(p), margin: String(m), churn: String(c), cac: String(k), ratioThreshold: String(R), paybackThreshold: String(T) };
}

function checkRoundTrip(p, m, c, k, R, T) {
  const label = JSON.stringify([p, m, c, k, R, T]);
  const base = calc.calculate(inputs(p, m, c, k, R, T));
  if (!base.ok || base.verdict !== 'wait') return 0;
  const ch = base.changes;
  let checked = 0;
  const variants = {
    price: (t) => inputs(t, m, c, k, R, T),
    margin: (t) => inputs(p, t, c, k, R, T),
    cac: (t) => inputs(p, m, c, t, R, T),
    churn: (t) => inputs(p, m, t, k, R, T)
  };
  for (const key of Object.keys(variants)) {
    if (ch[key].status !== 'needed') continue;
    const back = calc.calculate(variants[key](shown(ch[key].target)));
    assert.equal(back.ok, true, label + ' ' + key + ' ' + shown(ch[key].target));
    assert.equal(back.verdict, 'scale', label + ' ' + key + ' ' + shown(ch[key].target));
    checked++;
  }
  return checked;
}

test('показанные цели, подставленные обратно, дают "масштабировать": случайные вводы', () => {
  const rnd = mulberry32(20261022);
  let total = 0;
  for (let i = 0; i < 6000; i++) {
    const p = calc.roundHalfUp(0.5 + rnd() * 200, 2);
    const m = calc.roundHalfUp(1 + rnd() * 99, 2);
    const c = calc.roundHalfUp(0.1 + rnd() * 30, 2);
    const k = calc.roundHalfUp(0.5 + rnd() * 600, 2);
    const R = pick(rnd, [3, 3, 3, 2, 2.5, 4, 1.5]);
    const T = pick(rnd, [12, 12, 12, 6, 9, 24]);
    total += checkRoundTrip(p, m, c, k, R, T);
  }
  assert.ok(total > 5000, 'проверено целей: ' + total);
});

test('показанные цели, подставленные обратно, дают "масштабировать": вводы у границ порогов', () => {
  const rnd = mulberry32(7);
  let total = 0;
  for (let i = 0; i < 3000; i++) {
    const p = calc.roundHalfUp(1 + rnd() * 100, 2);
    const m = calc.roundHalfUp(5 + rnd() * 95, 2);
    const c = calc.roundHalfUp(0.5 + rnd() * 20, 2);
    const R = pick(rnd, [3, 2, 4]);
    const ltv = (p * (m / 100)) / (c / 100);
    const kRatio = ltv / R;
    const kPayback = 12 * p * (m / 100);
    const base = pick(rnd, [kRatio, kPayback]);
    const k = calc.roundHalfUp(base * (1 + (rnd() - 0.5) * 0.02), pick(rnd, [2, 3, 4]));
    if (k > 0) total += checkRoundTrip(p, m, c, k, R, 12);
  }
  assert.ok(total > 1000, 'проверено целей: ' + total);
});

test('цель CAC или оттока, округлившаяся до нуля, помечена недостижимой, а не нулём', () => {
  const r = calc.calculate(inputs(1, 1, 50, 100000, 3, 12));
  assert.equal(r.ok, true);
  assert.equal(r.changes.cac.status, 'unreachable');
  assert.equal(r.changes.cac.reason, 'zero');
  const q = calc.calculate(inputs(1, 100, 50, 1000, 1000, 1000));
  assert.equal(q.verdict, 'wait');
  assert.equal(q.changes.churn.status, 'unreachable');
  assert.equal(q.changes.churn.reason, 'zero');
});

test('проценты изменения считаются от округлённой цели', () => {
  const r = calc.calculate(inputs(10, 70, 6, 60, 3, 12));
  assert.equal(r.changes.price.changePct, 54.3);
  assert.equal(r.changes.cac.changePct, -35.2);
  assert.equal(r.changes.churn.changePct, -35.33);
  assert.equal(r.changes.price.target, 15.43);
  assert.equal(r.changes.cac.target, 38.88);
  assert.equal(r.changes.churn.target, 3.88);
});

test('точное (неокруглённое) изменение отдаётся для показа у нуля', () => {
  const r = calc.calculate(inputs(10, 50, 2, '60,0001', 3, 12));
  assert.equal(r.verdict, 'wait');
  assert.equal(r.changes.cac.changePct, 0);
  assert.ok(r.changes.cac.changePctExact < 0);
  assert.ok(Math.abs(r.changes.cac.changePctExact) < 0.005);
});
