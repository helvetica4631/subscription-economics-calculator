const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('calc.js работает как обычный скрипт без module/require (как в браузере)', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc.js'), 'utf8');
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const api = sandbox.SubEconCalc;
  assert.equal(typeof api, 'object');
  const r = api.calculate({ price: '10', margin: '70', churn: '6', cac: '60', ratioThreshold: '3', paybackThreshold: '12' });
  assert.equal(r.ok, true);
  assert.equal(api.roundHalfUp(r.ltv, 2), 116.67);
  assert.equal(r.changes.price.changePct, 54.3);
  assert.equal(api.rankChanges(r.changes, { price: 'easy', cac: 'medium', churn: 'medium', margin: 'hard' }).first, 'price');
});
