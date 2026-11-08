#!/usr/bin/env python3
"""One-time migration: dump the live APP_DATA bundle and app.js lyric maps
into the editable CSV/JSON source files under tools/data/.

Run this BEFORE the new tools/build_data.py is used.  It is not part of the
normal edit/build loop; after migration, tools/data/ is the source of truth.
"""
import argparse
import ast
import csv
import importlib.util
import json
import re
from pathlib import Path

COLS = list("ABCDEFGHIJKLMNO")
ROWS = list(range(10, 0, -1))


def load_bundle(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^const APP_DATA = (.*);\s*$", text, re.S)
    if not m:
        raise SystemExit(f"ไม่พบ const APP_DATA = ...; ใน {path}")
    return json.loads(m.group(1))


def extract_object(app_js: Path, name: str) -> dict:
    src = app_js.read_text(encoding="utf-8")
    marker = f"const {name} = "
    try:
        start = src.index(marker) + len(marker)
    except ValueError:
        raise SystemExit(
            f"ไม่พบ {name} ใน {app_js} — ถ้า migrate เป็น tools/data/ แล้ว "
            "สคริปต์นี้ใช้ไม่ได้อีก (ข้อมูลจริงอยู่ใน tools/data/)"
        ) from None
    end_marker = "\n  };"
    try:
        end = src.index(end_marker, start)
    except ValueError:
        raise SystemExit(f"หา block จบของ {name} ไม่พบ") from None
    text = src[start:end + len("\n  };")]
    text = re.sub(r"//[^\n]*", "", text).strip()
    if text.endswith(";"):
        text = text[:-1].strip()
    try:
        obj = ast.literal_eval(text)
    except (SyntaxError, ValueError) as exc:
        raise SystemExit(f"แปลง {name} ไม่ได้: {exc}") from exc
    if not isinstance(obj, dict):
        raise SystemExit(f"{name} ไม่ใช่ object")
    return obj


def load_old_songs(build_py: Path) -> list:
    spec = importlib.util.spec_from_file_location("old_build_data", build_py)
    if spec is None or spec.loader is None:
        raise SystemExit(f"โหลด {build_py} ไม่ได้")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.SONGS


def write_csv(path: Path, header: list, rows: list):
    with path.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def replace_key_in_order(d: dict, old: str, new: str, value) -> dict:
    out = {}
    for key, val in d.items():
        if key == old:
            out[new] = value
        else:
            out[key] = val
    return out


def main():
    here = Path(__file__).resolve().parent
    root = here.parent
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", default=str(root / "assets/data/app-data.js"))
    ap.add_argument("--app-js", default=str(root / "assets/js/app.js"))
    ap.add_argument("--build-py", default=str(here / "build_data.py"))
    ap.add_argument("--out-dir", default=str(here / "data"))
    args = ap.parse_args()

    bundle = load_bundle(Path(args.bundle))
    lyric_section = extract_object(Path(args.app_js), "LYRIC_SECTION")
    lyric_highlight = extract_object(Path(args.app_js), "LYRIC_HIGHLIGHT")
    old_songs = load_old_songs(Path(args.build_py))

    songs = bundle["songs"]
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    song_rows = []
    lyric_rows = []
    frame_rows = []
    grid_rows = []
    total_frames = 0

    for song in songs:
        sid = song["id"]
        song_rows.append({
            "song_id": sid,
            "code": song["code"],
            "show_code": song["showCode"],
            "title": song["title"],
            "subtitle": song["subtitle"],
            "bpm": 120,
            "default_beats": 16,
            "theme_a": song["theme"][0],
            "theme_b": song["theme"][1],
            "file": song["file"],
            "raw_blocks": song["rawBlocks"],
            "notation": song["notation"],
            "desc": song["desc"],
        })
        for i, text in enumerate(song["lyrics"]):
            lyric_rows.append({"song_id": sid, "line_no": i + 1, "text": text})
        section = lyric_section.get(sid, [])
        for i, st in enumerate(song["steps"]):
            total_frames += 1
            li = section[i] if i < len(section) else -1
            frame_rows.append({
                "song_id": sid,
                "frame_no": i + 1,
                "code": st["code"],
                "name": st["name"],
                "cue": st["cue"],
                "insight": st["insight"],
                "beats": "",
                "lyric_line": (li + 1) if isinstance(li, int) and li >= 0 else "",
                "lyric_highlight": "|".join(lyric_highlight.get(st["code"], [])),
            })
            g = st["g"]
            if len(g) != 150:
                raise SystemExit(f"กริด {st['code']} ยาว {len(g)} (ต้อง 150)")
            for r_i, row_no in enumerate(ROWS):
                cells = g[r_i * 15:(r_i + 1) * 15]
                row = {"song_id": sid, "frame_no": i + 1, "row_no": row_no}
                for c_i, col in enumerate(COLS):
                    row[col] = cells[c_i]
                grid_rows.append(row)

    extras = {
        "meta": {
            "school": bundle["meta"]["school"],
            "team": bundle["meta"]["team"],
        },
        "colors": bundle["colors"],
        "show": bundle["show"],
        "songbook": [],
        "program": bundle["program"],
        "equipment": bundle["equipment"],
        "typos": bundle["typos"],
        "sheetImport": {
            "files": [s["file"] for s in old_songs],
            "order": {str(s["id"]): s["order"] for s in old_songs},
        },
    }

    by_id = {s["id"]: s for s in songs}
    for entry in bundle["songbook"]:
        e = dict(entry)
        pid = e.get("pageId")
        if pid and pid in by_id:
            song = by_id[pid]
            if e.get("lyrics") == song["lyrics"]:
                e = replace_key_in_order(e, "lyrics", "lyricsRef", pid)
            if "stepIndex" in e:
                step_index = e["stepIndex"]
                if 0 <= step_index < len(song["steps"]):
                    code = song["steps"][step_index]["code"]
                    e = replace_key_in_order(e, "stepIndex", "stepCode", code)
        extras["songbook"].append(e)

    write_csv(out_dir / "songs.csv", [
        "song_id", "code", "show_code", "title", "subtitle", "bpm",
        "default_beats", "theme_a", "theme_b", "file", "raw_blocks",
        "notation", "desc",
    ], song_rows)
    write_csv(out_dir / "lyrics.csv", ["song_id", "line_no", "text"], lyric_rows)
    write_csv(out_dir / "frames.csv", [
        "song_id", "frame_no", "code", "name", "cue", "insight", "beats",
        "lyric_line", "lyric_highlight",
    ], frame_rows)
    write_csv(out_dir / "grids.csv", [
        "song_id", "frame_no", "row_no", *COLS,
    ], grid_rows)
    (out_dir / "extras.json").write_text(
        json.dumps(extras, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # Self-check: rebuild the 150-char string from what we just wrote.
    rebuilt = {}
    for row in grid_rows:
        key = (row["song_id"], row["frame_no"])
        rebuilt.setdefault(key, {})[row["row_no"]] = "".join(row[c] for c in COLS)
    for song in songs:
        for i, st in enumerate(song["steps"]):
            key = (song["id"], i + 1)
            text = "".join(rebuilt[key][r] for r in ROWS)
            if text != st["g"]:
                raise SystemExit(f"round-trip กริด {st['code']} ไม่ตรง")

    print(f"songs: {len(song_rows)}")
    print(f"lyrics: {len(lyric_rows)}")
    print(f"frames: {total_frames}")
    print(f"grid rows: {len(grid_rows)}")
    print(f"songbook: {len(extras['songbook'])}")
    print(f"wrote: {out_dir}")


if __name__ == "__main__":
    main()
