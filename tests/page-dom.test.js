const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { render } = require('../scripts/build.js');

function makeNode(tag) {
  const node = {
    tagName: tag.toUpperCase(),
    hidden: false,
    textContent: '',
    className: '',
    value: '',
    children: [],
    attrs: {},
    listeners: {},
    slots: {},
    setAttribute(name, value) { node.attrs[name] = value; },
    getAttribute(name) { return node.attrs[name]; },
    appendChild(child) { node.children.push(child); return child; },
    addEventListener(type, fn) { node.listeners[type] = fn; },
    querySelector(selector) {
      if (!node.slots[selector]) {
        node.slots[selector] = makeNode(selector.startsWith('td') ? 'td' : 'div');
      }
      return node.slots[selector];
    }
  };
  return node;
}

function loadPage() {
  const nodes = {};
  const selectors = {};
  const defaults = { ratioThreshold: '3', paybackThreshold: '12', 'diff-price': 'medium', 'diff-cac': 'medium', 'diff-churn': 'medium', 'diff-margin': 'medium' };
  const document = {
    getElementById(id) {
      if (!nodes[id]) {
        nodes[id] = makeNode('div');
        nodes[id].value = defaults[id] || '';
        nodes[id].hidden = id.startsWith('err-') || id === 'results' || id === 'warning' || id === 'nochanges';
      }
      return nodes[id];
    },
    querySelector(selector) {
      if (!selectors[selector]) {
        selectors[selector] = makeNode('tbody');
      }
      return selectors[selector];
    },
    createElement: makeNode,
    createTextNode(text) { return { textContent: text }; }
  };
  const context = vm.createContext({ document });
  const scripts = [...render().matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  scripts.forEach((code) => vm.runInContext(code, context));
  const byId = (id) => document.getElementById(id);
  function type(id, value) {
    byId(id).value = value;
    byId('form').listeners.input({ target: { id } });
  }
  return { byId, type };
}

function fillExample1(page) {
  page.type('price', '10');
  page.type('margin', '70');
  page.type('churn', '6');
  page.type('cac', '60');
}

test('при открытии цифры скрыты, показана подсказка', () => {
  const page = loadPage();
  assert.equal(page.byId('results').hidden, true);
  assert.equal(page.byId('pending').hidden, false);
  assert.match(page.byId('pending-text').textContent, /Введите все четыре показателя/);
});

test('корректный ввод показывает вердикт и четыре цифры', () => {
  const page = loadPage();
  fillExample1(page);
  assert.equal(page.byId('results').hidden, false);
  assert.equal(page.byId('pending').hidden, true);
  assert.equal(page.byId('verdict-title').textContent, 'Пока нет');
  assert.equal(page.byId('figures').children.length, 4);
});

test('ошибка в поле после корректного ввода скрывает вердикт и цифры и показывает причину у поля', () => {
  const page = loadPage();
  fillExample1(page);
  page.type('churn', '0');
  assert.equal(page.byId('results').hidden, true);
  assert.equal(page.byId('pending').hidden, false);
  assert.equal(page.byId('err-churn').hidden, false);
  assert.equal(page.byId('err-churn').textContent, 'Должно быть больше нуля.');
  assert.equal(page.byId('churn').attrs['aria-invalid'], 'true');
  assert.match(page.byId('pending-text').textContent, /Цифры и вердикт скрыты/);
  page.type('churn', '6');
  assert.equal(page.byId('results').hidden, false);
  assert.equal(page.byId('err-churn').hidden, true);
});

test('ошибка порога скрывает вердикт и цифры', () => {
  const page = loadPage();
  fillExample1(page);
  page.type('ratioThreshold', '');
  assert.equal(page.byId('results').hidden, true);
  assert.equal(page.byId('err-ratioThreshold').hidden, false);
});

test('переполнение показывает общую ошибку и скрывает цифры', () => {
  const page = loadPage();
  fillExample1(page);
  page.byId('churn').value = '0,' + '0'.repeat(150) + '1';
  page.type('price', '1' + '0'.repeat(200));
  assert.equal(page.byId('results').hidden, true);
  assert.equal(page.byId('err-general').hidden, false);
  assert.match(page.byId('err-general').textContent, /слишком/);
});

test('смена трудности из селекта меняет порядок без перезагрузки', () => {
  const page = loadPage();
  fillExample1(page);
  page.byId('diff-price').value = 'easy';
  page.byId('diff-cac').value = 'hard';
  page.byId('diff-churn').value = 'hard';
  page.byId('diff-margin').value = 'hard';
  page.type('price', '10');
  assert.match(page.byId('start').textContent, /^Проще всего начать с цены: трудность отмечена как «легко»/);
  page.byId('diff-price').value = 'hard';
  page.byId('diff-cac').value = 'easy';
  page.type('price', '10');
  assert.match(page.byId('start').textContent, /^Проще всего начать с CAC: трудность отмечена как «легко»/);
});

test('предупреждение об оттоке ниже 1% выводится, при обычном оттоке скрыто', () => {
  const page = loadPage();
  fillExample1(page);
  assert.equal(page.byId('warning').hidden, true);
  page.type('churn', '0,5');
  assert.equal(page.byId('warning').hidden, false);
  assert.match(page.byId('warning').textContent, /Отток ниже 1%/);
});
