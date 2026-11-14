# Tien Shan Water Account

A browser tool that shows how snow, rain, temperature, frost, soil wetness and evaporation have changed in four Central Asian river basins since 1981, tests whether each change is statistically proven, and states what it means for a water engineer, a dam dispatcher and a negotiator. Built for NASA Space Apps 2026, challenge "Be an Earth system trend detective!".

## Run it

Open `index.html` in a browser. No server, build step or internet connection is needed. Only the "Any place" page needs internet, because it fetches from the NASA POWER service.

To serve it locally instead: `python3 -m http.server 8931` and open http://127.0.0.1:8931/.

## Files

| Path | What it is |
|---|---|
| `index.html`, `styles.css`, `app.js`, `investigate.js` | The site. Statistics run in the browser in `app.js`; `investigate.js` holds the start page, the daily-data variables and the question box. |
| `data/daily.js`, `data/raw/power_daily/` | Daily snow depth and temperature per basin since 1981, built by `tools/build_daily.py`. |
| `vendor/leaflet/` | The Leaflet map library (BSD 2-Clause). |
| `data/data.js` | The series the site reads. Generated; do not edit. |
| `data/water_account.csv` | The same series as one table: record, basin, variable, year, month, value, unit, source. |
| `backup-v1/` | The first version of the site (Giovanni files only), kept as a fallback. |
| `data/raw/giovanni/<basin>/` | Area-averaged time series downloaded from NASA Giovanni. |
| `data/raw/power/<basin>/<lat>_<lon>.json` | NASA POWER monthly values 1981–2025, one file per grid cell in the basin box. |
| `tools/build_data.py` | Rebuilds `data/data.js` and the CSV from the raw files. |
| `fonts/` | Sofia Sans Condensed (SIL Open Font License), bundled so the site works offline. |
| `DESIGN.md`, `design/` | The locked visual design and its source screens. |

## What it does

- **Investigate (start page):** pick a place (a basin, a city, a click on the map, or coordinates) and a question: is the snow melting earlier, is less water arriving, is it getting warmer, is the growing season changing. The tool tests the NASA record and returns a case file: the answer, the evidence with plain definitions, cautions, and where the line would be in ten years.
- **Map over time:** one square per NASA grid cell (73 cells), coloured by its value in the chosen year. A slider and a Play button run from 1981 to 2025 and on to 2035, where each cell's proven trend line is extended as a labelled projection. Cells without a proven trend are left empty. Built by `tools/build_cells.py` into `data/cells.js`.
- **Climate-model projections:** each evidence card adds what three NASA NEX-GDDP-CMIP6 models project for 2043–2050 against 2005–2012 (middle emissions path), with the spread between models. Built by `tools/build_future.py` into `data/future.js`.
- **Snow calendar:** average snow depth on each day of the year, early years against recent years against this year, and the shift in the date the snow is half gone.
- **Ask:** a conversation about the place. Without a key the tool answers from its own rules. With an Anthropic API key (entered on the page, kept in the browser) Claude answers from the calculated figures only.
- **Explore data** holds four views. **All basins:** every basin against every variable, with the change per decade and a verdict.
- **Trend:** one place and variable in depth, for the whole year or a single month, with old and new averages and a CSV download.
- **Statement:** the findings as sentences, and what they mean for a water engineer, a dam dispatcher or a negotiator. Printable.
- **Compare:** one variable across the basins as yearly stripes.
- **Two records:** the long record (NASA POWER, 1981 to now, four basins, monthly and daily) and the Giovanni files (2000–2025, two basins). Two fixed windows, since 1981 and since 2000.
- **Cautions:** it flags a proven change that is really one step, and a basin where the two snow products disagree.

The four basins work offline. Any other place, and the map background, need internet.

## Add or update data

**Giovanni files.** Choose "Time Series, Area-Averaged", the variable, the basin box and the dates, download the CSV and put it in `data/raw/giovanni/<basin>/`. Recognised variables: `GLDAS_NOAH025_M_2_1_SWE_inst` (preferred) or `GLDAS_NOAH025_M_2_0_SWE_inst`, `M2TMNXLND_5_12_4_PRECSNOLAND`, `M2TMNXLND_5_12_4_PRECTOTLAND`, `M2TMNXSLV_5_12_4_T2M` (in °C).

**NASA POWER files.** One request per grid cell (latitude in steps of 0.5, longitude in steps of 0.625); the URL is at the top of `tools/build_data.py`. No login is needed.

Then run `python3 tools/build_data.py`. To add a basin, add its box to `BASINS` in that script first.

## Method

Yearly values (or one month across years) remove the seasonal cycle. The rate of change is the Theil-Sen slope. The Mann-Kendall test decides "proven" (p below 0.05) or "not proven". A proven change is flagged as "one step" when a single jump fits the years at least 20% better than a straight line. Welch's t-test compares the first and second half of the record. Limits are listed on the site's "Method and data" page.
