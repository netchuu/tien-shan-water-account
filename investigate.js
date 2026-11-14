/* Tien Shan Water Account: the "Investigate" page.
   Pick a place and a question; the tool reads the NASA record, tests it and answers.
   Also adds the variables built from daily data (dates and day counts) and the question box. */
(function () {
  'use strict';

  var WA = window.WA, D = WA.D, DAILY = window.WATER_DAILY || {};
  var DAY = 86400000;
  var CITIES = [['Bishkek', 42.87, 74.59], ['Osh', 40.53, 72.80], ['Karakol', 42.49, 78.39], ['Almaty', 43.24, 76.89], ['Tashkent', 41.31, 69.24], ['Dushanbe', 38.56, 68.79]];
  var MONTHLY = { SNODP: ['snowdepth', 'state'], PRECSNOLAND: ['snowfall', 'per_day'], PRECTOTCORR: ['precip', 'per_day'], T2M: ['temp', 'state'], FROST_DAYS: ['frost', 'state'], GWETROOT: ['soil', 'fraction'], EVLAND: ['evap', 'per_day'] };
  var QUESTIONS = [
    { id: 'melt', label: 'Is the snow melting earlier?', key: 'melt', yes: 'down', vars: ['melt', 'snowdepth', 'frost'], calendar: true,
      answers: { yes: 'Yes. The snow is melting earlier.', no: 'No. The snow is melting later.', open: 'No clear change. The record shows no reliable shift in the melt date.' } },
    { id: 'water', label: 'Is less water arriving?', key: 'precip', yes: 'down', vars: ['precip', 'snowfall', 'evap', 'soil'],
      answers: { yes: 'Yes. Less rain and snow is arriving.', no: 'No. More rain and snow is arriving.', open: 'No clear change. The record shows no reliable change in rain and snow.' } },
    { id: 'warm', label: 'Is it getting warmer?', key: 'temp', yes: 'up', vars: ['temp', 'frost', 'summer'],
      answers: { yes: 'Yes. It is getting warmer.', no: 'No. It is getting cooler.', open: 'No clear change. The record shows no reliable change in temperature.' } },
    { id: 'season', label: 'Is the growing season changing?', key: 'frostfree', yes: 'up', vars: ['frostfree', 'lastfrost', 'summer'],
      answers: { yes: 'Yes. The frost-free season is getting longer.', no: 'Yes, the other way. The frost-free season is getting shorter.', open: 'No clear change. The record shows no reliable change in the frost-free season.' } }
  ];
  var DEMOS = [
    { label: 'Is the snow above Toktogul melting earlier?', where: { kind: 'basin', id: 'naryn' }, q: 'melt' },
    { label: 'Is Bishkek getting warmer?', where: { kind: 'point', name: 'Bishkek', lat: 42.87, lon: 74.59 }, q: 'warm' },
    { label: 'Is the growing season above the Chu valley changing?', where: { kind: 'basin', id: 'chu' }, q: 'season' }
  ];
  var inv = { where: { kind: 'basin', id: 'naryn' }, q: 'melt', caseOf: null, status: '', chat: [], busy: false };
  var map = null, marker = null;

  /* ---------- variables built from daily data ---------- */

  D.variables.push(
    { id: 'melt', label: 'Snow half-melt date', long: 'the date the snow is half gone', unit: 'days', agg: 'mean', kind: 'reanalysis', date: true, fixed: true },
    { id: 'lastfrost', label: 'Last spring frost', long: 'the date of the last spring frost', unit: 'days', agg: 'mean', kind: 'reanalysis', date: true, fixed: true },
    { id: 'frostfree', label: 'Frost-free season', long: 'the length of the frost-free season', unit: 'days', agg: 'mean', kind: 'reanalysis', fixed: true },
    { id: 'summer', label: 'Summer days', long: 'the number of days of 25 °C or more', unit: 'days', agg: 'sum', kind: 'reanalysis', fixed: true, plural: true }
  );
  var TIMING = ['melt', 'lastfrost', 'frostfree', 'summer'];
  var longRecord = WA.record('long');
  longRecord.variables = longRecord.variables.concat(TIMING);
  longRecord.matrix = ['snowdepth', 'precip', 'temp', 'frost', 'melt', 'lastfrost', 'frostfree'];

  // Index the days of a daily series by calendar year.
  function yearIndex(d) {
    var t0 = Date.parse(d.start + 'T00:00:00Z'), years = {}, order = [];
    for (var i = 0; i < d.snow.length; i++) {
      var y = new Date(t0 + i * DAY).getUTCFullYear();
      if (!years[y]) { years[y] = { first: i, count: 0 }; order.push(y); }
      years[y].count++;
    }
    return { years: years, order: order };
  }
  // One value per year for each timing variable. Written for the northern hemisphere.
  function seasons(d) {
    var idx = yearIndex(d), out = { melt: {}, lastfrost: {}, frostfree: {}, summer: {} };
    idx.order.forEach(function (y) {
      var a = idx.years[y].first, len = idx.years[y].count, i, lastFrost = null;
      if (len >= 212) { // the year reaches the end of July
        // Winter peak: the deepest snow between 1 October of the year before and 30 June.
        var peak = -1, at = -1;
        for (i = Math.max(0, a - 92); i <= a + 180; i++) if (d.snow[i] !== null && d.snow[i] > peak) { peak = d.snow[i]; at = i; }
        if (peak >= 1) {
          for (i = at + 1; i < a + len; i++) {
            if (d.snow[i] !== null && d.snow[i] < peak / 2) { if (i - a + 1 >= 1) out.melt[y] = i - a + 1; break; }
          }
        }
        for (i = a; i < a + 212; i++) if (d.tmin[i] !== null && d.tmin[i] < 0) lastFrost = i - a + 1;
        if (lastFrost !== null) out.lastfrost[y] = lastFrost;
      }
      if (len >= 365) {
        var firstFrost = null, warm = 0;
        for (i = a + 212; i < a + len; i++) if (d.tmin[i] !== null && d.tmin[i] < 0) { firstFrost = i - a + 1; break; }
        if (lastFrost !== null && firstFrost !== null) out.frostfree[y] = firstFrost - lastFrost - 1;
        for (i = a; i < a + len; i++) if (d.tmax[i] !== null && d.tmax[i] >= 25) warm++;
        out.summer[y] = warm;
      }
    });
    return out;
  }
  function addTiming(bId, d, sourceText) {
    var s = seasons(d), products = { melt: 'SNODP, daily', lastfrost: 'T2M_MIN, daily', frostfree: 'T2M_MIN, daily', summer: 'T2M_MAX, daily' };
    TIMING.forEach(function (id) {
      if (Object.keys(s[id]).length >= 10) D.series.long[bId][id] = { source: sourceText, product: products[id], yearlyValues: s[id] };
    });
  }
  Object.keys(DAILY).forEach(function (bId) {
    if (D.series.long[bId]) addTiming(bId, DAILY[bId], 'NASA POWER (MERRA-2) daily values, mean of ' + DAILY[bId].cells + ' grid cells');
  });

  /* ---------- the snow calendar ---------- */

  // Average snow depth on each day of the year, for the first half of the years, the second half, and the latest year.
  function calendar(bId) {
    var d = DAILY[bId];
    if (!d) return '';
    var idx = yearIndex(d), full = idx.order.filter(function (y) { return idx.years[y].count >= 365; });
    if (full.length < 10) return '';
    var half = Math.floor(full.length / 2), early = full.slice(0, half), recent = full.slice(half), latest = idx.order[idx.order.length - 1];
    function curve(list) {
      var out = [];
      for (var k = 0; k < 365; k++) {
        var sum = 0, n = 0;
        list.forEach(function (y) { var v = d.snow[idx.years[y].first + k]; if (v !== null && v !== undefined && k < idx.years[y].count) { sum += v; n++; } });
        out.push(n ? sum / n : null);
      }
      return out;
    }
    var a = curve(early), b = curve(recent), c = curve([latest]);
    var hi = Math.max.apply(null, a.concat(b, c).filter(function (x) { return x !== null; })) || 1;
    function path(vals) {
      var p = '', pen = false;
      vals.forEach(function (v, k) {
        if (v === null) { pen = false; return; }
        p += (pen ? ' L' : ' M') + (6 + 388 * k / 364).toFixed(1) + ' ' + (6 + 108 * (1 - v / hi)).toFixed(1);
        pen = true;
      });
      return p.trim();
    }
    var melt = WA.compute('long', bId, 'melt', 'year', 0).series, m1 = [], m2 = [];
    melt.years.forEach(function (y, i) { (early.indexOf(y) >= 0 ? m1 : recent.indexOf(y) >= 0 ? m2 : []).push(melt.values[i]); });
    var shift = m1.length && m2.length ? WA.mean(m2) - WA.mean(m1) : null;
    var sentence = shift === null ? '' : 'On average the snow was half gone by ' + WA.dayName(WA.mean(m1)) + ' in ' + early[0] + ' to ' + early[early.length - 1] +
      ' and by ' + WA.dayName(WA.mean(m2)) + ' in ' + recent[0] + ' to ' + recent[recent.length - 1] + ': ' +
      (Math.abs(shift) < 0.5 ? 'no real difference.' : WA.num(Math.abs(shift)) + ' days ' + (shift < 0 ? 'earlier.' : 'later.'));
    return '<section class="panel calendar"><h2 class="panel-title">Snow through the year</h2>' +
      '<p class="caption">Average snow depth on each day of the year. Where the recent line sits to the left of the old one in spring, the snow leaves earlier.</p>' +
      '<svg class="chart" viewBox="0 0 400 120" preserveAspectRatio="none" role="img" aria-label="Snow depth through the year for ' + WA.basin(bId).name +
      ': the early years, the recent years and ' + latest + '. ' + sentence + '">' +
      '<path class="raw" d="' + path(a) + '"></path><path class="recent" d="' + path(b) + '"></path><path class="latest" d="' + path(c) + '"></path></svg>' +
      '<div class="axis"><span>January</span><span>April</span><span>July</span><span>October</span><span>December</span></div>' +
      '<div class="legend"><span><i class="key-old" aria-hidden="true"></i>' + early[0] + ' to ' + early[early.length - 1] + '</span>' +
      '<span><i class="key-new" aria-hidden="true"></i>' + recent[0] + ' to ' + recent[recent.length - 1] + '</span>' +
      '<span><i class="key-now" aria-hidden="true"></i>' + latest + ' so far</span></div>' +
      (sentence ? '<p>' + sentence + '</p>' : '') + '</section>';
  }
  WA.EXTRA.trendPanel = function (b, v) { return v.id === 'melt' || v.id === 'snowdepth' ? calendar(b.id) : ''; };

  /* ---------- fetching any place live ---------- */

  function ymd(date) { return date.toISOString().slice(0, 10).replace(/-/g, ''); }
  function getJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('NASA POWER answered with status ' + res.status);
      return res.json();
    });
  }
  function fetchPlace(name, lat, lon) {
    var base = 'https://power.larc.nasa.gov/api/temporal/';
    var monthlyUrl = base + 'monthly/point?parameters=' + Object.keys(MONTHLY).join(',') + '&community=AG&longitude=' + lon + '&latitude=' + lat + '&start=1981&end=2025&format=JSON';
    var dailyUrl = base + 'daily/point?parameters=SNODP,T2M_MIN,T2M_MAX&community=AG&longitude=' + lon + '&latitude=' + lat +
      '&start=19810101&end=' + ymd(new Date(Date.now() - 6 * DAY)) + '&format=JSON';
    // The daily record is optional: without it the dates are missing but the rest still works.
    return Promise.all([getJson(monthlyUrl), lat >= 0 ? getJson(dailyUrl).catch(function () { return null; }) : Promise.resolve(null)]).then(function (docs) {
      var params = docs[0].properties.parameter, out = {}, any = false;
      Object.keys(MONTHLY).forEach(function (p) {
        var def = MONTHLY[p], monthly = {};
        Object.keys(params[p] || {}).forEach(function (key) {
          var y = key.substr(0, 4), m = +key.substr(4), value = params[p][key];
          if (m === 13 || value === -999) return;
          if (def[1] === 'per_day') value *= new Date(+y, m, 0).getDate();
          if (def[1] === 'fraction') value *= 100;
          (monthly[y] = monthly[y] || [null, null, null, null, null, null, null, null, null, null, null, null])[m - 1] = value;
          any = true;
        });
        out[def[0]] = { source: 'NASA POWER (MERRA-2), one grid cell, fetched live', product: p, monthly: monthly };
      });
      if (!any) throw new Error('NASA POWER has no values for this point');
      var clean = String(name || 'My place').replace(/[<>&"']/g, '').slice(0, 30) || 'My place';
      D.basins = D.basins.filter(function (b) { return b.id !== 'place'; });
      D.basins.push({ id: 'place', name: clean, range: lat.toFixed(2) + '°, ' + lon.toFixed(2) + '°', feeds: 'this place', custom: true,
        box: lon.toFixed(2) + ', ' + lat.toFixed(2), cells: 1, elevation: Math.round(docs[0].geometry.coordinates[2]) });
      WA.D.basins = D.basins;
      D.series.long.place = out;
      delete DAILY.place;
      if (docs[1]) {
        var dp = docs[1].properties.parameter, days = Object.keys(dp.SNODP).sort();
        function col(p) { return days.map(function (k) { return dp[p][k] === -999 ? null : dp[p][k]; }); }
        DAILY.place = { start: days[0].substr(0, 4) + '-' + days[0].substr(4, 2) + '-' + days[0].substr(6, 2), cells: 1, snow: col('SNODP'), tmin: col('T2M_MIN'), tmax: col('T2M_MAX') };
        addTiming('place', DAILY.place, 'NASA POWER (MERRA-2) daily values, one grid cell, fetched live');
      }
      WA.clearCache();
    });
  }

  /* ---------- the case file ---------- */

  function strip(html) { return html.replace(/<[^>]+>/g, '').replace(/ /g, ' '); }
  function cautions(b, v, r) {
    var out = [];
    if (r.step) out.push(WA.stepText(v, r.step));
    if ((v.id === 'snowdepth' || v.id === 'swe') && r.stat && r.stat.proven && WA.snowConflict(b.id)) out.push(WA.snowConflict(b.id));
    return out;
  }
  // The same test over the shorter window, so the answer always comes with its years.
  function sinceText(b, id) {
    var w = longRecord.windows[longRecord.windows.length - 1], st = WA.compute('long', b.id, id, 'year', w).stat;
    if (!st || st.first < w) return '';
    return ' Over ' + st.first + ' to ' + st.last + ' alone the change is ' + (st.proven ? 'also statistically significant.' : 'not statistically significant: fewer years give the test less to work with.');
  }
  function verdict(b, q) {
    var v = WA.variable(q.key), r = WA.compute('long', b.id, q.key, 'year', 0), st = r.stat;
    if (!st) {
      return { cls: 'none', text: q.key === 'melt' ? 'This place has too little snow to date the melt.' : 'There is not enough data here to answer.', detail: '' };
    }
    var dir = !st.proven ? 'open' : (st.slope > 0 ? 'up' : 'down') === q.yes ? 'yes' : 'no';
    var weak = cautions(b, v, r).length > 0;
    return {
      cls: weak ? 'none' : st.cls,
      text: q.answers[dir] + (dir !== 'open' ? (weak ? ' The test passes, but with a caution below.' : '') : ''),
      detail: 'Since ' + st.first + ': ' + strip(WA.finding(v, 'year', st)) + sinceText(b, q.key)
    };
  }
  function caseFile() {
    var b = WA.basin(inv.caseOf), q = QUESTIONS.filter(function (x) { return x.id === inv.q; })[0];
    if (!b || !D.series.long[b.id]) return '';
    var head = verdict(b, q);
    var cards = q.vars.map(function (id) {
      var v = WA.variable(id), r = WA.compute('long', b.id, id, 'year', 0), st = r.stat;
      if (!st) return '<section class="panel card"><h3 class="panel-title">' + v.label + '</h3><p class="caption">' + WA.DEFINE[id] + '</p><div class="placeholder">[NO DATA FOR THIS PLACE]</div></section>';
      var w = WA.words(st, v);
      var label = b.name + ' ' + v.label.toLowerCase() + ', ' + st.first + ' to ' + st.last + (w ? ', ' + w : '');
      var proj = WA.projection(b, v, r);
      return '<section class="panel card"><h3 class="panel-title">' + v.label + '</h3>' +
        '<p class="caption">' + WA.DEFINE[id] + '</p>' +
        '<p class="card-figure"><strong class="' + (st.cls === 'none' ? '' : st.cls) + '">' + WA.num(st.perDecade, true) + ' ' + v.unit + '</strong> per decade' + (w ? ', ' + w : '') + '</p>' +
        WA.chart(r.series, st, label) +
        '<div class="axis"><span>' + st.first + '</span><span>Average ' + WA.val(v, st.mean) + ', ' + WA.pText(st.p) + '</span><span>' + st.last + '</span></div>' +
        cautions(b, v, r).map(function (c) { return '<p class="warn">' + c + '</p>'; }).join('') +
        (proj ? '<p class="caption">' + proj + '</p>' : '') +
        (WA.EXTRA.futureCard ? WA.EXTRA.futureCard(b, v) : '') +
        '<a class="more" href="' + WA.link('trend', { record: 'long', from: 0, basin: b.id, variable: id, month: 'year' }) + '">Full record</a></section>';
    }).join('');
    return '<section class="case" aria-label="Case file">' +
      '<div class="head"><h2 class="title">Case file: ' + b.name + '</h2><span class="caption">' + b.range + (b.elevation ? ', about ' + b.elevation + ' m' : '') + ', NASA record from 1981</span></div>' +
      '<div class="panel verdict"><p class="caption">' + q.label + '</p><p class="verdict-text ' + (head.cls === 'none' ? '' : head.cls) + '">' + head.text + '</p>' +
      (head.detail ? '<p>' + head.detail + '</p>' : '') + '</div>' +
      '<div class="cards">' + cards + '</div>' +
      (q.calendar ? calendar(b.id) : '') +
      askBox(b) +
      '<p class="caption">' + (b.custom ? '' : '<a href="' + WA.link('statement', { record: 'long', from: 0, basin: b.id }) + '">What this means for a water engineer, a dam dispatcher or a negotiator</a>. ') +
      '<a href="' + WA.link('trend', { record: 'long', from: 0, basin: b.id, variable: q.key, month: 'year' }) + '">Every variable for ' + b.name + '</a>. ' +
      'Past record, not a forecast; no glaciers in the data. <a href="' + WA.link('method') + '">Limits</a>.</p></section>';
  }

  /* ---------- questions in plain words ---------- */

  function chatHtml() {
    return inv.chat.map(function (t) {
      if (t.role === 'user') return '<div class="turn you"><p class="caption">You</p><p></p></div>';
      return '<div class="turn"><p class="caption">The tool</p>' +
        t.parts.map(function () { return '<p></p>'; }).join('') + (t.by ? '<p class="caption"></p>' : '') + '</div>';
    }).join('');
  }
  // Text goes in through textContent, so nothing typed or returned is ever treated as HTML.
  function drawChat() {
    var box = document.getElementById('chat');
    if (!box) return;
    box.innerHTML = chatHtml();
    Array.prototype.forEach.call(box.children, function (el, k) {
      var t = inv.chat[k], ps = el.querySelectorAll('p');
      if (t.role === 'user') { ps[1].textContent = t.text; return; }
      t.parts.forEach(function (p, n) { ps[n + 1].textContent = p; });
      if (t.by) ps[ps.length - 1].textContent = t.by;
    });
    box.scrollTop = box.scrollHeight;
  }
  function askBox(b) {
    return '<section class="panel ask"><h3 class="panel-title">Ask about ' + b.name + '</h3>' +
      '<p class="caption">Ask as many questions as you like. For example: when is the snow gone now? Will it keep changing? How sure is this?</p>' +
      '<div id="chat" class="chat" role="log" aria-live="polite" aria-label="Conversation"></div>' +
      '<form class="ask-form" data-form="ask"><label class="field wide">Your question <input type="text" name="q" maxlength="300" autocomplete="off"></label>' +
      '<button type="submit" class="btn">Ask</button><button type="button" class="btn" data-inv="clearchat">Clear</button></form></section>';
  }
  // Every finding for the place, as plain text.
  function facts(b, ids) {
    return (ids || longRecord.variables).map(function (id) {
      var v = WA.variable(id), r = WA.compute('long', b.id, id, 'year', 0);
      if (!r.stat) return null;
      var line = strip(WA.finding(v, 'year', r.stat));
      cautions(b, v, r).forEach(function (c) { line += ' Caution: ' + c; });
      return { id: id, v: v, r: r, line: line };
    }).filter(Boolean);
  }
  function localAnswer(question, b) {
    var t = question.toLowerCase(), ids = [], notes = [];
    function add(list) { list.forEach(function (x) { if (ids.indexOf(x) < 0) ids.push(x); }); }
    if (/glacier|ice\b/.test(t)) notes.push('This data has no glaciers in it. The NASA models here track seasonal snow, not glacier ice, so the tool cannot answer for glaciers.');
    if (/snow|melt|glacier|thaw/.test(t)) add(['melt', 'snowdepth']);
    if (/rain|water|precip|dry|drought|river|flow|irrigat/.test(t)) add(['precip', 'snowfall', 'soil', 'evap']);
    if (/warm|hot|heat|temperature|cold|cool/.test(t)) add(['temp', 'summer', 'frost']);
    if (/frost|season|crop|plant|grow|farm|field|harvest|sow/.test(t)) add(['lastfrost', 'frostfree']);
    if (/when|date|which day|what day/.test(t) && !ids.length) add(['melt', 'lastfrost']);
    var found = facts(b, ids.length ? ids : null), lines = [];
    if (/sure|trust|reliab|accura|confiden|true|proof|prove|certain/.test(t)) {
      lines.push('Each change is tested with the Mann-Kendall test. "Proven" means there is less than a 5% chance that pure year-to-year noise would give a trend this consistent. It does not prove the cause, and the data are model estimates, not ground measurements.');
    }
    if (/when|date|which day|what day|now\b/.test(t)) {
      found.forEach(function (f) {
        if (!f.v.date) return;
        var vals = f.r.series.values, recent = vals.slice(-10);
        lines.push(f.v.label + ': on average ' + WA.dayName(WA.mean(recent)) + ' over the last ' + recent.length + ' years on record (' + WA.dayName(WA.mean(vals)) + ' over the whole record).');
      });
    }
    if (/future|will\b|forecast|predict|next|continue|keep|20[3-9]\d/.test(t)) {
      var proj = found.map(function (f) { var p = WA.projection(b, f.v, f.r); return p ? f.v.label + ': ' + p : ''; }).filter(Boolean);
      lines.push(proj.length ? proj.join(' ') : 'Nothing here has a significant enough trend to extend. The tool does not forecast; it only extends a past trend line, and none qualifies for this question.');
      if (WA.EXTRA.futureLines) WA.EXTRA.futureLines(b, ids.length ? ids : null).forEach(function (l) { lines.push(l); });
    }
    if (!ids.length && !lines.length) found = found.filter(function (f) { return f.r.stat.proven; });
    found.forEach(function (f) { lines.push(f.line); });
    if (!lines.length && !notes.length) lines.push('No significant trend for ' + b.name + ' on this record.');
    return notes.concat(lines);
  }
  function answer(role, parts, by) {
    inv.chat.push({ role: role, parts: parts, by: by });
    drawChat();
  }
  // Answers come from fixed rules over the calculated figures. No AI service is called.
  function ask(question) {
    var b = WA.basin(inv.caseOf);
    question = (question || '').trim();
    if (!b || !question) return;
    inv.chat.push({ role: 'user', text: question });
    var input = document.querySelector('form[data-form="ask"] input[name="q"]');
    if (input) input.value = '';
    answer('tool', localAnswer(question, b), '');
  }

  /* ---------- the page ---------- */

  function pressed(on) { return on ? 'true' : 'false'; }
  function pageInvestigate() {
    var w = inv.where;
    return '<div class="head"><h1 class="title">Is your water changing?</h1></div>' +
      '<p class="lead">Pick a place and a question. The tool tests 45 years of NASA records and answers.</p>' +
      '<div class="steps"><section class="panel"><h2 class="panel-title">Where?</h2>' +
      '<div id="map" aria-label="Map. Select a basin, a city or any point."></div>' +
      '<p class="caption" id="inv-where">' + whereText() + '</p>' +
      '<details' + (w.kind === 'point' && !w.fromMap ? ' open' : '') + '><summary>Type coordinates</summary><form class="place-form" data-form="point">' +
      '<label class="field">Name <input type="text" name="name" maxlength="30" autocomplete="off" value="' + (w.kind === 'point' ? w.name : 'My place') + '"></label>' +
      '<label class="field">Latitude <input type="number" name="lat" step="0.01" min="-90" max="90" value="' + (w.kind === 'point' ? w.lat : '') + '"></label>' +
      '<label class="field">Longitude <input type="number" name="lon" step="0.01" min="-180" max="180" value="' + (w.kind === 'point' ? w.lon : '') + '"></label>' +
      '<button type="submit" class="btn">Use this point</button></form></details></section>' +
      '<section class="panel"><h2 class="panel-title">What do you want to know?</h2>' +
      '<div class="btn-col" role="group" aria-label="Question">' + QUESTIONS.map(function (q) {
        return '<button type="button" class="btn" data-inv="q" data-value="' + q.id + '" aria-pressed="' + pressed(inv.q === q.id) + '">' + q.label + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="btn go" data-inv="go"' + (inv.busy ? ' disabled' : '') + '>Investigate</button>' +
      '<p id="inv-status" role="status" class="' + (inv.status.charAt(0) === '[' ? 'warn' : 'caption') + '">' + inv.status + '</p>' +
      '<p class="caption">Or watch an example:</p><ul class="examples">' + DEMOS.map(function (d, i) {
        return '<li><button type="button" class="link" data-inv="demo" data-value="' + i + '">' + d.label + '</button></li>';
      }).join('') + '</ul></section></div>' +
      '<div id="case">' + (inv.caseOf ? caseFile() : '') + '</div>';
  }
  function whereText() {
    var w = inv.where;
    if (w.kind === 'basin') return 'Chosen: the ' + WA.basin(w.id).name + ' basin, ' + WA.basin(w.id).range + '. Select another basin, a city or any point on the map.';
    return 'Chosen: ' + w.name + ', ' + (+w.lat).toFixed(2) + '°, ' + (+w.lon).toFixed(2) + '°. Its record is fetched live from NASA.';
  }
  function setStatus(text) {
    inv.status = text;
    var el = document.getElementById('inv-status');
    if (el) { el.textContent = text; el.className = text.charAt(0) === '[' ? 'warn' : 'caption'; }
  }
  function run() {
    var w = inv.where;
    inv.chat = [];
    if (w.kind === 'basin') { inv.caseOf = w.id; inv.status = ''; WA.render(); scrollToCase(); return; }
    if (isNaN(w.lat) || isNaN(w.lon) || w.lat < -90 || w.lat > 90 || w.lon < -180 || w.lon > 180) { setStatus('[CHECK THE COORDINATES] Latitude runs from −90 to 90 and longitude from −180 to 180.'); return; }
    inv.busy = true;
    setStatus('Fetching 45 years of monthly and daily records from NASA POWER. This takes a few seconds.');
    fetchPlace(w.name, +w.lat, +w.lon).then(function () {
      inv.busy = false; inv.caseOf = 'place'; inv.status = '';
      if (WA.state.page === '') { WA.render(); scrollToCase(); }
    }).catch(function (err) {
      inv.busy = false;
      inv.status = '[COULD NOT REACH NASA POWER] ' + (err && err.message ? err.message + '. ' : '') + 'Check the internet connection and try again. The four built-in basins work without it.';
      if (WA.state.page === '') WA.render();
    });
  }
  function scrollToCase() {
    var el = document.getElementById('case');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
  }
  function choosePoint(name, lat, lon, redraw) {
    inv.where = { kind: 'point', name: name, lat: lat, lon: lon, fromMap: !redraw };
    inv.caseOf = null; // the old case file belongs to another place
    if (redraw) { WA.render(); return; }
    var old = document.getElementById('case');
    if (old) old.innerHTML = '';
    // A map click: update the form in place so the map does not reload.
    var form = document.querySelector('form[data-form="point"]');
    if (form) { form.elements.lat.value = lat.toFixed(2); form.elements.lon.value = lon.toFixed(2); form.elements.name.value = name; }
    Array.prototype.forEach.call(document.querySelectorAll('[data-inv="basin"]'), function (b) { b.setAttribute('aria-pressed', 'false'); });
    var where = document.getElementById('inv-where');
    if (where) where.textContent = whereText();
    placeMarker();
  }
  function placeMarker() {
    if (!map) return;
    if (marker) { map.removeLayer(marker); marker = null; }
    var w = inv.where;
    if (w.kind === 'point') marker = window.L.circleMarker([w.lat, w.lon], { radius: 9, color: '#EAF0F5', weight: 3, fillColor: '#142230', fillOpacity: 1 }).addTo(map);
  }
  function initMap() {
    var el = document.getElementById('map');
    map = null; marker = null;
    if (!el) return;
    if (!window.L) { el.outerHTML = '<p class="caption">The map could not load. Use the buttons or type coordinates.</p>'; return; }
    var L = window.L, w = inv.where;
    map = L.map(el, { zoomControl: true, attributionControl: true, minZoom: 2, maxZoom: 9 }).setView(w.kind === 'point' ? [w.lat, w.lon] : [41.3, 74.5], w.kind === 'point' ? 6 : 5);
    // NASA's own Blue Marble imagery (GIBS). It is open and needs no key.
    var blank = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
      { maxNativeZoom: 8, maxZoom: 9, errorTileUrl: blank, attribution: 'Imagery: NASA GIBS, Blue Marble' }).addTo(map);
    // City names are drawn by the page itself, so the map needs no second tile service.
    CITIES.forEach(function (c) {
      var dot = L.circleMarker([c[1], c[2]], { radius: 4, color: '#142230', weight: 1, fillColor: '#EAF0F5', fillOpacity: 1 }).addTo(map);
      dot.bindTooltip(c[0], { permanent: true, direction: 'right', offset: [6, 0], className: 'city-label' });
      dot.on('click', function (e) { L.DomEvent.stopPropagation(e); choosePoint(c[0], c[1], c[2], false); });
    });
    D.basins.forEach(function (b) {
      if (b.custom || !b.box) return;
      var p = b.box.split(',').map(Number), on = w.kind === 'basin' && w.id === b.id;
      var rect = L.rectangle([[p[1], p[0]], [p[3], p[2]]], { color: '#EAF0F5', weight: on ? 3 : 1.5, dashArray: on ? null : '5 5', fillColor: '#EAF0F5', fillOpacity: on ? 0.25 : 0.05 }).addTo(map);
      rect.bindTooltip(b.name + ' basin', { permanent: true, direction: 'center', className: 'basin-label' });
      rect.on('click', function (e) { L.DomEvent.stopPropagation(e); inv.where = { kind: 'basin', id: b.id }; inv.caseOf = null; WA.render(); });
    });
    map.on('click', function (e) { choosePoint('My place', +e.latlng.lat.toFixed(2), +((e.latlng.lng + 540) % 360 - 180).toFixed(2), false); });
    placeMarker();
  }
  var earlier = WA.EXTRA.afterRender;
  WA.EXTRA.afterRender = function (page) {
    if (earlier) earlier(page);
    if (page === '') { initMap(); drawChat(); } else { map = null; marker = null; }
  };
  // Lets another page (the map over time) hand a point to this one.
  WA.pick = function (name, lat, lon) {
    inv.where = { kind: 'point', name: name, lat: lat, lon: lon };
    inv.caseOf = null;
    location.hash = WA.link('');
  };
  WA.RENDER[''] = pageInvestigate;

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('button[data-inv]') : null;
    if (!el) return;
    var act = el.getAttribute('data-inv'), value = el.getAttribute('data-value');
    if (act === 'basin') { inv.where = { kind: 'basin', id: value }; inv.caseOf = null; WA.render(); }
    if (act === 'city') { var c = CITIES[+value]; choosePoint(c[0], c[1], c[2], true); }
    if (act === 'q') { inv.q = value; WA.render(); if (inv.caseOf) scrollToCase(); }
    if (act === 'clearchat') { inv.chat = []; drawChat(); }
    if (act === 'go') run();
    if (act === 'demo') { var d = DEMOS[+value]; inv.where = JSON.parse(JSON.stringify(d.where)); inv.q = d.q; inv.caseOf = null; WA.render(); run(); }
  });
  document.addEventListener('submit', function (e) {
    var form = e.target.getAttribute ? e.target.getAttribute('data-form') : null;
    if (form === 'point') {
      e.preventDefault();
      choosePoint(e.target.elements.name.value || 'My place', parseFloat(e.target.elements.lat.value), parseFloat(e.target.elements.lon.value), true);
    }
    if (form === 'ask') { e.preventDefault(); ask(e.target.elements.q.value); }
  });

  WA.start();
})();
