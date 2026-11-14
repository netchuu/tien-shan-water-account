#!/usr/bin/env python3
"""Build one value per year for every NASA grid cell, for the map with the time slider.

Usage:  python3 tools/build_cells.py [folder with daily files <basin>/<lat>_<lon>.json]
Reads   data/raw/power/<basin>/<lat>_<lon>.json   monthly values per cell
        the optional daily folder (same files as tools/build_daily.py), for the snow half-melt date
Writes  data/cells.js
"""
import calendar, glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YEARS = list(range(1981, 2026))
MONTHLY = {"SNODP": ("snowdepth", "mean"), "PRECTOTCORR": ("precip", "sum_per_day"), "T2M": ("temp", "mean"), "FROST_DAYS": ("frost", "sum")}


def yearly(values, how):
    out = []
    for y in YEARS:
        m = [values.get("%d%02d" % (y, k), -999) for k in range(1, 13)]
        if -999 in m:
            out.append(None)
        elif how == "mean":
            out.append(round(sum(m) / 12, 2))
        elif how == "sum":
            out.append(round(sum(m), 1))
        else:
            out.append(round(sum(v * calendar.monthrange(y, k + 1)[1] for k, v in enumerate(m)), 1))
    return out


def melt_dates(snow):
    """Day of the year when snow depth first falls below half of the winter peak (see the Method page)."""
    days = sorted(snow)
    index = {d: i for i, d in enumerate(days)}
    out = []
    for y in YEARS:
        a = index.get("%d0101" % y)
        if a is None:
            out.append(None)
            continue
        window = range(max(0, a - 92), min(len(days), a + 181))
        peak, at = -1, -1
        for i in window:
            v = snow[days[i]]
            if v != -999 and v > peak:
                peak, at = v, i
        value = None
        if peak >= 1:
            for i in range(at + 1, len(days)):
                if days[i][:4] != str(y) and i > a:
                    break
                v = snow[days[i]]
                if v != -999 and v < peak / 2:
                    value = i - a + 1 if i - a + 1 >= 1 else None
                    break
        out.append(value)
    return out


def main(daily_dir):
    cells = []
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "raw", "power", "*", "*.json"))):
        basin = os.path.basename(os.path.dirname(path))
        doc = json.load(open(path, encoding="utf-8"))
        lon, lat, elev = doc["geometry"]["coordinates"]
        cell = {"b": basin, "lat": lat, "lon": lon, "elev": round(elev)}
        for param, (name, how) in MONTHLY.items():
            cell[name] = yearly(doc["properties"]["parameter"][param], how)
        if daily_dir:
            dpath = os.path.join(daily_dir, basin, os.path.basename(path))
            if os.path.exists(dpath):
                cell["melt"] = melt_dates(json.load(open(dpath, encoding="utf-8"))["properties"]["parameter"]["SNODP"])
        cells.append(cell)
    with open(os.path.join(ROOT, "data", "cells.js"), "w", encoding="utf-8") as fh:
        fh.write("// Written by tools/build_cells.py. Do not edit by hand.\n")
        fh.write("window.WATER_CELLS = " + json.dumps({"years": YEARS, "cells": cells}, separators=(",", ":")) + ";\n")
    print(len(cells), "cells;", sum(1 for c in cells if "melt" in c), "with melt dates")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
