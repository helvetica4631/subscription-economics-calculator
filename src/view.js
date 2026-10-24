(function (root, factory) {
  var calc = typeof module === 'object' && module && module.exports ? require('./calc.js') : root.SubEconCalc;
  var api = factory(calc);
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.SubEconView = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (calc) {
  function plain(n, minDigits) {
    return Number(n.toPrecision(12)).toLocaleString('ru-RU', {
      useGrouping: false,
      minimumFractionDigits: minDigits || 0,
      maximumFractionDigits: 20
    });
  }

  function share(n) {
    return plain(n, 2);
  }

  function decimalsOf(text) {
    var i = text.indexOf(',');
    return i === -1 ? 0 : text.length - i - 1;
  }

  function toNumber(text) {
    return Number(text.replace(',', '.').replace('−', '-'));
  }

  function fit(format, minDigits, agrees) {
    var text = format(minDigits);
    for (var d = minDigits + 1; d <= 8 && !agrees(text); d++) {
      text = format(d);
    }
    return text;
  }

  function describeFigures(r) {
    var v = r.values;
    var p = plain(v.p);
    var m = share(v.m);
    var c = share(v.c);
    var k = plain(v.k);
    var ltvReference = Number((v.R * v.k).toPrecision(12));
    var ltvText = calc.formatNearThreshold(r.ltv, 2, ltvReference, r.ratioPass, 'atLeast');
    var ratioText = calc.formatNearThreshold(r.ltvCac, 2, v.R, r.ratioPass, 'atLeast');
    var ratioDigits = decimalsOf(ratioText);
    var ltvForRatio = fit(function (d) {
      return calc.formatNearThreshold(r.ltv, d, ltvReference, r.ratioPass, 'atLeast');
    }, 2, function (text) {
      return calc.formatRu(toNumber(text) / v.k, ratioDigits) === ratioText;
    });
    var paybackValue = calc.formatNearThreshold(r.payback, 1, v.T, r.paybackPass, 'atMost');
    var paybackFormulaValue = fit(function (d) {
      return calc.formatNearThreshold(r.payback, d, v.T, r.paybackPass, 'atMost');
    }, Math.max(2, decimalsOf(paybackValue)), function (text) {
      return calc.formatRu(toNumber(text), decimalsOf(paybackValue)) === paybackValue;
    });
    var lifetimeShort = calc.formatRu(r.lifetime, 1);
    var lifetimeLong = fit(function (d) {
      return calc.formatRu(r.lifetime, d);
    }, 2, function (text) {
      return calc.formatRu(toNumber(text), 1) === lifetimeShort;
    });
    var paybackShown = paybackValue;
    var lifetimeShown = null;
    if (paybackValue === lifetimeShort && r.payback !== r.lifetime) {
      for (var d = 2; d <= 8; d++) {
        var pText = calc.formatNearThreshold(r.payback, d, v.T, r.paybackPass, 'atMost');
        var lText = calc.formatRu(r.lifetime, d);
        if (pText !== lText) {
          paybackShown = pText;
          lifetimeShown = lText;
          break;
        }
      }
    }
    var beforeLeaving = r.payback < r.lifetime
      ? 'Окупаемость ' + paybackShown + ' месяца короче срока жизни' + (lifetimeShown ? ' ' + lifetimeShown + ' месяца' : '') + ': клиент успевает окупиться до ухода.'
      : 'Окупаемость ' + paybackShown + ' месяца не короче срока жизни' + (lifetimeShown ? ' ' + lifetimeShown + ' месяца' : '') + ': в среднем клиент уходит раньше, чем окупится.';
    return [
      {
        key: 'ltv',
        label: 'LTV, сколько денег клиент приносит за всё время',
        value: ltvText,
        tag: null,
        formula: 'цена × маржа ÷ отток = ' + p + ' × ' + m + ' ÷ ' + c + ' = ' + ltvText,
        usefulness: 'Сравниваем с CAC: при пороге ' + plain(v.R) + ' клиент должен приносить не меньше, чем CAC × ' + plain(v.R) + ' (стоимость привлечения, умноженная на ' + plain(v.R) + ').'
      },
      {
        key: 'ltvCac',
        label: 'LTV/CAC, во сколько раз клиент окупает своё привлечение',
        value: ratioText,
        tag: { text: 'порог ' + plain(v.R) + (r.ratioPass ? ' пройден' : ' не пройден'), pass: r.ratioPass },
        formula: 'LTV ÷ CAC = ' + ltvForRatio + ' ÷ ' + k + ' = ' + ratioText,
        usefulness: 'На каждую потраченную на привлечение единицу приходится ' + ratioText + ' прибыли за всё время жизни клиента.'
      },
      {
        key: 'payback',
        label: 'Окупаемость, через сколько месяцев клиент вернёт затраты на привлечение',
        value: paybackValue + ' месяца',
        tag: { text: 'порог ' + plain(v.T) + (r.paybackPass ? ' пройден' : ' не пройден'), pass: r.paybackPass },
        formula: 'CAC ÷ (цена × маржа) = ' + k + ' ÷ (' + p + ' × ' + m + ') = ' + paybackFormulaValue,
        usefulness: 'Через столько месяцев клиент вернёт деньги, потраченные на его привлечение.'
      },
      {
        key: 'lifetime',
        label: 'Срок жизни, сколько месяцев клиент в среднем остаётся',
        value: lifetimeShort + ' месяца',
        tag: null,
        formula: '1 ÷ отток = 1 ÷ ' + c + ' = ' + lifetimeLong,
        usefulness: beforeLeaving
      }
    ];
  }

  function describeVerdict(r) {
    var v = r.values;
    var ratioText = calc.formatNearThreshold(r.ltvCac, 2, v.R, r.ratioPass, 'atLeast');
    var paybackText = calc.formatNearThreshold(r.payback, 1, v.T, r.paybackPass, 'atMost');
    var parts = [
      'LTV/CAC равен ' + ratioText + ' при пороге ' + plain(v.R) + (r.ratioPass ? ': проходит.' : ': не проходит.'),
      r.paybackPass
        ? 'Окупаемость ' + paybackText + ' месяца укладывается в ' + plain(v.T) + '.'
        : 'Окупаемость ' + paybackText + ' месяца дольше порога ' + plain(v.T) + '.'
    ];
    if (r.verdict === 'scale') {
      parts.push('Оба порога пройдены, можно масштабировать платное привлечение.');
    } else {
      parts.push(r.ratioPass || r.paybackPass ? 'Не проходит один порог из двух.' : 'Не проходят оба порога.');
      parts.push('Сначала улучшите экономику: что именно сдвинуть, показано ниже.');
    }
    return {
      kind: r.verdict,
      title: r.verdict === 'scale' ? 'Масштабировать' : 'Пока нет',
      text: parts.join(' ')
    };
  }

  var LEVEL_LABELS = { easy: 'легко', medium: 'средне', hard: 'трудно' };
  var LEVEL_WEIGHTS = { easy: 1, medium: 2, hard: 3 };
  var ROW_KEYS = ['price', 'cac', 'churn', 'margin'];
  var ROW_NAMES = { price: 'Цена', cac: 'CAC', churn: 'Отток', margin: 'Маржа' };
  var ROW_GENITIVE = { price: 'цены', cac: 'CAC', churn: 'оттока', margin: 'маржи' };
  var ROW_LOWER = { price: 'цена', cac: 'CAC', churn: 'отток', margin: 'маржа' };
  var UP = ' (округлено вверх)';
  var DOWN = ' (округлено вниз)';
  var NO_TARGET = '—';

  var USEFULNESS = {
    price: 'Показывает, до какой цены нужно поднять подписку, чтобы выполнились оба порога, если остальные три показателя не меняются. Берётся большее из двух значений в скобках: первое нужно для порога LTV/CAC, второе для порога окупаемости.',
    cac: 'Показывает, до какой стоимости нужно снизить привлечение одного клиента, чтобы выполнились оба порога, если остальные три показателя не меняются. Берётся меньшее из двух значений в скобках: первое нужно для порога LTV/CAC, второе для порога окупаемости.',
    churn: 'Показывает, до какого оттока нужно его снизить, чтобы выполнился порог LTV/CAC, если остальные три показателя не меняются. Окупаемость от оттока не зависит, поэтому формула учитывает только порог LTV/CAC.',
    margin: 'Показывает, какой должна стать доля цены, остающаяся после прямых расходов, чтобы выполнились оба порога, если остальные три показателя не меняются. Берётся большее из двух значений в скобках: первое нужно для порога LTV/CAC, второе для порога окупаемости.'
  };

  function signedPercent(change) {
    var text = calc.formatNearThreshold(change.changePctExact, 2, 0, false);
    return (text.charAt(0) === '-' ? '−' + text.slice(1) : '+' + text) + '%';
  }

  function targetFormula(key, v) {
    var p = plain(v.p);
    var m = share(v.m);
    var c = share(v.c);
    var k = plain(v.k);
    var R = plain(v.R);
    var T = plain(v.T);
    if (key === 'price') {
      return 'max(' + R + ' × ' + k + ' × ' + c + ' ÷ ' + m + ' ; ' + k + ' ÷ (' + T + ' × ' + m + '))';
    }
    if (key === 'cac') {
      return 'min(' + p + ' × ' + m + ' ÷ (' + R + ' × ' + c + ') ; ' + T + ' × ' + p + ' × ' + m + ')';
    }
    if (key === 'churn') {
      return p + ' × ' + m + ' ÷ (' + R + ' × ' + k + ') × 100';
    }
    return 'max(' + R + ' × ' + k + ' × ' + c + ' ÷ ' + p + ' ; ' + k + ' ÷ (' + T + ' × ' + p + ')) × 100';
  }

  function overHundred(target) {
    for (var d = 2; d <= 10; d++) {
      var shown = calc.roundHalfUp(target, d);
      if (shown > 100) {
        return plain(shown) + '%';
      }
    }
    return 'больше 100%';
  }

  function describeRow(key, r, rank, level, score) {
    var v = r.values;
    var change = r.changes[key];
    var isPercent = key === 'churn' || key === 'margin';
    var currentNumber = plain(isPercent ? (key === 'churn' ? v.c : v.m) * 100 : key === 'price' ? v.p : v.k);
    var unit = isPercent ? '%' : '';
    var rounding = key === 'price' || key === 'margin' ? UP : DOWN;
    var row = {
      key: key,
      name: ROW_NAMES[key],
      current: currentNumber + unit,
      target: NO_TARGET,
      change: 'недостижимо',
      reachable: change.status === 'needed',
      reason: null,
      formula: null,
      changeFormula: null,
      usefulness: USEFULNESS[key],
      scoreText: null,
      rank: rank
    };
    if (change.status === 'needed') {
      var targetNumber = calc.formatRu(change.target, 2);
      row.target = targetNumber + unit;
      row.change = signedPercent(change);
      row.formula = targetFormula(key, v) + ' = ' + row.target + rounding;
      row.changeFormula = '(' + targetNumber + ' − ' + currentNumber + ') ÷ ' + currentNumber + ' × 100 = ' + row.change;
      row.scoreText = 'Оценка: ' + calc.formatRu(Math.abs(change.changePct), 2) + ' × ' + LEVEL_WEIGHTS[level] +
        ' (' + LEVEL_LABELS[level] + ') = ' + calc.formatRu(score, 2);
      return row;
    }
    if (change.reason === 'over100') {
      var needed = overHundred(change.target);
      row.target = needed;
      row.formula = targetFormula(key, v) + ' = ' + needed;
      row.reason = 'Маржа не может быть выше 100%, а для порогов понадобилось бы ' + needed + ', то есть больше 100%. Одной маржой порог не достичь.';
    } else if (change.reason === 'payback') {
      row.reason = 'Окупаемость от оттока не зависит: она уже дольше порога ' + plain(v.T) + ' месяцев, поэтому снижением оттока вердикт не исправить.';
    } else {
      row.formula = targetFormula(key, v) + ' = меньше 0,01';
      row.reason = 'Нужное значение меньше 0,01: показатель пришлось бы довести почти до нуля, а ноль недопустим. Одним этим показателем порог не достичь.';
    }
    return row;
  }

  function describeChanges(r, difficulty) {
    var chosen = difficulty || {};
    var ranking = calc.rankChanges(r.changes, chosen);
    var rows = ROW_KEYS.map(function (key) {
      var position = ranking.order.indexOf(key);
      var level = chosen[key] === undefined ? 'medium' : chosen[key];
      return describeRow(key, r, position === -1 ? null : position + 1, level, ranking.scores[key]);
    });
    var first = ranking.first;
    var start = null;
    if (first) {
      var firstRow = rows[ROW_KEYS.indexOf(first)];
      var level = chosen[first] === undefined ? 'medium' : chosen[first];
      start = 'Проще всего начать с ' + ROW_GENITIVE[first] + ': трудность отмечена как «' + LEVEL_LABELS[level] +
        '», нужное изменение ' + firstRow.change + '.';
    }
    var orderText = 'Порядок «с чего начать»: ' + ranking.order.map(function (key) { return ROW_LOWER[key]; }).join(', ') + '.';
    if (ranking.unreachable.length > 0) {
      orderText += ' Одним изменением недостижимо: ' + ranking.unreachable.map(function (key) { return ROW_LOWER[key]; }).join(', ') + '.';
    }
    return { rows: rows, start: start, orderText: orderText };
  }

  var LOW_CHURN_WARNING = 'Отток ниже 1% в месяц: средний срок жизни клиента больше 100 месяцев. LTV держится на допущении, что клиенты почти никогда не уходят, поэтому этой цифре стоит доверять с осторожностью. Цифры ниже всё равно показаны.';

  function describe(raw, difficulty) {
    var r = calc.calculate(raw);
    if (!r.ok) {
      return { ok: false, errors: r.errors };
    }
    return {
      ok: true,
      verdict: describeVerdict(r),
      warning: r.lowChurnWarning ? LOW_CHURN_WARNING : null,
      figures: describeFigures(r),
      changes: r.changes ? describeChanges(r, difficulty) : null,
      noChanges: r.noChangesNeeded ? 'Изменения не нужны: оба порога уже выполнены.' : null
    };
  }

  return { describe: describe };
});
