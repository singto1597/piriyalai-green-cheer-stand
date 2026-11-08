#!/usr/bin/env python3
"""Parse the 9 Google-Sheets HTML exports of the Piriyalai cheer stand codes.

Each sheet is a single waffle table. Stand blocks are 15 columns wide (A-O) and
10 rows tall (rows 10..1), laid out in a multi-column, multi-row arrangement of
"blocks" (one block == one code step / one picture).

We identify blocks by the presence of cells whose text looks like a seat label
(A1..O10).  The *real* coordinate is derived from the grid position, never from
the label text (the source sheets contain known typos such as K9 in the K8 slot,
H6 in the I6 slot, J7..O7 in the row-8 slots, etc).

Output: JSON with one entry per song, each holding every step:
  {id, fileName, title, steps:[{code, rows, cols, grid, cues:[...]}]}
where grid maps "A1".. "O10" -> "#rrggbb".
"""
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

COLS = list("ABCDEFGHIJKLMNO")
ROWS = list(range(10, 0, -1))
SEAT_RE = re.compile(r"^([A-O])\s*(\d{1,2})$")


def color_map(html: str) -> dict:
    out = {}
    for cls, body in re.findall(r"\.waffle \.([A-Za-z0-9]+)\{([^}]*)\}", html):
        m = re.search(r"background-color:\s*(#[0-9a-fA-F]{6,8})", body)
        if m:
            out[cls] = m.group(1)[:7].lower()
    return out


def cell_bg(cell, cmap) -> str:
    for cls in cell.get("class", []):
        c = cmap.get(cls)
        if c and c != "#808080":
            return c
    return "#ffffff"


def parse_file(path: Path):
    html = path.read_text(encoding="utf-8")
    cmap = color_map(html)
    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table")
    if table is None:
        raise SystemExit(f"no table in {path}")
    trs = table.find_all("tr")

    # row -> set of column indices that hold a seat label
    seat_cols_by_row = {}
    for ri, tr in enumerate(trs):
        cols = []
        for ci, c in enumerate(tr.find_all("td")):
            t = c.get_text(" ", strip=True).upper()
            if SEAT_RE.match(t):
                cols.append(ci)
        if len(cols) >= 10:
            seat_cols_by_row[ri] = cols

    # group consecutive rows into bands
    bands = []
    cur = []
    for ri in sorted(seat_cols_by_row):
        if cur and ri != cur[-1] + 1:
            bands.append(cur)
            cur = []
        cur.append(ri)
    if cur:
        bands.append(cur)

    # Group column indices of a band into 15-wide blocks (consecutive runs).
    # NOTE: steps are stored in scan order (band-major), which is NOT the run
    # order of the show.  Every block keeps its `band` (top -> bottom) and
    # `c0` (physical block-column start, 1/17/33/49/65).  build_data.py derives
    # the true order from those: down one block-column, then from the top of
    # the next block-column.
    steps = []
    for band_i, band in enumerate(bands):
        # use the union of columns, clustering by gap > 2
        all_idx = sorted(set().union(*(set(seat_cols_by_row[r]) for r in band)))
        groups, cur = [], [all_idx[0]]
        for x in all_idx[1:]:
            if x - cur[-1] == 1:
                cur.append(x)
            else:
                groups.append(cur)
                cur = [x]
        groups.append(cur)

        for col_i, g in enumerate(groups):
            c0 = min(g)
            # The block spans 15 columns starting at c0 (labels A..O).
            if len(g) != 15:
                # tolerate small variance; take first 15 consecutive
                pass
            grid = {}
            for r_i, ri in enumerate(band):
                row_num = 10 - r_i
                if row_num < 1:
                    continue
                tds = trs[ri].find_all("td")
                for k in range(15):
                    ci = c0 + k
                    if ci >= len(tds):
                        continue
                    grid[f"{COLS[k]}{row_num}"] = cell_bg(tds[ci], cmap)
            # cue text: cells in rows above the band, in the same block columns,
            # until the previous band ends. Collect non-empty text, skipping
            # the a..o column-heading row.
            prev_end = bands[bands.index(band) - 1][-1] if bands.index(band) > 0 else 0
            cues = []
            for rr in range(prev_end + 1, band[0]):
                tds = trs[rr].find_all("td")
                for k in range(15):
                    ci = c0 + k
                    if ci >= len(tds):
                        continue
                    t = tds[ci].get_text(" ", strip=True)
                    if not t:
                        continue
                    if re.fullmatch(r"[a-o]", t):
                        continue
                    if SEAT_RE.match(t.upper()) or re.fullmatch(r"\d{1,2}", t):
                        continue
                    if t not in cues:
                        cues.append(t)
            steps.append({"grid": grid, "cues": cues,
                          "band": band_i, "col": col_i, "c0": c0})

    return {"fileName": path.name, "colorMap": cmap, "steps": steps}


def main():
    base = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    files = [
        "1_ขึ้นมือ G.html",
        "2_กลอนโรงเรียน.html",
        "3_มาร์ช.html",
        "4_พวกเรายิ่งใหญ่.html",
        "5_เสียงกลองประชัน.html",
        "6_เอ้าวันเดียวกัน.html",
        "7_เอ้ามุ่งหน้าไป.html",
        "8_ไม่หวาดหวั่น.html",
        "9_คอนเซป 1-2-3.html",
        "10_เมดเล่ย์.html",
    ]
    result = []
    for fn in files:
        p = base / fn
        if not p.exists():
            print("missing", fn)
            continue
        data = parse_file(p)
        print(fn, "blocks:", len(data["steps"]),
              "sizes:", [len(s["grid"]) for s in data["steps"]])
        result.append(data)
    (out_dir / "stand_data.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print("written", out_dir / "stand_data.json")


if __name__ == "__main__":
    main()
