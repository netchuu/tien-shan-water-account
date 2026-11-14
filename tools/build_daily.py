#!/usr/bin/env python3
"""Average NASA POWER daily point files into one daily series per basin.

Usage:  python3 tools/build_daily.py <folder with <basin>/<lat>_<lon>.json files>
Each file comes from
https://power.larc.nasa.gov/api/temporal/daily/point?parameters=SNODP,T2M_MIN,T2M_MAX&community=AG&longitude=<lon>&latitude=<lat>&start=19810101&end=<yyyymmdd>&format=JSON
(the same grid cells as data/raw/power/<basin>/). The raw files are about 1 MB each, so only the
basin means are kept in the project:
Writes  data/raw/power_daily/<basin>.csv   date, snow depth cm, daily minimum C, daily maximum C
        data/daily.js                      the same series, loaded by index.html
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARAMS = [("SNODP", "snow"), ("T2M_MIN", "tmin"), ("T2M_MAX", "tmax")]


def main(src):
    out = {}
    os.makedirs(os.path.join(ROOT, "data", "raw", "power_daily"), exist_ok=True)
    for folder in sorted(glob.glob(os.path.join(src, "*"))):
        basin = os.path.basename(folder)
        cells = [json.load(open(f, encoding="utf-8"))["properties"]["parameter"] for f in sorted(glob.glob(os.path.join(folder, "*.json")))]
        if not cells:
            continue
        days = sorted(cells[0]["SNODP"])
        series = {}
        for param, name in PARAMS:
            values = []
            for d in days:
                v = [c[param][d] for c in cells if c[param].get(d, -999) != -999]
                values.append(round(sum(v) / len(v), 2) if v else None)
            series[name] = values
        out[basin] = {"start": days[0][:4] + "-" + days[0][4:6] + "-" + days[0][6:], "cells": len(cells), **series}
        with open(os.path.join(ROOT, "data", "raw", "power_daily", basin + ".csv"), "w", encoding="utf-8") as fh:
            fh.write("date,snow_depth_cm,tmin_c,tmax_c\n")
            for i, d in enumerate(days):
                fh.write("%s-%s-%s,%s,%s,%s\n" % (d[:4], d[4:6], d[6:], *["" if series[n][i] is None else series[n][i] for _, n in PARAMS]))
        print(basin, len(cells), "cells", days[0], days[-1], len(days), "days")
    with open(os.path.join(ROOT, "data", "daily.js"), "w", encoding="utf-8") as fh:
        fh.write("// Written by tools/build_daily.py. Do not edit by hand.\n")
        fh.write("window.WATER_DAILY = " + json.dumps(out, separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    main(sys.argv[1])
