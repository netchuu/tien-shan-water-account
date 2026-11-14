#!/usr/bin/env python3
"""Turn the raw NASA downloads into the files the site reads.

Usage:  python3 tools/build_data.py
Reads   data/raw/giovanni/<basin>/*.csv      Giovanni area-averaged time series
        data/raw/power/<basin>/<lat>_<lon>.json   NASA POWER monthly point API, one file per grid cell
Writes  data/water_account.csv  (record, basin, variable, year, month, value, unit, source)
        data/data.js            (the same series, loaded by index.html)

To add a basin: add it to BASINS, put its files in the folders above and run this script.
The POWER files come from
https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=SNODP,PRECSNOLAND,PRECTOTCORR,T2M,FROST_DAYS,GWETROOT,EVLAND&community=AG&longitude=<lon>&latitude=<lat>&start=1981&end=2025&format=JSON
"""
import calendar, glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")

# box = west, south, east, north. The boxes are rectangles around the mountain part of each basin.
BASINS = [
    {"id": "naryn", "name": "Naryn", "range": "Tien Shan", "feeds": "the Toktogul cascade", "box": "72.8, 40.9, 78.8, 42.3"},
    {"id": "vakhsh", "name": "Vakhsh", "range": "Pamir", "feeds": "the Nurek cascade", "box": "69.0, 38.3, 73.5, 39.6"},
    {"id": "chu", "name": "Chu", "range": "Tien Shan", "feeds": "the Chu valley canals", "box": "73.5, 42.0, 77.5, 42.75"},
    {"id": "talas", "name": "Talas", "range": "Tien Shan", "feeds": "the Talas valley canals", "box": "71.0, 42.0, 73.5, 42.75"},
]

VARIABLES = [
    {"id": "snowdepth", "label": "Snow depth", "long": "snow depth", "unit": "cm", "agg": "mean", "kind": "reanalysis"},
    {"id": "swe", "label": "Snow water", "long": "water held in the snowpack", "unit": "mm", "agg": "mean", "kind": "model"},
    {"id": "snowfall", "label": "Snowfall", "long": "snowfall", "unit": "mm", "agg": "sum", "kind": "reanalysis"},
    {"id": "precip", "label": "Rain and snow", "long": "rain and snow together", "unit": "mm", "agg": "sum", "kind": "reanalysis"},
    {"id": "temp", "label": "Air temperature", "long": "air temperature", "unit": "°C", "agg": "mean", "kind": "reanalysis"},
    {"id": "frost", "label": "Frost days", "long": "the number of frost days", "unit": "days", "agg": "sum", "kind": "reanalysis", "plural": True},
    {"id": "soil", "label": "Soil wetness", "long": "root-zone soil wetness", "unit": "%", "agg": "mean", "kind": "reanalysis"},
    {"id": "evap", "label": "Evaporation", "long": "evaporation from the land", "unit": "mm", "agg": "sum", "kind": "reanalysis"},
]

RECORDS = [
    {"id": "long", "label": "Long record, from 1981",
     "about": "NASA POWER (MERRA-2 reanalysis), monthly, the mean of every 0.5 x 0.625 degree grid cell in the basin box",
     "variables": ["snowdepth", "snowfall", "precip", "temp", "frost", "soil", "evap"], "windows": [1981, 2000]},
    {"id": "basin", "label": "Giovanni files, from 2000",
     "about": "NASA Giovanni area-averaged time series over the basin box (GLDAS and MERRA-2)",
     "variables": ["swe", "snowfall", "precip", "temp"], "windows": [2000]},
]

# Giovanni variable key (as in the file name) -> our variable. "rate" is kg per m2 per second.
GIOVANNI = [
    ("GLDAS_NOAH025_M_2_1_SWE_inst", "swe", "GLDAS Noah 2.1, monthly, 0.25 degree", "state"),
    ("GLDAS_NOAH025_M_2_0_SWE_inst", "swe", "GLDAS Noah 2.0, monthly, 0.25 degree", "state"),
    ("M2TMNXLND_5_12_4_PRECSNOLAND", "snowfall", "MERRA-2 M2TMNXLND 5.12.4, monthly, 0.5 x 0.625 degree", "rate"),
    ("M2TMNXLND_5_12_4_PRECTOTLAND", "precip", "MERRA-2 M2TMNXLND 5.12.4, monthly, 0.5 x 0.625 degree", "rate"),
    ("M2TMNXSLV_5_12_4_T2M", "temp", "MERRA-2 M2TMNXSLV 5.12.4, monthly, 0.5 x 0.625 degree", "state"),
]

# POWER parameter -> (our variable, how to convert one monthly value)
POWER = {
    "SNODP": ("snowdepth", "state"),
    "PRECSNOLAND": ("snowfall", "per_day"),
    "PRECTOTCORR": ("precip", "per_day"),
    "T2M": ("temp", "state"),
    "FROST_DAYS": ("frost", "state"),
    "GWETROOT": ("soil", "fraction"),
    "EVLAND": ("evap", "per_day"),
}
UNIT = {v["id"]: v["unit"] for v in VARIABLES}


def read_giovanni(path):
    """Return {(year, month): value}. Fill values are dropped."""
    fill, out = None, {}
    with open(path, encoding="utf-8-sig") as fh:
        for line in fh:
            line = line.strip()
            if line.startswith("Fill Value"):
                fill = float(line.rsplit(",", 1)[1])
            parts = line.split(",")
            if len(parts) == 2 and len(parts[0]) >= 10 and parts[0][:4].isdigit() and parts[0][4] == "-":
                value = float(parts[1])
                if fill is not None and value == fill:
                    continue
                out[(int(parts[0][:4]), int(parts[0][5:7]))] = value
    return out


def main():
    series = {"long": {}, "basin": {}}
    rows = []

    def add(record, basin, var, source, product, values):
        months = {}
        for (year, month), value in sorted(values.items()):
            months.setdefault(str(year), [None] * 12)[month - 1] = round(value, 4)
            rows.append((record, basin, var, year, month, round(value, 4), UNIT[var], source))
        series[record].setdefault(basin, {})[var] = {"source": source, "product": product, "monthly": months}

    for basin in BASINS:
        # Giovanni basin averages.
        files = sorted(glob.glob(os.path.join(RAW, "giovanni", basin["id"], "*.csv")))
        for key, var, source, kind in GIOVANNI:
            match = [f for f in files if key in os.path.basename(f)]
            if not match or var in series["basin"].get(basin["id"], {}):  # GLDAS 2.1 wins over 2.0
                continue
            data = read_giovanni(match[0])
            if kind == "rate":
                data = {(y, m): v * 86400 * calendar.monthrange(y, m)[1] for (y, m), v in data.items()}
            add("basin", basin["id"], var, source, key, data)

        # NASA POWER: average the grid cells in the box, month by month.
        cells = [json.load(open(f, encoding="utf-8")) for f in sorted(glob.glob(os.path.join(RAW, "power", basin["id"], "*.json")))]
        if cells:
            basin["cells"] = len(cells)
            basin["elevation"] = round(sum(c["geometry"]["coordinates"][2] for c in cells) / len(cells))
            for param, (var, kind) in POWER.items():
                data = {}
                for key in cells[0]["properties"]["parameter"][param]:
                    year, month = int(key[:4]), int(key[4:])
                    if month == 13:  # the yearly value; we build our own from the months
                        continue
                    values = [c["properties"]["parameter"][param][key] for c in cells]
                    values = [v for v in values if v != -999]
                    if not values:
                        continue
                    value = sum(values) / len(values)
                    if kind == "per_day":
                        value *= calendar.monthrange(year, month)[1]
                    elif kind == "fraction":
                        value *= 100
                    data[(year, month)] = value
                add("long", basin["id"], var, "NASA POWER (MERRA-2), mean of %d grid cells" % len(cells), param, data)

    with open(os.path.join(ROOT, "data", "water_account.csv"), "w", encoding="utf-8") as fh:
        fh.write("record,basin,variable,year,month,value,unit,source\n")
        for r in rows:
            fh.write(",".join('"%s"' % x if isinstance(x, str) and "," in x else str(x) for x in r) + "\n")

    payload = {"basins": BASINS, "variables": VARIABLES, "records": RECORDS, "series": series}
    with open(os.path.join(ROOT, "data", "data.js"), "w", encoding="utf-8") as fh:
        fh.write("// Written by tools/build_data.py. Do not edit by hand.\n")
        fh.write("window.WATER_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("rows:", len(rows))
    for record, basins in series.items():
        for b, vs in basins.items():
            years = sorted(next(iter(vs.values()))["monthly"])
            print(record, b, ",".join(vs), years[0], years[-1])


if __name__ == "__main__":
    sys.exit(main())
