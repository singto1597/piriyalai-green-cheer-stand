#!/usr/bin/env python3
"""Verify that rebuilding from tools/data/ preserves the existing bundle.

Checks:
  1. old/new bundles are byte-identical after removing the new timing keys
  2. every frame's lyricLine/lyricHighlight matches the old app.js maps
  3. every one of the 86 × 150 grid cells is unchanged
  4. every timing field is positive/well-typed

Usage:
    cp assets/data/app-data.js /tmp/app-data.before.js
    python3 tools/build_data.py --out /tmp/app-data.new.js --no-cache-bust
    python3 tools/verify_migration.py --old /tmp/app-data.before.js --new /tmp/app-data.new.js
"""
import argparse
import ast
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NEW_KEYS = {"bpm", "beats", "lyricLine", "lyricHighlight"}


def load_bundle(path):
    text = Path(path).read_text(encoding="utf-8")
    m = re.match(r"^const APP_DATA = (.*);\s*$", text, re.S)
    if not m:
        raise SystemExit(f"ไม่พบ const APP_DATA = ...; ใน {path}")
    return json.loads(m.group(1))


def extract_object(app_js, name):
    src = Path(app_js).read_text(encoding="utf-8")
    marker = f"const {name} = "
    try:
        start = src.index(marker) + len(marker)
    except ValueError:
        raise SystemExit(
            f"ไม่พบ {name} ใน {app_js} — สคริปต์นี้ใช้ตรวจตอน migrate เท่านั้น "
            "(ตอนนี้ข้อมูลจริงอยู่ใน tools/data/)"
        ) from None
    end = src.index("\n  };", start) + len("\n  };")
    text = re.sub(r"//[^\n]*", "", src[start:end]).strip()
    if text.endswith(";"):
        text = text[:-1].strip()
    return ast.literal_eval(text)


def strip_timing(bundle):
    out = json.loads(json.dumps(bundle, ensure_ascii=False))
    for song in out["songs"]:
        for key in ("bpm",):
            song.pop(key, None)
        for step in song["steps"]:
            for key in ("beats", "lyricLine", "lyricHighlight"):
                step.pop(key, None)
    return out


def first_diff(a, b, path="$"):
    if type(a) is not type(b):
        return f"{path}: type {type(a).__name__} != {type(b).__name__}"
    if isinstance(a, dict):
        if list(a) != list(b):
            missing = [k for k in a if k not in b]
            extra = [k for k in b if k not in a]
            order = [k for k, k2 in zip(a, b) if k != k2]
            return (f"{path}: key order/content differs "
                    f"(missing={missing}, extra={extra}, order={order[:5]})")
        for key in a:
            d = first_diff(a[key], b[key], f"{path}.{key}")
            if d:
                return d
        return None
    if isinstance(a, list):
        if len(a) != len(b):
            return f"{path}: length {len(a)} != {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)):
            d = first_diff(x, y, f"{path}[{i}]")
            if d:
                return d
        return None
    if a != b:
        return f"{path}: {a!r} != {b!r}"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--old", default="/tmp/app-data.before.js")
    ap.add_argument("--new", default="/tmp/app-data.new.js")
    ap.add_argument("--app-js", default=str(ROOT / "assets/js/app.js"))
    args = ap.parse_args()

    old = load_bundle(args.old)
    new = load_bundle(args.new)
    errors = []

    stripped = strip_timing(new)
    diff = first_diff(old, stripped)
    if diff:
        errors.append(f"bundle ไม่เท่าเดิมหลัง strip timing keys: {diff}")
    else:
        old_json = json.dumps(old, ensure_ascii=False, separators=(",", ":"))
        new_json = json.dumps(stripped, ensure_ascii=False, separators=(",", ":"))
        if old_json != new_json:
            errors.append("bundle JSON ต่างกันทั้งที่ object เท่ากัน (ตรวจ key order)")
        else:
            print(f"✅ bundle เท่าเดิมทุก byte หลังตัด key ใหม่ ({len(old_json)} bytes)")

    old_songs = {s["id"]: s for s in old["songs"]}
    new_songs = {s["id"]: s for s in new["songs"]}
    if list(old_songs) != list(new_songs):
        errors.append(f"song ids ต่างกัน: {list(old_songs)} vs {list(new_songs)}")

    section = extract_object(args.app_js, "LYRIC_SECTION")
    highlight = extract_object(args.app_js, "LYRIC_HIGHLIGHT")

    frames = 0
    cells = 0
    for sid, old_song in old_songs.items():
        new_song = new_songs.get(sid)
        if not new_song:
            continue
        if len(old_song["steps"]) != len(new_song["steps"]):
            errors.append(
                f"song {sid}: จำนวนเฟรม {len(old_song['steps'])} != {len(new_song['steps'])}"
            )
            continue
        bpm = new_song.get("bpm")
        if not isinstance(bpm, (int, float)) or bpm <= 0:
            errors.append(f"song {sid}: bpm ไม่ถูกต้อง ({bpm!r})")
        sec = section.get(sid, [])
        for i, (a, b) in enumerate(zip(old_song["steps"], new_song["steps"])):
            frames += 1
            code = a["code"]
            if a.get("g") != b.get("g"):
                errors.append(f"song {sid} frame {i + 1} ({code}): กริดไม่เท่าเดิม")
            else:
                cells += len(a["g"])
            want_line = (sec[i] + 1) if i < len(sec) and isinstance(sec[i], int) and sec[i] >= 0 else -1
            if b.get("lyricLine") != want_line:
                errors.append(
                    f"song {sid} frame {i + 1} ({code}): lyricLine {b.get('lyricLine')} "
                    f"!= app.js {want_line}"
                )
            want_hl = highlight.get(code, [])
            if b.get("lyricHighlight") != want_hl:
                errors.append(
                    f"song {sid} frame {i + 1} ({code}): lyricHighlight "
                    f"{b.get('lyricHighlight')} != app.js {want_hl}"
                )
            beats = b.get("beats")
            if not isinstance(beats, (int, float)) or beats <= 0:
                errors.append(f"song {sid} frame {i + 1} ({code}): beats ไม่ถูกต้อง ({beats!r})")
    print(f"ตรวจ {frames} เฟรม · กริด {cells} ตัวอักษร · lyricLine/highlight จาก app.js")

    if errors:
        for msg in errors[:40]:
            print(f"❌ {msg}", file=sys.stderr)
        if len(errors) > 40:
            print(f"… และอีก {len(errors) - 40} จุด", file=sys.stderr)
        return 1
    print("✅ migration ผ่านทุกข้อ")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
