#!/usr/bin/env python3
"""Draw a real-geography map (country outlines + numbered places) as an SVG for a Ghostwriter
"figure" screen. The SVG uses the app's figure classes, so it follows the page colour.

Usage:
    python3 map.py SPEC.json [--out MAP.svg] [--width 340]   (without --out the SVG goes to stdout)

Paste the SVG into a figure screen ("svg"), with "alt" and the caption "Today's borders; places
from outside the book", and follow it with a list screen of the numbered places.

spec.json:
{
  "id": "m1",                          unique per map in the document (used for the clip path)
  "mode": "overview",                  "overview": all markers equal
                                       "section": one place has "key": true
  "bbox": [-110, -35, 135, 66],        optional [lon_min, lat_min, lon_max, lat_max]; default: fit the places
  "places": [
    {"n": 1, "name": "London", "country": "United Kingdom"},   looked up in assets/geo/places.csv
    {"n": 2, "label": "Mesopotamia", "lat": 33.0, "lon": 44.4}, a region: give lat/lon yourself
    {"n": 3, "name": "Rome", "key": true}                       "section" mode: the one key place
  ]
}

Data: Natural Earth (public domain) country outlines at 1:110m (wide maps) or 1:50m (regional
maps), and Natural Earth populated places for the look-up. Borders are today's borders.
The script prints the resolved coordinates to stderr; check them.
Exit codes: 0 = map written, 2 = input error (bad spec, place not found, missing data file).
Requirements: Python 3.9+ only (no third-party packages).
"""
import argparse
import csv
import json
import math
import sys
from pathlib import Path

GEO = Path(__file__).resolve().parent.parent / "assets" / "geo"
WIDTH = 340          # a phone screen; --width 640 for a PDF-only map
MAX_H = 460          # a map is never taller than this (wider boxes instead)
MIN_SPAN = (24, 14)  # smallest lon / lat span in degrees, so a single country still shows context


def fail(msg):
    print(f"map.py: {msg}", file=sys.stderr)
    sys.exit(2)


def load_places():
    path = GEO / "places.csv"
    if not path.exists():
        fail(f"place list not found: {path}")
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def find(rows, name, country=None):
    n = name.strip().lower()
    hits = [r for r in rows if n in (r["name"].lower(), r["ascii"].lower())
            or n in [a.strip().lower() for a in r["alt"].split("|") if a]]
    if country and hits:
        c = country.strip().lower()
        same = [r for r in hits if r["country"].lower() == c]
        if not same:
            fail(f'"{name}" not found in {country}; found in: '
                     f'{", ".join(sorted({r["country"] for r in hits}))}. Give "lat" and "lon" instead.')
        hits = same
    if not hits:
        near = sorted({f'{r["name"]} ({r["country"]})' for r in rows if r["ascii"].lower().startswith(n[:4])})[:8]
        fail(f'place not found: "{name}". Similar: {", ".join(near) or "none"}. '
                 f'Give "lat" and "lon" instead.')
    return max(hits, key=lambda r: int(r["pop"]))


def ne1(lon, lat):
    """Natural Earth I projection (good for world and continent maps)."""
    l, p = math.radians(lon), math.radians(lat)
    p2 = p * p
    p4 = p2 * p2
    x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
    y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
    return x, -y


def read_spec(path):
    try:
        spec = json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"spec file not found: {path}")
    except json.JSONDecodeError as e:
        fail(f"spec is not valid JSON ({e})")
    if not isinstance(spec.get("places"), list) or not spec["places"]:
        fail('spec needs a non-empty "places" list')
    if spec.get("mode", "overview") not in ("overview", "section"):
        fail('"mode" must be "overview" or "section"')
    for p in spec["places"]:
        if "n" not in p or not ("name" in p or ("lat" in p and "lon" in p)):
            fail(f'each place needs "n" and either "name" or "lat" + "lon": {p}')
    if spec.get("mode") == "section" and sum(bool(p.get("key")) for p in spec["places"]) != 1:
        fail('"section" mode needs exactly one place with "key": true')
    return spec


def main():
    ap = argparse.ArgumentParser(description="Draw a real-geography map as an SVG snippet.")
    ap.add_argument("spec", help="map spec JSON file (see the docstring)")
    ap.add_argument("--out", help="write the SVG to this file instead of stdout")
    ap.add_argument("--width", type=int, default=340, help="design width: 340 for a phone screen (default), 640 for the PDF")
    args = ap.parse_args()
    global WIDTH, MAX_H
    WIDTH = args.width
    MAX_H = round(WIDTH * 1.35) if WIDTH < 480 else round(WIDTH * 0.72)
    spec = read_spec(args.spec)
    mid = spec.get("id", "m1")
    mode = spec.get("mode", "overview")
    rows = None
    places = []
    for p in spec["places"]:
        if "lat" in p and "lon" in p:
            lat, lon = float(p["lat"]), float(p["lon"])
            src = "given"
        else:
            rows = rows or load_places()
            r = find(rows, p["name"], p.get("country"))
            lat, lon = float(r["lat"]), float(r["lon"])
            src = f'{r["name"]}, {r["country"]}'
        places.append({**p, "lat": lat, "lon": lon})
        print(f'  {p["n"]:>2} {p.get("label") or p.get("name")}: {lat:.2f}, {lon:.2f}  ({src})', file=sys.stderr)

    if "bbox" in spec:
        lon0, lat0, lon1, lat1 = spec["bbox"]
    else:
        los = [p["lon"] for p in places]
        las = [p["lat"] for p in places]
        lon0, lon1, lat0, lat1 = min(los), max(los), min(las), max(las)
        pad_lo = max((lon1 - lon0) * 0.15, (MIN_SPAN[0] - (lon1 - lon0)) / 2, 2)
        pad_la = max((lat1 - lat0) * 0.15, (MIN_SPAN[1] - (lat1 - lat0)) / 2, 2)
        lon0, lon1 = max(lon0 - pad_lo, -180), min(lon1 + pad_lo, 180)
        lat0, lat1 = max(lat0 - pad_la, -85), min(lat1 + pad_la, 85)

    span = lon1 - lon0
    if span > 60:
        project = ne1
    else:
        coslat = math.cos(math.radians((lat0 + lat1) / 2))
        project = lambda lo, la: (math.radians(lo) * coslat, -math.radians(la))  # noqa: E731

    def frame(lon0, lat0, lon1, lat1):
        pts = [project(lo, la) for lo in (lon0, (lon0 + lon1) / 2, lon1) for la in (lat0, lat1)]
        xs, ys = [q[0] for q in pts], [q[1] for q in pts]
        return min(xs), max(xs), min(ys), max(ys)

    minx, maxx, miny, maxy = frame(lon0, lat0, lon1, lat1)
    k = WIDTH / (maxx - minx)
    height = (maxy - miny) * k
    while height > MAX_H and lon1 - lon0 < 340:   # too tall: widen the box
        lon0, lon1 = max(lon0 - 2, -180), min(lon1 + 2, 180)
        minx, maxx, miny, maxy = frame(lon0, lat0, lon1, lat1)
        k = WIDTH / (maxx - minx)
        height = (maxy - miny) * k
    height = round(height)

    def xy(lo, la):
        x, y = project(lo, la)
        return (x - minx) * k, (y - miny) * k

    data_file = GEO / ("countries-110m.json" if span > 90 else "countries-50m.json")
    if not data_file.exists():
        fail(f"outline data not found: {data_file}")
    data = json.loads(data_file.read_text(encoding="utf-8"))
    margin = 20
    paths = []
    for country in data["countries"]:
        d = []
        for ring in country["rings"]:
            if not any(lon0 - margin <= lo <= lon1 + margin and lat0 - margin <= la <= lat1 + margin for lo, la in ring):
                continue
            seg, last = [], None
            for lo, la in ring:
                x, y = xy(lo, la)
                if last and abs(x - last[0]) + abs(y - last[1]) < 0.8:
                    continue
                seg.append(f"{x:.1f} {y:.1f}")
                last = (x, y)
            if len(seg) > 2:
                d.append("M" + "L".join(seg) + "Z")
        if d:
            paths.append(f'<path class="land" d="{"".join(d)}"/>')

    marks = []
    for p in places:
        x, y = xy(p["lon"], p["lat"])
        if not (0 <= x <= WIDTH and 0 <= y <= height):
            print(f'  WARNING: place {p["n"]} is outside the map box', file=sys.stderr)
        if mode == "section":
            cls, tcls, r = ("k", "t2 tb tw c", 11) if p.get("key") else ("bt", "t2 tb c", 9.5)
        else:
            cls, tcls, r = "k", "t2 tb tw c", 9.5
        marks.append(f'<circle class="{cls} pin" cx="{x:.1f}" cy="{y:.1f}" r="{r}"/>'
                     f'<text class="{tcls}" x="{x:.1f}" y="{y + 3.8:.1f}">{p["n"]}</text>')

    svg = (f'<svg class="map" viewBox="0 0 {WIDTH} {height}" xmlns="http://www.w3.org/2000/svg">'
           f'<defs><clipPath id="clip-{mid}"><rect width="{WIDTH}" height="{height}" rx="12"/></clipPath></defs>'
           f'<rect class="sea" width="{WIDTH}" height="{height}" rx="12"/>'
           f'<g clip-path="url(#clip-{mid})">{"".join(paths)}</g>{"".join(marks)}</svg>')
    if mode == "overview" and len(places) > 1:
        print("  overview maps use the accent for every pin: that is the one exception to one key element", file=sys.stderr)
    if args.out:
        Path(args.out).write_text(svg + "\n", encoding="utf-8")
    else:
        print(svg)
    print(f"  map {WIDTH}x{height}, {'110m' if span > 90 else '50m'} outlines, {len(paths)} countries",
          file=sys.stderr)


if __name__ == "__main__":
    main()
