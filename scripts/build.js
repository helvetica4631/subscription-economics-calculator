const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function render(sources) {
  const calc = sources && sources.calc !== undefined ? sources.calc : fs.readFileSync(path.join(root, 'src', 'calc.js'), 'utf8');
  const view = sources && sources.view !== undefined ? sources.view : fs.readFileSync(path.join(root, 'src', 'view.js'), 'utf8');
  [calc, view].forEach((code) => {
    if (/<\/script/i.test(code)) {
      throw new Error('Код содержит закрывающий тег script и сломает страницу');
    }
  });
  const template = fs.readFileSync(path.join(root, 'src', 'page.template.html'), 'utf8');
  return template.replace('{{CALC}}', () => calc).replace('{{VIEW}}', () => view);
}

if (require.main === module) {
  fs.writeFileSync(path.join(root, 'index.html'), render());
}

module.exports = { render };
