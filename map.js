/* Tien Shan Water Account: the map over time.
   One square per NASA grid cell, coloured by its value in the chosen year. A slider moves through
   the record (1981 to 2025) and on into projected years, where each cell's proven trend line is extended. */
(function () {
  'use strict';

  var WA = window.WA, C = window.WATER_CELLS;
  if (!C) return;
  var VARS = ['melt', 'snowdepth', 'precip', 'temp', 'frost'].filter(function (id) { return C.cells.some(function (c) { return c[id]; }); });
  var FIRST = C.years[0], LAST = C.years[C.years.length - 1], HORIZON = LAST + 10;
  var m = { v: VARS[0], year: LAST, timer: null };
  var map = null, squares = [], fits = {};

  WA.PAGES.splice(1, 0, { id: 'map', label: 'Map over time' });

  function mix(c1, c2, t) {
    function ch(c, i) { return parseInt(c.substr(1 + 2 * i, 2), 16); }
    var out = '#';
    for (var i = 0; i < 3; i++) { var x = Math.round(ch(c1, i) + (ch(c2, i) - ch(c1, i)) * t).toString(16); out += x.length < 2 ? '0' + x : x; }
    return out;
  }
  function colour(t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? mix('#FFB866', '#2A3F54', t * 2) : mix('#2A3F54', '#8FC3FF', (t - 0.5) * 2); }

  // The trend and the range of one cell for one variable, calculated once.
  function fit(i, id) {
    var key = i + '|' + id;
    if (!fits[key]) {
      var ys = [], vs = [];
      (C.cells[i][id] || []).forEach(function (v, k) { if (v !== null) { ys.push(C.years[k]); vs.push(v); } });
      var st = WA.trend(ys, vs), series = { years: ys, values: vs };
      fits[key] = { st: st, step: st ? WA.step(series, st) : null, lo: Math.min.apply(null, vs), hi: Math.max.apply(null, vs), n: vs.length };
    }
    return fits[key];
  }
  // The value of a cell in a year: measured inside the record, the extended line after it.
  // A projection is given only where the trend is proven and is not a single step.
  function valueAt(i, id, year) {
    var f = fit(i, id);
    if (year <= LAST) { var v = C.cells[i][id][year - FIRST]; return { value: v === undefined ? null : v, kind: 'record' }; }
    if (!f.st || !f.st.proven || f.step) return { value: null, kind: 'none' };
    return { value: f.st.icpt + f.st.slope * (year - f.st.first), kind: 'projection' };
  }
  function basinMeans(id, year) {
    var sums = {};
    C.cells.forEach(function (c, i) {
      var x = valueAt(i, id, year);
      sums[c.b] = sums[c.b] || { sum: 0, n: 0, total: 0 };
      sums[c.b].total++;
      if (x.value !== null) { sums[c.b].sum += x.value; sums[c.b].n++; }
    });
    return sums;
  }

  function pageMap() {
    var v = WA.variable(m.v);
    return '<div class="head"><h1 class="title">The map over time</h1><span class="caption">One square is one NASA grid cell of about 50 km</span></div>' +
      '<p class="lead">Move the slider to watch each year since ' + FIRST + '. Past ' + LAST + ' the map shows a projection: each cell\'s past trend line, extended.</p>' +
      '<div class="btn-row" role="group" aria-label="Variable">' + VARS.map(function (id) {
        return '<button type="button" class="btn" data-map="var" data-value="' + id + '" aria-pressed="' + (id === m.v) + '">' + WA.variable(id).label + '</button>';
      }).join('') + '</div>' +
      '<p class="caption">' + WA.DEFINE[m.v] + '</p>' +
      '<div class="timebar"><button type="button" class="btn" data-map="play" id="map-play">Play</button>' +
      '<span class="year" id="map-year"></span>' +
      '<input type="range" id="map-slider" min="' + FIRST + '" max="' + HORIZON + '" step="1" value="' + m.year + '" aria-label="Year">' +
      '<span class="caption">' + FIRST + ' to ' + LAST + ' record, then projection to ' + HORIZON + '</span></div>' +
      '<p id="map-kind" role="status"></p>' +
      '<div id="tmap" aria-label="Map of the grid cells. Select a square to investigate that point."></div>' +
      '<div class="legend"><span><i style="background:#FFB866" aria-hidden="true"></i>' + (v.date ? 'Earliest' : 'Lowest') + ' in that cell\'s own record</span>' +
      '<span><i style="background:#2A3F54;border:1px solid #7F93A5" aria-hidden="true"></i>Middle</span>' +
      '<span><i style="background:#8FC3FF" aria-hidden="true"></i>' + (v.date ? 'Latest' : 'Highest') + '</span>' +
      '<span><i class="key-empty" aria-hidden="true"></i>No value, or no significant trend to project</span></div>' +
      '<ul class="readout" id="map-readout"></ul>' +
      '<p class="caption">Each cell is coloured against its own record, so a high valley and a low one can be compared. Select a square to open the full investigation for that point.</p>';
  }

  function update() {
    var v = WA.variable(m.v), projected = m.year > LAST, shown = 0;
    squares.forEach(function (sq, i) {
      var f = fit(i, m.v), x = valueAt(i, m.v, m.year), cell = C.cells[i];
      var text = x.value === null ? (projected ? 'no significant trend, so no projection' : 'no value this year') : WA.val(v, x.value) + (projected ? ' (projected)' : '');
      if (x.value === null) {
        sq.setStyle({ fillOpacity: 0, color: '#7F93A5', weight: 1, dashArray: '3 4' });
      } else {
        shown++;
        sq.setStyle({ fillColor: colour(f.hi === f.lo ? 0.5 : (x.value - f.lo) / (f.hi - f.lo)), fillOpacity: 0.9, color: '#142230', weight: 1, dashArray: projected ? '4 3' : null });
      }
      sq.setTooltipContent(v.label + ', ' + m.year + ': ' + text + '<br>' + cell.lat + '°, ' + cell.lon + '°, ' + cell.elev + ' m');
    });
    var yearEl = document.getElementById('map-year'), kind = document.getElementById('map-kind'), readout = document.getElementById('map-readout');
    if (yearEl) yearEl.textContent = m.year;
    if (kind) {
      kind.className = projected ? 'warn' : 'caption';
      kind.textContent = projected
        ? 'Projection for ' + m.year + '. Each cell\'s past trend line is extended; ' + shown + ' of ' + squares.length + ' cells have one. This is not a forecast, and nature does not have to follow the line.'
        : 'Record for ' + m.year + ': values from NASA POWER (MERRA-2).';
    }
    if (readout) {
      var means = basinMeans(m.v, m.year);
      readout.innerHTML = WA.D.basins.filter(function (b) { return means[b.id]; }).map(function (b) {
        var s = means[b.id];
        return '<li><strong>' + b.name + '</strong> ' + (s.n ? WA.val(v, s.sum / s.n) + (projected ? ' projected, from ' + s.n + ' of ' + s.total + ' cells' : '') : 'no projection') + '</li>';
      }).join('');
    }
  }
  function stop() {
    if (m.timer) { clearInterval(m.timer); m.timer = null; }
    var b = document.getElementById('map-play');
    if (b) b.textContent = 'Play';
  }
  function play() {
    if (m.timer) { stop(); return; }
    if (m.year >= HORIZON) m.year = FIRST;
    document.getElementById('map-play').textContent = 'Pause';
    m.timer = setInterval(function () {
      if (WA.state.page !== 'map' || m.year >= HORIZON) { stop(); return; }
      m.year++;
      var s = document.getElementById('map-slider');
      if (s) s.value = m.year;
      update();
    }, 350);
  }
  function initMap() {
    var el = document.getElementById('tmap');
    map = null; squares = [];
    if (!el) return;
    if (!window.L) { el.outerHTML = '<p class="warn">[THE MAP LIBRARY DID NOT LOAD]</p>'; return; }
    var L = window.L, blank = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    map = L.map(el, { minZoom: 3, maxZoom: 8, zoomSnap: 0.25 }).setView([40.8, 74.2], 6);
    L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
      { maxNativeZoom: 8, maxZoom: 8, errorTileUrl: blank, attribution: 'Imagery: NASA GIBS, Blue Marble' }).addTo(map);
    C.cells.forEach(function (c) {
      var sq = L.rectangle([[c.lat - 0.25, c.lon - 0.3125], [c.lat + 0.25, c.lon + 0.3125]], { weight: 1 }).addTo(map);
      sq.bindTooltip('', { sticky: true, className: 'cell-tip' });
      sq.on('click', function () { if (WA.pick) WA.pick('Cell ' + c.lat + ', ' + c.lon, c.lat, c.lon); });
      squares.push(sq);
    });
    // Show every cell whatever the screen width.
    map.invalidateSize();
    map.fitBounds(L.featureGroup(squares).getBounds(), { padding: [12, 12], animate: false });
    el.setAttribute('data-zoom', map.getZoom());
    update();
  }

  var previous = WA.EXTRA.afterRender;
  WA.EXTRA.afterRender = function (page) {
    if (previous) previous(page);
    if (page === 'map') initMap(); else { stop(); map = null; squares = []; }
  };
  WA.RENDER.map = pageMap;

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('button[data-map]') : null;
    if (!el) return;
    if (el.getAttribute('data-map') === 'var') { stop(); m.v = el.getAttribute('data-value'); WA.render(); }
    if (el.getAttribute('data-map') === 'play') play();
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'map-slider') { stop(); m.year = +e.target.value; update(); }
  });
})();
