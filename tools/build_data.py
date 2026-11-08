#!/usr/bin/env python3
"""Build assets/data/app-data.js from the editable CSV/JSON files in tools/data/.

Normal editing loop:
    python3 tools/build_data.py
    docker compose restart web     # because index.html is a single-file bind mount

The script validates everything first and prints Thai file:line errors.
No third-party packages are required.
"""
import argparse
import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Ubuntu 24.04 has zoneinfo
    ZoneInfo = None

ROOT = Path(__file__).resolve().parent.parent
COLS = list("ABCDEFGHIJKLMNO")
ROWS = list(range(10, 0, -1))
PALETTE = [
    "#ffffff", "#000000", "#ff0000", "#00ff00", "#ffff00", "#ff00ff",
    "#7030a0", "#0000ff", "#980000", "#ffc000", "#6aa84f", "#548235",
    "#cc0000", "#00ffff", "#9900ff", "#9933ff", "#ff9900", "#f1c232",
    "#999999", "#b7b7b7",
]
CHARS = "0123456789abcdefghij"
DEFAULT_BPM = 120
DEFAULT_BEATS = 16
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
CACHE_RE = re.compile(r"\?v=(\d{8})-(\d+)")

SONG_HEADER = [
    "song_id", "code", "show_code", "title", "subtitle", "bpm",
    "default_beats", "theme_a", "theme_b", "file", "raw_blocks",
    "notation", "desc",
]
LYRIC_HEADER = ["song_id", "line_no", "text"]
FRAME_HEADER = [
    "song_id", "frame_no", "code", "name", "cue", "insight", "beats",
    "lyric_line", "lyric_highlight",
]
GRID_HEADER = ["song_id", "frame_no", "row_no", *COLS]


class Ctx:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def err(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    def csv_rows(self, path, required):
        if not path.exists():
            self.err(f"{path}: ไม่พบไฟล์")
            return []
        rows = []
        with path.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            if not reader.fieldnames:
                self.err(f"{path}: ไฟล์ว่างหรือไม่มีหัวตาราง")
                return []
            fields = [f.strip() if f else f for f in reader.fieldnames]
            missing = [f for f in required if f not in fields]
            if missing:
                self.err(f"{path}: ขาดคอลัมน์ {', '.join(missing)}")
            for raw in reader:
                if None in raw:
                    self.err(f"{path}:{reader.line_num}: มีคอลัมน์เกินหัวตาราง")
                row = {}
                short = []
                for key, value in raw.items():
                    if key is None:
                        continue
                    key = key.strip()
                    if not key:
                        if value and value.strip():
                            self.err(f"{path}:{reader.line_num}: ข้อมูลอยู่ในคอลัมน์ไม่มีหัว")
                        continue
                    if value is None:
                        short.append(key)
                        row[key] = ""
                    else:
                        row[key] = value.strip()
                if short:
                    self.err(
                        f"{path}:{reader.line_num}: แถวมีค่าน้อยกว่าหัวตาราง "
                        f"(ขาด {', '.join(short)})"
                    )
                row["_line"] = reader.line_num
                rows.append(row)
        return rows


def where(path, row):
    return f"{path.name}:{row.get('_line', '?')}"


def text(row, key):
    return (row.get(key) or "").strip()


def parse_int(ctx, path, row, key, default=None, minv=None, maxv=None):
    raw = text(row, key)
    if raw == "":
        if default is not None:
            return default
        ctx.err(f"{where(path, row)}: {key} ว่าง (ต้องเป็นจำนวนเต็ม)")
        return None
    try:
        n = int(raw)
    except ValueError:
        ctx.err(f"{where(path, row)}: {key} = {raw!r} ไม่ใช่จำนวนเต็ม")
        return None
    if minv is not None and n < minv:
        ctx.err(f"{where(path, row)}: {key} = {n} ต่ำกว่า {minv}")
    if maxv is not None and n > maxv:
        ctx.err(f"{where(path, row)}: {key} = {n} เกิน {maxv}")
    return n


def parse_float(ctx, path, row, key, default=None, minv=None, maxv=None):
    raw = text(row, key)
    if raw == "":
        return default
    try:
        n = float(raw)
    except ValueError:
        ctx.err(f"{where(path, row)}: {key} = {raw!r} ไม่ใช่ตัวเลข")
        return None
    if minv is not None and n < minv:
        ctx.err(f"{where(path, row)}: {key} = {raw} ต่ำกว่า {minv}")
    if maxv is not None and n > maxv:
        ctx.err(f"{where(path, row)}: {key} = {raw} เกิน {maxv}")
    return n


def num_out(n):
    if isinstance(n, float) and n.is_integer():
        return int(n)
    return n


def replace_key_in_order(d, old, new, value):
    out = {}
    for key, val in d.items():
        if key == old:
            out[new] = value
        else:
            out[key] = val
    return out


def load_songs(ctx, path):
    rows = ctx.csv_rows(path, SONG_HEADER)
    songs = []
    seen = set()
    for row in rows:
        sid = parse_int(ctx, path, row, "song_id", minv=1)
        if sid is None:
            continue
        if sid in seen:
            ctx.err(f"{where(path, row)}: song_id {sid} ซ้ำ")
        seen.add(sid)
        code = text(row, "code") or str(sid)
        show_code = text(row, "show_code") or code
        title = text(row, "title")
        if not title:
            ctx.err(f"{where(path, row)}: title ว่าง")
        bpm = parse_float(ctx, path, row, "bpm", default=120, minv=40, maxv=240)
        default_beats = parse_float(
            ctx, path, row, "default_beats", default=16, minv=1, maxv=64
        )
        theme = []
        for key in ("theme_a", "theme_b"):
            hexv = text(row, key)
            if not HEX_RE.match(hexv):
                ctx.err(f"{where(path, row)}: {key} = {hexv!r} ต้องเป็น #rrggbb")
                hexv = "#38bdf8" if key == "theme_a" else "#a78bfa"
            theme.append(hexv)
        if text(row, "raw_blocks") == "":
            raw_blocks = None
        else:
            raw_blocks = parse_int(ctx, path, row, "raw_blocks", minv=0)
        songs.append({
            "id": sid,
            "code": code,
            "show_code": show_code,
            "title": title,
            "subtitle": text(row, "subtitle"),
            "bpm": bpm if bpm is not None else DEFAULT_BPM,
            "default_beats": (
                default_beats if default_beats is not None else DEFAULT_BEATS
            ),
            "theme": theme,
            "file": text(row, "file"),
            "raw_blocks": raw_blocks,
            "notation": text(row, "notation"),
            "desc": text(row, "desc"),
            "_line": row["_line"],
        })
    songs.sort(key=lambda s: s["id"])
    return songs


def load_lyrics(ctx, path, songs):
    rows = ctx.csv_rows(path, LYRIC_HEADER)
    by_song = {s["id"]: {} for s in songs}
    for row in rows:
        sid = parse_int(ctx, path, row, "song_id", minv=1)
        line_no = parse_int(ctx, path, row, "line_no", minv=1)
        if sid is None or line_no is None:
            continue
        if sid not in by_song:
            ctx.err(f"{where(path, row)}: song_id {sid} ไม่มีใน songs.csv")
            continue
        if line_no in by_song[sid]:
            ctx.err(f"{where(path, row)}: song {sid} line_no {line_no} ซ้ำ")
            continue
        body = text(row, "text")
        if not body:
            ctx.warn(f"{where(path, row)}: song {sid} line {line_no} เป็นข้อความว่าง")
        by_song[sid][line_no] = body
    out = {}
    for song in songs:
        sid = song["id"]
        nums = sorted(by_song[sid])
        expected = list(range(1, len(nums) + 1))
        if nums != expected:
            ctx.err(
                f"{path.name}: song {sid} line_no ต้องเรียง 1..N "
                f"(พบ {nums[:12]}{'...' if len(nums) > 12 else ''})"
            )
        out[sid] = [by_song[sid][n] for n in nums]
    return out


def load_frames(ctx, path, songs, lyrics):
    rows = ctx.csv_rows(path, FRAME_HEADER)
    by_song = {s["id"]: [] for s in songs}
    song_by_id = {s["id"]: s for s in songs}
    for row in rows:
        sid = parse_int(ctx, path, row, "song_id", minv=1)
        frame_no = parse_int(ctx, path, row, "frame_no", minv=1)
        if sid is None or frame_no is None:
            continue
        if sid not in song_by_id:
            ctx.err(f"{where(path, row)}: song_id {sid} ไม่มีใน songs.csv")
            continue
        code = text(row, "code") or f"{sid}.{frame_no}"
        beats_raw = text(row, "beats")
        if beats_raw == "":
            beats = song_by_id[sid]["default_beats"]
        else:
            beats = parse_float(ctx, path, row, "beats", minv=1, maxv=64)
        lyric_raw = text(row, "lyric_line")
        if lyric_raw in ("", "-1"):
            lyric_line = -1
        else:
            lyric_line = parse_int(ctx, path, row, "lyric_line", minv=1)
        if lyric_line is not None and lyric_line >= 1:
            if lyric_line > len(lyrics.get(sid, [])):
                ctx.err(
                    f"{where(path, row)}: lyric_line {lyric_line} "
                    f"ไม่มีใน lyrics ของ song {sid} "
                    f"(มี {len(lyrics.get(sid, []))} บรรทัด)"
                )
                lyric_line = -1
        highlight_raw = text(row, "lyric_highlight")
        highlight = [x.strip() for x in highlight_raw.split("|") if x.strip()]
        if highlight and lyric_line is not None and lyric_line >= 1:
            line = lyrics[sid][lyric_line - 1]
            for word in highlight:
                count = line.count(word)
                if count == 0:
                    ctx.err(
                        f"{where(path, row)}: คำไฮไลต์ {word!r} "
                        f"ไม่พบใน lyric line {lyric_line} ของ song {sid}"
                    )
        elif highlight:
            ctx.err(f"{where(path, row)}: มี lyric_highlight แต่ไม่มี lyric_line")
        by_song[sid].append({
            "song_id": sid,
            "frame_no": frame_no,
            "code": code,
            "name": text(row, "name"),
            "cue": text(row, "cue"),
            "insight": text(row, "insight"),
            "beats": beats if beats is not None else DEFAULT_BEATS,
            "lyric_line": lyric_line if lyric_line is not None else -1,
            "highlight": highlight,
            "_line": row["_line"],
        })
    out = {}
    for song in songs:
        sid = song["id"]
        frames = sorted(by_song[sid], key=lambda f: f["frame_no"])
        nums = [f["frame_no"] for f in frames]
        if nums != list(range(1, len(nums) + 1)):
            ctx.err(
                f"{path.name}: song {sid} frame_no ต้องเรียง 1..N "
                f"(พบ {nums[:15]}{'...' if len(nums) > 15 else ''})"
            )
        if not frames:
            ctx.err(f"{path.name}: song {sid} ไม่มีเฟรม")
        out[sid] = frames
    all_codes = {}
    for frames in out.values():
        for f in frames:
            if f["code"] in all_codes:
                ctx.err(
                    f"{path.name}: code {f['code']} ซ้ำ "
                    f"({where(path, f)} และ {all_codes[f['code']]})"
                )
            all_codes[f["code"]] = where(path, f)
    return out


def load_grids(ctx, path, frames):
    rows = ctx.csv_rows(path, GRID_HEADER)
    frame_by_key = {}
    for sid, fs in frames.items():
        for f in fs:
            frame_by_key[(sid, f["frame_no"])] = f
    grouped = {}
    upper_cells = 0
    blank_cells = 0
    for row in rows:
        sid = parse_int(ctx, path, row, "song_id", minv=1)
        frame_no = parse_int(ctx, path, row, "frame_no", minv=1)
        row_no = parse_int(ctx, path, row, "row_no", minv=1, maxv=10)
        if sid is None or frame_no is None or row_no is None:
            continue
        if (sid, frame_no) not in frame_by_key:
            ctx.err(
                f"{where(path, row)}: ไม่มีเฟรม song {sid} frame {frame_no} "
                f"ใน frames.csv"
            )
            continue
        cells = []
        for col in COLS:
            cell = text(row, col)
            if cell == "":
                blank_cells += 1
                cell = "0"
            elif cell != cell.lower():
                upper_cells += 1
                cell = cell.lower()
            if len(cell) != 1 or cell not in CHARS:
                ctx.err(
                    f"{where(path, row)}: ช่อง {col}{row_no} = {cell!r} "
                    f"ไม่ใช่รหัสสี 0–j"
                )
                cell = "0"
            cells.append(cell)
        key = (sid, frame_no)
        grouped.setdefault(key, {})
        if row_no in grouped[key]:
            ctx.err(f"{where(path, row)}: song {sid} frame {frame_no} row {row_no} ซ้ำ")
            continue
        grouped[key][row_no] = cells
    grids = {}
    for key, frame in frame_by_key.items():
        rows_by_no = grouped.get(key, {})
        missing = [r for r in ROWS if r not in rows_by_no]
        if missing:
            ctx.err(
                f"{path.name}: song {key[0]} frame {key[1]} "
                f"ขาดแถว {', '.join(str(r) for r in missing)}"
            )
        for row_no, cells in rows_by_no.items():
            grids.setdefault(key, {})[row_no] = "".join(cells)
        if len(rows_by_no) == 10:
            grids[key] = "".join(grids[key][r] for r in ROWS)
    if blank_cells:
        ctx.warn(f"{path.name}: มีช่องว่าง {blank_cells} ช่อง (ถือเป็นขาว 0)")
    if upper_cells:
        ctx.warn(f"{path.name}: มีตัวพิมพ์ใหญ่ {upper_cells} ช่อง (แปลงเป็นพิมพ์เล็กแล้ว)")
    return grids


def load_extras(ctx, path):
    if not path.exists():
        ctx.err(f"{path}: ไม่พบไฟล์")
        return None
    try:
        raw = path.read_text(encoding="utf-8-sig")
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        ctx.err(f"{path}:{exc.lineno}: JSON ผิดรูป — {exc.msg}")
        return None
    if not isinstance(data, dict):
        ctx.err(f"{path}: ต้องเป็น JSON object")
        return None
    for key in ("meta", "colors", "show", "songbook", "program", "equipment", "typos"):
        if key not in data:
            ctx.err(f"{path}: ขาด key {key!r}")
    meta = data.get("meta") or {}
    for key in ("school", "team"):
        if not isinstance(meta.get(key), str) or not meta.get(key).strip():
            ctx.err(f"{path}: meta.{key} ว่าง")
    colors = data.get("colors") or {}
    if not isinstance(colors, dict):
        ctx.err(f"{path}: colors ต้องเป็น object")
        colors = {}
    missing = [h for h in PALETTE if h not in colors]
    extra = [h for h in colors if h not in PALETTE]
    if missing:
        ctx.err(f"{path}: colors ขาดสี palette {', '.join(missing)}")
    if extra:
        ctx.err(f"{path}: colors มีสีที่ไม่อยู่ใน palette {', '.join(extra)}")
    for hexv in PALETTE:
        item = colors.get(hexv)
        if not isinstance(item, dict):
            continue
        for key in ("short", "name", "desc", "text"):
            if not isinstance(item.get(key), str):
                ctx.err(f"{path}: colors[{hexv}].{key} ต้องเป็นข้อความ")
    for key in ("songbook", "program", "equipment", "typos"):
        if not isinstance(data.get(key), list):
            ctx.err(f"{path}: {key} ต้องเป็น array")
    if not isinstance(data.get("show"), dict):
        ctx.err(f"{path}: show ต้องเป็น object")
    return data


def build_songbook(ctx, entries, songs, lyrics, frames, path):
    song_by_id = {s["id"]: s for s in songs}
    step_by_code = {}
    for sid, fs in frames.items():
        for (idx, f) in enumerate(fs):
            step_by_code[f["code"]] = (sid, idx)
    out = []
    if not isinstance(entries, list):
        return out
    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            ctx.err(f"{path}: songbook[{idx}] ต้องเป็น object")
            continue
        e = json.loads(json.dumps(entry, ensure_ascii=False))
        pid = e.get("pageId")
        if pid is not None:
            try:
                pid = int(pid)
            except (TypeError, ValueError):
                ctx.err(f"{path}: songbook[{idx}] pageId ไม่ใช่ตัวเลข")
                pid = None
            if pid is not None and pid not in song_by_id:
                ctx.err(f"{path}: songbook[{idx}] pageId {pid} ไม่มีใน songs.csv")
                pid = None
        if "lyricsRef" in e:
            ref = e.get("lyricsRef")
            try:
                ref = int(ref)
            except (TypeError, ValueError):
                ctx.err(f"{path}: songbook[{idx}] lyricsRef ไม่ใช่ตัวเลข")
                ref = None
            if ref is not None and ref not in song_by_id:
                ctx.err(f"{path}: songbook[{idx}] lyricsRef {ref} ไม่มีใน songs.csv")
                ref = None
            if "lyrics" in e:
                ctx.err(f"{path}: songbook[{idx}] มีทั้ง lyrics และ lyricsRef")
            e = replace_key_in_order(e, "lyricsRef", "lyrics", lyrics.get(ref, []))
            if pid is not None and ref is not None and pid != ref:
                ctx.warn(f"{path}: songbook[{idx}] pageId {pid} ≠ lyricsRef {ref}")
            if ref is not None and "title" in e:
                song_title = song_by_id[ref]["title"]
                if e["title"] != song_title:
                    ctx.warn(
                        f"{path}: songbook[{idx}] title {e['title']!r} "
                        f"ไม่ตรงกับ songs.csv {song_title!r} "
                        f"(แก้ extras.json ถ้าต้องการให้ตรง)"
                    )
        if "stepCode" in e:
            code = str(e.get("stepCode") or "").strip()
            found = step_by_code.get(code)
            if found is None:
                ctx.err(f"{path}: songbook[{idx}] stepCode {code!r} ไม่พบใน frames.csv")
                step_index = 0
            else:
                step_sid, step_index = found
                if pid is not None and step_sid != pid:
                    ctx.err(
                        f"{path}: songbook[{idx}] stepCode {code} "
                        f"อยู่ song {step_sid} ไม่ตรง pageId {pid}"
                    )
            if "stepIndex" in e:
                ctx.err(f"{path}: songbook[{idx}] มีทั้ง stepIndex และ stepCode")
            e = replace_key_in_order(e, "stepCode", "stepIndex", step_index)
        if "stepIndex" in e and pid is not None:
            try:
                si = int(e["stepIndex"])
            except (TypeError, ValueError):
                ctx.err(f"{path}: songbook[{idx}] stepIndex ไม่ใช่ตัวเลข")
                si = 0
            if not (0 <= si < len(frames.get(pid, []))):
                ctx.err(
                    f"{path}: songbook[{idx}] stepIndex {si} "
                    f"เกินจำนวนเฟรมของ song {pid}"
                )
            e["stepIndex"] = si
        out.append(e)
    return out


def build_bundle(ctx, songs, lyrics, frames, grids, extras):
    colors_in = extras.get("colors") or {}
    colors_out = {}
    for hexv in PALETTE:
        item = colors_in.get(hexv) or {}
        colors_out[hexv] = {
            "short": str(item.get("short", "")),
            "name": str(item.get("name", "")),
            "desc": str(item.get("desc", "")),
            "text": str(item.get("text", "#ffffff")),
        }
    songbook = build_songbook(
        ctx, extras.get("songbook") or [], songs, lyrics, frames,
        Path("extras.json"),
    )
    songs_out = []
    report = []
    show_ms = 0.0
    total_frames = 0
    for song in songs:
        sid = song["id"]
        steps = []
        song_ms = 0.0
        song_start = show_ms
        bpm = song["bpm"]
        for f in frames.get(sid, []):
            g = grids.get((sid, f["frame_no"]))
            if g is None or len(g) != 150:
                g = "0" * 150
            step = {
                "code": f["code"],
                "name": f["name"],
                "cue": f["cue"],
                "insight": f["insight"],
                "g": g,
                "beats": num_out(f["beats"]),
                "lyricLine": f["lyric_line"],
                "lyricHighlight": f["highlight"],
            }
            steps.append(step)
            total_frames += 1
            dur_ms = f["beats"] * 60000.0 / bpm
            report.append({
                "song_id": sid,
                "song": song["title"],
                "code": f["code"],
                "name": f["name"],
                "bpm": num_out(bpm),
                "default_beats": num_out(song["default_beats"]),
                "beats": num_out(f["beats"]),
                "frame_ms": round(dur_ms, 3),
                "start_s": round(song_start / 1000.0 + song_ms / 1000.0, 3),
                "duration_s": round(dur_ms / 1000.0, 3),
                "start_mmss": fmt_ms(song_start + song_ms),
                "lyric_line": f["lyric_line"],
            })
            song_ms += dur_ms
        if song_ms < 15000 or song_ms > 300000:
            ctx.warn(
                f"song {sid} ({song['title']}) ยาว {fmt_ms(song_ms)} "
                f"— ตรวจ bpm/default_beats/beats"
            )
        songs_out.append({
            "id": sid,
            "code": song["code"],
            "file": song["file"],
            "title": song["title"],
            "subtitle": song["subtitle"],
            "theme": song["theme"],
            "desc": song["desc"],
            "showCode": song["show_code"],
            "lyrics": lyrics.get(sid, []),
            "notation": song["notation"],
            "rawBlocks": (
                song["raw_blocks"] if song["raw_blocks"] is not None else len(steps)
            ),
            "steps": steps,
            "bpm": num_out(bpm),
        })
        show_ms += song_ms
    if show_ms < 300000 or show_ms > 2400000:
        ctx.warn(f"ไทม์ไลน์รวม {fmt_ms(show_ms)} — ตรวจ bpm/default_beats")
    for row in report:
        if row["frame_ms"] < 1000:
            ctx.warn(
                f"{row['code']} สั้น {row['frame_ms'] / 1000:.1f} s "
                f"(beats={row['beats']} @ {row['bpm']} BPM) — อาจถี่เกินไป"
            )
        elif row["frame_ms"] > 16000:
            ctx.warn(
                f"{row['code']} ยาว {row['frame_ms'] / 1000:.1f} s "
                f"(beats={row['beats']} @ {row['bpm']} BPM) — อาจนานเกินไป"
            )
    for entry in (extras.get("program") or []):
        if not isinstance(entry, dict):
            continue
        code = str(entry.get("code", ""))
        for song in songs:
            if song["code"] == code:
                title = str(entry.get("title") or "")
                song_title = song["title"]
                short_ok = song_title.startswith(title) or title.startswith(song_title)
                if entry.get("file") != song["file"] or (
                    title != song_title and not short_ok
                ):
                    ctx.warn(
                        f"program code {code} ไม่ตรงกับ songs.csv "
                        f"({title!r} vs {song_title!r})"
                    )
                break
    bundle = {
        "meta": {
            "school": extras["meta"]["school"],
            "team": extras["meta"]["team"],
            "cols": COLS,
            "rows": ROWS,
            "palette": PALETTE,
            "chars": CHARS,
            "totalSeats": 150,
        },
        "colors": colors_out,
        "songs": songs_out,
        "show": extras.get("show") or {},
        "songbook": songbook,
        "program": extras.get("program") or [],
        "equipment": extras.get("equipment") or [],
        "typos": extras.get("typos") or [],
    }
    return bundle, report, show_ms, total_frames


def fmt_ms(ms):
    s = max(0, round(ms / 1000.0))
    return f"{s // 60}:{s % 60:02d}"


def bump_cache(index_path, ctx):
    if not index_path.exists():
        ctx.err(f"{index_path}: ไม่พบ index.html")
        return None
    html = index_path.read_text(encoding="utf-8")
    matches = list(CACHE_RE.finditer(html))
    if not matches:
        ctx.err(f"{index_path}: ไม่พบ ?v=YYYYMMDD-N")
        return None
    now = datetime.now(ZoneInfo("Asia/Bangkok")) if ZoneInfo else datetime.now()
    today = now.strftime("%Y%m%d")
    same_day = [int(m.group(2)) for m in matches if m.group(1) == today]
    n = max(same_day) + 1 if same_day else 1
    new_version = f"{today}-{n}"
    html = CACHE_RE.sub(f"?v={new_version}", html)
    index_path.write_text(html, encoding="utf-8")
    return new_version


def write_report(path, report):
    path.parent.mkdir(parents=True, exist_ok=True)
    header = [
        "song_id", "song", "code", "name", "bpm", "default_beats", "beats",
        "frame_ms", "start_s", "duration_s", "start_mmss", "lyric_line",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        for row in report:
            writer.writerow({k: row[k] for k in header})


def print_summary(report, show_ms, total_frames):
    print(f"เพลง {len({r['song_id'] for r in report})} เพลง · {total_frames} เฟรม · "
          f"ไทม์ไลน์รวม {fmt_ms(show_ms)}")
    last_song = None
    for row in report:
        if row["song_id"] != last_song:
            last_song = row["song_id"]
            print(f"  {row['song_id']:>2}. {row['song']} · {row['bpm']} BPM · "
                  f"{row['default_beats']} บีต/เฟรม · เริ่ม {row['start_mmss']}")


def main():
    ap = argparse.ArgumentParser(description="สร้าง app-data.js จาก tools/data/")
    ap.add_argument("--data-dir", default=str(ROOT / "tools/data"))
    ap.add_argument("--out", default=str(ROOT / "assets/data/app-data.js"))
    ap.add_argument("--index", default=str(ROOT / "index.html"))
    ap.add_argument("--no-cache-bust", action="store_true")
    ap.add_argument("--check", action="store_true", help="ตรวจอย่างเดียว ไม่เขียน")
    ap.add_argument("--report-csv", default=str(ROOT / "tools/out/timing-report.csv"))
    ap.add_argument("--no-report", action="store_true")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    ctx = Ctx()
    songs = load_songs(ctx, data_dir / "songs.csv")
    lyrics = load_lyrics(ctx, data_dir / "lyrics.csv", songs)
    frames = load_frames(ctx, data_dir / "frames.csv", songs, lyrics)
    grids = load_grids(ctx, data_dir / "grids.csv", frames)
    extras = load_extras(ctx, data_dir / "extras.json")

    if ctx.errors:
        for msg in ctx.errors:
            print(f"❌ {msg}", file=sys.stderr)
        print(f"\nพบข้อผิดพลาด {len(ctx.errors)} จุด — ยังไม่เขียนไฟล์", file=sys.stderr)
        return 2

    bundle, report, show_ms, total_frames = build_bundle(
        ctx, songs, lyrics, frames, grids, extras
    )
    if ctx.errors:
        for msg in ctx.errors:
            print(f"❌ {msg}", file=sys.stderr)
        print(f"\nพบข้อผิดพลาด {len(ctx.errors)} จุด — ยังไม่เขียนไฟล์", file=sys.stderr)
        return 2

    print_summary(report, show_ms, total_frames)
    print(f"ไทม์ไลน์รวม {show_ms / 1000:.1f} วินาที")
    for msg in ctx.warnings:
        print(f"⚠️  {msg}")

    if not args.no_report and not args.check:
        report_path = Path(args.report_csv)
        write_report(report_path, report)
        print(f"report: {report_path}")

    if args.check:
        print("ตรวจข้อมูลผ่าน (--check ไม่ได้เขียนไฟล์)")
        return 0

    body = json.dumps(bundle, ensure_ascii=False, separators=(",", ":"))
    new_text = "const APP_DATA = " + body + ";\n"
    out_path = Path(args.out)
    old_text = out_path.read_text(encoding="utf-8") if out_path.exists() else ""
    if not out_path.parent.exists():
        ctx.err(f"{out_path.parent}: ไม่พบโฟลเดอร์")
        return 2
    changed = new_text != old_text
    if not changed:
        print("ข้อมูลไม่เปลี่ยน — ไม่เขียน bundle และไม่ bump ?v=")
        return 0
    out_path.write_text(new_text, encoding="utf-8")
    print(f"เขียน {out_path} ({out_path.stat().st_size} bytes)")
    if not args.no_cache_bust:
        version = bump_cache(Path(args.index), ctx)
        if ctx.errors:
            for msg in ctx.errors:
                print(f"❌ {msg}", file=sys.stderr)
            return 2
        print(f"cache-bust: ?v={version}")
        print("⚠️  index.html เป็น bind mount ไฟล์เดี่ยว — รัน: docker compose restart web")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
