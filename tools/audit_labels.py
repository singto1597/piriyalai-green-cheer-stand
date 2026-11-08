#!/usr/bin/env python3
"""Audit printed seat labels vs real grid positions in the source sheets."""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from bs4 import BeautifulSoup

COLS = list("ABCDEFGHIJKLMNO")
SEAT_RE = re.compile(r"^([A-O])\s*(\d{1,2})$", re.I)


def color_map(html):
    out = {}
    for cls, body in re.findall(r"\.waffle \.([A-Za-z0-9]+)\{([^}]*)\}", html):
        m = re.search(r"background-color:\s*(#[0-9a-fA-F]{6,8})", body)
        if m:
            out[cls] = m.group(1)[:7].lower()
    return out


def main():
    base = Path(sys.argv[1])
    files = [
        "1_ขึ้นมือ G.html", "2_กลอนโรงเรียน.html", "3_มาร์ช.html",
        "4_พวกเรายิ่งใหญ่.html", "5_เสียงกลองประชัน.html", "6_เอ้าวันเดียวกัน.html",
        "7_เอ้ามุ่งหน้าไป.html", "8_ไม่หวาดหวั่น.html", "9_คอนเซป 1-2-3.html",
        "10_เมดเล่ย์.html",
    ]
    totals = Counter()
    details = defaultdict(list)
    for fn in files:
        html = (base / fn).read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "lxml")
        rows = soup.find("table").find_all("tr")
        seat_rows = {}
        for ri, tr in enumerate(rows):
            idx = [ci for ci, c in enumerate(tr.find_all("td"))
                   if SEAT_RE.match(c.get_text(" ", strip=True).upper())]
            if len(idx) >= 10:
                seat_rows[ri] = idx
        bands, cur = [], []
        for ri in sorted(seat_rows):
            if cur and ri != cur[-1] + 1:
                bands.append(cur); cur = []
            cur.append(ri)
        if cur:
            bands.append(cur)
        for band in bands:
            all_idx = sorted(set().union(*(set(seat_rows[r]) for r in band)))
            groups, cur = [], [all_idx[0]]
            for x in all_idx[1:]:
                if x - cur[-1] == 1:
                    cur.append(x)
                else:
                    groups.append(cur); cur = [x]
            groups.append(cur)
            for g in groups:
                if len(g) != 15:
                    continue
                c0 = g[0]
                for r_i, ri in enumerate(band):
                    row_num = 10 - r_i
                    if row_num < 1:
                        continue
                    tds = rows[ri].find_all("td")
                    for k in range(15):
                        ci = c0 + k
                        if ci >= len(tds):
                            continue
                        txt = tds[ci].get_text(" ", strip=True).upper().replace(" ", "")
                        real = f"{COLS[k]}{row_num}"
                        m = SEAT_RE.match(txt)
                        if not m:
                            continue
                        if txt != real:
                            totals[(txt, real)] += 1
                            if len(details[(txt, real)]) < 6:
                                details[(txt, real)].append(f"{fn}@r{ri + 1}c{ci + 1}")
    print("LABEL MISMATCHES (printed -> real): count")
    for (txt, real), n in totals.most_common():
        print(f"  {txt:>4} -> {real:<4} x{n}   e.g. {', '.join(details[(txt, real)])}")


if __name__ == "__main__":
    main()
