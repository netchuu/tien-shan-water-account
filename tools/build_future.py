#!/usr/bin/env python3
"""Turn NASA NEX-GDDP-CMIP6 daily point files into yearly values per basin, model and variable.

Usage:  python3 tools/build_future.py <folder with <basin>_<model>_<var>_<year>.csv files>
Each file is one year of one variable at one point, from the NCCS THREDDS subset service:
https://ds.nccs.nasa.gov/thredds/ncss/grid/AMES/NEX/GDDP-CMIP6/<model>/<scenario>/r1i1p1f1/<var>/<var>_day_<model>_<scenario>_r1i1p1f1_gn_<year>_v2.0.nc?var=<var>&latitude=<lat>&longitude=<lon>&accept=csv&time_start=<year>-01-01T00:00:00Z&time_end=<year>-12-31T23:59:59Z
Variables: tasmin, tasmax (kelvin) and pr (kg per m2 per second). Scenario: historical to 2014, ssp245 after.
Writes  data/future.js
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POINTS = {"naryn": (41.5, 75.6), "vakhsh": (39.0, 71.25), "chu": (42.4, 75.5), "talas": (42.4, 72.2)}


def column(path):
    out = []
    with open(path, encoding="utf-8") as fh:
        next(fh)
        for line in fh:
            parts = line.strip().split(",")
            if len(parts) >= 5:
                out.append(float(parts[-1]))
    return out


def metrics(tmin, tmax, pr):
    """One year of daily values -> the same yearly variables the site uses for the record."""
    n = min(len(tmin), len(tmax), len(pr))
    tmin, tmax, pr = [t - 273.15 for t in tmin[:n]], [t - 273.15 for t in tmax[:n]], pr[:n]
    out = {
        "temp": sum((a + b) / 2 for a, b in zip(tmin, tmax)) / n,
        "precip": sum(pr) * 86400 * (365.25 / n if n < 365 else 1),  # some models use a 360-day year
        "frost": sum(1 for t in tmin if t < 0) * (365.25 / n if n < 365 else 1),
        "summer": sum(1 for t in tmax if t >= 25) * (365.25 / n if n < 365 else 1),
    }
    cut = round(n * 212 / 365)
    spring = [i + 1 for i in range(cut) if tmin[i] < 0]
    autumn = [i + 1 for i in range(cut, n) if tmin[i] < 0]
    if spring:
        out["lastfrost"] = spring[-1] * 365 / n
    if spring and autumn:
        out["frostfree"] = (autumn[0] - spring[-1] - 1) * 365 / n
    return out


def main(src):
    data, models, years = {}, set(), set()
    for path in sorted(glob.glob(os.path.join(src, "*_tasmin_*.csv"))):
        basin, model, _, year = os.path.basename(path)[:-4].split("_")
        others = [path.replace("_tasmin_", "_%s_" % v) for v in ("tasmax", "pr")]
        if not all(os.path.exists(p) for p in others):
            continue
        m = metrics(column(path), column(others[0]), column(others[1]))
        for name, value in m.items():
            data.setdefault(basin, {}).setdefault(name, {}).setdefault(model, {})[year] = round(value, 2)
        models.add(model)
        years.add(int(year))
    payload = {
        "source": "NASA NEX-GDDP-CMIP6 v2.0, daily, 0.25 degree, one grid point per basin",
        "scenario": "SSP2-4.5, a middle path for emissions",
        "models": sorted(models), "points": POINTS, "basins": data,
    }
    with open(os.path.join(ROOT, "data", "future.js"), "w", encoding="utf-8") as fh:
        fh.write("// Written by tools/build_future.py. Do not edit by hand.\n")
        fh.write("window.WATER_FUTURE = " + json.dumps(payload, separators=(",", ":")) + ";\n")
    print(sorted(models), min(years), max(years), {b: len(next(iter(v["temp"].values()))) for b, v in data.items()})


if __name__ == "__main__":
    main(sys.argv[1])
