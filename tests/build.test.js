const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const build = require('../scripts/build.js');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('index.html равен результату сборки из шаблона и src/*.js', () => {
  assert.equal(read('index.html'), build.render());
});

test('в index.html вставлен исходный код calc.js и view.js без изменений', () => {
  const page = read('index.html');
  assert.ok(page.includes(read('src/calc.js')));
  assert.ok(page.includes(read('src/view.js')));
});

test('вставленные скрипты работают как обычные скрипты страницы', () => {
  const page = read('index.html');
  const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 3);
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(scripts[0], sandbox);
  vm.runInContext(scripts[1], sandbox);
  const r = sandbox.SubEconView.describe(
    { price: '10', margin: '70', churn: '6', cac: '60', ratioThreshold: '3', paybackThreshold: '12' },
    {}
  );
  assert.equal(r.figures[0].value, '116,67');
  assert.equal(r.changes.rows[0].target, '15,43');
});

test('сборка отказывается вставлять код с закрывающим тегом script', () => {
  assert.throws(() => build.render({ calc: 'var a = "</script>";', view: '' }), /script/);
});

test('сборка подставляет переданный код в шаблон', () => {
  const page = build.render({ calc: 'var CALC_MARK = 1;', view: 'var VIEW_MARK = 2;' });
  assert.ok(page.includes('var CALC_MARK = 1;'));
  assert.ok(page.includes('var VIEW_MARK = 2;'));
  assert.ok(!page.includes('{{CALC}}'));
  assert.ok(!page.includes('{{VIEW}}'));
});

test('код с символами подстановки $& вставляется как есть', () => {
  const page = build.render({ calc: 'var a = "$&$1$`";', view: '' });
  assert.ok(page.includes('var a = "$&$1$`";'));
});
