/* Tien Shan Water Account: what NASA's climate models project.
   Reads data/future.js (NASA NEX-GDDP-CMIP6, built by tools/build_future.py) and adds one sentence
   to each evidence card and trend panel: the change the models project, with the spread between them. */
(function () {
  'use strict';

  var WA = window.WA, F = window.WATER_FUTURE;
  if (!WA || !F || !F.models || !F.models.length) return;
  var SPLIT = 2015; // years before this come from the models' historical runs, later years from the scenario

  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
  function span(list) { return Math.min.apply(null, list) + ' to ' + Math.max.apply(null, list); }
  // The projected change for one basin and variable: each model's future average minus its own past average.
  function summary(bId, id) {
    var d = (F.basins[bId] || {})[id];
    if (!d) return null;
    var deltas = [], baseYears = [], futureYears = [];
    F.models.forEach(function (m) {
      var ys = d[m], base = [], fut = [];
      if (!ys) return;
      Object.keys(ys).forEach(function (y) {
        if (+y < SPLIT) { base.push(ys[y]); baseYears.push(+y); } else { fut.push(ys[y]); futureYears.push(+y); }
      });
      if (base.length >= 5 && fut.length >= 5) deltas.push(mean(fut) - mean(base));
    });
    if (deltas.length < 2) return null;
    return {
      n: deltas.length, mean: mean(deltas), lo: Math.min.apply(null, deltas), hi: Math.max.apply(null, deltas),
      agree: deltas.every(function (x) { return x > 0; }) || deltas.every(function (x) { return x < 0; }),
      base: span(baseYears), future: span(futureYears)
    };
  }
  function amount(v, x) {
    if (v.date) return WA.num(Math.abs(x)) + ' days ' + (x < 0 ? 'earlier' : 'later');
    return WA.num(x, true) + ' ' + v.unit;
  }
  function sentence(b, v) {
    if (b.custom) return '';
    var s = summary(b.id, v.id);
    if (!s) return '';
    return 'NASA climate models for ' + s.future + ', against ' + s.base + ': ' + amount(v, s.mean) +
      ' (' + s.n + ' models, from ' + amount(v, s.lo) + ' to ' + amount(v, s.hi) + ').' +
      (s.agree ? '' : ' The models do not agree on the direction.');
  }

  WA.EXTRA.futureCard = function (b, v) {
    var text = sentence(b, v);
    return text ? '<p class="future">' + text + '</p>' : '';
  };
  var earlierPanel = WA.EXTRA.trendPanel;
  WA.EXTRA.trendPanel = function (b, v, r) {
    var text = sentence(b, v);
    return (text ? '<p class="future">' + text + '</p>' : '') + (earlierPanel ? earlierPanel(b, v, r) : '');
  };
  // For the question box: the same sentences as plain text.
  WA.EXTRA.futureFacts = function (b) {
    var lines = WA.D.variables.map(function (v) { var t = sentence(b, v); return t ? v.label + ': ' + t : ''; }).filter(Boolean);
    return lines.length ? '\nProjections from climate models (' + F.source + '; scenario ' + F.scenario + '; these are model projections, not the tool\'s own):\n- ' + lines.join('\n- ') : '';
  };
  WA.EXTRA.methodExtra = function () {
    return '<h2>What the climate models project</h2>' +
      '<p>Where a card says "NASA climate models", the figure comes from ' + F.source + '. It uses ' + F.models.length + ' models (' + F.models.join(', ') +
      ') under one scenario: ' + F.scenario + '. For each model the tool takes the average of the future years minus the average of that model\'s own past years, ' +
      'so a model that runs too warm or too cold everywhere does not distort the change. The range shows how far the models differ.</p>' +
      '<p>Limits: one grid point of about 25 km per basin, not the whole basin; ' + F.models.length + ' models out of the 35 in the dataset; one scenario; short averaging windows. ' +
      'The dataset has temperature and precipitation but no snow, so there is no model projection for the melt date. These are projections from physics models, not predictions by this tool or by AI.</p>';
  };
})();
