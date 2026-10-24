(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.SubEconCalc = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function roundHalfUp(x, digits) {
    var factor = Math.pow(10, digits);
    var sign = x < 0 ? -1 : 1;
    var result = (sign * Math.round(Math.abs(x) * factor * (1 + 1e-12))) / factor;
    return result === 0 ? 0 : result;
  }

  function ceilTo(x, digits) {
    var factor = Math.pow(10, digits);
    return Math.ceil(x * factor * (1 - 1e-12)) / factor;
  }

  function floorTo(x, digits) {
    var factor = Math.pow(10, digits);
    return Math.floor(x * factor * (1 + 1e-12)) / factor;
  }

  function formatRu(x, digits) {
    return roundHalfUp(x, digits).toFixed(digits).replace('.', ',');
  }

  var FIELDS = ['price', 'margin', 'churn', 'cac', 'ratioThreshold', 'paybackThreshold'];
  var PERCENT_FIELDS = { margin: true, churn: true };
  var EMPTY_ERROR = 'Поле пустое. Введите число.';

  var AMBIGUOUS_ERROR = 'Неоднозначная запись: тысячи или дробь? Введите число без разделителя тысяч или с другим числом знаков после запятой.';

  function parseNumber(text) {
    if (text === null || text === undefined) {
      return { ok: false, error: EMPTY_ERROR };
    }
    var cleaned = String(text).replace(/\s+/g, '');
    if (cleaned === '') {
      return { ok: false, error: EMPTY_ERROR };
    }
    var match = /^(-?)(\d+[.,]?\d*|[.,]\d+)$/.exec(cleaned);
    if (!match) {
      return { ok: false, error: 'Введите число: цифры и один разделитель (запятая или точка), без знаков и букв.' };
    }
    if (typeof text !== 'number' && /^\d{1,3}[.,]\d{3}$/.test(match[2])) {
      return { ok: false, error: AMBIGUOUS_ERROR };
    }
    var value = Number(match[2].replace(',', '.'));
    if (!isFinite(value)) {
      return { ok: false, error: 'Слишком большое число.' };
    }
    return { ok: true, value: match[1] ? -value : value };
  }

  function validateInputs(inputs) {
    var errors = {};
    var parsed = {};
    FIELDS.forEach(function (field) {
      var r = parseNumber(inputs ? inputs[field] : undefined);
      if (!r.ok) {
        errors[field] = r.error;
      } else if (!(r.value > 0)) {
        errors[field] = 'Должно быть больше нуля.';
      } else if (PERCENT_FIELDS[field] && r.value > 100) {
        errors[field] = 'Не может быть больше 100%.';
      } else {
        parsed[field] = r.value;
      }
    });
    if (Object.keys(errors).length > 0) {
      return { ok: false, errors: errors };
    }
    return {
      ok: true,
      values: {
        p: parsed.price,
        m: parsed.margin / 100,
        c: parsed.churn / 100,
        k: parsed.cac,
        R: parsed.ratioThreshold,
        T: parsed.paybackThreshold
      }
    };
  }

  var TOLERANCE = 1e-9;
  var LOW_CHURN = 0.01;

  function sameAs(value, reference) {
    return Math.abs(value - reference) < TOLERANCE * Math.abs(reference);
  }

  function atLeast(value, reference) {
    return value >= reference || sameAs(value, reference);
  }

  function atMost(value, reference) {
    return value <= reference || sameAs(value, reference);
  }

  function neededChange(rawTarget, current, scale, up) {
    var shown = up ? ceilTo(rawTarget * scale, 2) : floorTo(rawTarget * scale, 2);
    if (!(shown > 0)) {
      return { status: 'unreachable', reason: 'zero', target: null };
    }
    var currentShown = current * scale;
    var exact = ((shown - currentShown) / currentShown) * 100;
    return {
      status: 'needed',
      target: shown,
      changePct: roundHalfUp(exact, 2),
      changePctExact: exact
    };
  }

  function buildChanges(v, paybackPass) {
    var priceTarget = Math.max((v.R * v.k * v.c) / v.m, v.k / (v.T * v.m));
    var marginTarget = Math.max((v.R * v.k * v.c) / v.p, v.k / (v.T * v.p));
    var cacTarget = Math.min((v.p * v.m) / (v.R * v.c), v.T * v.p * v.m);
    var churnTarget = (v.p * v.m) / (v.R * v.k);
    var margin;
    if (marginTarget > 1 && !sameAs(marginTarget, 1)) {
      margin = { status: 'unreachable', reason: 'over100', target: marginTarget * 100 };
    } else {
      margin = neededChange(Math.min(marginTarget, 1), v.m, 100, true);
    }
    var churn;
    if (!paybackPass) {
      churn = { status: 'unreachable', reason: 'payback', target: null };
    } else {
      churn = neededChange(churnTarget, v.c, 100, false);
    }
    return {
      price: neededChange(priceTarget, v.p, 1, true),
      margin: margin,
      cac: neededChange(cacTarget, v.k, 1, false),
      churn: churn
    };
  }

  function calculate(inputs) {
    var checked = validateInputs(inputs);
    if (!checked.ok) {
      return checked;
    }
    var v = checked.values;
    var lifetime = 1 / v.c;
    var ltv = (v.p * v.m) / v.c;
    var ltvCac = ltv / v.k;
    var payback = v.k / (v.p * v.m);
    if (![lifetime, ltv, ltvCac, payback].every(isFinite)) {
      return { ok: false, errors: { general: 'Числа слишком большие или слишком малые для расчёта.' } };
    }
    var ratioPass = atLeast(ltvCac, v.R);
    var paybackPass = atMost(payback, v.T);
    var scale = ratioPass && paybackPass;
    return {
      ok: true,
      values: v,
      lifetime: lifetime,
      ltv: ltv,
      ltvCac: ltvCac,
      payback: payback,
      ratioPass: ratioPass,
      paybackPass: paybackPass,
      verdict: scale ? 'scale' : 'wait',
      lowChurnWarning: v.c < LOW_CHURN && !sameAs(v.c, LOW_CHURN),
      noChangesNeeded: scale,
      changes: scale ? null : buildChanges(v, paybackPass)
    };
  }

  function wrongSide(shown, reference, side, passes) {
    if (side === 'atLeast') {
      return passes ? shown < reference : shown >= reference;
    }
    return passes ? shown > reference : shown <= reference;
  }

  function formatNearThreshold(value, digits, reference, passes, kind) {
    var side = kind;
    if (!side) {
      if (passes) {
        return formatRu(value, digits);
      }
      side = value < reference ? 'atLeast' : 'atMost';
    }
    var used = digits;
    while (used < 6 && wrongSide(roundHalfUp(value, used), reference, side, passes)) {
      used++;
    }
    return formatRu(value, used);
  }

  var TIE_ORDER = ['price', 'cac', 'churn', 'margin'];
  var WEIGHTS = { easy: 1, medium: 2, hard: 3 };

  function rankChanges(changes, difficulty) {
    var chosen = difficulty || {};
    var scores = {};
    var order = [];
    var unreachable = [];
    TIE_ORDER.forEach(function (key) {
      var level = chosen[key] === undefined ? 'medium' : chosen[key];
      if (!Object.prototype.hasOwnProperty.call(WEIGHTS, level)) {
        throw new Error('Неизвестная трудность: ' + level);
      }
      if (!changes) {
        return;
      }
      if (changes[key].status === 'needed') {
        scores[key] = roundHalfUp(Math.abs(changes[key].changePct) * WEIGHTS[level], 2);
        order.push(key);
      } else {
        unreachable.push(key);
      }
    });
    order.sort(function (a, b) {
      return scores[a] - scores[b] || TIE_ORDER.indexOf(a) - TIE_ORDER.indexOf(b);
    });
    return { order: order, unreachable: unreachable, first: order.length ? order[0] : null, scores: scores };
  }

  return {
    roundHalfUp: roundHalfUp,
    formatRu: formatRu,
    formatNearThreshold: formatNearThreshold,
    parseNumber: parseNumber,
    validateInputs: validateInputs,
    calculate: calculate,
    rankChanges: rankChanges
  };
});
