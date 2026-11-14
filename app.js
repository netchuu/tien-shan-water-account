/* Tien Shan Water Account. Every number on screen is calculated here from data/data.js. */
(function () {
  'use strict';

  var D = window.WATER_DATA;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var ROLES = [
    { id: 'engineer', label: 'Water engineer', who: 'For the water engineer.', job: 'Decides in spring how much water to promise canals and farms for the summer.' },
    { id: 'dispatcher', label: 'Dam dispatcher', who: 'For the dam dispatcher.', job: 'Decides in autumn and winter how much water to release for electricity and how much to keep for summer.' },
    { id: 'negotiator', label: 'Negotiator', who: 'For the negotiator.', job: 'Agrees release limits and schedules between upstream and downstream countries.' }
  ];
  var PAGES = [
    { id: '', label: 'Investigate' },
    { id: 'overview', label: 'Explore data', tab: 'All basins' },
    { id: 'trend', label: 'Trend', tab: 'One place', hidden: true },
    { id: 'compare', label: 'Compare', tab: 'Compare basins', hidden: true },
    { id: 'statement', label: 'Statement', tab: 'What it means', hidden: true },
    { id: 'method', label: 'Method' },
    { id: 'about', label: 'About', hidden: true }
  ];
  var EXPLORE = ['overview', 'trend', 'compare', 'statement'];
  var SHORT_RECORD = 20; // years; below this a record is called short
  var SNOW = { swe: 'snowdepth', snowdepth: 'swe' }; // the snow variable of the other record
  var state = { page: '', record: 'long', from: 0, basin: 'naryn', variable: 'snowdepth', month: 'year', role: 'dispatcher', cmp: 'frost' };

  /* ---------- statistics ---------- */

  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
  // Standard normal cumulative distribution (Abramowitz and Stegun 26.2.17).
  function phi(z) {
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989422804014327 * Math.exp(-z * z / 2);
    var p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z >= 0 ? 1 - p : p;
  }
  // Theil-Sen slope and Mann-Kendall test (normal approximation with tie correction).
  function trend(years, values) {
    var n = values.length;
    if (n < 4) return null;
    var s = 0, slopes = [], i, j;
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        var d = values[j] - values[i];
        s += d > 0 ? 1 : d < 0 ? -1 : 0;
        slopes.push(d / (years[j] - years[i]));
      }
    }
    var slope = median(slopes);
    var ties = {}, tieTerm = 0;
    values.forEach(function (v) { ties[v] = (ties[v] || 0) + 1; });
    Object.keys(ties).forEach(function (k) { var t = ties[k]; if (t > 1) tieTerm += t * (t - 1) * (2 * t + 5); });
    var variance = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
    var z = s === 0 ? 0 : (s - (s > 0 ? 1 : -1)) / Math.sqrt(variance);
    var p = 2 * (1 - phi(Math.abs(z)));
    var y0 = years[0];
    var icpt = median(values.map(function (v, k) { return v - slope * (years[k] - y0); }));
    var proven = p < 0.05 && slope !== 0;
    return {
      n: n, first: years[0], last: years[n - 1], slope: slope, perDecade: slope * 10, p: p, icpt: icpt, mean: mean(values),
      proven: proven, short: n < SHORT_RECORD,
      cls: !proven ? 'none' : slope > 0 ? 'up' : 'down'
    };
  }
  function lgamma(x) {
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, t = x + 5.5, s = 1.000000000190015;
    t -= (x + 0.5) * Math.log(t);
    for (var j = 0; j < 6; j++) s += c[j] / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  // Regularised incomplete beta function, for the t distribution.
  function betai(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    function cf(a, b, x) {
      var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap, h, m, m2, aa, del;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      d = 1 / d; h = d;
      for (m = 1; m <= 200; m++) {
        m2 = 2 * m;
        aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
        c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d; h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
        c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d; del = d * c; h *= del;
        if (Math.abs(del - 1) < 3e-12) break;
      }
      return h;
    }
    return x < (a + 1) / (a + b + 2) ? bt * cf(a, b, x) / a : 1 - bt * cf(b, a, 1 - x) / b;
  }
  // Welch's t-test for two periods with unequal variance.
  function welch(a, b) {
    if (a.length < 3 || b.length < 3) return null;
    function variance(v, m) { return v.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (v.length - 1); }
    var ma = mean(a), mb = mean(b), va = variance(a, ma) / a.length, vb = variance(b, mb) / b.length;
    if (va + vb === 0) return null;
    var t = (mb - ma) / Math.sqrt(va + vb);
    var df = (va + vb) * (va + vb) / (va * va / (a.length - 1) + vb * vb / (b.length - 1));
    var p = betai(df / 2, 0.5, df / (df + t * t));
    return { oldMean: ma, newMean: mb, diff: mb - ma, p: p, proven: p < 0.05 };
  }
  // Is a proven trend really one step? Fit a straight line and the best single step to the same years.
  // If the step leaves at least 20% less unexplained variation than the line, call it a step.
  function step(series, st) {
    if (!st || !st.proven || st.n < 12) return null;
    var ys = series.years, vs = series.values, n = vs.length, best = null, k, i;
    function ss(a) { var m = mean(a); return a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0); }
    for (k = 5; k <= n - 5; k++) {
      var total = ss(vs.slice(0, k)) + ss(vs.slice(k));
      if (!best || total < best.ss) best = { ss: total, k: k };
    }
    if (!best) return null;
    var mx = mean(ys), my = mean(vs), sxy = 0, sxx = 0, line = 0;
    for (i = 0; i < n; i++) { sxy += (ys[i] - mx) * (vs[i] - my); sxx += (ys[i] - mx) * (ys[i] - mx); }
    for (i = 0; i < n; i++) { var e = vs[i] - (my + sxy / sxx * (ys[i] - mx)); line += e * e; }
    if (best.ss >= 0.8 * line) return null;
    return { year: ys[best.k], before: mean(vs.slice(0, best.k)), after: mean(vs.slice(best.k)) };
  }

  /* ---------- data access ---------- */

  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function basin(id) { return byId(D.basins, id); }
  function variable(id) { return byId(D.variables, id); }
  function record(id) { return byId(D.records, id || state.record); }
  function role(id) { return byId(ROLES, id); }
  function recordVariables(recId) { return record(recId).variables.map(variable); }
  function basinsIn(recId) { return D.basins.filter(function (b) { return !!D.series[recId || state.record][b.id]; }); }
  function source(recId, bId, vId) { return (D.series[recId][bId] || {})[vId] || null; }

  // One value per year: the whole year (mean or sum of twelve months) or a single month.
  function yearly(recId, bId, vId, month, from) {
    var src = source(recId, bId, vId), v = variable(vId), years = [], values = [];
    if (!src) return { years: years, values: values };
    if (src.yearlyValues) { // already one value per year, such as a date
      Object.keys(src.yearlyValues).sort().forEach(function (y) { if (+y >= from) { years.push(+y); values.push(src.yearlyValues[y]); } });
      return { years: years, values: values };
    }
    Object.keys(src.monthly).sort().forEach(function (y) {
      if (+y < from) return;
      var m = src.monthly[y], value = null;
      if (month === 'year') {
        if (m.every(function (x) { return x !== null; })) {
          var sum = m.reduce(function (a, b) { return a + b; }, 0);
          value = v.agg === 'sum' ? sum : sum / 12;
        }
      } else {
        value = m[+month - 1];
      }
      if (value !== null && value !== undefined) { years.push(+y); values.push(value); }
    });
    return { years: years, values: values };
  }
  var controlsOpen = false; // the data chooser stays open while it is being used
  var cache = {};
  function compute(recId, bId, vId, month, from) {
    var key = [recId, bId, vId, month, from].join('|');
    if (!cache[key]) {
      var s = yearly(recId, bId, vId, month, from), t = trend(s.years, s.values);
      cache[key] = { series: s, stat: t, step: step(s, t) };
    }
    return cache[key];
  }
  // The current record and time window.
  function result(bId, vId, month) { return compute(state.record, bId, vId, month, state.from); }

  // Cross-check between the two snow products (GLDAS snow water and MERRA-2 snow depth) over the same years.
  // These come from different land models, so this is the one independent comparison in the data.
  function snowConflict(bId) {
    if (!source('basin', bId, 'swe') || !source('long', bId, 'snowdepth')) return '';
    var a = compute('basin', bId, 'swe', 'year', 0).stat;
    if (!a) return '';
    var s = yearly('long', bId, 'snowdepth', 'year', a.first), keep = { years: [], values: [] };
    s.years.forEach(function (y, i) { if (y <= a.last) { keep.years.push(y); keep.values.push(s.values[i]); } });
    var b = trend(keep.years, keep.values);
    if (!b || !a.proven || !b.proven || a.cls === b.cls) return '';
    return 'Sources disagree on snow in ' + basin(bId).name + '. From ' + a.first + ' to ' + a.last + ', GLDAS snow water is ' + (a.slope > 0 ? 'rising' : 'falling') +
      ' while MERRA-2 snow depth is ' + (b.slope > 0 ? 'rising' : 'falling') + ', and both pass the test. Treat the direction as open until satellite snow cover is added.';
  }

  /* ---------- wording ---------- */

  function num(v, signed) {
    var a = Math.abs(v), dp = a >= 100 ? 0 : a >= 10 ? 1 : 2;
    var text = a.toFixed(dp);
    if (+text === 0) return text;
    return (v < 0 ? '−' : signed ? '+' : '') + text;
  }
  function pText(p) { return p < 0.001 ? 'p below 0.001' : 'p = ' + p.toFixed(3); }
  function dayName(doy) { // day of the year -> "12 April"
    var d = new Date(Date.UTC(2001, 0, Math.round(doy)));
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
  }
  // A value with its unit; dates are shown as a day and month.
  function val(v, x) { return v.date ? dayName(x) : num(x) + ' ' + v.unit; }
  function dirWord(v, up) { return v && v.date ? (up ? 'later' : 'earlier') : (up ? 'rising' : 'falling'); }
  function words(st, v) {
    if (!st) return 'not enough years';
    if (st.proven) return dirWord(v, st.slope > 0) + ', proven';
    return st.short ? 'not proven, short record' : 'not proven';
  }
  function periodName(month) { return month === 'year' ? 'whole year' : MONTHS[+month - 1]; }
  // "Yearly snowfall", "March snow water", "Average air temperature".
  function subject(v, month) {
    var l = v.label.toLowerCase();
    if (v.fixed) return v.label;
    if (month !== 'year') return MONTHS[+month - 1] + ' ' + l;
    return (v.agg === 'sum' ? 'Yearly ' : 'Average ') + l;
  }
  function finding(v, month, st) {
    var s = subject(v, month);
    if (!st) return s + ': not enough years to test.';
    var tail = !st.short ? '' : v.fixed
      ? ' It could be measured in only ' + st.n + ' years between ' + st.first + ' and ' + st.last + '.'
      : ' The record is only ' + st.n + ' years (' + st.first + ' to ' + st.last + ').';
    if (v.date && st.proven) {
      return 'The ' + s.toLowerCase() + ' is moving ' + dirWord(v, st.slope > 0) + ' by <strong>' + num(Math.abs(st.perDecade)) + ' days</strong> per decade. Proven (' + pText(st.p) + '). The average is ' + dayName(st.mean) + '.' + tail;
    }
    if (!st.proven) {
      return s + (v.plural ? ' show' : ' shows') + ' no proven change (' + num(st.perDecade, true) + ' ' + v.unit + ' per decade, ' + pText(st.p) + ').' + tail;
    }
    return s + (v.plural ? ' are ' : ' is ') + (st.slope > 0 ? 'rising' : 'falling') + ' by <strong>' + num(Math.abs(st.perDecade)) + ' ' + v.unit +
      '</strong> per decade. Proven (' + pText(st.p) + ').' + tail;
  }
  // What one proven or unproven change means for one role. Text only; the numbers stay in the finding.
  function reading(roleId, b, v, st) {
    var what = v.long, dir = st && st.proven ? (st.slope > 0 ? 'up' : 'down') : 'none', snow = v.id === 'swe' || v.id === 'snowdepth';
    if (roleId === 'negotiator') {
      if (dir === 'none') return 'A change in ' + what + ' is not proven for the ' + b.name + ' basin. Neither side can use this record to claim a trend.';
      return 'In the ' + b.name + ' basin, ' + what + ' is ' + (v.date ? 'moving ' + dirWord(v, dir === 'up') : dir === 'up' ? 'rising' : 'falling') +
        ', and the test confirms it. Every side can check this figure against the same open NASA data.';
    }
    if (dir === 'none') {
      return roleId === 'engineer'
        ? 'This record does not prove a change in ' + what + '. Keep using the long-term average, and check again when more years are loaded.'
        : 'No proven change in ' + what + '. This record gives no reason to change the drawdown rule.';
    }
    if (v.id === 'melt') {
      return dir === 'down'
        ? 'The snowpack is half gone earlier in the year. Inflow peaks sooner, so less of it is left for July and August, when fields and turbines both want it.'
        : 'The snowpack lasts later into the year. More of the inflow arrives close to the summer demand.';
    }
    if (v.id === 'lastfrost') {
      return dir === 'down'
        ? 'The last spring frost comes earlier. Melt and the irrigation season both start sooner.'
        : 'The last spring frost comes later. Melt and the irrigation season both start later.';
    }
    if (v.id === 'frostfree') {
      return dir === 'up'
        ? 'The frost-free season is getting longer. Crops can ask for water over more weeks of the year.'
        : 'The frost-free season is getting shorter. The irrigation season shrinks with it.';
    }
    if (v.id === 'summer') {
      return dir === 'up'
        ? 'There are more days of 25 °C or above. Evaporation and irrigation demand rise on those days.'
        : 'There are fewer days of 25 °C or above. Peak irrigation demand eases.';
    }
    if (v.id === 'frost') {
      return dir === 'down'
        ? 'Fewer frost days mean a longer melt season that starts earlier. Expect inflow to arrive sooner in spring and to run lower in late summer.'
        : 'More frost days keep the snow in place longer. Expect the melt to start later.';
    }
    if (v.id === 'soil') {
      return dir === 'down'
        ? 'Drier soil takes more of the meltwater before it reaches the river, and fields ask for irrigation earlier.'
        : 'Wetter soil passes more of the meltwater on to the river.';
    }
    if (v.id === 'evap') {
      return dir === 'up'
        ? 'More water is leaving the basin as evaporation before it reaches the river. More rain does not mean the same amount more in the canal.'
        : 'Less water is leaving the basin as evaporation before it reaches the river.';
    }
    if (roleId === 'engineer') {
      if (snow) {
        return dir === 'down'
          ? 'Less snow is waiting above ' + b.feeds + ' than the old averages assume. Promise summer water against the recent average, not the long one.'
          : 'More snow is waiting above ' + b.feeds + ' than the old averages assume. The recent average is the better guide for summer promises.';
      }
      if (v.id === 'temp') {
        return dir === 'up'
          ? 'A warmer basin melts its snow earlier. Expect the peak inflow to move towards spring, ahead of the July demand.'
          : 'A cooler basin holds its snow longer. Expect the peak inflow to stay later in the season.';
      }
      return dir === 'up'
        ? 'More ' + what + ' is arriving in the basin. That is supply, but it helps in July only if it stays as snow until then.'
        : 'Less ' + what + ' is arriving in the basin. Plan summer allocations with a smaller supply in mind.';
    }
    if (snow) {
      return dir === 'down'
        ? 'The snowpack that refills the reservoir is shrinking. Keep more water back in winter, because spring may return less.'
        : 'The snowpack that refills the reservoir is growing. Spring refill has been stronger in recent years than the old average.';
    }
    if (v.id === 'temp') {
      return dir === 'up'
        ? 'Warming moves the melt earlier. Inflow may arrive before summer demand does.'
        : 'Cooling moves the melt later. Inflow may arrive closer to summer demand.';
    }
    return dir === 'up'
      ? 'More ' + what + ' is reaching the basin above the reservoir. Count it as inflow only once it shows in the snowpack.'
      : 'Less ' + what + ' is reaching the basin above the reservoir. Plan the winter drawdown with a smaller refill in mind.';
  }
  function stepText(v, sp) {
    return 'Most of this change is one step around ' + sp.year + ': the average was ' + num(sp.before) + ' ' + v.unit + ' before and ' + num(sp.after) + ' ' + v.unit +
      ' after. A single step fits these years better than a steady line. A step like this can come from a change in the data fed to the model, not from the climate. Do not quote it as a steady trend.';
  }
  // The same reading, with a caution when the figure is weak. `shown` may carry a different wording of the variable.
  function cautious(roleId, b, v, st, shown) {
    var text = reading(roleId, b, shown || v, st);
    if (!st || !st.proven) return text;
    if (result(b.id, v.id, 'year').step) text += ' The change looks like a single step in the data, so confirm before acting on it.';
    if (SNOW[v.id] && snowConflict(b.id)) text += ' A second NASA source points the other way, so confirm before acting on it.';
    return text;
  }
  function listWords(items) {
    if (items.length < 2) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }
  // The years covered by the current record and window, taken from the longest series in it.
  function windowText() {
    var long = null;
    basinsIn().forEach(function (b) {
      record().variables.forEach(function (v) { var s = result(b.id, v, 'year').stat; if (s && (!long || s.n > long.n)) long = s; });
    });
    return long ? long.first + ' to ' + long.last : '';
  }

  // Where the fitted line would be in ten years. Shown only for a proven change with no caution attached.
  function projection(b, v, r) {
    var st = r.stat;
    if (!st || !st.proven || r.step || (SNOW[v.id] && snowConflict(b.id))) return '';
    var target = st.last + 10, now = st.icpt + st.slope * (st.last - st.first), then = st.icpt + st.slope * (target - st.first);
    return 'At this pace: ' + val(v, then) + ' by ' + target + ' (' + val(v, now) + ' in ' + st.last + '). The past line extended, not a forecast.';
  }
  // Plain definitions of every variable.
  var DEFINE = {
    snowdepth: 'How deep the snow lies on the ground, averaged over the area and over the days of the year.',
    swe: 'How much water the snowpack would give if it all melted, as a depth of water.',
    snowfall: 'The part of the precipitation that falls as snow, as a depth of water.',
    precip: 'Everything that falls from the sky, rain and snow together, as a depth of water.',
    temp: 'Air temperature two metres above the ground, averaged over day and night.',
    frost: 'The number of days in the year when the temperature drops below 0 °C.',
    soil: 'How wet the soil is where plant roots reach: 0% is completely dry, 100% is saturated.',
    evap: 'Water that goes back from the land into the air, as a depth of water.',
    melt: 'The first day after the winter peak when the snow depth is down to half of that peak. An early date means the meltwater leaves early.',
    lastfrost: 'The last day before August with a night-time minimum below 0 °C.',
    frostfree: 'The number of days between the last frost of spring and the first frost of autumn.',
    summer: 'The number of days in the year when the daytime maximum reaches 25 °C or more.'
  };
  var EXTRA = {}; // hooks filled by investigate.js

  /* ---------- drawing ---------- */

  function chart(series, st, label) {
    var W = 400, H = 120, pad = 6, ys = series.years, vs = series.values;
    if (!ys.length) return '';
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    if (st) {
      var a = st.icpt, b = st.icpt + st.slope * (st.last - st.first);
      lo = Math.min(lo, a, b); hi = Math.max(hi, a, b);
    }
    if (hi === lo) hi = lo + 1;
    var y0 = ys[0], y1 = ys[ys.length - 1], span = Math.max(1, y1 - y0);
    function X(year) { return pad + (W - 2 * pad) * (year - y0) / span; }
    function Y(v) { return pad + (H - 2 * pad) * (1 - (v - lo) / (hi - lo)); }
    var path = '', prev = null;
    ys.forEach(function (year, i) {
      path += (prev !== null && year - prev === 1 ? ' L' : ' M') + X(year).toFixed(1) + ' ' + Y(vs[i]).toFixed(1);
      prev = year;
    });
    var line = st ? '<path class="trend ' + st.cls + '" d="M' + X(st.first).toFixed(1) + ' ' + Y(st.icpt).toFixed(1) +
      ' L' + X(st.last).toFixed(1) + ' ' + Y(st.icpt + st.slope * (st.last - st.first)).toFixed(1) + '"></path>' : '';
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + label + '">' +
      '<path class="raw" d="' + path.trim() + '"></path>' + line + '</svg>';
  }
  function mix(c1, c2, t) {
    function ch(c, i) { return parseInt(c.substr(1 + 2 * i, 2), 16); }
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var x = Math.round(ch(c1, i) + (ch(c2, i) - ch(c1, i)) * t).toString(16);
      out += x.length < 2 ? '0' + x : x;
    }
    return out.toUpperCase();
  }
  function stripeColour(t) { return t < 0.5 ? mix('#FFB866', '#2A3F54', t * 2) : mix('#2A3F54', '#8FC3FF', (t - 0.5) * 2); }

  /* ---------- shared controls ---------- */

  function link(page, params) {
    var q = Object.keys(params || {}).map(function (k) { return k + '=' + params[k]; }).join('&');
    return '#/' + page + (q ? '?' + q : '');
  }
  function button(set, value, label, pressed) {
    return '<button type="button" class="btn" data-set="' + set + '" data-value="' + value + '" aria-pressed="' + pressed + '">' + label + '</button>';
  }
  function basinButtons() {
    return '<div class="btn-row" role="group" aria-label="Basin">' + basinsIn().map(function (b) {
      return button('basin', b.id, b.name, state.basin === b.id);
    }).join('') + '</div>';
  }
  // Which record, and which years. Fixed windows only, so nobody can hunt for a year that makes a trend "proven".
  function recordControls() {
    var r = record(), from = state.from || r.windows[0];
    var out = '<div class="btn-row" role="group" aria-label="Record">' + D.records.map(function (x) {
      return button('record', x.id, x.label, x.id === r.id);
    }).join('') + '</div>';
    if (r.windows.length > 1) {
      out += '<div class="btn-row" role="group" aria-label="Years">' + r.windows.map(function (w, i) {
        return button('from', i === 0 ? 0 : w, 'Since ' + w, from === w);
      }).join('') + '</div>';
    }
    return '<details class="controls"' + (controlsOpen ? ' open' : '') + '><summary>Data: ' + r.label.toLowerCase() + (r.windows.length > 1 ? ', years since ' + from : '') + '. Change</summary>' + out + '</details>';
  }
  function recordText(st) { return st ? st.first + ' to ' + st.last : 'no record'; }

  /* ---------- pages ---------- */

  function pageOverview() {
    var vars = (record().matrix || record().variables).map(variable), perVar = {};
    var rows = D.basins.map(function (b) {
      var head = '<th scope="row">' + b.name + '<span>' + b.range + '</span></th>';
      if (!D.series[state.record][b.id]) {
        return '<tr>' + head + '<td colspan="' + vars.length + '"><div class="placeholder">[' + b.name.toUpperCase() + ' IS NOT IN THIS RECORD]</div></td></tr>';
      }
      return '<tr>' + head + vars.map(function (v) {
        var r = result(b.id, v.id, 'year'), st = r.stat;
        if (!st) return '<td><div class="placeholder">[NO DATA]</div></td>';
        var clash = st.proven && SNOW[v.id] && snowConflict(b.id);
        if (st.proven && !b.custom) {
          perVar[v.id] = perVar[v.id] || { up: [], down: [] };
          perVar[v.id][st.cls].push(b.name + (r.step ? ' (one step)' : '') + (clash ? ' (sources disagree)' : ''));
        }
        return '<td><a class="cell ' + st.cls + '" href="' + link('trend', { record: state.record, from: state.from, basin: b.id, variable: v.id, month: 'year' }) + '">' +
          num(st.perDecade, true) + ' ' + v.unit + '<span>' + words(st, v) + (st.short ? ', ' + st.first + ' to ' + st.last : '') + (r.step ? ', one step in ' + r.step.year : '') + (clash ? ', sources disagree' : '') + '</span></a></td>';
      }).join('') + '</tr>';
    }).join('');
    var lines = vars.filter(function (v) { return perVar[v.id]; }).map(function (v) {
      var p = perVar[v.id], parts = [];
      if (p.down.length) parts.push((v.date ? 'moving earlier in ' : 'falling in ') + listWords(p.down));
      if (p.up.length) parts.push((v.date ? 'moving later in ' : 'rising in ') + listWords(p.up));
      return '<li><span class="mark ' + (p.up.length && p.down.length ? 'none' : p.up.length ? 'up' : 'down') + '" aria-hidden="true"></span><span><strong>' + v.label + '</strong> ' +
        (v.plural ? 'are ' : 'is ') + parts.join(' and ') + '.</span></li>';
    }).join('');
    return recordControls() +
      '<div class="head"><h1 class="title">Every basin, every variable</h1>' +
      '<span class="caption">Change per decade in whole-year values, ' + windowText() + '</span></div>' +
      '<div class="matrix-wrap"><table class="matrix cols-' + vars.length + '"><thead><tr><th scope="col">Basin</th>' +
      vars.map(function (v) { return '<th scope="col">' + v.label + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<h2 class="panel-title">Proven in these years, ' + windowText() + '</h2>' +
      (lines ? '<ul class="findings">' + lines + '</ul>' : '<p class="lead">No change is proven in these years.</p>') +
      '<p class="caption">Filled cells are proven changes; a dashed cell is not proven. ' +
      'A proven change marked "one step" or "sources disagree" should not be quoted as a steady trend. Select a cell to open its record.</p>';
  }

  function normsPanel(v, series) {
    var n = series.values.length, half = Math.floor(n / 2);
    var w = welch(series.values.slice(0, half), series.values.slice(half));
    if (!w) return '';
    var ys = series.years, cls = !w.proven ? '' : w.diff > 0 ? ' up' : ' down';
    return '<section class="norms" aria-label="Old average against new average">' +
      '<div class="panel"><h2 class="caption">Old average, ' + ys[0] + ' to ' + ys[half - 1] + '</h2><span class="figure">' + val(v, w.oldMean) + '</span></div>' +
      '<div class="panel"><h2 class="caption">New average, ' + ys[half] + ' to ' + ys[n - 1] + '</h2><span class="figure' + cls + '">' + val(v, w.newMean) + '</span></div>' +
      '<div class="panel"><h2 class="caption">Has the average itself moved?</h2><p>The new average is ' + num(Math.abs(w.diff)) + ' ' + v.unit +
      (v.date ? (w.diff > 0 ? ' later' : ' earlier') : (w.diff > 0 ? ' higher' : ' lower')) + '. ' + (w.proven ? 'Proven' : 'Not proven') + ' by a t-test (' + pText(w.p) + ').</p></div></section>';
  }

  function pageTrend() {
    var b = basin(state.basin), v = variable(state.variable);
    if (v.fixed) state.month = 'year';
    var r = result(b.id, v.id, state.month), st = r.stat;
    var side = recordVariables().map(function (x) {
      var s = result(b.id, x.id, state.month).stat;
      return '<button type="button" class="var-btn ' + (s ? s.cls : 'none') + '" data-set="variable" data-value="' + x.id + '" aria-pressed="' + (x.id === v.id) + '">' +
        '<b>' + x.label + '</b>' + (s ? '<strong class="' + (s.cls === 'none' ? '' : s.cls) + '">' + num(s.perDecade, true) + ' ' + x.unit + '</strong> ' + words(s, x) : '[NO DATA]') + '</button>';
    }).join('');
    var months = '<label class="field">Period <select data-set="month" aria-label="Period">' +
      '<option value="year"' + (state.month === 'year' ? ' selected' : '') + '>Whole year</option>' +
      MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (String(state.month) === String(i + 1) ? ' selected' : '') + '>' + m + '</option>'; }).join('') +
      '</select></label>';
    if (v.fixed) months = '<span class="caption">One value a year</span>';
    var main;
    if (!st) {
      main = '<section class="panel board-main"><h1 class="panel-title">' + subject(v, state.month) + '</h1><div class="placeholder">[NOT ENOUGH YEARS TO TEST]</div></section>';
    } else {
      var share = v.id !== 'temp' && v.id !== 'soil' && !v.fixed && st.mean > 0 ? ', a change of ' + Math.round(Math.abs(st.perDecade / st.mean * 100)) + '% of it each decade' : '';
      var label = b.name + ' ' + subject(v, state.month).toLowerCase() + ', ' + st.first + ' to ' + st.last + ', ' +
        (st.proven ? 'with a ' + (st.slope > 0 ? 'rising' : 'falling') + ' trend line' : 'with a trend line that is not proven');
      var src = source(state.record, b.id, v.id), conflict = SNOW[v.id] && state.month === 'year' ? snowConflict(b.id) : '';
      main = '<section class="panel board-main">' +
        '<h1 class="panel-title">' + subject(v, state.month) + '</h1>' +
        (DEFINE[v.id] ? '<p class="caption">' + DEFINE[v.id] + '</p>' : '') +
        '<div class="hero"><span class="hero-figure ' + (st.cls === 'none' ? '' : st.cls) + '">' + num(st.perDecade, true) + '</span>' +
        '<span class="hero-words">' + v.unit + ' per decade<br>' + words(st, v) + '</span></div>' +
        chart(r.series, st, label) +
        '<div class="axis"><span>' + st.first + '</span><span>Average ' + val(v, st.mean) + share + ', test ' + pText(st.p) + '</span><span>' + st.last + '</span></div>' +
        '<p class="caption">Source: ' + src.source + '. ' + (v.kind === 'model' ? 'A model estimate, not a measurement.' : 'A reanalysis: weather observations blended into a model.') +
        (st.short ? ' This file ends in ' + st.last + ', so the record is short.' : '') + '</p>' +
        (r.step ? '<p class="warn">' + stepText(v, r.step) + '</p>' : '') +
        (conflict ? '<p class="warn">' + conflict + '</p>' : '') +
        (state.month === 'year' && projection(b, v, r) ? '<p class="caption">' + projection(b, v, r) + '</p>' : '') +
        (EXTRA.trendPanel ? EXTRA.trendPanel(b, v, r) : '') +
        '<div class="btn-row"><button type="button" class="btn" data-action="csv">Download these values (CSV)</button></div>' +
        '<details><summary>Show the value for each year</summary><table class="years"><thead><tr><th scope="col">Year</th><th scope="col">' + v.label + ', ' + v.unit + '</th></tr></thead><tbody>' +
        r.series.years.map(function (y, i) { return '<tr><td>' + y + '</td><td>' + (v.date ? dayName(r.series.values[i]) : num(r.series.values[i])) + '</td></tr>'; }).join('') +
        '</tbody></table></details></section>';
    }
    var ro = role(state.role), note;
    if (b.custom) {
      note = '<p class="note"><strong>A single point.</strong> This is one NASA grid cell of about 50 km, fetched live. The role advice is written for reservoir basins, so only the finding is shown here.</p>';
    } else {
      note = '<p class="note"><strong>' + ro.who + '</strong> ' + (state.month === 'year' ? cautious(ro.id, b, v, st) : reading(ro.id, b, v, st)) +
        ' <a href="' + link('statement') + '" style="color:#142230">Change role</a></p>';
    }
    return recordControls() +
      '<div class="head">' + basinButtons() + months +
      '<span class="caption">' + b.name + ', ' + b.range + ', ' + periodName(state.month) + ', record ' + recordText(st) + '</span></div>' +
      '<div class="board">' + main + '<div class="board-side" role="group" aria-label="Variable">' + side + '</div></div>' +
      (st ? normsPanel(v, r.series) : '') + note;
  }

  function pageStatement() {
    var b = basin(state.basin), ro = role(state.role), unproven = [], lines = [], supply = {}, vars = recordVariables();
    var items = vars.map(function (v) {
      var r = result(b.id, v.id, 'year'), st = r.stat;
      if (st && st.proven && (v.id === 'snowfall' || v.id === 'precip')) supply[v.id] = st;
      return '<li><span class="mark ' + (st ? st.cls : 'none') + '" aria-hidden="true"></span><span>' + finding(v, 'year', st) +
        (r.step ? ' Most of it is one step around ' + r.step.year + '.' : '') + '</span></li>';
    }).join('');
    // Snowfall and total precipitation moving the same way are one message, not two (except for the negotiator, who quotes each figure).
    var merged = ro.id !== 'negotiator' && supply.snowfall && supply.precip && supply.snowfall.cls === supply.precip.cls;
    vars.forEach(function (v) {
      var st = result(b.id, v.id, 'year').stat;
      if (!st || !st.proven) { unproven.push(v.long); return; }
      if (merged && v.id === 'snowfall') return;
      lines.push(cautious(ro.id, b, v, st, merged && v.id === 'precip' ? { id: 'precip', long: 'snow and rain' } : null));
    });
    if (unproven.length) {
      lines.push(ro.id === 'negotiator'
        ? 'Not proven: ' + listWords(unproven) + '. Neither side can use this record to claim a trend there.'
        : 'Not proven: ' + listWords(unproven) + '. This record gives no reason to change plans on those.');
    }
    var aside;
    if (b.custom) {
      aside = '<aside class="panel split-side"><h2 class="panel-title">A single point</h2>' +
        '<p>This is one NASA grid cell of about 50 km, fetched live. The role advice is written for reservoir basins, so only the findings are shown.</p>' +
        '<p class="caption">Record of ' + windowText() + '. Past trend, not a forecast.</p></aside>';
    } else {
      aside = '<aside class="panel split-side"><h2 class="panel-title">Read it as</h2>' +
        '<div class="btn-col" role="group" aria-label="Role">' + ROLES.map(function (x) { return button('role', x.id, x.label, x.id === ro.id); }).join('') + '</div>' +
        '<p class="caption">' + ro.job + '</p>' +
        '<div class="reading">' + lines.map(function (l) { return '<p>' + l + '</p>'; }).join('') + '</div>' +
        '<p class="caption">Record of ' + windowText() + ' from NASA models. Past trend, not a forecast. The wording comes from fixed templates; the figures come from the calculation.</p></aside>';
    }
    return recordControls() + '<div class="split"><div class="split-main">' +
      '<h1 class="title">What the record says</h1>' + basinButtons() +
      '<h2 class="caption">' + b.name + ', ' + b.range + ', whole-year values</h2>' +
      '<ul class="findings">' + items + '</ul>' +
      '<div class="btn-row no-print"><a class="btn" href="' + link('trend') + '">Open the trend board for ' + b.name + '</a>' +
      '<button type="button" class="btn" data-action="print">Print this statement</button></div></div>' + aside + '</div>';
  }

  function pageCompare() {
    var v = variable(state.cmp), basins = basinsIn().filter(function (b) { return source(state.record, b.id, v.id); });
    var all = basins.map(function (b) { return result(b.id, v.id, 'year'); });
    var y0 = Math.min.apply(null, all.map(function (r) { return r.series.years[0]; }));
    var y1 = Math.max.apply(null, all.map(function (r) { return r.series.years[r.series.years.length - 1]; }));
    var bands = basins.map(function (b, i) {
      var r = all[i], st = r.stat, lo = Math.min.apply(null, r.series.values), hi = Math.max.apply(null, r.series.values), cells = '', missing = 0;
      for (var y = y0; y <= y1; y++) {
        var k = r.series.years.indexOf(y);
        if (k < 0) { cells += '<i class="gap"></i>'; missing++; continue; }
        cells += '<i style="background:' + stripeColour(hi === lo ? 0.5 : (r.series.values[k] - lo) / (hi - lo)) + '" title="' + y + ': ' + val(v, r.series.values[k]) + '"></i>';
      }
      var label = b.name + ' ' + subject(v, 'year').toLowerCase() + ' by year, ' + r.series.years[0] + ' to ' + r.series.years[r.series.years.length - 1] + '. ' +
        (st && st.proven ? (st.slope > 0 ? 'Blue stripes, meaning more, become more common towards the end.' : 'Amber stripes, meaning less, become more common towards the end.') : 'No proven direction.');
      return '<div class="band-head"><h2 class="panel-title">' + b.name + ', ' + b.range + '</h2>' +
        '<span><strong class="' + (st && st.cls !== 'none' ? st.cls : '') + '">' + (st ? num(st.perDecade, true) + ' ' + v.unit : '') + '</strong> per decade, ' + words(st, v) +
        (r.step ? ', one step in ' + r.step.year : '') + '</span></div>' +
        '<div class="stripes" role="img" aria-label="' + label + '">' + cells + '</div>' +
        (missing ? '<p class="caption">Dashed years are not in the loaded file for ' + b.name + ' (' + source(state.record, b.id, v.id).source + ').</p>' : '');
    }).join('');
    var up = [], down = [], none = [];
    basins.forEach(function (b, i) { (all[i].stat && all[i].stat.cls === 'up' ? up : all[i].stat && all[i].stat.cls === 'down' ? down : none).push(b.name); });
    var verdict;
    var moveWord = v.date ? (up.length ? 'shift later' : 'shift earlier') : (up.length ? 'rise' : 'fall');
    if (up.length && down.length) verdict = 'The basins are moving in opposite directions: ' + v.long + ' is ' + (v.date ? 'moving later' : 'rising') + ' in ' + listWords(up) + ' and ' + (v.date ? 'earlier' : 'falling') + ' in ' + listWords(down) + ', and each change is proven.';
    else if (!up.length && !down.length) verdict = 'No basin shows a proven change in ' + v.long + '.';
    else if (!none.length) verdict = 'Every basin shows a proven ' + moveWord + ' in ' + v.long + '.';
    else verdict = 'The ' + moveWord + ' in ' + v.long + ' is proven in ' + listWords(up.concat(down)) + ' and not proven in ' + listWords(none) +
      '. Not proven does not mean no change: it means this record cannot show one.';
    var mid = Math.round((y0 + y1) / 2);
    return recordControls() +
      '<div class="head"><h1 class="title">' + subject(v, 'year') + ', one stripe a year</h1><span class="caption">' + y0 + ' to ' + y1 + '</span></div>' +
      '<label class="field">Variable <select data-set="cmp" aria-label="Variable">' + recordVariables().map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === v.id ? ' selected' : '') + '>' + x.label + '</option>';
      }).join('') + '</select></label>' + bands +
      '<div class="axis"><span>' + y0 + '</span><span>' + mid + '</span><span>' + y1 + '</span></div>' +
      '<div class="legend"><span><i style="background:#FFB866" aria-hidden="true"></i>' + (v.date ? 'Earliest' : 'Lowest') + ' in that basin\'s record</span>' +
      '<span><i style="background:#2A3F54;border:1px solid #7F93A5" aria-hidden="true"></i>Middle</span>' +
      '<span><i style="background:#8FC3FF" aria-hidden="true"></i>' + (v.date ? 'Latest' : 'Highest') + '</span></div>' +
      '<p class="lead">' + verdict + '</p>';
  }

  function pageMethod() {
    var recRows = D.records.map(function (r) {
      return '<tr><td>' + r.label + '</td><td>' + r.about + '</td><td>' + r.variables.map(function (v) { return variable(v).label.toLowerCase(); }).join(', ') +
        '</td><td>' + basinsIn(r.id).filter(function (b) { return !b.custom; }).map(function (b) { return b.name; }).join(', ') + '</td></tr>';
    }).join('');
    var basinRows = D.basins.filter(function (b) { return !b.custom; }).map(function (b) {
      return '<tr><td>' + b.name + ', ' + b.range + '</td><td>' + b.box + '</td><td>' + (b.cells || '') + '</td><td>' + (b.elevation ? b.elevation + ' m' : '') + '</td></tr>';
    }).join('');
    var fileRows = '';
    basinsIn('basin').forEach(function (b) {
      record('basin').variables.forEach(function (vId) {
        var src = source('basin', b.id, vId), st = compute('basin', b.id, vId, 'year', 0).stat;
        if (src) fileRows += '<tr><td>' + b.name + '</td><td>' + variable(vId).label + '</td><td>' + src.source + '<br><span class="caption">' + src.product + '</span></td><td>' + recordText(st) + '</td></tr>';
      });
    });
    var long = record('long'), winRows = '', flips = [], robust = [], shaky = [], total = 0, lost = 0, gained = 0, gainedStep = 0;
    basinsIn('long').filter(function (b) { return !b.custom; }).forEach(function (b) {
      long.variables.forEach(function (vId) {
        var v = variable(vId), cells = long.windows.map(function (w) {
          var r = compute('long', b.id, vId, 'year', w);
          return { st: r.stat, step: r.step };
        });
        total++;
        if (cells[0].st.cls !== cells[cells.length - 1].st.cls) flips.push(b.name + ' ' + v.label.toLowerCase());
        else if (cells[0].st.proven) {
          var weak = cells.some(function (c) { return c.step; }) ? 'one step' : SNOW[vId] && snowConflict(b.id) ? 'sources disagree' : '';
          (weak ? shaky : robust).push(b.name + ' ' + v.label.toLowerCase() + ' (' + (cells[0].st.slope > 0 ? 'rising' : 'falling') + (weak ? ', ' + weak : '') + ')');
        }
        if (cells[0].st.proven && !cells[cells.length - 1].st.proven) lost++;
        if (!cells[0].st.proven && cells[cells.length - 1].st.proven) { gained++; if (cells[cells.length - 1].step) gainedStep++; }
        winRows += '<tr><td>' + b.name + '</td><td>' + v.label + ', ' + v.unit + '</td>' + cells.map(function (c) {
          return '<td>' + num(c.st.perDecade, true) + ', ' + words(c.st, v) + (c.step ? ', one step in ' + c.step.year : '') + '</td>';
        }).join('') + '</tr>';
      });
    });
    var conflicts = D.basins.map(function (b) { return snowConflict(b.id); }).filter(Boolean);
    return '<div class="prose wide"><h1 class="title">Method and data</h1>' +
      '<p>Every figure in this tool is calculated in your browser from the files listed here. Nothing is typed in by hand. The sentences come from fixed templates. The one exception is the question box: if you turn on AI answers with your own key, Claude writes that answer from the calculated figures, and the answer is labelled as written by AI.</p>' +
      '<h2>How a trend is tested</h2><ol>' +
      '<li>Take monthly values for the basin: the mean of every NASA grid cell inside the basin box.</li>' +
      '<li>Remove the seasonal cycle by comparing like with like: whole years with whole years, or one month with the same month in other years. A year counts only if all twelve months are present.</li>' +
      '<li>Measure the rate of change with the Theil-Sen slope, the median of the slopes between every pair of years. One extreme year cannot bend it.</li>' +
      '<li>Test it with the Mann-Kendall test. If p is below 0.05 the change is called proven. Otherwise it is called not proven.</li>' +
      '<li>Check whether a proven change is really one step: if a single jump fits the years at least 20% better than a straight line, the tool says so.</li>' +
      '<li>Compare the first half of the record with the second half using Welch\'s t-test, to see whether the average itself has moved.</li></ol>' +
      '<h2>Dates built from daily data</h2><ul>' +
      '<li><strong>Snow half-melt date.</strong> For each year, find the deepest snow between 1 October of the year before and 30 June. The half-melt date is the first day after that peak when the snow depth is below half of it. Years with a peak under 1 cm are left out.</li>' +
      '<li><strong>Last spring frost.</strong> The last day before August with a daily minimum below 0 °C.</li>' +
      '<li><strong>Frost-free season.</strong> The days between the last spring frost and the first frost after 31 July.</li>' +
      '<li><strong>Summer days.</strong> Days with a maximum of 25 °C or more.</li></ul>' +
      '<p>These use daily snow depth and temperature from NASA POWER (MERRA-2), averaged over the basin\'s grid cells, from 1981 to this month. The snow depth is modelled, not seen by satellite, and it is one source: no second product has checked the melt dates yet. The definitions are ours and are written for the northern hemisphere.</p>' +
      '<h2>Projections</h2><p>The tool does not forecast. Where it shows a year after the record ends, on the map over time or in a case file, it extends the fitted Theil-Sen line of a change that is proven and is not a single step. Places with no proven trend get no projection. No AI or machine-learning model produces these numbers: with one value a year there are too few data points to train one honestly.</p>' +
      (EXTRA.methodExtra ? EXTRA.methodExtra() : '') +
      '<h2>Two records</h2><div class="table-wrap"><table class="table"><thead><tr><th scope="col">Record</th><th scope="col">What it is</th><th scope="col">Variables</th><th scope="col">Basins</th></tr></thead><tbody>' + recRows + '</tbody></table></div>' +
      '<p>Snowfall, rain and temperature in both records come from the same MERRA-2 reanalysis, so they are not two independent sources. The one independent comparison is snow: GLDAS snow water against MERRA-2 snow depth.</p>' +
      conflicts.map(function (c) { return '<p class="warn">' + c + '</p>'; }).join('') +
      '<h2>Basins</h2><div class="table-wrap"><table class="table"><thead><tr><th scope="col">Basin</th><th scope="col">Box: west, south, east, north</th><th scope="col">Grid cells</th><th scope="col">Mean height of the cells</th></tr></thead><tbody>' + basinRows + '</tbody></table></div>' +
      '<h2>Giovanni files</h2><div class="table-wrap"><table class="table"><thead><tr><th scope="col">Basin</th><th scope="col">Variable</th><th scope="col">NASA product</th><th scope="col">Whole years</th></tr></thead><tbody>' + fileRows + '</tbody></table></div>' +
      '<p class="caption">Rates in kg per square metre per second or mm per day are converted to mm per month. Soil wetness is shown as a percentage of saturation. The combined table is data/water_account.csv.</p>' +
      '<h2>Does the answer depend on the years?</h2>' +
      '<p>The same test on the long record, for two fixed windows. The tool offers only these windows, so nobody can search for a start year that makes a trend pass.</p>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Basin</th><th scope="col">Variable</th>' +
      long.windows.map(function (w) { return '<th scope="col">Since ' + w + ', per decade</th>'; }).join('') + '</tr></thead><tbody>' + winRows + '</tbody></table></div>' +
      '<p>Of ' + total + ' basin and variable pairs, ' + lost + ' are proven over the long window but not over the short one: with fewer years the test has less to work with. ' +
      gained + ' are proven only since ' + long.windows[long.windows.length - 1] + ', and ' + gainedStep + ' of those are flagged as one step. A trend always belongs to its years: state the window whenever you quote one.</p>' +
      (robust.length ? '<p><strong>Proven in both windows, in the same direction, with no caution:</strong> ' + listWords(robust) + '. These are the findings to rely on.</p>' : '<p>No change is proven in both windows without a caution.</p>') +
      (shaky.length ? '<p>Proven in both windows but carrying a caution: ' + listWords(shaky) + '.</p>' : '') +
      '<h2>Limits you should know</h2><ul>' +
      '<li>A past trend is not a forecast.</li>' +
      '<li>MERRA-2 and GLDAS are models. They estimate snow from weather; nobody measured it on the ground. Absolute amounts in high mountains are uncertain, so read the direction and the test, not the millimetres.</li>' +
      '<li>The models contain no glaciers. Glacier loss in the Tien Shan is documented in published studies and does not appear in these figures.</li>' +
      '<li>A grid cell is about 50 km wide, far coarser than a mountain valley. A basin here is a rectangle, not the true watershed outline.</li>' +
      '<li>Reanalysis rain and snow can jump when the observations fed into the model change. That is why the tool flags one-step changes.</li>' +
      '<li>The Mann-Kendall test assumes one year does not depend on the year before. Snow and weather mostly satisfy this at yearly steps, but not perfectly.</li>' +
      '<li>In the long record, snow depth, snowfall, rain, soil wetness and evaporation all depend on the same rain and snow input to the model. When they move together in a basin, count that as one finding. Temperature and frost days are a second, separate line of evidence.</li>' +
      '<li>With many basins and variables tested at p below 0.05, about one result in twenty can pass by chance. Trust a pattern that repeats across basins more than a single cell.</li>' +
      '<li>The Vakhsh snow water file is an older model version (GLDAS 2.0) that ends in 2014. It cannot be compared directly with the Naryn file (GLDAS 2.1).</li></ul>' +
      '<h2>Not in this version</h2><ul>' +
      '<li>MODIS satellite snow cover, which would check the modelled melt dates against what a satellite saw. The request needs a NASA Earthdata login and was not ready in time.</li>' +
      '<li>Glaciers. Nothing here measures glacier ice.</li>' +
      '<li>GRACE total water storage.</li></ul>' +
      '<h2>Related tools</h2><p>MODSNOW and SnowMapper Central Asia show how much snow there is now. This tool asks a different question: whether the long-term level is moving, and whether that is proven.</p></div>';
  }

  function pageAbout() {
    return '<div class="prose"><h1 class="title">About</h1>' +
      '<p>Tien Shan Water Account was built for the NASA Space Apps Challenge 2026 in Bishkek, for the challenge "Be an Earth system trend detective!".</p>' +
      '<h2>Who it is for</h2><ul>' + ROLES.map(function (r) { return '<li><strong>' + r.label + '.</strong> ' + r.job + '</li>'; }).join('') + '</ul>' +
      '<h2>Team</h2><p>[TEAM NAMES AND ROLES]</p>' +
      '<h2>Code and data</h2><p><a href="https://github.com/netchuu/tien-shan-water-account">github.com/netchuu/tien-shan-water-account</a></p>' +
      '<p>The data are open NASA products. To add a basin, add its box to tools/build_data.py, download its files and run the script.</p>' +
      '<h2>Use of AI</h2><p>AI tools helped with research, code and text during the hackathon. The figures on screen are calculated from NASA data by the code in this repository, and the statements use fixed templates. The question box can use Claude if the visitor adds their own API key; those answers are labelled.</p>' +
      '<h2>Next steps</h2><ul><li>MODIS satellite snow cover, to check the modelled melt dates.</li><li>True basin outlines in place of rectangles.</li><li>Kyrgyz and Russian versions.</li><li>A yearly update script.</li></ul></div>';
  }

  /* ---------- actions ---------- */

  function downloadCsv() {
    var b = basin(state.basin), v = variable(state.variable), r = result(b.id, v.id, state.month), st = r.stat, src = source(state.record, b.id, v.id);
    var lines = ['# Tien Shan Water Account', '# Place: ' + b.name + ' (' + b.range + ')', '# Variable: ' + subject(v, state.month) + ', ' + v.unit, '# Source: ' + src.source + ' (' + src.product + ')'];
    if (st) lines.push('# Theil-Sen slope: ' + st.perDecade.toFixed(4) + ' ' + v.unit + ' per decade; Mann-Kendall p = ' + st.p.toFixed(4) + '; ' + words(st, v));
    lines.push('year,value');
    r.series.years.forEach(function (y, i) { lines.push(y + ',' + r.series.values[i].toFixed(4)); });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
    a.download = ['water-account', b.id, v.id, state.month, st ? st.first + '-' + st.last : ''].join('_') + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------- routing ---------- */

  var RENDER = { '': pageOverview, overview: pageOverview, trend: pageTrend, statement: pageStatement, compare: pageCompare, method: pageMethod, about: pageAbout };

  // Keep the state consistent: every record has its own basins, variables and windows.
  function normalise() {
    if (!record(state.record)) state.record = D.records[0].id;
    var r = record(), basins = basinsIn();
    state.from = r.windows.indexOf(+state.from) < 1 ? 0 : +state.from;
    if (!basins.some(function (b) { return b.id === state.basin; })) state.basin = basins[0].id;
    ['variable', 'cmp'].forEach(function (k) {
      if (r.variables.indexOf(state[k]) < 0) state[k] = SNOW[state[k]] && r.variables.indexOf(SNOW[state[k]]) >= 0 ? SNOW[state[k]] : r.variables[0];
    });
  }
  function readHash() {
    var h = location.hash.replace(/^#\/?/, ''), parts = h.split('?');
    state.page = RENDER[parts[0]] ? parts[0] : '';
    (parts[1] || '').split('&').forEach(function (kv) {
      var p = kv.split('=');
      if (p[0] === 'record' && record(p[1])) state.record = p[1];
      if (p[0] === 'from') state.from = +p[1] || 0;
      if (p[0] === 'basin' && basin(p[1])) state.basin = p[1];
      if (p[0] === 'variable' && variable(p[1])) state.variable = p[1];
      if (p[0] === 'cmp' && variable(p[1])) state.cmp = p[1];
      if (p[0] === 'role' && role(p[1])) state.role = p[1];
      if (p[0] === 'month' && (p[1] === 'year' || (+p[1] >= 1 && +p[1] <= 12))) state.month = p[1];
    });
    normalise();
  }
  function hashFor() {
    var rec = state.record, from = state.from;
    if (state.page === 'trend') return link('trend', { record: rec, from: from, basin: state.basin, variable: state.variable, month: state.month, role: state.role });
    if (state.page === 'statement') return link('statement', { record: rec, from: from, basin: state.basin, role: state.role });
    if (state.page === 'compare') return link('compare', { record: rec, from: from, cmp: state.cmp });
    if (state.page === 'overview') return link('overview', { record: rec, from: from });
    return link(state.page);
  }
  function render(keepFocus) {
    var main = document.getElementById('main');
    var explore = EXPLORE.indexOf(state.page) >= 0;
    var tabs = !explore ? '' : '<nav class="tabs" aria-label="Explore data">' + EXPLORE.map(function (id) {
      return '<a href="' + link(id) + '"' + (id === state.page ? ' aria-current="page"' : '') + '>' + byId(PAGES, id).tab + '</a>';
    }).join('') + '</nav>';
    main.innerHTML = tabs + RENDER[state.page]();
    document.getElementById('nav').innerHTML = PAGES.filter(function (p) { return !p.hidden; }).map(function (p) {
      var current = p.id === state.page || (p.id === 'overview' && explore);
      return '<a class="btn" href="' + link(p.id) + '"' + (current ? ' aria-current="page"' : '') + '>' + p.label + '</a>';
    }).join('');
    document.title = (state.page ? byId(PAGES, state.page).label + ', ' : '') + 'Tien Shan Water Account';
    if (EXTRA.afterRender) EXTRA.afterRender(state.page);
    if (keepFocus) {
      var el = main.querySelector('[data-set="' + keepFocus.set + '"]' + (keepFocus.value !== '' ? '[data-value="' + keepFocus.value + '"]' : ''));
      if (el) el.focus();
    }
  }
  function set(key, value) {
    controlsOpen = key === 'record' || key === 'from';
    state[key] = key === 'from' ? +value : value;
    normalise();
    try { history.replaceState(null, '', hashFor()); } catch (e) { /* some browsers refuse this on file pages; the page still works */ }
    render({ set: key, value: key === 'month' || key === 'cmp' ? '' : String(state[key]) });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var el = e.target.closest('button[data-set]');
    if (el) { set(el.getAttribute('data-set'), el.getAttribute('data-value')); return; }
    var act = e.target.closest('button[data-action]');
    if (!act) return;
    var action = act.getAttribute('data-action');
    if (action === 'csv') downloadCsv();
    if (action === 'print') window.print();
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches && e.target.matches('select[data-set]')) set(e.target.getAttribute('data-set'), e.target.value);
  });
  window.addEventListener('hashchange', function () { readHash(); render(); window.scrollTo(0, 0); });

  // Shared with investigate.js, which adds the landing page and the daily (date) variables, then calls start().
  window.WA = {
    D: D, state: state, MONTHS: MONTHS, ROLES: ROLES, PAGES: PAGES, RENDER: RENDER, EXTRA: EXTRA, DEFINE: DEFINE,
    trend: trend, welch: welch, step: step, yearly: yearly, compute: compute, result: result, mean: mean,
    basin: basin, variable: variable, record: record, basinsIn: basinsIn, source: source,
    num: num, val: val, pText: pText, words: words, dayName: dayName, finding: finding, subject: subject, reading: reading, cautious: cautious,
    stepText: stepText, snowConflict: snowConflict, projection: projection, chart: chart, link: link, listWords: listWords,
    render: function () { render(); }, clearCache: function () { cache = {}; },
    start: function () {
      if (!D || !D.records || !basinsIn(D.records[0].id).length) {
        document.getElementById('main').innerHTML = '<div class="placeholder">[NO DATA LOADED YET]</div>';
        return;
      }
      readHash();
      render();
    }
  };
})();
